// tests/engine/fiscal.test.ts
import { describe, it, expect } from 'vitest';
import {
  calcolaFisco,
  irpefLorda,
  detrazioneLavoro,
  ulterioreDetrazione,
  sommaIntegrativa,
  trattamentoIntegrativo,
  contributiLavoratore,
  contributiDatore
} from '../../src/lib/engine/fiscal';
import aliquote from '../../src/lib/data/aliquote.json';

describe('IRPEF — scaglioni 2026', () => {
  it('non tassa un reddito nullo o negativo', () => {
    expect(irpefLorda(0)).toBe(0);
    expect(irpefLorda(-100)).toBe(0);
  });

  it('applica il 23% dentro il primo scaglione', () => {
    expect(irpefLorda(20000)).toBeCloseTo(4600, 2);
    expect(irpefLorda(28000)).toBeCloseTo(6440, 2);
  });

  it('applica il 33% (non più il 35%) sul secondo scaglione', () => {
    // 28.000 × 23% + 12.000 × 33%
    expect(irpefLorda(40000)).toBeCloseTo(6440 + 3960, 2);
  });

  it('applica il 43% oltre 50.000 €', () => {
    // 6.440 + 22.000 × 33% + 10.000 × 43%
    expect(irpefLorda(60000)).toBeCloseTo(6440 + 7260 + 4300, 2);
  });

  it('è monotona crescente e continua ai confini di scaglione', () => {
    for (const s of [27999, 28001, 49999, 50001]) {
      expect(irpefLorda(s + 1)).toBeGreaterThan(irpefLorda(s));
    }
    expect(irpefLorda(28001) - irpefLorda(28000)).toBeCloseTo(0.33, 2);
    expect(irpefLorda(50001) - irpefLorda(50000)).toBeCloseTo(0.43, 2);
  });
});

describe('Detrazione da lavoro dipendente', () => {
  it('vale 1.955 € fino a 15.000 € (no tax area a 8.500 €)', () => {
    expect(detrazioneLavoro(10000)).toBe(1955);
    expect(detrazioneLavoro(15000)).toBe(1955);
    // no tax area: 8.500 × 23% = 1.955, esattamente la detrazione
    expect(irpefLorda(8500)).toBeCloseTo(1955, 2);
  });

  it('decresce fra 15.000 e 28.000 € secondo la formula TUIR', () => {
    expect(detrazioneLavoro(28000)).toBeCloseTo(1910, 2);
    expect(detrazioneLavoro(20000)).toBeCloseTo(1910 + (1190 * 8000) / 13000, 2);
  });

  it('si azzera a 50.000 €', () => {
    expect(detrazioneLavoro(50000)).toBeCloseTo(0, 6);
    expect(detrazioneLavoro(60000)).toBe(0);
  });

  it('salta verso l’alto appena sopra 15.000 €: è la norma, non un bug', () => {
    // TUIR art. 13 c. 1 lett. b) è discontinuo per costruzione: a 15.000 € la
    // detrazione vale 1.955 €, un euro sopra vale 1.910 + 1.190 = 3.100 €.
    // Il salto è compensato dalla perdita del trattamento integrativo (1.200 €),
    // che sotto i 15.000 € spetta pieno. Il vero invariante è che il NETTO non
    // faccia salti perversi — verificato in «calcolaFisco».
    expect(detrazioneLavoro(15000)).toBe(1955);
    expect(detrazioneLavoro(15001)).toBeCloseTo(3100, 0);
    expect(Math.abs(1955 + 1200 - detrazioneLavoro(15001))).toBeLessThan(60);
  });

  it('decresce con continuità dentro ciascuna fascia', () => {
    for (const [da, a] of [[15100, 27900], [28100, 49900]]) {
      let prec = Infinity;
      for (let r = da; r <= a; r += 200) {
        const d = detrazioneLavoro(r);
        expect(d).toBeLessThanOrEqual(prec + 1e-9);
        prec = d;
      }
    }
  });
});

describe('Taglio del cuneo 2026 — le tre misure che la v1 non aveva', () => {
  it('somma integrativa: 7,1% / 5,3% / 4,8% sotto i 20.000 €', () => {
    expect(sommaIntegrativa(8000, 8000)).toBeCloseTo(8000 * 0.071, 2);
    expect(sommaIntegrativa(12000, 12000)).toBeCloseTo(12000 * 0.053, 2);
    expect(sommaIntegrativa(18000, 18000)).toBeCloseTo(18000 * 0.048, 2);
  });

  it('somma integrativa: nulla sopra i 20.000 € di reddito complessivo', () => {
    expect(sommaIntegrativa(20001, 20001)).toBe(0);
  });

  it('ulteriore detrazione: 1.000 € piena fra 20.000 e 32.000 €', () => {
    expect(ulterioreDetrazione(25000)).toBe(1000);
    expect(ulterioreDetrazione(32000)).toBe(1000);
  });

  it('ulteriore detrazione: decresce da 32.000 e si azzera a 40.000 €', () => {
    expect(ulterioreDetrazione(36000)).toBeCloseTo(500, 2);
    expect(ulterioreDetrazione(40000)).toBeCloseTo(0, 6);
    expect(ulterioreDetrazione(40001)).toBe(0);
    expect(ulterioreDetrazione(19999)).toBe(0);
  });

  it('trattamento integrativo: pieno sotto 15.000 € solo se c’è capienza', () => {
    // reddito 12.000: imposta lorda 2.760 > detrazione 1.955 → spetta
    expect(trattamentoIntegrativo(12000, irpefLorda(12000), detrazioneLavoro(12000))).toBe(1200);
    // reddito 8.000: imposta lorda 1.840 < detrazione 1.955 → non spetta
    expect(trattamentoIntegrativo(8000, irpefLorda(8000), detrazioneLavoro(8000))).toBe(0);
  });

  it('trattamento integrativo: nullo sopra 28.000 €', () => {
    expect(trattamentoIntegrativo(30000, 8000, 1500)).toBe(0);
  });
});

describe('Contributi — i parametri che la v1 sbagliava', () => {
  const d = aliquote.inps.dipendente;

  it('applica il +1% sopra la prima fascia pensionabile, non sopra il massimale', () => {
    const sotto = contributiLavoratore(50000);
    expect(sotto).toBeCloseTo(50000 * d.aliquota, 2);

    const sopra = contributiLavoratore(70000);
    const atteso =
      70000 * d.aliquota + (70000 - d.prima_fascia_pensionabile) * d.aliquota_aggiuntiva;
    expect(sopra).toBeCloseTo(atteso, 2);
    // la v1 avrebbe applicato l'aliquota maggiorata solo oltre 113.520 €
    expect(sopra).toBeGreaterThan(70000 * d.aliquota);
  });

  it('non versa IVS sopra il massimale', () => {
    const alMassimale = contributiLavoratore(d.massimale_annuo);
    const oltre = contributiLavoratore(d.massimale_annuo + 50000);
    expect(oltre).toBeCloseTo(alMassimale, 2);
  });

  it('i contributi del datore superano il doppio di quelli del lavoratore', () => {
    const lav = contributiLavoratore(30000);
    const dat = contributiDatore(30000);
    expect(dat).toBeGreaterThan(lav * 2);
    expect(dat / 30000).toBeCloseTo(aliquote.inps.datore.ivs + aliquote.inps.datore.altri_contributi, 4);
  });
});

describe('calcolaFisco — coerenza contabile', () => {
  const base = { regione: 'emilia-romagna', settore_id: 'commercio' } as const;

  it('netto = lordo − contributi − imposte nette, sempre', () => {
    for (const lordo of [12000, 18000, 25000, 35000, 60000, 130000]) {
      const f = calcolaFisco({ ...base, lordo_annuo: lordo, tipo_contratto: 'dipendente' });
      expect(f.netto_annuo).toBeCloseTo(
        f.lordo_annuo - f.contributi_lavoratore - f.imposte_nette,
        6
      );
    }
  });

  it('costo del lavoro = lordo + contributi datore + TFR', () => {
    const f = calcolaFisco({ ...base, lordo_annuo: 25000, tipo_contratto: 'dipendente' });
    expect(f.costo_lavoro_annuo).toBeCloseTo(f.lordo_annuo + f.contributi_datore + f.tfr, 6);
    // il costo del lavoro sta circa il 37% sopra la RAL
    expect(f.costo_lavoro_annuo / f.lordo_annuo).toBeGreaterThan(1.3);
    expect(f.costo_lavoro_annuo / f.lordo_annuo).toBeLessThan(1.45);
  });

  it('sui redditi bassi il prelievo fiscale netto è negativo (lo Stato restituisce)', () => {
    const f = calcolaFisco({ ...base, lordo_annuo: 14000, tipo_contratto: 'dipendente' });
    expect(f.somma_integrativa).toBeGreaterThan(0);
    expect(f.imposte_nette).toBeLessThan(0);
    expect(f.netto_annuo).toBeGreaterThan(f.lordo_annuo - f.contributi_lavoratore);
  });

  it('il netto cresce sempre col lordo: nessun salto perverso alle soglie', () => {
    let prec = -Infinity;
    for (let lordo = 9000; lordo <= 60000; lordo += 250) {
      const f = calcolaFisco({ ...base, lordo_annuo: lordo, tipo_contratto: 'dipendente' });
      expect(f.netto_annuo).toBeGreaterThan(prec);
      prec = f.netto_annuo;
    }
  });

  it('il netto di un CCNL commercio IV livello è nell’ordine di grandezza atteso', () => {
    // 1.827,01 €/mese × 14 mensilità = 25.578 € di RAL
    const f = calcolaFisco({ ...base, lordo_annuo: 25578, tipo_contratto: 'dipendente' });
    const mensile = f.netto_annuo / 14; // in busta, su 14 mensilità
    expect(mensile).toBeGreaterThan(1350);
    expect(mensile).toBeLessThan(1600);
  });

  it('la borsa di dottorato è esente: netto = lordo', () => {
    const f = calcolaFisco({ ...base, lordo_annuo: 1354 * 12, tipo_contratto: 'dottorato' });
    expect(f.netto_annuo).toBe(1354 * 12);
    expect(f.contributi_lavoratore).toBe(0);
    expect(f.irpef_netta).toBe(0);
  });

  it('nel lavoro nero non c’è prelievo, ma nemmeno contributi versati', () => {
    const f = calcolaFisco({ ...base, lordo_annuo: 12000, tipo_contratto: 'nero' });
    expect(f.netto_annuo).toBe(12000);
    expect(f.contributi_lavoratore).toBe(0);
    expect(f.contributi_datore).toBe(0);
    expect(f.tfr).toBe(0);
  });

  it('il forfettario startup paga il 5% e non ha addizionali', () => {
    const f = calcolaFisco({
      ...base,
      lordo_annuo: 30000,
      tipo_contratto: 'forfettario',
      forfettario_startup: true
    });
    expect(f.addizionale_regionale).toBe(0);
    const imponibile = 30000 * 0.78 - f.contributi_lavoratore;
    expect(f.irpef_netta).toBeCloseTo(imponibile * 0.05, 2);
  });

  it('la partita IVA in gestione separata non ha la detrazione da lavoro dipendente', () => {
    const f = calcolaFisco({ ...base, lordo_annuo: 25000, tipo_contratto: 'partiva' });
    expect(f.detrazione_lavoro).toBe(0);
    expect(f.somma_integrativa).toBe(0);
    const dip = calcolaFisco({ ...base, lordo_annuo: 25000, tipo_contratto: 'dipendente' });
    expect(f.netto_annuo).toBeLessThan(dip.netto_annuo);
  });

  it('regge gli input degeneri senza produrre NaN', () => {
    for (const lordo of [0, -5000]) {
      const f = calcolaFisco({ ...base, lordo_annuo: lordo, tipo_contratto: 'dipendente' });
      for (const v of Object.values(f)) expect(Number.isFinite(v as number)).toBe(true);
      expect(f.netto_annuo).toBeGreaterThanOrEqual(0);
    }
  });
});
