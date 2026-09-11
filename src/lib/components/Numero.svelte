<!--
  src/lib/components/Numero.svelte
  Un numero che si anima quando cambia. Serve a far vedere CHE è cambiato:
  in un calcolatore dal vivo, un valore che salta senza transizione passa
  inosservato. Chi ha chiesto meno movimento riceve il salto secco.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import { tweened } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';

  interface Props {
    valore: number;
    decimali?: number;
    prefisso?: string;
    suffisso?: string;
    durata?: number;
  }

  const { valore, decimali = 0, prefisso = '', suffisso = '', durata = 700 }: Props = $props();

  const ridotto =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  // Valore e durata iniziali sono letti apposta una volta sola: il tween parte
  // da dove siamo ora e la durata non cambia in corsa.
  const n = untrack(() =>
    tweened(valore, { duration: ridotto ? 0 : durata, easing: cubicOut })
  );

  $effect(() => {
    n.set(Number.isFinite(valore) ? valore : 0);
  });

  const formattato = $derived(
    $n.toLocaleString('it-IT', {
      minimumFractionDigits: decimali,
      maximumFractionDigits: decimali
    })
  );
</script>

<span class="tdv-numero">{prefisso}{formattato}{suffisso}</span>

<style>
  .tdv-numero {
    font-variant-numeric: tabular-nums;
    font-feature-settings: 'tnum';
  }
</style>
