// tests/engine/integrazione.test.ts
// Casi reali, dal profilo al risultato completo.
import { describe, it, expect } from 'vitest';
import { calcola } from '../../src/lib/engine';
import provinceData from '../../src/lib/data/province.json';
import ccnlData from '../../src/lib/data/ccnl.json';
import type { CcnlSettore, Ingresso, ProvinciaEntry } from '../../src/lib/types';

const PROVINCE = provinceData.province as ProvinciaEntry[];
const SETTORI = ccnlData.settori as unknown as CcnlSettore[];
const trova = (c: string) => PROVINCE.find((p) => p.codice === c)!;

function lordoAnnuo(settoreId: string, livello: string): number {
  const s = SETTORI.find((x) => x.id === settoreId)!;
  const l = s.livelli.find((x) => x.livello === livello)!;
  return Math.round((l.minimo_tabellare + l.contingenza + l.edr) * s.mensilita);
}

const ingressoBase: Omit<Ingresso, 'lordo_annuo' | 'settore_id' | 'provincia' | 'regione' | 'mensilita'> = {
  tipo_contratto: 'dipendente',
  ore_settimanali: 40,
  minuti_pendolarismo: 60,
  ore_straordinario_non_pagato: 0,
  profilo_cura: 'media',
  alloggio: 'bilocale',
  usa_auto: false,
  pasti_fuori_settimana: 5
};

describe('Casi reali', () => {
  it('commessa IV livello a Milano, bilocale da sola: le ore non bastano', () => {
    const p = trova('MI');
    const r = calcola(
      { ...ingressoBase, mensilita: 14, lordo_annuo: lordoAnnuo('commercio', '4'), settore_id: 'commercio', provincia: p.codice, regione: p.regione },
      p
    );
    // in busta legge ~1.475 €; il reddito medio mensile, con 13ª e 14ª spalmate, è ~1.720 €
    expect(r.fisco.netto_in_busta).toBeGreaterThan(1400);
    expect(r.fisco.netto_in_busta).toBeLessThan(1550);
    expect(r.fisco.netto_mensile).toBeGreaterThan(r.fisco.netto_in_busta);
    // i costi fissi superano il netto disponibile: servirebbero più ore di quante ne abbia
    expect(r.sopravvivenza.in_rosso).toBe(true);
    expect(r.sopravvivenza.quota_ore).toBeGreaterThan(1);
    expect(r.sopravvivenza.ore_sopravvivenza).toBeGreaterThan(r.tempo.ore_sottratte);
  });

  it('la stessa commessa in stanza condivisa a Milano torna in nero', () => {
    const p = trova('MI');
    const solo = calcola(
      { ...ingressoBase, mensilita: 14, lordo_annuo: lordoAnnuo('commercio', '4'), settore_id: 'commercio', provincia: p.codice, regione: p.regione },
      p
    );
    const condiviso = calcola(
      { ...ingressoBase, mensilita: 14, alloggio: 'stanza', lordo_annuo: lordoAnnuo('commercio', '4'), settore_id: 'commercio', provincia: p.codice, regione: p.regione },
      p
    );
    expect(condiviso.sopravvivenza.in_rosso).toBe(false);
    expect(condiviso.sopravvivenza.residuo).toBeGreaterThan(0);
    // dividere la casa vale più di 400 € al mese: è la variabile che decide tutto
    expect(condiviso.sopravvivenza.residuo - solo.sopravvivenza.residuo).toBeGreaterThan(400);
  });

  it('operaio metalmeccanico D1 a Brescia: il profitto pesa più delle imposte', () => {
    const p = trova('BS');
    const r = calcola(
      { ...ingressoBase, mensilita: 13, lordo_annuo: lordoAnnuo('metalmeccanici', 'D1'), settore_id: 'metalmeccanici', provincia: p.codice, regione: p.regione },
      p
    );
    expect(r.valore.profitto.ore).toBeGreaterThan(r.valore.imposte.ore);
    expect(r.valore.profitto.ore + r.valore.previdenza.ore + r.valore.imposte.ore + r.valore.netto.ore)
      .toBeCloseTo(r.tempo.ore_retribuite, 6);
  });

  it('dottorando a Bologna: nessun prelievo, ma la borsa non copre un bilocale', () => {
    const p = trova('BO');
    const r = calcola(
      { ...ingressoBase, mensilita: 12, tipo_contratto: 'dottorato', lordo_annuo: 1354 * 12, settore_id: 'dottorato', provincia: p.codice, regione: p.regione },
      p
    );
    expect(r.fisco.netto_mensile).toBeCloseTo(1354, 2);
    expect(r.sopravvivenza.in_rosso).toBe(true);
  });

  it('impiegato pubblico a Roma: zero profitto, tutto il resto quadra comunque', () => {
    const p = trova('RM');
    const r = calcola(
      { ...ingressoBase, mensilita: 13, lordo_annuo: lordoAnnuo('pubblica-amministrazione', 'ASS'), settore_id: 'pubblica-amministrazione', provincia: p.codice, regione: p.regione },
      p
    );
    expect(r.valore.profitto.euro).toBeCloseTo(0, 6);
    expect(
      r.valore.previdenza.frazione + r.valore.imposte.frazione + r.valore.netto.frazione
    ).toBeCloseTo(1, 9);
  });

  it('cameriere a nero a Napoli: nessuna previdenza, margine massimo', () => {
    const p = trova('NA');
    const r = calcola(
      { ...ingressoBase, mensilita: 12, tipo_contratto: 'nero', lordo_annuo: 1100 * 12, settore_id: 'nero', provincia: p.codice, regione: p.regione },
      p
    );
    expect(r.fisco.netto_mensile).toBeCloseTo(1100, 2);
    expect(r.valore.previdenza.euro).toBe(0);
    expect(r.valore.profitto.frazione).toBeGreaterThan(0.35);
  });

  it('ogni combinazione di provincia e settore produce numeri finiti', () => {
    for (const p of PROVINCE) {
      for (const s of SETTORI) {
        const l = s.livelli[s.livelli.length - 1];
        const r = calcola(
          {
            ...ingressoBase,
            mensilita: s.mensilita,
            tipo_contratto: s.id === 'dottorato' ? 'dottorato' : 'dipendente',
            lordo_annuo: Math.round((l.minimo_tabellare + l.contingenza + l.edr) * s.mensilita),
            settore_id: s.id,
            provincia: p.codice,
            regione: p.regione
          },
          p
        );
        for (const blocco of [r.fisco, r.tempo, r.sopravvivenza]) {
          for (const [k, v] of Object.entries(blocco)) {
            if (typeof v === 'number' && !Number.isFinite(v)) {
              throw new Error(`${p.codice}/${s.id}: ${k} non finito`);
            }
          }
        }
        const somma =
          r.valore.profitto.frazione + r.valore.previdenza.frazione +
          r.valore.imposte.frazione + r.valore.netto.frazione;
        expect(somma).toBeCloseTo(1, 8);
      }
    }
  });
});
