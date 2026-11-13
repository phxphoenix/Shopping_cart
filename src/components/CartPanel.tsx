import { formatPLN } from '@/domain/money';
import { useShopStore } from '@/store/useShopStore';

function renderAsciiProgressBar(percentage: number): string {
  const totalSlots = 20;
  const clampedPct = Math.max(0, Math.min(100, percentage));
  const filledSlots = Math.round((clampedPct / 100) * totalSlots);

  if (clampedPct >= 100) {
    return `[${'='.repeat(totalSlots)}] 100%`;
  }

  const arrows = filledSlots > 0 ? '='.repeat(filledSlots - 1) + '>' : '';
  const empty = ' '.repeat(totalSlots - filledSlots);

  return `[${arrows}${empty}] ${clampedPct}%`;
}

export function CartPanel() {
  const { cart, getCartTotals, incrementCartItem, decrementCartItem, removeFromCart, clearCart } =
    useShopStore();

  const totals = getCartTotals();
  const percentage = Math.min(100, Math.round((totals.subtotalCents / 20000) * 100));

  return (
    <section className="retro-panel" aria-labelledby="cart-heading">
      <div className="panel-header">
        <h2 id="cart-heading" className="panel-title">
          // KOSZYK ({totals.itemCount} szt.)
        </h2>
        {cart.length > 0 && (
          <button
            type="button"
            onClick={clearCart}
            className="btn-danger"
            style={{ fontSize: 'var(--font-size-xs)', padding: '0.2rem 0.5rem' }}
            title="Wyczyść całą zawartość koszyka"
          >
            WYCZYŚĆ
          </button>
        )}
      </div>

      {/* Wizualny pasek ASCII postępu do darmowej dostawy */}
      <div
        style={{
          border: '1px solid var(--border-dim)',
          backgroundColor: 'var(--bg-main)',
          padding: '0.65rem 0.75rem',
          marginBottom: '1rem',
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--font-size-xs)',
        }}
        aria-live="polite"
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '0.25rem',
          }}
        >
          <span style={{ color: 'var(--text-muted)' }}>DARMOWA DOSTAWA OD 200,00 ZŁ:</span>
          {totals.isFreeDelivery ? (
            <span style={{ color: 'var(--accent)', fontWeight: 'bold' }}>
              DARMOWA DOSTAWA AKTYWNA
            </span>
          ) : (
            <span style={{ color: 'var(--warning)' }}>
              Brakuje: {formatPLN(totals.amountToFreeDeliveryCents)}
            </span>
          )}
        </div>

        {/* Pasek ASCII */}
        <pre
          style={{
            margin: '0.25rem 0',
            color: totals.isFreeDelivery ? 'var(--accent)' : 'var(--text-primary)',
            fontSize: 'var(--font-size-xs)',
            letterSpacing: '0.05em',
            overflowX: 'auto',
          }}
          aria-label={`Postęp do darmowej dostawy: ${percentage}%`}
        >
          {renderAsciiProgressBar(percentage)}
        </pre>

        <div style={{ color: 'var(--text-dim)', fontSize: '0.7rem' }}>
          {totals.isFreeDelivery
            ? 'Gratulacje! Twoje zamówienie kwalifikuje się do darmowej wysyłki.'
            : `Dodaj za ${formatPLN(totals.amountToFreeDeliveryCents)}, aby uzyskać darmową dostawę.`}
        </div>
      </div>

      {/* Lista pozycji w koszyku */}
      {cart.length === 0 ? (
        <div
          style={{
            padding: '1.5rem',
            textAlign: 'center',
            border: '1px dashed var(--border-dim)',
            color: 'var(--text-muted)',
            marginBottom: '1rem',
          }}
        >
          [KOSZYK JEST PUSTY. WYBIERZ PRODUKTY Z KATALOGU]
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
            marginBottom: '1rem',
            maxHeight: '320px',
            overflowY: 'auto',
          }}
        >
          {cart.map((item) => (
            <div
              key={item.product.id}
              style={{
                border: '1px solid var(--border-dim)',
                backgroundColor: 'var(--bg-main)',
                padding: '0.5rem 0.65rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.5rem',
              }}
            >
              <div style={{ flex: 1, minWidth: '150px' }}>
                <div style={{ color: 'var(--text-bright)', fontWeight: 600 }}>
                  {item.product.name}
                </div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                  {formatPLN(item.product.priceCents)} / szt.
                </div>
              </div>

              {/* Kontrolki ilości i suma linii */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                }}
              >
                <button
                  type="button"
                  onClick={() => decrementCartItem(item.product.id)}
                  aria-label={`Zmniejsz ilość dla ${item.product.name}`}
                  style={{ padding: '0.15rem 0.45rem', fontSize: 'var(--font-size-xs)' }}
                >
                  -
                </button>
                <span
                  style={{
                    minWidth: '24px',
                    textAlign: 'center',
                    fontWeight: 'bold',
                    fontSize: 'var(--font-size-sm)',
                  }}
                >
                  {item.quantity}
                </span>
                <button
                  type="button"
                  onClick={() => incrementCartItem(item.product.id)}
                  aria-label={`Zwiększ ilość dla ${item.product.name}`}
                  style={{ padding: '0.15rem 0.45rem', fontSize: 'var(--font-size-xs)' }}
                >
                  +
                </button>
                <div
                  style={{
                    minWidth: '75px',
                    textAlign: 'right',
                    color: 'var(--text-bright)',
                    fontWeight: 600,
                    fontSize: 'var(--font-size-sm)',
                  }}
                >
                  {formatPLN(item.lineTotalCents)}
                </div>
                <button
                  type="button"
                  onClick={() => removeFromCart(item.product.id)}
                  className="btn-danger"
                  aria-label={`Usuń ${item.product.name} z koszyka`}
                  style={{
                    padding: '0.15rem 0.45rem',
                    fontSize: 'var(--font-size-xs)',
                  }}
                  title="Usuń tę pozycję z koszyka"
                >
                  USUŃ
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Podsumowanie finansowe koszyka */}
      <div
        style={{
          borderTop: '1px solid var(--border-main)',
          paddingTop: '0.75rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.35rem',
          fontSize: 'var(--font-size-sm)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--text-muted)' }}>Suma produktów:</span>
          <span>{formatPLN(totals.subtotalCents)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--text-muted)' }}>Dostawa:</span>
          <span style={{ color: totals.isFreeDelivery ? 'var(--accent)' : 'inherit' }}>
            {totals.isFreeDelivery
              ? '0,00 zł (GRATIS)'
              : totals.itemCount === 0
                ? '0,00 zł'
                : formatPLN(totals.deliveryCents)}
          </span>
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            borderTop: '1px dotted var(--border-dim)',
            paddingTop: '0.45rem',
            marginTop: '0.2rem',
          }}
        >
          <strong style={{ fontSize: 'var(--font-size-base)', color: 'var(--text-bright)' }}>
            DO ZAPŁATY:
          </strong>
          <strong
            style={{
              fontSize: 'var(--font-size-lg)',
              color: 'var(--accent)',
            }}
          >
            {formatPLN(totals.totalCents)}
          </strong>
        </div>
      </div>
    </section>
  );
}
