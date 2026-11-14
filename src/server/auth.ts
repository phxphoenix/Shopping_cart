/**
 * Server Authentication & Rate Limiting Module
 *
 * Implements:
 * - Constant-time administrator password verification via scryptSync and timingSafeEqual.
 * - Cryptographically signed HMAC-SHA256 session tokens.
 * - HttpOnly; SameSite=Strict cookie handling (retro_admin_session) & Bearer auth support.
 * - Sliding-window rate limiters for admin login and customer registration.
 *
 * Security Hygiene:
 * - Zero plaintext password retention.
 * - Resistant against timing attacks and brute-force guessing.
 */

import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export const ADMIN_COOKIE_NAME = 'retro_admin_session';
export const ADMIN_SESSION_DURATION_SECONDS = 7200; // 2 hours

// Rate limit configurations
export const ADMIN_LOGIN_MAX_FAILED_ATTEMPTS = 5;
export const ADMIN_LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

export const CUSTOMER_REGISTER_MAX_ATTEMPTS = 5;
export const CUSTOMER_REGISTER_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Resolves the configured admin password from environment variables.
 * In production, empty string is returned if ADMIN_PASSWORD is missing (blocking login).
 * In development or testing, falls back to 'admin123'.
 */
export function getAdminPassword(): string {
  const configured = process.env.ADMIN_PASSWORD?.trim();
  if (configured && configured.length > 0) {
    return configured;
  }

  const isDevOrTest =
    process.env.NODE_ENV !== 'production' || process.env.ALLOW_DEFAULT_ADMIN_PASSWORD === 'true';

  if (isDevOrTest) {
    return 'admin123';
  }

  return '';
}

/**
 * Verifies an entered password against the configured admin password.
 * Uses scrypt key derivation and constant-time buffer comparison to prevent timing attacks.
 */
export function verifyAdminPassword(candidatePassword: string): boolean {
  const actualPassword = getAdminPassword();
  if (!actualPassword || !candidatePassword) {
    return false;
  }

  const fixedSalt = 'retro-crt-salt-scrypt-2026';
  const candidateKey = scryptSync(candidatePassword, fixedSalt, 64);
  const actualKey = scryptSync(actualPassword, fixedSalt, 64);

  return timingSafeEqual(candidateKey, actualKey);
}

/**
 * Resolves the HMAC session secret from environment variables.
 */
export function getAdminSessionSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET?.trim();
  if (secret && secret.length >= 16) {
    return secret;
  }

  const isDevOrTest =
    process.env.NODE_ENV !== 'production' || process.env.ALLOW_DEFAULT_ADMIN_PASSWORD === 'true';

  if (isDevOrTest) {
    return 'retro-default-admin-session-secret-key-32-chars-long';
  }

  throw new Error('ADMIN_SESSION_SECRET is not configured or too short (min 16 chars).');
}

export interface AdminSessionPayload {
  readonly role: 'admin';
  readonly iat: number; // Unix timestamp in seconds
  readonly exp: number; // Unix timestamp in seconds
  readonly nonce: string;
}

/**
 * Generates a signed HMAC-SHA256 session token.
 */
export function createAdminSessionToken(
  ttlSeconds: number = ADMIN_SESSION_DURATION_SECONDS
): string {
  const secret = getAdminSessionSecret();
  const now = Math.floor(Date.now() / 1000);
  const payload: AdminSessionPayload = {
    role: 'admin',
    iat: now,
    exp: now + ttlSeconds,
    nonce: randomBytes(16).toString('hex'),
  };

  const payloadEncoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', secret).update(payloadEncoded).digest('base64url');

  return `${payloadEncoded}.${signature}`;
}

/**
 * Verifies an HMAC-SHA256 session token.
 * Validates cryptographic signature and expiration time.
 */
export function verifyAdminSessionToken(token: string | null | undefined): boolean {
  if (!token || typeof token !== 'string') {
    return false;
  }

  const parts = token.split('.');
  if (parts.length !== 2) {
    return false;
  }

  const [payloadEncoded, signature] = parts;
  if (!payloadEncoded || !signature) {
    return false;
  }

  let secret: string;
  try {
    secret = getAdminSessionSecret();
  } catch {
    return false;
  }

  const expectedSignature = createHmac('sha256', secret).update(payloadEncoded).digest('base64url');

  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (sigBuffer.length !== expectedBuffer.length) {
    return false;
  }

  if (!timingSafeEqual(sigBuffer, expectedBuffer)) {
    return false;
  }

  try {
    const rawJson = Buffer.from(payloadEncoded, 'base64url').toString('utf8');
    const payload = JSON.parse(rawJson) as AdminSessionPayload;

    if (payload.role !== 'admin') {
      return false;
    }

    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp !== 'number' || payload.exp < now) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Parses a specific cookie value from a Cookie header string.
 */
export function parseCookie(cookieHeader: string | null | undefined, name: string): string | null {
  if (!cookieHeader) {
    return null;
  }

  const parts = cookieHeader.split(';');
  for (const part of parts) {
    const [rawKey, ...rawVal] = part.trim().split('=');
    if (rawKey === name) {
      return decodeURIComponent(rawVal.join('='));
    }
  }

  return null;
}

/**
 * Extracts the admin session token from an incoming Request.
 * Inspects:
 * 1. Authorization: Bearer <token>
 * 2. Cookie: retro_admin_session=<token>
 */
export function getSessionTokenFromRequest(request: Request): string | null {
  const authHeader = request.headers.get('authorization') ?? request.headers.get('Authorization');
  if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token) return token;
  }

  const cookieHeader = request.headers.get('cookie') ?? request.headers.get('Cookie');
  return parseCookie(cookieHeader, ADMIN_COOKIE_NAME);
}

/**
 * Determines whether the given HTTP Request has valid admin authorization.
 */
export function isAdminRequest(request: Request): boolean {
  const token = getSessionTokenFromRequest(request);
  return verifyAdminSessionToken(token);
}

/**
 * Builds the Set-Cookie header value for setting the admin session cookie.
 */
export function createSessionCookie(
  token: string,
  maxAge: number = ADMIN_SESSION_DURATION_SECONDS
): string {
  return `${ADMIN_COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}`;
}

/**
 * Builds the Set-Cookie header value for clearing the admin session cookie upon logout.
 */
export function createClearSessionCookie(): string {
  return `${ADMIN_COOKIE_NAME}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`;
}

// ---------------------------------------------------------------------------
// Rate Limiter
// ---------------------------------------------------------------------------

interface RateLimitRecord {
  timestamps: number[];
}

const rateLimitStore = new Map<string, RateLimitRecord>();

export interface RateLimitCheckResult {
  readonly allowed: boolean;
  readonly remaining: number;
  readonly retryAfterSeconds: number;
}

/**
 * Sliding-window rate limiter check.
 * Checks whether the key has exceeded `limit` attempts within `windowMs`.
 * If allowed, records the current timestamp and returns allowed=true.
 */
export function checkRateLimit(key: string, limit: number, windowMs: number): RateLimitCheckResult {
  const now = Date.now();
  const record = rateLimitStore.get(key) ?? { timestamps: [] };

  // Filter out timestamps outside the active sliding window
  record.timestamps = record.timestamps.filter((ts) => now - ts < windowMs);

  if (record.timestamps.length >= limit) {
    const oldest = record.timestamps[0] ?? now;
    const retryAfterMs = Math.max(0, windowMs - (now - oldest));
    const retryAfterSeconds = Math.ceil(retryAfterMs / 1000);

    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds,
    };
  }

  record.timestamps.push(now);
  rateLimitStore.set(key, record);

  return {
    allowed: true,
    remaining: limit - record.timestamps.length,
    retryAfterSeconds: 0,
  };
}

/**
 * Clears rate limiting history for a specific key (e.g. after a successful login).
 */
export function clearRateLimit(key: string): void {
  rateLimitStore.delete(key);
}

/**
 * Resets all rate limiters in memory (used by tests between test cases).
 */
export function resetRateLimits(): void {
  rateLimitStore.clear();
}

/**
 * Resolves the client IP address from request headers or falls back to loopback.
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0];
    if (first && first.trim()) {
      return first.trim();
    }
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp && realIp.trim()) {
    return realIp.trim();
  }

  return '127.0.0.1';
}
