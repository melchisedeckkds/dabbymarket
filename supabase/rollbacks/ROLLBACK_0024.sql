-- Retour arrière de 0024 (DabbyMap). À exécuter en une fois.
-- ATTENTION : supprime TOUS les repères, contributions, photos (références), droits et zones.
-- Exportez-les avant si besoin. Les fichiers du bucket « landmark-photos » doivent être vidés
-- depuis Storage (interface Supabase) avant de supprimer le bucket. Les extensions PostGIS,
-- pg_trgm et unaccent sont laissées en place (inoffensives).
begin;
drop policy if exists "Photos repères : lecture publique" on storage.objects;
drop policy if exists "Photos repères : dépôt dans son dossier" on storage.objects;
drop policy if exists "Photos repères : suppression des siennes" on storage.objects;
drop function if exists public.map_review_photo(uuid, boolean);
drop function if exists public.map_verify(uuid, text, text, text);
drop function if exists public.map_review_contribution(uuid, boolean, text);
drop function if exists public.map_contribute(text, uuid, jsonb);
drop function if exists public.map__apply(uuid, uuid);
drop function if exists public.map_search(text, double precision, double precision, integer);
drop function if exists public.map_nearby(double precision, double precision, integer, text, integer, integer);
drop table if exists public.navigation_reports, public.saved_places, public.mapper_permissions,
  public.landmark_edit_history, public.landmark_contributions, public.landmark_verifications,
  public.landmark_photos, public.landmark_aliases, public.landmarks,
  public.landmark_categories, public.geo_zones cascade;
drop function if exists public.landmarks_history();
drop function if exists public.landmark_aliases_biu();
drop function if exists public.landmarks_biu();
drop function if exists public.map_zone_for(double precision, double precision);
drop function if exists public.map_can(text, uuid, text);
-- Bucket : à supprimer ensuite depuis Storage > landmark-photos > Delete bucket (après l'avoir vidé).
commit;
