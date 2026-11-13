import { describe, expect, it } from 'vitest';
import * as domain from '@/domain';

describe('domain/index (public API barrel)', () => {
  it('exports all domain functions, constants, and catalog data', () => {
    // Money
    expect(typeof domain.toCents).toBe('function');
    expect(typeof domain.plnToCents).toBe('function');
    expect(typeof domain.centsToPln).toBe('function');
    expect(typeof domain.addCents).toBe('function');
    expect(typeof domain.subtractCents).toBe('function');
    expect(typeof domain.multiplyCents).toBe('function');
    expect(typeof domain.formatPLN).toBe('function');

    // Catalog
    expect(Array.isArray(domain.DEFAULT_CATALOG)).toBe(true);
    expect(domain.DEFAULT_CATALOG.length).toBeGreaterThanOrEqual(5);
    expect(domain.ORIGINAL_PRODUCT_SKUS.size).toBe(5);
    expect(typeof domain.findProductById).toBe('function');
    expect(typeof domain.findProductBySku).toBe('function');
    expect(typeof domain.filterByCategory).toBe('function');
    expect(typeof domain.searchProducts).toBe('function');

    // Cart
    expect(domain.FREE_DELIVERY_THRESHOLD_CENTS).toBe(20000);
    expect(domain.DELIVERY_COST_CENTS).toBe(1500);
    expect(typeof domain.calculateTotals).toBe('function');
    expect(typeof domain.addItem).toBe('function');
    expect(typeof domain.updateQuantity).toBe('function');
    expect(typeof domain.removeItem).toBe('function');
    expect(typeof domain.clearCart).toBe('function');

    // Payment
    expect(domain.BTC_RATE_PLN).toBe(250000);
    expect(typeof domain.validateLuhn).toBe('function');
    expect(typeof domain.maskCardNumber).toBe('function');
    expect(typeof domain.validateCardPayment).toBe('function');
    expect(typeof domain.validatePayPalPayment).toBe('function');
    expect(typeof domain.validateBitcoinPayment).toBe('function');
    expect(typeof domain.validatePayment).toBe('function');
    expect(typeof domain.validatePaymentSafe).toBe('function');

    // Export Txt
    expect(typeof domain.generateOrderHistoryTxt).toBe('function');
    expect(typeof domain.generateOrderHistoryFilename).toBe('function');

    // Schemas & Migration
    expect(domain.CustomerSchema).toBeDefined();
    expect(domain.OrderSchema).toBeDefined();
    expect(domain.PersistedShopStateSchema).toBeDefined();
    expect(typeof domain.parseLegacyOrCurrentBackup).toBe('function');
    expect(typeof domain.generateDomainId).toBe('function');
  });
});
