import { useEffect, useState } from 'react';
import {
  HeaderBar,
  CatalogPanel,
  CartPanel,
  CustomersPanel,
  CheckoutPanel,
  OrderHistoryPanel,
  AdminLoginModal,
  AdminPanel,
  StatusBar,
} from '@/components';
import { useShopStore } from '@/store/useShopStore';

export default function App() {
  const { isInitialized, initialize, settings, activeView, isAdminAuthenticated } = useShopStore();
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  // Ekran startowy podczas ładowania danych ze storage
  if (!isInitialized) {
    return (
      <main className="retro-boot-screen">
        <div className="retro-boot-box">
          <h1 className="retro-boot-title">[BOOTING RETRO SHOPPING CART v2.0...]</h1>
          <p className="retro-boot-status">
            SYSTEM STATUS: ONLINE
            <br />
            TERMINAL READY. WAITING FOR HOST COMMAND.
          </p>
        </div>
      </main>
    );
  }

  const crtClassName = settings.crtFx ? 'crt-fx-enabled' : '';
  const showAdminView = activeView === 'admin' && isAdminAuthenticated;

  return (
    <div className={`retro-app ${crtClassName}`}>
      <HeaderBar onOpenLoginModal={() => setIsLoginModalOpen(true)} />

      <main className="retro-main">
        {showAdminView ? (
          <AdminPanel />
        ) : (
          <div className="terminal-grid">
            {/* Lewa kolumna: Katalog produktów oraz Historia zamówień */}
            <div className="terminal-column">
              <CatalogPanel />
              <OrderHistoryPanel />
            </div>

            {/* Prawa kolumna: Baza klientów, Koszyk oraz Kasa */}
            <div className="terminal-column">
              <CustomersPanel />
              <CartPanel />
              <CheckoutPanel />
            </div>
          </div>
        )}
      </main>

      <StatusBar />

      <AdminLoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
      />
    </div>
  );
}
