// src/lib/formato.ts
// Formattazione condivisa. Sta in un modulo suo perché era duplicata in due
// componenti e in entrambi aveva lo stesso bug: arrotondando i minuti si
// arrivava a «51h 60m». Un solo posto, un solo test.

/** Ore decimali → «7h 30m». I minuti arrotondati a 60 riportano sull'ora. */
export function formattaOre(n: number): string {
  if (!Number.isFinite(n) || n < 0) return '0h';
  const totale = Math.round(n * 60);
  const ore = Math.floor(totale / 60);
  const minuti = totale % 60;
  return minuti > 0 ? `${ore}h ${minuti}m` : `${ore}h`;
}

/** Euro arrotondati con separatore italiano delle migliaia. */
export function formattaEuro(n: number): string {
  if (!Number.isFinite(n)) return '0';
  return Math.round(n).toLocaleString('it-IT');
}
