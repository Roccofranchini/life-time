-- Tempo di Vita — schema iniziale Supabase
-- Fonte: ARCHITECTURE.md, sezione "Schema Supabase"

-- Cache costi vita per provincia (TTL applicativo: 7 giorni)
create table if not exists costi_vita (
  id          uuid default gen_random_uuid() primary key,
  provincia   char(2) not null,           -- codice ISTAT es. "BO"
  voce        text not null,              -- 'affitto_bilocale_periferia' | 'spesa_alimentare_minima' | 'carburante_benzina_litro' | 'bollette_stimate'
  valore      numeric(10, 2) not null,
  fonte       text not null,              -- 'OMI' | 'ISTAT' | 'Mimit' | 'stima_interna'
  aggiornato  timestamptz not null default now(),
  unique (provincia, voce)
);

-- Indice per TTL check (query: select where aggiornato > now() - interval '7 days')
create index if not exists idx_costi_vita_aggiornato on costi_vita (aggiornato);

-- Indice per lookup rapido per provincia
create index if not exists idx_costi_vita_provincia on costi_vita (provincia);

-- Province italiane (tabella di lookup)
create table if not exists province (
  codice      char(2) primary key,
  nome        text not null,
  regione     text not null,
  capoluogo   boolean not null default false
);

-- Row Level Security: pubblico in lettura, scrittura solo con service_role_key
alter table costi_vita enable row level security;
alter table province enable row level security;

create policy "costi_vita: lettura pubblica"
  on costi_vita for select
  using (true);

create policy "province: lettura pubblica"
  on province for select
  using (true);
-- Le policy di scrittura sono volutamente assenti: solo service_role_key può scrivere.
