// src/lib/server/costi-cache.ts
// Layer di cache Supabase per i costi della vita.
// TTL 7 giorni (ARCHITECTURE.md): oltre questa soglia i record vanno
// considerati scaduti e la pipeline di scraping deve rinfrescarli.
//
// Schema tabella: costi_vita(provincia, voce, valore, fonte, aggiornato).
// Questo modulo NON effettua fetch dalle fonti pubbliche — è compito della
// pipeline Python (Fase 6). Qui leggiamo solo la cache; se è vuota/scaduta
// si ricade sul fallback statico.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { CostiVita } from '$lib/types';

export const TTL_GIORNI = 7;
export const TTL_MS = TTL_GIORNI * 24 * 60 * 60 * 1000;

type VoceCosto =
  | 'affitto_bilocale_periferia'
  | 'spesa_alimentare_minima'
  | 'carburante_benzina_litro'
  | 'bollette_stimate';

const VOCI_RICHIESTE: VoceCosto[] = [
  'affitto_bilocale_periferia',
  'spesa_alimentare_minima',
  'carburante_benzina_litro',
  'bollette_stimate'
];

interface RigaCache {
  voce: VoceCosto;
  valore: number;
  aggiornato: string;
}

/**
 * Legge tutti i record di una provincia, restituisce un CostiVita completo
 * solo se tutte le 4 voci sono presenti E freschi (< TTL).
 * Altrimenti ritorna null — chi chiama userà il fallback statico.
 */
export async function leggiCache(
  supabase: SupabaseClient,
  provincia: string
): Promise<CostiVita | null> {
  const sogliaIso = new Date(Date.now() - TTL_MS).toISOString();

  const { data, error } = await supabase
    .from('costi_vita')
    .select('voce, valore, aggiornato')
    .eq('provincia', provincia)
    .gte('aggiornato', sogliaIso);

  if (error || !data) return null;

  const righe = data as RigaCache[];
  const mappa = new Map<VoceCosto, RigaCache>(righe.map((r) => [r.voce, r]));
  for (const voce of VOCI_RICHIESTE) if (!mappa.has(voce)) return null;

  const piuVecchia = righe.reduce(
    (acc, r) => (r.aggiornato < acc ? r.aggiornato : acc),
    righe[0].aggiornato
  );

  return {
    provincia,
    affitto_bilocale_periferia: Number(mappa.get('affitto_bilocale_periferia')!.valore),
    spesa_alimentare_minima: Number(mappa.get('spesa_alimentare_minima')!.valore),
    carburante_benzina_litro: Number(mappa.get('carburante_benzina_litro')!.valore),
    bollette_stimate: Number(mappa.get('bollette_stimate')!.valore),
    aggiornato: piuVecchia
  };
}

/**
 * Scrive le 4 voci di una provincia in cache (upsert).
 * Chiamato dalla pipeline dati dopo un fetch riuscito.
 */
export async function scriviCache(
  supabase: SupabaseClient,
  costi: CostiVita,
  fonte: string
): Promise<void> {
  const now = new Date().toISOString();
  const righe = VOCI_RICHIESTE.map((voce) => ({
    provincia: costi.provincia,
    voce,
    valore: costi[voce],
    fonte,
    aggiornato: now
  }));
  await supabase.from('costi_vita').upsert(righe, { onConflict: 'provincia,voce' });
}
