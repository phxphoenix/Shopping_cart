/**
 * Domain module: Cart & Order Totals
 *
 * Implements pure shopping cart operations and exact delivery threshold arithmetic.
 * Free delivery threshold: 200.00 PLN (20 000 groszy).
 * Standard delivery cost: 15.00 PLN (1 500 groszy).
 */

import type { Product } from './catalog';
import { type Cents, addCents, multiplyCents, subtractCents, toCents } from './money';

/** Free delivery threshold in grosze (200.00 PLN) */
export const FREE_DELIVERY_THRESHOLD_CENTS: Cents = toCents(20000);

/** Standard delivery cost below threshold in grosze (15.00 PLN) */
export const DELIVERY_COST_CENTS: Cents = toCents(1500);

export interface CartItem {
  readonly product: Product;
  readonly quantity: number;
  readonly lineTotalCents: Cents;
}

export interface CartTotals {
  /** Sum of product line totals */
  readonly subtotalCents: Cents;
  /** Delivery charge (0 if empty or free delivery threshold met) */
  readonly deliveryCents: Cents;
  /** Total amount payable (subtotal + delivery) */
  readonly totalCents: Cents;
  /** Whether the order qualifies for free delivery */
  readonly isFreeDelivery: boolean;
  /** Remaining amount in grosze needed to reach free delivery */
  readonly amountToFreeDeliveryCents: Cents;
  /** Total number of individual items in the cart */
  readonly itemCount: number;
}

/**
 * Calculates cart totals including delivery cost and free delivery delta.
 * If the cart is empty: delivery is 0, total is 0.
 */
export function calculateTotals(items: readonly CartItem[]): CartTotals {
  if (items.length === 0) {
    return {
      subtotalCents: toCents(0),
      deliveryCents: toCents(0),
      totalCents: toCents(0),
      isFreeDelivery: false,
      amountToFreeDeliveryCents: FREE_DELIVERY_THRESHOLD_CENTS,
      itemCount: 0,
    };
  }

  let subtotal = 0;
  let itemCount = 0;

  for (const item of items) {
    subtotal += item.lineTotalCents;
    itemCount += item.quantity;
  }

  const subtotalCents = toCents(subtotal);
  const isFreeDelivery = subtotalCents >= FREE_DELIVERY_THRESHOLD_CENTS;

  const deliveryCents = isFreeDelivery ? toCents(0) : DELIVERY_COST_CENTS;
  const totalCents = addCents(subtotalCents, deliveryCents);
  const amountToFreeDeliveryCents = isFreeDelivery
    ? toCents(0)
    : subtractCents(FREE_DELIVERY_THRESHOLD_CENTS, subtotalCents);

  return {
    subtotalCents,
    deliveryCents,
    totalCents,
    isFreeDelivery,
    amountToFreeDeliveryCents,
    itemCount,
  };
}

/**
 * Adds a product to the cart with the given quantity (default: 1).
 * If the product already exists, increments the quantity.
 * Throws RangeError if quantity is not a positive safe integer.
 */
export function addItem(items: readonly CartItem[], product: Product, quantity = 1): CartItem[] {
  if (!Number.isSafeInteger(quantity) || quantity <= 0) {
    throw new RangeError(`Quantity must be a positive integer, received: ${quantity}`);
  }

  const existingIndex = items.findIndex((item) => item.product.id === product.id);

  if (existingIndex >= 0) {
    const existing = items[existingIndex]!;
    const newQuantity = existing.quantity + quantity;
    const updatedItem: CartItem = {
      product: existing.product,
      quantity: newQuantity,
      lineTotalCents: multiplyCents(existing.product.priceCents, newQuantity),
    };

    const newItems = [...items];
    newItems[existingIndex] = updatedItem;
    return newItems;
  }

  const newItem: CartItem = {
    product,
    quantity,
    lineTotalCents: multiplyCents(product.priceCents, quantity),
  };

  return [...items, newItem];
}

/**
 * Updates the quantity of a specific product in the cart.
 * If quantity is 0, removes the product from the cart.
 * Throws RangeError if quantity is negative or not a safe integer.
 */
export function updateQuantity(
  items: readonly CartItem[],
  productId: string,
  quantity: number
): CartItem[] {
  if (!Number.isSafeInteger(quantity) || quantity < 0) {
    throw new RangeError(`Quantity must be a non-negative integer, received: ${quantity}`);
  }

  if (quantity === 0) {
    return removeItem(items, productId);
  }

  return items.map((item) => {
    if (item.product.id !== productId) {
      return item;
    }
    return {
      product: item.product,
      quantity,
      lineTotalCents: multiplyCents(item.product.priceCents, quantity),
    };
  });
}

/**
 * Removes a product from the cart by its product ID.
 */
export function removeItem(items: readonly CartItem[], productId: string): CartItem[] {
  return items.filter((item) => item.product.id !== productId);
}

/**
 * Clears all items from the cart.
 */
export function clearCart(): CartItem[] {
  return [];
}
