<!--
  src/routes/report/+page.svelte
  Dashboard risultati. Due origini possibili per i dati:
    (a) data.fromUrl === true  → arrivati da link condiviso; dati calcolati
        server-side in +page.server.ts. Popoliamo gli store per coerenza.
    (b) data.fromUrl === false → arrivati dal wizard; dati già negli store.
  Se né (a) né (b): redirect alla home.

  Privacy: lo share link contiene SOLO parametri di selezione, MAI numeri.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { get } from 'svelte/store';

  import PieChart, { type Segmento } from '$lib/components/PieChart.svelte';
  import ComparatoreCitta from '$lib/components/ComparatoreCitta.svelte';
  import ccnlData from '$lib/data/ccnl.json';
  import type { CcnlData } from '$lib/types';
  import {
    profilo,
    risultatoFiscale,
    costiProvincia,
    risultatoSopravvivenza,
    breakdownTemporale,
    resetTuttiGliStore
  } from '$lib/stores/profile';
  import {
    calcola_sopravvivenza,
    calcola_breakdown_temporale,
    MARGINE_ERRORE
  } from '$lib/engine';
  import { costruisciReportUrl } from '$lib/share';
  import type {
    CtaEntry,
    FiscalOutput,
    CostiVita,
    SurvivalOutput,
    TimeBreakdown,
    ProfiloUtente
  } from '$lib/types';
  import type { PageData } from './$types';

  interface Props {
    data: PageData;
  }

  const { data }: Props = $props();

  // Consumo benzina/mese identico al server: coerenza dati.
  const CONSUMO_BENZINA_LITRI_MESE = 40;
  const ORE_LAVORO_MENSILI_FULLTIME = (40 * 52) / 12;

  // stato locale
  let segmentoSelezionato = $state<Segmento | null>(null);
  let mostraShareConferma = $state(false);
  let ctaLocali = $state<CtaEntry[]>([]);
  let esportando = $state(false);
  let exportCardEl = $state<HTMLDivElement | null>(null);

  // ─── inizializzazione ────────────────────────────────────────────
  onMount(() => {
    if (data.fromUrl) {
      // dati dal server: popola store per coerenza con il resto dell'app
      profilo.set(data.profilo);
      risultatoFiscale.set(data.fiscal);
      costiProvincia.set(data.costi);
      risultatoSopravvivenza.set(data.survival);
      breakdownTemporale.set(data.breakdown);
      ctaLocali = data.cta;
      return;
    }

    // flusso wizard: controllo se store è popolato
    const profCorrente = get(profilo);
    const fiscCorrente = get(risultatoFiscale);
    const costiCorrenti = get(costiProvincia);

    if (!profCorrente || !fiscCorrente || !costiCorrenti) {
      goto('/');
      return;
    }

    // completa eventualmente i derivati mancanti
    completaDerivatiSeMancanti(profCorrente, fiscCorrente, costiCorrenti);
    void filtraCta(profCorrente.provincia).then((r) => (ctaLocali = r));
  });

  function completaDerivatiSeMancanti(
    p: ProfiloUtente,
    f: FiscalOutput,
    c: CostiVita
  ) {
    const oreLavoro =
      p.tipo_contratto === 'parttime' && p.percentuale_parttime
        ? ORE_LAVORO_MENSILI_FULLTIME * p.percentuale_parttime
        : ORE_LAVORO_MENSILI_FULLTIME;

    if (!get(risultatoSopravvivenza)) {
      const s: SurvivalOutput = calcola_sopravvivenza({
        affitto: c.affitto_bilocale_periferia,
        spesa_minima: c.spesa_alimentare_minima,
        bollette: c.bollette_stimate,
        carburante_mensile_stimato: c.carburante_benzina_litro * CONSUMO_BENZINA_LITRI_MESE,
        netto_mensile: f.netto_mensile,
        ore_lavoro_mensili: oreLavoro
      });
      risultatoSopravvivenza.set(s);
    }

    const sLoc = get(risultatoSopravvivenza);
    if (!get(breakdownTemporale) && sLoc) {
      const lordoStimato = f.netto_annuo + f.irpef_annua + f.contributi_inps + f.addizionale_regionale + f.addizionale_comunale;
      const b: TimeBreakdown = calcola_breakdown_temporale({
        survival: sLoc,
        fiscal: f,
        lordo_annuo: lordoStimato,
        ore_lavoro_mensili: oreLavoro,
        settore_id: p.settore_id,
        affitto: c.affitto_bilocale_periferia
      });
      breakdownTemporale.set(b);
    }
  }

  async function filtraCta(prov: string): Promise<CtaEntry[]> {
    const mod = await import('$lib/data/cta.json');
    const entries = (mod.default.entries ?? mod.entries) as CtaEntry[];
    return entries.filter((e) => e.provincia === prov || e.provincia === 'nazionale');
  }

  // gestione caricamento async di CTA nel flusso wizard
  $effect(() => {
    if (!data.fromUrl && $profilo) {
      void filtraCta($profilo.provincia).then((r) => (ctaLocali = r));
    }
  });

  // ─── Derived per la UI ───────────────────────────────────────────
  // Modello temporale onesto: 730h = sonno + lavoro + vita biologica + libero reale.
  // Il lavoro si sub-ripartisce in sopravvivenza, stato, capitale, salario residuo.
  // Totale segmenti mostrati in torta = 730h (somma invariante).

  // Salario residuo: parte del lavoro che NON va in costi fissi/tasse/profitto.
  // Può essere 0 se sopravvivenza + stato + capitale eccede l'orario di lavoro.
  const salarioResiduo = $derived.by(() => {
    const b = $breakdownTemporale;
    if (!b) return 0;
    return Math.max(0, b.ore_lavoro - b.ore_sopravvivenza - b.ore_stato - b.ore_capitale);
  });

  const tempoLiberoReale = $derived($breakdownTemporale?.ore_libero_reale ?? 0);

  const segmenti = $derived.by<Segmento[]>(() => {
    const b = $breakdownTemporale;
    if (!b) return [];
    const base: Segmento[] = [
      {
        id: 'sonno',
        label: 'Sonno',
        ore: b.ore_sonno,
        colore: 'var(--tdv-seg-sonno)',
        descrizione:
          'Otto ore a notte per reintegrare la forza-lavoro. Non è riposo, è manutenzione del corpo che domani torna in servizio.'
      },
      {
        id: 'sopravvivenza',
        label: 'Sopravvivenza',
        ore: b.ore_sopravvivenza,
        colore: 'var(--tdv-seg-sopravvivenza)',
        descrizione:
          'Ore di lavoro che servono solo a coprire affitto, spesa minima, bollette e carburante ai prezzi della tua provincia.'
      },
      {
        id: 'stato',
        label: 'Tasse & Stato',
        ore: b.ore_stato,
        colore: 'var(--tdv-seg-stato)',
        descrizione:
          'Ore del tuo lavoro convertite in IRPEF, addizionali regionale e comunale, contributi INPS. È il cuneo fiscale sul lordo.'
      },
      {
        id: 'capitale',
        label: 'Profitto capitale',
        ore: b.ore_capitale,
        colore: 'var(--tdv-seg-capitale)',
        descrizione:
          'Quota di margine medio del tuo settore (MOL/Valore aggiunto, fonte ISTAT SBS). Il surplus che trattiene chi organizza il lavoro.'
      }
    ];

    if (salarioResiduo > 1) {
      base.push({
        id: 'salario_residuo',
        label: 'Salario residuo',
        ore: salarioResiduo,
        colore: 'var(--tdv-seg-salario-residuo)',
        descrizione:
          'Ore di lavoro che finiscono davvero in tasca tua, dopo costi fissi, tasse e profitto. Quello che compra ciò che non è strettamente vitale.'
      });
    }

    base.push(
      {
        id: 'vita_biologica',
        label: 'Vita biologica',
        ore: b.ore_vita_biologica,
        colore: 'var(--tdv-seg-vita-biologica)',
        descrizione:
          'Riproduzione sociale: pasti, cucina, igiene, cura della casa, spostamenti non lavorativi. Circa 180h/mese (ISTAT Uso del tempo). Non è tempo libero.'
      },
      {
        id: 'libero_reale',
        label: 'Tempo libero reale',
        ore: tempoLiberoReale,
        colore: 'var(--tdv-seg-libero)',
        descrizione:
          "Quel che rimane davvero tuo. Politica, lettura, relazioni, ozio, cura. È il residuo onesto dopo sonno, lavoro e riproduzione sociale."
      }
    );

    return base;
  });

  const giorniAffitto = $derived($breakdownTemporale?.giorni_affitto ?? 0);
  const oreLiberoSettimana = $derived((tempoLiberoReale / 4.33).toFixed(1));

  // Lordo annuo ricostruito dal CCNL del profilo (per il comparatore città).
  const lordoAnnuoAttuale = $derived.by(() => {
    const p = $profilo;
    if (!p) return 0;
    const settori = (ccnlData as unknown as CcnlData).settori;
    const settore = settori.find((s) => s.id === p.settore_id);
    const livello = settore?.livelli.find((l) => l.livello === p.livello);
    if (!livello) return 0;
    let lordo = livello.lordo_mensile * (settore?.mensilita ?? 13);
    if (p.tipo_contratto === 'parttime' && p.percentuale_parttime) {
      lordo = Math.round(lordo * p.percentuale_parttime);
    }
    return lordo;
  });

  // ─── Azioni ──────────────────────────────────────────────────────
  async function condividi() {
    if (!$profilo) return;
    const url = costruisciReportUrl($page.url.origin, $profilo);
    try {
      await navigator.clipboard.writeText(url);
      mostraShareConferma = true;
      setTimeout(() => (mostraShareConferma = false), 2500);
    } catch {
      window.prompt('Copia il link manualmente:', url);
    }
  }

  function modifica() {
    // Torna al wizard pre-popolato senza resettare i dati dello store.
    // +page.svelte rileva ?modifica=1 e ripristina lo step 2 dai valori dello store.
    goto('/?modifica=1');
  }

  function ricomincia() {
    resetTuttiGliStore();
    goto('/');
  }

  async function esportaPng() {
    if (!exportCardEl) return;
    esportando = true;
    try {
      // Doppia chiamata: la prima carica i font in cache, la seconda li renderizza.
      // Workaround noto di html-to-image per Google Fonts caricati async.
      const { toPng } = await import('html-to-image');
      await toPng(exportCardEl);
      const dataUrl = await toPng(exportCardEl, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: '#0a0a08'
      });
      const a = document.createElement('a');
      a.download = `tempo-di-vita-${($profilo?.nome_provincia ?? 'report').toLowerCase().replace(/\s+/g, '-')}.png`;
      a.href = dataUrl;
      a.click();
    } catch (err) {
      console.error('Export PNG fallito:', err);
    } finally {
      esportando = false;
    }
  }

  // ─── Meta ────────────────────────────────────────────────────────
  const metaTitle = $derived(
    data.fromUrl
      ? data.meta.title
      : $profilo && $breakdownTemporale
        ? `${$profilo.nome_provincia}: ${giorniAffitto} giorni/mese per l'affitto`
        : 'Report · Tempo di vita'
  );
  const metaDesc = $derived(
    data.fromUrl
      ? data.meta.description
      : $risultatoFiscale
        ? `Netto mensile ${Math.round($risultatoFiscale.netto_mensile).toLocaleString('it-IT')}€ · ±${(MARGINE_ERRORE * 100).toFixed(0)}% · nessun tracciamento.`
        : 'Stima del costo della vita in ore di lavoro'
  );

  function formatEuro(n: number): string {
    return n.toLocaleString('it-IT', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0
    });
  }
</script>

<svelte:head>
  <title>{metaTitle}</title>
  <meta name="description" content={metaDesc} />
  <meta property="og:title" content={metaTitle} />
  <meta property="og:description" content={metaDesc} />
  <meta property="og:type" content="article" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content={metaTitle} />
  <meta name="twitter:description" content={metaDesc} />
</svelte:head>

{#if $profilo && $risultatoFiscale && $costiProvincia && $breakdownTemporale}
  <!-- ─── Hero numeri chiave ─── -->
  <section class="hero">
    <div class="hero-eyebrow">
      <span class="tdv-triangle"></span>
      Report · {$profilo.nome_provincia} ({$profilo.provincia}) · ±{Math.round(MARGINE_ERRORE * 100)}%
    </div>
    <h1 class="hero-title">
      Lavori <span>{giorniAffitto}</span> giorni<br />
      al mese per l'affitto.
    </h1>
    <p class="hero-sub">
      Il tuo salario lordo è
      <strong>{formatEuro($risultatoFiscale.netto_annuo + $risultatoFiscale.irpef_annua + $risultatoFiscale.contributi_inps + $risultatoFiscale.addizionale_regionale + $risultatoFiscale.addizionale_comunale)}</strong>.
      Dopo tasse ne ricevi <strong>{formatEuro($risultatoFiscale.netto_annuo)}</strong>.
      Di {$breakdownTemporale.ore_totali_mese} ore in un mese, <strong>{Math.round($breakdownTemporale.ore_sonno)}</strong> le dormi,
      <strong>{Math.round($breakdownTemporale.ore_lavoro)}</strong> le lavori,
      <strong>{Math.round($breakdownTemporale.ore_vita_biologica)}</strong> le spendi a mangiare, cucinare, lavarti, muoverti.
      Di <em>libero reale</em> ne resta circa <strong>{Math.round(tempoLiberoReale)}</strong> —
      <strong>{oreLiberoSettimana}</strong> ore a settimana.
    </p>
  </section>

  <!-- ─── Torta + legenda ─── -->
  <section class="content">
    <div class="chart-col">
      <div class="tdv-section-label">
        <span class="tdv-star"></span>
        Un mese di vita · {$breakdownTemporale.ore_totali_mese}h
      </div>
      <div class="chart-inner">
        <PieChart
          {segmenti}
          width={300}
          height={300}
          oreMese={$breakdownTemporale.ore_totali_mese}
          onSegmentClick={(s) => (segmentoSelezionato = s)}
        />
      </div>

      <!-- breakdown dettagliato al click -->
      {#if segmentoSelezionato}
        <div class="segment-detail">
          <div class="sd-head">
            <span class="sd-dot" style:background={segmentoSelezionato.colore}></span>
            <strong>{segmentoSelezionato.label}</strong>
            <span class="sd-hours">{Math.round(segmentoSelezionato.ore)}h</span>
          </div>
          <p class="sd-body">
            {segmentoSelezionato.descrizione ??
              'Ore residue dopo sonno, lavoro e riproduzione sociale.'}
          </p>
        </div>
      {/if}
    </div>

    <aside class="legend-col">
      <div class="tdv-section-label">
        <span class="tdv-star dim"></span>
        Dettaglio segmenti
      </div>
      <ul class="legend">
        {#each segmenti as s (s.id)}
          <li>
            <span class="legend-dot" style:background={s.colore}></span>
            <span class="legend-name">{s.label}</span>
            <span class="legend-val">
              <span class="ore">{Math.round(s.ore)}h</span>
              <span class="pct">
                {Math.round((s.ore / $breakdownTemporale.ore_totali_mese) * 100)}%
              </span>
            </span>
          </li>
        {/each}
      </ul>

      <div class="manifesto-nums">
        <div class="m-block">
          <div class="m-n red">{Math.round($breakdownTemporale.ore_lavoro)}h</div>
          <p>ore di lavoro mensili da contratto</p>
        </div>
        <div class="m-block">
          <div class="m-n dim">
            –{Math.round($breakdownTemporale.ore_vita_biologica)}h
          </div>
          <p>riproduzione sociale: mangiare, cucinare, igiene, spostamenti (ISTAT)</p>
        </div>
        <div class="m-block">
          <div class="m-n dim">
            –{Math.round($breakdownTemporale.ore_sopravvivenza + $breakdownTemporale.ore_stato)}h
          </div>
          <p>costi fissi + tasse, dentro le ore di lavoro</p>
        </div>
        <div class="m-block">
          <div class="m-n green">{Math.round(tempoLiberoReale)}h</div>
          <p>tempo libero reale, al netto di tutto</p>
        </div>
      </div>
    </aside>
  </section>

  <!-- ─── Costi della provincia ─── -->
  <section class="costi">
    <div class="tdv-section-label">
      <span class="tdv-star"></span>
      Costi della vita · {$costiProvincia.provincia} · aggiornato {$costiProvincia.aggiornato.slice(0, 10)}
    </div>
    <dl class="costi-grid">
      <div>
        <dt>Affitto bilocale (periferia)</dt>
        <dd>{formatEuro($costiProvincia.affitto_bilocale_periferia)}/mese</dd>
      </div>
      <div>
        <dt>Spesa alimentare minima</dt>
        <dd>{formatEuro($costiProvincia.spesa_alimentare_minima)}/mese</dd>
      </div>
      <div>
        <dt>Bollette</dt>
        <dd>{formatEuro($costiProvincia.bollette_stimate)}/mese</dd>
      </div>
      <div>
        <dt>Benzina</dt>
        <dd>{formatEuro($costiProvincia.carburante_benzina_litro)}/L</dd>
      </div>
    </dl>
  </section>

  <!-- ─── Comparatore città ─── -->
  {#if lordoAnnuoAttuale > 0}
    <ComparatoreCitta
      profiloAttuale={$profilo}
      {lordoAnnuoAttuale}
      nettoMensileAttuale={$risultatoFiscale.netto_mensile}
      affittoAttuale={$costiProvincia.affitto_bilocale_periferia}
      breakdownAttuale={$breakdownTemporale}
      liberoRealeAttuale={tempoLiberoReale}
    />
  {/if}

  <!-- ─── CTA locali ─── -->
  {#if ctaLocali.length > 0}
    <section class="cta">
      <div class="tdv-section-label">
        <span class="tdv-star"></span>
        Chi può aiutarti · {$profilo.nome_provincia}
      </div>
      <ul class="cta-list">
        {#each ctaLocali as c (c.id)}
          <li class="cta-item">
            <a href={c.url} target="_blank" rel="noopener noreferrer" class="cta-link">
              <div class="cta-head">
                <span class="cta-tipo">{c.tipo.replace(/_/g, ' ')}</span>
                <span class="cta-arrow">↗</span>
              </div>
              <div class="cta-nome">{c.nome}</div>
              <p class="cta-desc">{c.descrizione}</p>
              <div class="cta-tags">
                {#each c.tag as t}<span class="cta-tag">#{t}</span>{/each}
              </div>
            </a>
          </li>
        {/each}
      </ul>
    </section>
  {/if}

  <!-- ─── Export card ─── -->
  <section class="export-section">
    <div class="tdv-section-label">
      <span class="tdv-star dim"></span>
      Scarica come immagine
    </div>

    <!-- Card catturata da html-to-image. Stili critici inline per fedeltà render. -->
    <div
      class="export-card"
      bind:this={exportCardEl}
      aria-hidden="true"
    >
      <div class="ec-header">
        <span class="ec-app">TEMPO DI VITA</span>
        <span class="ec-meta">{$profilo?.nome_provincia?.toUpperCase()} · {new Date().getFullYear()}</span>
      </div>

      <div class="ec-headline">
        Lavori <span class="ec-n">{giorniAffitto}</span> giorni<br />al mese per l'affitto.
      </div>

      <div class="ec-metrics">
        <div class="ec-metric">
          <div class="ec-mv">{formatEuro($risultatoFiscale.netto_mensile)}</div>
          <div class="ec-ml">netto mensile</div>
        </div>
        <div class="ec-sep">·</div>
        <div class="ec-metric">
          <div class="ec-mv">{oreLiberoSettimana}h</div>
          <div class="ec-ml">libero reale/settimana</div>
        </div>
        <div class="ec-sep">·</div>
        <div class="ec-metric">
          <div class="ec-mv">{Math.round($risultatoFiscale.cuneo_fiscale_percentuale * 100)}%</div>
          <div class="ec-ml">cuneo fiscale sul lordo</div>
        </div>
      </div>

      <div class="ec-breakdown">
        {#each segmenti as s (s.id)}
          <div class="ec-bar-row">
            <div class="ec-bar-label">{s.label}</div>
            <div class="ec-bar-track">
              <div
                class="ec-bar-fill"
                style:width="{Math.round((s.ore / ($breakdownTemporale?.ore_totali_mese ?? 730)) * 100)}%"
                style:background={s.colore}
              ></div>
            </div>
            <div class="ec-bar-val">{Math.round(s.ore)}h</div>
          </div>
        {/each}
      </div>

      <div class="ec-footer">
        <div class="ec-prof">
          {$profilo?.settore_nome} · {$profilo?.tipo_contratto === 'nero' ? 'Lavoro non regolamentato' : $profilo?.tipo_contratto}
        </div>
        <div class="ec-url">life-time-eosin.vercel.app · ±3% · dati aperti</div>
      </div>
    </div>

    <button
      type="button"
      class="tdv-btn-ghost export-btn"
      onclick={esportaPng}
      disabled={esportando}
    >
      {esportando ? 'Generazione in corso…' : '↓ Scarica PNG (×2 retina)'}
    </button>
    <p class="tdv-privacy-note">
      L'immagine è generata interamente nel tuo browser. Nessun dato inviato a server.
    </p>
  </section>

  <!-- ─── Azioni ─── -->
  <section class="azioni">
    {#if $profilo?.tipo_contratto === 'nero'}
      <div class="share-nero-note">
        <span class="tdv-triangle"></span>
        Il report a nero non è condivisibile via link: la paga inserita non lascia mai il tuo browser
        e non può essere ricostruita da un URL. Fai uno screenshot se vuoi condividerlo.
      </div>
    {:else}
      <button type="button" class="tdv-btn-primary" onclick={condividi}>
        {mostraShareConferma ? '✓ Link copiato negli appunti' : 'Condividi questo report →'}
      </button>
      <p class="tdv-privacy-note">
        Il link contiene solo la tua selezione (provincia, settore, contratto), mai numeri o dati
        personali. Non stiamo memorizzando nulla di te.
      </p>
    {/if}
    <button type="button" class="tdv-btn-ghost" onclick={modifica}>← Modifica selezione</button>
    <button type="button" class="btn-ricomincia" onclick={ricomincia}>Ricomincia da zero</button>
  </section>
{:else}
  <div class="empty">
    <p>Nessun calcolo in sessione. Torno alla home…</p>
  </div>
{/if}

<style>
  /* ─── Hero ─── */
  .hero {
    padding: 48px 32px 32px;
    max-width: 960px;
    margin: 0 auto;
  }
  .hero-eyebrow {
    font-family: var(--tdv-mono);
    font-size: 10px;
    letter-spacing: 0.18em;
    color: var(--tdv-red);
    text-transform: uppercase;
    margin-bottom: 20px;
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .hero-title {
    font-family: var(--tdv-serif);
    font-style: italic;
    font-weight: 700;
    font-size: 56px;
    line-height: 1.02;
    color: var(--tdv-ink);
    margin-bottom: 22px;
  }
  .hero-title :global(span) {
    color: var(--tdv-red);
    font-style: normal;
  }
  .hero-sub {
    font-size: 13px;
    line-height: 1.8;
    color: var(--tdv-ink2);
    max-width: 680px;
    border-left: 2px solid var(--tdv-red);
    padding-left: 14px;
  }
  .hero-sub strong {
    color: var(--tdv-ink);
    font-weight: 600;
  }

  /* ─── Content ─── */
  .content {
    display: grid;
    grid-template-columns: 1fr 320px;
    border-top: var(--tdv-border);
    border-bottom: var(--tdv-border);
  }
  .chart-col {
    padding: 32px;
    border-right: var(--tdv-border);
  }
  .chart-inner {
    display: flex;
    justify-content: center;
    margin: 20px 0;
  }
  .legend-col {
    padding: 32px 24px;
  }

  .segment-detail {
    margin-top: 20px;
    padding: 16px 18px;
    border-left: 2px solid var(--tdv-red);
    background: rgba(200, 41, 30, 0.04);
  }
  .sd-head {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 12px;
    margin-bottom: 8px;
  }
  .sd-dot {
    width: 10px;
    height: 10px;
    display: inline-block;
  }
  .sd-head strong {
    flex: 1;
    color: var(--tdv-ink);
    font-weight: 600;
  }
  .sd-hours {
    font-family: var(--tdv-serif);
    font-style: italic;
    font-size: 18px;
    color: var(--tdv-red);
  }
  .sd-body {
    font-size: 11px;
    color: var(--tdv-ink2);
    line-height: 1.7;
  }

  /* ─── Legenda ─── */
  .legend {
    list-style: none;
    margin-bottom: 28px;
  }
  .legend li {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 0;
    border-bottom: 1px solid var(--tdv-border2);
    font-size: 11px;
  }
  .legend-dot {
    width: 10px;
    height: 10px;
    flex-shrink: 0;
  }
  .legend-name {
    flex: 1;
    color: var(--tdv-ink2);
    letter-spacing: 0.04em;
  }
  .legend-val {
    display: flex;
    gap: 10px;
    align-items: baseline;
    font-variant-numeric: tabular-nums;
  }
  .legend-val .ore {
    color: var(--tdv-ink);
    font-size: 11px;
  }
  .legend-val .pct {
    color: var(--tdv-ink3);
    font-size: 9px;
    letter-spacing: 0.1em;
  }

  .manifesto-nums {
    display: grid;
    gap: 16px;
  }
  .m-block p {
    font-size: 9px;
    color: var(--tdv-ink3);
    line-height: 1.7;
    letter-spacing: 0.04em;
    margin-top: 4px;
  }
  .m-n {
    font-family: var(--tdv-serif);
    font-style: italic;
    font-size: 32px;
    line-height: 1;
  }
  .m-n.red {
    color: var(--tdv-red);
  }
  .m-n.dim {
    color: var(--tdv-ink3);
  }
  .m-n.green {
    color: var(--tdv-green);
  }

  /* ─── Costi ─── */
  .costi {
    padding: 32px;
    border-bottom: var(--tdv-border);
  }
  .costi-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 24px;
  }
  .costi-grid > div {
    padding: 14px 0;
    border-top: 1px solid var(--tdv-border2);
  }
  .costi-grid dt {
    font-size: 9px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--tdv-ink3);
    margin-bottom: 8px;
  }
  .costi-grid dd {
    font-family: var(--tdv-serif);
    font-style: italic;
    font-size: 22px;
    color: var(--tdv-ink);
  }

  /* ─── CTA ─── */
  .cta {
    padding: 32px;
    border-bottom: var(--tdv-border);
  }
  .cta-list {
    list-style: none;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 16px;
  }
  .cta-item {
    border: 1px solid var(--tdv-border);
    transition: border-color 0.2s, background 0.2s;
  }
  .cta-item:hover {
    border-color: var(--tdv-red);
    background: rgba(200, 41, 30, 0.04);
  }
  .cta-link {
    display: block;
    padding: 18px 20px;
    color: inherit;
    text-decoration: none;
    border-bottom: none;
  }
  .cta-link:hover {
    color: inherit;
    border-color: inherit;
  }
  .cta-head {
    display: flex;
    justify-content: space-between;
    font-size: 9px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--tdv-red);
    margin-bottom: 10px;
  }
  .cta-nome {
    font-family: var(--tdv-mono);
    font-size: 13px;
    font-weight: 600;
    color: var(--tdv-ink);
    margin-bottom: 8px;
    line-height: 1.3;
  }
  .cta-desc {
    font-size: 11px;
    color: var(--tdv-ink2);
    line-height: 1.7;
    margin-bottom: 10px;
  }
  .cta-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .cta-tag {
    font-size: 9px;
    letter-spacing: 0.08em;
    color: var(--tdv-ink3);
    background: rgba(255, 255, 255, 0.03);
    padding: 3px 8px;
  }

  /* ─── Azioni ─── */
  .azioni {
    padding: 32px;
    max-width: 560px;
    margin: 0 auto;
    display: grid;
    gap: 12px;
  }
  .share-nero-note {
    font-size: 11px;
    color: var(--tdv-ink2);
    line-height: 1.7;
    border-left: 2px solid var(--tdv-red);
    padding: 10px 14px;
    display: flex;
    gap: 10px;
    align-items: flex-start;
  }
  .btn-ricomincia {
    background: transparent;
    border: none;
    color: var(--tdv-ink3);
    font-family: var(--tdv-mono);
    font-size: 9px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    padding: 8px 0;
    cursor: pointer;
    text-align: center;
    transition: color 0.2s;
  }
  .btn-ricomincia:hover {
    color: var(--tdv-ink2);
  }

  .empty {
    padding: 80px 32px;
    text-align: center;
    color: var(--tdv-ink3);
  }

  /* ─── Export section ─── */
  .export-section {
    padding: 32px;
    border-bottom: var(--tdv-border);
  }

  .export-card {
    width: 720px;
    background: #0a0a08;
    border: 1px solid rgba(240, 237, 230, 0.12);
    padding: 40px 44px 36px;
    font-family: 'IBM Plex Mono', ui-monospace, monospace;
    color: #f0ede6;
    margin-bottom: 16px;
  }

  .ec-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 32px;
  }
  .ec-app {
    font-size: 9px;
    letter-spacing: 0.22em;
    color: #c8291e;
    font-weight: 600;
  }
  .ec-meta {
    font-size: 9px;
    letter-spacing: 0.14em;
    color: #5a5850;
  }

  .ec-headline {
    font-family: 'Playfair Display', 'Times New Roman', serif;
    font-size: 42px;
    font-style: italic;
    font-weight: 700;
    line-height: 1.1;
    color: #f0ede6;
    margin-bottom: 28px;
  }
  .ec-n {
    color: #c8291e;
    font-style: normal;
  }

  .ec-metrics {
    display: flex;
    align-items: flex-end;
    gap: 20px;
    padding: 20px 0;
    border-top: 1px solid rgba(240, 237, 230, 0.08);
    border-bottom: 1px solid rgba(240, 237, 230, 0.08);
    margin-bottom: 24px;
  }
  .ec-metric {
    flex: 1;
  }
  .ec-mv {
    font-family: 'Playfair Display', 'Times New Roman', serif;
    font-style: italic;
    font-size: 26px;
    color: #f0ede6;
    line-height: 1;
    margin-bottom: 6px;
  }
  .ec-ml {
    font-size: 8px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #5a5850;
  }
  .ec-sep {
    color: #3a3a38;
    font-size: 20px;
    padding-bottom: 20px;
  }

  .ec-breakdown {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 24px;
  }
  .ec-bar-row {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .ec-bar-label {
    font-size: 8px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #a09e96;
    width: 130px;
    flex-shrink: 0;
  }
  .ec-bar-track {
    flex: 1;
    height: 3px;
    background: rgba(240, 237, 230, 0.06);
  }
  .ec-bar-fill {
    height: 100%;
    min-width: 2px;
  }
  .ec-bar-val {
    font-size: 9px;
    color: #5a5850;
    width: 32px;
    text-align: right;
    flex-shrink: 0;
    font-variant-numeric: tabular-nums;
  }

  .ec-footer {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    padding-top: 16px;
    border-top: 1px solid rgba(240, 237, 230, 0.06);
  }
  .ec-prof {
    font-size: 9px;
    letter-spacing: 0.1em;
    color: #5a5850;
    text-transform: uppercase;
  }
  .ec-url {
    font-size: 8px;
    letter-spacing: 0.1em;
    color: #3a3a38;
    text-transform: uppercase;
  }

  .export-btn {
    width: 720px;
  }

  /* responsive */
  @media (max-width: 900px) {
    .content {
      grid-template-columns: 1fr;
    }
    .chart-col {
      border-right: none;
      border-bottom: var(--tdv-border);
    }
    .costi-grid {
      grid-template-columns: 1fr 1fr;
    }
    .hero-title {
      font-size: 42px;
    }
  }
  @media (max-width: 520px) {
    .costi-grid {
      grid-template-columns: 1fr;
    }
    .hero {
      padding: 28px 20px 20px;
    }
    .hero-title {
      font-size: 32px;
    }
  }
</style>
