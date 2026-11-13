/**
 * Domain module: Catalog & Products
 *
 * Defines product structures, default inventory preserving the 5 original legacy
 * products alongside retro computing additions, and pure search/filter utilities.
 */

import { type Cents, toCents } from './money';

export type ProductCategory =
  'Elektronika' | 'Odziez' | 'Akcesoria' | 'Edukacja' | 'Retro Hardware';

export interface Product {
  readonly id: string;
  readonly sku: string;
  readonly name: string;
  readonly priceCents: Cents;
  readonly category: ProductCategory;
  readonly description: string;
  readonly inStock: boolean;
  readonly stockQuantity: number;
}

/**
 * Default product catalog.
 * Preserves all 5 original items from legacy/products.py with exact price matching in grosze,
 * complemented by retro CRT/cyberdeck peripherals.
 */
export const DEFAULT_CATALOG: readonly Product[] = [
  // Original 5 legacy items:
  {
    id: 'prod-laptop',
    sku: 'HW-LAPTOP-01',
    name: 'Laptop',
    priceCents: toCents(349999), // 3499.99 PLN
    category: 'Elektronika',
    description: 'Wysokowydajny komputer przenośny do programowania i pracy biurowej.',
    inStock: true,
    stockQuantity: 12,
  },
  {
    id: 'prod-sluchawki',
    sku: 'AU-PHONE-02',
    name: 'Słuchawki',
    priceCents: toCents(19999), // 199.99 PLN
    category: 'Elektronika',
    description: 'Wygodne słuchawki stereofoniczne z redukcją szumów otoczenia.',
    inStock: true,
    stockQuantity: 25,
  },
  {
    id: 'prod-koszulka',
    sku: 'CL-TSHIRT-03',
    name: 'Koszulka',
    priceCents: toCents(7999), // 79.99 PLN
    category: 'Odziez',
    description: 'Bawelniana koszulka programisty z motywem terminalowym.',
    inStock: true,
    stockQuantity: 40,
  },
  {
    id: 'prod-plecak',
    sku: 'AC-BACKPACK-04',
    name: 'Plecak',
    priceCents: toCents(14999), // 149.99 PLN
    category: 'Akcesoria',
    description: 'Wodoodporny plecak na laptopa 15.6 cala i akcesoria.',
    inStock: true,
    stockQuantity: 18,
  },
  {
    id: 'prod-ksiazka-python',
    sku: 'BK-PYTHON-05',
    name: 'Książka Python',
    priceCents: toCents(5999), // 59.99 PLN
    category: 'Edukacja',
    description:
      'Kompleksowy podręcznik programowania w języku Python od podstaw do zaawansowanych technik.',
    inStock: true,
    stockQuantity: 30,
  },

  // Retro thematic expansions:
  {
    id: 'prod-crt-monitor',
    sku: 'RH-CRT17-06',
    name: 'Monitor CRT 17"',
    priceCents: toCents(45000), // 450.00 PLN
    category: 'Retro Hardware',
    description: 'Klasyczny kineskopowy monitor z zielonym luminoforem P1 i odświeżaniem 85Hz.',
    inStock: true,
    stockQuantity: 4,
  },
  {
    id: 'prod-klawiatura-mech',
    sku: 'RH-KEYB-07',
    name: 'Klawiatura Mechaniczna Clicky',
    priceCents: toCents(29900), // 299.00 PLN
    category: 'Retro Hardware',
    description:
      'Ciężka klawiatura ze sprężynami buckling spring, inspirowana legendarnym IBM Model M.',
    inStock: true,
    stockQuantity: 8,
  },
  {
    id: 'prod-dyskietki',
    sku: 'AC-FLOPPY-08',
    name: 'Dyskietka 3.5" HD (Paczka 10 szt.)',
    priceCents: toCents(3999), // 39.99 PLN
    category: 'Akcesoria',
    description: 'Pudełko 10 dyskietek magnetycznych 1.44 MB do archiwizacji danych offline.',
    inStock: true,
    stockQuantity: 50,
  },
];

/**
 * SKUs of the original 5 products from legacy Python code.
 */
export const ORIGINAL_PRODUCT_SKUS = new Set([
  'HW-LAPTOP-01',
  'AU-PHONE-02',
  'CL-TSHIRT-03',
  'AC-BACKPACK-04',
  'BK-PYTHON-05',
]);

/**
 * Finds a product by its unique identifier.
 */
export function findProductById(catalog: readonly Product[], id: string): Product | undefined {
  return catalog.find((product) => product.id === id);
}

/**
 * Finds a product by its SKU code.
 */
export function findProductBySku(catalog: readonly Product[], sku: string): Product | undefined {
  return catalog.find((product) => product.sku.toLowerCase() === sku.toLowerCase());
}

/**
 * Filters the catalog by category. Passing 'ALL' or empty string returns the full catalog.
 */
export function filterByCategory(
  catalog: readonly Product[],
  category: ProductCategory | 'ALL'
): Product[] {
  if (category === 'ALL') {
    return [...catalog];
  }
  return catalog.filter((product) => product.category === category);
}

/**
 * Searches and filters the product catalog.
 * Matches substring in product name, SKU, or description (case-insensitive).
 */
export function searchProducts(
  catalog: readonly Product[],
  query: string,
  category: ProductCategory | 'ALL' = 'ALL'
): Product[] {
  const normalizedQuery = query.trim().toLowerCase();
  const filteredByCategory = filterByCategory(catalog, category);

  if (!normalizedQuery) {
    return filteredByCategory;
  }

  return filteredByCategory.filter((product) => {
    return (
      product.name.toLowerCase().includes(normalizedQuery) ||
      product.sku.toLowerCase().includes(normalizedQuery) ||
      product.description.toLowerCase().includes(normalizedQuery)
    );
  });
}
