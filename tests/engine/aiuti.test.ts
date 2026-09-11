// tests/engine/aiuti.test.ts
import { describe, it, expect } from 'vitest';
import { valutaAiuti } from '../../src/lib/engine/aiuti';
import type { SituazionePersonale } from '../../src/lib/types';

const nessuna: SituazionePersonale = { in_affitto: false, under31: false, con_figli: false };
const inquilinoGiovane: SituazionePersonale = { in_affitto: true, under31: true, con_figli: false };

describe('Aiuti concreti', () => {
  it('propone sempre l’ISEE: è la chiave di tutto il resto', () => {
    const r = valutaAiuti({ reddito_complessivo: 40000, tipo_contratto: 'dipendente', situazione: nessuna });
    expect(r.map((v) => v.id)).toContain('isee');
  });

  it('a un inquilino under 31 sotto soglia propone la detrazione da 2.000 €', () => {
    const r = valutaAiuti({ reddito_complessivo: 14000, tipo_contratto: 'dipendente', situazione: inquilinoGiovane });
    const v = r.find((x) => x.id === 'detrazione-affitto-giovani');
    expect(v).toBeDefined();
    expect(v!.esito).toBe('certo');
  });

  it('non cumula la detrazione under 31 con quella ordinaria', () => {
    const r = valutaAiuti({ reddito_complessivo: 14000, tipo_contratto: 'dipendente', situazione: inquilinoGiovane });
    expect(r.map((v) => v.id)).toContain('detrazione-affitto-giovani');
    expect(r.map((v) => v.id)).not.toContain('detrazione-affitto-abitazione');
  });

  it('a un inquilino over 30 propone quella ordinaria', () => {
    const r = valutaAiuti({
      reddito_complessivo: 20000,
      tipo_contratto: 'dipendente',
      situazione: { in_affitto: true, under31: false, con_figli: false }
    });
    expect(r.map((v) => v.id)).toContain('detrazione-affitto-abitazione');
    expect(r.map((v) => v.id)).not.toContain('detrazione-affitto-giovani');
  });

  it('non propone misure sull’affitto a chi non è in affitto', () => {
    const r = valutaAiuti({ reddito_complessivo: 12000, tipo_contratto: 'dipendente', situazione: nessuna });
    for (const id of ['detrazione-affitto-giovani', 'detrazione-affitto-abitazione', 'canone-concordato']) {
      expect(r.map((v) => v.id)).not.toContain(id);
    }
  });

  it('marca come «probabile», mai «certo», ciò che dipende dall’ISEE', () => {
    const r = valutaAiuti({ reddito_complessivo: 13000, tipo_contratto: 'dipendente', situazione: nessuna });
    for (const v of r) {
      if (v.condizioni.richiede_isee) expect(v.esito).toBe('probabile');
    }
    expect(r.find((v) => v.id === 'bonus-sociale-bollette')!.esito).toBe('probabile');
  });

  it('a chi lavora in nero propone la vertenza, non l’inquadramento', () => {
    const r = valutaAiuti({ reddito_complessivo: 12000, tipo_contratto: 'nero', situazione: nessuna });
    const ids = r.map((v) => v.id);
    expect(ids).toContain('vertenza-nero');
    expect(ids).not.toContain('vertenza-inquadramento');
    expect(ids).not.toContain('naspi');
  });

  it('a un reddito alto restano poche voci, ma mai zero', () => {
    const r = valutaAiuti({ reddito_complessivo: 80000, tipo_contratto: 'dipendente', situazione: nessuna });
    expect(r.length).toBeGreaterThan(0);
    expect(r.map((v) => v.id)).not.toContain('assegno-inclusione');
    expect(r.map((v) => v.id)).not.toContain('carta-dedicata-a-te');
  });

  it('l’assegno unico compare solo con figli a carico', () => {
    const senza = valutaAiuti({ reddito_complessivo: 25000, tipo_contratto: 'dipendente', situazione: nessuna });
    const con = valutaAiuti({
      reddito_complessivo: 25000,
      tipo_contratto: 'dipendente',
      situazione: { in_affitto: false, under31: false, con_figli: true }
    });
    expect(senza.map((v) => v.id)).not.toContain('assegno-unico');
    expect(con.map((v) => v.id)).toContain('assegno-unico');
  });

  it('è ordinato per priorità e ogni voce ha fonte e link', () => {
    const r = valutaAiuti({ reddito_complessivo: 13000, tipo_contratto: 'dipendente', situazione: inquilinoGiovane });
    for (let i = 1; i < r.length; i++) expect(r[i].priorita).toBeGreaterThanOrEqual(r[i - 1].priorita);
    for (const v of r) {
      expect(v.fonte.length).toBeGreaterThan(5);
      expect(v.url).toMatch(/^https:\/\//);
      expect(v.come.length).toBeGreaterThan(10);
    }
  });
});
