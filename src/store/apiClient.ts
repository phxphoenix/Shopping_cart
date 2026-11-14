/**
 * Store HTTP API Client
 *
 * Provides typed, credentials-aware HTTP communication with Vercel Functions (/api/*).
 * Automatically includes credentials ('same-origin') for HttpOnly session cookie transmission.
 * Returns discriminated union results distinguishing successful responses, API errors (4xx/5xx),
 * and network/offline failures.
 */

import type {
  AddCategoryInput,
  AddProductInput,
  Category,
  Product,
  UpdateCategoryPatch,
  UpdateProductPatch,
} from '@/domain/catalog';
import type { RegisterCustomerInput } from '@/domain/customer';
import type { PaymentInput } from '@/domain/payment';
import type { Customer, Order } from '@/domain/schemas';

export type ApiResult<T> =
  | { readonly ok: true; readonly status: number; readonly data: T }
  | {
      readonly ok: false;
      readonly status: number;
      readonly error: string;
      readonly data?: unknown;
      readonly isNetworkError: boolean;
    };

export interface InitialStateResponse {
  readonly categories: Category[];
  readonly catalog: Product[];
  readonly customers: Customer[];
  readonly orders: Order[];
  readonly isAdmin: boolean;
}

export interface AdminSessionResponse {
  readonly isAdmin: boolean;
  readonly success?: boolean;
  readonly token?: string;
  readonly error?: string;
}

export interface MigrateProductsApiInput {
  readonly sourceCategoryId: string;
  readonly targetCategoryId: string;
  readonly productIds?: readonly string[];
}

export interface PlaceOrderApiInput {
  readonly customer: Customer;
  readonly items: readonly {
    readonly id?: string;
    readonly productId?: string;
    readonly product?: { id?: string };
    readonly quantity: number;
  }[];
  readonly payment?: PaymentInput;
  readonly paymentMethod?: string;
  readonly paymentDetails?: PaymentInput;
  readonly discountCode?: string;
}

export class ShopApiClient {
  constructor(private readonly baseUrl: string = '') {}

  private resolveUrl(path: string): string {
    if (!this.baseUrl) {
      return path;
    }
    const cleanBase = this.baseUrl.replace(/\/+$/, '');
    const cleanPath = path.replace(/^\/+/, '');
    return `${cleanBase}/${cleanPath}`;
  }

  private async request<T>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
    try {
      const url = this.resolveUrl(path);
      const headers = new Headers(init?.headers);
      if (init?.body && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
      }

      const res = await fetch(url, {
        ...init,
        headers,
        credentials: 'same-origin',
      });

      let parsed: unknown = null;
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        try {
          parsed = await res.json();
        } catch {
          parsed = null;
        }
      } else {
        try {
          parsed = await res.text();
        } catch {
          parsed = null;
        }
      }

      if (res.ok) {
        return { ok: true, status: res.status, data: parsed as T };
      }

      const errorMsg =
        parsed && typeof parsed === 'object' && 'error' in parsed && typeof parsed.error === 'string'
          ? parsed.error
          : typeof parsed === 'string' && parsed.length > 0
            ? parsed
            : `Błąd serwera (HTTP ${res.status})`;

      return {
        ok: false,
        status: res.status,
        error: errorMsg,
        data: parsed,
        isNetworkError: false,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return {
        ok: false,
        status: 0,
        error: msg,
        isNetworkError: true,
      };
    }
  }

  // State
  async fetchState(): Promise<ApiResult<InitialStateResponse>> {
    return this.request<InitialStateResponse>('/api/state');
  }

  async resetDemo(): Promise<ApiResult<{ success: boolean; state?: unknown }>> {
    return this.request<{ success: boolean; state?: unknown }>('/api/state', {
      method: 'POST',
      body: JSON.stringify({ action: 'resetDemo' }),
    });
  }

  async importBackup(state: unknown): Promise<ApiResult<{ success: boolean }>> {
    return this.request<{ success: boolean }>('/api/state', {
      method: 'POST',
      body: JSON.stringify({ action: 'importBackup', state }),
    });
  }

  // Admin Session
  async checkAdminSession(): Promise<ApiResult<AdminSessionResponse>> {
    return this.request<AdminSessionResponse>('/api/admin/session');
  }

  async loginAdmin(password: string): Promise<ApiResult<AdminSessionResponse>> {
    return this.request<AdminSessionResponse>('/api/admin/session', {
      method: 'POST',
      body: JSON.stringify({ password }),
    });
  }

  async logoutAdmin(): Promise<ApiResult<AdminSessionResponse>> {
    return this.request<AdminSessionResponse>('/api/admin/session', {
      method: 'DELETE',
    });
  }

  // Categories
  async fetchCategories(): Promise<ApiResult<Category[]>> {
    return this.request<Category[]>('/api/categories');
  }

  async createCategory(input: AddCategoryInput): Promise<ApiResult<Category>> {
    return this.request<Category>('/api/categories', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async updateCategory(
    id: string,
    patch: UpdateCategoryPatch
  ): Promise<ApiResult<{ category: Category; updatedProductsCount: number }>> {
    return this.request<{ category: Category; updatedProductsCount: number }>('/api/categories', {
      method: 'PUT',
      body: JSON.stringify({ id, ...patch }),
    });
  }

  async deleteCategory(
    id: string,
    targetCategoryId?: string
  ): Promise<ApiResult<{ deletedCategoryId: string; targetCategoryId: string }>> {
    return this.request<{ deletedCategoryId: string; targetCategoryId: string }>(
      '/api/categories',
      {
        method: 'DELETE',
        body: JSON.stringify({ id, targetCategoryId }),
      }
    );
  }

  async migrateCategoryProducts(
    input: MigrateProductsApiInput
  ): Promise<ApiResult<{ success: boolean; migratedCount: number }>> {
    return this.request<{ success: boolean; migratedCount: number }>(
      '/api/categories/migrate',
      {
        method: 'POST',
        body: JSON.stringify(input),
      }
    );
  }

  // Products
  async fetchProducts(): Promise<ApiResult<Product[]>> {
    return this.request<Product[]>('/api/products');
  }

  async createProduct(input: AddProductInput): Promise<ApiResult<Product>> {
    return this.request<Product>('/api/products', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async updateProduct(id: string, patch: UpdateProductPatch): Promise<ApiResult<Product>> {
    return this.request<Product>('/api/products', {
      method: 'PUT',
      body: JSON.stringify({ id, ...patch }),
    });
  }

  async deleteProduct(id: string): Promise<ApiResult<{ deletedProductId: string }>> {
    return this.request<{ deletedProductId: string }>(`/api/products?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
      body: JSON.stringify({ id }),
    });
  }

  // Customers
  async fetchCustomers(): Promise<ApiResult<Customer[]>> {
    return this.request<Customer[]>('/api/customers');
  }

  async registerCustomer(
    input: RegisterCustomerInput
  ): Promise<ApiResult<Customer & { customer?: Customer }>> {
    return this.request<Customer & { customer?: Customer }>('/api/customers', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async deleteCustomer(
    id: string
  ): Promise<ApiResult<{ success: boolean; deletedCustomerId: string }>> {
    return this.request<{ success: boolean; deletedCustomerId: string }>(
      `/api/customers?id=${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
        body: JSON.stringify({ id }),
      }
    );
  }

  // Orders
  async fetchOrders(): Promise<ApiResult<Order[]>> {
    return this.request<Order[]>('/api/orders');
  }

  async placeOrder(input: PlaceOrderApiInput): Promise<ApiResult<Order>> {
    const res = await this.request<Order & { order?: Order }>('/api/orders', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    if (res.ok && res.data) {
      const order = res.data.order ? res.data.order : res.data;
      return { ok: true, status: res.status, data: order };
    }
    return res as ApiResult<Order>;
  }

  async deleteOrder(id: string): Promise<ApiResult<{ success: boolean; deletedOrderId: string }>> {
    return this.request<{ success: boolean; deletedOrderId: string }>(
      `/api/orders?id=${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
        body: JSON.stringify({ id }),
      }
    );
  }
}

export const defaultApiClient = new ShopApiClient();
