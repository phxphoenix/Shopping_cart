import { describe, expect, it } from 'vitest';
import { PersistedShopStateSchema } from '@/domain/schemas';
import { createSeedState } from '@/storage/seed';

describe('storage/seed', () => {
  it('creates a valid seed state complying with PersistedShopStateSchema v3', () => {
    const seed = createSeedState();
    const result = PersistedShopStateSchema.safeParse(seed);
    expect(result.success).toBe(true);
    expect(seed.version).toBe(3);
    expect(seed.categories).toBeDefined();
    expect(seed.categories?.length).toBeGreaterThanOrEqual(6);
    expect(seed.catalog).toBeDefined();
    expect(seed.catalog?.length).toBeGreaterThanOrEqual(8);
  });

  it('contains sanitized demo customers with zero private personal data', () => {
    const seed = createSeedState();
    expect(seed.customers).toHaveLength(2);
    expect(seed.customers[0]?.name).toBe('Jan Kowalski');
    expect(seed.customers[0]?.email).toBe('jan.kowalski@example.com');
    expect(seed.customers[1]?.name).toBe('Anna Nowak');
    expect(seed.customers[1]?.email).toBe('anna.nowak@example.com');
  });

  it('contains sample orders with strictly masked payment details and NO CVV', () => {
    const seed = createSeedState();
    expect(seed.orders).toHaveLength(2);

    const [order1, order2] = seed.orders;

    // Order 1: Card payment
    expect(order1?.paymentDetails.method).toBe('card');
    if (order1?.paymentDetails.method === 'card') {
      expect(order1.paymentDetails.maskedCard).toBe('**** **** **** 1234');
      expect(order1.paymentDetails.last4).toBe('1234');
      expect((order1.paymentDetails as Record<string, unknown>).cvv).toBeUndefined();
    }
    expect(order1?.totalCents).toBe(349999);
    expect(order1?.deliveryCents).toBe(0); // free delivery threshold >= 200.00 PLN

    // Order 2: PayPal payment
    expect(order2?.paymentDetails.method).toBe('paypal');
    if (order2?.paymentDetails.method === 'paypal') {
      expect(order2.paymentDetails.email).toBe('anna.nowak@example.com');
    }
    expect(order2?.subtotalCents).toBe(19999);
    expect(order2?.deliveryCents).toBe(1500); // standard delivery
    expect(order2?.totalCents).toBe(21499);
  });

  it('initializes with empty cart and default retro CRT settings', () => {
    const seed = createSeedState();
    expect(seed.cart).toEqual([]);
    expect(seed.selectedCustomerId).toBe('cust-demo-1');
    expect(seed.settings.crtFx).toBe(true);
  });
});
