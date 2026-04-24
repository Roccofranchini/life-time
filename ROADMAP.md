# ROADMAP.md — Roadmap per Claude Code

Questo file guida lo sviluppo passo-passo del progetto.
Ogni fase ha un obiettivo chiaro e un prompt consigliato da dare a Claude Code.

---

## Fase 0 — Setup progetto (30 min)

**Obiettivo:** repo funzionante con SvelteKit + Supabase configurati

**Comandi da eseguire manualmente:**
```bash
npm create svelte@latest tempo-di-vita
# scegli: Skeleton project, TypeScript, ESLint, Prettier, Vitest

cd tempo-di-vita
npm install
npm install -D d3 @types/d3

# Supabase client
npm install @supabase/supabase-js

# OG image (per share social)
npm install @vercel/og
```

**Poi crea `.env.local`** con le credenziali Supabase (vedi CLAUDE.md).

**Prompt per Claude Code:**
```
Leggi CLAUDE.md e ARCHITECTURE.md.

Crea la struttura di directory del progetto come descritta in CLAUDE.md.
Crea i file placeholder vuoti (con solo un commento TODO) per:
- src/lib/engine/fiscal.ts
- src/lib/engine/survival.ts
- src/lib/engine/time.ts
- src/lib/engine/index.ts
- src/lib/types.ts
- src/lib/stores/profile.ts
- src/lib/data/ccnl.json (con almeno 2 settori di esempio)
- src/lib/data/aliquote.json (con dati 2024 reali da ARCHITECTURE.md)
- src/lib/data/cta.json (con 3 entries di esempio)

Crea anche supabase/migrations/001_initial.sql con lo schema da ARCHITECTURE.md.
```

---

## Fase 1 — Motore di calcolo (1–2 ore)

**Obiettivo:** il cuore dell'app funziona e ha test

**Prompt per Claude Code:**
```
Leggi CLAUDE.md, ARCHITECTURE.md sezione "Motore fiscale", e src/lib/types.ts.

Implementa le seguenti pure functions in TypeScript:

1. src/lib/engine/fiscal.ts
   - Funzione: calcola_netto(input: FiscalInput): FiscalOutput
   - Implementa il calcolo IRPEF 2024 con gli scaglioni da aliquote.json
   - Implementa le detrazioni lavoro dipendente (formula in ARCHITECTURE.md)
   - Gestisci i tre tipi di contratto: dipendente, part-time, partiva
   - Leggi le aliquote SEMPRE da src/lib/data/aliquote.json, mai hardcodate

2. src/lib/engine/survival.ts
   - Funzione: calcola_sopravvivenza(input: SurvivalInput): SurvivalOutput
   - Input: affitto, spesa_minima, bollette_stimate, netto_mensile, ore_lavoro_mensili
   - Output: ore_sopravvivenza, percentuale_del_netto, percentuale_delle_ore

3. src/lib/engine/time.ts
   - Funzione: calcola_breakdown_temporale(input: TimeInput): TimeBreakdown
   - Calcola i 4 segmenti: sopravvivenza, stato, capitale, libero
   - Il segmento "capitale" usa il margine medio di settore da aliquote.json

4. src/lib/types.ts — definisci tutti i tipi TypeScript necessari

5. Scrivi i test in tests/engine/ usando Vitest:
   - Test fiscal.ts con: lordo 25.000 Bologna, atteso netto ~19.500 (verifica manuale IRPEF)
   - Test edge case: part-time 60%, P.IVA flat rate
   - Tutti i test devono passare con npm run test
```

---

## Fase 2 — API routes (2 ore)

**Obiettivo:** backend che serve dati e calcoli

**Prompt per Claude Code:**
```
Leggi CLAUDE.md e ARCHITECTURE.md.

Implementa le SvelteKit server routes:

1. src/routes/api/calcola/+server.ts
   POST /api/calcola
   - Body: { lordo_annuo, tipo_contratto, regione, comune }
   - Usa calcola_netto() da src/lib/engine/fiscal.ts
   - Ritorna FiscalOutput come JSON
   - Gestisci errori con status code appropriati (400 per input invalidi)
   - MAI loggare dati personali

2. src/routes/api/costi/[provincia]/+server.ts
   GET /api/costi/:provincia
   - Controlla prima la cache Supabase (tabella costi_vita, TTL 7 giorni)
   - Se cache valida: ritorna dati cachati
   - Se cache scaduta/assente: fetcha da Mimit (carburante) e ritorna dati ISTAT statici
     (per ora usa valori statici per ISTAT/OMI — li aggiorneremo con lo scraper)
   - Aggiorna la cache Supabase dopo il fetch
   - Inizializza il client Supabase con SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY

Per il client Supabase crea src/lib/server/supabase.ts (file server-only).
Assicurati che NESSUN import di questo file finisca nel bundle client.
```

---

## Fase 3 — Frontend wizard (2–3 ore)

**Obiettivo:** l'utente può inserire il suo profilo

**Prompt per Claude Code:**
```
Leggi CLAUDE.md e il file src/lib/types.ts.

Implementa il wizard di onboarding in src/routes/+page.svelte:

Step 1 — Città
  - Input text con autocomplete sulle province italiane
  - Usa le province da src/lib/data/province.json (crealo con tutte le 107 province)

Step 2 — Contratto
  - Select: settore (da ccnl.json)
  - Select: livello (dipende dal settore scelto)
  - Select: tipo contratto (indeterminato / part-time / P.IVA)
  - Se part-time: slider percentuale (50%, 60%, 70%, 80%)

Step 3 — Conferma
  - Riepilogo selezioni
  - CTA: "Calcola il tuo tempo di vita"
  - Nota esplicita: "Non raccogliamo nessun dato. Il calcolo avviene sul tuo dispositivo."

Store: salva il profilo in src/lib/stores/profile.ts come Svelte writable store.
Al click su "Calcola": chiama POST /api/calcola e GET /api/costi/:provincia,
poi naviga a /report con i dati passati via store (non via URL per i dati sensibili).

Design: minimale, pulito, testo grande. NO elementi decorativi superflui.
Lo stile è politico-editoriale: come un manifesto, non come una startup fintech.
Usa CSS custom properties (prefisso --tdv-) definite in app.css.
Font consigliato: 'IBM Plex Mono' per i numeri, sans-serif di sistema per il testo.
```

---

## Fase 4 — Dashboard risultati (3–4 ore)

**Obiettivo:** la visualizzazione che fa effetto politico

**Prompt per Claude Code:**
```
Leggi CLAUDE.md, ARCHITECTURE.md sezione "Flusso principale", e src/lib/engine/time.ts.

Implementa src/routes/report/+page.svelte:

1. Grafico a torta D3 animato
   - 4 segmenti: Sopravvivenza, Stato, Capitale, Tempo libero reale
   - Animazione di entrata (1.2s ease-out)
   - Click su segmento → breakdown dettagliato sotto
   - Colori: usa CSS custom properties, supporta dark mode
   - Fallback accessibile: tabella <table> visibile quando JS è disabilitato

2. Numeri chiave sopra la torta
   - "Lavori X giorni al mese per l'affitto"
   - "Il tuo salario lordo è Y€. Dopo tasse ne ricevi Z€ (±3%)"
   - "Hai X ore di tempo libero reale al mese"

3. Sezione CTA
   - Filtra cta.json per provincia corrente
   - Mostra solo le CTA rilevanti (logica in DATA_SOURCES.md, sezione "Tipi di CTA")
   - Design: discreto, non invasivo

4. Bottone "Condividi"
   - Genera URL /report?p=BO&s=commercio-4&c=indeterminato
   - Copia negli appunti + messaggio di conferma
   - NON condividere dati numerici nell'URL (solo parametri di selezione)

5. Meta tag OG in src/routes/report/+page.server.ts
   - Leggi i parametri query string
   - Ricalcola il dato chiave server-side
   - Ritorna: { title, description } per i meta tag
```

---

## Fase 5 — Comparatore geografico (2 ore)

**Obiettivo:** "E se ti trasferissi?"

**Prompt per Claude Code:**
```
Aggiungi nella dashboard report una sezione "E se ti trasferissi?":

- Input: seconda città (autocomplete province)
- Fetcha GET /api/costi/:nuova_provincia
- Ricalcola breakdown temporale per la nuova città (stesso salario, costi diversi)
- Mostra diff: "+15 ore di tempo libero al mese" / "-8 ore"
- Visualizzazione: due barre orizzontali affiancate (D3 o CSS puro)

Non serve mappa interattiva nella versione iniziale — il comparatore testuale è sufficiente.
```

---

## Fase 6 — Pipeline dati (2 ore)

**Obiettivo:** aggiornamento automatico dei dati pubblici

**Prompt per Claude Code:**
```
Leggi DATA_SOURCES.md completamente.

Crea i seguenti script Python in data-pipeline/:

1. scrape_mimit.py
   - Fetcha i prezzi carburanti per provincia dall'API Mimit (URL in DATA_SOURCES.md)
   - Aggiorna la tabella costi_vita in Supabase (voce: 'carburante')
   - Usa le variabili d'ambiente SUPABASE_URL e SUPABASE_KEY
   - Stampa un report di quante province sono state aggiornate

2. scrape_omi.py
   - Scarica il file Excel OMI più recente (URL in DATA_SOURCES.md)
   - Usa openpyxl per estrarre affitto_medio_bilocale_periferia per provincia
   - Aggiorna la tabella costi_vita in Supabase (voce: 'affitto_bilocale_periferia')

3. .github/workflows/update-data.yml
   - Schedule: primo del mese alle 06:00 UTC
   - Steps: checkout → setup Python 3.12 → pip install → run scripts
   - Secrets necessari: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

Ogni script deve essere idempotente (ri-eseguibile senza duplicare dati).
```

---

## Fase 7 — QA e ottimizzazione (1–2 ore)

**Prompt per Claude Code:**
```
Esegui una revisione completa del progetto:

1. Accessibilità
   - Tutti gli elementi interattivi hanno aria-label
   - Il grafico D3 ha un <title> e <desc> SVG
   - La tabella fallback è presente e corretta

2. Performance
   - I JSON statici (ccnl.json, aliquote.json) sono importati come asset statici
   - Le chiamate API hanno timeout (10s max) e gestione errori
   - Il bundle client non include il client Supabase server-only

3. Privacy check
   - Verifica che nessun endpoint loggi IP o dati personali
   - Verifica che il client Supabase con service role key non sia mai nel bundle client
   - Verifica che gli URL condivisibili non contengano PII

4. SEO
   - robots.txt presente (index: yes, ma no /api/)
   - sitemap.xml con solo la homepage
   - Meta description nella homepage

Produci un report delle issues trovate e fixale.
```

---

## Checklist finale prima del deploy

- [ ] `npm run build` senza errori
- [ ] `npm run check` senza errori TypeScript
- [ ] `npm run test` — tutti i test passano
- [ ] `.env.local` NON committato (controllare .gitignore)
- [ ] Supabase migrations eseguite in produzione
- [ ] Vercel: variabili d'ambiente configurate nel dashboard
- [ ] GitHub: secrets SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY aggiunti
- [ ] Prima run manuale di `update-data.yml` per popolare la cache
- [ ] Test su mobile (breakpoint 375px)
- [ ] Test con JS disabilitato (tabella fallback visibile)
