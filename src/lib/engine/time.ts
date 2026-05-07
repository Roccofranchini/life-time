// src/lib/engine/time.ts
// Motore temporale: scomposizione onesta di un mese di vita.
//
// Principio editoriale: il "tempo libero" non è 730 − sonno − lavoro.
// Bisogna sottrarre anche la riproduzione sociale (mangiare, cucinare,
// igiene, spostamenti, cura della casa). Altrimenti il grafico mente.
//
// Segmenti esposti:
//   sonno · lavoro (con sub-ripartizione sopravvivenza/stato/capitale/salario residuo)
//   vita biologica (riproduzione sociale, stima ISTAT Uso del tempo)
//   libero reale (residuo)
//
// Pure function, legge aliquote.json per il margine medio di settore.

import aliquoteData from '../data/aliquote.json';
import type { AliquoteData, TimeBreakdown, TimeInput } from '../types';

const aliquote = aliquoteData as AliquoteData;

export const ORE_TOTALI_MESE = 730;
export const ORE_SONNO_MESE = 240; // 8h × 30
// Fonte: ISTAT "Uso del tempo" (ultima rilevazione disponibile).
// Media giornaliera: pasti ~2h, cura personale/igiene ~1h,
// lavoro domestico ~2h, spostamenti non lavorativi ~1h → ~6h/giorno.
// 6h × 30 = 180h/mese di riproduzione sociale.
export const ORE_VITA_BIOLOGICA_MESE = 180;
export const GIORNI_CALENDARIO_MESE = 30;

function margineSettore(settoreId: string): number {
  const table = aliquote.margine_medio_settore;
  return table[settoreId] ?? table['default'] ?? 0.08;
}

/**
 * Calcola il breakdown temporale di un mese.
 *  - ore_totali_mese: 730 (media convenzionale)
 *  - ore_sonno: 240 (8h × 30)
 *  - ore_lavoro: da contratto (es. 40h × 52 / 12 = 173)
 *  - ore_sopravvivenza: (1−cuneo−margine) × min(1, costi/netto) × ore_lavoro — gross-consistent
 *  - ore_stato: cuneo fiscale × ore_lavoro
 *  - ore_capitale: margine medio di settore × ore_lavoro (surplus estratto)
 *  - ore_vita_biologica: 180 (ISTAT Uso del tempo: pasti+igiene+casa+spostamenti)
 *  - ore_libero_reale: residuo onesto (tipicamente 100–140h/mese full-time)
 *  - ore_libere: legacy, 730 − sonno − lavoro (tenuto per retro-compat)
 *  - giorni_affitto: giorni di calendario del mese lavorati per coprire l'affitto
 */
export function calcola_breakdown_temporale(input: TimeInput): TimeBreakdown {
  const { survival, fiscal, ore_lavoro_mensili, settore_id, affitto } = input;

  const cuneo = fiscal.cuneo_fiscale_percentuale;
  const margine = margineSettore(settore_id);

  const ore_stato = Math.max(0, cuneo * ore_lavoro_mensili);
  const ore_capitale = Math.max(0, margine * ore_lavoro_mensili);

  // Fraction of gross work hours that produces net income (consistent reference frame).
  // ore_stato and ore_capitale are gross fractions; ore_sopravvivenza must be too,
  // otherwise segments can exceed ore_lavoro when costi > netto.
  const fraz_netto = Math.max(0, 1 - cuneo - margine);
  const fraz_sopravvivenza =
    fiscal.netto_mensile > 0
      ? Math.min(1, survival.costo_sopravvivenza_totale / fiscal.netto_mensile)
      : 1;
  const ore_sopravvivenza = fraz_netto * fraz_sopravvivenza * ore_lavoro_mensili;

  const ore_libere = Math.max(0, ORE_TOTALI_MESE - ORE_SONNO_MESE - ore_lavoro_mensili);

  const ore_vita_biologica = ORE_VITA_BIOLOGICA_MESE;

  const ore_libero_reale = Math.max(
    0,
    ORE_TOTALI_MESE - ORE_SONNO_MESE - ore_lavoro_mensili - ore_vita_biologica
  );

  const giorni_affitto =
    fiscal.netto_mensile > 0
      ? Math.round((affitto / fiscal.netto_mensile) * GIORNI_CALENDARIO_MESE)
      : 0;

  return {
    ore_totali_mese: ORE_TOTALI_MESE,
    ore_sonno: ORE_SONNO_MESE,
    ore_lavoro: ore_lavoro_mensili,
    ore_sopravvivenza,
    ore_stato,
    ore_capitale,
    ore_vita_biologica,
    ore_libero_reale,
    ore_libere,
    giorni_affitto
  };
}
