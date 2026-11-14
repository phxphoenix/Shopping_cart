import { describe, expect, it } from 'vitest';
import { DEFAULT_CATEGORIES, DEFAULT_CATEGORY_ID, DEFAULT_CATALOG } from '@/domain/catalog';
import {
  CategorySchema,
  CustomerSchema,
  OrderItemSchema,
  OrderSchema,
  PersistedShopStateSchema,
  ProductSchema,
  generateDomainId,
  parseLegacyOrCurrentBackup,
} from '@/domain/schemas';

describe('domain/schemas', () => {
  describe('CustomerSchema', () => {
    it('validates a correct customer object', () => {
      const valid = {
        id: 'cust-1',
        name: 'Jan Kowalski',
        email: 'jan@example.com',
      };
      const result = CustomerSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('rejects invalid email address or empty name', () => {
      expect(
        CustomerSchema.safeParse({ id: 'c1', name: '', email: 'jan@example.com' }).success
      ).toBe(false);
      expect(
        CustomerSchema.safeParse({ id: 'c1', name: 'Jan', email: 'invalid-email' }).success
      ).toBe(false);
    });
  });

  describe('OrderItemSchema', () => {
    it('validates and transforms item with integer price in Cents', () => {
      const valid = {
        id: 'item-1',
        name: 'Laptop',
        priceCents: 349999,
        quantity: 1,
        category: 'Elektronika',
      };
      const result = OrderItemSchema.safeParse(valid);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.priceCents).toBe(349999);
      }
    });

    it('rejects negative or floating point prices', () => {
      expect(
        OrderItemSchema.safeParse({
          id: 'i1',
          name: 'A',
          priceCents: -500,
          quantity: 1,
          category: 'C',
        }).success
      ).toBe(false);

      expect(
        OrderItemSchema.safeParse({
          id: 'i1',
          name: 'A',
          priceCents: 19.99,
          quantity: 1,
          category: 'C',
        }).success
      ).toBe(false);
    });
  });

  describe('OrderSchema & PersistedShopStateSchema', () => {
    const sampleOrder = {
      id: 'ord-101',
      timestamp: '2026-11-13 10:00:00',
      customer: {
        id: 'cust-1',
        name: 'Jan Kowalski',
        email: 'jan@example.com',
      },
      items: [
        {
          id: 'item-1',
          name: 'Słuchawki',
          priceCents: 19999,
          quantity: 1,
          category: 'Elektronika',
        },
      ],
      subtotalCents: 19999,
      deliveryCents: 1500,
      totalCents: 21499,
      paymentMethod: 'Karta kredytowa',
      paymentDetails: {
        method: 'card' as const,
        maskedCard: '**** **** **** 0366',
        last4: '0366',
        expiry: '12/28',
      },
    };

    it('validates a complete order conforming to v2 schema', () => {
      const result = OrderSchema.safeParse(sampleOrder);
      expect(result.success).toBe(true);
    });

    it('validates complete shop state backup v2', () => {
      const state = {
        version: 2 as const,
        exportedAt: '2026-11-13T10:00:00.000Z',
        customers: [sampleOrder.customer],
        orders: [sampleOrder],
      };
      const result = PersistedShopStateSchema.safeParse(state);
      expect(result.success).toBe(true);
    });

    it('validates complete shop state backup v3 with categories and catalog', () => {
      const state = {
        version: 3 as const,
        exportedAt: '2026-11-14T12:00:00.000Z',
        customers: [sampleOrder.customer],
        orders: [sampleOrder],
        categories: [...DEFAULT_CATEGORIES],
        catalog: [...DEFAULT_CATALOG],
      };
      const result = PersistedShopStateSchema.safeParse(state);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.version).toBe(3);
        expect(result.data.categories?.length).toBe(DEFAULT_CATEGORIES.length);
        expect(result.data.catalog?.length).toBe(DEFAULT_CATALOG.length);
      }
    });
  });

  describe('CategorySchema', () => {
    it('validates a valid category object', () => {
      const valid = {
        id: 'cat-custom',
        name: 'Gry Retro',
        slug: 'gry-retro',
        description: 'Klasyczne gry na dyskietkach i kartridżach',
        isDefault: false,
      };
      const result = CategorySchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('rejects invalid category names (less than 2 or more than 50 chars)', () => {
      expect(CategorySchema.safeParse({ id: 'c1', name: 'A', description: 'Desc' }).success).toBe(
        false
      );

      expect(
        CategorySchema.safeParse({ id: 'c1', name: 'A'.repeat(51), description: 'Desc' }).success
      ).toBe(false);
    });

    it('rejects category without an ID', () => {
      expect(CategorySchema.safeParse({ id: '', name: 'Gry', description: 'Desc' }).success).toBe(
        false
      );
    });
  });

  describe('ProductSchema (Dynamic Category & Automatic categoryId Resolution)', () => {
    it('validates a product with both category and categoryId', () => {
      const valid = {
        id: 'p-1',
        sku: 'SKU-01',
        name: 'Modem',
        priceCents: 12000,
        categoryId: 'cat-retro-hardware',
        category: 'Retro Hardware',
        description: 'Opis',
        inStock: true,
        stockQuantity: 5,
      };
      const result = ProductSchema.safeParse(valid);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.categoryId).toBe('cat-retro-hardware');
        expect(result.data.category).toBe('Retro Hardware');
      }
    });

    it('automatically resolves categoryId from DEFAULT_CATEGORIES if missing (legacy v2 compatibility)', () => {
      const legacyProduct = {
        id: 'p-legacy-1',
        sku: 'LEG-01',
        name: 'Laptop Retro',
        priceCents: 349999,
        category: 'Elektronika', // categoryId omitted!
        description: 'Opis',
        inStock: true,
        stockQuantity: 10,
      };
      const result = ProductSchema.safeParse(legacyProduct);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.categoryId).toBe('cat-elektronika');
        expect(result.data.category).toBe('Elektronika');
      }
    });

    it('falls back to DEFAULT_CATEGORY_ID when category name is not in DEFAULT_CATEGORIES and categoryId is omitted', () => {
      const customCategoryProduct = {
        id: 'p-custom-1',
        sku: 'CUST-01',
        name: 'Rzadki Artefakt',
        priceCents: 50000,
        category: 'Nietypowa Kategoria',
        description: 'Opis',
        inStock: true,
        stockQuantity: 1,
      };
      const result = ProductSchema.safeParse(customCategoryProduct);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.categoryId).toBe(DEFAULT_CATEGORY_ID);
      }
    });
  });

  describe('generateDomainId', () => {
    it('generates a string starting with specified prefix', () => {
      const id1 = generateDomainId('test');
      const id2 = generateDomainId('test');
      expect(id1.startsWith('test-')).toBe(true);
      expect(id2.startsWith('test-')).toBe(true);
      expect(id1).not.toBe(id2);
    });

    it('falls back to Math.random when crypto.randomUUID is not available', () => {
      const original = globalThis.crypto;
      try {
        // Temporarily delete or stub randomUUID
        Object.defineProperty(globalThis, 'crypto', {
          value: { randomUUID: undefined },
          configurable: true,
        });
        const id = generateDomainId('fallback');
        expect(id.startsWith('fallback-')).toBe(true);
      } finally {
        Object.defineProperty(globalThis, 'crypto', {
          value: original,
          configurable: true,
        });
      }
    });
  });

  describe('parseLegacyOrCurrentBackup (Legacy Migration & PCI-DSS Hygiene)', () => {
    it('parses an existing modern v2 backup directly without modification', () => {
      const v2Json = JSON.stringify({
        version: 2,
        exportedAt: '2026-11-13T10:00:00.000Z',
        customers: [{ id: 'c1', name: 'Jan', email: 'jan@example.com' }],
        orders: [
          {
            id: 'o1',
            timestamp: '2026-11-13 10:00:00',
            customer: { id: 'c1', name: 'Jan', email: 'jan@example.com' },
            items: [
              {
                id: 'i1',
                name: 'Laptop',
                priceCents: 349999,
                quantity: 1,
                category: 'Elektronika',
              },
            ],
            subtotalCents: 349999,
            deliveryCents: 0,
            totalCents: 349999,
            paymentMethod: 'Karta kredytowa',
            paymentDetails: {
              method: 'card',
              maskedCard: '**** **** **** 0366',
              last4: '0366',
              expiry: '12/28',
            },
          },
        ],
      });

      const parsed = parseLegacyOrCurrentBackup(v2Json);
      expect(parsed.version).toBe(2);
      expect(parsed.orders.length).toBe(1);
      expect(parsed.orders[0]?.subtotalCents).toBe(349999);
      expect(parsed.categories).toBeDefined();
      expect(parsed.categories?.length).toBe(DEFAULT_CATEGORIES.length);
      expect(parsed.catalog).toBeDefined();
      expect(parsed.catalog?.length).toBe(DEFAULT_CATALOG.length);
    });

    it('parses a modern v3 backup with custom categories and products', () => {
      const v3Json = JSON.stringify({
        version: 3,
        exportedAt: '2026-11-14T12:00:00.000Z',
        customers: [{ id: 'c1', name: 'Jan', email: 'jan@example.com' }],
        orders: [],
        categories: [
          {
            id: 'cat-custom',
            name: 'Moja Kategoria',
            description: 'Kategoria v3',
          },
        ],
        catalog: [
          {
            id: 'prod-v3',
            sku: 'V3-SKU',
            name: 'Produkt V3',
            priceCents: 9999,
            categoryId: 'cat-custom',
            category: 'Moja Kategoria',
            description: 'Desc',
            inStock: true,
            stockQuantity: 5,
          },
        ],
      });

      const parsed = parseLegacyOrCurrentBackup(v3Json);
      expect(parsed.version).toBe(3);
      expect(parsed.categories?.length).toBe(1);
      expect(parsed.categories?.[0]?.name).toBe('Moja Kategoria');
      expect(parsed.catalog?.length).toBe(1);
      expect(parsed.catalog?.[0]?.sku).toBe('V3-SKU');
    });

    it('rejects corrupt or non-object JSON inputs with a descriptive error', () => {
      expect(() => parseLegacyOrCurrentBackup('invalid json string {')).toThrow(
        /Nieprawidłowy format JSON/
      );
      expect(() => parseLegacyOrCurrentBackup('"just a string"')).toThrow(
        /oczekiwano obiektu JSON/
      );
      expect(() => parseLegacyOrCurrentBackup('12345')).toThrow(/oczekiwano obiektu JSON/);
      expect(() => parseLegacyOrCurrentBackup('null')).toThrow(/oczekiwano obiektu JSON/);
      expect(() => parseLegacyOrCurrentBackup('[]')).toThrow(/oczekiwano obiektu JSON/);
    });

    it('throws error if version is 2 but content violates v2 schema', () => {
      const invalidV2 = JSON.stringify({
        version: 2,
        exportedAt: '2026-11-13T10:00:00.000Z',
        customers: [{ id: 'c1', name: '', email: 'not-an-email' }],
        orders: [],
      });

      expect(() => parseLegacyOrCurrentBackup(invalidV2)).toThrow(
        /Błąd walidacji kopii zapasowej v2/
      );
    });

    it('migrates legacy Tkinter data.json with floating points to integer Cents and STRIPS PLAINTEXT CVV', () => {
      const legacyJson = JSON.stringify({
        customers: [
          { name: 'Adam Mickiewicz', email: 'adam@pan-tadeusz.pl' },
          { name: 'Juliusz Słowacki', email: '' }, // empty email fallback
        ],
        orders: [
          {
            timestamp: '2026-01-10 14:20:00',
            customer: {
              name: 'Adam Mickiewicz',
              email: 'adam@pan-tadeusz.pl',
            },
            items: [
              {
                name: 'Laptop',
                price: 3499.99, // float!
                qty: 1,
                category: 'Elektronika',
              },
            ],
            subtotal: 3499.99,
            delivery: 0.0,
            total: 3499.99,
            payment_method: 'Karta kredytowa',
            // DANGEROUS LEGACY DATA: contains full 16-digit card and plaintext CVV
            payment_details: {
              method: 'Karta kredytowa',
              card_number: '4532015112830366',
              expiry: '12/28',
              cvv: '789',
            },
          },
          {
            timestamp: '2026-01-11 16:00:00',
            customer: { name: 'Juliusz Słowacki', email: 'juliusz@kordian.pl' },
            items: [
              {
                name: 'Koszulka',
                price: 79.99,
                qty: 2,
                category: 'Odziez',
              },
            ],
            subtotal: 159.98,
            delivery: 15.0,
            total: 174.98,
            payment_method: 'PayPal',
            payment_details: {
              method: 'PayPal',
              email: 'juliusz@paypal.com',
            },
          },
          {
            timestamp: '2026-01-12 18:00:00',
            customer: { name: 'Anonimowy' },
            items: [
              {
                name: 'Książka Python',
                price: 59.99,
                quantity: 1,
                category: 'Edukacja',
              },
            ],
            subtotal: 59.99,
            delivery: 15.0,
            total: 74.99,
            payment_method: 'Bitcoin',
            payment_details: {
              method: 'Bitcoin',
              wallet: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
            },
          },
        ],
      });

      const parsed = parseLegacyOrCurrentBackup(legacyJson);

      // Verify basic migration
      expect(parsed.version).toBe(2);
      expect(parsed.customers.length).toBe(2);
      expect(parsed.orders.length).toBe(3);

      const order1 = parsed.orders[0]!;
      // Floats converted to Cents
      expect(order1.subtotalCents).toBe(349999);
      expect(order1.deliveryCents).toBe(0);
      expect(order1.totalCents).toBe(349999);
      expect(order1.items[0]?.priceCents).toBe(349999);
      expect(order1.items[0]?.quantity).toBe(1);

      // =========================================================================
      // CRITICAL PCI-DSS HYGIENE AUDIT:
      // =========================================================================
      const p1Details = order1.paymentDetails;
      expect(p1Details.method).toBe('card');
      if (p1Details.method === 'card') {
        expect(p1Details.maskedCard).toBe('**** **** **** 0366');
        expect(p1Details.last4).toBe('0366');
        expect(p1Details.expiry).toBe('12/28');

        // Unconditionally no CVV
        expect(p1Details).not.toHaveProperty('cvv');
        expect(p1Details).not.toHaveProperty('cvc');
        expect(p1Details).not.toHaveProperty('card_number');
      }

      // Check entire serialized migrated backup for leaks of CVV or full card number
      const serialized = JSON.stringify(parsed);
      expect(serialized.includes('"789"')).toBe(false);
      expect(serialized.includes('453201511283')).toBe(false);

      // Verify Order 2 (PayPal)
      const order2 = parsed.orders[1]!;
      expect(order2.subtotalCents).toBe(15998); // 159.98 -> 15998
      expect(order2.deliveryCents).toBe(1500); // 15.00 -> 1500
      expect(order2.totalCents).toBe(17498);
      expect(order2.paymentDetails.method).toBe('paypal');

      // Verify Order 3 (Bitcoin)
      const order3 = parsed.orders[2]!;
      expect(order3.subtotalCents).toBe(5999);
      expect(order3.deliveryCents).toBe(1500);
      expect(order3.totalCents).toBe(7499);
      expect(order3.paymentDetails.method).toBe('bitcoin');
      if (order3.paymentDetails.method === 'bitcoin') {
        expect(order3.paymentDetails.walletAddress).toBe('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa');
        expect(order3.paymentDetails.btcRatePln).toBe(250000);
        expect(typeof order3.paymentDetails.btcAmount).toBe('string');
      }
    });

    it('handles legacy file with empty customers and orders arrays safely', () => {
      const emptyLegacy = JSON.stringify({
        customers: [],
        orders: [],
      });
      const parsed = parseLegacyOrCurrentBackup(emptyLegacy);
      expect(parsed.version).toBe(2);
      expect(parsed.customers).toEqual([]);
      expect(parsed.orders).toEqual([]);
    });

    it('migrates legacy orders using modern camelCase properties, pre-existing IDs, and valid SafePaymentInfo', () => {
      const legacyWithCamelCase = JSON.stringify({
        customers: [
          {
            id: 'existing-cust-id',
            name: 'Krystyna Janda',
            email: 'krystyna@teatr.pl',
          },
        ],
        orders: [
          {
            id: 'existing-ord-id',
            timestamp: '2026-02-01 12:00:00',
            customer: {
              id: 'existing-cust-id',
              name: 'Krystyna Janda',
              email: 'krystyna@teatr.pl',
            },
            items: [
              {
                id: 'existing-item-id',
                name: 'Książka Python',
                priceCents: 5999, // Already in Cents
                quantity: 2, // Modern quantity
                category: 'Edukacja',
              },
            ],
            subtotalCents: 11998,
            deliveryCents: 1500,
            totalCents: 13498,
            paymentMethod: 'Karta kredytowa',
            paymentDetails: {
              // Already valid SafeCardPayment!
              method: 'card',
              maskedCard: '**** **** **** 9999',
              last4: '9999',
              expiry: '11/30',
            },
          },
          {
            paymentMethod: 'Karta kredytowa',
            paymentDetails: {
              cardNumber: '5500000000000004', // camelCase cardNumber
              expiry: '10/29',
              cvv: '123',
            },
            items: [
              {
                name: 'Koszulka',
                price: 79.99,
              },
            ],
          },
          {
            paymentMethod: 'Bitcoin',
            paymentDetails: {
              walletAddress: '3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy', // camelCase walletAddress
              btcRatePln: 300000,
              btcAmount: '0.00100000',
            },
          },
        ],
      });

      const parsed = parseLegacyOrCurrentBackup(legacyWithCamelCase);
      expect(parsed.orders.length).toBe(3);

      const o1 = parsed.orders[0]!;
      expect(o1.id).toBe('existing-ord-id');
      expect(o1.customer.id).toBe('existing-cust-id');
      expect(o1.items[0]?.id).toBe('existing-item-id');
      expect(o1.paymentDetails.method).toBe('card');
      if (o1.paymentDetails.method === 'card') {
        expect(o1.paymentDetails.last4).toBe('9999');
      }

      const o2 = parsed.orders[1]!;
      expect(o2.paymentDetails.method).toBe('card');
      if (o2.paymentDetails.method === 'card') {
        expect(o2.paymentDetails.last4).toBe('0004');
        expect(o2.paymentDetails).not.toHaveProperty('cvv');
      }

      const o3 = parsed.orders[2]!;
      expect(o3.paymentDetails.method).toBe('bitcoin');
      if (o3.paymentDetails.method === 'bitcoin') {
        expect(o3.paymentDetails.btcRatePln).toBe(300000);
        expect(o3.paymentDetails.btcAmount).toBe('0.00100000');
      }
    });
  });
});
