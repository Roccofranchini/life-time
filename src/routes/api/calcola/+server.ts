// src/routes/api/calcola/+server.ts
// POST /api/calcola
// Body: { lordo_annuo, tipo_contratto, percentuale_parttime?, regione, comune }
// Ritorna: FiscalOutput (JSON).
//
// Privacy:
//   - nessun log del body né della response
//   - nessuna persistenza: è una pure function server-side
//   - nessun cookie, nessun header tracciante

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { calcola_netto } from '$lib/engine/fiscal';
import { validaFiscalInput } from '$lib/server/validation';

export const POST: RequestHandler = async ({ request }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    error(400, 'Body non è JSON valido');
  }

  const v = validaFiscalInput(body);
  if (!v.ok || !v.value) error(400, v.error ?? 'Input non valido');

  const out = calcola_netto(v.value);

  return json(out, {
    headers: {
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff'
    }
  });
};
