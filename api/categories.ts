/**
 * Vercel Function: /api/categories
 *
 * GET: Public category list
 * POST: Create category (Admin only)
 * PUT: Update category and synchronize products (Admin only)
 * DELETE: Delete category with automatic product migration to fallback category (Admin only)
 */

import { isAdminRequest } from '../src/server/auth.js';
import {
  errorResponse,
  extractResourceId,
  jsonResponse,
  parseJsonBody,
} from '../src/server/http.js';
import { getRepository } from '../src/server/repository.js';
import type { AddCategoryInput, UpdateCategoryPatch } from '../src/domain/catalog.js';

export async function GET(): Promise<Response> {
  try {
    const repo = getRepository();
    const categories = await repo.getCategories();
    return jsonResponse(categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    return errorResponse('Wystąpił błąd podczas pobierania kategorii.', 500);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    if (!isAdminRequest(request)) {
      return errorResponse('Brak uprawnień administratora. Wymagane logowanie.', 401);
    }

    const body = await parseJsonBody<AddCategoryInput>(request);
    if (!body || !body.name || typeof body.name !== 'string') {
      return errorResponse('Nazwa kategorii jest wymagana.', 400);
    }

    const repo = getRepository();
    const created = await repo.addCategory({
      name: body.name,
      description: body.description,
      slug: body.slug,
      id: body.id,
    });

    return jsonResponse(created, 201);
  } catch (error) {
    console.error('Error creating category:', error);
    const message = error instanceof Error ? error.message : 'Nie udało się utworzyć kategorii.';
    return errorResponse(message, 400);
  }
}

export async function PUT(request: Request): Promise<Response> {
  try {
    if (!isAdminRequest(request)) {
      return errorResponse('Brak uprawnień administratora. Wymagane logowanie.', 401);
    }

    const body = await parseJsonBody<UpdateCategoryPatch & { id?: string }>(request);
    const categoryId = extractResourceId(request, body);

    if (!categoryId) {
      return errorResponse('Identyfikator kategorii jest wymagany.', 400);
    }

    const repo = getRepository();
    const result = await repo.updateCategory(categoryId, {
      name: body?.name,
      description: body?.description,
      slug: body?.slug,
    });

    return jsonResponse(result, 200);
  } catch (error) {
    console.error('Error updating category:', error);
    const message =
      error instanceof Error ? error.message : 'Nie udało się zaktualizować kategorii.';
    return errorResponse(message, 400);
  }
}

export async function DELETE(request: Request): Promise<Response> {
  try {
    if (!isAdminRequest(request)) {
      return errorResponse('Brak uprawnień administratora. Wymagane logowanie.', 401);
    }

    const body = await parseJsonBody<{ id?: string; targetCategoryId?: string }>(request);
    const categoryId = extractResourceId(request, body);

    if (!categoryId) {
      return errorResponse('Identyfikator kategorii do usunięcia jest wymagany.', 400);
    }

    const url = new URL(request.url, 'http://localhost');
    const targetCategoryId =
      body?.targetCategoryId || url.searchParams.get('targetCategoryId') || undefined;

    const repo = getRepository();
    const result = await repo.deleteCategory(categoryId, targetCategoryId);

    return jsonResponse(
      {
        success: true,
        deletedCategoryId: result.deletedCategoryId,
        migratedProductsCount: result.migratedProductsCount,
      },
      200
    );
  } catch (error) {
    console.error('Error deleting category:', error);
    const message = error instanceof Error ? error.message : 'Nie udało się usunąć kategorii.';
    return errorResponse(message, 400);
  }
}
