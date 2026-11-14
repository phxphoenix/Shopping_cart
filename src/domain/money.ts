/**
 * Domain module: Money & Cents
 *
 * Strict integer arithmetic for currency handling.
 * All amounts are represented as integer Cents (grosze), avoiding any floating-point
 * rounding errors in calculations.
 */

declare const CentsBrand: unique symbol;

/**
 * Branded type representing monetary values in integer Cents (grosze).
 * 1 PLN = 100 Cents.
 */
export type Cents = number & { readonly [CentsBrand]: true };

/**
 * Type guard for Cents.
 */
export function isCents(value: unknown): value is Cents {
  return typeof value === 'number' && Number.isSafeInteger(value);
}

/**
 * Converts a number to Cents, ensuring it is a safe integer.
 * Throws TypeError if the value is not a safe integer.
 */
export function toCents(value: number): Cents {
  if (!Number.isSafeInteger(value)) {
    throw new TypeError(`Expected safe integer for Cents, received: ${value}`);
  }
  return value as Cents;
}

/**
 * Converts a PLN float/decimal amount to Cents using Math.round(pln * 100).
 * INTENDED STRICTLY for importing legacy data.json or initial catalog fixtures.
 */
export function plnToCents(pln: number): Cents {
  if (!Number.isFinite(pln)) {
    throw new TypeError(`Expected finite number for PLN conversion, received: ${pln}`);
  }
  return toCents(Math.round(pln * 100));
}

/**
 * Converts Cents back to a floating-point PLN number (for presentation or legacy export).
 */
export function centsToPln(cents: Cents): number {
  return cents / 100;
}

/**
 * Sums multiple Cents values safely.
 */
export function addCents(...values: readonly Cents[]): Cents {
  const sum = values.reduce<number>((acc, v) => acc + v, 0);
  return toCents(sum);
}

/**
 * Subtracts b from a: (a - b).
 */
export function subtractCents(a: Cents, b: Cents): Cents {
  return toCents(a - b);
}

/**
 * Multiplies unit price in Cents by an integer quantity.
 * Throws RangeError if quantity is negative or not a safe integer.
 */
export function multiplyCents(unitPrice: Cents, quantity: number): Cents {
  if (!Number.isSafeInteger(quantity) || quantity < 0) {
    throw new RangeError(`Quantity must be a non-negative integer, received: ${quantity}`);
  }
  return toCents(unitPrice * quantity);
}

export interface FormatPlnOptions {
  /** If true, uses ASCII currency symbol 'zl' instead of 'zł' */
  readonly ascii?: boolean;
}

/**
 * Formats Cents into standard Polish currency format:
 * e.g. 349999 -> "3 499,99 zł" (or "3 499,99 zl" if ascii: true).
 * Handles negative values and zero correctly.
 */
export function formatPLN(cents: Cents | number, options: FormatPlnOptions = {}): string {
  if (!Number.isFinite(cents)) {
    return '0,00 zł';
  }
  const isNegative = cents < 0;
  const abs = Math.abs(Math.round(cents));
  const zlotys = Math.floor(abs / 100);
  const grosze = abs % 100;

  // Insert space every 3 digits from right
  const zlotysFormatted = zlotys.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const groszeFormatted = grosze.toString().padStart(2, '0');
  const currency = options.ascii ? 'zl' : 'zł';
  const sign = isNegative ? '-' : '';

  return `${sign}${zlotysFormatted},${groszeFormatted} ${currency}`;
}

/**
 * Parses a user-input PLN string into integer Cents without floating-point math.
 *
 * Accepted formats: "199.99", "199,99", "199.9", "199", with optional leading/trailing whitespace.
 * Rejects empty strings, negative amounts, more than 2 decimal places, or non-numeric characters.
 */
export function parsePlnInputToCents(rawInput: string): Cents {
  const trimmed = rawInput.trim();

  if (!trimmed) {
    throw new Error('Kwota nie może być pusta.');
  }

  if (trimmed.startsWith('-') || trimmed.includes('-')) {
    throw new RangeError('Kwota nie może być ujemna.');
  }

  const match = trimmed.match(/^(\d+)(?:[.,](\d{1,2}))?$/);
  if (!match) {
    if (/[.,]\d{3,}$/.test(trimmed)) {
      throw new RangeError('Kwota nie może mieć więcej niż 2 miejsca po przecinku.');
    }
    throw new Error(
      'Nieprawidłowy format kwoty. Wprowadź liczbę nieujemną (np. 199.99 lub 199,99).'
    );
  }

  const wholeStr = match[1]!;
  const fracStr = match[2] ?? '';

  const whole = Number.parseInt(wholeStr, 10);
  if (!Number.isSafeInteger(whole)) {
    throw new RangeError('Kwota przekracza maksymalną dopuszczalną wartość.');
  }

  const frac = fracStr.length > 0 ? Number.parseInt(fracStr.padEnd(2, '0'), 10) : 0;
  const totalCents = whole * 100 + frac;

  if (!Number.isSafeInteger(totalCents)) {
    throw new RangeError('Kwota przekracza maksymalną dopuszczalną wartość.');
  }

  return toCents(totalCents);
}
