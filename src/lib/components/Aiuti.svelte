<!--
  src/lib/components/Aiuti.svelte
  La parte che rende l'app utile invece che solo giusta.
  Un calcolo che dimostra a una persona che è povera e la lascia lì ha fatto
  la metà meno utile del lavoro.

  Le tre opzioni qui sotto non entrano nella URL condivisa e non lasciano mai
  il browser: servono solo a filtrare quali diritti hanno senso per chi guarda.
-->
<script lang="ts">
  import { slide } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { valutaAiuti, AVVERTENZA_AIUTI } from '$lib/engine';
  import type { SituazionePersonale, TipoContratto } from '$lib/types';

  interface Props {
    reddito: number;
    tipoContratto: TipoContratto;
    situazione: SituazionePersonale;
  }

  let { reddito, tipoContratto, situazione = $bindable() }: Props = $props();

  let aperta = $state<string | null>(null);

  const voci = $derived(
    valutaAiuti({
      reddito_complessivo: reddito,
      tipo_contratto: tipoContratto,
      situazione
    })
  );

  const opzioni: { chiave: keyof SituazionePersonale; label: string }[] = [
    { chiave: 'in_affitto', label: 'Sono in affitto' },
    { chiave: 'under31', label: 'Ho meno di 31 anni' },
    { chiave: 'con_figli', label: 'Ho figli a carico' }
  ];
</script>

<section class="aiuti">
  <div class="tdv-section-label">Cosa puoi fare adesso</div>

  <p class="intro">
    Sotto ci sono soldi che ti spettano e che moltissime persone non chiedono, quasi sempre
    perché non sanno che esistono. Spunta cosa vale per te: queste tre risposte restano nel
    tuo browser e non finiscono nemmeno nel link che puoi condividere.
  </p>

  <div class="opzioni">
    {#each opzioni as o (o.chiave)}
      <button
        type="button"
        class="opzione"
        class:on={situazione[o.chiave]}
        aria-pressed={situazione[o.chiave]}
        onclick={() => (situazione[o.chiave] = !situazione[o.chiave])}
      >
        <span class="box" aria-hidden="true">{situazione[o.chiave] ? '×' : ''}</span>
        {o.label}
      </button>
    {/each}
  </div>

  <ul class="lista">
    {#each voci as v (v.id)}
      <li class="voce" class:probabile={v.esito === 'probabile'}>
        <button
          type="button"
          class="testa"
          aria-expanded={aperta === v.id}
          onclick={() => (aperta = aperta === v.id ? null : v.id)}
        >
          <span class="titolo">{v.titolo}</span>
          <span class="importo">{v.importo}</span>
          <span class="freccia" class:giu={aperta === v.id} aria-hidden="true">→</span>
        </button>

        {#if aperta === v.id}
          <div class="corpo" transition:slide={{ duration: 260, easing: cubicOut }}>
            <p class="desc">{v.descrizione}</p>
            <p class="come"><span class="etich">Come si chiede</span>{v.come}</p>
            <p class="motivo">
              <span class="etich">Perché compare qui</span>{v.motivo}
            </p>
            <p class="fonte">
              {v.fonte} · <a href={v.url} target="_blank" rel="noopener noreferrer">vai alla fonte ↗</a>
            </p>
          </div>
        {/if}
      </li>
    {/each}
  </ul>

  <p class="avvertenza">{AVVERTENZA_AIUTI}</p>
</section>

<style>
  .aiuti {
    padding: 36px 32px;
    border-top: 1px solid var(--tdv-border);
    background: var(--tdv-paper-2);
  }

  .intro {
    font-size: 12px;
    line-height: 1.9;
    color: var(--tdv-ink2);
    max-width: 74ch;
  }

  .opzioni {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 22px 0 28px;
  }
  .opzione {
    display: inline-flex;
    align-items: center;
    gap: 9px;
    background: none;
    border: 1px solid var(--tdv-border);
    color: var(--tdv-ink2);
    padding: 9px 15px;
    font-size: 11px;
    cursor: pointer;
    transition: all var(--tdv-fast) var(--tdv-ease);
  }
  .opzione.on {
    border-color: var(--tdv-red);
    color: var(--tdv-red);
    background: var(--tdv-red-dim);
  }
  .box {
    width: 13px;
    height: 13px;
    border: 1px solid currentColor;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    line-height: 1;
  }

  .lista {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .voce {
    border-top: 1px solid var(--tdv-border2);
  }
  .voce:last-child {
    border-bottom: 1px solid var(--tdv-border2);
  }

  .testa {
    width: 100%;
    display: grid;
    grid-template-columns: 1fr auto 20px;
    gap: 16px;
    align-items: baseline;
    background: none;
    border: none;
    padding: 16px 0;
    text-align: left;
    cursor: pointer;
    color: inherit;
    transition: color var(--tdv-fast) var(--tdv-ease);
  }
  .testa:hover .titolo,
  .testa:focus-visible .titolo {
    color: var(--tdv-red);
  }

  .titolo {
    font-size: 14px;
    color: var(--tdv-ink);
    transition: color var(--tdv-fast) var(--tdv-ease);
  }
  .importo {
    font-size: 11px;
    color: var(--tdv-dato-4);
    text-align: right;
  }
  .voce.probabile .importo {
    color: var(--tdv-dato-3);
  }
  .freccia {
    color: var(--tdv-ink3);
    font-size: 13px;
    transition: transform var(--tdv-fast) var(--tdv-ease);
  }
  .freccia.giu {
    transform: rotate(90deg);
  }

  .corpo {
    padding: 0 0 20px;
    max-width: 76ch;
  }
  .corpo p {
    font-size: 11px;
    line-height: 1.9;
    color: var(--tdv-ink2);
    margin-bottom: 10px;
  }
  .desc {
    color: var(--tdv-ink) !important;
    font-size: 12px !important;
  }
  .etich {
    display: block;
    font-size: 9px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--tdv-ink3);
    margin-bottom: 2px;
  }
  .fonte {
    font-size: 10px !important;
    color: var(--tdv-ink3) !important;
    margin-bottom: 0 !important;
  }

  .avvertenza {
    margin-top: 26px;
    padding-left: 12px;
    border-left: 2px solid var(--tdv-border);
    font-size: 10px;
    line-height: 1.8;
    color: var(--tdv-ink3);
    max-width: 74ch;
  }

  @media (max-width: 760px) {
    .aiuti {
      padding: 28px 20px;
    }
    .testa {
      grid-template-columns: 1fr 20px;
    }
    .importo {
      grid-column: 1;
      grid-row: 2;
      text-align: left;
    }
  }
</style>
