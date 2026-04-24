# DATA_SOURCES.md — Fonti dati e aggiornamento

## Dati salariali — CCNL

**File:** `src/lib/data/ccnl.json`
**Frequenza aggiornamento:** 1–2 volte l'anno (rinnovi contrattuali)
**Come aggiornare:** manualmente via PR

### Schema

```json
{
  "settori": [
    {
      "id": "commercio",
      "nome": "Commercio (CCNL Confcommercio)",
      "fonte": "https://www.confcommercio.it/-/ccnl-terziario-contratto",
      "aggiornato": "2024-03-01",
      "livelli": [
        { "livello": "1", "descrizione": "Quadro", "lordo_mensile": 2850 },
        { "livello": "2", "descrizione": "1ª categoria", "lordo_mensile": 2340 },
        { "livello": "3", "descrizione": "2ª categoria", "lordo_mensile": 2010 },
        { "livello": "4", "descrizione": "3ª categoria", "lordo_mensile": 1780 },
        { "livello": "5", "descrizione": "4ª categoria", "lordo_mensile": 1620 }
      ]
    }
  ]
}
```

### CCNL da includere nella versione iniziale

- Commercio (Confcommercio) — ~3M lavoratori
- Metalmeccanici (FIM-CISL / FIOM-CGIL) — ~1.7M lavoratori
- Terziario avanzato (Confcommercio) — ICT, servizi
- Logistica e trasporti
- Edilizia (CCNL Edilizia)
- Pulizie e multiservizi
- Sanità privata
- Ristorazione e turismo (CCNL FIPE)

---

## Costo della vita — fonti per provincia

### Affitti (OMI — Agenzia delle Entrate)

**URL:** https://www.agenziaentrate.gov.it/portale/web/guest/schede/fabbricatiterreni/omi/banche-dati/quotazioni-immobiliari
**Formato:** file Excel scaricabile ogni 6 mesi (I semestre / II semestre)
**Script:** `data-pipeline/scrape_omi.py`

```python
# Dati estratti per provincia:
# - affitto_medio_bilocale_centro (€/mq/anno)
# - affitto_medio_bilocale_periferia (€/mq/anno)
# Usiamo bilocale periferia come baseline "sopravvivenza"
```

### Spesa alimentare (ISTAT — Paniere NIC)

**URL:** https://www.istat.it/it/prezzi/prezzi-al-consumo/paniere
**API SDMX:** `https://sdmx.istat.it/SDMXWS/rest/data/IT1,DF_PREZZI_NIC/...`
**Formato:** JSON via API SDMX
**Frequenza:** mensile

```bash
# Endpoint per spesa minima mensile per adulto (stima):
# Usiamo il sottoinsieme "Prodotti alimentari e bevande analcoliche"
# del paniere NIC, media nazionale per divisione geografica
```

### Carburanti (Mimit — Osservatorio Prezzi)

**URL:** https://www.mise.gov.it/index.php/it/mercato-e-consumatori/carburanti
**API:** `https://prezzicarburanti.mise.gov.it/PrezziCarburanti/api/prod/prezzo_regione_ultime48ore`
**Formato:** JSON
**Frequenza:** aggiornato ogni 48h — cachato 7 giorni in Supabase

---

## Dati fiscali

**File:** `src/lib/data/aliquote.json`
**Frequenza aggiornamento:** 1 volta l'anno (Legge di Bilancio)
**Come aggiornare:** PR manuale dopo pubblicazione in Gazzetta Ufficiale

### Schema

```json
{
  "anno": 2026,
  "fonte": "https://www.agenziaentrate.gov.it/portale/imposta-sul-reddito-delle-persone-fisiche-irpef-/aliquote-e-calcolo-dell-irpef",
  "irpef": {
    "scaglioni": [
      { "da": 0,     "a": 28000,  "aliquota": 0.23 },
      { "da": 28001, "a": 50000,  "aliquota": 0.33 },
      { "da": 50001, "a": null,   "aliquota": 0.43 }
    ],
    "detrazioni_lavoro_dipendente": {
      "formula": "vedere fiscal.ts"
    }
  },
  "inps": {
    "dipendente": {
      "aliquota": 0.0919,
      "massimale_annuo": 113520
    },
    "partiva_gestione_separata": {
      "aliquota": 0.2623
    }
  },
  "addizionali_regionali": {
    "lombardia": 0.0173,
    "lazio": 0.0333,
    "campania": 0.02,
    "emilia-romagna": 0.0133,
    "veneto": 0.0123
  },
  "addizionali_comunali_media": 0.008
}
```

---

## CTA locali — Call to Action

**File:** `src/lib/data/cta.json`
**Frequenza aggiornamento:** continua (contributi community)

### Schema

```json
{
  "entries": [
    {
      "id": "sunia-bologna",
      "provincia": "BO",
      "tipo": "sindacato_inquilini",
      "nome": "SUNIA Bologna — Sindacato Unitario Nazionale Inquilini",
      "url": "https://www.suniaer.it/bologna/",
      "tag": ["affitto", "sfratto", "diritti"],
      "descrizione": "Tutela legale inquilini, sportello consulenza affitti"
    }
  ]
}
```

### Tipi di CTA

| tipo | quando mostrarlo |
|---|---|
| `sindacato_inquilini` | se affitto > 40% del netto |
| `sindacato_lavoro` | se salario < soglia povertà relativa |
| `sportello_sociale` | se tempo sopravvivenza > 60% ore lavoro |
| `collettivo_locale` | sempre, come risorsa aggiuntiva |

---

## Note legali sulle fonti

Tutti i dati usati sono **pubblici e liberamente riutilizzabili**:
- ISTAT: licenza CC BY 3.0 IT
- Agenzia delle Entrate (OMI): dati pubblici ex L. 241/90
- Mimit: dati pubblici
- CCNL: minimi tabellari sono dati pubblici (non il testo completo del contratto)

Il progetto non distribuisce testi contrattuali completi, solo i valori numerici
dei minimi tabellari, che sono informazioni di pubblica utilità.

---

## Storico verifiche fonti

### 2026-04-23 — Audit URL (pre-deploy)

Verifica manuale di tutti gli URL in `aliquote.json`, `ccnl.json`, `cta.json` e
in questo documento. Esito:

- **Agenzia Entrate IRPEF** — il vecchio URL `/portale/web/guest/aliquote-irpef-2024`
  restituisce 404. Sostituito con `/portale/imposta-sul-reddito-delle-persone-fisiche-irpef-/aliquote-e-calcolo-dell-irpef`.
- **Aliquote IRPEF** — secondo scaglione aggiornato dal 35 % al 33 % per
  Legge 30/12/2025 n. 199 (Bilancio 2026). Campo `anno` portato a 2026.
- **Confcommercio** — vecchio URL dead, sostituito con la nuova landing stabile
  `/-/ccnl-terziario-contratto`.
- **Federmeccanica PDF 2021** — link PDF morto. Sostituito con la pagina FIOM-CGIL
  che ospita il testo depositato (più stabile nel tempo).
- **Confetra** — rotta CCNL non trovata. Sostituito con la pagina FILT-CGIL
  dedicata ai contratti trasporto merci.
- **FIPE** — sostituito con la categoria `area-lavoro/testo-ccnl-fipe/`.
- **SUNIA Lazio** (`sunialazio.it`) — dominio non più risolvibile. Sostituito
  con la sezione Roma del portale nazionale SUNIA.
- **Unione Inquilini Napoli** — pagina sezione provinciale non esistente.
  Rimpiazzata con l'indice nazionale delle sedi.
- **FIOM Torino** (`fiomtorino.it`) — redirect 301 verso il sito regionale
  FIOM Piemonte, adottato come canonico.
- **ISTAT SBS 2023** — PDF funzionante, nessuna modifica.
- **SUNIA Bologna** (`suniaer.it/bologna/`), **CGIL Milano** (`cgil.milano.it`) —
  OK, nessuna modifica.
