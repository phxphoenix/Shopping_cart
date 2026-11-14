import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_CATEGORY_ID } from '@/domain/catalog';
import { toCents } from '@/domain/money';
import type { StorageAdapter } from '@/storage/adapter';
import { InMemoryStorageAdapter } from '@/storage/inMemoryAdapter';
import { ShopApiClient } from '@/store/apiClient';
import { createShopStore, type ShopStore } from '@/store/useShopStore';

describe('Integration: Zustand Store + In-Memory Storage Adapter', () => {
  let adapter: InMemoryStorageAdapter;
  let store: ShopStore;

  beforeEach(() => {
    adapter = new InMemoryStorageAdapter();
    store = createShopStore(adapter);
  });

  describe('Initialization & Seeding', () => {
    it('initializes with seed data when storage adapter is initially empty', async () => {
      expect(store.getState().isInitialized).toBe(false);
      expect(store.getState().customers).toHaveLength(0);

      await store.getState().initialize();

      const state = store.getState();
      expect(state.isInitialized).toBe(true);
      expect(state.isLoading).toBe(false);
      expect(state.customers).toHaveLength(2);
      expect(state.customers[0]?.name).toBe('Jan Kowalski');
      expect(state.customers[1]?.name).toBe('Anna Nowak');
      expect(state.orders).toHaveLength(2);
      expect(state.cart).toEqual([]);
      expect(state.selectedCustomerId).toBe('cust-demo-1');
      expect(state.settings.crtFx).toBe(true);

      // Verify adapter was seeded as well
      const saved = await adapter.loadState();
      expect(saved).not.toBeNull();
      expect(saved?.customers).toHaveLength(2);
    });

    it('loads existing state from adapter when already populated', async () => {
      // Pre-populate adapter
      await adapter.saveState({
        version: 2,
        exportedAt: '2026-11-13T08:00:00.000Z',
        customers: [{ id: 'c-custom', name: 'Zofia Nałkowska', email: 'zofia@literatura.pl' }],
        orders: [],
        cart: [],
        selectedCustomerId: 'c-custom',
        settings: { crtFx: false },
      });

      await store.getState().initialize();

      const state = store.getState();
      expect(state.isInitialized).toBe(true);
      expect(state.customers).toHaveLength(1);
      expect(state.customers[0]?.name).toBe('Zofia Nałkowska');
      expect(state.selectedCustomerId).toBe('c-custom');
      expect(state.settings.crtFx).toBe(false);
    });

    it('does not re-seed or reload if initialize() is called multiple times', async () => {
      await store.getState().initialize();
      store.getState().addCustomer({ name: 'Nowy Klient', email: 'nowy@test.pl' });
      expect(store.getState().customers).toHaveLength(3);

      await store.getState().initialize();
      expect(store.getState().customers).toHaveLength(3);
    });

    it('falls back to seed data if adapter.loadState() throws unexpected exception', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const failingAdapter: StorageAdapter = {
        loadState: vi.fn().mockRejectedValue(new Error('Fatal I/O Error')),
        saveState: vi.fn().mockResolvedValue(undefined),
        clearState: vi.fn().mockResolvedValue(undefined),
      };
      const crashStore = createShopStore(failingAdapter);

      await crashStore.getState().initialize();
      expect(crashStore.getState().isInitialized).toBe(true);
      expect(crashStore.getState().statusTone).toBe('warning');
      expect(crashStore.getState().customers).toHaveLength(2);
      consoleSpy.mockRestore();
    });
  });

  describe('Catalog Filtering & Searching', () => {
    beforeEach(async () => {
      await store.getState().initialize();
    });

    it('returns complete default catalog by default', () => {
      const products = store.getState().getFilteredProducts();
      expect(products.length).toBeGreaterThanOrEqual(8);
      expect(products.some((p) => p.name === 'Laptop')).toBe(true);
    });

    it('filters products by search query across name, sku, and description', () => {
      store.getState().setSearchQuery('książka');
      const filtered = store.getState().getFilteredProducts();
      expect(filtered).toHaveLength(1);
      expect(filtered[0]?.name).toBe('Książka Python');

      store.getState().setSearchQuery('RH-CRT17-06');
      expect(store.getState().getFilteredProducts()[0]?.name).toContain('Monitor CRT');

      store.getState().setSearchQuery('');
      expect(store.getState().getFilteredProducts().length).toBeGreaterThanOrEqual(8);
    });

    it('filters products by category and combines with search query', () => {
      store.getState().setSelectedCategory('Retro Hardware');
      const retroItems = store.getState().getFilteredProducts();
      expect(retroItems.length).toBeGreaterThan(0);
      expect(retroItems.every((p) => p.category === 'Retro Hardware')).toBe(true);

      // Search within category
      store.getState().setSearchQuery('Klawiatura');
      const matched = store.getState().getFilteredProducts();
      expect(matched).toHaveLength(1);
      expect(matched[0]?.name).toContain('Klawiatura');

      store.getState().setSelectedCategory('ALL');
      store.getState().setSearchQuery('');
    });

    it('allows adding custom products to the catalog', () => {
      const customProduct = {
        id: 'prod-custom-01',
        sku: 'CUST-01',
        name: 'Modem 56k V.90',
        priceCents: toCents(12900),
        categoryId: 'cat-retro-hardware',
        category: 'Retro Hardware' as const,
        description: 'Klasyczny modem telefoniczny 56kbps.',
        inStock: true,
        stockQuantity: 5,
      };

      store.getState().addProductToCatalog(customProduct);
      store.getState().setSearchQuery('Modem');
      expect(store.getState().getFilteredProducts()).toHaveLength(1);
      expect(store.getState().statusTone).toBe('success');
    });
  });

  describe('Cart Operations & Free Delivery Threshold', () => {
    beforeEach(async () => {
      await store.getState().initialize();
    });

    it('computes zero totals for empty cart', () => {
      const totals = store.getState().getCartTotals();
      expect(totals.subtotalCents).toBe(0);
      expect(totals.deliveryCents).toBe(0);
      expect(totals.totalCents).toBe(0);
      expect(totals.isFreeDelivery).toBe(false);
      expect(totals.amountToFreeDeliveryCents).toBe(20000);
      expect(totals.itemCount).toBe(0);
    });

    it('strictly handles 200.00 PLN threshold: 199.99 PLN adds delivery 15.00 PLN', () => {
      // Słuchawki: 199.99 PLN (19 999 groszy)
      store.getState().addToCart('prod-sluchawki', 1);

      let totals = store.getState().getCartTotals();
      expect(totals.subtotalCents).toBe(19999);
      expect(totals.deliveryCents).toBe(1500); // 15.00 PLN
      expect(totals.totalCents).toBe(21499); // 214.99 PLN
      expect(totals.isFreeDelivery).toBe(false);
      expect(totals.amountToFreeDeliveryCents).toBe(1); // exactly 1 grosz missing!
      expect(totals.itemCount).toBe(1);

      // Now add 1 pack of floppy disks (39.99 PLN = 3999 groszy) -> Subtotal: 239.98 PLN
      store.getState().addToCart('prod-dyskietki', 1);

      totals = store.getState().getCartTotals();
      expect(totals.subtotalCents).toBe(23998);
      expect(totals.deliveryCents).toBe(0); // FREE DELIVERY!
      expect(totals.totalCents).toBe(23998);
      expect(totals.isFreeDelivery).toBe(true);
      expect(totals.amountToFreeDeliveryCents).toBe(0);
      expect(totals.itemCount).toBe(2);
    });

    it('supports increment, decrement, setCartQuantity and remove', () => {
      store.getState().addToCart('prod-koszulka', 1); // 79.99 PLN
      expect(store.getState().cart[0]?.quantity).toBe(1);

      store.getState().incrementCartItem('prod-koszulka');
      expect(store.getState().cart[0]?.quantity).toBe(2);
      expect(store.getState().getCartTotals().subtotalCents).toBe(15998);

      store.getState().setCartQuantity('prod-koszulka', 3);
      expect(store.getState().cart[0]?.quantity).toBe(3);

      store.getState().decrementCartItem('prod-koszulka');
      expect(store.getState().cart[0]?.quantity).toBe(2);

      store.getState().decrementCartItem('prod-koszulka');
      expect(store.getState().cart[0]?.quantity).toBe(1);

      // Decrementing when quantity is 1 removes the item
      store.getState().decrementCartItem('prod-koszulka');
      expect(store.getState().cart).toHaveLength(0);
    });

    it('removes item directly and clears cart', () => {
      store.getState().addToCart('prod-laptop', 1);
      store.getState().addToCart('prod-plecak', 1);
      expect(store.getState().cart).toHaveLength(2);

      store.getState().removeFromCart('prod-laptop');
      expect(store.getState().cart).toHaveLength(1);
      expect(store.getState().cart[0]?.product.id).toBe('prod-plecak');

      store.getState().clearCart();
      expect(store.getState().cart).toHaveLength(0);
    });

    it('gracefully handles invalid quantities or missing cart items', () => {
      // Missing item increment/decrement
      store.getState().incrementCartItem('non-existent');
      store.getState().decrementCartItem('non-existent');
      expect(store.getState().cart).toHaveLength(0);

      // Invalid quantity
      store.getState().addToCart('prod-koszulka', 1);
      store.getState().setCartQuantity('prod-koszulka', -5);
      expect(store.getState().statusTone).toBe('error');
    });

    it('reports error when adding non-existent product ID', () => {
      store.getState().addToCart('non-existent-id');
      expect(store.getState().statusTone).toBe('error');
      expect(store.getState().statusMessage).toContain('Nie znaleziono produktu');
    });
  });

  describe('Customer Management', () => {
    beforeEach(async () => {
      await store.getState().initialize();
    });

    it('adds customer with valid name and email and auto-selects if none selected', () => {
      store.getState().selectCustomer(null);
      const success = store.getState().addCustomer({
        name: 'Maria Skłodowska',
        email: 'maria@curie.pl',
      });

      expect(success).toBe(true);
      const customers = store.getState().customers;
      expect(customers.some((c) => c.name === 'Maria Skłodowska')).toBe(true);
      expect(store.getState().selectedCustomerId).not.toBeNull();
      expect(store.getState().getSelectedCustomer()?.name).toBe('Maria Skłodowska');
      expect(store.getState().statusTone).toBe('success');
    });

    it('rejects customer with invalid email or empty name', () => {
      const initialCount = store.getState().customers.length;

      expect(store.getState().addCustomer({ name: '', email: 'valid@example.com' })).toBe(false);
      expect(store.getState().addCustomer({ name: 'Jan', email: 'not-an-email' })).toBe(false);

      expect(store.getState().customers).toHaveLength(initialCount);
      expect(store.getState().statusTone).toBe('error');
    });

    it('safely removes customer and updates selectedCustomerId if active customer removed', async () => {
      await store.getState().loginAdmin('admin123');
      const initialCustomers = store.getState().customers;
      const firstCust = initialCustomers[0]!;
      const secondCust = initialCustomers[1]!;

      store.getState().selectCustomer(firstCust.id);

      await store.getState().removeCustomer(firstCust.id);

      expect(store.getState().customers.some((c) => c.id === firstCust.id)).toBe(false);
      expect(store.getState().selectedCustomerId).toBe(secondCust.id);

      // Non-existent customer removal does nothing
      await store.getState().removeCustomer('non-existent-id');
    });
  });

  describe('Checkout, Orders & PCI-DSS Hygiene', () => {
    beforeEach(async () => {
      await store.getState().initialize();
    });

    it('prevents checkout when cart is empty', async () => {
      const result = await store.getState().placeOrder({
        method: 'card',
        cardNumber: '4532015112830366',
        expiry: '12/28',
        cvv: '123',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('pusty');
      expect(store.getState().statusTone).toBe('warning');
    });

    it('prevents checkout when no customer is selected', async () => {
      store.getState().addToCart('prod-laptop', 1);
      store.getState().selectCustomer(null);

      const result = await store.getState().placeOrder({
        method: 'card',
        cardNumber: '4532015112830366',
        expiry: '12/28',
        cvv: '123',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('klienta');
      // Cart must remain intact!
      expect(store.getState().cart).toHaveLength(1);
    });

    it('rejects invalid card payment (Luhn failure, expired, invalid CVV) WITHOUT clearing cart', async () => {
      store.getState().addToCart('prod-sluchawki', 1);
      const initialCartCount = store.getState().cart.length;

      // 1. Invalid Luhn Checksum
      const luhnFail = await store.getState().placeOrder({
        method: 'card',
        cardNumber: '4532015112830367', // Last digit invalid for Luhn
        expiry: '12/28',
        cvv: '123',
      });
      expect(luhnFail.success).toBe(false);
      expect(luhnFail.error).toContain('Luhna');
      expect(store.getState().cart).toHaveLength(initialCartCount);

      // 2. Expired card
      const expiredFail = await store.getState().placeOrder({
        method: 'card',
        cardNumber: '4532015112830366',
        expiry: '01/20',
        cvv: '123',
      });
      expect(expiredFail.success).toBe(false);
      expect(expiredFail.error).toContain('ważność');
      expect(store.getState().cart).toHaveLength(initialCartCount);

      // 3. Invalid CVV format
      const cvvFail = await store.getState().placeOrder({
        method: 'card',
        cardNumber: '4532015112830366',
        expiry: '12/28',
        cvv: '1', // Too short
      });
      expect(cvvFail.success).toBe(false);
      expect(cvvFail.error).toContain('CVV');
      expect(store.getState().cart).toHaveLength(initialCartCount);
    });

    it('completes Card order: validates amounts, clears cart, and STRICTLY STRIPS CVV from state and storage', async () => {
      // Add items: Laptop (3499.99 PLN = 349999 Cents, free delivery)
      store.getState().addToCart('prod-laptop', 1);

      const orderResult = await store.getState().placeOrder({
        method: 'card',
        cardNumber: '4532015112830366',
        expiry: '12/28',
        cvv: '789',
      });

      expect(orderResult.success).toBe(true);
      expect(orderResult.orderId).toBeDefined();

      // Cart is cleared after successful order
      expect(store.getState().cart).toHaveLength(0);

      // Order is added to orders
      const order = store.getState().orders[0]!;
      expect(order.id).toBe(orderResult.orderId);
      expect(order.subtotalCents).toBe(349999);
      expect(order.deliveryCents).toBe(0);
      expect(order.totalCents).toBe(349999);
      expect(order.paymentMethod).toBe('Karta kredytowa');

      // CRITICAL PCI-DSS HYGIENE:
      expect(order.paymentDetails.method).toBe('card');
      if (order.paymentDetails.method === 'card') {
        expect(order.paymentDetails.maskedCard).toBe('**** **** **** 0366');
        expect(order.paymentDetails.last4).toBe('0366');
        expect(order.paymentDetails.expiry).toBe('12/28');
        expect((order.paymentDetails as Record<string, unknown>).cvv).toBeUndefined();
        expect((order.paymentDetails as Record<string, unknown>).cardNumber).toBeUndefined();
      }

      // Verify that persisted state in StorageAdapter ALSO has ZERO CVV and masked card
      const persisted = await adapter.loadState();
      expect(persisted).not.toBeNull();
      const persistedOrder = persisted!.orders[0]!;
      if (persistedOrder.paymentDetails.method === 'card') {
        expect(persistedOrder.paymentDetails.maskedCard).toBe('**** **** **** 0366');
        expect((persistedOrder.paymentDetails as Record<string, unknown>).cvv).toBeUndefined();
        expect(
          (persistedOrder.paymentDetails as Record<string, unknown>).cardNumber
        ).toBeUndefined();
      }
    });

    it('completes PayPal and Bitcoin orders successfully', async () => {
      // PayPal order
      store.getState().addToCart('prod-ksiazka-python', 1);
      const paypalRes = await store.getState().placeOrder({
        method: 'paypal',
        email: 'jan.kowalski@example.com',
      });
      expect(paypalRes.success).toBe(true);
      const paypalOrder = store.getState().orders[0]!;
      expect(paypalOrder.paymentDetails.method).toBe('paypal');

      // Bitcoin order
      store.getState().addToCart('prod-crt-monitor', 1);
      const btcRes = await store.getState().placeOrder({
        method: 'bitcoin',
        walletAddress: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
      });
      expect(btcRes.success).toBe(true);
      const btcOrder = store.getState().orders[0]!;
      expect(btcOrder.paymentDetails.method).toBe('bitcoin');
      if (btcOrder.paymentDetails.method === 'bitcoin') {
        expect(btcOrder.paymentDetails.walletAddress).toBe('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa');
        expect(Number(btcOrder.paymentDetails.btcAmount)).toBeGreaterThan(0);
      }
    });

    it('removing customer preserves order history snapshot without breaking references', async () => {
      // Register custom customer
      store.getState().addCustomer({
        name: 'Stanisław Lem',
        email: 'stanislaw@solaris.pl',
      });
      const lem = store.getState().customers.find((c) => c.name === 'Stanisław Lem')!;
      store.getState().selectCustomer(lem.id);

      store.getState().addToCart('prod-ksiazka-python', 1);
      const res = await store.getState().placeOrder({
        method: 'paypal',
        email: 'stanislaw@solaris.pl',
      });
      expect(res.success).toBe(true);

      const placedOrderId = res.orderId!;

      // Log in as admin to remove customer
      await store.getState().loginAdmin('admin123');

      // Remove customer Lem from active customers
      await store.getState().removeCustomer(lem.id);
      expect(store.getState().customers.some((c) => c.id === lem.id)).toBe(false);

      // Verify the order still contains Lem's snapshot data!
      const order = store.getState().orders.find((o) => o.id === placedOrderId)!;
      expect(order).toBeDefined();
      expect(order.customer.name).toBe('Stanisław Lem');
      expect(order.customer.email).toBe('stanislaw@solaris.pl');

      // Verify ASCII export report still prints Lem's details
      const report = store.getState().exportHistoryTxt();
      expect(report.content).toContain('Stanisław Lem');
      expect(report.content).toContain('stanislaw@solaris.pl');
    });

    it('removes an order by ID', () => {
      const initialOrders = store.getState().orders;
      const orderIdToRemove = initialOrders[0]!.id;

      store.getState().removeOrder(orderIdToRemove);
      expect(store.getState().orders.some((o) => o.id === orderIdToRemove)).toBe(false);
      expect(store.getState().statusTone).toBe('info');
    });
  });

  describe('Data Tools: JSON Export, Legacy Import & Demo Reset', () => {
    beforeEach(async () => {
      await store.getState().initialize();
    });

    it('exports backup JSON strictly without any plain card numbers or CVV fields', () => {
      const jsonStr = store.getState().exportBackupJson();
      expect(jsonStr).toContain('"version": 3');
      expect(jsonStr).not.toContain('"cvv"');
      expect(jsonStr).not.toContain('"card_number"');

      const parsed = JSON.parse(jsonStr) as Record<string, unknown>;
      expect(parsed.version).toBe(3);
      expect(Array.isArray(parsed.customers)).toBe(true);
      expect(Array.isArray(parsed.orders)).toBe(true);
      expect(Array.isArray(parsed.categories)).toBe(true);
      expect(Array.isArray(parsed.catalog)).toBe(true);
    });

    it('imports legacy Tkinter data.json, migrates float prices to Cents and PURGES ALL CVVs', async () => {
      const legacyBackup = JSON.stringify({
        customers: [{ name: 'Adam Mickiewicz', email: 'adam@pan-tadeusz.pl' }],
        orders: [
          {
            timestamp: '2026-01-10 14:20:00',
            customer: { name: 'Adam Mickiewicz', email: 'adam@pan-tadeusz.pl' },
            items: [
              {
                name: 'Laptop',
                price: 3499.99, // float
                qty: 1,
                category: 'Elektronika',
              },
            ],
            subtotal: 3499.99,
            delivery: 0.0,
            total: 3499.99,
            payment_method: 'Karta kredytowa',
            payment_details: {
              method: 'Karta kredytowa',
              card_number: '4532015112830366',
              expiry: '12/28',
              cvv: '789', // CRITICAL DANGEROUS LEGACY DATA
            },
          },
        ],
      });

      const importResult = await store.getState().importBackupJson(legacyBackup);
      expect(importResult.success).toBe(true);

      const state = store.getState();
      expect(state.customers).toHaveLength(1);
      expect(state.customers[0]?.name).toBe('Adam Mickiewicz');
      expect(state.orders).toHaveLength(1);

      const importedOrder = state.orders[0]!;
      expect(importedOrder.subtotalCents).toBe(349999); // Converted to grosze
      expect(importedOrder.totalCents).toBe(349999);

      // Verify CVV is purged!
      expect(importedOrder.paymentDetails.method).toBe('card');
      if (importedOrder.paymentDetails.method === 'card') {
        expect(importedOrder.paymentDetails.maskedCard).toBe('**** **** **** 0366');
        expect(importedOrder.paymentDetails.last4).toBe('0366');
        expect((importedOrder.paymentDetails as Record<string, unknown>).cvv).toBeUndefined();
      }

      // Verify persistence in storage adapter
      const inStorage = await adapter.loadState();
      expect(inStorage?.orders[0]?.subtotalCents).toBe(349999);
      expect((inStorage?.orders[0]?.paymentDetails as Record<string, unknown>).cvv).toBeUndefined();
    });

    it('rejects corrupt JSON on import and preserves existing state', async () => {
      const originalCount = store.getState().orders.length;

      const badResult = await store.getState().importBackupJson('{ corrupt json');
      expect(badResult.success).toBe(false);
      expect(store.getState().orders).toHaveLength(originalCount);
      expect(store.getState().statusTone).toBe('error');
    });

    it('sets and clears status message', () => {
      store.getState().setStatus('Terminal online', 'success');
      expect(store.getState().statusMessage).toBe('Terminal online');
      expect(store.getState().statusTone).toBe('success');

      store.getState().clearStatus();
      expect(store.getState().statusMessage).toBeNull();
      expect(store.getState().statusTone).toBe('info');
    });

    it('manually persists current state via persistCurrentState', async () => {
      await store.getState().persistCurrentState();
      const saved = await adapter.loadState();
      expect(saved).not.toBeNull();
    });

    it('toggles CRT FX setting and persists change', () => {
      expect(store.getState().settings.crtFx).toBe(true);

      store.getState().toggleCrtFx();
      expect(store.getState().settings.crtFx).toBe(false);

      store.getState().toggleCrtFx();
      expect(store.getState().settings.crtFx).toBe(true);
    });

    it('resets demo data to initial pristine seed state', async () => {
      // Mutate state
      store.getState().addCustomer({ name: 'Tymczasowy', email: 'temp@test.pl' });
      store.getState().clearCart();
      store.getState().removeOrder(store.getState().orders[0]!.id);

      // Trigger reset
      await store.getState().resetDemoData();

      const state = store.getState();
      expect(state.customers).toHaveLength(2);
      expect(state.customers[0]?.name).toBe('Jan Kowalski');
      expect(state.orders).toHaveLength(2);
      expect(state.cart).toEqual([]);
      expect(state.statusTone).toBe('info');
    });
  });

  describe('Admin Authentication, Session & View Switching', () => {
    beforeEach(async () => {
      await store.getState().initialize();
    });

    it('successfully logs in with valid password (admin123 or admin-retro-2026)', async () => {
      expect(store.getState().isAdminAuthenticated).toBe(false);
      expect(store.getState().activeView).toBe('shop');

      const result = await store.getState().loginAdmin('admin123');
      expect(result.success).toBe(true);

      const state = store.getState();
      expect(state.isAdminAuthenticated).toBe(true);
      expect(state.activeView).toBe('admin');
      expect(state.statusTone).toBe('success');
      expect(state.statusMessage).toContain('ADMINISTRATOR');
    });

    it('rejects login with invalid password and maintains shop view', async () => {
      const result = await store.getState().loginAdmin('wrong-password-999');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Nieprawidłowe hasło');

      const state = store.getState();
      expect(state.isAdminAuthenticated).toBe(false);
      expect(state.activeView).toBe('shop');
      expect(state.statusTone).toBe('error');
    });

    it('terminates admin session on logoutAdmin and switches back to shop view', async () => {
      await store.getState().loginAdmin('admin123');
      expect(store.getState().isAdminAuthenticated).toBe(true);
      expect(store.getState().activeView).toBe('admin');

      await store.getState().logoutAdmin();

      const state = store.getState();
      expect(state.isAdminAuthenticated).toBe(false);
      expect(state.activeView).toBe('shop');
      expect(state.statusTone).toBe('info');
      expect(state.statusMessage).toContain('SESJA ADMINISTRATORA ZAKOŃCZONA');
    });

    it('blocks switching activeView to admin when not authenticated', () => {
      expect(store.getState().isAdminAuthenticated).toBe(false);

      store.getState().setActiveView('admin');

      expect(store.getState().activeView).toBe('shop');
      expect(store.getState().statusTone).toBe('warning');
      expect(store.getState().statusMessage).toContain('WYMAGANA AUTORYZACJA');
    });

    it('allows switching activeView between shop and admin when authenticated', async () => {
      await store.getState().loginAdmin('admin123');
      expect(store.getState().activeView).toBe('admin');

      store.getState().setActiveView('shop');
      expect(store.getState().activeView).toBe('shop');

      store.getState().setActiveView('admin');
      expect(store.getState().activeView).toBe('admin');
    });
  });

  describe('Security: Customer Actions & Permission Gate', () => {
    beforeEach(async () => {
      await store.getState().initialize();
    });

    it('blocks removeCustomer when admin is NOT authenticated with BRAK UPRAWNIEŃ ADMINISTRATORA', async () => {
      const initialCustomers = store.getState().customers;
      const targetCustomer = initialCustomers[0]!;

      expect(store.getState().isAdminAuthenticated).toBe(false);

      await store.getState().removeCustomer(targetCustomer.id);

      // Customer must NOT be removed!
      expect(store.getState().customers).toHaveLength(initialCustomers.length);
      expect(store.getState().customers.some((c) => c.id === targetCustomer.id)).toBe(true);
      expect(store.getState().statusTone).toBe('error');
      expect(store.getState().statusMessage).toBe('BRAK UPRAWNIEŃ ADMINISTRATORA');
    });

    it('successfully removes customer when admin IS authenticated', async () => {
      const initialCustomers = store.getState().customers;
      const targetCustomer = initialCustomers[0]!;

      await store.getState().loginAdmin('admin123');
      await store.getState().removeCustomer(targetCustomer.id);

      expect(store.getState().customers).toHaveLength(initialCustomers.length - 1);
      expect(store.getState().customers.some((c) => c.id === targetCustomer.id)).toBe(false);
      expect(store.getState().statusTone).toBe('info');
    });
  });

  describe('Strict Customer Registration, Honeypot & Email Privacy', () => {
    beforeEach(async () => {
      await store.getState().initialize();
    });

    it('successfully registers customer with valid data and unlocks their email in session', () => {
      const success = store.getState().addCustomer({
        name: 'Eliza Orzeszkowa',
        email: 'eliza@nad-niemnem.pl',
      });

      expect(success).toBe(true);

      const customers = store.getState().customers;
      const eliza = customers.find((c) => c.email === 'eliza@nad-niemnem.pl')!;
      expect(eliza).toBeDefined();
      expect(store.getState().selectedCustomerId).toBe(eliza.id);

      // Session unlocked customer emails map contains full email
      expect(store.getState().unlockedCustomerEmails[eliza.id]).toBe('eliza@nad-niemnem.pl');

      // getSelectedCustomer returns the customer with their unmasked email
      const activeCustomer = store.getState().getSelectedCustomer();
      expect(activeCustomer?.email).toBe('eliza@nad-niemnem.pl');
    });

    it('blocks duplicate email registration case-insensitively', () => {
      // 'Jan Kowalski' with 'jan.kowalski@example.com' already exists from seed
      const duplicateResult = store.getState().addCustomer({
        name: 'Jan Klon',
        email: 'JAN.KOWALSKI@EXAMPLE.COM',
      });

      expect(duplicateResult).toBe(false);
      expect(store.getState().statusTone).toBe('error');
      expect(store.getState().statusMessage).toContain('już zarejestrowany');
    });

    it('blocks registration when anti-bot honeypot field is filled', () => {
      const botResult = store.getState().addCustomer({
        name: 'Automated Spammer',
        email: 'bot@spamnetwork.com',
        honeypot: 'http://malicious-spam-link.ru',
      });

      expect(botResult).toBe(false);
      expect(store.getState().statusTone).toBe('error');
      expect(store.getState().statusMessage).toContain('honeypot');
    });

    it('blocks registration with invalid name containing numbers or HTML tags', () => {
      const htmlResult = store.getState().addCustomer({
        name: '<script>alert("xss")</script>',
        email: 'xss@hacker.io',
      });
      expect(htmlResult).toBe(false);
      expect(store.getState().statusTone).toBe('error');

      const digitsResult = store.getState().addCustomer({
        name: 'Robot 12345',
        email: 'robot123@example.com',
      });
      expect(digitsResult).toBe(false);
      expect(store.getState().statusTone).toBe('error');
    });
  });

  describe('Category CRUD, Name Sync & Automatic Fallback Deletion', () => {
    beforeEach(async () => {
      await store.getState().initialize();
    });

    it('adds a new category and persists to storage', async () => {
      const initialCount = store.getState().categories.length;

      await store.getState().addCategory({
        name: 'Komputery 8-bit',
        description: 'Atari, Commodore, ZX Spectrum',
      });

      const categories = store.getState().categories;
      expect(categories).toHaveLength(initialCount + 1);

      const added = categories.find((c) => c.name === 'Komputery 8-bit')!;
      expect(added).toBeDefined();
      expect(added.description).toBe('Atari, Commodore, ZX Spectrum');
      expect(store.getState().statusTone).toBe('success');

      // Verify persistence in adapter
      const inStorage = await adapter.loadState();
      expect(inStorage?.categories?.some((c) => c.name === 'Komputery 8-bit')).toBe(true);
    });

    it('rejects adding a category with duplicate name', async () => {
      await expect(
        store.getState().addCategory({
          name: 'Elektronika', // already exists in default categories
        })
      ).rejects.toThrow(/już istnieje/);

      expect(store.getState().statusTone).toBe('error');
    });

    it('updates category name and synchronizes product category field and selectedCategory', async () => {
      // Find 'Odziez' category and a product in it ('Koszulka')
      const odziezCat = store.getState().categories.find((c) => c.name === 'Odziez')!;
      expect(odziezCat).toBeDefined();

      // Set current filter to 'Odziez'
      store.getState().setSelectedCategory('Odziez');
      expect(store.getState().selectedCategory).toBe('Odziez');

      // Rename category to 'Odzież Vintage'
      await store.getState().updateCategory(odziezCat.id, {
        name: 'Odzież Vintage',
      });

      const updatedCategories = store.getState().categories;
      const updatedCat = updatedCategories.find((c) => c.id === odziezCat.id)!;
      expect(updatedCat.name).toBe('Odzież Vintage');

      // Product assigned to this category must have synchronized category name
      const koszulka = store.getState().catalog.find((p) => p.sku === 'CL-TSHIRT-03')!;
      expect(koszulka.category).toBe('Odzież Vintage');

      // selectedCategory filter must update to the new category name
      expect(store.getState().selectedCategory).toBe('Odzież Vintage');
      expect(store.getState().statusTone).toBe('success');
    });

    it('blocks deleting default category (cat-default)', async () => {
      await expect(
        store.getState().removeCategory(DEFAULT_CATEGORY_ID)
      ).rejects.toThrow(/Nie można usunąć domyślnej kategorii/);

      expect(store.getState().statusTone).toBe('error');
      expect(store.getState().categories.some((c) => c.id === DEFAULT_CATEGORY_ID)).toBe(true);
    });

    it('deletes category and automatically moves products to default category Ogólne', async () => {
      const edukacjaCat = store.getState().categories.find((c) => c.name === 'Edukacja')!;
      expect(edukacjaCat).toBeDefined();

      // Product 'prod-ksiazka-python' is currently in 'Edukacja'
      const pythonBookBefore = store.getState().catalog.find((p) => p.id === 'prod-ksiazka-python')!;
      expect(pythonBookBefore.categoryId).toBe(edukacjaCat.id);

      // Set filter to 'Edukacja'
      store.getState().setSelectedCategory('Edukacja');

      // Delete 'Edukacja' category
      await store.getState().removeCategory(edukacjaCat.id);

      // 'Edukacja' must be removed from categories
      expect(store.getState().categories.some((c) => c.id === edukacjaCat.id)).toBe(false);

      // Python book must be moved to default category 'cat-default' ('Ogólne')
      const pythonBookAfter = store.getState().catalog.find((p) => p.id === 'prod-ksiazka-python')!;
      expect(pythonBookAfter.categoryId).toBe(DEFAULT_CATEGORY_ID);
      expect(pythonBookAfter.category).toBe('Ogólne');

      // Filter must reset to 'ALL' because current selectedCategory was removed
      expect(store.getState().selectedCategory).toBe('ALL');
      expect(store.getState().statusTone).toBe('info');
    });
  });

  describe('Category Migration Tool (Object & Positional API)', () => {
    beforeEach(async () => {
      await store.getState().initialize();
    });

    it('migrates all products between categories using object argument', async () => {
      // Migrate all products from 'cat-akcesoria' to 'cat-retro-hardware'
      const accessoriesBefore = store
        .getState()
        .catalog.filter((p) => p.categoryId === 'cat-akcesoria');
      expect(accessoriesBefore.length).toBeGreaterThan(0);

      await store.getState().migrateCategoryProducts({
        sourceCategoryId: 'cat-akcesoria',
        targetCategoryId: 'cat-retro-hardware',
      });

      // No products left in accessories
      const accessoriesAfter = store
        .getState()
        .catalog.filter((p) => p.categoryId === 'cat-akcesoria');
      expect(accessoriesAfter).toHaveLength(0);

      // Plecak and Dyskietki now in Retro Hardware
      const plecak = store.getState().catalog.find((p) => p.sku === 'AC-BACKPACK-04')!;
      expect(plecak.categoryId).toBe('cat-retro-hardware');
      expect(plecak.category).toBe('Retro Hardware');
      expect(store.getState().statusTone).toBe('success');
    });

    it('migrates selected products by productIds using positional arguments', async () => {
      // Move only 'prod-plecak' from 'cat-akcesoria' to 'cat-odziez'
      await store
        .getState()
        .migrateCategoryProducts('cat-akcesoria', 'cat-odziez', ['prod-plecak']);

      const plecak = store.getState().catalog.find((p) => p.id === 'prod-plecak')!;
      expect(plecak.categoryId).toBe('cat-odziez');
      expect(plecak.category).toBe('Odziez');

      // Dyskietki should remain in 'cat-akcesoria'
      const floppy = store.getState().catalog.find((p) => p.id === 'prod-dyskietki')!;
      expect(floppy.categoryId).toBe('cat-akcesoria');
    });
  });

  describe('Product CRUD & Automatic Cart Synchronization', () => {
    beforeEach(async () => {
      await store.getState().initialize();
    });

    it('adds a new product to catalog and sets category defaults', async () => {
      const initialCatalogCount = store.getState().catalog.length;

      await store.getState().addProductToCatalog({
        sku: 'RH-AMIGA-500',
        name: 'Komputer Amiga 500',
        priceCents: toCents(180000),
        categoryId: 'cat-retro-hardware',
        description: 'Komputer 16-bitowy z procesorem Motorola 68000 i układami OCS.',
        stockQuantity: 3,
      });

      const updatedCatalog = store.getState().catalog;
      expect(updatedCatalog).toHaveLength(initialCatalogCount + 1);

      const amiga = updatedCatalog.find((p) => p.sku === 'RH-AMIGA-500')!;
      expect(amiga).toBeDefined();
      expect(amiga.priceCents).toBe(180000);
      expect(amiga.category).toBe('Retro Hardware');
      expect(amiga.inStock).toBe(true);
      expect(store.getState().statusTone).toBe('success');
    });

    it('updates product price and automatically recalculates cart item totalCents', async () => {
      // Add 'prod-laptop' (original price 3499.99 PLN) to cart
      store.getState().addToCart('prod-laptop', 2);
      expect(store.getState().getCartTotals().subtotalCents).toBe(699998);

      // Admin discounts laptop to 3000.00 PLN (300000 groszy)
      await store.getState().updateProductInCatalog('prod-laptop', {
        priceCents: toCents(300000),
      });

      // Cart item must automatically synchronize with new price!
      const cartItem = store.getState().cart.find((i) => i.product.id === 'prod-laptop')!;
      expect(cartItem.product.priceCents).toBe(300000);
      expect(cartItem.lineTotalCents).toBe(600000); // 2 * 3000.00
      expect(store.getState().getCartTotals().subtotalCents).toBe(600000);
    });

    it('automatically drops product from cart when stockQuantity drops to 0 or inStock becomes false', async () => {
      // Put headphones in cart
      store.getState().addToCart('prod-sluchawki', 1);
      expect(store.getState().cart).toHaveLength(1);

      // Set stockQuantity to 0
      await store.getState().updateProductInCatalog('prod-sluchawki', {
        stockQuantity: 0,
      });

      // Cart sync must remove out-of-stock product
      expect(store.getState().cart).toHaveLength(0);
      expect(store.getState().getCartTotals().itemCount).toBe(0);
    });

    it('automatically drops product from cart when removed from catalog', async () => {
      store.getState().addToCart('prod-koszulka', 2);
      expect(store.getState().cart).toHaveLength(1);

      // Delete product from catalog
      await store.getState().removeProductFromCatalog('prod-koszulka');

      expect(store.getState().catalog.some((p) => p.id === 'prod-koszulka')).toBe(false);
      expect(store.getState().cart).toHaveLength(0);
      expect(store.getState().statusTone).toBe('info');
    });
  });

  describe('API Client Synchronization & Network Failure Fallback', () => {
    it('seamlessly falls back to local in-memory storage when API network fails', async () => {
      const mockClient = new ShopApiClient('http://non-existent-server-url-12345.local');
      // Create store with syncWithApi explicitly enabled to test error handling
      const networkStore = createShopStore(adapter, {
        syncWithApi: true,
        apiClient: mockClient,
      });

      // Initialize with failing network should fall back to seed data without throwing!
      await networkStore.getState().initialize();
      expect(networkStore.getState().isInitialized).toBe(true);
      expect(networkStore.getState().customers).toHaveLength(2);

      // Login admin with fallback check
      const loginRes = await networkStore.getState().loginAdmin('admin123');
      expect(loginRes.success).toBe(true);
      expect(networkStore.getState().isAdminAuthenticated).toBe(true);

      // Adding customer works locally without throwing network errors
      const addRes = networkStore.getState().addCustomer({
        name: 'Henryk Sienkiewicz',
        email: 'henryk@trylogia.pl',
      });
      expect(addRes).toBe(true);
      expect(networkStore.getState().customers.some((c) => c.name === 'Henryk Sienkiewicz')).toBe(true);
    });
  });
});
