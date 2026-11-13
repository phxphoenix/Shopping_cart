import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CheckoutPanel } from '@/components/CheckoutPanel';
import { DEFAULT_CATALOG } from '@/domain/catalog';
import { useShopStore } from '@/store/useShopStore';

describe('CheckoutPanel UI Integration', () => {
  const customer = { id: 'cust-chk-1', name: 'Jan Testowy', email: 'jan@test.pl' };
  const product = DEFAULT_CATALOG[0]!; // Laptop (3499.99 PLN)

  beforeEach(() => {
    useShopStore.setState({
      customers: [customer],
      selectedCustomerId: customer.id,
      cart: [
        {
          product,
          quantity: 1,
          lineTotalCents: product.priceCents,
        },
      ],
      orders: [],
    });
  });

  describe('Credit Card Payment', () => {
    it('displays error alert when card number fails Luhn algorithm check', async () => {
      const user = userEvent.setup();
      render(<CheckoutPanel />);

      const cardInput = screen.getByLabelText(/Numer karty \(16 cyfr\):/i);
      const expiryInput = screen.getByLabelText(/Ważność \(MM\/RR\):/i);
      const cvvInput = screen.getByLabelText(/Kod CVV \(3-4 cyfry\):/i);
      const submitBtn = screen.getByRole('button', { name: /ZAMÓW I ZAPŁAĆ/i });

      // 4532 0151 1283 0367 fails Luhn check
      await user.type(cardInput, '4532 0151 1283 0367');
      await user.type(expiryInput, '12/28');
      await user.type(cvvInput, '123');
      await user.click(submitBtn);

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/Nieprawidłowa suma kontrolna numeru karty/i)).toBeInTheDocument();
      expect(useShopStore.getState().orders).toHaveLength(0);
    });

    it('displays error alert when card is expired', async () => {
      const user = userEvent.setup();
      render(<CheckoutPanel />);

      const cardInput = screen.getByLabelText(/Numer karty \(16 cyfr\):/i);
      const expiryInput = screen.getByLabelText(/Ważność \(MM\/RR\):/i);
      const cvvInput = screen.getByLabelText(/Kod CVV \(3-4 cyfry\):/i);
      const submitBtn = screen.getByRole('button', { name: /ZAMÓW I ZAPŁAĆ/i });

      // Valid Luhn card, but expired
      await user.type(cardInput, '4532 0151 1283 0366');
      await user.type(expiryInput, '01/20');
      await user.type(cvvInput, '123');
      await user.click(submitBtn);

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/Karta płatnicza straciła ważność/i)).toBeInTheDocument();
      expect(useShopStore.getState().orders).toHaveLength(0);
    });

    it('displays error alert when CVV code is invalid', async () => {
      const user = userEvent.setup();
      render(<CheckoutPanel />);

      const cardInput = screen.getByLabelText(/Numer karty \(16 cyfr\):/i);
      const expiryInput = screen.getByLabelText(/Ważność \(MM\/RR\):/i);
      const cvvInput = screen.getByLabelText(/Kod CVV \(3-4 cyfry\):/i);
      const submitBtn = screen.getByRole('button', { name: /ZAMÓW I ZAPŁAĆ/i });

      await user.type(cardInput, '4532 0151 1283 0366');
      await user.type(expiryInput, '12/28');
      await user.type(cvvInput, '12'); // Only 2 digits (requires 3 or 4)
      await user.click(submitBtn);

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/Kod CVV musi składać się z 3 lub 4 cyfr/i)).toBeInTheDocument();
      expect(useShopStore.getState().orders).toHaveLength(0);
    });

    it('completes order with valid card, masks card number, and enforces PCI-DSS hygiene (no CVV)', async () => {
      const user = userEvent.setup();
      render(<CheckoutPanel />);

      const cardInput = screen.getByLabelText(/Numer karty \(16 cyfr\):/i);
      const expiryInput = screen.getByLabelText(/Ważność \(MM\/RR\):/i);
      const cvvInput = screen.getByLabelText(/Kod CVV \(3-4 cyfry\):/i);
      const submitBtn = screen.getByRole('button', { name: /ZAMÓW I ZAPŁAĆ/i });

      // Valid Luhn card, future expiry, valid CVV
      await user.type(cardInput, '4532 0151 1283 0366');
      await user.type(expiryInput, '12/28');
      await user.type(cvvInput, '987');
      await user.click(submitBtn);

      // Order created in store
      const orders = useShopStore.getState().orders;
      expect(orders).toHaveLength(1);
      const order = orders[0]!;

      // PCI-DSS Hygiene Assertions
      expect(order.paymentMethod).toBe('Karta kredytowa');
      expect(order.paymentDetails?.method).toBe('card');
      if (order.paymentDetails?.method === 'card') {
        expect(order.paymentDetails.maskedCard).toBe('**** **** **** 0366');
        expect(order.paymentDetails.last4).toBe('0366');
        expect(order.paymentDetails.expiry).toBe('12/28');
        // CVV MUST NOT EXIST in the order object
        expect('cvv' in order.paymentDetails).toBe(false);
      }

      // Input fields must be cleared from the DOM
      expect(cardInput).toHaveValue('');
      expect(expiryInput).toHaveValue('');
      expect(cvvInput).toHaveValue('');

      // Cart is cleared after successful order
      expect(useShopStore.getState().cart).toHaveLength(0);
    });
  });

  describe('PayPal Payment', () => {
    it('validates invalid PayPal email and completes order on valid email', async () => {
      const user = userEvent.setup();
      render(<CheckoutPanel />);

      // Switch to PayPal tab
      const paypalTab = screen.getByRole('button', { name: /PayPal/i });
      await user.click(paypalTab);

      const emailInput = screen.getByLabelText(/Adres e-mail konta PayPal:/i);
      const submitBtn = screen.getByRole('button', { name: /ZAMÓW I ZAPŁAĆ/i });

      // Invalid email
      await user.type(emailInput, 'niepoprawny-email');
      await user.click(submitBtn);

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/Nieprawidłowy adres e-mail konta PayPal/i)).toBeInTheDocument();
      expect(useShopStore.getState().orders).toHaveLength(0);

      // Valid email
      await user.clear(emailInput);
      await user.type(emailInput, 'platnosc@paypal.com');
      await user.click(submitBtn);

      const orders = useShopStore.getState().orders;
      expect(orders).toHaveLength(1);
      expect(orders[0]?.paymentMethod).toBe('PayPal');
      expect(orders[0]?.paymentDetails).toEqual({
        method: 'paypal',
        email: 'platnosc@paypal.com',
      });
    });
  });

  describe('Bitcoin Payment', () => {
    it('shows dynamic BTC equivalent, validates address, and completes order', async () => {
      const user = userEvent.setup();
      render(<CheckoutPanel />);

      // Switch to Bitcoin tab
      const btcTab = screen.getByRole('button', { name: /Bitcoin/i });
      await user.click(btcTab);

      // BTC equivalent should be displayed
      expect(screen.getByText(/Równowartość BTC:/i)).toBeInTheDocument();
      expect(screen.getByText(/~0\.01399996 BTC/i)).toBeInTheDocument();

      const btcInput = screen.getByLabelText(/Adres portfela Bitcoin/i);
      const submitBtn = screen.getByRole('button', { name: /ZAMÓW I ZAPŁAĆ/i });

      // Invalid address
      await user.type(btcInput, 'niepoprawny-adres-btc-123');
      await user.click(submitBtn);

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/Nieprawidłowy adres portfela Bitcoin/i)).toBeInTheDocument();
      expect(useShopStore.getState().orders).toHaveLength(0);

      // Valid Base58 address
      await user.clear(btcInput);
      await user.type(btcInput, '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa');
      await user.click(submitBtn);

      const orders = useShopStore.getState().orders;
      expect(orders).toHaveLength(1);
      expect(orders[0]?.paymentMethod).toBe('Bitcoin');
      expect(orders[0]?.paymentDetails?.method).toBe('bitcoin');
    });
  });
});
