<!--
  src/routes/+page.svelte
  Home: hero editoriale + globo + wizard 3-step.
  Flusso: utente compila → chiamata a /api/calcola e /api/costi/:p in parallelo →
  store popolati → goto('/report').
  Nessun dato persistente: reload = reset.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { get } from 'svelte/store';
  import Globe from '$lib/components/Globe.svelte';
  import provinceData from '$lib/data/province.json';
  import ccnlData from '$lib/data/ccnl.json';
  import { calcola_netto, MARGINE_ERRORE } from '$lib/engine/fiscal';
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
  let pagaMensileNetta = $state<number>(0); // solo per tipo_contratto === 'nero'

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

  // CCNL dà mensile → annuo = mensile × mensilita (default 13, dottorato usa 12).
  const lordoAnnuoCalcolato: number = $derived.by(() => {
    if (tipoContratto === 'nero') return pagaMensileNetta * 12;
    if (!livelloCorrente) return 0;
    const mensilita = settoreCorrente?.mensilita ?? 13;
    let annuo = livelloCorrente.lordo_mensile * mensilita;
    if (tipoContratto === 'parttime') annuo = annuo * (percentualePt / 100);
    return Math.round(annuo);
  });

  // Anteprima netto client-side: per nero è la paga dichiarata; dottorato è
  // esente IRPEF quindi netto = lordo; altri usano l'engine fiscale.
  const nettoMensileStimato: number = $derived.by(() => {
    if (tipoContratto === 'nero') return pagaMensileNetta;
    if (!provinciaSelezionata || lordoAnnuoCalcolato <= 0) return 0;
    try {
      const out = calcola_netto({
        lordo_annuo: lordoAnnuoCalcolato,
        tipo_contratto: tipoContratto,
        regione: provinciaSelezionata.regione,
        comune: provinciaSelezionata.nome.toLowerCase()
      });
      return Math.round(out.netto_mensile);
    } catch {
      return 0;
    }
  });

  // Ore di lavoro contrattuali stimate al mese (standard 40h/sett × 4.33).
  const oreLavoroMensili: number = $derived.by(() => {
    const oreFull = oreSettimanali * 4.33;
    if (tipoContratto === 'parttime') return Math.round(oreFull * (percentualePt / 100));
    return Math.round(oreFull);
  });

  // Diritti non goduti stimati per lavoro a nero (uso annualizzato).
  const dirittiNonGoduti = $derived.by(() => {
    if (tipoContratto !== 'nero' || pagaMensileNetta <= 0) return null;
    const annuo = pagaMensileNetta * 12;
    return {
      tfr: Math.round(annuo * 0.0833),        // TFR: 8.33% del lordo equivalente
      ferie: Math.round((pagaMensileNetta / 21) * 26), // 26 gg retribuiti non pagati
      inpsAnnuo: Math.round(annuo * 0.0919)   // contributi pensione non versati
    };
  });

  // ─── Wizard step metadata (per stepper) ─────────────────────────────
  const wizardSteps: { n: 1 | 2 | 3; label: string }[] = [
    { n: 1, label: 'Città' },
    { n: 2, label: 'Lavoro' },
    { n: 3, label: 'Conferma' }
  ];

  // ─── Pre-popolamento da store (flusso "← Modifica" dal report) ──────
  // Se l'URL contiene ?modifica=1 e lo store profilo è popolato, ripristina
  // la selezione nello step 2 senza azzerare i dati già calcolati.
  onMount(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get('modifica') !== '1') return;
    const p = get(profilo);
    if (!p) return;

    const prov = province.find((pr) => pr.codice === p.provincia);
    if (prov) {
      provinciaSelezionata = prov;
      queryProvincia = `${prov.nome} (${prov.codice})`;
    }
    if (p.settore_id && p.settore_id !== 'nero') settoreId = p.settore_id;
    if (p.livello && p.livello !== '-') livello = p.livello;
    tipoContratto = p.tipo_contratto;
    if (p.tipo_contratto === 'parttime' && p.percentuale_parttime) {
      percentualePt = Math.round(p.percentuale_parttime * 100);
    }
    oreSettimanali = p.ore_settimanali_contratto ?? 40;
    if (p.paga_mensile_netta) pagaMensileNetta = p.paga_mensile_netta;
    step = 2;
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
    if (tipoContratto === 'nero') return pagaMensileNetta > 0 && oreSettimanali > 0;
    if (!livelloCorrente) return false;
    if (tipoContratto === 'parttime' && (percentualePt <= 0 || percentualePt > 100)) return false;
    return true;
  }

  async function inviaCalcolo() {
    if (!provinciaSelezionata) return;
    if (tipoContratto !== 'nero' && !livelloCorrente) return;

    inCalcolo = true;
    erroreCalcolo = null;

    try {
      // ── Lavoro a nero: fiscal client-side, solo costi da API ─────────
      if (tipoContratto === 'nero') {
        const respCosti = await fetch(`/api/costi/${provinciaSelezionata.codice}`);
        if (!respCosti.ok) throw new Error(await respCosti.text() || `Errore costi (${respCosti.status})`);
        const costi: CostiVita = await respCosti.json();

        const fiscale: FiscalOutput = {
          netto_mensile: pagaMensileNetta,
          netto_annuo: pagaMensileNetta * 12,
          irpef_annua: 0,
          addizionale_regionale: 0,
          addizionale_comunale: 0,
          contributi_inps: 0,
          cuneo_fiscale_percentuale: 0,
          margine_errore: MARGINE_ERRORE
        };

        profilo.set({
          provincia: provinciaSelezionata.codice,
          nome_provincia: provinciaSelezionata.nome,
          regione: provinciaSelezionata.regione,
          comune_capoluogo: provinciaSelezionata.nome.toLowerCase(),
          settore_id: 'nero',
          settore_nome: 'Lavoro non regolamentato',
          livello: '-',
          tipo_contratto: 'nero',
          ore_settimanali_contratto: oreSettimanali,
          paga_mensile_netta: pagaMensileNetta
        });
        risultatoFiscale.set(fiscale);
        costiProvincia.set(costi);
        await goto('/report');
        return;
      }

      // ── Tutti gli altri contratti: flusso normale ────────────────────
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

      const [respFisc, respCosti] = await Promise.all([
        fetch('/api/calcola', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            lordo_annuo: lordoAnnuoCalcolato,
            tipo_contratto: tipoContratto,
            regione: profiloCorrente.regione,
            comune: profiloCorrente.comune_capoluogo,
            ...(tipoContratto === 'parttime' ? { percentuale_parttime: percentualePt / 100 } : {})
          })
        }),
        fetch(`/api/costi/${provinciaSelezionata.codice}`)
      ]);

      if (!respFisc.ok) throw new Error(await respFisc.text() || `Errore calcolo (${respFisc.status})`);
      if (!respCosti.ok) throw new Error(await respCosti.text() || `Errore costi (${respCosti.status})`);

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
    <div class="hero-stat-wrap">
      <div class="hero-stat-eyebrow">
        Esempio · commercio livello 4 · Bologna
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
      Il tuo profilo
    </div>

    <!-- Stepper editoriale: 3 segmenti, indietro consentito sui completati -->
    <ol class="stepper" aria-label="Progresso compilazione">
      {#each wizardSteps as s (s.n)}
        {@const isDone = step > s.n}
        {@const isCurrent = step === s.n}
        <li
          class="stepper-item"
          class:done={isDone}
          class:current={isCurrent}
          aria-current={isCurrent ? 'step' : undefined}
        >
          <button
            type="button"
            onclick={() => isDone && vaiStep(s.n)}
            disabled={!isDone}
            aria-label="Passo {s.n}: {s.label}{isDone ? ' (completato)' : isCurrent ? ' (in corso)' : ''}"
          >
            <span class="step-num">0{s.n}</span>
            <span class="step-label">{s.label}</span>
            <span class="step-state" aria-hidden="true">
              {#if isDone}
                <span class="step-check">✓</span>
              {:else if isCurrent}
                <span class="tdv-triangle"></span>
              {:else}
                <span class="step-circle"></span>
              {/if}
            </span>
          </button>
        </li>
      {/each}
    </ol>
    <div class="stepper-progress" aria-hidden="true">
      <div class="stepper-progress-bar" style:width="{(step / 3) * 100}%"></div>
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

    <!-- Step 2: contratto — flusso normale o lavoro a nero -->
    {#if step === 2}
      <!-- Selezione tipo contratto sempre visibile -->
      <div class="wizard-step">
        <label class="wizard-label" for="contratto-sel">Tipo contratto</label>
        <select
          id="contratto-sel"
          class="tdv-select"
          bind:value={tipoContratto}
          onchange={() => {
            // reset settore/livello al default quando si cambia tipo
            if (tipoContratto !== 'nero') {
              const primo = settoreCorrente?.livelli[0];
              if (primo) livello = primo.livello;
            }
          }}
        >
          <option value="indeterminato">Indeterminato full-time</option>
          <option value="parttime">Part-time</option>
          <option value="partiva">Partita IVA (gestione separata)</option>
          <option value="dottorato">Borsa di dottorato di ricerca</option>
          <option value="nero">Non ho un contratto / lavoro a nero</option>
        </select>
      </div>

      {#if tipoContratto === 'nero'}
        <!-- ── Flusso lavoro a nero ── -->
        <div class="wizard-nero-intro">
          <span class="tdv-triangle"></span>
          Inserisci quello che ricevi davvero: niente stime, niente calcoli. Il
          modello funziona uguale — costi di vita e ore sottratte si calcolano
          allo stesso modo.
        </div>

        <div class="wizard-step">
          <label for="paga-netta-input" class="wizard-label">
            Paga mensile in mano (€)
          </label>
          <input
            id="paga-netta-input"
            type="number"
            class="tdv-input"
            min="1"
            max="50000"
            step="50"
            placeholder="es. 900"
            bind:value={pagaMensileNetta}
          />
        </div>

        <div class="wizard-step">
          <label for="ore-nero-range" class="wizard-label">
            Ore lavorate a settimana: <strong>{oreSettimanali}h</strong>
          </label>
          <input
            id="ore-nero-range"
            type="range"
            min="4"
            max="80"
            step="1"
            bind:value={oreSettimanali}
            class="tdv-range"
          />
        </div>

      {:else}
        <!-- ── Flusso contratto regolamentato ── -->
        <div class="wizard-step">
          <label for="settore-sel" class="wizard-label">
            {tipoContratto === 'dottorato' ? 'Tipo di borsa' : 'Settore CCNL'}
          </label>
          <select
            id="settore-sel"
            class="tdv-select"
            bind:value={settoreId}
            onchange={() => {
              const primo = settoreCorrente?.livelli[0];
              if (primo) livello = primo.livello;
            }}
          >
            {#each settori.filter(s => tipoContratto === 'dottorato' ? s.id === 'dottorato' : s.id !== 'dottorato') as s (s.id)}
              <option value={s.id}>{s.nome}</option>
            {/each}
          </select>
        </div>

        <div class="wizard-step">
          <label for="livello-sel" class="wizard-label">
            {tipoContratto === 'dottorato' ? 'Tipo di borsa / anno' : 'Livello / inquadramento'}
          </label>
          <select id="livello-sel" class="tdv-select" bind:value={livello}>
            {#each settoreCorrente?.livelli ?? [] as l (l.livello)}
              <option value={l.livello}>
                {l.descrizione} · {l.lordo_mensile}€/mese
              </option>
            {/each}
          </select>
        </div>

        {#if tipoContratto === 'dottorato'}
          <div class="wizard-nota-dottorato">
            <span class="nota-key">Nota fiscale</span>
            Le borse di dottorato sono <strong>esenti IRPEF</strong> (art. 4, L. 476/1984)
            e non soggette a contribuzione INPS sul percorso formativo standard. Il
            netto coincide con il lordo.
          </div>
        {/if}

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
            Minimo tabellare × {settoreCorrente?.mensilita ?? 13} mensilità
            {tipoContratto === 'dottorato' ? '(DM 630/2023)' : '(CCNL)'}
            {tipoContratto === 'parttime' ? `· ridotto al ${percentualePt}%` : ''}.
          </div>
        </div>
      {/if}

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
          {#if tipoContratto === 'nero'}
            <div>
              <dt>Contratto</dt>
              <dd>Nessun contratto · lavoro non regolamentato</dd>
            </div>
            <div>
              <dt>Paga mensile dichiarata</dt>
              <dd><strong>{pagaMensileNetta.toLocaleString('it-IT')}€ netti</strong></dd>
            </div>
            <div>
              <dt>Ore settimanali</dt>
              <dd>{oreSettimanali}h</dd>
            </div>
          {:else}
            <div>
              <dt>Settore</dt>
              <dd>{settoreCorrente?.nome}</dd>
            </div>
            <div>
              <dt>Livello</dt>
              <dd>{livelloCorrente?.descrizione}</dd>
            </div>
            <div>
              <dt>Contratto</dt>
              <dd>
                {tipoContratto === 'indeterminato' ? 'Indeterminato full-time'
                  : tipoContratto === 'parttime' ? `Part-time ${percentualePt}%`
                  : tipoContratto === 'dottorato' ? 'Borsa di dottorato'
                  : 'Partita IVA (gestione separata)'}
              </dd>
            </div>
            <div>
              <dt>Lordo annuo</dt>
              <dd><strong>{lordoAnnuoCalcolato.toLocaleString('it-IT')}€</strong></dd>
            </div>
          {/if}
        </dl>

        <!-- Anteprima viva -->
        <div class="anteprima-vivente">
          <div class="av-row">
            <span class="av-key">
              {tipoContratto === 'nero' ? 'Paga in mano al mese' : 'Netto mensile stimato'}
            </span>
            <span class="av-val red">
              {tipoContratto === 'nero' ? '' : '~'}{nettoMensileStimato.toLocaleString('it-IT')}€
            </span>
          </div>
          <div class="av-row">
            <span class="av-key">Ore di lavoro al mese</span>
            <span class="av-val">{oreLavoroMensili}h</span>
          </div>
          <div class="av-hint">
            {#if tipoContratto === 'nero'}
              Nessuna trattenuta fiscale dichiarata · il modello usa la paga come netto
            {:else if tipoContratto === 'dottorato'}
              Borsa esente IRPEF ex L. 476/1984 · netto = lordo · margine ±3%
            {:else}
              Calcolo client-side · IRPEF + INPS + addizionali · margine ±3%
            {/if}
          </div>
        </div>

        <!-- Diritti non goduti — solo lavoro a nero -->
        {#if tipoContratto === 'nero' && dirittiNonGoduti}
          <div class="diritti-non-goduti">
            <div class="dng-label">
              <span class="tdv-triangle"></span>
              Cosa non stai accumulando
            </div>
            <div class="dng-row">
              <span class="dng-key">TFR non maturato</span>
              <span class="dng-val">~{dirittiNonGoduti.tfr.toLocaleString('it-IT')}€/anno</span>
            </div>
            <div class="dng-row">
              <span class="dng-key">Ferie retribuite</span>
              <span class="dng-val">0 giorni (diritto: 26gg/anno · ~{dirittiNonGoduti.ferie.toLocaleString('it-IT')}€)</span>
            </div>
            <div class="dng-row">
              <span class="dng-key">Contributi INPS pensione</span>
              <span class="dng-val">0 (stima: ~{dirittiNonGoduti.inpsAnnuo.toLocaleString('it-IT')}€/anno non versati)</span>
            </div>
            <div class="dng-row">
              <span class="dng-key">Malattia / maternità</span>
              <span class="dng-val">nessuna copertura</span>
            </div>
          </div>
        {/if}
      </div>

      <!-- Anteprima report: cosa l'utente vedrà dopo aver cliccato Calcola -->
      <div class="cosa-vedrai">
        <div class="cv-label">
          <span class="tdv-triangle"></span>
          Cosa vedrai dopo
        </div>
        <ul class="cv-list">
          <li>
            <span class="cv-glyph cv-glyph-pie" aria-hidden="true">
              <span></span><span></span><span></span><span></span>
            </span>
            <div>
              <strong>Torta del tuo tempo</strong>
              <span class="cv-sub">7 segmenti: sopravvivenza · stato · capitale · sonno · vita biologica · libero</span>
            </div>
          </li>
          <li>
            <span class="cv-glyph cv-glyph-bars" aria-hidden="true">
              <span></span><span></span><span></span>
            </span>
            <div>
              <strong>Confronto con altre città</strong>
              <span class="cv-sub">stesso lordo, costi e tasse di 5 capoluoghi italiani</span>
            </div>
          </li>
          <li>
            <span class="cv-glyph cv-glyph-star" aria-hidden="true">
              <span class="tdv-star"></span>
            </span>
            <div>
              <strong>Sindacati e sportelli vicino a te</strong>
              <span class="cv-sub">SUNIA, CGIL, collettivi della tua provincia — quando i numeri scottano</span>
            </div>
          </li>
          <li>
            <span class="cv-glyph cv-glyph-link" aria-hidden="true">#</span>
            <div>
              <strong>Link condivisibile</strong>
              <span class="cv-sub">URL anonimo per condividere il risultato — nessun tracciamento</span>
            </div>
          </li>
        </ul>
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
      Come funziona
    </div>

    <p class="side-intro">
      Tempo di Vita non inventa numeri. Legge dati pubblici dello Stato e li
      trasforma in qualcosa che si capisce: <em>ore della tua vita</em>.
    </p>

    <details class="side-detail">
      <summary>
        <span class="side-q-mark" aria-hidden="true"></span>
        <span class="side-q">Da dove vengono le tasse?</span>
      </summary>
      <div class="side-a">
        L'<strong>IRPEF</strong> è la tassa sul reddito: tre fasce (23%, 33%,
        43%) decise ogni anno dalla Legge di Bilancio. Ai dipendenti si
        sommano i <strong>contributi INPS</strong> (9,19%) e le
        <strong>addizionali regionali e comunali</strong>, diverse città per
        città. Per chi ha partita IVA in gestione separata: 26,23% INPS.
      </div>
    </details>

    <details class="side-detail">
      <summary>
        <span class="side-q-mark" aria-hidden="true"></span>
        <span class="side-q">Da dove vengono i costi della vita?</span>
      </summary>
      <div class="side-a">
        L'<strong>OMI</strong> è il database immobiliare dell'Agenzia delle
        Entrate: lo Stato pubblica i prezzi medi degli affitti per ogni
        provincia, ogni sei mesi. L'<strong>ISTAT</strong> pubblica il
        "paniere": i prezzi reali della spesa alimentare, mensili. Il
        <strong>Mimit</strong> aggiorna ogni 48 ore i prezzi medi di benzina
        e diesel. Le <strong>bollette</strong> seguono le tariffe ARERA.
      </div>
    </details>

    <details class="side-detail">
      <summary>
        <span class="side-q-mark" aria-hidden="true"></span>
        <span class="side-q">Come si trasforma il salario in ore?</span>
      </summary>
      <div class="side-a">
        Un mese ha <strong>730 ore</strong>. Ne togliamo <strong>240</strong>
        di sonno (8h × 30). Delle restanti, calcoliamo quante servono per
        pagare affitto, spesa, bollette, tasse — quelle sono ore
        <em>sottratte</em>. Ciò che rimane è il tuo tempo libero
        <em>reale</em>, quello che davvero ti appartiene.
      </div>
    </details>

    <details class="side-detail">
      <summary>
        <span class="side-q-mark" aria-hidden="true"></span>
        <span class="side-q">Quanto sono affidabili questi numeri?</span>
      </summary>
      <div class="side-a">
        Ogni stima porta un <strong>margine di ±3%</strong>: non è una
        consulenza fiscale, è uno strumento di consapevolezza. Il calcolo è
        verificabile riga per riga nel codice sorgente, e usa solo fonti
        ufficiali e pubbliche.
      </div>
    </details>

    <a href="/dati-aperti" class="side-cta">→ Mappa interattiva delle fonti</a>
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
  .hero-stat-wrap {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .hero-stat-eyebrow {
    font-size: 9px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--tdv-red);
    padding-left: 10px;
    border-left: 2px solid var(--tdv-red);
    line-height: 1.4;
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

  /* ─── STEPPER ─── */
  .stepper {
    list-style: none;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    border-top: 1px solid var(--tdv-border);
    border-bottom: 1px solid var(--tdv-border);
    margin-bottom: 0;
  }
  .stepper-item {
    border-right: 1px solid var(--tdv-border);
  }
  .stepper-item:last-child {
    border-right: none;
  }
  .stepper-item button {
    width: 100%;
    background: transparent;
    border: none;
    padding: 14px 16px;
    display: flex;
    align-items: center;
    gap: 12px;
    cursor: not-allowed;
    text-align: left;
    color: var(--tdv-ink3);
    font-family: var(--tdv-mono);
    transition: color 0.2s, background 0.2s;
  }
  .stepper-item.done button {
    cursor: pointer;
    color: var(--tdv-ink2);
  }
  .stepper-item.done button:hover,
  .stepper-item.done button:focus-visible {
    background: rgba(200, 41, 30, 0.05);
    color: var(--tdv-red);
    outline: none;
  }
  .stepper-item.current button {
    color: var(--tdv-red);
    cursor: default;
    background: rgba(200, 41, 30, 0.04);
  }
  .step-num {
    font-family: var(--tdv-serif);
    font-style: italic;
    font-weight: 700;
    font-size: 22px;
    line-height: 1;
    flex-shrink: 0;
    color: var(--tdv-ink3);
  }
  .stepper-item.done .step-num {
    color: var(--tdv-red);
  }
  .stepper-item.current .step-num {
    color: var(--tdv-red);
  }
  .step-label {
    font-size: 9px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    flex: 1;
  }
  .step-state {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 14px;
    height: 14px;
    flex-shrink: 0;
  }
  .step-check {
    color: var(--tdv-red);
    font-size: 11px;
    line-height: 1;
  }
  .step-circle {
    width: 6px;
    height: 6px;
    border: 1px solid var(--tdv-ink3);
    border-radius: 50%;
  }

  /* Linea di progressione sotto i 3 segmenti */
  .stepper-progress {
    height: 2px;
    background: var(--tdv-border);
    margin-bottom: 24px;
    position: relative;
    overflow: hidden;
  }
  .stepper-progress-bar {
    height: 100%;
    background: var(--tdv-red);
    transition: width 0.35s cubic-bezier(0.2, 0.8, 0.2, 1);
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

  /* ─── Anteprima viva nel riepilogo (#3c) ─── */
  .anteprima-vivente {
    margin-top: 18px;
    padding: 14px 16px;
    border: 1px solid var(--tdv-border);
    border-left: 2px solid var(--tdv-red);
    background: rgba(200, 41, 30, 0.03);
  }
  .av-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    padding: 6px 0;
    border-bottom: 1px solid var(--tdv-border2);
  }
  .av-row:last-of-type {
    border-bottom: none;
  }
  .av-key {
    font-size: 9px;
    letter-spacing: 0.10em;
    text-transform: uppercase;
    color: var(--tdv-ink3);
  }
  .av-val {
    font-family: var(--tdv-serif);
    font-style: italic;
    font-weight: 700;
    font-size: 20px;
    color: var(--tdv-ink);
  }
  .av-val.red {
    color: var(--tdv-red);
  }
  .av-hint {
    margin-top: 8px;
    font-size: 9px;
    letter-spacing: 0.06em;
    color: var(--tdv-ink3);
  }

  /* ─── "Cosa vedrai dopo" (#3b) ─── */
  .cosa-vedrai {
    margin-top: 24px;
    margin-bottom: 20px;
    border-top: 1px solid var(--tdv-border);
    padding-top: 20px;
  }
  .cv-label {
    font-family: var(--tdv-mono);
    font-size: 9px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--tdv-red);
    margin-bottom: 14px;
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .cv-list {
    list-style: none;
    display: flex;
    flex-direction: column;
  }
  .cv-list li {
    display: grid;
    grid-template-columns: 32px 1fr;
    gap: 14px;
    align-items: center;
    padding: 12px 0;
    border-top: 1px solid var(--tdv-border2);
  }
  .cv-list li:first-child {
    border-top: none;
  }
  .cv-list strong {
    display: block;
    font-size: 11px;
    color: var(--tdv-ink);
    font-weight: 600;
    letter-spacing: 0.02em;
    margin-bottom: 3px;
  }
  .cv-sub {
    display: block;
    font-size: 10px;
    color: var(--tdv-ink3);
    line-height: 1.55;
  }

  /* Glifi CSS-puri (no emoji) */
  .cv-glyph {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--tdv-red);
  }
  /* Pie: 4 quarti accostati a 4 colori del design system */
  .cv-glyph-pie {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1px;
    width: 18px;
    height: 18px;
  }
  .cv-glyph-pie span {
    background: var(--tdv-red);
  }
  .cv-glyph-pie span:nth-child(2) {
    background: var(--tdv-ink3);
  }
  .cv-glyph-pie span:nth-child(3) {
    background: var(--tdv-green);
  }
  .cv-glyph-pie span:nth-child(4) {
    background: #4a3a28;
  }
  /* 3 barre verticali tipo grafico a barre */
  .cv-glyph-bars {
    display: flex;
    align-items: flex-end;
    gap: 2px;
    height: 16px;
  }
  .cv-glyph-bars span {
    width: 4px;
    background: var(--tdv-red);
  }
  .cv-glyph-bars span:nth-child(1) {
    height: 8px;
  }
  .cv-glyph-bars span:nth-child(2) {
    height: 14px;
  }
  .cv-glyph-bars span:nth-child(3) {
    height: 11px;
  }
  /* Link glyph: hash mono */
  .cv-glyph-link {
    font-family: var(--tdv-mono);
    font-weight: 600;
    font-size: 16px;
    line-height: 1;
  }

  /* ─── Lavoro a nero: intro + diritti non goduti ─── */
  .wizard-nero-intro {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 12px 14px;
    border-left: 2px solid var(--tdv-red);
    background: rgba(200, 41, 30, 0.04);
    font-size: 11px;
    color: var(--tdv-ink2);
    line-height: 1.65;
    margin-bottom: 20px;
  }

  .diritti-non-goduti {
    margin-top: 18px;
    padding: 14px 16px;
    border: 1px solid var(--tdv-border);
    border-left: 2px solid var(--tdv-ink3);
    background: rgba(90, 88, 80, 0.06);
  }
  .dng-label {
    font-size: 9px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--tdv-ink3);
    margin-bottom: 12px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .dng-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 4px;
    padding: 5px 0;
    border-bottom: 1px solid var(--tdv-border2);
    font-size: 10px;
  }
  .dng-row:last-child {
    border-bottom: none;
  }
  .dng-key {
    color: var(--tdv-ink3);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-size: 9px;
  }
  .dng-val {
    color: var(--tdv-ink2);
  }

  /* ─── Nota dottorato ─── */
  .wizard-nota-dottorato {
    margin-bottom: 16px;
    padding: 10px 14px;
    border-left: 2px solid var(--tdv-green);
    background: rgba(29, 158, 117, 0.05);
    font-size: 11px;
    color: var(--tdv-ink2);
    line-height: 1.65;
  }
  .wizard-nota-dottorato .nota-key {
    display: block;
    font-size: 9px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--tdv-green);
    margin-bottom: 6px;
  }
  .wizard-nota-dottorato strong {
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

  /* ─── Side col: "Come funziona" ─── */
  .side-intro {
    font-size: 12px;
    color: var(--tdv-ink2);
    line-height: 1.7;
    margin-bottom: 22px;
    padding-bottom: 18px;
    border-bottom: 1px solid var(--tdv-border);
  }
  .side-intro em {
    color: var(--tdv-red);
    font-style: italic;
    font-family: var(--tdv-serif);
  }

  .side-detail {
    border-bottom: 1px solid var(--tdv-border2);
  }
  .side-detail > summary {
    list-style: none;
    cursor: pointer;
    padding: 12px 0;
    display: flex;
    align-items: center;
    gap: 10px;
    color: var(--tdv-ink2);
    font-size: 11px;
    line-height: 1.5;
    transition: color 0.15s;
  }
  .side-detail > summary::-webkit-details-marker {
    display: none;
  }
  .side-detail > summary:hover {
    color: var(--tdv-ink);
  }
  /* Marker: triangolo CSS-only che ruota in stato open */
  .side-q-mark {
    width: 0;
    height: 0;
    border-left: 5px solid var(--tdv-red);
    border-top: 4px solid transparent;
    border-bottom: 4px solid transparent;
    flex-shrink: 0;
    transition: transform 0.2s ease-out;
  }
  .side-detail[open] > summary {
    color: var(--tdv-red);
  }
  .side-detail[open] .side-q-mark {
    transform: rotate(90deg);
  }
  .side-q {
    flex: 1;
  }

  .side-a {
    padding: 0 0 16px 15px;
    margin-left: 0;
    border-left: 1px solid var(--tdv-red-dim);
    font-size: 11px;
    line-height: 1.75;
    color: var(--tdv-ink2);
  }
  .side-a strong {
    color: var(--tdv-ink);
    font-weight: 600;
  }
  .side-a em {
    color: var(--tdv-red);
    font-style: italic;
    font-family: var(--tdv-serif);
  }

  .side-cta {
    display: inline-block;
    margin-top: 22px;
    font-size: 10px;
    letter-spacing: 0.10em;
    text-transform: uppercase;
    color: var(--tdv-red);
    text-decoration: none;
    border-bottom: 1px solid var(--tdv-red-dim);
    padding-bottom: 4px;
    transition: border-color 0.2s;
  }
  .side-cta:hover {
    border-color: var(--tdv-red);
    color: var(--tdv-red2);
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

  @media (max-width: 560px) {
    /* Stepper verticale: barra rossa a sinistra invece di colonne */
    .stepper {
      grid-template-columns: 1fr;
      border-top: none;
    }
    .stepper-item {
      border-right: none;
      border-bottom: 1px solid var(--tdv-border);
      border-left: 2px solid transparent;
    }
    .stepper-item:last-child {
      border-bottom: none;
    }
    .stepper-item.current {
      border-left-color: var(--tdv-red);
    }
    .stepper-item.done {
      border-left-color: var(--tdv-red-dim);
    }
    .stepper-item button {
      padding: 10px 14px;
    }
    .step-num {
      font-size: 18px;
    }
  }
</style>
