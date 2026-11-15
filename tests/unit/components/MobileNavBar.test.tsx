import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MobileNavBar } from '@/components/MobileNavBar';
import { useShopStore } from '@/store/useShopStore';
import { toCents } from '@/domain/money';

describe('MobileNavBar component', () => {
  beforeEach(() => {
    useShopStore.setState({
      cart: [],
      activeView: 'shop',
    });
  });

  it('renders quick-jump navigation buttons in shop view with live cart count', async () => {
    const user = userEvent.setup();
    const scrollIntoViewMock = vi.fn();
    const targetEl = document.createElement('section');
    targetEl.id = 'panel-cart';
    targetEl.scrollIntoView = scrollIntoViewMock;
    document.body.appendChild(targetEl);

    useShopStore.setState({
      cart: [
        {
          product: {
            id: 'p1',
            sku: 'HW-01',
            name: 'Retro Laptop',
            categoryId: 'cat-default',
            category: 'Ogólne',
            priceCents: toCents(10000),
            stockQuantity: 5,
            inStock: true,
            description: 'Test',
          },
          quantity: 3,
          lineTotalCents: toCents(30000),
        },
      ],
    });

    render(<MobileNavBar showAdminView={false} />);

    expect(screen.getByRole('button', { name: /KATALOG/i })).toBeInTheDocument();
    const cartBtn = screen.getByRole('button', { name: /KOSZYK \(3\)/i });
    expect(cartBtn).toHaveClass('mobile-nav-btn--highlight');

    await user.click(cartBtn);
    expect(scrollIntoViewMock).toHaveBeenCalledTimes(1);

    document.body.removeChild(targetEl);
  });

  it('renders admin mobile navigation controls and switches back to shop view', async () => {
    const user = userEvent.setup();
    const scrollToSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    useShopStore.setState({ activeView: 'admin' });

    render(<MobileNavBar showAdminView={true} />);

    await user.click(screen.getByRole('button', { name: /GÓRA/i }));
    expect(scrollToSpy).toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /SKLEP/i }));
    expect(useShopStore.getState().activeView).toBe('shop');

    scrollToSpy.mockRestore();
  });
});
