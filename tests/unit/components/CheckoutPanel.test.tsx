import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CheckoutPanel } from '@/components/CheckoutPanel';
import { DEFAULT_CATALOG } from '@/domain/catalog';
import { toCents } from '@/domain/money';
import { useShopStore } from '@/store/useShopStore';

describe('CheckoutPanel component', () => {
  beforeEach(() => {
    useShopStore.setState({
      customers: [{ id: 'c1', name: 'Jan Testowy', email: 'jan@test.com' }],
      selectedCustomerId: 'c1',
      cart: [
        {
          product: DEFAULT_CATALOG[0]!,
          quantity: 1,
          lineTotalCents: toCents(349999),
        },
      ],
      orders: [],
    });
  });

  it('renders payment method tabs and active customer info', () => {
    render(<CheckoutPanel />);
    expect(screen.getByRole('heading', { name: /\/\/ KASA & PŁATNOŚĆ/i })).toBeInTheDocument();
    expect(screen.getByText('Jan Testowy')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Karta kredytowa/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /PayPal/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Bitcoin/i })).toBeInTheDocument();
  });

  it('switches to PayPal and Bitcoin forms', async () => {
    const user = userEvent.setup();
    render(<CheckoutPanel />);

    // Switch to PayPal
    await user.click(screen.getByRole('button', { name: /PayPal/i }));
    expect(screen.getByLabelText(/Adres e-mail konta PayPal:/i)).toBeInTheDocument();

    // Switch to Bitcoin
    await user.click(screen.getByRole('button', { name: /Bitcoin/i }));
    expect(screen.getByLabelText(/Adres portfela Bitcoin/i)).toBeInTheDocument();
    expect(screen.getByText(/Równowartość BTC:/i)).toBeInTheDocument();
  });

  it('displays validation error if submitting empty card inputs', async () => {
    const user = userEvent.setup();
    render(<CheckoutPanel />);

    const payBtn = screen.getByRole('button', { name: /ZAMÓW I ZAPŁAĆ/i });
    await user.click(payBtn);

    expect(screen.getByRole('alert')).toHaveTextContent(/Wypełnij wszystkie pola karty/i);
  });

  it('completes order with valid card and clears sensitive input fields', async () => {
    const user = userEvent.setup();
    render(<CheckoutPanel />);

    const cardInput = screen.getByLabelText(/Numer karty/i);
    const expiryInput = screen.getByLabelText(/Ważność \(MM\/RR\):/i);
    const cvvInput = screen.getByLabelText(/Kod CVV/i);

    // Valid card with Luhn check
    await user.type(cardInput, '4532015112830366');
    await user.type(expiryInput, '12/28');
    await user.type(cvvInput, '123');

    const payBtn = screen.getByRole('button', { name: /ZAMÓW I ZAPŁAĆ/i });
    await user.click(payBtn);

    // Order should have succeeded
    expect(useShopStore.getState().orders.length).toBe(1);

    // Form inputs must be cleared for PCI hygiene!
    expect((screen.getByLabelText(/Numer karty/i) as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText(/Kod CVV/i) as HTMLInputElement).value).toBe('');
  });
});
