import { useState, type FormEvent, useId } from 'react';
import { DEFAULT_CATEGORY_ID, type Category, type Product } from '@/domain/catalog';
import { formatPLN, parsePlnInputToCents } from '@/domain/money';
import { useShopStore } from '@/store/useShopStore';

export type AdminTab = 'categories' | 'products' | 'migration' | 'customers';

export function AdminPanel() {
  const {
    categories,
    catalog,
    customers,
    orders,
    setActiveView,
    logoutAdmin,
    addCategory,
    updateCategory,
    removeCategory,
    migrateCategoryProducts,
    addProductToCatalog,
    updateProductInCatalog,
    removeProductFromCatalog,
    removeCustomer,
    setStatus,
  } = useShopStore();

  const [activeTab, setActiveTab] = useState<AdminTab>('categories');

  // ---------------------------------------------------------------------------
  // Tab 1: KATEGORIE state
  // ---------------------------------------------------------------------------
  const [newCatName, setNewCatName] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');
  const [catError, setCatError] = useState<string | null>(null);
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editCatName, setEditCatName] = useState('');
  const [editCatDesc, setEditCatDesc] = useState('');
  const [deletingCatId, setDeletingCatId] = useState<string | null>(null);
  const [deleteTargetCatId, setDeleteTargetCatId] = useState<string>(DEFAULT_CATEGORY_ID);

  // ---------------------------------------------------------------------------
  // Tab 2: PRODUKTY state
  // ---------------------------------------------------------------------------
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [prodSku, setProdSku] = useState('');
  const [prodName, setProdName] = useState('');
  const [prodCatId, setProdCatId] = useState(categories[0]?.id ?? DEFAULT_CATEGORY_ID);
  const [prodPrice, setProdPrice] = useState('');
  const [prodStock, setProdStock] = useState('10');
  const [prodInStock, setProdInStock] = useState(true);
  const [prodDesc, setProdDesc] = useState('');
  const [prodError, setProdError] = useState<string | null>(null);
  const [prodSearch, setProdSearch] = useState('');
  const [prodFilterCat, setProdFilterCat] = useState('ALL');

  // ---------------------------------------------------------------------------
  // Tab 3: MIGRACJA PRODUKTÓW state
  // ---------------------------------------------------------------------------
  const [migrateSourceCatId, setMigrateSourceCatId] = useState<string>(() => {
    // Pick the first non-empty category or first category
    const nonDefault = categories.find((c) => !c.isDefault);
    return nonDefault?.id ?? categories[0]?.id ?? DEFAULT_CATEGORY_ID;
  });
  const [migrateTargetCatId, setMigrateTargetCatId] = useState<string>(() => {
    const target = categories.find((c) => c.isDefault) ?? categories[1];
    return target?.id ?? DEFAULT_CATEGORY_ID;
  });
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(() => {
    const initialSource = categories.find((c) => !c.isDefault)?.id ?? categories[0]?.id ?? '';
    const prods = catalog.filter((p) => p.categoryId === initialSource);
    return new Set(prods.map((p) => p.id));
  });
  const [migrationStatus, setMigrationStatus] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Tab 4: KLIENCI state
  // ---------------------------------------------------------------------------
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerToDelete, setCustomerToDelete] = useState<string | null>(null);

  const baseId = useId();

  // ===========================================================================
  // Tab 1 Handlers: Categories
  // ===========================================================================
  const handleAddCategory = async (e: FormEvent) => {
    e.preventDefault();
    setCatError(null);

    const name = newCatName.trim();
    if (name.length < 2 || name.length > 50) {
      setCatError('Nazwa kategorii musi zawierać od 2 do 50 znaków.');
      return;
    }

    try {
      await addCategory({ name, description: newCatDesc.trim() });
      setNewCatName('');
      setNewCatDesc('');
      setCatError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setCatError(msg);
    }
  };

  const startEditCategory = (cat: Category) => {
    setEditingCatId(cat.id);
    setEditCatName(cat.name);
    setEditCatDesc(cat.description);
    setCatError(null);
  };

  const handleUpdateCategory = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingCatId) return;
    setCatError(null);

    const name = editCatName.trim();
    if (name.length < 2 || name.length > 50) {
      setCatError('Nazwa kategorii musi zawierać od 2 do 50 znaków.');
      return;
    }

    try {
      await updateCategory(editingCatId, { name, description: editCatDesc.trim() });
      setEditingCatId(null);
      setCatError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setCatError(msg);
    }
  };

  const handleConfirmDeleteCategory = async (catId: string) => {
    setCatError(null);
    try {
      await removeCategory(catId, deleteTargetCatId);
      setDeletingCatId(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setCatError(msg);
    }
  };

  // ===========================================================================
  // Tab 2 Handlers: Products
  // ===========================================================================
  const resetProductForm = () => {
    setEditingProductId(null);
    setProdSku('');
    setProdName('');
    setProdCatId(categories[0]?.id ?? DEFAULT_CATEGORY_ID);
    setProdPrice('');
    setProdStock('10');
    setProdInStock(true);
    setProdDesc('');
    setProdError(null);
  };

  const startEditProduct = (prod: Product) => {
    setEditingProductId(prod.id);
    setProdSku(prod.sku);
    setProdName(prod.name);
    setProdCatId(prod.categoryId);
    setProdPrice((prod.priceCents / 100).toFixed(2));
    setProdStock(String(prod.stockQuantity));
    setProdInStock(prod.inStock);
    setProdDesc(prod.description);
    setProdError(null);
  };

  const handleProductSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setProdError(null);

    const sku = prodSku.trim();
    const name = prodName.trim();
    const stockQuantity = parseInt(prodStock, 10);

    if (!sku) {
      setProdError('SKU produktu jest wymagane.');
      return;
    }
    if (!name) {
      setProdError('Nazwa produktu jest wymagana.');
      return;
    }
    if (isNaN(stockQuantity) || stockQuantity < 0) {
      setProdError('Stan magazynowy musi być nieujemną liczbą całkowitą.');
      return;
    }

    let priceCents;
    try {
      priceCents = parsePlnInputToCents(prodPrice);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Nieprawidłowy format ceny.';
      setProdError(msg);
      return;
    }

    const cat = categories.find((c) => c.id === prodCatId);
    const categoryName = cat ? cat.name : 'Ogólne';

    try {
      if (editingProductId) {
        await updateProductInCatalog(editingProductId, {
          sku,
          name,
          categoryId: prodCatId,
          category: categoryName,
          priceCents,
          stockQuantity,
          inStock: prodInStock && stockQuantity > 0,
          description: prodDesc.trim(),
        });
      } else {
        await addProductToCatalog({
          sku,
          name,
          categoryId: prodCatId,
          category: categoryName,
          priceCents,
          stockQuantity,
          inStock: prodInStock && stockQuantity > 0,
          description: prodDesc.trim(),
        });
      }
      resetProductForm();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setProdError(msg);
    }
  };

  const handleDeleteProduct = async (product: Product) => {
    try {
      await removeProductFromCatalog(product.id);
      if (editingProductId === product.id) {
        resetProductForm();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setProdError(msg);
    }
  };

  // Filter products for Tab 2
  const filteredCatalog = catalog.filter((p) => {
    const matchesCat =
      prodFilterCat === 'ALL' || p.categoryId === prodFilterCat || p.category === prodFilterCat;
    const q = prodSearch.trim().toLowerCase();
    const matchesSearch =
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q);
    return matchesCat && matchesSearch;
  });

  // ===========================================================================
  // Tab 3 Handlers: Migration
  // ===========================================================================
  const sourceProducts = catalog.filter(
    (p) =>
      p.categoryId === migrateSourceCatId ||
      p.category === categories.find((c) => c.id === migrateSourceCatId)?.name
  );

  const handleSourceCatChange = (newSourceId: string) => {
    setMigrateSourceCatId(newSourceId);
    const prods = catalog.filter((p) => p.categoryId === newSourceId);
    setSelectedProductIds(new Set(prods.map((p) => p.id)));
    setMigrationStatus(null);
  };

  const handleSelectAllMigration = () => {
    setSelectedProductIds(new Set(sourceProducts.map((p) => p.id)));
  };

  const handleDeselectAllMigration = () => {
    setSelectedProductIds(new Set());
  };

  const toggleMigrationProduct = (id: string) => {
    setSelectedProductIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleExecuteMigration = async () => {
    if (selectedProductIds.size === 0) return;
    if (migrateSourceCatId === migrateTargetCatId) {
      setMigrationStatus('BŁĄD: Kategoria źródłowa i docelowa muszą być różne.');
      return;
    }

    try {
      await migrateCategoryProducts({
        sourceCategoryId: migrateSourceCatId,
        targetCategoryId: migrateTargetCatId,
        productIds: Array.from(selectedProductIds),
      });

      const count = selectedProductIds.size;
      const targetCat = categories.find((c) => c.id === migrateTargetCatId);
      setMigrationStatus(
        `SUKCES: Pomyślnie przeniesiono ${count} produktów do kategorii "${targetCat?.name ?? migrateTargetCatId}".`
      );

      // Refresh selection for remaining products in source category
      const remaining = catalog.filter(
        (p) => p.categoryId === migrateSourceCatId && !selectedProductIds.has(p.id)
      );
      setSelectedProductIds(new Set(remaining.map((p) => p.id)));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setMigrationStatus(`BŁĄD MIGRACJI: ${msg}`);
    }
  };

  // ===========================================================================
  // Tab 4 Handlers: Customers
  // ===========================================================================
  const filteredCustomers = customers.filter((c) => {
    const q = customerSearch.trim().toLowerCase();
    if (!q) return true;
    return c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q);
  });

  const getCustomerOrderCount = (customerId: string, email: string) => {
    const normEmail = email.trim().toLowerCase();
    return orders.filter(
      (o) => o.customer.id === customerId || o.customer.email.trim().toLowerCase() === normEmail
    ).length;
  };

  const handleDeleteCustomer = async (customerId: string) => {
    try {
      await removeCustomer(customerId);
      setCustomerToDelete(null);
      setStatus('KLIENT ZOSTAŁ USUNIĘTY Z BAZY SYSTEMOWEJ', 'info');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatus(`BŁĄD USUWANIA KLIENTA: ${msg}`, 'error');
    }
  };

  return (
    <section className="retro-panel" aria-labelledby="admin-panel-title">
      {/* Nagłówek Panelu Admina */}
      <div className="panel-header" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.5rem',
            minWidth: 0,
          }}
        >
          <h2
            id="admin-panel-title"
            className="panel-title"
            style={{ color: 'var(--text-bright)' }}
          >
            // SEKCJA ADMINISTRACYJNA // TRYB UPRAWNIONY
          </h2>
          <span className="badge badge-accent">[ADMIN ROOT]</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={() => setActiveView('shop')}
            title="Powróć do głównego widoku zakupowego"
          >
            [&lt;- POWRÓT DO SKLEPU]
          </button>
          <button
            type="button"
            onClick={() => void logoutAdmin()}
            className="btn-danger"
            title="Zakończ sesję administratora"
          >
            [WYLOGUJ ADMINA]
          </button>
        </div>
      </div>

      {/* Nawigacja Zakładkowa */}
      <div role="tablist" aria-label="Zakładki Sekcji Administracyjnej" className="admin-tablist">
        <button
          id={`${baseId}-tab-categories`}
          role="tab"
          type="button"
          aria-selected={activeTab === 'categories'}
          aria-controls={`${baseId}-panel-categories`}
          className={`admin-tab-btn ${activeTab === 'categories' ? 'btn-active' : ''}`}
          onClick={() => setActiveTab('categories')}
        >
          {activeTab === 'categories' ? '&gt; [1] KATEGORIE' : '[1] KATEGORIE'} ({categories.length}
          )
        </button>

        <button
          id={`${baseId}-tab-products`}
          role="tab"
          type="button"
          aria-selected={activeTab === 'products'}
          aria-controls={`${baseId}-panel-products`}
          className={`admin-tab-btn ${activeTab === 'products' ? 'btn-active' : ''}`}
          onClick={() => setActiveTab('products')}
        >
          {activeTab === 'products' ? '&gt; [2] PRODUKTY' : '[2] PRODUKTY'} ({catalog.length})
        </button>

        <button
          id={`${baseId}-tab-migration`}
          role="tab"
          type="button"
          aria-selected={activeTab === 'migration'}
          aria-controls={`${baseId}-panel-migration`}
          className={`admin-tab-btn ${activeTab === 'migration' ? 'btn-active' : ''}`}
          onClick={() => setActiveTab('migration')}
        >
          {activeTab === 'migration' ? '&gt; [3] MIGRACJA PRODUKTÓW' : '[3] MIGRACJA PRODUKTÓW'}
        </button>

        <button
          id={`${baseId}-tab-customers`}
          role="tab"
          type="button"
          aria-selected={activeTab === 'customers'}
          aria-controls={`${baseId}-panel-customers`}
          className={`admin-tab-btn ${activeTab === 'customers' ? 'btn-active' : ''}`}
          onClick={() => setActiveTab('customers')}
        >
          {activeTab === 'customers' ? '&gt; [4] KLIENCI' : '[4] KLIENCI'} ({customers.length})
        </button>
      </div>

      {/* ===================================================================== */}
      {/* ZAKŁADKA 1: KATEGORIE                                                 */}
      {/* ===================================================================== */}
      {activeTab === 'categories' && (
        <div
          id={`${baseId}-panel-categories`}
          role="tabpanel"
          aria-labelledby={`${baseId}-tab-categories`}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.25rem' }}>
            {/* Formularz dodawania / edycji kategorii */}
            <form
              onSubmit={editingCatId ? handleUpdateCategory : handleAddCategory}
              noValidate
              style={{
                border: '1px solid var(--border-dim)',
                backgroundColor: 'var(--bg-main)',
                padding: '1rem',
              }}
              aria-label={editingCatId ? 'Edycja kategorii' : 'Dodawanie nowej kategorii'}
            >
              <div
                style={{
                  fontWeight: 'bold',
                  marginBottom: '0.75rem',
                  color: 'var(--text-bright)',
                }}
              >
                {editingCatId ? '// EDYCJA KATEGORII' : '// + NOWA KATEGORIA KATALOGU'}
              </div>

              <div className="form-group">
                <label htmlFor="cat-name-input" className="form-label">
                  Nazwa kategorii (2-50 znaków):
                </label>
                <input
                  id="cat-name-input"
                  type="text"
                  value={editingCatId ? editCatName : newCatName}
                  onChange={(e) => {
                    if (editingCatId) setEditCatName(e.target.value);
                    else setNewCatName(e.target.value);
                    if (catError) setCatError(null);
                  }}
                  placeholder="np. Retro Peryferia"
                  style={{ width: '100%' }}
                />
              </div>

              <div className="form-group">
                <label htmlFor="cat-desc-input" className="form-label">
                  Opis kategorii:
                </label>
                <input
                  id="cat-desc-input"
                  type="text"
                  value={editingCatId ? editCatDesc : newCatDesc}
                  onChange={(e) => {
                    if (editingCatId) setEditCatDesc(e.target.value);
                    else setNewCatDesc(e.target.value);
                  }}
                  placeholder="Krótki opis asortymentu w kategorii..."
                  style={{ width: '100%' }}
                />
              </div>

              {catError && (
                <div
                  role="alert"
                  className="form-error"
                  style={{
                    padding: '0.4rem 0.6rem',
                    backgroundColor: 'var(--error-bg)',
                    border: '1px solid var(--border-error)',
                    marginBottom: '0.75rem',
                  }}
                >
                  ! BŁĄD: {catError}
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="submit" className="btn-primary">
                  {editingCatId ? 'ZAPISZ ZMIANY' : '+ DODAJ KATEGORIĘ'}
                </button>
                {editingCatId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingCatId(null);
                      setCatError(null);
                    }}
                  >
                    ANULUJ
                  </button>
                )}
              </div>
            </form>

            {/* Lista Kategorii */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              <div style={{ fontWeight: 'bold', color: 'var(--text-bright)' }}>
                // ZAREJESTROWANE KATEGORIE ({categories.length})
              </div>

              {categories.map((cat) => {
                const assignedCount = catalog.filter(
                  (p) => p.categoryId === cat.id || p.category === cat.name
                ).length;
                const isDeleting = deletingCatId === cat.id;

                return (
                  <div
                    key={cat.id}
                    style={{
                      border: '1px solid var(--border-dim)',
                      backgroundColor: 'var(--bg-main)',
                      padding: '0.75rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'baseline',
                        flexWrap: 'wrap',
                        gap: '0.5rem',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: '0.45rem',
                          minWidth: 0,
                        }}
                      >
                        <strong style={{ color: 'var(--text-bright)', overflowWrap: 'anywhere' }}>
                          {cat.name}
                        </strong>
                        {cat.isDefault && <span className="badge badge-accent">[DOMYŚLNA]</span>}
                        <span className="badge badge-warning">ID: {cat.id}</span>
                        <span
                          style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}
                        >
                          ({assignedCount} {assignedCount === 1 ? 'produkt' : 'produktów'})
                        </span>
                      </div>

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                        <button
                          type="button"
                          onClick={() => startEditCategory(cat)}
                          aria-label={`Edytuj kategorię ${cat.name}`}
                          style={{ padding: '0.2rem 0.5rem', fontSize: 'var(--font-size-xs)' }}
                        >
                          EDYTUJ
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingCatId(cat.id)}
                          disabled={Boolean(cat.isDefault)}
                          className="btn-danger"
                          aria-label={`Usuń kategorię ${cat.name}`}
                          title={
                            cat.isDefault
                              ? 'Nie można usunąć domyślnej kategorii systemowej'
                              : `Usuń kategorię ${cat.name} (produkty zostaną przeniesione)`
                          }
                          style={{ padding: '0.2rem 0.5rem', fontSize: 'var(--font-size-xs)' }}
                        >
                          USUŃ
                        </button>
                      </div>
                    </div>

                    {cat.description && (
                      <p
                        style={{
                          fontSize: 'var(--font-size-xs)',
                          color: 'var(--text-muted)',
                          margin: 0,
                        }}
                      >
                        {cat.description}
                      </p>
                    )}

                    {/* Potwierdzenie usunięcia z wyborem kategorii docelowej */}
                    {isDeleting && (
                      <div
                        style={{
                          border: '1px solid var(--border-warning)',
                          backgroundColor: 'var(--warning-bg)',
                          padding: '0.65rem',
                          marginTop: '0.35rem',
                        }}
                        role="group"
                        aria-label={`Potwierdzenie usunięcia kategorii ${cat.name}`}
                      >
                        <div
                          style={{
                            fontSize: 'var(--font-size-xs)',
                            color: 'var(--warning)',
                            marginBottom: '0.5rem',
                          }}
                        >
                          ! UWAGA: Przypisane produkty ({assignedCount}) zostaną automatycznie
                          przeniesione do wybranej kategorii docelowej:
                        </div>

                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            flexWrap: 'wrap',
                          }}
                        >
                          <label htmlFor={`target-cat-${cat.id}`} className="sr-only">
                            Kategoria docelowa dla przenoszonych produktów
                          </label>
                          <select
                            id={`target-cat-${cat.id}`}
                            className="select-sm"
                            value={deleteTargetCatId}
                            onChange={(e) => setDeleteTargetCatId(e.target.value)}
                          >
                            {categories
                              .filter((c) => c.id !== cat.id)
                              .map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name} {c.isDefault ? '(Domyślna)' : ''}
                                </option>
                              ))}
                          </select>

                          <button
                            type="button"
                            className="btn-danger"
                            onClick={() => handleConfirmDeleteCategory(cat.id)}
                            style={{ padding: '0.25rem 0.65rem', fontSize: 'var(--font-size-xs)' }}
                          >
                            POTWIERDŹ USUNIĘCIE I PRZENIEŚ
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingCatId(null)}
                            style={{ padding: '0.25rem 0.5rem', fontSize: 'var(--font-size-xs)' }}
                          >
                            ANULUJ
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* ZAKŁADKA 2: PRODUKTY                                                  */}
      {/* ===================================================================== */}
      {activeTab === 'products' && (
        <div
          id={`${baseId}-panel-products`}
          role="tabpanel"
          aria-labelledby={`${baseId}-tab-products`}
        >
          {/* Formularz Dodawania / Edycji Produktu */}
          <form
            onSubmit={handleProductSubmit}
            noValidate
            style={{
              border: '1px solid var(--border-dim)',
              backgroundColor: 'var(--bg-main)',
              padding: '1rem',
              marginBottom: '1.25rem',
            }}
            aria-label={editingProductId ? 'Edycja produktu' : 'Dodawanie nowego produktu'}
          >
            <div
              style={{
                fontWeight: 'bold',
                marginBottom: '0.75rem',
                color: 'var(--text-bright)',
                display: 'flex',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '0.5rem',
              }}
            >
              <span>
                {editingProductId
                  ? `// EDYCJA PRODUKTU (ID: ${editingProductId})`
                  : '// + NOWY PRODUKT W KATALOGU'}
              </span>
              {editingProductId && (
                <button
                  type="button"
                  onClick={resetProductForm}
                  style={{ fontSize: 'var(--font-size-xs)' }}
                >
                  [ANULUJ EDYCJĘ]
                </button>
              )}
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))',
                gap: '0.75rem',
              }}
            >
              <div className="form-group">
                <label htmlFor="prod-sku-input" className="form-label">
                  SKU (Unikalny kod):
                </label>
                <input
                  id="prod-sku-input"
                  type="text"
                  value={prodSku}
                  onChange={(e) => setProdSku(e.target.value)}
                  placeholder="np. HW-RETRO-01"
                  style={{ width: '100%' }}
                />
              </div>

              <div className="form-group">
                <label htmlFor="prod-name-input" className="form-label">
                  Nazwa produktu:
                </label>
                <input
                  id="prod-name-input"
                  type="text"
                  value={prodName}
                  onChange={(e) => setProdName(e.target.value)}
                  placeholder="np. Cyberdeck v3"
                  style={{ width: '100%' }}
                />
              </div>

              <div className="form-group">
                <label htmlFor="prod-cat-select" className="form-label">
                  Kategoria:
                </label>
                <select
                  id="prod-cat-select"
                  value={prodCatId}
                  onChange={(e) => setProdCatId(e.target.value)}
                  style={{ width: '100%' }}
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.isDefault ? ' [DOMYŚLNA]' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="prod-price-input" className="form-label">
                  Cena (PLN):
                </label>
                <input
                  id="prod-price-input"
                  type="text"
                  value={prodPrice}
                  onChange={(e) => setProdPrice(e.target.value)}
                  placeholder="np. 149.99 lub 200"
                  style={{ width: '100%' }}
                />
              </div>

              <div className="form-group">
                <label htmlFor="prod-stock-input" className="form-label">
                  Stan magazynowy (szt.):
                </label>
                <input
                  id="prod-stock-input"
                  type="number"
                  min={0}
                  value={prodStock}
                  onChange={(e) => setProdStock(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>

              <div
                className="form-group"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  marginTop: '1.25rem',
                }}
              >
                <input
                  id="prod-instock-checkbox"
                  type="checkbox"
                  checked={prodInStock}
                  onChange={(e) => setProdInStock(e.target.checked)}
                />
                <label
                  htmlFor="prod-instock-checkbox"
                  style={{
                    fontSize: 'var(--font-size-xs)',
                    color: 'var(--text-bright)',
                    cursor: 'pointer',
                  }}
                >
                  Dostępny w sprzedaży (inStock)
                </label>
              </div>
            </div>

            <div className="form-group" style={{ marginTop: '0.5rem' }}>
              <label htmlFor="prod-desc-input" className="form-label">
                Opis produktu:
              </label>
              <textarea
                id="prod-desc-input"
                rows={2}
                value={prodDesc}
                onChange={(e) => setProdDesc(e.target.value)}
                placeholder="Szczegółowy opis techniczny produktu..."
                style={{
                  width: '100%',
                  fontFamily: 'var(--font-mono)',
                  backgroundColor: 'var(--bg-input)',
                  border: '1px solid var(--border-main)',
                  color: 'var(--text-primary)',
                  padding: '0.4rem',
                }}
              />
            </div>

            {prodError && (
              <div
                role="alert"
                className="form-error"
                style={{
                  padding: '0.4rem 0.6rem',
                  backgroundColor: 'var(--error-bg)',
                  border: '1px solid var(--border-error)',
                  marginBottom: '0.75rem',
                }}
              >
                ! BŁĄD PRODUKTU: {prodError}
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="submit" className="btn-primary">
                {editingProductId ? 'ZAPISZ ZMIANY PRODUKTU' : '+ DODAJ PRODUKT DO KATALOGU'}
              </button>
              {editingProductId && (
                <button type="button" onClick={resetProductForm}>
                  ANULUJ
                </button>
              )}
            </div>
          </form>

          {/* Filtry i wyszukiwarka listy produktów */}
          <div
            style={{
              display: 'flex',
              gap: '0.75rem',
              flexWrap: 'wrap',
              marginBottom: '1rem',
              alignItems: 'center',
            }}
          >
            <div style={{ flex: '1 1 240px' }}>
              <label htmlFor="admin-prod-search" className="sr-only">
                Szukaj produktów w panelu admina
              </label>
              <input
                id="admin-prod-search"
                type="search"
                value={prodSearch}
                onChange={(e) => setProdSearch(e.target.value)}
                placeholder="Filtruj produkty po nazwie / SKU..."
                style={{ width: '100%' }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <label htmlFor="admin-prod-cat-filter" className="form-label" style={{ margin: 0 }}>
                Kategoria:
              </label>
              <select
                id="admin-prod-cat-filter"
                value={prodFilterCat}
                onChange={(e) => setProdFilterCat(e.target.value)}
              >
                <option value="ALL">Wszystkie kategorie</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Tabela / Lista Produktów */}
          <div className="admin-table-wrap">
            {filteredCatalog.length === 0 ? (
              <div
                style={{
                  padding: '1.5rem',
                  textAlign: 'center',
                  color: 'var(--text-muted)',
                }}
              >
                [BRAK PRODUKTÓW W KATALOGU SPEŁNIAJĄCYCH KRYTERIA]
              </div>
            ) : (
              <table
                className="retro-responsive-table"
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: 'var(--font-size-xs)',
                  textAlign: 'left',
                }}
              >
                <thead>
                  <tr
                    style={{
                      backgroundColor: 'var(--bg-panel-header)',
                      borderBottom: '1px solid var(--border-dim)',
                    }}
                  >
                    <th style={{ padding: '0.5rem' }}>SKU</th>
                    <th style={{ padding: '0.5rem' }}>NAZWA</th>
                    <th style={{ padding: '0.5rem' }}>KATEGORIA</th>
                    <th style={{ padding: '0.5rem' }}>CENA</th>
                    <th style={{ padding: '0.5rem' }}>MAGAZYN</th>
                    <th style={{ padding: '0.5rem' }}>STATUS</th>
                    <th style={{ padding: '0.5rem', textAlign: 'right' }}>AKCJE</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCatalog.map((product) => (
                    <tr
                      key={product.id}
                      style={{
                        borderBottom: '1px solid var(--border-dim)',
                        backgroundColor:
                          editingProductId === product.id ? 'var(--bg-hover)' : 'transparent',
                      }}
                    >
                      <td
                        data-label="SKU"
                        style={{ padding: '0.5rem', fontFamily: 'var(--font-mono)' }}
                      >
                        <span className="badge badge-accent">[{product.sku}]</span>
                      </td>
                      <td data-label="NAZWA" style={{ padding: '0.5rem' }}>
                        <strong style={{ color: 'var(--text-bright)' }}>{product.name}</strong>
                      </td>
                      <td
                        data-label="KATEGORIA"
                        style={{ padding: '0.5rem', color: 'var(--text-muted)' }}
                      >
                        {product.category}
                      </td>
                      <td
                        data-label="CENA"
                        style={{ padding: '0.5rem', color: 'var(--text-bright)' }}
                      >
                        {formatPLN(product.priceCents)}
                      </td>
                      <td data-label="MAGAZYN" style={{ padding: '0.5rem' }}>
                        {product.stockQuantity} szt.
                      </td>
                      <td data-label="STATUS" style={{ padding: '0.5rem' }}>
                        {product.inStock && product.stockQuantity > 0 ? (
                          <span style={{ color: 'var(--accent)' }}>[W SPRZEDAŻY]</span>
                        ) : (
                          <span style={{ color: 'var(--error)' }}>[NIEDOSTĘPNY]</span>
                        )}
                      </td>
                      <td
                        className="table-actions-cell"
                        style={{ padding: '0.5rem', textAlign: 'right' }}
                      >
                        <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                          <button
                            type="button"
                            onClick={() => startEditProduct(product)}
                            aria-label={`Edytuj produkt ${product.name}`}
                            style={{ padding: '0.15rem 0.45rem', fontSize: 'var(--font-size-xs)' }}
                          >
                            EDYTUJ
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeleteProduct(product)}
                            className="btn-danger"
                            aria-label={`Usuń produkt ${product.name}`}
                            style={{ padding: '0.15rem 0.45rem', fontSize: 'var(--font-size-xs)' }}
                          >
                            USUŃ
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* ZAKŁADKA 3: MIGRACJA PRODUKTÓW                                        */}
      {/* ===================================================================== */}
      {activeTab === 'migration' && (
        <div
          id={`${baseId}-panel-migration`}
          role="tabpanel"
          aria-labelledby={`${baseId}-tab-migration`}
        >
          <div
            style={{
              border: '1px solid var(--border-dim)',
              backgroundColor: 'var(--bg-main)',
              padding: '1rem',
              marginBottom: '1rem',
            }}
          >
            <div
              style={{ fontWeight: 'bold', color: 'var(--text-bright)', marginBottom: '0.5rem' }}
            >
              // MASOWA MIGRACJA PRODUKTÓW MIĘDZY KATEGORIAMI
            </div>
            <p
              style={{
                fontSize: 'var(--font-size-xs)',
                color: 'var(--text-muted)',
                margin: '0 0 1rem 0',
              }}
            >
              Wybierz kategorię źródłową oraz docelową, a następnie zaznacz produkty, które mają
              zostać przeniesione. Migracja automatycznie zaktualizuje powiązania w bazie danych i
              koszyku.
            </p>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(min(260px, 100%), 1fr))',
                gap: '1rem',
                marginBottom: '1rem',
              }}
            >
              <div className="form-group">
                <label htmlFor="migrate-source-cat" className="form-label">
                  Kategoria źródłowa:
                </label>
                <select
                  id="migrate-source-cat"
                  value={migrateSourceCatId}
                  onChange={(e) => handleSourceCatChange(e.target.value)}
                  style={{ width: '100%' }}
                >
                  {categories.map((c) => {
                    const count = catalog.filter((p) => p.categoryId === c.id).length;
                    return (
                      <option key={c.id} value={c.id}>
                        {c.name} ({count} produktów)
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="migrate-target-cat" className="form-label">
                  Kategoria docelowa:
                </label>
                <select
                  id="migrate-target-cat"
                  value={migrateTargetCatId}
                  onChange={(e) => {
                    setMigrateTargetCatId(e.target.value);
                    setMigrationStatus(null);
                  }}
                  style={{ width: '100%' }}
                >
                  {categories
                    .filter((c) => c.id !== migrateSourceCatId)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                        {c.isDefault ? ' [DOMYŚLNA]' : ''}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            {/* Narzędzia wyboru produktów w kategorii źródłowej */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.5rem',
                borderTop: '1px dotted var(--border-dim)',
                paddingTop: '0.75rem',
                marginBottom: '0.75rem',
              }}
            >
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-bright)' }}>
                Produkty w kategorii źródłowej: ({sourceProducts.length}) | Zaznaczono: (
                {selectedProductIds.size})
              </div>

              <div style={{ display: 'flex', gap: '0.35rem' }}>
                <button
                  type="button"
                  onClick={handleSelectAllMigration}
                  disabled={sourceProducts.length === 0}
                  style={{ fontSize: 'var(--font-size-xs)', padding: '0.2rem 0.5rem' }}
                >
                  Zaznacz wszystkie
                </button>
                <button
                  type="button"
                  onClick={handleDeselectAllMigration}
                  disabled={selectedProductIds.size === 0}
                  style={{ fontSize: 'var(--font-size-xs)', padding: '0.2rem 0.5rem' }}
                >
                  Odznacz wszystkie
                </button>
              </div>
            </div>

            {/* Lista produktów z checkboxami */}
            <div className="admin-migration-list">
              {sourceProducts.length === 0 ? (
                <div
                  style={{
                    padding: '1rem',
                    textAlign: 'center',
                    color: 'var(--text-muted)',
                    fontSize: 'var(--font-size-xs)',
                  }}
                >
                  [BRAK PRODUKTÓW PRZYPISANYCH DO WYBRANEJ KATEGORII ŹRÓDŁOWEJ]
                </div>
              ) : (
                sourceProducts.map((p) => {
                  const isChecked = selectedProductIds.has(p.id);
                  return (
                    <label
                      key={p.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '0.5rem',
                        padding: '0.45rem 0.5rem',
                        backgroundColor: isChecked ? 'var(--bg-hover)' : 'transparent',
                        cursor: 'pointer',
                        fontSize: 'var(--font-size-xs)',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleMigrationProduct(p.id)}
                      />
                      <span className="badge badge-accent">[{p.sku}]</span>
                      <strong style={{ color: 'var(--text-bright)' }}>{p.name}</strong>
                      <span style={{ color: 'var(--text-muted)', marginLeft: 'auto' }}>
                        {formatPLN(p.priceCents)}
                      </span>
                    </label>
                  );
                })
              )}
            </div>

            {migrationStatus && (
              <div
                role="status"
                style={{
                  padding: '0.45rem 0.65rem',
                  backgroundColor: migrationStatus.startsWith('SUKCES')
                    ? 'var(--success-bg)'
                    : 'var(--error-bg)',
                  border: `1px solid ${
                    migrationStatus.startsWith('SUKCES')
                      ? 'var(--border-bright)'
                      : 'var(--border-error)'
                  }`,
                  color: migrationStatus.startsWith('SUKCES') ? 'var(--accent)' : 'var(--error)',
                  fontSize: 'var(--font-size-xs)',
                  marginBottom: '1rem',
                }}
              >
                {migrationStatus}
              </div>
            )}

            <button
              type="button"
              className="btn-primary"
              disabled={selectedProductIds.size === 0 || migrateSourceCatId === migrateTargetCatId}
              onClick={() => void handleExecuteMigration()}
              style={{ width: '100%', padding: '0.5rem' }}
            >
              MIGRUJ WYBRANE PRODUKTY ({selectedProductIds.size}) -&gt;
            </button>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* ZAKŁADKA 4: KLIENCI (ZARZĄDZANIE)                                     */}
      {/* ===================================================================== */}
      {activeTab === 'customers' && (
        <div
          id={`${baseId}-panel-customers`}
          role="tabpanel"
          aria-labelledby={`${baseId}-tab-customers`}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.75rem',
              marginBottom: '1rem',
            }}
          >
            <div style={{ flex: '1 1 260px' }}>
              <label htmlFor="admin-customer-search-input" className="sr-only">
                Szukaj klientów
              </label>
              <input
                id="admin-customer-search-input"
                type="search"
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                placeholder="Szukaj klienta po imieniu lub adresie e-mail..."
                style={{ width: '100%' }}
              />
            </div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
              Razem klientów w bazie:{' '}
              <strong style={{ color: 'var(--text-bright)' }}>{customers.length}</strong>
            </div>
          </div>

          {/* Lista Klientów */}
          <div className="admin-customers-list">
            {filteredCustomers.length === 0 ? (
              <div
                style={{
                  padding: '1.5rem',
                  textAlign: 'center',
                  border: '1px dashed var(--border-dim)',
                  color: 'var(--text-muted)',
                }}
              >
                [BRAK ZAREJESTROWANYCH KLIENTÓW SPEŁNIAJĄCYCH KRYTERIA]
              </div>
            ) : (
              filteredCustomers.map((customer) => {
                const orderCount = getCustomerOrderCount(customer.id, customer.email);
                const isConfirming = customerToDelete === customer.id;

                return (
                  <div
                    key={customer.id}
                    style={{
                      border: '1px solid var(--border-dim)',
                      backgroundColor: 'var(--bg-main)',
                      padding: '0.65rem 0.85rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '0.5rem',
                    }}
                  >
                    <div style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: '0.45rem',
                        }}
                      >
                        <strong style={{ color: 'var(--text-bright)' }}>{customer.name}</strong>
                        <span className="badge">ID: {customer.id}</span>
                      </div>
                      <div
                        style={{
                          fontSize: 'var(--font-size-xs)',
                          color: 'var(--text-primary)',
                          marginTop: '0.15rem',
                          overflowWrap: 'anywhere',
                        }}
                      >
                        E-mail: <span style={{ color: 'var(--accent)' }}>{customer.email}</span>
                      </div>
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                        Złożone zamówienia: <strong>{orderCount}</strong>
                      </div>
                    </div>

                    <div>
                      {!isConfirming ? (
                        <button
                          type="button"
                          className="btn-danger"
                          onClick={() => setCustomerToDelete(customer.id)}
                          aria-label={`Usuń klienta ${customer.name}`}
                          style={{ padding: '0.2rem 0.6rem', fontSize: 'var(--font-size-xs)' }}
                          title="Usuń klienta z bazy danych (wcześniejsze zamówienia zachowają snapshot)"
                        >
                          USUŃ
                        </button>
                      ) : (
                        <div style={{ display: 'inline-flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                          <button
                            type="button"
                            className="btn-danger"
                            onClick={() => void handleDeleteCustomer(customer.id)}
                            style={{ padding: '0.2rem 0.5rem', fontSize: 'var(--font-size-xs)' }}
                          >
                            POTWIERDŹ USUŃ?
                          </button>
                          <button
                            type="button"
                            onClick={() => setCustomerToDelete(null)}
                            style={{ padding: '0.2rem 0.4rem', fontSize: 'var(--font-size-xs)' }}
                          >
                            ANULUJ
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </section>
  );
}
