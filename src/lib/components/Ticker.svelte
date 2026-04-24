<!--
  src/lib/components/Ticker.svelte
  Ticker orizzontale rosso stile broadcast/TG. Non porta informazione
  operativa: è parte del tono editoriale del prodotto.
  Accessibilità: aria-hidden perché è puramente decorativo.
-->
<script lang="ts">
  interface Props {
    messaggi?: string[];
  }

  const { messaggi = [
    "il tempo è l'unica risorsa non rinnovabile",
    'lavori per vivere, o vivi per lavorare',
    'ogni euro ha un costo in ore di esistenza',
    'dati pubblici · calcoli aperti · nessun tracciamento'
  ] }: Props = $props();

  const rotolo = $derived(
    [...messaggi, ...messaggi].map((m) => `★ ${m}`).join('   \u00A0\u00A0\u00A0   ')
  );
</script>

<div class="tdv-ticker-bar" role="presentation" aria-hidden="true">
  <span class="tdv-ticker-inner">{rotolo}</span>
</div>

<style>
  .tdv-ticker-bar {
    background: var(--tdv-red);
    color: #fff;
    font-family: var(--tdv-mono);
    font-size: 9px;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    padding: 7px 0;
    overflow: hidden;
    white-space: nowrap;
    position: relative;
    border-radius: 0;
  }
  .tdv-ticker-inner {
    display: inline-block;
    animation: tdv-ticker-scroll 22s linear infinite;
    padding-left: 100%;
  }
  @keyframes tdv-ticker-scroll {
    from {
      transform: translateX(0);
    }
    to {
      transform: translateX(-100%);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .tdv-ticker-inner {
      animation: none;
      padding-left: 0;
    }
  }
</style>
