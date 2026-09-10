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
  public async generateContentWithGemini(prompt: string, context?: string): Promise<string> {
    const apiKey = this.activeAPIKey;
    if (!apiKey) {
      throw new Error('No API key available for AI service');
    }

    const modelsToTry = ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.1-flash-lite'];
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

    contents.push({
      role: 'user',
      parts: [{ text: prompt }]
    });

    const body = {
      contents,
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 4096
      }
    };

    let lastError = '';
    for (const modelName of modelsToTry) {
      try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(body)
        });

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
}

export const apiService = APIService.shared;
