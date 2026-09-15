# Critica del modello — da v1 a v2

Documento di lavoro. Serve a rendere esplicito **cosa non funzionava** nella prima
versione di *Tempo di Vita* e **su quale base teorica** è costruita la seconda.
È materiale politico, non solo tecnico: un'app che dice a un lavoratore quanto
tempo gli viene sottratto deve poter reggere una discussione, non solo un test unitario.

---

## 1. L'errore centrale: due frame di riferimento incompatibili

La v1 costruiva la torta del mese così:

```
ore_stato     = cuneo_fiscale × ore_lavoro       cuneo = tasse / LORDO del lavoratore
ore_capitale  = margine_settore × ore_lavoro     margine = MOL / VALORE AGGIUNTO dell'impresa
```

Le due frazioni hanno **denominatori diversi**. Il cuneo è una quota del salario
lordo; il margine è una quota del valore aggiunto, che è una grandezza molto più
grande (il salario lordo ne è solo una parte). Sommarle e disegnarle come fette
adiacenti della stessa torta è un errore di categoria: equivale a sommare il 30%
di 100 con il 30% di 300 e chiamarlo 60%.

La conseguenza pratica: i segmenti non chiudevano. La v1 aveva già dovuto
introdurre una toppa — il commit `8154db6 fix(engine): correggi overflow torta` —
che riscalava `ore_sopravvivenza` con un fattore `(1 − cuneo − margine)` per
impedire alla somma di sfondare il totale. Una toppa aritmetica su un problema
teorico: il grafico smetteva di sforare ma continuava a non significare niente.

**Correzione v2.** Un solo denominatore per tutto: **il valore aggiunto prodotto
in un'ora di lavoro**. Ogni euro prodotto in quell'ora va in uno e un solo posto:

```
VA/ora  =  profitto  +  contributi (datore + lavoratore)  +  imposte  +  netto
```

I quattro addendi sommano esattamente al valore aggiunto orario, per costruzione.
Da lì le ore si ricavano come quote: `ore_per_X = ore_lavoro × (X / VA)`. Nessuna
toppa, nessun riscalamento, nessun overflow possibile. Il test
`decomposizione: le quote sommano a 1` lo verifica per costruzione.

---

## 2. Mancava metà del cuneo: i contributi del datore di lavoro

La v1 calcolava il "cuneo fiscale" come `(IRPEF + addizionali + INPS lavoratore) / lordo`.
Ma il 9,19% trattenuto in busta paga è **meno di un terzo** della contribuzione:
il datore versa un altro 23,81% di IVS, più NASpI, CIG, malattia, maternità,
fondo garanzia TFR e INAIL. Il costo totale del lavoro sta intorno al **+30/32%
della RAL**, e quella parte non compariva da nessuna parte.

È un'omissione che pesa in due direzioni opposte e va detta per intero:

- **sottostimava lo Stato**: quasi due terzi del prelievo contributivo sparivano
  dal grafico;
- **sottostimava il costo del lavoro**, cioè il denominatore rispetto al quale si
  misura quanto valore l'impresa trattiene. Il "profitto" calcolato sul lordo del
  lavoratore invece che sul costo pieno è gonfiato.

**Correzione v2.** Il punto di partenza del calcolo non è più la RAL, ma il
**costo del lavoro** (`RAL + contributi datore`), che è ciò che l'ora di lavoro
costa davvero a chi la compra. Da lì si risale al valore aggiunto tramite la
quota del lavoro di settore, e si scende al netto passando per tutti i prelievi.

Va detta anche l'altra metà della verità, altrimenti si fa propaganda e non analisi:
i contributi non sono una tassa. Sono salario differito (pensione) e assicurazione
sociale (disoccupazione, malattia, maternità). L'app li mostra in una fetta
distinta da quella delle imposte proprio per non confonderli.

---

## 3. Il fisco era sbagliato per chi guadagna poco — cioè per quasi tutti gli utenti

La v1 applicava la detrazione da lavoro dipendente e basta. Mancavano tre istituti
che valgono, sommati, oltre **1.000-2.000 € l'anno** proprio nelle fasce basse:

| Istituto | Chi | Quanto |
|---|---|---|
| Somma integrativa (taglio del cuneo) | reddito complessivo ≤ 20.000 | 7,1% / 5,3% / 4,8% del reddito da lavoro, esentasse |
| Ulteriore detrazione | reddito 20.000-40.000 | 1.000 € fino a 32.000, poi a scalare fino a zero |
| Trattamento integrativo (ex bonus Renzi) | reddito ≤ 28.000, a condizione | fino a 1.200 € |

Un'app che vuole dire a una commessa di IV livello quanto le resta e le sbaglia
il netto di 100 € al mese **in difetto** non è credibile, per quanto sia giusta la
sua tesi politica. Peggio: rende la tesi attaccabile su un dettaglio, che è il modo
più economico per liquidarla.

Erano sbagliati anche due parametri contributivi:

- la v1 applicava il **+1% di aliquota aggiuntiva** sopra il *massimale*
  (113.520 €). Va invece applicato sopra la **prima fascia di retribuzione
  pensionabile** (56.224 € nel 2026) — cioè circa 57.000 € più in basso;
- sopra il **massimale** (122.295 € nel 2026) i contributi IVS non si versano
  affatto, mentre la v1 continuava a calcolarli.

**Correzione v2.** `fiscal.ts` implementa detrazione, somma integrativa, ulteriore
detrazione e trattamento integrativo, con soglie e formule in `aliquote.json`,
mai nel codice. Massimale e prima fascia sono distinti e usati per quello che sono.

---

## 4. Il paniere di sopravvivenza era arbitrario

`affitto + spesa alimentare + bollette + 40 litri di benzina`. Quattro voci scelte
a mano, e la benzina anche per chi vive a Milano e non ha la macchina. Mancavano
trasporto pubblico, sanità (ticket, dentista, farmaci non rimborsati),
telecomunicazioni, vestiario, igiene, manutenzione: voci che in un bilancio reale
pesano più della benzina.

Il problema non è la scelta delle voci — è che **non c'era un criterio**. Un paniere
compilato a intuito produce un numero che vale quanto l'intuito di chi l'ha scritto.

**Correzione v2.** Due panieri, dichiarati come tali e mostrati affiancati:

1. **Soglia di povertà assoluta ISTAT** — la spesa mensile minima per un paniere
   di beni e servizi considerati essenziali per evitare l'esclusione sociale,
   calcolata da ISTAT per tipologia familiare, ripartizione geografica e ampiezza
   del comune. Non è una nostra opinione: è la linea ufficiale sotto la quale
   lo Stato italiano dichiara che una persona è povera. Per un adulto solo
   30-59 anni va da ~760 €/mese (piccolo comune del Mezzogiorno) a ~940 €/mese
   (centro di area metropolitana del Nord).
2. **Costi fissi effettivi** — affitto di mercato + utenze + alimentari +
   trasporto, ricostruiti da fonti verificabili e **derivabili**: non più 107 numeri
   magici, ma `€/m² della provincia × superficie convenzionale`, così che chiunque
   possa rifare il conto e contestarlo.

Il confronto fra i due è di per sé un risultato politico: in molte province il
canone di mercato di un bilocale in periferia da solo **supera** l'intera soglia
di povertà assoluta calcolata da ISTAT, componente abitativa inclusa.

---

## 5. Il tempo di lavoro era solo quello contrattuale

La v1 usava `40h × 52 / 12 = 173h` e si fermava lì. Ma il tempo che il lavoro
sottrae alla vita non è il tempo retribuito: è il tempo **indisponibile**.

Mancava tutto ciò che sta intorno alla prestazione e che non viene pagato:

- **pendolarismo**: ~60 minuti al giorno in media in Italia, ~22 ore al mese;
- **pause non retribuite**, tempi di vestizione, reperibilità;
- **straordinario non pagato**, endemico in interi settori.

Sono ore in cui non sei al lavoro ma non sei nemmeno libero. Tenerle fuori dal
conto è esattamente l'operazione ideologica che l'app dovrebbe smontare: far
sembrare "tempo libero" del tempo che il rapporto di lavoro ha già occupato.

**Correzione v2.** Si distingue fra:

- `ore_retribuite` — quelle del contratto, base del calcolo fiscale;
- `ore_sottratte` — retribuite + pendolarismo + straordinario non pagato.

E si distinguono due salari orari:

```
salario orario nominale = netto / ore_retribuite
salario orario reale    = (netto − costi imposti dal lavoro) / ore_sottratte
```

dove i costi imposti dal lavoro sono quelli che esisterebbero solo perché lavori
(abbonamento, carburante del tragitto, pasti fuori). È il *real hourly wage* di
Dominguez e Robin: la domanda "quanto costa questa cosa in ore della mia vita?"
ha senso solo se il divisore è il salario orario **reale**. Con il nominale si
sottostima sistematicamente il prezzo in tempo di ogni acquisto — nell'ordine del
20-30%.

---

## 6. Le costanti temporali erano numeri tondi travestiti da dati

`ORE_SONNO_MESE = 240` (8h × 30) e `ORE_VITA_BIOLOGICA_MESE = 180` (6h × 30)
erano attribuite a "ISTAT Uso del tempo" ma non corrispondono a nessuna cifra
pubblicata: erano stime plausibili arrotondate, con una citazione appiccicata sopra.
È il tipo di scorciatoia che un progetto che mette la verificabilità nel manifesto
non può permettersi.

C'era anche un'omissione più grave del arrotondamento. Il "lavoro familiare"
veniva trattato come una costante uguale per tutti, mentre è la variabile più
diseguale che esista nell'uso del tempo italiano. Dati ISTAT 2023 sulle persone
**occupate**:

| | lavoro familiare / giorno |
|---|---|
| uomini occupati | 1h 48m |
| donne occupate | 4h 10m |

**2 ore e 22 minuti al giorno di differenza a parità di impegno professionale**:
circa **72 ore al mese** di lavoro non pagato in più, che è quasi mezza giornata
lavorativa aggiuntiva ogni giorno. Una donna che lavora full time e ha una casa
non ha "meno tempo libero": ha un secondo turno.

**Correzione v2.** Le costanti temporali sono in `tempo.json` con la fonte e
l'anno accanto a ogni numero, e il carico di lavoro familiare è **un parametro
selezionabile**, non una media che nasconde la disuguaglianza che dovrebbe mostrare.

---

## 7. Il "margine di settore" prometteva più di quanto potesse mantenere

La v1 chiamava `margine_medio_settore` il rapporto MOL / valore aggiunto e lo
interpretava, nelle note del file dati, come "proxy del saggio di sfruttamento".
La direzione è giusta, la precisione promessa no. Tre limiti che vanno dichiarati
e che la v2 dichiara nell'interfaccia, non solo in un commento:

1. **Il MOL non è profitto.** È il margine *lordo*: dentro ci sono gli ammortamenti,
   cioè il capitale fisso consumato nel processo. Il profitto netto è più basso.
2. **In Italia il MOL contiene reddito misto.** In un tessuto di microimprese
   familiari, dentro il "margine" c'è anche il lavoro non retribuito del titolare
   e dei familiari. Non è tutto reddito da capitale.
3. **È una media di settore, non la tua impresa.** Da una media settoriale non si
   deduce il saggio di sfruttamento individuale. Un'infermiera di una cooperativa
   in appalto e una di una clinica privata stanno nello stesso codice ATECO e in
   due situazioni opposte.

**Correzione v2.** Il parametro resta — è la cosa più vicina a una misura pubblica
della quota di valore non distribuita al lavoro — ma cambia nome e statuto:
`quota_lavoro_settore`, dichiarato come **quota del valore aggiunto che va al lavoro
dipendente**, grandezza descrittiva e verificabile. E soprattutto il risultato non è
più un numero puntuale ma un **intervallo**: la fetta "profitto" viene mostrata come
banda min-max, perché è così che si comunica onestamente una stima con questa
incertezza. Un numero secco su un parametro incerto è una bugia con più cifre decimali.

Il quadro di riferimento resta quello del valore-lavoro: la giornata si divide in
lavoro necessario (riproduce il valore della forza-lavoro) e pluslavoro (non
retribuito). La v2 non pretende di misurare `s/v` per il singolo. Mostra la
distribuzione osservabile del valore aggiunto e lascia che sia quella a parlare —
che è più forte, perché è controllabile.

---

## 8. Cosa è stato tolto, e perché

L'app faceva troppe cose. Globo animato, comparatore fra città, serie storica
decennale, "modalità obiettivo", export PNG della card: ognuna difendibile da sola,
tutte insieme un rumore che sotterrava il messaggio. Il report era lungo 1.880
righe e chiedeva all'utente di scorrere sette sezioni prima di capire il punto.

Il criterio di taglio è quello del manifesto: *"questo aiuta un lavoratore a capire
quanto del suo tempo viene sottratto?"*. Ciò che non passava l'esame è uscito.

**Restano quattro cose**, in quest'ordine:

1. il calcolo, immediato e su una sola schermata;
2. la scomposizione dell'ora e del mese, con le fonti a un clic;
3. il convertitore prezzo → ore di vita, al salario orario reale;
4. **cosa puoi fare adesso**: diritti esigibili con soglie e link, e a chi rivolgersi.

Il punto 4 è la novità che giustifica la 2.0. Un'app che dimostra a una persona
che è povera e la lascia lì ha fatto metà del lavoro, e la metà meno utile.
Se il calcolo mostra un reddito sotto 15.493,71 €, l'app deve dire che esiste una
detrazione sull'affitto fino a 2.000 € e dove si chiede. Il resto è denuncia
senza sbocco — che è precisamente la condizione politica che il progetto dice di
voler rompere.

---

## Fonti verificate

Aggiornamento del **10 settembre 2026**. Ogni numero usato dal motore ha la fonte
in `DATA_SOURCES.md` e nei campi `fonte` dei file JSON in `src/lib/data/`.
