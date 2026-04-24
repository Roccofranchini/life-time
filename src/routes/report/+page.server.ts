// src/routes/report/+page.server.ts
// Server load per il report: se la URL contiene i parametri di share
// (?p=BO&s=commercio-4&c=indeterminato[&pt=60]) ricalcoliamo tutto server-side.
// Questo serve a:
//   - link condivisibili funzionanti senza aver compilato il wizard
//   - meta tag OG (title/description) corretti per il preview social
//   - SSR del report (first paint, accessibilità)
//
// Se i parametri mancano o non sono validi ritorniamo { fromUrl: false }
// e la pagina userà i dati dagli store (flusso wizard).
//
// Privacy: i parametri di URL sono SELEZIONI (provincia, settore, contratto),
// MAI numeri calcolati. Nessun dato personale circola via URL.

import type { PageServerLoad } from './$types';
import type {
  CostiVita,
  CtaData,
  CtaEntry,
  FiscalOutput,
  ProfiloUtente,
  SurvivalOutput,
  TimeBreakdown,
  TipoContratto
} from '$lib/types';
import {
  calcola_netto,
  calcola_sopravvivenza,
  calcola_breakdown_temporale
} from '$lib/engine';
import ccnlData from '$lib/data/ccnl.json';
import provinceData from '$lib/data/province.json';
import ctaData from '$lib/data/cta.json';
import { getSupabaseServer } from '$lib/server/supabase';
import { leggiCache } from '$lib/server/costi-cache';
import { costiFallback } from '$lib/server/costi-fallback';
import type { CcnlData } from '$lib/types';

// Consumo medio mensile benzina stimato (litri). Convenzione editoriale:
// 400km/mese × 10km/L ≈ 40L, conservativo per chi usa mezzi urbani.
const CONSUMO_BENZINA_LITRI_MESE = 40;

// 40h/settimana × 52 settimane / 12 mesi ≈ 173.33
const ORE_LAVORO_MENSILI_FULLTIME = (40 * 52) / 12;

interface ProvinciaEntry {
  codice: string;
  nome: string;
  regione: string;
  capoluogo: boolean;
}

const TIPI_CONTRATTO_VALIDI: readonly TipoContratto[] = [
  'indeterminato',
  'parttime',
  'partiva'
];

const VUOTO = { fromUrl: false as const };

export const load: PageServerLoad = async ({ url, setHeaders }) => {
  // edge safety: nessun cookie, nessun log
  setHeaders({
    'cache-control': 'private, max-age=0, must-revalidate',
    'x-content-type-options': 'nosniff'
  });

  const p = url.searchParams.get('p');
  const s = url.searchParams.get('s');
  const c = url.searchParams.get('c');
  const pt = url.searchParams.get('pt');

  if (!p || !s || !c) return VUOTO;

  const matchS = /^([a-z-]+)-(\d+)$/.exec(s);
  if (!matchS) return VUOTO;
  const settoreId = matchS[1];
  const livelloStr = matchS[2];

  if (!TIPI_CONTRATTO_VALIDI.includes(c as TipoContratto)) return VUOTO;
  const tipoContratto = c as TipoContratto;

  let percentualePt: number | undefined;
  if (tipoContratto === 'parttime') {
    const parsed = pt ? Number.parseInt(pt, 10) : NaN;
    if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 100) return VUOTO;
    percentualePt = parsed / 100;
  }

  const province = (provinceData as { province: ProvinciaEntry[] }).province;
  const provincia = province.find((x) => x.codice === p);
  if (!provincia) return VUOTO;

  const settori = (ccnlData as unknown as CcnlData).settori;
  const settore = settori.find((x) => x.id === settoreId);
  const livello = settore?.livelli.find((l) => l.livello === livelloStr);
  if (!settore || !livello) return VUOTO;

  // ─── Lordo annuo ─────────────────────────────────────────────────
  let lordoAnnuo = livello.lordo_mensile * 13;
  if (tipoContratto === 'parttime' && percentualePt !== undefined) {
    lordoAnnuo = Math.round(lordoAnnuo * percentualePt);
  }

  // ─── Fiscale ─────────────────────────────────────────────────────
  const fiscal: FiscalOutput = calcola_netto({
    lordo_annuo: lordoAnnuo,
    tipo_contratto: tipoContratto,
    regione: provincia.regione,
    comune: provincia.nome.toLowerCase(),
    ...(percentualePt !== undefined ? { percentuale_parttime: percentualePt } : {})
  });

  // ─── Costi vita ──────────────────────────────────────────────────
  const supabase = getSupabaseServer();
  let costi: CostiVita | null = null;
  if (supabase) {
    try {
      costi = await leggiCache(supabase, provincia.codice);
    } catch {
      costi = null;
    }
  }
  if (!costi) costi = costiFallback(provincia.codice);

  // ─── Ore lavoro mensili ──────────────────────────────────────────
  const oreLavoroMensili =
    tipoContratto === 'parttime' && percentualePt !== undefined
      ? ORE_LAVORO_MENSILI_FULLTIME * percentualePt
      : ORE_LAVORO_MENSILI_FULLTIME;

  // ─── Sopravvivenza ───────────────────────────────────────────────
  const survival: SurvivalOutput = calcola_sopravvivenza({
    affitto: costi.affitto_bilocale_periferia,
    spesa_minima: costi.spesa_alimentare_minima,
    bollette: costi.bollette_stimate,
    carburante_mensile_stimato: costi.carburante_benzina_litro * CONSUMO_BENZINA_LITRI_MESE,
    netto_mensile: fiscal.netto_mensile,
    ore_lavoro_mensili: oreLavoroMensili
  });

  // ─── Breakdown temporale ─────────────────────────────────────────
  const breakdown: TimeBreakdown = calcola_breakdown_temporale({
    survival,
    fiscal,
    lordo_annuo: lordoAnnuo,
    ore_lavoro_mensili: oreLavoroMensili,
    settore_id: settoreId,
    affitto: costi.affitto_bilocale_periferia
  });

  // ─── Profilo ─────────────────────────────────────────────────────
  const profilo: ProfiloUtente = {
    provincia: provincia.codice,
    nome_provincia: provincia.nome,
    regione: provincia.regione,
    comune_capoluogo: provincia.nome.toLowerCase(),
    settore_id: settore.id,
    settore_nome: settore.nome,
    livello: livello.livello,
    tipo_contratto: tipoContratto,
    ...(percentualePt !== undefined ? { percentuale_parttime: percentualePt } : {}),
    ore_settimanali_contratto:
      tipoContratto === 'parttime' && percentualePt !== undefined ? 40 * percentualePt : 40
  };

  // ─── CTA filtrate ────────────────────────────────────────────────
  const entries = (ctaData as CtaData).entries;
  const cta: CtaEntry[] = entries.filter(
    (e) => e.provincia === provincia.codice || e.provincia === 'nazionale'
  );

  // ─── Meta OG ─────────────────────────────────────────────────────
  const titolo = `${provincia.nome}: ${breakdown.giorni_affitto} giorni/mese per l'affitto`;
  const descrizione = `Netto mensile stimato ${Math.round(fiscal.netto_mensile).toLocaleString(
    'it-IT'
  )}€ · ±3% · Dati pubblici · nessun tracciamento.`;

  return {
    fromUrl: true as const,
    profilo,
    fiscal,
    costi,
    survival,
    breakdown,
    cta,
    meta: { title: titolo, description: descrizione }
  };
};
