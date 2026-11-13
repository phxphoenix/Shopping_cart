import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import App from '@/App';
import { useShopStore } from '@/store/useShopStore';

describe('App smoke test', () => {
  beforeEach(() => {
    useShopStore.setState({ isInitialized: false });
  });

  it('renders the retro booting message before transitioning to the terminal', async () => {
    render(<App />);

    // Initially displays the boot screen
    expect(
      screen.getByRole('heading', { name: /\[BOOTING RETRO SHOPPING CART v2\.0\.\.\.\]/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/TERMINAL READY/i)).toBeInTheDocument();

    // Awaits initialization to transition into terminal
    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /SHOPPING CART \/\/ TERMINAL v2\.0/i })
      ).toBeInTheDocument();
    });
  });

  it('renders the full retro terminal UI once initialized with all panels', async () => {
    render(<App />);

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /SHOPPING CART \/\/ TERMINAL v2\.0/i })
      ).toBeInTheDocument();
    });

    // Verify all 5 terminal panels and status bar are active
    expect(screen.getByRole('heading', { name: /\/\/ KATALOG PRODUKTÓW/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /\/\/ KOSZYK/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /\/\/ BAZA KLIENTÓW/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /\/\/ KASA & PŁATNOŚĆ/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /\/\/ HISTORIA ZAMÓWIEŃ/i })).toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});
