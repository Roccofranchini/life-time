import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, type Plugin } from 'vite';

const CARTELLA_FONT = 'src/lib/server/fonts';

/**
 * Modulo virtuale `font:<nome>` → stringa base64 del corrispondente .ttf.
 *
 * Serve alla route /api/og, che deve passare i byte dei font a Satori.
 * Le alternative non funzionano:
 *   · readFileSync da static/ → su Vercel la cartella static è servita dalla
 *     CDN e non finisce nella funzione serverless: ENOENT in produzione;
 *   · il suffisso ?inline di Vite → sotto la soglia di inlining emette un file
 *     separato e restituisce la sua URL, non un data URL;
 *   · un import relativo con suffisso → TypeScript applica le dichiarazioni
 *     wildcard solo agli specificatori NON relativi, quindi non tiparebbe.
 *
 * Con un identificatore virtuale i byte finiscono dentro il modulo — la
 * funzione non tocca mai il disco — e il tipo si dichiara in app.d.ts con
 * `declare module 'font:*'`. I .ttf restano file veri nel repository.
 */
function fontBase64(): Plugin {
  const PREFISSO = 'font:';
  const RISOLTO = '\0' + PREFISSO;
  return {
    name: 'tdv-font-base64',
    enforce: 'pre',
    resolveId(id) {
      return id.startsWith(PREFISSO) ? RISOLTO + id.slice(PREFISSO.length) : null;
    },
    async load(id) {
      if (!id.startsWith(RISOLTO)) return null;
      const nome = id.slice(RISOLTO.length);
      // Nessun percorso arbitrario: solo un nome di file dentro la cartella font.
      if (!/^[a-z0-9-]+$/i.test(nome)) {
        this.error(`nome di font non valido: ${nome}`);
      }
      const file = path.resolve(process.cwd(), CARTELLA_FONT, `${nome}.ttf`);
      const buf = await readFile(file);
      return `export default ${JSON.stringify(buf.toString('base64'))};`;
    }
  };
}

export default defineConfig({
  plugins: [fontBase64(), sveltekit()],
  test: {
    include: ['tests/**/*.{test,spec}.{js,ts}'],
    environment: 'node'
  }
});
