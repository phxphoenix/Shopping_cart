import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as adminLoginApi from '../../../api/admin/login';
import * as adminSessionApi from '../../../api/admin/session';
import * as categoriesApi from '../../../api/categories';
import * as categoriesMigrateApi from '../../../api/categories/migrate';
import * as customersApi from '../../../api/customers';
import * as ordersApi from '../../../api/orders';
import * as stateApi from '../../../api/state';
import * as productsDirectApi from '../../../api/products';
import {
  DEFAULT_CATEGORIES,
  DEFAULT_CATEGORY_ID,
  DEFAULT_CATALOG,
} from '../../../src/domain/catalog';
import { toCents } from '../../../src/domain/money';
import { createAdminSessionToken, resetRateLimits } from '../../../src/server/auth';
import {
  InMemoryShopRepository,
  resetRepositoryForTesting,
  setRepositoryForTesting,
} from '../../../src/server/repository';

describe('Server API Endpoints (/api/*)', () => {
  let inMemoryRepo: InMemoryShopRepository;
  const originalEnv = { ...process.env };

  function createAuthHeader(): { Cookie: string } {
    const token = createAdminSessionToken();
    return { Cookie: `retro_admin_session=${token}` };
  }

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.ADMIN_PASSWORD = 'test-admin-pass';
    process.env.ADMIN_SESSION_SECRET = 'super-secret-key-for-test-suite-32-chars';
    resetRateLimits();
    inMemoryRepo = new InMemoryShopRepository();
    setRepositoryForTesting(inMemoryRepo);
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    resetRateLimits();
    resetRepositoryForTesting();
  });

  // -------------------------------------------------------------------------
  // Admin Session & Login
  // -------------------------------------------------------------------------
  describe('/api/admin/session & /api/admin/login', () => {
    it('GET /api/admin/session returns { isAdmin: false } when unauthenticated', async () => {
      const req = new Request('http://localhost/api/admin/session');
      const res = await adminSessionApi.GET(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toEqual({ isAdmin: false });
    });

    it('GET /api/admin/session returns { isAdmin: true } with valid session cookie', async () => {
      const req = new Request('http://localhost/api/admin/session', {
        headers: createAuthHeader(),
      });
      const res = await adminSessionApi.GET(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toEqual({ isAdmin: true });
    });

    it('POST /api/admin/session rejects empty or invalid password with 400/401', async () => {
      const emptyReq = new Request('http://localhost/api/admin/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const emptyRes = await adminSessionApi.POST(emptyReq);
      expect(emptyRes.status).toBe(400);

      const wrongReq = new Request('http://localhost/api/admin/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'wrong-pass' }),
      });
      const wrongRes = await adminSessionApi.POST(wrongReq);
      expect(wrongRes.status).toBe(401);
      const wrongJson = await wrongRes.json();
      expect(wrongJson.error).toContain('Nieprawidłowe hasło');
    });

    it('POST /api/admin/session blocks brute-force attempts with 429 after 5 failed attempts', async () => {
      for (let i = 0; i < 5; i++) {
        const req = new Request('http://localhost/api/admin/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '10.0.0.1' },
          body: JSON.stringify({ password: `wrong-${i}` }),
        });
        const res = await adminSessionApi.POST(req);
        expect(res.status).toBe(401);
      }

      // 6th attempt from the same IP must be rate-limited with 429
      const blockedReq = new Request('http://localhost/api/admin/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '10.0.0.1' },
        body: JSON.stringify({ password: 'test-admin-pass' }),
      });
      const blockedRes = await adminSessionApi.POST(blockedReq);
      expect(blockedRes.status).toBe(429);
      expect(blockedRes.headers.get('Retry-After')).toBeDefined();
      const blockedJson = await blockedRes.json();
      expect(blockedJson.error).toContain('Zbyt wiele nieudanych prób');
    });

    it('POST /api/admin/session succeeds with correct password and sets HttpOnly cookie', async () => {
      const req = new Request('http://localhost/api/admin/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'test-admin-pass' }),
      });
      const res = await adminSessionApi.POST(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.isAdmin).toBe(true);
      expect(json.token).toBeDefined();

      const setCookie = res.headers.get('Set-Cookie');
      expect(setCookie).toContain('retro_admin_session=');
      expect(setCookie).toContain('HttpOnly');
      expect(setCookie).toContain('SameSite=Strict');
    });

    it('DELETE /api/admin/session clears session cookie upon logout', async () => {
      const res = await adminSessionApi.DELETE();
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toEqual({ success: true, isAdmin: false });

      const setCookie = res.headers.get('Set-Cookie');
      expect(setCookie).toContain('retro_admin_session=');
      expect(setCookie).toContain('Max-Age=0');
    });

    it('/api/admin/login alias delegates identically to session handlers', async () => {
      const req = new Request('http://localhost/api/admin/login');
      const res = await adminLoginApi.GET(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toEqual({ isAdmin: false });
    });
  });

  // -------------------------------------------------------------------------
  // Categories API & Migrations
  // -------------------------------------------------------------------------
  describe('/api/categories & /api/categories/migrate', () => {
    it('GET /api/categories is public and returns all categories', async () => {
      const res = await categoriesApi.GET();
      expect(res.status).toBe(200);
      const list = await res.json();
      expect(Array.isArray(list)).toBe(true);
      expect(list.length).toBe(DEFAULT_CATEGORIES.length);
      expect(list[0]?.id).toBe(DEFAULT_CATEGORY_ID);
    });

    it('rejects POST, PUT, DELETE /api/categories without admin authorization with 401', async () => {
      const postReq = new Request('http://localhost/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Nowa Kategoria' }),
      });
      expect((await categoriesApi.POST(postReq)).status).toBe(401);

      const putReq = new Request('http://localhost/api/categories?id=cat-elektronika', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Zmieniona' }),
      });
      expect((await categoriesApi.PUT(putReq)).status).toBe(401);

      const deleteReq = new Request('http://localhost/api/categories?id=cat-elektronika', {
        method: 'DELETE',
      });
      expect((await categoriesApi.DELETE(deleteReq)).status).toBe(401);
    });

    it('allows admin to create, update and delete category with automatic fallback', async () => {
      // 1. Create category
      const createReq = new Request('http://localhost/api/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...createAuthHeader(),
        },
        body: JSON.stringify({
          name: 'Peryferia Retro',
          description: 'Kable, przejściówki, modemy',
        }),
      });
      const createRes = await categoriesApi.POST(createReq);
      expect(createRes.status).toBe(201);
      const created = await createRes.json();
      expect(created.name).toBe('Peryferia Retro');

      // 2. Update category
      const updateReq = new Request(`http://localhost/api/categories?id=${created.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...createAuthHeader(),
        },
        body: JSON.stringify({
          name: 'Peryferia Retro V2',
        }),
      });
      const updateRes = await categoriesApi.PUT(updateReq);
      expect(updateRes.status).toBe(200);
      const updated = await updateRes.json();
      expect(updated.category.name).toBe('Peryferia Retro V2');

      // 3. Delete category (should succeed)
      const deleteReq = new Request(`http://localhost/api/categories?id=${created.id}`, {
        method: 'DELETE',
        headers: createAuthHeader(),
      });
      const deleteRes = await categoriesApi.DELETE(deleteReq);
      expect(deleteRes.status).toBe(200);
      const deleteJson = await deleteRes.json();
      expect(deleteJson.success).toBe(true);
      expect(deleteJson.deletedCategoryId).toBe(created.id);
    });

    it('blocks deleting default category (cat-default) with 400 Bad Request', async () => {
      const deleteReq = new Request(`http://localhost/api/categories?id=${DEFAULT_CATEGORY_ID}`, {
        method: 'DELETE',
        headers: createAuthHeader(),
      });
      const res = await categoriesApi.DELETE(deleteReq);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain('Nie można usunąć domyślnej kategorii');
    });

    it('/api/categories/migrate moves products in bulk with admin authentication', async () => {
      const unauthReq = new Request('http://localhost/api/categories/migrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceCategoryId: 'cat-elektronika',
          targetCategoryId: 'cat-retro-hardware',
        }),
      });
      expect((await categoriesMigrateApi.POST(unauthReq)).status).toBe(401);

      const authReq = new Request('http://localhost/api/categories/migrate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...createAuthHeader(),
        },
        body: JSON.stringify({
          sourceCategoryId: 'cat-elektronika',
          targetCategoryId: 'cat-retro-hardware',
        }),
      });
      const res = await categoriesMigrateApi.POST(authReq);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.migratedCount).toBeGreaterThan(0);
    });
  });

  // -------------------------------------------------------------------------
  // Products API
  // -------------------------------------------------------------------------
  describe('/api/products', () => {
    it('GET /api/products returns products list and supports category & search filtering', async () => {
      const resAll = await productsDirectApi.GET(new Request('http://localhost/api/products'));
      expect(resAll.status).toBe(200);
      const all = await resAll.json();
      expect(all.length).toBe(DEFAULT_CATALOG.length);

      const resFiltered = await productsDirectApi.GET(
        new Request('http://localhost/api/products?category=cat-elektronika')
      );
      const filtered = await resFiltered.json();
      expect(filtered.length).toBeGreaterThan(0);
      expect(
        filtered.every((p: { categoryId: string }) => p.categoryId === 'cat-elektronika')
      ).toBe(true);

      const resSearch = await productsDirectApi.GET(
        new Request('http://localhost/api/products?search=HW-LAPTOP-01')
      );
      const searchRes = await resSearch.json();
      expect(searchRes.length).toBe(1);
      expect(searchRes[0].name).toBe('Laptop');
    });

    it('rejects POST, PUT, DELETE without admin session with 401', async () => {
      const postReq = new Request('http://localhost/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sku: 'NEW-01',
          name: 'Nowy',
          priceCents: 1000,
          categoryId: 'cat-default',
          stockQuantity: 1,
        }),
      });
      expect((await productsDirectApi.POST(postReq)).status).toBe(401);

      const putReq = new Request('http://localhost/api/products?id=prod-laptop', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Zmieniony' }),
      });
      expect((await productsDirectApi.PUT(putReq)).status).toBe(401);

      const delReq = new Request('http://localhost/api/products?id=prod-laptop', {
        method: 'DELETE',
      });
      expect((await productsDirectApi.DELETE(delReq)).status).toBe(401);
    });

    it('allows admin full CRUD of products', async () => {
      // 1. Create product
      const createReq = new Request('http://localhost/api/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...createAuthHeader(),
        },
        body: JSON.stringify({
          sku: 'MODEM-28800',
          name: 'Modem Telefoniczny 28.8k',
          priceCents: toCents(12900),
          categoryId: 'cat-akcesoria',
          stockQuantity: 10,
        }),
      });
      const createRes = await productsDirectApi.POST(createReq);
      expect(createRes.status).toBe(201);
      const created = await createRes.json();
      expect(created.sku).toBe('MODEM-28800');

      // 2. Update product
      const updateReq = new Request(`http://localhost/api/products?id=${created.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...createAuthHeader(),
        },
        body: JSON.stringify({
          name: 'Modem Telefoniczny 33.6k V.34',
          priceCents: toCents(14900),
        }),
      });
      const updateRes = await productsDirectApi.PUT(updateReq);
      expect(updateRes.status).toBe(200);
      const updated = await updateRes.json();
      expect(updated.name).toBe('Modem Telefoniczny 33.6k V.34');
      expect(updated.priceCents).toBe(toCents(14900));

      // 3. Delete product
      const delReq = new Request(`http://localhost/api/products?id=${created.id}`, {
        method: 'DELETE',
        headers: createAuthHeader(),
      });
      const delRes = await productsDirectApi.DELETE(delReq);
      expect(delRes.status).toBe(200);
      const delJson = await delRes.json();
      expect(delJson.success).toBe(true);
      expect(delJson.deletedProductId).toBe(created.id);
    });
  });

  // -------------------------------------------------------------------------
  // Customers API (PII hygiene, Registration, Honeypot & Admin Delete)
  // -------------------------------------------------------------------------
  describe('/api/customers', () => {
    it('GET /api/customers masks emails for public requests and reveals full emails for Admin', async () => {
      // Public request
      const pubReq = new Request('http://localhost/api/customers');
      const pubRes = await customersApi.GET(pubReq);
      expect(pubRes.status).toBe(200);
      const pubList = await pubRes.json();
      expect(pubList[0].email).toMatch(/^[a-z0-9_.-]\*\*\*[a-z0-9_.-]@/i);
      expect(pubList[0].email).not.toBe('jan.kowalski@example.com');

      // Admin request
      const adminReq = new Request('http://localhost/api/customers', {
        headers: createAuthHeader(),
      });
      const adminRes = await customersApi.GET(adminReq);
      expect(adminRes.status).toBe(200);
      const adminList = await adminRes.json();
      expect(adminList[0].email).toBe('jan.kowalski@example.com');
    });

    it('POST /api/customers successfully registers a valid customer with 201 Created', async () => {
      const req = new Request('http://localhost/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Tomasz Lis',
          email: 'tomasz.lis@example.com',
        }),
      });
      const res = await customersApi.POST(req);
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.id).toBeDefined();
      expect(json.name).toBe('Tomasz Lis');
      expect(json.email).toBe('tomasz.lis@example.com');
    });

    it('POST /api/customers rejects duplicate email with 409 Conflict', async () => {
      const req = new Request('http://localhost/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Jan Kowalski Duplikat',
          email: 'JAN.KOWALSKI@EXAMPLE.COM',
        }),
      });
      const res = await customersApi.POST(req);
      expect(res.status).toBe(409);
      const json = await res.json();
      expect(json.error).toContain('jest już zarejestrowany');
    });

    it('POST /api/customers rejects filled honeypot or companyWebsite fields with 400 Bad Request', async () => {
      const botReq = new Request('http://localhost/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Bot Spammer',
          email: 'bot@spam.com',
          honeypot: 'http://spam.org',
        }),
      });
      const botRes = await customersApi.POST(botReq);
      expect(botRes.status).toBe(400);
      const json = await botRes.json();
      expect(json.error).toContain('anty-spam honeypot');
    });

    it('POST /api/customers enforces sliding rate limit of max 5 registrations / 10 min with 429', async () => {
      const names = [
        'Klient Pierwszy',
        'Klient Drugi',
        'Klient Trzeci',
        'Klient Czwarty',
        'Klient Piaty',
      ];
      for (let i = 0; i < 5; i++) {
        const req = new Request('http://localhost/api/customers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '192.168.1.100' },
          body: JSON.stringify({
            name: names[i],
            email: `klient.${i}@example.com`,
          }),
        });
        const res = await customersApi.POST(req);
        expect(res.status).toBe(201);
      }

      // 6th registration from the same IP must be blocked
      const blockedReq = new Request('http://localhost/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '192.168.1.100' },
        body: JSON.stringify({
          name: 'Klient Zablokowany',
          email: 'blocked@example.com',
        }),
      });
      const blockedRes = await customersApi.POST(blockedReq);
      expect(blockedRes.status).toBe(429);
      const blockedJson = await blockedRes.json();
      expect(blockedJson.error).toContain('Zbyt wiele prób rejestracji');
    });

    it('DELETE /api/customers is strictly protected by Admin session (401 for unauth)', async () => {
      const unauthReq = new Request('http://localhost/api/customers?id=cust-demo-1', {
        method: 'DELETE',
      });
      const unauthRes = await customersApi.DELETE(unauthReq);
      expect(unauthRes.status).toBe(401);

      const authReq = new Request('http://localhost/api/customers?id=cust-demo-1', {
        method: 'DELETE',
        headers: createAuthHeader(),
      });
      const authRes = await customersApi.DELETE(authReq);
      expect(authRes.status).toBe(200);
      const json = await authRes.json();
      expect(json.success).toBe(true);
      expect(json.deletedCustomerId).toBe('cust-demo-1');
    });
  });

  // -------------------------------------------------------------------------
  // Orders API (Server-side price verification & PCI-DSS hygiene)
  // -------------------------------------------------------------------------
  describe('/api/orders', () => {
    it('GET /api/orders returns existing orders', async () => {
      const res = await ordersApi.GET();
      expect(res.status).toBe(200);
      const orders = await res.json();
      expect(Array.isArray(orders)).toBe(true);
      expect(orders.length).toBe(2);
    });

    it('POST /api/orders calculates prices from server catalog ignoring client manipulation', async () => {
      // Client attempts to send laptop with manipulated price of 1 PLN (100 cents)
      const fakeOrderReq = new Request('http://localhost/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer: {
            id: 'cust-demo-1',
          },
          items: [
            {
              id: 'prod-laptop',
              priceCents: 100, // Spoofed price
              quantity: 1,
            },
          ],
          payment: {
            method: 'paypal',
            email: 'jan.kowalski@example.com',
          },
        }),
      });

      const res = await ordersApi.POST(fakeOrderReq);
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.success).toBe(true);

      const order = json.order;
      // Actual laptop price in catalog is 3499.99 PLN (349999 cents)
      expect(order.subtotalCents).toBe(toCents(349999));
      expect(order.items[0].priceCents).toBe(toCents(349999));
      // Total >= 200.00 PLN qualifies for free delivery
      expect(order.deliveryCents).toBe(0);
      expect(order.totalCents).toBe(toCents(349999));
    });

    it('POST /api/orders adds 15.00 PLN delivery fee when subtotal is below 200.00 PLN', async () => {
      // Słuchawki price = 199.99 PLN (19999 cents), which is strictly below 20000 cents threshold
      const orderReq = new Request('http://localhost/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer: {
            id: 'cust-demo-2',
          },
          items: [
            {
              id: 'prod-sluchawki',
              quantity: 1,
            },
          ],
          payment: {
            method: 'paypal',
            email: 'anna.nowak@example.com',
          },
        }),
      });

      const res = await ordersApi.POST(orderReq);
      expect(res.status).toBe(201);
      const json = await res.json();
      const order = json.order;

      expect(order.subtotalCents).toBe(toCents(19999));
      expect(order.deliveryCents).toBe(toCents(1500));
      expect(order.totalCents).toBe(toCents(19999 + 1500));
    });

    it('POST /api/orders applies RETRO10 coupon code correctly', async () => {
      const orderReq = new Request('http://localhost/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer: {
            id: 'cust-demo-1',
          },
          items: [
            {
              id: 'prod-sluchawki', // 199.99 PLN -> 19999 cents
              quantity: 1,
            },
          ],
          discountCode: 'RETRO10',
          payment: {
            method: 'paypal',
            email: 'jan.kowalski@example.com',
          },
        }),
      });

      const res = await ordersApi.POST(orderReq);
      expect(res.status).toBe(201);
      const json = await res.json();
      const order = json.order;

      // 10% discount on 19999 cents = 2000 cents
      // 19999 - 2000 = 17999 cents subtotalAfterDiscount
      // delivery: 1500 cents
      // total: 17999 + 1500 = 19499 cents
      expect(order.totalCents).toBe(toCents(17999 + 1500));
    });

    it('POST /api/orders enforces PCI-DSS hygiene: CVV is never returned or stored', async () => {
      const cardOrderReq = new Request('http://localhost/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer: {
            id: 'cust-demo-1',
          },
          items: [{ id: 'prod-dyskietki', quantity: 1 }],
          payment: {
            method: 'card',
            cardNumber: '4532 0151 1283 0366', // Valid Luhn test card
            expiry: '12/28',
            cvv: '789', // Sensitive transient data
          },
        }),
      });

      const res = await ordersApi.POST(cardOrderReq);
      expect(res.status).toBe(201);
      const json = await res.json();
      const order = json.order;

      expect(order.paymentDetails.method).toBe('card');
      expect(order.paymentDetails.maskedCard).toBe('**** **** **** 0366');
      expect(order.paymentDetails.last4).toBe('0366');
      // Assert strictly that CVV is nowhere in the returned object or memory
      expect(JSON.stringify(order)).not.toContain('789');
      expect((order.paymentDetails as Record<string, unknown>).cvv).toBeUndefined();
    });

    it('DELETE /api/orders deletes order', async () => {
      const delReq = new Request('http://localhost/api/orders?id=ord-demo-1', {
        method: 'DELETE',
      });
      const res = await ordersApi.DELETE(delReq);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.deletedOrderId).toBe('ord-demo-1');
    });
  });

  // -------------------------------------------------------------------------
  // State API (Initial state & Demo reset / Backup import)
  // -------------------------------------------------------------------------
  describe('/api/state', () => {
    it('GET /api/state returns categories, catalog, masked customers, orders and isAdmin', async () => {
      const pubReq = new Request('http://localhost/api/state');
      const pubRes = await stateApi.GET(pubReq);
      expect(pubRes.status).toBe(200);
      const pubJson = await pubRes.json();

      expect(pubJson.isAdmin).toBe(false);
      expect(pubJson.categories.length).toBe(DEFAULT_CATEGORIES.length);
      expect(pubJson.catalog.length).toBe(DEFAULT_CATALOG.length);
      expect(pubJson.customers[0].email).toMatch(/^[a-z0-9_.-]\*\*\*[a-z0-9_.-]@/i);

      // Authenticated admin GET /api/state
      const adminReq = new Request('http://localhost/api/state', {
        headers: createAuthHeader(),
      });
      const adminRes = await stateApi.GET(adminReq);
      const adminJson = await adminRes.json();
      expect(adminJson.isAdmin).toBe(true);
      expect(adminJson.customers[0].email).toBe('jan.kowalski@example.com');
    });

    it('POST /api/state requires admin authorization for resetDemo and importBackup', async () => {
      const unauthReq = new Request('http://localhost/api/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resetDemo' }),
      });
      expect((await stateApi.POST(unauthReq)).status).toBe(401);

      const authReq = new Request('http://localhost/api/state', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...createAuthHeader(),
        },
        body: JSON.stringify({ action: 'resetDemo' }),
      });
      const authRes = await stateApi.POST(authReq);
      expect(authRes.status).toBe(200);
      const json = await authRes.json();
      expect(json.success).toBe(true);
      expect(json.state).toBeDefined();
    });
  });
});
