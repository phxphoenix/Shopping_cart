import { describe, expect, it } from 'vitest';
import {
  RegisterCustomerInputSchema,
  assertUniqueCustomerEmail,
  maskCustomerEmail,
  validateNewCustomerRegistration,
  validateUniqueCustomerEmail,
} from '@/domain/customer';
import type { Customer } from '@/domain/schemas';

describe('domain/customer (Registration Validation, Honeypot & PII Masking)', () => {
  const existingCustomers: readonly Customer[] = [
    {
      id: 'cust-1',
      name: 'Jan Kowalski',
      email: 'jan.kowalski@example.com',
    },
    {
      id: 'cust-2',
      name: 'Anna Nowak',
      email: 'anna.nowak@example.com',
    },
    {
      id: 'cust-3',
      name: 'Marek Z-Dąbrowski',
      email: 'marek@sub.domain.org',
    },
  ];

  describe('RegisterCustomerInputSchema', () => {
    it('accepts valid customer registration inputs with Polish characters, hyphens, and apostrophes', () => {
      const valid = {
        name: 'Stanisław Żółć-Gęśl',
        email: 'stanislaw.zolc@example.pl',
      };
      const result = RegisterCustomerInputSchema.safeParse(valid);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('Stanisław Żółć-Gęśl');
        expect(result.data.email).toBe('stanislaw.zolc@example.pl');
      }
    });

    it('trims leading/trailing whitespace and lowercases email', () => {
      const input = {
        name: '   Grażyna O’Connor   ',
        email: '   GRAZYNA.OCONNOR@EXAMPLE.COM   ',
      };
      const result = RegisterCustomerInputSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('Grażyna O’Connor');
        expect(result.data.email).toBe('grazyna.oconnor@example.com');
      }
    });

    it('rejects names shorter than 3 or longer than 80 characters', () => {
      expect(
        RegisterCustomerInputSchema.safeParse({ name: 'Al', email: 'al@example.com' }).success
      ).toBe(false);

      expect(
        RegisterCustomerInputSchema.safeParse({ name: 'A'.repeat(81), email: 'a@example.com' })
          .success
      ).toBe(false);
    });

    it('rejects names containing numbers or special punctuation characters', () => {
      expect(
        RegisterCustomerInputSchema.safeParse({
          name: 'Jan Kowalski 123',
          email: 'jan@example.com',
        }).success
      ).toBe(false);

      expect(
        RegisterCustomerInputSchema.safeParse({ name: 'Jan_Kowalski', email: 'jan@example.com' })
          .success
      ).toBe(false);

      expect(
        RegisterCustomerInputSchema.safeParse({ name: 'Jan@Kowalski', email: 'jan@example.com' })
          .success
      ).toBe(false);
    });

    it('rejects names containing double consecutive spaces', () => {
      expect(
        RegisterCustomerInputSchema.safeParse({ name: 'Jan  Kowalski', email: 'jan@example.com' })
          .success
      ).toBe(false);
    });

    it('rejects names containing HTML or script tags (XSS prevention)', () => {
      expect(
        RegisterCustomerInputSchema.safeParse({
          name: '<script>alert(1)</script>',
          email: 'xss@example.com',
        }).success
      ).toBe(false);

      expect(
        RegisterCustomerInputSchema.safeParse({
          name: 'Jan <b>Kowalski</b>',
          email: 'xss@example.com',
        }).success
      ).toBe(false);
    });

    it('rejects invalid email formats or domains lacking a proper TLD', () => {
      expect(
        RegisterCustomerInputSchema.safeParse({ name: 'Jan Kowalski', email: 'not-an-email' })
          .success
      ).toBe(false);

      expect(
        RegisterCustomerInputSchema.safeParse({ name: 'Jan Kowalski', email: 'jan@localhost' })
          .success
      ).toBe(false);

      expect(
        RegisterCustomerInputSchema.safeParse({ name: 'Jan Kowalski', email: 'jan@nodot' }).success
      ).toBe(false);

      expect(
        RegisterCustomerInputSchema.safeParse({
          name: 'Jan Kowalski',
          email: 'a'.repeat(115) + '@test.com', // > 120 chars
        }).success
      ).toBe(false);
    });

    describe('Anti-bot Honeypot validation', () => {
      it('accepts registration when honeypot fields are empty, undefined, or whitespace-only', () => {
        expect(
          RegisterCustomerInputSchema.safeParse({
            name: 'Piotr Zieliński',
            email: 'piotr@example.com',
            honeypot: '',
          }).success
        ).toBe(true);

        expect(
          RegisterCustomerInputSchema.safeParse({
            name: 'Piotr Zieliński',
            email: 'piotr@example.com',
            companyWebsite: '   ',
          }).success
        ).toBe(true);

        expect(
          RegisterCustomerInputSchema.safeParse({
            name: 'Piotr Zieliński',
            email: 'piotr@example.com',
          }).success
        ).toBe(true);
      });

      it('rejects registration when honeypot or companyWebsite field is populated by a spam bot', () => {
        const hpResult = RegisterCustomerInputSchema.safeParse({
          name: 'Spam Bot',
          email: 'bot@spammer.org',
          honeypot: 'http://spam-link.com',
        });
        expect(hpResult.success).toBe(false);
        if (!hpResult.success) {
          expect(hpResult.error.issues[0]?.message).toContain('anty-spam honeypot');
        }

        const cwResult = RegisterCustomerInputSchema.safeParse({
          name: 'Spam Bot',
          email: 'bot@spammer.org',
          companyWebsite: 'commercial-offer.com',
        });
        expect(cwResult.success).toBe(false);
        if (!cwResult.success) {
          expect(cwResult.error.issues[0]?.message).toContain('anty-spam honeypot');
        }
      });
    });
  });

  describe('validateUniqueCustomerEmail & assertUniqueCustomerEmail', () => {
    it('returns true when email does not exist in customer list', () => {
      expect(validateUniqueCustomerEmail(existingCustomers, 'nowy.klient@example.com')).toBe(true);
    });

    it('returns false when email already exists (case-insensitive check)', () => {
      expect(validateUniqueCustomerEmail(existingCustomers, 'jan.kowalski@example.com')).toBe(
        false
      );
      expect(validateUniqueCustomerEmail(existingCustomers, 'JAN.KOWALSKI@EXAMPLE.COM')).toBe(
        false
      );
      expect(validateUniqueCustomerEmail(existingCustomers, '  Anna.Nowak@example.com  ')).toBe(
        false
      );
    });

    it('excludes specified customer ID during self-update', () => {
      expect(
        validateUniqueCustomerEmail(existingCustomers, 'jan.kowalski@example.com', 'cust-1')
      ).toBe(true);

      // Still detects conflict if conflicting with a different customer
      expect(
        validateUniqueCustomerEmail(existingCustomers, 'jan.kowalski@example.com', 'cust-2')
      ).toBe(false);
    });

    it('assertUniqueCustomerEmail throws descriptive error on duplicate email', () => {
      expect(() =>
        assertUniqueCustomerEmail(existingCustomers, 'jan.kowalski@example.com')
      ).toThrow(/już istnieje/);

      expect(() =>
        assertUniqueCustomerEmail(existingCustomers, 'unikalny@example.com')
      ).not.toThrow();
    });
  });

  describe('validateNewCustomerRegistration', () => {
    it('validates and returns normalized registration data for a valid new customer', () => {
      const input = {
        name: 'Tadeusz Mazowiecki',
        email: 'tadeusz.m@example.com',
      };
      const result = validateNewCustomerRegistration(existingCustomers, input);
      expect(result).toEqual({
        name: 'Tadeusz Mazowiecki',
        email: 'tadeusz.m@example.com',
      });
    });

    it('throws error when registration contains an existing email', () => {
      const duplicateInput = {
        name: 'Jan Klon',
        email: 'JAN.KOWALSKI@EXAMPLE.COM',
      };
      expect(() => validateNewCustomerRegistration(existingCustomers, duplicateInput)).toThrow(
        /jest już zarejestrowany/
      );
    });

    it('throws error when registration fails schema validation', () => {
      expect(() =>
        validateNewCustomerRegistration(existingCustomers, {
          name: '12',
          email: 'invalid',
        })
      ).toThrow();
    });

    it('throws error when honeypot is populated', () => {
      expect(() =>
        validateNewCustomerRegistration(existingCustomers, {
          name: 'Bot Jan',
          email: 'bot@example.com',
          honeypot: 'spam content',
        })
      ).toThrow(/anty-spam honeypot/);
    });
  });

  describe('maskCustomerEmail (PII Sanitization for Public Views)', () => {
    it('masks standard Polish/international email addresses', () => {
      expect(maskCustomerEmail('jan.kowalski@example.com')).toBe('j***i@example.com');
      expect(maskCustomerEmail('anna.nowak@poczta.onet.pl')).toBe('a***k@poczta.onet.pl');
      expect(maskCustomerEmail('stanislaw@domain.org')).toBe('s***w@domain.org');
    });

    it('masks short usernames correctly', () => {
      // 2-character username
      expect(maskCustomerEmail('ab@example.com')).toBe('a***@example.com');
      expect(maskCustomerEmail('jk@retro.shop')).toBe('j***@retro.shop');

      // 1-character username
      expect(maskCustomerEmail('a@example.com')).toBe('a***@example.com');
    });

    it('handles emails with whitespace by trimming before masking', () => {
      expect(maskCustomerEmail('   jan.kowalski@example.com   ')).toBe('j***i@example.com');
    });

    it('returns placeholder *** for invalid or malformed email strings', () => {
      expect(maskCustomerEmail('')).toBe('***');
      expect(maskCustomerEmail('invalid-email')).toBe('***');
      expect(maskCustomerEmail('@example.com')).toBe('***');
      expect(maskCustomerEmail('user@')).toBe('***');
      expect(maskCustomerEmail('   ')).toBe('***');
    });
  });
});
