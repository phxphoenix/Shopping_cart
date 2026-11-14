/**
 * Server database module: Neon Postgres connection and schema initializer
 *
 * Provides lazy initialization of the Neon serverless SQL client.
 * NEVER executes neon() at module top-level during import.
 * Zero usage of Proxy. Safe during build environments when DATABASE_URL is unset.
 */

import { neon, type NeonQueryFunction } from '@neondatabase/serverless';
import { DEFAULT_CATEGORIES, DEFAULT_CATALOG } from '../domain/catalog';
import { createSeedState } from '../storage/seed';

let cachedSql: NeonQueryFunction<false, false> | null = null;

/**
 * Returns a lazily-instantiated Neon SQL client.
 * Throws an explicit error if DATABASE_URL is not set when called.
 */
export function getNeonSql(): NeonQueryFunction<false, false> {
  if (cachedSql) {
    return cachedSql;
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl || databaseUrl.trim().length === 0) {
    throw new Error(
      'Brak zmiennej środowiskowej DATABASE_URL. Ustaw DATABASE_URL lub użyj trybu pamięciowego (USE_IN_MEMORY_DB=true).'
    );
  }

  cachedSql = neon(databaseUrl);
  return cachedSql;
}

/**
 * Allows resetting the cached Neon SQL client (primarily for testing).
 */
export function resetNeonSqlForTesting(): void {
  cachedSql = null;
}

/**
 * Ensures required database tables exist and seeds initial data if tables are empty.
 * All monetary amounts are strictly stored as integer Cents (INTEGER).
 */
export async function ensureSchemaAndSeed(
  sql: NeonQueryFunction<false, false>,
  forceSeed = false
): Promise<void> {
  // 1. Create tables if not exists
  await sql`
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT,
      description TEXT NOT NULL,
      is_default BOOLEAN NOT NULL DEFAULT FALSE
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      sku TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      price_cents INTEGER NOT NULL,
      category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      in_stock BOOLEAN NOT NULL DEFAULT TRUE,
      stock_quantity INTEGER NOT NULL DEFAULT 0
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL,
      customer_json JSONB NOT NULL,
      items_json JSONB NOT NULL,
      subtotal_cents INTEGER NOT NULL,
      delivery_cents INTEGER NOT NULL,
      total_cents INTEGER NOT NULL,
      payment_method TEXT NOT NULL,
      payment_details_json JSONB NOT NULL
    );
  `;

  // 2. Check and seed categories
  const catRows = (await sql`
    SELECT COUNT(*)::int AS count FROM categories;
  `) as Array<{ count: number }>;
  const catCount = Number(catRows[0]?.count ?? 0);

  if (catCount === 0 || forceSeed) {
    for (const cat of DEFAULT_CATEGORIES) {
      await sql`
        INSERT INTO categories (id, name, slug, description, is_default)
        VALUES (${cat.id}, ${cat.name}, ${cat.slug ?? null}, ${cat.description}, ${Boolean(cat.isDefault)})
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          slug = EXCLUDED.slug,
          description = EXCLUDED.description,
          is_default = EXCLUDED.is_default;
      `;
    }
  }

  // 3. Check and seed products
  const prodRows = (await sql`
    SELECT COUNT(*)::int AS count FROM products;
  `) as Array<{ count: number }>;
  const prodCount = Number(prodRows[0]?.count ?? 0);

  if (prodCount === 0 || forceSeed) {
    for (const prod of DEFAULT_CATALOG) {
      await sql`
        INSERT INTO products (id, sku, name, price_cents, category_id, category, description, in_stock, stock_quantity)
        VALUES (${prod.id}, ${prod.sku}, ${prod.name}, ${prod.priceCents}, ${prod.categoryId}, ${prod.category}, ${prod.description}, ${prod.inStock}, ${prod.stockQuantity})
        ON CONFLICT (id) DO UPDATE SET
          sku = EXCLUDED.sku,
          name = EXCLUDED.name,
          price_cents = EXCLUDED.price_cents,
          category_id = EXCLUDED.category_id,
          category = EXCLUDED.category,
          description = EXCLUDED.description,
          in_stock = EXCLUDED.in_stock,
          stock_quantity = EXCLUDED.stock_quantity;
      `;
    }
  }

  // 4. Check and seed customers
  const custRows = (await sql`
    SELECT COUNT(*)::int AS count FROM customers;
  `) as Array<{ count: number }>;
  const custCount = Number(custRows[0]?.count ?? 0);

  if (custCount === 0 || forceSeed) {
    const seed = createSeedState();
    for (const cust of seed.customers) {
      await sql`
        INSERT INTO customers (id, name, email)
        VALUES (${cust.id}, ${cust.name}, ${cust.email})
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          email = EXCLUDED.email;
      `;
    }
  }

  // 5. Check and seed orders
  const ordRows = (await sql`
    SELECT COUNT(*)::int AS count FROM orders;
  `) as Array<{ count: number }>;
  const ordCount = Number(ordRows[0]?.count ?? 0);

  if (ordCount === 0 || forceSeed) {
    const seed = createSeedState();
    for (const ord of seed.orders) {
      await sql`
        INSERT INTO orders (id, timestamp, customer_json, items_json, subtotal_cents, delivery_cents, total_cents, payment_method, payment_details_json)
        VALUES (${ord.id}, ${ord.timestamp}, ${JSON.stringify(ord.customer)}, ${JSON.stringify(ord.items)}, ${ord.subtotalCents}, ${ord.deliveryCents}, ${ord.totalCents}, ${ord.paymentMethod}, ${JSON.stringify(ord.paymentDetails)})
        ON CONFLICT (id) DO UPDATE SET
          timestamp = EXCLUDED.timestamp,
          customer_json = EXCLUDED.customer_json,
          items_json = EXCLUDED.items_json,
          subtotal_cents = EXCLUDED.subtotal_cents,
          delivery_cents = EXCLUDED.delivery_cents,
          total_cents = EXCLUDED.total_cents,
          payment_method = EXCLUDED.payment_method,
          payment_details_json = EXCLUDED.payment_details_json;
      `;
    }
  }
}
