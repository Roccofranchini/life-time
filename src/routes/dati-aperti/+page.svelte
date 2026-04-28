<!--
  src/routes/dati-aperti/+page.svelte
  Mappa interattiva delle fonti dati di Tempo di Vita.
  Rete force-directed D3: ogni nodo è una fonte, ogni arco è una dipendenza.
  Stile: cyber/hacker coerente col design system (IBM Plex Mono, palette --tdv-*).
  Accessibilità: tabella sr-only + tooltip testuale + rispetta prefers-reduced-motion.
-->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import * as d3 from 'd3';

  interface SourceNode extends d3.SimulationNodeDatum {
    id: string;
    label: string;
    sublabel?: string;
    type: 'root' | 'category' | 'source';
    url?: string;
    categoria?: string;
    formato?: string;
    aggiornamento?: string;
    licenza?: string;
  }

  interface SourceLink extends d3.SimulationLinkDatum<SourceNode> {
    source: string | SourceNode;
    target: string | SourceNode;
  }

  const nodes: SourceNode[] = [
    { id: 'root', label: 'TEMPO DI VITA', type: 'root' },

    { id: 'cat-fiscal', label: 'DATI FISCALI', type: 'category' },
    { id: 'cat-vita', label: 'COSTO DELLA VITA', type: 'category' },
    { id: 'cat-ccnl', label: 'CONTRATTI CCNL', type: 'category' },
    { id: 'cat-cta', label: 'SUPPORTO LOCALE', type: 'category' },

    {
      id: 'irpef',
      label: 'Agenzia delle Entrate',
      sublabel: 'Aliquote IRPEF 2026',
      type: 'source',
      url: 'https://www.agenziaentrate.gov.it/portale/imposta-sul-reddito-delle-persone-fisiche-irpef-/aliquote-e-calcolo-dell-irpef',
      categoria: 'Dati fiscali',
      formato: 'Web / PDF',
      aggiornamento: 'Annuale (Legge di Bilancio)',
      licenza: 'Pubblica ex L. 241/90'
    },
    {
      id: 'inps',
      label: 'INPS',
      sublabel: 'Aliquote contributive',
      type: 'source',
      url: 'https://www.inps.it/it/it/dati-e-bilanci/entrate-contributive/aliquote-contributive.html',
      categoria: 'Dati fiscali',
      formato: 'Web',
      aggiornamento: 'Annuale',
      licenza: 'Pubblica'
    },

    {
      id: 'omi',
      label: 'OMI — Agenzia Entrate',
      sublabel: 'Quotazioni immobiliari',
      type: 'source',
      url: 'https://www.agenziaentrate.gov.it/portale/web/guest/schede/fabbricatiterreni/omi/banche-dati/quotazioni-immobiliari',
      categoria: 'Costo della vita',
      formato: 'Excel (semestrale)',
      aggiornamento: 'Semestrale',
      licenza: 'Pubblica ex L. 241/90'
    },
    {
      id: 'istat',
      label: 'ISTAT',
      sublabel: 'Paniere NIC — spesa alimentare',
      type: 'source',
      url: 'https://www.istat.it/it/prezzi/prezzi-al-consumo/paniere',
      categoria: 'Costo della vita',
      formato: 'JSON via API SDMX',
      aggiornamento: 'Mensile',
      licenza: 'CC BY 3.0 IT'
    },
    {
      id: 'mimit',
      label: 'Mimit',
      sublabel: 'Osservatorio prezzi carburanti',
      type: 'source',
      url: 'https://www.mimit.gov.it/it/mercato-e-consumatori/carburanti',
      categoria: 'Costo della vita',
      formato: 'JSON API',
      aggiornamento: 'Ogni 48h (cache 7gg)',
      licenza: 'Pubblica'
    },

    {
      id: 'ccnl-commercio',
      label: 'Confcommercio',
      sublabel: 'CCNL Commercio (~3M lav.)',
      type: 'source',
      url: 'https://www.confcommercio.it/-/ccnl-terziario-contratto',
      categoria: 'Contratti CCNL',
      formato: 'PDF / Web',
      aggiornamento: '2024-03-01',
      licenza: 'Minimi tabellari pubblici'
    },
    {
      id: 'ccnl-metalmeccanici',
      label: 'FIOM-CGIL / Federmeccanica',
      sublabel: 'CCNL Metalmeccanici (~1.7M lav.)',
      type: 'source',
      url: 'https://www.fiom-cgil.it/net/industria-privata-e-installazione-impianti/ccnl-federmeccanica',
      categoria: 'Contratti CCNL',
      formato: 'PDF / Web',
      aggiornamento: '2024-06-01',
      licenza: 'Minimi tabellari pubblici'
    },
    {
      id: 'ccnl-logistica',
      label: 'FILT-CGIL',
      sublabel: 'CCNL Logistica e Trasporti',
      type: 'source',
      url: 'https://www.filtcgil.it/terra/27-contratti-terra/contratti-trasporto-merci.html',
      categoria: 'Contratti CCNL',
      formato: 'PDF / Web',
      aggiornamento: '2024-03-01',
      licenza: 'Minimi tabellari pubblici'
    },
    {
      id: 'ccnl-ristorazione',
      label: 'FIPE',
      sublabel: 'CCNL Ristorazione e Pubblici Esercizi',
      type: 'source',
      url: 'https://www.fipe.it/category/area-lavoro/testo-ccnl-fipe/',
      categoria: 'Contratti CCNL',
      formato: 'PDF / Web',
      aggiornamento: '2024-01-01',
      licenza: 'Minimi tabellari pubblici'
    },

    {
      id: 'sunia',
      label: 'SUNIA',
      sublabel: 'Sindacato Unitario Inquilini',
      type: 'source',
      url: 'https://www.sunia.it',
      categoria: 'Supporto locale',
      formato: 'Web',
      aggiornamento: 'Continuo (community)',
      licenza: 'N/A'
    },
    {
      id: 'cgil',
      label: 'CGIL',
      sublabel: 'Sindacato Lavoratori',
      type: 'source',
      url: 'https://www.cgil.it',
      categoria: 'Supporto locale',
      formato: 'Web',
      aggiornamento: 'Continuo (community)',
      licenza: 'N/A'
    }
  ];

  const links: SourceLink[] = [
    { source: 'root', target: 'cat-fiscal' },
    { source: 'root', target: 'cat-vita' },
    { source: 'root', target: 'cat-ccnl' },
    { source: 'root', target: 'cat-cta' },
    { source: 'cat-fiscal', target: 'irpef' },
    { source: 'cat-fiscal', target: 'inps' },
    { source: 'cat-vita', target: 'omi' },
    { source: 'cat-vita', target: 'istat' },
    { source: 'cat-vita', target: 'mimit' },
    { source: 'cat-ccnl', target: 'ccnl-commercio' },
    { source: 'cat-ccnl', target: 'ccnl-metalmeccanici' },
    { source: 'cat-ccnl', target: 'ccnl-logistica' },
    { source: 'cat-ccnl', target: 'ccnl-ristorazione' },
    { source: 'cat-cta', target: 'sunia' },
    { source: 'cat-cta', target: 'cgil' }
  ];

  const allSources = nodes.filter((n) => n.type === 'source');

  let svgEl: SVGSVGElement;
  let containerEl: HTMLDivElement;
  let tooltip = $state<{ node: SourceNode | null; x: number; y: number }>({ node: null, x: 0, y: 0 });
  let simulation: d3.Simulation<SourceNode, SourceLink> | null = null;

  const COLOR = {
    root: '#c8291e',
    category: '#a09e96',
    source: '#5a5850',
    sourceHover: '#c8291e',
    linkRoot: 'rgba(200,41,30,0.35)',
    linkCat: 'rgba(240,237,230,0.12)',
    text: '#f0ede6',
    textDim: '#5a5850'
  };

  function nodeRadius(d: SourceNode): number {
    if (d.type === 'root') return 22;
    if (d.type === 'category') return 14;
    return 8;
  }

  onMount(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const W = containerEl.clientWidth;
    const H = Math.min(560, Math.max(400, W * 0.55));

    const svg = d3
      .select(svgEl)
      .attr('width', W)
      .attr('height', H)
      .attr('viewBox', `0 0 ${W} ${H}`);

    // Defs: glow filter + arrow marker
    const defs = svg.append('defs');

    defs
      .append('filter')
      .attr('id', 'glow')
      .append('feGaussianBlur')
      .attr('stdDeviation', '3')
      .attr('result', 'coloredBlur');

    const feMerge = defs.select('filter#glow').append('feMerge');
    feMerge.append('feMergeNode').attr('in', 'coloredBlur');
    feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

    // scanline overlay
    const scanlinePattern = defs
      .append('pattern')
      .attr('id', 'scanlines')
      .attr('patternUnits', 'userSpaceOnUse')
      .attr('width', W)
      .attr('height', 4);
    scanlinePattern
      .append('rect')
      .attr('width', W)
      .attr('height', 1)
      .attr('y', 0)
      .attr('fill', 'rgba(0,0,0,0.08)');

    svg
      .append('rect')
      .attr('width', W)
      .attr('height', H)
      .attr('fill', 'url(#scanlines)')
      .attr('pointer-events', 'none');

    // Clone nodes/links for simulation
    const simNodes: SourceNode[] = nodes.map((n) => ({ ...n }));
    const nodeById = new Map(simNodes.map((n) => [n.id, n]));
    const simLinks: SourceLink[] = links.map((l) => ({
      source: nodeById.get(l.source as string)!,
      target: nodeById.get(l.target as string)!
    }));

    simulation = d3
      .forceSimulation<SourceNode>(simNodes)
      .force(
        'link',
        d3
          .forceLink<SourceNode, SourceLink>(simLinks)
          .id((d) => d.id)
          .distance((l) => {
            const s = l.source as SourceNode;
            if (s.type === 'root') return 120;
            return 90;
          })
          .strength(0.8)
      )
      .force('charge', d3.forceManyBody().strength(-280))
      .force('center', d3.forceCenter(W / 2, H / 2))
      .force('collide', d3.forceCollide<SourceNode>().radius((d) => nodeRadius(d) + 28))
      .alphaDecay(prefersReduced ? 0.1 : 0.028);

    // Links layer
    const linkGroup = svg.append('g').attr('class', 'links');
    const linkSel = linkGroup
      .selectAll<SVGLineElement, SourceLink>('line')
      .data(simLinks)
      .join('line')
      .attr('stroke', (l) => {
        const s = l.source as SourceNode;
        return s.type === 'root' ? COLOR.linkRoot : COLOR.linkCat;
      })
      .attr('stroke-width', (l) => {
        const s = l.source as SourceNode;
        return s.type === 'root' ? 1.5 : 1;
      })
      .attr('stroke-dasharray', '4 6')
      .attr('stroke-linecap', 'round');

    // Animate dash offset for data-flow feel (skip if reduced motion)
    if (!prefersReduced) {
      linkSel
        .style('animation', (_d, i) => `tdv-dash-flow ${2.5 + (i % 4) * 0.4}s linear infinite`);
    }

    // Nodes layer
    const nodeGroup = svg.append('g').attr('class', 'nodes');
    const nodeSel = nodeGroup
      .selectAll<SVGGElement, SourceNode>('g.node')
      .data(simNodes)
      .join('g')
      .attr('class', 'node')
      .attr('cursor', (d) => (d.url ? 'pointer' : 'default'))
      .call(
        d3
          .drag<SVGGElement, SourceNode>()
          .on('start', (event, d) => {
            if (!event.active) simulation?.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on('drag', (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on('end', (event, d) => {
            if (!event.active) simulation?.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          })
      );

    // Node circle
    nodeSel
      .append('circle')
      .attr('r', (d) => nodeRadius(d))
      .attr('fill', (d) => {
        if (d.type === 'root') return COLOR.root;
        if (d.type === 'category') return 'rgba(160,158,150,0.12)';
        return 'rgba(90,88,80,0.15)';
      })
      .attr('stroke', (d) => {
        if (d.type === 'root') return COLOR.root;
        if (d.type === 'category') return COLOR.category;
        return COLOR.source;
      })
      .attr('stroke-width', (d) => (d.type === 'root' ? 2 : 1))
      .attr('filter', (d) => (d.type === 'root' ? 'url(#glow)' : null));

    // Node label (main)
    nodeSel
      .append('text')
      .attr('dy', (d) => {
        if (d.type === 'root') return nodeRadius(d) + 14;
        if (d.type === 'category') return nodeRadius(d) + 12;
        return nodeRadius(d) + 11;
      })
      .attr('text-anchor', 'middle')
      .attr('font-family', "'IBM Plex Mono', monospace")
      .attr('font-size', (d) => (d.type === 'root' ? 9 : d.type === 'category' ? 8 : 7.5))
      .attr('letter-spacing', (d) => (d.type === 'root' ? '0.15em' : '0.10em'))
      .attr('fill', (d) => (d.type === 'root' ? COLOR.root : d.type === 'category' ? COLOR.category : COLOR.textDim))
      .attr('font-weight', (d) => (d.type === 'root' ? '600' : '400'))
      .text((d) => d.label);

    // Node sublabel
    nodeSel
      .filter((d) => d.type === 'source' && !!d.sublabel)
      .append('text')
      .attr('dy', (d) => nodeRadius(d) + 22)
      .attr('text-anchor', 'middle')
      .attr('font-family', "'IBM Plex Mono', monospace")
      .attr('font-size', 6.5)
      .attr('fill', 'rgba(90,88,80,0.7)')
      .text((d) => d.sublabel ?? '');

    // Hover / click interactions
    nodeSel
      .on('mouseenter', (event: MouseEvent, d) => {
        if (d.type === 'source') {
          d3.select(event.currentTarget as SVGGElement)
            .select('circle')
            .attr('stroke', COLOR.sourceHover)
            .attr('filter', 'url(#glow)');
          tooltip = { node: d, x: event.clientX, y: event.clientY };
        }
      })
      .on('mousemove', (event: MouseEvent, d) => {
        if (d.type === 'source') {
          tooltip = { node: d, x: event.clientX, y: event.clientY };
        }
      })
      .on('mouseleave', (event: MouseEvent, d) => {
        d3.select(event.currentTarget as SVGGElement)
          .select('circle')
          .attr('stroke', d.type === 'root' ? COLOR.root : d.type === 'category' ? COLOR.category : COLOR.source)
          .attr('filter', d.type === 'root' ? 'url(#glow)' : null);
        tooltip = { node: null, x: 0, y: 0 };
      })
      .on('click', (_event, d) => {
        if (d.url) window.open(d.url, '_blank', 'noopener,noreferrer');
      });

    // Tick
    simulation.on('tick', () => {
      linkSel
        .attr('x1', (l) => (l.source as SourceNode).x ?? 0)
        .attr('y1', (l) => (l.source as SourceNode).y ?? 0)
        .attr('x2', (l) => (l.target as SourceNode).x ?? 0)
        .attr('y2', (l) => (l.target as SourceNode).y ?? 0);

      nodeSel.attr('transform', (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });

    // Responsive resize
    function onResize() {
      const W2 = containerEl.clientWidth;
      const H2 = Math.min(560, Math.max(400, W2 * 0.55));
      svg.attr('width', W2).attr('height', H2).attr('viewBox', `0 0 ${W2} ${H2}`);
      simulation?.force('center', d3.forceCenter(W2 / 2, H2 / 2)).alpha(0.3).restart();
    }
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
    };
  });

  onDestroy(() => {
    simulation?.stop();
  });
</script>

<svelte:head>
  <title>Dati aperti · Tempo di vita</title>
  <meta
    name="description"
    content="Tutte le fonti pubbliche usate da Tempo di Vita: ISTAT, Agenzia delle Entrate, INPS, OMI, Mimit, CCNL. Dati aperti, codice aperto."
  />
</svelte:head>

<div class="tdv-dati-page">

  <!-- Header -->
  <header class="tdv-dati-header">
    <div class="tdv-section-label">Dati aperti</div>
    <h1 class="tdv-dati-title">Ogni numero ha una fonte.</h1>
    <p class="tdv-dati-intro">
      Tempo di Vita non produce dati: li aggrega da fonti pubbliche ufficiali e li
      rende leggibili. Questa pagina mostra l'intera catena di dipendenze — dalla
      fonte primaria al calcolo che vedi sullo schermo.
      <br />
      <span class="dim">Tutto verificabile. Tutto riproducibile. Tutto aperto.</span>
    </p>
  </header>

  <!-- Network graph -->
  <section class="tdv-network-section" aria-label="Mappa interattiva delle fonti">
    <div class="tdv-network-legend">
      <span class="legend-item root"><span class="dot"></span>app</span>
      <span class="legend-item cat"><span class="dot"></span>categoria</span>
      <span class="legend-item src"><span class="dot"></span>fonte — clicca per aprire</span>
    </div>

    <div class="tdv-network-wrap" bind:this={containerEl}>
      <svg bind:this={svgEl} role="img" aria-label="Rete delle fonti dati di Tempo di Vita"></svg>

      <!-- Tooltip -->
      {#if tooltip.node}
        <div
          class="tdv-node-tooltip"
          style:left="{tooltip.x + 14}px"
          style:top="{tooltip.y - 10}px"
        >
          <div class="tt-label">{tooltip.node.label}</div>
          {#if tooltip.node.sublabel}
            <div class="tt-sub">{tooltip.node.sublabel}</div>
          {/if}
          <div class="tt-meta">
            <span class="tt-key">categoria</span><span class="tt-val">{tooltip.node.categoria}</span>
          </div>
          <div class="tt-meta">
            <span class="tt-key">formato</span><span class="tt-val">{tooltip.node.formato}</span>
          </div>
          <div class="tt-meta">
            <span class="tt-key">aggiornamento</span><span class="tt-val">{tooltip.node.aggiornamento}</span>
          </div>
          <div class="tt-meta">
            <span class="tt-key">licenza</span><span class="tt-val">{tooltip.node.licenza}</span>
          </div>
          {#if tooltip.node.url}
            <div class="tt-url">↗ {tooltip.node.url}</div>
          {/if}
        </div>
      {/if}
    </div>

    <!-- Fallback tabellare per screen reader / no-JS -->
    <table class="sr-only" aria-label="Elenco fonti dati">
      <thead>
        <tr>
          <th>Fonte</th><th>Categoria</th><th>Formato</th><th>Aggiornamento</th><th>Licenza</th><th>URL</th>
        </tr>
      </thead>
      <tbody>
        {#each allSources as s}
          <tr>
            <td>{s.label}</td>
            <td>{s.categoria}</td>
            <td>{s.formato}</td>
            <td>{s.aggiornamento}</td>
            <td>{s.licenza}</td>
            <td>{s.url ?? '—'}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </section>

  <!-- Full source table -->
  <section class="tdv-sources-section">
    <div class="tdv-section-label">Elenco completo</div>
    <div class="tdv-sources-grid">
      {#each allSources as s}
        <div class="tdv-source-card">
          <div class="sc-name">{s.label}</div>
          {#if s.sublabel}<div class="sc-sub">{s.sublabel}</div>{/if}
          <div class="sc-meta-row">
            <span class="sc-tag">{s.categoria}</span>
            <span class="sc-tag">{s.formato}</span>
          </div>
          <div class="sc-meta-row dim">
            <span class="sc-key">aggiornamento</span>
            <span class="sc-val">{s.aggiornamento}</span>
          </div>
          <div class="sc-meta-row dim">
            <span class="sc-key">licenza</span>
            <span class="sc-val">{s.licenza}</span>
          </div>
          {#if s.url}
            <a class="sc-link" href={s.url} target="_blank" rel="noopener noreferrer">
              Apri fonte ↗
            </a>
          {/if}
        </div>
      {/each}
    </div>
  </section>

  <!-- Codice sorgente -->
  <section class="tdv-cta-section">
    <div class="tdv-section-label">Codice sorgente</div>
    <p>
      Tutto il codice che legge, processa e visualizza questi dati è pubblico e
      auditabile su GitHub sotto licenza AGPL-3.0.
    </p>
    <a
      class="tdv-btn-ghost tdv-cta-btn"
      href="https://github.com/roccofranchini/life-time"
      target="_blank"
      rel="noopener noreferrer"
    >
      github.com/roccofranchini/life-time ↗
    </a>
  </section>

</div>

<style>
  /* ─── Layout ─────────────────────────────────────────────── */
  .tdv-dati-page {
    max-width: 1100px;
    margin: 0 auto;
    padding: 48px 32px 80px;
    display: flex;
    flex-direction: column;
    gap: 64px;
  }

  /* ─── Header ─────────────────────────────────────────────── */
  .tdv-dati-header {
    max-width: 640px;
  }
  .tdv-dati-title {
    font-family: var(--tdv-serif);
    font-style: italic;
    font-weight: 700;
    font-size: clamp(28px, 4vw, 48px);
    color: var(--tdv-ink);
    line-height: 1.15;
    margin-bottom: 20px;
  }
  .tdv-dati-intro {
    font-size: 13px;
    color: var(--tdv-ink2);
    line-height: 1.75;
  }
  .tdv-dati-intro .dim {
    color: var(--tdv-ink3);
    font-size: 11px;
    letter-spacing: 0.05em;
  }

  /* ─── Network section ─────────────────────────────────────── */
  .tdv-network-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .tdv-network-legend {
    display: flex;
    gap: 24px;
    font-size: 9px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--tdv-ink3);
    padding-bottom: 8px;
  }
  .legend-item {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .legend-item .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    border: 1px solid currentColor;
    flex-shrink: 0;
  }
  .legend-item.root { color: var(--tdv-red); }
  .legend-item.cat  { color: var(--tdv-ink2); }
  .legend-item.src  { color: var(--tdv-ink3); }
  .legend-item.root .dot { background: var(--tdv-red); border-color: var(--tdv-red); }

  .tdv-network-wrap {
    position: relative;
    border: 1px solid var(--tdv-border);
    background: rgba(10, 10, 8, 0.6);
    overflow: hidden;
  }
  .tdv-network-wrap svg {
    display: block;
    width: 100%;
  }

  /* dash-flow animation for edges — keyframe defined in app.css */

  /* Scanline subtle overlay on the network */
  .tdv-network-wrap::after {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: repeating-linear-gradient(
      180deg,
      transparent 0px,
      transparent 3px,
      rgba(0, 0, 0, 0.04) 3px,
      rgba(0, 0, 0, 0.04) 4px
    );
  }

  /* ─── Tooltip ──────────────────────────────────────────────── */
  .tdv-node-tooltip {
    position: fixed;
    z-index: 100;
    background: #0d0d0a;
    border: 1px solid var(--tdv-red);
    border-left: 2px solid var(--tdv-red);
    padding: 10px 14px;
    font-family: var(--tdv-mono);
    font-size: 10px;
    min-width: 220px;
    max-width: 320px;
    pointer-events: none;
    box-shadow: 0 0 20px rgba(200, 41, 30, 0.15);
  }
  .tt-label {
    font-size: 11px;
    font-weight: 600;
    color: var(--tdv-ink);
    letter-spacing: 0.06em;
    margin-bottom: 2px;
  }
  .tt-sub {
    font-size: 9px;
    color: var(--tdv-ink3);
    letter-spacing: 0.08em;
    margin-bottom: 10px;
  }
  .tt-meta {
    display: flex;
    gap: 8px;
    margin-bottom: 3px;
    color: var(--tdv-ink2);
    font-size: 9px;
  }
  .tt-key {
    color: var(--tdv-ink3);
    text-transform: uppercase;
    letter-spacing: 0.10em;
    min-width: 90px;
    flex-shrink: 0;
  }
  .tt-val {
    color: var(--tdv-ink2);
  }
  .tt-url {
    margin-top: 8px;
    font-size: 8px;
    color: var(--tdv-red);
    letter-spacing: 0.06em;
    word-break: break-all;
    opacity: 0.8;
  }

  /* ─── Source cards grid ───────────────────────────────────── */
  .tdv-sources-section {
    display: flex;
    flex-direction: column;
    gap: 0;
  }
  .tdv-sources-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    border-left: 1px solid var(--tdv-border);
    border-top: 1px solid var(--tdv-border);
  }
  .tdv-source-card {
    border-right: 1px solid var(--tdv-border);
    border-bottom: 1px solid var(--tdv-border);
    padding: 20px 20px 16px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    transition: background 0.2s;
  }
  .tdv-source-card:hover {
    background: rgba(200, 41, 30, 0.04);
  }
  .sc-name {
    font-size: 12px;
    font-weight: 600;
    color: var(--tdv-ink);
    letter-spacing: 0.05em;
  }
  .sc-sub {
    font-size: 10px;
    color: var(--tdv-ink3);
    line-height: 1.4;
    margin-bottom: 4px;
  }
  .sc-meta-row {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    font-size: 9px;
    letter-spacing: 0.06em;
  }
  .sc-meta-row.dim {
    color: var(--tdv-ink3);
  }
  .sc-tag {
    border: 1px solid var(--tdv-border);
    padding: 2px 6px;
    color: var(--tdv-ink3);
    text-transform: uppercase;
    letter-spacing: 0.10em;
    font-size: 8px;
  }
  .sc-key {
    text-transform: uppercase;
    letter-spacing: 0.10em;
    color: var(--tdv-ink3);
    flex-shrink: 0;
    min-width: 80px;
  }
  .sc-val {
    color: var(--tdv-ink2);
  }
  .sc-link {
    display: inline-block;
    margin-top: 8px;
    font-size: 9px;
    letter-spacing: 0.10em;
    text-transform: uppercase;
    color: var(--tdv-red);
    border-bottom: 1px solid var(--tdv-red-dim);
    text-decoration: none;
    transition: border-color 0.2s;
    width: fit-content;
  }
  .sc-link:hover {
    border-color: var(--tdv-red);
    color: var(--tdv-red2);
  }

  /* ─── CTA section ────────────────────────────────────────── */
  .tdv-cta-section {
    border-top: 1px solid var(--tdv-border);
    padding-top: 32px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    max-width: 540px;
  }
  .tdv-cta-section p {
    font-size: 12px;
    color: var(--tdv-ink2);
    line-height: 1.7;
  }
  .tdv-cta-btn {
    display: inline-block;
    width: fit-content;
    text-decoration: none;
    font-size: 10px;
    padding: 12px 18px;
  }

  /* ─── Screen reader only ─────────────────────────────────── */
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

  /* ─── Responsive ─────────────────────────────────────────── */
  @media (max-width: 640px) {
    .tdv-dati-page {
      padding: 32px 20px 60px;
      gap: 48px;
    }
    .tdv-network-legend {
      flex-wrap: wrap;
      gap: 12px;
    }
    .tdv-node-tooltip {
      display: none;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .tdv-network-wrap :global(.links line) {
      animation: none !important;
    }
  }
</style>
