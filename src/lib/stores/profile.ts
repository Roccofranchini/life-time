// src/lib/stores/profile.ts
// Store Svelte writable per il profilo utente + risultati calcolo.
//
// Privacy-first:
//   - nessuna persistenza in localStorage (dati perduti al reload: è voluto)
//   - nessun dato lascia il browser se non verso /api/calcola e /api/costi
//   - il profilo contiene solo metadati geografici/contrattuali, zero PII

import { writable, type Writable } from 'svelte/store';
import type {
  ProfiloUtente,
  FiscalOutput,
  CostiVita,
  SurvivalOutput,
  TimeBreakdown
} from '$lib/types';

export const profilo: Writable<ProfiloUtente | null> = writable(null);

export const risultatoFiscale: Writable<FiscalOutput | null> = writable(null);

export const costiProvincia: Writable<CostiVita | null> = writable(null);

export const risultatoSopravvivenza: Writable<SurvivalOutput | null> = writable(null);

export const breakdownTemporale: Writable<TimeBreakdown | null> = writable(null);

/**
 * Reset completo. Usato dal CTA "ricalcola" e al leave di /report.
 */
export function resetTuttiGliStore(): void {
  profilo.set(null);
  risultatoFiscale.set(null);
  costiProvincia.set(null);
  risultatoSopravvivenza.set(null);
  breakdownTemporale.set(null);
}
