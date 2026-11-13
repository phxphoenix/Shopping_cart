import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '@/App';
import { HeaderBar } from '@/components/HeaderBar';
import { createSeedState } from '@/storage';
import { useShopStore } from '@/store/useShopStore';

describe('HeaderBar and App UI Integration', () => {
  beforeEach(() => {
    const seed = createSeedState();
    useShopStore.setState({
      isInitialized: true,
      isLoading: false,
      customers: [...seed.customers],
      selectedCustomerId: seed.selectedCustomerId,
      orders: [...seed.orders],
      cart: [],
      settings: { crtFx: true },
      statusMessage: null,
      statusTone: 'info',
    });
  });

  it('toggles CRT FX setting and toggles the crt-fx-enabled class on retro-app', async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);

    const appRoot = container.querySelector('.retro-app');
    expect(appRoot).toHaveClass('crt-fx-enabled');

    const crtBtn = screen.getByRole('button', { name: /CRT FX: ON/i });
    expect(crtBtn).toHaveAttribute('aria-pressed', 'true');

    // Click to turn OFF
    await user.click(crtBtn);
    expect(screen.getByRole('button', { name: /CRT FX: OFF/i })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
    expect(appRoot).not.toHaveClass('crt-fx-enabled');
    expect(useShopStore.getState().settings.crtFx).toBe(false);

    // Click to turn ON again
    const crtOffBtn = screen.getByRole('button', { name: /CRT FX: OFF/i });
    await user.click(crtOffBtn);
    expect(appRoot).toHaveClass('crt-fx-enabled');
    expect(useShopStore.getState().settings.crtFx).toBe(true);
  });

  it('exports JSON backup on clicking EXPORT JSON', async () => {
    const user = userEvent.setup();
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    render(<HeaderBar />);
    const exportBtn = screen.getByRole('button', { name: /EXPORT JSON/i });
    await user.click(exportBtn);

    expect(clickSpy).toHaveBeenCalled();
    expect(useShopStore.getState().statusMessage).toContain('WYEKSPORTOWANO KOPIĘ ZAPASOWĄ');
    clickSpy.mockRestore();
  });

  it('handles two-step RESET DEMO flow and allows cancellation', async () => {
    // Set custom state before render
    useShopStore.setState({ customers: [] });
    expect(useShopStore.getState().customers).toHaveLength(0);

    const user = userEvent.setup();
    render(<HeaderBar />);

    const resetBtn = screen.getByRole('button', { name: /RESET DEMO/i });
    await user.click(resetBtn);

    // Confirmation options rendered
    const confirmBtn = screen.getByRole('button', { name: /POTWIERDŹ RESET\?/i });
    const cancelBtn = screen.getByRole('button', { name: /ANULUJ/i });
    expect(confirmBtn).toBeInTheDocument();
    expect(cancelBtn).toBeInTheDocument();

    // Cancel flow
    await user.click(cancelBtn);
    expect(screen.getByRole('button', { name: /RESET DEMO/i })).toBeInTheDocument();
    expect(useShopStore.getState().customers).toHaveLength(0);

    // Trigger reset again and confirm
    await user.click(screen.getByRole('button', { name: /RESET DEMO/i }));
    await user.click(screen.getByRole('button', { name: /POTWIERDŹ RESET\?/i }));

    // Demo data restored
    expect(useShopStore.getState().customers.length).toBeGreaterThan(0);
    expect(useShopStore.getState().statusMessage).toContain('PRZYWRÓCONO DOMYŚLNE DANE DEMO');
  });

  it('imports valid JSON backup via file input and updates shop state', async () => {
    const user = userEvent.setup();
    const { container } = render(<HeaderBar />);

    const backupData = {
      version: 2,
      exportedAt: new Date().toISOString(),
      customers: [{ id: 'c-imp-1', name: 'Zygmunt III Waza', email: 'zygmunt@krol.pl' }],
      orders: [],
      cart: [],
      selectedCustomerId: 'c-imp-1',
      settings: { crtFx: false },
    };

    const file = new File([JSON.stringify(backupData)], 'backup.json', {
      type: 'application/json',
    });

    const fileInput = container.querySelector('#import-json-input') as HTMLInputElement;
    expect(fileInput).not.toBeNull();

    await user.upload(fileInput, file);

    await waitFor(() => {
      const customers = useShopStore.getState().customers;
      expect(customers).toHaveLength(1);
      expect(customers[0]?.name).toBe('Zygmunt III Waza');
      expect(useShopStore.getState().selectedCustomerId).toBe('c-imp-1');
      expect(useShopStore.getState().settings.crtFx).toBe(false);
    });
  });

  it('displays error in status when importing invalid or corrupt JSON file', async () => {
    const user = userEvent.setup();
    const { container } = render(<HeaderBar />);

    const corruptFile = new File(['{ invalid: json syntax ...'], 'corrupt.json', {
      type: 'application/json',
    });

    const fileInput = container.querySelector('#import-json-input') as HTMLInputElement;
    await user.upload(fileInput, corruptFile);

    await waitFor(() => {
      expect(useShopStore.getState().statusTone).toBe('error');
      expect(useShopStore.getState().statusMessage).toContain('BŁĄD IMPORTU');
    });
  });
});
