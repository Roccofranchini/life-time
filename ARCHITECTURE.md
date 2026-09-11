# ARCHITECTURE.md — Tempo di Vita 2.0

## Panoramica

```
┌──────────────────────────────────────────────────────────────┐
│                      BROWSER (client)                        │
│                                                              │
│   controlli ──▶ Stato ──▶ risolviIngresso ──▶ calcola()      │
│      ▲                                            │          │
│      │                                            ▼          │
│   URL (?p=MI&s=…)  ◀── statoInQuery ──      Risultato ──▶ UI │
│                                                              │
│   Tutto qui dentro. Nessuna richiesta parte durante l'uso.   │
└───────────────────────────┬──────────────────────────────────┘
                            │  solo al primo caricamento
                            ▼
┌──────────────────────────────────────────────────────────────┐
│                    SERVER (SvelteKit / Vercel)               │
│                                                              │
│   +page.server.ts   rifà lo stesso calcolo per il SSR e i    │
│                     meta tag del link condiviso              │
│   /api/og           rifà lo stesso calcolo e disegna il PNG  │
│                                                              │
│   Nessun database, nessuna cache, nessuna API esterna.       │
└──────────────────────────────────────────────────────────────┘
```

Server e client chiamano **la stessa funzione sugli stessi dati**: il risultato
renderizzato dal server non può divergere da quello che compare dopo l'idratazione,
e l'anteprima social non può mostrare un numero diverso dalla pagina.

---

## La catena del calcolo

Il modello ha un solo denominatore: il **valore aggiunto prodotto in un'ora di lavoro**.
Ogni passaggio è una funzione pura e ogni euro finisce in una e una sola destinazione.

```
                    minimo CCNL × mensilità
                              │
                              ▼
                        lordo annuo (RAL)
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
  contributi            contributi             IRPEF, addizionali
  lavoratore              datore               − detrazioni
        │                  + TFR               − taglio del cuneo
        │                     │                − trattamento integrativo
        │                     ▼                     │
        │             costo del lavoro              │
        │                     │                     │
        │            ÷ quota lavoro settore         │
        │                     ▼                     │
        │             valore aggiunto               │
        │                     │                     │
        └──────────┬──────────┴──────────┬──────────┘
                   ▼                     ▼
        ╔══════════════════════════════════════════╗
        ║  profitto + previdenza + imposte + netto ║
        ║         = valore aggiunto  (esatto)      ║
        ╚══════════════════════════════════════════╝
                              │
                              ▼
        netto − costi imposti dal lavoro
        ─────────────────────────────────  = salario orario REALE
        ore contratto + tragitto + strao
                              │
                              ▼
        costi fissi ÷ salario orario reale = ore di sopravvivenza
```

### Perché un solo denominatore

Nella v1 le fette della torta avevano denominatori diversi — il cuneo era una quota
del salario, il margine una quota del valore aggiunto — e la somma sforava il totale.
C'era voluta una toppa aritmetica per impedire al grafico di esplodere. Qui le quattro
destinazioni sono quote di **una stessa somma**, quindi l'overflow non è rappresentabile.
Il test `le quote sommano a 1` lo verifica su tutte le combinazioni di settore e reddito.
La storia completa sta in `CRITICA.md` §1.

---

## I moduli

| Modulo | Responsabilità | Non fa |
|---|---|---|
| `engine/fiscal.ts` | RAL → netto, RAL → costo del lavoro | non sa nulla di tempo né di costi |
| `engine/valore.ts` | costo del lavoro → valore aggiunto → 4 quote | non ricalcola il fisco |
| `engine/tempo.ts` | ore sottratte, salario orario reale | non sa nulla di affitti |
| `engine/sopravvivenza.ts` | paniere, canone derivato, ore per coprirlo | non sa nulla di fisco |
| `engine/aiuti.ts` | quali diritti spettano, dati i numeri | non calcola l'ISEE |
| `engine/index.ts` | compone i quattro in `calcola()` | non contiene formule |
| `stato.ts` | Stato ⇄ URL, Stato → Ingresso | non calcola |
| `formato.ts` | ore ed euro in stringa | non arrotonda per finta |

L'ordine in `calcola()` non è arbitrario: il fisco dà il netto, il netto e le ore danno il
salario orario reale, e solo il salario orario reale permette di convertire i costi in ore.

---

## Dove stanno i numeri

Nessuna cifra vive nel codice. `src/lib/data/` contiene cinque file, ognuno con `fonte`,
`url` e data di verifica accanto a ogni gruppo di valori:

| File | Contiene |
|---|---|
| `aliquote.json` | scaglioni IRPEF, detrazioni, taglio del cuneo, contributi, quote di settore |
| `ccnl.json` | minimi contrattuali, con il grado di verifica di ogni livello |
| `province.json` | 107 province: ripartizione, tipo di comune, €/m² |
| `tempo.json` | costanti temporali, tipi di alloggio, soglie di povertà ISTAT |
| `aiuti.json` | misure esigibili, soglie, dove si chiedono |

Il motore li legge come moduli TypeScript: Vite li impacchetta nel bundle, quindi non c'è
nessuna lettura a runtime e nessun punto in cui i dati possano divergere dal repository.

---

## Stato e URL

Lo stato del calcolatore vive nel componente di pagina. La URL lo segue con 250 ms di
ritardo, riscritta con `history.replaceState` nativo: cambia solo la query, mai il percorso,
e `history.state` viene ripassato intatto perché il router di SvelteKit non se ne accorga.

Il `replaceState` di SvelteKit **non** è utilizzabile qui: chiamato da dentro un effetto
rientra nel proprio flush e va in errore al primo aggiornamento, lasciando la URL ferma al
valore iniziale — con il risultato che il link condiviso mostrerebbe un calcolo diverso da
quello sullo schermo.

Nella URL finiscono solo scelte. Mai un numero calcolato, mai nulla di identificante.

---

## Rendering senza JavaScript

Requisito del progetto, non cortesia: le larghezze finali dei segmenti sono nel markup
prodotto dal server e l'animazione di crescita è una `@keyframes` CSS su `scaleX`. Con
JavaScript disattivato la barra è ferma e corretta; la tabella equivalente è sempre nel DOM,
dentro un `<details>`, ed è ciò che leggono gli screen reader.

---

## Cosa è stato rimosso nella 2.0

| Rimosso | Perché |
|---|---|
| Supabase e cache dei costi | i canoni sono derivati da dati versionati: la cache poteva solo introdurre divergenza |
| `POST /api/calcola`, `GET /api/costi/:p` | il calcolo è puro e sta nel browser |
| Route `/report` e store globali | una schermata sola: niente stato da trasportare |
| D3 | due barre impilate non giustificano 90 kB di libreria |
| html-to-image e export PNG | l'immagine OG del link condiviso fa lo stesso lavoro, lato server |
| Globo, comparatore città, serie storica, modalità obiettivo | non passavano la domanda del manifesto |

Il criterio è in `CLAUDE.md`: *"questo aiuta un lavoratore a capire quanto del suo tempo
viene sottratto?"*. Ciò che non passava l'esame è uscito.
