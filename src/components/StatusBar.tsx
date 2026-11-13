import { useShopStore } from '@/store/useShopStore';

export function StatusBar() {
  const { statusMessage, statusTone, getSelectedCustomer, getCartTotals } = useShopStore();

  const selectedCustomer = getSelectedCustomer();
  const totals = getCartTotals();

  const getToneColor = (): string => {
    switch (statusTone) {
      case 'success':
        return 'var(--success)';
      case 'warning':
        return 'var(--warning)';
      case 'error':
        return 'var(--error)';
      case 'info':
      default:
        return 'var(--text-primary)';
    }
  };

  const displayText = statusMessage ?? 'SYSTEM GOTOWY // OCZEKIWANIE NA POLECENIA';

  return (
    <footer className="retro-status-bar" role="status" aria-live="polite" aria-atomic="true">
      <div className="status-left">
        <span className="status-indicator" aria-hidden="true">
          ●
        </span>
        <span className="status-message" style={{ color: getToneColor() }}>
          {displayText}
        </span>
      </div>

      <div className="status-right">
        <div>
          <span style={{ color: 'var(--text-muted)' }}>KLIENT: </span>
          <strong style={{ color: selectedCustomer ? 'var(--text-bright)' : 'var(--warning)' }}>
            {selectedCustomer ? selectedCustomer.name : 'BRAK'}
          </strong>
        </div>

        <div>
          <span style={{ color: 'var(--text-muted)' }}>KOSZYK: </span>
          <strong style={{ color: 'var(--text-bright)' }}>{totals.itemCount} szt.</strong>
        </div>

        <div>
          <span style={{ color: 'var(--text-muted)' }}>STORAGE: </span>
          <span className="badge badge-accent" style={{ padding: '0.1rem 0.35rem' }}>
            INDEXED_DB
          </span>
        </div>
      </div>
    </footer>
  );
}
