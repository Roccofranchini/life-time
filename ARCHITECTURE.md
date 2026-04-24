# ARCHITECTURE.md — Tempo di Vita

## Panoramica

```
┌─────────────────────────────────────────────────────┐
│                   BROWSER (client)                  │
│                                                     │
│  Wizard onboarding → Store profilo → Dashboard D3  │
│         (tutto client-side, nessun PII inviato)    │
└──────────────────────┬──────────────────────────────┘
                       │ POST /api/calcola
                       │ GET  /api/costi/:provincia
                       ▼
┌─────────────────────────────────────────────────────┐
│            SVELTEKIT SERVER (Edge Functions)        │
│                                                     │
│  ┌────────────────┐   ┌───────────────────────────┐│
│  │  Motore fiscale│   │  Aggregatore costi vita   ││
│  │  (TypeScript)  │   │  (fetch + cache Supabase) ││
│  └────────────────┘   └───────────────────────────┘│
└──────────────────────┬──────────────────────────────┘
                       │
          ┌────────────┴────────────┐
          ▼                         ▼
┌─────────────────┐     ┌──────────────────────────┐
│    SUPABASE     │     │   FONTI DATI PUBBLICHE   │
│  (cache 7 gg)  │     │  ISTAT / OMI / Mimit     │
│                 │     │  (solo server-side)       │
│  - costi_vita  │     └──────────────────────────┘
│  - province    │
└─────────────────┘

┌─────────────────────────────────────────────────────┐
│           DATI STATICI (GitHub, versionati)         │
│   ccnl.json · aliquote.json · cta.json             │
│   Aggiornabili via PR · Verificabili da chiunque   │
└─────────────────────────────────────────────────────┘
```

---

## Flusso principale — calcolo "Tempo di Vita"

```
1. Utente seleziona:
   - Città (provincia ISTAT)
   - Settore + livello CCNL
   - Tipo contratto (indeterminato / part-time / P.IVA)

2. Client legge ccnl.json → ottiene minimo lordo mensile

3. POST /api/calcola con { lordo, tipo_contratto, regione, comune }
   → motore fiscale calcola il NETTO mensile (±3%)

4. GET /api/costi/:provincia
   → server controlla cache Supabase (TTL 7 giorni)
   → se scaduta: fetcha ISTAT + OMI + Mimit, aggiorna cache, ritorna dati
   → ritorna: { affitto_medio, spesa_minima, carburante_litro }

5. Client esegue breakdown temporale:
   ore_totali_mese = 730 (media)
   ore_sonno = 8 * 30 = 240
   ore_lavoro = (ore_settimanali_contrattuali * 52) / 12

   tempo_sopravvivenza_h = (affitto + spesa_minima + bollette_stimate) / (netto / ore_lavoro)
   tempo_stato_h         = (lordo - netto) / (lordo / ore_lavoro)
   tempo_capitale_h      = stimato da margine medio di settore (tabella in aliquote.json)
   tempo_libero_h        = ore_totali_mese - ore_sonno - ore_lavoro

6. D3 renderizza il grafico a torta animato con i 4 segmenti

7. Suggerisce CTA locali filtrando cta.json per provincia
```

---

## Motore fiscale — dettaglio

File: `src/lib/engine/fiscal.ts`

```typescript
// Input
interface FiscalInput {
  lordo_annuo: number         // RAL
  tipo_contratto: 'dipendente' | 'parttime' | 'partiva'
  percentuale_parttime?: number  // es. 0.6 per 60%
  regione: string             // es. "emilia-romagna"
  comune: string              // es. "bologna"
}

// Output
interface FiscalOutput {
  netto_mensile: number
  netto_annuo: number
  irpef: number
  addizionale_regionale: number
  addizionale_comunale: number
  contributi_inps: number
  cuneo_fiscale_percentuale: number
  margine_errore: 0.03        // sempre ±3%
}
```

### Algoritmo IRPEF 2024

```
Scaglioni (da aliquote.json):
  0     – 28.000  → 23%
  28.001 – 50.000 → 35%
  50.001+          → 43%

Detrazione lavoro dipendente:
  se lordo ≤ 15.000: 1.995 + max(0, 690 * (28.000 - lordo) / 13.000)
  se lordo ≤ 28.000: 1.910 + (1.370 * (28.000 - lordo) / 13.000)
  se lordo ≤ 50.000: 1.910 * (50.000 - lordo) / 22.000
  se lordo >  50.000: 0

INPS dipendente: 9.19% fino a massimale, poi 10.19%
INPS P.IVA flat: 26.23% (gestione separata INPS)
```

---

## Schema Supabase

```sql
-- Cache costi vita per provincia
CREATE TABLE costi_vita (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  provincia   char(2) NOT NULL,           -- codice ISTAT es. "BO"
  voce        text NOT NULL,              -- 'affitto_bilocale' | 'spesa_minima' | 'carburante'
  valore      numeric(10,2) NOT NULL,
  fonte       text NOT NULL,              -- 'OMI' | 'ISTAT' | 'Mimit'
  aggiornato  timestamptz DEFAULT now(),
  UNIQUE(provincia, voce)
);

-- Indice per TTL check
CREATE INDEX idx_costi_vita_aggiornato ON costi_vita(aggiornato);

-- Province italiane (tabella di lookup)
CREATE TABLE province (
  codice      char(2) PRIMARY KEY,
  nome        text NOT NULL,
  regione     text NOT NULL,
  capoluogo   boolean DEFAULT false
);
```

---

## GitHub Actions — pipeline dati

File: `.github/workflows/update-data.yml`

```yaml
name: Aggiorna dati pubblici
on:
  schedule:
    - cron: '0 6 1 * *'    # ogni primo del mese alle 06:00
  workflow_dispatch:        # anche manuale

jobs:
  scrape:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: '3.12' }
      - run: pip install pdfplumber httpx supabase-py
      - run: python data-pipeline/scrape_omi.py
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
      - run: python data-pipeline/scrape_istat.py
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
```

---

## SEO e condivisione social

Ogni report genera una URL unica:
```
/report?p=BO&s=commercio-4&c=indeterminato
```

Il server SvelteKit genera i meta tag OG dinamicamente:

```html
<meta property="og:title" content="Lavori 18 giorni al mese per l'affitto — Tempo di Vita" />
<meta property="og:description" content="A Bologna, livello 4 Commercio: solo 8 ore/mese di tempo libero reale." />
<meta property="og:image" content="/api/og?p=BO&s=commercio-4" />
```

L'immagine OG è generata server-side con `@vercel/og` (Satori).

---

## Decisioni architetturali e motivazioni

| Decisione | Alternativa scartata | Motivazione |
|---|---|---|
| SvelteKit | Next.js | Bundle più piccolo, DX migliore per progetto solo, SSR nativo |
| CSS custom props | Tailwind | Controllo totale sul design system, nessuna dipendenza di build |
| Supabase come cache | Redis / Upstash | Free tier generoso, PostgreSQL familiare, niente infra da gestire |
| Dati CCNL su GitHub | DB remoto | Verificabilità, contributi via PR, nessun endpoint da mantenere |
| AGPL-3.0 | MIT | Impedisce fork commerciali chiusi; coerente con filosofia del progetto |
| Nessun auth | JWT / session | Privacy by design; non c'è nulla da proteggere se non raccogli dati |
