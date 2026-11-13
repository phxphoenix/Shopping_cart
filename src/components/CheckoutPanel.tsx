import { useState, type FormEvent } from 'react';
import { centsToBtcString, BTC_RATE_PLN, type PaymentInput } from '@/domain/payment';
import { formatPLN } from '@/domain/money';
import { useShopStore } from '@/store/useShopStore';

type PaymentMethodType = 'card' | 'paypal' | 'bitcoin';

export function CheckoutPanel() {
  const { cart, getCartTotals, getSelectedCustomer, selectedCustomerId, placeOrder } =
    useShopStore();

  const [method, setMethod] = useState<PaymentMethodType>('card');
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [paypalEmail, setPaypalEmail] = useState('');
  const [btcWallet, setBtcWallet] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const totals = getCartTotals();
  const selectedCustomer = getSelectedCustomer();

  const clearForm = () => {
    setCardNumber('');
    setExpiry('');
    setCvv('');
    setPaypalEmail('');
    setBtcWallet('');
    setErrorMsg(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (cart.length === 0) {
      setErrorMsg('Koszyk jest pusty. Dodaj produkty przed złożeniem zamówienia.');
      return;
    }

    if (!selectedCustomerId) {
      setErrorMsg(
        'Brak aktywnego klienta. Wybierz lub zarejestruj klienta w panelu bazy klientów.'
      );
      return;
    }

    let paymentInput: PaymentInput;

    if (method === 'card') {
      if (!cardNumber.trim() || !expiry.trim() || !cvv.trim()) {
        setErrorMsg('Wypełnij wszystkie pola karty płatniczej (numer, data ważności, CVV).');
        return;
      }
      paymentInput = {
        method: 'card',
        cardNumber: cardNumber.trim(),
        expiry: expiry.trim(),
        cvv: cvv.trim(),
      };
    } else if (method === 'paypal') {
      if (!paypalEmail.trim()) {
        setErrorMsg('Wprowadź adres e-mail konta PayPal.');
        return;
      }
      paymentInput = {
        method: 'paypal',
        email: paypalEmail.trim(),
      };
    } else {
      if (!btcWallet.trim()) {
        setErrorMsg('Wprowadź adres portfela Bitcoin (Base58 1.../3... lub Bech32 bc1...).');
        return;
      }
      paymentInput = {
        method: 'bitcoin',
        walletAddress: btcWallet.trim(),
      };
    }

    setIsSubmitting(true);
    try {
      const result = await placeOrder(paymentInput);
      if (result.success) {
        // Natychmiastowe czyszczenie pól formularza (PCI-DSS Hygiene)
        clearForm();
      } else {
        setErrorMsg(result.error ?? 'Błąd podczas realizacji zamówienia');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const isOrderBlocked = cart.length === 0 || !selectedCustomerId;

  return (
    <section className="retro-panel" aria-labelledby="checkout-heading">
      <div className="panel-header">
        <h2 id="checkout-heading" className="panel-title">
          // KASA & PŁATNOŚĆ
        </h2>
      </div>

      {/* Podsumowanie klienta i kwoty */}
      <div
        style={{
          border: '1px solid var(--border-dim)',
          backgroundColor: 'var(--bg-main)',
          padding: '0.65rem 0.75rem',
          marginBottom: '0.85rem',
          fontSize: 'var(--font-size-xs)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.35rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--text-muted)' }}>Zamawiający:</span>
          {selectedCustomer ? (
            <strong style={{ color: 'var(--text-bright)' }}>{selectedCustomer.name}</strong>
          ) : (
            <span style={{ color: 'var(--warning)' }}>[Wybierz klienta w panelu]</span>
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--text-muted)' }}>Pozycji w koszyku:</span>
          <span>{totals.itemCount} szt.</span>
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            borderTop: '1px dotted var(--border-dim)',
            paddingTop: '0.35rem',
          }}
        >
          <strong style={{ color: 'var(--text-bright)' }}>Łącznie do zapłaty:</strong>
          <strong style={{ color: 'var(--accent)', fontSize: 'var(--font-size-sm)' }}>
            {formatPLN(totals.totalCents)}
          </strong>
        </div>
      </div>

      {/* Wybór metody płatności */}
      <div className="form-group">
        <div
          style={{
            fontSize: 'var(--font-size-xs)',
            color: 'var(--text-muted)',
            marginBottom: '0.35rem',
          }}
        >
          Wybierz metodę płatności:
        </div>
        <div
          role="group"
          aria-label="Wybór metody płatności"
          style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}
        >
          <button
            type="button"
            onClick={() => {
              setMethod('card');
              setErrorMsg(null);
            }}
            className={method === 'card' ? 'btn-active' : ''}
            aria-pressed={method === 'card'}
            style={{ fontSize: 'var(--font-size-xs)', flex: 1 }}
          >
            Karta kredytowa
          </button>
          <button
            type="button"
            onClick={() => {
              setMethod('paypal');
              setErrorMsg(null);
            }}
            className={method === 'paypal' ? 'btn-active' : ''}
            aria-pressed={method === 'paypal'}
            style={{ fontSize: 'var(--font-size-xs)', flex: 1 }}
          >
            PayPal
          </button>
          <button
            type="button"
            onClick={() => {
              setMethod('bitcoin');
              setErrorMsg(null);
            }}
            className={method === 'bitcoin' ? 'btn-active' : ''}
            aria-pressed={method === 'bitcoin'}
            style={{ fontSize: 'var(--font-size-xs)', flex: 1 }}
          >
            Bitcoin
          </button>
        </div>
      </div>

      {/* Dynamiczny formularz płatności */}
      <form onSubmit={handleSubmit} aria-label="Formularz finalizacji płatności">
        {/* Metoda 1: Karta kredytowa */}
        {method === 'card' && (
          <div
            style={{
              border: '1px solid var(--border-dim)',
              backgroundColor: 'var(--bg-main)',
              padding: '0.75rem',
              marginBottom: '0.85rem',
            }}
          >
            <div className="form-group">
              <label htmlFor="card-number" className="form-label">
                Numer karty (16 cyfr):
              </label>
              <input
                id="card-number"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                maxLength={19}
                value={cardNumber}
                onChange={(e) => setCardNumber(e.target.value)}
                placeholder="4532 0150 0000 0000"
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
              <div className="form-group">
                <label htmlFor="card-expiry" className="form-label">
                  Ważność (MM/RR):
                </label>
                <input
                  id="card-expiry"
                  type="text"
                  maxLength={5}
                  value={expiry}
                  onChange={(e) => setExpiry(e.target.value)}
                  placeholder="12/28"
                  autoComplete="off"
                />
              </div>

              <div className="form-group">
                <label htmlFor="card-cvv" className="form-label">
                  Kod CVV (3-4 cyfry):
                </label>
                <input
                  id="card-cvv"
                  type="password"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={4}
                  value={cvv}
                  onChange={(e) => setCvv(e.target.value)}
                  placeholder="•••"
                />
              </div>
            </div>

            <div
              style={{
                fontSize: '0.68rem',
                color: 'var(--text-dim)',
                lineHeight: 1.3,
                marginTop: '0.25rem',
              }}
            >
              [PCI-DSS SAFE] Numer karty podlega weryfikacji sumy kontrolnej Luhna i jest
              natychmiast maskowany (**** 1234). Kod CVV weryfikowany jest wyłącznie w pamięci RAM i
              nigdy nie trafia do bazy ani logów.
            </div>
          </div>
        )}

        {/* Metoda 2: PayPal */}
        {method === 'paypal' && (
          <div
            style={{
              border: '1px solid var(--border-dim)',
              backgroundColor: 'var(--bg-main)',
              padding: '0.75rem',
              marginBottom: '0.85rem',
            }}
          >
            <div className="form-group">
              <label htmlFor="paypal-email" className="form-label">
                Adres e-mail konta PayPal:
              </label>
              <input
                id="paypal-email"
                type="email"
                autoComplete="email"
                value={paypalEmail}
                onChange={(e) => setPaypalEmail(e.target.value)}
                placeholder="uzytkownik@paypal.com"
              />
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
              Płatność zostanie zweryfikowana z autoryzacją konta PayPal.
            </div>
          </div>
        )}

        {/* Metoda 3: Bitcoin */}
        {method === 'bitcoin' && (
          <div
            style={{
              border: '1px solid var(--border-dim)',
              backgroundColor: 'var(--bg-main)',
              padding: '0.75rem',
              marginBottom: '0.85rem',
            }}
          >
            <div className="form-group">
              <label htmlFor="btc-address" className="form-label">
                Adres portfela Bitcoin (Base58 / Bech32):
              </label>
              <input
                id="btc-address"
                type="text"
                value={btcWallet}
                onChange={(e) => setBtcWallet(e.target.value)}
                placeholder="1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa lub bc1..."
                autoComplete="off"
              />
            </div>

            <div
              style={{
                borderTop: '1px dotted var(--border-dim)',
                paddingTop: '0.5rem',
                fontSize: 'var(--font-size-xs)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.25rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Równowartość BTC:</span>
                <strong style={{ color: 'var(--accent)' }}>
                  ~{centsToBtcString(totals.totalCents)} BTC
                </strong>
              </div>
              <div style={{ color: 'var(--text-dim)', fontSize: '0.68rem' }}>
                Stały kurs rozliczeniowy: 1 BTC = {formatPLN(BTC_RATE_PLN * 100)}
              </div>
            </div>
          </div>
        )}

        {/* Komunikat błędu walidacji */}
        {errorMsg && (
          <div
            role="alert"
            className="form-error"
            style={{
              padding: '0.45rem 0.65rem',
              backgroundColor: 'var(--error-bg)',
              border: '1px solid var(--border-error)',
              marginBottom: '0.85rem',
              fontSize: 'var(--font-size-xs)',
            }}
          >
            ! BŁĄD: {errorMsg}
          </div>
        )}

        {/* Przycisk realizacji zamówienia */}
        <button
          type="submit"
          className="btn-primary"
          disabled={isOrderBlocked || isSubmitting}
          style={{ width: '100%', padding: '0.65rem', fontSize: 'var(--font-size-base)' }}
        >
          {isSubmitting ? 'PRZETWARZANIE PŁATNOŚCI...' : 'ZAMÓW I ZAPŁAĆ ->'}
        </button>

        {isOrderBlocked && (
          <div
            style={{
              fontSize: '0.72rem',
              color: 'var(--warning)',
              marginTop: '0.45rem',
              textAlign: 'center',
            }}
          >
            {cart.length === 0
              ? '[Koszyk jest pusty - dodaj produkty]'
              : '[Wybierz aktywnego klienta w panelu bazy klientów]'}
          </div>
        )}
      </form>
    </section>
  );
}
