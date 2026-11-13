import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBar } from '@/components/StatusBar';
import { DEFAULT_CATALOG } from '@/domain/catalog';
import { toCents } from '@/domain/money';
import { useShopStore } from '@/store/useShopStore';

describe('StatusBar component', () => {
  beforeEach(() => {
    useShopStore.setState({
      statusMessage: null,
      statusTone: 'info',
      selectedCustomerId: null,
      cart: [],
    });
  });

  it('renders default system online status message when statusMessage is null', () => {
    render(<StatusBar />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText(/SYSTEM GOTOWY \/\/ OCZEKIWANIE NA POLECENIA/i)).toBeInTheDocument();
    expect(screen.getByText(/BRAK/i)).toBeInTheDocument();
  });

  it('renders customized status message and tone correctly', () => {
    useShopStore.setState({
      statusMessage: 'ZŁOŻONO NOWE ZAMÓWIENIE // ID: ord-1234',
      statusTone: 'success',
      customers: [{ id: 'c1', name: 'Anna Nowak', email: 'anna@nowak.pl' }],
      selectedCustomerId: 'c1',
      cart: [
        {
          product: DEFAULT_CATALOG[0]!,
          quantity: 2,
          lineTotalCents: toCents(DEFAULT_CATALOG[0]!.priceCents * 2),
        },
      ],
    });

    render(<StatusBar />);
    expect(screen.getByText(/ZŁOŻONO NOWE ZAMÓWIENIE/i)).toBeInTheDocument();
    expect(screen.getByText('Anna Nowak')).toBeInTheDocument();
    expect(screen.getByText('2 szt.')).toBeInTheDocument();
  });
});
