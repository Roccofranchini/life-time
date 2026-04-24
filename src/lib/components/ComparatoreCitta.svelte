<!--
  src/lib/components/ComparatoreCitta.svelte
  "E se ti trasferissi?"
  Input: seconda provincia (autocomplete). Mantiene lo stesso lordo/contratto,
  cambia regione/comune → cambia netto (addizionali) + costi vita → cambia
  breakdown temporale.
  Viz: due barre orizzontali stacked (attuale vs ipotetica), diff "+/−Xh libero".
  Tutto CSS puro: la torta è già nella pagina, qui serve un'altra forma.
-->
<script lang="ts">
  import { calcola_sopravvivenza, calcola_breakdown_temporale } from '$lib/engine';
  import provinceData from '$lib/data/province.json';
  import type {
    CostiVita,
    FiscalOutput,
    ProfiloUtente,
    SurvivalOutput,
    TimeBreakdown
  } from '$lib/types';

  interface ProvinciaEntry {
    codice: string;
    nome: string;
    regione: string;
    capoluogo: boolean;
  }

  interface Props {
    profiloAttuale: ProfiloUtente;
    lordoAnnuoAttuale: number;
    nettoMensileAttuale: number;
    affittoAttuale: number;
    breakdownAttuale: TimeBreakdown;
    liberoRealeAttuale: number;
  }

  const {
    profiloAttuale,
    lordoAnnuoAttuale,
    nettoMensileAttuale,
    affittoAttuale,
    breakdownAttuale,
    liberoRealeAttuale
  }: Props = $props();

  const CONSUMO_BENZINA_LITRI_MESE = 40;
  const ORE_LAVORO_MENSILI_FULLTIME = (40 * 52) / 12;

  const tutteLeProvince: ProvinciaEntry[] = (
    provinceData as { province: ProvinciaEntry[] }
  ).province;

  // ─── Stato ──────────────────────────────────────────────────────
  let query = $state('');
  let selezionata = $state<ProvinciaEntry | null>(null);
  let inFetch = $state(false);
  let errore = $state<string | null>(null);

  let nuovoFiscal = $state<FiscalOutput | null>(null);
  let nuoviCosti = $state<CostiVita | null>(null);
  let nuovoSurvival = $state<SurvivalOutput | null>(null);
  let nuovoBreakdown = $state<TimeBreakdown | null>(null);

  const suggerimenti: ProvinciaEntry[] = $derived.by(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    if (selezionata && query === `${selezionata.nome} (${selezionata.codice})`) return [];
    return tutteLeProvince
      .filter(
        (p) =>
          p.codice !== profiloAttuale.provincia &&
          (p.nome.toLowerCase().includes(q) ||
            p.codice.toLowerCase() === q ||
            p.regione.replace(/-/g, ' ').includes(q))
      )
      .slice(0, 6);
  });

  const oreLavoroMensili = $derived(
    profiloAttuale.tipo_contratto === 'parttime' && profiloAttuale.percentuale_parttime
      ? ORE_LAVORO_MENSILI_FULLTIME * profiloAttuale.percentuale_parttime
      : ORE_LAVORO_MENSILI_FULLTIME
  );

  const liberoRealeNuovo = $derived(nuovoBreakdown?.ore_libero_reale ?? 0);

  // "Ore di lavoro forzate" = sopravvivenza + stato. Le ore del tuo lavoro
  // che, a parità di contratto, finiscono SEMPRE a coprire costi locali
  // (affitto/spesa/bollette/carburante) e tasse locali (addizionali regionali
  // e comunali). È l'unico numero che davvero varia tra due città per lo
  // stesso contratto. `ore_libero_reale` è invariante per contratto (= 310
  // − ore_lavoro), e `salario_residuo` spesso è saturato a 0 per i salari
  // medi — quindi nessuno dei due funziona come metrica del confronto.
  // La diff di ore_lavoro_forzate, con segno invertito (meno forzato = meglio),
  // è il nostro "tempo di vita recuperato".
  const oreLavoroForzateAttuale = $derived(
    breakdownAttuale.ore_sopravvivenza + breakdownAttuale.ore_stato
  );
  const oreLavoroForzateNuovo = $derived(
    nuovoBreakdown
      ? nuovoBreakdown.ore_sopravvivenza + nuovoBreakdown.ore_stato
      : 0
  );

  // Positivo = trasferirti ti libera ore, negativo = te ne toglie.
  const diffLibero = $derived(oreLavoroForzateAttuale - oreLavoroForzateNuovo);

  // Delta granulari utili nella diff-card
  const diffSopravvivenza = $derived(
    nuovoBreakdown
      ? nuovoBreakdown.ore_sopravvivenza - breakdownAttuale.ore_sopravvivenza
      : 0
  );
  const diffStato = $derived(
    nuovoBreakdown ? nuovoBreakdown.ore_stato - breakdownAttuale.ore_stato : 0
  );

  const diffNetto = $derived(
    nuovoFiscal ? nuovoFiscal.netto_mensile - nettoMensileAttuale : 0
  );
  const diffAffitto = $derived(
    nuoviCosti ? nuoviCosti.affitto_bilocale_periferia - affittoAttuale : 0
  );

  // ─── Handlers ───────────────────────────────────────────────────
  function scegli(p: ProvinciaEntry) {
    selezionata = p;
    query = `${p.nome} (${p.codice})`;
  }

  async function confronta() {
    if (!selezionata) return;
    inFetch = true;
    errore = null;

    try {
      const [respFisc, respCosti] = await Promise.all([
        fetch('/api/calcola', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            lordo_annuo: lordoAnnuoAttuale,
            tipo_contratto: profiloAttuale.tipo_contratto,
            regione: selezionata.regione,
            comune: selezionata.nome.toLowerCase(),
            ...(profiloAttuale.tipo_contratto === 'parttime' &&
            profiloAttuale.percentuale_parttime
              ? { percentuale_parttime: profiloAttuale.percentuale_parttime }
              : {})
          })
        }),
        fetch(`/api/costi/${selezionata.codice}`)
      ]);

      if (!respFisc.ok) throw new Error(`Errore calcolo (${respFisc.status})`);
      if (!respCosti.ok) throw new Error(`Errore costi (${respCosti.status})`);

      const fisc: FiscalOutput = await respFisc.json();
      const costi: CostiVita = await respCosti.json();

      const surv = calcola_sopravvivenza({
        affitto: costi.affitto_bilocale_periferia,
        spesa_minima: costi.spesa_alimentare_minima,
        bollette: costi.bollette_stimate,
        carburante_mensile_stimato:
          costi.carburante_benzina_litro * CONSUMO_BENZINA_LITRI_MESE,
        netto_mensile: fisc.netto_mensile,
        ore_lavoro_mensili: oreLavoroMensili
      });

      const brk = calcola_breakdown_temporale({
        survival: surv,
        fiscal: fisc,
        lordo_annuo: lordoAnnuoAttuale,
        ore_lavoro_mensili: oreLavoroMensili,
        settore_id: profiloAttuale.settore_id,
        affitto: costi.affitto_bilocale_periferia
      });

      nuovoFiscal = fisc;
      nuoviCosti = costi;
      nuovoSurvival = surv;
      nuovoBreakdown = brk;
    } catch (e) {
      errore = e instanceof Error ? e.message : 'Errore sconosciuto';
    } finally {
      inFetch = false;
    }
  }

  function resetta() {
    selezionata = null;
    query = '';
    nuovoFiscal = null;
    nuoviCosti = null;
    nuovoSurvival = null;
    nuovoBreakdown = null;
    errore = null;
  }

  // ─── Helpers visualizzazione ───────────────────────────────────
  interface SegVis {
    id: string;
    label: string;
    ore: number;
    colore: string;
  }

  function segmentiDi(b: TimeBreakdown, liberoReale: number): SegVis[] {
    const salarioResiduo = Math.max(
      0,
      b.ore_lavoro - b.ore_sopravvivenza - b.ore_stato - b.ore_capitale
    );
    const base: SegVis[] = [
      { id: 'sonno', label: 'Sonno', ore: b.ore_sonno, colore: 'var(--tdv-seg-sonno)' },
      { id: 'sopravvivenza', label: 'Sopravv.', ore: b.ore_sopravvivenza, colore: 'var(--tdv-seg-sopravvivenza)' },
      { id: 'stato', label: 'Stato', ore: b.ore_stato, colore: 'var(--tdv-seg-stato)' },
      { id: 'capitale', label: 'Capitale', ore: b.ore_capitale, colore: 'var(--tdv-seg-capitale)' }
    ];
    if (salarioResiduo > 1) {
      base.push({
        id: 'salario_residuo',
        label: 'Salario res.',
        ore: salarioResiduo,
        colore: 'var(--tdv-seg-salario-residuo)'
      });
    }
    base.push(
      { id: 'vita_biologica', label: 'Vita bio.', ore: b.ore_vita_biologica, colore: 'var(--tdv-seg-vita-biologica)' },
      { id: 'libero', label: 'Libero', ore: liberoReale, colore: 'var(--tdv-seg-libero)' }
    );
    return base;
  }

  const segAttuale: SegVis[] = $derived(segmentiDi(breakdownAttuale, liberoRealeAttuale));
  const segNuovo: SegVis[] = $derived(
    nuovoBreakdown ? segmentiDi(nuovoBreakdown, liberoRealeNuovo) : []
  );

  function firmato(n: number, suffisso = '€'): string {
    const intero = Math.round(n);
    return `${intero >= 0 ? '+' : ''}${intero}${suffisso}`;
  }
</script>

<section class="comparatore">
  <div class="tdv-section-label">
    <span class="tdv-star"></span>
    E se ti trasferissi?
  </div>

  <p class="intro">
    Mantenendo lo stesso contratto <strong>{profiloAttuale.settore_nome}</strong> livello
    <strong>{profiloAttuale.livello}</strong>, come cambierebbe il tuo tempo di vita in un'altra
    provincia?
  </p>

  <div class="picker">
    <label for="cmp-input" class="wizard-label">Seconda provincia</label>
    <input
      id="cmp-input"
      type="text"
      class="tdv-input"
      placeholder="Cerca: Milano, Palermo, Cuneo…"
      bind:value={query}
      autocomplete="off"
    />

    {#if suggerimenti.length > 0}
      <ul class="ac">
        {#each suggerimenti as p (p.codice)}
          <li>
            <button type="button" onclick={() => scegli(p)}>
              <span class="ac-name">{p.nome}</span>
              <span class="ac-codice">{p.codice}</span>
            </button>
          </li>
        {/each}
      </ul>
    {/if}

    <div class="picker-actions">
      <button
        type="button"
        class="btn-primary"
        disabled={!selezionata || inFetch}
        onclick={confronta}
      >
        {inFetch ? 'Calcolo…' : 'Confronta →'}
      </button>
      {#if nuovoBreakdown || errore}
        <button type="button" class="btn-ghost" onclick={resetta}>Reset</button>
      {/if}
    </div>

    {#if errore}
      <div class="errore">⚠ {errore}</div>
    {/if}
  </div>

  {#if nuovoBreakdown && selezionata && nuovoFiscal && nuoviCosti}
    <div class="bars">
      <div class="bar-row">
        <div class="bar-label">
          <div class="bar-city">{profiloAttuale.nome_provincia}</div>
          <div class="bar-sub">attuale</div>
        </div>
        <div class="bar-track" role="img" aria-label="Ripartizione mensile città attuale">
          {#each segAttuale as s (s.id)}
            <span
              class="bar-seg"
              style:flex-grow={s.ore}
              style:background={s.colore}
              title="{s.label}: {Math.round(s.ore)}h"
            ></span>
          {/each}
        </div>
      </div>

      <div class="bar-row">
        <div class="bar-label">
          <div class="bar-city">{selezionata.nome}</div>
          <div class="bar-sub">ipotetica</div>
        </div>
        <div class="bar-track" role="img" aria-label="Ripartizione mensile città ipotetica">
          {#each segNuovo as s (s.id)}
            <span
              class="bar-seg"
              style:flex-grow={s.ore}
              style:background={s.colore}
              title="{s.label}: {Math.round(s.ore)}h"
            ></span>
          {/each}
        </div>
      </div>
    </div>

    <div
      class="diff-card"
      class:positivo={diffLibero > 0}
      class:negativo={diffLibero < 0}
    >
      <div class="diff-eye">
        {#if diffLibero > 0}
          ↑ A {selezionata.nome} recupereresti
        {:else if diffLibero < 0}
          ↓ A {selezionata.nome} perderesti
        {:else}
          → A {selezionata.nome} cambia nulla:
        {/if}
      </div>
      <div class="diff-big">
        {diffLibero >= 0 ? '+' : ''}{Math.round(diffLibero)}h
      </div>
      <div class="diff-sub">
        di ore di vita al mese ({(diffLibero / 4.33 >= 0 ? '+' : '') +
          (diffLibero / 4.33).toFixed(1)}h a settimana) — ore di lavoro che
        non finirebbero più in affitto, bollette e addizionali locali. Le
        ore fisicamente libere (sonno, vita biologica, dopo-lavoro) non
        cambiano a parità di contratto.
      </div>
    </div>

    <dl class="diff-grid">
      <div>
        <dt>Netto mensile</dt>
        <dd>
          {Math.round(nuovoFiscal.netto_mensile).toLocaleString('it-IT')}€
          <span class="diff-inline">({firmato(diffNetto)})</span>
        </dd>
      </div>
      <div>
        <dt>Affitto</dt>
        <dd>
          {nuoviCosti.affitto_bilocale_periferia}€
          <span class="diff-inline">({firmato(diffAffitto)})</span>
        </dd>
      </div>
      <div>
        <dt>Sopravvivenza</dt>
        <dd>
          {Math.round(nuovoBreakdown.ore_sopravvivenza)}h
          <span class="diff-inline">({firmato(diffSopravvivenza, 'h')})</span>
        </dd>
      </div>
      <div>
        <dt>Stato</dt>
        <dd>
          {Math.round(nuovoBreakdown.ore_stato)}h
          <span class="diff-inline">({firmato(diffStato, 'h')})</span>
        </dd>
      </div>
    </dl>

    <p class="caveat">
      Non è consulenza: non considera trasloco, rete sociale, costo di vivere lontano dalla
      famiglia. Il "trasferimento razionale" è una categoria del capitale, non della vita.
    </p>
  {/if}
</section>

<style>
  .comparatore {
    padding: 32px;
    border-bottom: var(--tdv-border);
  }

  .intro {
    font-size: 12px;
    color: var(--tdv-ink2);
    line-height: 1.7;
    margin-bottom: 20px;
    max-width: 640px;
  }
  .intro strong {
    color: var(--tdv-ink);
    font-weight: 600;
  }

  .picker {
    max-width: 480px;
    margin-bottom: 28px;
  }
  .wizard-label {
    display: block;
    font-size: 9px;
    letter-spacing: 0.12em;
    color: var(--tdv-ink3);
    text-transform: uppercase;
    margin-bottom: 8px;
  }
  .ac {
    list-style: none;
    border: 1px solid var(--tdv-border);
    border-top: none;
    max-height: 220px;
    overflow-y: auto;
    background: #111110;
    margin: 0;
    padding: 0;
  }
  .ac li + li {
    border-top: 1px solid var(--tdv-border2);
  }
  .ac button {
    width: 100%;
    background: transparent;
    border: none;
    color: var(--tdv-ink);
    padding: 10px 14px;
    display: flex;
    justify-content: space-between;
    cursor: pointer;
    font-family: var(--tdv-mono);
    font-size: 12px;
  }
  .ac button:hover {
    background: rgba(200, 41, 30, 0.08);
    color: var(--tdv-red);
  }
  .ac-codice {
    font-size: 10px;
    color: var(--tdv-ink3);
    letter-spacing: 0.1em;
  }
  .picker-actions {
    display: flex;
    gap: 10px;
    margin-top: 14px;
  }
  .btn-primary {
    flex: 1;
    background: var(--tdv-red);
    color: #fff;
    border: none;
    font-family: var(--tdv-mono);
    font-size: 11px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    padding: 12px 20px;
    cursor: pointer;
    transition: background 0.2s;
  }
  .btn-primary:hover:not(:disabled) {
    background: var(--tdv-red2);
  }
  .btn-primary:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .btn-ghost {
    background: transparent;
    color: var(--tdv-ink2);
    border: 1px solid var(--tdv-border);
    font-family: var(--tdv-mono);
    font-size: 11px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    padding: 12px 18px;
    cursor: pointer;
    transition: color 0.2s, border-color 0.2s;
  }
  .btn-ghost:hover {
    border-color: var(--tdv-ink3);
    color: var(--tdv-ink);
  }
  .errore {
    margin-top: 12px;
    padding: 10px 14px;
    border-left: 2px solid var(--tdv-red);
    background: rgba(200, 41, 30, 0.08);
    font-size: 11px;
    color: var(--tdv-red2);
  }

  .bars {
    display: grid;
    gap: 18px;
    margin-bottom: 22px;
  }
  .bar-row {
    display: grid;
    grid-template-columns: 140px 1fr;
    gap: 18px;
    align-items: center;
  }
  .bar-label .bar-city {
    font-family: var(--tdv-serif);
    font-style: italic;
    font-size: 20px;
    color: var(--tdv-ink);
  }
  .bar-label .bar-sub {
    font-size: 9px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--tdv-ink3);
  }
  .bar-track {
    display: flex;
    width: 100%;
    height: 28px;
    background: #111110;
    border: 1px solid var(--tdv-border);
    overflow: hidden;
  }
  .bar-seg {
    display: block;
    height: 100%;
    transition: flex-grow 0.3s ease;
  }

  .diff-card {
    padding: 18px 22px;
    border-left: 3px solid var(--tdv-ink3);
    background: rgba(255, 255, 255, 0.02);
    margin-bottom: 22px;
  }
  .diff-card.positivo {
    border-left-color: var(--tdv-green);
    background: rgba(29, 158, 117, 0.06);
  }
  .diff-card.negativo {
    border-left-color: var(--tdv-red);
    background: rgba(200, 41, 30, 0.06);
  }
  .diff-eye {
    font-size: 9px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--tdv-ink3);
    margin-bottom: 6px;
  }
  .diff-big {
    font-family: var(--tdv-serif);
    font-style: italic;
    font-weight: 700;
    font-size: 48px;
    line-height: 1;
    color: var(--tdv-ink);
  }
  .diff-card.positivo .diff-big {
    color: var(--tdv-green);
  }
  .diff-card.negativo .diff-big {
    color: var(--tdv-red);
  }
  .diff-sub {
    font-size: 11px;
    color: var(--tdv-ink2);
    margin-top: 6px;
  }

  .diff-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
    margin-bottom: 16px;
  }
  .diff-grid > div {
    padding: 12px 0;
    border-top: 1px solid var(--tdv-border2);
  }
  .diff-grid dt {
    font-size: 9px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--tdv-ink3);
    margin-bottom: 6px;
  }
  .diff-grid dd {
    font-family: var(--tdv-serif);
    font-style: italic;
    font-size: 20px;
    color: var(--tdv-ink);
  }
  .diff-inline {
    display: inline-block;
    font-family: var(--tdv-mono);
    font-style: normal;
    font-size: 10px;
    color: var(--tdv-ink3);
    margin-left: 6px;
  }

  .caveat {
    font-size: 10px;
    color: var(--tdv-ink3);
    border-left: 1px solid var(--tdv-border);
    padding-left: 12px;
    max-width: 640px;
    line-height: 1.7;
  }

  @media (max-width: 760px) {
    .bar-row {
      grid-template-columns: 1fr;
    }
    .diff-grid {
      grid-template-columns: 1fr 1fr;
    }
  }
</style>
