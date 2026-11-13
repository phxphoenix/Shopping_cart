import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CatalogPanel } from '@/components/CatalogPanel';
import { useShopStore } from '@/store/useShopStore';

describe('CatalogPanel component', () => {
  beforeEach(() => {
    useShopStore.setState({
      searchQuery: '',
      selectedCategory: 'ALL',
      cart: [],
    });
  });

  it('renders products and category filters', () => {
    render(<CatalogPanel />);
    expect(screen.getByRole('heading', { name: /\/\/ KATALOG PRODUKTÓW/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /> WSZYSTKIE/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Elektronika/i })).toBeInTheDocument();
    expect(screen.getByText('Laptop')).toBeInTheDocument();
  });

  it('filters products by search input', async () => {
    const user = userEvent.setup();
    render(<CatalogPanel />);

    const searchInput = screen.getByRole('searchbox', {
      name: /Wyszukiwarka produktów/i,
    });
    await user.type(searchInput, 'Słuchawki');

    expect(screen.getByText('Słuchawki')).toBeInTheDocument();
    expect(screen.queryByText('Laptop')).not.toBeInTheDocument();
  });

  it('filters products by category button', async () => {
    const user = userEvent.setup();
    render(<CatalogPanel />);

    const eduBtn = screen.getByRole('button', { name: /Edukacja/i });
    await user.click(eduBtn);

    expect(screen.getByText('Książka Python')).toBeInTheDocument();
    expect(screen.queryByText('Laptop')).not.toBeInTheDocument();
  });

  it('increments quantity and adds item to cart', async () => {
    const user = userEvent.setup();
    render(<CatalogPanel />);

    const laptopAddBtn = screen.getAllByRole('button', { name: /DODAJ ->/i })[0]!;
    await user.click(laptopAddBtn);

    const cart = useShopStore.getState().cart;
    expect(cart.length).toBe(1);
    expect(cart[0]?.quantity).toBe(1);
  });
});
