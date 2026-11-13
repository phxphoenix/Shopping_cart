/**
 * Store module: Zustand Shop Store
 *
 * Central state management for Retro Shopping Cart v2.0.
 * Injects StorageAdapter for flexible persistence (IndexedDB, fallback, in-memory).
 *
 * Guarantees:
 * - 100% Cents integer arithmetic for money (via src/domain/cart and src/domain/money).
 * - PCI-DSS hygiene: CVV is NEVER stored, logged or retained in state or storage.
 * - Order snapshots preserve customer details even if a customer is deleted.
 */

import {
  addItem,
  calculateTotals,
  clearCart,
  removeItem,
  updateQuantity,
  type CartItem,
  type CartTotals,
} from '@/domain/cart';
import {
  DEFAULT_CATALOG,
  findProductById,
  searchProducts,
  type Product,
  type ProductCategory,
} from '@/domain/catalog';
import {
  generateOrderHistoryFilename,
  generateOrderHistoryTxt,
  type ExportTxtOptions,
} from '@/domain/exportTxt';
import { formatPLN } from '@/domain/money';
import { validatePaymentSafe, type PaymentInput } from '@/domain/payment';
import {
  CustomerSchema,
  generateDomainId,
  parseLegacyOrCurrentBackup,
  type Customer,
  type Order,
  type OrderItem,
  type PersistedShopState,
  type ShopSettings,
} from '@/domain/schemas';
import { createSeedState, IndexedDbStorageAdapter, type StorageAdapter } from '@/storage';
import { create, type StoreApi, type UseBoundStore } from 'zustand';

export type StatusTone = 'info' | 'success' | 'warning' | 'error';

export interface ShopState {
  // Initialization & Loading
  isInitialized: boolean;
  isLoading: boolean;

  // Catalog
  catalog: readonly Product[];
  searchQuery: string;
  selectedCategory: ProductCategory | 'ALL';

  // Cart
  cart: readonly CartItem[];

  // Customers
  customers: readonly Customer[];
  selectedCustomerId: string | null;

  // Orders
  orders: readonly Order[];

  // Settings
  settings: ShopSettings;

  // Status message for terminal StatusBar
  statusMessage: string | null;
  statusTone: StatusTone;

  // Computed getters / Selectors
  getFilteredProducts: () => readonly Product[];
  getCartTotals: () => CartTotals;
  getSelectedCustomer: () => Customer | undefined;

  // Actions: Init & Persistence
  initialize: () => Promise<void>;
  persistCurrentState: () => Promise<void>;

  // Actions: Catalog
  setSearchQuery: (query: string) => void;
  setSelectedCategory: (category: ProductCategory | 'ALL') => void;
  addProductToCatalog: (product: Product) => void;

  // Actions: Cart
  addToCart: (productId: string, quantity?: number) => void;
  setCartQuantity: (productId: string, quantity: number) => void;
  incrementCartItem: (productId: string) => void;
  decrementCartItem: (productId: string) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;

  // Actions: Customers
  addCustomer: (input: { name: string; email: string }) => boolean;
  selectCustomer: (customerId: string | null) => void;
  removeCustomer: (customerId: string) => void;

  // Actions: Orders & Checkout
  placeOrder: (
    paymentInput: PaymentInput
  ) => Promise<{ success: boolean; orderId?: string; error?: string }>;
  removeOrder: (orderId: string) => void;
  setStatus: (message: string, tone?: StatusTone) => void;
  clearStatus: () => void;

  // Actions: Settings & Utilities
  toggleCrtFx: () => void;
  exportHistoryTxt: (options?: ExportTxtOptions) => { filename: string; content: string };
  exportBackupJson: () => string;
  importBackupJson: (rawText: string) => Promise<{ success: boolean; message: string }>;
  resetDemoData: () => Promise<void>;
}

export type ShopStore = UseBoundStore<StoreApi<ShopState>>;

/**
 * Creates an isolated shop store with the specified storage adapter.
 * Defaults to IndexedDbStorageAdapter with localStorage fallback.
 */
export function createShopStore(
  adapter: StorageAdapter = new IndexedDbStorageAdapter()
): ShopStore {
  return create<ShopState>()((set, get) => {
    const persist = async (): Promise<void> => {
      const state = get();
      if (!state.isInitialized) {
        return;
      }
      const payload: PersistedShopState = {
        version: 2,
        exportedAt: new Date().toISOString(),
        customers: [...state.customers],
        orders: [...state.orders],
        cart: [...state.cart],
        selectedCustomerId: state.selectedCustomerId,
        settings: { ...state.settings },
      };
      try {
        await adapter.saveState(payload);
      } catch (err) {
        console.error('Failed to persist shop state:', err);
      }
    };

    return {
      // Initial default state
      isInitialized: false,
      isLoading: false,

      catalog: DEFAULT_CATALOG,
      searchQuery: '',
      selectedCategory: 'ALL',

      cart: [],

      customers: [],
      selectedCustomerId: null,

      orders: [],

      settings: {
        crtFx: true,
      },

      statusMessage: null,
      statusTone: 'info',

      // Selectors
      getFilteredProducts: () => {
        const { catalog, searchQuery, selectedCategory } = get();
        return searchProducts(catalog, searchQuery, selectedCategory);
      },

      getCartTotals: () => {
        return calculateTotals(get().cart);
      },

      getSelectedCustomer: () => {
        const { customers, selectedCustomerId } = get();
        return customers.find((c) => c.id === selectedCustomerId);
      },

      // Actions: Init
      initialize: async () => {
        if (get().isInitialized) {
          return;
        }
        set({ isLoading: true });

        try {
          const saved = await adapter.loadState();
          if (!saved) {
            // Storage empty or invalid -> seed initial demo data
            const seed = createSeedState();
            await adapter.saveState(seed);
            set({
              isInitialized: true,
              isLoading: false,
              customers: seed.customers,
              orders: seed.orders,
              cart: seed.cart ?? [],
              selectedCustomerId: seed.selectedCustomerId,
              settings: seed.settings,
              statusMessage: 'SYSTEM ZAINICJALIZOWANY [DANE STARTOWE]',
              statusTone: 'info',
            });
          } else {
            set({
              isInitialized: true,
              isLoading: false,
              customers: saved.customers,
              orders: saved.orders,
              cart: saved.cart ?? [],
              selectedCustomerId: saved.selectedCustomerId ?? saved.customers[0]?.id ?? null,
              settings: saved.settings ?? { crtFx: true },
              statusMessage: 'STAN WCZYTANY Z PAMIĘCI',
              statusTone: 'info',
            });
          }
        } catch (err) {
          console.error('Initialization error:', err);
          const seed = createSeedState();
          set({
            isInitialized: true,
            isLoading: false,
            customers: seed.customers,
            orders: seed.orders,
            cart: [],
            selectedCustomerId: seed.selectedCustomerId,
            settings: seed.settings,
            statusMessage: 'BŁĄD WCZYTYWANIA: ZAŁADOWANO DANE AWARYJNE',
            statusTone: 'warning',
          });
        }
      },

      persistCurrentState: async () => {
        await persist();
      },

      // Actions: Catalog
      setSearchQuery: (query: string) => {
        set({ searchQuery: query });
      },

      setSelectedCategory: (category: ProductCategory | 'ALL') => {
        set({ selectedCategory: category });
      },

      addProductToCatalog: (product: Product) => {
        set((state) => ({
          catalog: [...state.catalog, product],
          statusMessage: `DODANO PRODUKT DO KATALOGU: ${product.name}`,
          statusTone: 'success',
        }));
      },

      // Actions: Cart
      addToCart: (productId: string, quantity = 1) => {
        const { catalog, cart } = get();
        const product = findProductById(catalog, productId);
        if (!product) {
          set({
            statusMessage: `BŁĄD: Nie znaleziono produktu [${productId}]`,
            statusTone: 'error',
          });
          return;
        }

        try {
          const updatedCart = addItem(cart, product, quantity);
          set({
            cart: updatedCart,
            statusMessage: `DODANO DO KOSZYKA: ${product.name} (x${quantity})`,
            statusTone: 'success',
          });
          void persist();
        } catch (err) {
          set({
            statusMessage: `BŁĄD: ${err instanceof Error ? err.message : String(err)}`,
            statusTone: 'error',
          });
        }
      },

      setCartQuantity: (productId: string, quantity: number) => {
        const { cart } = get();
        try {
          const updatedCart = updateQuantity(cart, productId, quantity);
          set({ cart: updatedCart });
          void persist();
        } catch (err) {
          set({
            statusMessage: `BŁĄD: ${err instanceof Error ? err.message : String(err)}`,
            statusTone: 'error',
          });
        }
      },

      incrementCartItem: (productId: string) => {
        const { cart } = get();
        const existing = cart.find((i) => i.product.id === productId);
        if (!existing) {
          return;
        }
        const updatedCart = updateQuantity(cart, productId, existing.quantity + 1);
        set({ cart: updatedCart });
        void persist();
      },

      decrementCartItem: (productId: string) => {
        const { cart } = get();
        const existing = cart.find((i) => i.product.id === productId);
        if (!existing) {
          return;
        }
        const updatedCart = updateQuantity(cart, productId, existing.quantity - 1);
        set({ cart: updatedCart });
        void persist();
      },

      removeFromCart: (productId: string) => {
        const { cart } = get();
        const item = cart.find((i) => i.product.id === productId);
        const updatedCart = removeItem(cart, productId);
        set({
          cart: updatedCart,
          statusMessage: item ? `USUNIĘTO Z KOSZYKA: ${item.product.name}` : null,
          statusTone: 'info',
        });
        void persist();
      },

      clearCart: () => {
        set({
          cart: clearCart(),
          statusMessage: 'KOSZYK ZOSTAŁ WYCZYSZCZONY',
          statusTone: 'info',
        });
        void persist();
      },

      // Actions: Customers
      addCustomer: (input: { name: string; email: string }) => {
        const name = input.name.trim();
        const email = input.email.trim();
        const id = generateDomainId('cust');

        const validation = CustomerSchema.safeParse({ id, name, email });
        if (!validation.success) {
          const errorMsg = validation.error.errors.map((e) => e.message).join(', ');
          set({
            statusMessage: `BŁĄD DANYCH KLIENTA: ${errorMsg}`,
            statusTone: 'error',
          });
          return false;
        }

        const { customers, selectedCustomerId } = get();
        const newCustomer = validation.data;
        const updatedCustomers = [...customers, newCustomer];

        set({
          customers: updatedCustomers,
          selectedCustomerId: selectedCustomerId ?? newCustomer.id,
          statusMessage: `DODANO KLIENTA: ${newCustomer.name} <${newCustomer.email}>`,
          statusTone: 'success',
        });

        void persist();
        return true;
      },

      selectCustomer: (customerId: string | null) => {
        set({ selectedCustomerId: customerId });
        void persist();
      },

      removeCustomer: (customerId: string) => {
        const { customers, selectedCustomerId } = get();
        const customerToRemove = customers.find((c) => c.id === customerId);
        if (!customerToRemove) {
          return;
        }

        const remainingCustomers = customers.filter((c) => c.id !== customerId);
        let nextSelectedId = selectedCustomerId;

        if (selectedCustomerId === customerId) {
          nextSelectedId = remainingCustomers[0]?.id ?? null;
        }

        set({
          customers: remainingCustomers,
          selectedCustomerId: nextSelectedId,
          statusMessage: `USUNIĘTO KLIENTA: ${customerToRemove.name}`,
          statusTone: 'info',
        });

        void persist();
      },

      // Actions: Checkout & Orders
      placeOrder: async (paymentInput: PaymentInput) => {
        const { cart, selectedCustomerId, customers, orders } = get();

        if (cart.length === 0) {
          set({
            statusMessage: 'BŁĄD ZAMÓWIENIA: Koszyk jest pusty',
            statusTone: 'warning',
          });
          return { success: false, error: 'Koszyk jest pusty' };
        }

        const customer = customers.find((c) => c.id === selectedCustomerId);
        if (!customer) {
          set({
            statusMessage: 'BŁĄD ZAMÓWIENIA: Brak wybranego klienta',
            statusTone: 'warning',
          });
          return { success: false, error: 'Brak wybranego klienta' };
        }

        // Exact pure domain calculations
        const totals = calculateTotals(cart);

        // Safe payment validation (PCI-DSS Hygiene)
        const validationResult = validatePaymentSafe(paymentInput, {
          totalCents: totals.totalCents,
        });

        if (!validationResult.success) {
          const errorMsg = validationResult.errors.join('; ');
          set({
            statusMessage: `BŁĄD PŁATNOŚCI: ${errorMsg}`,
            statusTone: 'error',
          });
          return { success: false, error: errorMsg };
        }

        const orderId = generateDomainId('ord');
        const now = new Date();
        const timestamp = now.toISOString().replace('T', ' ').substring(0, 19);

        const orderItems: OrderItem[] = cart.map((item) => ({
          id: item.product.id,
          name: item.product.name,
          priceCents: item.product.priceCents,
          quantity: item.quantity,
          category: item.product.category,
        }));

        const paymentMethodLabel =
          paymentInput.method === 'card'
            ? 'Karta kredytowa'
            : paymentInput.method === 'paypal'
              ? 'PayPal'
              : 'Bitcoin';

        const newOrder: Order = {
          id: orderId,
          timestamp,
          customer: {
            id: customer.id,
            name: customer.name,
            email: customer.email,
          },
          items: orderItems,
          subtotalCents: totals.subtotalCents,
          deliveryCents: totals.deliveryCents,
          totalCents: totals.totalCents,
          paymentMethod: paymentMethodLabel,
          paymentDetails: validationResult.data,
        };

        const updatedOrders = [newOrder, ...orders];

        set({
          orders: updatedOrders,
          cart: [],
          statusMessage: `ZAMÓWIENIE PRZYJĘTE // ID: ${orderId} // KWOTA: ${formatPLN(totals.totalCents)}`,
          statusTone: 'success',
        });

        await persist();

        return { success: true, orderId };
      },

      removeOrder: (orderId: string) => {
        const { orders } = get();
        const updatedOrders = orders.filter((o) => o.id !== orderId);
        set({
          orders: updatedOrders,
          statusMessage: `USUNIĘTO ZAMÓWIENIE: ${orderId}`,
          statusTone: 'info',
        });
        void persist();
      },

      setStatus: (message: string, tone: StatusTone = 'info') => {
        set({ statusMessage: message, statusTone: tone });
      },

      clearStatus: () => {
        set({ statusMessage: null, statusTone: 'info' });
      },

      // Actions: Settings & Utilities
      toggleCrtFx: () => {
        const { settings } = get();
        const nextCrtFx = !settings.crtFx;
        set({
          settings: { ...settings, crtFx: nextCrtFx },
          statusMessage: `CRT FX: ${nextCrtFx ? 'WŁĄCZONY' : 'WYŁĄCZONY'}`,
          statusTone: 'info',
        });
        void persist();
      },

      exportHistoryTxt: (options?: ExportTxtOptions) => {
        const { orders } = get();
        const filename = generateOrderHistoryFilename();
        const content = generateOrderHistoryTxt(orders, options);
        set({
          statusMessage: `WYGENEROWANO RAPORT: ${filename}`,
          statusTone: 'success',
        });
        return { filename, content };
      },

      exportBackupJson: () => {
        const { customers, orders, cart, selectedCustomerId, settings } = get();
        const backup: PersistedShopState = {
          version: 2,
          exportedAt: new Date().toISOString(),
          customers: [...customers],
          orders: [...orders],
          cart: [...cart],
          selectedCustomerId,
          settings: { ...settings },
        };
        return JSON.stringify(backup, null, 2);
      },

      importBackupJson: async (rawText: string) => {
        try {
          const parsed = parseLegacyOrCurrentBackup(rawText);
          const customers = [...parsed.customers];
          const orders = [...parsed.orders];
          const cart = parsed.cart ? [...parsed.cart] : [];
          const settings = parsed.settings ?? get().settings;
          const selectedCustomerId = parsed.selectedCustomerId ?? customers[0]?.id ?? null;

          set({
            customers,
            orders,
            cart,
            selectedCustomerId,
            settings,
            statusMessage: `IMPORT ZAKOŃCZONY // KLIENTÓW: ${customers.length}, ZAMÓWIEŃ: ${orders.length}`,
            statusTone: 'success',
          });

          await persist();
          return { success: true, message: 'Import zakończony sukcesem' };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          set({
            statusMessage: `BŁĄD IMPORTU: ${message}`,
            statusTone: 'error',
          });
          return { success: false, message };
        }
      },

      resetDemoData: async () => {
        const seed = createSeedState();
        set({
          customers: [...seed.customers],
          orders: [...seed.orders],
          cart: [],
          selectedCustomerId: seed.selectedCustomerId,
          settings: { ...seed.settings },
          statusMessage: 'PRZYWRÓCONO DOMYŚLNE DANE DEMO',
          statusTone: 'info',
        });
        await persist();
      },
    };
  });
}

/**
 * Default global hook instance of the store connected to IndexedDbStorageAdapter.
 */
export const useShopStore = createShopStore();
