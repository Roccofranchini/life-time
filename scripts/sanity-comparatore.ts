// scripts/sanity-comparatore.ts
// Script manuale di ispezione: stampa i valori BZ vs CZ come li vedrebbe
// un utente nel comparatore. Da eseguire con `npx vitest run scripts/...`
// o via `tsx` (necessita dev-dependency).
import { costiFallback } from '../src/lib/server/costi-fallback';
import { calcola_netto } from '../src/lib/engine/fiscal';
import { calcola_sopravvivenza } from '../src/lib/engine/survival';
import { calcola_breakdown_temporale } from '../src/lib/engine/time';

const LORDO_ANNUO = 23_140;
const ORE_LAV = (40 * 52) / 12;

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
    carburante_mensile_stimato: c.carburante_benzina_litro * 40,
    netto_mensile: fisc.netto_mensile,
    ore_lavoro_mensili: ORE_LAV
  });
  const brk = calcola_breakdown_temporale({
    survival: surv,
    fiscal: fisc,
    lordo_annuo: LORDO_ANNUO,
    ore_lavoro_mensili: ORE_LAV,
    settore_id: 'commercio',
    affitto: c.affitto_bilocale_periferia
  });
  return { c, fisc, brk };
}

const bz = simula('BZ', 'trentino-alto-adige', 'bolzano');
const cz = simula('CZ', 'calabria', 'catanzaro');

/* eslint-disable no-console */
console.log('\n=== BOLZANO (attuale) ===');
console.log('  affitto      :', bz.c.affitto_bilocale_periferia, '€');
console.log('  netto mensile:', bz.fisc.netto_mensile.toFixed(2), '€');
console.log('  ore sopra    :', bz.brk.ore_sopravvivenza.toFixed(1), 'h');
console.log('  ore stato    :', bz.brk.ore_stato.toFixed(1), 'h');

console.log('\n=== CATANZARO (ipotetica) ===');
console.log('  affitto      :', cz.c.affitto_bilocale_periferia, '€');
console.log('  netto mensile:', cz.fisc.netto_mensile.toFixed(2), '€');
console.log('  ore sopra    :', cz.brk.ore_sopravvivenza.toFixed(1), 'h');
console.log('  ore stato    :', cz.brk.ore_stato.toFixed(1), 'h');

const fA = bz.brk.ore_sopravvivenza + bz.brk.ore_stato;
const fN = cz.brk.ore_sopravvivenza + cz.brk.ore_stato;
const diff = fA - fN;
console.log('\n=== DIFF BZ → CZ ===');
console.log('  ore forzate BZ :', fA.toFixed(1), 'h');
console.log('  ore forzate CZ :', fN.toFixed(1), 'h');
console.log('  recuperate a CZ:', diff.toFixed(1), 'h/mese →', (diff / 4.33).toFixed(1), 'h/sett');
console.log('  diff netto     :', (cz.fisc.netto_mensile - bz.fisc.netto_mensile).toFixed(2), '€');
console.log('  diff affitto   :', cz.c.affitto_bilocale_periferia - bz.c.affitto_bilocale_periferia, '€');
