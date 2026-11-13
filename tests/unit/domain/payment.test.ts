import { describe, expect, it } from 'vitest';
import { toCents } from '@/domain/money';
import {
  BTC_RATE_PLN,
  PaymentValidationError,
  centsToBtcString,
  isValidBitcoinAddress,
  maskCardNumber,
  validateBitcoinPayment,
  validateCardPayment,
  validateLuhn,
  validatePayPalPayment,
  validatePayment,
  validatePaymentSafe,
} from '@/domain/payment';

describe('domain/payment', () => {
  // Reference date: November 15, 2026
  const testNow = new Date(2026, 10, 15);

  describe('validateLuhn', () => {
    it('validates correct card numbers', () => {
      expect(validateLuhn('4532015112830366')).toBe(true);
      expect(validateLuhn('5500000000000004')).toBe(true);
    });

    it('rejects invalid Luhn checksums', () => {
      expect(validateLuhn('4532015112830367')).toBe(false);
      expect(validateLuhn('1234567812345678')).toBe(false);
    });

    it('rejects non-digit strings', () => {
      expect(validateLuhn('4532-0151-1283-0366')).toBe(false);
      expect(validateLuhn('abc')).toBe(false);
      expect(validateLuhn('')).toBe(false);
    });
  });

  describe('maskCardNumber', () => {
    it('masks 16-digit card number and preserves only the last 4 digits', () => {
      const { masked, last4 } = maskCardNumber('4532 0151 1283 0366');
      expect(masked).toBe('**** **** **** 0366');
      expect(last4).toBe('0366');
    });

    it('handles formatted input with hyphens or spaces', () => {
      const { masked, last4 } = maskCardNumber('5500-0000-0000-0004');
      expect(masked).toBe('**** **** **** 0004');
      expect(last4).toBe('0004');
    });
  });

  describe('validateCardPayment (PCI-DSS Hygiene)', () => {
    const validCardInput = {
      method: 'card' as const,
      cardNumber: '4532 0151 1283 0366',
      expiry: '12/28',
      cvv: '789',
    };

    it('successfully validates a valid credit card and discards CVV / full PAN', () => {
      const result = validateCardPayment(validCardInput, testNow);

      expect(result.method).toBe('card');
      expect(result.maskedCard).toBe('**** **** **** 0366');
      expect(result.last4).toBe('0366');
      expect(result.expiry).toBe('12/28');

      // CRITICAL PCI-DSS ASSERTIONS:
      expect(result).not.toHaveProperty('cvv');
      expect(result).not.toHaveProperty('cardNumber');
      expect(JSON.stringify(result).includes('789')).toBe(false);
      expect(JSON.stringify(result).includes('4532')).toBe(false);
    });

    it('accepts 4-digit CVV (e.g. Amex style)', () => {
      const input = { ...validCardInput, cvv: '1234' };
      const result = validateCardPayment(input, testNow);
      expect(result.maskedCard).toBe('**** **** **** 0366');
    });

    it('normalizes 4-digit year format (e.g. 12/2028 -> 12/28)', () => {
      const input = { ...validCardInput, expiry: '12/2028' };
      const result = validateCardPayment(input, testNow);
      expect(result.expiry).toBe('12/28');
    });

    it('accepts card expiring in the current reference month', () => {
      // testNow is November 2026 -> 11/26 is valid until end of month
      const input = { ...validCardInput, expiry: '11/26' };
      const result = validateCardPayment(input, testNow);
      expect(result.expiry).toBe('11/26');
    });

    it('rejects card expired in the previous month', () => {
      // testNow is November 2026 -> 10/26 is expired
      const input = { ...validCardInput, expiry: '10/26' };
      expect(() => validateCardPayment(input, testNow)).toThrow(PaymentValidationError);
    });

    it('rejects card expired in a previous year', () => {
      const input = { ...validCardInput, expiry: '12/25' };
      expect(() => validateCardPayment(input, testNow)).toThrow(PaymentValidationError);
    });

    it('rejects invalid expiry format', () => {
      expect(() => validateCardPayment({ ...validCardInput, expiry: '13/28' }, testNow)).toThrow(
        PaymentValidationError
      );
      expect(() => validateCardPayment({ ...validCardInput, expiry: '00/28' }, testNow)).toThrow(
        PaymentValidationError
      );
      expect(() => validateCardPayment({ ...validCardInput, expiry: 'invalid' }, testNow)).toThrow(
        PaymentValidationError
      );
    });

    it('rejects card number with invalid length (not 16 digits)', () => {
      expect(() =>
        validateCardPayment(
          { ...validCardInput, cardNumber: '453201511283036' }, // 15 digits
          testNow
        )
      ).toThrow(PaymentValidationError);

      expect(() =>
        validateCardPayment(
          { ...validCardInput, cardNumber: '45320151128303661' }, // 17 digits
          testNow
        )
      ).toThrow(PaymentValidationError);
    });

    it('rejects card number failing Luhn algorithm', () => {
      expect(() =>
        validateCardPayment({ ...validCardInput, cardNumber: '4532015112830367' }, testNow)
      ).toThrow(PaymentValidationError);
    });

    it('rejects invalid CVV (e.g. 2 digits, 5 digits, or letters)', () => {
      expect(() => validateCardPayment({ ...validCardInput, cvv: '12' }, testNow)).toThrow(
        PaymentValidationError
      );

      expect(() => validateCardPayment({ ...validCardInput, cvv: '12345' }, testNow)).toThrow(
        PaymentValidationError
      );

      expect(() => validateCardPayment({ ...validCardInput, cvv: 'abc' }, testNow)).toThrow(
        PaymentValidationError
      );
    });

    it('collects multiple validation errors into the exception', () => {
      try {
        validateCardPayment(
          {
            method: 'card',
            cardNumber: '123',
            expiry: '99/99',
            cvv: 'ab',
          },
          testNow
        );
        expect.fail('Should have thrown PaymentValidationError');
      } catch (err) {
        expect(err).toBeInstanceOf(PaymentValidationError);
        const pve = err as PaymentValidationError;
        expect(pve.errors.length).toBeGreaterThanOrEqual(3);
      }
    });
  });

  describe('validatePayPalPayment', () => {
    it('accepts valid email address', () => {
      const result = validatePayPalPayment({
        method: 'paypal',
        email: 'user@example.com',
      });
      expect(result.method).toBe('paypal');
      expect(result.email).toBe('user@example.com');
    });

    it('rejects invalid email formats', () => {
      expect(() => validatePayPalPayment({ method: 'paypal', email: 'invalid-email' })).toThrow(
        PaymentValidationError
      );

      expect(() => validatePayPalPayment({ method: 'paypal', email: 'missing@domain' })).toThrow(
        PaymentValidationError
      );

      expect(() => validatePayPalPayment({ method: 'paypal', email: '  ' })).toThrow(
        PaymentValidationError
      );
    });
  });

  describe('isValidBitcoinAddress', () => {
    it('accepts valid Base58 P2PKH addresses (starting with 1)', () => {
      expect(isValidBitcoinAddress('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa')).toBe(true);
      expect(isValidBitcoinAddress('1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2')).toBe(true);
    });

    it('accepts valid Base58 P2SH addresses (starting with 3)', () => {
      expect(isValidBitcoinAddress('3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy')).toBe(true);
    });

    it('accepts valid Bech32 Native SegWit addresses (starting with bc1)', () => {
      expect(isValidBitcoinAddress('bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq')).toBe(true);
    });

    it('rejects invalid Bitcoin addresses', () => {
      // Disallowed characters in Base58 (0, O, I, l)
      expect(isValidBitcoinAddress('1A1zP1eP5QGefi2DMPTfTL5SLmv7Div0Na')).toBe(false);
      // Too short
      expect(isValidBitcoinAddress('1A1zP1eP5QGefi2DMPT')).toBe(false);
      // Wrong prefix
      expect(isValidBitcoinAddress('4A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa')).toBe(false);
      // Arbitrary string
      expect(isValidBitcoinAddress('not-a-wallet')).toBe(false);
    });
  });

  describe('centsToBtcString & validateBitcoinPayment', () => {
    it('converts amounts to BTC satoshi precision with default rate 250 000 PLN', () => {
      // 250 000 PLN (25 000 000 Cents) = 1.00000000 BTC
      expect(centsToBtcString(toCents(25000000), BTC_RATE_PLN)).toBe('1.00000000');

      // 3499.99 PLN (349999 Cents) -> 3499.99 / 250000 = 0.01399996 BTC
      expect(centsToBtcString(toCents(349999), BTC_RATE_PLN)).toBe('0.01399996');
    });

    it('throws RangeError if btcRatePln is <= 0', () => {
      expect(() => centsToBtcString(toCents(100), 0)).toThrow(RangeError);
      expect(() => centsToBtcString(toCents(100), -500)).toThrow(RangeError);
    });

    it('validates Bitcoin payment with correct wallet and amount', () => {
      const result = validateBitcoinPayment(
        {
          method: 'bitcoin',
          walletAddress: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
        },
        toCents(349999)
      );

      expect(result.method).toBe('bitcoin');
      expect(result.walletAddress).toBe('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa');
      expect(result.btcAmount).toBe('0.01399996');
      expect(result.btcRatePln).toBe(BTC_RATE_PLN);
    });

    it('throws PaymentValidationError on invalid wallet', () => {
      expect(() =>
        validateBitcoinPayment({
          method: 'bitcoin',
          walletAddress: 'invalid-address',
        })
      ).toThrow(PaymentValidationError);
    });
  });

  describe('unified validatePayment & validatePaymentSafe', () => {
    it('routes card payment correctly', () => {
      const res = validatePayment(
        {
          method: 'card',
          cardNumber: '4532015112830366',
          expiry: '12/28',
          cvv: '123',
        },
        { now: testNow }
      );
      expect(res.method).toBe('card');
    });

    it('routes paypal payment correctly', () => {
      const res = validatePayment({
        method: 'paypal',
        email: 'test@paypal.com',
      });
      expect(res.method).toBe('paypal');
    });

    it('routes bitcoin payment correctly', () => {
      const res = validatePayment(
        {
          method: 'bitcoin',
          walletAddress: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
        },
        { totalCents: toCents(20000) }
      );
      expect(res.method).toBe('bitcoin');
    });

    it('validatePaymentSafe returns success result without throwing', () => {
      const safe = validatePaymentSafe(
        {
          method: 'card',
          cardNumber: '4532015112830366',
          expiry: '12/28',
          cvv: '123',
        },
        { now: testNow }
      );
      expect(safe.success).toBe(true);
      if (safe.success) {
        expect(safe.data.method).toBe('card');
      }
    });

    it('validatePaymentSafe returns failure result with error messages on invalid input', () => {
      const safe = validatePaymentSafe(
        {
          method: 'card',
          cardNumber: '0000',
          expiry: 'invalid',
          cvv: '0',
        },
        { now: testNow }
      );
      expect(safe.success).toBe(false);
      if (!safe.success) {
        expect(safe.errors.length).toBeGreaterThanOrEqual(1);
      }
    });

    it('validatePaymentSafe catches generic non-validation exceptions (e.g. RangeError)', () => {
      const safe = validatePaymentSafe(
        {
          method: 'bitcoin',
          walletAddress: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
          btcRatePln: -10, // Invalid non-positive rate triggers RangeError
        },
        { totalCents: toCents(100) }
      );
      expect(safe.success).toBe(false);
      if (!safe.success) {
        expect(safe.errors[0]).toContain('Kurs BTC/PLN musi być dodatni');
      }
    });
  });
});
