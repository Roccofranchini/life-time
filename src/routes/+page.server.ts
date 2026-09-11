// src/routes/+page.server.ts
// Il calcolo avviene lato client a ogni modifica. Qui il server fa una sola
// cosa: rendere funzionante un link condiviso anche prima che il JavaScript
// parta, e produrre i meta tag per l'anteprima social.
//
// Nessun cookie, nessun log, nessuna chiamata esterna, nessun database: i dati
// sono file versionati nel repository e il motore è una funzione pura. Il
// server non viene a sapere nulla che non sia già nella URL che l'utente ha
// scelto di condividere.

import type { PageServerLoad } from './$types';
import { calcola } from '$lib/engine';
import { queryInStato, risolviIngresso, statoInQuery } from '$lib/stato';

export const load: PageServerLoad = ({ url, setHeaders }) => {
  setHeaders({
    'cache-control': 'public, max-age=0, s-maxage=3600',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer'
  });

  const stato = queryInStato(url.searchParams);
  const daLink = url.searchParams.has('p') || url.searchParams.has('s') || url.searchParams.has('l');

  const risolto = risolviIngresso(stato);
  const risultato = risolto ? calcola(risolto.ingresso, risolto.provincia) : null;

  const nomeProvincia = risolto?.provincia.nome ?? '';
  const ore = risultato ? Math.round(risultato.sopravvivenza.ore_sopravvivenza) : 0;
  const orario = risultato ? risultato.tempo.salario_orario_reale.toFixed(2) : '0';

  const titolo = daLink && risultato
    ? `${nomeProvincia}: ${ore} ore al mese solo per esistere`
    : 'Tempo di vita — quanto della tua vita costa vivere';

  const descrizione = daLink && risultato
    ? `Salario orario reale ${orario} €/h. Calcolo aperto, fonti pubbliche, nessun dato raccolto.`
    : 'Converti il tuo salario in ore di vita. Calcolo aperto, fonti pubbliche, nessun tracciamento.';

  return {
    stato,
    daLink,
    risultato,
    meta: {
      title: titolo,
      description: descrizione,
      // assoluto: gli scraper social non risolvono i path relativi
      ogImageUrl: `${url.origin}/api/og?${statoInQuery(stato)}`,
      canonical: `${url.origin}/?${statoInQuery(stato)}`
    }
  };
};
