import { describe, it, expect } from 'vitest';
import { validaFiscalInput, validaProvincia } from '../../src/lib/server/validation';

describe('validaFiscalInput', () => {
  const valido = {
    lordo_annuo: 25_000,
    tipo_contratto: 'indeterminato',
    regione: 'emilia-romagna',
    comune: 'bologna'
  };

  it('accetta un payload valido', () => {
    const r = validaFiscalInput(valido);
    expect(r.ok).toBe(true);
    expect(r.value?.lordo_annuo).toBe(25_000);
  });

  it('rifiuta body non-oggetto', () => {
    expect(validaFiscalInput(null).ok).toBe(false);
    expect(validaFiscalInput('stringa').ok).toBe(false);
    expect(validaFiscalInput([1, 2, 3]).ok).toBe(false);
    expect(validaFiscalInput(42).ok).toBe(false);
  });

  it('rifiuta lordo_annuo negativo o non numerico', () => {
    expect(validaFiscalInput({ ...valido, lordo_annuo: -100 }).ok).toBe(false);
    expect(validaFiscalInput({ ...valido, lordo_annuo: 'alto' }).ok).toBe(false);
    expect(validaFiscalInput({ ...valido, lordo_annuo: NaN }).ok).toBe(false);
    expect(validaFiscalInput({ ...valido, lordo_annuo: Infinity }).ok).toBe(false);
  });

  it('rifiuta tipo_contratto non ammesso', () => {
    const r = validaFiscalInput({ ...valido, tipo_contratto: 'stagista' });
    expect(r.ok).toBe(false);
    expect(r.error).toContain('tipo_contratto');
  });

  it('accetta percentuale_parttime in (0, 1]', () => {
    const r = validaFiscalInput({
      ...valido,
      tipo_contratto: 'parttime',
      percentuale_parttime: 0.6
    });
    expect(r.ok).toBe(true);
    expect(r.value?.percentuale_parttime).toBe(0.6);
  });

  it('rifiuta percentuale_parttime fuori range', () => {
    expect(validaFiscalInput({ ...valido, percentuale_parttime: 0 }).ok).toBe(false);
    expect(validaFiscalInput({ ...valido, percentuale_parttime: 1.5 }).ok).toBe(false);
    expect(validaFiscalInput({ ...valido, percentuale_parttime: -0.2 }).ok).toBe(false);
  });

  it('rifiuta campi non ammessi (anti-inject email/nome)', () => {
    const r = validaFiscalInput({ ...valido, email: 'a@b.c' });
    expect(r.ok).toBe(false);
    expect(r.error).toContain('email');

    const r2 = validaFiscalInput({ ...valido, nome: 'Mario Rossi' });
    expect(r2.ok).toBe(false);
  });

  it('rifiuta regione/comune vuoti', () => {
    expect(validaFiscalInput({ ...valido, regione: '' }).ok).toBe(false);
    expect(validaFiscalInput({ ...valido, comune: '   ' }).ok).toBe(false);
  });
});

describe('validaProvincia', () => {
  it('accetta codice ISTAT a 2 lettere, normalizzato uppercase', () => {
    expect(validaProvincia('BO').value).toBe('BO');
    expect(validaProvincia('bo').value).toBe('BO');
    expect(validaProvincia(' RM ').value).toBe('RM');
  });

  it('rifiuta formati non validi', () => {
    expect(validaProvincia(undefined).ok).toBe(false);
    expect(validaProvincia('').ok).toBe(false);
    expect(validaProvincia('BOL').ok).toBe(false);
    expect(validaProvincia('B').ok).toBe(false);
    expect(validaProvincia('B1').ok).toBe(false);
    expect(validaProvincia('!!').ok).toBe(false);
  });
});
