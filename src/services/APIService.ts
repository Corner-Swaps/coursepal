/**
 * APIService
 * 1:1 Parity with native Swift APIService.swift
 * Handles syllabus AI extraction, course chat, and synchronization
 * using the bundled Gemini 2.5 Flash API credentials.
 */

export class APIService {
  private static instance: APIService;

  public static get bundledAPIKey(): string {
    const encoded = 'QVEuQWI4Uk42TDlyVzFxZ3NlVDBNS1R2V3JqVUdiU0tQVEhja1dtOE9oWFdLLWNETVh2Q3c=';
    try {
      if (typeof atob !== 'undefined') {
        return atob(encoded);
      }
      if (typeof Buffer !== 'undefined') {
        return Buffer.from(encoded, 'base64').toString('utf-8');
      }
    } catch {
      // Fallback
    }
    return '';
  }

  public get activeAPIKey(): string {
    return APIService.bundledAPIKey;
  }

  public static get shared(): APIService {
    if (!APIService.instance) {
      APIService.instance = new APIService();
    }
    return APIService.instance;
  }

  /**
   * Calls Gemini 3.6 Flash generateContent API endpoint with resilient fallback
   */
  public async generateContentWithGemini(prompt: string, context?: string, base64Pdf?: string): Promise<string> {
    const apiKey = this.activeAPIKey;
    if (!apiKey) {
      throw new Error('No API key available for AI service');
    }

    const modelsToTry = ['gemini-flash-lite-latest', 'gemini-3-flash-preview', 'gemini-flash-latest'];

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
    if (base64Pdf) {
      userParts.push({
        inlineData: {
          mimeType: 'application/pdf',
          data: base64Pdf
        }
      });
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
        temperature: 0.1,
        maxOutputTokens: 8192,
        ...(isJsonPrompt ? { responseMimeType: 'application/json' } : {})
      }
    };

    let lastError = '';
    for (const modelName of modelsToTry) {
      try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 45000);

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
        lastError = `Gemini API error (${response.status}): ${errText}`;
      } catch (err: any) {
        lastError = err.message;
      }
    }

    throw new Error(lastError || 'Failed to generate content with Gemini API');
  }

  /**
   * Generates 4-5 actionable study milestones for an assignment matching Swift APIService
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
