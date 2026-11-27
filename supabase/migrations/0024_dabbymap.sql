-- =========================================================
-- DabbyMarket — 0024 : DABBYMAP (fondations de la carte et des repères)
--
-- Contenu : PostGIS, zones géographiques, catégories de repères, repères (« Dabby Landmarks »),
-- alias, photos, vérifications, contributions, historique, droits des cartographes,
-- lieux enregistrés, signalements ; fonctions de recherche (map_nearby, map_search) ;
-- contribution / modération / vérification ; bucket de photos ; 4 zones + 10 catégories de départ.
-- Le jeu de départ d'Étoudi (52 repères OpenStreetMap) est importé à la fin du fichier.
--
-- SÉCURITÉ (leçon de 0023) : toute fonction SECURITY DEFINER a un search_path vide, des noms
-- qualifiés, et un EXECUTE retiré à PUBLIC puis accordé explicitement.
-- Les utilisateurs ne peuvent écrire dans les repères QUE par les fonctions ci-dessous.
-- Retour arrière : voir supabase/rollbacks/ROLLBACK_0024.sql
-- Tables volontairement reportées (décision du 25/11) : landmark_relations, landmark_access_points,
-- route_history, mapper_territories (remplacée par mapper_permissions.zone_id).
-- =========================================================

create extension if not exists postgis with schema extensions;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

-- ---------- Zones ----------
create table public.geo_zones (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9_-]{2,40}$'),
  name text not null,
  kind text not null check (kind in ('country','city','district','pilot')),
  parent_id uuid references public.geo_zones(id) on delete set null,
  center_lat double precision not null check (center_lat between -90 and 90),
  center_lng double precision not null check (center_lng between -180 and 180),
  radius_m integer not null check (radius_m between 100 and 2000000),
  center extensions.geography(Point, 4326) generated always as
    (extensions.st_setsrid(extensions.st_makepoint(center_lng, center_lat), 4326)::extensions.geography) stored,
  navigation_enabled boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index geo_zones_center_gix on public.geo_zones using gist (center);

-- ---------- Catégories ----------
create table public.landmark_categories (
  code text primary key check (code ~ '^[a-z0-9_]{2,40}$'),
  label_fr text not null,
  label_en text not null,
  icon text not null,
  default_importance smallint not null default 3 check (default_importance between 1 and 5),
  sort_order smallint not null default 100,
  is_active boolean not null default true
);

-- ---------- Repères ----------
create table public.landmarks (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 120),
  search_text text not null default '',
  category_code text not null references public.landmark_categories(code),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  location extensions.geography(Point, 4326) generated always as
    (extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::extensions.geography) stored,
  importance smallint not null default 3 check (importance between 1 and 5),
  zone_id uuid references public.geo_zones(id) on delete set null,
  access_hint text check (access_hint is null or char_length(access_hint) <= 300),
  verification_status text not null default 'unverified'
    check (verification_status in ('unverified','located','verified','claimed_verified','institutional')),
  publication_status text not null default 'pending'
    check (publication_status in ('draft','pending','published','to_fix','rejected','archived','reported')),
  source_type text not null default 'user' check (source_type in ('osm','agent','user','establishment','import')),
  source_ref text,
  source_attribution text,
  claimed_shop_id uuid references public.shops(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index landmarks_source_uq on public.landmarks (source_type, source_ref) where source_ref is not null;
create index landmarks_location_gix on public.landmarks using gist (location);
create index landmarks_search_trgm on public.landmarks using gin (search_text extensions.gin_trgm_ops);
create index landmarks_zone_idx on public.landmarks (zone_id, publication_status);

create table public.landmark_aliases (
  id uuid primary key default gen_random_uuid(),
  landmark_id uuid not null references public.landmarks(id) on delete cascade,
  alias text not null check (char_length(btrim(alias)) between 2 and 120),
  alias_search text not null default '',
  alias_type text not null default 'popular' check (alias_type in ('popular','former','abbreviation','translation')),
  source text,
  verification_status text not null default 'unverified',
  unique (landmark_id, alias)
);
create index landmark_aliases_trgm on public.landmark_aliases using gin (alias_search extensions.gin_trgm_ops);

create table public.landmark_photos (
  id uuid primary key default gen_random_uuid(),
  landmark_id uuid not null references public.landmarks(id) on delete cascade,
  storage_path text not null,
  thumbnail_path text,
  photo_type text not null default 'facade' check (photo_type in ('facade','entrance','landmark','context')),
  author_id uuid references public.profiles(id) on delete set null,
  source text not null default 'agent',
  captured_at timestamptz,
  created_at timestamptz not null default now(),
  verification_status text not null default 'pending' check (verification_status in ('pending','approved','rejected')),
  rights_status text not null default 'author_grants_license'
);
create index landmark_photos_lm_idx on public.landmark_photos (landmark_id, verification_status);

create table public.landmark_verifications (
  id uuid primary key default gen_random_uuid(),
  landmark_id uuid not null references public.landmarks(id) on delete cascade,
  verifier_id uuid references public.profiles(id) on delete set null,
  verification_type text not null check (verification_type in ('field_visit','photo','owner','document')),
  result text not null check (result in ('confirmed','moved','closed','wrong')),
  notes text check (notes is null or char_length(notes) <= 500),
  created_at timestamptz not null default now()
);

create table public.landmark_contributions (
  id uuid primary key default gen_random_uuid(),
  contributor_id uuid not null references public.profiles(id) on delete cascade,
  landmark_id uuid references public.landmarks(id) on delete cascade,
  contribution_type text not null check (contribution_type in ('create','edit','report')),
  proposed_changes jsonb not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reviewer_id uuid references public.profiles(id) on delete set null,
  review_note text,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz
);
create index landmark_contrib_status_idx on public.landmark_contributions (status, submitted_at);
create index landmark_contrib_user_idx on public.landmark_contributions (contributor_id, submitted_at);

create table public.landmark_edit_history (
  id uuid primary key default gen_random_uuid(),
  landmark_id uuid not null references public.landmarks(id) on delete cascade,
  editor_id uuid,
  previous_values jsonb not null,
  new_values jsonb not null,
  change_reason text,
  created_at timestamptz not null default now()
);
create index landmark_history_lm_idx on public.landmark_edit_history (landmark_id, created_at desc);

create table public.mapper_permissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  permission_code text not null check (permission_code in ('create','edit','verify','moderate')),
  category_code text references public.landmark_categories(code),
  zone_id uuid references public.geo_zones(id) on delete cascade,
  granted_by uuid references public.profiles(id) on delete set null,
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  is_active boolean not null default true
);
create index mapper_permissions_user_idx on public.mapper_permissions (user_id) where is_active;

create table public.saved_places (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  landmark_id uuid not null references public.landmarks(id) on delete cascade,
  custom_label text check (custom_label is null or char_length(custom_label) <= 60),
  created_at timestamptz not null default now(),
  unique (user_id, landmark_id)
);

create table public.navigation_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  report_type text not null check (report_type in ('wrong_route','wrong_location','road_blocked','missing_road','other')),
  lat double precision check (lat is null or lat between -90 and 90),
  lng double precision check (lng is null or lng between -180 and 180),
  landmark_id uuid references public.landmarks(id) on delete set null,
  description text check (description is null or char_length(description) <= 500),
  status text not null default 'open' check (status in ('open','reviewed','fixed','dismissed')),
  created_at timestamptz not null default now()
);

-- ---------- Droits : écriture uniquement par les fonctions ----------
revoke insert, update, delete on public.geo_zones, public.landmark_categories, public.landmarks,
  public.landmark_aliases, public.landmark_verifications, public.landmark_contributions,
  public.landmark_edit_history, public.mapper_permissions from anon, authenticated;
revoke all on public.landmark_edit_history, public.landmark_verifications, public.landmark_contributions,
  public.mapper_permissions, public.saved_places, public.navigation_reports from anon;
revoke insert, update, delete on public.landmark_photos from anon;
revoke update, delete on public.landmark_photos, public.navigation_reports from authenticated;
revoke update on public.saved_places from authenticated;

-- ---------- Droits d'un cartographe ----------
create or replace function public.map_can(p_perm text, p_zone uuid, p_cat text)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select p.is_admin from public.profiles p where p.id = auth.uid()), false
  ) or exists (
    with recursive anc(id) as (
      select p_zone where p_zone is not null
      union
      select z.parent_id from public.geo_zones z join anc on z.id = anc.id where z.parent_id is not null
    )
    select 1 from public.mapper_permissions mp
    where mp.user_id = auth.uid() and mp.is_active
      and mp.valid_from <= now() and (mp.valid_until is null or mp.valid_until > now())
      and (mp.permission_code = p_perm or mp.permission_code = 'moderate')
      and (mp.category_code is null or mp.category_code = p_cat)
      and (mp.zone_id is null or mp.zone_id in (select id from anc))
  );
$$;
revoke execute on function public.map_can(text, uuid, text) from public;
grant execute on function public.map_can(text, uuid, text) to anon, authenticated;

create or replace function public.map_zone_for(p_lat double precision, p_lng double precision)
returns uuid language sql stable security definer set search_path = '' as $$
  select z.id from public.geo_zones z
  where z.is_active and extensions.st_dwithin(
    z.center,
    extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography,
    z.radius_m)
  order by z.radius_m asc limit 1;
$$;
revoke execute on function public.map_zone_for(double precision, double precision) from public;
grant execute on function public.map_zone_for(double precision, double precision) to anon, authenticated;

-- ---------- Déclencheurs ----------
create or replace function public.landmarks_biu() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.search_text := lower(extensions.unaccent(btrim(new.name)));
  new.name := btrim(new.name);
  new.updated_at := now();
  if tg_op = 'INSERT' and new.zone_id is null then
    new.zone_id := public.map_zone_for(new.lat, new.lng);
  end if;
  return new;
end $$;
revoke execute on function public.landmarks_biu() from public, anon, authenticated;
create trigger trg_landmarks_biu before insert or update on public.landmarks
  for each row execute function public.landmarks_biu();

create or replace function public.landmark_aliases_biu() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.alias := btrim(new.alias);
  new.alias_search := lower(extensions.unaccent(new.alias));
  return new;
end $$;
revoke execute on function public.landmark_aliases_biu() from public, anon, authenticated;
create trigger trg_landmark_aliases_biu before insert or update on public.landmark_aliases
  for each row execute function public.landmark_aliases_biu();

create or replace function public.landmarks_history() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_old jsonb; v_new jsonb;
begin
  v_old := jsonb_build_object('name', old.name, 'category_code', old.category_code, 'lat', old.lat, 'lng', old.lng,
    'importance', old.importance, 'access_hint', old.access_hint,
    'verification_status', old.verification_status, 'publication_status', old.publication_status);
  v_new := jsonb_build_object('name', new.name, 'category_code', new.category_code, 'lat', new.lat, 'lng', new.lng,
    'importance', new.importance, 'access_hint', new.access_hint,
    'verification_status', new.verification_status, 'publication_status', new.publication_status);
  if v_old is distinct from v_new then
    insert into public.landmark_edit_history (landmark_id, editor_id, previous_values, new_values, change_reason)
    values (new.id, auth.uid(), v_old, v_new, nullif(current_setting('dabbymap.change_reason', true), ''));
  end if;
  return new;
end $$;
revoke execute on function public.landmarks_history() from public, anon, authenticated;
create trigger trg_landmarks_history after update on public.landmarks
  for each row execute function public.landmarks_history();

-- ---------- RLS ----------
alter table public.geo_zones enable row level security;
alter table public.landmark_categories enable row level security;
alter table public.landmarks enable row level security;
alter table public.landmark_aliases enable row level security;
alter table public.landmark_photos enable row level security;
alter table public.landmark_verifications enable row level security;
alter table public.landmark_contributions enable row level security;
alter table public.landmark_edit_history enable row level security;
alter table public.mapper_permissions enable row level security;
alter table public.saved_places enable row level security;
alter table public.navigation_reports enable row level security;

create policy "Zones : lecture" on public.geo_zones for select using (is_active or public.dm_is_admin());
create policy "Zones : admin" on public.geo_zones for all using (public.dm_is_admin()) with check (public.dm_is_admin());
create policy "Catégories repères : lecture" on public.landmark_categories for select using (is_active or public.dm_is_admin());
create policy "Catégories repères : admin" on public.landmark_categories for all using (public.dm_is_admin()) with check (public.dm_is_admin());

create policy "Repères : lecture" on public.landmarks for select using (
  publication_status = 'published'
  or created_by = auth.uid()
  or public.map_can('moderate', zone_id, category_code)
);
create policy "Alias : lecture" on public.landmark_aliases for select using (
  exists (select 1 from public.landmarks l where l.id = landmark_id)
);
create policy "Photos : lecture" on public.landmark_photos for select using (
  (verification_status = 'approved' and exists (select 1 from public.landmarks l where l.id = landmark_id))
  or author_id = auth.uid()
  or exists (select 1 from public.landmarks l where l.id = landmark_id and public.map_can('moderate', l.zone_id, l.category_code))
);
create policy "Photos : dépôt" on public.landmark_photos for insert to authenticated with check (
  author_id = auth.uid() and verification_status = 'pending'
  and storage_path like auth.uid()::text || '/%'
  and (thumbnail_path is null or thumbnail_path like auth.uid()::text || '/%')
  and exists (select 1 from public.landmarks l where l.id = landmark_id and l.publication_status = 'published')
);
create policy "Vérifications : lecture" on public.landmark_verifications for select using (
  verifier_id = auth.uid()
  or exists (select 1 from public.landmarks l where l.id = landmark_id and public.map_can('moderate', l.zone_id, l.category_code))
);
create policy "Contributions : lecture" on public.landmark_contributions for select using (
  contributor_id = auth.uid()
  or public.dm_is_admin()
  or (landmark_id is not null and exists (select 1 from public.landmarks l where l.id = landmark_id and public.map_can('moderate', l.zone_id, l.category_code)))
  or (landmark_id is null and public.map_can('moderate',
        public.map_zone_for(((proposed_changes->>'lat'))::double precision, ((proposed_changes->>'lng'))::double precision),
        proposed_changes->>'category_code'))
);
create policy "Historique : lecture modérateurs" on public.landmark_edit_history for select using (
  exists (select 1 from public.landmarks l where l.id = landmark_id and public.map_can('moderate', l.zone_id, l.category_code))
);
create policy "Droits cartographes : lecture" on public.mapper_permissions for select using (user_id = auth.uid() or public.dm_is_admin());
create policy "Droits cartographes : admin" on public.mapper_permissions for all using (public.dm_is_admin()) with check (public.dm_is_admin());
create policy "Lieux enregistrés : lecture" on public.saved_places for select using (user_id = auth.uid());
create policy "Lieux enregistrés : ajout" on public.saved_places for insert to authenticated with check (
  user_id = auth.uid() and exists (select 1 from public.landmarks l where l.id = landmark_id)
);
create policy "Lieux enregistrés : suppression" on public.saved_places for delete to authenticated using (user_id = auth.uid());
create policy "Signalements : lecture" on public.navigation_reports for select using (user_id = auth.uid() or public.dm_is_admin());
create policy "Signalements : envoi" on public.navigation_reports for insert to authenticated with check (user_id = auth.uid());

-- ---------- Lecture publique : repères proches ----------
create or replace function public.map_nearby(
  p_lat double precision, p_lng double precision,
  p_radius_m integer default 1500, p_category text default null,
  p_min_importance integer default 1, p_limit integer default 60)
returns table (id uuid, name text, category_code text, lat double precision, lng double precision,
  importance smallint, verification_status text, access_hint text, distance_m double precision,
  thumbnail_path text)
language sql stable security definer set search_path = '' as $$
  with me as (
    select extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography as g
  )
  select l.id, l.name, l.category_code, l.lat, l.lng, l.importance, l.verification_status, l.access_hint,
         extensions.st_distance(l.location, me.g) as distance_m,
         (select ph.thumbnail_path from public.landmark_photos ph
           where ph.landmark_id = l.id and ph.verification_status = 'approved'
           order by ph.created_at limit 1) as thumbnail_path
  from public.landmarks l, me
  where p_lat between -90 and 90 and p_lng between -180 and 180
    and l.publication_status = 'published'
    and extensions.st_dwithin(l.location, me.g, least(greatest(p_radius_m, 50), 20000))
    and (p_category is null or l.category_code = p_category)
    and l.importance >= greatest(p_min_importance, 1)
  order by l.importance desc, extensions.st_distance(l.location, me.g) asc
  limit least(greatest(p_limit, 1), 200);
$$;
revoke execute on function public.map_nearby(double precision, double precision, integer, text, integer, integer) from public;
grant execute on function public.map_nearby(double precision, double precision, integer, text, integer, integer) to anon, authenticated;

-- ---------- Lecture publique : recherche (insensible aux accents et à la casse) ----------
create or replace function public.map_search(
  p_query text, p_lat double precision default null, p_lng double precision default null,
  p_limit integer default 20)
returns table (id uuid, name text, matched_alias text, category_code text, lat double precision,
  lng double precision, verification_status text, distance_m double precision, score real)
language sql stable security definer set search_path = '' as $$
  with q as (
    select lower(extensions.unaccent(btrim(coalesce(p_query, '')))) as t,
           case when p_lat is not null and p_lng is not null and p_lat between -90 and 90 and p_lng between -180 and 180
                then extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography end as g
  ), hits as (
    select l.id, null::text as matched_alias, extensions.similarity(l.search_text, q.t) as sc
    from public.landmarks l, q
    where char_length(q.t) >= 2 and l.publication_status = 'published'
      and (l.search_text like '%' || replace(replace(replace(q.t, '\', '\\'), '%', '\%'), '_', '\_') || '%'
           or extensions.similarity(l.search_text, q.t) > 0.3)
    union all
    select a.landmark_id, a.alias, extensions.similarity(a.alias_search, q.t) + 0.05
    from public.landmark_aliases a
    join public.landmarks l on l.id = a.landmark_id and l.publication_status = 'published', q
    where char_length(q.t) >= 2
      and (a.alias_search like '%' || replace(replace(replace(q.t, '\', '\\'), '%', '\%'), '_', '\_') || '%'
           or extensions.similarity(a.alias_search, q.t) > 0.3)
  ), best as (
    select distinct on (h.id) h.id, h.matched_alias, h.sc from hits h order by h.id, h.sc desc
  )
  select l.id, l.name, b.matched_alias, l.category_code, l.lat, l.lng, l.verification_status,
         case when q.g is not null then extensions.st_distance(l.location, q.g) end as distance_m,
         b.sc::real as score
  from best b join public.landmarks l on l.id = b.id, q
  order by b.sc desc, l.importance desc,
           case when q.g is not null then extensions.st_distance(l.location, q.g) end asc nulls last
  limit least(greatest(p_limit, 1), 50);
$$;
revoke execute on function public.map_search(text, double precision, double precision, integer) from public;
grant execute on function public.map_search(text, double precision, double precision, integer) to anon, authenticated;

-- ---------- Application d'une contribution (interne) ----------
create or replace function public.map__apply(p_id uuid, p_actor uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  c public.landmark_contributions%rowtype;
  v_lm public.landmarks%rowtype;
  v_new uuid;
  v_pt_cat text;
  v_is_mod boolean;
begin
  select * into c from public.landmark_contributions where id = p_id for update;
  if not found or c.status <> 'pending' then return; end if;

  if c.contribution_type = 'create' then
    insert into public.landmarks (name, category_code, lat, lng, importance, access_hint,
      verification_status, publication_status, source_type, created_by)
    values (c.proposed_changes->>'name',
            coalesce(c.proposed_changes->>'category_code', 'autre'),
            (c.proposed_changes->>'lat')::double precision, (c.proposed_changes->>'lng')::double precision,
            coalesce((select default_importance from public.landmark_categories
                      where code = coalesce(c.proposed_changes->>'category_code', 'autre')), 3),
            nullif(c.proposed_changes->>'access_hint', ''),
            'located', 'published',
            case when exists (select 1 from public.mapper_permissions mp
                              where mp.user_id = c.contributor_id and mp.is_active) then 'agent' else 'user' end,
            c.contributor_id)
    returning id into v_new;
    update public.landmark_contributions set landmark_id = v_new where id = c.id;

  elsif c.contribution_type = 'edit' then
    select * into v_lm from public.landmarks where id = c.landmark_id for update;
    if not found then raise exception 'Repère introuvable'; end if;
    -- L'importance n'est modifiable que si l'AUTEUR de la proposition est cartographe ou admin.
    v_is_mod := exists (select 1 from public.mapper_permissions mp where mp.user_id = c.contributor_id and mp.is_active)
             or exists (select 1 from public.profiles p where p.id = c.contributor_id and p.is_admin);
    perform set_config('dabbymap.change_reason', 'contribution ' || c.id::text, true);
    update public.landmarks set
      name = coalesce(c.proposed_changes->>'name', name),
      category_code = coalesce(c.proposed_changes->>'category_code', category_code),
      lat = coalesce((c.proposed_changes->>'lat')::double precision, lat),
      lng = coalesce((c.proposed_changes->>'lng')::double precision, lng),
      access_hint = case when c.proposed_changes ? 'access_hint' then nullif(c.proposed_changes->>'access_hint', '') else access_hint end,
      importance = case when v_is_mod and c.proposed_changes ? 'importance'
                        then (c.proposed_changes->>'importance')::smallint else importance end,
      verification_status = case when verification_status in ('verified','claimed_verified','institutional')
                                      and (c.proposed_changes ? 'lat' or c.proposed_changes ? 'lng')
                                 then 'located' else verification_status end
    where id = c.landmark_id;

  elsif c.contribution_type = 'report' then
    perform set_config('dabbymap.change_reason', 'signalement ' || c.id::text, true);
    update public.landmarks set publication_status = 'to_fix'
      where id = c.landmark_id and publication_status = 'published';
  end if;

  update public.landmark_contributions
     set status = 'approved', reviewer_id = p_actor, reviewed_at = now() where id = c.id;
end $$;
revoke execute on function public.map__apply(uuid, uuid) from public, anon, authenticated;

-- ---------- Contribuer (utilisateurs connectés) ----------
create or replace function public.map_contribute(p_type text, p_landmark uuid, p_changes jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
  v_lm public.landmarks%rowtype;
  v_zone uuid;
  v_cat text;
  v_direct boolean := false;
  v_num constant text := '^-?[0-9]+(\.[0-9]+)?$';
begin
  if v_uid is null then raise exception 'Connexion requise'; end if;
  if p_type not in ('create','edit','report') then raise exception 'Type de contribution invalide'; end if;
  if p_changes is null or jsonb_typeof(p_changes) <> 'object' then raise exception 'Contenu invalide'; end if;
  if exists (select 1 from jsonb_object_keys(p_changes) k
             where k not in ('name','category_code','lat','lng','access_hint','importance','note')) then
    raise exception 'Champ non autorisé';
  end if;
  if (select count(*) from public.landmark_contributions
       where contributor_id = v_uid and submitted_at > now() - interval '24 hours') >= 30 then
    raise exception 'Limite quotidienne atteinte (30 contributions)';
  end if;
  if (p_changes ? 'lat' and (p_changes->>'lat') !~ v_num) or (p_changes ? 'lng' and (p_changes->>'lng') !~ v_num)
     or (p_changes ? 'importance' and (p_changes->>'importance') !~ '^[1-5]$') then
    raise exception 'Valeur numérique invalide';
  end if;
  if p_changes ? 'name' and char_length(btrim(p_changes->>'name')) not between 2 and 120 then
    raise exception 'Nom invalide (2 à 120 caractères)';
  end if;
  if p_changes ? 'access_hint' and char_length(p_changes->>'access_hint') > 300 then
    raise exception 'Indication d''accès trop longue (300 caractères maximum)';
  end if;
  if p_changes ? 'category_code' and not exists
     (select 1 from public.landmark_categories where code = p_changes->>'category_code' and is_active) then
    raise exception 'Catégorie inconnue';
  end if;
  -- Zone de couverture : Cameroun (rectangle large) — évite les points aberrants.
  if (p_changes ? 'lat' and ((p_changes->>'lat')::double precision not between 1.6 and 13.2))
     or (p_changes ? 'lng' and ((p_changes->>'lng')::double precision not between 8.4 and 16.3)) then
    raise exception 'Position hors du Cameroun';
  end if;

  if p_type = 'create' then
    if not (p_changes ? 'name' and p_changes ? 'lat' and p_changes ? 'lng') then
      raise exception 'Nom et position obligatoires';
    end if;
    v_cat := coalesce(p_changes->>'category_code', 'autre');
    v_zone := public.map_zone_for((p_changes->>'lat')::double precision, (p_changes->>'lng')::double precision);
    v_direct := public.map_can('create', v_zone, v_cat);
    p_landmark := null;
  else
    select * into v_lm from public.landmarks where id = p_landmark and publication_status in ('published','to_fix');
    if not found then raise exception 'Repère introuvable'; end if;
    if p_type = 'edit' then
      v_direct := public.map_can('edit', v_lm.zone_id, v_lm.category_code);
    elsif not (p_changes ? 'note') or char_length(btrim(p_changes->>'note')) < 3 then
      raise exception 'Un signalement doit expliquer le problème';
    end if;
  end if;

  insert into public.landmark_contributions (contributor_id, landmark_id, contribution_type, proposed_changes)
  values (v_uid, p_landmark, p_type, p_changes) returning id into v_id;
  if v_direct then perform public.map__apply(v_id, v_uid); end if;
  return v_id;
end $$;
revoke execute on function public.map_contribute(text, uuid, jsonb) from public, anon;
grant execute on function public.map_contribute(text, uuid, jsonb) to authenticated;

-- ---------- Modérer une contribution ----------
create or replace function public.map_review_contribution(p_id uuid, p_approve boolean, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare c public.landmark_contributions%rowtype; v_lm public.landmarks%rowtype; v_zone uuid; v_cat text;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  select * into c from public.landmark_contributions where id = p_id for update;
  if not found then raise exception 'Contribution introuvable'; end if;
  if c.status <> 'pending' then raise exception 'Déjà traitée'; end if;
  if c.landmark_id is not null then
    select * into v_lm from public.landmarks where id = c.landmark_id;
    v_zone := v_lm.zone_id; v_cat := v_lm.category_code;
  else
    v_zone := public.map_zone_for((c.proposed_changes->>'lat')::double precision, (c.proposed_changes->>'lng')::double precision);
    v_cat := coalesce(c.proposed_changes->>'category_code', 'autre');
  end if;
  if not public.map_can('moderate', v_zone, v_cat) then raise exception 'Droits insuffisants'; end if;
  if p_approve then
    perform public.map__apply(p_id, auth.uid());
    update public.landmark_contributions set review_note = left(p_note, 300) where id = p_id;
  else
    update public.landmark_contributions
       set status = 'rejected', reviewer_id = auth.uid(), reviewed_at = now(), review_note = left(p_note, 300)
     where id = p_id;
  end if;
end $$;
revoke execute on function public.map_review_contribution(uuid, boolean, text) from public, anon;
grant execute on function public.map_review_contribution(uuid, boolean, text) to authenticated;

-- ---------- Vérifier un repère sur le terrain ----------
create or replace function public.map_verify(p_landmark uuid, p_type text, p_result text, p_notes text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_lm public.landmarks%rowtype;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  select * into v_lm from public.landmarks where id = p_landmark;
  if not found then raise exception 'Repère introuvable'; end if;
  if not public.map_can('verify', v_lm.zone_id, v_lm.category_code) then raise exception 'Droits insuffisants'; end if;
  if p_type not in ('field_visit','photo','owner','document') or p_result not in ('confirmed','moved','closed','wrong') then
    raise exception 'Valeur invalide';
  end if;
  insert into public.landmark_verifications (landmark_id, verifier_id, verification_type, result, notes)
  values (p_landmark, auth.uid(), p_type, p_result, left(p_notes, 500));
  perform set_config('dabbymap.change_reason', 'vérification ' || p_result, true);
  if p_result = 'confirmed' then
    update public.landmarks
       set verification_status = case when verification_status in ('claimed_verified','institutional') then verification_status else 'verified' end,
           verified_at = now(), publication_status = case when publication_status = 'to_fix' then 'published' else publication_status end
     where id = p_landmark;
  else
    update public.landmarks set publication_status = 'to_fix' where id = p_landmark and publication_status = 'published';
  end if;
end $$;
revoke execute on function public.map_verify(uuid, text, text, text) from public, anon;
grant execute on function public.map_verify(uuid, text, text, text) to authenticated;

-- ---------- Valider / refuser une photo ----------
create or replace function public.map_review_photo(p_photo uuid, p_approve boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare v_lm public.landmarks%rowtype; v_ph public.landmark_photos%rowtype;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  select * into v_ph from public.landmark_photos where id = p_photo;
  if not found then raise exception 'Photo introuvable'; end if;
  select * into v_lm from public.landmarks where id = v_ph.landmark_id;
  if not public.map_can('moderate', v_lm.zone_id, v_lm.category_code) then raise exception 'Droits insuffisants'; end if;
  update public.landmark_photos set verification_status = case when p_approve then 'approved' else 'rejected' end where id = p_photo;
end $$;
revoke execute on function public.map_review_photo(uuid, boolean) from public, anon;
grant execute on function public.map_review_photo(uuid, boolean) to authenticated;

-- ---------- Stockage des photos de repères ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('landmark-photos', 'landmark-photos', true, 1048576, array['image/webp','image/jpeg'])
on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "Photos repères : lecture publique" on storage.objects for select using (bucket_id = 'landmark-photos');
create policy "Photos repères : dépôt dans son dossier" on storage.objects for insert to authenticated with check (
  bucket_id = 'landmark-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Photos repères : suppression des siennes" on storage.objects for delete to authenticated using (
  bucket_id = 'landmark-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------- Données de départ ----------
insert into public.landmark_categories (code, label_fr, label_en, icon, default_importance, sort_order) values
  ('repere_routier','Rond-point / carrefour','Roundabout / junction','circle-dot',5,10),
  ('station_service','Station-service','Fuel station','fuel',4,20),
  ('commerce','Marché / grand commerce','Market / large store','shopping-basket',4,30),
  ('institution','Administration / sécurité','Public institution','landmark',4,40),
  ('education','École / université','School / university','graduation-cap',3,50),
  ('sante','Santé','Health','cross',3,60),
  ('transport','Gare routière / agence de voyage','Bus station / travel agency','bus',3,70),
  ('communautaire','Lieu de culte / communautaire','Worship / community','church',3,80),
  ('remarquable','Lieu remarquable / hôtel','Notable place / hotel','star',2,90),
  ('autre','Autre repère','Other landmark','map-pin',2,100)
on conflict (code) do nothing;

insert into public.geo_zones (code, name, kind, center_lat, center_lng, radius_m, navigation_enabled) values
  ('cameroun','Cameroun','country',7.37,12.35,700000,false)
on conflict (code) do nothing;
insert into public.geo_zones (code, name, kind, parent_id, center_lat, center_lng, radius_m, navigation_enabled)
select v.code, v.name, v.kind, (select id from public.geo_zones where code = v.parent), v.lat, v.lng, v.r, v.nav
from (values
  ('yaounde','Yaoundé','city','cameroun',3.848,11.502,25000,true),
  ('douala','Douala','city','cameroun',4.0511,9.7679,25000,true),
  ('etoudi','Étoudi (zone pilote)','pilot','yaounde',3.9177,11.5285,1800,true)
) as v(code, name, kind, parent, lat, lng, r, nav)
on conflict (code) do nothing;
-- Les rayons des zones sont des valeurs approximatives, modifiables dans geo_zones.

-- ---------- Jeu de départ d'Étoudi : 52 repères issus d'OpenStreetMap ----------
-- Statut « non vérifié » : à confirmer sur le terrain par les agents. Rejouable sans doublon.
insert into public.landmarks (name, category_code, lat, lng, importance, verification_status, publication_status,
                              source_type, source_ref, source_attribution)
select v.name, v.cat, v.lat, v.lng, v.imp, 'unverified', 'published', 'osm', v.ref,
       '© contributeurs OpenStreetMap (ODbL)'
from (values
  ('Marché Étoudi', 'commerce', 3.914893, 11.525264, 4, 'way/218539508'),
  ('Dovv, Tongolo', 'commerce', 3.90814, 11.528772, 4, 'way/525564645'),
  ('Petit Marché De Fruit', 'commerce', 3.922, 11.538728, 4, 'node/7184499271'),
  ('DOVV NGOUSSO', 'commerce', 3.908155, 11.541344, 4, 'node/7165885470'),
  ('Gendarmerie, Brigade d''Etoudi', 'institution', 3.916825, 11.530838, 4, 'way/191996188'),
  ('Commissariat d''Etoudi', 'institution', 3.912769, 11.52719, 4, 'way/192009223'),
  ('Mairie de Yaoundé 1', 'institution', 3.903669, 11.523637, 4, 'way/1450200008'),
  ('Neptune Etoudi', 'station_service', 3.917875, 11.527888, 4, 'node/9041239828'),
  ('Gulfin-Santa Barbara', 'station_service', 3.915036, 11.532122, 4, 'node/9779831590'),
  ('TOTAL Etoudi', 'station_service', 3.914248, 11.525596, 4, 'node/9041250683'),
  ('MRS Emana 1', 'station_service', 3.916963, 11.520344, 4, 'way/410578743'),
  ('Oilibya Emana', 'station_service', 3.917805, 11.520193, 4, 'way/410578744'),
  ('DELTA PETROLEUM', 'station_service', 3.90987, 11.524728, 4, 'way/192007408'),
  ('Total Carrefour Yannick', 'station_service', 3.908393, 11.52843, 4, 'way/525564642'),
  ('Tradex Emana', 'station_service', 3.926433, 11.520229, 4, 'way/410579802'),
  ('Ola Energy, Rail Ngousso', 'station_service', 3.908512, 11.53668, 4, 'way/525560428'),
  ('Salle du Royaume Etoudi', 'communautaire', 3.913957, 11.525858, 3, 'node/10726221111'),
  ('Église Presbytérienne Camerounaise', 'communautaire', 3.924334, 11.542419, 3, 'way/191823169'),
  ('Saint-Jhon''s Church', 'communautaire', 3.911534, 11.54345, 3, 'way/219557189'),
  ('École Sainte-Cathérine', 'education', 3.91872, 11.52802, 3, 'way/219833861'),
  ('École Maternielle Sainte Catherine', 'education', 3.92006, 11.527221, 3, 'way/219833795'),
  ('Pi and Ju École de l''Avenir', 'education', 3.919868, 11.530685, 3, 'way/191994391'),
  ('Collége Jean Tabi', 'education', 3.918131, 11.525459, 3, 'way/219833722'),
  ('École Primaire Catholique Saint Aloys Etoudi', 'education', 3.916993, 11.525487, 3, 'way/219833797'),
  ('EPL les Charlottins', 'education', 3.916206, 11.531338, 3, 'way/219956426'),
  ('la Reférence', 'education', 3.919513, 11.531314, 3, 'way/219956438'),
  ('Centre Educatif Maffodong', 'education', 3.919895, 11.533894, 3, 'way/191994277'),
  ('Collége Prime FAPO', 'education', 3.921842, 11.532992, 3, 'way/219325825'),
  ('Collége FIDO', 'education', 3.915218, 11.535121, 3, 'way/219956422'),
  ('Chefferie De 3e Degre De Nkolbong', 'institution', 3.918979, 11.541566, 3, 'node/7166374506'),
  ('3ème Degré Bloc 2', 'institution', 3.916393, 11.542239, 3, 'node/7166374507'),
  ('Centre National de Production des Passeports', 'institution', 3.905157, 11.522892, 3, 'way/977027029'),
  ('3eme Degrés Bloc I', 'institution', 3.921701, 11.542257, 3, 'node/7166374508'),
  ('Maternité Marie Étoudi', 'sante', 3.918775, 11.527542, 3, 'way/191996250'),
  ('Clinique Sainte Thérèse d''Etoudi', 'sante', 3.916606, 11.527252, 3, 'way/191994336'),
  ('Pharmacie du Palais', 'sante', 3.914515, 11.525617, 3, 'way/218797804'),
  ('Pharmacie d''Étondi', 'sante', 3.916441, 11.523472, 3, 'way/218797796'),
  ('Docteur EDU', 'sante', 3.910922, 11.52663, 3, 'node/9111838417'),
  ('CAI', 'sante', 3.91, 11.525572, 3, 'way/219052046'),
  ('Holly Anna''health Center', 'sante', 3.917691, 11.538913, 3, 'node/7166804631'),
  ('Pharmacie de Tongolo', 'sante', 3.906815, 11.52501, 3, 'way/218797797'),
  ('Cabinet De Soins Espoir,santé & Vie', 'sante', 3.921095, 11.53968, 3, 'node/7166799775'),
  ('Centee De Santé God''s Will', 'sante', 3.920644, 11.540711, 3, 'node/7166814055'),
  ('Binam Voyages', 'transport', 3.908116, 11.529305, 3, 'node/5112590483'),
  ('Amigo Voyages', 'transport', 3.907482, 11.526504, 3, 'node/5125881350'),
  ('General Express', 'transport', 3.904218, 11.526138, 3, 'node/1103614025'),
  ('Hôtel Saphir', 'remarquable', 3.91964, 11.530846, 2, 'way/191994770'),
  ('Hôtel Les Platanes', 'remarquable', 3.91872, 11.520607, 2, 'way/410579801'),
  ('Summit palace', 'remarquable', 3.909013, 11.526819, 2, 'node/9111649017'),
  ('Segmad Hôtel', 'remarquable', 3.909395, 11.539906, 2, 'node/7193048413'),
  ('Menat Hotel', 'remarquable', 3.90376, 11.53392, 2, 'node/13747726143'),
  ('Hotel Blanco', 'remarquable', 3.908599, 11.540906, 2, 'node/7193030669')
) as v(name, cat, lat, lng, imp, ref)
on conflict (source_type, source_ref) where source_ref is not null do nothing;
