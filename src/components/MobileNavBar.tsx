import { useShopStore } from '@/store/useShopStore';

export interface MobileNavBarProps {
  showAdminView: boolean;
}

function scrollToSection(sectionId: string) {
  const el = document.getElementById(sectionId);
  if (!el) return;

  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  el.scrollIntoView({
    behavior: prefersReducedMotion ? 'auto' : 'smooth',
    block: 'start',
  });
}

function scrollToTop() {
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  window.scrollTo({
    top: 0,
    behavior: prefersReducedMotion ? 'auto' : 'smooth',
  });
}

export function MobileNavBar({ showAdminView }: MobileNavBarProps) {
  const { getCartTotals, setActiveView } = useShopStore();
  const totals = getCartTotals();

  if (showAdminView) {
    return (
      <nav className="mobile-bottom-nav" aria-label="Nawigacja mobilna administratora">
        <button
          type="button"
          className="mobile-nav-btn"
          onClick={scrollToTop}
          aria-label="GÓRA — przewiń do początku panelu"
        >
          <span>
            <span aria-hidden="true">↑ </span>GÓRA
          </span>
        </button>
        <button
          type="button"
          className="mobile-nav-btn mobile-nav-btn--highlight"
          onClick={() => {
            setActiveView('shop');
            scrollToTop();
          }}
          aria-label="SKLEP — powrót do widoku sklepu"
        >
          <span>
            <span aria-hidden="true">&lt;- </span>SKLEP
          </span>
        </button>
      </nav>
    );
  }

  return (
    <nav className="mobile-bottom-nav" aria-label="Szybka nawigacja mobilna">
      <button
        type="button"
        className="mobile-nav-btn"
        onClick={() => scrollToSection('panel-catalog')}
        aria-label="KATALOG — przejdź do sekcji produktów"
      >
        <span>KATALOG</span>
      </button>
      <button
        type="button"
        className={`mobile-nav-btn ${totals.itemCount > 0 ? 'mobile-nav-btn--highlight' : ''}`}
        onClick={() => scrollToSection('panel-cart')}
        aria-label={`KOSZYK (${totals.itemCount}) — przejdź do sekcji koszyka`}
      >
        <span>KOSZYK ({totals.itemCount})</span>
      </button>
      <button
        type="button"
        className="mobile-nav-btn"
        onClick={() => scrollToSection('panel-customers')}
        aria-label="KLIENT — przejdź do bazy klientów"
      >
        <span>KLIENT</span>
      </button>
      <button
        type="button"
        className="mobile-nav-btn"
        onClick={() => scrollToSection('panel-checkout')}
        aria-label="KASA — przejdź do płatności"
      >
        <span>KASA</span>
      </button>
      <button
        type="button"
        className="mobile-nav-btn"
        onClick={() => scrollToSection('panel-orders')}
        aria-label="HISTORIA — przejdź do zamówień"
      >
        <span>HISTORIA</span>
      </button>
    </nav>
  );
}
