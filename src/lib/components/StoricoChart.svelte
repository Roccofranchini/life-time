<!--
  src/lib/components/StoricoChart.svelte
  Visualizzazione storica 2015-2025: netto mensile vs costi fissi.
  Profilo tipo: CCNL Commercio L4, Bologna.

  Due aree SVG:
    – verde (piena): netto mensile anno per anno
    – rossa (linea + fill): costi fissi — quando supera il verde, CRISI.

  Tecnica: D3 puro per calcolare path/scale, render dichiarativo Svelte (SSR-safe).
  Nessun effetto / onMount: tutto $derived.
-->
<script lang="ts">
  import * as d3 from 'd3';
  import storicoRaw from '$lib/data/storico.json';

  interface PuntoStorico {
    anno: number;
    lordo_mensile: number;
    netto_mensile: number;
    affitto: number;
    spesa_minima: number;
    bollette: number;
    benzina_litro: number;
    costi_fissi: number;
    residuo: number;
    giorni_affitto: number;
    evento: string | null;
  }

  const serie = storicoRaw.serie as PuntoStorico[];

  // ─── Layout ──────────────────────────────────────────────────────
  const W = 800;
  const H = 320;
  const M = { top: 24, right: 24, bottom: 48, left: 64 };
  const INNER_W = W - M.left - M.right;
  const INNER_H = H - M.top - M.bottom;

  // ─── Scale ───────────────────────────────────────────────────────
  const xScale = d3
    .scaleLinear()
    .domain([2015, 2025])
    .range([0, INNER_W]);

  const yMax = 1800;
  const yScale = d3.scaleLinear().domain([0, yMax]).range([INNER_H, 0]);

  // ─── Generatori path ─────────────────────────────────────────────
  const lineNetto = d3
    .line<PuntoStorico>()
    .x((d) => xScale(d.anno))
    .y((d) => yScale(d.netto_mensile))
    .curve(d3.curveMonotoneX);

  const lineCosti = d3
    .line<PuntoStorico>()
    .x((d) => xScale(d.anno))
    .y((d) => yScale(d.costi_fissi))
    .curve(d3.curveMonotoneX);

  const areaNetto = d3
    .area<PuntoStorico>()
    .x((d) => xScale(d.anno))
    .y0(yScale(0))
    .y1((d) => yScale(d.netto_mensile))
    .curve(d3.curveMonotoneX);

  // Area della "crisi": tra le due linee, non clippiamo —
  // lasciamo il fill pieno e usiamo opacity bassa.
  // Visivamente chiaro: il rosso sale sopra il verde.
  const areaCrisi = d3
    .area<PuntoStorico>()
    .x((d) => xScale(d.anno))
    .y0((d) => yScale(d.netto_mensile))
    .y1((d) => yScale(d.costi_fissi))
    .curve(d3.curveMonotoneX);

  // ─── Paths ───────────────────────────────────────────────────────
  const pathNetto   = lineNetto(serie)  ?? '';
  const pathCosti   = lineCosti(serie)  ?? '';
  const fillNetto   = areaNetto(serie)  ?? '';
  const fillCrisi   = areaCrisi(serie)  ?? '';

  // ─── Assi ────────────────────────────────────────────────────────
  const yTicks = [0, 400, 800, 1200, 1600];
  const xTicks = serie.map((d) => d.anno);

  // ─── Stato hover ─────────────────────────────────────────────────
  let hoveredAnno = $state<number | null>(null);
  const hoveredPoint = $derived(
    hoveredAnno != null ? serie.find((d) => d.anno === hoveredAnno) ?? null : null
  );

  function handleMouseMove(e: MouseEvent) {
    const rect = (e.currentTarget as SVGElement).getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * W - M.left;
    const anno = Math.round(xScale.invert(svgX));
    if (anno >= 2015 && anno <= 2025) hoveredAnno = anno;
  }

  function handleMouseLeave() {
    hoveredAnno = null;
  }

  // Crossover anno: primo anno in cui costi > netto
  const crossoverAnno = serie.find((d) => d.residuo < 0)?.anno ?? null;

  function fmt(n: number): string {
    return n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
  }
</script>

<div class="storico-wrap">
  <svg
    viewBox="0 0 {W} {H}"
    class="storico-svg"
    role="img"
    aria-label="Andamento netto mensile vs costi fissi 2015-2025, profilo tipo Bologna"
    onmousemove={handleMouseMove}
    onmouseleave={handleMouseLeave}
  >
    <g transform="translate({M.left},{M.top})">

      <!-- ── Griglia y ── -->
      {#each yTicks as y}
        <line
          x1="0" x2={INNER_W}
          y1={yScale(y)} y2={yScale(y)}
          stroke="rgba(240,237,230,0.05)" stroke-width="1"
        />
        <text
          x="-8" y={yScale(y)}
          fill="#5a5850"
          font-size="9"
          text-anchor="end"
          dominant-baseline="middle"
          font-family="IBM Plex Mono, monospace"
        >{y === 0 ? '0€' : `${y/1000 >= 1 ? (y/1000).toFixed(0)+'k' : y}€`}</text>
      {/each}

      <!-- ── Area netto (verde bassa opacità) ── -->
      <path d={fillNetto} fill="rgba(29,158,117,0.12)" />

      <!-- ── Area crisi (rosso dove costi > netto) ── -->
      <path d={fillCrisi} fill="rgba(200,41,30,0.18)" />

      <!-- ── Linea netto ── -->
      <path d={pathNetto} fill="none" stroke="#1d9e75" stroke-width="2" />

      <!-- ── Linea costi ── -->
      <path d={pathCosti} fill="none" stroke="#c8291e" stroke-width="2" stroke-dasharray="5,3" />

      <!-- ── Annotazione crossover ── -->
      {#if crossoverAnno}
        {@const cx = xScale(crossoverAnno - 0.5)}
        <line
          x1={cx} x2={cx}
          y1="0" y2={INNER_H}
          stroke="rgba(200,41,30,0.3)" stroke-width="1" stroke-dasharray="3,4"
        />
        <text
          x={cx - 6} y="8"
          fill="#c8291e" font-size="8"
          text-anchor="end"
          font-family="IBM Plex Mono, monospace"
          letter-spacing="0.08em"
        >CRISI</text>
      {/if}

      <!-- ── Punti interattivi ── -->
      {#each serie as d}
        {@const cx = xScale(d.anno)}
        {@const cyNetto = yScale(d.netto_mensile)}
        {@const cyCosti = yScale(d.costi_fissi)}
        <circle cx={cx} cy={cyNetto} r={hoveredAnno === d.anno ? 5 : 3} fill="#1d9e75" />
        <circle cx={cx} cy={cyCosti} r={hoveredAnno === d.anno ? 5 : 3} fill="#c8291e" />

        <!-- Evento markers -->
        {#if d.evento}
          <circle cx={cx} cy={yScale(yMax * 0.92)} r="4"
            fill="none" stroke="#c8291e" stroke-width="1.5"
          />
        {/if}
      {/each}

      <!-- ── Linea hover ── -->
      {#if hoveredAnno != null}
        {@const hx = xScale(hoveredAnno)}
        <line x1={hx} x2={hx} y1="0" y2={INNER_H}
          stroke="rgba(240,237,230,0.15)" stroke-width="1" />
      {/if}

      <!-- ── Asse X ── -->
      <line x1="0" x2={INNER_W} y1={INNER_H} y2={INNER_H}
        stroke="rgba(240,237,230,0.1)" stroke-width="1" />
      {#each xTicks as anno}
        <text
          x={xScale(anno)} y={INNER_H + 14}
          fill={hoveredAnno === anno ? '#f0ede6' : '#5a5850'}
          font-size="9"
          text-anchor="middle"
          font-family="IBM Plex Mono, monospace"
        >{anno}</text>
      {/each}

      <!-- ── Barre giorni affitto (sotto X) ── -->
      <!-- Mostriamo solo le etichette, non le barre per evitare sovraffollamento -->

    </g>
  </svg>

  <!-- ── Tooltip hover ── -->
  {#if hoveredPoint}
    {@const p = hoveredPoint}
    <div class="storico-tooltip">
      <div class="tt-anno">{p.anno}</div>
      {#if p.evento}
        <div class="tt-evento">{p.evento}</div>
      {/if}
      <div class="tt-row tt-netto">
        <span>Netto</span>
        <strong>{fmt(p.netto_mensile)}/mese</strong>
      </div>
      <div class="tt-row tt-costi">
        <span>Costi fissi</span>
        <strong>{fmt(p.costi_fissi)}/mese</strong>
      </div>
      <div class="tt-row" class:tt-neg={p.residuo < 0} class:tt-pos={p.residuo >= 0}>
        <span>Residuo</span>
        <strong>{p.residuo >= 0 ? '+' : ''}{fmt(p.residuo)}</strong>
      </div>
      <div class="tt-sub">
        {p.giorni_affitto}gg/mese per l'affitto · affitto {fmt(p.affitto)}
      </div>
    </div>
  {/if}

  <!-- ── Legenda ── -->
  <div class="storico-legend">
    <span class="leg-netto">— Netto mensile</span>
    <span class="leg-costi">- - Costi fissi</span>
    <span class="leg-area">▓ zona di crisi (costi &gt; netto)</span>
  </div>

  <!-- ── Giorni affitto mini-chart ── -->
  <div class="giorni-row" aria-label="Giorni lavorati per l'affitto per anno">
    {#each serie as d}
      <div class="gg-item">
        <div class="gg-n" class:gg-alto={d.giorni_affitto >= 18}>{d.giorni_affitto}</div>
        <div class="gg-anno">{d.anno}</div>
      </div>
    {/each}
  </div>
  <div class="gg-label">giorni al mese lavorati per l'affitto</div>

  <p class="storico-nota">
    {storicoRaw.profilo_tipo} · stime editoriali ±5% ·
    <a href="https://www.agenziaentrate.gov.it" target="_blank" rel="noopener noreferrer">Ag. Entrate</a> ·
    <a href="https://www.istat.it" target="_blank" rel="noopener noreferrer">ISTAT</a> ·
    <a href="https://www.arera.it" target="_blank" rel="noopener noreferrer">ARERA</a> ·
    <a href="https://carburanti.mise.gov.it" target="_blank" rel="noopener noreferrer">Mimit</a>
  </p>
</div>

<style>
  .storico-wrap {
    position: relative;
  }

  .storico-svg {
    width: 100%;
    height: auto;
    display: block;
    overflow: visible;
  }

  .storico-tooltip {
    position: absolute;
    top: 20px;
    right: 0;
    background: #111110;
    border: 1px solid rgba(240,237,230,0.12);
    border-left: 2px solid var(--tdv-red);
    padding: 12px 16px;
    min-width: 200px;
    font-size: 11px;
    pointer-events: none;
  }
  .tt-anno {
    font-family: var(--tdv-serif);
    font-style: italic;
    font-size: 22px;
    color: var(--tdv-ink);
    line-height: 1;
    margin-bottom: 6px;
  }
  .tt-evento {
    font-size: 9px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--tdv-red);
    margin-bottom: 10px;
  }
  .tt-row {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    padding: 4px 0;
    border-bottom: 1px solid rgba(240,237,230,0.06);
    color: var(--tdv-ink2);
  }
  .tt-row strong { color: var(--tdv-ink); }
  .tt-netto strong { color: #1d9e75; }
  .tt-costi strong { color: var(--tdv-red); }
  .tt-neg strong { color: var(--tdv-red); font-weight: 700; }
  .tt-pos strong { color: #1d9e75; font-weight: 700; }
  .tt-sub {
    font-size: 9px;
    color: var(--tdv-ink3);
    margin-top: 8px;
    letter-spacing: 0.04em;
  }

  .storico-legend {
    display: flex;
    gap: 20px;
    font-size: 9px;
    letter-spacing: 0.08em;
    margin: 8px 0 16px;
    flex-wrap: wrap;
  }
  .leg-netto { color: #1d9e75; }
  .leg-costi { color: var(--tdv-red); }
  .leg-area { color: rgba(200,41,30,0.7); }

  .giorni-row {
    display: flex;
    gap: 0;
    border-top: 1px solid var(--tdv-border2);
    padding-top: 10px;
    margin-bottom: 4px;
  }
  .gg-item {
    flex: 1;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }
  .gg-n {
    font-family: var(--tdv-serif);
    font-style: italic;
    font-size: 16px;
    color: var(--tdv-ink2);
    line-height: 1;
  }
  .gg-alto {
    color: var(--tdv-red);
    font-weight: 700;
  }
  .gg-anno {
    font-size: 7px;
    color: var(--tdv-ink3);
    letter-spacing: 0.06em;
  }
  .gg-label {
    font-size: 8px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--tdv-ink3);
    text-align: center;
    margin-bottom: 16px;
  }

  .storico-nota {
    font-size: 9px;
    color: var(--tdv-ink3);
    border-left: 1px solid var(--tdv-border);
    padding-left: 10px;
    line-height: 1.7;
  }
  .storico-nota a {
    color: var(--tdv-ink3);
    text-decoration: underline;
    text-underline-offset: 3px;
  }
  .storico-nota a:hover {
    color: var(--tdv-red);
  }

  @media (max-width: 640px) {
    .storico-tooltip {
      position: static;
      margin-bottom: 12px;
      border-left-width: 2px;
    }
    .gg-n { font-size: 13px; }
    .gg-anno { font-size: 6px; }
  }
</style>
