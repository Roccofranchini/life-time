<!--
  src/lib/components/PieChart.svelte
  Torta D3 a N segmenti (tipicamente 5: sopravvivenza · stato · capitale · vita biologica · libero reale).
  Entrata animata 1.2s ease-out (transizione d a pie generator).

  Tooltip: in hover/focus su un segmento compare un overlay HTML col micro-testo
  politico-editoriale di quel segmento. Tipografia coerente col design system:
  IBM Plex Mono, ink su paper-2, bordo rosso, 0 radius.

  Accessibilità:
    - <title> e <desc> SVG
    - <table> sr-only con gli stessi dati: se CSS non carica / JS off, i numeri restano leggibili
    - focus con keyboard → tooltip visibile
  Valori in ore. La somma dei segmenti è normalizzata a 730h (1 mese).
-->
<script lang="ts">
  import * as d3 from 'd3';

  export interface Segmento {
    id: string;
    label: string;
    ore: number;
    colore: string;
    /** Micro-testo 1–2 righe mostrato in hover/focus. */
    descrizione?: string;
  }

  interface Props {
    segmenti: Segmento[];
    width?: number;
    height?: number;
    oreMese?: number;
    onSegmentClick?: (seg: Segmento) => void;
  }

  let {
    segmenti,
    width = 280,
    height = 280,
    oreMese = 730,
    onSegmentClick
  }: Props = $props();

  let svgEl: SVGSVGElement | undefined = $state();
  let wrapEl: HTMLDivElement | undefined = $state();

  // Stato tooltip
  let tooltipVisibile = $state(false);
  let tooltipX = $state(0);
  let tooltipY = $state(0);
  let tooltipSeg = $state<Segmento | null>(null);

  const radius = $derived(Math.min(width, height) / 2 - 6);
  const innerRadius = $derived(radius * 0.55);

  const tooltipPct = $derived(
    tooltipSeg ? Math.round((tooltipSeg.ore / oreMese) * 100) : 0
  );
  const tooltipOre = $derived(tooltipSeg ? Math.round(tooltipSeg.ore) : 0);

  function posizionaTooltip(e: PointerEvent) {
    if (!wrapEl) return;
    const r = wrapEl.getBoundingClientRect();
    tooltipX = e.clientX - r.left + 14;
    tooltipY = e.clientY - r.top + 14;
  }

  $effect(() => {
    if (!svgEl) return;
    const data = segmenti;
    const W = width;
    const H = height;
    const R = radius;
    const rIn = innerRadius;
    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();

    const g = svg.append('g').attr('transform', `translate(${W / 2}, ${H / 2})`);

    const pie = d3
      .pie<Segmento>()
      .value((d) => d.ore)
      .sort(null)
      .padAngle(0.005);

    const arc = d3
      .arc<d3.PieArcDatum<Segmento>>()
      .innerRadius(rIn)
      .outerRadius(R)
      .cornerRadius(0);

    const arcHover = d3
      .arc<d3.PieArcDatum<Segmento>>()
      .innerRadius(rIn - 4)
      .outerRadius(R + 4)
      .cornerRadius(0);

    const arcFn = (d: d3.PieArcDatum<Segmento>): string => arc(d) ?? '';
    const arcHoverFn = (d: d3.PieArcDatum<Segmento>): string => arcHover(d) ?? '';

    const slices = g
      .selectAll<SVGPathElement, d3.PieArcDatum<Segmento>>('path.slice')
      .data(pie(data))
      .join('path')
      .attr('class', 'slice')
      .attr('fill', (d) => d.data.colore)
      .attr('stroke', '#0a0a08')
      .attr('stroke-width', 1)
      .attr('role', 'button')
      .attr('tabindex', 0)
      .attr('aria-label', (d) => {
        const pct = Math.round((d.data.ore / oreMese) * 100);
        return `${d.data.label}: ${Math.round(d.data.ore)} ore (${pct}%)`;
      })
      .style('cursor', onSegmentClick ? 'pointer' : 'default')
      .on('click', (_e, d) => {
        onSegmentClick?.(d.data);
      })
      .on('keydown', (e: KeyboardEvent, d) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSegmentClick?.(d.data);
        }
      })
      .on('mouseover', function (this: SVGPathElement, _e: MouseEvent, d) {
        d3.select<SVGPathElement, d3.PieArcDatum<Segmento>>(this)
          .transition()
          .duration(150)
          .attr('d', arcHoverFn);
        tooltipSeg = d.data;
        tooltipVisibile = true;
      })
      .on('mouseout', function (this: SVGPathElement) {
        d3.select<SVGPathElement, d3.PieArcDatum<Segmento>>(this)
          .transition()
          .duration(150)
          .attr('d', arcFn);
        tooltipVisibile = false;
        tooltipSeg = null;
      })
      .on('focus', function (this: SVGPathElement, _e: FocusEvent, d) {
        tooltipSeg = d.data;
        tooltipVisibile = true;
        const [cx, cy] = arc.centroid(d);
        tooltipX = W / 2 + cx + 14;
        tooltipY = H / 2 + cy + 14;
      })
      .on('blur', function () {
        tooltipVisibile = false;
        tooltipSeg = null;
      });

    // Animazione di entrata: da angolo 0 all'angolo finale
    slices
      .transition()
      .duration(1200)
      .ease(d3.easeQuadOut)
      .attrTween('d', function (d) {
        const i = d3.interpolate({ startAngle: 0, endAngle: 0 }, d);
        return (t) => arc(i(t)) ?? '';
      });

    // Cerchio centrale con totale ore
    g.append('text')
      .attr('class', 'center-label')
      .attr('text-anchor', 'middle')
      .attr('dy', '-0.4em')
      .attr('fill', '#5a5850')
      .attr('font-size', '9px')
      .attr('font-family', "'IBM Plex Mono', monospace")
      .attr('letter-spacing', '0.15em')
      .text('UN MESE');

    g.append('text')
      .attr('class', 'center-total')
      .attr('text-anchor', 'middle')
      .attr('dy', '1em')
      .attr('fill', '#f0ede6')
      .attr('font-size', '28px')
      .attr('font-style', 'italic')
      .attr('font-family', "'Playfair Display', serif")
      .attr('font-weight', 700)
      .text(`${oreMese}h`);
  });
</script>

<div
  class="chart-wrap"
  bind:this={wrapEl}
  onpointermove={posizionaTooltip}
  role="presentation"
>
  <svg
    bind:this={svgEl}
    {width}
    {height}
    viewBox="0 0 {width} {height}"
    role="img"
    aria-labelledby="piechart-title piechart-desc"
  >
    <title id="piechart-title">
      Ripartizione del tempo mensile in {segmenti.length} segmenti
    </title>
    <desc id="piechart-desc">
      Grafico a torta che mostra, su {oreMese} ore mensili, la quota assorbita da
      sonno, lavoro (sopravvivenza/stato/capitale), vita biologica e tempo libero reale.
    </desc>
  </svg>

  {#if tooltipVisibile && tooltipSeg}
    <div
      class="pie-tooltip"
      style="left: {tooltipX}px; top: {tooltipY}px;"
      role="tooltip"
      aria-live="polite"
    >
      <div class="tooltip-head">
        <span class="tooltip-dot" style="background: {tooltipSeg.colore};"></span>
        <span class="tooltip-label">{tooltipSeg.label}</span>
      </div>
      <div class="tooltip-stat">
        {tooltipOre}h — {tooltipPct}% del mese
      </div>
      {#if tooltipSeg.descrizione}
        <div class="tooltip-desc">{tooltipSeg.descrizione}</div>
      {/if}
    </div>
  {/if}

  <!-- Fallback accessibile: sempre presente, nascosta visivamente ma leggibile da screen reader
       e visibile se CSS non carica. -->
  <table class="sr-only">
    <caption>Ripartizione del tempo mensile</caption>
    <thead>
      <tr><th scope="col">Segmento</th><th scope="col">Ore</th><th scope="col">%</th></tr>
    </thead>
    <tbody>
      {#each segmenti as s (s.id)}
        <tr>
          <th scope="row">{s.label}</th>
          <td>{Math.round(s.ore)}h</td>
          <td>{Math.round((s.ore / oreMese) * 100)}%</td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>

<style>
  .chart-wrap {
    position: relative;
    display: inline-block;
  }
  svg {
    display: block;
    overflow: visible;
  }

  .pie-tooltip {
    position: absolute;
    z-index: 10;
    pointer-events: none;
    max-width: 260px;
    padding: 0.65rem 0.8rem;
    background: var(--tdv-paper-2, #14140f);
    border: 1px solid var(--tdv-rosso, #c8332f);
    color: var(--tdv-ink, #f0ede6);
    font-family: 'IBM Plex Mono', monospace;
    font-size: 11px;
    line-height: 1.45;
    letter-spacing: 0.04em;
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.5);
    animation: tdv-tooltip-in 160ms ease-out;
  }

  @keyframes tdv-tooltip-in {
    from { opacity: 0; transform: translateY(-3px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .tooltip-head {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.35rem;
  }
  .tooltip-dot {
    display: inline-block;
    width: 8px;
    height: 8px;
    flex-shrink: 0;
  }
  .tooltip-label {
    font-size: 10px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--tdv-ink, #f0ede6);
  }
  .tooltip-stat {
    font-size: 13px;
    font-family: 'Playfair Display', serif;
    font-style: italic;
    color: var(--tdv-ink, #f0ede6);
    margin-bottom: 0.35rem;
  }
  .tooltip-desc {
    font-size: 11px;
    color: var(--tdv-ink-2, #bab5a8);
    letter-spacing: 0.02em;
    border-top: 1px solid rgba(200, 51, 47, 0.25);
    padding-top: 0.35rem;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
</style>
