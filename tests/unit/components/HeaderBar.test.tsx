import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HeaderBar } from '@/components/HeaderBar';
import { useShopStore } from '@/store/useShopStore';

describe('HeaderBar component', () => {
  beforeEach(() => {
    useShopStore.setState({
      settings: { crtFx: true },
      customers: [],
      orders: [],
      cart: [],
      isAdminAuthenticated: false,
      activeView: 'shop',
    });
  });

  it('renders the system title and action buttons', () => {
    render(<HeaderBar />);
    expect(
      screen.getByRole('heading', { name: /SHOPPING CART \/\/ TERMINAL v2\.0/i })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /CRT FX: ON/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /PANEL ADMINA/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /IMPORT JSON/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /EXPORT JSON/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /RESET DEMO/i })).toBeInTheDocument();
  });

  it('triggers onOpenLoginModal when clicking PANEL ADMINA while unauthenticated', async () => {
    const user = userEvent.setup();
    const openModalMock = vi.fn();
    render(<HeaderBar onOpenLoginModal={openModalMock} />);

    await user.click(screen.getByRole('button', { name: /PANEL ADMINA/i }));
    expect(openModalMock).toHaveBeenCalledTimes(1);
  });

  it('renders view switcher and logout button when admin is authenticated', async () => {
    const user = userEvent.setup();
    useShopStore.setState({ isAdminAuthenticated: true, activeView: 'shop' });

    render(<HeaderBar />);
    expect(screen.getByRole('button', { name: /PANEL ADMINA/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /WYLOGUJ ADMINA/i })).toBeInTheDocument();

    // Click PANEL ADMINA to switch view to admin
    await user.click(screen.getByRole('button', { name: /PANEL ADMINA/i }));
    expect(useShopStore.getState().activeView).toBe('admin');
  });

  it('switches back to shop view when in admin view and logs out admin', async () => {
    const user = userEvent.setup();
    useShopStore.setState({ isAdminAuthenticated: true, activeView: 'admin' });

    render(<HeaderBar />);
    expect(screen.getByRole('button', { name: /WIDOK: SKLEP/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /WIDOK: SKLEP/i }));
    expect(useShopStore.getState().activeView).toBe('shop');

    await user.click(screen.getByRole('button', { name: /WYLOGUJ ADMINA/i }));
    expect(useShopStore.getState().isAdminAuthenticated).toBe(false);
  });

  it('toggles CRT FX setting when clicking toggle button', async () => {
    const user = userEvent.setup();
    render(<HeaderBar />);

    const crtBtn = screen.getByRole('button', { name: /CRT FX: ON/i });
    expect(crtBtn).toHaveAttribute('aria-pressed', 'true');

    await user.click(crtBtn);

    expect(screen.getByRole('button', { name: /CRT FX: OFF/i })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
    expect(useShopStore.getState().settings.crtFx).toBe(false);
  });

  it('shows inline confirmation when clicking RESET DEMO and allows canceling', async () => {
    const user = userEvent.setup();
    render(<HeaderBar />);

    const resetBtn = screen.getByRole('button', { name: /RESET DEMO/i });
    await user.click(resetBtn);

    expect(screen.getByRole('button', { name: /POTWIERDŹ RESET\?/i })).toBeInTheDocument();
    const cancelBtn = screen.getByRole('button', { name: /ANULUJ/i });

    await user.click(cancelBtn);

    expect(screen.getByRole('button', { name: /RESET DEMO/i })).toBeInTheDocument();
  });

  it('triggers resetDemoData when confirming reset', async () => {
    const user = userEvent.setup();
    render(<HeaderBar />);

    await user.click(screen.getByRole('button', { name: /RESET DEMO/i }));
    await user.click(screen.getByRole('button', { name: /POTWIERDŹ RESET\?/i }));

    // Reset demo repopulates default customers
    expect(useShopStore.getState().customers.length).toBeGreaterThan(0);
  });

  it('triggers backup export on EXPORT JSON click', async () => {
    const user = userEvent.setup();
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    render(<HeaderBar />);
    await user.click(screen.getByRole('button', { name: /EXPORT JSON/i }));

    expect(clickSpy).toHaveBeenCalled();
    clickSpy.mockRestore();
  });
});
