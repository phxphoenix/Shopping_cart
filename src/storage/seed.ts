/**
 * Storage module: Demo Seed State
 *
 * Generates safe, sanitized demo data for initial shop initialization.
 * Zero private personal data and strictly ZERO CVV / plaintext card numbers.
 */

import { toCents } from '../domain/money';
import type { Customer, Order, PersistedShopState } from '../domain/schemas';

export function createSeedState(): PersistedShopState {
  const customer1: Customer = {
    id: 'cust-demo-1',
    name: 'Jan Kowalski',
    email: 'jan.kowalski@example.com',
  };

  const customer2: Customer = {
    id: 'cust-demo-2',
    name: 'Anna Nowak',
    email: 'anna.nowak@example.com',
  };

  const order1: Order = {
    id: 'ord-demo-1',
    timestamp: '2026-11-10 12:00:00',
    customer: customer1,
    items: [
      {
        id: 'prod-laptop',
        name: 'Laptop',
        priceCents: toCents(349999),
        quantity: 1,
        category: 'Elektronika',
      },
    ],
    subtotalCents: toCents(349999),
    deliveryCents: toCents(0),
    totalCents: toCents(349999),
    paymentMethod: 'Karta kredytowa',
    paymentDetails: {
      method: 'card',
      maskedCard: '**** **** **** 1234',
      last4: '1234',
      expiry: '12/28',
    },
  };

  const order2: Order = {
    id: 'ord-demo-2',
    timestamp: '2026-11-11 15:30:00',
    customer: customer2,
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
    paymentMethod: 'PayPal',
    paymentDetails: {
      method: 'paypal',
      email: 'anna.nowak@example.com',
    },
  };

  return {
    version: 2,
    exportedAt: '2026-11-13T10:00:00.000Z',
    customers: [customer1, customer2],
    orders: [order1, order2],
    cart: [],
    selectedCustomerId: customer1.id,
    settings: {
      crtFx: true,
    },
  };
}
