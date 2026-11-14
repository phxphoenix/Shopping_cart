import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '@/App';
import { DEFAULT_CATEGORIES, DEFAULT_CATALOG } from '@/domain/catalog';
import { toCents } from '@/domain/money';
import type { Order } from '@/domain/schemas';
import { useShopStore } from '@/store/useShopStore';

describe('AdminPanel UI Integration', () => {
  const initialCustomers = [
    { id: 'c-1', name: 'Jan Kowalski', email: 'jan@kowalski.pl' },
    { id: 'c-2', name: 'Anna Nowak', email: 'anna@nowak.pl' },
  ];

  const existingOrder: Order = {
    id: 'ord-hist-anna',
    timestamp: '2026-11-14 10:00:00',
    customer: { id: 'c-2', name: 'Anna Nowak', email: 'anna@nowak.pl' },
    items: [
      {
        id: 'p1',
        name: 'Laptop',
        priceCents: toCents(349999),
        quantity: 1,
        category: 'Elektronika',
      },
    ],
    subtotalCents: toCents(349999),
    deliveryCents: toCents(0),
    totalCents: toCents(349999),
    paymentMethod: 'card',
    paymentDetails: {
      method: 'card',
      maskedCard: '**** **** **** 0366',
      last4: '0366',
      expiry: '12/28',
    },
  };

  beforeEach(() => {
    useShopStore.setState({
      isInitialized: true,
      isLoading: false,
      isAdminAuthenticated: false,
      activeView: 'shop',
      categories: [...DEFAULT_CATEGORIES],
      catalog: [...DEFAULT_CATALOG],
      customers: [...initialCustomers],
      selectedCustomerId: 'c-1',
      orders: [existingOrder],
      cart: [],
      settings: { crtFx: true },
      statusMessage: null,
      statusTone: 'info',
      unlockedCustomerEmails: {},
    });
  });

  it('completes full admin login flow via HeaderBar + AdminLoginModal (rejects wrong password, opens AdminPanel on valid password)', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Initially in shop view
    expect(screen.getByRole('heading', { name: /\/\/ KATALOG PRODUKTÓW/i })).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: /\/\/ SEKCJA ADMINISTRACYJNA/i })
    ).not.toBeInTheDocument();

    // Click PANEL ADMINA in HeaderBar
    const adminBtn = screen.getByRole('button', { name: 'PANEL ADMINA' });
    await user.click(adminBtn);

    // Modal dialog is open
    const modal = screen.getByRole('dialog', { name: /\/\/ AUTORYZACJA ADMINISTRATORA/i });
    expect(modal).toBeInTheDocument();

    const passwordInput = screen.getByLabelText(/Hasło dostępu administratora:/i);
    const authBtn = screen.getByRole('button', { name: /AUTORYZUJ DOSTĘP/i });

    // Submit invalid password
    await user.type(passwordInput, 'zlehaslo');
    await user.click(authBtn);

    expect(screen.getByRole('alert')).toHaveTextContent(/Nieprawidłowe hasło administratora/i);
    expect(
      screen.queryByRole('heading', { name: /\/\/ SEKCJA ADMINISTRACYJNA/i })
    ).not.toBeInTheDocument();

    // Clear and submit correct password
    await user.clear(passwordInput);
    await user.type(passwordInput, 'admin123');
    await user.click(authBtn);

    // Modal closed and AdminPanel rendered
    expect(
      screen.getByRole('heading', { name: /\/\/ SEKCJA ADMINISTRACYJNA \/\/ TRYB UPRAWNIONY/i })
    ).toBeInTheDocument();
    expect(useShopStore.getState().isAdminAuthenticated).toBe(true);
    expect(useShopStore.getState().activeView).toBe('admin');
  }, 15000);

  it('manages categories: adds new category, edits category name, and deletes category with automatic product migration to Ogólne', async () => {
    const user = userEvent.setup();
    useShopStore.setState({
      isAdminAuthenticated: true,
      activeView: 'admin',
    });
    render(<App />);

    // In AdminPanel, default tab is [1] KATEGORIE
    expect(screen.getByRole('tab', { name: /\[1\] KATEGORIE/i })).toHaveAttribute(
      'aria-selected',
      'true'
    );

    // 1. Add new category
    const nameInput = screen.getByLabelText(/Nazwa kategorii/i);
    const descInput = screen.getByLabelText(/Opis kategorii/i);
    const addCatBtn = screen.getByRole('button', { name: /\+ DODAJ KATEGORIĘ/i });

    await user.type(nameInput, 'Cyberdecki');
    await user.type(descInput, 'Mobilne terminale hakerskie');
    await user.click(addCatBtn);

    expect(screen.getByText('Cyberdecki')).toBeInTheDocument();
    expect(useShopStore.getState().categories.some((c) => c.name === 'Cyberdecki')).toBe(true);

    // 2. Edit category
    const editCatBtn = screen.getByRole('button', { name: /Edytuj kategorię Cyberdecki/i });
    await user.click(editCatBtn);

    await user.clear(nameInput);
    await user.type(nameInput, 'Cyberdecki Pro');
    const saveCatBtn = screen.getByRole('button', { name: /ZAPISZ ZMIANY/i });
    await user.click(saveCatBtn);

    expect(screen.getByText('Cyberdecki Pro')).toBeInTheDocument();

    // 3. Delete non-default category (e.g. Odziez which has products assigned)
    const odziezProductsBefore = useShopStore
      .getState()
      .catalog.filter((p) => p.category === 'Odziez');
    expect(odziezProductsBefore.length).toBeGreaterThan(0);

    const deleteOdziezBtn = screen.getByRole('button', { name: /Usuń kategorię Odziez/i });
    await user.click(deleteOdziezBtn);

    // Migration prompt appears
    expect(
      screen.getByText(/Przypisane produkty.*zostaną automatycznie przeniesione/i)
    ).toBeInTheDocument();

    const confirmDeleteBtn = screen.getByRole('button', {
      name: /POTWIERDŹ USUNIĘCIE I PRZENIEŚ/i,
    });
    await user.click(confirmDeleteBtn);

    // Category removed
    expect(useShopStore.getState().categories.some((c) => c.name === 'Odziez')).toBe(false);

    // Formerly 'Odziez' products moved to default category 'Ogólne'
    const migratedProducts = useShopStore
      .getState()
      .catalog.filter((p) => odziezProductsBefore.some((orig) => orig.id === p.id));
    for (const prod of migratedProducts) {
      expect(prod.category).toBe('Ogólne');
      expect(prod.categoryId).toBe('cat-default');
    }
  }, 15000);

  it('migrates products between two categories in [3] MIGRACJA PRODUKTÓW tab', async () => {
    const user = userEvent.setup();
    useShopStore.setState({
      isAdminAuthenticated: true,
      activeView: 'admin',
    });
    render(<App />);

    // Switch to [3] MIGRACJA PRODUKTÓW tab
    await user.click(screen.getByRole('tab', { name: /\[3\] MIGRACJA PRODUKTÓW/i }));

    expect(
      screen.getByText(/\/\/ MASOWA MIGRACJA PRODUKTÓW MIĘDZY KATEGORIAMI/i)
    ).toBeInTheDocument();

    // Source category is Elektronika by default, target is Odziez by default
    // Let's migrate all Elektronika products to Edukacja
    const targetSelect = screen.getByLabelText(/Kategoria docelowa/i);
    await user.selectOptions(targetSelect, 'cat-edukacja');

    // Click MIGRUJ WYBRANE PRODUKTY
    const migrateBtn = screen.getByRole('button', { name: /MIGRUJ WYBRANE PRODUKTY/i });
    await user.click(migrateBtn);

    expect(screen.getByText(/SUKCES: Pomyślnie przeniesiono/i)).toBeInTheDocument();

    // Verify Laptop (was Elektronika) is now Edukacja
    const laptop = useShopStore.getState().catalog.find((p) => p.name === 'Laptop');
    expect(laptop?.category).toBe('Edukacja');
    expect(laptop?.categoryId).toBe('cat-edukacja');
  });

  it('manages products: adds new product, updates price/stock, and deletes product with immediate reactive impact on CatalogPanel and CartPanel', async () => {
    const user = userEvent.setup();
    useShopStore.setState({
      isAdminAuthenticated: true,
      activeView: 'admin',
    });
    render(<App />);

    // 1. Add new product in [2] PRODUKTY tab
    await user.click(screen.getByRole('tab', { name: /\[2\] PRODUKTY/i }));

    const skuInput = screen.getByLabelText(/SKU \(Unikalny kod\):/i);
    const nameInput = screen.getByLabelText(/Nazwa produktu:/i);
    const priceInput = screen.getByLabelText(/Cena \(PLN\):/i);
    const stockInput = screen.getByLabelText(/Stan magazynowy \(szt\.\):/i);
    const descInput = screen.getByLabelText(/Opis produktu:/i);
    const addProductBtn = screen.getByRole('button', { name: /\+ DODAJ PRODUKT DO KATALOGU/i });

    await user.type(skuInput, 'HW-CABLE-09');
    await user.type(nameInput, 'Kabel VGA Gold');
    await user.type(priceInput, '29.99');
    await user.clear(stockInput);
    await user.type(stockInput, '10');
    await user.type(descInput, 'Pozłacany kabel wideo VGA');
    await user.click(addProductBtn);

    expect(screen.getByText('Kabel VGA Gold')).toBeInTheDocument();

    // 2. Return to shop view and verify in CatalogPanel
    await user.click(screen.getByRole('button', { name: /\[<- POWRÓT DO SKLEPU\]/i }));
    expect(screen.getByRole('heading', { name: /\/\/ KATALOG PRODUKTÓW/i })).toBeInTheDocument();

    const vgaArticle = screen.getByText('Kabel VGA Gold').closest('article');
    expect(vgaArticle).not.toBeNull();
    if (!vgaArticle) throw new Error('Product article not found');

    expect(within(vgaArticle).getByText(/HW-CABLE-09/i)).toBeInTheDocument();
    expect(within(vgaArticle).getByText('29,99 zł')).toBeInTheDocument();
    expect(within(vgaArticle).getByText(/Stan: 10 szt\./i)).toBeInTheDocument();

    // 3. Add Kabel VGA Gold to cart
    const addToCartBtn = within(vgaArticle).getByRole('button', { name: /DODAJ ->/i });
    await user.click(addToCartBtn);

    // Verify in CartPanel
    const cartPanel = screen.getByRole('heading', { name: /\/\/ KOSZYK/i }).closest('section');
    expect(cartPanel).not.toBeNull();
    if (!cartPanel) throw new Error('Cart panel not found');

    expect(within(cartPanel).getByText('Kabel VGA Gold')).toBeInTheDocument();
    expect(within(cartPanel).getAllByText('29,99 zł').length).toBeGreaterThanOrEqual(1);

    // 4. Switch back to Admin -> edit price to 49.99
    await user.click(screen.getByRole('button', { name: 'PANEL ADMINA' }));
    await user.click(screen.getByRole('tab', { name: /\[2\] PRODUKTY/i }));

    const editVgaBtn = screen.getByRole('button', { name: /Edytuj produkt Kabel VGA Gold/i });
    await user.click(editVgaBtn);

    const editPriceInput = screen.getByLabelText(/Cena \(PLN\):/i);
    await user.clear(editPriceInput);
    await user.type(editPriceInput, '49.99');
    await user.click(screen.getByRole('button', { name: /ZAPISZ ZMIANY PRODUKTU/i }));

    // Switch to shop view -> Cart line total immediately updated via syncCartWithCatalog!
    await user.click(screen.getByRole('button', { name: /\[<- POWRÓT DO SKLEPU\]/i }));
    const updatedCartPanel = screen
      .getByRole('heading', { name: /\/\/ KOSZYK/i })
      .closest('section');
    expect(updatedCartPanel).not.toBeNull();
    if (!updatedCartPanel) throw new Error('Updated cart panel not found');
    expect(within(updatedCartPanel).getAllByText('49,99 zł').length).toBeGreaterThanOrEqual(1);

    // 5. Switch back to Admin -> set stock to 0 / inStock false
    await user.click(screen.getByRole('button', { name: 'PANEL ADMINA' }));
    await user.click(screen.getByRole('tab', { name: /\[2\] PRODUKTY/i }));

    await user.click(screen.getByRole('button', { name: /Edytuj produkt Kabel VGA Gold/i }));
    const inStockCheckbox = screen.getByLabelText(/Dostępny w sprzedaży \(inStock\)/i);
    await user.click(inStockCheckbox); // uncheck inStock
    await user.click(screen.getByRole('button', { name: /ZAPISZ ZMIANY PRODUKTU/i }));

    // Switch to shop view -> product was removed from cart because it became unavailable
    await user.click(screen.getByRole('button', { name: /\[<- POWRÓT DO SKLEPU\]/i }));
    const cartAfterUnstock = screen
      .getByRole('heading', { name: /\/\/ KOSZYK/i })
      .closest('section');
    expect(cartAfterUnstock).not.toBeNull();
    if (!cartAfterUnstock) throw new Error('Cart after unstock not found');
    expect(within(cartAfterUnstock).queryByText('Kabel VGA Gold')).not.toBeInTheDocument();

    // In CatalogPanel, button is disabled and badge shows [NIEDOSTĘPNY]
    const updatedVgaArticle = screen.getByText('Kabel VGA Gold').closest('article');
    expect(updatedVgaArticle).not.toBeNull();
    if (!updatedVgaArticle) throw new Error('Updated article not found');
    expect(within(updatedVgaArticle).getByText('[NIEDOSTĘPNY]')).toBeInTheDocument();
    expect(within(updatedVgaArticle).getByRole('button', { name: /DODAJ ->/i })).toBeDisabled();

    // 6. Delete product in AdminPanel
    await user.click(screen.getByRole('button', { name: 'PANEL ADMINA' }));
    await user.click(screen.getByRole('tab', { name: /\[2\] PRODUKTY/i }));

    const deleteVgaBtn = screen.getByRole('button', { name: /Usuń produkt Kabel VGA Gold/i });
    await user.click(deleteVgaBtn);

    // Switch to shop view -> product is completely removed from CatalogPanel
    await user.click(screen.getByRole('button', { name: /\[<- POWRÓT DO SKLEPU\]/i }));
    expect(screen.queryByText('Kabel VGA Gold')).not.toBeInTheDocument();
  }, 15000);

  it('deletes customer in [4] KLIENCI tab of AdminPanel and verifies that their order history in OrderHistoryPanel remains intact', async () => {
    const user = userEvent.setup();
    useShopStore.setState({
      isAdminAuthenticated: true,
      activeView: 'admin',
    });
    render(<App />);

    // Switch to [4] KLIENCI tab
    await user.click(screen.getByRole('tab', { name: /\[4\] KLIENCI/i }));

    // Both customers listed with unmasked emails
    expect(screen.getByText('jan@kowalski.pl')).toBeInTheDocument();
    expect(screen.getByText('anna@nowak.pl')).toBeInTheDocument();

    // Delete customer Anna Nowak
    const deleteAnnaBtn = screen.getByRole('button', { name: /Usuń klienta Anna Nowak/i });
    await user.click(deleteAnnaBtn);

    const confirmDeleteBtn = screen.getByRole('button', { name: /POTWIERDŹ USUŃ\?/i });
    await user.click(confirmDeleteBtn);

    // Customer removed from active customer list
    expect(useShopStore.getState().customers.some((c) => c.name === 'Anna Nowak')).toBe(false);

    // Return to shop view
    await user.click(screen.getByRole('button', { name: /\[<- POWRÓT DO SKLEPU\]/i }));

    // In CustomersPanel, Anna Nowak is no longer present
    const customersPanel = screen
      .getByRole('heading', { name: /\/\/ BAZA KLIENTÓW/i })
      .closest('section');
    expect(customersPanel).not.toBeNull();
    if (!customersPanel) throw new Error('Customers panel not found');
    expect(within(customersPanel).queryByText('Anna Nowak')).not.toBeInTheDocument();

    // In OrderHistoryPanel, Anna Nowak's historical order remains 100% intact!
    const ordersPanel = screen
      .getByRole('heading', { name: /\/\/ HISTORIA ZAMÓWIEŃ/i })
      .closest('section');
    expect(ordersPanel).not.toBeNull();
    if (!ordersPanel) throw new Error('Orders panel not found');

    const annaOrderRow = within(ordersPanel).getByText('Anna Nowak').closest('tr');
    expect(annaOrderRow).not.toBeNull();
    if (!annaOrderRow) throw new Error('Anna order row not found');
    expect(within(annaOrderRow).getByText('Anna Nowak')).toBeInTheDocument();

    // Open order details modal
    const detailsBtn = within(annaOrderRow).getByRole('button', { name: /Szczegóły/i });
    await user.click(detailsBtn);

    const orderModal = screen.getByRole('dialog', { name: /\/\/ SZCZEGÓŁY ZAMÓWIENIA/i });
    expect(orderModal).toBeInTheDocument();
    expect(within(orderModal).getByText('Anna Nowak')).toBeInTheDocument();
    expect(within(orderModal).getByText('anna@nowak.pl')).toBeInTheDocument();

    // Close modal
    await user.click(within(orderModal).getByRole('button', { name: /ZAMKNIJ \[ESC\]/i }));
    expect(
      screen.queryByRole('dialog', { name: /\/\/ SZCZEGÓŁY ZAMÓWIENIA/i })
    ).not.toBeInTheDocument();
  });
});
