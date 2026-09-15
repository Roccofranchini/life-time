// tests/engine/sopravvivenza.test.ts
import { describe, it, expect } from 'vitest';
import {
  calcolaSopravvivenza,
  canoneMensile,
  eurMqPeriferia,
  sogliaIstat
} from '../../src/lib/engine/sopravvivenza';
import tempo from '../../src/lib/data/tempo.json';
import provinceData from '../../src/lib/data/province.json';
import type { AlloggioId, ProvinciaEntry } from '../../src/lib/types';

const PROVINCE = provinceData.province as ProvinciaEntry[];
const trova = (c: string) => PROVINCE.find((p) => p.codice === c)!;

const MI = trova('MI');
const EN = trova('EN');
const BO = trova('BO');

// Contesto internamente coerente: il salario orario reale è (netto − costi del
// lavoro) / ore sottratte, esattamente come lo produce calcolaTempo.
const ctx = {
  netto_mensile: 1450,
  costi_del_lavoro: 176,
  ore_sottratte: 195,
  salario_orario_reale: (1450 - 176) / 195
};

describe('Canone derivato, non scritto a mano', () => {
  it('canone = €/m² di periferia × superficie / persone che se lo dividono', () => {
    expect(canoneMensile(MI, 'bilocale')).toBeCloseTo(eurMqPeriferia(MI) * 55, 6);
    expect(canoneMensile(MI, 'stanza')).toBeCloseTo((eurMqPeriferia(MI) * 85) / 3, 6);
  });

  it('la periferia è la media di mercato scontata del coefficiente dichiarato', () => {
    const c = tempo.alloggi.coefficiente_periferia;
    expect(c).toBeGreaterThan(0.5);
    expect(c).toBeLessThan(1);
    expect(eurMqPeriferia(MI)).toBeCloseTo(MI.eur_mq_medio * c, 6);
    // la periferia costa sempre meno della media che comprende il centro
    for (const p of PROVINCE) expect(eurMqPeriferia(p)).toBeLessThan(p.eur_mq_medio);
  });

  it('gli ancoraggi rilevati portano i valori pubblicati, non stime', () => {
    // idealista II trim. 2026: Milano 23,3 · Roma 19,8 · Bologna 17,5
    expect(MI.eur_mq_medio).toBe(23.3);
    expect(trova('RM').eur_mq_medio).toBe(19.8);
    expect(BO.eur_mq_medio).toBe(17.5);
    for (const cod of ['MI', 'RM', 'BO', 'FI', 'TO', 'PA']) {
      expect(trova(cod).fonte_dato).toBe('rilevato_capoluogo');
    }
  });

  it('ogni provincia dichiara se il canone è rilevato o stimato', () => {
    const ammessi = ['rilevato_capoluogo', 'rilevato_provincia', 'calibrato'];
    for (const p of PROVINCE) {
      expect(ammessi).toContain(p.fonte_dato);
      expect(p.rilevazione.length).toBeGreaterThan(5);
    }
    const rilevati = PROVINCE.filter((p) => p.fonte_dato !== 'calibrato');
    expect(rilevati.length).toBeGreaterThanOrEqual(19);
  });

  it('una stanza condivisa costa molto meno di un bilocale da soli', () => {
    expect(canoneMensile(MI, 'stanza')).toBeLessThan(canoneMensile(MI, 'bilocale') * 0.7);
  });

  it('Milano costa più di Enna, in ogni tipo di alloggio', () => {
    for (const a of ['stanza', 'monolocale', 'bilocale', 'coppia'] as AlloggioId[]) {
      expect(canoneMensile(MI, a)).toBeGreaterThan(canoneMensile(EN, a));
    }
  });

  it('tutte le 107 province hanno €/m², area e tipo comune', () => {
    expect(PROVINCE).toHaveLength(107);
    for (const p of PROVINCE) {
      expect(p.eur_mq_medio).toBeGreaterThan(0);
      expect(['nord', 'centro', 'mezzogiorno']).toContain(p.area);
      expect(['metropoli', 'grande', 'piccolo']).toContain(p.tipo_comune);
    }
  });
});

describe('Soglia di povertà assoluta ISTAT', () => {
  it('è più alta al Nord e nelle aree metropolitane', () => {
    expect(sogliaIstat(MI)).toBeGreaterThan(sogliaIstat(EN));
    expect(sogliaIstat(MI)).toBe(917);
    expect(sogliaIstat(trova('PA'))).toBe(760);
  });

  it('resta nell’intervallo dei valori pubblicati per un adulto solo', () => {
    for (const p of PROVINCE) {
      const s = sogliaIstat(p);
      expect(s).toBeGreaterThanOrEqual(690);
      expect(s).toBeLessThanOrEqual(940);
    }
  });
});

describe('Costi fissi e ore di sopravvivenza', () => {
  it('costi fissi = canone + parte non abitativa del paniere ISTAT', () => {
    const s = calcolaSopravvivenza({ provincia: BO, alloggio: 'bilocale', ...ctx });
    expect(s.costi_fissi).toBeCloseTo(s.affitto + s.paniere_essenziale, 6);
    expect(s.paniere_essenziale).toBeCloseTo(s.soglia_istat * 0.62, 6);
  });

  it('le ore si contano al salario orario reale', () => {
    const s = calcolaSopravvivenza({ provincia: BO, alloggio: 'bilocale', ...ctx });
    expect(s.ore_sopravvivenza).toBeCloseTo(s.costi_fissi / ctx.salario_orario_reale, 6);
  });

  it('euro e ore raccontano la stessa cosa: il metro è il netto disponibile', () => {
    const s = calcolaSopravvivenza({ provincia: BO, alloggio: 'bilocale', ...ctx });
    expect(s.netto_disponibile).toBeCloseTo(ctx.netto_mensile - ctx.costi_del_lavoro, 6);
    // in rosso in euro ⟺ oltre le ore disponibili
    expect(s.in_rosso).toBe(s.quota_ore > 1);
    expect(s.quota_netto).toBeCloseTo(s.quota_ore, 6);
  });

  it('a Milano da soli in bilocale col netto medio si va in rosso', () => {
    const s = calcolaSopravvivenza({ provincia: MI, alloggio: 'bilocale', ...ctx });
    expect(s.in_rosso).toBe(true);
    expect(s.residuo).toBeLessThan(0);
    expect(s.quota_netto).toBeGreaterThan(1);
  });

  it('condividere una casa a Milano può riportare in nero lo stesso stipendio', () => {
    const solo = calcolaSopravvivenza({ provincia: MI, alloggio: 'bilocale', ...ctx });
    const condiviso = calcolaSopravvivenza({ provincia: MI, alloggio: 'stanza', ...ctx });
    expect(condiviso.costi_fissi).toBeLessThan(solo.costi_fissi);
    expect(condiviso.in_rosso).toBe(false);
  });

  it('segnala quando il netto sta sotto la soglia di povertà assoluta', () => {
    const povero = calcolaSopravvivenza({
      provincia: MI,
      alloggio: 'stanza',
      ...ctx,
      netto_mensile: 800
    });
    expect(povero.sotto_soglia_istat).toBe(true);
    const no = calcolaSopravvivenza({ provincia: MI, alloggio: 'stanza', ...ctx });
    expect(no.sotto_soglia_istat).toBe(false);
  });

  it('i giorni per l’affitto stanno fra 0 e i giorni del mese', () => {
    for (const p of [MI, BO, EN]) {
      const s = calcolaSopravvivenza({ provincia: p, alloggio: 'bilocale', ...ctx });
      expect(s.giorni_affitto).toBeGreaterThanOrEqual(0);
      expect(s.giorni_affitto).toBeLessThanOrEqual(31);
    }
  });

  it('non produce NaN con netto o salario nulli', () => {
    const s = calcolaSopravvivenza({
      provincia: BO,
      alloggio: 'bilocale',
      netto_mensile: 0,
      costi_del_lavoro: 0,
      salario_orario_reale: 0,
      ore_sottratte: 0
    });
    for (const v of Object.values(s)) {
      if (typeof v === 'number') expect(Number.isFinite(v)).toBe(true);
    }
  });
});
