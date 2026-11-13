import { useEffect, useRef, type MouseEvent } from 'react';
import { formatPLN } from '@/domain/money';
import type { Order } from '@/domain/schemas';

interface OrderDetailsModalProps {
  order: Order | null;
  onClose: () => void;
}

export function OrderDetailsModal({ order, onClose }: OrderDetailsModalProps) {
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!order) {
      return;
    }

    // Save previous active element to restore focus after closing
    previouslyFocusedElementRef.current = document.activeElement as HTMLElement | null;

    // Focus close button on open
    closeBtnRef.current?.focus();

    // Listen to Escape key
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      previouslyFocusedElementRef.current?.focus();
    };
  }, [order, onClose]);

  if (!order) {
    return null;
  }

  const handleBackdropClick = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const payment = order.paymentDetails;

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick} role="presentation">
      <div
        className="modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="order-details-title"
      >
        <div className="modal-header">
          <h3 id="order-details-title" className="modal-title">
            // SZCZEGÓŁY ZAMÓWIENIA
          </h3>
          <span className="badge badge-accent">ID: {order.id}</span>
        </div>

        <div className="modal-body">
          {/* Informacje ogólne */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '0.75rem',
              border: '1px solid var(--border-dim)',
              backgroundColor: 'var(--bg-main)',
              padding: '0.75rem',
            }}
          >
            <div>
              <div style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)' }}>
                Data i godzina:
              </div>
              <strong style={{ color: 'var(--text-bright)' }}>{order.timestamp}</strong>
            </div>

            <div>
              <div style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)' }}>
                Klient (snapshot):
              </div>
              <strong style={{ color: 'var(--text-bright)' }}>{order.customer.name}</strong>
              {order.customer.email && (
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                  {order.customer.email}
                </div>
              )}
            </div>

            <div style={{ gridColumn: 'span 2' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)' }}>
                Metoda płatności:
              </div>
              <div style={{ color: 'var(--text-bright)', marginTop: '0.2rem' }}>
                {order.paymentMethod === 'card' && payment?.method === 'card' && (
                  <span>
                    Karta kredytowa: <strong>{payment.maskedCard}</strong> (ważność:{' '}
                    {payment.expiry})
                  </span>
                )}
                {order.paymentMethod === 'paypal' && payment?.method === 'paypal' && (
                  <span>
                    PayPal: <strong>{payment.email}</strong>
                  </span>
                )}
                {order.paymentMethod === 'bitcoin' && payment?.method === 'bitcoin' && (
                  <span>
                    Bitcoin: <strong>{payment.walletAddress}</strong> (kwota: {payment.btcAmount}{' '}
                    BTC)
                  </span>
                )}
                {!payment && <span>{order.paymentMethod}</span>}
              </div>
            </div>
          </div>

          {/* Pozycje zamówienia */}
          <div>
            <div
              style={{
                color: 'var(--text-bright)',
                fontWeight: 600,
                marginBottom: '0.45rem',
                fontSize: 'var(--font-size-sm)',
              }}
            >
              Zamówione pozycje:
            </div>
            <div
              style={{
                border: '1px solid var(--border-dim)',
                backgroundColor: 'var(--bg-main)',
                overflowX: 'auto',
              }}
            >
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: 'var(--font-size-xs)',
                  textAlign: 'left',
                }}
              >
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-dim)' }}>
                    <th style={{ padding: '0.45rem 0.6rem' }}>Nazwa</th>
                    <th style={{ padding: '0.45rem 0.6rem', textAlign: 'center' }}>Ilość</th>
                    <th style={{ padding: '0.45rem 0.6rem', textAlign: 'right' }}>Cena</th>
                    <th style={{ padding: '0.45rem 0.6rem', textAlign: 'right' }}>Wartość</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item, idx) => (
                    <tr
                      key={`${item.name}-${idx}`}
                      style={{
                        borderBottom:
                          idx < order.items.length - 1 ? '1px dotted var(--border-dim)' : 'none',
                      }}
                    >
                      <td style={{ padding: '0.45rem 0.6rem', color: 'var(--text-bright)' }}>
                        {item.name}
                      </td>
                      <td style={{ padding: '0.45rem 0.6rem', textAlign: 'center' }}>
                        {item.quantity} szt.
                      </td>
                      <td style={{ padding: '0.45rem 0.6rem', textAlign: 'right' }}>
                        {formatPLN(item.priceCents)}
                      </td>
                      <td
                        style={{
                          padding: '0.45rem 0.6rem',
                          textAlign: 'right',
                          fontWeight: 600,
                        }}
                      >
                        {formatPLN(item.priceCents * item.quantity)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Podsumowanie finansowe */}
          <div
            style={{
              border: '1px solid var(--border-dim)',
              backgroundColor: 'var(--bg-main)',
              padding: '0.75rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.35rem',
              fontSize: 'var(--font-size-sm)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Suma produktów:</span>
              <span>{formatPLN(order.subtotalCents)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Koszt wysyłki:</span>
              <span>
                {order.deliveryCents === 0 ? '0,00 zł (GRATIS)' : formatPLN(order.deliveryCents)}
              </span>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                borderTop: '1px solid var(--border-main)',
                paddingTop: '0.45rem',
                marginTop: '0.25rem',
              }}
            >
              <strong style={{ color: 'var(--text-bright)' }}>RAZEM OPŁACONO:</strong>
              <strong style={{ color: 'var(--accent)', fontSize: 'var(--font-size-base)' }}>
                {formatPLN(order.totalCents)}
              </strong>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button
            type="button"
            ref={closeBtnRef}
            onClick={onClose}
            className="btn-primary"
            style={{ minWidth: '120px' }}
          >
            ZAMKNIJ [ESC]
          </button>
        </div>
      </div>
    </div>
  );
}
