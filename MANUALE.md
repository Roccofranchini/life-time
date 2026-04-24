# Tempo di Vita — Manuale completo

> Web app open source che converte il salario in **ore di vita sottratte**.
> Non un calcolatore neutro: un manifesto politico-editoriale su quanto del
> mese di un lavoratore italiano va in sopravvivenza, tasse, profitto e
> riproduzione sociale — e quanto gli resta davvero.

Licenza codice: **AGPL-3.0**. Licenza dati: le fonti citate sono tutte
pubbliche e riutilizzabili (vedi §10).

---

## Indice

1. [Cosa fa l'app](#1-cosa-fa-lapp)
2. [Stack tecnico e privacy](#2-stack-tecnico-e-privacy)
3. [Il modello temporale onesto](#3-il-modello-temporale-onesto)
4. [Motore fiscale — algoritmo e formule](#4-motore-fiscale--algoritmo-e-formule)
5. [Motore sopravvivenza](#5-motore-sopravvivenza)
6. [Motore temporale — le 7 fette del mese](#6-motore-temporale--le-7-fette-del-mese)
7. [Workflow utente end-to-end](#7-workflow-utente-end-to-end)
8. [Comparatore città — "e se ti trasferissi?"](#8-comparatore-città--e-se-ti-trasferissi)
9. [Condivisione report e privacy by design](#9-condivisione-report-e-privacy-by-design)
10. [Fonti dati — elenco completo](#10-fonti-dati--elenco-completo)
11. [Margine d'errore e onestà epistemica](#11-margine-derrore-e-onestà-epistemica)

---

## 1. Cosa fa l'app

L'utente indica tre cose:

- **Provincia** (codice ISTAT, es. `BO`)
- **Settore + livello CCNL** (es. Commercio livello 4)
- **Tipo di contratto** (indeterminato, part-time, partita IVA gestione separata)

Da queste tre selezioni — **senza chiedere mai dati personali, RAL, busta paga** — l'app:

1. legge il minimo tabellare CCNL pubblico → stima il lordo annuo;
2. applica il motore fiscale italiano 2026 (post L. Bilancio 2026) → stima il netto;
3. legge i costi locali (affitto, spesa, bollette, carburante) della provincia;
4. calcola quante **ore del mese** finiscono in: sonno, riproduzione sociale
   (mangiare, cucinare, igiene, spostamenti), costi fissi, tasse, profitto
   del capitale, e quanto resta di **tempo libero reale**;
5. renderizza tutto in un grafico a torta D3 con tooltip editoriali;
6. permette di **confrontare due province** mantenendo lo stesso contratto;
7. offre un link condivisibile che **non contiene alcun numero calcolato** —
   solo le selezioni dell'utente.

---

## 2. Stack tecnico e privacy

| Ruolo | Tecnologia |
|---|---|
| Frontend + SSR | SvelteKit 2 + Svelte 5 (runes) · TypeScript strict |
| Visualizzazioni | D3.js v7 (pie + arc), Canvas 2D (globo hero) |
| Backend/API | SvelteKit server routes (Edge-compatible) |
| Cache costi vita | Supabase PostgreSQL (TTL 7 giorni) |
| Pipeline dati | GitHub Actions + Python (pdfplumber) |
| Hosting | Vercel (free tier) |
| Auth | **Nessuna** — app completamente anonima |

**Garanzie privacy codificate nel repo:**

- nessun cookie, nessun log, nessun tracker di terze parti;
- nessuna PII raccolta o trasmessa (niente reddito digitato, niente nome,
  niente CAP);
- le API `/api/calcola` e `/api/costi/:provincia` hanno `cache-control: no-store`
  (calcolo) e `cache-control: public, max-age=86400` (costi pubblici per
  provincia — non personali);
- la `SUPABASE_SERVICE_ROLE_KEY` è solo server-side (non finisce nel bundle client);
- l'URL di share contiene solo selezioni (provincia, settore, contratto), **mai
  numeri calcolati**.

---

## 3. Il modello temporale onesto

Il mese convenzionale è **730 ore** (365.25 / 12 × 24).

La prima versione del modello mostrava "tempo libero" come `730 − sonno − lavoro`,
risultando in ~317 h/mese. **È una bugia**: include il tempo in cui mangi,
cucini, ti lavi, pulisci casa e ti muovi per non-lavoro. Il modello corretto
sottrae anche questa quota — storicamente chiamata **riproduzione sociale** o
lavoro non pagato (cfr. Silvia Federici, *Il punto zero della rivoluzione*, 2014).

### Le quote strutturali (costanti del modello)

| Voce | Ore/mese | Fonte |
|---|---:|---|
| Totale mese | 730 | 365.25 × 24 / 12 |
| Sonno | 240 | convenzione: 8 h × 30 giorni |
| Vita biologica | 180 | ISTAT *Uso del tempo* — somma di pasti (~2 h/g), igiene (~1 h/g), lavoro domestico (~2 h/g), spostamenti non lavorativi (~1 h/g) |
| Lavoro | ~173 (full-time) | 40 h/sett × 52 / 12 |

**Libero reale** = 730 − 240 − 173 − 180 = **~137 h/mese** per un full-time
(≈ 31.6 h/sett, ≈ 4.5 h al giorno), non 317.

Il codice espone la costante in `src/lib/engine/time.ts`:

```ts
export const ORE_TOTALI_MESE = 730;
export const ORE_SONNO_MESE = 240;            // 8h × 30
export const ORE_VITA_BIOLOGICA_MESE = 180;   // ISTAT Uso del tempo
```

---

## 4. Motore fiscale — algoritmo e formule

File: `src/lib/engine/fiscal.ts`.
Fonti normative: **Agenzia delle Entrate**, **TUIR art. 13**, **D.Lgs 216/2023**, **Legge 30/12/2025 n. 199 (Bilancio 2026)**, **INPS circolare 22/2024**.

### 4.1 IRPEF — scaglioni 2026 (post L. 199/2025)

| Scaglione | Aliquota |
|---|---:|
| 0 – 28 000 € | 23 % |
| 28 001 – 50 000 € | 33 % *(ridotta dal 35 %)* |
| 50 001 € → | 43 % |

La Legge di Bilancio 2026 ha abbassato il secondo scaglione dal 35 % al 33 %,
confermando la struttura a tre aliquote introdotta nel 2024 dal D.Lgs 216/2023
(che aveva accorpato il vecchio primo e secondo scaglione al 23 %).

Il codice applica gli scaglioni in modo **progressivo puro**: ogni porzione
di reddito paga la sua aliquota, non l'aliquota massima. L'imponibile IRPEF
è il **reddito complessivo** = lordo annuo − contributi INPS obbligatori a
carico del lavoratore.

### 4.2 Detrazione per lavoro dipendente (TUIR art. 13 c.1 lett. a-b-c)

```
se reddito ≤ 15 000 €:  1 955 €
se reddito ≤ 28 000 €:  1 910 + 1 190 × (28 000 − R) / 13 000
se reddito ≤ 50 000 €:  1 910 × (50 000 − R) / 22 000
se reddito >  50 000 €:  0
```

Formula aggiornata alla versione post-riforma 2024 (riconfermata dalla L.
199/2025 per il 2026); non include il trattamento integrativo ex-"bonus Renzi"
(che ha soglie di eleggibilità che dipendono da dati non disponibili all'app,
e non è applicabile in modo automatico).

Fonte: Agenzia delle Entrate, *Aliquote e calcolo dell'IRPEF*
(https://www.agenziaentrate.gov.it/portale/imposta-sul-reddito-delle-persone-fisiche-irpef-/aliquote-e-calcolo-dell-irpef)
· circolare INPS 22/2024 · TUIR art. 13.

### 4.3 Contributi INPS

| Contratto | Formula |
|---|---|
| Dipendente | 9,19 % fino al massimale annuo 113 520 €, 10,19 % sulla quota eccedente |
| Partita IVA (gestione separata) | 26,23 % flat |

Fonte: INPS, *Aliquote contributive 2024*. Massimale ex L. 335/1995 rivalutato ISTAT.

### 4.4 Addizionali regionali e comunali

Addizionale regionale: aliquota fissa per regione (da 1,23 % Trentino / Basilicata
a 3,33 % Lazio). Fonte: *Testo Unico sulle addizionali IRPEF*, MEF — Dipartimento
delle Finanze, tabelle aggiornate 2024.

Addizionale comunale: media nazionale **0,8 %** (in assenza di tabella comune-per-comune).

### 4.5 Cuneo fiscale

```
cuneo_fiscale_percentuale = (IRPEF + add. reg. + add. com. + INPS) / lordo_annuo
```

Valore che il motore temporale riutilizza per stimare le *ore di lavoro che
finiscono allo Stato* (vedi §6.3).

### 4.6 Convenzione sul part-time

Il motore fiscale tratta `lordo_annuo` come **RAL effettiva** (quella che compare
in CU/busta paga), già scalata in caso di part-time. Coerente con la prassi di
CGIL, JetHR, calcolostipendionetto.it. `percentuale_parttime` resta come campo
informativo per la narrativa UI (numero di ore di lavoro mensili), non come
scalatore fiscale ulteriore.

---

## 5. Motore sopravvivenza

File: `src/lib/engine/survival.ts`.

```
costo_sopravvivenza_totale = affitto + spesa_minima + bollette + carburante_stimato
valore_orario              = netto_mensile / ore_lavoro_mensili
ore_sopravvivenza          = costo_sopravvivenza_totale / valore_orario
percentuale_netto          = costo_sopravvivenza_totale / netto_mensile
```

Le quattro voci dei costi vengono dalla provincia (vedi §10). Il **carburante
stimato** usa una convenzione editoriale dichiarata: 40 L/mese (≈ 400 km / 10 km·L),
conservativa per chi usa mezzi urbani. Se l'utente non guida, la voce sovrastima
leggermente la sopravvivenza — scelta intenzionale, perché molti devono spostarsi
anche senza auto (trasporti, manutenzione bici, ecc.).

**Come leggere il numero**: "devi lavorare N ore al mese solo per coprire i costi
fissi minimi di vivere nella tua provincia".

---

## 6. Motore temporale — le 7 fette del mese

File: `src/lib/engine/time.ts`.
Il mese di 730 h viene scomposto in **segmenti mutuamente esclusivi che sommano
esattamente a 730**:

### 6.1 Sonno (240 h)
Convenzione: 8 h × 30 giorni. Non è riposo libero: è manutenzione del corpo
che domani torna in servizio. Varia poco tra individui (range 6–9 h in media
OECD, *Time Use Surveys*).

### 6.2 Sopravvivenza (parte del lavoro)
`ore_sopravvivenza` del motore §5. È la porzione di ore di lavoro che copre
affitto/spesa/bollette/carburante ai prezzi medi della provincia.

### 6.3 Tasse & Stato (parte del lavoro)
```
ore_stato = cuneo_fiscale_percentuale × ore_lavoro_mensili
```
Ore di lavoro convertite in IRPEF + addizionali + INPS. È il cuneo sul lordo,
non sul netto.

### 6.4 Profitto del capitale (parte del lavoro)
```
ore_capitale = margine_medio_settore × ore_lavoro_mensili
```

La tabella `margine_medio_settore` (in `src/lib/data/aliquote.json`) è
**ISTAT MOL/Valore aggiunto** per divisione ATECO, anno 2023, report *Conti
economici delle imprese e dei gruppi* (ottobre 2025):

| Settore | MOL/VA | Interpretazione marxiana |
|---|---:|---|
| Commercio (G47) | 0,30 | saggio di sfruttamento ~30% |
| Metalmeccanici (C24-28) | 0,38 | industria più capital-intensive |
| Logistica | 0,35 | |
| Ristorazione | 0,22 | labor-intensive, profit-share basso |
| Terziario | 0,30 | |
| Edilizia | 0,30 | |
| Pulizie | 0,20 | |
| Sanità privata | 0,35 | |
| default | 0,32 | media servizi non finanziari |

L'indicatore MOL/VA misura la quota di valore aggiunto **non** assegnata al
lavoro dipendente — proxy settoriale del *profit share* e, in cornice marxiana,
del saggio di sfruttamento. Fonte: ISTAT, *Report Conti economici imprese e
gruppi 2023*, tabelle per divisione ATECO (link in §10).

### 6.5 Salario residuo (parte del lavoro, se > 0)
```
salario_residuo = max(0, ore_lavoro − ore_sopravvivenza − ore_stato − ore_capitale)
```
Ore di lavoro che finiscono davvero in tasca (oltre costi fissi, tasse, profitto).
Mostrato in torta solo se > 1 h, altrimenti confuso nella narrativa "la
sopravvivenza mangia tutto il salario".

### 6.6 Vita biologica (180 h)
Costante ISTAT, non dipende dal salario. Il messaggio editoriale è: **questa
quota è sempre lì**, e chi ha meno salario spesso la spende male (trasporto
pubblico più lento, cibo lavorato di più per costare meno, case piccole che
costringono a servizi esterni).

### 6.7 Libero reale (residuo)
```
ore_libero_reale = max(0, 730 − 240 − ore_lavoro − 180)
                 = max(0, 310 − ore_lavoro)
```

Per full-time 40 h/sett ≈ 173 h lavoro → **libero reale ≈ 137 h/mese ≈ 31,6 h/sett**.

**Invariante di test** (`tests/engine/time.test.ts`): `ore_libero_reale < ore_libere`
in qualunque scenario realistico. Il test fallisce se qualcuno reintroduce il
modello disonesto.

### 6.8 Numero "giorni affitto"

```
giorni_affitto = round(affitto / netto_mensile × 30)
```

Il titolo del report. Non è un calcolo scientificamente raffinato: è una
**metrica comunicativa** ("lavori X giorni al mese solo per il padrone di casa").
Calibrata sul mese di calendario (30 giorni), non sui giorni lavorativi.

---

## 7. Workflow utente end-to-end

```
┌──────────────────────────────────────────────────────────────┐
│  1. HOME  /  wizard 3 passi                                  │
│  ────────────────────────────────────────                   │
│  a. autocomplete provincia (107 province ISTAT)              │
│  b. select settore CCNL → select livello                     │
│  c. tipo contratto (indeterminato / parttime + % / p.iva)    │
│     + il client legge ccnl.json → calcola lordo_annuo        │
└────────────────────────┬─────────────────────────────────────┘
                         │ click "Calcola →"
                         ▼
┌──────────────────────────────────────────────────────────────┐
│  2. CHIAMATE API IN PARALLELO                                │
│  ────────────────────────────────────────                   │
│  Promise.all([                                               │
│    POST /api/calcola  { lordo, tipo, regione, comune }       │
│      → FiscalOutput (netto, irpef, inps, add. reg/com, cuneo)│
│    GET  /api/costi/:provincia                                │
│      → CostiVita (affitto, spesa, bollette, carburante)      │
│  ])                                                          │
└────────────────────────┬─────────────────────────────────────┘
                         │ client calcola in locale:
                         ▼
┌──────────────────────────────────────────────────────────────┐
│  3. MOTORI PURE-FUNCTION (client)                            │
│  ────────────────────────────────────────                   │
│  survival = calcola_sopravvivenza({...})   // §5             │
│  breakdown = calcola_breakdown_temporale({...})  // §6       │
│  Scrive 5 store Svelte: profilo, risultatoFiscale,           │
│    costiProvincia, risultatoSopravvivenza, breakdownTemporale│
└────────────────────────┬─────────────────────────────────────┘
                         │ goto('/report')
                         ▼
┌──────────────────────────────────────────────────────────────┐
│  4. DASHBOARD  /report                                       │
│  ────────────────────────────────────────                   │
│  Hero — titolo: "Lavori N giorni al mese per l'affitto"      │
│  PieChart D3 a 7 segmenti (vedi §6) con tooltip editoriali   │
│  Legenda + "manifesto-nums" laterale                         │
│  Dettaglio costi vita della provincia                        │
│  ComparatoreCitta (§8)                                       │
│  CTA locali (§7.1) filtrate per provincia                    │
│  Bottone "Condividi → copia link" (senza numeri, §9)         │
└──────────────────────────────────────────────────────────────┘
```

### 7.1 CTA locali

`src/lib/data/cta.json` contiene una lista di sportelli e organizzazioni:
sindacati inquilini (SUNIA), sindacati del lavoro, sportelli sociali, collettivi.
Ogni voce ha `provincia` (codice ISTAT o `"nazionale"`). La dashboard filtra
automaticamente per provincia corrente + voci nazionali, così chi arriva sul
report vede **a chi può telefonare domani**.

### 7.2 Due ingressi al report

- **(a)** dal wizard: gli store Svelte sono popolati, la pagina legge da lì.
- **(b)** da link condiviso: `+page.server.ts` legge `?p=BO&s=commercio-4&c=indeterminato`,
  ri-esegue tutto il calcolo server-side e rende in SSR (così i meta tag OG
  hanno i numeri corretti per preview social). Il client poi popola gli store
  per coerenza con il resto della UI.

---

## 8. Comparatore città — "e se ti trasferissi?"

Componente `src/lib/components/ComparatoreCitta.svelte`, integrato nella
dashboard sotto la sezione costi vita.

**Cosa fa**: data una seconda provincia scelta via autocomplete, mantiene
invariati CCNL + livello + tipo contratto (quindi il lordo), e **ricalcola
tutto il resto**:

1. `POST /api/calcola` con la nuova regione/comune → nuovo netto (diverso per
   addizionali regionali + comunali);
2. `GET /api/costi/:nuovaProvincia` → nuovi affitto/spesa/bollette/carburante;
3. client: `calcola_sopravvivenza` + `calcola_breakdown_temporale`.

**Cosa mostra**:

- due **barre orizzontali stacked** (attuale vs ipotetica), ciascuna divisa
  negli stessi 6–7 segmenti della torta principale — stessa palette, così
  il confronto è immediato;
- una **diff-card** centrale con il delta di tempo libero reale in ore/mese e
  ore/settimana. Verde se il trasferimento libererebbe tempo, rosso se ne
  sottrarrebbe;
- un `dl` con i delta puntuali su netto mensile, affitto, sopravvivenza, stato;
- un **caveat editoriale**: _"Non è consulenza: non considera trasloco, rete
  sociale, costo di vivere lontano dalla famiglia. Il 'trasferimento razionale'
  è una categoria del capitale, non della vita."_

**Limite dichiarato**: il CCNL non varia per città (i minimi tabellari sono
nazionali), quindi il confronto misura solo l'effetto di (i) addizionali
regionali/comunali, (ii) costi locali, (iii) profit-share settoriale
invariato. È sufficiente per leggere l'asimmetria tra salario nazionale e
mercato immobiliare locale — che è esattamente la tesi politica dell'app.

---

## 9. Condivisione report e privacy by design

Click "Condividi → copia link": si copia negli appunti una URL tipo:

```
https://esempio.it/report?p=BO&s=commercio-4&c=indeterminato
```

- solo tre (o quattro, con `pt=60` per part-time) parametri
- **zero numeri calcolati**
- chi apre il link ri-computa tutto server-side con le stesse fonti
- zero identificatori riconducibili all'utente

Il server load (`src/routes/report/+page.server.ts`) imposta:
- `cache-control: private, max-age=0, must-revalidate` (nessuna cache edge
  personale);
- `x-content-type-options: nosniff`;
- nessun log del querystring.

Generazione url e validazione parametri: `src/lib/share.ts` + `src/lib/server/validation.ts`.

---

## 10. Fonti dati — elenco completo

### 10.1 Fiscali (file `src/lib/data/aliquote.json`)

| Dato | Fonte | URL |
|---|---|---|
| Scaglioni IRPEF 2026 (post L. 199/2025) | Agenzia delle Entrate — *Aliquote e calcolo dell'IRPEF* | https://www.agenziaentrate.gov.it/portale/imposta-sul-reddito-delle-persone-fisiche-irpef-/aliquote-e-calcolo-dell-irpef |
| Detrazione lavoro dipendente | TUIR art. 13 c.1 lett. a-b-c · D.Lgs 216/2023 | circolare AdE 2024, circolare INPS 22/2024 |
| INPS dipendente 9,19 % (+ massimale) | INPS — *Aliquote contributive 2024* | https://www.inps.it |
| INPS gestione separata 26,23 % | INPS — ex L. 335/1995 art. 2 c. 26 | https://www.inps.it |
| Addizionali regionali | MEF — Dipartimento Finanze, tabelle | https://www.finanze.gov.it/it/fiscalita-regionale-e-locale/addizionali-regionali-allirpef/ |
| Media addizionali comunali 0,8 % | stima MEF su capoluoghi | https://www.finanze.gov.it |

**Aggiornamento**: una volta all'anno, manualmente via PR, dopo pubblicazione
Legge di Bilancio in Gazzetta Ufficiale.

### 10.2 Salariali (file `src/lib/data/ccnl.json`)

Minimi tabellari (lordo mensile per livello). Otto settori nella versione
iniziale, scelti per copertura:

| Settore | CCNL | Fonte |
|---|---|---|
| Commercio | Confcommercio — Terziario, Distribuzione, Servizi | https://www.confcommercio.it/-/ccnl-terziario-contratto |
| Metalmeccanici | Federmeccanica / FIM-FIOM-UILM | https://www.fiom-cgil.it/net/industria-privata-e-installazione-impianti/ccnl-federmeccanica |
| Logistica | Confetra — Logistica, Trasporto merci e Spedizione (testo depositato) | https://www.filtcgil.it/terra/27-contratti-terra/contratti-trasporto-merci.html |
| Ristorazione | FIPE — Pubblici Esercizi | https://www.fipe.it/category/area-lavoro/testo-ccnl-fipe/ |
| Terziario avanzato | Confcommercio | (idem commercio, livelli ICT) |
| Edilizia | CCNL Edilizia | in aggiornamento |
| Pulizie e multiservizi | CCNL Multiservizi | in aggiornamento |
| Sanità privata | AIOP / ARIS | in aggiornamento |

> **Nota sulle fonti CCNL**: quando un link "ufficiale" delle associazioni
> datoriali non è stabile nel tempo (Confcommercio ristruttura spesso il sito,
> Federmeccanica non pubblica il PDF dopo il rinnovo), abbiamo scelto come
> fonte secondaria il sito del sindacato firmatario (FIOM-CGIL, FILT-CGIL):
> ospita il testo depositato presso CNEL, ha URL più stabili e garantisce
> tracciabilità del contratto firmato.

**Aggiornamento**: 1–2 volte all'anno (rinnovi contrattuali), manualmente via PR.

### 10.3 Costo della vita (popolamento Supabase tramite pipeline Python)

| Voce | Fonte | Formato | Frequenza |
|---|---|---|---|
| Affitto bilocale periferia | **OMI — Agenzia delle Entrate**, Osservatorio Mercato Immobiliare, *Quotazioni immobiliari* per provincia | Excel ogni 6 mesi (I sem / II sem) | semestrale, cache 7 gg |
| Spesa alimentare minima | **ISTAT — Paniere NIC**, sottoinsieme "Prodotti alimentari e bevande analcoliche" | API SDMX JSON | mensile |
| Carburanti (benzina €/L) | **Mimit — Osservatorio Prezzi**, *prezzo_regione_ultime48ore* | JSON API | 48 h, cache 7 gg |
| Bollette stimate (luce+gas+acqua) | **ARERA** stime nazionali + media regionale | manuale, semi-annuale | semestrale |

URL chiave:

- OMI: https://www.agenziaentrate.gov.it/portale/web/guest/schede/fabbricatiterreni/omi/banche-dati/quotazioni-immobiliari
- ISTAT Paniere: https://www.istat.it/it/prezzi/prezzi-al-consumo/paniere · API: `https://sdmx.istat.it/SDMXWS/rest/data/IT1,DF_PREZZI_NIC/...`
- Mimit: https://www.mise.gov.it/index.php/it/mercato-e-consumatori/carburanti · `https://prezzicarburanti.mise.gov.it/PrezziCarburanti/api/prod/prezzo_regione_ultime48ore`

**Fallback**: se Supabase non è configurato o se la cache è vuota, `src/lib/server/costi-fallback.ts`
restituisce valori conservativi stimati al 2024 per 11 capoluoghi + un default
(550 €/affitto, 295 €/spesa, 1,85 €/L, 175 €/bollette). Marcati `fonte: "fallback_statico"`
in modo leggibile dall'UI.

### 10.4 Profit share settoriale (file `src/lib/data/aliquote.json`, chiave `margine_medio_settore`)

Fonte: **ISTAT — Conti economici delle imprese e dei gruppi di imprese, anno 2023**,
pubblicazione ottobre 2025.

- URL: https://www.istat.it/wp-content/uploads/2025/10/Report-Conti-economici-imprese-e-gruppi_2023.pdf
- Indicatore: **MOL / Valore aggiunto a prezzi base**, per divisione ATECO
- Copertura: tutte le imprese italiane non finanziarie con ≥ 1 addetto
- Interpretazione: quota del valore aggiunto non assegnata al lavoro dipendente;
  proxy del *profit share* e, in cornice marxiana, del saggio di sfruttamento.

### 10.5 Uso del tempo (costante vita biologica = 180 h/mese)

Fonte: **ISTAT — *Uso del tempo*** (ultima rilevazione disponibile).
Media giornaliera estratta: pasti ~2 h, cura personale/igiene ~1 h, lavoro
domestico ~2 h, spostamenti non lavorativi ~1 h → **~6 h/giorno × 30 = 180 h/mese**.

URL ISTAT: https://www.istat.it/it/archivio/uso+del+tempo

Riferimento teorico per l'inquadramento "riproduzione sociale": Silvia Federici,
*Il punto zero della rivoluzione*, ombre corte 2014; Nancy Fraser, *Crisis of
Care*, New Left Review 100, 2016.

### 10.6 Province italiane (file `src/lib/data/province.json`)

107 province ISTAT. Schema `{codice, nome, regione, capoluogo}`. Fonte: ISTAT,
*Codici delle unità territoriali*. Licenza CC BY 3.0 IT.
URL: https://www.istat.it/it/archivio/6789

### 10.7 CTA locali (file `src/lib/data/cta.json`)

Sindacati e organizzazioni per provincia, schema `{id, provincia, tipo, nome,
url, tag, descrizione}`. Alimentato via PR community. Tipi attualmente previsti:

- `sindacato_inquilini` (es. SUNIA) — priorità se affitto > 40 % netto
- `sindacato_lavoro` (es. CGIL, USB) — priorità se salario sotto soglia povertà
- `sportello_sociale` (Caritas, centri d'ascolto) — priorità se sopravvivenza > 60 % ore lavoro
- `collettivo_locale` (assemblee territoriali) — sempre come risorsa aggiuntiva

### 10.8 Note legali sulle fonti

Tutti i dati sono **pubblici e liberamente riutilizzabili**:

- **ISTAT**: licenza CC BY 3.0 IT;
- **Agenzia delle Entrate / OMI**: dati pubblici ex L. 241/90;
- **Mimit**: dati pubblici;
- **CCNL**: minimi tabellari = informazioni di pubblica utilità (l'app non
  distribuisce il testo completo dei contratti, solo i valori numerici);
- **INPS / MEF**: dati pubblici in Gazzetta Ufficiale.

---

## 11. Margine d'errore e onestà epistemica

Il motore fiscale dichiara esplicitamente `margine_errore: 0.03` (±3 %) in ogni
output. Motivi principali:

- le **detrazioni per carichi familiari** non sono calcolate (l'app non chiede
  composizione nucleo familiare);
- il **trattamento integrativo** ex-"bonus Renzi" non è applicato automaticamente
  (dipende da soglia di IRPEF netta > detrazioni, caso per caso);
- l'**addizionale comunale** usa la media nazionale 0,8 %, non la tabella
  comune-per-comune;
- i **contributi aggiuntivi** di categoria (fondo sanitario, previdenza
  integrativa) non sono modellati.

Il numero "giorni affitto" è un **artefatto comunicativo**, non una metrica
scientifica: usa giorni di calendario (30), non giorni lavorativi. Un economista
farebbe `affitto / salario_giornaliero`. Noi facciamo `affitto / netto_mensile × 30`
perché il messaggio è: *"il primo tot del mese vive il padrone di casa, poi
vivi tu"*.

Il profit share settoriale è una media, non un valore per azienda: un'impresa
ad alta produttività del lavoro avrà MOL/VA > media di settore, una in crisi
< media. L'app non ha modo di saperlo e lo dichiara.

Il libero reale di 137 h/mese è una **stima superiore**: non sottrae
pendolarismo (se hai 45 min × 2 di viaggio/giorno, togli altre ~30 h),
straordinari non pagati, lavoro di cura di figli/anziani (che per una madre
lavoratrice in Italia supera facilmente 60 h/mese secondo ISTAT *Uso del tempo*).

**Questi limiti sono dichiarati nell'UI**, non nascosti: il margine ±3 % appare
nell'eyebrow del report, il caveat del comparatore è in fondo alla diff-card,
e il dettaglio di ogni segmento della torta compare in hover/focus con un
micro-testo politico-editoriale che spiega *cosa stai guardando*.

---

*Tempo di Vita è un manifesto politico-editoriale con pretese di precisione
economica. Dove i due obiettivi entrano in conflitto, documentiamo il conflitto.*
