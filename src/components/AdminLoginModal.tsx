import { useEffect, useRef, useState, type FormEvent, type MouseEvent } from 'react';
import { useShopStore } from '@/store/useShopStore';

export interface AdminLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AdminLoginModal({ isOpen, onClose }: AdminLoginModalProps) {
  const { loginAdmin } = useShopStore();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const passwordInputRef = useRef<HTMLInputElement>(null);
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    // Save previous active element to restore focus after closing
    previouslyFocusedElementRef.current = document.activeElement as HTMLElement | null;

    // Focus password input after modal opens
    const timer = setTimeout(() => {
      passwordInputRef.current?.focus();
    }, 50);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);
      previouslyFocusedElementRef.current?.focus();
    };
  }, [isOpen, onClose]);

  // Reset state when opening/closing
  useEffect(() => {
    if (isOpen) {
      setPassword('');
      setError(null);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const handleBackdropClick = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!password) {
      setError('Wprowadź hasło administratora.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await loginAdmin(password);
      if (result.success) {
        setPassword('');
        setError(null);
        onClose();
      } else {
        setError(result.error ?? 'Nieprawidłowe hasło administratora.');
        passwordInputRef.current?.focus();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`BŁĄD SYSTEMU: ${msg}`);
      passwordInputRef.current?.focus();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="modal-backdrop"
      onClick={handleBackdropClick}
      role="presentation"
      style={{ zIndex: 10000 }}
    >
      <div
        className="modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-login-modal-title"
        style={{ maxWidth: '520px' }}
      >
        <div className="modal-header">
          <h3 id="admin-login-modal-title" className="modal-title">
            // AUTORYZACJA ADMINISTRATORA
          </h3>
          <span className="badge badge-warning">[SECURITY GATE]</span>
        </div>

        <form onSubmit={handleSubmit} noValidate className="modal-body">
          <p
            style={{
              fontSize: 'var(--font-size-xs)',
              color: 'var(--text-muted)',
              lineHeight: 1.5,
              margin: 0,
            }}
          >
            Dostęp do konfiguracji kategorii, modyfikacji katalogu, migracji produktów oraz pełnej
            bazy klientów wymaga uprawnień administratora systemu.
          </p>

          <div className="form-group" style={{ marginTop: '0.5rem', marginBottom: '0.75rem' }}>
            <label htmlFor="admin-password-input" className="form-label">
              Hasło dostępu administratora:
            </label>
            <input
              id="admin-password-input"
              ref={passwordInputRef}
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError(null);
              }}
              placeholder="Wprowadź hasło..."
              autoComplete="current-password"
              disabled={isSubmitting}
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem',
                backgroundColor: 'var(--bg-input)',
                border: '1px solid var(--border-main)',
                color: 'var(--text-bright)',
                fontFamily: 'var(--font-mono)',
              }}
            />
          </div>

          {error && (
            <div
              role="alert"
              className="form-error"
              style={{
                padding: '0.45rem 0.65rem',
                backgroundColor: 'var(--error-bg)',
                border: '1px solid var(--border-error)',
                color: 'var(--error)',
                fontSize: 'var(--font-size-xs)',
                marginBottom: '0.75rem',
              }}
            >
              ! BŁĄD AUTORYZACJI: {error}
            </div>
          )}

          <div
            style={{
              border: '1px dashed var(--border-dim)',
              backgroundColor: 'var(--bg-main)',
              padding: '0.5rem 0.65rem',
              fontSize: 'var(--font-size-xs)',
              color: 'var(--text-dim)',
              lineHeight: 1.4,
            }}
          >
            <strong style={{ color: 'var(--warning)' }}>// WSKAZÓWKA DEMO / DEV:</strong> Domyślne
            hasło demonstracyjne w środowisku testowym to <code>admin123</code> (lub zdefiniowane w
            zmiennej <code>ADMIN_PASSWORD</code>).
          </div>

          <div className="modal-footer" style={{ marginTop: '1rem', paddingBottom: 0 }}>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              style={{ padding: '0.45rem 1rem' }}
            >
              [ANULUJ]
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={isSubmitting}
              style={{ padding: '0.45rem 1.25rem' }}
            >
              {isSubmitting ? 'WERYFIKACJA...' : 'AUTORYZUJ DOSTĘP'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
