/**
 * Domain module: Catalog & Products (v3)
 *
 * Defines dynamic category and product structures, default inventory preserving
 * the 5 original legacy products alongside retro computing additions, and pure
 * search, filter, CRUD, and migration operations.
 */

import { type Cents, toCents } from './money';

export const DEFAULT_CATEGORY_ID = 'cat-default';

export interface Category {
  readonly id: string;
  readonly name: string;
  readonly slug?: string;
  readonly description: string;
  readonly isDefault?: boolean;
}

export const DEFAULT_CATEGORIES: readonly Category[] = [
  {
    id: DEFAULT_CATEGORY_ID,
    name: 'Ogólne',
    slug: 'ogolne',
    description: 'Domyślna kategoria dla produktów nieprzypisanych i migrowanych',
    isDefault: true,
  },
  {
    id: 'cat-elektronika',
    name: 'Elektronika',
    slug: 'elektronika',
    description: 'Sprzęt komputerowy, urządzenia audio i elektronika użytkowa',
  },
  {
    id: 'cat-odziez',
    name: 'Odziez',
    slug: 'odziez',
    description: 'Odzież retro i tekstylia dla programistów',
  },
  {
    id: 'cat-akcesoria',
    name: 'Akcesoria',
    slug: 'akcesoria',
    description: 'Akcesoria biurowe, torby, nośniki danych i peryferia',
  },
  {
    id: 'cat-edukacja',
    name: 'Edukacja',
    slug: 'edukacja',
    description: 'Podręczniki, literatura techniczna i materiały edukacyjne',
  },
  {
    id: 'cat-retro-hardware',
    name: 'Retro Hardware',
    slug: 'retro-hardware',
    description: 'Monitory CRT, klawiatury mechaniczne i zabytkowy sprzęt komputerowy',
  },
];

export type ProductCategory = string;

export interface Product {
  readonly id: string;
  readonly sku: string;
  readonly name: string;
  readonly priceCents: Cents;
  readonly categoryId: string;
  readonly category: ProductCategory;
  readonly description: string;
  readonly inStock: boolean;
  readonly stockQuantity: number;
}

/**
 * Default product catalog.
 * Preserves all 5 original items from legacy/products.py with exact price matching in grosze,
 * complemented by retro CRT/cyberdeck peripherals, linked to category IDs.
 */
export const DEFAULT_CATALOG: readonly Product[] = [
  // Original 5 legacy items:
  {
    id: 'prod-laptop',
    sku: 'HW-LAPTOP-01',
    name: 'Laptop',
    priceCents: toCents(349999), // 3499.99 PLN
    categoryId: 'cat-elektronika',
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
    categoryId: 'cat-elektronika',
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
    categoryId: 'cat-odziez',
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
    categoryId: 'cat-akcesoria',
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
    categoryId: 'cat-edukacja',
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
    categoryId: 'cat-retro-hardware',
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
    categoryId: 'cat-retro-hardware',
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
    categoryId: 'cat-akcesoria',
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
 * Generates a URL-friendly slug from a text string.
 */
export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

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
  if (category === 'ALL' || !category) {
    return [...catalog];
  }
  return catalog.filter((product) => product.category === category || product.categoryId === category);
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

// ---------------------------------------------------------------------------
// Category CRUD & Migration Functions
// ---------------------------------------------------------------------------

export interface AddCategoryInput {
  readonly name: string;
  readonly description?: string;
  readonly id?: string;
  readonly slug?: string;
  readonly isDefault?: boolean;
}

export function addCategoryToList(
  categories: readonly Category[],
  input: AddCategoryInput
): Category[] {
  const trimmedName = input.name.trim();
  if (trimmedName.length < 2 || trimmedName.length > 50) {
    throw new Error('Nazwa kategorii musi zawierać od 2 do 50 znaków.');
  }

  const isDuplicate = categories.some(
    (c) => c.name.toLowerCase() === trimmedName.toLowerCase()
  );
  if (isDuplicate) {
    throw new Error(`Kategoria o nazwie "${trimmedName}" już istnieje.`);
  }

  const id = input.id?.trim() || `cat-${slugify(trimmedName) || Date.now().toString(36)}`;
  if (categories.some((c) => c.id === id)) {
    throw new Error(`Kategoria o identyfikatorze "${id}" już istnieje.`);
  }

  const newCategory: Category = {
    id,
    name: trimmedName,
    slug: input.slug ?? slugify(trimmedName),
    description: input.description?.trim() ?? '',
    ...(input.isDefault ? { isDefault: true } : {}),
  };

  return [...categories, newCategory];
}

export const createCategory = addCategoryToList;

export interface UpdateCategoryPatch {
  readonly name?: string;
  readonly description?: string;
  readonly slug?: string;
}

export function updateCategoryInList(
  categories: readonly Category[],
  products: readonly Product[],
  categoryId: string,
  patch: UpdateCategoryPatch
): { categories: Category[]; products: Product[] } {
  const existing = categories.find((c) => c.id === categoryId);
  if (!existing) {
    throw new Error(`Kategoria o identyfikatorze "${categoryId}" nie istnieje.`);
  }

  let updatedName = existing.name;
  if (patch.name !== undefined) {
    const trimmed = patch.name.trim();
    if (trimmed.length < 2 || trimmed.length > 50) {
      throw new Error('Nazwa kategorii musi zawierać od 2 do 50 znaków.');
    }
    const duplicate = categories.some(
      (c) => c.id !== categoryId && c.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (duplicate) {
      throw new Error(`Kategoria o nazwie "${trimmed}" już istnieje.`);
    }
    updatedName = trimmed;
  }

  const updatedCategory: Category = {
    ...existing,
    name: updatedName,
    slug: patch.slug ?? (patch.name !== undefined ? slugify(updatedName) : existing.slug),
    description: patch.description !== undefined ? patch.description.trim() : existing.description,
  };

  const updatedCategories = categories.map((c) => (c.id === categoryId ? updatedCategory : c));

  const updatedProducts = products.map((p) => {
    if (p.categoryId === categoryId) {
      return {
        ...p,
        category: updatedName,
      };
    }
    return p;
  });

  return {
    categories: updatedCategories,
    products: updatedProducts,
  };
}

export const updateCategory = updateCategoryInList;

export function deleteCategoryFromList(
  categories: readonly Category[],
  products: readonly Product[],
  categoryId: string,
  targetCategoryId = DEFAULT_CATEGORY_ID
): { categories: Category[]; products: Product[] } {
  const categoryToDelete = categories.find((c) => c.id === categoryId);
  if (!categoryToDelete) {
    throw new Error(`Kategoria o identyfikatorze "${categoryId}" nie istnieje.`);
  }

  if (categoryToDelete.isDefault) {
    throw new Error('Nie można usunąć domyślnej kategorii systemowej.');
  }

  if (targetCategoryId === categoryId) {
    throw new Error('Kategoria docelowa migracji nie może być kategorią usuwaną.');
  }

  const targetCategory = categories.find((c) => c.id === targetCategoryId);
  if (!targetCategory) {
    throw new Error(
      `Docelowa kategoria migracji o identyfikatorze "${targetCategoryId}" nie istnieje.`
    );
  }

  const updatedCategories = categories.filter((c) => c.id !== categoryId);

  const updatedProducts = products.map((p) => {
    if (p.categoryId === categoryId) {
      return {
        ...p,
        categoryId: targetCategory.id,
        category: targetCategory.name,
      };
    }
    return p;
  });

  return {
    categories: updatedCategories,
    products: updatedProducts,
  };
}

export const deleteCategoryWithFallback = deleteCategoryFromList;

export interface MigrateProductsParams {
  readonly sourceCategoryId: string;
  readonly targetCategoryId: string;
  readonly productIds?: readonly string[];
}

export function migrateProductsBetweenCategories(
  products: readonly Product[],
  categories: readonly Category[],
  paramsOrSourceId: MigrateProductsParams | string,
  targetId?: string,
  productIds?: readonly string[]
): Product[] {
  let sourceCategoryId: string;
  let targetCategoryId: string;
  let idsToMigrate: readonly string[] | undefined;

  if (typeof paramsOrSourceId === 'string') {
    sourceCategoryId = paramsOrSourceId;
    targetCategoryId = targetId ?? '';
    idsToMigrate = productIds;
  } else {
    sourceCategoryId = paramsOrSourceId.sourceCategoryId;
    targetCategoryId = paramsOrSourceId.targetCategoryId;
    idsToMigrate = paramsOrSourceId.productIds;
  }

  const sourceCategory = categories.find((c) => c.id === sourceCategoryId);
  if (!sourceCategory) {
    throw new Error(`Kategoria źródłowa o identyfikatorze "${sourceCategoryId}" nie istnieje.`);
  }

  const targetCategory = categories.find((c) => c.id === targetCategoryId);
  if (!targetCategory) {
    throw new Error(`Kategoria docelowa o identyfikatorze "${targetCategoryId}" nie istnieje.`);
  }

  if (sourceCategoryId === targetCategoryId) {
    return [...products];
  }

  const idsSet = idsToMigrate ? new Set(idsToMigrate) : null;

  return products.map((p) => {
    if (p.categoryId === sourceCategoryId && (!idsSet || idsSet.has(p.id))) {
      return {
        ...p,
        categoryId: targetCategory.id,
        category: targetCategory.name,
      };
    }
    return p;
  });
}

// ---------------------------------------------------------------------------
// Product CRUD Functions
// ---------------------------------------------------------------------------

export interface AddProductInput {
  readonly id?: string;
  readonly sku: string;
  readonly name: string;
  readonly priceCents: Cents | number;
  readonly categoryId: string;
  readonly category?: string;
  readonly description?: string;
  readonly stockQuantity: number;
  readonly inStock?: boolean;
}

export function addProductToList(
  products: readonly Product[],
  categories: readonly Category[],
  input: AddProductInput
): Product[] {
  const trimmedSku = input.sku.trim();
  if (!trimmedSku) {
    throw new Error('Kod SKU produktu jest wymagany.');
  }

  const duplicateSku = products.some(
    (p) => p.sku.toLowerCase() === trimmedSku.toLowerCase()
  );
  if (duplicateSku) {
    throw new Error(`Produkt o kodzie SKU "${trimmedSku}" już istnieje.`);
  }

  const trimmedName = input.name.trim();
  if (!trimmedName) {
    throw new Error('Nazwa produktu jest wymagana.');
  }

  const targetCategory = categories.find((c) => c.id === input.categoryId);
  if (!targetCategory) {
    throw new Error(`Kategoria o identyfikatorze "${input.categoryId}" nie istnieje.`);
  }

  if (!Number.isSafeInteger(input.priceCents) || input.priceCents < 0) {
    throw new RangeError('Cena produktu w groszach musi być nieujemną liczbą całkowitą.');
  }

  if (!Number.isSafeInteger(input.stockQuantity) || input.stockQuantity < 0) {
    throw new RangeError('Ilość w magazynie musi być nieujemną liczbą całkowitą.');
  }

  const inStock = input.stockQuantity === 0 ? false : (input.inStock ?? true);

  const id = input.id?.trim() || `prod-${slugify(trimmedName) || Date.now().toString(36)}`;
  if (products.some((p) => p.id === id)) {
    throw new Error(`Produkt o identyfikatorze "${id}" już istnieje.`);
  }

  const newProduct: Product = {
    id,
    sku: trimmedSku,
    name: trimmedName,
    priceCents: toCents(input.priceCents),
    categoryId: targetCategory.id,
    category: input.category?.trim() || targetCategory.name,
    description: input.description?.trim() ?? '',
    inStock,
    stockQuantity: input.stockQuantity,
  };

  return [...products, newProduct];
}

export const createProduct = addProductToList;

export interface UpdateProductPatch {
  readonly sku?: string;
  readonly name?: string;
  readonly priceCents?: Cents | number;
  readonly categoryId?: string;
  readonly category?: string;
  readonly description?: string;
  readonly stockQuantity?: number;
  readonly inStock?: boolean;
}

export function updateProductInList(
  products: readonly Product[],
  categories: readonly Category[],
  productId: string,
  patch: UpdateProductPatch
): Product[] {
  const existing = products.find((p) => p.id === productId);
  if (!existing) {
    throw new Error(`Produkt o identyfikatorze "${productId}" nie istnieje.`);
  }

  let updatedSku = existing.sku;
  if (patch.sku !== undefined) {
    const trimmed = patch.sku.trim();
    if (!trimmed) {
      throw new Error('Kod SKU produktu nie może być pusty.');
    }
    const duplicate = products.some(
      (p) => p.id !== productId && p.sku.toLowerCase() === trimmed.toLowerCase()
    );
    if (duplicate) {
      throw new Error(`Produkt o kodzie SKU "${trimmed}" już istnieje.`);
    }
    updatedSku = trimmed;
  }

  let updatedName = existing.name;
  if (patch.name !== undefined) {
    const trimmed = patch.name.trim();
    if (!trimmed) {
      throw new Error('Nazwa produktu nie może być pusta.');
    }
    updatedName = trimmed;
  }

  let updatedCategoryId = existing.categoryId;
  let updatedCategoryName = existing.category;
  if (patch.categoryId !== undefined) {
    const cat = categories.find((c) => c.id === patch.categoryId);
    if (!cat) {
      throw new Error(`Kategoria o identyfikatorze "${patch.categoryId}" nie istnieje.`);
    }
    updatedCategoryId = cat.id;
    updatedCategoryName = patch.category?.trim() || cat.name;
  } else if (patch.category !== undefined) {
    updatedCategoryName = patch.category.trim();
  }

  let updatedPriceCents = existing.priceCents;
  if (patch.priceCents !== undefined) {
    if (!Number.isSafeInteger(patch.priceCents) || patch.priceCents < 0) {
      throw new RangeError('Cena produktu w groszach musi być nieujemną liczbą całkowitą.');
    }
    updatedPriceCents = toCents(patch.priceCents);
  }

  let updatedStockQuantity = existing.stockQuantity;
  if (patch.stockQuantity !== undefined) {
    if (!Number.isSafeInteger(patch.stockQuantity) || patch.stockQuantity < 0) {
      throw new RangeError('Ilość w magazynie musi być nieujemną liczbą całkowitą.');
    }
    updatedStockQuantity = patch.stockQuantity;
  }

  let updatedInStock = existing.inStock;
  if (updatedStockQuantity === 0) {
    updatedInStock = false;
  } else if (patch.inStock !== undefined) {
    updatedInStock = patch.inStock;
  }

  const updatedProduct: Product = {
    ...existing,
    sku: updatedSku,
    name: updatedName,
    priceCents: updatedPriceCents,
    categoryId: updatedCategoryId,
    category: updatedCategoryName,
    description: patch.description !== undefined ? patch.description.trim() : existing.description,
    stockQuantity: updatedStockQuantity,
    inStock: updatedInStock,
  };

  return products.map((p) => (p.id === productId ? updatedProduct : p));
}

export const updateProduct = updateProductInList;

export function deleteProductFromList(
  products: readonly Product[],
  productId: string
): Product[] {
  const existing = products.find((p) => p.id === productId);
  if (!existing) {
    throw new Error(`Produkt o identyfikatorze "${productId}" nie istnieje.`);
  }
  return products.filter((p) => p.id !== productId);
}

export const deleteProduct = deleteProductFromList;
