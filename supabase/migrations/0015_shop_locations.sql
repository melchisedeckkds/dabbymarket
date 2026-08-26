-- =========================================================
-- DabbyMarket — 0015 : emplacements multiples + historique de
-- déménagement pour les boutiques physiques.
--
-- Conçue pour ne RIEN casser de l'existant : shops.lat/lng/neighborhood/
-- landmark restent en place et continuent d'alimenter tout le code actuel
-- (Carte, Boutique, CreerBoutique) via l'emplacement "principal" — c'est
-- shop_locations qui ajoute, par-dessus, la possibilité d'avoir plusieurs
-- adresses actives et un historique des anciennes.
-- =========================================================

create table if not exists shop_locations (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  neighborhood text,
  city text not null default 'Yaoundé',
  landmark text,
  label text, -- ex. "Agence Bastos", "Succursale Marché Central" — facultatif
  is_primary boolean not null default false, -- l'emplacement reflété sur shops.lat/lng (compatibilité)
  is_current boolean not null default true,  -- false = ancien emplacement (déménagement), conservé pour historique
  moved_at timestamptz not null default now(),   -- depuis quand cet emplacement est/était valide
  replaced_at timestamptz,                        -- quand il a cessé d'être courant (null si toujours actif)
  created_at timestamptz not null default now()
);

alter table shop_locations enable row level security;
create policy "Emplacements visibles par tous" on shop_locations for select using (true);
create policy "Le propriétaire gère les emplacements de sa boutique" on shop_locations for all
  using (exists (select 1 from shops s where s.id = shop_id and s.owner_id = auth.uid()))
  with check (exists (select 1 from shops s where s.id = shop_id and s.owner_id = auth.uid()));

create index if not exists shop_locations_shop_idx on shop_locations (shop_id, is_current);
create index if not exists shop_locations_current_idx on shop_locations (is_current) where is_current;

-- ---------------------------------------------------------
-- Rétro-compatibilité : une ligne "principale" par boutique physique déjà
-- existante, reflétant exactement shops.lat/lng actuels.
-- ---------------------------------------------------------
insert into shop_locations (shop_id, lat, lng, neighborhood, city, landmark, is_primary, is_current, moved_at)
select id, lat, lng, neighborhood, coalesce(city, 'Yaoundé'), landmark, true, true, created_at
from shops
where shop_type = 'physical' and lat is not null and lng is not null
  and not exists (select 1 from shop_locations sl where sl.shop_id = shops.id);

-- ---------------------------------------------------------
-- Nouvelle boutique physique : crée automatiquement son emplacement
-- principal dans shop_locations — aucune modification requise dans
-- CreerBoutique.tsx, qui continue d'insérer lat/lng directement sur shops.
-- ---------------------------------------------------------
create or replace function sync_primary_shop_location()
returns trigger language plpgsql security definer as $$
begin
  if new.shop_type = 'physical' and new.lat is not null and new.lng is not null then
    insert into shop_locations (shop_id, lat, lng, neighborhood, city, landmark, is_primary, is_current, moved_at)
    values (new.id, new.lat, new.lng, new.neighborhood, coalesce(new.city, 'Yaoundé'), new.landmark, true, true, now());
  end if;
  return new;
end; $$;

drop trigger if exists trg_sync_primary_shop_location on shops;
create trigger trg_sync_primary_shop_location
  after insert on shops
  for each row execute function sync_primary_shop_location();

-- ---------------------------------------------------------
-- Ajouter une succursale (emplacement supplémentaire actif) — n'affecte
-- jamais les emplacements déjà existants.
-- ---------------------------------------------------------
create or replace function add_shop_location(
  p_shop_id uuid, p_lat double precision, p_lng double precision,
  p_neighborhood text, p_city text, p_landmark text, p_label text default null
)
returns uuid language plpgsql security definer as $$
declare v_id uuid;
begin
  if not exists (select 1 from shops where id = p_shop_id and owner_id = auth.uid()) then
    raise exception 'Vous ne pouvez ajouter un emplacement qu''à votre propre boutique';
  end if;
  insert into shop_locations (shop_id, lat, lng, neighborhood, city, landmark, label, is_primary, is_current)
    values (p_shop_id, p_lat, p_lng, p_neighborhood, coalesce(p_city, 'Yaoundé'), p_landmark, p_label, false, true)
    returning id into v_id;
  return v_id;
end; $$;
grant execute on function add_shop_location(uuid, double precision, double precision, text, text, text, text) to authenticated;

-- ---------------------------------------------------------
-- Déménager un emplacement existant : l'ancien devient historique
-- (is_current=false, replaced_at renseigné) et un nouvel emplacement
-- prend sa place, visible par tous — la Carte s'adapte automatiquement
-- car elle ne lit jamais que is_current=true. Si l'emplacement déménagé
-- était le principal, shops.lat/lng est mis à jour pour rester cohérent
-- avec tout le code existant qui les lit directement.
-- ---------------------------------------------------------
create or replace function relocate_shop_location(
  p_location_id uuid, p_lat double precision, p_lng double precision,
  p_neighborhood text, p_city text, p_landmark text
)
returns uuid language plpgsql security definer as $$
declare
  v_old shop_locations%rowtype;
  v_new_id uuid;
begin
  select * into v_old from shop_locations where id = p_location_id;
  if v_old.id is null then raise exception 'Emplacement introuvable'; end if;
  if not exists (select 1 from shops where id = v_old.shop_id and owner_id = auth.uid()) then
    raise exception 'Vous ne pouvez déplacer qu''un emplacement de votre propre boutique';
  end if;

  update shop_locations set is_current = false, replaced_at = now() where id = p_location_id;

  insert into shop_locations (shop_id, lat, lng, neighborhood, city, landmark, label, is_primary, is_current, moved_at)
    values (v_old.shop_id, p_lat, p_lng, p_neighborhood, coalesce(p_city, 'Yaoundé'), p_landmark, v_old.label, v_old.is_primary, true, now())
    returning id into v_new_id;

  if v_old.is_primary then
    update shops set lat = p_lat, lng = p_lng, neighborhood = p_neighborhood, city = coalesce(p_city, 'Yaoundé'), landmark = p_landmark
      where id = v_old.shop_id;
  end if;

  return v_new_id;
end; $$;
grant execute on function relocate_shop_location(uuid, double precision, double precision, text, text, text) to authenticated;

-- Fermer définitivement une succursale (elle n'est plus exploitée).
create or replace function close_shop_location(p_location_id uuid)
returns void language plpgsql security definer as $$
begin
  if not exists (
    select 1 from shop_locations sl join shops s on s.id = sl.shop_id
    where sl.id = p_location_id and s.owner_id = auth.uid()
  ) then
    raise exception 'Vous ne pouvez fermer qu''un emplacement de votre propre boutique';
  end if;
  update shop_locations set is_current = false, replaced_at = now() where id = p_location_id;
end; $$;
grant execute on function close_shop_location(uuid) to authenticated;

-- Vue pratique : tous les emplacements actifs, avec les infos boutique
-- utiles à l'affichage carte, sans avoir à tout rejoindre côté client.
create or replace view active_shop_locations
with (security_invoker = true) as
select
  sl.id as location_id, sl.shop_id, sl.lat, sl.lng, sl.neighborhood, sl.city, sl.landmark, sl.label, sl.is_primary,
  s.name, s.category, s.logo_url, s.verified, s.owner_id, s.delivery_zone, s.hours, s.shop_type
from shop_locations sl
join shops s on s.id = sl.shop_id
where sl.is_current;

grant select on active_shop_locations to anon, authenticated;
