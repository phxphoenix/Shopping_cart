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

  it('removes a customer when clicking USUŃ', async () => {
    const user = userEvent.setup();
    render(<CustomersPanel />);

    const deleteBtn = screen.getByRole('button', { name: /Usuń klienta Anna Nowak/i });
    await user.click(deleteBtn);

    expect(useShopStore.getState().customers.some((c) => c.id === 'c2')).toBe(false);
  });
});
