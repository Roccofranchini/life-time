<!--
  src/lib/components/Metodo.svelte
  Il metodo e le fonti, in fondo alla pagina e aperti a chiunque.
  Non è una nota legale: è la parte che rende contestabile il risultato.
  Un numero che non si può rifare non è un argomento, è uno slogan.
-->
<script lang="ts">
  import { slide } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import aliquote from '$lib/data/aliquote.json';
  import tempo from '$lib/data/tempo.json';
  import province from '$lib/data/province.json';
  import type { CcnlSettore, ProvinciaEntry, Risultato } from '$lib/types';

  interface Props {
    risultato: Risultato;
    settore: CcnlSettore | undefined;
    provincia: ProvinciaEntry;
  }

  const { risultato: r, settore, provincia }: Props = $props();

  let aperto = $state(false);

  const eur = (n: number) => Math.round(n).toLocaleString('it-IT');
  const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

  const passaggi = $derived([
    {
      t: 'Dal minimo contrattuale alla RAL',
      v: `${eur(r.fisco.lordo_annuo)} € l'anno`,
      d: settore
        ? `${settore.sigla_ccnl}. ${settore.composizione}, per ${settore.mensilita} mensilità.`
        : 'Lordo mensile dichiarato, per le mensilità indicate.'
    },
    {
      t: 'Dalla RAL al costo del lavoro',
      v: `${eur(r.fisco.costo_lavoro_annuo)} € l'anno`,
      d: `Più ${eur(r.fisco.contributi_datore)} € di contributi a carico di chi ti paga (IVS ${pct(
        aliquote.inps.datore.ivs
      )} più NASpI, CIG, malattia, maternità, fondo garanzia e INAIL) e ${eur(
        r.fisco.tfr
      )} € di TFR accantonato. È quello che la tua ora costa davvero.`
    },
    {
      t: 'Dal costo del lavoro al valore aggiunto',
      v: `${eur(r.valore.valore_aggiunto_mensile)} € al mese`,
      d: r.valore.settore_pubblico
        ? 'Settore pubblico: la quota del lavoro è posta a 1 per convenzione dichiarata, quindi valore aggiunto e costo del lavoro coincidono e il profitto è zero.'
        : `Diviso la quota del valore aggiunto che nel tuo settore va al lavoro dipendente (${pct(
            r.valore.quota_lavoro
          )}, ±${pct(r.valore.incertezza_quota)}). È il parametro più incerto del modello: per questo il profitto è mostrato come banda, mai come numero secco.`
    },
    {
      t: 'Dalla RAL al netto',
      v: `${eur(r.fisco.netto_annuo)} € l'anno`,
      d: `IRPEF lorda ${eur(r.fisco.irpef_lorda)} €, meno detrazione da lavoro ${eur(
        r.fisco.detrazione_lavoro
      )} €${r.fisco.ulteriore_detrazione > 0 ? ` e ulteriore detrazione ${eur(r.fisco.ulteriore_detrazione)} €` : ''}. Addizionali ${eur(
        r.fisco.addizionale_regionale + r.fisco.addizionale_comunale
      )} €.${r.fisco.somma_integrativa > 0 ? ` Taglio del cuneo: +${eur(r.fisco.somma_integrativa)} € esentasse.` : ''}${
        r.fisco.trattamento_integrativo > 0
          ? ` Trattamento integrativo: +${eur(r.fisco.trattamento_integrativo)} €.`
          : ''
      }`
    },
    {
      t: 'Dal netto al salario orario reale',
      v: `${r.tempo.salario_orario_reale.toFixed(2)} € l'ora`,
      d: `Netto mensile meno ${eur(
        r.tempo.costi_del_lavoro_mese
      )} € di costi imposti dal lavoro, diviso ${Math.round(
        r.tempo.ore_sottratte
      )} ore realmente sottratte (contratto, tragitto, straordinario non pagato) invece delle ${Math.round(
        r.tempo.ore_retribuite
      )} contrattuali.`
    },
    {
      t: 'Dal canone al metro quadro',
      v: `${eur(r.sopravvivenza.affitto)} € al mese`,
      d: `${provincia.eur_mq_medio} €/m² di media di mercato per ${provincia.nome} (${
        provincia.fonte_dato === 'calibrato'
          ? 'non rilevato: stima riscalata sulle province rilevate della stessa ripartizione'
          : provincia.rilevazione
      }), scontato al ${Math.round(tempo.alloggi.coefficiente_periferia * 100)}% per la periferia, × ${
        r.sopravvivenza.affitto_mq
      } m²${
        r.sopravvivenza.affitto_persone > 1 ? `, diviso ${r.sopravvivenza.affitto_persone} persone` : ''
      }.`
    },
    {
      t: 'Dal paniere ISTAT ai costi fissi',
      v: `${eur(r.sopravvivenza.costi_fissi)} € al mese`,
      d: `Canone più il ${pct(
        tempo.soglia_poverta_assoluta.quota_non_abitativa
      )} della soglia di povertà assoluta ISTAT per la tua zona (${eur(
        r.sopravvivenza.soglia_istat
      )} €), che è la parte non abitativa del paniere essenziale.`
    }
  ]);

  const fonti = [
    { n: 'Agenzia delle Entrate — IRPEF 2026', u: aliquote.irpef.url, d: aliquote.irpef.fonte },
    { n: 'INPS — minimali e massimali 2026', u: aliquote.inps.url, d: aliquote.inps.fonte },
    { n: 'ISTAT — povertà assoluta', u: tempo.soglia_poverta_assoluta.url, d: tempo.soglia_poverta_assoluta.fonte },
    { n: 'ISTAT — uso del tempo', u: tempo.lavoro_familiare.url, d: tempo.lavoro_familiare.fonte },
    { n: 'ISTAT — pendolarismo', u: tempo.pendolarismo.url, d: tempo.pendolarismo.fonte },
    { n: 'ISTAT — quota del lavoro sul valore aggiunto', u: aliquote.quota_lavoro_settore.url, d: aliquote.quota_lavoro_settore.fonte },
    { n: 'idealista — indice dei canoni di locazione', u: province.url_canoni, d: province.fonte_canoni },
    { n: 'OMI — quotazioni immobiliari', u: province.url_omi, d: 'Banca dati delle quotazioni immobiliari dell’Agenzia delle Entrate.' }
  ];
</script>

<section class="metodo">
  <div class="tdv-section-label">Come è fatto questo numero</div>

  <button type="button" class="apri" aria-expanded={aperto} onclick={() => (aperto = !aperto)}>
    {aperto ? 'Chiudi il conto passo per passo' : 'Apri il conto passo per passo'}
    <span class="freccia" class:giu={aperto} aria-hidden="true">→</span>
  </button>

  {#if aperto}
    <div transition:slide={{ duration: 300, easing: cubicOut }}>
      <ol class="passaggi">
        {#each passaggi as p, i (p.t)}
          <li>
            <span class="n">{String(i + 1).padStart(2, '0')}</span>
            <span class="corpo">
              <span class="t">{p.t}</span>
              <span class="v">{p.v}</span>
              <span class="d">{p.d}</span>
            </span>
          </li>
        {/each}
      </ol>

      <div class="limiti">
        <h3>Cosa questo calcolo non sa</h3>
        <ul>
          <li>
            <strong>La tua busta paga vera.</strong> Superminimi, scatti di anzianità, indennità,
            premi di risultato e detrazioni per familiari a carico non sono qui dentro. Il minimo
            contrattuale è un pavimento, non uno stipendio.
          </li>
          <li>
            <strong>Il tuo ISEE.</strong> Dipende dal patrimonio, che non ti chiediamo. Per questo
            le misure che ne dipendono sono marcate «probabile» e mai «certo».
          </li>
          <li>
            <strong>Quanto profitto produci tu.</strong> La quota del valore aggiunto è una media
            di settore. Non descrive la tua impresa, e da una media non si deduce il caso singolo.
            Il margine operativo lordo contiene anche ammortamenti e, nelle microimprese, il lavoro
            non retribuito di titolari e familiari: non è tutto reddito da capitale.
          </li>
          <li>
            <strong>Quanto costa affittare dove vivi tu.</strong> Solo 19 province su 107 hanno una
            rilevazione pubblica del canone che siamo riusciti a verificare. Per le altre il valore è
            riscalato su quelle, e il campo «rilevato / stimato» accanto al canone dice sempre in
            quale dei due casi ti trovi.
          </li>
          <li>
            <strong>Quanto spendi davvero.</strong> Il paniere è quello minimo ISTAT, non il tuo.
            Se hai un debito, una malattia cronica o una persona da mantenere, il conto vero è
            peggiore di questo.
          </li>
        </ul>
      </div>

      <div class="fonti">
        <h3>Fonti</h3>
        <ul>
          {#each fonti as f (f.n)}
            <li>
              <a href={f.u} target="_blank" rel="noopener noreferrer">{f.n} ↗</a>
              <span>{f.d}</span>
            </li>
          {/each}
        </ul>
        <p class="agg">
          Dati fiscali e statistici verificati al {aliquote.aggiornato}. Ogni cifra sta in un file
          JSON versionato in <code>src/lib/data/</code>: se una è sbagliata, si corregge con una
          pull request, senza toccare una riga di codice.
        </p>
      </div>
    </div>
  {/if}
</section>

<style>
  .metodo {
    padding: 36px 32px 56px;
    border-top: 1px solid var(--tdv-border);
  }

  .apri {
    background: none;
    border: 1px solid var(--tdv-border);
    color: var(--tdv-ink2);
    padding: 12px 18px;
    font-size: 11px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 12px;
    transition: all var(--tdv-fast) var(--tdv-ease);
  }
  .apri:hover,
  .apri:focus-visible {
    border-color: var(--tdv-red);
    color: var(--tdv-red);
  }
  .freccia {
    transition: transform var(--tdv-fast) var(--tdv-ease);
  }
  .freccia.giu {
    transform: rotate(90deg);
  }

  .passaggi {
    list-style: none;
    margin: 28px 0 0;
    padding: 0;
    counter-reset: p;
  }
  .passaggi li {
    display: grid;
    grid-template-columns: 34px 1fr;
    gap: 16px;
    padding: 16px 0;
    border-bottom: 1px solid var(--tdv-border2);
  }
  .n {
    font-family: var(--tdv-serif);
    font-style: italic;
    font-size: 15px;
    color: var(--tdv-red);
  }
  .corpo {
    display: flex;
    flex-direction: column;
    gap: 5px;
    max-width: 78ch;
  }
  .t {
    font-size: 9px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--tdv-ink3);
  }
  .v {
    font-family: var(--tdv-serif);
    font-style: italic;
    font-size: 20px;
    color: var(--tdv-ink);
  }
  .d {
    font-size: 11px;
    line-height: 1.85;
    color: var(--tdv-ink2);
  }

  .limiti,
  .fonti {
    margin-top: 36px;
  }
  h3 {
    font-size: 9px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--tdv-red);
    margin-bottom: 16px;
  }
  .limiti ul,
  .fonti ul {
    list-style: none;
    padding: 0;
    margin: 0;
    max-width: 80ch;
  }
  .limiti li {
    font-size: 11px;
    line-height: 1.9;
    color: var(--tdv-ink2);
    padding: 9px 0 9px 12px;
    border-left: 2px solid var(--tdv-border);
    margin-bottom: 8px;
  }
  .limiti strong {
    color: var(--tdv-ink);
  }
  .fonti li {
    display: flex;
    flex-direction: column;
    gap: 3px;
    padding: 10px 0;
    border-bottom: 1px solid var(--tdv-border2);
  }
  .fonti li span {
    font-size: 10px;
    line-height: 1.7;
    color: var(--tdv-ink3);
  }
  .agg {
    margin-top: 20px;
    font-size: 10px;
    line-height: 1.8;
    color: var(--tdv-ink3);
  }
  code {
    font-family: var(--tdv-mono);
    color: var(--tdv-ink2);
  }

  @media (max-width: 760px) {
    .metodo {
      padding: 28px 20px 44px;
    }
  }
</style>
