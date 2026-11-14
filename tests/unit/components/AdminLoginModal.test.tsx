import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdminLoginModal } from '@/components/AdminLoginModal';
import { useShopStore } from '@/store/useShopStore';

describe('AdminLoginModal component', () => {
  beforeEach(() => {
    useShopStore.setState({
      isAdminAuthenticated: false,
      activeView: 'shop',
    });
  });

  it('renders nothing when isOpen is false', () => {
    const { container } = render(<AdminLoginModal isOpen={false} onClose={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders modal dialog with accessible attributes, password input, and demo hint when isOpen is true', () => {
    render(<AdminLoginModal isOpen={true} onClose={vi.fn()} />);

    expect(screen.getByRole('dialog', { name: /\/\/ AUTORYZACJA ADMINISTRATORA/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Hasło dostępu administratora:/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /AUTORYZUJ DOSTĘP/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /\[ANULUJ\]/i })).toBeInTheDocument();
    expect(screen.getByText(/admin123/i)).toBeInTheDocument();
  });

  it('calls onClose when clicking [ANULUJ] button', async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();
    render(<AdminLoginModal isOpen={true} onClose={handleClose} />);

    await user.click(screen.getByRole('button', { name: /\[ANULUJ\]/i }));
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when pressing Escape key', async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();
    render(<AdminLoginModal isOpen={true} onClose={handleClose} />);

    await user.keyboard('{Escape}');
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('displays validation error in role="alert" when submitting empty password', async () => {
    const user = userEvent.setup();
    render(<AdminLoginModal isOpen={true} onClose={vi.fn()} />);

    const submitBtn = screen.getByRole('button', { name: /AUTORYZUJ DOSTĘP/i });
    await user.click(submitBtn);

    expect(screen.getByRole('alert')).toHaveTextContent(/Wprowadź hasło administratora/i);
  });

  it('displays authentication error in role="alert" on invalid password', async () => {
    const user = userEvent.setup();
    render(<AdminLoginModal isOpen={true} onClose={vi.fn()} />);

    const passwordInput = screen.getByLabelText(/Hasło dostępu administratora:/i);
    await user.type(passwordInput, 'wrongpassword123');

    const submitBtn = screen.getByRole('button', { name: /AUTORYZUJ DOSTĘP/i });
    await user.click(submitBtn);

    expect(screen.getByRole('alert')).toHaveTextContent(/Nieprawidłowe hasło administratora/i);
    expect(useShopStore.getState().isAdminAuthenticated).toBe(false);
  });

  it('authenticates admin, closes modal, and transitions to admin view on valid password', async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();
    render(<AdminLoginModal isOpen={true} onClose={handleClose} />);

    const passwordInput = screen.getByLabelText(/Hasło dostępu administratora:/i);
    await user.type(passwordInput, 'admin123');

    const submitBtn = screen.getByRole('button', { name: /AUTORYZUJ DOSTĘP/i });
    await user.click(submitBtn);

    expect(useShopStore.getState().isAdminAuthenticated).toBe(true);
    expect(useShopStore.getState().activeView).toBe('admin');
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
