// src/lib/engine/survival.ts
// Motore di sopravvivenza: converte i costi fissi mensili in ore di lavoro.
// Pure function.

import type { SurvivalInput, SurvivalOutput } from '../types';

/**
 * Dati i costi fissi mensili (affitto, spesa, bollette, carburante) calcola:
 *  - costo_sopravvivenza_totale (€ / mese)
 *  - ore di lavoro necessarie per coprirlo (al valore orario = netto/ore_lavoro)
 *  - percentuale del netto assorbita dai costi fissi
 *  - percentuale delle ore di lavoro dedicate alla sopravvivenza
 */
export function calcola_sopravvivenza(input: SurvivalInput): SurvivalOutput {
  const {
    affitto,
    spesa_minima,
    bollette,
    carburante_mensile_stimato,
    netto_mensile,
    ore_lavoro_mensili
  } = input;

  const costo_sopravvivenza_totale =
    affitto + spesa_minima + bollette + carburante_mensile_stimato;

  const valore_orario =
    netto_mensile > 0 && ore_lavoro_mensili > 0 ? netto_mensile / ore_lavoro_mensili : 0;

  const ore_sopravvivenza = valore_orario > 0 ? costo_sopravvivenza_totale / valore_orario : 0;

  const percentuale_netto =
    netto_mensile > 0 ? costo_sopravvivenza_totale / netto_mensile : 0;

  const percentuale_ore_lavoro =
    ore_lavoro_mensili > 0 ? ore_sopravvivenza / ore_lavoro_mensili : 0;

  return {
    costo_sopravvivenza_totale,
    ore_sopravvivenza,
    percentuale_netto,
    percentuale_ore_lavoro
  };
}
