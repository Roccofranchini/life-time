// src/lib/share.ts
// Generatore URL condivisibili per il report.
// Regola invariabile: nell'URL finiscono SOLO i parametri di selezione,
// mai i numeri calcolati. Vedi ARCHITECTURE.md — sezione Privacy.

import type { ProfiloUtente, ReportParams } from './types';

export function costruisciReportParams(profilo: ProfiloUtente): ReportParams {
  const params: ReportParams = {
    p: profilo.provincia,
    s: `${profilo.settore_id}-${profilo.livello}`,
    c: profilo.tipo_contratto
  };
  if (
    profilo.tipo_contratto === 'parttime' &&
    profilo.percentuale_parttime !== undefined
  ) {
    params.pt = Math.round(profilo.percentuale_parttime * 100).toString();
  }
  return params;
}

/**
 * Costruisce una URL /report condivisibile a partire da origin + profilo.
 * Esempio: https://esempio.it/report?p=BO&s=commercio-4&c=indeterminato
 */
export function costruisciReportUrl(origin: string, profilo: ProfiloUtente): string {
  const params = costruisciReportParams(profilo);
  const qs = new URLSearchParams(params as unknown as Record<string, string>).toString();
  return `${origin.replace(/\/$/, '')}/report?${qs}`;
}
