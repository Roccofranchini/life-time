// tests/engine/tempo.test.ts
import { describe, it, expect } from 'vitest';
import {
  calcolaTempo,
  oreRetribuiteMese,
  oreLavoroFamiliare,
  prezzoInOre,
  ORE_MESE
} from '../../src/lib/engine/tempo';

const base = {
  netto_mensile: 1450,
  ore_settimanali: 40,
  minuti_pendolarismo: 60,
  ore_straordinario_non_pagato: 0,
  profilo_cura: 'media' as const,
  usa_auto: false,
  pasti_fuori_settimana: 5
};

describe('Contabilità del tempo', () => {
  it('40 ore settimanali fanno 173,3 ore al mese', () => {
    expect(oreRetribuiteMese(40)).toBeCloseTo(173.33, 2);
    expect(oreRetribuiteMese(20)).toBeCloseTo(86.67, 2);
  });

  it('le ore sottratte superano sempre quelle retribuite quando c’è pendolarismo', () => {
    const t = calcolaTempo(base);
    expect(t.ore_sottratte).toBeGreaterThan(t.ore_retribuite);
    expect(t.ore_sottratte).toBeCloseTo(
      t.ore_retribuite + t.ore_pendolarismo + t.ore_straordinario,
      6
    );
  });

  it('un’ora al giorno di pendolarismo vale circa 22 ore al mese', () => {
    const t = calcolaTempo(base);
    expect(t.ore_pendolarismo).toBeCloseTo(21.7, 1);
  });

  it('senza pendolarismo né straordinario, sottratte = retribuite', () => {
    const t = calcolaTempo({ ...base, minuti_pendolarismo: 0, ore_straordinario_non_pagato: 0 });
    expect(t.ore_sottratte).toBeCloseTo(t.ore_retribuite, 6);
    expect(t.ore_pendolarismo).toBe(0);
  });

  it('il bilancio del mese non sfora mai le 730 ore', () => {
    for (const ore of [20, 36, 40, 48, 60]) {
      for (const cura of ['uomo_occupato', 'donna_occupata', 'media'] as const) {
        const t = calcolaTempo({ ...base, ore_settimanali: ore, profilo_cura: cura });
        const somma =
          t.ore_sonno + t.ore_cura_personale + t.ore_lavoro_familiare + t.ore_sottratte + t.ore_libere;
        expect(somma).toBeLessThanOrEqual(ORE_MESE + 1e-6);
        expect(t.ore_libere).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('il divario di genere sul lavoro familiare vale circa 72 ore al mese', () => {
    const donne = oreLavoroFamiliare('donna_occupata');
    const uomini = oreLavoroFamiliare('uomo_occupato');
    expect(donne - uomini).toBeGreaterThan(65);
    expect(donne - uomini).toBeLessThan(80);
  });

  it('una donna occupata ha meno tempo libero di un uomo, a parità di lavoro', () => {
    const u = calcolaTempo({ ...base, profilo_cura: 'uomo_occupato' });
    const d = calcolaTempo({ ...base, profilo_cura: 'donna_occupata' });
    expect(d.ore_libere).toBeLessThan(u.ore_libere);
    expect(u.ore_libere - d.ore_libere).toBeCloseTo(
      oreLavoroFamiliare('donna_occupata') - oreLavoroFamiliare('uomo_occupato'),
      6
    );
  });
});

describe('Salario orario reale', () => {
  it('è sempre minore o uguale al nominale', () => {
    for (const min of [0, 20, 60, 120]) {
      for (const auto of [true, false]) {
        const t = calcolaTempo({ ...base, minuti_pendolarismo: min, usa_auto: auto });
        expect(t.salario_orario_reale).toBeLessThanOrEqual(t.salario_orario_nominale + 1e-9);
      }
    }
  });

  it('coincide col nominale solo se non c’è né tragitto né costo', () => {
    const t = calcolaTempo({
      ...base,
      minuti_pendolarismo: 0,
      pasti_fuori_settimana: 0,
      ore_straordinario_non_pagato: 0
    });
    expect(t.salario_orario_reale).toBeCloseTo(t.salario_orario_nominale, 6);
    expect(t.scarto_orario).toBeCloseTo(0, 6);
    expect(t.costi_del_lavoro_mese).toBe(0);
  });

  it('con un’ora di tragitto e pasti fuori lo scarto è nell’ordine del 20%', () => {
    const t = calcolaTempo(base);
    expect(t.scarto_orario).toBeGreaterThan(0.1);
    expect(t.scarto_orario).toBeLessThan(0.35);
  });

  it('due ore di tragitto in auto erodono più di due ore in metro', () => {
    const auto = calcolaTempo({ ...base, minuti_pendolarismo: 120, usa_auto: true });
    const tpl = calcolaTempo({ ...base, minuti_pendolarismo: 120, usa_auto: false });
    expect(auto.costi_del_lavoro_mese).toBeGreaterThan(tpl.costi_del_lavoro_mese);
    expect(auto.salario_orario_reale).toBeLessThan(tpl.salario_orario_reale);
  });

  it('lo straordinario non pagato abbassa il salario orario reale ma non il nominale', () => {
    const senza = calcolaTempo(base);
    const con = calcolaTempo({ ...base, ore_straordinario_non_pagato: 5 });
    expect(con.salario_orario_nominale).toBeCloseTo(senza.salario_orario_nominale, 6);
    expect(con.salario_orario_reale).toBeLessThan(senza.salario_orario_reale);
  });

  it('un prezzo costa più ore al salario reale che a quello nominale', () => {
    const t = calcolaTempo(base);
    const reali = prezzoInOre(100, t.salario_orario_reale);
    const nominali = prezzoInOre(100, t.salario_orario_nominale);
    expect(reali).toBeGreaterThan(nominali);
    expect(prezzoInOre(100, 0)).toBe(0);
  });

  it('non produce NaN con netto o ore nulle', () => {
    const t = calcolaTempo({ ...base, netto_mensile: 0, ore_settimanali: 0 });
    for (const v of Object.values(t)) expect(Number.isFinite(v as number)).toBe(true);
    expect(t.salario_orario_reale).toBe(0);
  });
});
