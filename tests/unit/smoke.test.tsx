import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '@/App';

describe('App smoke test', () => {
  it('renders the retro booting message correctly', () => {
    render(<App />);
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent('[BOOTING RETRO SHOPPING CART v2.0...]');
  });

  it('displays terminal ready status', () => {
    render(<App />);
    expect(screen.getByText(/TERMINAL READY/i)).toBeInTheDocument();
  });
});
