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
    expect(typeof domain.parsePlnInputToCents).toBe('function');

    // Catalog
    expect(Array.isArray(domain.DEFAULT_CATALOG)).toBe(true);
    expect(domain.DEFAULT_CATALOG.length).toBeGreaterThanOrEqual(5);
    expect(domain.ORIGINAL_PRODUCT_SKUS.size).toBe(5);
    expect(domain.DEFAULT_CATEGORY_ID).toBe('cat-default');
    expect(Array.isArray(domain.DEFAULT_CATEGORIES)).toBe(true);
    expect(domain.DEFAULT_CATEGORIES.length).toBeGreaterThanOrEqual(6);
    expect(typeof domain.findProductById).toBe('function');
    expect(typeof domain.findProductBySku).toBe('function');
    expect(typeof domain.filterByCategory).toBe('function');
    expect(typeof domain.searchProducts).toBe('function');
    expect(typeof domain.slugify).toBe('function');
    expect(typeof domain.addCategoryToList).toBe('function');
    expect(typeof domain.createCategory).toBe('function');
    expect(typeof domain.updateCategoryInList).toBe('function');
    expect(typeof domain.updateCategory).toBe('function');
    expect(typeof domain.deleteCategoryFromList).toBe('function');
    expect(typeof domain.deleteCategoryWithFallback).toBe('function');
    expect(typeof domain.migrateProductsBetweenCategories).toBe('function');
    expect(typeof domain.addProductToList).toBe('function');
    expect(typeof domain.createProduct).toBe('function');
    expect(typeof domain.updateProductInList).toBe('function');
    expect(typeof domain.updateProduct).toBe('function');
    expect(typeof domain.deleteProductFromList).toBe('function');
    expect(typeof domain.deleteProduct).toBe('function');

    // Cart
    expect(domain.FREE_DELIVERY_THRESHOLD_CENTS).toBe(20000);
    expect(domain.DELIVERY_COST_CENTS).toBe(1500);
    expect(typeof domain.calculateTotals).toBe('function');
    expect(typeof domain.addItem).toBe('function');
    expect(typeof domain.updateQuantity).toBe('function');
    expect(typeof domain.removeItem).toBe('function');
    expect(typeof domain.clearCart).toBe('function');
    expect(typeof domain.syncCartWithCatalog).toBe('function');

    // Customer & Validation
    expect(domain.RegisterCustomerInputSchema).toBeDefined();
    expect(typeof domain.validateUniqueCustomerEmail).toBe('function');
    expect(typeof domain.assertUniqueCustomerEmail).toBe('function');
    expect(typeof domain.validateNewCustomerRegistration).toBe('function');
    expect(typeof domain.maskCustomerEmail).toBe('function');

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
