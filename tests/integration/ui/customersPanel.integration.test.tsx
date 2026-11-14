import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CustomersPanel } from '@/components/CustomersPanel';
import { toCents } from '@/domain/money';
import type { Order } from '@/domain/schemas';
import { useShopStore } from '@/store/useShopStore';

describe('CustomersPanel UI Integration', () => {
  const initialCustomers = [
    { id: 'c-1', name: 'Jan Kowalski', email: 'jan@kowalski.pl' },
    { id: 'c-2', name: 'Anna Nowak', email: 'anna@nowak.pl' },
  ];

  const existingOrder: Order = {
    id: 'ord-hist-01',
    timestamp: '2026-11-13 10:00:00',
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
      isAdminAuthenticated: false,
      unlockedCustomerEmails: {},
      customers: [...initialCustomers],
      selectedCustomerId: 'c-1',
      orders: [existingOrder],
    });
  });

  it('renders registered customers with masked emails in public view without delete button', () => {
    render(<CustomersPanel />);

    expect(screen.getByRole('heading', { name: /\/\/ BAZA KLIENTÓW \(2\)/i })).toBeInTheDocument();
    // Names appear in badge and in list
    expect(screen.getAllByText(/Jan Kowalski/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Anna Nowak')).toBeInTheDocument();
    // Emails masked in public view
    expect(screen.getAllByText(/j\*\*\*n@kowalski\.pl/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/\(a\*\*\*a@nowak\.pl\)/i)).toBeInTheDocument();

    // Verify delete button is NOT present in public view
    expect(screen.queryByRole('button', { name: /USUŃ/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Usuń klienta/i })).not.toBeInTheDocument();

    // Verify information note is present
    expect(
      screen.getByText(
        /Usuwanie kont klientów jest dostępne wyłącznie dla uprawnionych sesji w Panelu Administracyjnym/i
      )
    ).toBeInTheDocument();
  });

  it('displays full unmasked email when isAdminAuthenticated is true', () => {
    useShopStore.setState({ isAdminAuthenticated: true });
    render(<CustomersPanel />);

    expect(screen.getAllByText(/\(jan@kowalski\.pl\)/i).length).toBe(2);
    expect(screen.getByText(/\(anna@nowak\.pl\)/i)).toBeInTheDocument();
  });

  it('adds a valid new customer, updates store, and clears form inputs with session unmasking', async () => {
    const user = userEvent.setup();
    render(<CustomersPanel />);

    const nameInput = screen.getByLabelText(/Imię i nazwisko:/i);
    const emailInput = screen.getByLabelText(/Adres e-mail:/i);
    const submitBtn = screen.getByRole('button', { name: /\+ DODAJ KLIENTA/i });

    await user.type(nameInput, 'Tomasz Karolak');
    await user.type(emailInput, 'tomasz@teatr.pl');
    await user.click(submitBtn);

    // Form inputs cleared
    expect(nameInput).toHaveValue('');
    expect(emailInput).toHaveValue('');

    // Customer added to list and store
    expect(screen.getByText('Tomasz Karolak')).toBeInTheDocument();
    expect(useShopStore.getState().customers).toHaveLength(3);
  });

  it('validates empty name or invalid email and displays error alert', async () => {
    const user = userEvent.setup();
    render(<CustomersPanel />);

    const nameInput = screen.getByLabelText(/Imię i nazwisko:/i);
    const emailInput = screen.getByLabelText(/Adres e-mail:/i);
    const submitBtn = screen.getByRole('button', { name: /\+ DODAJ KLIENTA/i });

    // Submit with empty fields
    await user.click(submitBtn);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(useShopStore.getState().customers).toHaveLength(2);

    // Enter name but invalid email
    await user.type(nameInput, 'Niepoprawny Klient');
    await user.type(emailInput, 'zly-email-bez-malpy');
    await user.click(submitBtn);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/Nieprawidłowy.*adres.*e-mail/i)).toBeInTheDocument();
    expect(useShopStore.getState().customers).toHaveLength(2);
  });

  it('allows selecting an active customer from the list', async () => {
    const user = userEvent.setup();
    render(<CustomersPanel />);

    // Initially c-1 is selected
    expect(screen.getByText(/AKTYWNY KLIENT DO ZAMÓWIENIA:/i)).toBeInTheDocument();

    // Select Anna Nowak
    const selectAnnaBtn = screen.getByRole('button', {
      name: /Anna Nowak/i,
    });
    await user.click(selectAnnaBtn);

    expect(useShopStore.getState().selectedCustomerId).toBe('c-2');
  });

  it('rejects duplicate email registration (case-insensitive) and displays error alert', async () => {
    const user = userEvent.setup();
    render(<CustomersPanel />);

    const nameInput = screen.getByLabelText(/Imię i nazwisko:/i);
    const emailInput = screen.getByLabelText(/Adres e-mail:/i);
    const submitBtn = screen.getByRole('button', { name: /\+ DODAJ KLIENTA/i });

    // Attempt to register with existing email in uppercase
    await user.type(nameInput, 'Jan Inny');
    await user.type(emailInput, 'JAN@KOWALSKI.PL');
    await user.click(submitBtn);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/już zarejestrowany w systemie/i)).toBeInTheDocument();
    expect(useShopStore.getState().customers).toHaveLength(2);
  });

  it('rejects invalid name formats containing numbers or HTML tags and displays error alert', async () => {
    const user = userEvent.setup();
    render(<CustomersPanel />);

    const nameInput = screen.getByLabelText(/Imię i nazwisko:/i);
    const emailInput = screen.getByLabelText(/Adres e-mail:/i);
    const submitBtn = screen.getByRole('button', { name: /\+ DODAJ KLIENTA/i });

    // Digits in name
    await user.type(nameInput, 'Janek123');
    await user.type(emailInput, 'janek123@example.com');
    await user.click(submitBtn);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/cyfry i znaki specjalne są niedozwolone/i)).toBeInTheDocument();
    expect(useShopStore.getState().customers).toHaveLength(2);

    // HTML / XSS tags in name
    await user.clear(nameInput);
    await user.type(nameInput, '<script>alert(1)</script>');
    await user.click(submitBtn);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/cyfry i znaki specjalne są niedozwolone/i)).toBeInTheDocument();
    expect(useShopStore.getState().customers).toHaveLength(2);
  });

  it('rejects bot submission when honeypot field is populated', async () => {
    const user = userEvent.setup();
    render(<CustomersPanel />);

    const nameInput = screen.getByLabelText(/Imię i nazwisko:/i);
    const emailInput = screen.getByLabelText(/Adres e-mail:/i);
    const honeypotInput = screen.getByLabelText(/Strona WWW firmy/i);
    const submitBtn = screen.getByRole('button', { name: /\+ DODAJ KLIENTA/i });

    await user.type(nameInput, 'Bot Internetowy');
    await user.type(emailInput, 'bot@spam.com');
    await user.type(honeypotInput, 'http://spam-link.xyz');
    await user.click(submitBtn);

    expect(screen.getByRole('alert')).toHaveTextContent(/anty-spam honeypot/i);
    expect(useShopStore.getState().customers).toHaveLength(2);
  });
});
