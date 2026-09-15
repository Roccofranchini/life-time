// tests/engine/font.test.ts
// Regressione: i font dell'immagine social devono stare DENTRO il bundle.
//
// Prima venivano letti da static/ con readFileSync. In locale funzionava, in
// produzione no: su Vercel static/ è servita dalla CDN e non esiste dentro la
// funzione serverless, quindi /api/og rispondeva 500 con ENOENT — e il guasto
// era invisibile perché nessun test toccava quel percorso e la pagina
// funzionava lo stesso.
//
// Questo test gira attraverso Vite, quindi esercita lo stesso plugin che usa
// la build: se i byte smettono di finire nel bundle, fallisce qui.
import { describe, it, expect } from 'vitest';
import fontRegular64 from 'font:ibm-plex-mono-400';
import fontBold64 from 'font:ibm-plex-mono-700';

describe('Font dell’immagine social', () => {
  it('arrivano come base64, non come percorso o URL', () => {
    for (const f of [fontRegular64, fontBold64]) {
      expect(typeof f).toBe('string');
      expect(f.length).toBeGreaterThan(10000);
      // L'alfabeto base64 comprende anche '/', quindi quel carattere non può
      // fare da spia di un percorso: è il resto dell'alfabeto a distinguerli.
      expect(f).toMatch(/^[A-Za-z0-9+/=]+$/);
      // una URL o un percorso conterrebbero questi
      expect(f).not.toContain('.ttf');
      expect(f).not.toContain('_app');
      expect(f.startsWith('/')).toBe(false);
    }
  });

  it('decodificano in TrueType validi', () => {
    for (const f of [fontRegular64, fontBold64]) {
      const buf = Buffer.from(f, 'base64');
      expect(buf.length).toBeGreaterThan(50000);
      // firma TrueType: 0x00010000
      expect(buf.readUInt32BE(0)).toBe(0x00010000);
    }
  });

  it('i due pesi sono file diversi', () => {
    expect(fontRegular64).not.toBe(fontBold64);
  });
});
