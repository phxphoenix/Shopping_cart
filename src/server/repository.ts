/**
 * Server Repository Module: ShopRepository interface and dual-mode implementations
 *
 * Implements:
 * 1. NeonShopRepository: executes SQL queries against Neon Postgres with integer Cents.
 * 2. InMemoryShopRepository: in-memory implementation for 100% deterministic testing and dev fallback.
 */

import type { NeonQueryFunction } from '@neondatabase/serverless';
import {
  DEFAULT_CATEGORIES,
  DEFAULT_CATEGORY_ID,
  DEFAULT_CATALOG,
  type AddCategoryInput,
  type AddProductInput,
  type Category,
  type MigrateProductsParams,
  type Product,
  type UpdateCategoryPatch,
  type UpdateProductPatch,
  addCategoryToList,
  addProductToList,
  deleteCategoryFromList,
  deleteProductFromList,
  migrateProductsBetweenCategories,
  updateCategoryInList,
  updateProductInList,
} from '../domain/catalog';
import { toCents } from '../domain/money';
import type { Customer, Order } from '../domain/schemas';
import { createSeedState } from '../storage/seed';
import { ensureSchemaAndSeed, getNeonSql } from './db';

export interface ShopRepository {
  // Categories
  getCategories(): Promise<Category[]>;
  addCategory(input: AddCategoryInput): Promise<Category>;
  updateCategory(
    categoryId: string,
    patch: UpdateCategoryPatch
  ): Promise<{ category: Category; updatedProductsCount: number }>;
  deleteCategory(
    categoryId: string,
    targetCategoryId?: string
  ): Promise<{ deletedCategoryId: string; migratedProductsCount: number }>;
  migrateCategoryProducts(params: MigrateProductsParams): Promise<{ migratedCount: number }>;

  // Products
  getProducts(): Promise<Product[]>;
  addProduct(input: AddProductInput): Promise<Product>;
  updateProduct(productId: string, patch: UpdateProductPatch): Promise<Product>;
  deleteProduct(productId: string): Promise<string>;

  // Customers
  getCustomers(): Promise<Customer[]>;
  addCustomer(customer: Customer): Promise<Customer>;
  deleteCustomer(customerId: string): Promise<string>;

  // Orders
  getOrders(): Promise<Order[]>;
  addOrder(order: Order): Promise<Order>;
  deleteOrder(orderId: string): Promise<string>;

  // Full state / maintenance
  getFullState(): Promise<{
    categories: Category[];
    catalog: Product[];
    customers: Customer[];
    orders: Order[];
  }>;
  resetDemo(): Promise<void>;
  importState(state: {
    categories?: readonly Category[];
    catalog?: readonly Product[];
    customers?: readonly Customer[];
    orders?: readonly Order[];
  }): Promise<void>;
}

// ---------------------------------------------------------------------------
// InMemoryShopRepository
// ---------------------------------------------------------------------------

export class InMemoryShopRepository implements ShopRepository {
  private categories: Category[];
  private products: Product[];
  private customers: Customer[];
  private orders: Order[];

  constructor() {
    const seed = createSeedState();
    this.categories = [...DEFAULT_CATEGORIES];
    this.products = [...DEFAULT_CATALOG];
    this.customers = [...seed.customers];
    this.orders = [...seed.orders];
  }

  public async getCategories(): Promise<Category[]> {
    return [...this.categories];
  }

  public async addCategory(input: AddCategoryInput): Promise<Category> {
    const updated = addCategoryToList(this.categories, input);
    const added = updated[updated.length - 1];
    if (!added) {
      throw new Error('Nie udało się utworzyć kategorii.');
    }
    this.categories = updated;
    return added;
  }

  public async updateCategory(
    categoryId: string,
    patch: UpdateCategoryPatch
  ): Promise<{ category: Category; updatedProductsCount: number }> {
    const res = updateCategoryInList(this.categories, this.products, categoryId, patch);
    const updatedCategory = res.categories.find((c) => c.id === categoryId);
    if (!updatedCategory) {
      throw new Error(`Kategoria "${categoryId}" nie została odnaleziona.`);
    }

    const updatedCount = res.products.filter(
      (p, idx) => p !== this.products[idx] && p.categoryId === categoryId
    ).length;

    this.categories = res.categories;
    this.products = res.products;

    return { category: updatedCategory, updatedProductsCount: updatedCount };
  }

  public async deleteCategory(
    categoryId: string,
    targetCategoryId = DEFAULT_CATEGORY_ID
  ): Promise<{ deletedCategoryId: string; migratedProductsCount: number }> {
    const productsToMigrateCount = this.products.filter((p) => p.categoryId === categoryId).length;
    const res = deleteCategoryFromList(
      this.categories,
      this.products,
      categoryId,
      targetCategoryId
    );

    this.categories = res.categories;
    this.products = res.products;

    return {
      deletedCategoryId: categoryId,
      migratedProductsCount: productsToMigrateCount,
    };
  }

  public async migrateCategoryProducts(
    params: MigrateProductsParams
  ): Promise<{ migratedCount: number }> {
    const updated = migrateProductsBetweenCategories(this.products, this.categories, params);
    let migratedCount = 0;
    for (let i = 0; i < updated.length; i++) {
      if (updated[i] !== this.products[i]) {
        migratedCount++;
      }
    }
    this.products = updated;
    return { migratedCount };
  }

  public async getProducts(): Promise<Product[]> {
    return [...this.products];
  }

  public async addProduct(input: AddProductInput): Promise<Product> {
    const updated = addProductToList(this.products, this.categories, input);
    const added = updated[updated.length - 1];
    if (!added) {
      throw new Error('Nie udało się dodać produktu.');
    }
    this.products = updated;
    return added;
  }

  public async updateProduct(productId: string, patch: UpdateProductPatch): Promise<Product> {
    const updated = updateProductInList(this.products, this.categories, productId, patch);
    const found = updated.find((p) => p.id === productId);
    if (!found) {
      throw new Error(`Produkt "${productId}" nie został odnaleziony.`);
    }
    this.products = updated;
    return found;
  }

  public async deleteProduct(productId: string): Promise<string> {
    this.products = deleteProductFromList(this.products, productId);
    return productId;
  }

  public async getCustomers(): Promise<Customer[]> {
    return [...this.customers];
  }

  public async addCustomer(customer: Customer): Promise<Customer> {
    const normalizedEmail = customer.email.trim().toLowerCase();
    const duplicate = this.customers.some((c) => c.email.trim().toLowerCase() === normalizedEmail);
    if (duplicate) {
      throw new Error(`Klient z adresem e-mail "${customer.email}" już istnieje.`);
    }
    this.customers = [...this.customers, customer];
    return customer;
  }

  public async deleteCustomer(customerId: string): Promise<string> {
    const initialLen = this.customers.length;
    this.customers = this.customers.filter((c) => c.id !== customerId);
    if (this.customers.length === initialLen) {
      throw new Error(`Klient o identyfikatorze "${customerId}" nie istnieje.`);
    }
    return customerId;
  }

  public async getOrders(): Promise<Order[]> {
    return [...this.orders];
  }

  public async addOrder(order: Order): Promise<Order> {
    this.orders = [order, ...this.orders];
    return order;
  }

  public async deleteOrder(orderId: string): Promise<string> {
    const initialLen = this.orders.length;
    this.orders = this.orders.filter((o) => o.id !== orderId);
    if (this.orders.length === initialLen) {
      throw new Error(`Zamówienie o identyfikatorze "${orderId}" nie istnieje.`);
    }
    return orderId;
  }

  public async getFullState(): Promise<{
    categories: Category[];
    catalog: Product[];
    customers: Customer[];
    orders: Order[];
  }> {
    return {
      categories: [...this.categories],
      catalog: [...this.products],
      customers: [...this.customers],
      orders: [...this.orders],
    };
  }

  public async resetDemo(): Promise<void> {
    const seed = createSeedState();
    this.categories = [...DEFAULT_CATEGORIES];
    this.products = [...DEFAULT_CATALOG];
    this.customers = [...seed.customers];
    this.orders = [...seed.orders];
  }

  public async importState(state: {
    categories?: readonly Category[];
    catalog?: readonly Product[];
    customers?: readonly Customer[];
    orders?: readonly Order[];
  }): Promise<void> {
    this.categories = state.categories ? [...state.categories] : [...DEFAULT_CATEGORIES];
    this.products = state.catalog ? [...state.catalog] : [...DEFAULT_CATALOG];
    this.customers = state.customers ? [...state.customers] : [];
    this.orders = state.orders ? [...state.orders] : [];
  }
}

// ---------------------------------------------------------------------------
// NeonShopRepository
// ---------------------------------------------------------------------------

export class NeonShopRepository implements ShopRepository {
  private sqlClient: NeonQueryFunction<false, false> | null = null;
  private isInitialized = false;

  private get sql(): NeonQueryFunction<false, false> {
    if (!this.sqlClient) {
      this.sqlClient = getNeonSql();
    }
    return this.sqlClient;
  }

  private async ensureReady(): Promise<void> {
    if (!this.isInitialized) {
      await ensureSchemaAndSeed(this.sql);
      this.isInitialized = true;
    }
  }

  public async getCategories(): Promise<Category[]> {
    await this.ensureReady();
    const rows = (await this.sql`
      SELECT id, name, slug, description, is_default
      FROM categories
      ORDER BY is_default DESC, name ASC;
    `) as Array<{
      id: string;
      name: string;
      slug: string | null;
      description: string;
      is_default: boolean;
    }>;

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug ?? undefined,
      description: r.description,
      isDefault: Boolean(r.is_default),
    }));
  }

  public async addCategory(input: AddCategoryInput): Promise<Category> {
    await this.ensureReady();
    const current = await this.getCategories();
    const updated = addCategoryToList(current, input);
    const added = updated[updated.length - 1];
    if (!added) {
      throw new Error('Nie udało się utworzyć kategorii.');
    }

    await this.sql`
      INSERT INTO categories (id, name, slug, description, is_default)
      VALUES (${added.id}, ${added.name}, ${added.slug ?? null}, ${added.description}, ${Boolean(added.isDefault)});
    `;

    return added;
  }

  public async updateCategory(
    categoryId: string,
    patch: UpdateCategoryPatch
  ): Promise<{ category: Category; updatedProductsCount: number }> {
    await this.ensureReady();
    const currentCategories = await this.getCategories();
    const currentProducts = await this.getProducts();

    const res = updateCategoryInList(currentCategories, currentProducts, categoryId, patch);
    const updatedCategory = res.categories.find((c) => c.id === categoryId);
    if (!updatedCategory) {
      throw new Error(`Kategoria "${categoryId}" nie została odnaleziona.`);
    }

    await this.sql`
      UPDATE categories
      SET name = ${updatedCategory.name},
          slug = ${updatedCategory.slug ?? null},
          description = ${updatedCategory.description}
      WHERE id = ${categoryId};
    `;

    let updatedProductsCount = 0;
    if (patch.name !== undefined) {
      const updateRes = (await this.sql`
        UPDATE products
        SET category = ${updatedCategory.name}
        WHERE category_id = ${categoryId}
        RETURNING id;
      `) as Array<{ id: string }>;
      updatedProductsCount = updateRes.length;
    }

    return { category: updatedCategory, updatedProductsCount };
  }

  public async deleteCategory(
    categoryId: string,
    targetCategoryId = DEFAULT_CATEGORY_ID
  ): Promise<{ deletedCategoryId: string; migratedProductsCount: number }> {
    await this.ensureReady();
    const currentCategories = await this.getCategories();
    const currentProducts = await this.getProducts();

    // Validates rules using domain function
    deleteCategoryFromList(currentCategories, currentProducts, categoryId, targetCategoryId);

    const targetCat = currentCategories.find((c) => c.id === targetCategoryId);
    if (!targetCat) {
      throw new Error(`Kategoria docelowa "${targetCategoryId}" nie istnieje.`);
    }

    // Migrate products in database
    const migrateRes = (await this.sql`
      UPDATE products
      SET category_id = ${targetCat.id},
          category = ${targetCat.name}
      WHERE category_id = ${categoryId}
      RETURNING id;
    `) as Array<{ id: string }>;

    // Delete category
    await this.sql`
      DELETE FROM categories
      WHERE id = ${categoryId};
    `;

    return {
      deletedCategoryId: categoryId,
      migratedProductsCount: migrateRes.length,
    };
  }

  public async migrateCategoryProducts(
    params: MigrateProductsParams
  ): Promise<{ migratedCount: number }> {
    await this.ensureReady();
    const currentCategories = await this.getCategories();
    const sourceCat = currentCategories.find((c) => c.id === params.sourceCategoryId);
    if (!sourceCat) {
      throw new Error(`Kategoria źródłowa "${params.sourceCategoryId}" nie istnieje.`);
    }
    const targetCat = currentCategories.find((c) => c.id === params.targetCategoryId);
    if (!targetCat) {
      throw new Error(`Kategoria docelowa "${params.targetCategoryId}" nie istnieje.`);
    }

    if (params.sourceCategoryId === params.targetCategoryId) {
      return { migratedCount: 0 };
    }

    let count = 0;
    if (params.productIds && params.productIds.length > 0) {
      for (const prodId of params.productIds) {
        const res = (await this.sql`
          UPDATE products
          SET category_id = ${targetCat.id},
              category = ${targetCat.name}
          WHERE category_id = ${sourceCat.id} AND id = ${prodId}
          RETURNING id;
        `) as Array<{ id: string }>;
        count += res.length;
      }
    } else {
      const res = (await this.sql`
        UPDATE products
        SET category_id = ${targetCat.id},
            category = ${targetCat.name}
        WHERE category_id = ${sourceCat.id}
        RETURNING id;
      `) as Array<{ id: string }>;
      count = res.length;
    }

    return { migratedCount: count };
  }

  public async getProducts(): Promise<Product[]> {
    await this.ensureReady();
    const rows = (await this.sql`
      SELECT id, sku, name, price_cents, category_id, category, description, in_stock, stock_quantity
      FROM products
      ORDER BY name ASC;
    `) as Array<{
      id: string;
      sku: string;
      name: string;
      price_cents: number;
      category_id: string;
      category: string;
      description: string;
      in_stock: boolean;
      stock_quantity: number;
    }>;

    return rows.map((r) => ({
      id: r.id,
      sku: r.sku,
      name: r.name,
      priceCents: toCents(Number(r.price_cents)),
      categoryId: r.category_id,
      category: r.category,
      description: r.description,
      inStock: Boolean(r.in_stock),
      stockQuantity: Number(r.stock_quantity),
    }));
  }

  public async addProduct(input: AddProductInput): Promise<Product> {
    await this.ensureReady();
    const currentProducts = await this.getProducts();
    const currentCategories = await this.getCategories();
    const updated = addProductToList(currentProducts, currentCategories, input);
    const added = updated[updated.length - 1];
    if (!added) {
      throw new Error('Nie udało się utworzyć produktu.');
    }

    await this.sql`
      INSERT INTO products (id, sku, name, price_cents, category_id, category, description, in_stock, stock_quantity)
      VALUES (${added.id}, ${added.sku}, ${added.name}, ${added.priceCents}, ${added.categoryId}, ${added.category}, ${added.description}, ${added.inStock}, ${added.stockQuantity});
    `;

    return added;
  }

  public async updateProduct(productId: string, patch: UpdateProductPatch): Promise<Product> {
    await this.ensureReady();
    const currentProducts = await this.getProducts();
    const currentCategories = await this.getCategories();
    const updated = updateProductInList(currentProducts, currentCategories, productId, patch);
    const found = updated.find((p) => p.id === productId);
    if (!found) {
      throw new Error(`Produkt "${productId}" nie został odnaleziony.`);
    }

    await this.sql`
      UPDATE products
      SET sku = ${found.sku},
          name = ${found.name},
          price_cents = ${found.priceCents},
          category_id = ${found.categoryId},
          category = ${found.category},
          description = ${found.description},
          in_stock = ${found.inStock},
          stock_quantity = ${found.stockQuantity}
      WHERE id = ${productId};
    `;

    return found;
  }

  public async deleteProduct(productId: string): Promise<string> {
    await this.ensureReady();
    const res = (await this.sql`
      DELETE FROM products
      WHERE id = ${productId}
      RETURNING id;
    `) as Array<{ id: string }>;

    if (res.length === 0) {
      throw new Error(`Produkt o identyfikatorze "${productId}" nie istnieje.`);
    }

    return productId;
  }

  public async getCustomers(): Promise<Customer[]> {
    await this.ensureReady();
    const rows = (await this.sql`
      SELECT id, name, email
      FROM customers
      ORDER BY name ASC;
    `) as Array<{ id: string; name: string; email: string }>;

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
    }));
  }

  public async addCustomer(customer: Customer): Promise<Customer> {
    await this.ensureReady();
    const normalizedEmail = customer.email.trim().toLowerCase();
    const existing = (await this.sql`
      SELECT id FROM customers WHERE LOWER(email) = ${normalizedEmail};
    `) as Array<{ id: string }>;

    if (existing.length > 0) {
      throw new Error(`Klient z adresem e-mail "${customer.email}" już istnieje.`);
    }

    await this.sql`
      INSERT INTO customers (id, name, email)
      VALUES (${customer.id}, ${customer.name}, ${customer.email});
    `;

    return customer;
  }

  public async deleteCustomer(customerId: string): Promise<string> {
    await this.ensureReady();
    const res = (await this.sql`
      DELETE FROM customers
      WHERE id = ${customerId}
      RETURNING id;
    `) as Array<{ id: string }>;

    if (res.length === 0) {
      throw new Error(`Klient o identyfikatorze "${customerId}" nie istnieje.`);
    }

    return customerId;
  }

  public async getOrders(): Promise<Order[]> {
    await this.ensureReady();
    const rows = (await this.sql`
      SELECT id, timestamp, customer_json, items_json, subtotal_cents, delivery_cents, total_cents, payment_method, payment_details_json
      FROM orders
      ORDER BY timestamp DESC;
    `) as Array<{
      id: string;
      timestamp: string;
      customer_json: unknown;
      items_json: unknown;
      subtotal_cents: number;
      delivery_cents: number;
      total_cents: number;
      payment_method: string;
      payment_details_json: unknown;
    }>;

    return rows.map((r) => {
      const customer =
        typeof r.customer_json === 'string'
          ? (JSON.parse(r.customer_json) as Order['customer'])
          : (r.customer_json as Order['customer']);
      const items =
        typeof r.items_json === 'string'
          ? (JSON.parse(r.items_json) as Order['items'])
          : (r.items_json as Order['items']);
      const paymentDetails =
        typeof r.payment_details_json === 'string'
          ? (JSON.parse(r.payment_details_json) as Order['paymentDetails'])
          : (r.payment_details_json as Order['paymentDetails']);

      return {
        id: r.id,
        timestamp: r.timestamp,
        customer,
        items,
        subtotalCents: toCents(Number(r.subtotal_cents)),
        deliveryCents: toCents(Number(r.delivery_cents)),
        totalCents: toCents(Number(r.total_cents)),
        paymentMethod: r.payment_method,
        paymentDetails,
      };
    });
  }

  public async addOrder(order: Order): Promise<Order> {
    await this.ensureReady();
    await this.sql`
      INSERT INTO orders (id, timestamp, customer_json, items_json, subtotal_cents, delivery_cents, total_cents, payment_method, payment_details_json)
      VALUES (
        ${order.id},
        ${order.timestamp},
        ${JSON.stringify(order.customer)},
        ${JSON.stringify(order.items)},
        ${order.subtotalCents},
        ${order.deliveryCents},
        ${order.totalCents},
        ${order.paymentMethod},
        ${JSON.stringify(order.paymentDetails)}
      );
    `;

    return order;
  }

  public async deleteOrder(orderId: string): Promise<string> {
    await this.ensureReady();
    const res = (await this.sql`
      DELETE FROM orders
      WHERE id = ${orderId}
      RETURNING id;
    `) as Array<{ id: string }>;

    if (res.length === 0) {
      throw new Error(`Zamówienie o identyfikatorze "${orderId}" nie istnieje.`);
    }

    return orderId;
  }

  public async getFullState(): Promise<{
    categories: Category[];
    catalog: Product[];
    customers: Customer[];
    orders: Order[];
  }> {
    const [categories, catalog, customers, orders] = await Promise.all([
      this.getCategories(),
      this.getProducts(),
      this.getCustomers(),
      this.getOrders(),
    ]);

    return { categories, catalog, customers, orders };
  }

  public async resetDemo(): Promise<void> {
    await this.ensureReady();
    await this.sql`DELETE FROM orders;`;
    await this.sql`DELETE FROM products;`;
    await this.sql`DELETE FROM customers;`;
    await this.sql`DELETE FROM categories;`;
    await ensureSchemaAndSeed(this.sql, true);
  }

  public async importState(state: {
    categories?: readonly Category[];
    catalog?: readonly Product[];
    customers?: readonly Customer[];
    orders?: readonly Order[];
  }): Promise<void> {
    await this.ensureReady();
    await this.sql`DELETE FROM orders;`;
    await this.sql`DELETE FROM products;`;
    await this.sql`DELETE FROM customers;`;
    await this.sql`DELETE FROM categories;`;

    const categoriesToImport = state.categories ?? DEFAULT_CATEGORIES;
    for (const cat of categoriesToImport) {
      await this.sql`
        INSERT INTO categories (id, name, slug, description, is_default)
        VALUES (${cat.id}, ${cat.name}, ${cat.slug ?? null}, ${cat.description}, ${Boolean(cat.isDefault)});
      `;
    }

    const productsToImport = state.catalog ?? DEFAULT_CATALOG;
    for (const prod of productsToImport) {
      await this.sql`
        INSERT INTO products (id, sku, name, price_cents, category_id, category, description, in_stock, stock_quantity)
        VALUES (${prod.id}, ${prod.sku}, ${prod.name}, ${prod.priceCents}, ${prod.categoryId}, ${prod.category}, ${prod.description}, ${prod.inStock}, ${prod.stockQuantity});
      `;
    }

    if (state.customers) {
      for (const cust of state.customers) {
        await this.sql`
          INSERT INTO customers (id, name, email)
          VALUES (${cust.id}, ${cust.name}, ${cust.email});
        `;
      }
    }

    if (state.orders) {
      for (const ord of state.orders) {
        await this.sql`
          INSERT INTO orders (id, timestamp, customer_json, items_json, subtotal_cents, delivery_cents, total_cents, payment_method, payment_details_json)
          VALUES (${ord.id}, ${ord.timestamp}, ${JSON.stringify(ord.customer)}, ${JSON.stringify(ord.items)}, ${ord.subtotalCents}, ${ord.deliveryCents}, ${ord.totalCents}, ${ord.paymentMethod}, ${JSON.stringify(ord.paymentDetails)});
        `;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton factory & testing helpers
// ---------------------------------------------------------------------------

let activeRepository: ShopRepository | null = null;

/**
 * Returns the active ShopRepository instance.
 * Automatically chooses NeonShopRepository if DATABASE_URL is present and USE_IN_MEMORY_DB !== 'true'.
 * Otherwise uses InMemoryShopRepository for deterministic tests and offline dev.
 */
export function getRepository(): ShopRepository {
  if (activeRepository) {
    return activeRepository;
  }

  const useInMemory =
    process.env.USE_IN_MEMORY_DB === 'true' ||
    !process.env.DATABASE_URL ||
    process.env.DATABASE_URL.trim().length === 0;

  if (useInMemory) {
    activeRepository = new InMemoryShopRepository();
  } else {
    activeRepository = new NeonShopRepository();
  }

  return activeRepository;
}

export function setRepositoryForTesting(repo: ShopRepository | null): void {
  activeRepository = repo;
}

export function resetRepositoryForTesting(): void {
  activeRepository = null;
}
