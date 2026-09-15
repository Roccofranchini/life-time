// src/lib/engine/fiscal.ts
// Dal lordo al netto, e dal lordo al costo del lavoro. Pure function.
//
// Nessun numero è scritto qui dentro: aliquote, soglie e formule stanno in
// src/lib/data/aliquote.json, che è modificabile con una PR senza toccare il codice.
//
// Rispetto alla v1 cambiano quattro cose sostanziali (CRITICA.md §2 e §3):
//   1. si calcolano anche i contributi del datore e il TFR, quindi il COSTO DEL LAVORO;
//   2. ci sono somma integrativa, ulteriore detrazione e trattamento integrativo,
//      che sui redditi bassi valgono più di mille euro l'anno;
//   3. il +1% di aliquota aggiuntiva sta sopra la prima fascia pensionabile,
//      non sopra il massimale — la v1 lo applicava 57.000 € più in alto;
//   4. sopra il massimale i contributi IVS non si versano affatto.

import aliquote from '../data/aliquote.json';
import type { Fisco, TipoContratto } from '../types';

export const MARGINE_ERRORE = aliquote.margine_errore.valore;

const A = aliquote;

// ─── IRPEF ─────────────────────────────────────────────────────────────────

/** Applica gli scaglioni progressivi. Gli scaglioni sono contigui: ogni fascia
 *  tassa solo la porzione compresa fra il proprio limite inferiore e superiore. */
export function irpefLorda(imponibile: number): number {
  if (imponibile <= 0) return 0;
  let imposta = 0;
  for (const s of A.irpef.scaglioni) {
    const sup = s.a ?? Number.POSITIVE_INFINITY;
    if (imponibile <= s.da) break;
    imposta += (Math.min(imponibile, sup) - s.da) * s.aliquota;
  }
  return imposta;
}

/** Detrazione per lavoro dipendente — TUIR art. 13 c. 1. */
export function detrazioneLavoro(reddito: number): number {
  if (reddito <= 0) return 0;
  const d = A.detrazione_lavoro_dipendente;
  if (reddito <= d.fascia_1.fino_a) return d.fascia_1.importo;
  if (reddito <= d.fascia_2.fino_a) {
    const f = d.fascia_2;
    return f.base + (f.variabile * (f.riferimento - reddito)) / f.ampiezza;
  }
  if (reddito <= d.fascia_3.fino_a) {
    const f = d.fascia_3;
    return (f.base * (f.riferimento - reddito)) / f.ampiezza;
  }
  return 0;
}

/** Ulteriore detrazione 20.000-40.000 € — L. 207/2024 c. 6.
 *  Piena fino a 32.000 €, poi decresce linearmente fino ad azzerarsi a 40.000 €. */
export function ulterioreDetrazione(reddito: number): number {
  const u = A.ulteriore_detrazione;
  if (reddito <= u.da || reddito > u.azzeramento) return 0;
  if (reddito <= u.fino_a_pieno) return u.importo_pieno;
  return (u.importo_pieno * (u.azzeramento - reddito)) / (u.azzeramento - u.fino_a_pieno);
}

/** Somma integrativa (taglio del cuneo) — L. 207/2024 c. 4-5.
 *  Non concorre al reddito: si somma al netto senza essere tassata.
 *  La percentuale si applica all'INTERO reddito di lavoro, non per scaglioni. */
export function sommaIntegrativa(redditoComplessivo: number, redditoLavoro: number): number {
  const s = A.somma_integrativa;
  if (redditoComplessivo > s.soglia_reddito_complessivo || redditoLavoro <= 0) return 0;
  for (const sc of s.scaglioni) {
    if (sc.reddito_lavoro_fino_a === null || redditoLavoro <= sc.reddito_lavoro_fino_a) {
      return redditoLavoro * sc.percentuale;
    }
  }
  return 0;
}

/** Trattamento integrativo (ex bonus Renzi) — D.L. 3/2020, cumulabile col cuneo.
 *  Fino a 15.000 € spetta pieno se l'imposta lorda supera la detrazione da lavoro.
 *  Fra 15.000 e 28.000 € spetta nei limiti della differenza fra detrazioni e imposta lorda. */
export function trattamentoIntegrativo(
  reddito: number,
  imposta: number,
  detrazioni: number
): number {
  const t = A.trattamento_integrativo;
  if (reddito <= t.soglia_piena) return imposta > detrazioni ? t.importo : 0;
  if (reddito <= t.soglia_massima) return Math.max(0, Math.min(t.importo, detrazioni - imposta));
  return 0;
}

// ─── Contributi ────────────────────────────────────────────────────────────

/** IVS a carico di chi lavora: aliquota base fino alla prima fascia pensionabile,
 *  +1% sopra, nulla sopra il massimale. */
export function contributiLavoratore(lordo: number, pubblico = false): number {
  const d = A.inps.dipendente;
  const base = pubblico ? A.inps.pubblico_impiego.dipendente : d.aliquota;
  const imponibile = Math.min(lordo, d.massimale_annuo);
  const eccedenza = Math.max(0, Math.min(lordo, d.massimale_annuo) - d.prima_fascia_pensionabile);
  return imponibile * base + eccedenza * d.aliquota_aggiuntiva;
}

/** Contributi a carico di chi compra il lavoro: IVS più NASpI, CIG, malattia,
 *  maternità, fondo garanzia e INAIL. È il parametro più incerto del modello. */
export function contributiDatore(lordo: number, pubblico = false): number {
  const imponibile = Math.min(lordo, A.inps.dipendente.massimale_annuo);
  if (pubblico) return imponibile * A.inps.pubblico_impiego.datore;
  return imponibile * (A.inps.datore.ivs + A.inps.datore.altri_contributi);
}

const SETTORI_PUBBLICI = new Set(['pubblica-amministrazione', 'funzioni-locali', 'scuola']);

export function isSettorePubblico(settoreId: string): boolean {
  return SETTORI_PUBBLICI.has(settoreId);
}

// ─── Calcolo completo ──────────────────────────────────────────────────────

function vuoto(lordo: number, mensilita: number): Fisco {
  return {
    lordo_annuo: lordo,
    contributi_lavoratore: 0,
    contributi_datore: 0,
    tfr: 0,
    costo_lavoro_annuo: lordo,
    reddito_complessivo: lordo,
    irpef_lorda: 0,
    detrazione_lavoro: 0,
    ulteriore_detrazione: 0,
    trattamento_integrativo: 0,
    somma_integrativa: 0,
    irpef_netta: 0,
    addizionale_regionale: 0,
    addizionale_comunale: 0,
    imposte_nette: 0,
    netto_annuo: lordo,
    netto_mensile: lordo / 12,
    netto_in_busta: lordo / mensilita,
    mensilita,
    cuneo_su_costo_lavoro: 0,
    margine_errore: MARGINE_ERRORE
  };
}

function aliquotaRegionale(regione: string): number {
  const k = regione.toLowerCase().trim() as keyof typeof A.addizionali.regionali;
  return A.addizionali.regionali[k] ?? 0;
}

export function calcolaFisco(input: {
  lordo_annuo: number;
  tipo_contratto: TipoContratto;
  regione: string;
  settore_id?: string;
  mensilita?: number;
  coefficiente_redditivita?: number;
  forfettario_startup?: boolean;
}): Fisco {
  const { lordo_annuo, tipo_contratto, regione } = input;
  const lordo = Math.max(0, lordo_annuo);
  const mensilita = input.mensilita && input.mensilita > 0 ? input.mensilita : 12;

  // Lavoro nero: nessun prelievo, nessun diritto. Il lordo dichiarato È il netto.
  // Il datore risparmia contributi e TFR: quel risparmio non sparisce, diventa
  // margine — ed è per questo che il settore 'nero' ha la quota del lavoro più bassa.
  if (tipo_contratto === 'nero') return vuoto(lordo, mensilita);

  // Borsa di dottorato: esente IRPEF ex art. 4 L. 476/1984, nessun contributo
  // a carico del borsista sul percorso formativo standard.
  if (tipo_contratto === 'dottorato') return vuoto(lordo, mensilita);

  // Regime forfettario: imposta sostitutiva, niente IRPEF né addizionali.
  if (tipo_contratto === 'forfettario') {
    const coeff = input.coefficiente_redditivita ?? 0.78;
    const redditoLordo = lordo * coeff;
    const contributi = redditoLordo * A.inps.gestione_separata.aliquota;
    const imponibile = Math.max(0, redditoLordo - contributi);
    const aliquotaSost = input.forfettario_startup ? 0.05 : 0.15;
    const imposta = imponibile * aliquotaSost;
    const netto = lordo - contributi - imposta;
    return {
      lordo_annuo: lordo,
      contributi_lavoratore: contributi,
      contributi_datore: 0,
      tfr: 0,
      costo_lavoro_annuo: lordo,
      reddito_complessivo: redditoLordo,
      irpef_lorda: imposta,
      detrazione_lavoro: 0,
      ulteriore_detrazione: 0,
      trattamento_integrativo: 0,
      somma_integrativa: 0,
      irpef_netta: imposta,
      addizionale_regionale: 0,
      addizionale_comunale: 0,
      imposte_nette: imposta,
      netto_annuo: netto,
      netto_mensile: netto / 12,
      netto_in_busta: netto / mensilita,
      mensilita,
      cuneo_su_costo_lavoro: lordo > 0 ? (lordo - netto) / lordo : 0,
      margine_errore: MARGINE_ERRORE
    };
  }

  const pubblico = isSettorePubblico(input.settore_id ?? '');
  const partiva = tipo_contratto === 'partiva';

  // ── contributi ───────────────────────────────────────────────────────────
  const contributi_lavoratore = partiva
    ? lordo * A.inps.gestione_separata.aliquota
    : contributiLavoratore(lordo, pubblico);
  const contributi_datore = partiva ? 0 : contributiDatore(lordo, pubblico);
  const tfr = partiva || pubblico ? 0 : lordo * A.tfr.quota;
  const costo_lavoro_annuo = lordo + contributi_datore + tfr;

  // ── imponibile e imposta ─────────────────────────────────────────────────
  const reddito_complessivo = Math.max(0, lordo - contributi_lavoratore);
  const irpef_lorda = irpefLorda(reddito_complessivo);

  // La detrazione da lavoro dipendente non spetta al lavoro autonomo puro.
  const detrazione_lavoro = partiva ? 0 : detrazioneLavoro(reddito_complessivo);
  const ulteriore_detrazione = partiva ? 0 : ulterioreDetrazione(reddito_complessivo);
  const detrazioni = detrazione_lavoro + ulteriore_detrazione;

  const irpef_netta = Math.max(0, irpef_lorda - detrazioni);

  const trattamento_integrativo = partiva
    ? 0
    : trattamentoIntegrativo(reddito_complessivo, irpef_lorda, detrazioni);
  const somma_integrativa = partiva
    ? 0
    : sommaIntegrativa(reddito_complessivo, reddito_complessivo);

  // Le addizionali si calcolano sul reddito complessivo al lordo delle detrazioni,
  // ma non sono dovute se l'IRPEF netta è azzerata dalle detrazioni.
  const dovuteAddizionali = irpef_lorda > detrazioni;
  const addizionale_regionale = dovuteAddizionali
    ? reddito_complessivo * aliquotaRegionale(regione)
    : 0;
  const addizionale_comunale = dovuteAddizionali
    ? reddito_complessivo * A.addizionali.comunale_media
    : 0;

  // Prelievo fiscale NETTO: imposte meno bonus. Sui redditi bassi è negativo,
  // cioè lo Stato restituisce più IRPEF di quanta ne prenda. Va mostrato così.
  const imposte_nette =
    irpef_netta +
    addizionale_regionale +
    addizionale_comunale -
    trattamento_integrativo -
    somma_integrativa;

  const netto_annuo = lordo - contributi_lavoratore - imposte_nette;

  return {
    lordo_annuo: lordo,
    contributi_lavoratore,
    contributi_datore,
    tfr,
    costo_lavoro_annuo,
    reddito_complessivo,
    irpef_lorda,
    detrazione_lavoro,
    ulteriore_detrazione,
    trattamento_integrativo,
    somma_integrativa,
    irpef_netta,
    addizionale_regionale,
    addizionale_comunale,
    imposte_nette,
    netto_annuo,
    netto_mensile: netto_annuo / 12,
    netto_in_busta: netto_annuo / mensilita,
    mensilita,
    cuneo_su_costo_lavoro:
      costo_lavoro_annuo > 0 ? (costo_lavoro_annuo - netto_annuo) / costo_lavoro_annuo : 0,
    margine_errore: MARGINE_ERRORE
  };
}
