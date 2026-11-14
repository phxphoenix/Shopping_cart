/**
 * Domain module: Payments & PCI-DSS Hygiene
 *
 * Implements validation for 3 payment methods (Credit Card, PayPal, Bitcoin).
 *
 * PCI-DSS Hygiene:
 * - CVV is validated strictly in transient memory and is NEVER persisted, logged, or returned.
 * - Full credit card numbers are immediately discarded after Luhn validation.
 * - Only masked card format (`**** **** **** 1234`) and last 4 digits are retained.
 */

import { type Cents, toCents } from './money.js';

/** Fixed exchange rate: 1 BTC = 250 000.00 PLN (matching legacy/payments.py) */
export const BTC_RATE_PLN = 250000;

export interface CardPaymentInput {
  readonly method: 'card';
  readonly cardNumber: string;
  readonly expiry: string;
  readonly cvv: string;
}

export interface PayPalPaymentInput {
  readonly method: 'paypal';
  readonly email: string;
}

export interface BitcoinPaymentInput {
  readonly method: 'bitcoin';
  readonly walletAddress: string;
  readonly btcRatePln?: number;
}

export type PaymentInput = CardPaymentInput | PayPalPaymentInput | BitcoinPaymentInput;

export interface SafeCardPayment {
  readonly method: 'card';
  readonly maskedCard: string;
  readonly last4: string;
  readonly expiry: string;
}

export interface SafePayPalPayment {
  readonly method: 'paypal';
  readonly email: string;
}

export interface SafeBitcoinPayment {
  readonly method: 'bitcoin';
  readonly walletAddress: string;
  readonly btcAmount: string;
  readonly btcRatePln: number;
}

export type SafePaymentInfo = SafeCardPayment | SafePayPalPayment | SafeBitcoinPayment;

export class PaymentValidationError extends Error {
  public readonly errors: readonly string[];

  constructor(errors: readonly string[]) {
    super(`Payment validation failed: ${errors.join('; ')}`);
    this.name = 'PaymentValidationError';
    this.errors = errors;
  }
}

/**
 * Validates a string of digits using the standard Luhn algorithm (mod 10).
 */
export function validateLuhn(digits: string): boolean {
  if (!/^\d+$/.test(digits)) {
    return false;
  }

  let sum = 0;
  let shouldDouble = false;

  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = Number.parseInt(digits.charAt(i), 10);

    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }

    sum += digit;
    shouldDouble = !shouldDouble;
  }

  return sum % 10 === 0;
}

/**
 * Normalizes and masks a 16-digit card number.
 * Returns `**** **** **** 1234`.
 */
export function maskCardNumber(cardNumber: string): {
  masked: string;
  last4: string;
} {
  const clean = cardNumber.replace(/[\s-]/g, '');
  const last4 = clean.slice(-4);
  return {
    masked: `**** **** **** ${last4}`,
    last4,
  };
}

/**
 * Validates credit card payment inputs:
 * - Exactly 16 digits after stripping spaces/hyphens
 * - Luhn checksum verification
 * - Expiration date (MM/RR or MM/YYYY) not prior to the reference month
 * - CVV (3 or 4 digits)
 *
 * CVV and full card number are discarded immediately after this check.
 */
export function validateCardPayment(
  input: CardPaymentInput,
  now: Date = new Date()
): SafeCardPayment {
  const errors: string[] = [];
  const cleanNumber = input.cardNumber.replace(/[\s-]/g, '');

  if (!/^\d{16}$/.test(cleanNumber)) {
    errors.push('Numer karty musi zawierać dokładnie 16 cyfr');
  } else if (!validateLuhn(cleanNumber)) {
    errors.push('Nieprawidłowa suma kontrolna numeru karty (błąd algorytmu Luhna)');
  }

  // Expiry check
  const expiryMatch = input.expiry.trim().match(/^(0[1-9]|1[0-2])\/(\d{2}|\d{4})$/);
  if (!expiryMatch) {
    errors.push('Data ważności musi być w formacie MM/RR (np. 12/28)');
  } else {
    const month = Number.parseInt(expiryMatch[1] ?? '0', 10);
    const rawYear = expiryMatch[2] ?? '0';
    const year =
      rawYear.length === 2 ? 2000 + Number.parseInt(rawYear, 10) : Number.parseInt(rawYear, 10);

    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 1-12

    if (year < currentYear || (year === currentYear && month < currentMonth)) {
      errors.push('Karta płatnicza straciła ważność');
    }
  }

  // CVV check (in memory only!)
  const cleanCvv = input.cvv.trim();
  if (!/^\d{3,4}$/.test(cleanCvv)) {
    errors.push('Kod CVV musi składać się z 3 lub 4 cyfr');
  }

  if (errors.length > 0) {
    throw new PaymentValidationError(errors);
  }

  const { masked, last4 } = maskCardNumber(cleanNumber);
  const normalizedExpiry = `${expiryMatch![1]}/${(expiryMatch![2] ?? '').slice(-2)}`;

  return {
    method: 'card',
    maskedCard: masked,
    last4,
    expiry: normalizedExpiry,
  };
}

/**
 * Validates PayPal payment email.
 */
export function validatePayPalPayment(input: PayPalPaymentInput): SafePayPalPayment {
  const email = input.email.trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  if (!email || !emailRegex.test(email)) {
    throw new PaymentValidationError(['Nieprawidłowy adres e-mail konta PayPal']);
  }

  return {
    method: 'paypal',
    email,
  };
}

/**
 * Converts Cents to a formatted Bitcoin amount string with 8 decimal places (satoshis).
 */
export function centsToBtcString(cents: Cents, btcRatePln: number = BTC_RATE_PLN): string {
  if (btcRatePln <= 0) {
    throw new RangeError('Kurs BTC/PLN musi być dodatni');
  }
  const pln = cents / 100;
  const btc = pln / btcRatePln;
  return btc.toFixed(8);
}

/**
 * Validates a Bitcoin wallet address:
 * - Base58 addresses (P2PKH starting with '1', P2SH starting with '3'), length 26-35,
 *   characters excluding '0', 'O', 'I', 'l'.
 * - Bech32 addresses (Native SegWit / Taproot starting with 'bc1'), length 42-62, alphanumeric.
 */
export function isValidBitcoinAddress(address: string): boolean {
  const trimmed = address.trim();

  // Base58Check (starts with 1 or 3, length 26..35, no 0, O, I, l)
  const isBase58 = /^[13][1-9A-HJ-NP-Za-km-z]{25,34}$/.test(trimmed);
  if (isBase58) {
    return true;
  }

  // Bech32 / Bech32m (starts with bc1, length 42..62)
  const isBech32 = /^bc1[ac-hj-np-z02-9]{39,59}$/i.test(trimmed);
  if (isBech32 && trimmed.length >= 42 && trimmed.length <= 62) {
    return true;
  }

  return false;
}

/**
 * Validates Bitcoin payment inputs and computes the BTC amount.
 */
export function validateBitcoinPayment(
  input: BitcoinPaymentInput,
  totalCents: Cents = toCents(0),
  btcRatePln: number = BTC_RATE_PLN
): SafeBitcoinPayment {
  const address = input.walletAddress.trim();

  if (!isValidBitcoinAddress(address)) {
    throw new PaymentValidationError([
      'Nieprawidłowy adres portfela Bitcoin (wymagany adres Base58 1.../3... lub Bech32 bc1...)',
    ]);
  }

  const rate = input.btcRatePln ?? btcRatePln;
  const btcAmount = centsToBtcString(totalCents, rate);

  return {
    method: 'bitcoin',
    walletAddress: address,
    btcAmount,
    btcRatePln: rate,
  };
}

export interface ValidatePaymentOptions {
  readonly totalCents?: Cents;
  readonly now?: Date;
  readonly btcRatePln?: number;
}

/**
 * Unified payment validator.
 * Accepts any raw payment input and returns sanitized SafePaymentInfo.
 * Throws PaymentValidationError if validation fails.
 */
export function validatePayment(
  input: PaymentInput,
  options: ValidatePaymentOptions = {}
): SafePaymentInfo {
  switch (input.method) {
    case 'card':
      return validateCardPayment(input, options.now);
    case 'paypal':
      return validatePayPalPayment(input);
    case 'bitcoin':
      return validateBitcoinPayment(
        input,
        options.totalCents ?? toCents(0),
        options.btcRatePln ?? BTC_RATE_PLN
      );
  }
}

export type SafePaymentValidationResult =
  | { readonly success: true; readonly data: SafePaymentInfo }
  | { readonly success: false; readonly errors: readonly string[] };

/**
 * Safe (non-throwing) payment validator wrapper.
 */
export function validatePaymentSafe(
  input: PaymentInput,
  options: ValidatePaymentOptions = {}
): SafePaymentValidationResult {
  try {
    const data = validatePayment(input, options);
    return { success: true, data };
  } catch (error) {
    if (error instanceof PaymentValidationError) {
      return { success: false, errors: error.errors };
    }
    return {
      success: false,
      errors: [error instanceof Error ? error.message : 'Unknown validation error'],
    };
  }
}
