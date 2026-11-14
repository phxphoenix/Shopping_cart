import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CATEGORIES,
  DEFAULT_CATEGORY_ID,
  DEFAULT_CATALOG,
  ORIGINAL_PRODUCT_SKUS,
  addCategoryToList,
  addProductToList,
  createCategory,
  createProduct,
  deleteCategoryFromList,
  deleteCategoryWithFallback,
  deleteProduct,
  deleteProductFromList,
  filterByCategory,
  findProductById,
  findProductBySku,
  migrateProductsBetweenCategories,
  searchProducts,
  slugify,
  updateCategory,
  updateCategoryInList,
  updateProduct,
  updateProductInList,
} from '@/domain/catalog';
import { toCents } from '@/domain/money';

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

  describe('DEFAULT_CATEGORIES & DEFAULT_CATEGORY_ID', () => {
    it('contains the non-deletable default category and 5 standard categories', () => {
      expect(DEFAULT_CATEGORY_ID).toBe('cat-default');
      expect(DEFAULT_CATEGORIES.length).toBe(6);

      const defaultCat = DEFAULT_CATEGORIES.find((c) => c.id === DEFAULT_CATEGORY_ID);
      expect(defaultCat).toBeDefined();
      expect(defaultCat?.name).toBe('Ogólne');
      expect(defaultCat?.isDefault).toBe(true);

      const names = DEFAULT_CATEGORIES.map((c) => c.name);
      expect(names).toContain('Elektronika');
      expect(names).toContain('Odziez');
      expect(names).toContain('Akcesoria');
      expect(names).toContain('Edukacja');
      expect(names).toContain('Retro Hardware');
    });

    it('ensures all products in DEFAULT_CATALOG have a valid categoryId matching DEFAULT_CATEGORIES', () => {
      const validCategoryIds = new Set(DEFAULT_CATEGORIES.map((c) => c.id));
      for (const product of DEFAULT_CATALOG) {
        expect(product.categoryId).toBeDefined();
        expect(validCategoryIds.has(product.categoryId)).toBe(true);
      }
    });
  });

  describe('slugify', () => {
    it('generates normalized URL-safe slugs', () => {
      expect(slugify('Retro Hardware')).toBe('retro-hardware');
      expect(slugify('Książki & Podręczniki!')).toBe('ksiazki-podreczniki');
      expect(slugify('  Ogólne  ')).toBe('ogolne');
      expect(slugify('---test---')).toBe('test');
    });
  });

  describe('Category Management (CRUD & Validation)', () => {
    describe('addCategoryToList / createCategory', () => {
      it('adds a new category with generated id and slug', () => {
        const initial = [...DEFAULT_CATEGORIES];
        const updated = addCategoryToList(initial, {
          name: 'Cyberdecki',
          description: 'Samodzielnie budowane terminale przenośne',
        });

        expect(updated.length).toBe(initial.length + 1);
        const added = updated.find((c) => c.name === 'Cyberdecki');
        expect(added).toBeDefined();
        expect(added?.slug).toBe('cyberdecki');
        expect(added?.description).toBe('Samodzielnie budowane terminale przenośne');
        expect(added?.id).toBe('cat-cyberdecki');
      });

      it('accepts explicit id and slug', () => {
        const updated = createCategory(DEFAULT_CATEGORIES, {
          id: 'custom-cat-id',
          name: 'Audio Vintage',
          slug: 'vintage-audio',
          description: 'Odtwarzacze kasetowe i wzmacniacze lampowe',
        });

        const added = updated.find((c) => c.id === 'custom-cat-id');
        expect(added?.name).toBe('Audio Vintage');
        expect(added?.slug).toBe('vintage-audio');
      });

      it('rejects category names shorter than 2 or longer than 50 characters', () => {
        expect(() => addCategoryToList(DEFAULT_CATEGORIES, { name: 'A' })).toThrow(
          /od 2 do 50 znaków/
        );
        expect(() =>
          addCategoryToList(DEFAULT_CATEGORIES, { name: 'a'.repeat(51) })
        ).toThrow(/od 2 do 50 znaków/);
      });

      it('rejects duplicate category names case-insensitively', () => {
        expect(() =>
          addCategoryToList(DEFAULT_CATEGORIES, { name: 'elektronika' })
        ).toThrow(/już istnieje/);
        expect(() =>
          addCategoryToList(DEFAULT_CATEGORIES, { name: '  OGÓLNE  ' })
        ).toThrow(/już istnieje/);
      });

      it('rejects duplicate category IDs', () => {
        expect(() =>
          addCategoryToList(DEFAULT_CATEGORIES, {
            id: 'cat-elektronika',
            name: 'Nowa Elektronika',
          })
        ).toThrow(/identyfikatorze "cat-elektronika" już istnieje/);
      });
    });

    describe('updateCategoryInList / updateCategory', () => {
      it('updates category name and description, synchronizing product category names', () => {
        const categories = [...DEFAULT_CATEGORIES];
        const products = [...DEFAULT_CATALOG];

        const { categories: nextCats, products: nextProds } = updateCategoryInList(
          categories,
          products,
          'cat-elektronika',
          {
            name: 'Elektronika Cyfrowa',
            description: 'Zaktualizowany opis kategorii elektroniki',
          }
        );

        const updatedCat = nextCats.find((c) => c.id === 'cat-elektronika');
        expect(updatedCat?.name).toBe('Elektronika Cyfrowa');
        expect(updatedCat?.description).toBe('Zaktualizowany opis kategorii elektroniki');

        const affectedProducts = nextProds.filter((p) => p.categoryId === 'cat-elektronika');
        expect(affectedProducts.length).toBeGreaterThan(0);
        expect(affectedProducts.every((p) => p.category === 'Elektronika Cyfrowa')).toBe(true);
      });

      it('allows updating description without changing name', () => {
        const { categories: nextCats } = updateCategory(
          DEFAULT_CATEGORIES,
          DEFAULT_CATALOG,
          'cat-odziez',
          { description: 'Nowy opis' }
        );

        const updatedCat = nextCats.find((c) => c.id === 'cat-odziez');
        expect(updatedCat?.name).toBe('Odziez');
        expect(updatedCat?.description).toBe('Nowy opis');
      });

      it('throws if categoryId is not found', () => {
        expect(() =>
          updateCategoryInList(DEFAULT_CATEGORIES, DEFAULT_CATALOG, 'non-existent', {
            name: 'Nowa Nazwa',
          })
        ).toThrow(/nie istnieje/);
      });

      it('rejects duplicate name when updated to match another category', () => {
        expect(() =>
          updateCategoryInList(DEFAULT_CATEGORIES, DEFAULT_CATALOG, 'cat-odziez', {
            name: 'Elektronika',
          })
        ).toThrow(/już istnieje/);
      });

      it('validates name length on update', () => {
        expect(() =>
          updateCategoryInList(DEFAULT_CATEGORIES, DEFAULT_CATALOG, 'cat-odziez', {
            name: 'X',
          })
        ).toThrow(/od 2 do 50 znaków/);
      });
    });

    describe('deleteCategoryFromList / deleteCategoryWithFallback', () => {
      it('prevents deletion of the system default category', () => {
        expect(() =>
          deleteCategoryFromList(DEFAULT_CATEGORIES, DEFAULT_CATALOG, DEFAULT_CATEGORY_ID)
        ).toThrow(/Nie można usunąć domyślnej kategorii systemowej/);
      });

      it('throws if targetCategoryId is the category being deleted', () => {
        expect(() =>
          deleteCategoryFromList(
            DEFAULT_CATEGORIES,
            DEFAULT_CATALOG,
            'cat-elektronika',
            'cat-elektronika'
          )
        ).toThrow(/nie może być kategorią usuwaną/);
      });

      it('throws if category to delete does not exist', () => {
        expect(() =>
          deleteCategoryFromList(DEFAULT_CATEGORIES, DEFAULT_CATALOG, 'missing-cat')
        ).toThrow(/nie istnieje/);
      });

      it('throws if target category does not exist', () => {
        expect(() =>
          deleteCategoryFromList(
            DEFAULT_CATEGORIES,
            DEFAULT_CATALOG,
            'cat-elektronika',
            'invalid-target'
          )
        ).toThrow(/Docelowa kategoria migracji/);
      });

      it('deletes category and automatically moves products to DEFAULT_CATEGORY_ID by default', () => {
        const { categories: nextCats, products: nextProds } = deleteCategoryFromList(
          DEFAULT_CATEGORIES,
          DEFAULT_CATALOG,
          'cat-elektronika'
        );

        expect(nextCats.some((c) => c.id === 'cat-elektronika')).toBe(false);

        // Products originally in Elektronika should now be in 'cat-default' ('Ogólne')
        const movedLaptop = nextProds.find((p) => p.id === 'prod-laptop');
        expect(movedLaptop?.categoryId).toBe(DEFAULT_CATEGORY_ID);
        expect(movedLaptop?.category).toBe('Ogólne');

        const movedHeadphones = nextProds.find((p) => p.id === 'prod-sluchawki');
        expect(movedHeadphones?.categoryId).toBe(DEFAULT_CATEGORY_ID);
        expect(movedHeadphones?.category).toBe('Ogólne');
      });

      it('deletes category and moves products to explicitly specified target category', () => {
        const { categories: nextCats, products: nextProds } = deleteCategoryWithFallback(
          DEFAULT_CATEGORIES,
          DEFAULT_CATALOG,
          'cat-retro-hardware',
          'cat-akcesoria'
        );

        expect(nextCats.some((c) => c.id === 'cat-retro-hardware')).toBe(false);

        const movedMonitor = nextProds.find((p) => p.id === 'prod-crt-monitor');
        expect(movedMonitor?.categoryId).toBe('cat-akcesoria');
        expect(movedMonitor?.category).toBe('Akcesoria');
      });
    });
  });

  describe('migrateProductsBetweenCategories', () => {
    it('migrates all products from source to target category using object parameter', () => {
      const migrated = migrateProductsBetweenCategories(DEFAULT_CATALOG, DEFAULT_CATEGORIES, {
        sourceCategoryId: 'cat-edukacja',
        targetCategoryId: 'cat-akcesoria',
      });

      const book = migrated.find((p) => p.id === 'prod-ksiazka-python');
      expect(book?.categoryId).toBe('cat-akcesoria');
      expect(book?.category).toBe('Akcesoria');
    });

    it('migrates specific productIds only when provided', () => {
      const migrated = migrateProductsBetweenCategories(DEFAULT_CATALOG, DEFAULT_CATEGORIES, {
        sourceCategoryId: 'cat-elektronika',
        targetCategoryId: 'cat-retro-hardware',
        productIds: ['prod-laptop'],
      });

      const laptop = migrated.find((p) => p.id === 'prod-laptop');
      expect(laptop?.categoryId).toBe('cat-retro-hardware');
      expect(laptop?.category).toBe('Retro Hardware');

      // Słuchawki should remain in Elektronika
      const headphones = migrated.find((p) => p.id === 'prod-sluchawki');
      expect(headphones?.categoryId).toBe('cat-elektronika');
      expect(headphones?.category).toBe('Elektronika');
    });

    it('supports positional parameters style', () => {
      const migrated = migrateProductsBetweenCategories(
        DEFAULT_CATALOG,
        DEFAULT_CATEGORIES,
        'cat-odziez',
        'cat-akcesoria'
      );

      const tshirt = migrated.find((p) => p.id === 'prod-koszulka');
      expect(tshirt?.categoryId).toBe('cat-akcesoria');
      expect(tshirt?.category).toBe('Akcesoria');
    });

    it('returns unchanged copy if source and target categories are the same', () => {
      const result = migrateProductsBetweenCategories(DEFAULT_CATALOG, DEFAULT_CATEGORIES, {
        sourceCategoryId: 'cat-elektronika',
        targetCategoryId: 'cat-elektronika',
      });
      expect(result).toEqual(DEFAULT_CATALOG);
    });

    it('throws if source category does not exist', () => {
      expect(() =>
        migrateProductsBetweenCategories(DEFAULT_CATALOG, DEFAULT_CATEGORIES, {
          sourceCategoryId: 'unknown-src',
          targetCategoryId: 'cat-akcesoria',
        })
      ).toThrow(/Kategoria źródłowa/);
    });

    it('throws if target category does not exist', () => {
      expect(() =>
        migrateProductsBetweenCategories(DEFAULT_CATALOG, DEFAULT_CATEGORIES, {
          sourceCategoryId: 'cat-elektronika',
          targetCategoryId: 'unknown-target',
        })
      ).toThrow(/Kategoria docelowa/);
    });
  });

  describe('Product Management (CRUD & Stock Invariants)', () => {
    describe('addProductToList / createProduct', () => {
      it('adds a valid new product and resolves category name', () => {
        const added = addProductToList(DEFAULT_CATALOG, DEFAULT_CATEGORIES, {
          sku: 'NW-NEW-01',
          name: 'Nowy Produkt',
          priceCents: 12345,
          categoryId: 'cat-retro-hardware',
          description: 'Opis nowego produktu',
          stockQuantity: 10,
        });

        expect(added.length).toBe(DEFAULT_CATALOG.length + 1);
        const prod = added.find((p) => p.sku === 'NW-NEW-01');
        expect(prod).toBeDefined();
        expect(prod?.category).toBe('Retro Hardware');
        expect(prod?.priceCents).toBe(12345);
        expect(prod?.inStock).toBe(true);
      });

      it('automatically sets inStock to false when stockQuantity is 0', () => {
        const added = createProduct(DEFAULT_CATALOG, DEFAULT_CATEGORIES, {
          sku: 'OUT-OF-STOCK-01',
          name: 'Niedostępny Produkt',
          priceCents: 5000,
          categoryId: 'cat-akcesoria',
          stockQuantity: 0,
          inStock: true, // explicit true should be overridden to false
        });

        const prod = added.find((p) => p.sku === 'OUT-OF-STOCK-01');
        expect(prod?.inStock).toBe(false);
      });

      it('rejects duplicate SKU case-insensitively', () => {
        expect(() =>
          addProductToList(DEFAULT_CATALOG, DEFAULT_CATEGORIES, {
            sku: 'hw-laptop-01',
            name: 'Inny Laptop',
            priceCents: 1000,
            categoryId: 'cat-elektronika',
            stockQuantity: 5,
          })
        ).toThrow(/już istnieje/);
      });

      it('rejects empty SKU or empty name', () => {
        expect(() =>
          addProductToList(DEFAULT_CATALOG, DEFAULT_CATEGORIES, {
            sku: '',
            name: 'Produkt',
            priceCents: 1000,
            categoryId: 'cat-elektronika',
            stockQuantity: 5,
          })
        ).toThrow(/Kod SKU/);

        expect(() =>
          addProductToList(DEFAULT_CATALOG, DEFAULT_CATEGORIES, {
            sku: 'VALID-SKU',
            name: '   ',
            priceCents: 1000,
            categoryId: 'cat-elektronika',
            stockQuantity: 5,
          })
        ).toThrow(/Nazwa produktu/);
      });

      it('rejects non-existent categoryId', () => {
        expect(() =>
          addProductToList(DEFAULT_CATALOG, DEFAULT_CATEGORIES, {
            sku: 'VAL-SKU-1',
            name: 'Test',
            priceCents: 1000,
            categoryId: 'missing-category',
            stockQuantity: 5,
          })
        ).toThrow(/nie istnieje/);
      });

      it('rejects negative or non-integer price or stockQuantity', () => {
        expect(() =>
          addProductToList(DEFAULT_CATALOG, DEFAULT_CATEGORIES, {
            sku: 'VAL-1',
            name: 'Test',
            priceCents: -100,
            categoryId: 'cat-elektronika',
            stockQuantity: 5,
          })
        ).toThrow(RangeError);

        expect(() =>
          addProductToList(DEFAULT_CATALOG, DEFAULT_CATEGORIES, {
            sku: 'VAL-2',
            name: 'Test',
            priceCents: 1000,
            categoryId: 'cat-elektronika',
            stockQuantity: -1,
          })
        ).toThrow(RangeError);
      });

      it('rejects duplicate ID if explicitly passed', () => {
        expect(() =>
          addProductToList(DEFAULT_CATALOG, DEFAULT_CATEGORIES, {
            id: 'prod-laptop',
            sku: 'UNIQUE-SKU-99',
            name: 'Test',
            priceCents: 1000,
            categoryId: 'cat-elektronika',
            stockQuantity: 5,
          })
        ).toThrow(/identyfikatorze "prod-laptop" już istnieje/);
      });
    });

    describe('updateProductInList / updateProduct', () => {
      it('updates product fields and synchronizes category name when categoryId changes', () => {
        const updated = updateProductInList(
          DEFAULT_CATALOG,
          DEFAULT_CATEGORIES,
          'prod-laptop',
          {
            name: 'Laptop Retro Pro',
            categoryId: 'cat-retro-hardware',
            priceCents: toCents(399999),
            stockQuantity: 7,
          }
        );

        const prod = updated.find((p) => p.id === 'prod-laptop');
        expect(prod?.name).toBe('Laptop Retro Pro');
        expect(prod?.categoryId).toBe('cat-retro-hardware');
        expect(prod?.category).toBe('Retro Hardware');
        expect(prod?.priceCents).toBe(399999);
        expect(prod?.stockQuantity).toBe(7);
      });

      it('automatically sets inStock: false when updated stockQuantity reaches 0', () => {
        const updated = updateProduct(
          DEFAULT_CATALOG,
          DEFAULT_CATEGORIES,
          'prod-laptop',
          { stockQuantity: 0 }
        );

        const prod = updated.find((p) => p.id === 'prod-laptop');
        expect(prod?.stockQuantity).toBe(0);
        expect(prod?.inStock).toBe(false);
      });

      it('allows manually setting inStock: false while stock is positive', () => {
        const updated = updateProduct(
          DEFAULT_CATALOG,
          DEFAULT_CATEGORIES,
          'prod-laptop',
          { inStock: false }
        );

        const prod = updated.find((p) => p.id === 'prod-laptop');
        expect(prod?.inStock).toBe(false);
      });

      it('throws if productId does not exist', () => {
        expect(() =>
          updateProductInList(DEFAULT_CATALOG, DEFAULT_CATEGORIES, 'non-existent', {
            name: 'A',
          })
        ).toThrow(/nie istnieje/);
      });

      it('rejects empty name on update', () => {
        expect(() =>
          updateProductInList(DEFAULT_CATALOG, DEFAULT_CATEGORIES, 'prod-laptop', {
            name: '   ',
          })
        ).toThrow(/nie może być pusta/);
      });

      it('allows updating custom category string directly', () => {
        const updated = updateProductInList(
          DEFAULT_CATALOG,
          DEFAULT_CATEGORIES,
          'prod-laptop',
          { category: 'Hardware Przenośny' }
        );
        const prod = updated.find((p) => p.id === 'prod-laptop');
        expect(prod?.category).toBe('Hardware Przenośny');
      });

      it('rejects duplicate SKU when modifying SKU', () => {
        expect(() =>
          updateProductInList(DEFAULT_CATALOG, DEFAULT_CATEGORIES, 'prod-laptop', {
            sku: 'AU-PHONE-02',
          })
        ).toThrow(/już istnieje/);
      });

      it('rejects invalid categoryId on update', () => {
        expect(() =>
          updateProductInList(DEFAULT_CATALOG, DEFAULT_CATEGORIES, 'prod-laptop', {
            categoryId: 'bad-cat',
          })
        ).toThrow(/nie istnieje/);
      });

      it('rejects negative price or stock quantity on update', () => {
        expect(() =>
          updateProductInList(DEFAULT_CATALOG, DEFAULT_CATEGORIES, 'prod-laptop', {
            priceCents: -50,
          })
        ).toThrow(RangeError);

        expect(() =>
          updateProductInList(DEFAULT_CATALOG, DEFAULT_CATEGORIES, 'prod-laptop', {
            stockQuantity: -2,
          })
        ).toThrow(RangeError);
      });
    });

    describe('deleteProductFromList / deleteProduct', () => {
      it('removes product from catalog', () => {
        const updated = deleteProductFromList(DEFAULT_CATALOG, 'prod-laptop');
        expect(updated.length).toBe(DEFAULT_CATALOG.length - 1);
        expect(updated.some((p) => p.id === 'prod-laptop')).toBe(false);
      });

      it('throws error when attempting to delete non-existent product', () => {
        expect(() => deleteProduct(DEFAULT_CATALOG, 'unknown-prod')).toThrow(/nie istnieje/);
      });
    });
  });
});
