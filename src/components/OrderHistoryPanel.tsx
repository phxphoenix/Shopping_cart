import { useState } from 'react';
import { formatPLN } from '@/domain/money';
import type { Order } from '@/domain/schemas';
import { useShopStore } from '@/store/useShopStore';
import { downloadTextFile } from '@/utils/download';
import { OrderDetailsModal } from './OrderDetailsModal';

function formatPaymentShort(order: Order): string {
  const p = order.paymentDetails;
  if (!p) {
    return order.paymentMethod;
  }
  if (p.method === 'card') {
    return `Karta (${p.maskedCard})`;
  }
  if (p.method === 'paypal') {
    return `PayPal (${p.email})`;
  }
  if (p.method === 'bitcoin') {
    const shortAddr =
      p.walletAddress.length > 12
        ? `${p.walletAddress.slice(0, 6)}...${p.walletAddress.slice(-4)}`
        : p.walletAddress;
    return `BTC (${shortAddr})`;
  }
  return order.paymentMethod;
}

export function OrderHistoryPanel() {
  const { orders, removeOrder, exportHistoryTxt, setStatus } = useShopStore();
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const handleExportTxt = () => {
    try {
      const { filename, content } = exportHistoryTxt();
      downloadTextFile(filename, content, 'text/plain;charset=utf-8');
      setStatus(`WYEKSPORTOWANO RAPORT HISTORII DO PLIKU: ${filename}`, 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setStatus(`BŁĄD EKSPORTU HISTORII: ${message}`, 'error');
    }
  };

  return (
    <>
      <section id="panel-orders" className="retro-panel" aria-labelledby="orders-heading">
        <div className="panel-header">
          <h2 id="orders-heading" className="panel-title">
            // HISTORIA ZAMÓWIEŃ ({orders.length})
          </h2>
          {orders.length > 0 && (
            <button
              type="button"
              onClick={handleExportTxt}
              style={{ fontSize: 'var(--font-size-xs)' }}
              title="Pobierz tabelaryczny raport ASCII w pliku .txt (zgodny z legacy/main.py)"
            >
              EXPORT .TXT
            </button>
          )}
        </div>

        {orders.length === 0 ? (
          <div
            style={{
              padding: '1.5rem',
              textAlign: 'center',
              border: '1px dashed var(--border-dim)',
              color: 'var(--text-muted)',
              fontSize: 'var(--font-size-xs)',
            }}
          >
            [BRAK ZAMÓWIEŃ W HISTORII. ZŁÓŻ PIERWSZE ZAMÓWIENIE W PANELU KASY]
          </div>
        ) : (
          <div className="orders-table-container">
            <table
              className="retro-responsive-table"
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: 'var(--font-size-xs)',
                textAlign: 'left',
              }}
              aria-label="Tabela historii zamówień"
            >
              <thead>
                <tr
                  style={{
                    borderBottom: '1px solid var(--border-dim)',
                    backgroundColor: 'var(--bg-panel-header)',
                  }}
                >
                  <th style={{ padding: '0.45rem 0.5rem' }}>Data</th>
                  <th style={{ padding: '0.45rem 0.5rem' }}>Klient</th>
                  <th style={{ padding: '0.45rem 0.5rem' }}>Płatność</th>
                  <th style={{ padding: '0.45rem 0.5rem', textAlign: 'right' }}>Kwota</th>
                  <th style={{ padding: '0.45rem 0.5rem', textAlign: 'center' }}>Akcje</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order, idx) => (
                  <tr
                    key={order.id}
                    onDoubleClick={() => setSelectedOrder(order)}
                    style={{
                      borderBottom:
                        idx < orders.length - 1 ? '1px dotted var(--border-dim)' : 'none',
                      cursor: 'pointer',
                    }}
                    title="Kliknij dwukrotnie, aby otworzyć szczegóły"
                  >
                    <td
                      data-label="Data"
                      style={{ padding: '0.45rem 0.5rem', whiteSpace: 'nowrap' }}
                    >
                      {order.timestamp ? order.timestamp.slice(0, 16) : '---'}
                    </td>
                    <td
                      data-label="Klient"
                      style={{
                        padding: '0.45rem 0.5rem',
                        color: 'var(--text-bright)',
                        fontWeight: 600,
                      }}
                    >
                      {order.customer.name}
                    </td>
                    <td
                      data-label="Płatność"
                      style={{ padding: '0.45rem 0.5rem', color: 'var(--text-muted)' }}
                    >
                      {formatPaymentShort(order)}
                    </td>
                    <td
                      data-label="Kwota"
                      style={{
                        padding: '0.45rem 0.5rem',
                        textAlign: 'right',
                        fontWeight: 'bold',
                        color: 'var(--accent)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {formatPLN(order.totalCents)}
                    </td>
                    <td
                      className="table-actions-cell"
                      style={{
                        padding: '0.45rem 0.5rem',
                        textAlign: 'center',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedOrder(order);
                        }}
                        style={{
                          fontSize: '0.7rem',
                          padding: '0.15rem 0.35rem',
                          marginRight: '0.35rem',
                        }}
                        aria-label={`Szczegóły zamówienia ${order.id}`}
                      >
                        SZCZEGÓŁY
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeOrder(order.id);
                        }}
                        className="btn-danger"
                        style={{ fontSize: '0.7rem', padding: '0.15rem 0.35rem' }}
                        aria-label={`Usuń zamówienie ${order.id}`}
                      >
                        USUŃ
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Modal szczegółów zamówienia */}
      <OrderDetailsModal order={selectedOrder} onClose={() => setSelectedOrder(null)} />
    </>
  );
}
