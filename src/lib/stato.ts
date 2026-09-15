// src/lib/stato.ts
// Stato del calcolatore: una sola fonte di verità, condivisa da server e client.
// Il server la usa per fare SSR del link condiviso, il client per il calcolo dal
// vivo. Stessa funzione, stesso risultato: niente divergenze fra prima e dopo
// l'idratazione.
//
// Privacy: nella URL finiscono solo SCELTE (dove vivi, che contratto hai, quanto
// pendoli). Mai un numero calcolato, mai nulla che identifichi una persona. Le
// tre opzioni della sezione aiuti (affitto, under 31, figli) non entrano nella
// URL nemmeno come scelte: restano nel browser.

import ccnlData from './data/ccnl.json';
import provinceData from './data/province.json';
import type {
  AlloggioId,
  CcnlSettore,
  Ingresso,
  ProfiloCura,
  ProvinciaEntry,
  TipoContratto
} from './types';

export const PROVINCE = provinceData.province as ProvinciaEntry[];
export const SETTORI = ccnlData.settori as unknown as CcnlSettore[];
export const META_CCNL = { aggiornato: ccnlData.aggiornato, avvertenza: ccnlData.avvertenza };

export type ModoReddito = 'ccnl' | 'mio';

export interface Stato {
  provincia: string;
  modo: ModoReddito;
  settore_id: string;
  livello: string;
  /** solo modo 'mio': lordo mensile dichiarato dall'utente */
  lordo_mensile: number;
  mensilita: number;
  tipo_contratto: TipoContratto;
  ore_settimanali: number;
  alloggio: AlloggioId;
  minuti_pendolarismo: number;
  ore_straordinario: number;
  profilo_cura: ProfiloCura;
  usa_auto: boolean;
  pasti_fuori: number;
}

export const STATO_INIZIALE: Stato = {
  provincia: 'BO',
  modo: 'ccnl',
  settore_id: 'commercio',
  livello: '4',
  lordo_mensile: 1800,
  mensilita: 14,
  tipo_contratto: 'dipendente',
  ore_settimanali: 40,
  alloggio: 'bilocale',
  minuti_pendolarismo: 60,
  ore_straordinario: 0,
  profilo_cura: 'media',
  usa_auto: false,
  pasti_fuori: 5
};

const CONTRATTI: readonly TipoContratto[] = [
  'dipendente',
  'parttime',
  'partiva',
  'forfettario',
  'dottorato',
  'nero'
];
const ALLOGGI: readonly AlloggioId[] = ['stanza', 'monolocale', 'bilocale', 'coppia'];
const CURE: readonly ProfiloCura[] = ['uomo_occupato', 'donna_occupata', 'media'];

export function trovaProvincia(codice: string): ProvinciaEntry | undefined {
  return PROVINCE.find((p) => p.codice === codice.toUpperCase());
}

export function trovaSettore(id: string): CcnlSettore | undefined {
  return SETTORI.find((s) => s.id === id);
}

/** Lordo mensile di un livello CCNL: minimo tabellare + contingenza + EDR. */
export function lordoMensileCcnl(settoreId: string, livello: string): number {
  const s = trovaSettore(settoreId);
  const l = s?.livelli.find((x) => x.livello === livello);
  if (!s || !l) return 0;
  return l.minimo_tabellare + l.contingenza + l.edr;
}

/** Da stato dell'interfaccia a ingresso del motore. Un solo posto in cui si
 *  decide come si passa da «commercio, IV livello, part-time 60%» a una RAL. */
export function risolviIngresso(stato: Stato): { ingresso: Ingresso; provincia: ProvinciaEntry } | null {
  const provincia = trovaProvincia(stato.provincia);
  if (!provincia) return null;

  const settore = trovaSettore(stato.settore_id);
  const mensilita =
    stato.modo === 'ccnl' ? (settore?.mensilita ?? 13) : clamp(stato.mensilita, 12, 14);

  const lordoMensile =
    stato.modo === 'ccnl'
      ? lordoMensileCcnl(stato.settore_id, stato.livello)
      : Math.max(0, stato.lordo_mensile);

  if (lordoMensile <= 0) return null;

  // Il part-time scala la RAL in proporzione alle ore: è la stessa convenzione
  // della busta paga, dove il minimo tabellare è riproporzionato sull'orario.
  const oreContratto = clamp(stato.ore_settimanali, 1, 80);
  const fattore =
    stato.tipo_contratto === 'parttime' ? Math.min(1, oreContratto / 40) : 1;

  const lordo_annuo = Math.round(lordoMensile * mensilita * fattore);

  return {
    provincia,
    ingresso: {
      lordo_annuo,
      mensilita,
      tipo_contratto: stato.tipo_contratto,
      regione: provincia.regione,
      settore_id: stato.settore_id,
      provincia: provincia.codice,
      ore_settimanali: oreContratto,
      minuti_pendolarismo: clamp(stato.minuti_pendolarismo, 0, 240),
      ore_straordinario_non_pagato: clamp(stato.ore_straordinario, 0, 40),
      profilo_cura: stato.profilo_cura,
      alloggio: stato.alloggio,
      usa_auto: stato.usa_auto,
      pasti_fuori_settimana: clamp(stato.pasti_fuori, 0, 14)
    }
  };
}

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

// ─── URL ───────────────────────────────────────────────────────────────────

const CURA_CORTA: Record<ProfiloCura, string> = {
  uomo_occupato: 'u',
  donna_occupata: 'd',
  media: 'm'
};

/** Costruisce la query di condivisione. Solo scelte, mai risultati. */
export function statoInQuery(stato: Stato): string {
  const q = new URLSearchParams();
  q.set('p', stato.provincia);
  if (stato.modo === 'ccnl') {
    q.set('s', `${stato.settore_id}-${stato.livello}`);
  } else {
    q.set('l', String(Math.round(stato.lordo_mensile)));
    q.set('m', String(stato.mensilita));
  }
  q.set('c', stato.tipo_contratto);
  q.set('a', stato.alloggio);
  q.set('h', String(stato.ore_settimanali));
  q.set('pe', String(stato.minuti_pendolarismo));
  if (stato.ore_straordinario > 0) q.set('st', String(stato.ore_straordinario));
  q.set('cu', CURA_CORTA[stato.profilo_cura]);
  if (stato.usa_auto) q.set('au', '1');
  if (stato.pasti_fuori !== STATO_INIZIALE.pasti_fuori) q.set('pf', String(stato.pasti_fuori));
  return q.toString();
}

/** Legge la query e produce uno stato valido. Qualsiasi valore fuori posto
 *  ricade sul default: un link manomesso non può rompere la pagina. */
export function queryInStato(q: URLSearchParams): Stato {
  const s = { ...STATO_INIZIALE };

  const p = q.get('p');
  if (p && trovaProvincia(p)) s.provincia = p.toUpperCase();

  const sl = q.get('s');
  const match = sl ? /^([a-z-]+)-([A-Za-z0-9]+)$/.exec(sl) : null;
  if (match && trovaSettore(match[1])?.livelli.some((l) => l.livello === match[2])) {
    s.modo = 'ccnl';
    s.settore_id = match[1];
    s.livello = match[2];
  }

  const l = intero(q.get('l'));
  if (l !== null && l > 0 && l < 100000) {
    s.modo = 'mio';
    s.lordo_mensile = l;
    const m = intero(q.get('m'));
    s.mensilita = m === 12 || m === 13 || m === 14 ? m : 13;
  }

  const c = q.get('c') as TipoContratto | null;
  if (c && CONTRATTI.includes(c)) s.tipo_contratto = c;

  const a = q.get('a') as AlloggioId | null;
  if (a && ALLOGGI.includes(a)) s.alloggio = a;

  const h = intero(q.get('h'));
  if (h !== null && h >= 1 && h <= 80) s.ore_settimanali = h;

  const pe = intero(q.get('pe'));
  if (pe !== null && pe >= 0 && pe <= 240) s.minuti_pendolarismo = pe;

  const st = intero(q.get('st'));
  if (st !== null && st >= 0 && st <= 40) s.ore_straordinario = st;

  const cu = q.get('cu');
  const curaLunga = CURE.find((k) => CURA_CORTA[k] === cu);
  if (curaLunga) s.profilo_cura = curaLunga;

  s.usa_auto = q.get('au') === '1';

  const pf = intero(q.get('pf'));
  if (pf !== null && pf >= 0 && pf <= 14) s.pasti_fuori = pf;

  // Coerenza: il dottorato ha sempre 12 mensilità e nessun livello CCNL diverso.
  if (s.tipo_contratto === 'dottorato' && s.modo === 'ccnl') s.settore_id = 'dottorato';
  if (s.settore_id === 'dottorato') s.tipo_contratto = 'dottorato';

  return s;
}

function intero(v: string | null): number | null {
  if (v === null) return null;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}
