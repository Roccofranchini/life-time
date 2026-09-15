// src/routes/api/og/+server.ts
// Immagine 1200×630 per l'anteprima social di un link condiviso.
//
// Legge gli stessi parametri della pagina, rifà lo stesso calcolo con lo stesso
// motore — quindi l'anteprima non può divergere dal risultato — e disegna una
// card con il numero che conta: le ore di vita che se ne vanno in costi fissi.
//
// Satori (SVG) → resvg (PNG). Nessuna chiamata esterna, nessun dato personale:
// i parametri sono scelte, non risultati.

import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import type { RequestHandler } from './$types';
import { calcola } from '$lib/engine';
import { queryInStato, risolviIngresso, trovaSettore } from '$lib/stato';

// I font arrivano dal bundle, non dal filesystem: su Vercel la cartella static/
// è servita dalla CDN e non esiste dentro la funzione serverless. Il plugin
// `tdv-font-base64` in vite.config.ts li incorpora come stringa base64.
import fontRegular64 from 'font:ibm-plex-mono-400';
import fontBold64 from 'font:ibm-plex-mono-700';

const fontRegular = Buffer.from(fontRegular64, 'base64');
const fontBold = Buffer.from(fontBold64, 'base64');

const W = 1200;
const H = 630;

// Colori espliciti: Satori non risolve le custom property CSS.
const BG = '#0a0a08';
const INK = '#f0ede6';
const INK2 = '#a09e96';
const INK3 = '#5a5850';
const ROSSO = '#c8291e';
const PALETTE = ['#d93b2b', '#4a90c2', '#b07d15', '#22a97d'];

/** Satori vuole display:flex su ogni contenitore: questo helper lo garantisce. */
function box(style: Record<string, unknown>, children: unknown[] = []) {
  return { type: 'div', props: { style: { display: 'flex', ...style }, children } };
}

function testo(t: string, style: Record<string, unknown>) {
  return { type: 'div', props: { style: { display: 'flex', ...style }, children: t } };
}

export const GET: RequestHandler = async ({ url, setHeaders }) => {
  const stato = queryInStato(url.searchParams);
  const risolto = risolviIngresso(stato);

  if (!risolto) return new Response('Parametri non validi', { status: 400 });

  const r = calcola(risolto.ingresso, risolto.provincia);
  const settore = trovaSettore(stato.settore_id);

  const ore = Math.round(r.sopravvivenza.ore_sopravvivenza);
  const orario = r.tempo.salario_orario_reale.toFixed(2);
  const libere = Math.round(r.tempo.ore_libere);

  // Le quattro destinazioni del valore prodotto, come barra impilata.
  const quote = [
    r.valore.profitto.frazione,
    r.valore.previdenza.frazione,
    Math.max(0, r.valore.imposte.frazione),
    r.valore.netto.frazione
  ];
  const somma = quote.reduce((a, b) => a + b, 0) || 1;

  const element = box(
    {
      flexDirection: 'column',
      width: W,
      height: H,
      background: BG,
      padding: '56px 64px 48px',
      fontFamily: 'IBM Plex Mono',
      color: INK,
      position: 'relative'
    },
    [
      box({ position: 'absolute', left: 0, top: 0, width: 5, height: H, background: ROSSO }),

      // occhiello
      box({ alignItems: 'center', marginBottom: 34 }, [
        testo('TEMPO DI VITA', {
          fontSize: 17,
          letterSpacing: 4,
          color: ROSSO,
          fontWeight: 700
        }),
        testo(`· ${risolto.provincia.nome.toUpperCase()}`, {
          fontSize: 17,
          letterSpacing: 3,
          color: INK3,
          marginLeft: 14
        })
      ]),

      // il numero
      box({ alignItems: 'flex-end', marginBottom: 6 }, [
        testo(String(ore), { fontSize: 150, fontWeight: 700, lineHeight: 1, color: INK }),
        testo('ore', { fontSize: 52, fontWeight: 700, color: ROSSO, marginLeft: 18, marginBottom: 14 })
      ]),
      testo('di vita, ogni mese, solo per pagare il minimo indispensabile', {
        fontSize: 28,
        color: INK2,
        marginBottom: 40
      }),

      // barra delle quattro destinazioni
      box({ width: W - 128, height: 20, marginBottom: 16 },
        quote.map((q, i) =>
          box({
            width: Math.max(2, (q / somma) * (W - 128) - 3),
            height: 20,
            background: PALETTE[i],
            marginRight: 3,
            borderRadius: i === 0 ? '4px 0 0 4px' : i === 3 ? '0 4px 4px 0' : 0
          })
        )
      ),
      box({ marginBottom: 42 }, [
        testo('profitto · previdenza · imposte · a te', { fontSize: 18, color: INK3 })
      ]),

      // piede
      box({ marginTop: 'auto', alignItems: 'flex-end', justifyContent: 'space-between', width: W - 128 }, [
        box({ flexDirection: 'column' }, [
          testo(`${orario} € l'ora, davvero`, { fontSize: 26, color: INK, marginBottom: 8 }),
          testo(`${libere} ore libere al mese · ${settore?.nome ?? ''}`, {
            fontSize: 18,
            color: INK3
          })
        ]),
        testo('tempodivita · dati pubblici · ±3%', { fontSize: 17, color: INK3 })
      ])
    ]
  );

  const svg = await satori(element as never, {
    width: W,
    height: H,
    fonts: [
      { name: 'IBM Plex Mono', data: fontRegular, weight: 400, style: 'normal' },
      { name: 'IBM Plex Mono', data: fontBold, weight: 700, style: 'normal' }
    ]
  });

  const png = new Resvg(svg, { fitTo: { mode: 'width', value: W } }).render().asPng();

  setHeaders({
    'content-type': 'image/png',
    'cache-control': 'public, max-age=3600, s-maxage=86400, immutable'
  });

  return new Response(new Uint8Array(png));
};
