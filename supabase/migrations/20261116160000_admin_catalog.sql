-- Katalog für /admin: Garagen, Tarife, Texte und Mail-Empfänger.
-- Keine Policies: anon/authenticated haben keinen Zugriff. Netlify nutzt den Service Role.

create table if not exists public.garagen (
  id text primary key,
  label text not null,
  vertrags_adresse text not null default '',
  sort_order integer not null default 0,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.tarife (
  id text primary key,
  garage_id text not null references public.garagen (id) on delete cascade,
  label text not null,
  detail text not null default '',
  sort_order integer not null default 0,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

create index if not exists tarife_garage_id_idx on public.tarife (garage_id);

create table if not exists public.app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

alter table public.garagen enable row level security;
alter table public.tarife enable row level security;
alter table public.app_settings enable row level security;

alter table public.dauerpark_antraege
  add column if not exists tarif_label text;

alter table public.dauerpark_antraege
  add column if not exists garage_label text;

alter table public.dauerpark_antraege
  add column if not exists garage_vertragsadresse text;

comment on table public.garagen is 'Standorte der Online-Anmeldung. Pflege über /admin.';
comment on table public.tarife is 'Dauerparktarife je Garage. label enthält den Betrag für den Vertrag.';
comment on column public.dauerpark_antraege.tarif_label is 'Tariftext zum Zeitpunkt der Anmeldung (Vertragspreis).';
comment on column public.dauerpark_antraege.garage_label is 'Garagenname zum Zeitpunkt der Anmeldung.';
comment on column public.dauerpark_antraege.garage_vertragsadresse is 'Vertragsort zum Zeitpunkt der Anmeldung.';
