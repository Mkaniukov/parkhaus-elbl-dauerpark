-- URL des aus Google Docs erzeugten Vertrags (Link zum geteilten Dokument)
alter table public.dauerpark_antraege
  add column if not exists contract_pdf_url text;

comment on column public.dauerpark_antraege.contract_pdf_url is
  'Link zum Google-Doc (nach Kopie des Templates); wird von Edge Function generate-contract gesetzt.';
