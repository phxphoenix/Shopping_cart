import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CustomersPanel } from '@/components/CustomersPanel';
import { useShopStore } from '@/store/useShopStore';

describe('CustomersPanel component', () => {
  beforeEach(() => {
    useShopStore.setState({
      isAdminAuthenticated: true,
      customers: [
        { id: 'c1', name: 'Jan Kowalski', email: 'jan@example.com' },
        { id: 'c2', name: 'Anna Nowak', email: 'anna@example.com' },
      ],
      selectedCustomerId: 'c1',
      unlockedCustomerEmails: {},
    });
  });

  it('renders customers list and displays the active customer', () => {
    render(<CustomersPanel />);
    expect(screen.getByRole('heading', { name: /\/\/ BAZA KLIENTÓW \(2\)/i })).toBeInTheDocument();
    expect(screen.getByText('Jan Kowalski (jan@example.com)')).toBeInTheDocument();
    expect(screen.getByText('Anna Nowak')).toBeInTheDocument();
  });

  it('displays validation error when adding customer with invalid data', async () => {
    const user = userEvent.setup();
    render(<CustomersPanel />);

    const submitBtn = screen.getByRole('button', { name: /\+ DODAJ KLIENTA/i });
    await user.click(submitBtn);

    expect(screen.getByRole('alert')).toHaveTextContent(/BŁĄD/i);
  });

  it('successfully adds a valid customer and selects them', async () => {
    const user = userEvent.setup();
    render(<CustomersPanel />);

    const nameInput = screen.getByLabelText(/Imię i nazwisko:/i);
    const emailInput = screen.getByLabelText(/Adres e-mail:/i);
    const submitBtn = screen.getByRole('button', { name: /\+ DODAJ KLIENTA/i });

    await user.type(nameInput, 'Piotr Zieliński');
    await user.type(emailInput, 'piotr@example.com');
    await user.click(submitBtn);

    expect(screen.getByText('Piotr Zieliński')).toBeInTheDocument();
    expect(useShopStore.getState().customers.some((c) => c.name === 'Piotr Zieliński')).toBe(true);
  });

  it('switches active customer when clicking another customer', async () => {
    const user = userEvent.setup();
    render(<CustomersPanel />);

    const annaBtn = screen.getByRole('button', {
      name: /\[○\] Anna Nowak/i,
    });
    await user.click(annaBtn);

    expect(useShopStore.getState().selectedCustomerId).toBe('c2');
  });

  it('does NOT render USUŃ button in public view and shows admin notice', () => {
    useShopStore.setState({ isAdminAuthenticated: false });
    render(<CustomersPanel />);

    expect(screen.queryByRole('button', { name: /USUŃ/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Usuń klienta/i })).not.toBeInTheDocument();
    expect(
      screen.getByText(
        /Usuwanie kont klientów jest dostępne wyłącznie dla uprawnionych sesji w Panelu Administracyjnym/i
      )
    ).toBeInTheDocument();
  });

  it('masks email addresses for unauthorized public sessions', () => {
    useShopStore.setState({ isAdminAuthenticated: false, unlockedCustomerEmails: {} });
    render(<CustomersPanel />);

    expect(screen.getAllByText(/j\*\*\*n@example\.com/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/\(a\*\*\*a@example\.com\)/i)).toBeInTheDocument();
  });

  it('unmasks email for customers registered in the current session', () => {
    useShopStore.setState({
      isAdminAuthenticated: false,
      unlockedCustomerEmails: { c1: 'jan@example.com' },
    });
    render(<CustomersPanel />);

    expect(screen.getAllByText(/\(jan@example\.com\)/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/\(a\*\*\*a@example\.com\)/i)).toBeInTheDocument();
  });
});
