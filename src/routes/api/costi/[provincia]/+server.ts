// src/routes/api/costi/[provincia]/+server.ts
// GET /api/costi/:provincia
// Ritorna: CostiVita (JSON).
//
// Ordine delle fonti:
//   1. cache Supabase (TTL 7 giorni)  →  se completa e fresca, la usa
//   2. fallback statico (src/lib/server/costi-fallback.ts)
//
// Il fetch dalle fonti pubbliche (OMI, ISTAT, Mimit) è affidato alla pipeline
// Python (Fase 6). Questo endpoint NON chiama endpoint esterni a runtime:
// tenere un endpoint di lettura pubblico senza auth e senza rate limit che
// scatena HTTP out-bound è una superficie d'abuso da evitare.

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSupabaseServer } from '$lib/server/supabase';
import { leggiCache, TTL_GIORNI } from '$lib/server/costi-cache';
import { costiFallback, FALLBACK_FONTE } from '$lib/server/costi-fallback';
import { validaProvincia } from '$lib/server/validation';
import type { CostiVita } from '$lib/types';

export const GET: RequestHandler = async ({ params, setHeaders }) => {
  const v = validaProvincia(params.provincia);
  if (!v.ok || !v.value) error(400, v.error ?? 'Provincia non valida');
  const provincia = v.value;

  let costi: CostiVita | null = null;
  let fonte = FALLBACK_FONTE;

  const supabase = getSupabaseServer();
  if (supabase) {
    try {
      costi = await leggiCache(supabase, provincia);
      if (costi) fonte = 'cache_supabase';
    } catch {
      // Errore di rete/DB: degrada silenziosamente al fallback.
      costi = null;
    }
  }

  if (!costi) costi = costiFallback(provincia);

  setHeaders({
    // i costi cambiano al massimo ogni mese: 1 giorno di cache edge è sicuro
    'cache-control': 'public, max-age=86400, stale-while-revalidate=604800',
    'x-content-type-options': 'nosniff'
  });

  return json({ ...costi, fonte, ttl_giorni: TTL_GIORNI });
};
