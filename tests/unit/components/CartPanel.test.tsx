import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CartPanel } from '@/components/CartPanel';
import { DEFAULT_CATALOG } from '@/domain/catalog';
import { toCents } from '@/domain/money';
import { useShopStore } from '@/store/useShopStore';

describe('CartPanel component', () => {
  beforeEach(() => {
    useShopStore.setState({ cart: [] });
  });

  it('renders empty cart message when cart has no items', () => {
    render(<CartPanel />);
    expect(
      screen.getByText(/\[KOSZYK JEST PUSTY\. WYBIERZ PRODUKTY Z KATALOGU\]/i)
    ).toBeInTheDocument();
  });

  it('displays items, allows quantity change and removal', async () => {
    const user = userEvent.setup();
    const product = DEFAULT_CATALOG[0]!;

    useShopStore.setState({
      cart: [
        {
          product,
          quantity: 2,
          lineTotalCents: toCents(product.priceCents * 2),
        },
      ],
    });

    render(<CartPanel />);
    expect(screen.getByText('Laptop')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();

    // Increment
    const plusBtn = screen.getByRole('button', { name: /Zwiększ ilość dla Laptop/i });
    await user.click(plusBtn);
    expect(useShopStore.getState().cart[0]?.quantity).toBe(3);

    // Remove item
    const removeBtn = screen.getByRole('button', { name: /Usuń Laptop z koszyka/i });
    await user.click(removeBtn);
    expect(useShopStore.getState().cart.length).toBe(0);
  });

  it('displays free delivery active status when subtotal exceeds 200 PLN', () => {
    const laptop = DEFAULT_CATALOG[0]!; // Laptop is 3499.99 PLN > 200.00 PLN

    useShopStore.setState({
      cart: [
        {
          product: laptop,
          quantity: 1,
          lineTotalCents: laptop.priceCents,
        },
      ],
    });

    render(<CartPanel />);
    expect(screen.getByText(/DARMOWA DOSTAWA AKTYWNA/i)).toBeInTheDocument();
    expect(screen.getByText(/0,00 zł \(GRATIS\)/i)).toBeInTheDocument();
  });

  it('clears cart when clicking WYCZYŚĆ', async () => {
    const user = userEvent.setup();
    const product = DEFAULT_CATALOG[0]!;
    useShopStore.setState({
      cart: [
        {
          product,
          quantity: 1,
          lineTotalCents: product.priceCents,
        },
      ],
    });

    render(<CartPanel />);
    const clearBtn = screen.getByRole('button', { name: /WYCZYŚĆ/i });
    await user.click(clearBtn);

    expect(useShopStore.getState().cart.length).toBe(0);
  });
});
