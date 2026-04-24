// src/lib/engine/fiscal.ts
// Motore di calcolo netto da lordo — pure function, no side effects.
// Le aliquote provengono sempre da src/lib/data/aliquote.json.

import aliquoteData from '../data/aliquote.json';
import type {
  AliquoteData,
  FiscalInput,
  FiscalOutput,
  ScaglioneIrpef
} from '../types';

const aliquote = aliquoteData as AliquoteData;

export const MARGINE_ERRORE = 0.03;

/**
 * Applica gli scaglioni IRPEF progressivi al reddito imponibile.
 * Le estremità "da"/"a" del JSON sono trattate come intervalli contigui:
 * la base tassata in ogni scaglione va dal limite superiore precedente al
 * limite superiore corrente (o all'imponibile, se inferiore).
 */
function calcolaIrpefLorda(imponibile: number, scaglioni: ScaglioneIrpef[]): number {
  if (imponibile <= 0) return 0;
  let imposta = 0;
  let precedente = 0;
  for (const s of scaglioni) {
    const limiteSup = s.a ?? Number.POSITIVE_INFINITY;
    if (imponibile <= precedente) break;
    const porzione = Math.min(imponibile, limiteSup) - precedente;
    if (porzione > 0) imposta += porzione * s.aliquota;
    precedente = limiteSup;
  }
  return imposta;
}

/**
 * Detrazione IRPEF per lavoro dipendente — formula 2024 post D.Lgs 216/2023
 * (TUIR art. 13, c. 1, lett. a, b, c).
 * Applicata al reddito complessivo, che per un dipendente puro coincide con
 * il lordo annuo meno i contributi INPS a carico del lavoratore.
 * Fonte: Agenzia delle Entrate, circolare INPS 22/2024; brocardi.it art.13 TUIR.
 */
function calcolaDetrazioneLavoroDipendente(redditoComplessivo: number): number {
  if (redditoComplessivo <= 0) return 0;
  if (redditoComplessivo <= 15000) {
    // Detrazione base 2024: 1.955 € fissa (no "bonus 690" — formula originaria
    // pre-216/2023). Il trattamento integrativo ex-"bonus Renzi" non è qui.
    return 1955;
  }
  if (redditoComplessivo <= 28000) {
    return 1910 + (1190 * (28000 - redditoComplessivo)) / 13000;
  }
  if (redditoComplessivo <= 50000) {
    return (1910 * (50000 - redditoComplessivo)) / 22000;
  }
  return 0;
}

/**
 * Contributi INPS lavoratore dipendente: 9.19% fino al massimale annuo,
 * quindi 10.19% sulla quota eccedente.
 */
function calcolaInpsDipendente(lordoAnnuo: number): number {
  const { aliquota, aliquota_massimale, massimale_annuo } = aliquote.inps.dipendente;
  if (lordoAnnuo <= massimale_annuo) return lordoAnnuo * aliquota;
  return massimale_annuo * aliquota + (lordoAnnuo - massimale_annuo) * aliquota_massimale;
}

/**
 * Contributi INPS gestione separata per P.IVA (flat).
 */
function calcolaInpsPartiva(lordoAnnuo: number): number {
  return lordoAnnuo * aliquote.inps.partiva_gestione_separata.aliquota;
}

function aliquotaRegionale(regione: string): number {
  const key = regione.toLowerCase().trim();
  return aliquote.addizionali_regionali[key] ?? 0;
}

/**
 * Calcolo del netto annuo/mensile partendo dal RAL effettivo.
 *
 * Convenzione (coerente con CGIL, JetHR, calcolostipendionetto.it):
 *   - `lordo_annuo` è la RAL EFFETTIVA che compare in CU/busta paga,
 *     già scalata in caso di part-time. Non va applicata alcuna ulteriore
 *     scalatura qui. `percentuale_parttime` resta come campo informativo
 *     (usato dall'UI per narrativa, non dall'aritmetica fiscale).
 *   - `tipo_contratto` discrimina solo i contributi INPS (dipendente vs.
 *     gestione separata) e l'applicabilità della detrazione lavoro dipendente.
 *
 * Il risultato porta sempre il margine d'errore dichiarato ±3%.
 */
export function calcola_netto(input: FiscalInput): FiscalOutput {
  const { lordo_annuo, tipo_contratto, regione } = input;

  const contributi_inps =
    tipo_contratto === 'partiva'
      ? calcolaInpsPartiva(lordo_annuo)
      : calcolaInpsDipendente(lordo_annuo);

  // Reddito complessivo (dipendente puro) = lordo − contributi INPS obbligatori
  const redditoComplessivo = Math.max(0, lordo_annuo - contributi_inps);

  const irpefLorda = calcolaIrpefLorda(redditoComplessivo, aliquote.irpef.scaglioni);
  const detrazione =
    tipo_contratto === 'partiva' ? 0 : calcolaDetrazioneLavoroDipendente(redditoComplessivo);
  const irpef_annua = Math.max(0, irpefLorda - detrazione);

  const addizionale_regionale = redditoComplessivo * aliquotaRegionale(regione);
  const addizionale_comunale = redditoComplessivo * aliquote.addizionali_comunali_media;

  const netto_annuo =
    lordo_annuo - contributi_inps - irpef_annua - addizionale_regionale - addizionale_comunale;

  const totaleTasse =
    irpef_annua + addizionale_regionale + addizionale_comunale + contributi_inps;
  const cuneo_fiscale_percentuale = lordo_annuo > 0 ? totaleTasse / lordo_annuo : 0;

  return {
    netto_mensile: netto_annuo / 12,
    netto_annuo,
    irpef_annua,
    addizionale_regionale,
    addizionale_comunale,
    contributi_inps,
    cuneo_fiscale_percentuale,
    margine_errore: MARGINE_ERRORE
  };
}
