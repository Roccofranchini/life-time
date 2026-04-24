import { describe, it, expect } from 'vitest';
import {
  calcola_breakdown_temporale,
  ORE_TOTALI_MESE,
  ORE_SONNO_MESE,
  ORE_VITA_BIOLOGICA_MESE
} from '../../src/lib/engine/time';
import { calcola_netto } from '../../src/lib/engine/fiscal';
import { calcola_sopravvivenza } from '../../src/lib/engine/survival';

describe('calcola_breakdown_temporale', () => {
  const fiscal = calcola_netto({
    lordo_annuo: 25_000,
    tipo_contratto: 'indeterminato',
    regione: 'emilia-romagna',
    comune: 'bologna'
  });
  const survival = calcola_sopravvivenza({
    affitto: 700,
    spesa_minima: 300,
    bollette: 150,
    carburante_mensile_stimato: 80,
    netto_mensile: fiscal.netto_mensile,
    ore_lavoro_mensili: 173
  });

  it('costanti strutturali: 730 ore/mese, 240 ore di sonno, 180 ore di vita biologica', () => {
    const out = calcola_breakdown_temporale({
      survival,
      fiscal,
      lordo_annuo: 25_000,
      ore_lavoro_mensili: 173,
      settore_id: 'commercio',
      affitto: 700
    });

    expect(out.ore_totali_mese).toBe(ORE_TOTALI_MESE);
    expect(out.ore_sonno).toBe(ORE_SONNO_MESE);
    expect(out.ore_vita_biologica).toBe(ORE_VITA_BIOLOGICA_MESE);
    expect(out.ore_totali_mese).toBe(730);
    expect(out.ore_sonno).toBe(240);
    expect(out.ore_vita_biologica).toBe(180);
  });

  it('ore_libere (legacy) = 730 − 240 − ore_lavoro', () => {
    const out = calcola_breakdown_temporale({
      survival,
      fiscal,
      lordo_annuo: 25_000,
      ore_lavoro_mensili: 173,
      settore_id: 'commercio',
      affitto: 700
    });

    expect(out.ore_libere).toBe(730 - 240 - 173);
  });

  it('ore_libero_reale = 730 − sonno − lavoro − vita biologica (modello onesto)', () => {
    const out = calcola_breakdown_temporale({
      survival,
      fiscal,
      lordo_annuo: 25_000,
      ore_lavoro_mensili: 173,
      settore_id: 'commercio',
      affitto: 700
    });

    expect(out.ore_libero_reale).toBe(730 - 240 - 173 - 180);
    // deve essere strettamente minore del "libero" legacy:
    expect(out.ore_libero_reale).toBeLessThan(out.ore_libere);
  });

  it('ore_libero_reale non va mai sotto zero (es. lavoro estremo)', () => {
    const out = calcola_breakdown_temporale({
      survival,
      fiscal,
      lordo_annuo: 25_000,
      ore_lavoro_mensili: 400, // caso assurdo: assorbirebbe più del residuo
      settore_id: 'commercio',
      affitto: 700
    });

    expect(out.ore_libero_reale).toBeGreaterThanOrEqual(0);
  });

  it('ore_capitale = MOL/VA settoriale × ore_lavoro (fonte: ISTAT SBS 2023)', () => {
    // Con profit share ISTAT: commercio G47=0,30 ; metalmeccanici C24-28=0,38
    // → metalmeccanici > commercio (industria più capital-intensive)
    const commercio = calcola_breakdown_temporale({
      survival,
      fiscal,
      lordo_annuo: 25_000,
      ore_lavoro_mensili: 173,
      settore_id: 'commercio',
      affitto: 700
    });
    const meccanici = calcola_breakdown_temporale({
      survival,
      fiscal,
      lordo_annuo: 25_000,
      ore_lavoro_mensili: 173,
      settore_id: 'metalmeccanici',
      affitto: 700
    });

    expect(meccanici.ore_capitale).toBeGreaterThan(commercio.ore_capitale);
    expect(commercio.ore_capitale).toBeCloseTo(0.30 * 173, 2);
    expect(meccanici.ore_capitale).toBeCloseTo(0.38 * 173, 2);
  });

  it('settore sconosciuto → usa default 0,32 (media servizi non finanziari)', () => {
    const out = calcola_breakdown_temporale({
      survival,
      fiscal,
      lordo_annuo: 25_000,
      ore_lavoro_mensili: 173,
      settore_id: 'settore-inesistente',
      affitto: 700
    });

    expect(out.ore_capitale).toBeCloseTo(0.32 * 173, 2);
  });

  it('ristorazione (labor-intensive) ha la quota capitale più bassa dei 4 settori core', () => {
    const s = ['commercio', 'metalmeccanici', 'logistica', 'ristorazione'].map((id) =>
      calcola_breakdown_temporale({
        survival,
        fiscal,
        lordo_annuo: 25_000,
        ore_lavoro_mensili: 173,
        settore_id: id,
        affitto: 700
      })
    );
    const ristorazione = s[3];
    s.slice(0, 3).forEach((altro) => {
      expect(ristorazione.ore_capitale).toBeLessThan(altro.ore_capitale);
    });
  });

  it('giorni_affitto intero positivo, proporzionale al ratio affitto/netto', () => {
    // netto ~1620, affitto 700: 700/1620 × 30 ≈ 13
    const out = calcola_breakdown_temporale({
      survival,
      fiscal,
      lordo_annuo: 25_000,
      ore_lavoro_mensili: 173,
      settore_id: 'commercio',
      affitto: 700
    });

    expect(Number.isInteger(out.giorni_affitto)).toBe(true);
    expect(out.giorni_affitto).toBeGreaterThan(0);
    expect(out.giorni_affitto).toBeLessThan(30);
  });

  it('affitto molto alto → giorni_affitto cresce (segnalazione politica)', () => {
    const basso = calcola_breakdown_temporale({
      survival,
      fiscal,
      lordo_annuo: 25_000,
      ore_lavoro_mensili: 173,
      settore_id: 'commercio',
      affitto: 500
    });
    const alto = calcola_breakdown_temporale({
      survival,
      fiscal,
      lordo_annuo: 25_000,
      ore_lavoro_mensili: 173,
      settore_id: 'commercio',
      affitto: 1200
    });
    expect(alto.giorni_affitto).toBeGreaterThan(basso.giorni_affitto);
  });
});
