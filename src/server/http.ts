/**
 * Server HTTP Utilities for Web API Request/Response Handlers
 */

export function jsonResponse(data: unknown, status = 200, headersInit?: HeadersInit): Response {
  const headers = new Headers(headersInit);
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json; charset=utf-8');
  }

  return new Response(JSON.stringify(data), {
    status,
    headers,
  });
}

export function errorResponse(message: string, status = 400, headersInit?: HeadersInit): Response {
  return jsonResponse({ error: message }, status, headersInit);
}

export async function parseJsonBody<T = unknown>(request: Request): Promise<T | null> {
  try {
    const text = await request.text();
    if (!text || text.trim().length === 0) {
      return null;
    }
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

/**
 * Extracts an ID from query parameters (?id=...), trailing path segment, or JSON body.
 */
export function extractResourceId(request: Request, body?: { id?: string } | null): string | null {
  const url = new URL(request.url, 'http://localhost');
  const queryId = url.searchParams.get('id');
  if (queryId && queryId.trim().length > 0) {
    return queryId.trim();
  }

  if (body?.id && typeof body.id === 'string' && body.id.trim().length > 0) {
    return body.id.trim();
  }

  // Trailing path segment if URL is /api/customers/:id
  const segments = url.pathname.split('/').filter(Boolean);
  const last = segments[segments.length - 1];
  if (last && !['customers', 'products', 'categories', 'orders'].includes(last)) {
    return decodeURIComponent(last);
  }

  return null;
}
