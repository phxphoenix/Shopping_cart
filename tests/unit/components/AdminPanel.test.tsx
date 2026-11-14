import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdminPanel } from '@/components/AdminPanel';
import { DEFAULT_CATEGORIES, DEFAULT_CATALOG } from '@/domain/catalog';
import { toCents } from '@/domain/money';
import { useShopStore } from '@/store/useShopStore';

describe('AdminPanel component', () => {
  beforeEach(() => {
    useShopStore.setState({
      isAdminAuthenticated: true,
      activeView: 'admin',
      categories: [...DEFAULT_CATEGORIES],
      catalog: [...DEFAULT_CATALOG],
      customers: [
        { id: 'c1', name: 'Jan Kowalski', email: 'jan.kowalski@example.com' },
        { id: 'c2', name: 'Anna Nowak', email: 'anna.nowak@example.com' },
      ],
      orders: [
        {
          id: 'ord-1',
          timestamp: '2026-11-14 12:00:00',
          customer: { id: 'c1', name: 'Jan Kowalski', email: 'jan.kowalski@example.com' },
          items: [],
          subtotalCents: toCents(10000),
          deliveryCents: toCents(0),
          totalCents: toCents(10000),
          paymentMethod: 'card',
          paymentDetails: {
            method: 'card',
            maskedCard: '**** **** **** 1234',
            last4: '1234',
            expiry: '12/28',
          },
        },
      ],
    });
  });

  it('renders admin header and navigation tabs', () => {
    render(<AdminPanel />);

    expect(
      screen.getByRole('heading', { name: /\/\/ SEKCJA ADMINISTRACYJNA \/\/ TRYB UPRAWNIONY/i })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /\[<- POWRÓT DO SKLEPU\]/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /\[WYLOGUJ ADMINA\]/i })).toBeInTheDocument();

    expect(screen.getByRole('tab', { name: /\[1\] KATEGORIE/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /\[2\] PRODUKTY/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /\[3\] MIGRACJA PRODUKTÓW/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /\[4\] KLIENCI/i })).toBeInTheDocument();
  });

  it('switches to shop view when clicking return to shop button', async () => {
    const user = userEvent.setup();
    render(<AdminPanel />);

    await user.click(screen.getByRole('button', { name: /\[<- POWRÓT DO SKLEPU\]/i }));
    expect(useShopStore.getState().activeView).toBe('shop');
  });

  it('logs out admin when clicking logout button', async () => {
    const user = userEvent.setup();
    render(<AdminPanel />);

    await user.click(screen.getByRole('button', { name: /\[WYLOGUJ ADMINA\]/i }));
    expect(useShopStore.getState().isAdminAuthenticated).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Tab 1: KATEGORIE Tests
  // -------------------------------------------------------------------------
  it('renders categories list with [DOMYŚLNA] badge and disabled delete button for default category', () => {
    render(<AdminPanel />);

    expect(screen.getByText('Ogólne')).toBeInTheDocument();
    expect(screen.getByText('[DOMYŚLNA]')).toBeInTheDocument();

    const deleteDefaultBtn = screen.getByRole('button', { name: /Usuń kategorię Ogólne/i });
    expect(deleteDefaultBtn).toBeDisabled();
  });

  it('adds a new category and displays it in list', async () => {
    const user = userEvent.setup();
    render(<AdminPanel />);

    const nameInput = screen.getByLabelText(/Nazwa kategorii/i);
    const descInput = screen.getByLabelText(/Opis kategorii/i);
    const submitBtn = screen.getByRole('button', { name: /\+ DODAJ KATEGORIĘ/i });

    await user.type(nameInput, 'Cyberdecki');
    await user.type(descInput, 'Przenośne terminale retro');
    await user.click(submitBtn);

    expect(screen.getByText('Cyberdecki')).toBeInTheDocument();
    expect(screen.getByText('Przenośne terminale retro')).toBeInTheDocument();
    expect(useShopStore.getState().categories.some((c) => c.name === 'Cyberdecki')).toBe(true);
  });

  it('edits an existing category name and description', async () => {
    const user = userEvent.setup();
    render(<AdminPanel />);

    const editElektronikaBtn = screen.getByRole('button', {
      name: /Edytuj kategorię Elektronika/i,
    });
    await user.click(editElektronikaBtn);

    const nameInput = screen.getByLabelText(/Nazwa kategorii/i);
    await user.clear(nameInput);
    await user.type(nameInput, 'Super Elektronika');

    const saveBtn = screen.getByRole('button', { name: /ZAPISZ ZMIANY/i });
    await user.click(saveBtn);

    expect(screen.getByText('Super Elektronika')).toBeInTheDocument();
    expect(useShopStore.getState().categories.some((c) => c.name === 'Super Elektronika')).toBe(
      true
    );
  });

  it('deletes a non-default category and moves products to target category', async () => {
    const user = userEvent.setup();
    render(<AdminPanel />);

    const deleteOdziezBtn = screen.getByRole('button', { name: /Usuń kategorię Odziez/i });
    await user.click(deleteOdziezBtn);

    expect(
      screen.getByText(/Przypisane produkty.*zostaną automatycznie przeniesione/i)
    ).toBeInTheDocument();

    const confirmBtn = screen.getByRole('button', { name: /POTWIERDŹ USUNIĘCIE I PRZENIEŚ/i });
    await user.click(confirmBtn);

    expect(useShopStore.getState().categories.some((c) => c.name === 'Odziez')).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Tab 2: PRODUKTY Tests
  // -------------------------------------------------------------------------
  it('switches to [2] PRODUKTY tab, adds a new product, and displays it in catalog table', async () => {
    const user = userEvent.setup();
    render(<AdminPanel />);

    await user.click(screen.getByRole('tab', { name: /\[2\] PRODUKTY/i }));

    const skuInput = screen.getByLabelText(/SKU \(Unikalny kod\):/i);
    const nameInput = screen.getByLabelText(/Nazwa produktu:/i);
    const priceInput = screen.getByLabelText(/Cena \(PLN\):/i);
    const stockInput = screen.getByLabelText(/Stan magazynowy \(szt\.\):/i);
    const descInput = screen.getByLabelText(/Opis produktu:/i);
    const submitBtn = screen.getByRole('button', { name: /\+ DODAJ PRODUKT DO KATALOGU/i });

    await user.type(skuInput, 'TEST-PROD-01');
    await user.type(nameInput, 'Nowy Monitor CRT');
    await user.type(priceInput, '499.50');
    await user.clear(stockInput);
    await user.type(stockInput, '7');
    await user.type(descInput, 'Świetny monitor kineskopowy');
    await user.click(submitBtn);

    expect(screen.getByText('Nowy Monitor CRT')).toBeInTheDocument();
    expect(screen.getByText('499,50 zł')).toBeInTheDocument();
    expect(screen.getByText('7 szt.')).toBeInTheDocument();
    expect(useShopStore.getState().catalog.some((p) => p.sku === 'TEST-PROD-01')).toBe(true);
  });

  it('edits an existing product from the table', async () => {
    const user = userEvent.setup();
    render(<AdminPanel />);

    await user.click(screen.getByRole('tab', { name: /\[2\] PRODUKTY/i }));

    const editBtn = screen.getByRole('button', { name: /Edytuj produkt Laptop/i });
    await user.click(editBtn);

    const nameInput = screen.getByLabelText(/Nazwa produktu:/i);
    await user.clear(nameInput);
    await user.type(nameInput, 'Laptop Pro 2026');

    const saveBtn = screen.getByRole('button', { name: /ZAPISZ ZMIANY PRODUKTU/i });
    await user.click(saveBtn);

    expect(screen.getByText('Laptop Pro 2026')).toBeInTheDocument();
    expect(useShopStore.getState().catalog.some((p) => p.name === 'Laptop Pro 2026')).toBe(true);
  });

  it('deletes a product from catalog table', async () => {
    const user = userEvent.setup();
    render(<AdminPanel />);

    await user.click(screen.getByRole('tab', { name: /\[2\] PRODUKTY/i }));

    const deleteBtn = screen.getByRole('button', { name: /Usuń produkt Laptop/i });
    await user.click(deleteBtn);

    expect(useShopStore.getState().catalog.some((p) => p.name === 'Laptop')).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Tab 3: MIGRACJA PRODUKTÓW Tests
  // -------------------------------------------------------------------------
  it('switches to [3] MIGRACJA PRODUKTÓW tab and migrates selected products', async () => {
    const user = userEvent.setup();
    render(<AdminPanel />);

    await user.click(screen.getByRole('tab', { name: /\[3\] MIGRACJA PRODUKTÓW/i }));

    expect(
      screen.getByText(/\/\/ MASOWA MIGRACJA PRODUKTÓW MIĘDZY KATEGORIAMI/i)
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Zaznacz wszystkie/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Odznacz wszystkie/i })).toBeInTheDocument();

    const migrateBtn = screen.getByRole('button', { name: /MIGRUJ WYBRANE PRODUKTY/i });
    await user.click(migrateBtn);

    expect(screen.getByText(/SUKCES: Pomyślnie przeniesiono/i)).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Tab 4: KLIENCI Tests
  // -------------------------------------------------------------------------
  it('switches to [4] KLIENCI tab, shows unmasked emails, order counts, and allows deleting a customer', async () => {
    const user = userEvent.setup();
    render(<AdminPanel />);

    await user.click(screen.getByRole('tab', { name: /\[4\] KLIENCI/i }));

    // Unmasked emails are displayed in admin panel
    expect(screen.getByText('jan.kowalski@example.com')).toBeInTheDocument();
    expect(screen.getByText('anna.nowak@example.com')).toBeInTheDocument();

    // Order count is computed
    expect(screen.getAllByText(/Złożone zamówienia:/i).length).toBe(2);

    // Click USUŃ on Anna Nowak
    const deleteBtn = screen.getByRole('button', { name: /Usuń klienta Anna Nowak/i });
    await user.click(deleteBtn);

    // Confirm prompt appears
    const confirmBtn = screen.getByRole('button', { name: /POTWIERDŹ USUŃ\?/i });
    await user.click(confirmBtn);

    expect(useShopStore.getState().customers.some((c) => c.id === 'c2')).toBe(false);
  });
});
