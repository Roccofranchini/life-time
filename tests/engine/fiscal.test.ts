import { describe, it, expect } from 'vitest';
import { calcola_netto, MARGINE_ERRORE } from '../../src/lib/engine/fiscal';

describe('calcola_netto — dipendente', () => {
  it('lordo 25.000€ Bologna (Emilia-Romagna) → netto annuo ~19.300-19.500€', () => {
    const out = calcola_netto({
      lordo_annuo: 25_000,
      tipo_contratto: 'indeterminato',
      regione: 'emilia-romagna',
      comune: 'bologna'
    });

    expect(out.netto_annuo).toBeGreaterThanOrEqual(19_300);
    expect(out.netto_annuo).toBeLessThanOrEqual(19_500);
    expect(out.netto_mensile).toBeCloseTo(out.netto_annuo / 12, 2);
  });

  it('INPS dipendente al 9,19% sotto massimale', () => {
    const out = calcola_netto({
      lordo_annuo: 25_000,
      tipo_contratto: 'indeterminato',
      regione: 'emilia-romagna',
      comune: 'bologna'
    });

    expect(out.contributi_inps).toBeCloseTo(25_000 * 0.0919, 1);
  });

  it('include margine di errore 3% nell’output', () => {
    const out = calcola_netto({
      lordo_annuo: 30_000,
      tipo_contratto: 'indeterminato',
      regione: 'lombardia',
      comune: 'milano'
    });

    expect(out.margine_errore).toBe(0.03);
    expect(MARGINE_ERRORE).toBe(0.03);
  });

  it('progressività: raddoppiando il lordo il netto non raddoppia', () => {
    const basso = calcola_netto({
      lordo_annuo: 20_000,
      tipo_contratto: 'indeterminato',
      regione: 'lombardia',
      comune: 'milano'
    });
    const alto = calcola_netto({
      lordo_annuo: 40_000,
      tipo_contratto: 'indeterminato',
      regione: 'lombardia',
      comune: 'milano'
    });

    // netto alto < 2 × netto basso perché il secondo scaglione è tassato di più
    expect(alto.netto_annuo).toBeLessThan(basso.netto_annuo * 2);
    // ma è comunque maggiore in valore assoluto
    expect(alto.netto_annuo).toBeGreaterThan(basso.netto_annuo);
  });

  it('detrazione lavoro dipendente 2024: 1.955€ fissa per RC ≤ 15.000', () => {
    // Lordo 13.500 → INPS 1.240,65 → RC 12.259,35 (< 15.000)
    // IRPEF lorda: 12.259,35 × 0,23 = 2.819,65
    // Detrazione: 1.955 (fissa)
    // IRPEF netta: 864,65
    const out = calcola_netto({
      lordo_annuo: 13_500,
      tipo_contratto: 'indeterminato',
      regione: 'lombardia',
      comune: 'milano'
    });
    const rc = 13_500 - 13_500 * 0.0919;
    const irpefLordaAttesa = rc * 0.23;
    expect(out.irpef_annua).toBeCloseTo(irpefLordaAttesa - 1955, 1);
  });

  it('regione sconosciuta → addizionale regionale = 0 (non esplode)', () => {
    const out = calcola_netto({
      lordo_annuo: 25_000,
      tipo_contratto: 'indeterminato',
      regione: 'regione-che-non-esiste',
      comune: 'nessuno'
    });
    expect(out.addizionale_regionale).toBe(0);
    expect(out.netto_annuo).toBeGreaterThan(0);
  });
});

describe('calcola_netto — part-time (RAL effettiva in input)', () => {
  it('part-time: input = RAL effettiva (nessuna scalatura interna)', () => {
    // Convenzione CGIL/simulatori: l'utente passa la RAL che compare in CU.
    // Per un part-time 60% su base full-time 25.000 → RAL effettiva 15.000.
    const fullTime = calcola_netto({
      lordo_annuo: 25_000,
      tipo_contratto: 'indeterminato',
      regione: 'emilia-romagna',
      comune: 'bologna'
    });
    const partTime = calcola_netto({
      lordo_annuo: 15_000,
      tipo_contratto: 'parttime',
      percentuale_parttime: 0.6, // solo informativo, non usato nel calcolo
      regione: 'emilia-romagna',
      comune: 'bologna'
    });

    // INPS scala col lordo effettivo
    expect(partTime.contributi_inps).toBeCloseTo(15_000 * 0.0919, 1);

    // netto < full-time ma > 50% del full-time (progressività favorisce i bassi redditi)
    expect(partTime.netto_annuo).toBeLessThan(fullTime.netto_annuo);
    expect(partTime.netto_annuo).toBeGreaterThan(fullTime.netto_annuo * 0.5);

    // range realistico
    expect(partTime.netto_annuo).toBeGreaterThan(11_000);
    expect(partTime.netto_annuo).toBeLessThan(14_000);
  });

  it('tipo_contratto parttime e indeterminato sullo stesso lordo → stesso netto', () => {
    const dip = calcola_netto({
      lordo_annuo: 15_000,
      tipo_contratto: 'indeterminato',
      regione: 'lombardia',
      comune: 'milano'
    });
    const pt = calcola_netto({
      lordo_annuo: 15_000,
      tipo_contratto: 'parttime',
      percentuale_parttime: 0.6,
      regione: 'lombardia',
      comune: 'milano'
    });
    expect(pt.netto_annuo).toBeCloseTo(dip.netto_annuo, 2);
  });
});

describe('calcola_netto — partita IVA', () => {
  it('P.IVA 30.000€: INPS gestione separata 26,23%, no detrazione dipendente', () => {
    const out = calcola_netto({
      lordo_annuo: 30_000,
      tipo_contratto: 'partiva',
      regione: 'emilia-romagna',
      comune: 'bologna'
    });

    // INPS gestione separata: 30_000 × 0.2623 = 7.869
    expect(out.contributi_inps).toBeCloseTo(30_000 * 0.2623, 1);
    expect(out.contributi_inps).toBeCloseTo(7_869, 0);

    // IRPEF lorda = (30000 - 7869) × 0.23 = 5.090,13 (scaglione singolo)
    // Senza detrazione lavoro dipendente → IRPEF netta ≈ 5.090
    expect(out.irpef_annua).toBeCloseTo(22_131 * 0.23, 0);

    // Netto in un intervallo realistico
    expect(out.netto_annuo).toBeGreaterThan(15_000);
    expect(out.netto_annuo).toBeLessThan(18_000);
  });

  it('P.IVA paga più tasse del dipendente a parità di lordo (no detrazione)', () => {
    const dip = calcola_netto({
      lordo_annuo: 30_000,
      tipo_contratto: 'indeterminato',
      regione: 'emilia-romagna',
      comune: 'bologna'
    });
    const piva = calcola_netto({
      lordo_annuo: 30_000,
      tipo_contratto: 'partiva',
      regione: 'emilia-romagna',
      comune: 'bologna'
    });

    expect(piva.netto_annuo).toBeLessThan(dip.netto_annuo);
    expect(piva.cuneo_fiscale_percentuale).toBeGreaterThan(dip.cuneo_fiscale_percentuale);
  });
});
