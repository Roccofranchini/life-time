# DESIGN_SYSTEM.md — Tempo di Vita

## Estetica di riferimento

L'app è un incrocio tra:
- **Giornalismo di inchiesta** (Le Monde Diplomatique, Il Manifesto)
- **Hacker culture** (terminale, monospace, dati grezzi esposti)
- **Manifesto politico** (urgenza, chiarezza, resistenza)
- **Desiderio di vivere** (non solo rabbia — anche speranza, il verde del tempo libero)

Il tono visivo è: **dark, editoriale, tagliente**. Non una startup fintech. Non un'app di wellness.
Un oggetto di coscienza.

---

## Palette colori — USARE SOLO QUESTI VALORI

```css
:root {
  /* Fondamentali */
  --tdv-bg:         #0a0a08;    /* nero quasi-nero con tonalità calda */
  --tdv-ink:        #f0ede6;    /* bianco carta, non bianco puro */
  --tdv-ink2:       #a09e96;    /* testo secondario */
  --tdv-ink3:       #5a5850;    /* testo terziario, bordi sottili */

  /* Accenti */
  --tdv-red:        #c8291e;    /* rosso principale — resistenza */
  --tdv-red2:       #e03328;    /* rosso hover */
  --tdv-red-dim:    rgba(200,41,30,0.15);  /* sfondo sottile rosso */
  --tdv-green:      #1D9E75;    /* tempo libero reale — speranza */

  /* Struttura */
  --tdv-grid:       rgba(240,237,230,0.04);  /* griglia di sfondo */
  --tdv-border:     rgba(240,237,230,0.10);  /* bordi standard */
  --tdv-border2:    rgba(240,237,230,0.06);  /* bordi più sottili */
}
```

### Assegnazione semantica colori

| Colore | Significato | Dove usarlo |
|---|---|---|
| `--tdv-red` | Sopravvivenza · Urgenza · Resistenza | Affitto, tasse, elementi di denuncia |
| `--tdv-green` | Tempo libero · Speranza · Vita | Il tempo che resta, CTA positive |
| `--tdv-ink3` | Stato · Tasse | Segmento "ore per lo stato" |
| `#3d3d38` | Capitale · Profitto estratto | Segmento meno visibile, quasi-nascosto |
| `--tdv-ink` | Neutro · Struttura | Testo principale, layout |

---

## Tipografia

### Font

```html
<!-- In <head> — caricare entrambi -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:ital,wght@0,400;0,600;1,400&family=Playfair+Display:ital,wght@0,700;1,700&display=swap" rel="stylesheet">
```

```css
--tdv-mono:   'IBM Plex Mono', monospace;   /* UI, dati, codice */
--tdv-serif:  'Playfair Display', serif;    /* titoli, numeri hero, citazioni */
```

### Scale tipografica

| Nome | Font | Size | Weight | Uso |
|---|---|---|---|---|
| `display` | Playfair, italic | 48–56px | 700 | Titolo hero |
| `number-hero` | Playfair, italic | 32–42px | 700 | Numeri chiave (18 giorni, 8h) |
| `heading` | IBM Plex Mono | 18–22px | 600 | Titoli sezione |
| `body` | IBM Plex Mono | 13px | 400 | Testo narrativo |
| `label` | IBM Plex Mono | 9–10px | 400 | Label uppercase con letter-spacing 0.14em |
| `mono-data` | IBM Plex Mono | 11–13px | 400/600 | Output calcoli, codice |

### Regole tipografiche

- Titoli hero: **sempre italic** con Playfair
- Label di sezione: UPPERCASE + letter-spacing 0.14–0.18em + colore `--tdv-red`
- Numeri di impatto: Playfair italic, dimensioni generose
- Testo corpo: IBM Plex Mono, line-height 1.8
- **MAI** Inter, Roboto, Arial, SF Pro o font di sistema generici

---

## Layout

### Griglia di sfondo

```css
.page-bg {
  background-color: var(--tdv-bg);
  background-image:
    linear-gradient(var(--tdv-grid) 1px, transparent 1px),
    linear-gradient(90deg, var(--tdv-grid) 1px, transparent 1px);
  background-size: 40px 40px;
}
```

### Struttura pagine

```
┌─────────────────────────────────────┐
│  NAV (10px mono uppercase)          │
├─────────────────────────────────────┤
│  TICKER (rosso, scroll animato)     │
├──────────────────────┬──────────────┤
│  HERO LEFT           │  GLOBO       │
│  (titolo + stat)     │  (canvas)    │
├──────────────────────┴──────────────┤
│  CONTENUTO PRINCIPALE               │
└─────────────────────────────────────┘
```

### Bordi e separatori

```css
/* Bordo standard tra sezioni */
border-bottom: 1px solid var(--tdv-border);

/* Bordo enfatico (es. accent left) */
border-left: 2px solid var(--tdv-red);

/* MAI box-shadow decorativo */
/* MAI border-radius > 4px su elementi UI (l'app è spigolosa) */
/* ECCEZIONE: border-radius: 0 ovunque, salvo bottoni che possono avere 0px */
```

---

## Componenti UI

### Nav bar

```css
.nav {
  display: flex;
  border-bottom: 1px solid var(--tdv-border);
  font-family: var(--tdv-mono);
  font-size: 10px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--tdv-ink3);
}
.nav-item {
  padding: 12px 20px;
  border-right: 1px solid var(--tdv-border);
  cursor: pointer;
  transition: color 0.2s;
}
.nav-item:hover { color: var(--tdv-ink); }
.nav-item.active {
  color: var(--tdv-red);
  border-bottom: 2px solid var(--tdv-red);
  margin-bottom: -1px;
}
```

### Ticker di emergenza

```css
.ticker {
  background: var(--tdv-red);
  color: #fff;
  font-family: var(--tdv-mono);
  font-size: 9px;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  padding: 7px 0;
  overflow: hidden;
  white-space: nowrap;
}
.ticker-inner {
  display: inline-block;
  animation: ticker-scroll 25s linear infinite;
  padding-left: 100%;
}
@keyframes ticker-scroll {
  from { transform: translateX(0); }
  to { transform: translateX(-100%); }
}
```

Testo ticker: messaggi brevi, taglienti, politicamente diretti.
Es: "★ il tempo è l'unica risorsa non rinnovabile · ★ lavori per vivere, o vivi per lavorare"

### Label di sezione

```css
.section-label {
  font-family: var(--tdv-mono);
  font-size: 9px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--tdv-red);
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.section-label::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--tdv-red-dim);
}
```

### Select / Input

```css
.tdv-select, .tdv-input {
  width: 100%;
  background: transparent;
  border: 1px solid var(--tdv-border);
  color: var(--tdv-ink);
  font-family: var(--tdv-mono);
  font-size: 13px;
  padding: 10px 14px;
  appearance: none;
  border-radius: 0;
  transition: border-color 0.2s;
}
.tdv-select:focus, .tdv-input:focus {
  outline: none;
  border-color: var(--tdv-red);
}
```

### Bottone principale CTA

```css
.tdv-btn-primary {
  width: 100%;
  background: var(--tdv-red);
  color: #fff;
  border: none;
  border-radius: 0;
  font-family: var(--tdv-mono);
  font-size: 11px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  padding: 14px 20px;
  cursor: pointer;
  transition: background 0.2s;
}
.tdv-btn-primary:hover { background: var(--tdv-red2); }

.tdv-btn-ghost {
  background: transparent;
  color: var(--tdv-ink2);
  border: 1px solid var(--tdv-border);
  /* stesse dimensioni del primary */
}
.tdv-btn-ghost:hover { border-color: var(--tdv-ink3); color: var(--tdv-ink); }
```

### Stat card (numeri di impatto)

```css
.stat-item {
  /* nessun box, solo tipografia */
}
.stat-n {
  font-family: var(--tdv-serif);
  font-size: 32px;
  font-style: italic;
  color: var(--tdv-ink);
  line-height: 1;
}
.stat-n.red   { color: var(--tdv-red); }
.stat-n.green { color: var(--tdv-green); }
.stat-n.dim   { color: var(--tdv-ink3); }
.stat-l {
  font-family: var(--tdv-mono);
  font-size: 9px;
  letter-spacing: 0.12em;
  color: var(--tdv-ink3);
  text-transform: uppercase;
  margin-top: 4px;
}
```

### Privacy note

```css
.privacy-note {
  font-family: var(--tdv-mono);
  font-size: 9px;
  color: var(--tdv-ink3);
  text-align: center;
  margin-top: 10px;
  line-height: 1.6;
}
```

---

## Animazioni speciali

### Globo rotante (Canvas 2D)

Il globo è un elemento identitario dell'app. Si trova nell'hero.
Implementazione: Canvas 2D con proiezione sferica manuale (no librerie).

Caratteristiche:
- Sfondo: nero con griglia di meridiani/paralleli sottilissima (`rgba(240,237,230,0.05)`)
- Continenti: filled in rosso (`rgba(200,41,30,0.22)`) con bordo rosso
- Alone pulsante esterno: `rgba(200,41,30,0.12-0.20)` che pulsa lentamente
- Rotazione: continua, lenta (angle += 0.006 per frame)
- Stelle di sfondo: mix di puntini bianchi e stelle rosse a 5 punte che lampeggiano
- Label: "IT · 2024" sotto il globo in IBM Plex Mono

```javascript
// Struttura base — vedere il mockup interattivo per l'implementazione completa
// Il file va in: src/lib/components/Globe.svelte
// Props: size (number), speed (number, default 0.006)
```

### Stella a 5 punte (CSS puro)

```css
.star {
  width: 10px;
  height: 10px;
  background: var(--tdv-red);
  clip-path: polygon(
    50% 0%, 61% 35%, 98% 35%, 68% 57%,
    79% 91%, 50% 70%, 21% 91%, 32% 57%,
    2% 35%, 39% 35%
  );
}
```

### Triangolo puntato (eyebrow)

```css
.eyebrow::before {
  content: '';
  display: inline-block;
  width: 6px; height: 6px;
  background: var(--tdv-red);
  clip-path: polygon(50% 0%, 100% 100%, 0% 100%);
  animation: pulse-triangle 2s ease-in-out infinite;
}
@keyframes pulse-triangle {
  0%,100% { opacity: 1; transform: scale(1); }
  50%      { opacity: 0.5; transform: scale(0.8); }
}
```

### Torta D3 — colori dei segmenti

```javascript
const SEGMENT_COLORS = {
  sopravvivenza: 'var(--tdv-red)',      // affitto + spesa + bollette
  stato:         'var(--tdv-ink3)',     // tasse
  capitale:      '#3d3d38',            // profitto estratto (quasi-invisibile)
  libero:        'var(--tdv-green)',    // tempo libero reale
};
// Il segmento "capitale" è volutamente scuro/nascosto — è il surplus estratto
// Il segmento "libero" è volutamente verde speranza
```

---

## Tono del copy (regole per i testi)

- **Diretto, non diplomatico**: "Lavori X giorni al mese per l'affitto" non "X giorni sono dedicati all'affitto"
- **Prima persona plurale dove possibile**: "Il nostro tempo" non "Il tempo dell'utente"
- **Dati grezzi esposti**: mostrare le formule, i margini di errore, le fonti
- **Nessun edulcorante**: il segmento "capitale" si chiama "profitto estratto dall'azienda", non "costi aziendali"
- **Privacy dichiarata**: ogni form ha la nota "Nessun dato inviato. Nessun account. Nessun cookie."

### Esempi di copy corretto

```
✓ "Lavori 18 giorni al mese per pagare l'affitto."
✓ "Il tuo datore di lavoro guadagna X ore del tuo tempo ogni mese."
✓ "Stima fiscale con margine ±3% — vedi il codice sorgente."
✓ "Se ti trasferisci a Ferrara recuperi 15 ore di vita al mese."

✗ "Ottimizza le tue finanze personali"
✗ "Benessere economico"
✗ "Il tuo profilo finanziario"
```

---

## File Svelte — struttura componenti

```
src/
├── app.css                    ← tutte le variabili CSS :root qui
├── lib/components/
│   ├── Globe.svelte           ← globo Canvas (props: size, speed)
│   ├── Ticker.svelte          ← barra rossa scorrevole (props: messages[])
│   ├── SectionLabel.svelte    ← label uppercase rosso con linea
│   ├── StatCard.svelte        ← numero hero + label (props: value, label, color)
│   ├── LifeRing.svelte        ← grafico a torta D3 (props: breakdown)
│   ├── WizardStep.svelte      ← singolo step del wizard
│   └── CtaCard.svelte         ← card CTA locale
```

---

## Cose da NON fare (anti-pattern)

```
✗ border-radius elevati (> 4px) — l'app è editoriale, non "friendly"
✗ gradients decorativi — solo tinta piatta
✗ Inter / Roboto / SF Pro — usare solo IBM Plex Mono + Playfair Display
✗ blu come colore primario — il progetto non è corporate
✗ icone SVG elaborate — usare clip-path geometrici (stella, triangolo)
✗ animazioni veloci o nervose — tutto deve essere lento, deliberato
✗ card con ombra — solo bordi sottili
✗ linguaggio neutro nel copy — ogni parola deve avere una posizione
✗ background bianco — il progetto è sempre dark
```
