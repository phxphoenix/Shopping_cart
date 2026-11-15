import { useState, type FormEvent } from 'react';
import { maskCustomerEmail, validateNewCustomerRegistration } from '@/domain/customer';
import { useShopStore } from '@/store/useShopStore';

export function CustomersPanel() {
  const {
    customers,
    selectedCustomerId,
    selectCustomer,
    addCustomer,
    getSelectedCustomer,
    unlockedCustomerEmails,
    isAdminAuthenticated,
  } = useShopStore();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [companyWebsite, setCompanyWebsite] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const selectedCustomer = getSelectedCustomer();
  const selectedDisplayEmail = selectedCustomer
    ? isAdminAuthenticated || Boolean(unlockedCustomerEmails[selectedCustomer.id])
      ? selectedCustomer.email
      : maskCustomerEmail(selectedCustomer.email)
    : '';

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const trimmedHoneypot = companyWebsite.trim();

    try {
      // Validate customer registration using domain rules (name format, email format, honeypot, uniqueness)
      const validated = validateNewCustomerRegistration(customers, {
        name: trimmedName,
        email: trimmedEmail,
        companyWebsite: trimmedHoneypot,
        honeypot: trimmedHoneypot,
      });

      const success = addCustomer({
        name: validated.name,
        email: validated.email,
        honeypot: trimmedHoneypot,
        companyWebsite: trimmedHoneypot,
      });

      if (success) {
        setName('');
        setEmail('');
        setCompanyWebsite('');
        setFormError(null);
      } else {
        setFormError('Nie udało się zarejestrować klienta. Sprawdź poprawność danych.');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setFormError(errorMsg);
    }
  };

  return (
    <section id="panel-customers" className="retro-panel" aria-labelledby="customers-heading">
      <div className="panel-header">
        <h2 id="customers-heading" className="panel-title">
          // BAZA KLIENTÓW ({customers.length})
        </h2>
      </div>

      {/* Aktywny klient info badge */}
      <div
        style={{
          border: '1px solid var(--border-dim)',
          backgroundColor: 'var(--bg-main)',
          padding: '0.5rem 0.75rem',
          marginBottom: '0.85rem',
          fontSize: 'var(--font-size-xs)',
          overflowWrap: 'anywhere',
        }}
      >
        <span style={{ color: 'var(--text-muted)' }}>AKTYWNY KLIENT DO ZAMÓWIENIA: </span>
        {selectedCustomer ? (
          <strong style={{ color: 'var(--accent)' }}>
            {selectedCustomer.name} ({selectedDisplayEmail})
          </strong>
        ) : (
          <span style={{ color: 'var(--warning)' }}>[BRAK - WYBIERZ KLIENTA Z LISTY PONIŻEJ]</span>
        )}
      </div>

      {/* Formularz dodania nowego klienta */}
      <form
        onSubmit={handleSubmit}
        noValidate
        style={{
          border: '1px solid var(--border-dim)',
          padding: '0.75rem',
          backgroundColor: 'var(--bg-main)',
          marginBottom: '1rem',
        }}
        aria-label="Formularz dodawania nowego klienta"
      >
        <div style={{ fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-bright)' }}>
          + REJESTRACJA NOWEGO KLIENTA
        </div>

        <div className="form-group">
          <label htmlFor="customer-name" className="form-label">
            Imię i nazwisko:
          </label>
          <input
            id="customer-name"
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (formError) setFormError(null);
            }}
            placeholder="np. Jan Kowalski"
            autoComplete="name"
          />
        </div>

        <div className="form-group">
          <label htmlFor="customer-email" className="form-label">
            Adres e-mail:
          </label>
          <input
            id="customer-email"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (formError) setFormError(null);
            }}
            placeholder="np. jan.kowalski@example.pl"
            autoComplete="email"
          />
        </div>

        {/* Ukryte pole anty-botowe honeypot zgodne z WCAG AA */}
        <div
          style={{
            position: 'absolute',
            left: '-9999px',
            top: '-9999px',
            width: '1px',
            height: '1px',
            overflow: 'hidden',
          }}
          aria-hidden="true"
        >
          <label htmlFor="customer-company-website" className="sr-only">
            Strona WWW firmy:
          </label>
          <input
            id="customer-company-website"
            name="companyWebsite"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={companyWebsite}
            onChange={(e) => setCompanyWebsite(e.target.value)}
          />
        </div>

        {formError && (
          <div
            role="alert"
            className="form-error"
            style={{
              padding: '0.35rem 0.5rem',
              backgroundColor: 'var(--error-bg)',
              border: '1px solid var(--border-error)',
              marginBottom: '0.65rem',
            }}
          >
            ! BŁĄD: {formError}
          </div>
        )}

        <button type="submit" className="btn-primary" style={{ width: '100%' }}>
          + DODAJ KLIENTA
        </button>
      </form>

      {/* Lista klientów */}
      <div role="group" aria-label="Lista zarejestrowanych klientów" className="customers-list">
        {customers.length === 0 ? (
          <div
            style={{
              padding: '1rem',
              textAlign: 'center',
              border: '1px dashed var(--border-dim)',
              color: 'var(--text-muted)',
              fontSize: 'var(--font-size-xs)',
            }}
          >
            [BRAK KLIENTÓW W BAZIE - DODAJ PIERWSZEGO KLIENTA POWYŻEJ]
          </div>
        ) : (
          customers.map((customer) => {
            const isSelected = selectedCustomerId === customer.id;
            const isEmailUnlocked =
              isAdminAuthenticated || Boolean(unlockedCustomerEmails[customer.id]);
            const displayEmail = isEmailUnlocked
              ? customer.email
              : maskCustomerEmail(customer.email);

            return (
              <div
                key={customer.id}
                style={{
                  border: isSelected ? '1px solid var(--accent)' : '1px solid var(--border-dim)',
                  backgroundColor: isSelected ? 'var(--bg-hover)' : 'var(--bg-main)',
                  padding: '0.45rem 0.65rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                {/* Przycisk wyboru klienta */}
                <button
                  type="button"
                  onClick={() => selectCustomer(customer.id)}
                  aria-pressed={isSelected}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    textAlign: 'left',
                    color: isSelected ? 'var(--text-bright)' : 'var(--text-primary)',
                    cursor: 'pointer',
                    flex: 1,
                    minWidth: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                  }}
                  title={`Wybierz ${customer.name} jako aktywnego klienta`}
                >
                  <span
                    style={{
                      color: isSelected ? 'var(--accent)' : 'var(--text-dim)',
                      fontWeight: 'bold',
                      flexShrink: 0,
                    }}
                  >
                    {isSelected ? '[●]' : '[○]'}
                  </span>
                  <div style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                    <strong style={{ fontSize: 'var(--font-size-sm)' }}>{customer.name}</strong>{' '}
                    <span
                      style={{
                        fontSize: 'var(--font-size-xs)',
                        color: 'var(--text-muted)',
                      }}
                    >
                      ({displayEmail})
                    </span>
                  </div>
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Subtelna informacja o braku akcji usuwania w widoku publicznym */}
      <div
        style={{
          marginTop: '0.75rem',
          paddingTop: '0.5rem',
          borderTop: '1px dotted var(--border-dim)',
          fontSize: 'var(--font-size-xs)',
          color: 'var(--text-dim)',
          lineHeight: 1.4,
        }}
      >
        // INFORMACJA SYSTEMOWA: Usuwanie kont klientów jest dostępne wyłącznie dla uprawnionych
        sesji w Panelu Administracyjnym.
      </div>
    </section>
  );
}
