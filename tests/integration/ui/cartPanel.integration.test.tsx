import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CartPanel } from '@/components/CartPanel';
import { DEFAULT_CATALOG } from '@/domain/catalog';
import { toCents } from '@/domain/money';
import { useShopStore } from '@/store/useShopStore';

describe('CartPanel UI Integration', () => {
  beforeEach(() => {
    useShopStore.setState({ cart: [] });
  });

  it('calculates 15.00 PLN delivery when subtotal is under 200.00 PLN threshold', () => {
    // Koszulka is 79.99 PLN (7999 Cents) < 200.00 PLN
    const tshirt = DEFAULT_CATALOG.find((p) => p.sku === 'CL-TSHIRT-03')!;

    useShopStore.setState({
      cart: [
        {
          product: tshirt,
          quantity: 1,
          lineTotalCents: tshirt.priceCents,
        },
      ],
    });

    render(<CartPanel />);

    // Verification of delivery fee and total
    expect(screen.getByText('Dostawa:')).toBeInTheDocument();
    expect(screen.getByText('15,00 zł')).toBeInTheDocument();
    expect(screen.getByText('Suma produktów:')).toBeInTheDocument();
    expect(screen.getAllByText('79,99 zł').length).toBeGreaterThanOrEqual(1);
    // 79.99 + 15.00 = 94.99 zł
    expect(screen.getByText('94,99 zł')).toBeInTheDocument();

    // Verification of missing amount to free delivery: 200.00 - 79.99 = 120.01 zł
    expect(screen.getByText(/Brakuje: 120,01 zł/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Dodaj za 120,01 zł, aby uzyskać darmową dostawę\./i)
    ).toBeInTheDocument();
  });

  it('activates free delivery (GRATIS) when subtotal reaches or exceeds 200.00 PLN threshold', () => {
    // Koszulka is 79.99 PLN x 3 = 239.97 PLN >= 200.00 PLN
    const tshirt = DEFAULT_CATALOG.find((p) => p.sku === 'CL-TSHIRT-03')!;

    useShopStore.setState({
      cart: [
        {
          product: tshirt,
          quantity: 3,
          lineTotalCents: toCents(tshirt.priceCents * 3),
        },
      ],
    });

    render(<CartPanel />);

    // Free delivery indicator
    expect(screen.getByText(/DARMOWA DOSTAWA AKTYWNA/i)).toBeInTheDocument();
    expect(screen.getByText('0,00 zł (GRATIS)')).toBeInTheDocument();
    expect(screen.getAllByText('239,97 zł').length).toBeGreaterThanOrEqual(1);
    expect(
      screen.getByText(/Gratulacje! Twoje zamówienie kwalifikuje się do darmowej wysyłki\./i)
    ).toBeInTheDocument();
  });

  it('supports +, -, and USUŃ operations on items', async () => {
    const user = userEvent.setup();
    const phone = DEFAULT_CATALOG.find((p) => p.sku === 'AU-PHONE-02')!; // 199.99 PLN

    useShopStore.setState({
      cart: [
        {
          product: phone,
          quantity: 1,
          lineTotalCents: phone.priceCents,
        },
      ],
    });

    render(<CartPanel />);

    expect(screen.getByText('Słuchawki')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    // 199.99 zł (< 200, so + 15.00 = 214.99 zł)
    expect(screen.getAllByText(/199,99 zł/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('15,00 zł')).toBeInTheDocument();
    expect(screen.getByText('214,99 zł')).toBeInTheDocument();

    // Increment: 2 items => 2 x 199.99 = 399.98 zł (>= 200, so FREE DELIVERY!)
    const incBtn = screen.getByRole('button', { name: /Zwiększ ilość dla Słuchawki/i });
    await user.click(incBtn);

    expect(useShopStore.getState().cart[0]?.quantity).toBe(2);
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getAllByText('399,98 zł').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('0,00 zł (GRATIS)')).toBeInTheDocument();

    // Decrement: back to 1 item
    const decBtn = screen.getByRole('button', { name: /Zmniejsz ilość dla Słuchawki/i });
    await user.click(decBtn);

    expect(useShopStore.getState().cart[0]?.quantity).toBe(1);
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('15,00 zł')).toBeInTheDocument();

    // Remove single item via USUŃ
    const removeBtn = screen.getByRole('button', { name: /Usuń Słuchawki z koszyka/i });
    await user.click(removeBtn);

    expect(useShopStore.getState().cart).toHaveLength(0);
    expect(
      screen.getByText(/\[KOSZYK JEST PUSTY\. WYBIERZ PRODUKTY Z KATALOGU\]/i)
    ).toBeInTheDocument();
  });

  it('supports WYCZYŚĆ button to clear all cart items at once', async () => {
    const user = userEvent.setup();
    const laptop = DEFAULT_CATALOG[0]!;
    const tshirt = DEFAULT_CATALOG[2]!;

    useShopStore.setState({
      cart: [
        { product: laptop, quantity: 1, lineTotalCents: laptop.priceCents },
        { product: tshirt, quantity: 2, lineTotalCents: toCents(tshirt.priceCents * 2) },
      ],
    });

    render(<CartPanel />);

    expect(screen.getByRole('heading', { name: /\/\/ KOSZYK \(3 szt\.\)/i })).toBeInTheDocument();
    const clearBtn = screen.getByRole('button', { name: /WYCZYŚĆ/i });
    await user.click(clearBtn);

    expect(useShopStore.getState().cart).toEqual([]);
    expect(
      screen.getByText(/\[KOSZYK JEST PUSTY\. WYBIERZ PRODUKTY Z KATALOGU\]/i)
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /WYCZYŚĆ/i })).not.toBeInTheDocument();
  });
});
