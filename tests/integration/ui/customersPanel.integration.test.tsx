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
      isAdminAuthenticated: true,
      customers: [...initialCustomers],
      selectedCustomerId: 'c-1',
      orders: [existingOrder],
    });
  });

  it('renders registered customers and active customer badge', () => {
    render(<CustomersPanel />);

    expect(screen.getByRole('heading', { name: /\/\/ BAZA KLIENTÓW \(2\)/i })).toBeInTheDocument();
    expect(screen.getByText(/Jan Kowalski \(jan@kowalski\.pl\)/i)).toBeInTheDocument();
    expect(screen.getByText('Anna Nowak')).toBeInTheDocument();
  });

  it('adds a valid new customer, updates store, and clears form inputs', async () => {
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
    expect(screen.getByText('(tomasz@teatr.pl)')).toBeInTheDocument();
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
    expect(screen.getByText(/Nieprawidłowy adres email/i)).toBeInTheDocument();
    expect(useShopStore.getState().customers).toHaveLength(2);
  });

  it('allows selecting an active customer from the list', async () => {
    const user = userEvent.setup();
    render(<CustomersPanel />);

    // Initially c-1 is selected
    expect(screen.getByText(/AKTYWNY KLIENT DO ZAMÓWIENIA:/i)).toBeInTheDocument();
    expect(screen.getByText(/Jan Kowalski \(jan@kowalski\.pl\)/i)).toBeInTheDocument();

    // Select Anna Nowak
    const selectAnnaBtn = screen.getByRole('button', {
      name: /Anna Nowak \(anna@nowak\.pl\)/i,
    });
    await user.click(selectAnnaBtn);

    expect(useShopStore.getState().selectedCustomerId).toBe('c-2');
    expect(screen.getByText(/Anna Nowak \(anna@nowak\.pl\)/i)).toBeInTheDocument();
  });

  it('safely deletes customer without breaking existing order customer snapshot', async () => {
    const user = userEvent.setup();
    render(<CustomersPanel />);

    // Delete Anna Nowak (who has existingOrder ord-hist-01)
    const deleteAnnaBtn = screen.getByRole('button', { name: /Usuń klienta Anna Nowak/i });
    await user.click(deleteAnnaBtn);

    // Anna Nowak is removed from customer database
    expect(useShopStore.getState().customers).toHaveLength(1);
    expect(screen.queryByText(/Usuń klienta Anna Nowak/i)).not.toBeInTheDocument();

    // Verify existing order still preserves the customer snapshot safely!
    const orders = useShopStore.getState().orders;
    expect(orders).toHaveLength(1);
    expect(orders[0]?.customer.name).toBe('Anna Nowak');
    expect(orders[0]?.customer.email).toBe('anna@nowak.pl');
  });
});
