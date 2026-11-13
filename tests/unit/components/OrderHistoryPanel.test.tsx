import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OrderHistoryPanel } from '@/components/OrderHistoryPanel';
import { toCents } from '@/domain/money';
import { useShopStore } from '@/store/useShopStore';

describe('OrderHistoryPanel component', () => {
  const sampleOrder = {
    id: 'ord-test-01',
    timestamp: '2026-11-13 12:00:00',
    customer: { id: 'c1', name: 'Jan Testowy', email: 'jan@test.com' },
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
      method: 'card' as const,
      maskedCard: '**** **** **** 0366',
      last4: '0366',
      expiry: '12/28',
    },
  };

  beforeEach(() => {
    useShopStore.setState({ orders: [sampleOrder] });
  });

  it('renders order history table with masked card information', () => {
    render(<OrderHistoryPanel />);
    expect(
      screen.getByRole('heading', { name: /\/\/ HISTORIA ZAMÓWIEŃ \(1\)/i })
    ).toBeInTheDocument();
    expect(screen.getByText('Jan Testowy')).toBeInTheDocument();
    expect(screen.getByText(/Karta \(\*\*\*\* \*\*\*\* \*\*\*\* 0366\)/i)).toBeInTheDocument();
  });

  it('opens details modal when clicking SZCZEGÓŁY button and closes with ZAMKNIJ', async () => {
    const user = userEvent.setup();
    render(<OrderHistoryPanel />);

    const detailsBtn = screen.getByRole('button', {
      name: /Szczegóły zamówienia ord-test-01/i,
    });
    await user.click(detailsBtn);

    // Modal is opened
    expect(screen.getByRole('heading', { name: /\/\/ SZCZEGÓŁY ZAMÓWIENIA/i })).toBeInTheDocument();
    expect(screen.getByText('ID: ord-test-01')).toBeInTheDocument();

    // Close modal
    const closeBtn = screen.getByRole('button', { name: /ZAMKNIJ \[ESC\]/i });
    await user.click(closeBtn);

    expect(
      screen.queryByRole('heading', { name: /\/\/ SZCZEGÓŁY ZAMÓWIENIA/i })
    ).not.toBeInTheDocument();
  });

  it('triggers text file export when clicking EXPORT .TXT', async () => {
    const user = userEvent.setup();
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    render(<OrderHistoryPanel />);
    const exportBtn = screen.getByRole('button', { name: /EXPORT \.TXT/i });
    await user.click(exportBtn);

    expect(clickSpy).toHaveBeenCalled();
    clickSpy.mockRestore();
  });
});
