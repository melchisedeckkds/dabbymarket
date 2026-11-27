-- =========================================================
-- DabbyMarket — 0025 : DabbyMap — recherche de quartiers et villes
-- Permet de taper « etoudi », « yaounde »… dans la barre de recherche de la carte et de centrer
-- la carte sur le lieu. Recherche insensible aux accents et à la casse.
-- Ne contient AUCUNE position inventée : seules les zones de geo_zones sont trouvées.
-- Retour arrière : supabase/rollbacks/ROLLBACK_0025.sql
-- =========================================================

alter table public.geo_zones add column if not exists search_text text not null default '';

create or replace function public.geo_zones_biu() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.search_text := lower(extensions.unaccent(btrim(new.name)));
  return new;
end $$;
revoke execute on function public.geo_zones_biu() from public, anon, authenticated;
drop trigger if exists trg_geo_zones_biu on public.geo_zones;
create trigger trg_geo_zones_biu before insert or update of name on public.geo_zones
  for each row execute function public.geo_zones_biu();

-- Nom plus simple pour la zone pilote (la mention « zone pilote » reste dans le type).
update public.geo_zones set name = 'Étoudi' where code = 'etoudi' and name = 'Étoudi (zone pilote)';
update public.geo_zones set name = name;  -- remplit search_text pour les lignes existantes

create index if not exists geo_zones_search_trgm on public.geo_zones using gin (search_text extensions.gin_trgm_ops);

create or replace function public.map_search_zones(p_query text, p_limit integer default 5)
returns table (code text, name text, kind text, center_lat double precision, center_lng double precision, radius_m integer)
language sql stable security definer set search_path = '' as $$
  with q as (select lower(extensions.unaccent(btrim(coalesce(p_query, '')))) as t)
  select z.code, z.name, z.kind, z.center_lat, z.center_lng, z.radius_m
  from public.geo_zones z, q
  where z.is_active and z.kind <> 'country' and char_length(q.t) >= 2
    and (z.search_text like '%' || replace(replace(replace(q.t, '\', '\\'), '%', '\%'), '_', '\_') || '%'
         or extensions.similarity(z.search_text, q.t) > 0.35)
  order by (z.search_text like q.t || '%') desc, extensions.similarity(z.search_text, q.t) desc, z.radius_m asc
  limit least(greatest(p_limit, 1), 20);
$$;
revoke execute on function public.map_search_zones(text, integer) from public;
grant execute on function public.map_search_zones(text, integer) to anon, authenticated;
