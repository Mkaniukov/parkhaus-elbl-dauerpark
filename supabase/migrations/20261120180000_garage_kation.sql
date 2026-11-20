-- Kaution je Garage. Die globale app_settings.kation_eur bleibt der Ersatzwert für den Vertrag.

alter table public.garagen
  add column if not exists kation_eur numeric;

comment on column public.garagen.kation_eur is
  'Kaution in Euro. Leer, wenn für die Garage kein Betrag veröffentlicht ist.';

update public.garagen set kation_eur = 400 where id = '1010-posthoefe' and kation_eur is null;
update public.garagen set kation_eur = 200 where id = '1190-skyline' and kation_eur is null;
update public.garagen set kation_eur = 200 where id = '1220-reichsbruecke' and kation_eur is null;
