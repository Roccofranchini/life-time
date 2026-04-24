<!--
  src/routes/+page.svelte
  Home: hero editoriale + globo + wizard 3-step.
  Flusso: utente compila → chiamata a /api/calcola e /api/costi/:p in parallelo →
  store popolati → goto('/report').
  Nessun dato persistente: reload = reset.
-->
<script lang="ts">
  import { goto } from '$app/navigation';
  import Globe from '$lib/components/Globe.svelte';
  import provinceData from '$lib/data/province.json';
  import ccnlData from '$lib/data/ccnl.json';
  import {
    profilo,
    risultatoFiscale,
    costiProvincia
  } from '$lib/stores/profile';
  import type {
    TipoContratto,
    FiscalOutput,
    CostiVita,
    CcnlData,
    CcnlSettore,
    ProfiloUtente
  } from '$lib/types';

  interface ProvinciaEntry {
    codice: string;
    nome: string;
    regione: string;
    capoluogo: boolean;
  }

  const province: ProvinciaEntry[] = (provinceData as { province: ProvinciaEntry[] }).province;
  const settori: CcnlSettore[] = (ccnlData as unknown as CcnlData).settori;

  // ─── Stato wizard ───────────────────────────────────────────────────
  let step = $state<1 | 2 | 3>(1);

  // step 1: ricerca + selezione provincia
  let queryProvincia = $state('');
  let provinciaSelezionata = $state<ProvinciaEntry | null>(null);

  // step 2: settore / livello / contratto
  let settoreId = $state<string>('commercio');
  let livello = $state<string>('4');
  let tipoContratto = $state<TipoContratto>('indeterminato');
  let percentualePt = $state<number>(60); // percento, solo se parttime
  let oreSettimanali = $state<number>(40);

  // stato globale richiesta
  let inCalcolo = $state(false);
  let erroreCalcolo = $state<string | null>(null);

  // ─── Derived ────────────────────────────────────────────────────────
  const risultatiFiltrati: ProvinciaEntry[] = $derived.by(() => {
    const q = queryProvincia.trim().toLowerCase();
    if (!q) return [];
    return province
      .filter(
        (p) =>
          p.nome.toLowerCase().includes(q) ||
          p.codice.toLowerCase() === q ||
          p.regione.replace(/-/g, ' ').includes(q)
      )
      .slice(0, 8);
  });

  const settoreCorrente: CcnlSettore | undefined = $derived(
    settori.find((s) => s.id === settoreId)
  );

  const livelloCorrente = $derived(
    settoreCorrente?.livelli.find((l) => l.livello === livello) ?? null
  );

  // CCNL dà mensile → annuo = mensile * 13 (13a).
  // Per compatibilità con simulatori pubblici usiamo 13 come default.
  const lordoAnnuoCalcolato: number = $derived.by(() => {
    if (!livelloCorrente) return 0;
    let annuo = livelloCorrente.lordo_mensile * 13;
    if (tipoContratto === 'parttime') {
      annuo = annuo * (percentualePt / 100);
    }
    return Math.round(annuo);
  });

  // ─── Handlers ───────────────────────────────────────────────────────
  function selezionaProvincia(p: ProvinciaEntry) {
    provinciaSelezionata = p;
    queryProvincia = `${p.nome} (${p.codice})`;
  }

  function vaiStep(n: 1 | 2 | 3) {
    erroreCalcolo = null;
    step = n;
  }

  function validaStep1(): boolean {
    return provinciaSelezionata !== null;
  }

  function validaStep2(): boolean {
    if (!livelloCorrente) return false;
    if (tipoContratto === 'parttime' && (percentualePt <= 0 || percentualePt > 100))
      return false;
    return true;
  }

  async function inviaCalcolo() {
    if (!provinciaSelezionata || !livelloCorrente) return;

    inCalcolo = true;
    erroreCalcolo = null;

    const profiloCorrente: ProfiloUtente = {
      provincia: provinciaSelezionata.codice,
      nome_provincia: provinciaSelezionata.nome,
      regione: provinciaSelezionata.regione,
      comune_capoluogo: provinciaSelezionata.nome.toLowerCase(),
      settore_id: settoreId,
      settore_nome: settoreCorrente?.nome ?? '',
      livello,
      tipo_contratto: tipoContratto,
      ...(tipoContratto === 'parttime' ? { percentuale_parttime: percentualePt / 100 } : {}),
      ore_settimanali_contratto: oreSettimanali
    };

    try {
      const [respFisc, respCosti] = await Promise.all([
        fetch('/api/calcola', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            lordo_annuo: lordoAnnuoCalcolato,
            tipo_contratto: tipoContratto,
            regione: profiloCorrente.regione,
            comune: profiloCorrente.comune_capoluogo,
            ...(tipoContratto === 'parttime'
              ? { percentuale_parttime: percentualePt / 100 }
              : {})
          })
        }),
        fetch(`/api/costi/${provinciaSelezionata.codice}`)
      ]);

      if (!respFisc.ok) {
        const msg = await respFisc.text();
        throw new Error(msg || `Errore calcolo (${respFisc.status})`);
      }
      if (!respCosti.ok) {
        const msg = await respCosti.text();
        throw new Error(msg || `Errore costi (${respCosti.status})`);
      }

      const fiscale: FiscalOutput = await respFisc.json();
      const costi: CostiVita = await respCosti.json();

      profilo.set(profiloCorrente);
      risultatoFiscale.set(fiscale);
      costiProvincia.set(costi);

      await goto('/report');
    } catch (err) {
      erroreCalcolo = err instanceof Error ? err.message : 'Errore sconosciuto';
    } finally {
      inCalcolo = false;
    }
  }
</script>

<!-- ── HERO ───────────────────────────────────────────────────── -->
<section class="hero">
  <div class="hero-left">
    <div>
      <div class="hero-eyebrow">
        <span class="tdv-triangle"></span>
        Strumento di coscienza · Open source · Italia 2026
      </div>
      <h1 class="hero-title">Quanto vale<br />la tua <span>vita?</span></h1>
      <p class="hero-sub">
        Converti il tuo salario in quello che è davvero: ore sottratte alla tua esistenza. Dati
        pubblici, calcoli verificabili, nessun dato raccolto.
      </p>
    </div>
    <div class="hero-stat">
      <div class="stat-item">
        <div class="tdv-stat-n">18</div>
        <div class="tdv-stat-l">giorni/mese per l'affitto</div>
      </div>
      <div class="stat-item">
        <div class="tdv-stat-n">8h</div>
        <div class="tdv-stat-l">tempo libero reale/giorno</div>
      </div>
      <div class="stat-item">
        <div class="tdv-stat-n">±3%</div>
        <div class="tdv-stat-l">margine di stima</div>
      </div>
    </div>
  </div>
  <div class="hero-right">
    <Globe width={260} height={280} label="IT · 2026" />
  </div>
</section>

<!-- ── WIZARD ─────────────────────────────────────────────────── -->
<section class="content" id="wizard">
  <div class="main-col">
    <div class="tdv-section-label">
      <span class="tdv-star"></span>
      Il tuo profilo · passo {step} di 3
    </div>

    <!-- Step 1: Provincia -->
    {#if step === 1}
      <div class="wizard-step">
        <label for="provincia-input" class="wizard-label">Città di residenza</label>
        <input
          id="provincia-input"
          type="text"
          class="tdv-input"
          placeholder="Cerca: Bologna, Milano, Roma…"
          bind:value={queryProvincia}
          autocomplete="off"
        />

        {#if risultatiFiltrati.length > 0 && !provinciaSelezionata}
          <ul class="autocomplete">
            {#each risultatiFiltrati as p (p.codice)}
              <li>
                <button type="button" onclick={() => selezionaProvincia(p)}>
                  <span class="ac-name">{p.nome}</span>
                  <span class="ac-codice">{p.codice}</span>
                </button>
              </li>
            {/each}
          </ul>
        {/if}

        {#if provinciaSelezionata}
          <div class="selezione">
            <span class="tdv-triangle"></span>
            {provinciaSelezionata.nome} · {provinciaSelezionata.regione.replace(/-/g, ' ')}
          </div>
        {/if}
      </div>

      <button
        type="button"
        class="tdv-btn-primary"
        disabled={!validaStep1()}
        onclick={() => vaiStep(2)}
      >
        Avanti →
      </button>
    {/if}

    <!-- Step 2: Settore / livello / contratto -->
    {#if step === 2}
      <div class="wizard-step">
        <label for="settore-sel" class="wizard-label">Settore CCNL</label>
        <select
          id="settore-sel"
          class="tdv-select"
          bind:value={settoreId}
          onchange={() => {
            const primo = settoreCorrente?.livelli[0];
            if (primo) livello = primo.livello;
          }}
        >
          {#each settori as s (s.id)}
            <option value={s.id}>{s.nome}</option>
          {/each}
        </select>
      </div>

      <div class="wizard-step">
        <label for="livello-sel" class="wizard-label">Livello / inquadramento</label>
        <select id="livello-sel" class="tdv-select" bind:value={livello}>
          {#each settoreCorrente?.livelli ?? [] as l (l.livello)}
            <option value={l.livello}>
              Livello {l.livello} · {l.descrizione} · {l.lordo_mensile}€/mese
            </option>
          {/each}
        </select>
      </div>

      <div class="wizard-step">
        <label class="wizard-label" for="contratto-sel">Tipo contratto</label>
        <select id="contratto-sel" class="tdv-select" bind:value={tipoContratto}>
          <option value="indeterminato">Indeterminato full-time</option>
          <option value="parttime">Part-time</option>
          <option value="partiva">Partita IVA (gestione separata)</option>
        </select>
      </div>

      {#if tipoContratto === 'parttime'}
        <div class="wizard-step">
          <label for="pt-range" class="wizard-label">
            Percentuale part-time: <strong>{percentualePt}%</strong>
          </label>
          <input
            id="pt-range"
            type="range"
            min="10"
            max="99"
            step="5"
            bind:value={percentualePt}
            class="tdv-range"
          />
        </div>
      {/if}

      <div class="riepilogo">
        <div class="riep-row">
          <span>Lordo annuo stimato</span>
          <strong>{lordoAnnuoCalcolato.toLocaleString('it-IT')}€</strong>
        </div>
        <div class="riep-hint">
          Stima da minimo tabellare CCNL × 13 mensilità.
        </div>
      </div>

      <div class="btn-row">
        <button type="button" class="tdv-btn-ghost" onclick={() => vaiStep(1)}>← Indietro</button>
        <button
          type="button"
          class="tdv-btn-primary"
          disabled={!validaStep2()}
          onclick={() => vaiStep(3)}
        >
          Avanti →
        </button>
      </div>
    {/if}

    <!-- Step 3: Conferma -->
    {#if step === 3}
      <div class="wizard-step">
        <div class="wizard-label">Riepilogo</div>
        <dl class="riepilogo-finale">
          <div>
            <dt>Città</dt>
            <dd>{provinciaSelezionata?.nome} ({provinciaSelezionata?.codice})</dd>
          </div>
          <div>
            <dt>Settore</dt>
            <dd>{settoreCorrente?.nome}</dd>
          </div>
          <div>
            <dt>Livello</dt>
            <dd>{livello} · {livelloCorrente?.descrizione}</dd>
          </div>
          <div>
            <dt>Contratto</dt>
            <dd>
              {tipoContratto === 'indeterminato'
                ? 'Indeterminato full-time'
                : tipoContratto === 'parttime'
                  ? `Part-time ${percentualePt}%`
                  : 'Partita IVA'}
            </dd>
          </div>
          <div>
            <dt>Lordo annuo</dt>
            <dd><strong>{lordoAnnuoCalcolato.toLocaleString('it-IT')}€</strong></dd>
          </div>
        </dl>
      </div>

      <button
        type="button"
        class="tdv-btn-primary"
        onclick={inviaCalcolo}
        disabled={inCalcolo}
      >
        {inCalcolo ? 'Calcolo in corso…' : 'Calcola il tuo tempo di vita →'}
      </button>

      <button type="button" class="tdv-btn-ghost btn-back" onclick={() => vaiStep(2)}>
        ← Modifica
      </button>

      {#if erroreCalcolo}
        <div class="errore">⚠ {erroreCalcolo}</div>
      {/if}

      <div class="tdv-privacy-note">
        Nessun dato raccolto. Nessun account. Nessun cookie. Nessun log.<br />
        Il calcolo avviene nel rispetto della tua privacy — reload = reset.
      </div>
    {/if}
  </div>

  <aside class="side-col">
    <div class="tdv-section-label">
      <span class="tdv-star dim"></span>
      Anteprima metodologia
    </div>
    <ul class="side-list">
      <li>
        <strong>Fiscale.</strong> IRPEF 2026 (23%/33%/43% — post L. 199/2025), INPS 9,19% dipendente o 26,23% P.IVA,
        addizionali regionali/comunali medie.
      </li>
      <li>
        <strong>Costi vita.</strong> Affitto OMI, spesa ISTAT, carburante Mimit, bollette Arera
        — aggiornati ogni 7 giorni.
      </li>
      <li>
        <strong>Tempo.</strong> 730h/mese totali − 240h sonno − ore di lavoro necessarie per
        sopravvivenza, stato, capitale.
      </li>
      <li>
        <strong>Margine.</strong> ±3% su ogni stima. Non è consulenza fiscale.
      </li>
    </ul>
  </aside>
</section>

<section class="manifesto">
  <div class="manifesto-block">
    <div class="manifesto-n red">173h</div>
    <p class="manifesto-desc">
      ore di lavoro mensili previste da un contratto full-time standard
    </p>
  </div>
  <div class="manifesto-block">
    <div class="manifesto-n dim">–81h</div>
    <p class="manifesto-desc">
      ore sottratte da affitto, spesa, bollette e tasse ogni mese
    </p>
  </div>
  <div class="manifesto-block">
    <div class="manifesto-n green">24h</div>
    <p class="manifesto-desc">ore di tempo libero reale che restano dopo tutto</p>
  </div>
</section>

<style>
  /* ─── HERO ─── */
  .hero {
    position: relative;
    min-height: 420px;
    display: grid;
    grid-template-columns: 1fr 260px;
    overflow: hidden;
    border-bottom: var(--tdv-border);
  }
  .hero-left {
    padding: 40px 36px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    z-index: 2;
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
    font-size: 52px;
    line-height: 1;
    font-style: italic;
    font-weight: 700;
    color: var(--tdv-ink);
    margin-bottom: 16px;
  }
  .hero-title :global(span) {
    color: var(--tdv-red);
    font-style: normal;
  }
  .hero-sub {
    font-size: 11px;
    line-height: 1.8;
    color: var(--tdv-ink2);
    max-width: 380px;
    border-left: 2px solid var(--tdv-red);
    padding-left: 14px;
    margin-bottom: 32px;
  }
  .hero-stat {
    display: flex;
    gap: 32px;
    flex-wrap: wrap;
  }
  .hero-right {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* ─── CONTENT / WIZARD ─── */
  .content {
    display: grid;
    grid-template-columns: 1fr 280px;
    gap: 0;
    border-bottom: var(--tdv-border);
  }
  .main-col {
    border-right: var(--tdv-border);
    padding: 28px 32px;
  }
  .side-col {
    padding: 28px 24px;
  }

  .wizard-step {
    margin-bottom: 20px;
  }
  .wizard-label {
    display: block;
    font-size: 9px;
    letter-spacing: 0.12em;
    color: var(--tdv-ink3);
    text-transform: uppercase;
    margin-bottom: 8px;
  }

  /* autocomplete */
  .autocomplete {
    list-style: none;
    border: 1px solid var(--tdv-border);
    border-top: none;
    max-height: 260px;
    overflow-y: auto;
    background: #111110;
  }
  .autocomplete li + li {
    border-top: 1px solid var(--tdv-border2);
  }
  .autocomplete button {
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
  .autocomplete button:hover {
    background: rgba(200, 41, 30, 0.08);
    color: var(--tdv-red);
  }
  .ac-codice {
    font-size: 10px;
    color: var(--tdv-ink3);
    letter-spacing: 0.1em;
  }
  .selezione {
    margin-top: 10px;
    font-size: 11px;
    color: var(--tdv-ink2);
    display: flex;
    align-items: center;
    gap: 8px;
  }

  /* range */
  .tdv-range {
    width: 100%;
    accent-color: var(--tdv-red);
    background: transparent;
  }

  .riepilogo {
    padding: 14px;
    border-left: 2px solid var(--tdv-red);
    background: rgba(200, 41, 30, 0.04);
    margin-bottom: 20px;
  }
  .riep-row {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    color: var(--tdv-ink);
  }
  .riep-row strong {
    font-family: var(--tdv-serif);
    font-style: italic;
    font-size: 18px;
    color: var(--tdv-red);
  }
  .riep-hint {
    font-size: 9px;
    color: var(--tdv-ink3);
    margin-top: 6px;
    letter-spacing: 0.08em;
  }

  .riepilogo-finale {
    display: grid;
    gap: 10px;
    margin-bottom: 16px;
  }
  .riepilogo-finale > div {
    display: grid;
    grid-template-columns: 130px 1fr;
    gap: 12px;
    padding: 8px 0;
    border-bottom: 1px solid var(--tdv-border2);
    font-size: 11px;
  }
  .riepilogo-finale dt {
    color: var(--tdv-ink3);
    letter-spacing: 0.1em;
    text-transform: uppercase;
    font-size: 9px;
  }
  .riepilogo-finale dd {
    color: var(--tdv-ink);
  }

  .btn-row {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 10px;
  }
  .btn-back {
    margin-top: 10px;
  }

  .errore {
    margin-top: 14px;
    padding: 10px 14px;
    border-left: 2px solid var(--tdv-red);
    background: rgba(200, 41, 30, 0.08);
    font-size: 11px;
    color: var(--tdv-red2);
  }

  /* side col */
  .side-list {
    list-style: none;
    display: grid;
    gap: 14px;
  }
  .side-list li {
    font-size: 11px;
    color: var(--tdv-ink2);
    line-height: 1.7;
    padding-left: 10px;
    border-left: 1px solid var(--tdv-border);
  }
  .side-list strong {
    color: var(--tdv-red);
    font-weight: 600;
  }

  /* manifesto */
  .manifesto {
    padding: 28px 32px;
    border-bottom: var(--tdv-border);
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 24px;
  }
  .manifesto-n {
    font-family: var(--tdv-serif);
    font-size: 42px;
    font-style: italic;
    line-height: 1;
    margin-bottom: 8px;
  }
  .manifesto-n.red {
    color: var(--tdv-red);
  }
  .manifesto-n.dim {
    color: var(--tdv-ink3);
  }
  .manifesto-n.green {
    color: var(--tdv-green);
  }
  .manifesto-desc {
    font-size: 10px;
    color: var(--tdv-ink3);
    line-height: 1.7;
    letter-spacing: 0.04em;
  }

  /* responsive */
  @media (max-width: 900px) {
    .hero {
      grid-template-columns: 1fr;
    }
    .hero-right {
      padding: 20px 0 30px;
    }
    .content {
      grid-template-columns: 1fr;
    }
    .main-col {
      border-right: none;
      border-bottom: var(--tdv-border);
    }
    .hero-title {
      font-size: 42px;
    }
    .manifesto {
      grid-template-columns: 1fr;
    }
  }
</style>
