// tests/engine/valore.test.ts
// Il test che la v1 non poteva superare: le quattro fette devono sommare
// esattamente al valore aggiunto, per costruzione e non per riscalamento.
import { describe, it, expect } from 'vitest';
import { calcolaFisco } from '../../src/lib/engine/fiscal';
import { decomponiValore, quotaLavoro, INCERTEZZA_QUOTA } from '../../src/lib/engine/valore';
import { oreRetribuiteMese } from '../../src/lib/engine/tempo';

const ORE = oreRetribuiteMese(40);
const SETTORI = ['commercio', 'metalmeccanici', 'logistica', 'ristorazione', 'pulizie', 'sanita-privata'];
const LORDI = [12000, 18000, 25578, 35000, 55000, 90000];

function decomponi(lordo: number, settore: string, ore = ORE) {
  const f = calcolaFisco({ lordo_annuo: lordo, tipo_contratto: 'dipendente', regione: 'lazio', settore_id: settore });
  return { f, v: decomponiValore(f, settore, ore) };
}

describe('Decomposizione del valore aggiunto', () => {
  it('le quattro fette sommano al valore aggiunto, in euro', () => {
    for (const settore of SETTORI) {
      for (const lordo of LORDI) {
        const { v } = decomponi(lordo, settore);
        const somma = v.profitto.euro + v.previdenza.euro + v.imposte.euro + v.netto.euro;
        expect(somma).toBeCloseTo(v.valore_aggiunto_mensile, 6);
      }
    }
  });

  it('le quattro frazioni sommano a 1', () => {
    for (const settore of SETTORI) {
      for (const lordo of LORDI) {
        const { v } = decomponi(lordo, settore);
        const somma =
          v.profitto.frazione + v.previdenza.frazione + v.imposte.frazione + v.netto.frazione;
        expect(somma).toBeCloseTo(1, 9);
      }
    }
  });

  it('le quattro fette in ore sommano alle ore di lavoro retribuito', () => {
    for (const settore of SETTORI) {
      for (const lordo of LORDI) {
        const { v } = decomponi(lordo, settore);
        const somma = v.profitto.ore + v.previdenza.ore + v.imposte.ore + v.netto.ore;
        expect(somma).toBeCloseTo(ORE, 6);
      }
    }
  });

  it('nessuna fetta può sforare il totale — il bug che la v1 doveva rattoppare', () => {
    // Caso limite della v1: costi di sopravvivenza superiori al netto facevano
    // esplodere la torta. Qui le fette sono quote di una somma, quindi il caso
    // non è nemmeno rappresentabile.
    for (const lordo of [9000, 11000, 14000]) {
      const { v } = decomponi(lordo, 'ristorazione');
      for (const q of [v.profitto, v.previdenza, v.imposte, v.netto]) {
        expect(q.ore).toBeLessThanOrEqual(ORE + 1e-9);
        expect(q.frazione).toBeLessThanOrEqual(1 + 1e-9);
      }
    }
  });

  it('il valore aggiunto è sempre ≥ costo del lavoro', () => {
    for (const settore of SETTORI) {
      const { f, v } = decomponi(30000, settore);
      expect(v.valore_aggiunto_mensile).toBeGreaterThanOrEqual(f.costo_lavoro_annuo / 12 - 1e-9);
    }
  });

  it('un settore a bassa quota del lavoro estrae più profitto', () => {
    const alta = decomponi(25000, 'pulizie').v; // quota 0.82
    const bassa = decomponi(25000, 'metalmeccanici').v; // quota 0.62
    expect(quotaLavoro('pulizie')).toBeGreaterThan(quotaLavoro('metalmeccanici'));
    expect(bassa.profitto.ore).toBeGreaterThan(alta.profitto.ore);
  });

  it('nel settore pubblico il profitto è zero per convenzione dichiarata', () => {
    for (const s of ['pubblica-amministrazione', 'scuola', 'funzioni-locali']) {
      const { v } = decomponi(30000, s);
      expect(v.settore_pubblico).toBe(true);
      expect(v.quota_lavoro).toBe(1);
      expect(v.profitto.euro).toBeCloseTo(0, 6);
      expect(v.profitto_banda.min_ore).toBe(0);
      expect(v.profitto_banda.max_ore).toBe(0);
    }
  });

  it('la banda di incertezza contiene la stima puntuale ed è ordinata', () => {
    for (const settore of SETTORI) {
      const { v } = decomponi(28000, settore);
      expect(v.profitto_banda.min_ore).toBeLessThanOrEqual(v.profitto.ore + 1e-9);
      expect(v.profitto_banda.max_ore).toBeGreaterThanOrEqual(v.profitto.ore - 1e-9);
      expect(v.profitto_banda.min_euro).toBeLessThanOrEqual(v.profitto_banda.max_euro);
      expect(v.incertezza_quota).toBe(INCERTEZZA_QUOTA);
    }
  });

  it('la previdenza pesa più delle imposte sui redditi bassi', () => {
    // Il risultato politico che la v1 non poteva mostrare: sotto i 20.000 €
    // il prelievo fiscale netto è negativo, mentre la contribuzione resta piena.
    const { v } = decomponi(15000, 'commercio');
    expect(v.imposte.euro).toBeLessThan(0);
    expect(v.previdenza.euro).toBeGreaterThan(0);
    expect(v.previdenza.ore).toBeGreaterThan(Math.abs(v.imposte.ore));
  });

  it('nel lavoro nero non c’è previdenza e il margine è più alto', () => {
    const f = calcolaFisco({ lordo_annuo: 14400, tipo_contratto: 'nero', regione: 'campania', settore_id: 'nero' });
    const v = decomponiValore(f, 'nero', ORE);
    expect(v.previdenza.euro).toBe(0);
    expect(v.imposte.euro).toBe(0);
    expect(v.netto.frazione + v.profitto.frazione).toBeCloseTo(1, 9);
    expect(v.profitto.frazione).toBeGreaterThan(0.35);
  });

  it('non produce NaN su input degeneri', () => {
    const f = calcolaFisco({ lordo_annuo: 0, tipo_contratto: 'dipendente', regione: 'lazio', settore_id: 'commercio' });
    const v = decomponiValore(f, 'commercio', 0);
    for (const q of [v.profitto, v.previdenza, v.imposte, v.netto]) {
      expect(Number.isFinite(q.euro)).toBe(true);
      expect(Number.isFinite(q.frazione)).toBe(true);
      expect(Number.isFinite(q.ore)).toBe(true);
    }
  });
});
