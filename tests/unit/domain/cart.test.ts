import { describe, expect, it } from 'vitest';
import {
  DELIVERY_COST_CENTS,
  FREE_DELIVERY_THRESHOLD_CENTS,
  addItem,
  calculateTotals,
  clearCart,
  removeItem,
  updateQuantity,
} from '@/domain/cart';
import { DEFAULT_CATALOG } from '@/domain/catalog';
import { toCents } from '@/domain/money';

describe('domain/cart', () => {
  const laptop = DEFAULT_CATALOG[0]!; // 3499.99 PLN = 349999 groszy
  const headphones = DEFAULT_CATALOG[1]!; // 199.99 PLN = 19999 groszy
  const tshirt = DEFAULT_CATALOG[2]!; // 79.99 PLN = 7999 groszy

  describe('calculateTotals & delivery thresholds', () => {
    it('returns zeroes for an empty cart with full distance to free delivery', () => {
      const totals = calculateTotals([]);
      expect(totals.subtotalCents).toBe(0);
      expect(totals.deliveryCents).toBe(0);
      expect(totals.totalCents).toBe(0);
      expect(totals.isFreeDelivery).toBe(false);
      expect(totals.amountToFreeDeliveryCents).toBe(FREE_DELIVERY_THRESHOLD_CENTS);
      expect(totals.itemCount).toBe(0);
    });

    it('charges delivery below threshold at 199.99 PLN (19 999 groszy)', () => {
      // 1x Słuchawki = 199.99 PLN (19999 groszy) -> 1 grosz below 200.00 PLN threshold!
      const items = addItem([], headphones, 1);
      const totals = calculateTotals(items);

      expect(totals.subtotalCents).toBe(19999);
      expect(totals.deliveryCents).toBe(DELIVERY_COST_CENTS); // 1500 groszy = 15.00 PLN
      expect(totals.totalCents).toBe(21499); // 19999 + 1500 = 21499 groszy (214.99 PLN)
      expect(totals.isFreeDelivery).toBe(false);
      expect(totals.amountToFreeDeliveryCents).toBe(1); // exactly 1 grosz missing
      expect(totals.itemCount).toBe(1);
    });

    it('grants free delivery exactly at the 200.00 PLN (20 000 groszy) threshold', () => {
      // Create artificial item at exactly 200.00 PLN
      const itemAtThreshold = {
        product: {
          ...headphones,
          id: 'exact-200',
          priceCents: toCents(20000),
        },
        quantity: 1,
        lineTotalCents: toCents(20000),
      };

      const totals = calculateTotals([itemAtThreshold]);

      expect(totals.subtotalCents).toBe(20000);
      expect(totals.deliveryCents).toBe(0);
      expect(totals.totalCents).toBe(20000);
      expect(totals.isFreeDelivery).toBe(true);
      expect(totals.amountToFreeDeliveryCents).toBe(0);
      expect(totals.itemCount).toBe(1);
    });

    it('grants free delivery above threshold (e.g. Laptop at 3499.99 PLN)', () => {
      const items = addItem([], laptop, 1);
      const totals = calculateTotals(items);

      expect(totals.subtotalCents).toBe(349999);
      expect(totals.deliveryCents).toBe(0);
      expect(totals.totalCents).toBe(349999);
      expect(totals.isFreeDelivery).toBe(true);
      expect(totals.amountToFreeDeliveryCents).toBe(0);
      expect(totals.itemCount).toBe(1);
    });

    it('correctly calculates total item count for multiple quantities', () => {
      let items = addItem([], tshirt, 2);
      items = addItem(items, headphones, 3);
      const totals = calculateTotals(items);

      expect(totals.itemCount).toBe(5);
    });
  });

  describe('addItem', () => {
    it('adds a new item to an empty cart', () => {
      const items = addItem([], tshirt, 1);
      expect(items.length).toBe(1);
      expect(items[0]?.product.id).toBe(tshirt.id);
      expect(items[0]?.quantity).toBe(1);
      expect(items[0]?.lineTotalCents).toBe(tshirt.priceCents);
    });

    it('increments quantity and updates lineTotal when adding the same product', () => {
      let items = addItem([], tshirt, 2);
      items = addItem(items, tshirt, 3);

      expect(items.length).toBe(1);
      expect(items[0]?.quantity).toBe(5);
      expect(items[0]?.lineTotalCents).toBe(tshirt.priceCents * 5);
    });

    it('adds different products as separate items', () => {
      let items = addItem([], tshirt, 1);
      items = addItem(items, headphones, 1);

      expect(items.length).toBe(2);
      expect(items[0]?.product.id).toBe(tshirt.id);
      expect(items[1]?.product.id).toBe(headphones.id);
    });

    it('throws RangeError when quantity is <= 0 or not an integer', () => {
      expect(() => addItem([], tshirt, 0)).toThrow(RangeError);
      expect(() => addItem([], tshirt, -1)).toThrow(RangeError);
      expect(() => addItem([], tshirt, 1.5)).toThrow(RangeError);
      expect(() => addItem([], tshirt, NaN)).toThrow(RangeError);
    });
  });

  describe('updateQuantity', () => {
    it('updates quantity of existing product', () => {
      const initial = addItem([], tshirt, 2);
      const updated = updateQuantity(initial, tshirt.id, 4);

      expect(updated[0]?.quantity).toBe(4);
      expect(updated[0]?.lineTotalCents).toBe(tshirt.priceCents * 4);
    });

    it('removes item from cart when quantity is set to 0', () => {
      const initial = addItem([], tshirt, 2);
      const updated = updateQuantity(initial, tshirt.id, 0);

      expect(updated.length).toBe(0);
    });

    it('leaves items unchanged when productId does not match', () => {
      const initial = addItem([], tshirt, 2);
      const updated = updateQuantity(initial, 'non-existent', 5);

      expect(updated).toEqual(initial);
    });

    it('throws RangeError for negative or non-integer quantity', () => {
      const initial = addItem([], tshirt, 2);
      expect(() => updateQuantity(initial, tshirt.id, -2)).toThrow(RangeError);
      expect(() => updateQuantity(initial, tshirt.id, 2.5)).toThrow(RangeError);
    });
  });

  describe('removeItem', () => {
    it('removes target product by ID', () => {
      let items = addItem([], tshirt, 1);
      items = addItem(items, headphones, 1);

      const afterRemove = removeItem(items, tshirt.id);
      expect(afterRemove.length).toBe(1);
      expect(afterRemove[0]?.product.id).toBe(headphones.id);
    });

    it('returns unmodified list if productId not found', () => {
      const items = addItem([], tshirt, 1);
      const after = removeItem(items, 'unknown-id');
      expect(after.length).toBe(1);
    });
  });

  describe('clearCart', () => {
    it('returns an empty array', () => {
      let items = addItem([], tshirt, 2);
      items = addItem(items, laptop, 1);
      expect(items.length).toBe(2);
      expect(clearCart()).toEqual([]);
    });
  });
});
