// src/lib/engine/tempo.ts
// Contabilità del tempo e salario orario reale. Pure function.
//
// Due distinzioni che la v1 non faceva (CRITICA.md §5):
//
//   ore retribuite  →  quelle del contratto, base del calcolo fiscale
//   ore sottratte   →  retribuite + pendolarismo + straordinario non pagato
//
// e di conseguenza due salari orari:
//
//   nominale = netto / ore retribuite
//   reale    = (netto − costi imposti dal lavoro) / ore sottratte
//
// Il secondo è il real hourly wage di Dominguez e Robin: la domanda "quanto
// costa questa cosa in ore della mia vita" ha senso solo con quel divisore.
// Con il nominale si sottostima il prezzo in tempo di ogni acquisto del 20-30%.

import T from '../data/tempo.json';
import type { ProfiloCura, Tempo } from '../types';

export const ORE_MESE = T.mese.ore_totali;
export const GIORNI_MESE = T.mese.giorni;
export const GIORNI_LAVORATIVI_MESE = T.mese.giorni_lavorativi;
const SETTIMANE_MESE = 52 / 12;

export function oreRetribuiteMese(oreSettimanali: number): number {
  return oreSettimanali * SETTIMANE_MESE;
}

export function oreLavoroFamiliare(profilo: ProfiloCura): number {
  const p = T.lavoro_familiare.profili[profilo] ?? T.lavoro_familiare.profili.media;
  return p.ore_giorno * GIORNI_MESE;
}

/**
 * Spese che esistono solo perché lavori: tragitto e pasti fuori.
 * Si sottraggono dal netto prima di calcolare il salario orario reale —
 * non sono consumo, sono un costo di produzione scaricato su chi lavora.
 */
export function costiDelLavoroMese(input: {
  usa_auto: boolean;
  minuti_pendolarismo: number;
  pasti_fuori_settimana: number;
  giorni_lavorativi: number;
}): number {
  const c = T.costi_del_lavoro;
  const { usa_auto, minuti_pendolarismo, pasti_fuori_settimana, giorni_lavorativi } = input;

  let tragitto = 0;
  if (minuti_pendolarismo > 0) {
    tragitto = usa_auto
      ? c.km_medi_tratta * 2 * giorni_lavorativi * c.costo_km_auto
      : c.abbonamento_tpl_mese;
  }
  const pasti = pasti_fuori_settimana * SETTIMANE_MESE * c.pasto_fuori;
  return tragitto + pasti;
}

export function calcolaTempo(input: {
  netto_mensile: number;
  ore_settimanali: number;
  minuti_pendolarismo: number;
  ore_straordinario_non_pagato: number;
  profilo_cura: ProfiloCura;
  usa_auto: boolean;
  pasti_fuori_settimana: number;
}): Tempo {
  const ore_retribuite = oreRetribuiteMese(input.ore_settimanali);

  // I giorni lavorativi scalano col part-time: chi lavora 20 ore su 5 giorni
  // pendola comunque 5 giorni, chi lavora 20 ore su 3 giorni no. In assenza
  // del dato usiamo la proporzione sulle ore, che è la stima conservativa.
  const giorni_lavorativi = Math.min(
    GIORNI_LAVORATIVI_MESE,
    GIORNI_LAVORATIVI_MESE * (input.ore_settimanali / 40)
  );

  const ore_pendolarismo = (input.minuti_pendolarismo / 60) * giorni_lavorativi;
  const ore_straordinario = input.ore_straordinario_non_pagato * SETTIMANE_MESE;
  const ore_sottratte = ore_retribuite + ore_pendolarismo + ore_straordinario;

  const ore_sonno = T.sonno.ore_giorno * GIORNI_MESE;
  const ore_cura_personale = T.cura_personale.ore_giorno * GIORNI_MESE;
  const ore_lavoro_familiare = oreLavoroFamiliare(input.profilo_cura);

  const ore_libere = Math.max(
    0,
    ORE_MESE - ore_sonno - ore_cura_personale - ore_lavoro_familiare - ore_sottratte
  );

  const costi_del_lavoro_mese = costiDelLavoroMese({
    usa_auto: input.usa_auto,
    minuti_pendolarismo: input.minuti_pendolarismo,
    pasti_fuori_settimana: input.pasti_fuori_settimana,
    giorni_lavorativi
  });

  const salario_orario_nominale =
    ore_retribuite > 0 ? input.netto_mensile / ore_retribuite : 0;
  const salario_orario_reale =
    ore_sottratte > 0
      ? Math.max(0, input.netto_mensile - costi_del_lavoro_mese) / ore_sottratte
      : 0;

  const scarto_orario =
    salario_orario_nominale > 0
      ? 1 - salario_orario_reale / salario_orario_nominale
      : 0;

  return {
    ore_totali_mese: ORE_MESE,
    ore_retribuite,
    ore_pendolarismo,
    ore_straordinario,
    ore_sottratte,
    ore_sonno,
    ore_cura_personale,
    ore_lavoro_familiare,
    ore_libere,
    salario_orario_nominale,
    salario_orario_reale,
    scarto_orario,
    costi_del_lavoro_mese
  };
}

/** Quante ore della tua vita costa un prezzo, al salario orario reale. */
export function prezzoInOre(prezzo: number, salarioOrarioReale: number): number {
  if (salarioOrarioReale <= 0) return 0;
  return prezzo / salarioOrarioReale;
}
