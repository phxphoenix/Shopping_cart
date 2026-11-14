/**
 * Domain module: Customer Validation & Privacy (PII Hygiene v3)
 *
 * Enforces strict input validation for customer registration, anti-bot honeypot checks,
 * case-insensitive email uniqueness, and PII masking for public customer lists.
 */

import { z } from 'zod';
import type { Customer } from './schemas';

/**
 * Zod schema for new customer registration.
 *
 * Validations:
 * - `name`: 3-80 chars (after trim), letters, spaces, hyphens, and apostrophes only.
 *   Disallows digits, HTML/XSS brackets, and multiple consecutive spaces.
 * - `email`: trimmed and lowercased, valid email format with TLD domain, max 120 chars.
 * - `honeypot` / `companyWebsite`: anti-bot trap fields. Must remain empty.
 */
export const RegisterCustomerInputSchema = z
  .object({
    name: z
      .string({ required_error: 'Imię i nazwisko jest wymagane' })
      .transform((val) => val.trim())
      .pipe(
        z
          .string()
          .min(3, 'Imię i nazwisko musi zawierać od 3 do 80 znaków.')
          .max(80, 'Imię i nazwisko musi zawierać od 3 do 80 znaków.')
          .regex(
            /^[\p{L}\s'\u2019\u02BC-]+$/u,
            'Imię i nazwisko może zawierać wyłącznie litery, spacje, myślniki i apostrofy (cyfry i znaki specjalne są niedozwolone).'
          )
          .refine((val) => !val.includes('  '), {
            message: 'Imię i nazwisko nie może zawierać podwójnych spacji.',
          })
          .refine((val) => !/[<>]/.test(val), {
            message: 'Wykryto niedozwolone znaki HTML / skryptowe.',
          })
      ),
    email: z
      .string({ required_error: 'Adres e-mail jest wymagany' })
      .transform((val) => val.trim().toLowerCase())
      .pipe(
        z
          .string()
          .max(120, 'Adres e-mail może zawierać maksymalnie 120 znaków.')
          .email('Nieprawidłowy format adresu e-mail.')
          .refine(
            (val) => {
              const parts = val.split('@');
              if (parts.length !== 2) return false;
              const domain = parts[1]!;
              return /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain);
            },
            {
              message: 'Adres e-mail musi zawierać prawidłową domenę z końcówką TLD.',
            }
          )
      ),
    honeypot: z.string().optional().default(''),
    companyWebsite: z.string().optional().default(''),
  })
  .refine(
    (data) => {
      const hp = data.honeypot?.trim();
      const cw = data.companyWebsite?.trim();
      return (!hp || hp.length === 0) && (!cw || cw.length === 0);
    },
    {
      message: 'Wykryto aktywność automatyczną (anty-spam honeypot).',
      path: ['honeypot'],
    }
  );

export type RegisterCustomerInput = z.infer<typeof RegisterCustomerInputSchema>;

/**
 * Checks whether an email address is unique among existing customers (case-insensitive).
 *
 * @param customers Current customer list
 * @param email Email address to check
 * @param excludeId Optional customer ID to exclude (e.g. during profile update)
 * @returns `true` if unique, `false` if already in use
 */
export function validateUniqueCustomerEmail(
  customers: readonly Customer[],
  email: string,
  excludeId?: string
): boolean {
  const normalized = email.trim().toLowerCase();
  return !customers.some(
    (c) => c.email.trim().toLowerCase() === normalized && (!excludeId || c.id !== excludeId)
  );
}

/**
 * Asserts that an email address is unique, throwing an error if a conflict exists.
 */
export function assertUniqueCustomerEmail(
  customers: readonly Customer[],
  email: string,
  excludeId?: string
): void {
  if (!validateUniqueCustomerEmail(customers, email, excludeId)) {
    throw new Error(`Klient z adresem e-mail "${email.trim().toLowerCase()}" już istnieje.`);
  }
}

/**
 * Fully validates customer registration input:
 * 1. Validates schema (name length/format, email format/TLD, empty honeypot).
 * 2. Checks email uniqueness among existing customers (case-insensitive).
 *
 * Throws a descriptive Polish Error on failure.
 * Returns the normalized `{ name, email }` on success.
 */
export function validateNewCustomerRegistration(
  customers: readonly Customer[],
  rawInput: unknown
): { name: string; email: string } {
  const parsed = RegisterCustomerInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    throw new Error(firstIssue?.message ?? 'Niepoprawne dane formularza rejestracji.');
  }

  const { name, email } = parsed.data;

  if (!validateUniqueCustomerEmail(customers, email)) {
    throw new Error(`Klient z adresem e-mail "${email}" jest już zarejestrowany w systemie.`);
  }

  return { name, email };
}

/**
 * Masks customer email address for public display without leaking PII.
 *
 * Examples:
 * - "jan.kowalski@example.com" -> "j***i@example.com"
 * - "ab@example.com" -> "a***@example.com"
 * - "a@example.com" -> "a***@example.com"
 * - invalid / empty -> "***"
 */
export function maskCustomerEmail(email: string): string {
  const trimmed = email.trim();
  const atIndex = trimmed.lastIndexOf('@');
  if (atIndex <= 0 || atIndex === trimmed.length - 1) {
    return '***';
  }

  const user = trimmed.slice(0, atIndex);
  const domain = trimmed.slice(atIndex + 1);

  if (user.length <= 1) {
    return `${user}***@${domain}`;
  }

  if (user.length === 2) {
    return `${user[0]}***@${domain}`;
  }

  return `${user[0]}***${user[user.length - 1]}@${domain}`;
}
