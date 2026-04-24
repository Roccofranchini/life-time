# CLAUDE.md — Tempo di Vita

## Cos'è questo progetto

"Tempo di Vita" è una web app open source che converte il salario in **ore di vita sottratte**.
L'utente seleziona città, settore CCNL e tipo di contratto; l'app calcola quanto del suo tempo va
a sopravvivenza, tasse, profitto del capitale, e quanto rimane davvero libero.

Filosofia: trasparenza totale, privacy by design, nessun tracking, codice verificabile da chiunque.

---

## Stack

| Ruolo | Tecnologia |
|---|---|
| Frontend + SSR | SvelteKit (TypeScript) |
| Styling | CSS custom properties + utility classes (NO Tailwind) |
| Visualizzazioni | D3.js v7 |
| Backend/API | SvelteKit server routes (Edge-compatible) |
| Database / cache | Supabase (PostgreSQL) |
| Auth | Nessuna — app completamente anonima |
| Hosting | Vercel (free tier) |
| CI/CD scraper | GitHub Actions + Python (pdfplumber) |
| Licenza | AGPL-3.0 |

---

## Struttura directory

```
tempo-di-vita/
├── CLAUDE.md                  ← questo file
├── ARCHITECTURE.md            ← architettura dettagliata
├── DATA_SOURCES.md            ← fonti dati e aggiornamento
├── src/
│   ├── lib/
│   │   ├── engine/            ← motore di calcolo (puro TS, no dipendenze UI)
│   │   │   ├── fiscal.ts      ← calcolo netto da lordo
│   │   │   ├── survival.ts    ← calcolo costi sopravvivenza
│   │   │   ├── time.ts        ← conversione euro → ore vita
│   │   │   └── index.ts       ← barrel export
│   │   ├── data/              ← dati statici versionati
│   │   │   ├── ccnl.json      ← minimi tabellari CCNL
│   │   │   ├── aliquote.json  ← aliquote IRPEF + addizionali regionali
│   │   │   └── cta.json       ← call-to-action locali (sindacati, collettivi)
│   │   ├── stores/            ← Svelte stores globali
│   │   │   └── profile.ts     ← profilo utente (client-side only)
│   │   └── types.ts           ← TypeScript types condivisi
│   ├── routes/
│   │   ├── +page.svelte       ← homepage / wizard onboarding
│   │   ├── report/
│   │   │   └── +page.svelte   ← dashboard risultati
│   │   └── api/
│   │       ├── calcola/
│   │       │   └── +server.ts ← POST /api/calcola
│   │       └── costi/
│   │           └── [provincia]/
│   │               └── +server.ts ← GET /api/costi/:provincia
│   └── app.css                ← design tokens globali
├── data-pipeline/             ← script Python per scraping
│   ├── scrape_omi.py
│   ├── scrape_istat.py
│   └── scrape_mimit.py
├── .github/
│   └── workflows/
│       └── update-data.yml    ← GitHub Action mensile scraping
├── supabase/
│   └── migrations/            ← SQL migrations Supabase
└── tests/
    └── engine/                ← unit test del motore fiscale
```

---

## Regole di sviluppo (IMPORTANTI — seguile sempre)

### Privacy
- **MAI** raccogliere email, nome, IP o qualsiasi PII
- Il calcolo avviene **lato client** dove possibile
- Le chiamate alle API esterne (ISTAT, OMI, Mimit) avvengono **solo server-side**
- Nessun cookie di tracking; se serve analytics, usare Plausible con `data-api` anonimo

### Calcolo fiscale
- Tutte le funzioni in `src/lib/engine/` sono **pure functions** (input → output, no side effects)
- Il margine d'errore del ±3% deve essere **sempre mostrato in UI** vicino al risultato netto
- Le aliquote IRPEF 2024 sono in `src/lib/data/aliquote.json` — non hardcodarle nel codice

### Dati
- I minimi CCNL e le CTA locali sono in `src/lib/data/*.json` — modificabili via PR
- I dati di costo della vita (OMI, ISTAT, Mimit) sono **cachati in Supabase** con TTL 7 giorni
- Prima di chiamare un'API esterna, controlla sempre la cache Supabase

### Frontend
- Usare **Svelte stores** per lo stato del profilo utente (mai localStorage per dati sensibili)
- Le route `/report` generano meta tag OG dinamici lato server (per la condivisione social)
- I grafici D3 devono funzionare **senza JS disabilitato** — mostrare fallback tabellare

### Naming conventions
- File: `kebab-case`
- TypeScript: `camelCase` per variabili/funzioni, `PascalCase` per tipi/interfacce
- CSS custom properties: `--tdv-nome-variabile` (prefisso `tdv` per evitare conflitti)

### Testing
- Ogni funzione in `src/lib/engine/` deve avere test unitari in `tests/engine/`
- Usare Vitest (già incluso in SvelteKit)
- Non committare codice che rompe i test esistenti

---

## Comandi utili

```bash
# Setup iniziale
npm install
cp .env.example .env.local   # aggiungi le credenziali Supabase

# Sviluppo
npm run dev

# Build e preview
npm run build
npm run preview

# Test
npm run test
npm run test:engine          # solo test del motore fiscale

# Type check
npm run check

# Aggiornamento dati manuale
cd data-pipeline
python scrape_omi.py         # richiede SUPABASE_URL e SUPABASE_KEY in env
```

---

## Variabili d'ambiente necessarie

```
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=   # solo per la pipeline dati, mai nel frontend
```

Mettile in `.env.local` (mai committare questo file).

---

## Come aggiungere un nuovo CCNL

1. Apri `src/lib/data/ccnl.json`
2. Aggiungi un oggetto seguendo lo schema esistente (vedi `src/lib/types.ts` → `CcnlEntry`)
3. Aggiungi la fonte (URL PDF ministeriale) nel campo `fonte`
4. Apri una PR con titolo `data: aggiungi CCNL [nome settore]`

---

## Come aggiungere una CTA locale

1. Apri `src/lib/data/cta.json`
2. Aggiungi l'entry seguendo lo schema `CtaEntry`
3. Verifica che `provincia` usi il codice ISTAT (es. `"BO"` per Bologna)

---

## Filosofia del progetto (non ignorare)

Questa non è una "utility app". È uno strumento politico che rende visibile la teoria del valore-lavoro.
Ogni scelta tecnica deve essere coerente con questo: trasparenza, verificabilità, anonimato, diffusibilità.

Quando sei in dubbio su una scelta di design o architettura, chiediti:
**"Questo aiuta un lavoratore a capire quanto del suo tempo viene sottratto?"**
