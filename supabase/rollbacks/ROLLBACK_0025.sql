-- Retour arrière de 0025.
drop function if exists public.map_search_zones(text, integer);
drop index if exists public.geo_zones_search_trgm;
drop trigger if exists trg_geo_zones_biu on public.geo_zones;
drop function if exists public.geo_zones_biu();
alter table public.geo_zones drop column if exists search_text;
update public.geo_zones set name = 'Étoudi (zone pilote)' where code = 'etoudi';
