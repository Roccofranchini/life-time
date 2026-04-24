import { describe, it, expect } from 'vitest';
import { calcola_sopravvivenza } from '../../src/lib/engine/survival';

describe('calcola_sopravvivenza', () => {
  it('somma i costi fissi e calcola le ore di lavoro necessarie', () => {
    const out = calcola_sopravvivenza({
      affitto: 700,
      spesa_minima: 300,
      bollette: 150,
      carburante_mensile_stimato: 100,
      netto_mensile: 1600,
      ore_lavoro_mensili: 173
    });

    // Totale costi: 700 + 300 + 150 + 100 = 1250
    expect(out.costo_sopravvivenza_totale).toBe(1250);

    // Valore orario: 1600 / 173 ≈ 9,248 €/h
    // Ore necessarie: 1250 / 9,248 ≈ 135,15h
    const valoreOrario = 1600 / 173;
    expect(out.ore_sopravvivenza).toBeCloseTo(1250 / valoreOrario, 2);

    // Percentuale del netto: 1250 / 1600 = 0,78125
    expect(out.percentuale_netto).toBeCloseTo(0.78125, 4);

    // Percentuale delle ore di lavoro: ore_sopravvivenza / ore_lavoro
    expect(out.percentuale_ore_lavoro).toBeCloseTo(out.ore_sopravvivenza / 173, 4);
  });

  it('coerenza matematica: percentuale_netto × netto = costo totale', () => {
    const input = {
      affitto: 1200,
      spesa_minima: 400,
      bollette: 200,
      carburante_mensile_stimato: 120,
      netto_mensile: 2100,
      ore_lavoro_mensili: 173
    };
    const out = calcola_sopravvivenza(input);

    expect(out.percentuale_netto * input.netto_mensile).toBeCloseTo(
      out.costo_sopravvivenza_totale,
      2
    );
  });

  it('caso degenere: netto_mensile = 0 → ritorna 0 senza divisioni per zero', () => {
    const out = calcola_sopravvivenza({
      affitto: 700,
      spesa_minima: 300,
      bollette: 150,
      carburante_mensile_stimato: 0,
      netto_mensile: 0,
      ore_lavoro_mensili: 173
    });

    expect(out.ore_sopravvivenza).toBe(0);
    expect(out.percentuale_netto).toBe(0);
    expect(out.percentuale_ore_lavoro).toBe(0);
    expect(out.costo_sopravvivenza_totale).toBe(1150);
    expect(Number.isFinite(out.ore_sopravvivenza)).toBe(true);
  });

  it('scenario "emergenza abitativa": affitto > netto', () => {
    const out = calcola_sopravvivenza({
      affitto: 1800,
      spesa_minima: 300,
      bollette: 150,
      carburante_mensile_stimato: 0,
      netto_mensile: 1400,
      ore_lavoro_mensili: 173
    });

    // percentuale_netto > 1 è il segnale politico che lo stipendio non basta
    expect(out.percentuale_netto).toBeGreaterThan(1);
    expect(out.percentuale_ore_lavoro).toBeGreaterThan(1);
  });
});
