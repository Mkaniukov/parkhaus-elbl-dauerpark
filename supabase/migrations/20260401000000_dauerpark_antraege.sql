-- Dauerpark-Anmeldungen (Insert nur über Netlify Function mit Service Role)
create table if not exists public.dauerpark_antraege (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name_firma text not null,
  adresse text not null,
  telefon text not null,
  email text not null,
  beginn date not null,
  fahrzeug text not null,
  kennzeichen text not null,
  iban text not null,
  bic text,
  lautend_auf text not null,
  tarif text not null,
  garage text not null,
  agb_akzeptiert boolean not null default false,
  sepa_akzeptiert boolean not null default false,
  datenschutz_akzeptiert boolean not null default false
);

comment on table public.dauerpark_antraege is 'Online-Anmeldungen Dauerpark; Client hat keinen Zugriff (RLS).';

alter table public.dauerpark_antraege enable row level security;
