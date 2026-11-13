import { useState, type FormEvent } from 'react';
import { CustomerSchema } from '@/domain/schemas';
import { useShopStore } from '@/store/useShopStore';

export function CustomersPanel() {
  const {
    customers,
    selectedCustomerId,
    selectCustomer,
    addCustomer,
    removeCustomer,
    getSelectedCustomer,
  } = useShopStore();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const selectedCustomer = getSelectedCustomer();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();

    // Client-side quick validation matching CustomerSchema
    const parseResult = CustomerSchema.pick({ name: true, email: true }).safeParse({
      name: trimmedName,
      email: trimmedEmail,
    });

    if (!parseResult.success) {
      const errorMsg = parseResult.error.errors.map((err) => err.message).join('; ');
      setFormError(errorMsg);
      return;
    }

    const success = addCustomer({ name: trimmedName, email: trimmedEmail });
    if (success) {
      setName('');
      setEmail('');
      setFormError(null);
    } else {
      setFormError('Nie udało się dodać klienta. Sprawdź poprawność danych.');
    }
  };

  return (
    <section className="retro-panel" aria-labelledby="customers-heading">
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
        }}
      >
        <span style={{ color: 'var(--text-muted)' }}>AKTYWNY KLIENT DO ZAMÓWIENIA: </span>
        {selectedCustomer ? (
          <strong style={{ color: 'var(--accent)' }}>
            {selectedCustomer.name} ({selectedCustomer.email})
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
      <div
        role="group"
        aria-label="Lista zarejestrowanych klientów"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.4rem',
          maxHeight: '220px',
          overflowY: 'auto',
        }}
      >
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
                    }}
                  >
                    {isSelected ? '[●]' : '[○]'}
                  </span>
                  <div>
                    <strong style={{ fontSize: 'var(--font-size-sm)' }}>{customer.name}</strong>{' '}
                    <span
                      style={{
                        fontSize: 'var(--font-size-xs)',
                        color: 'var(--text-muted)',
                      }}
                    >
                      ({customer.email})
                    </span>
                  </div>
                </button>

                {/* Bezpieczne usuwanie klienta */}
                <button
                  type="button"
                  onClick={() => removeCustomer(customer.id)}
                  className="btn-danger"
                  aria-label={`Usuń klienta ${customer.name}`}
                  style={{
                    padding: '0.15rem 0.45rem',
                    fontSize: 'var(--font-size-xs)',
                  }}
                  title="Usuń klienta z listy (historia wcześniejszych zamówień zachowuje snapshot danych klienta)"
                >
                  USUŃ
                </button>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
