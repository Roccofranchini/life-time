// src/routes/api/og/+server.ts
// Genera un'immagine PNG 1200×630 per l'og:image del report condivisibile.
//
// Accetta gli stessi query params dell'URL share (?p=BO&s=commercio-4&c=indeterminato).
// Calcola il netto con l'engine fiscale (puro TS, no Supabase) e renderizza
// una card editoriale via Satori (SVG) → resvg-js (PNG).
//
// Cache: 1h pubblico — i dati sottostanti (aliquote CCNL) cambiano al massimo
// una volta l'anno. Supabase non è necessario: netto mensile e cuneo fiscale
// sono deterministici a parità di params.

import { readFileSync } from 'fs';
import { join } from 'path';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import type { RequestHandler } from './$types';
import { calcola_netto } from '$lib/engine/fiscal';
import ccnlData from '$lib/data/ccnl.json';
import provinceData from '$lib/data/province.json';
import type { CcnlData, TipoContratto } from '$lib/types';

// Font caricati a livello di modulo — una sola lettura per istanza server.
const fontRegular = readFileSync(join(process.cwd(), 'static/fonts/ibm-plex-mono-400.ttf'));
const fontBold = readFileSync(join(process.cwd(), 'static/fonts/ibm-plex-mono-700.ttf'));

const OG_W = 1200;
const OG_H = 630;

const TIPI_VALIDI: readonly TipoContratto[] = ['indeterminato', 'parttime', 'partiva', 'dottorato'];

interface ProvinciaEntry {
  codice: string;
  nome: string;
  regione: string;
  capoluogo: boolean;
}

function fmt(n: number): string {
  return n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
}

function labelContratto(c: TipoContratto): string {
  const map: Record<TipoContratto, string> = {
    indeterminato: 'Contratto indeterminato',
    parttime: 'Contratto part-time',
    partiva: 'Partita IVA — gest. separata',
    dottorato: 'Borsa di dottorato',
    nero: ''
  };
  return map[c] ?? c;
}

export const GET: RequestHandler = async ({ url, setHeaders }) => {
  // ─── Parsing params ───────────────────────────────────────────────
  const p = url.searchParams.get('p') ?? '';
  const s = url.searchParams.get('s') ?? '';
  const c = url.searchParams.get('c') ?? '';
  const pt = url.searchParams.get('pt');

  const matchS = /^([a-z-]+)-(.+)$/.exec(s);
  if (!p || !matchS || !TIPI_VALIDI.includes(c as TipoContratto)) {
    return new Response('Params non validi', { status: 400 });
  }

  const settoreId = matchS[1];
  const livelloStr = matchS[2];
  const tipoContratto = c as TipoContratto;

  const province = (provinceData as { province: ProvinciaEntry[] }).province;
  const provincia = province.find((x) => x.codice === p);
  const settori = (ccnlData as unknown as CcnlData).settori;
  const settore = settori.find((x) => x.id === settoreId);
  const livello = settore?.livelli.find((l) => l.livello === livelloStr);

  if (!provincia || !settore || !livello) {
    return new Response('Dati non trovati', { status: 404 });
  }

  // ─── Calcolo fiscale ──────────────────────────────────────────────
  const mensilita = settore.mensilita ?? 13;
  let lordoAnnuo = livello.lordo_mensile * mensilita;

  let percentualePt: number | undefined;
  if (tipoContratto === 'parttime' && pt) {
    const parsed = Number.parseInt(pt, 10);
    if (Number.isFinite(parsed) && parsed > 0 && parsed <= 100) {
      percentualePt = parsed / 100;
      lordoAnnuo = Math.round(lordoAnnuo * percentualePt);
    }
  }

  const fiscal = calcola_netto({
    lordo_annuo: lordoAnnuo,
    tipo_contratto: tipoContratto,
    regione: provincia.regione,
    comune: provincia.nome.toLowerCase(),
    ...(percentualePt !== undefined ? { percentuale_parttime: percentualePt } : {})
  });

  const cuneoPct = Math.round(fiscal.cuneo_fiscale_percentuale * 100);
  const nettoMensile = Math.round(fiscal.netto_mensile);

  // ─── Layout Satori ────────────────────────────────────────────────
  // Nota: Satori richiede display:flex su ogni container.
  // I colori sono hardcoded (no CSS vars) per garantire fedeltà nel render SVG.

  const barSegments = [
    { label: 'TASSE', pct: cuneoPct, color: '#5a5850' },
    { label: 'NETTO', pct: 100 - cuneoPct, color: '#c8291e' }
  ];

  const element = {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column' as const,
        width: OG_W,
        height: OG_H,
        background: '#0a0a08',
        padding: '56px 64px 48px',
        fontFamily: 'IBM Plex Mono',
        color: '#f0ede6',
        position: 'relative' as const
      },
      children: [
        // Accent bar sinistra
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              position: 'absolute' as const,
              left: 0,
              top: 0,
              width: 4,
              height: OG_H,
              background: '#c8291e'
            }
          }
        },

        // Header: app name + location
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 48
            },
            children: [
              {
                type: 'span',
                props: {
                  style: {
                    fontSize: 13,
                    letterSpacing: '0.22em',
                    color: '#c8291e',
                    fontWeight: 700,
                    textTransform: 'uppercase' as const
                  },
                  children: 'TEMPO DI VITA'
                }
              },
              {
                type: 'span',
                props: {
                  style: { fontSize: 11, letterSpacing: '0.14em', color: '#5a5850' },
                  children: `IT · ${new Date().getFullYear()}`
                }
              }
            ]
          }
        },

        // Città e regione
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              flexDirection: 'column' as const,
              marginBottom: 8
            },
            children: [
              {
                type: 'span',
                props: {
                  style: {
                    fontSize: 48,
                    fontWeight: 700,
                    color: '#f0ede6',
                    lineHeight: 1.05,
                    letterSpacing: '-0.01em'
                  },
                  children: provincia.nome.toUpperCase()
                }
              },
              {
                type: 'span',
                props: {
                  style: {
                    fontSize: 13,
                    color: '#5a5850',
                    letterSpacing: '0.1em',
                    marginTop: 6,
                    textTransform: 'uppercase' as const
                  },
                  children: `${provincia.regione.replace(/-/g, ' ')} · ${settore.nome} · ${labelContratto(tipoContratto)}`
                }
              }
            ]
          }
        },

        // Separatore
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              height: 1,
              background: 'rgba(240,237,230,0.08)',
              margin: '28px 0'
            }
          }
        },

        // Metriche principali
        {
          type: 'div',
          props: {
            style: { display: 'flex', gap: 64, marginBottom: 32 },
            children: [
              {
                type: 'div',
                props: {
                  style: { display: 'flex', flexDirection: 'column' as const },
                  children: [
                    {
                      type: 'span',
                      props: {
                        style: { fontSize: 38, fontWeight: 700, color: '#f0ede6', lineHeight: 1 },
                        children: fmt(nettoMensile)
                      }
                    },
                    {
                      type: 'span',
                      props: {
                        style: { fontSize: 10, color: '#5a5850', letterSpacing: '0.12em', marginTop: 8 },
                        children: 'NETTO MENSILE STIMATO'
                      }
                    }
                  ]
                }
              },
              {
                type: 'div',
                props: {
                  style: { display: 'flex', flexDirection: 'column' as const },
                  children: [
                    {
                      type: 'span',
                      props: {
                        style: { fontSize: 38, fontWeight: 700, color: '#f0ede6', lineHeight: 1 },
                        children: fmt(lordoAnnuo)
                      }
                    },
                    {
                      type: 'span',
                      props: {
                        style: { fontSize: 10, color: '#5a5850', letterSpacing: '0.12em', marginTop: 8 },
                        children: 'RAL (MINIMO TABELLARE)'
                      }
                    }
                  ]
                }
              },
              {
                type: 'div',
                props: {
                  style: { display: 'flex', flexDirection: 'column' as const },
                  children: [
                    {
                      type: 'span',
                      props: {
                        style: { fontSize: 38, fontWeight: 700, color: '#c8291e', lineHeight: 1 },
                        children: `${cuneoPct}%`
                      }
                    },
                    {
                      type: 'span',
                      props: {
                        style: { fontSize: 10, color: '#5a5850', letterSpacing: '0.12em', marginTop: 8 },
                        children: 'CUNEO FISCALE'
                      }
                    }
                  ]
                }
              }
            ]
          }
        },

        // Barra lordo: tasse vs netto
        {
          type: 'div',
          props: {
            style: { display: 'flex', height: 6, width: '100%', marginBottom: 32 },
            children: barSegments.map((seg) => ({
              type: 'div',
              props: {
                style: { display: 'flex', width: `${seg.pct}%`, height: '100%', background: seg.color }
              }
            }))
          }
        },

        // Footer
        {
          type: 'div',
          props: {
            style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' },
            children: [
              {
                type: 'span',
                props: {
                  style: { fontSize: 9, color: '#3a3a38', letterSpacing: '0.12em' },
                  children: 'DATI PUBBLICI · CALCOLI VERIFICABILI · ±3% · NESSUN TRACKING'
                }
              },
              {
                type: 'span',
                props: {
                  style: { fontSize: 9, color: '#3a3a38', letterSpacing: '0.12em' },
                  children: 'LIFE-TIME-EOSIN.VERCEL.APP'
                }
              }
            ]
          }
        }
      ]
    }
  };

  // ─── Render SVG → PNG ─────────────────────────────────────────────
  const svg = await satori(element as Parameters<typeof satori>[0], {
    width: OG_W,
    height: OG_H,
    fonts: [
      { name: 'IBM Plex Mono', data: fontRegular, weight: 400, style: 'normal' },
      { name: 'IBM Plex Mono', data: fontBold, weight: 700, style: 'normal' }
    ]
  });

  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: OG_W } });
  const pngBuffer = resvg.render().asPng();
  // Buffer di Node.js non è direttamente BodyInit — wrap in Uint8Array.
  const png = new Uint8Array(pngBuffer);

  setHeaders({
    'content-type': 'image/png',
    'cache-control': 'public, max-age=3600, s-maxage=86400, immutable'
  });

  return new Response(png);
};
