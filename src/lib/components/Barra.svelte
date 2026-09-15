<!--
  src/lib/components/Barra.svelte
  Barra impilata al 100%: una quantità divisa in parti che sommano al totale.
  È la forma giusta perché il dato risponde a «di che cosa è fatto questo»,
  non «quanto è grande rispetto a cos'altro».

  Scelte non negoziabili applicate qui:
   · ordine dei colori fisso, mai ciclato — il colore segue la destinazione,
     non la sua posizione in classifica, così un filtro non ricolora nulla;
   · 2px di superficie fra un segmento e l'altro, perché il confine si veda
     anche a chi non distingue le due tinte;
   · legenda sempre presente, più etichetta diretta sui segmenti abbastanza
     larghi: l'identità non è mai affidata al solo colore;
   · tabella equivalente sempre nel DOM, letta dagli screen reader e visibile
     se il JavaScript non parte;
   · testi in inchiostro, mai nel colore della serie.
-->
<script lang="ts">
  import { formattaEuro, formattaOre } from '$lib/formato';

  export interface Fetta {
    id: string;
    etichetta: string;
    ore: number;
    euro: number;
    colore: string;
    spiegazione: string;
  }

  interface Props {
    fette: Fetta[];
    totale: number;
    unita?: 'ore' | 'euro';
    titolo: string;
    altezza?: number;
  }

  const { fette, totale, unita = 'ore', titolo, altezza = 56 }: Props = $props();

  let attiva = $state<string | null>(null);

  const visibili = $derived(fette.filter((f) => f.ore > 0.01));

  function pct(f: Fetta): number {
    return totale > 0 ? (f.ore / totale) * 100 : 0;
  }

  const fmtOre = formattaOre;
  const fmtEuro = (n: number) => `${formattaEuro(n)} €`;

  function valore(f: Fetta): string {
    return unita === 'ore' ? fmtOre(f.ore) : fmtEuro(f.euro);
  }
</script>

<figure class="barra-fig">
  <figcaption class="barra-titolo">{titolo}</figcaption>

  <div
    class="barra"
    style="height:{altezza}px"
    role="img"
    aria-label="{titolo}. {visibili.map((f) => `${f.etichetta}: ${valore(f)}`).join('; ')}."
  >
    {#each visibili as f, i (f.id)}
      <button
        type="button"
        class="seg"
        class:prima={i === 0}
        class:ultima={i === visibili.length - 1}
        class:spenta={attiva !== null && attiva !== f.id}
        style="width:{pct(f)}%; background:{f.colore}"
        onmouseenter={() => (attiva = f.id)}
        onmouseleave={() => (attiva = null)}
        onfocus={() => (attiva = f.id)}
        onblur={() => (attiva = null)}
        aria-label="{f.etichetta}: {valore(f)}, {Math.round(pct(f))}%"
      >
        {#if pct(f) > 13}
          <span class="seg-etichetta">{Math.round(pct(f))}%</span>
        {/if}
      </button>
    {/each}
  </div>

  <!-- Legenda: sempre, perché le serie sono più di una -->
  <ul class="legenda">
    {#each visibili as f (f.id)}
      <li
        class="voce"
        class:spenta={attiva !== null && attiva !== f.id}
        onmouseenter={() => (attiva = f.id)}
        onmouseleave={() => (attiva = null)}
      >
        <span class="pastiglia" style="background:{f.colore}"></span>
        <span class="voce-testo">
          <span class="voce-etichetta">{f.etichetta}</span>
          <span class="voce-valore">{valore(f)}</span>
        </span>
      </li>
    {/each}
  </ul>

  {#if attiva}
    <p class="spiegazione" aria-live="polite">
      {visibili.find((f) => f.id === attiva)?.spiegazione}
    </p>
  {:else}
    <p class="spiegazione vuota">Passa sopra una fetta per sapere cos'è.</p>
  {/if}

  <!-- Equivalente tabellare: funziona senza JavaScript ed è ciò che leggono
       gli screen reader quando la barra è solo un'immagine. -->
  <details class="tabella">
    <summary>Vedi i numeri in tabella</summary>
    <table>
      <thead>
        <tr><th scope="col">Destinazione</th><th scope="col">Ore</th><th scope="col">Euro</th><th scope="col">Quota</th></tr>
      </thead>
      <tbody>
        {#each visibili as f (f.id)}
          <tr>
            <th scope="row">{f.etichetta}</th>
            <td>{fmtOre(f.ore)}</td>
            <td>{fmtEuro(f.euro)}</td>
            <td>{pct(f).toFixed(1)}%</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </details>
</figure>

<style>
  .barra-fig {
    margin: 0;
  }

  .barra-titolo {
    font-size: 9px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--tdv-red);
    margin-bottom: 14px;
  }

  .barra {
    display: flex;
    width: 100%;
    /* La superficie si vede attraverso i 2px di gap: è il separatore */
    gap: 2px;
    background: var(--tdv-bg);
    overflow: hidden;

    /* La barra cresce da sinistra: si vede la quantità formarsi invece di
       trovarla già lì. È un'animazione CSS e non un tween in JavaScript
       perché le larghezze dei segmenti devono essere quelle definitive già
       nel markup del server — altrimenti, senza JavaScript, la barra
       resterebbe vuota. Chi ha chiesto meno movimento la trova ferma e
       completa: ci pensa la regola globale su prefers-reduced-motion. */
    transform-origin: left center;
    animation: tdv-cresci var(--tdv-slow) var(--tdv-ease) both;
  }

  @keyframes tdv-cresci {
    from {
      transform: scaleX(0);
    }
    to {
      transform: scaleX(1);
    }
  }

  .seg {
    border: none;
    padding: 0;
    cursor: pointer;
    position: relative;
    min-width: 2px;
    transition: opacity var(--tdv-fast) var(--tdv-ease),
      filter var(--tdv-fast) var(--tdv-ease);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .seg.prima {
    border-radius: 4px 0 0 4px;
  }
  .seg.ultima {
    border-radius: 0 4px 4px 0;
  }
  .seg.spenta {
    opacity: 0.3;
  }
  .seg:hover,
  .seg:focus-visible {
    filter: brightness(1.12);
  }

  /* Etichetta diretta: inchiostro su fondo colorato, non il colore della serie */
  .seg-etichetta {
    font-size: 10px;
    font-weight: 600;
    color: #0a0a08;
    font-variant-numeric: tabular-nums;
    pointer-events: none;
    mix-blend-mode: luminosity;
  }

  .legenda {
    list-style: none;
    margin: 16px 0 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 10px 20px;
  }

  .voce {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    transition: opacity var(--tdv-fast) var(--tdv-ease);
  }
  .voce.spenta {
    opacity: 0.4;
  }

  .pastiglia {
    width: 10px;
    height: 10px;
    flex: 0 0 10px;
    margin-top: 4px;
    border-radius: 2px;
  }

  .voce-testo {
    display: flex;
    flex-direction: column;
    line-height: 1.4;
  }
  .voce-etichetta {
    font-size: 11px;
    color: var(--tdv-ink2);
  }
  .voce-valore {
    font-size: 14px;
    color: var(--tdv-ink);
    font-variant-numeric: tabular-nums;
  }

  .spiegazione {
    margin: 14px 0 0;
    font-size: 11px;
    line-height: 1.7;
    color: var(--tdv-ink2);
    min-height: 2.6em;
  }
  .spiegazione.vuota {
    color: var(--tdv-ink3);
  }

  .tabella {
    margin-top: 10px;
    font-size: 11px;
    color: var(--tdv-ink3);
  }
  .tabella summary {
    cursor: pointer;
    padding: 4px 0;
  }
  .tabella table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 8px;
  }
  .tabella th,
  .tabella td {
    text-align: left;
    padding: 6px 8px 6px 0;
    border-bottom: 1px solid var(--tdv-border2);
    font-weight: 400;
    color: var(--tdv-ink2);
    font-variant-numeric: tabular-nums;
  }
  .tabella thead th {
    color: var(--tdv-ink3);
    font-size: 9px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }
</style>
