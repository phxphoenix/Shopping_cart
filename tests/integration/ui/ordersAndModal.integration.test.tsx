import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OrderHistoryPanel } from '@/components/OrderHistoryPanel';
import { toCents } from '@/domain/money';
import type { Order } from '@/domain/schemas';
import { useShopStore } from '@/store/useShopStore';

describe('OrderHistoryPanel and OrderDetailsModal UI Integration', () => {
  const sampleOrders: Order[] = [
    {
      id: 'ord-int-01',
      timestamp: '2026-11-13 14:30:00',
      customer: { id: 'c1', name: 'Jan Kowalski', email: 'jan@kowalski.pl' },
      items: [
        {
          id: 'p1',
          name: 'Laptop Retro',
          priceCents: toCents(349999),
          quantity: 1,
          category: 'Elektronika',
        },
      ],
      subtotalCents: toCents(349999),
      deliveryCents: toCents(0),
      totalCents: toCents(349999),
      paymentMethod: 'Karta kredytowa',
      paymentDetails: {
        method: 'card',
        maskedCard: '**** **** **** 0366',
        last4: '0366',
        expiry: '12/28',
      },
    },
    {
      id: 'ord-int-02',
      timestamp: '2026-11-13 15:00:00',
      customer: { id: 'c2', name: 'Anna Nowak', email: 'anna@nowak.pl' },
      items: [
        {
          id: 'p2',
          name: 'Koszulka Retro',
          priceCents: toCents(7999),
          quantity: 1,
          category: 'Odziez',
        },
      ],
      subtotalCents: toCents(7999),
      deliveryCents: toCents(1500),
      totalCents: toCents(9499),
      paymentMethod: 'PayPal',
      paymentDetails: {
        method: 'paypal',
        email: 'anna.nowak@paypal.pl',
      },
    },
  ];

  beforeEach(() => {
    useShopStore.setState({ orders: [...sampleOrders] });
  });

  it('renders order history table with all orders and payment summaries', () => {
    render(<OrderHistoryPanel />);

    expect(
      screen.getByRole('heading', { name: /\/\/ HISTORIA ZAMÓWIEŃ \(2\)/i })
    ).toBeInTheDocument();
    expect(screen.getByText('Jan Kowalski')).toBeInTheDocument();
    expect(screen.getByText('Anna Nowak')).toBeInTheDocument();
    expect(screen.getByText(/Karta \(\*\*\*\* \*\*\*\* \*\*\*\* 0366\)/i)).toBeInTheDocument();
    expect(screen.getByText(/PayPal \(anna\.nowak@paypal\.pl\)/i)).toBeInTheDocument();
  });

  it('opens OrderDetailsModal and displays full order details without any CVV', async () => {
    const user = userEvent.setup();
    render(<OrderHistoryPanel />);

    const detailsBtn = screen.getByRole('button', {
      name: /Szczegóły zamówienia ord-int-01/i,
    });
    await user.click(detailsBtn);

    // Modal dialog rendered
    const dialog = screen.getByRole('dialog', { name: /\/\/ SZCZEGÓŁY ZAMÓWIENIA/i });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText('ID: ord-int-01')).toBeInTheDocument();
    expect(within(dialog).getByText('Jan Kowalski')).toBeInTheDocument();
    expect(within(dialog).getByText('Laptop Retro')).toBeInTheDocument();
    expect(within(dialog).getByText('**** **** **** 0366')).toBeInTheDocument();

    // Verify CVV does not exist anywhere in DOM
    expect(screen.queryByText(/cvv/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/789/i)).not.toBeInTheDocument();

    // Close with close button
    const closeBtn = within(dialog).getByRole('button', { name: /ZAMKNIJ \[ESC\]/i });
    await user.click(closeBtn);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes OrderDetailsModal via Escape keyboard shortcut', async () => {
    const user = userEvent.setup();
    render(<OrderHistoryPanel />);

    const detailsBtn = screen.getByRole('button', {
      name: /Szczegóły zamówienia ord-int-02/i,
    });
    await user.click(detailsBtn);

    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // Press Escape
    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('removes an order from history on clicking USUŃ', async () => {
    const user = userEvent.setup();
    render(<OrderHistoryPanel />);

    const deleteBtn = screen.getByRole('button', {
      name: /Usuń zamówienie ord-int-01/i,
    });
    await user.click(deleteBtn);

    // Order 1 is deleted
    expect(useShopStore.getState().orders).toHaveLength(1);
    expect(
      screen.getByRole('heading', { name: /\/\/ HISTORIA ZAMÓWIEŃ \(1\)/i })
    ).toBeInTheDocument();
    expect(screen.queryByText('Jan Kowalski')).not.toBeInTheDocument();
    expect(screen.getByText('Anna Nowak')).toBeInTheDocument();
  });

  it('triggers text report export on clicking EXPORT .TXT', async () => {
    const user = userEvent.setup();
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    render(<OrderHistoryPanel />);
    const exportBtn = screen.getByRole('button', { name: /EXPORT \.TXT/i });
    await user.click(exportBtn);

    expect(clickSpy).toHaveBeenCalled();
    expect(useShopStore.getState().statusMessage).toContain('WYEKSPORTOWANO RAPORT HISTORII');
    clickSpy.mockRestore();
  });
});
