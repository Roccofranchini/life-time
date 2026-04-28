// src/lib/types.ts
// Tipi TypeScript condivisi — Tempo di Vita

// ─── Profilo utente ────────────────────────────────────────────────────────

export type TipoContratto = 'indeterminato' | 'parttime' | 'partiva' | 'dottorato' | 'nero';

export interface ProfiloUtente {
  provincia: string; // codice ISTAT es. "BO"
  nome_provincia: string; // es. "Bologna"
  regione: string; // es. "emilia-romagna"
  comune_capoluogo: string; // per calcolo addizionale comunale
  settore_id: string; // es. "commercio"
  settore_nome: string; // es. "Commercio (Confcommercio)"
  livello: string; // es. "4"
  tipo_contratto: TipoContratto;
  percentuale_parttime?: number; // es. 0.6 per 60%
  ore_settimanali_contratto: number; // es. 40
  paga_mensile_netta?: number; // solo per tipo_contratto === 'nero'
}

// ─── Dati CCNL ─────────────────────────────────────────────────────────────

export interface CcnlLivello {
  livello: string;
  descrizione: string;
  lordo_mensile: number; // minimo tabellare mensile in €
}

export interface CcnlSettore {
  id: string;
  nome: string;
  fonte: string; // URL PDF/fonte ufficiale
  aggiornato: string; // ISO date
  mensilita?: number; // default 13; dottorato usa 12 (no 13a)
  livelli: CcnlLivello[];
}

export interface CcnlData {
  settori: CcnlSettore[];
}

// ─── Aliquote fiscali ──────────────────────────────────────────────────────

export interface ScaglioneIrpef {
  da: number;
  a: number | null; // null = "in su"
  aliquota: number;
}

export interface AliquoteData {
  anno: number;
  fonte: string;
  irpef: {
    scaglioni: ScaglioneIrpef[];
  };
  inps: {
    dipendente: {
      aliquota: number;
      aliquota_massimale: number;
      massimale_annuo: number;
    };
    partiva_gestione_separata: {
      aliquota: number;
    };
  };
  addizionali_regionali: Record<string, number>;
  addizionali_comunali_media: number;
  margine_medio_settore_fonte: string;
  margine_medio_settore_url: string;
  margine_medio_settore: Record<string, number>;
}

// ─── Tipi di contratto ─────────────────────────────────────────────────────

export type TipoContrattoFiscale = TipoContratto | 'dipendente';

// ─── Motore fiscale ─────────────────────────────────────────────────────────

export interface FiscalInput {
  lordo_annuo: number;
  tipo_contratto: TipoContratto;
  percentuale_parttime?: number;
  regione: string;
  comune: string;
}

export interface FiscalOutput {
  netto_mensile: number;
  netto_annuo: number;
  irpef_annua: number;
  addizionale_regionale: number;
  addizionale_comunale: number;
  contributi_inps: number;
  cuneo_fiscale_percentuale: number;
  margine_errore: number; // sempre 0.03 (±3%)
}

// ─── Costi vita ──────────────────────────────────────────────────────────────

export interface CostiVita {
  provincia: string;
  affitto_bilocale_periferia: number; // € mensili
  spesa_alimentare_minima: number; // € mensili per adulto
  carburante_benzina_litro: number; // € per litro
  bollette_stimate: number; // € mensili (media nazionale)
  aggiornato: string; // ISO date
}

// ─── Motore sopravvivenza ─────────────────────────────────────────────────

export interface SurvivalInput {
  affitto: number;
  spesa_minima: number;
  bollette: number;
  carburante_mensile_stimato: number;
  netto_mensile: number;
  ore_lavoro_mensili: number; // es. 40h * 52w / 12 = 173h
}

export interface SurvivalOutput {
  costo_sopravvivenza_totale: number; // € mensili
  ore_sopravvivenza: number; // ore di lavoro necessarie
  percentuale_netto: number; // es. 0.65 = 65% del netto
  percentuale_ore_lavoro: number; // es. 0.47 = 47% delle ore di lavoro
}

// ─── Motore temporale ────────────────────────────────────────────────────────

export interface TimeInput {
  survival: SurvivalOutput;
  fiscal: FiscalOutput;
  lordo_annuo: number;
  ore_lavoro_mensili: number;
  settore_id: string; // per margine medio di settore
  affitto: number; // per calcolo giorni_affitto
}

export interface TimeBreakdown {
  ore_totali_mese: number; // 730
  ore_sonno: number; // 240
  ore_lavoro: number; // es. 173
  ore_sopravvivenza: number; // ore di lavoro per costi fissi
  ore_stato: number; // ore di lavoro per tasse
  ore_capitale: number; // ore di lavoro per profitto azienda
  ore_vita_biologica: number; // 180 — riproduzione sociale (ISTAT)
  ore_libero_reale: number; // residuo onesto dopo sonno/lavoro/vita biologica
  ore_libere: number; // legacy: 730 − sonno − lavoro (retro-compat)
  giorni_affitto: number; // es. "18 giorni per l'affitto"
}

// ─── CTA locali ─────────────────────────────────────────────────────────────

export type TipoCta =
  | 'sindacato_inquilini'
  | 'sindacato_lavoro'
  | 'sportello_sociale'
  | 'collettivo_locale';

export interface CtaEntry {
  id: string;
  provincia: string; // codice ISTAT, o "nazionale"
  tipo: TipoCta;
  nome: string;
  url: string;
  tag: string[];
  descrizione: string;
}

export interface CtaData {
  entries: CtaEntry[];
}

// ─── Report condivisibile ────────────────────────────────────────────────────

export interface ReportParams {
  p: string; // provincia es. "BO"
  s: string; // settore-livello es. "commercio-4"
  c: TipoContratto; // tipo contratto
  pt?: string; // percentuale part-time es. "60"
}

export interface ReportData {
  profilo: ProfiloUtente;
  fiscal: FiscalOutput;
  costi: CostiVita;
  survival: SurvivalOutput;
  breakdown: TimeBreakdown;
  cta: CtaEntry[];
}
