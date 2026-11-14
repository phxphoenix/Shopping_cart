import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  checkRateLimit,
  clearRateLimit,
  createAdminSessionToken,
  createClearSessionCookie,
  createSessionCookie,
  getAdminPassword,
  getClientIp,
  getSessionTokenFromRequest,
  isAdminRequest,
  resetRateLimits,
  verifyAdminPassword,
  verifyAdminSessionToken,
} from '../../../src/server/auth';

describe('Server Auth & Rate Limiting Module', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    resetRateLimits();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    resetRateLimits();
  });

  describe('Admin password verification', () => {
    it('uses "admin123" fallback in development and testing environments', () => {
      delete process.env.ADMIN_PASSWORD;
      process.env.NODE_ENV = 'development';
      expect(getAdminPassword()).toBe('admin123');
      expect(verifyAdminPassword('admin123')).toBe(true);
      expect(verifyAdminPassword('wrong-password')).toBe(false);
    });

    it('uses configured ADMIN_PASSWORD when provided', () => {
      process.env.ADMIN_PASSWORD = 'super-secret-retro-key-2026';
      expect(getAdminPassword()).toBe('super-secret-retro-key-2026');
      expect(verifyAdminPassword('super-secret-retro-key-2026')).toBe(true);
      expect(verifyAdminPassword('admin123')).toBe(false);
    });

    it('disallows login when ADMIN_PASSWORD is unset in production', () => {
      delete process.env.ADMIN_PASSWORD;
      delete process.env.ALLOW_DEFAULT_ADMIN_PASSWORD;
      process.env.NODE_ENV = 'production';

      expect(getAdminPassword()).toBe('');
      expect(verifyAdminPassword('admin123')).toBe(false);
      expect(verifyAdminPassword('')).toBe(false);
    });

    it('rejects empty candidate passwords', () => {
      process.env.ADMIN_PASSWORD = 'test-password';
      expect(verifyAdminPassword('')).toBe(false);
    });
  });

  describe('HMAC-SHA256 session token generation and verification', () => {
    it('creates a valid session token that verifies successfully', () => {
      const token = createAdminSessionToken(3600);
      expect(token).toContain('.');
      expect(verifyAdminSessionToken(token)).toBe(true);
    });

    it('rejects tampered tokens', () => {
      const token = createAdminSessionToken(3600);
      const [payload, signature] = token.split('.');
      const tampered = `${payload}.${signature}tampered`;
      expect(verifyAdminSessionToken(tampered)).toBe(false);
    });

    it('rejects expired tokens', () => {
      // Create a token expired 10 seconds ago
      const expiredToken = createAdminSessionToken(-10);
      expect(verifyAdminSessionToken(expiredToken)).toBe(false);
    });

    it('rejects invalid or null tokens', () => {
      expect(verifyAdminSessionToken('')).toBe(false);
      expect(verifyAdminSessionToken(null)).toBe(false);
      expect(verifyAdminSessionToken(undefined)).toBe(false);
      expect(verifyAdminSessionToken('invalid.token.structure')).toBe(false);
    });
  });

  describe('Session extraction and isAdminRequest', () => {
    it('authenticates via HttpOnly cookie', () => {
      const token = createAdminSessionToken(3600);
      const request = new Request('http://localhost/api/admin/session', {
        headers: {
          Cookie: `other_cookie=123; retro_admin_session=${token}; theme=dark`,
        },
      });

      expect(getSessionTokenFromRequest(request)).toBe(token);
      expect(isAdminRequest(request)).toBe(true);
    });

    it('authenticates via Authorization Bearer header', () => {
      const token = createAdminSessionToken(3600);
      const request = new Request('http://localhost/api/categories', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      expect(getSessionTokenFromRequest(request)).toBe(token);
      expect(isAdminRequest(request)).toBe(true);
    });

    it('returns false for missing or invalid session credentials', () => {
      const unauthRequest = new Request('http://localhost/api/categories');
      expect(isAdminRequest(unauthRequest)).toBe(false);

      const invalidCookieRequest = new Request('http://localhost/api/categories', {
        headers: {
          Cookie: 'retro_admin_session=invalid-token',
        },
      });
      expect(isAdminRequest(invalidCookieRequest)).toBe(false);
    });

    it('generates correct cookie headers for session setup and clearing', () => {
      const token = 'sample-token';
      const setCookie = createSessionCookie(token, 7200);
      expect(setCookie).toContain('retro_admin_session=sample-token');
      expect(setCookie).toContain('HttpOnly');
      expect(setCookie).toContain('SameSite=Strict');
      expect(setCookie).toContain('Max-Age=7200');

      const clearCookie = createClearSessionCookie();
      expect(clearCookie).toContain('retro_admin_session=');
      expect(clearCookie).toContain('Max-Age=0');
    });
  });

  describe('Sliding window rate limiter', () => {
    it('allows attempts within limit and blocks on threshold exceeded', () => {
      const key = 'test-action:127.0.0.1';
      const limit = 3;
      const windowMs = 5000;

      const r1 = checkRateLimit(key, limit, windowMs);
      expect(r1.allowed).toBe(true);
      expect(r1.remaining).toBe(2);

      const r2 = checkRateLimit(key, limit, windowMs);
      expect(r2.allowed).toBe(true);
      expect(r2.remaining).toBe(1);

      const r3 = checkRateLimit(key, limit, windowMs);
      expect(r3.allowed).toBe(true);
      expect(r3.remaining).toBe(0);

      // 4th attempt should be blocked
      const r4 = checkRateLimit(key, limit, windowMs);
      expect(r4.allowed).toBe(false);
      expect(r4.remaining).toBe(0);
      expect(r4.retryAfterSeconds).toBeGreaterThan(0);
    });

    it('allows clearing rate limits on demand', () => {
      const key = 'test-key';
      checkRateLimit(key, 1, 60000);
      expect(checkRateLimit(key, 1, 60000).allowed).toBe(false);

      clearRateLimit(key);
      expect(checkRateLimit(key, 1, 60000).allowed).toBe(true);
    });
  });

  describe('Client IP extraction', () => {
    it('extracts IP from x-forwarded-for header', () => {
      const req = new Request('http://localhost/api/test', {
        headers: {
          'x-forwarded-for': '203.0.113.195, 70.41.3.18',
        },
      });
      expect(getClientIp(req)).toBe('203.0.113.195');
    });

    it('extracts IP from x-real-ip header if x-forwarded-for is absent', () => {
      const req = new Request('http://localhost/api/test', {
        headers: {
          'x-real-ip': '198.51.100.4',
        },
      });
      expect(getClientIp(req)).toBe('198.51.100.4');
    });

    it('falls back to 127.0.0.1 when no IP headers exist', () => {
      const req = new Request('http://localhost/api/test');
      expect(getClientIp(req)).toBe('127.0.0.1');
    });
  });
});
