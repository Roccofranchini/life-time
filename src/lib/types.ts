// src/lib/types.ts
// Tipi condivisi — Tempo di Vita 2.0
//
// Il modello ha un solo frame di riferimento: il VALORE AGGIUNTO prodotto in
// un'ora di lavoro. Ogni euro prodotto finisce in una e una sola delle quattro
// destinazioni (profitto, previdenza, imposte, netto), che sommano al valore
// aggiunto per costruzione. Le ore si ricavano come quote di quella somma.
// Vedi CRITICA.md §1 per perché la v1 non poteva funzionare.

// ─── Contratto ─────────────────────────────────────────────────────────────

export type TipoContratto =
  | 'dipendente' // indeterminato o determinato: fiscalmente identici
  | 'parttime'
  | 'partiva' // gestione separata, regime ordinario
  | 'forfettario'
  | 'dottorato'
  | 'nero';

export type ProfiloCura = 'uomo_occupato' | 'donna_occupata' | 'media';

export type AlloggioId = 'stanza' | 'monolocale' | 'bilocale' | 'coppia';

export type AreaGeografica = 'nord' | 'centro' | 'mezzogiorno';
export type TipoComune = 'metropoli' | 'grande' | 'piccolo';

// ─── Ingresso unico del motore ─────────────────────────────────────────────

export interface Ingresso {
  /** RAL effettiva in €, già scalata per il part-time. Per 'nero' è il netto × mensilità. */
  lordo_annuo: number;
  /** mensilità contrattuali: 12, 13 o 14. Serve a distinguere il netto in busta dal reddito medio. */
  mensilita: number;
  tipo_contratto: TipoContratto;
  /** slug regione, es. "emilia-romagna" — per l'addizionale regionale */
  regione: string;
  /** id di settore per la quota del lavoro sul valore aggiunto */
  settore_id: string;
  /** codice provincia ISTAT, es. "BO" */
  provincia: string;

  /** ore settimanali da contratto */
  ore_settimanali: number;
  /** minuti di spostamento casa-lavoro andata e ritorno, per giorno lavorativo */
  minuti_pendolarismo: number;
  /** ore settimanali di straordinario non retribuito */
  ore_straordinario_non_pagato: number;
  /** quale carico di lavoro familiare applicare (ISTAT, persone occupate) */
  profilo_cura: ProfiloCura;

  /** tipo di alloggio: determina superficie e numero di persone su cui si divide il canone */
  alloggio: AlloggioId;
  /** true se il tragitto si fa in auto, false se con abbonamento al trasporto pubblico */
  usa_auto: boolean;
  /** pasti consumati fuori per motivi di lavoro, a settimana */
  pasti_fuori_settimana: number;

  /** solo forfettario: coefficiente di redditività ATECO */
  coefficiente_redditivita?: number;
  /** solo forfettario: true nei primi 5 anni di attività (imposta sostitutiva al 5%) */
  forfettario_startup?: boolean;
}

// ─── Uscita fiscale ────────────────────────────────────────────────────────

export interface Fisco {
  lordo_annuo: number;
  /** contributi previdenziali trattenuti a chi lavora */
  contributi_lavoratore: number;
  /** contributi previdenziali versati da chi compra il lavoro */
  contributi_datore: number;
  /** accantonamento TFR: salario differito, non imposta */
  tfr: number;
  /** ciò che l'ora di lavoro costa davvero a chi la compra */
  costo_lavoro_annuo: number;

  reddito_complessivo: number;
  irpef_lorda: number;
  detrazione_lavoro: number;
  ulteriore_detrazione: number;
  trattamento_integrativo: number;
  somma_integrativa: number;
  irpef_netta: number;
  addizionale_regionale: number;
  addizionale_comunale: number;

  /** prelievo fiscale netto: imposte meno bonus. Può essere negativo sui redditi bassi. */
  imposte_nette: number;
  netto_annuo: number;
  /** netto annuo / 12: il reddito medio mensile, tredicesima e quattordicesima spalmate.
   *  È il numero giusto da confrontare con i costi, che sono mensili tutti i mesi. */
  netto_mensile: number;
  /** netto annuo / mensilità: quello che si legge in busta paga. Più basso. */
  netto_in_busta: number;
  mensilita: number;

  /** (costo del lavoro − netto) / costo del lavoro */
  cuneo_su_costo_lavoro: number;
  margine_errore: number;
}

// ─── Decomposizione del valore aggiunto ────────────────────────────────────

export interface Quota {
  /** € al mese */
  euro: number;
  /** frazione del valore aggiunto, in [0,1] */
  frazione: number;
  /** ore di lavoro retribuito corrispondenti */
  ore: number;
}

export interface Valore {
  /** valore aggiunto mensile attribuibile a chi lavora, in € */
  valore_aggiunto_mensile: number;
  /** quota del valore aggiunto che va al lavoro, da ISTAT per settore */
  quota_lavoro: number;
  incertezza_quota: number;

  profitto: Quota;
  previdenza: Quota;
  imposte: Quota;
  netto: Quota;

  /** banda min-max del profitto, dall'incertezza sulla quota del lavoro */
  profitto_banda: { min_ore: number; max_ore: number; min_euro: number; max_euro: number };
  /** true per i settori pubblici, dove il profitto è posto a zero per convenzione */
  settore_pubblico: boolean;
}

// ─── Tempo ─────────────────────────────────────────────────────────────────

export interface Tempo {
  ore_totali_mese: number;
  ore_retribuite: number;
  ore_pendolarismo: number;
  ore_straordinario: number;
  /** retribuite + pendolarismo + straordinario non pagato */
  ore_sottratte: number;

  ore_sonno: number;
  ore_cura_personale: number;
  ore_lavoro_familiare: number;
  ore_libere: number;

  /** netto / ore retribuite */
  salario_orario_nominale: number;
  /** (netto − costi imposti dal lavoro) / ore sottratte */
  salario_orario_reale: number;
  /** quanto il salario orario reale è più basso di quello nominale, in [0,1] */
  scarto_orario: number;
  costi_del_lavoro_mese: number;
}

// ─── Sopravvivenza ─────────────────────────────────────────────────────────

export interface Sopravvivenza {
  affitto: number;
  affitto_mq: number;
  affitto_persone: number;
  /** soglia di povertà assoluta ISTAT per un adulto solo, nella zona */
  soglia_istat: number;
  /** parte non abitativa del paniere ISTAT: cibo, trasporti, salute, igiene, vestiario */
  paniere_essenziale: number;
  /** affitto di mercato + paniere essenziale */
  costi_fissi: number;
  /** netto mensile meno i costi che il lavoro impone (tragitto, pasti fuori) */
  netto_disponibile: number;

  /** ore da lavorare, al salario orario reale, per pagare i costi fissi */
  ore_sopravvivenza: number;
  /** quota del netto disponibile assorbita dai costi fissi */
  quota_netto: number;
  /** quota delle ore sottratte assorbita dai costi fissi */
  quota_ore: number;
  /** € che restano davvero: netto disponibile meno costi fissi */
  residuo: number;
  /** true se i costi fissi superano il netto disponibile */
  in_rosso: boolean;
  /** true se il netto è sotto la soglia di povertà assoluta ISTAT */
  sotto_soglia_istat: boolean;
  /** giorni di calendario del mese lavorati solo per il canone */
  giorni_affitto: number;
}

// ─── Risultato completo ────────────────────────────────────────────────────

export interface Risultato {
  fisco: Fisco;
  valore: Valore;
  tempo: Tempo;
  sopravvivenza: Sopravvivenza;
}

// ─── Aiuti concreti ────────────────────────────────────────────────────────

export interface CondizioniAiuto {
  reddito_complessivo_max?: number;
  isee_max?: number;
  richiede_isee?: boolean;
  richiede_affitto?: boolean;
  richiede_figli?: boolean;
  richiede_carico_familiare?: boolean;
  eta_min?: number;
  eta_max?: number;
  tipo_contratto_in?: string[];
  tipo_contratto_not_in?: string[];
}

export interface VoceAiuto {
  id: string;
  titolo: string;
  importo: string;
  descrizione: string;
  come: string;
  fonte: string;
  url: string;
  condizioni: CondizioniAiuto;
  priorita: number;
}

/** Le poche opzioni che l'utente può dichiarare. Restano nel browser, sempre. */
export interface SituazionePersonale {
  in_affitto: boolean;
  under31: boolean;
  con_figli: boolean;
}

export interface AiutoValutato extends VoceAiuto {
  /** 'certo' = le condizioni note bastano; 'probabile' = dipende dall'ISEE, che non calcoliamo */
  esito: 'certo' | 'probabile';
  motivo: string;
}

// ─── Dati di riferimento ───────────────────────────────────────────────────

export interface ProvinciaEntry {
  codice: string;
  nome: string;
  regione: string;
  area: AreaGeografica;
  tipo_comune: TipoComune;
  eur_mq: number;
}

export interface CcnlLivello {
  livello: string;
  descrizione: string;
  minimo_tabellare: number;
  contingenza: number;
  edr: number;
  verifica: 'tabella' | 'riparametrato' | 'stima';
}

export interface CcnlSettore {
  id: string;
  nome: string;
  sigla_ccnl: string;
  fonte: string;
  url: string;
  aggiornato: string;
  mensilita: number;
  ore_settimanali: number;
  composizione: string;
  esente_irpef?: boolean;
  livelli: CcnlLivello[];
}

// ─── CTA locali ────────────────────────────────────────────────────────────

export type TipoCta =
  | 'sindacato_inquilini'
  | 'sindacato_lavoro'
  | 'sportello_sociale'
  | 'collettivo_locale';

export interface CtaEntry {
  id: string;
  provincia: string;
  tipo: TipoCta;
  nome: string;
  url: string;
  tag: string[];
  descrizione: string;
}
