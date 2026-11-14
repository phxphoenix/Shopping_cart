import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { NeonQueryFunction } from '@neondatabase/serverless';
import { ensureSchemaAndSeed, getNeonSql, resetNeonSqlForTesting } from '../../../src/server/db';
import { NeonShopRepository, resetRepositoryForTesting } from '../../../src/server/repository';
import { DEFAULT_CATEGORIES, DEFAULT_CATALOG } from '../../../src/domain/catalog';
import { toCents } from '../../../src/domain/money';

describe('Neon Database & NeonShopRepository Unit Tests', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    resetNeonSqlForTesting();
    resetRepositoryForTesting();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    resetNeonSqlForTesting();
    resetRepositoryForTesting();
  });

  describe('db.ts: getNeonSql error handling', () => {
    it('throws error when DATABASE_URL is not set', () => {
      delete process.env.DATABASE_URL;
      expect(() => getNeonSql()).toThrow(/Brak zmiennej środowiskowej DATABASE_URL/);
    });

    it('lazily instantiates neon client when DATABASE_URL is provided', () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@ep-test.neon.tech/neondb';
      const sql = getNeonSql();
      expect(sql).toBeDefined();
      expect(typeof sql).toBe('function');
      // Second call returns cached instance
      expect(getNeonSql()).toBe(sql);
    });
  });

  describe('ensureSchemaAndSeed', () => {
    it('creates tables and seeds categories, catalog, customers and orders when empty', async () => {
      const executedQueries: string[] = [];

      const mockSql = (async (strings: TemplateStringsArray, ..._values: unknown[]) => {
        const query = strings.join('?').replace(/\s+/g, ' ').trim();
        executedQueries.push(query);

        if (query.includes('COUNT(*)::int AS count FROM categories')) {
          return [{ count: 0 }];
        }
        if (query.includes('COUNT(*)::int AS count FROM products')) {
          return [{ count: 0 }];
        }
        if (query.includes('COUNT(*)::int AS count FROM customers')) {
          return [{ count: 0 }];
        }
        if (query.includes('COUNT(*)::int AS count FROM orders')) {
          return [{ count: 0 }];
        }

        return [];
      }) as unknown as NeonQueryFunction<false, false>;

      await ensureSchemaAndSeed(mockSql);

      // Verify table creations
      expect(executedQueries.some((q) => q.includes('CREATE TABLE IF NOT EXISTS categories'))).toBe(
        true
      );
      expect(executedQueries.some((q) => q.includes('CREATE TABLE IF NOT EXISTS products'))).toBe(
        true
      );
      expect(executedQueries.some((q) => q.includes('CREATE TABLE IF NOT EXISTS customers'))).toBe(
        true
      );
      expect(executedQueries.some((q) => q.includes('CREATE TABLE IF NOT EXISTS orders'))).toBe(
        true
      );

      // Verify seed inserts
      expect(executedQueries.some((q) => q.includes('INSERT INTO categories'))).toBe(true);
      expect(executedQueries.some((q) => q.includes('INSERT INTO products'))).toBe(true);
      expect(executedQueries.some((q) => q.includes('INSERT INTO customers'))).toBe(true);
      expect(executedQueries.some((q) => q.includes('INSERT INTO orders'))).toBe(true);
    });

    it('skips inserting seed data when counts are non-zero and not forced', async () => {
      const executedQueries: string[] = [];

      const mockSql = (async (strings: TemplateStringsArray, ..._values: unknown[]) => {
        const query = strings.join('?').replace(/\s+/g, ' ').trim();
        executedQueries.push(query);

        if (query.includes('COUNT(*)::int AS count')) {
          return [{ count: 5 }];
        }
        return [];
      }) as unknown as NeonQueryFunction<false, false>;

      await ensureSchemaAndSeed(mockSql, false);

      expect(executedQueries.some((q) => q.includes('INSERT INTO categories'))).toBe(false);
      expect(executedQueries.some((q) => q.includes('INSERT INTO products'))).toBe(false);
    });
  });

  describe('NeonShopRepository methods', () => {
    it('executes CRUD operations against Neon SQL client', async () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@ep-test.neon.tech/neondb';

      const repo = new NeonShopRepository();

      // Mock the internal sql client
      const dbCategories = [
        {
          id: 'cat-default',
          name: 'Ogólne',
          slug: 'ogolne',
          description: 'Domyślna',
          is_default: true,
        },
        {
          id: 'cat-elektronika',
          name: 'Elektronika',
          slug: 'elektronika',
          description: 'Sprzęt',
          is_default: false,
        },
      ];

      const dbProducts = [
        {
          id: 'prod-laptop',
          sku: 'HW-LAPTOP-01',
          name: 'Laptop',
          price_cents: 349999,
          category_id: 'cat-elektronika',
          category: 'Elektronika',
          description: 'Komputer',
          in_stock: true,
          stock_quantity: 12,
        },
      ];

      const dbCustomers = [
        {
          id: 'cust-demo-1',
          name: 'Jan Kowalski',
          email: 'jan.kowalski@example.com',
        },
      ];

      const dbOrders = [
        {
          id: 'ord-1',
          timestamp: '2026-11-14 12:00:00',
          customer_json: JSON.stringify({
            id: 'cust-demo-1',
            name: 'Jan Kowalski',
            email: 'jan.kowalski@example.com',
          }),
          items_json: JSON.stringify([
            {
              id: 'prod-laptop',
              name: 'Laptop',
              priceCents: 349999,
              quantity: 1,
              category: 'Elektronika',
            },
          ]),
          subtotal_cents: 349999,
          delivery_cents: 0,
          total_cents: 349999,
          payment_method: 'PayPal',
          payment_details_json: JSON.stringify({
            method: 'paypal',
            email: 'jan.kowalski@example.com',
          }),
        },
      ];

      const mockSql = (async (strings: TemplateStringsArray, ..._values: unknown[]) => {
        const query = strings.join('?').replace(/\s+/g, ' ').trim();

        if (query.includes('COUNT(*)::int AS count')) {
          return [{ count: 1 }];
        }
        if (query.includes('SELECT id, name, slug, description, is_default FROM categories')) {
          return dbCategories;
        }
        if (query.includes('INSERT INTO categories')) {
          return [];
        }
        if (query.includes('UPDATE categories')) {
          return [];
        }
        if (query.includes('DELETE FROM categories')) {
          return [];
        }
        if (
          query.includes(
            'SELECT id, sku, name, price_cents, category_id, category, description, in_stock, stock_quantity FROM products'
          )
        ) {
          return dbProducts;
        }
        if (query.includes('INSERT INTO products')) {
          return [];
        }
        if (query.includes('UPDATE products')) {
          return [{ id: 'prod-laptop' }];
        }
        if (query.includes('DELETE FROM products')) {
          return [{ id: 'prod-laptop' }];
        }
        if (query.includes('SELECT id, name, email FROM customers WHERE LOWER(email)')) {
          return [];
        }
        if (query.includes('SELECT id, name, email FROM customers')) {
          return dbCustomers;
        }
        if (query.includes('INSERT INTO customers')) {
          return [];
        }
        if (query.includes('DELETE FROM customers')) {
          return [{ id: 'cust-demo-1' }];
        }
        if (query.includes('SELECT id, timestamp, customer_json, items_json')) {
          return dbOrders;
        }
        if (query.includes('INSERT INTO orders')) {
          return [];
        }
        if (query.includes('DELETE FROM orders')) {
          return [{ id: 'ord-1' }];
        }

        return [];
      }) as unknown as NeonQueryFunction<false, false>;

      // Inject mockSql into repo
      (repo as unknown as { sqlClient: NeonQueryFunction<false, false> }).sqlClient = mockSql;
      (repo as unknown as { isInitialized: boolean }).isInitialized = true;

      // 1. Categories
      const categories = await repo.getCategories();
      expect(categories.length).toBe(2);
      expect(categories[0]?.id).toBe('cat-default');

      const addedCat = await repo.addCategory({ name: 'Akcesoria Nowe', description: 'Test' });
      expect(addedCat.name).toBe('Akcesoria Nowe');

      const updatedCat = await repo.updateCategory('cat-elektronika', { name: 'Elektronika Nowa' });
      expect(updatedCat.category.name).toBe('Elektronika Nowa');

      // 2. Products
      const prods = await repo.getProducts();
      expect(prods.length).toBe(1);
      expect(prods[0]?.name).toBe('Laptop');
      expect(prods[0]?.priceCents).toBe(toCents(349999));

      const addedProd = await repo.addProduct({
        sku: 'NEW-01',
        name: 'Myszka',
        priceCents: toCents(4900),
        categoryId: 'cat-elektronika',
        stockQuantity: 5,
      });
      expect(addedProd.sku).toBe('NEW-01');

      const updatedProd = await repo.updateProduct('prod-laptop', { priceCents: toCents(399999) });
      expect(updatedProd.priceCents).toBe(toCents(399999));

      const delProdId = await repo.deleteProduct('prod-laptop');
      expect(delProdId).toBe('prod-laptop');

      // 3. Customers
      const customers = await repo.getCustomers();
      expect(customers.length).toBe(1);
      expect(customers[0]?.name).toBe('Jan Kowalski');

      const addedCust = await repo.addCustomer({
        id: 'cust-new',
        name: 'Adam Nowak',
        email: 'adam.nowak@example.com',
      });
      expect(addedCust.id).toBe('cust-new');

      const delCustId = await repo.deleteCustomer('cust-demo-1');
      expect(delCustId).toBe('cust-demo-1');

      // 4. Orders
      const orders = await repo.getOrders();
      expect(orders.length).toBe(1);
      expect(orders[0]?.paymentMethod).toBe('PayPal');

      const addedOrder = await repo.addOrder(orders[0]!);
      expect(addedOrder.id).toBe('ord-1');

      const delOrderId = await repo.deleteOrder('ord-1');
      expect(delOrderId).toBe('ord-1');

      // 5. Bulk operations
      const fullState = await repo.getFullState();
      expect(fullState.categories).toBeDefined();
      expect(fullState.catalog).toBeDefined();

      await repo.resetDemo();
      await repo.importState({
        categories: DEFAULT_CATEGORIES,
        catalog: DEFAULT_CATALOG,
        customers: [],
        orders: [],
      });
    });
  });
});
