/**
 * APIService
 * Handles syllabus AI extraction, study plan generation, and synchronization.
 * Uses authenticated server-side endpoint in production with no bundled provider secrets.
 */

export class APIService {
  private static instance: APIService;
  private customApiKey: string | null = null;
  private serverProxyUrl: string = 'http://localhost:3088/api/syllabi/parse';

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
  public setServerProxyUrl(url: string): void {
    this.serverProxyUrl = url;
  }

  public get activeAPIKey(): string | null {
    return this.customApiKey;
  }

  /**
   * Calls AI generateContent endpoint via server-side proxy or authenticated key
   * with bounded retries and timeout guards.
   */
  public async generateContentWithGemini(
    prompt: string,
    context?: string,
    base64Pdf?: string,
    base64Images?: string[]
  ): Promise<string> {
    const apiKey = this.activeAPIKey;

    // If no direct API key is set, attempt server-side proxy endpoint
    if (!apiKey) {
      return this.callServerSideProxy(prompt, context, base64Pdf, base64Images);
    }

    // Direct Gemini API call with bounded retries & sanitized errors
    const modelsToTry = [
      'gemini-2.5-flash',
      'gemini-1.5-flash'
    ];

    const contents: any[] = [];
    if (context) {
      contents.push({
        role: 'user',
        parts: [{ text: `Context:\n${context}` }]
      });
      contents.push({
        role: 'model',
        parts: [{ text: 'Understood. I have reviewed the course context.' }]
      });
    }

    const userParts: any[] = [];

    // Binary PDF or image input
    if (base64Pdf) {
      const isPng = base64Pdf.startsWith('iVBOR');
      const isJpg = base64Pdf.startsWith('/9j/');
      const isPdf = base64Pdf.startsWith('JVBER');
      if (isPng || isJpg || isPdf) {
        const mime = isPng ? 'image/png' : (isJpg ? 'image/jpeg' : 'application/pdf');
        userParts.push({
          inlineData: {
            mimeType: mime,
            data: base64Pdf
          }
        });
      }
    } else if (base64Images && base64Images.length > 0) {
      for (const b64Img of base64Images) {
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

    contents.push({
      role: 'user',
      parts: userParts
    });

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
        const timeoutId = setTimeout(() => controller.abort(), 15000); // Bounded 15s timeout

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
   * Calls secure server-side proxy
   */
  private async callServerSideProxy(
    prompt: string,
    context?: string,
    base64Pdf?: string,
    base64Images?: string[]
  ): Promise<string> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);

      const response = await fetch(this.serverProxyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompt,
          rawText: context,
          base64Pdf,
          base64Images
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        return typeof data === 'string' ? data : JSON.stringify(data);
      }
      throw new Error(`Server returned status ${response.status}`);
    } catch (err: any) {
      throw new Error(`Server-side AI parsing unavailable: ${this.sanitizeError(err.message)}`);
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
