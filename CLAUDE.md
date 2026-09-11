# CLAUDE.md — Tempo di Vita 2.0

## Cos'è questo progetto

"Tempo di Vita" è una web app open source che converte il salario in **ore di vita sottratte**.
L'utente sceglie dove vive, che contratto ha e come vive; l'app calcola dove finisce il valore
che produce, quante ore servono per pagare il minimo indispensabile, quanto tempo gli resta —
e quali diritti può esigere subito.

Filosofia: trasparenza totale, privacy by design, nessun tracking, ogni numero rifacibile da chiunque.

> **Leggi `CRITICA.md` prima di toccare il motore.** Contiene la critica del modello v1 e le
> ragioni di ogni scelta della v2. Molte cose che sembrano complicate sono complicate apposta,
> e molte che sembrano semplificabili sono già la versione semplificata di un errore.

---

## Stack

| Ruolo | Tecnologia |
|---|---|
| Frontend + SSR | SvelteKit 2 + Svelte 5 (runes, TypeScript) |
| Styling | CSS custom properties + component styles (NO Tailwind) |
| Visualizzazioni | SVG/CSS scritti a mano — nessuna libreria di grafici |
| Calcolo | Pure functions in `src/lib/engine/`, eseguite nel browser |
| Backend | Nessuno. Una sola route server per l'immagine OG |
| Database | Nessuno. I dati sono file JSON versionati |
| Auth | Nessuna — app completamente anonima |
| Hosting | Vercel (free tier) |
| Licenza | AGPL-3.0 |

**La 2.0 ha eliminato Supabase, D3 e html-to-image.** I costi della vita non sono più
cachati da una pipeline: sono derivati da `€/m² × superficie`, due grandezze pubblicate che
stanno in un file JSON. Niente cache significa niente divergenza fra ciò che l'app mostra e
ciò che il repository dichiara — che è esattamente il punto del progetto.

---

## Struttura directory

```
tempo-di-vita/
├── CLAUDE.md                  ← questo file
├── CRITICA.md                 ← critica del modello v1 e fondamenti della v2
├── ARCHITECTURE.md            ← come si compone il calcolo
├── DATA_SOURCES.md            ← ogni fonte, con data di verifica
├── DESIGN_SYSTEM.md           ← estetica, token, palette dati
├── src/
│   ├── lib/
│   │   ├── engine/            ← motore (puro TS, nessuna dipendenza UI)
│   │   │   ├── fiscal.ts      ← lordo → netto e lordo → costo del lavoro
│   │   │   ├── valore.ts      ← decomposizione del valore aggiunto
│   │   │   ├── tempo.ts       ← ore sottratte e salario orario reale
│   │   │   ├── sopravvivenza.ts ← paniere e ore per coprirlo
│   │   │   ├── aiuti.ts       ← diritti esigibili dati i numeri
│   │   │   └── index.ts       ← composizione: Ingresso → Risultato
│   │   ├── data/              ← ogni numero del modello, con la sua fonte
│   │   │   ├── aliquote.json  ← IRPEF, detrazioni, contributi, quote di settore
│   │   │   ├── ccnl.json      ← minimi contrattuali, con grado di verifica
│   │   │   ├── province.json  ← 107 province: area, tipo comune, €/m²
│   │   │   ├── tempo.json     ← costanti temporali, alloggi, soglie ISTAT
│   │   │   └── aiuti.json     ← misure, soglie, dove si chiedono
│   │   ├── components/        ← Barra, Numero, Aiuti, Metodo, Ticker
│   │   ├── stato.ts           ← stato del calcolatore, URL ⇄ Ingresso
│   │   ├── formato.ts         ← formattazione condivisa
│   │   └── types.ts           ← tipi condivisi
│   ├── routes/
│   │   ├── +layout.svelte
│   │   ├── +page.svelte       ← tutta l'app: calcolatore e risultato
│   │   ├── +page.server.ts    ← SSR del link condiviso e meta tag
│   │   └── api/og/+server.ts  ← immagine 1200×630 per l'anteprima social
│   └── app.css                ← token globali e motion
└── tests/engine/              ← unit test del motore
```

---

## Regole di sviluppo (IMPORTANTI — seguile sempre)

### Privacy
- **MAI** raccogliere email, nome, IP o qualsiasi PII
- Il calcolo avviene **interamente lato client**; il server non vede input
- Nella URL finiscono solo **scelte** (città, contratto, tipo di casa), mai risultati
- Le tre opzioni della sezione aiuti (affitto, under 31, figli) non entrano nemmeno nella URL
- Nessun cookie, nessun analytics, nessuna chiamata a terze parti a runtime

### Il modello
- Tutte le funzioni in `src/lib/engine/` sono **pure** (input → output, nessun effetto)
- **Un solo frame di riferimento**: il valore aggiunto. Profitto, previdenza, imposte e netto
  sommano al valore aggiunto *per costruzione*. Se una modifica rompe il test
  «le quote sommano a 1», la modifica è sbagliata — non il test
- Le ore dei costi si contano al **salario orario reale**, mai a quello nominale
- Il margine d'errore ±3% va **sempre mostrato in UI** vicino al risultato
- L'incertezza sulla quota del lavoro di settore è **separata** dal ±3% e si mostra come banda

### Dati
- **Nessun numero hardcodato nel codice.** Aliquote, soglie, costanti temporali e formule
  stanno nei JSON di `src/lib/data/`. Se una cifra è sbagliata si corregge con una PR su un
  file dati, senza toccare una riga di TypeScript
- Ogni numero porta `fonte` e `url`. I minimi CCNL portano anche `verifica`:
  `tabella` (pubblicato), `riparametrato` (dedotto dalla scala contrattuale), `stima`
- I canoni non si scrivono a mano: sono `€/m² × superficie ÷ persone`

### Frontend
- Stato locale con le rune di Svelte 5; nessuno store globale, nessun dato in localStorage
- Il risultato si aggiorna **mentre** si muove un controllo: niente pulsante «calcola»
- **Ogni grafico deve funzionare senza JavaScript.** Le larghezze finali stanno nel markup
  del server e l'animazione è in CSS; la tabella equivalente è sempre nel DOM
- Le animazioni spiegano qualcosa o non ci sono. `prefers-reduced-motion` le spegne tutte

### Visualizzazioni
- Palette dati in `app.css` (`--tdv-dato-1..4`), **ordine fisso, mai ciclato**
- Steps distinti per tema chiaro e scuro, entrambi validati (non un ribaltamento automatico)
- Legenda sempre presente; etichette dirette solo sui segmenti abbastanza larghi
- I testi portano i token di inchiostro, mai il colore della serie

### Naming
- File: `kebab-case` · TypeScript: `camelCase`, tipi `PascalCase`
- CSS custom properties: prefisso `--tdv-`
- Il codice e i commenti sono in **italiano**, come il progetto

### Testing
- Ogni funzione dell'engine ha unit test in `tests/engine/`
- I test coprono anche gli **invarianti contabili** e gli input degeneri (0, negativi, NaN)
- Non committare codice che rompe i test esistenti

---

## Comandi utili

```bash
npm install
npm run dev            # sviluppo
npm run build          # build di produzione
npm run preview        # anteprima della build
npm run test           # tutti i test
npm run test:engine    # solo il motore
npm run check          # type check
```

Nessuna variabile d'ambiente è necessaria: l'app non parla con nessuno.

---

## Come aggiungere o correggere un dato

1. **Un CCNL**: `src/lib/data/ccnl.json`, schema `CcnlSettore` in `types.ts`.
   Metti `fonte`, `url`, `aggiornato` e il `verifica` giusto per ogni livello.
   PR con titolo `dati: CCNL [settore] aggiornato al [data]`
2. **Un'aliquota o una soglia**: `src/lib/data/aliquote.json`. Aggiorna anche `fonte` e `anno`
3. **Un canone**: `src/lib/data/province.json`, campo `eur_mq`. Non scrivere canoni mensili
4. **Un diritto esigibile**: `src/lib/data/aiuti.json`, schema `VoceAiuto`.
   Deve avere soglia, importo, **dove si chiede** e la norma di riferimento

---

## Filosofia del progetto (non ignorare)

Questa non è una "utility app". È uno strumento politico che rende visibile la teoria del
valore-lavoro. Ogni scelta tecnica deve essere coerente con questo: trasparenza,
verificabilità, anonimato, diffusibilità.

Due domande da farsi davanti a ogni scelta di design o architettura:

1. **"Questo aiuta un lavoratore a capire quanto del suo tempo viene sottratto?"**
2. **"Questo numero, chi non si fida può rifarlo?"**

Se la risposta alla prima è no, la funzionalità non serve — la 2.0 è nata togliendo.
Se la risposta alla seconda è no, il numero non si pubblica.
