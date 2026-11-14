import { useState, type ChangeEvent } from 'react';
import { formatPLN } from '@/domain/money';
import { useShopStore } from '@/store/useShopStore';

export function CatalogPanel() {
  const {
    searchQuery,
    setSearchQuery,
    selectedCategory,
    setSelectedCategory,
    categories,
    getFilteredProducts,
    addToCart,
  } = useShopStore();

  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const filteredProducts = getFilteredProducts();

  const getQty = (productId: string): number => quantities[productId] ?? 1;

  const setQty = (productId: string, val: number) => {
    const clamped = Math.max(1, Math.min(99, Math.floor(val)));
    setQuantities((prev) => ({ ...prev, [productId]: clamped }));
  };

  const handleQtyChange = (productId: string, e: ChangeEvent<HTMLInputElement>) => {
    const parsed = Number.parseInt(e.target.value, 10);
    if (!Number.isNaN(parsed)) {
      setQty(productId, parsed);
    } else {
      setQuantities((prev) => ({ ...prev, [productId]: 1 }));
    }
  };

  const handleAddToCart = (productId: string) => {
    const qty = getQty(productId);
    addToCart(productId, qty);
    // Reset back to 1 for this product
    setQuantities((prev) => ({ ...prev, [productId]: 1 }));
  };

  return (
    <section className="retro-panel" aria-labelledby="catalog-heading">
      <div className="panel-header">
        <h2 id="catalog-heading" className="panel-title">
          // KATALOG PRODUKTÓW ({filteredProducts.length})
        </h2>
      </div>

      {/* Wyszukiwarka */}
      <div className="form-group" style={{ marginBottom: '0.85rem' }}>
        <label htmlFor="catalog-search" className="sr-only">
          Szukaj produktów po nazwie, SKU lub opisie
        </label>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            id="catalog-search"
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Szukaj: np. Laptop, HW-LAPTOP-01, monitor..."
            aria-label="Wyszukiwarka produktów"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Wyczyść pole wyszukiwania"
              title="Wyczyść wyszukiwanie"
            >
              [X]
            </button>
          )}
        </div>
      </div>

      {/* Dynamiczne filtry kategorii */}
      <div
        role="group"
        aria-label="Filtry kategorii produktów"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.35rem',
          marginBottom: '1rem',
        }}
      >
        {/* Kategoria Wszystkie */}
        <button
          type="button"
          onClick={() => setSelectedCategory('ALL')}
          className={selectedCategory === 'ALL' ? 'btn-active' : ''}
          aria-pressed={selectedCategory === 'ALL'}
          style={{ fontSize: 'var(--font-size-xs)' }}
        >
          {selectedCategory === 'ALL' ? '> WSZYSTKIE' : 'WSZYSTKIE'}
        </button>

        {/* Dynamiczne kategorie ze store */}
        {categories.map((category) => {
          const isSelected = selectedCategory === category.name || selectedCategory === category.id;
          return (
            <button
              key={category.id}
              type="button"
              onClick={() => setSelectedCategory(category.name)}
              className={isSelected ? 'btn-active' : ''}
              aria-pressed={isSelected}
              style={{ fontSize: 'var(--font-size-xs)' }}
            >
              {isSelected ? `> ${category.name}` : category.name}
            </button>
          );
        })}
      </div>

      {/* Lista produktów */}
      {filteredProducts.length === 0 ? (
        <div
          style={{
            padding: '1.5rem',
            textAlign: 'center',
            border: '1px dashed var(--border-dim)',
            color: 'var(--text-muted)',
          }}
        >
          [BRAK POZYCJI W KATALOGU SPEŁNIAJĄCYCH KRYTERIA]
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
            maxHeight: '620px',
            overflowY: 'auto',
            paddingRight: '0.25rem',
          }}
        >
          {filteredProducts.map((product) => {
            const qty = getQty(product.id);
            const isAvailable = Boolean(product.inStock && product.stockQuantity > 0);

            return (
              <article
                key={product.id}
                style={{
                  border: isAvailable
                    ? '1px solid var(--border-dim)'
                    : '1px solid var(--border-error)',
                  backgroundColor: 'var(--bg-main)',
                  padding: '0.75rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                }}
              >
                {/* Wiersz nagłówka produktu */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    flexWrap: 'wrap',
                    gap: '0.35rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className="badge badge-accent">[{product.sku}]</span>
                    <strong
                      style={{
                        color: 'var(--text-bright)',
                        fontSize: 'var(--font-size-base)',
                      }}
                    >
                      {product.name}
                    </strong>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span className="badge">kat: {product.category}</span>
                    {isAvailable ? (
                      <span
                        style={{
                          fontSize: 'var(--font-size-xs)',
                          color: 'var(--text-muted)',
                        }}
                      >
                        Stan: {product.stockQuantity} szt.
                      </span>
                    ) : (
                      <span
                        style={{
                          fontSize: 'var(--font-size-xs)',
                          color: 'var(--error)',
                          fontWeight: 'bold',
                        }}
                      >
                        [NIEDOSTĘPNY]
                      </span>
                    )}
                  </div>
                </div>

                {/* Opis */}
                <p
                  style={{
                    fontSize: 'var(--font-size-xs)',
                    color: 'var(--text-muted)',
                    margin: 0,
                    lineHeight: 1.4,
                  }}
                >
                  {product.description}
                </p>

                {/* Wiersz ceny i dodawania do koszyka */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '0.5rem',
                    borderTop: '1px dotted var(--border-dim)',
                    paddingTop: '0.5rem',
                    marginTop: '0.25rem',
                  }}
                >
                  <div>
                    <span
                      style={{
                        fontSize: 'var(--font-size-sm)',
                        color: 'var(--text-muted)',
                        marginRight: '0.35rem',
                      }}
                    >
                      Cena:
                    </span>
                    <strong
                      style={{
                        fontSize: 'var(--font-size-base)',
                        color: 'var(--text-bright)',
                      }}
                    >
                      {formatPLN(product.priceCents)}
                    </strong>
                  </div>

                  {/* Kontrolka ilości i przycisk Dodaj */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <button
                      type="button"
                      onClick={() => setQty(product.id, qty - 1)}
                      disabled={!isAvailable || qty <= 1}
                      aria-label={`Zmniejsz ilość dla ${product.name}`}
                      style={{ padding: '0.2rem 0.5rem' }}
                    >
                      -
                    </button>
                    <label htmlFor={`qty-${product.id}`} className="sr-only">
                      Ilość dla {product.name}
                    </label>
                    <input
                      id={`qty-${product.id}`}
                      type="number"
                      min={1}
                      max={99}
                      value={qty}
                      disabled={!isAvailable}
                      onChange={(e) => handleQtyChange(product.id, e)}
                      style={{
                        width: '46px',
                        textAlign: 'center',
                        padding: '0.2rem',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setQty(product.id, qty + 1)}
                      disabled={!isAvailable || qty >= 99}
                      aria-label={`Zwiększ ilość dla ${product.name}`}
                      style={{ padding: '0.2rem 0.5rem' }}
                    >
                      +
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddToCart(product.id)}
                      disabled={!isAvailable}
                      className="btn-primary"
                      style={{ padding: '0.25rem 0.65rem' }}
                      title={
                        isAvailable
                          ? 'Dodaj produkt do koszyka'
                          : 'Produkt chwilowo niedostępny w magazynie'
                      }
                    >
                      DODAJ -&gt;
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
