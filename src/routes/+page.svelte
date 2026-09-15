<!--
  src/routes/+page.svelte
  Una sola schermata: scegli, e il risultato cambia mentre scegli.
  Niente wizard a passi, niente navigazione verso una pagina di report, niente
  stato da trasportare fra route. Chi arriva da un link condiviso vede lo stesso
  risultato già renderizzato dal server, poi il calcolo continua nel browser.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import Barra, { type Fetta } from '$lib/components/Barra.svelte';
  import Numero from '$lib/components/Numero.svelte';
  import Aiuti from '$lib/components/Aiuti.svelte';
  import Metodo from '$lib/components/Metodo.svelte';
  import { calcola, eurMqPeriferia, prezzoInOre } from '$lib/engine';
  import {
    PROVINCE,
    SETTORI,
    META_CCNL,
    lordoMensileCcnl,
    risolviIngresso,
    statoInQuery,
    trovaSettore,
    type Stato
  } from '$lib/stato';
  import tempoData from '$lib/data/tempo.json';
  import { formattaEuro, formattaOre } from '$lib/formato';
  import type { AlloggioId, ProfiloCura, SituazionePersonale, TipoContratto } from '$lib/types';
  import type { PageData } from './$types';

  const { data }: { data: PageData } = $props();

  // ─── stato ────────────────────────────────────────────────────────────────
  // Copia iniziale voluta: da qui in poi lo stato vive nel client e la URL lo
  // segue, non il contrario. Un nuovo `data` dal server non deve sovrascrivere
  // quello che l'utente sta muovendo.
  let s = $state<Stato>(untrack(() => ({ ...data.stato })));
  let ricerca = $state('');
  let situazione = $state<SituazionePersonale>({
    in_affitto: true,
    under31: false,
    con_figli: false
  });
  let prezzo = $state(100);
  let copiato = $state(false);

  // ─── derivati ─────────────────────────────────────────────────────────────
  const risolto = $derived(risolviIngresso(s));
  const r = $derived(risolto ? calcola(risolto.ingresso, risolto.provincia) : null);
  const provincia = $derived(risolto?.provincia ?? null);
  const settore = $derived(trovaSettore(s.settore_id));

  const provinceFiltrate = $derived.by(() => {
    const q = ricerca.trim().toLowerCase();
    if (!q) return [];
    return PROVINCE.filter(
      (p) =>
        p.nome.toLowerCase().includes(q) ||
        p.codice.toLowerCase() === q ||
        p.regione.replace(/-/g, ' ').includes(q)
    ).slice(0, 7);
  });

  // La URL segue lo stato, così un refresh non perde quello che hai scelto e
  // copiare dalla barra degli indirizzi funziona.
  //
  // Due accortezze. La prima: si aspettano 250 ms, altrimenti digitando in un
  // campo numerico si riscrive la URL a ogni tasto. La seconda: si usa l'API
  // nativa invece di `replaceState` di SvelteKit, perché quello, chiamato da
  // dentro un effetto, rientra nel proprio flush e va in errore al primo
  // aggiornamento — lasciando la URL ferma al valore iniziale. Qui cambia solo
  // la query, mai il percorso, e si ripassa `history.state` intatto: il router
  // non se ne accorge e la cronologia non si riempie di voci.
  let attesaUrl: ReturnType<typeof setTimeout> | undefined;
  $effect(() => {
    const q = statoInQuery(s);
    if (typeof window === 'undefined') return;
    clearTimeout(attesaUrl);
    attesaUrl = setTimeout(() => {
      if (window.location.search.slice(1) === q) return;
      window.history.replaceState(
        window.history.state,
        '',
        `${window.location.pathname}?${q}`
      );
    }, 250);
    return () => clearTimeout(attesaUrl);
  });

  // ─── fette ────────────────────────────────────────────────────────────────
  const fetteOra: Fetta[] = $derived.by(() => {
    if (!r) return [];
    const v = r.valore;
    const banda = v.settore_pubblico
      ? ''
      : ` Stima fra ${Math.round(v.profitto_banda.min_ore)} e ${Math.round(
          v.profitto_banda.max_ore
        )} ore: dipende dalla quota del valore aggiunto che nel tuo settore va al lavoro, che è il parametro più incerto del modello.`;
    return [
      {
        id: 'profitto',
        etichetta: 'Profitto e rendita',
        ore: v.profitto.ore,
        euro: v.profitto.euro,
        colore: 'var(--tdv-dato-1)',
        spiegazione: v.settore_pubblico
          ? 'Nel settore pubblico non c’è estrazione di profitto privato: questa fetta è posta a zero per convenzione dichiarata, non misurata.'
          : `Il valore che produci e che non torna a te in nessuna forma: resta all’impresa.${banda}`
      },
      {
        id: 'previdenza',
        etichetta: 'Previdenza e TFR',
        ore: v.previdenza.ore,
        euro: v.previdenza.euro,
        colore: 'var(--tdv-dato-2)',
        spiegazione:
          'Contributi tuoi e del datore, più il TFR. Non è una tassa: è salario differito e assicurazione sociale — pensione, disoccupazione, malattia, maternità. Due terzi li versa chi ti paga, e non li vedi in busta.'
      },
      {
        id: 'imposte',
        etichetta: r.valore.imposte.euro < 0 ? 'Imposte (saldo a tuo favore)' : 'Imposte',
        ore: Math.abs(v.imposte.ore),
        euro: v.imposte.euro,
        colore: 'var(--tdv-dato-3)',
        spiegazione:
          r.valore.imposte.euro < 0
            ? 'Con questo reddito il taglio del cuneo e il trattamento integrativo ti restituiscono più IRPEF di quanta ne paghi: il saldo fiscale è negativo. Il prelievo vero che senti è quello contributivo.'
            : 'IRPEF e addizionali regionale e comunale, al netto di detrazioni, taglio del cuneo e trattamento integrativo.'
      },
      {
        id: 'netto',
        etichetta: 'A te',
        ore: v.netto.ore,
        euro: v.netto.euro,
        colore: 'var(--tdv-dato-4)',
        spiegazione: 'Quello che arriva sul conto, prima di spendere un euro.'
      }
    ];
  });

  const fetteMese: Fetta[] = $derived.by(() => {
    if (!r) return [];
    const t = r.tempo;
    const eurOra = t.salario_orario_reale;
    return [
      {
        id: 'lavoro',
        etichetta: 'Lavoro e tragitto',
        ore: t.ore_sottratte,
        euro: t.ore_sottratte * eurOra,
        colore: 'var(--tdv-dato-1)',
        spiegazione: `${Math.round(t.ore_retribuite)} ore pagate, ${Math.round(
          t.ore_pendolarismo
        )} di spostamenti e ${Math.round(
          t.ore_straordinario
        )} di straordinario non pagato. Le ultime due non sono lavoro, ma non sono nemmeno tempo tuo.`
      },
      {
        id: 'familiare',
        etichetta: 'Lavoro domestico e di cura',
        ore: t.ore_lavoro_familiare,
        euro: t.ore_lavoro_familiare * eurOra,
        colore: 'var(--tdv-dato-3)',
        spiegazione:
          'Cucinare, pulire, fare la spesa, accudire. È lavoro, non è tempo libero, e non lo paga nessuno. Fra persone occupate, le donne ne fanno 2h22 al giorno più degli uomini: circa 72 ore al mese.'
      },
      {
        id: 'sonno',
        etichetta: 'Sonno',
        ore: t.ore_sonno,
        euro: 0,
        colore: 'var(--tdv-neutro-1)',
        spiegazione: 'Otto ore per notte. L’unica voce che nessuno può contrattare.'
      },
      {
        id: 'cura',
        etichetta: 'Mangiare, lavarsi',
        ore: t.ore_cura_personale,
        euro: 0,
        colore: 'var(--tdv-neutro-2)',
        spiegazione: 'Pasti, igiene, cura di sé: circa due ore e mezza al giorno.'
      },
      {
        id: 'libero',
        etichetta: 'Tempo davvero tuo',
        ore: t.ore_libere,
        euro: 0,
        colore: 'var(--tdv-dato-4)',
        spiegazione: `${(t.ore_libere / 30.44).toFixed(
          1
        )} ore al giorno. Quello che resta dopo tutto il resto — ed è questa, non il salario, la misura di quanto sei libero.`
      }
    ];
  });

  const oreDelPrezzo = $derived(r ? prezzoInOre(prezzo, r.tempo.salario_orario_reale) : 0);

  const ALLOGGI = tempoData.alloggi.tipi;
  const PENDOLI = tempoData.pendolarismo.opzioni_minuti;

  const CURE: { id: ProfiloCura; label: string }[] = [
    { id: 'uomo_occupato', label: 'Poco — 1h 48m al giorno' },
    { id: 'media', label: 'La media — 3h al giorno' },
    { id: 'donna_occupata', label: 'Molto — 4h 10m al giorno' }
  ];

  const CONTRATTI: { id: TipoContratto; label: string }[] = [
    { id: 'dipendente', label: 'Dipendente' },
    { id: 'parttime', label: 'Part-time' },
    { id: 'partiva', label: 'Partita IVA' },
    { id: 'forfettario', label: 'Forfettario' },
    { id: 'dottorato', label: 'Borsa di dottorato' },
    { id: 'nero', label: 'Senza contratto' }
  ];

  // ─── azioni ───────────────────────────────────────────────────────────────
  function scegliProvincia(codice: string, nome: string) {
    s.provincia = codice;
    ricerca = '';
  }

  function cambiaSettore(id: string) {
    s.settore_id = id;
    const set = trovaSettore(id);
    if (set) {
      s.livello = set.livelli[set.livelli.length - 1].livello;
      s.ore_settimanali = set.ore_settimanali;
      if (id === 'dottorato') s.tipo_contratto = 'dottorato';
      else if (s.tipo_contratto === 'dottorato') s.tipo_contratto = 'dipendente';
    }
  }

  async function condividi() {
    if (typeof navigator === 'undefined') return;
    const url = `${window.location.origin}${window.location.pathname}?${statoInQuery(s)}`;
    try {
      await navigator.clipboard.writeText(url);
      copiato = true;
      setTimeout(() => (copiato = false), 2200);
    } catch {
      /* clipboard negata: la URL è comunque nella barra degli indirizzi */
    }
  }

  const eur = formattaEuro;
  const ore = formattaOre;
</script>

<svelte:head>
  <title>{data.meta.title}</title>
  <meta name="description" content={data.meta.description} />
  <meta property="og:title" content={data.meta.title} />
  <meta property="og:description" content={data.meta.description} />
  <meta property="og:image" content={data.meta.ogImageUrl} />
  <meta property="og:type" content="website" />
  <meta property="og:url" content={data.meta.canonical} />
  <link rel="canonical" href={data.meta.canonical} />
  <meta name="twitter:card" content="summary_large_image" />
</svelte:head>

<!-- ══ MANIFESTO ══════════════════════════════════════════════════════════ -->
<section class="hero">
  <p class="occhiello"><span class="tdv-triangle"></span> Strumento di conteggio</p>
  <h1>
    Il salario si misura in euro.<br />
    <em>La vita si misura in ore.</em>
  </h1>
  <p class="sommario">
    Questo non è un calcolatore di stipendio. Converte quello che guadagni in
    <strong>ore della tua vita</strong>: quante ne servono per pagare l'affitto, quante
    restano a chi ti paga, quante restano a te. Fonti pubbliche, calcolo aperto,
    nessun dato raccolto.
  </p>
</section>

<!-- ══ CALCOLATORE ════════════════════════════════════════════════════════ -->
<section class="calcolatore" id="calcola">
  <div class="tdv-section-label">Le tue coordinate</div>

  <div class="campi">
    <!-- dove -->
    <div class="campo">
      <label for="q-prov">Dove vivi</label>
      <div class="ricerca">
        <input
          id="q-prov"
          class="tdv-input"
          type="search"
          autocomplete="off"
          placeholder={provincia ? `${provincia.nome} (${provincia.codice})` : 'Cerca la provincia'}
          bind:value={ricerca}
        />
        {#if provinceFiltrate.length}
          <ul class="suggerimenti">
            {#each provinceFiltrate as p (p.codice)}
              <li>
                <button type="button" onclick={() => scegliProvincia(p.codice, p.nome)}>
                  <span>{p.nome}</span>
                  <span class="hint">{eurMqPeriferia(p).toFixed(1)} €/m² · {p.tipo_comune}</span>
                </button>
              </li>
            {/each}
          </ul>
        {/if}
      </div>
    </div>

    <!-- come vivi -->
    <div class="campo">
      <label for="alloggio">Come vivi</label>
      <select id="alloggio" class="tdv-select" bind:value={s.alloggio}>
        {#each ALLOGGI as a (a.id)}
          <option value={a.id}>{a.nome}</option>
        {/each}
      </select>
    </div>

    <!-- contratto -->
    <div class="campo">
      <label for="contratto">Che contratto hai</label>
      <select id="contratto" class="tdv-select" bind:value={s.tipo_contratto}>
        {#each CONTRATTI as c (c.id)}
          <option value={c.id}>{c.label}</option>
        {/each}
      </select>
    </div>
  </div>

  <!-- reddito: tabella CCNL oppure il proprio -->
  <div class="modo">
    <button
      type="button"
      class="tab"
      class:on={s.modo === 'ccnl'}
      onclick={() => (s.modo = 'ccnl')}>Vado a contratto</button
    >
    <button
      type="button"
      class="tab"
      class:on={s.modo === 'mio'}
      onclick={() => (s.modo = 'mio')}>Conosco il mio lordo</button
    >
  </div>

  {#if s.modo === 'ccnl'}
    <div class="campi">
      <div class="campo">
        <label for="settore">Settore</label>
        <select
          id="settore"
          class="tdv-select"
          value={s.settore_id}
          onchange={(e) => cambiaSettore(e.currentTarget.value)}
        >
          {#each SETTORI as set (set.id)}
            <option value={set.id}>{set.nome}</option>
          {/each}
        </select>
      </div>
      <div class="campo">
        <label for="livello">Livello</label>
        <select id="livello" class="tdv-select" bind:value={s.livello}>
          {#each settore?.livelli ?? [] as l (l.livello)}
            <option value={l.livello}>{l.descrizione}</option>
          {/each}
        </select>
      </div>
      <div class="campo">
        <div class="lettura">
          <span class="lettura-n">{eur(lordoMensileCcnl(s.settore_id, s.livello))} €</span>
          <span class="lettura-l">
            minimo lordo/mese · {settore?.mensilita} mensilità
            {#if settore?.livelli.find((l) => l.livello === s.livello)?.verifica === 'stima'}
              <span class="avviso">stima</span>
            {/if}
          </span>
        </div>
      </div>
    </div>
    {#if settore}
      <p class="nota-fonte">
        {settore.sigla_ccnl} · {settore.composizione} ·
        <a href={settore.url} target="_blank" rel="noopener noreferrer">fonte ↗</a>
      </p>
    {/if}
  {:else}
    <div class="campi">
      <div class="campo">
        <label for="lordo">Lordo mensile in busta (€)</label>
        <input id="lordo" class="tdv-input" type="number" min="0" step="10" bind:value={s.lordo_mensile} />
      </div>
      <div class="campo">
        <label for="mensilita">Mensilità</label>
        <select id="mensilita" class="tdv-select" bind:value={s.mensilita}>
          <option value={12}>12</option>
          <option value={13}>13 — con tredicesima</option>
          <option value={14}>14 — con tredicesima e quattordicesima</option>
        </select>
      </div>
      <div class="campo">
        <label for="settore-m">Settore (serve per il valore aggiunto)</label>
        <select id="settore-m" class="tdv-select" value={s.settore_id} onchange={(e) => (s.settore_id = e.currentTarget.value)}>
          {#each SETTORI as set (set.id)}
            <option value={set.id}>{set.nome}</option>
          {/each}
        </select>
      </div>
    </div>
    <p class="nota-fonte">
      Prendi il lordo dalla busta paga: è più preciso di qualunque minimo tabellare.
      Se hai solo il netto, il conto non torna all'indietro in modo univoco — meglio il lordo.
    </p>
  {/if}

  <!-- tempo -->
  <div class="tdv-section-label" style="margin-top:28px">Il tuo tempo</div>
  <div class="campi">
    <div class="campo">
      <label for="ore">Ore a settimana da contratto</label>
      <input id="ore" class="tdv-input" type="number" min="1" max="80" bind:value={s.ore_settimanali} />
    </div>
    <div class="campo">
      <label for="pendo">Casa-lavoro, andata e ritorno</label>
      <select id="pendo" class="tdv-select" bind:value={s.minuti_pendolarismo}>
        {#each PENDOLI as m (m)}
          <option value={m}>{m === 0 ? 'Lavoro da casa' : `${m} minuti al giorno`}</option>
        {/each}
      </select>
    </div>
    <div class="campo">
      <label for="strao">Straordinario non pagato, a settimana</label>
      <input id="strao" class="tdv-input" type="number" min="0" max="40" bind:value={s.ore_straordinario} />
    </div>
    <div class="campo">
      <label for="cura">Quanto lavoro domestico e di cura fai</label>
      <select id="cura" class="tdv-select" bind:value={s.profilo_cura}>
        {#each CURE as c (c.id)}
          <option value={c.id}>{c.label}</option>
        {/each}
      </select>
    </div>
    {#if s.minuti_pendolarismo > 0}
      <div class="campo">
        <span class="label-finto">Come ti sposti</span>
        <div class="scelte">
          <button type="button" class="scelta" class:on={!s.usa_auto} onclick={() => (s.usa_auto = false)}>Mezzi</button>
          <button type="button" class="scelta" class:on={s.usa_auto} onclick={() => (s.usa_auto = true)}>Auto</button>
        </div>
      </div>
    {/if}
    <div class="campo">
      <label for="pasti">Pasti fuori per lavoro, a settimana</label>
      <input id="pasti" class="tdv-input" type="number" min="0" max="14" bind:value={s.pasti_fuori} />
    </div>
  </div>
</section>

{#if r && provincia}
  <!-- ══ IL NUMERO ═══════════════════════════════════════════════════════ -->
  <section class="verdetto">
    <div class="tdv-section-label">Il tuo salario orario reale</div>
    <div class="verdetto-griglia">
      <div class="grande">
        <div class="grande-n">
          <Numero valore={r.tempo.salario_orario_reale} decimali={2} suffisso=" €" />
        </div>
        <div class="grande-l">per ogni ora che il lavoro ti prende</div>
        <p class="grande-nota">
          In busta sembrano <strong>{r.tempo.salario_orario_nominale.toFixed(2)} €/h</strong>.
          Ma togliendo {ore(r.tempo.ore_pendolarismo + r.tempo.ore_straordinario)} al mese di
          tragitto e straordinario non pagato, e i {eur(r.tempo.costi_del_lavoro_mese)} € che
          spendi per andare a lavorare, quello che ti resta per ogni ora sottratta è
          <strong>il {Math.round(r.tempo.scarto_orario * 100)}% in meno</strong>.
        </p>
      </div>

      <div class="cifre">
        <div class="cifra">
          <span class="cifra-n"><Numero valore={r.fisco.netto_in_busta} suffisso=" €" /></span>
          <span class="cifra-l">netto in busta, {r.fisco.mensilita} mensilità</span>
        </div>
        <div class="cifra">
          <span class="cifra-n"><Numero valore={r.fisco.netto_mensile} suffisso=" €" /></span>
          <span class="cifra-l">reddito medio al mese, 13ª e 14ª spalmate</span>
        </div>
        <div class="cifra">
          <span class="cifra-n rosso"><Numero valore={r.sopravvivenza.ore_sopravvivenza} suffisso=" h" /></span>
          <span class="cifra-l">ogni mese solo per i costi fissi</span>
        </div>
        <div class="cifra">
          <span class="cifra-n" class:verde={!r.sopravvivenza.in_rosso} class:rosso={r.sopravvivenza.in_rosso}>
            <Numero valore={r.sopravvivenza.residuo} suffisso=" €" />
          </span>
          <span class="cifra-l">ti restano, dopo tutto il necessario</span>
        </div>
      </div>
    </div>

    {#if r.sopravvivenza.in_rosso}
      <p class="allarme">
        I costi fissi superano quello che ti resta dopo aver pagato per andare a lavorare.
        Servirebbero <strong>{ore(r.sopravvivenza.ore_sopravvivenza)}</strong> al mese, e tu ne hai
        {ore(r.tempo.ore_sottratte)}. Non è una questione di come gestisci i soldi: con questo
        stipendio, in questa città, in questo tipo di casa, il conto non chiude.
      </p>
    {/if}
    {#if r.sopravvivenza.sotto_soglia_istat}
      <p class="allarme">
        Il tuo reddito mensile è sotto la <strong>soglia di povertà assoluta ISTAT</strong> per la
        tua zona ({eur(r.sopravvivenza.soglia_istat)} €). È la linea sotto la quale lo Stato
        italiano dichiara che una persona è povera — e tu stai lavorando.
      </p>
    {/if}

    <p class="margine">
      Tutti i numeri hanno un margine dichiarato di ±{Math.round(r.fisco.margine_errore * 100)}%.
      Non è consulenza fiscale: è un ordine di grandezza verificabile.
    </p>
  </section>

  <!-- ══ L'ORA ═══════════════════════════════════════════════════════════ -->
  <section class="blocco">
    <Barra
      titolo="Dove va il valore che produci in un mese di lavoro"
      fette={fetteOra}
      totale={r.tempo.ore_retribuite}
      unita="ore"
    />
    <p class="chiosa">
      {#if r.valore.settore_pubblico}
        Nel settore pubblico la fetta del profitto è posta a zero: non c'è un'impresa che
        trattiene un margine. Resta tutto il resto.
      {:else}
        Su {ore(r.tempo.ore_retribuite)} di lavoro pagato,
        <strong>{ore(r.valore.profitto.ore)}</strong> producono valore che non torna a te in
        nessuna forma. Non è un'accusa a nessuno in particolare: è la quota del valore aggiunto
        che nel tuo settore non va al lavoro dipendente, secondo i conti economici ISTAT.
      {/if}
    </p>
  </section>

  <!-- ══ IL MESE ═════════════════════════════════════════════════════════ -->
  <section class="blocco">
    <Barra
      titolo="Come è fatto il tuo mese — 730 ore"
      fette={fetteMese}
      totale={r.tempo.ore_totali_mese}
      unita="ore"
    />
    <p class="chiosa">
      Il tempo libero non è quello che avanza dalle ore di ufficio. È quello che avanza dopo
      il tragitto, la spesa, la lavatrice e la cena: <strong>{ore(r.tempo.ore_libere)}</strong>
      al mese, {(r.tempo.ore_libere / 30.44).toFixed(1)} ore al giorno.
      {#if s.profilo_cura !== 'donna_occupata'}
        Se ti occupassi della casa quanto se ne occupa in media una donna occupata, ne avresti
        {Math.round((tempoData.lavoro_familiare.profili.donna_occupata.ore_giorno - tempoData.lavoro_familiare.profili[s.profilo_cura].ore_giorno) * 30.44)}
        in meno.
      {/if}
    </p>
  </section>

  <!-- ══ I COSTI ═════════════════════════════════════════════════════════ -->
  <section class="blocco">
    <div class="tdv-section-label">Quanto costa esistere a {provincia.nome}</div>
    <ul class="costi">
      <li>
        <span class="costi-v">{eur(r.sopravvivenza.affitto)} €</span>
        <span class="costi-l">
          affitto — {r.sopravvivenza.affitto_mq} m² a {eurMqPeriferia(provincia).toFixed(1)} €/m²
          {#if r.sopravvivenza.affitto_persone > 1}, diviso {r.sopravvivenza.affitto_persone}{/if}
          <span class="provenienza" class:stimato={provincia.fonte_dato === 'calibrato'}>
            {provincia.fonte_dato === 'calibrato' ? 'stimato' : 'rilevato'}
          </span>
        </span>
        <span class="costi-o">{ore(r.sopravvivenza.affitto / r.tempo.salario_orario_reale)}</span>
      </li>
      <li>
        <span class="costi-v">{eur(r.sopravvivenza.paniere_essenziale)} €</span>
        <span class="costi-l">
          cibo, trasporti, salute, igiene, vestiario — parte non abitativa del paniere ISTAT
        </span>
        <span class="costi-o">{ore(r.sopravvivenza.paniere_essenziale / r.tempo.salario_orario_reale)}</span>
      </li>
      <li class="totale">
        <span class="costi-v">{eur(r.sopravvivenza.costi_fissi)} €</span>
        <span class="costi-l">totale del minimo indispensabile</span>
        <span class="costi-o">{ore(r.sopravvivenza.ore_sopravvivenza)}</span>
      </li>
      <li class="fuori">
        <span class="costi-v">{eur(r.tempo.costi_del_lavoro_mese)} €</span>
        <span class="costi-l">
          andare a lavorare — abbonamento o benzina, pasti fuori.
          <em>Già tolti prima del conto</em>: sono il motivo per cui il tuo salario orario
          reale è più basso di quello in busta, quindi non si sommano qui.
        </span>
        <span class="costi-o">—</span>
      </li>
    </ul>
    {#if provincia.fonte_dato === 'calibrato'}
      <p class="nota-dato">
        Per {provincia.nome} non esiste una rilevazione pubblica del canone che siamo riusciti a
        verificare: questo valore è una stima riscalata sulle province della stessa ripartizione
        dove la rilevazione c'è. Prendilo come ordine di grandezza.
        {#if provincia.avvertenza_turistica}<br />{provincia.avvertenza_turistica}{/if}
      </p>
    {/if}
    <p class="chiosa">
      La soglia di povertà assoluta ISTAT per un adulto solo dalle tue parti è
      <strong>{eur(r.sopravvivenza.soglia_istat)} €</strong> al mese.
      {#if r.sopravvivenza.affitto > r.sopravvivenza.soglia_istat * 0.38}
        Il solo affitto di mercato si mangia più della componente abitativa che ISTAT mette
        in quella soglia: è lì che il conto salta.
      {/if}
    </p>
  </section>

  <!-- ══ IL PREZZO IN ORE ════════════════════════════════════════════════ -->
  <section class="blocco convertitore">
    <div class="tdv-section-label">Quanto costa in ore della tua vita</div>
    <div class="conv-riga">
      <input
        class="tdv-input conv-input"
        type="number"
        min="0"
        step="10"
        bind:value={prezzo}
        aria-label="Prezzo in euro"
      />
      <span class="conv-eq">costano</span>
      <span class="conv-out"><Numero valore={oreDelPrezzo} decimali={1} suffisso=" ore" /></span>
    </div>
    <div class="conv-scorciatoie">
      {#each [50, 100, 300, 800, 2000] as p (p)}
        <button type="button" class="scelta" class:on={prezzo === p} onclick={() => (prezzo = p)}>
          {p} €
        </button>
      {/each}
    </div>
    <p class="chiosa">
      Al salario orario <em>reale</em>, non a quello che sembra in busta. È la differenza fra
      «costa cento euro» e «costa {oreDelPrezzo.toFixed(1)} ore della mia vita, che non tornano».
    </p>
  </section>

  <!-- ══ COSA PUOI FARE ══════════════════════════════════════════════════ -->
  <Aiuti
    reddito={r.fisco.reddito_complessivo}
    tipoContratto={s.tipo_contratto}
    bind:situazione
  />

  <!-- ══ CONDIVIDI ═══════════════════════════════════════════════════════ -->
  <section class="blocco azioni">
    <button type="button" class="tdv-btn-primary" onclick={condividi}>
      {copiato ? 'Link copiato' : 'Copia il link di questo calcolo'}
    </button>
    <p class="chiosa piccola">
      Il link contiene solo le tue scelte — città, contratto, tipo di casa — mai i numeri
      calcolati e mai nulla che ti identifichi.
    </p>
  </section>

  <!-- ══ METODO ══════════════════════════════════════════════════════════ -->
  <Metodo risultato={r} settore={settore} {provincia} />
{:else}
  <section class="blocco">
    <p class="chiosa">Scegli una provincia e un inquadramento per vedere il calcolo.</p>
  </section>
{/if}

<style>
  /* ── manifesto ────────────────────────────────────────────────────────── */
  .hero {
    padding: 56px 32px 40px;
    max-width: 900px;
  }
  .occhiello {
    font-size: 9px;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--tdv-red);
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 24px;
  }
  .hero h1 {
    font-family: var(--tdv-serif);
    font-size: clamp(32px, 6vw, 62px);
    line-height: 1.08;
    font-weight: 700;
    letter-spacing: -0.01em;
  }
  .hero h1 em {
    color: var(--tdv-red);
    font-style: italic;
  }
  .sommario {
    margin-top: 24px;
    font-size: 14px;
    line-height: 1.8;
    color: var(--tdv-ink2);
    max-width: 62ch;
  }
  .sommario strong {
    color: var(--tdv-ink);
  }

  /* ── calcolatore ──────────────────────────────────────────────────────── */
  .calcolatore {
    padding: 32px;
    border-top: 1px solid var(--tdv-border);
    border-bottom: 1px solid var(--tdv-border);
    background: var(--tdv-paper-2);
  }
  .campi {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
    gap: 18px 24px;
  }
  .campo {
    display: flex;
    flex-direction: column;
    gap: 7px;
    min-width: 0;
  }
  .campo label,
  .label-finto {
    font-size: 9px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--tdv-ink3);
  }

  .ricerca {
    position: relative;
  }
  .suggerimenti {
    position: absolute;
    z-index: 20;
    top: 100%;
    left: 0;
    right: 0;
    list-style: none;
    margin: 2px 0 0;
    padding: 0;
    background: var(--tdv-bg);
    border: 1px solid var(--tdv-border);
    max-height: 260px;
    overflow-y: auto;
    animation: tdv-appari var(--tdv-fast) var(--tdv-ease);
  }
  .suggerimenti button {
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 12px;
    background: none;
    border: none;
    border-bottom: 1px solid var(--tdv-border2);
    padding: 9px 12px;
    text-align: left;
    cursor: pointer;
    font-size: 12px;
    color: var(--tdv-ink);
  }
  .suggerimenti button:hover,
  .suggerimenti button:focus-visible {
    background: var(--tdv-red-dim);
    color: var(--tdv-red);
  }
  .hint {
    font-size: 10px;
    color: var(--tdv-ink3);
    white-space: nowrap;
  }

  .modo {
    display: flex;
    gap: 0;
    margin: 26px 0 18px;
    border-bottom: 1px solid var(--tdv-border);
  }
  .tab {
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
    padding: 9px 16px;
    font-size: 10px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--tdv-ink3);
    cursor: pointer;
    transition: color var(--tdv-fast) var(--tdv-ease),
      border-color var(--tdv-fast) var(--tdv-ease);
  }
  .tab.on {
    color: var(--tdv-red);
    border-bottom-color: var(--tdv-red);
  }

  .lettura {
    display: flex;
    flex-direction: column;
    gap: 3px;
    padding-top: 22px;
  }
  .lettura-n {
    font-family: var(--tdv-serif);
    font-style: italic;
    font-size: 26px;
    line-height: 1;
  }
  .lettura-l {
    font-size: 10px;
    color: var(--tdv-ink3);
  }
  .avviso {
    color: var(--tdv-dato-3);
    border: 1px solid currentColor;
    padding: 0 4px;
    margin-left: 4px;
    font-size: 9px;
    text-transform: uppercase;
  }

  .scelte {
    display: flex;
    gap: 6px;
  }
  .scelta {
    background: none;
    border: 1px solid var(--tdv-border);
    color: var(--tdv-ink2);
    padding: 9px 14px;
    font-size: 11px;
    cursor: pointer;
    transition: all var(--tdv-fast) var(--tdv-ease);
  }
  .scelta.on {
    border-color: var(--tdv-red);
    color: var(--tdv-red);
    background: var(--tdv-red-dim);
  }

  .nota-fonte {
    margin-top: 14px;
    font-size: 10px;
    line-height: 1.7;
    color: var(--tdv-ink3);
  }

  /* ── verdetto ─────────────────────────────────────────────────────────── */
  .verdetto {
    padding: 44px 32px;
    animation: tdv-sali var(--tdv-mid) var(--tdv-ease) both;
  }
  .verdetto-griglia {
    display: grid;
    grid-template-columns: minmax(280px, 1.1fr) minmax(280px, 1fr);
    gap: 36px 48px;
    align-items: start;
  }
  .grande-n {
    font-family: var(--tdv-serif);
    font-style: italic;
    font-weight: 700;
    font-size: clamp(52px, 11vw, 96px);
    line-height: 0.95;
    color: var(--tdv-red);
  }
  .grande-l {
    font-size: 11px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--tdv-ink3);
    margin-top: 10px;
  }
  .grande-nota {
    margin-top: 20px;
    font-size: 12px;
    line-height: 1.8;
    color: var(--tdv-ink2);
    max-width: 48ch;
  }
  .grande-nota strong {
    color: var(--tdv-ink);
  }

  .cifre {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 22px 20px;
  }
  .cifra {
    display: flex;
    flex-direction: column;
    gap: 5px;
    padding-left: 12px;
    border-left: 2px solid var(--tdv-border);
  }
  .cifra-n {
    font-family: var(--tdv-serif);
    font-style: italic;
    font-weight: 700;
    font-size: 27px;
    line-height: 1;
  }
  .cifra-n.rosso {
    color: var(--tdv-dato-1);
  }
  .cifra-n.verde {
    color: var(--tdv-dato-4);
  }
  .cifra-l {
    font-size: 10px;
    line-height: 1.5;
    color: var(--tdv-ink3);
  }

  .allarme {
    margin-top: 30px;
    padding: 16px 20px;
    border-left: 2px solid var(--tdv-red);
    background: var(--tdv-red-dim);
    font-size: 12px;
    line-height: 1.8;
    color: var(--tdv-ink);
    max-width: 78ch;
  }
  .margine {
    margin-top: 24px;
    font-size: 10px;
    color: var(--tdv-ink3);
  }

  /* ── blocchi ──────────────────────────────────────────────────────────── */
  .blocco {
    padding: 36px 32px;
    border-top: 1px solid var(--tdv-border);
  }
  .chiosa {
    margin-top: 22px;
    font-size: 12px;
    line-height: 1.9;
    color: var(--tdv-ink2);
    max-width: 74ch;
  }
  .chiosa strong {
    color: var(--tdv-ink);
  }
  .chiosa.piccola {
    font-size: 10px;
    margin-top: 14px;
  }

  /* ── costi ────────────────────────────────────────────────────────────── */
  .costi {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .costi li {
    display: grid;
    grid-template-columns: 100px 1fr 90px;
    gap: 16px;
    align-items: baseline;
    padding: 13px 0;
    border-bottom: 1px solid var(--tdv-border2);
  }
  .costi li.totale {
    border-bottom: none;
    border-top: 1px solid var(--tdv-border);
    margin-top: 4px;
  }
  .costi li.fuori {
    border-bottom: none;
    opacity: 0.75;
  }
  .costi li.fuori .costi-v {
    font-size: 16px;
    color: var(--tdv-ink3);
  }
  .provenienza {
    display: inline-block;
    margin-left: 6px;
    padding: 1px 5px;
    border: 1px solid var(--tdv-dato-4);
    color: var(--tdv-dato-4);
    font-size: 9px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .provenienza.stimato {
    border-color: var(--tdv-dato-3);
    color: var(--tdv-dato-3);
  }
  .nota-dato {
    margin-top: 18px;
    padding-left: 12px;
    border-left: 2px solid var(--tdv-dato-3);
    font-size: 11px;
    line-height: 1.8;
    color: var(--tdv-ink2);
    max-width: 74ch;
  }
  .costi-l em {
    color: var(--tdv-ink2);
    font-style: normal;
    border-bottom: 1px solid var(--tdv-border);
  }
  .costi-v {
    font-family: var(--tdv-serif);
    font-style: italic;
    font-size: 20px;
    font-variant-numeric: tabular-nums;
  }
  .costi li.totale .costi-v {
    color: var(--tdv-red);
  }
  .costi-l {
    font-size: 11px;
    line-height: 1.6;
    color: var(--tdv-ink2);
  }
  .costi-o {
    font-size: 13px;
    text-align: right;
    color: var(--tdv-ink3);
    font-variant-numeric: tabular-nums;
  }

  /* ── convertitore ─────────────────────────────────────────────────────── */
  .conv-riga {
    display: flex;
    align-items: center;
    gap: 16px;
    flex-wrap: wrap;
  }
  .conv-input {
    width: 140px;
    font-size: 20px;
  }
  .conv-eq {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--tdv-ink3);
  }
  .conv-out {
    font-family: var(--tdv-serif);
    font-style: italic;
    font-weight: 700;
    font-size: 38px;
    color: var(--tdv-red);
  }
  .conv-scorciatoie {
    display: flex;
    gap: 8px;
    margin-top: 16px;
    flex-wrap: wrap;
  }

  .azioni {
    max-width: 520px;
  }

  /* ── mobile ───────────────────────────────────────────────────────────── */
  @media (max-width: 760px) {
    .hero {
      padding: 36px 20px 28px;
    }
    .calcolatore,
    .verdetto,
    .blocco {
      padding-left: 20px;
      padding-right: 20px;
    }
    .verdetto-griglia {
      grid-template-columns: 1fr;
    }
    .costi li {
      grid-template-columns: 90px 1fr;
    }
    .costi-o {
      grid-column: 2;
      text-align: left;
    }
  }
</style>
