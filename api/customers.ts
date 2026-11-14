/**
 * Vercel Function: /api/customers
 *
 * GET: List customers (PII email masking for public view, unmasked for Admin)
 * POST: Register new customer (strict Zod validation, anti-bot honeypot check, email uniqueness, sliding rate-limit)
 * DELETE: Delete customer (strictly restricted to Admin; 401 Unauthorized for public)
 */

import {
  maskCustomerEmail,
  RegisterCustomerInputSchema,
  validateUniqueCustomerEmail,
} from '../src/domain/customer.js';
import { generateDomainId, type Customer } from '../src/domain/schemas.js';
import {
  checkRateLimit,
  CUSTOMER_REGISTER_MAX_ATTEMPTS,
  CUSTOMER_REGISTER_WINDOW_MS,
  getClientIp,
  isAdminRequest,
} from '../src/server/auth.js';
import {
  errorResponse,
  extractResourceId,
  jsonResponse,
  parseJsonBody,
} from '../src/server/http.js';
import { getRepository } from '../src/server/repository.js';

export async function GET(request: Request): Promise<Response> {
  try {
    const repo = getRepository();
    const customers = await repo.getCustomers();
    const isAdmin = isAdminRequest(request);

    if (isAdmin) {
      return jsonResponse(customers);
    }

    const maskedCustomers = customers.map((c) => ({
      id: c.id,
      name: c.name,
      email: maskCustomerEmail(c.email),
    }));

    return jsonResponse(maskedCustomers);
  } catch (error) {
    console.error('Error fetching customers:', error);
    return errorResponse('Wystąpił błąd podczas pobierania listy klientów.', 500);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const ip = getClientIp(request);
    const rateLimitKey = `customer-register:${ip}`;

    const rateResult = checkRateLimit(
      rateLimitKey,
      CUSTOMER_REGISTER_MAX_ATTEMPTS,
      CUSTOMER_REGISTER_WINDOW_MS
    );

    if (!rateResult.allowed) {
      return jsonResponse(
        {
          error: `Zbyt wiele prób rejestracji. Odczekaj ${rateResult.retryAfterSeconds} s przed kolejną próbą.`,
          retryAfterSeconds: rateResult.retryAfterSeconds,
        },
        429,
        {
          'Retry-After': String(rateResult.retryAfterSeconds),
        }
      );
    }

    const rawBody = await parseJsonBody<Record<string, unknown>>(request);
    if (!rawBody) {
      return errorResponse('Dane formularza rejestracji są wymagane.', 400);
    }

    // 1. Zod schema validation (including anti-bot honeypot)
    const parsed = RegisterCustomerInputSchema.safeParse(rawBody);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      return errorResponse(firstIssue?.message ?? 'Niepoprawne dane formularza rejestracji.', 400);
    }

    const { name, email } = parsed.data;

    // 2. Email uniqueness check
    const repo = getRepository();
    const currentCustomers = await repo.getCustomers();

    if (!validateUniqueCustomerEmail(currentCustomers, email)) {
      return errorResponse(
        `Klient z adresem e-mail "${email}" jest już zarejestrowany w systemie.`,
        409
      );
    }

    // 3. Create new customer entity
    const newCustomer: Customer = {
      id: generateDomainId('cust'),
      name,
      email,
    };

    const saved = await repo.addCustomer(newCustomer);

    return jsonResponse(
      {
        ...saved,
        customer: saved,
      },
      201
    );
  } catch (error) {
    console.error('Error registering customer:', error);
    const message =
      error instanceof Error ? error.message : 'Wystąpił błąd podczas rejestracji klienta.';
    return errorResponse(message, 500);
  }
}

export async function DELETE(request: Request): Promise<Response> {
  try {
    if (!isAdminRequest(request)) {
      return errorResponse(
        'Brak uprawnień administratora do usunięcia klienta. Wymagane logowanie.',
        401
      );
    }

    const body = await parseJsonBody<{ id?: string }>(request);
    const customerId = extractResourceId(request, body);

    if (!customerId) {
      return errorResponse('Identyfikator klienta do usunięcia jest wymagany.', 400);
    }

    const repo = getRepository();
    const deletedId = await repo.deleteCustomer(customerId);

    return jsonResponse(
      {
        success: true,
        deletedCustomerId: deletedId,
      },
      200
    );
  } catch (error) {
    console.error('Error deleting customer:', error);
    const message =
      error instanceof Error ? error.message : 'Wystąpił błąd podczas usuwania klienta.';
    return errorResponse(message, 400);
  }
}
