/**
 * Vercel Function: /api/categories/migrate
 *
 * Bulk migration of products between categories (Admin only).
 */

import { isAdminRequest } from '../../src/server/auth.js';
import { errorResponse, jsonResponse, parseJsonBody } from '../../src/server/http.js';
import { getRepository } from '../../src/server/repository.js';

interface MigrateRequestBody {
  readonly sourceCategoryId: string;
  readonly targetCategoryId: string;
  readonly productIds?: readonly string[];
}

export async function POST(request: Request): Promise<Response> {
  try {
    if (!isAdminRequest(request)) {
      return errorResponse('Brak uprawnień administratora. Wymagane logowanie.', 401);
    }

    const body = await parseJsonBody<MigrateRequestBody>(request);
    if (!body || !body.sourceCategoryId || !body.targetCategoryId) {
      return errorResponse(
        'Pola sourceCategoryId oraz targetCategoryId są wymagane do migracji produktów.',
        400
      );
    }

    const repo = getRepository();
    const result = await repo.migrateCategoryProducts({
      sourceCategoryId: body.sourceCategoryId,
      targetCategoryId: body.targetCategoryId,
      productIds: body.productIds,
    });

    return jsonResponse({
      success: true,
      migratedCount: result.migratedCount,
    });
  } catch (error) {
    console.error('Error migrating category products:', error);
    const message =
      error instanceof Error ? error.message : 'Wystąpił błąd podczas migracji produktów.';
    return errorResponse(message, 400);
  }
}
