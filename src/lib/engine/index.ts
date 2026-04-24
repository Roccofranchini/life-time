// src/lib/engine/index.ts
// Barrel export del motore di calcolo.

export { calcola_netto, MARGINE_ERRORE } from './fiscal';
export { calcola_sopravvivenza } from './survival';
export {
  calcola_breakdown_temporale,
  ORE_TOTALI_MESE,
  ORE_SONNO_MESE,
  GIORNI_CALENDARIO_MESE
} from './time';
