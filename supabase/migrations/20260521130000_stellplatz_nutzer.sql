-- Optional: tatsächliche Stellplatnutzer:in (falls abweichend vom Vertragspartner)
alter table public.dauerpark_antraege
  add column if not exists stellplatz_nutzer text;

comment on column public.dauerpark_antraege.stellplatz_nutzer is
  'Optional: Name Nutzer:in der Stelle, falls nicht ident mit Vertragspartner (Formular).';
