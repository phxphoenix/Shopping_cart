import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { handleApiRequest, matchApiRoute, viteApiPlugin } from '../../../src/server/viteApiPlugin';
import { resetRateLimits } from '../../../src/server/auth';
import {
  InMemoryShopRepository,
  resetRepositoryForTesting,
  setRepositoryForTesting,
} from '../../../src/server/repository';

class MockIncomingMessage extends Readable {
  public method = 'GET';
  public url = '/api/state';
  public headers: Record<string, string | string[] | undefined> = {
    host: 'localhost:3000',
  };

  _read() {}

  public pushBody(data: string): void {
    this.push(Buffer.from(data));
    this.push(null);
  }
}

class MockServerResponse extends EventEmitter {
  public statusCode = 200;
  public headers: Record<string, string | string[]> = {};
  public body = '';

  public setHeader(name: string, value: string | string[]): void {
    this.headers[name] = value;
  }

  public end(chunk?: Buffer | string): void {
    if (chunk) {
      this.body = typeof chunk === 'string' ? chunk : chunk.toString('utf8');
    }
    this.emit('finish');
  }
}

describe('Vite API Plugin (src/server/viteApiPlugin.ts)', () => {
  beforeEach(() => {
    resetRateLimits();
    setRepositoryForTesting(new InMemoryShopRepository());
  });

  afterEach(() => {
    resetRateLimits();
    resetRepositoryForTesting();
  });

  describe('Route matching (matchApiRoute)', () => {
    it('matches all known /api routes', () => {
      expect(matchApiRoute('/api/state')).toBeDefined();
      expect(matchApiRoute('/api/admin/session')).toBeDefined();
      expect(matchApiRoute('/api/admin/login')).toBeDefined();
      expect(matchApiRoute('/api/categories')).toBeDefined();
      expect(matchApiRoute('/api/categories/cat-123')).toBeDefined();
      expect(matchApiRoute('/api/categories/migrate')).toBeDefined();
      expect(matchApiRoute('/api/products')).toBeDefined();
      expect(matchApiRoute('/api/products/prod-123')).toBeDefined();
      expect(matchApiRoute('/api/customers')).toBeDefined();
      expect(matchApiRoute('/api/customers/cust-123')).toBeDefined();
      expect(matchApiRoute('/api/orders')).toBeDefined();
      expect(matchApiRoute('/api/orders/ord-123')).toBeDefined();
    });

    it('returns null for unknown paths', () => {
      expect(matchApiRoute('/api/unknown-endpoint')).toBeNull();
      expect(matchApiRoute('/')).toBeNull();
      expect(matchApiRoute('/index.html')).toBeNull();
    });
  });

  describe('handleApiRequest middleware integration', () => {
    it('ignores non-api requests and returns false', async () => {
      const req = new MockIncomingMessage() as unknown as IncomingMessage;
      req.url = '/src/main.tsx';
      const res = new MockServerResponse() as unknown as ServerResponse;

      const handled = await handleApiRequest(req, res, '/');
      expect(handled).toBe(false);
    });

    it('handles GET /api/state request successfully', async () => {
      const req = new MockIncomingMessage() as unknown as IncomingMessage;
      req.method = 'GET';
      req.url = '/api/state';
      const res = new MockServerResponse() as unknown as MockServerResponse;

      (req as unknown as MockIncomingMessage).push(null);
      const handled = await handleApiRequest(req, res as unknown as ServerResponse, '/');
      expect(handled).toBe(true);
      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toContain('application/json');

      const parsed = JSON.parse(res.body);
      expect(parsed.categories).toBeDefined();
      expect(parsed.catalog).toBeDefined();
    });

    it('handles requests with base path prefix (e.g. /my-app/api/categories)', async () => {
      const req = new MockIncomingMessage() as unknown as IncomingMessage;
      req.method = 'GET';
      req.url = '/my-app/api/categories';
      const res = new MockServerResponse() as unknown as MockServerResponse;

      (req as unknown as MockIncomingMessage).push(null);
      const handled = await handleApiRequest(req, res as unknown as ServerResponse, '/my-app/');
      expect(handled).toBe(true);
      expect(res.statusCode).toBe(200);

      const parsed = JSON.parse(res.body);
      expect(Array.isArray(parsed)).toBe(true);
    });

    it('returns 404 for unknown api endpoint', async () => {
      const req = new MockIncomingMessage() as unknown as IncomingMessage;
      req.method = 'GET';
      req.url = '/api/does-not-exist';
      const res = new MockServerResponse() as unknown as MockServerResponse;

      (req as unknown as MockIncomingMessage).push(null);
      const handled = await handleApiRequest(req, res as unknown as ServerResponse, '/');
      expect(handled).toBe(true);
      expect(res.statusCode).toBe(404);
      const parsed = JSON.parse(res.body);
      expect(parsed.error).toContain('Nie odnaleziono endpointu API');
    });

    it('creates Vite plugin instance with configureServer and configurePreviewServer hooks', () => {
      const plugin = viteApiPlugin('/');
      expect(plugin.name).toBe('vite-plugin-retro-crt-api');
      expect(typeof plugin.configureServer).toBe('function');
      expect(typeof plugin.configurePreviewServer).toBe('function');
    });
  });
});
