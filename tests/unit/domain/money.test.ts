import { describe, expect, it } from 'vitest';
import {
  addCents,
  centsToPln,
  formatPLN,
  isCents,
  multiplyCents,
  parsePlnInputToCents,
  plnToCents,
  subtractCents,
  toCents,
} from '@/domain/money';

describe('domain/money', () => {
  describe('isCents & toCents', () => {
    it('identifies safe integers as valid Cents', () => {
      expect(isCents(0)).toBe(true);
      expect(isCents(100)).toBe(true);
      expect(isCents(-500)).toBe(true);
      expect(isCents(349999)).toBe(true);
    });

    it('rejects floating-point and non-number values', () => {
      expect(isCents(19.99)).toBe(false);
      expect(isCents(NaN)).toBe(false);
      expect(isCents(Infinity)).toBe(false);
      expect(isCents('100')).toBe(false);
      expect(isCents(null)).toBe(false);
      expect(isCents(undefined)).toBe(false);
    });

    it('toCents returns branded Cents for valid integer', () => {
      const cents = toCents(1500);
      expect(cents).toBe(1500);
    });

    it('toCents throws TypeError on float or non-integer', () => {
      expect(() => toCents(15.5)).toThrow(TypeError);
      expect(() => toCents(NaN)).toThrow(TypeError);
      expect(() => toCents(Infinity)).toThrow(TypeError);
    });
  });

  describe('plnToCents & centsToPln', () => {
    it('converts PLN decimal to integer Cents using Math.round', () => {
      expect(plnToCents(3499.99)).toBe(349999);
      expect(plnToCents(199.99)).toBe(19999);
      expect(plnToCents(79.99)).toBe(7999);
      expect(plnToCents(149.99)).toBe(14999);
      expect(plnToCents(59.99)).toBe(5999);
      expect(plnToCents(200.0)).toBe(20000);
      expect(plnToCents(15.0)).toBe(1500);
      expect(plnToCents(0.01)).toBe(1);
      expect(plnToCents(0)).toBe(0);
    });

    it('handles rounding edge cases properly', () => {
      expect(plnToCents(0.005)).toBe(1);
      expect(plnToCents(0.004)).toBe(0);
    });

    it('throws TypeError if pln is not finite', () => {
      expect(() => plnToCents(NaN)).toThrow(TypeError);
      expect(() => plnToCents(Infinity)).toThrow(TypeError);
    });

    it('converts Cents back to float PLN', () => {
      expect(centsToPln(toCents(349999))).toBe(3499.99);
      expect(centsToPln(toCents(1500))).toBe(15.0);
      expect(centsToPln(toCents(0))).toBe(0);
    });
  });

  describe('addCents & subtractCents', () => {
    it('adds multiple Cents values without precision loss', () => {
      const sum = addCents(toCents(19999), toCents(7999), toCents(1500));
      expect(sum).toBe(29498);
    });

    it('returns 0 when adding empty arguments', () => {
      expect(addCents()).toBe(0);
    });

    it('subtracts Cents correctly', () => {
      expect(subtractCents(toCents(20000), toCents(19999))).toBe(1);
      expect(subtractCents(toCents(1500), toCents(2000))).toBe(-500);
    });
  });

  describe('multiplyCents', () => {
    it('multiplies price by integer quantity', () => {
      expect(multiplyCents(toCents(19999), 3)).toBe(59997);
      expect(multiplyCents(toCents(349999), 0)).toBe(0);
    });

    it('throws RangeError for negative or non-integer quantities', () => {
      expect(() => multiplyCents(toCents(100), -1)).toThrow(RangeError);
      expect(() => multiplyCents(toCents(100), 2.5)).toThrow(RangeError);
      expect(() => multiplyCents(toCents(100), NaN)).toThrow(RangeError);
    });
  });

  describe('formatPLN', () => {
    it('formats amounts in standard Polish format (thousands space, comma decimals, zł symbol)', () => {
      expect(formatPLN(toCents(349999))).toBe('3 499,99 zł');
      expect(formatPLN(toCents(19999))).toBe('199,99 zł');
      expect(formatPLN(toCents(7999))).toBe('79,99 zł');
      expect(formatPLN(toCents(20000))).toBe('200,00 zł');
      expect(formatPLN(toCents(1500))).toBe('15,00 zł');
      expect(formatPLN(toCents(0))).toBe('0,00 zł');
      expect(formatPLN(toCents(5))).toBe('0,05 zł');
    });

    it('formats large numbers with grouped thousands', () => {
      expect(formatPLN(toCents(25000000))).toBe('250 000,00 zł');
      expect(formatPLN(toCents(100000000))).toBe('1 000 000,00 zł');
    });

    it('formats negative amounts with a minus sign', () => {
      expect(formatPLN(toCents(-1500))).toBe('-15,00 zł');
      expect(formatPLN(toCents(-123456))).toBe('-1 234,56 zł');
    });

    it('supports ascii: true option returning "zl"', () => {
      expect(formatPLN(toCents(349999), { ascii: true })).toBe('3 499,99 zl');
      expect(formatPLN(toCents(19999), { ascii: true })).toBe('199,99 zl');
    });

    it('handles non-finite input gracefully by returning fallback', () => {
      expect(formatPLN(NaN)).toBe('0,00 zł');
      expect(formatPLN(Infinity)).toBe('0,00 zł');
    });
  });

  describe('parsePlnInputToCents (Strict Integer Parsing without Floats)', () => {
    it('correctly parses dot-separated amounts', () => {
      expect(parsePlnInputToCents('199.99')).toBe(19999);
      expect(parsePlnInputToCents('199.9')).toBe(19990);
      expect(parsePlnInputToCents('199.0')).toBe(19900);
      expect(parsePlnInputToCents('199.00')).toBe(19900);
      expect(parsePlnInputToCents('0.05')).toBe(5);
      expect(parsePlnInputToCents('0.50')).toBe(50);
      expect(parsePlnInputToCents('3499.99')).toBe(349999);
    });

    it('correctly parses comma-separated amounts', () => {
      expect(parsePlnInputToCents('199,99')).toBe(19999);
      expect(parsePlnInputToCents('199,9')).toBe(19990);
      expect(parsePlnInputToCents('0,05')).toBe(5);
      expect(parsePlnInputToCents('0,5')).toBe(50);
      expect(parsePlnInputToCents('15,00')).toBe(1500);
    });

    it('correctly parses integer amounts without decimal parts', () => {
      expect(parsePlnInputToCents('199')).toBe(19900);
      expect(parsePlnInputToCents('0')).toBe(0);
      expect(parsePlnInputToCents('200')).toBe(20000);
      expect(parsePlnInputToCents('15')).toBe(1500);
    });

    it('ignores leading and trailing whitespace', () => {
      expect(parsePlnInputToCents('   199.99   ')).toBe(19999);
      expect(parsePlnInputToCents('\t199,99\n')).toBe(19999);
      expect(parsePlnInputToCents('  200  ')).toBe(20000);
    });

    it('throws Error for empty or whitespace-only strings', () => {
      expect(() => parsePlnInputToCents('')).toThrow(/Kwota nie może być pusta/);
      expect(() => parsePlnInputToCents('   ')).toThrow(/Kwota nie może być pusta/);
      expect(() => parsePlnInputToCents('\t\n')).toThrow(/Kwota nie może być pusta/);
    });

    it('throws RangeError for negative amounts', () => {
      expect(() => parsePlnInputToCents('-10')).toThrow(RangeError);
      expect(() => parsePlnInputToCents('-10.50')).toThrow(RangeError);
      expect(() => parsePlnInputToCents(' -0.01 ')).toThrow(RangeError);
      expect(() => parsePlnInputToCents('-0,50')).toThrow(RangeError);
    });

    it('throws RangeError for amounts with more than 2 decimal places', () => {
      expect(() => parsePlnInputToCents('199.999')).toThrow(RangeError);
      expect(() => parsePlnInputToCents('199,999')).toThrow(RangeError);
      expect(() => parsePlnInputToCents('0.005')).toThrow(RangeError);
      expect(() => parsePlnInputToCents('12.3456')).toThrow(RangeError);
    });

    it('throws Error for non-numeric or malformed strings', () => {
      expect(() => parsePlnInputToCents('abc')).toThrow(/Nieprawidłowy format kwoty/);
      expect(() => parsePlnInputToCents('12a')).toThrow(/Nieprawidłowy format kwoty/);
      expect(() => parsePlnInputToCents('12.3.4')).toThrow(/Nieprawidłowy format kwoty/);
      expect(() => parsePlnInputToCents('10 000')).toThrow(/Nieprawidłowy format kwoty/);
      expect(() => parsePlnInputToCents('PLN 100')).toThrow(/Nieprawidłowy format kwoty/);
    });

    it('throws RangeError for excessively large numbers exceeding safe integer range', () => {
      expect(() => parsePlnInputToCents('99999999999999999999999999')).toThrow(RangeError);
      expect(() => parsePlnInputToCents('9007199254740990.00')).toThrow(RangeError);
    });
  });
});
