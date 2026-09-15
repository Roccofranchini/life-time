// src/lib/engine/valore.ts
// Decomposizione del valore aggiunto prodotto in un'ora di lavoro.
//
// È il cuore teorico della 2.0. Un solo denominatore per tutto:
//
//     valore aggiunto = profitto + previdenza + imposte + netto
//
// I quattro addendi sommano al valore aggiunto PER COSTRUZIONE, non per
// aggiustamento. Nella v1 le fette avevano denominatori diversi (il cuneo era
// una quota del salario, il margine una quota del valore aggiunto) e la somma
// sforava: c'era voluta una toppa aritmetica per impedire alla torta di
// esplodere. Qui non può succedere, ed è il test `le quote sommano a 1` a dirlo.
//
// Catena: costo del lavoro → valore aggiunto → quattro destinazioni.
// Il passaggio da costo del lavoro a valore aggiunto usa la quota del lavoro
// di settore (ISTAT). È il parametro più incerto del modello, per questo il
// profitto viene restituito anche come banda min-max e mai come numero secco.

import aliquote from '../data/aliquote.json';
import { isSettorePubblico } from './fiscal';
import type { Fisco, Quota, Valore } from '../types';

const Q = aliquote.quota_lavoro_settore;

export function quotaLavoro(settoreId: string): number {
  const t = Q.valori as Record<string, number>;
  return t[settoreId] ?? t['default'];
}

export const INCERTEZZA_QUOTA = Q.incertezza;

function quota(euro: number, valoreAggiunto: number, oreLavoro: number): Quota {
  const frazione = valoreAggiunto > 0 ? euro / valoreAggiunto : 0;
  return { euro, frazione, ore: frazione * oreLavoro };
}

/**
 * Scompone il valore aggiunto mensile nelle quattro destinazioni e converte
 * ciascuna nelle ore di lavoro retribuito che le corrispondono.
 *
 * @param fisco   uscita di calcolaFisco (valori annui)
 * @param settoreId  settore per la quota del lavoro sul valore aggiunto
 * @param oreRetribuite  ore di lavoro retribuito al mese
 */
export function decomponiValore(
  fisco: Fisco,
  settoreId: string,
  oreRetribuite: number
): Valore {
  const pubblico = isSettorePubblico(settoreId);
  const q = quotaLavoro(settoreId);

  // Tutto mensile da qui in poi.
  const costoLavoro = fisco.costo_lavoro_annuo / 12;
  const previdenzaEuro =
    (fisco.contributi_lavoratore + fisco.contributi_datore + fisco.tfr) / 12;
  const imposteEuro = fisco.imposte_nette / 12;
  const nettoEuro = fisco.netto_mensile;

  // Nel settore pubblico non c'è estrazione di profitto privato: la quota è 1
  // per convenzione dichiarata, quindi il valore aggiunto coincide col costo.
  const valoreAggiunto = pubblico ? costoLavoro : costoLavoro / q;
  const profittoEuro = Math.max(0, valoreAggiunto - costoLavoro);

  const profitto = quota(profittoEuro, valoreAggiunto, oreRetribuite);
  const previdenza = quota(previdenzaEuro, valoreAggiunto, oreRetribuite);
  const imposte = quota(imposteEuro, valoreAggiunto, oreRetribuite);
  const netto = quota(nettoEuro, valoreAggiunto, oreRetribuite);

  // Banda di incertezza sul profitto: una quota del lavoro più alta significa
  // meno profitto, e viceversa. Il numero secco su un parametro così incerto
  // sarebbe una bugia con più cifre decimali (CRITICA.md §7).
  const qMin = Math.min(0.98, q + INCERTEZZA_QUOTA);
  const qMax = Math.max(0.2, q - INCERTEZZA_QUOTA);
  const vaMin = pubblico ? costoLavoro : costoLavoro / qMin;
  const vaMax = pubblico ? costoLavoro : costoLavoro / qMax;
  const minEuro = Math.max(0, vaMin - costoLavoro);
  const maxEuro = Math.max(0, vaMax - costoLavoro);

  return {
    valore_aggiunto_mensile: valoreAggiunto,
    quota_lavoro: pubblico ? 1 : q,
    incertezza_quota: pubblico ? 0 : INCERTEZZA_QUOTA,
    profitto,
    previdenza,
    imposte,
    netto,
    profitto_banda: {
      min_euro: minEuro,
      max_euro: maxEuro,
      min_ore: vaMin > 0 ? (minEuro / vaMin) * oreRetribuite : 0,
      max_ore: vaMax > 0 ? (maxEuro / vaMax) * oreRetribuite : 0
    },
    settore_pubblico: pubblico
  };
}
