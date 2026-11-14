/**
 * Vercel Function: /api/state
 *
 * GET: Returns initial state { categories, catalog, customers, orders, isAdmin }
 *      (Customer emails are masked if !isAdmin).
 * POST: Administrative bulk operations: resetDemo or importBackup (Admin only).
 */

import { maskCustomerEmail } from '../src/domain/customer.js';
import { parseLegacyOrCurrentBackup } from '../src/domain/schemas.js';
import { isAdminRequest } from '../src/server/auth.js';
import { errorResponse, jsonResponse, parseJsonBody } from '../src/server/http.js';
import { getRepository } from '../src/server/repository.js';

export async function GET(request: Request): Promise<Response> {
  try {
    const repo = getRepository();
    const state = await repo.getFullState();
    const isAdmin = isAdminRequest(request);

    const customers = isAdmin
      ? state.customers
      : state.customers.map((c) => ({
          id: c.id,
          name: c.name,
          email: maskCustomerEmail(c.email),
        }));

    return jsonResponse({
      categories: state.categories,
      catalog: state.catalog,
      customers,
      orders: state.orders,
      isAdmin,
    });
  } catch (error) {
    console.error('Error fetching initial shop state:', error);
    return errorResponse('Wystąpił błąd podczas pobierania stanu sklepu.', 500);
  }
}

interface StateActionRequestBody {
  readonly action: 'resetDemo' | 'importBackup';
  readonly state?: unknown;
}

export async function POST(request: Request): Promise<Response> {
  try {
    const isAdmin = isAdminRequest(request);
    const allowDemo = process.env.ALLOW_DEMO_RESET === 'true';

    if (!isAdmin && !allowDemo) {
      return errorResponse('Brak uprawnień administratora do modyfikacji stanu bazy.', 401);
    }

    const body = await parseJsonBody<StateActionRequestBody>(request);
    if (!body || !body.action) {
      return errorResponse('Pole action ("resetDemo" lub "importBackup") jest wymagane.', 400);
    }

    const repo = getRepository();

    if (body.action === 'resetDemo') {
      await repo.resetDemo();
      const updated = await repo.getFullState();
      return jsonResponse({
        success: true,
        message: 'Przywrócono domyślne dane demonstracyjne sklepu.',
        state: updated,
      });
    }

    if (body.action === 'importBackup') {
      if (!body.state) {
        return errorResponse('Brak danych stanu do zaimportowania w polu "state".', 400);
      }

      const stateJson = typeof body.state === 'string' ? body.state : JSON.stringify(body.state);
      const parsedBackup = parseLegacyOrCurrentBackup(stateJson);
      await repo.importState({
        categories: parsedBackup.categories,
        catalog: parsedBackup.catalog,
        customers: parsedBackup.customers,
        orders: parsedBackup.orders,
      });

      const updated = await repo.getFullState();
      return jsonResponse({
        success: true,
        message: 'Pomyślnie zaimportowano stan z kopii zapasowej.',
        state: updated,
      });
    }

    return errorResponse(`Nieznana akcja: "${body.action}".`, 400);
  } catch (error) {
    console.error('Error executing state action:', error);
    const message =
      error instanceof Error ? error.message : 'Wystąpił błąd podczas aktualizacji stanu sklepu.';
    return errorResponse(message, 400);
  }
}
