// tests/engine/formato.test.ts
import { describe, it, expect } from 'vitest';
import { formattaOre, formattaEuro } from '../../src/lib/formato';

describe('formattaOre', () => {
  it('non produce mai «60m»: i minuti arrotondati riportano sull’ora', () => {
    expect(formattaOre(51.999)).toBe('52h');
    expect(formattaOre(51.9917)).toBe('52h');
    expect(formattaOre(0.9999)).toBe('1h');
    for (let n = 0; n < 200; n += 0.0137) {
      expect(formattaOre(n)).not.toMatch(/\b60m\b/);
    }
  });

  it('formatta ore e minuti', () => {
    expect(formattaOre(7.5)).toBe('7h 30m');
    expect(formattaOre(173.333)).toBe('173h 20m');
    expect(formattaOre(8)).toBe('8h');
  });

  it('regge zero, negativi e non-numeri', () => {
    expect(formattaOre(0)).toBe('0h');
    expect(formattaOre(-5)).toBe('0h');
    expect(formattaOre(NaN)).toBe('0h');
    expect(formattaOre(Infinity)).toBe('0h');
  });
});

describe('formattaEuro', () => {
  it('arrotonda e usa le convenzioni italiane', () => {
    // In italiano (CLDR minimumGroupingDigits = 2) il separatore compare solo
    // da cinque cifre: 1827 resta «1827», 25578 diventa «25.578».
    expect(formattaEuro(1826.51)).toBe('1827');
    expect(formattaEuro(25578)).toBe('25.578');
    expect(formattaEuro(0)).toBe('0');
    expect(formattaEuro(-1500)).toBe('-1500');
  });

  it('regge i non-numeri', () => {
    expect(formattaEuro(NaN)).toBe('0');
    expect(formattaEuro(Infinity)).toBe('0');
  });
});
