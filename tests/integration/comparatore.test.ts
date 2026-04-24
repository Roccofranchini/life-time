// tests/integration/comparatore.test.ts
// Sanity check end-to-end del comparatore città:
// garantisce che due province ragionevolmente diverse (Bolzano capolista
// del costo della vita vs Catanzaro in basso) producano una diff di "ore
// di lavoro forzate" (sopravvivenza + stato) chiaramente > 0.
//
// Regressione: fino al 2026-04-23 tutte le province non esplicite
// ricadevano sullo stesso DEFAULT_FALLBACK, rendendo il diff sempre 0.

import { describe, it, expect } from 'vitest';
import { costiFallback } from '../../src/lib/server/costi-fallback';
import { calcola_netto } from '../../src/lib/engine/fiscal';
import { calcola_sopravvivenza } from '../../src/lib/engine/survival';
import { calcola_breakdown_temporale } from '../../src/lib/engine/time';

const LORDO_ANNUO = 23_140; // commercio livello 4 × 13 mensilità
const ORE_LAV = (40 * 52) / 12;
const SETTORE = 'commercio';
const CONSUMO_BENZINA_L = 40;

function simula(codice: string, regione: string, comune: string) {
  const c = costiFallback(codice);
  const fisc = calcola_netto({
    lordo_annuo: LORDO_ANNUO,
    tipo_contratto: 'indeterminato',
    regione,
    comune
  });
  const surv = calcola_sopravvivenza({
    affitto: c.affitto_bilocale_periferia,
    spesa_minima: c.spesa_alimentare_minima,
    bollette: c.bollette_stimate,
    carburante_mensile_stimato: c.carburante_benzina_litro * CONSUMO_BENZINA_L,
    netto_mensile: fisc.netto_mensile,
    ore_lavoro_mensili: ORE_LAV
  });
  const brk = calcola_breakdown_temporale({
    survival: surv,
    fiscal: fisc,
    lordo_annuo: LORDO_ANNUO,
    ore_lavoro_mensili: ORE_LAV,
    settore_id: SETTORE,
    affitto: c.affitto_bilocale_periferia
  });
  return { costi: c, fisc, brk };
}

describe('ComparatoreCitta — diff ore forzate', () => {
  it('Bolzano vs Catanzaro produce una differenza > 30h/mese', () => {
    const bz = simula('BZ', 'trentino-alto-adige', 'bolzano');
    const cz = simula('CZ', 'calabria', 'catanzaro');

    const forzateBZ = bz.brk.ore_sopravvivenza + bz.brk.ore_stato;
    const forzateCZ = cz.brk.ore_sopravvivenza + cz.brk.ore_stato;
    const diff = forzateBZ - forzateCZ;

    // Il costo della vita tra BZ e CZ è così divaricato che il diff deve
    // essere sostanziale, non marginale.
    expect(diff).toBeGreaterThan(30);
  });

  it('il fallback differenzia tutte le 107 province (no collasso sul default)', async () => {
    const provMod = await import('../../src/lib/data/province.json');
    const province = (provMod.default as { province: { codice: string }[] }).province;
    const affitti = new Set<number>();
    for (const p of province) {
      const c = costiFallback(p.codice);
      affitti.add(c.affitto_bilocale_periferia);
    }
    // Prima del fix: tutte le province non esplicite → stesso default.
    // Dopo: almeno 15 livelli distinti di affitto.
    expect(affitti.size).toBeGreaterThanOrEqual(15);
  });

  it('Bolzano ha affitto > Milano × 0.85 e > Catanzaro × 2', () => {
    const bz = costiFallback('BZ');
    const mi = costiFallback('MI');
    const cz = costiFallback('CZ');
    expect(bz.affitto_bilocale_periferia).toBeGreaterThan(
      mi.affitto_bilocale_periferia * 0.85
    );
    expect(bz.affitto_bilocale_periferia).toBeGreaterThan(
      cz.affitto_bilocale_periferia * 2
    );
  });
});
