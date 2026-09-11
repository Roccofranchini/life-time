// src/lib/engine/aiuti.ts
// Selezione dei diritti esigibili in base ai numeri già calcolati.
//
// Non è una sezione "risorse utili": è la parte che rende l'app utile invece
// che solo giusta. Un calcolo che dimostra a una persona che è povera e la
// lascia lì ha fatto la metà meno utile del lavoro.
//
// Privacy: le uniche informazioni personali sono tre booleani (affitto, under 31,
// figli), scelti dall'utente, tenuti in memoria nel browser e mai trasmessi.
// L'ISEE non lo calcoliamo — dipende dal patrimonio, che non chiediamo — quindi
// le misure che ne dipendono sono marcate 'probabile' e mai 'certo'.

import dati from '../data/aiuti.json';
import type { AiutoValutato, SituazionePersonale, TipoContratto, VoceAiuto } from '../types';

const VOCI = dati.voci as VoceAiuto[];

export const AVVERTENZA_AIUTI = dati.avvertenza;

export function valutaAiuti(input: {
  reddito_complessivo: number;
  tipo_contratto: TipoContratto;
  situazione: SituazionePersonale;
}): AiutoValutato[] {
  const { reddito_complessivo, tipo_contratto, situazione } = input;
  const out: AiutoValutato[] = [];

  for (const v of VOCI) {
    const c = v.condizioni;

    if (c.reddito_complessivo_max !== undefined && reddito_complessivo > c.reddito_complessivo_max)
      continue;
    if (c.tipo_contratto_in && !c.tipo_contratto_in.includes(tipo_contratto)) continue;
    if (c.tipo_contratto_not_in && c.tipo_contratto_not_in.includes(tipo_contratto)) continue;
    if (c.richiede_affitto && !situazione.in_affitto) continue;
    if (c.richiede_figli && !situazione.con_figli) continue;
    if (c.richiede_carico_familiare && !situazione.con_figli) continue;
    if (c.eta_max !== undefined && c.eta_max <= 30 && !situazione.under31) continue;

    const dipendeDaIsee = c.richiede_isee === true;
    out.push({
      ...v,
      esito: dipendeDaIsee ? 'probabile' : 'certo',
      motivo: dipendeDaIsee
        ? `Dipende dall'ISEE, che non calcoliamo: serve sotto ${c.isee_max?.toLocaleString('it-IT')} €.`
        : motivoCerto(v, reddito_complessivo)
    });
  }

  // La detrazione under 31 e quella ordinaria non si cumulano: si prende la più
  // conveniente, che è sempre la prima quando spetta.
  const haUnder31 = out.some((v) => v.id === 'detrazione-affitto-giovani');
  const filtrate = haUnder31 ? out.filter((v) => v.id !== 'detrazione-affitto-abitazione') : out;

  return filtrate.sort((a, b) => a.priorita - b.priorita);
}

function motivoCerto(v: VoceAiuto, reddito: number): string {
  const max = v.condizioni.reddito_complessivo_max;
  if (max === undefined) return 'Spetta a prescindere dal reddito.';
  return `Il tuo reddito stimato (${Math.round(reddito).toLocaleString(
    'it-IT'
  )} €) è sotto la soglia di ${max.toLocaleString('it-IT')} €.`;
}
