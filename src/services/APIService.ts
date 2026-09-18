/**
 * APIService
 * Handles syllabus AI extraction, study plan generation, and synchronization.
 * Uses authenticated server-side endpoint in production with no bundled provider secrets.
 */

export interface DiagnosticProvenance {
  diagnosticImportId?: string;
  documentHash?: string;
  receivedByteCount?: number;
  parserSource: 'PROVIDER_AI' | 'BACKEND_FALLBACK' | 'LOCAL_DEVICE_FALLBACK';
  providerModel?: string | null;
  status: string;
}

export class APIService {
  private static instance: APIService;
  private customApiKey: string | null = null;
  private serverProxyUrl: string | null = null;
  private lastDiagnostic: DiagnosticProvenance | null = null;

  private constructor() {}

  public static get shared(): APIService {
    if (!APIService.instance) {
      APIService.instance = new APIService();
    }
    return APIService.instance;
  }

  /**
   * Configures custom runtime key (only for local testing/debugging; never bundled into app)
   */
  public setCustomApiKey(key: string | null): void {
    this.customApiKey = key;
  }

  /**
   * Configures backend proxy URL
   */
  public static get bundledProxyUrl(): string | null {
    return (
      (typeof process !== 'undefined' && process.env && (process.env.EXPO_PUBLIC_AI_PROXY_URL || process.env.AI_PROXY_URL)) ||
      null
    );
  }

  public get activeProxyUrl(): string | null {
    return this.serverProxyUrl || APIService.bundledProxyUrl;
  }

  public static get bundledAPIKey(): string | null {
    return (
      (typeof process !== 'undefined' && process.env && (process.env.EXPO_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY)) ||
      null
    );
  }

  public get activeAPIKey(): string | null {
    return this.customApiKey || APIService.bundledAPIKey;
  }

  public getLastDiagnostic(): DiagnosticProvenance | null {
    return this.lastDiagnostic;
  }

  /**
   * Calls AI generateContent endpoint via Cloudflare proxy or direct Gemini API
   * with bounded retries and timeout guards.
   */
  public async generateContentWithGemini(
    prompt: string,
    context?: string,
    base64Pdf?: string,
    base64Images?: string[],
    fileName?: string
  ): Promise<string> {
    const proxyUrl = this.activeProxyUrl;
    if (proxyUrl) {
      try {
        return await this.callServerSideProxy(prompt, context, base64Pdf, base64Images, fileName);
      } catch (proxyErr) {
        console.warn('Cloudflare proxy request failed, falling back to direct Gemini API:', proxyErr);
      }
    }

    const apiKey = this.activeAPIKey;
    if (!apiKey) {
      this.lastDiagnostic = {
        parserSource: 'LOCAL_DEVICE_FALLBACK',
        status: 'FALLBACK',
        providerModel: null
      };
      throw new Error('No AI provider API key or server proxy configured; falling back to local extraction');
    }
    const modelsToTry = [
      'gemini-3.5-flash-lite',
      'gemini-3.6-flash',
      'gemini-3.1-flash-lite',
      'gemini-3-flash-preview'
    ];

    const userParts: any[] = [];

    // Include text context if available
    if (context && context.trim().length > 0) {
      userParts.push({
        text: `SYLLABUS DOCUMENT TEXT CONTENT:\n${context.slice(0, 150000)}`
      });
    }

    // Binary PDF or image input
    if (base64Pdf) {
      const isPng = base64Pdf.startsWith('iVBOR');
      const isJpg = base64Pdf.startsWith('/9j/');
      const isPdf = base64Pdf.startsWith('JVBER');
      if (isPng || isJpg || isPdf) {
        const mime = isPng ? 'image/png' : (isJpg ? 'image/jpeg' : 'application/pdf');
        // Include PDF data if under 4MB
        if (base64Pdf.length < 5000000) {
          userParts.push({
            inlineData: {
              mimeType: mime,
              data: base64Pdf
            }
          });
        }
      }
    } else if (base64Images && base64Images.length > 0) {
      // Send up to 10 rendered page images
      const imagesToSend = base64Images.slice(0, 10);
      for (const b64Img of imagesToSend) {
        if (!b64Img || b64Img.length < 20) continue;
        const isPng = b64Img.startsWith('iVBOR');
        const mime = isPng ? 'image/png' : 'image/jpeg';
        userParts.push({
          inlineData: {
            mimeType: mime,
            data: b64Img
          }
        });
      }
    }

    userParts.push({ text: prompt });

    const contents = [
      {
        role: 'user',
        parts: userParts
      }
    ];

    const isJsonPrompt = prompt.toLowerCase().includes('json');
    const body: any = {
      contents,
      generationConfig: {
        temperature: 0.0,
        maxOutputTokens: 8192,
        ...(isJsonPrompt ? { responseMimeType: 'application/json' } : {})
      }
    };

    let lastError = '';
    for (const modelName of modelsToTry) {
      try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // Bounded 30s timeout

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(body),
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (response.ok) {
          const result = await response.json();
          const candidate = result.candidates?.[0];
          const textPart = candidate?.content?.parts?.[0]?.text;
          this.lastDiagnostic = {
            diagnosticImportId: `direct-${Date.now()}`,
            parserSource: 'PROVIDER_AI',
            providerModel: modelName,
            status: 'SUCCESS'
          };
          return textPart || '';
        }

        const errText = await response.text();
        lastError = `AI service error (${response.status}): ${this.sanitizeError(errText)}`;
        // Fast-fail on auth errors
        if (response.status === 400 || response.status === 401 || response.status === 403) {
          break;
        }
      } catch (err: any) {
        lastError = this.sanitizeError(err.message || 'Network request failed');
      }
    }

    throw new Error(lastError || 'Failed to generate content with AI service');
  }

  /**
   * Calls secure server-side proxy if a proxy URL has been explicitly configured
   */
  private async callServerSideProxy(
    prompt: string,
    context?: string,
    base64Pdf?: string,
    base64Images?: string[],
    fileName?: string
  ): Promise<string> {
    const proxyUrl = this.activeProxyUrl;
    if (!proxyUrl) {
      this.lastDiagnostic = {
        parserSource: 'LOCAL_DEVICE_FALLBACK',
        status: 'FALLBACK',
        providerModel: null
      };
      throw new Error('AI parsing unavailable: No Gemini API key or backend proxy configured.');
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(proxyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompt,
          rawText: context,
          base64Pdf,
          base64Images,
          fileName
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        this.lastDiagnostic = {
          diagnosticImportId: data.diagnosticImportId,
          documentHash: data.documentHash,
          receivedByteCount: data.receivedByteCount,
          parserSource: data.parserSource || 'BACKEND_FALLBACK',
          providerModel: data.providerModel || null,
          status: 'SUCCESS'
        };
        return typeof data === 'string' ? data : JSON.stringify(data);
      }

      const errText = await response.text();
      throw new Error(`Server (${response.status}): ${this.sanitizeError(errText)}`);
    } catch (err: any) {
      this.lastDiagnostic = {
        parserSource: 'LOCAL_DEVICE_FALLBACK',
        status: 'FALLBACK',
        providerModel: null
      };
      throw new Error(`Server-side AI parsing unavailable: ${this.sanitizeError(err.message || 'Network request failed')}`);
    }
  }

  /**
   * Sanitizes error messages by stripping API keys and query strings
   */
  private sanitizeError(errStr: string): string {
    return errStr
      .replace(/[?&]key=[^&\s]+/gi, '?key=[REDACTED]')
      .replace(/AIza[0-9A-Za-z-_]{35}/g, '[REDACTED]');
  }

  /**
   * Generates actionable study milestones for an assignment
   */
  public async generateAssignmentMilestones(
    title: string,
    instructions?: string | null,
    weight?: string | null,
    points?: string | null,
    rubric: string[] = []
  ): Promise<string[]> {
    const prompt = `You are CoursePal Study Plan AI. Break down the university assignment into 4 to 5 chronological, actionable study milestones.
Return ONLY a JSON array of strings, e.g. ["Step 1...", "Step 2...", "Step 3...", "Step 4..."].
Each step should start with an action verb and be concise (under 15 words).

Assignment Title: ${title}
Weight: ${weight || 'N/A'}
Points: ${points || 'N/A'}
Instructions: ${instructions || 'Standard course assignment'}
Rubric Breakdown: ${rubric.join(', ') || 'Standard academic criteria'}

Output ONLY valid JSON array.`;

    try {
      const response = await this.generateContentWithGemini(prompt);
      let cleanJson = response.trim();
      if (cleanJson.startsWith('```')) {
        cleanJson = cleanJson.split('\n').slice(1).join('\n');
        if (cleanJson.endsWith('```')) cleanJson = cleanJson.slice(0, -3).trim();
      }
      const parsed = JSON.parse(cleanJson);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(s => String(s).trim());
      }
    } catch {
      // Fallback
    }

    return [
      'Review assignment guidelines & rubric criteria',
      'Research topic & gather 5+ peer-reviewed sources',
      'Draft initial outline and structure key arguments',
      'Write complete first draft with APA formatting',
      'Proofread, refine citations, and submit final version'
    ];
  }
}

export const apiService = APIService.shared;
