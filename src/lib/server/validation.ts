// src/lib/server/validation.ts
// Validatori puri per gli endpoint API. Nessun side effect, nessun log.
// La separazione permette unit-test senza la machinery di SvelteKit.

import type { FiscalInput, TipoContratto } from '$lib/types';

const TIPI_CONTRATTO: readonly TipoContratto[] = ['indeterminato', 'parttime', 'partiva'];

export interface ValidationResult<T> {
  ok: boolean;
  value?: T;
  error?: string;
}

function isFiniteNumber(x: unknown): x is number {
  return typeof x === 'number' && Number.isFinite(x);
}

function isNonEmptyString(x: unknown): x is string {
  return typeof x === 'string' && x.trim().length > 0;
}

/**
 * Valida il body di POST /api/calcola.
 * Rifiuta payload con chiavi inattese (strict): riduce la superficie d'attacco
 * e impedisce all'utente di iniettare campi tipo "email" per sbaglio.
 */
export function validaFiscalInput(body: unknown): ValidationResult<FiscalInput> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: 'Body deve essere un oggetto JSON' };
  }
  const b = body as Record<string, unknown>;

  const CHIAVI_AMMESSE = new Set([
    'lordo_annuo',
    'tipo_contratto',
    'percentuale_parttime',
    'regione',
    'comune'
  ]);
  for (const k of Object.keys(b)) {
    if (!CHIAVI_AMMESSE.has(k)) {
      return { ok: false, error: `Campo non ammesso: ${k}` };
    }
  }

  if (!isFiniteNumber(b.lordo_annuo) || b.lordo_annuo < 0 || b.lordo_annuo > 10_000_000) {
    return { ok: false, error: 'lordo_annuo deve essere un numero tra 0 e 10.000.000' };
  }
  if (!isNonEmptyString(b.tipo_contratto) || !TIPI_CONTRATTO.includes(b.tipo_contratto as TipoContratto)) {
    return { ok: false, error: `tipo_contratto deve essere uno di: ${TIPI_CONTRATTO.join(', ')}` };
  }
  if (!isNonEmptyString(b.regione)) {
    return { ok: false, error: 'regione è obbligatoria' };
  }
  if (!isNonEmptyString(b.comune)) {
    return { ok: false, error: 'comune è obbligatorio' };
  }
  if (b.percentuale_parttime !== undefined) {
    if (!isFiniteNumber(b.percentuale_parttime) || b.percentuale_parttime <= 0 || b.percentuale_parttime > 1) {
      return { ok: false, error: 'percentuale_parttime deve essere in (0, 1]' };
    }
  }

  return {
    ok: true,
    value: {
      lordo_annuo: b.lordo_annuo,
      tipo_contratto: b.tipo_contratto as TipoContratto,
      regione: b.regione,
      comune: b.comune,
      ...(b.percentuale_parttime !== undefined
        ? { percentuale_parttime: b.percentuale_parttime as number }
        : {})
    }
  };
}

/**
 * Valida il path parameter `provincia` di GET /api/costi/[provincia].
 * Accetta solo codici ISTAT a 2 caratteri alfabetici.
 */
export function validaProvincia(raw: string | undefined): ValidationResult<string> {
  if (!raw) return { ok: false, error: 'provincia mancante' };
  const norm = raw.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(norm)) {
    return { ok: false, error: 'provincia deve essere un codice ISTAT di 2 lettere (es. BO)' };
  }
  return { ok: true, value: norm };
}
