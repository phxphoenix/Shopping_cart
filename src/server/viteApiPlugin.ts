/**
 * Vite Dev & Preview Plugin for /api/* Routes
 *
 * Intercepts /api/* requests during `vite dev` and `vite preview`,
 * bridges Node.js IncomingMessage / ServerResponse to standard Web API Request / Response,
 * invokes the matching handler from api/, and transmits the Response with Set-Cookie headers.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin, PreviewServer, ViteDevServer } from 'vite';

import * as adminLoginHandler from '../../api/admin/login';
import * as adminSessionHandler from '../../api/admin/session';
import * as categoriesHandler from '../../api/categories';
import * as categoriesMigrateHandler from '../../api/categories/migrate';
import * as customersHandler from '../../api/customers';
import * as ordersHandler from '../../api/orders';
import * as productsHandler from '../../api/products';
import * as stateHandler from '../../api/state';

type RouteHandlerModule = {
  GET?: (req: Request) => Promise<Response>;
  POST?: (req: Request) => Promise<Response>;
  PUT?: (req: Request) => Promise<Response>;
  DELETE?: (req: Request) => Promise<Response>;
  PATCH?: (req: Request) => Promise<Response>;
};

export function matchApiRoute(pathname: string): RouteHandlerModule | null {
  // Normalize path without trailing slash
  const clean = pathname.replace(/\/+$/, '') || '/';

  if (clean === '/api/state') {
    return stateHandler;
  }
  if (clean === '/api/admin/session') {
    return adminSessionHandler;
  }
  if (clean === '/api/admin/login') {
    return adminLoginHandler;
  }
  if (clean === '/api/categories/migrate') {
    return categoriesMigrateHandler;
  }
  if (clean === '/api/categories' || clean.startsWith('/api/categories/')) {
    return categoriesHandler;
  }
  if (clean === '/api/products' || clean.startsWith('/api/products/')) {
    return productsHandler;
  }
  if (clean === '/api/customers' || clean.startsWith('/api/customers/')) {
    return customersHandler;
  }
  if (clean === '/api/orders' || clean.startsWith('/api/orders/')) {
    return ordersHandler;
  }

  return null;
}

export async function handleApiRequest(
  req: IncomingMessage,
  res: ServerResponse,
  basePath = '/'
): Promise<boolean> {
  const host = req.headers.host || 'localhost';
  const fullUrl = new URL(req.url ?? '/', `http://${host}`);
  let pathname = fullUrl.pathname;

  // Strip base prefix if configured (e.g. /my-app/)
  if (basePath !== '/' && pathname.startsWith(basePath)) {
    pathname = '/' + pathname.slice(basePath.length).replace(/^\/+/, '');
  }

  if (!pathname.startsWith('/api')) {
    return false;
  }

  const handlerModule = matchApiRoute(pathname);
  if (!handlerModule) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: `Nie odnaleziono endpointu API: ${pathname}` }));
    return true;
  }

  const method = (req.method ?? 'GET').toUpperCase();
  const handlerFn = handlerModule[method as keyof RouteHandlerModule];

  if (!handlerFn) {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: `Metoda ${method} nie jest obsługiwana dla ${pathname}.` }));
    return true;
  }

  try {
    // Read body buffer
    const chunks: Uint8Array[] = [];
    if (typeof (req as unknown as AsyncIterable<unknown>)[Symbol.asyncIterator] === 'function') {
      for await (const chunk of req) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : (chunk as Uint8Array));
      }
    } else {
      await new Promise<void>((resolve) => {
        req.on('data', (chunk) => {
          chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : (chunk as Uint8Array));
        });
        req.on('end', () => resolve());
      });
    }
    const bodyBuffer = Buffer.concat(chunks);

    // Build Web API Headers
    const headers = new Headers();
    for (const [key, val] of Object.entries(req.headers)) {
      if (val === undefined) continue;
      if (Array.isArray(val)) {
        for (const v of val) {
          headers.append(key, v);
        }
      } else {
        headers.set(key, val);
      }
    }

    const hasBody = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method) && bodyBuffer.length > 0;

    const webRequest = new Request(fullUrl.toString(), {
      method,
      headers,
      body: hasBody ? bodyBuffer : undefined,
    });

    const response = await handlerFn(webRequest);

    res.statusCode = response.status;

    // Preserve Set-Cookie correctly
    const getSetCookieFn = (response.headers as unknown as { getSetCookie?: () => string[] })
      .getSetCookie;
    if (typeof getSetCookieFn === 'function') {
      const cookies = getSetCookieFn.call(response.headers);
      if (cookies.length > 0) {
        res.setHeader('Set-Cookie', cookies);
      }
    } else {
      const singleCookie = response.headers.get('set-cookie');
      if (singleCookie) {
        res.setHeader('Set-Cookie', singleCookie);
      }
    }

    // Copy other response headers
    response.headers.forEach((value, name) => {
      if (name.toLowerCase() !== 'set-cookie') {
        res.setHeader(name, value);
      }
    });

    const arrayBuf = await response.arrayBuffer();
    res.end(Buffer.from(arrayBuf));
    return true;
  } catch (error) {
    console.error(`Vite API Plugin Error [${method} ${pathname}]:`, error);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: 'Wewnętrzny błąd serwera lokalnego API Vite.' }));
    return true;
  }
}

export function viteApiPlugin(basePath = '/'): Plugin {
  return {
    name: 'vite-plugin-retro-crt-api',
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (req, res, next) => {
        const handled = await handleApiRequest(req, res, basePath);
        if (!handled) {
          next();
        }
      });
    },
    configurePreviewServer(server: PreviewServer) {
      server.middlewares.use(async (req, res, next) => {
        const handled = await handleApiRequest(req, res, basePath);
        if (!handled) {
          next();
        }
      });
    },
  };
}
