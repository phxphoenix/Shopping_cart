import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CATALOG,
  ORIGINAL_PRODUCT_SKUS,
  filterByCategory,
  findProductById,
  findProductBySku,
  searchProducts,
} from '@/domain/catalog';

describe('domain/catalog', () => {
  it('contains all 5 original legacy products with exact prices in grosze', () => {
    const laptop = findProductBySku(DEFAULT_CATALOG, 'HW-LAPTOP-01');
    expect(laptop).toBeDefined();
    expect(laptop?.name).toBe('Laptop');
    expect(laptop?.priceCents).toBe(349999);
    expect(laptop?.category).toBe('Elektronika');

    const headphones = findProductBySku(DEFAULT_CATALOG, 'AU-PHONE-02');
    expect(headphones).toBeDefined();
    expect(headphones?.name).toBe('Słuchawki');
    expect(headphones?.priceCents).toBe(19999);
    expect(headphones?.category).toBe('Elektronika');

    const tshirt = findProductBySku(DEFAULT_CATALOG, 'CL-TSHIRT-03');
    expect(tshirt).toBeDefined();
    expect(tshirt?.name).toBe('Koszulka');
    expect(tshirt?.priceCents).toBe(7999);
    expect(tshirt?.category).toBe('Odziez');

    const backpack = findProductBySku(DEFAULT_CATALOG, 'AC-BACKPACK-04');
    expect(backpack).toBeDefined();
    expect(backpack?.name).toBe('Plecak');
    expect(backpack?.priceCents).toBe(14999);
    expect(backpack?.category).toBe('Akcesoria');

    const book = findProductBySku(DEFAULT_CATALOG, 'BK-PYTHON-05');
    expect(book).toBeDefined();
    expect(book?.name).toBe('Książka Python');
    expect(book?.priceCents).toBe(5999);
    expect(book?.category).toBe('Edukacja');
  });

  it('contains retro computing expansions', () => {
    const crt = findProductBySku(DEFAULT_CATALOG, 'RH-CRT17-06');
    expect(crt).toBeDefined();
    expect(crt?.name).toContain('CRT');
    expect(crt?.category).toBe('Retro Hardware');

    const keyboard = findProductBySku(DEFAULT_CATALOG, 'RH-KEYB-07');
    expect(keyboard).toBeDefined();
    expect(keyboard?.name).toContain('Klawiatura Mechaniczna');
  });

  it('has 5 legacy SKUs registered in ORIGINAL_PRODUCT_SKUS', () => {
    expect(ORIGINAL_PRODUCT_SKUS.size).toBe(5);
    expect(ORIGINAL_PRODUCT_SKUS.has('HW-LAPTOP-01')).toBe(true);
    expect(ORIGINAL_PRODUCT_SKUS.has('AU-PHONE-02')).toBe(true);
    expect(ORIGINAL_PRODUCT_SKUS.has('CL-TSHIRT-03')).toBe(true);
    expect(ORIGINAL_PRODUCT_SKUS.has('AC-BACKPACK-04')).toBe(true);
    expect(ORIGINAL_PRODUCT_SKUS.has('BK-PYTHON-05')).toBe(true);
  });

  describe('findProductById', () => {
    it('returns the product when found', () => {
      const prod = findProductById(DEFAULT_CATALOG, 'prod-laptop');
      expect(prod?.sku).toBe('HW-LAPTOP-01');
    });

    it('returns undefined when id does not exist', () => {
      expect(findProductById(DEFAULT_CATALOG, 'non-existent')).toBeUndefined();
    });
  });

  describe('findProductBySku', () => {
    it('finds product case-insensitively', () => {
      const prod = findProductBySku(DEFAULT_CATALOG, 'hw-laptop-01');
      expect(prod?.id).toBe('prod-laptop');
    });

    it('returns undefined if sku not found', () => {
      expect(findProductBySku(DEFAULT_CATALOG, 'UNKNOWN-SKU')).toBeUndefined();
    });
  });

  describe('filterByCategory', () => {
    it('filters by category accurately', () => {
      const electronics = filterByCategory(DEFAULT_CATALOG, 'Elektronika');
      expect(electronics.length).toBeGreaterThanOrEqual(2);
      expect(electronics.every((p) => p.category === 'Elektronika')).toBe(true);
    });

    it('returns all items when category is ALL', () => {
      const all = filterByCategory(DEFAULT_CATALOG, 'ALL');
      expect(all.length).toBe(DEFAULT_CATALOG.length);
    });
  });

  describe('searchProducts', () => {
    it('searches by name substring case-insensitively', () => {
      const results = searchProducts(DEFAULT_CATALOG, 'książka');
      expect(results.length).toBe(1);
      expect(results[0]?.name).toBe('Książka Python');
    });

    it('searches by SKU substring', () => {
      const results = searchProducts(DEFAULT_CATALOG, 'CRT17');
      expect(results.length).toBe(1);
      expect(results[0]?.sku).toBe('RH-CRT17-06');
    });

    it('searches in product description', () => {
      const results = searchProducts(DEFAULT_CATALOG, 'luminofor');
      expect(results.length).toBe(1);
      expect(results[0]?.name).toContain('CRT');
    });

    it('combines text query with category filter', () => {
      const results = searchProducts(DEFAULT_CATALOG, 'laptop', 'Retro Hardware');
      expect(results.length).toBe(0);

      const validCatResults = searchProducts(DEFAULT_CATALOG, 'laptop', 'Elektronika');
      expect(validCatResults.length).toBe(1);
    });

    it('returns all products for category if search query is whitespace', () => {
      const results = searchProducts(DEFAULT_CATALOG, '   ', 'Elektronika');
      expect(results.every((p) => p.category === 'Elektronika')).toBe(true);
    });
  });
});
