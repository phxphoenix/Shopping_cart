/**
 * Vercel Function: /api/admin/session
 *
 * Handles administrator session check, login (with rate limiting and constant-time password check),
 * and logout.
 */

import {
  ADMIN_LOGIN_MAX_FAILED_ATTEMPTS,
  ADMIN_LOGIN_WINDOW_MS,
  checkRateLimit,
  clearRateLimit,
  createClearSessionCookie,
  createAdminSessionToken,
  createSessionCookie,
  getClientIp,
  isAdminRequest,
  verifyAdminPassword,
} from '../../src/server/auth';
import { errorResponse, jsonResponse, parseJsonBody } from '../../src/server/http';

export async function GET(request: Request): Promise<Response> {
  try {
    const isAdmin = isAdminRequest(request);
    return jsonResponse({ isAdmin });
  } catch (error) {
    console.error('Error checking admin session:', error);
    return errorResponse('Wystąpił błąd podczas sprawdzania sesji administratora.', 500);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const ip = getClientIp(request);
    const rateLimitKey = `admin-login:${ip}`;

    const rateResult = checkRateLimit(
      rateLimitKey,
      ADMIN_LOGIN_MAX_FAILED_ATTEMPTS,
      ADMIN_LOGIN_WINDOW_MS
    );

    if (!rateResult.allowed) {
      return jsonResponse(
        {
          error: `Zbyt wiele nieudanych prób logowania. Dostęp zablokowany na ${rateResult.retryAfterSeconds} s.`,
          retryAfterSeconds: rateResult.retryAfterSeconds,
        },
        429,
        {
          'Retry-After': String(rateResult.retryAfterSeconds),
        }
      );
    }

    const body = await parseJsonBody<{ password?: string }>(request);
    const password = body?.password;

    if (!password || typeof password !== 'string') {
      return errorResponse('Hasło administratora jest wymagane.', 400);
    }

    const isValid = verifyAdminPassword(password);
    if (!isValid) {
      return errorResponse('Nieprawidłowe hasło administratora.', 401);
    }

    // Clear failed login attempts on successful authentication
    clearRateLimit(rateLimitKey);

    const token = createAdminSessionToken();
    const cookieHeader = createSessionCookie(token);

    return jsonResponse(
      {
        success: true,
        isAdmin: true,
        token,
      },
      200,
      {
        'Set-Cookie': cookieHeader,
      }
    );
  } catch (error) {
    console.error('Error processing admin login:', error);
    return errorResponse('Wystąpił wewnętrzny błąd serwera podczas logowania.', 500);
  }
}

export async function DELETE(): Promise<Response> {
  try {
    const clearCookieHeader = createClearSessionCookie();
    return jsonResponse(
      {
        success: true,
        isAdmin: false,
      },
      200,
      {
        'Set-Cookie': clearCookieHeader,
      }
    );
  } catch (error) {
    console.error('Error logging out admin:', error);
    return errorResponse('Wystąpił błąd podczas wylogowywania.', 500);
  }
}
