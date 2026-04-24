# Tempo di Vita

> Quanto costa vivere, in ore.

Applicazione SvelteKit open source che converte il salario in ore di vita sottratte. Calcoli trasparenti su dati pubblici (Agenzia delle Entrate · INPS · ISTAT · OMI · Mimit · ARERA), nessun tracciamento, nessun cookie.

## Cosa fa

1. Partendo da un profilo (provincia, CCNL, livello, tipo contratto) calcola il **netto mensile** con IRPEF 2026 post Legge di Bilancio 2026 (L. 199/2025: 23%/33%/43%), addizionali regionali/comunali, contributi INPS.
2. Stima la **sopravvivenza** (affitto bilocale periferia, spesa alimentare minima, bollette, carburante) per la provincia scelta.
3. Scompone il mese in 7 segmenti onesti di 730 ore: sonno · lavoro (suddiviso in sopravvivenza/stato/capitale/salario-residuo) · riproduzione sociale (vita biologica, ~180h/mese per pasti, cucina, igiene, spostamenti) · tempo libero reale.
4. Permette di **confrontare** due città a parità di contratto, mostrando le ore di lavoro "forzate" (sopravvivenza + tasse locali) che si risparmierebbero trasferendosi.

Il manuale metodologico completo è in [`MANUALE.md`](./MANUALE.md).

## Stack

- SvelteKit 2 + Svelte 5 (runes)
- TypeScript strict
- D3.js 7 per la visualizzazione a torta
- Adapter Vercel (serverless Node 20)
- Supabase opzionale (cache costi di vita; in assenza si usa il fallback statico 107/107 capoluoghi)

## Sviluppo

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # 36/36
npm run check    # svelte-check
npm run build    # produzione
```

## Privacy by design

- Nessun cookie, nessun banner, nessuna analytics.
- I parametri del profilo restano in-URL (privacy-friendly: niente cookie di sessione).
- Il backend non logga niente di riconducibile all'utente.

## Licenza

**AGPL-3.0-or-later**. Se modifichi l'app e la esponi in rete, sei tenuto a pubblicare il sorgente modificato.

## Fonti

Vedi `MANUALE.md` §10 per l'elenco completo e versionato.
