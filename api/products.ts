/**
 * Vercel Function: /api/products
 *
 * GET: Public product catalog listing (with optional category and search filters)
 * POST: Create product (Admin only)
 * PUT: Update product (Admin only)
 * DELETE: Delete product (Admin only)
 */

import {
  filterByCategory,
  searchProducts,
  type AddProductInput,
  type UpdateProductPatch,
} from '../src/domain/catalog';
import { isAdminRequest } from '../src/server/auth';
import { errorResponse, extractResourceId, jsonResponse, parseJsonBody } from '../src/server/http';
import { getRepository } from '../src/server/repository';

export async function GET(request: Request): Promise<Response> {
  try {
    const repo = getRepository();
    const catalog = await repo.getProducts();

    const url = new URL(request.url, 'http://localhost');
    const category = url.searchParams.get('category');
    const search = url.searchParams.get('search');

    let result = catalog;
    if (search && search.trim().length > 0) {
      result = searchProducts(result, search, category ?? 'ALL');
    } else if (category && category !== 'ALL') {
      result = filterByCategory(result, category);
    }

    return jsonResponse(result);
  } catch (error) {
    console.error('Error fetching products:', error);
    return errorResponse('Wystąpił błąd podczas pobierania produktów.', 500);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    if (!isAdminRequest(request)) {
      return errorResponse('Brak uprawnień administratora. Wymagane logowanie.', 401);
    }

    const body = await parseJsonBody<AddProductInput>(request);
    if (!body || !body.sku || !body.name || !body.categoryId) {
      return errorResponse('Pola sku, name oraz categoryId są wymagane.', 400);
    }

    const repo = getRepository();
    const created = await repo.addProduct({
      sku: body.sku,
      name: body.name,
      priceCents: body.priceCents,
      categoryId: body.categoryId,
      category: body.category,
      description: body.description,
      stockQuantity: body.stockQuantity,
      inStock: body.inStock,
    });

    return jsonResponse(created, 201);
  } catch (error) {
    console.error('Error creating product:', error);
    const message = error instanceof Error ? error.message : 'Nie udało się dodać produktu.';
    return errorResponse(message, 400);
  }
}

export async function PUT(request: Request): Promise<Response> {
  try {
    if (!isAdminRequest(request)) {
      return errorResponse('Brak uprawnień administratora. Wymagane logowanie.', 401);
    }

    const body = await parseJsonBody<UpdateProductPatch & { id?: string }>(request);
    const productId = extractResourceId(request, body);

    if (!productId) {
      return errorResponse('Identyfikator produktu jest wymagany.', 400);
    }

    const repo = getRepository();
    const updated = await repo.updateProduct(productId, {
      sku: body?.sku,
      name: body?.name,
      priceCents: body?.priceCents,
      categoryId: body?.categoryId,
      category: body?.category,
      description: body?.description,
      stockQuantity: body?.stockQuantity,
      inStock: body?.inStock,
    });

    return jsonResponse(updated, 200);
  } catch (error) {
    console.error('Error updating product:', error);
    const message =
      error instanceof Error ? error.message : 'Nie udało się zaktualizować produktu.';
    return errorResponse(message, 400);
  }
}

export async function DELETE(request: Request): Promise<Response> {
  try {
    if (!isAdminRequest(request)) {
      return errorResponse('Brak uprawnień administratora. Wymagane logowanie.', 401);
    }

    const body = await parseJsonBody<{ id?: string }>(request);
    const productId = extractResourceId(request, body);

    if (!productId) {
      return errorResponse('Identyfikator produktu do usunięcia jest wymagany.', 400);
    }

    const repo = getRepository();
    const deletedId = await repo.deleteProduct(productId);

    return jsonResponse(
      {
        success: true,
        deletedProductId: deletedId,
      },
      200
    );
  } catch (error) {
    console.error('Error deleting product:', error);
    const message = error instanceof Error ? error.message : 'Nie udało się usunąć produktu.';
    return errorResponse(message, 400);
  }
}
