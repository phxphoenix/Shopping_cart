import { describe, it, expect, beforeEach } from 'vitest';
import {
  DEFAULT_CATEGORIES,
  DEFAULT_CATEGORY_ID,
  DEFAULT_CATALOG,
} from '../../../src/domain/catalog';
import { toCents } from '../../../src/domain/money';
import type { Customer, Order } from '../../../src/domain/schemas';
import {
  getRepository,
  InMemoryShopRepository,
  resetRepositoryForTesting,
  setRepositoryForTesting,
} from '../../../src/server/repository';

describe('Server ShopRepository Module', () => {
  beforeEach(() => {
    resetRepositoryForTesting();
  });

  describe('InMemoryShopRepository', () => {
    let repo: InMemoryShopRepository;

    beforeEach(() => {
      repo = new InMemoryShopRepository();
    });

    it('initializes with default categories, catalog, customers and orders', async () => {
      const categories = await repo.getCategories();
      expect(categories.length).toBe(DEFAULT_CATEGORIES.length);
      expect(categories[0]?.id).toBe(DEFAULT_CATEGORY_ID);

      const products = await repo.getProducts();
      expect(products.length).toBe(DEFAULT_CATALOG.length);

      const customers = await repo.getCustomers();
      expect(customers.length).toBe(2);

      const orders = await repo.getOrders();
      expect(orders.length).toBe(2);
    });

    describe('Category CRUD & Migration', () => {
      it('adds a valid new category', async () => {
        const added = await repo.addCategory({
          name: 'Cyberdeck Modding',
          description: 'Części i obudowy do budowy retro terminali cyberdeck',
        });

        expect(added.id).toBeDefined();
        expect(added.name).toBe('Cyberdeck Modding');

        const all = await repo.getCategories();
        expect(all.some((c) => c.id === added.id)).toBe(true);
      });

      it('prevents adding duplicate category names (case-insensitive)', async () => {
        await expect(
          repo.addCategory({
            name: 'elektronika',
            description: 'Duplikat',
          })
        ).rejects.toThrow(/już istnieje/);
      });

      it('updates category and synchronizes product category names', async () => {
        const { category, updatedProductsCount } = await repo.updateCategory('cat-elektronika', {
          name: 'Elektronika Retro',
        });

        expect(category.name).toBe('Elektronika Retro');
        expect(updatedProductsCount).toBeGreaterThan(0);

        const prods = await repo.getProducts();
        const laptop = prods.find((p) => p.id === 'prod-laptop');
        expect(laptop?.category).toBe('Elektronika Retro');
      });

      it('prevents deleting the default category', async () => {
        await expect(repo.deleteCategory(DEFAULT_CATEGORY_ID)).rejects.toThrow(
          /Nie można usunąć domyślnej kategorii/
        );
      });

      it('deletes category and moves its products to the default fallback category', async () => {
        // Add a temporary category and a product in it
        const cat = await repo.addCategory({ name: 'Tymczasowa' });
        const prod = await repo.addProduct({
          sku: 'TEMP-01',
          name: 'Produkt Temp',
          priceCents: toCents(5000),
          categoryId: cat.id,
          stockQuantity: 5,
        });

        const deleteResult = await repo.deleteCategory(cat.id);
        expect(deleteResult.deletedCategoryId).toBe(cat.id);
        expect(deleteResult.migratedProductsCount).toBe(1);

        const prods = await repo.getProducts();
        const migratedProd = prods.find((p) => p.id === prod.id);
        expect(migratedProd?.categoryId).toBe(DEFAULT_CATEGORY_ID);
        expect(migratedProd?.category).toBe('Ogólne');
      });

      it('migrates products between categories in bulk', async () => {
        const newCat = await repo.addCategory({ name: 'Sprzęt Vintage' });
        const res = await repo.migrateCategoryProducts({
          sourceCategoryId: 'cat-retro-hardware',
          targetCategoryId: newCat.id,
        });

        expect(res.migratedCount).toBeGreaterThan(0);

        const prods = await repo.getProducts();
        const moved = prods.filter((p) => p.categoryId === newCat.id);
        expect(moved.length).toBe(res.migratedCount);
      });
    });

    describe('Product CRUD', () => {
      it('adds a valid product and enforces category existence', async () => {
        const created = await repo.addProduct({
          sku: 'NEW-PROD-99',
          name: 'Monitor Bursztynowy',
          priceCents: toCents(79900),
          categoryId: 'cat-retro-hardware',
          stockQuantity: 3,
        });

        expect(created.id).toBeDefined();
        expect(created.priceCents).toBe(toCents(79900));

        const all = await repo.getProducts();
        expect(all.some((p) => p.id === created.id)).toBe(true);
      });

      it('rejects adding product with nonexistent category', async () => {
        await expect(
          repo.addProduct({
            sku: 'FAIL-01',
            name: 'Błędny',
            priceCents: toCents(1000),
            categoryId: 'cat-nonexistent',
            stockQuantity: 1,
          })
        ).rejects.toThrow(/nie istnieje/);
      });

      it('updates product and deletes product', async () => {
        const updated = await repo.updateProduct('prod-laptop', {
          name: 'Laptop Retro IBM',
          priceCents: toCents(400000),
        });
        expect(updated.name).toBe('Laptop Retro IBM');
        expect(updated.priceCents).toBe(toCents(400000));

        const deletedId = await repo.deleteProduct('prod-laptop');
        expect(deletedId).toBe('prod-laptop');

        const all = await repo.getProducts();
        expect(all.some((p) => p.id === 'prod-laptop')).toBe(false);
      });
    });

    describe('Customer operations', () => {
      it('adds a new customer and rejects duplicate emails', async () => {
        const newCust: Customer = {
          id: 'cust-unique-1',
          name: 'Piotr Zieliński',
          email: 'piotr.zielinski@example.com',
        };

        const added = await repo.addCustomer(newCust);
        expect(added.email).toBe(newCust.email);

        await expect(
          repo.addCustomer({
            id: 'cust-dup',
            name: 'Piotr Klon',
            email: 'PIOTR.ZIELINSKI@example.com',
          })
        ).rejects.toThrow(/już istnieje/);
      });

      it('deletes an existing customer', async () => {
        const deletedId = await repo.deleteCustomer('cust-demo-1');
        expect(deletedId).toBe('cust-demo-1');

        const customers = await repo.getCustomers();
        expect(customers.some((c) => c.id === 'cust-demo-1')).toBe(false);
      });
    });

    describe('Order operations', () => {
      it('adds and deletes orders', async () => {
        const newOrder: Order = {
          id: 'ord-test-custom',
          timestamp: '2026-11-14 12:00:00',
          customer: {
            id: 'cust-demo-1',
            name: 'Jan Kowalski',
            email: 'jan.kowalski@example.com',
          },
          items: [
            {
              id: 'prod-sluchawki',
              name: 'Słuchawki',
              priceCents: toCents(19999),
              quantity: 1,
              category: 'Elektronika',
            },
          ],
          subtotalCents: toCents(19999),
          deliveryCents: toCents(1500),
          totalCents: toCents(21499),
          paymentMethod: 'Karta kredytowa',
          paymentDetails: {
            method: 'card',
            maskedCard: '**** **** **** 4321',
            last4: '4321',
            expiry: '09/27',
          },
        };

        const added = await repo.addOrder(newOrder);
        expect(added.id).toBe('ord-test-custom');

        const orders = await repo.getOrders();
        expect(orders.some((o) => o.id === 'ord-test-custom')).toBe(true);

        await repo.deleteOrder('ord-test-custom');
        const ordersAfter = await repo.getOrders();
        expect(ordersAfter.some((o) => o.id === 'ord-test-custom')).toBe(false);
      });
    });

    describe('State maintenance (resetDemo and importState)', () => {
      it('resets repository to demo state', async () => {
        await repo.deleteProduct('prod-laptop');
        const prodsBefore = await repo.getProducts();
        expect(prodsBefore.some((p) => p.id === 'prod-laptop')).toBe(false);

        await repo.resetDemo();

        const prodsAfter = await repo.getProducts();
        expect(prodsAfter.some((p) => p.id === 'prod-laptop')).toBe(true);
      });

      it('imports a complete state', async () => {
        const customCust: Customer = {
          id: 'cust-imported-1',
          name: 'Importowany Klient',
          email: 'imported@example.com',
        };

        await repo.importState({
          categories: [DEFAULT_CATEGORIES[0]!],
          catalog: [DEFAULT_CATALOG[0]!],
          customers: [customCust],
          orders: [],
        });

        const state = await repo.getFullState();
        expect(state.categories.length).toBe(1);
        expect(state.catalog.length).toBe(1);
        expect(state.customers.length).toBe(1);
        expect(state.customers[0]?.id).toBe('cust-imported-1');
        expect(state.orders.length).toBe(0);
      });
    });
  });

  describe('Repository factory selection', () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
      process.env = { ...originalEnv };
      resetRepositoryForTesting();
    });

    it('returns InMemoryShopRepository when DATABASE_URL is not set', () => {
      delete process.env.DATABASE_URL;
      const repo = getRepository();
      expect(repo).toBeInstanceOf(InMemoryShopRepository);
    });

    it('returns InMemoryShopRepository when USE_IN_MEMORY_DB="true" even if DATABASE_URL is set', () => {
      process.env.DATABASE_URL = 'postgresql://fake-neon-url';
      process.env.USE_IN_MEMORY_DB = 'true';
      const repo = getRepository();
      expect(repo).toBeInstanceOf(InMemoryShopRepository);
    });

    it('supports injecting custom repository for testing', () => {
      const mockRepo = new InMemoryShopRepository();
      setRepositoryForTesting(mockRepo);
      expect(getRepository()).toBe(mockRepo);
    });
  });
});
