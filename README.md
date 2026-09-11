# Tempo di Vita

**Il salario si misura in euro. La vita si misura in ore.**

Web app open source che converte quello che guadagni in **ore della tua vita**: quante ne
servono per pagare l'affitto, quante restano a chi ti paga, quante restano a te — e quali
diritti puoi esigere subito.

Non è un calcolatore di stipendio. È uno strumento per rendere visibile dove finisce il tempo.

---

## Cosa fa

1. **Scomposizione del valore.** Il valore che produci in un mese di lavoro si divide in
   quattro: profitto, previdenza, imposte, e quello che arriva a te. Le quattro parti sommano
   al totale per costruzione, non per aggiustamento.
2. **Salario orario reale.** Non il netto diviso le ore di contratto, ma il netto meno i costi
   che il lavoro impone, diviso le ore che il lavoro davvero ti prende — tragitto e
   straordinario non pagato compresi. Tipicamente il 20-30% più basso di quello in busta.
3. **Costi in ore.** Affitto e paniere essenziale convertiti in ore di vita, al salario reale.
4. **Cosa puoi fare adesso.** I diritti esigibili con il tuo reddito, con soglia, importo e
   dove si chiedono.

## Come è fatto

Tutto il calcolo avviene **nel tuo browser**, con funzioni pure. Nessun database, nessuna API
esterna, nessun cookie, nessun analytics. Il server esiste solo per renderizzare il link
condiviso e la sua anteprima, e rifà lo stesso identico calcolo sugli stessi dati.

Nella URL condivisibile finiscono solo le tue **scelte** — città, contratto, tipo di casa —
mai i numeri calcolati e mai nulla che ti identifichi.

Ogni numero del modello sta in un file JSON versionato, con la fonte accanto. Se ne trovi uno
sbagliato, si corregge con una pull request su un file dati.

## Documentazione

| File | Cosa contiene |
|---|---|
| [`CRITICA.md`](CRITICA.md) | La critica del modello v1 e i fondamenti teorici della 2.0 |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | La catena del calcolo, modulo per modulo |
| [`DATA_SOURCES.md`](DATA_SOURCES.md) | Ogni fonte, con data di verifica |
| [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md) | Estetica, token, palette dati |
| [`CLAUDE.md`](CLAUDE.md) | Regole di sviluppo |

## Sviluppo

```bash
npm install
npm run dev        # http://localhost:5173
npm run test       # 90 test sul motore
npm run check      # type check
npm run build
```

Nessuna variabile d'ambiente: l'app non parla con nessuno.

## Margine di errore

I risultati portano un margine dichiarato di **±3%**, che copre la dispersione di addizionali
comunali, contributi datoriali effettivi, premi INAIL, superminimi e scatti. L'incertezza
sulla quota del valore aggiunto che va al lavoro è più grande, è dichiarata a parte e si
mostra come banda.

Non è consulenza fiscale. È un ordine di grandezza che chiunque può rifare.

## Licenza

[AGPL-3.0](LICENSE). Il codice che gira su un server deve restare aperto: vale anche per chi
lo riusa.
