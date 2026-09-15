// src/lib/engine/index.ts
// Barrel export e composizione: da un Ingresso a un Risultato completo.

import { calcolaFisco, MARGINE_ERRORE } from './fiscal';
import { decomponiValore } from './valore';
import { calcolaTempo, oreRetribuiteMese } from './tempo';
import { calcolaSopravvivenza } from './sopravvivenza';
import type { Ingresso, ProvinciaEntry, Risultato } from '../types';

export { calcolaFisco, MARGINE_ERRORE, irpefLorda, detrazioneLavoro, ulterioreDetrazione, sommaIntegrativa, trattamentoIntegrativo, contributiLavoratore, contributiDatore, isSettorePubblico } from './fiscal';
export { decomponiValore, quotaLavoro, INCERTEZZA_QUOTA } from './valore';
export { calcolaTempo, prezzoInOre, oreRetribuiteMese, oreLavoroFamiliare, costiDelLavoroMese, ORE_MESE, GIORNI_MESE, GIORNI_LAVORATIVI_MESE } from './tempo';
export { calcolaSopravvivenza, canoneMensile, eurMqPeriferia, sogliaIstat, tipoAlloggio } from './sopravvivenza';
export { valutaAiuti, AVVERTENZA_AIUTI } from './aiuti';

/**
 * Calcolo completo. L'ordine conta: il fisco dà il netto, il netto e le ore
 * danno il salario orario reale, il salario orario reale converte i costi in ore.
 */
export function calcola(ingresso: Ingresso, provincia: ProvinciaEntry): Risultato {
  const fisco = calcolaFisco({
    lordo_annuo: ingresso.lordo_annuo,
    tipo_contratto: ingresso.tipo_contratto,
    regione: ingresso.regione,
    settore_id: ingresso.settore_id,
    mensilita: ingresso.mensilita,
    coefficiente_redditivita: ingresso.coefficiente_redditivita,
    forfettario_startup: ingresso.forfettario_startup
  });

  const tempo = calcolaTempo({
    netto_mensile: fisco.netto_mensile,
    ore_settimanali: ingresso.ore_settimanali,
    minuti_pendolarismo: ingresso.minuti_pendolarismo,
    ore_straordinario_non_pagato: ingresso.ore_straordinario_non_pagato,
    profilo_cura: ingresso.profilo_cura,
    usa_auto: ingresso.usa_auto,
    pasti_fuori_settimana: ingresso.pasti_fuori_settimana
  });

  const valore = decomponiValore(
    fisco,
    ingresso.settore_id,
    oreRetribuiteMese(ingresso.ore_settimanali)
  );

  const sopravvivenza = calcolaSopravvivenza({
    provincia,
    alloggio: ingresso.alloggio,
    netto_mensile: fisco.netto_mensile,
    costi_del_lavoro: tempo.costi_del_lavoro_mese,
    salario_orario_reale: tempo.salario_orario_reale,
    ore_sottratte: tempo.ore_sottratte
  });

  return { fisco, valore, tempo, sopravvivenza };
}
