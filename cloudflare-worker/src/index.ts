/**
 * CoursePal Cloudflare AI Shield & Proxy
 * Securely proxies syllabus extraction requests to Google Gemini,
 * keeping your Gemini API key 100% private and protected from mobile clients.
 */

export interface Env {
  GEMINI_API_KEY: string;
  ENVIRONMENT?: string;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-CoursePal-Client',
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // 1. Handle CORS Pre-flight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: CORS_HEADERS,
      });
    }

    // 2. Public Legal & Compliance Web Pages (Apple App Store & Canadian PIPEDA compliant)
    if (url.pathname === '/privacy') {
      const { renderPrivacyPolicyHtml } = await import('./legalPages');
      return new Response(renderPrivacyPolicyHtml(), {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }

    if (url.pathname === '/terms' || url.pathname === '/legal') {
      const { renderTermsOfServiceHtml } = await import('./legalPages');
      return new Response(renderTermsOfServiceHtml(), {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }

    // 3. Health check endpoint
    if (url.pathname === '/' || url.pathname === '/health') {
      return new Response(
        JSON.stringify({
          status: 'ok',
          service: 'CoursePal AI Proxy & Legal Services',
          jurisdiction: 'Canada',
          privacyPolicy: `${url.origin}/privacy`,
          termsOfService: `${url.origin}/terms`,
        }),
        {
          status: 200,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        }
      );
    }

    // 3. Syllabus parsing endpoint
    if (url.pathname === '/api/syllabi/parse' || url.pathname === '/parse') {
      if (request.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
          status: 405,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }

      try {
        const body: any = await request.json();
        const { prompt, rawText, base64Pdf, base64Images, fileName } = body;

        const apiKey = env.GEMINI_API_KEY;
        if (!apiKey) {
          return new Response(
            JSON.stringify({ error: 'Worker GEMINI_API_KEY secret is not configured' }),
            {
              status: 500,
              headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
            }
          );
        }

        const userParts: any[] = [];

        // Include text context if present
        if (rawText && typeof rawText === 'string' && rawText.trim().length > 0) {
          userParts.push({
            text: `SYLLABUS DOCUMENT TEXT CONTENT:\n${rawText.slice(0, 150000)}`,
          });
        }

        // Include PDF or images if provided
        let hasInlineDoc = false;
        if (base64Pdf && typeof base64Pdf === 'string' && base64Pdf.length < 5000000) {
          const isPng = base64Pdf.startsWith('iVBOR');
          const isJpg = base64Pdf.startsWith('/9j/');
          const isPdf = base64Pdf.startsWith('JVBER');
          if (isPng || isJpg || isPdf) {
            const mime = isPng ? 'image/png' : isJpg ? 'image/jpeg' : 'application/pdf';
            userParts.push({
              inlineData: {
                mimeType: mime,
                data: base64Pdf,
              },
            });
            hasInlineDoc = true;
          }
        }

        // Include rendered page images if provided (e.g. for docx converted pages or multi-page documents)
        if (!hasInlineDoc && Array.isArray(base64Images) && base64Images.length > 0) {
          for (const b64Img of base64Images.slice(0, 10)) {
            if (!b64Img || b64Img.length < 20) continue;
            const isPng = b64Img.startsWith('iVBOR');
            const mime = isPng ? 'image/png' : 'image/jpeg';
            userParts.push({
              inlineData: {
                mimeType: mime,
                data: b64Img,
              },
            });
          }
        }

        userParts.push({ text: prompt || 'Extract course syllabus into JSON.' });

        const contents = [{ role: 'user', parts: userParts }];
        const isJsonPrompt = (prompt || '').toLowerCase().includes('json');

        const geminiBody = {
          contents,
          generationConfig: {
            temperature: 0.0,
            maxOutputTokens: 8192,
            ...(isJsonPrompt ? { responseMimeType: 'application/json' } : {}),
          },
        };

        const modelsToTry = [
          'gemini-3.5-flash-lite',
          'gemini-3.6-flash',
          'gemini-3.1-flash-lite',
        ];

        let lastError = '';
        for (const model of modelsToTry) {
          const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(geminiBody),
          });

          if (response.ok) {
            const data: any = await response.json();
            const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
            return new Response(text, {
              status: 200,
              headers: {
                ...CORS_HEADERS,
                'Content-Type': 'application/json',
                'X-Provider-Model': model,
              },
            });
          }

          const err = await response.text();
          lastError = `Gemini (${response.status}): ${err.slice(0, 300)}`;
          if (response.status === 400 || response.status === 401 || response.status === 403) {
            break;
          }
        }

        return new Response(JSON.stringify({ error: lastError || 'AI extraction failed' }), {
          status: 502,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err?.message || 'Bad Request' }), {
          status: 400,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }
    }

    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  },
};
