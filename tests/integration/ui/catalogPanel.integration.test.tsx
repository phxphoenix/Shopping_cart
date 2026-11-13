import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CatalogPanel } from '@/components/CatalogPanel';
import { CartPanel } from '@/components/CartPanel';
import { DEFAULT_CATALOG } from '@/domain/catalog';
import { useShopStore } from '@/store/useShopStore';

describe('CatalogPanel UI Integration', () => {
  beforeEach(() => {
    useShopStore.setState({
      catalog: DEFAULT_CATALOG,
      searchQuery: '',
      selectedCategory: 'ALL',
      cart: [],
    });
  });

  it('renders products and filters dynamically by search query (name and SKU)', async () => {
    const user = userEvent.setup();
    render(<CatalogPanel />);

    // Initially displays all 8 default products
    expect(
      screen.getByRole('heading', { name: /\/\/ KATALOG PRODUKTÓW \(8\)/i })
    ).toBeInTheDocument();
    expect(screen.getByText('Laptop')).toBeInTheDocument();
    expect(screen.getByText('Słuchawki')).toBeInTheDocument();

    const searchInput = screen.getByLabelText(/Wyszukiwarka produktów/i);

    // Search by product name (Słuchawki matches exactly 1)
    await user.type(searchInput, 'Słuchawki');
    expect(
      screen.getByRole('heading', { name: /\/\/ KATALOG PRODUKTÓW \(1\)/i })
    ).toBeInTheDocument();
    expect(screen.getByText('Słuchawki')).toBeInTheDocument();
    expect(screen.queryByText('Laptop')).not.toBeInTheDocument();

    // Clear search with [X] button
    const clearBtn = screen.getByRole('button', { name: /Wyczyść pole wyszukiwania/i });
    await user.click(clearBtn);
    expect(
      screen.getByRole('heading', { name: /\/\/ KATALOG PRODUKTÓW \(8\)/i })
    ).toBeInTheDocument();

    // Search by SKU
    await user.type(searchInput, 'AU-PHONE-02');
    expect(
      screen.getByRole('heading', { name: /\/\/ KATALOG PRODUKTÓW \(1\)/i })
    ).toBeInTheDocument();
    expect(screen.getByText('Słuchawki')).toBeInTheDocument();

    // Search nonexistent query
    await user.clear(searchInput);
    await user.type(searchInput, 'NieIstnieje12345');
    expect(
      screen.getByText(/\[BRAK POZYCJI W KATALOGU SPEŁNIAJĄCYCH KRYTERIA\]/i)
    ).toBeInTheDocument();
  });

  it('filters catalog by category tabs', async () => {
    const user = userEvent.setup();
    render(<CatalogPanel />);

    // Click on 'Elektronika' category (Laptop, Słuchawki)
    const electronicsBtn = screen.getByRole('button', { name: /Elektronika/i });
    await user.click(electronicsBtn);

    expect(electronicsBtn).toHaveAttribute('aria-pressed', 'true');
    expect(
      screen.getByRole('heading', { name: /\/\/ KATALOG PRODUKTÓW \(2\)/i })
    ).toBeInTheDocument();
    expect(screen.getByText('Laptop')).toBeInTheDocument();
    expect(screen.getByText('Słuchawki')).toBeInTheDocument();
    expect(screen.queryByText('Koszulka')).not.toBeInTheDocument();

    // Click on 'Odziez' (Koszulka)
    const clothingBtn = screen.getByRole('button', { name: /Odziez/i });
    await user.click(clothingBtn);
    expect(clothingBtn).toHaveAttribute('aria-pressed', 'true');
    expect(
      screen.getByRole('heading', { name: /\/\/ KATALOG PRODUKTÓW \(1\)/i })
    ).toBeInTheDocument();
    expect(screen.getByText('Koszulka')).toBeInTheDocument();

    // Click on 'Retro Hardware' (Monitor CRT 17", Klawiatura Mechaniczna Clicky)
    const retroBtn = screen.getByRole('button', { name: /Retro Hardware/i });
    await user.click(retroBtn);
    expect(
      screen.getByRole('heading', { name: /\/\/ KATALOG PRODUKTÓW \(2\)/i })
    ).toBeInTheDocument();
    expect(screen.getByText('Monitor CRT 17"')).toBeInTheDocument();
    expect(screen.getByText('Klawiatura Mechaniczna Clicky')).toBeInTheDocument();

    // Reset to 'WSZYSTKIE'
    const allBtn = screen.getByRole('button', { name: /WSZYSTKIE/i });
    await user.click(allBtn);
    expect(
      screen.getByRole('heading', { name: /\/\/ KATALOG PRODUKTÓW \(8\)/i })
    ).toBeInTheDocument();
  });

  it('manages quantity increment, decrement and manual numeric input with clamping', async () => {
    const user = userEvent.setup();
    render(<CatalogPanel />);

    const decBtn = screen.getByRole('button', { name: /Zmniejsz ilość dla Laptop/i });
    const incBtn = screen.getByRole('button', { name: /Zwiększ ilość dla Laptop/i });
    const qtyInput = screen.getByRole('spinbutton', { name: /^Ilość dla Laptop$/i });

    // Initial value is 1, decBtn is disabled
    expect(qtyInput).toHaveValue(1);
    expect(decBtn).toBeDisabled();

    // Increment
    await user.click(incBtn);
    expect(qtyInput).toHaveValue(2);
    expect(decBtn).not.toBeDisabled();

    // Decrement
    await user.click(decBtn);
    expect(qtyInput).toHaveValue(1);
    expect(decBtn).toBeDisabled();

    // Manual change
    fireEvent.change(qtyInput, { target: { value: '5' } });
    expect(qtyInput).toHaveValue(5);

    // Clamping: > 99 clamps to 99
    fireEvent.change(qtyInput, { target: { value: '150' } });
    expect(qtyInput).toHaveValue(99);
  });

  it('adds selected quantity to cart and updates cart state and resets input', async () => {
    const user = userEvent.setup();
    // Render both Catalog and Cart to test real integration
    render(
      <div>
        <CatalogPanel />
        <CartPanel />
      </div>
    );

    // Initially cart is empty
    expect(
      screen.getByText(/\[KOSZYK JEST PUSTY\. WYBIERZ PRODUKTY Z KATALOGU\]/i)
    ).toBeInTheDocument();

    const laptopArticle = screen.getByText('Laptop').closest('article')!;
    const incBtn = screen.getByRole('button', { name: /Zwiększ ilość dla Laptop/i });
    const addLaptopBtn = laptopArticle.querySelector('button.btn-primary') as HTMLButtonElement;

    // Set quantity to 2 and add to cart
    await user.click(incBtn);
    await user.click(addLaptopBtn);

    // Verify cart now contains 2 Laptops
    expect(useShopStore.getState().cart).toHaveLength(1);
    expect(useShopStore.getState().cart[0]?.product.name).toBe('Laptop');
    expect(useShopStore.getState().cart[0]?.quantity).toBe(2);

    // Verify quantity input in catalog was reset to 1
    const qtyInput = screen.getByRole('spinbutton', { name: /^Ilość dla Laptop$/i });
    expect(qtyInput).toHaveValue(1);

    // Add another item: Słuchawki (qty 1)
    const phoneArticle = screen.getByText('Słuchawki').closest('article')!;
    const addPhoneBtn = phoneArticle.querySelector('button.btn-primary') as HTMLButtonElement;
    await user.click(addPhoneBtn);

    expect(useShopStore.getState().cart).toHaveLength(2);
    expect(useShopStore.getState().cart[1]?.product.name).toBe('Słuchawki');
    expect(useShopStore.getState().cart[1]?.quantity).toBe(1);
  });
});
