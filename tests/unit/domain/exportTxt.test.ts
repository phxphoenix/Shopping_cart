import { describe, expect, it } from 'vitest';
import {
  type ExportOrderRecord,
  generateOrderHistoryFilename,
  generateOrderHistoryTxt,
} from '@/domain/exportTxt';
import { toCents } from '@/domain/money';

describe('domain/exportTxt', () => {
  describe('generateOrderHistoryFilename', () => {
    it('generates filename matching order_history_YYYYMMDD_HHMMSS.txt pattern', () => {
      const filename = generateOrderHistoryFilename();
      expect(filename).toMatch(/^order_history_\d{8}_\d{6}\.txt$/);
    });

    it('formats a specific date accurately with zero-padding', () => {
      // Month 10 = November (0-indexed)
      const date = new Date(2026, 10, 13, 8, 5, 9);
      const filename = generateOrderHistoryFilename(date);
      expect(filename).toBe('order_history_20261113_080509.txt');
    });
  });

  describe('generateOrderHistoryTxt', () => {
    it('generates friendly message when order history is empty', () => {
      const output = generateOrderHistoryTxt([]);

      expect(output).toContain('SHOPPING CART - ORDER HISTORY EXPORT');
      expect(output).toContain('Brak zamowien do wyeksportowania.');
    });

    it('generates well-formatted ASCII table for orders with diverse payment methods', () => {
      const orders: ExportOrderRecord[] = [
        {
          timestamp: '2026-11-13 08:30:00',
          customer: {
            name: 'Jan Kowalski',
            email: 'jan@example.com',
          },
          paymentMethod: 'Karta kredytowa',
          paymentDetails: {
            method: 'card',
            maskedCard: '**** **** **** 0366',
            last4: '0366',
            expiry: '12/28',
          },
          subtotalCents: toCents(349999), // 3499.99 PLN
          deliveryCents: toCents(0), // Free delivery
          totalCents: toCents(349999),
        },
        {
          timestamp: '2026-11-13 09:15:22',
          customer: {
            name: 'Anna Nowak',
            email: 'anna@example.com',
          },
          paymentMethod: 'PayPal',
          paymentDetails: {
            method: 'paypal',
            email: 'anna@example.com',
          },
          subtotalCents: toCents(7999), // 79.99 PLN
          deliveryCents: toCents(1500), // 15.00 PLN delivery
          totalCents: toCents(9499),
        },
        {
          timestamp: '2026-11-13 10:00:00',
          customer: {
            name: 'Satoshi Nakamoto',
            email: '',
          },
          paymentMethod: 'Bitcoin',
          paymentDetails: {
            method: 'bitcoin',
            walletAddress: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
            btcAmount: '0.00080000',
            btcRatePln: 250000,
          },
          subtotalCents: toCents(20000),
          deliveryCents: toCents(0),
          totalCents: toCents(20000),
        },
      ];

      const txt = generateOrderHistoryTxt(orders);

      // Verify ASCII table headers
      expect(txt).toContain('SHOPPING CART - ORDER HISTORY EXPORT');
      expect(txt).toContain(
        '| DATA                | KLIENT           | EMAIL            | PLATNOSC'
      );

      // Verify customer records
      expect(txt).toContain('Jan Kowalski');
      expect(txt).toContain('jan@example.com');
      expect(txt).toContain('Karta kredytowa (**** 0366)');
      expect(txt).toContain('3 499,99 zł');
      expect(txt).toContain('GRATIS');

      expect(txt).toContain('Anna Nowak');
      expect(txt).toContain('PayPal (anna@example.com)');
      expect(txt).toContain('79,99 zł');
      expect(txt).toContain('15,00 zł');
      expect(txt).toContain('94,99 zł');

      // Verify customer with missing email shows '-'
      expect(txt).toContain('Satoshi Nakamoto');
      expect(txt).toContain('Bitcoin (1A1zP1...vfNa)');

      // Verify summary footer
      expect(txt).toContain('Liczba zamowien: 3');
      // Total: 349999 + 9499 + 20000 = 379498 Cents = 3 794,98 zł
      expect(txt).toContain('Laczna kwota:    3 794,98 zł');

      // Verify border structures
      expect(txt).toMatch(/\+={10,}\+/);
      expect(txt).toMatch(/\+-{10,}\+/);

      // PCI-DSS verification: NO CVVs in export text
      expect(txt).not.toContain('cvv');
      expect(txt).not.toContain('CVV');
    });

    it('renders ASCII currency "zl" when options.ascii is true', () => {
      const orders: ExportOrderRecord[] = [
        {
          timestamp: '2026-11-13 11:00:00',
          customer: { name: 'Test', email: 'test@example.com' },
          paymentMethod: 'Karta kredytowa',
          subtotalCents: toCents(19999),
          deliveryCents: toCents(1500),
          totalCents: toCents(21499),
        },
      ];

      const txt = generateOrderHistoryTxt(orders, { ascii: true });
      expect(txt).toContain('199,99 zl');
      expect(txt).toContain('15,00 zl');
      expect(txt).toContain('214,99 zl');
      expect(txt).toContain('Laczna kwota:    214,99 zl');
    });

    it('handles fallback defaults for anonymous customers or missing payment details', () => {
      const orders: ExportOrderRecord[] = [
        {
          timestamp: '2026-11-13 12:00:00',
          customer: { name: '', email: undefined },
          paymentMethod: 'Gotówka',
          subtotalCents: toCents(5000),
          deliveryCents: toCents(1500),
          totalCents: toCents(6500),
        },
        {
          timestamp: '2026-11-13 12:05:00',
          customer: { name: 'Bob', email: 'bob@example.com' },
          paymentMethod: 'Bitcoin',
          paymentDetails: {
            method: 'bitcoin',
            walletAddress: 'short', // length <= 10
            btcAmount: '0.00010000',
            btcRatePln: 250000,
          },
          subtotalCents: toCents(1000),
          deliveryCents: toCents(0),
          totalCents: toCents(1000),
        },
      ];

      const txt = generateOrderHistoryTxt(orders);
      expect(txt).toContain('Anonimowy');
      expect(txt).toContain('-');
      expect(txt).toContain('Gotówka');
      expect(txt).toContain('Bitcoin (short)');
    });
  });
});
