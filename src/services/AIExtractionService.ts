import { LOW_CONFIDENCE_THRESHOLD } from './ParseConfidence';

export interface PageText {
  pageNumber: number;
  text: string;
}

export interface AIExtractionOptions {
  score: number;
  apiKey: string | null;
  consent: boolean;
  pages?: PageText[];
  onDeviceFallback?: {
    weeks?: any[];
    readings?: any[];
    assignments?: any[];
  };
}

export interface AIExtractionResult {
  weeks: any[];
  readings: any[];
  assignments: any[];
  usedFallbackForFailedChunks?: boolean;
}

export const MODEL_CHAIN = [
  'gemini-3.8-flash',
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite'
];

/**
 * Validates that the AI response matches the expected course schema.
 */
function validateAISchema(json: any): void {
  if (!json || typeof json !== 'object') {
    throw new Error('AI response does not conform to schema: not an object');
  }
  if (!Array.isArray(json.weeks) && !Array.isArray(json.readings) && !Array.isArray(json.assignments)) {
    throw new Error('AI response does not conform to schema: missing weeks, readings, or assignments arrays');
  }
}

/**
 * Gated AI extraction service (Layer 4).
 * Fires ONLY when score < 60 AND apiKey is present AND consent is true.
 * Processes pages in chunks of at most 5 pages.
 */
export async function runAIExtractionIfNeeded(
  options: AIExtractionOptions,
  fetchFn: typeof fetch = fetch
): Promise<AIExtractionResult | null> {
  // 1. Strict Gating Rules
  if (options.score >= LOW_CONFIDENCE_THRESHOLD) {
    return null;
  }
  if (!options.apiKey || !options.consent) {
    return null;
  }

  const pages = options.pages || [];
  if (pages.length === 0) {
    return null;
  }

  // 2. Page Chunking (max 5 pages per call)
  const CHUNK_SIZE = 5;
  const chunks: PageText[][] = [];
  for (let i = 0; i < pages.length; i += CHUNK_SIZE) {
    chunks.push(pages.slice(i, i + CHUNK_SIZE));
  }

  const combinedWeeks: any[] = [];
  const combinedReadings: any[] = [];
  const combinedAssignments: any[] = [];
  let usedFallback = false;

  for (const chunk of chunks) {
    const chunkText = chunk.map(p => `--- PAGE ${p.pageNumber} ---\n${p.text}`).join('\n\n');
    let chunkSuccess = false;

    // Try model chain with retries
    for (const model of MODEL_CHAIN) {
      if (chunkSuccess) break;

      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${options.apiKey}`;
          const prompt = `Extract all syllabus coursework from the following text chunk.\n` +
            `Respond with ONLY a valid JSON object matching this schema, with no markdown fences:\n` +
            `{\n` +
            `  "weeks": [{ "weekNumber": 1, "theme": "..." }],\n` +
            `  "readings": [{ "title": "...", "weekNumber": 1 }],\n` +
            `  "assignments": [{ "title": "...", "weightPercentage": "..." }]\n` +
            `}\n\n` +
            `Text:\n${chunkText}`;

          const res = await fetchFn(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                temperature: 0.1
              }
            })
          });

          if (!res.ok) {
            continue;
          }

          const data = await res.json();
          let parsedJson: any = data;

          if (data?.candidates?.[0]?.content?.parts?.[0]?.text) {
            const rawReply = data.candidates[0].content.parts[0].text.trim().replace(/^```json\s*|^```\s*|```$/g, '');
            parsedJson = JSON.parse(rawReply);
          }

          validateAISchema(parsedJson);

          if (Array.isArray(parsedJson.weeks)) combinedWeeks.push(...parsedJson.weeks);
          if (Array.isArray(parsedJson.readings)) combinedReadings.push(...parsedJson.readings);
          if (Array.isArray(parsedJson.assignments)) combinedAssignments.push(...parsedJson.assignments);

          chunkSuccess = true;
          break;
        } catch (err: any) {
          if (err?.message?.includes('schema')) {
            throw err;
          }
          // Retry on network/timeout error
        }
      }
    }

    if (!chunkSuccess) {
      usedFallback = true;
      if (options.onDeviceFallback) {
        if (options.onDeviceFallback.weeks) combinedWeeks.push(...options.onDeviceFallback.weeks);
        if (options.onDeviceFallback.readings) combinedReadings.push(...options.onDeviceFallback.readings);
        if (options.onDeviceFallback.assignments) combinedAssignments.push(...options.onDeviceFallback.assignments);
      }
    }
  }

  // Deduplicate merged results
  return {
    weeks: combinedWeeks,
    readings: combinedReadings,
    assignments: combinedAssignments,
    ...(usedFallback ? { usedFallbackForFailedChunks: true } : {})
  };
}
