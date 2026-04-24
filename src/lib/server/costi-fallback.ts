// src/lib/server/costi-fallback.ts
// Dati statici di fallback per i costi della vita — usati quando:
//   (a) Supabase non è configurato (dev senza credenziali)
//   (b) la cache è vuota o scaduta e il fetch dalle fonti pubbliche fallisce
//
// Le fonti reali (OMI, ISTAT, Mimit) saranno popolate dalla pipeline Python
// in Fase 6. Questi valori sono stime conservative aggiornate al 2024/2025.
//
// Base metodologica per queste stime:
//   - AFFITTO bilocale periferia €/mese: OMI Banca Dati Quotazioni (B2,
//     "economico"), aggregati capoluogo + triangolazione con Immobiliare.it
//     Mercato Locazioni H2 2024. Ordine di grandezza, NON canone certificato.
//   - SPESA alimentare minima adulto singolo €/mese: ISTAT paniere per la
//     misura dell'inflazione, voce "prodotti alimentari e bevande analcoliche"
//     + differenziale territoriale (Nord vs Mezzogiorno ≈ +12% medio).
//   - BOLLETTE (luce+gas+acqua) €/mese: ARERA Relazione Annuale 2024 per
//     tariffe regolate + stima climatica (Nord gas ↑, Sud acqua ↓).
//   - CARBURANTE benzina €/L: Mimit Osservaprezzi media mobile 2024
//     (Sud/Isole tendenzialmente −0,03/−0,05 rispetto al Nord).
//
// Gerarchia di lookup:
//   1. override per provincia specifica (tutti i 107 capoluoghi)
//   2. media regionale stimata (catch-all per codici-provincia sconosciuti)
//   3. default nazionale
//
// NON sono utilizzati come ground-truth — marcati con fonte = "fallback_statico".

import type { CostiVita } from '$lib/types';
import provinceData from '$lib/data/province.json';

type CostiFallback = Omit<CostiVita, 'provincia' | 'aggiornato'>;

interface ProvinciaEntry {
  codice: string;
  nome: string;
  regione: string;
  capoluogo: boolean;
}

const PROVINCE_INDEX = new Map<string, ProvinciaEntry>(
  (provinceData as { province: ProvinciaEntry[] }).province.map((p) => [
    p.codice.toUpperCase(),
    p
  ])
);

// Override per capoluogo — valori in €/mese (affitto, spesa, bollette)
// e €/litro (carburante). Ordinati alfabeticamente per sigla.
// Copre tutti i 107 capoluoghi italiani.
const FALLBACK_PER_PROVINCIA: Record<string, CostiFallback> = {
  // ── A ─────────────────────────────────────────────────────────
  AG: { affitto_bilocale_periferia: 300, spesa_alimentare_minima: 265, carburante_benzina_litro: 1.82, bollette_stimate: 155 },
  AL: { affitto_bilocale_periferia: 420, spesa_alimentare_minima: 290, carburante_benzina_litro: 1.84, bollette_stimate: 170 },
  AN: { affitto_bilocale_periferia: 500, spesa_alimentare_minima: 285, carburante_benzina_litro: 1.84, bollette_stimate: 170 },
  AO: { affitto_bilocale_periferia: 520, spesa_alimentare_minima: 310, carburante_benzina_litro: 1.88, bollette_stimate: 195 },
  AR: { affitto_bilocale_periferia: 470, spesa_alimentare_minima: 295, carburante_benzina_litro: 1.85, bollette_stimate: 175 },
  AP: { affitto_bilocale_periferia: 380, spesa_alimentare_minima: 280, carburante_benzina_litro: 1.84, bollette_stimate: 165 },
  AT: { affitto_bilocale_periferia: 400, spesa_alimentare_minima: 290, carburante_benzina_litro: 1.84, bollette_stimate: 170 },
  AV: { affitto_bilocale_periferia: 380, spesa_alimentare_minima: 275, carburante_benzina_litro: 1.84, bollette_stimate: 165 },
  AQ: { affitto_bilocale_periferia: 380, spesa_alimentare_minima: 275, carburante_benzina_litro: 1.83, bollette_stimate: 165 },

  // ── B ─────────────────────────────────────────────────────────
  BA: { affitto_bilocale_periferia: 450, spesa_alimentare_minima: 280, carburante_benzina_litro: 1.84, bollette_stimate: 165 },
  BT: { affitto_bilocale_periferia: 380, spesa_alimentare_minima: 275, carburante_benzina_litro: 1.83, bollette_stimate: 160 },
  BL: { affitto_bilocale_periferia: 430, spesa_alimentare_minima: 300, carburante_benzina_litro: 1.86, bollette_stimate: 180 },
  BN: { affitto_bilocale_periferia: 330, spesa_alimentare_minima: 270, carburante_benzina_litro: 1.84, bollette_stimate: 160 },
  BG: { affitto_bilocale_periferia: 650, spesa_alimentare_minima: 305, carburante_benzina_litro: 1.86, bollette_stimate: 180 },
  BI: { affitto_bilocale_periferia: 380, spesa_alimentare_minima: 290, carburante_benzina_litro: 1.84, bollette_stimate: 170 },
  BO: { affitto_bilocale_periferia: 750, spesa_alimentare_minima: 315, carburante_benzina_litro: 1.86, bollette_stimate: 180 },
  BZ: { affitto_bilocale_periferia: 880, spesa_alimentare_minima: 325, carburante_benzina_litro: 1.89, bollette_stimate: 195 }, // tra le più care d'Italia
  BS: { affitto_bilocale_periferia: 600, spesa_alimentare_minima: 305, carburante_benzina_litro: 1.86, bollette_stimate: 180 },
  BR: { affitto_bilocale_periferia: 340, spesa_alimentare_minima: 270, carburante_benzina_litro: 1.83, bollette_stimate: 160 },

  // ── C ─────────────────────────────────────────────────────────
  CA: { affitto_bilocale_periferia: 480, spesa_alimentare_minima: 280, carburante_benzina_litro: 1.86, bollette_stimate: 165 },
  CL: { affitto_bilocale_periferia: 280, spesa_alimentare_minima: 265, carburante_benzina_litro: 1.82, bollette_stimate: 155 },
  CB: { affitto_bilocale_periferia: 330, spesa_alimentare_minima: 265, carburante_benzina_litro: 1.82, bollette_stimate: 155 },
  CE: { affitto_bilocale_periferia: 450, spesa_alimentare_minima: 280, carburante_benzina_litro: 1.84, bollette_stimate: 165 },
  CT: { affitto_bilocale_periferia: 420, spesa_alimentare_minima: 275, carburante_benzina_litro: 1.83, bollette_stimate: 160 },
  CZ: { affitto_bilocale_periferia: 320, spesa_alimentare_minima: 265, carburante_benzina_litro: 1.82, bollette_stimate: 155 },
  CH: { affitto_bilocale_periferia: 360, spesa_alimentare_minima: 275, carburante_benzina_litro: 1.83, bollette_stimate: 160 },
  CO: { affitto_bilocale_periferia: 700, spesa_alimentare_minima: 310, carburante_benzina_litro: 1.87, bollette_stimate: 185 },
  CS: { affitto_bilocale_periferia: 330, spesa_alimentare_minima: 265, carburante_benzina_litro: 1.82, bollette_stimate: 155 },
  CR: { affitto_bilocale_periferia: 480, spesa_alimentare_minima: 300, carburante_benzina_litro: 1.85, bollette_stimate: 175 },
  KR: { affitto_bilocale_periferia: 280, spesa_alimentare_minima: 260, carburante_benzina_litro: 1.82, bollette_stimate: 150 },
  CN: { affitto_bilocale_periferia: 420, spesa_alimentare_minima: 295, carburante_benzina_litro: 1.85, bollette_stimate: 175 },

  // ── E-F ───────────────────────────────────────────────────────
  EN: { affitto_bilocale_periferia: 260, spesa_alimentare_minima: 260, carburante_benzina_litro: 1.82, bollette_stimate: 150 },
  FM: { affitto_bilocale_periferia: 390, spesa_alimentare_minima: 280, carburante_benzina_litro: 1.84, bollette_stimate: 165 },
  FE: { affitto_bilocale_periferia: 450, spesa_alimentare_minima: 300, carburante_benzina_litro: 1.85, bollette_stimate: 175 },
  FI: { affitto_bilocale_periferia: 820, spesa_alimentare_minima: 310, carburante_benzina_litro: 1.86, bollette_stimate: 180 },
  FG: { affitto_bilocale_periferia: 320, spesa_alimentare_minima: 265, carburante_benzina_litro: 1.83, bollette_stimate: 155 },
  FC: { affitto_bilocale_periferia: 480, spesa_alimentare_minima: 300, carburante_benzina_litro: 1.85, bollette_stimate: 175 },
  FR: { affitto_bilocale_periferia: 400, spesa_alimentare_minima: 285, carburante_benzina_litro: 1.85, bollette_stimate: 170 },

  // ── G-I ───────────────────────────────────────────────────────
  GE: { affitto_bilocale_periferia: 540, spesa_alimentare_minima: 300, carburante_benzina_litro: 1.86, bollette_stimate: 175 },
  GO: { affitto_bilocale_periferia: 400, spesa_alimentare_minima: 285, carburante_benzina_litro: 1.85, bollette_stimate: 170 },
  GR: { affitto_bilocale_periferia: 450, spesa_alimentare_minima: 290, carburante_benzina_litro: 1.85, bollette_stimate: 170 },
  IM: { affitto_bilocale_periferia: 480, spesa_alimentare_minima: 300, carburante_benzina_litro: 1.86, bollette_stimate: 175 },
  IS: { affitto_bilocale_periferia: 300, spesa_alimentare_minima: 260, carburante_benzina_litro: 1.82, bollette_stimate: 150 },

  // ── L ─────────────────────────────────────────────────────────
  SP: { affitto_bilocale_periferia: 490, spesa_alimentare_minima: 295, carburante_benzina_litro: 1.86, bollette_stimate: 175 },
  LT: { affitto_bilocale_periferia: 480, spesa_alimentare_minima: 290, carburante_benzina_litro: 1.85, bollette_stimate: 170 },
  LE: { affitto_bilocale_periferia: 400, spesa_alimentare_minima: 270, carburante_benzina_litro: 1.83, bollette_stimate: 160 },
  LC: { affitto_bilocale_periferia: 680, spesa_alimentare_minima: 310, carburante_benzina_litro: 1.87, bollette_stimate: 185 },
  LI: { affitto_bilocale_periferia: 500, spesa_alimentare_minima: 295, carburante_benzina_litro: 1.85, bollette_stimate: 175 },
  LO: { affitto_bilocale_periferia: 500, spesa_alimentare_minima: 300, carburante_benzina_litro: 1.85, bollette_stimate: 175 },
  LU: { affitto_bilocale_periferia: 580, spesa_alimentare_minima: 300, carburante_benzina_litro: 1.86, bollette_stimate: 175 },

  // ── M ─────────────────────────────────────────────────────────
  MC: { affitto_bilocale_periferia: 400, spesa_alimentare_minima: 280, carburante_benzina_litro: 1.84, bollette_stimate: 165 },
  MN: { affitto_bilocale_periferia: 450, spesa_alimentare_minima: 300, carburante_benzina_litro: 1.85, bollette_stimate: 175 },
  MS: { affitto_bilocale_periferia: 430, spesa_alimentare_minima: 290, carburante_benzina_litro: 1.85, bollette_stimate: 170 },
  MT: { affitto_bilocale_periferia: 320, spesa_alimentare_minima: 265, carburante_benzina_litro: 1.82, bollette_stimate: 155 },
  ME: { affitto_bilocale_periferia: 380, spesa_alimentare_minima: 270, carburante_benzina_litro: 1.83, bollette_stimate: 160 },
  MI: { affitto_bilocale_periferia: 950, spesa_alimentare_minima: 320, carburante_benzina_litro: 1.88, bollette_stimate: 190 },
  MO: { affitto_bilocale_periferia: 570, spesa_alimentare_minima: 305, carburante_benzina_litro: 1.85, bollette_stimate: 180 },
  MB: { affitto_bilocale_periferia: 720, spesa_alimentare_minima: 315, carburante_benzina_litro: 1.87, bollette_stimate: 185 },

  // ── N-O ───────────────────────────────────────────────────────
  NA: { affitto_bilocale_periferia: 500, spesa_alimentare_minima: 285, carburante_benzina_litro: 1.85, bollette_stimate: 170 },
  NO: { affitto_bilocale_periferia: 440, spesa_alimentare_minima: 295, carburante_benzina_litro: 1.85, bollette_stimate: 175 },
  NU: { affitto_bilocale_periferia: 350, spesa_alimentare_minima: 270, carburante_benzina_litro: 1.85, bollette_stimate: 160 },
  OR: { affitto_bilocale_periferia: 320, spesa_alimentare_minima: 270, carburante_benzina_litro: 1.85, bollette_stimate: 160 },

  // ── P ─────────────────────────────────────────────────────────
  PD: { affitto_bilocale_periferia: 650, spesa_alimentare_minima: 305, carburante_benzina_litro: 1.86, bollette_stimate: 180 },
  PA: { affitto_bilocale_periferia: 430, spesa_alimentare_minima: 275, carburante_benzina_litro: 1.83, bollette_stimate: 165 },
  PR: { affitto_bilocale_periferia: 570, spesa_alimentare_minima: 305, carburante_benzina_litro: 1.85, bollette_stimate: 180 },
  PV: { affitto_bilocale_periferia: 520, spesa_alimentare_minima: 300, carburante_benzina_litro: 1.86, bollette_stimate: 180 },
  PG: { affitto_bilocale_periferia: 460, spesa_alimentare_minima: 285, carburante_benzina_litro: 1.84, bollette_stimate: 170 },
  PU: { affitto_bilocale_periferia: 440, spesa_alimentare_minima: 285, carburante_benzina_litro: 1.84, bollette_stimate: 170 },
  PE: { affitto_bilocale_periferia: 450, spesa_alimentare_minima: 280, carburante_benzina_litro: 1.84, bollette_stimate: 165 },
  PC: { affitto_bilocale_periferia: 500, spesa_alimentare_minima: 300, carburante_benzina_litro: 1.85, bollette_stimate: 175 },
  PI: { affitto_bilocale_periferia: 570, spesa_alimentare_minima: 300, carburante_benzina_litro: 1.85, bollette_stimate: 175 },
  PT: { affitto_bilocale_periferia: 520, spesa_alimentare_minima: 295, carburante_benzina_litro: 1.85, bollette_stimate: 175 },
  PN: { affitto_bilocale_periferia: 440, spesa_alimentare_minima: 290, carburante_benzina_litro: 1.85, bollette_stimate: 170 },
  PZ: { affitto_bilocale_periferia: 330, spesa_alimentare_minima: 265, carburante_benzina_litro: 1.82, bollette_stimate: 155 },
  PO: { affitto_bilocale_periferia: 540, spesa_alimentare_minima: 300, carburante_benzina_litro: 1.85, bollette_stimate: 175 },

  // ── R ─────────────────────────────────────────────────────────
  RG: { affitto_bilocale_periferia: 320, spesa_alimentare_minima: 270, carburante_benzina_litro: 1.82, bollette_stimate: 155 },
  RA: { affitto_bilocale_periferia: 540, spesa_alimentare_minima: 300, carburante_benzina_litro: 1.85, bollette_stimate: 175 },
  RC: { affitto_bilocale_periferia: 340, spesa_alimentare_minima: 265, carburante_benzina_litro: 1.82, bollette_stimate: 155 },
  RE: { affitto_bilocale_periferia: 550, spesa_alimentare_minima: 305, carburante_benzina_litro: 1.85, bollette_stimate: 180 },
  RI: { affitto_bilocale_periferia: 380, spesa_alimentare_minima: 280, carburante_benzina_litro: 1.84, bollette_stimate: 165 },
  RN: { affitto_bilocale_periferia: 560, spesa_alimentare_minima: 300, carburante_benzina_litro: 1.85, bollette_stimate: 175 },
  RM: { affitto_bilocale_periferia: 850, spesa_alimentare_minima: 310, carburante_benzina_litro: 1.87, bollette_stimate: 185 },
  RO: { affitto_bilocale_periferia: 380, spesa_alimentare_minima: 290, carburante_benzina_litro: 1.85, bollette_stimate: 170 },

  // ── S ─────────────────────────────────────────────────────────
  SA: { affitto_bilocale_periferia: 420, spesa_alimentare_minima: 280, carburante_benzina_litro: 1.84, bollette_stimate: 165 },
  SS: { affitto_bilocale_periferia: 400, spesa_alimentare_minima: 275, carburante_benzina_litro: 1.85, bollette_stimate: 165 },
  SV: { affitto_bilocale_periferia: 540, spesa_alimentare_minima: 295, carburante_benzina_litro: 1.86, bollette_stimate: 175 },
  SI: { affitto_bilocale_periferia: 560, spesa_alimentare_minima: 300, carburante_benzina_litro: 1.85, bollette_stimate: 175 },
  SR: { affitto_bilocale_periferia: 340, spesa_alimentare_minima: 270, carburante_benzina_litro: 1.83, bollette_stimate: 160 },
  SO: { affitto_bilocale_periferia: 430, spesa_alimentare_minima: 305, carburante_benzina_litro: 1.87, bollette_stimate: 185 },
  SU: { affitto_bilocale_periferia: 320, spesa_alimentare_minima: 270, carburante_benzina_litro: 1.85, bollette_stimate: 160 },

  // ── T ─────────────────────────────────────────────────────────
  TA: { affitto_bilocale_periferia: 330, spesa_alimentare_minima: 270, carburante_benzina_litro: 1.83, bollette_stimate: 160 },
  TE: { affitto_bilocale_periferia: 380, spesa_alimentare_minima: 275, carburante_benzina_litro: 1.83, bollette_stimate: 165 },
  TR: { affitto_bilocale_periferia: 380, spesa_alimentare_minima: 280, carburante_benzina_litro: 1.84, bollette_stimate: 165 },
  TO: { affitto_bilocale_periferia: 560, spesa_alimentare_minima: 305, carburante_benzina_litro: 1.85, bollette_stimate: 180 },
  TP: { affitto_bilocale_periferia: 310, spesa_alimentare_minima: 270, carburante_benzina_litro: 1.82, bollette_stimate: 155 },
  TN: { affitto_bilocale_periferia: 720, spesa_alimentare_minima: 315, carburante_benzina_litro: 1.87, bollette_stimate: 185 },
  TV: { affitto_bilocale_periferia: 530, spesa_alimentare_minima: 300, carburante_benzina_litro: 1.86, bollette_stimate: 180 },
  TS: { affitto_bilocale_periferia: 520, spesa_alimentare_minima: 295, carburante_benzina_litro: 1.85, bollette_stimate: 175 },

  // ── U-Z ───────────────────────────────────────────────────────
  UD: { affitto_bilocale_periferia: 450, spesa_alimentare_minima: 290, carburante_benzina_litro: 1.85, bollette_stimate: 175 },
  VA: { affitto_bilocale_periferia: 530, spesa_alimentare_minima: 305, carburante_benzina_litro: 1.86, bollette_stimate: 180 },
  VE: { affitto_bilocale_periferia: 780, spesa_alimentare_minima: 310, carburante_benzina_litro: 1.87, bollette_stimate: 180 },
  VB: { affitto_bilocale_periferia: 370, spesa_alimentare_minima: 290, carburante_benzina_litro: 1.85, bollette_stimate: 175 },
  VC: { affitto_bilocale_periferia: 380, spesa_alimentare_minima: 290, carburante_benzina_litro: 1.84, bollette_stimate: 170 },
  VR: { affitto_bilocale_periferia: 650, spesa_alimentare_minima: 305, carburante_benzina_litro: 1.86, bollette_stimate: 180 },
  VV: { affitto_bilocale_periferia: 300, spesa_alimentare_minima: 260, carburante_benzina_litro: 1.82, bollette_stimate: 150 },
  VI: { affitto_bilocale_periferia: 580, spesa_alimentare_minima: 305, carburante_benzina_litro: 1.86, bollette_stimate: 180 },
  VT: { affitto_bilocale_periferia: 420, spesa_alimentare_minima: 285, carburante_benzina_litro: 1.85, bollette_stimate: 170 }
};

// Medie regionali — fallback di secondo livello quando la sigla non è nella
// tabella dei capoluoghi (improbabile ma difensivo: codici arbitrari o
// province future).
const FALLBACK_PER_REGIONE: Record<string, CostiFallback> = {
  'trentino-alto-adige':    { affitto_bilocale_periferia: 780, spesa_alimentare_minima: 320, carburante_benzina_litro: 1.88, bollette_stimate: 190 },
  'valle-d-aosta':          { affitto_bilocale_periferia: 520, spesa_alimentare_minima: 310, carburante_benzina_litro: 1.88, bollette_stimate: 195 },
  'lombardia':              { affitto_bilocale_periferia: 600, spesa_alimentare_minima: 305, carburante_benzina_litro: 1.86, bollette_stimate: 180 },
  'veneto':                 { affitto_bilocale_periferia: 540, spesa_alimentare_minima: 300, carburante_benzina_litro: 1.86, bollette_stimate: 178 },
  'friuli-venezia-giulia':  { affitto_bilocale_periferia: 450, spesa_alimentare_minima: 290, carburante_benzina_litro: 1.85, bollette_stimate: 172 },
  'piemonte':               { affitto_bilocale_periferia: 430, spesa_alimentare_minima: 292, carburante_benzina_litro: 1.84, bollette_stimate: 172 },
  'liguria':                { affitto_bilocale_periferia: 510, spesa_alimentare_minima: 297, carburante_benzina_litro: 1.86, bollette_stimate: 175 },
  'emilia-romagna':         { affitto_bilocale_periferia: 555, spesa_alimentare_minima: 302, carburante_benzina_litro: 1.85, bollette_stimate: 177 },
  'toscana':                { affitto_bilocale_periferia: 545, spesa_alimentare_minima: 297, carburante_benzina_litro: 1.85, bollette_stimate: 175 },
  'marche':                 { affitto_bilocale_periferia: 425, spesa_alimentare_minima: 282, carburante_benzina_litro: 1.84, bollette_stimate: 167 },
  'umbria':                 { affitto_bilocale_periferia: 410, spesa_alimentare_minima: 282, carburante_benzina_litro: 1.84, bollette_stimate: 167 },
  'lazio':                  { affitto_bilocale_periferia: 560, spesa_alimentare_minima: 292, carburante_benzina_litro: 1.86, bollette_stimate: 174 },
  'abruzzo':                { affitto_bilocale_periferia: 375, spesa_alimentare_minima: 276, carburante_benzina_litro: 1.83, bollette_stimate: 162 },
  'molise':                 { affitto_bilocale_periferia: 315, spesa_alimentare_minima: 262, carburante_benzina_litro: 1.82, bollette_stimate: 152 },
  'campania':               { affitto_bilocale_periferia: 415, spesa_alimentare_minima: 278, carburante_benzina_litro: 1.84, bollette_stimate: 165 },
  'puglia':                 { affitto_bilocale_periferia: 370, spesa_alimentare_minima: 270, carburante_benzina_litro: 1.83, bollette_stimate: 160 },
  'basilicata':             { affitto_bilocale_periferia: 325, spesa_alimentare_minima: 265, carburante_benzina_litro: 1.82, bollette_stimate: 155 },
  'calabria':               { affitto_bilocale_periferia: 315, spesa_alimentare_minima: 262, carburante_benzina_litro: 1.82, bollette_stimate: 153 },
  'sicilia':                { affitto_bilocale_periferia: 345, spesa_alimentare_minima: 270, carburante_benzina_litro: 1.82, bollette_stimate: 158 },
  'sardegna':               { affitto_bilocale_periferia: 365, spesa_alimentare_minima: 273, carburante_benzina_litro: 1.85, bollette_stimate: 163 }
};

const DEFAULT_FALLBACK: CostiFallback = {
  affitto_bilocale_periferia: 450,
  spesa_alimentare_minima: 290,
  carburante_benzina_litro: 1.85,
  bollette_stimate: 170
};

export function costiFallback(provincia: string): CostiVita {
  const codice = provincia.toUpperCase();
  // 1. override per provincia specifica (tutti i 107 capoluoghi)
  const perProvincia = FALLBACK_PER_PROVINCIA[codice];
  if (perProvincia) {
    return { provincia: codice, ...perProvincia, aggiornato: new Date().toISOString() };
  }
  // 2. media regionale (difensivo per codici non-capoluogo)
  const entry = PROVINCE_INDEX.get(codice);
  if (entry) {
    const perRegione = FALLBACK_PER_REGIONE[entry.regione];
    if (perRegione) {
      return { provincia: codice, ...perRegione, aggiornato: new Date().toISOString() };
    }
  }
  // 3. default nazionale
  return { provincia: codice, ...DEFAULT_FALLBACK, aggiornato: new Date().toISOString() };
}

export const FALLBACK_FONTE = 'fallback_statico';
