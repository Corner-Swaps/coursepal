/**
 * CoursePal Legal & Compliance Services
 * Serves public legal and privacy compliance web pages for Apple App Store & Canadian PIPEDA compliance.
 * 100% on-device app architecture with zero remote syllabus parsing.
 */

export interface Env {
  ENVIRONMENT?: string;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-CoursePal-Client',
};

export default {
  async fetch(request: Request, _env: Env): Promise<Response> {
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
          service: 'CoursePal Legal & Compliance Services',
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

    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  },
};
