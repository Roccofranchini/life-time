# DATA_SOURCES.md — Fonti

**Ultima verifica: 10 settembre 2026.** Ogni fonte qui sotto è stata riaperta e ricontrollata
in quella data. Dove il valore pubblicato non copriva tutti i casi, il file dati dice
esplicitamente che si tratta di una ricostruzione e come è stata fatta.

Regola del progetto: se un numero non ha una fonte pubblica e verificabile, non entra
nell'app. Se ce l'ha ma è incerto, entra dichiarando la propria incertezza.

---

## 1. Fisco — `src/lib/data/aliquote.json`

| Voce | Valore 2026 | Fonte |
|---|---|---|
| Scaglioni IRPEF | 23% fino a 28k · **33%** 28–50k · 43% oltre | Legge di Bilancio 2026 (L. 199/2025), art. 1 |
| Detrazione lavoro dipendente | 1.955 € fino a 15k; formule TUIR sopra | TUIR art. 13 c. 1 |
| No tax area | 8.500 € | TUIR art. 13 |
| Somma integrativa (taglio del cuneo) | 7,1% / 5,3% / 4,8% del reddito da lavoro, fino a 20k di reddito complessivo | L. 207/2024 art. 1 c. 4-5 |
| Ulteriore detrazione | 1.000 € fra 20k e 32k, a scalare fino a 40k | L. 207/2024 art. 1 c. 6 |
| Trattamento integrativo | 1.200 € fino a 15k; parziale fino a 28k | D.L. 3/2020, confermato e cumulabile |
| Contributi IVS lavoratore | 9,19% | INPS, aliquota FPLD |
| Aliquota aggiuntiva +1% | sopra **56.224 €** (prima fascia pensionabile) | art. 3-ter D.L. 384/1992; INPS circ. 6/2026 |
| Massimale contributivo | **122.295 €** | INPS circ. 6/2026 |
| Contributi IVS datore | 23,81% | INPS, ripartizione 33% |
| Altri contributi datore | 6,8% medio (NASpI, CIG, malattia, maternità, fondo garanzia, INAIL) | aggregato, con incertezza dichiarata ±2% |
| TFR | 7,41% − 0,50% = 6,91% | art. 2120 c.c. |
| Gestione separata | 26,23% | INPS |

> **Il secondo scaglione è al 33%, non al 35%.** La riduzione è la novità della Legge di
> Bilancio 2026 e vale fino a 440 € l'anno, con recupero sopra i 200.000 €.

> **La detrazione è discontinua a 15.000 € e non è un errore.** Un euro sopra la soglia passa
> da 1.955 a 3.100 €; il salto compensa la perdita del trattamento integrativo da 1.200 €.
> Il test verifica l'invariante che conta davvero: il *netto* cresce sempre col lordo.

---

## 2. Contratti — `src/lib/data/ccnl.json`

Ogni livello dichiara come è stato ottenuto:

- `tabella` — importo pubblicato dalle parti firmatarie o dai sindacati di categoria
- `riparametrato` — ricavato dalla scala di riparametrazione contrattuale a partire da un
  livello pubblicato. È il meccanismo con cui il contratto stesso fissa gli altri livelli
- `stima` — ordine di grandezza, segnalato anche nell'interfaccia

| Settore | In vigore da | Mensilità | Riferimento |
|---|---|---|---|
| Terziario Confcommercio | 1/11/2026 | 14 | rinnovo 22/3/2024, quarta tranche (+35 € al IV livello) |
| Metalmeccanici Federmeccanica-Assistal | 1/6/2026 | 13 | rinnovo 11/2025, terza tranche (+53,17 € al C3) |
| Logistica, trasporto merci | 1/1/2026 | 13 | rinnovo 6/12/2024, seconda tranche |
| Pubblici esercizi FIPE | 1/6/2026 | 14 | rinnovo 26/5/2026, terza tranche |
| Funzioni centrali (ARAN) | 1/2/2025 | 13 | CCNL 2022-2024, sottoscritto 27/1/2025 |
| Istruzione e ricerca — scuola | 1/1/2026 | 13 | CCNL 2022-2024, sottoscritto 23/12/2025 |
| Borsa di dottorato | 2024 | 12 | DM MUR 630/2023 |

Verifiche fatte per la 2.0:

- **La v1 confondeva il minimo tabellare con il lordo mensile.** Per il commercio il IV
  livello ha un minimo tabellare di 1.292,46 €, ma il lordo è 1.827,01 € perché ci vanno
  sommate contingenza (congelata dal 1992) ed EDR. Ora i tre componenti sono separati nel file
- **La v1 usava 13 mensilità per tutti.** Commercio e pubblici esercizi ne hanno 14:
  un errore del 7,7% sulla RAL annua di due dei settori più rappresentati
- **La classificazione dei metalmeccanici è cambiata** col rinnovo 2021: i livelli sono
  D1…A1, non più 1°…7°

I minimi restano un **pavimento**. Superminimi, scatti, indennità e premi non ci sono: per
questo l'app ha l'inserimento diretto del proprio lordo, che è sempre più preciso.

---

## 3. Territorio e canoni — `src/lib/data/province.json`

- **Ripartizioni geografiche**: ISTAT (nord / centro / mezzogiorno)
- **Città metropolitane**: L. 56/2014 (14 comuni)
- **Ampiezza del comune**: metropoli / grande (≥ 50.000 ab.) / piccolo
- **Canoni**: €/m² stimati per la periferia del capoluogo, ricostruiti da quotazioni OMI e
  rilevazioni idealista/Immobiliare.it, aggiornati all'indice dei canoni Q2 2026 (+9% sul 2024)

Il file **non contiene canoni mensili**. Contiene €/m². Il canone è sempre
`€/m² × superficie ÷ persone`, dove le superfici stanno in `tempo.json`. Due grandezze
pubblicate e un'operazione: chiunque può rifare il conto e contestarlo, che è il punto.

Riferimenti di controllo a Q2 2026: Milano 23,3 €/m² di media cittadina, Roma 19,2,
Bologna 17,3, Napoli 15,5. I valori del file sono i corrispondenti di periferia.

---

## 4. Tempo e soglie — `src/lib/data/tempo.json`

| Voce | Valore | Fonte |
|---|---|---|
| Soglia di povertà assoluta, adulto solo | 695–917 €/mese secondo zona | ISTAT, *La povertà in Italia — Anno 2024* (14/10/2025) |
| Pendolarismo | ~34 min a tratta; il modello usa 60 min al giorno | ISTAT, spostamenti quotidiani per lavoro |
| Lavoro familiare, uomini occupati | 1h 48m al giorno | ISTAT, Rapporto Annuale 2026 su Uso del tempo 2023 |
| Lavoro familiare, donne occupate | 4h 10m al giorno | idem |
| Sonno | 8h | ISTAT, Uso del tempo |
| Cura personale non-sonno | 2h 30m | ISTAT, Uso del tempo |
| Costo chilometrico auto | 0,35 €/km | ACI, costi chilometrici |

**Le soglie di povertà sono una ricostruzione, e il file lo dice.** Due valori pubblicati
fissano gli estremi — 916,98 €/mese al centro di un'area metropolitana del Nord e 760,22 € in
Sicilia — e le celle intermedie seguono il differenziale ISTAT per ampiezza del comune.
Per il proprio caso esatto c'è il [calcolatore ufficiale ISTAT](https://www.istat.it/notizia/online-il-nuovo-calcolatore-della-soglia-di-poverta-assoluta/), linkato nell'app.

**La quota non abitativa del 62% è un'assunzione dichiarata**, non un dato ISTAT: serve a
sommare il canone di mercato effettivo al resto del paniere senza contare due volte la casa.

---

## 5. Quota del lavoro sul valore aggiunto — `src/lib/data/aliquote.json`

Misura la quota del valore aggiunto che va al lavoro dipendente. Il complemento a 1 è il
margine operativo lordo. Base: quota aggregata del lavoro al **44%** (stima ISTAT 2024) e
**51%** nel campione di imprese private Mediobanca; i valori per settore sono ordinati per
intensità di lavoro su quella base.

**Tre limiti, dichiarati anche nell'interfaccia:**

1. Il MOL non è profitto netto: contiene gli ammortamenti del capitale fisso
2. Nel tessuto italiano di microimprese contiene anche reddito misto — lavoro non retribuito
   di titolari e familiari
3. È una media di settore: non descrive la singola impresa né il singolo rapporto di lavoro

Per questo il profitto è mostrato come **banda min-max** (±0,08 sulla quota) e mai come
numero secco. Un numero puntuale su un parametro così incerto sarebbe una bugia con più
cifre decimali.

Per PA, enti locali e scuola la quota è posta a 1: nel settore pubblico non c'è estrazione di
profitto privato. È una scelta editoriale conservativa, non una misura.

---

## 6. Diritti esigibili — `src/lib/data/aiuti.json`

| Misura | Soglia 2026 | Fonte |
|---|---|---|
| Detrazione affitto under 31 | reddito ≤ 15.493,71 €, età 20-30 | art. 16 c. 1-ter TUIR |
| Detrazione affitto abitazione principale | ≤ 15.493,71 € → 300 €; ≤ 30.987,41 € → 150 € | art. 16 c. 01 TUIR |
| Canone concordato | — | L. 431/1998 art. 2 c. 3 |
| Bonus sociale bollette | ISEE ≤ **9.796 €** (20.000 con 4+ figli) | ARERA, soglia aggiornata dal 1/1/2026 |
| Carta «Dedicata a te» | ISEE ≤ 15.000 € | decreto annuale MASAF |
| Assegno di inclusione | ISEE ≤ 10.140 €; franchigia prima casa salita a 91.500 € | D.L. 48/2023, mod. L. Bilancio 2026 |
| Assegno unico | nessuna soglia; importo pieno con ISEE ≤ 17.227,33 € | D.Lgs. 230/2021 |
| NASpI | domanda entro 68 giorni | D.Lgs. 22/2015 |

L'app **non calcola l'ISEE** — dipende dal patrimonio, che non chiede. Le misure che ne
dipendono sono marcate «probabile» e mai «certo».

---

## Come contestare un numero

Ogni cifra sta in un JSON versionato con la sua fonte accanto. Se ne trovi una sbagliata,
apri una pull request sul file dati: non serve toccare una riga di codice, e il test
dell'engine dirà subito se la correzione rompe un invariante contabile.
