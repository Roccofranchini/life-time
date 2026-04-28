<!--
  src/routes/+layout.svelte
  Shell globale: stylesheet, nav bar, ticker rosso.
  Niente analytics, niente cookie banner (nessun cookie).
  Navigazione minima: Tempo di vita (home), Calcola (scroll al wizard),
  Dati aperti (link interno al dump JSON), GitHub (out).
-->
<script lang="ts">
  import '../app.css';
  import { page } from '$app/stores';
  import Ticker from '$lib/components/Ticker.svelte';

  interface Props {
    children: import('svelte').Snippet;
  }

  const { children }: Props = $props();

  const GITHUB_URL = 'https://github.com/roccofranchini/life-time';

  function scrollAWizard(e: MouseEvent) {
    if ($page.url.pathname !== '/') return;
    e.preventDefault();
    document.getElementById('wizard')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
</script>

<svelte:head>
  <title>Tempo di vita · quanto costa vivere, in ore</title>
  <meta
    name="description"
    content="Converti il tuo salario in ore sottratte alla tua esistenza. Dati pubblici, calcoli aperti, nessun dato raccolto."
  />
  <meta name="color-scheme" content="dark" />
</svelte:head>

<div class="tdv-page">
  <div class="tdv-grid-bg" aria-hidden="true"></div>

  <nav class="tdv-nav" aria-label="Navigazione principale">
    <a
      href="/"
      class="tdv-nav-item"
      class:active={$page.url.pathname === '/'}
      aria-current={$page.url.pathname === '/' ? 'page' : undefined}
    >
      Tempo di vita
    </a>
    <a href="/#wizard" class="tdv-nav-item" onclick={scrollAWizard}>Calcola</a>
    <a
      href="/dati-aperti"
      class="tdv-nav-item"
      class:active={$page.url.pathname === '/dati-aperti'}
      aria-current={$page.url.pathname === '/dati-aperti' ? 'page' : undefined}
    >
      Dati aperti
    </a>
    <a href={GITHUB_URL} class="tdv-nav-item" target="_blank" rel="noopener noreferrer">
      GitHub ↗
    </a>
  </nav>

  <Ticker />

  <main class="tdv-main">
    {@render children()}
  </main>

  <footer class="tdv-footer">
    <div class="tdv-footer-col">
      <div class="tdv-section-label">Licenza</div>
      <p>AGPL-3.0 · codice e dati aperti · nessun tracciamento</p>
    </div>
    <div class="tdv-footer-col">
      <div class="tdv-section-label">Fonti</div>
      <p>Agenzia delle Entrate · INPS · ISTAT · OMI · Mimit</p>
    </div>
    <div class="tdv-footer-col">
      <div class="tdv-section-label">Margine</div>
      <p>±3% · stima editoriale, non consulenza fiscale</p>
    </div>
  </footer>
</div>

<style>
  .tdv-page {
    position: relative;
    min-height: 100vh;
    background: var(--tdv-bg);
    color: var(--tdv-ink);
    font-family: var(--tdv-mono);
    overflow-x: hidden;
  }

  .tdv-grid-bg {
    position: fixed;
    inset: 0;
    pointer-events: none;
    background-image:
      linear-gradient(var(--tdv-grid) 1px, transparent 1px),
      linear-gradient(90deg, var(--tdv-grid) 1px, transparent 1px);
    background-size: 40px 40px;
    z-index: 0;
  }

  .tdv-nav {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    border-bottom: var(--tdv-border);
    font-size: 10px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--tdv-ink3);
    overflow-x: auto;
  }
  .tdv-nav-item {
    padding: 12px 20px;
    border-right: var(--tdv-border);
    cursor: pointer;
    transition: color 0.2s, background 0.2s;
    white-space: nowrap;
    text-decoration: none;
    color: inherit;
  }
  .tdv-nav-item:hover {
    color: var(--tdv-ink);
    background: rgba(255, 255, 255, 0.03);
  }
  .tdv-nav-item.active {
    color: var(--tdv-red);
    border-bottom: 2px solid var(--tdv-red);
    margin-bottom: -1px;
  }

  .tdv-main {
    position: relative;
    z-index: 1;
  }

  .tdv-footer {
    position: relative;
    z-index: 1;
    border-top: var(--tdv-border);
    padding: 28px 32px 40px;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 24px;
    font-size: 11px;
    color: var(--tdv-ink3);
    line-height: 1.6;
  }
  .tdv-footer-col p {
    margin: 8px 0 0;
  }

  @media (max-width: 640px) {
    .tdv-footer {
      grid-template-columns: 1fr;
      padding: 20px;
    }
  }
</style>
