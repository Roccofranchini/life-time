// src/lib/engine/sopravvivenza.ts
// Costi fissi e ore necessarie a coprirli. Pure function.
//
// La v1 sommava quattro voci scelte a mano (affitto, spesa, bollette e 40 litri
// di benzina, anche a chi vive a Milano senza macchina). Qui il paniere ha un
// criterio, ed è pubblico (CRITICA.md §4):
//
//   costi fissi = canone di mercato + parte non abitativa del paniere ISTAT
//
// dove il paniere ISTAT è la soglia di povertà assoluta — la linea sotto la
// quale lo Stato italiano dichiara che una persona è povera — e la parte non
// abitativa (62%) copre cibo, trasporti, salute, igiene, vestiario, comunicazioni.
//
// Il canone non è più un numero scritto a mano: è €/m² della provincia per la
// superficie del tipo di alloggio, diviso le persone che se lo dividono. Due
// grandezze pubblicate e un'operazione: chiunque può rifare il conto.
//
// Le ore si calcolano al salario orario REALE, non a quello nominale.

import T from '../data/tempo.json';
import type { AlloggioId, ProvinciaEntry, Sopravvivenza } from '../types';

const SOGLIE = T.soglia_poverta_assoluta;

export function tipoAlloggio(id: AlloggioId) {
  return T.alloggi.tipi.find((a) => a.id === id) ?? T.alloggi.tipi[2];
}

export function sogliaIstat(provincia: ProvinciaEntry): number {
  const perArea = (SOGLIE.valori as Record<string, Record<string, number>>)[provincia.area];
  return perArea?.[provincia.tipo_comune] ?? SOGLIE.valori.centro.grande;
}

export function canoneMensile(provincia: ProvinciaEntry, alloggio: AlloggioId): number {
  const a = tipoAlloggio(alloggio);
  return (provincia.eur_mq * a.mq) / a.quota_persone;
}

export function calcolaSopravvivenza(input: {
  provincia: ProvinciaEntry;
  alloggio: AlloggioId;
  netto_mensile: number;
  /** costi che il lavoro impone: tragitto e pasti fuori. Non sono reddito disponibile. */
  costi_del_lavoro: number;
  salario_orario_reale: number;
  ore_sottratte: number;
}): Sopravvivenza {
  const { provincia, alloggio, netto_mensile, costi_del_lavoro, salario_orario_reale, ore_sottratte } =
    input;

  const a = tipoAlloggio(alloggio);
  const affitto = canoneMensile(provincia, alloggio);
  const soglia_istat = sogliaIstat(provincia);
  const paniere_essenziale = soglia_istat * SOGLIE.quota_non_abitativa;
  const costi_fissi = affitto + paniere_essenziale;

  // Il metro giusto non è il netto, ma quello che ne resta dopo aver pagato il
  // biglietto per andare a guadagnarlo: è la stessa base su cui è costruito il
  // salario orario reale, quindi euro e ore raccontano la stessa cosa.
  const netto_disponibile = Math.max(0, netto_mensile - costi_del_lavoro);

  const ore_sopravvivenza =
    salario_orario_reale > 0 ? costi_fissi / salario_orario_reale : 0;

  return {
    affitto,
    affitto_mq: a.mq,
    affitto_persone: a.quota_persone,
    soglia_istat,
    paniere_essenziale,
    costi_fissi,
    netto_disponibile,
    ore_sopravvivenza,
    quota_netto: netto_disponibile > 0 ? costi_fissi / netto_disponibile : 0,
    quota_ore: ore_sottratte > 0 ? ore_sopravvivenza / ore_sottratte : 0,
    residuo: netto_disponibile - costi_fissi,
    in_rosso: costi_fissi > netto_disponibile,
    sotto_soglia_istat: netto_mensile < soglia_istat,
    giorni_affitto:
      netto_mensile > 0 ? Math.round((affitto / netto_mensile) * T.mese.giorni) : 0
  };
}
