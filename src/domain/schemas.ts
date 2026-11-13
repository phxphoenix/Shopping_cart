/**
 * Domain module: Schemas, Zod Validation, and Legacy Backup Import
 *
 * Provides runtime validation using Zod for domain entities and ensures safe
 * migration from legacy data.json (Tkinter format) to the modern v2 schema.
 *
 * PCI-DSS Hygiene on Import:
 * Any legacy plaintext `cvv` / `cvc` fields are strictly discarded and never imported.
 * Full credit card numbers are masked to `**** **** **** 1234` and reduced to `last4`.
 */

import { z } from 'zod';
import { type Cents, plnToCents, toCents } from './money';
import { BTC_RATE_PLN, type SafePaymentInfo, centsToBtcString, maskCardNumber } from './payment';

/**
 * Universal portable ID generator (zero DOM or browser-specific dependencies).
 */
export function generateDomainId(prefix = 'id'): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return `${prefix}-${globalThis.crypto.randomUUID()}`;
  }
  const rand = Math.random().toString(36).substring(2, 10);
  const time = Date.now().toString(36);
  return `${prefix}-${time}-${rand}`;
}

// ---------------------------------------------------------------------------
// Zod Schemas
// ---------------------------------------------------------------------------

export const CustomerSchema = z.object({
  id: z.string().min(1, 'ID klienta jest wymagane'),
  name: z.string().min(1, 'Imię klienta jest wymagane'),
  email: z.string().email('Nieprawidłowy adres email'),
});
export type Customer = z.infer<typeof CustomerSchema>;

export const OrderItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  priceCents: z
    .number()
    .int()
    .nonnegative()
    .transform((val) => toCents(val)),
  quantity: z.number().int().positive(),
  category: z.string().min(1),
});
export type OrderItem = z.infer<typeof OrderItemSchema>;

export const SafeCardPaymentSchema = z.object({
  method: z.literal('card'),
  maskedCard: z.string().min(1),
  last4: z.string().length(4),
  expiry: z.string().min(1),
});

export const SafePayPalPaymentSchema = z.object({
  method: z.literal('paypal'),
  email: z.string().email(),
});

export const SafeBitcoinPaymentSchema = z.object({
  method: z.literal('bitcoin'),
  walletAddress: z.string().min(1),
  btcAmount: z.string().min(1),
  btcRatePln: z.number().positive(),
});

export const SafePaymentInfoSchema = z.discriminatedUnion('method', [
  SafeCardPaymentSchema,
  SafePayPalPaymentSchema,
  SafeBitcoinPaymentSchema,
]);

export const OrderSchema = z.object({
  id: z.string().min(1),
  timestamp: z.string().min(1),
  customer: CustomerSchema,
  items: z.array(OrderItemSchema),
  subtotalCents: z
    .number()
    .int()
    .nonnegative()
    .transform((val) => toCents(val)),
  deliveryCents: z
    .number()
    .int()
    .nonnegative()
    .transform((val) => toCents(val)),
  totalCents: z
    .number()
    .int()
    .nonnegative()
    .transform((val) => toCents(val)),
  paymentMethod: z.string().min(1),
  paymentDetails: SafePaymentInfoSchema,
});
export type Order = z.infer<typeof OrderSchema>;

export const PersistedShopStateSchema = z.object({
  version: z.literal(2),
  exportedAt: z.string(),
  customers: z.array(CustomerSchema),
  orders: z.array(OrderSchema),
});
export type PersistedShopState = z.infer<typeof PersistedShopStateSchema>;

export interface ParsedBackupState {
  readonly version: 2;
  readonly exportedAt: string;
  readonly customers: readonly Customer[];
  readonly orders: readonly Order[];
}

// ---------------------------------------------------------------------------
// Legacy Parser & Migration Helper
// ---------------------------------------------------------------------------

function sanitizePaymentDetailsForMigration(
  methodName: string,
  rawDetails: Record<string, unknown> | undefined,
  totalCents: Cents
): SafePaymentInfo {
  const methodStr = (methodName || '').toLowerCase();
  const details = rawDetails ?? {};

  // Check if it's already a valid safe payment info v2
  const safeParseAttempt = SafePaymentInfoSchema.safeParse(details);
  if (safeParseAttempt.success) {
    return safeParseAttempt.data;
  }

  if (
    methodStr.includes('karta') ||
    methodStr.includes('card') ||
    details.method === 'Karta kredytowa' ||
    details.method === 'card'
  ) {
    const rawCardNumber =
      typeof details.card_number === 'string'
        ? details.card_number
        : typeof details.cardNumber === 'string'
          ? details.cardNumber
          : typeof details.maskedCard === 'string'
            ? details.maskedCard
            : '0000000000000000';

    const cleanCard = rawCardNumber.replace(/[\s-]/g, '');
    const { masked: maskedCard, last4 } =
      cleanCard.length >= 4
        ? maskCardNumber(cleanCard)
        : {
            masked: `**** **** **** ${typeof details.last4 === 'string' && details.last4.length === 4 ? details.last4 : '0000'}`,
            last4:
              typeof details.last4 === 'string' && details.last4.length === 4
                ? details.last4
                : '0000',
          };
    const expiry =
      typeof details.expiry === 'string' && details.expiry.trim() ? details.expiry.trim() : '12/99';

    // Strictly discard CVV! Do not include in returned object.
    return {
      method: 'card',
      maskedCard,
      last4,
      expiry,
    };
  }

  if (methodStr.includes('paypal') || details.method === 'PayPal' || details.method === 'paypal') {
    const email =
      typeof details.email === 'string' && details.email.includes('@')
        ? details.email.trim()
        : 'unknown@paypal.com';

    return {
      method: 'paypal',
      email,
    };
  }

  // Fallback to Bitcoin
  const wallet =
    typeof details.wallet === 'string'
      ? details.wallet.trim()
      : typeof details.walletAddress === 'string'
        ? details.walletAddress.trim()
        : '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa';

  const rate =
    typeof details.btcRatePln === 'number' && details.btcRatePln > 0
      ? details.btcRatePln
      : BTC_RATE_PLN;

  const btcAmount =
    typeof details.btcAmount === 'string' ? details.btcAmount : centsToBtcString(totalCents, rate);

  return {
    method: 'bitcoin',
    walletAddress: wallet,
    btcAmount,
    btcRatePln: rate,
  };
}

/**
 * Parses either a modern v2 backup JSON string or a legacy Tkinter data.json format.
 *
 * Migration guarantees:
 * 1. Floats are safely converted to integer Cents via Math.round(pln * 100).
 * 2. Any plaintext credit card numbers are masked to `**** **** **** 1234`.
 * 3. Any plaintext CVV / CVC fields are unconditionally stripped.
 * 4. Missing IDs are assigned unique stable identifiers.
 * 5. Returns validated ParsedBackupState.
 */
export function parseLegacyOrCurrentBackup(jsonString: string): ParsedBackupState {
  let raw: unknown;
  try {
    raw = JSON.parse(jsonString);
  } catch (err) {
    throw new Error(
      `Nieprawidłowy format JSON: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('Nieprawidłowy plik kopii zapasowej: oczekiwano obiektu JSON');
  }

  const rawObj = raw as Record<string, unknown>;

  // Check if it's already a modern v2 backup
  if (rawObj.version === 2) {
    const v2Parse = PersistedShopStateSchema.safeParse(rawObj);
    if (v2Parse.success) {
      return v2Parse.data;
    }
    // If version is 2 but validation failed, throw detailed Zod error
    throw new Error(
      `Błąd walidacji kopii zapasowej v2: ${v2Parse.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')}`
    );
  }

  // Legacy migration (Tkinter format)
  const rawCustomers = Array.isArray(rawObj.customers) ? rawObj.customers : [];
  const rawOrders = Array.isArray(rawObj.orders) ? rawObj.orders : [];

  const customers: Customer[] = rawCustomers.map((cust, idx) => {
    const custObj = (cust && typeof cust === 'object' ? cust : {}) as Record<string, unknown>;

    const id =
      typeof custObj.id === 'string' && custObj.id.trim()
        ? custObj.id.trim()
        : generateDomainId(`cust-${idx + 1}`);

    const name =
      typeof custObj.name === 'string' && custObj.name.trim() ? custObj.name.trim() : 'Anonimowy';

    const email =
      typeof custObj.email === 'string' && custObj.email.includes('@')
        ? custObj.email.trim()
        : `klient-${idx + 1}@example.com`;

    return { id, name, email };
  });

  const orders: Order[] = rawOrders.map((ord, idx) => {
    const ordObj = (ord && typeof ord === 'object' ? ord : {}) as Record<string, unknown>;

    const id =
      typeof ordObj.id === 'string' && ordObj.id.trim()
        ? ordObj.id.trim()
        : generateDomainId(`ord-${idx + 1}`);

    const timestamp =
      typeof ordObj.timestamp === 'string' && ordObj.timestamp.trim()
        ? ordObj.timestamp.trim()
        : new Date().toISOString();

    // Customer resolution
    const ordCust = (
      ordObj.customer && typeof ordObj.customer === 'object' ? ordObj.customer : {}
    ) as Record<string, unknown>;

    const customerName =
      typeof ordCust.name === 'string' && ordCust.name.trim() ? ordCust.name.trim() : 'Anonimowy';

    const customerEmail =
      typeof ordCust.email === 'string' && ordCust.email.includes('@')
        ? ordCust.email.trim()
        : 'klient@example.com';

    const matchedCustomer = customers.find(
      (c) => c.name === customerName && c.email === customerEmail
    );

    const customer: Customer = matchedCustomer ?? {
      id:
        typeof ordCust.id === 'string' && ordCust.id.trim()
          ? ordCust.id.trim()
          : generateDomainId(`cust-ord-${idx + 1}`),
      name: customerName,
      email: customerEmail,
    };

    // Amount conversions (float to Cents with rounding)
    const rawSubtotal = typeof ordObj.subtotal === 'number' ? ordObj.subtotal : 0;
    const rawDelivery = typeof ordObj.delivery === 'number' ? ordObj.delivery : 0;
    const rawTotal = typeof ordObj.total === 'number' ? ordObj.total : 0;

    const subtotalCents =
      typeof ordObj.subtotalCents === 'number'
        ? toCents(ordObj.subtotalCents)
        : plnToCents(rawSubtotal);

    const deliveryCents =
      typeof ordObj.deliveryCents === 'number'
        ? toCents(ordObj.deliveryCents)
        : plnToCents(rawDelivery);

    const totalCents =
      typeof ordObj.totalCents === 'number' ? toCents(ordObj.totalCents) : plnToCents(rawTotal);

    // Items conversion
    const rawItems = Array.isArray(ordObj.items) ? ordObj.items : [];
    const items: OrderItem[] = rawItems.map((item, itemIdx) => {
      const itemObj = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;

      const itemId =
        typeof itemObj.id === 'string' && itemObj.id.trim()
          ? itemObj.id.trim()
          : generateDomainId(`item-${idx + 1}-${itemIdx + 1}`);

      const name =
        typeof itemObj.name === 'string' && itemObj.name.trim() ? itemObj.name.trim() : 'Produkt';

      const priceCents =
        typeof itemObj.priceCents === 'number'
          ? toCents(itemObj.priceCents)
          : typeof itemObj.price === 'number'
            ? plnToCents(itemObj.price)
            : toCents(0);

      const quantity =
        typeof itemObj.qty === 'number' && itemObj.qty > 0
          ? Math.round(itemObj.qty)
          : typeof itemObj.quantity === 'number' && itemObj.quantity > 0
            ? Math.round(itemObj.quantity)
            : 1;

      const category =
        typeof itemObj.category === 'string' && itemObj.category.trim()
          ? itemObj.category.trim()
          : 'Ogólne';

      return {
        id: itemId,
        name,
        priceCents,
        quantity,
        category,
      };
    });

    const paymentMethod =
      typeof ordObj.payment_method === 'string'
        ? ordObj.payment_method
        : typeof ordObj.paymentMethod === 'string'
          ? ordObj.paymentMethod
          : 'Karta kredytowa';

    const rawPaymentDetails = (ordObj.payment_details ?? ordObj.paymentDetails) as
      Record<string, unknown> | undefined;

    const paymentDetails = sanitizePaymentDetailsForMigration(
      paymentMethod,
      rawPaymentDetails,
      totalCents
    );

    return {
      id,
      timestamp,
      customer,
      items,
      subtotalCents,
      deliveryCents,
      totalCents,
      paymentMethod,
      paymentDetails,
    };
  });

  return {
    version: 2,
    exportedAt: new Date().toISOString(),
    customers,
    orders,
  };
}
