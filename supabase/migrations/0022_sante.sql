-- =========================================================
-- DabbyMarket — 0022 : VOLET SANTÉ (S0 annuaire, S1 services/équipements,
--                      S2 médicaments — désactivé par défaut)
--
-- Principes :
--   * Seuls des établissements VÉRIFIÉS par un administrateur peuvent publier
--     dans la catégorie « santé » (aucun particulier, aucune boutique générale).
--   * Pas de boost, pas de vente flash, pas de vitrine payante pour la santé :
--     la visibilité ne s'achète pas sur ce sujet.
--   * Pas d'avis texte libre sur la santé, pas d'alertes de disponibilité,
--     et les recherches de santé ne sont PAS journalisées (données sensibles).
--   * S2 (médicaments) : interrupteur `health_s2_enabled` = 0 par défaut.
--     À n'activer qu'après avis juridique (ordonnance, loi 2024/017 sur les
--     données personnelles). Seuls les produits du référentiel `drug_reference`
--     (curaté par l'admin) sont publiables ; les substances « controlled » ne
--     le sont jamais.
--   * Les prix des produits de santé ne sont pas affichés par la recherche tant
--     que `health_show_prices` = 0.
--
-- Additive. Retour arrière : ROLLBACK_0022.sql
-- =========================================================

-- 1. Réglages
insert into app_config (key, value, description) values
  ('health_s2_enabled', '0', 'S2 : autoriser la publication de médicaments (0 = non). NE PAS ACTIVER sans avis juridique.'),
  ('health_show_prices', '0', 'Afficher les prix des offres de santé dans la recherche (0 = non).'),
  ('health_profile_valid_months', '12', 'Durée de validité d''une vérification d''établissement de santé avant renouvellement.')
on conflict (key) do nothing;

-- 2. Sous-catégories (feuilles) sous « sante »
insert into product_categories (id, parent_id, name_fr, name_en, sort_order, active, ttl_hours, is_regulated, allow_stock)
values
  ('sante-pharmacie',   'sante', 'Pharmacie (médicaments)',        'Pharmacy (medicines)',   10, true, 6,  true, true),
  ('sante-services',    'sante', 'Services de santé',              'Health services',        20, true, 24, true, true),
  ('sante-equipements', 'sante', 'Équipements et consommables',    'Equipment & supplies',   30, true, 24, true, true)
on conflict (id) do nothing;

-- 3. Profil d'établissement de santé (privé côté champs d'autorisation)
create table if not exists health_profiles (
  shop_id            uuid primary key references shops(id) on delete cascade,
  facility_type      text not null check (facility_type in ('pharmacie','hopital','centre_sante','laboratoire','imagerie','cabinet','autre')),
  authorization_ref  text not null check (char_length(authorization_ref) between 3 and 120),
  responsible_name   text not null check (char_length(responsible_name) between 2 and 120),
  status             text not null default 'pending' check (status in ('pending','verified','rejected','suspended','expired')),
  verified_by        uuid references profiles(id),
  verified_at        timestamptz,
  expires_at         timestamptz,
  review_note        text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
alter table health_profiles enable row level security;
drop policy if exists "Santé : lecture propriétaire ou admin" on health_profiles;
create policy "Santé : lecture propriétaire ou admin" on health_profiles for select
  using (dm_is_admin() or exists (select 1 from shops s where s.id = shop_id and s.owner_id = auth.uid()));
-- aucune politique d'écriture : tout passe par les fonctions ci-dessous

create or replace function dm_is_health_shop(p_shop uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from health_profiles where shop_id = p_shop);
$$;
create or replace function dm_health_verified(p_shop uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from health_profiles h join shops s on s.id = h.shop_id
    where h.shop_id = p_shop and h.status = 'verified'
      and (h.expires_at is null or h.expires_at > now()) and not s.is_blocked);
$$;
create or replace function dm_health_visible(p_shop uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select dm_health_verified(p_shop);
$$;
grant execute on function dm_is_health_shop(uuid), dm_health_verified(uuid), dm_health_visible(uuid) to anon, authenticated;

-- 4. Annuaire public (S0) : uniquement les établissements vérifiés, sans champs privés
create table if not exists health_duty_periods (
  id        uuid primary key default gen_random_uuid(),
  shop_id   uuid not null references shops(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at   timestamptz not null,
  note      text check (char_length(note) <= 200),
  check (ends_at > starts_at and ends_at - starts_at <= interval '31 days')
);
alter table health_duty_periods enable row level security;
drop policy if exists "Garde : lecture publique si vérifié" on health_duty_periods;
create policy "Garde : lecture publique si vérifié" on health_duty_periods for select
  using (dm_health_verified(shop_id) or dm_is_admin());
drop policy if exists "Garde : gestion propriétaire vérifié" on health_duty_periods;
create policy "Garde : gestion propriétaire vérifié" on health_duty_periods for all
  using (exists (select 1 from shops s where s.id = shop_id and s.owner_id = auth.uid()) and dm_health_verified(shop_id))
  with check (exists (select 1 from shops s where s.id = shop_id and s.owner_id = auth.uid()) and dm_health_verified(shop_id));

create or replace view health_facilities_public as
select s.id as shop_id, s.name, s.city, s.neighborhood, s.landmark, s.lat, s.lng, s.hours,
       h.facility_type, h.verified_at, h.expires_at,
       exists (select 1 from health_duty_periods d where d.shop_id = s.id and now() between d.starts_at and d.ends_at) as on_duty_now
from health_profiles h join shops s on s.id = h.shop_id
where h.status = 'verified' and (h.expires_at is null or h.expires_at > now()) and not s.is_blocked;
grant select on health_facilities_public to anon, authenticated;

-- 5. Dépôt et instruction du dossier
create or replace function submit_health_profile(p_shop uuid, p_facility_type text, p_authorization_ref text, p_responsible_name text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if not exists (select 1 from shops where id = p_shop and owner_id = auth.uid()) then
    raise exception 'Boutique introuvable ou non autorisée';
  end if;
  insert into health_profiles (shop_id, facility_type, authorization_ref, responsible_name, status)
  values (p_shop, p_facility_type, btrim(p_authorization_ref), btrim(p_responsible_name), 'pending')
  on conflict (shop_id) do update set
    facility_type = excluded.facility_type, authorization_ref = excluded.authorization_ref,
    responsible_name = excluded.responsible_name, status = 'pending',
    verified_by = null, verified_at = null, expires_at = null, review_note = null, updated_at = now();
  -- toute modification du dossier retire l'établissement de l'annuaire jusqu'à nouvelle vérification
  perform health_deactivate_offers(p_shop);
end; $$;

create or replace function health_deactivate_offers(p_shop uuid)
returns void language sql security definer set search_path = public as $$
  update products set is_active = false, is_showcased = false, boosted_until = null
  where shop_id = p_shop and is_active and dm_category_is_health(category);
$$;

create or replace function admin_set_health_status(p_shop uuid, p_status text, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_owner uuid;
begin
  if not dm_is_admin() then raise exception 'Réservé aux administrateurs'; end if;
  if p_status not in ('verified','rejected','suspended') then raise exception 'Statut invalide'; end if;
  if p_status <> 'verified' and (p_note is null or btrim(p_note) = '') then
    raise exception 'Un motif est obligatoire pour refuser ou suspendre';
  end if;
  update health_profiles set status = p_status, review_note = p_note, updated_at = now(),
    verified_by = case when p_status = 'verified' then auth.uid() end,
    verified_at = case when p_status = 'verified' then now() end,
    expires_at  = case when p_status = 'verified' then now() + make_interval(months => coalesce(config_int('health_profile_valid_months'), 12)) end
  where shop_id = p_shop;
  if not found then raise exception 'Dossier introuvable'; end if;
  if p_status <> 'verified' then perform health_deactivate_offers(p_shop); end if;
  select owner_id into v_owner from shops where id = p_shop;
  perform dm_push_notification(v_owner, 'merchant', 'system',
    case p_status when 'verified' then 'Établissement de santé vérifié' when 'rejected' then 'Dossier santé refusé' else 'Établissement de santé suspendu' end,
    coalesce(p_note, 'Votre établissement peut désormais publier dans la rubrique Santé.'),
    '/shop', jsonb_build_object('health_status', p_status), 'health-' || p_shop || '-' || p_status || '-' || to_char(now(), 'YYYYMMDDHH24MISS'), null);
end; $$;
grant execute on function submit_health_profile(uuid, text, text, text), admin_set_health_status(uuid, text, text) to authenticated;

-- Expiration quotidienne des vérifications
create or replace function health_expire_profiles()
returns integer language plpgsql security definer set search_path = public as $$
declare r record; n integer := 0;
begin
  for r in select h.shop_id, s.owner_id from health_profiles h join shops s on s.id = h.shop_id
           where h.status = 'verified' and h.expires_at <= now() loop
    update health_profiles set status = 'expired', updated_at = now() where shop_id = r.shop_id;
    perform health_deactivate_offers(r.shop_id);
    perform dm_push_notification(r.owner_id, 'merchant', 'system', 'Vérification santé expirée',
      'Renouvelez votre dossier pour republier vos offres de santé.', '/shop', jsonb_build_object('health_status', 'expired'),
      'health-expired-' || r.shop_id || '-' || to_char(now(), 'YYYYMMDD'), null);
    n := n + 1;
  end loop;
  return n;
end; $$;
select cron.schedule('dabbymarket-health-expire', '0 4 * * *', $$select health_expire_profiles();$$);

-- 6. Référentiel de médicaments (curaté par l'admin, S2)
create table if not exists drug_reference (
  catalog_item_id uuid primary key references catalog_items(id) on delete cascade,
  dci             text not null,
  dosage          text,
  forme           text,
  presentation    text,
  fabricant       text,
  rx_status       text not null default 'prescription' check (rx_status in ('prescription','otc_listed','controlled')),
  created_at      timestamptz not null default now()
);
alter table drug_reference enable row level security;
drop policy if exists "Médicaments : lecture" on drug_reference;
create policy "Médicaments : lecture" on drug_reference for select using (true);
drop policy if exists "Médicaments : gestion admin" on drug_reference;
create policy "Médicaments : gestion admin" on drug_reference for all using (dm_is_admin()) with check (dm_is_admin());

-- 7. Garde-fou sur les offres de santé
create or replace function products_health_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_rx text;
begin
  if not dm_category_is_health(new.category) then return new; end if;
  if not new.is_active then return new; end if;
  if new.category = 'sante' then
    raise exception 'Choisissez une sous-catégorie de santé (pharmacie, services, équipements).';
  end if;
  if not dm_health_verified(new.shop_id) then
    raise exception 'La rubrique Santé est réservée aux établissements vérifiés. Déposez votre dossier depuis votre espace marchand.';
  end if;
  new.boosted_until := null;
  new.is_showcased := false;
  new.showcased_at := null;
  if new.category = 'sante-pharmacie' then
    if coalesce(config_int('health_s2_enabled'), 0) <> 1 then
      raise exception 'La vente de médicaments n''est pas encore ouverte sur DabbyMarket.';
    end if;
    select d.rx_status into v_rx from drug_reference d where d.catalog_item_id = new.catalog_item_id;
    if v_rx is null then
      raise exception 'Ce médicament doit être choisi dans le référentiel officiel (pas de saisie libre).';
    end if;
    if v_rx = 'controlled' then
      raise exception 'Ce produit ne peut pas être publié sur DabbyMarket.';
    end if;
  end if;
  return new;
end; $$;
drop trigger if exists trg_products_health_guard on products;
create trigger trg_products_health_guard before insert or update on products
  for each row execute function products_health_guard();

-- Fermeture de S2 : les offres de médicaments sont désactivées automatiquement
create or replace function health_s2_switch_sync()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.key = 'health_s2_enabled' and new.value is distinct from '1' then
    update products set is_active = false where category = 'sante-pharmacie' and is_active;
  end if;
  return new;
end; $$;
drop trigger if exists trg_health_s2_switch_sync on app_config;
create trigger trg_health_s2_switch_sync after insert or update on app_config
  for each row execute function health_s2_switch_sync();

-- 8. Pas de boost ni de vente flash pour la santé
create or replace function boosts_reliability_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_shop uuid; v_status text; v_cat text;
begin
  v_shop := case new.target_type when 'shop' then new.target_id
                                 when 'product' then (select shop_id from products where id = new.target_id) end;
  if v_shop is null then return new; end if;
  if dm_is_health_shop(v_shop) then
    raise exception 'Les boosts ne sont pas disponibles pour les établissements de santé.';
  end if;
  if new.target_type = 'product' then
    select category into v_cat from products where id = new.target_id;
    if dm_category_is_health(v_cat) then
      raise exception 'Les boosts ne sont pas disponibles pour les produits de santé.';
    end if;
  end if;
  select reliability_status into v_status from shops where id = v_shop;
  if v_status in ('unreliable', 'boost_suspended') then
    raise exception 'Les boosts sont suspendus pour cette boutique (fiabilité des informations insuffisante). Vous pouvez contester depuis votre espace marchand.';
  end if;
  return new;
end; $$;

create or replace function flash_health_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if dm_category_is_health(new.category) then
    raise exception 'Les ventes flash ne sont pas autorisées dans la catégorie Santé.';
  end if;
  return new;
end; $$;
drop trigger if exists trg_flash_health_guard on flash_listings;
create trigger trg_flash_health_guard before insert or update of category on flash_listings
  for each row execute function flash_health_guard();

-- 9. Pas d'avis sur les produits de santé
create or replace function product_reviews_health_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_cat text;
begin
  select category into v_cat from products where id = new.product_id;
  if dm_category_is_health(v_cat) then
    raise exception 'Les avis sur les produits de santé sont désactivés.';
  end if;
  return new;
end; $$;
drop trigger if exists trg_product_reviews_health_guard on product_reviews;
create trigger trg_product_reviews_health_guard before insert on product_reviews
  for each row execute function product_reviews_health_guard();

-- 10. Confidentialité : recherches et alertes de santé
create or replace function dm_is_health_query(p_query text, p_catalog_item uuid default null)
returns boolean language sql stable security definer set search_path = public as $$
  select
    coalesce(dm_norm(p_query) ~ '(medicament|pharmac|ordonnance|antibio|paracetamol|amoxicilline|quinine|artemether|coartem|vih|sida|paludisme|palu|test de grossesse|contracepti|preservatif|avortement|depression|tuberculose|diabete|insuline|hypertension|hepatite|cancer|chimiotherap|dialyse|sirop|comprime|gelule|vaccin)', false)
    or exists (select 1 from catalog_items c where c.id = p_catalog_item and dm_category_is_health(c.category_id))
    or exists (select 1 from catalog_items c
               where dm_category_is_health(c.category_id) and char_length(dm_norm(p_query)) >= 3
                 and (dm_norm(c.name_fr) = dm_norm(p_query) or dm_norm(p_query) = any (select dm_norm(x) from unnest(c.synonyms) x)))
    or exists (select 1 from drug_reference d where char_length(dm_norm(p_query)) >= 4 and dm_norm(d.dci) = dm_norm(p_query));
$$;
grant execute on function dm_is_health_query(text, uuid) to anon, authenticated;

create or replace function log_search_demand(p_query text, p_catalog_item uuid default null, p_neighborhood text default null, p_city text default null, p_results integer default 0)
returns void language plpgsql security definer set search_path = public as $$
declare v_q text := btrim(dm_norm(p_query));
begin
  if auth.uid() is null or v_q is null or char_length(v_q) < 2 or char_length(v_q) > 80 then return; end if;
  if dm_is_health_query(v_q, p_catalog_item) then return; end if;
  insert into search_demand_log (user_id, query_norm, catalog_item_id, neighborhood, city, results_available)
  values (auth.uid(), v_q, p_catalog_item, nullif(btrim(p_neighborhood), ''), nullif(btrim(p_city), ''), greatest(coalesce(p_results, 0), 0))
  on conflict (user_id, query_norm, day) do nothing;
end; $$;

-- filet de sécurité : aucune ligne de santé ne peut entrer dans le journal, quel que soit le chemin
create or replace function search_demand_health_filter()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if dm_is_health_query(new.query_norm, new.catalog_item_id) then return null; end if;
  return new;
end; $$;
drop trigger if exists trg_search_demand_health_filter on search_demand_log;
create trigger trg_search_demand_health_filter before insert on search_demand_log
  for each row execute function search_demand_health_filter();

create or replace function availability_alerts_health_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_cat text;
begin
  if new.product_id is not null then select category into v_cat from products where id = new.product_id;
     if dm_category_is_health(v_cat) then raise exception 'Les alertes ne sont pas disponibles pour les produits de santé.'; end if; end if;
  if dm_is_health_query(new.query, new.catalog_item_id) then
    raise exception 'Les alertes ne sont pas disponibles pour les produits de santé.';
  end if;
  return new;
end; $$;
drop trigger if exists trg_availability_alerts_health_guard on availability_alerts;
create trigger trg_availability_alerts_health_guard before insert or update on availability_alerts
  for each row execute function availability_alerts_health_guard();

-- purge de l'existant
delete from search_demand_log where dm_is_health_query(query_norm, catalog_item_id);
update availability_alerts set active = false
  where active and (dm_is_health_query(query, catalog_item_id)
    or product_id in (select id from products where dm_category_is_health(category)));
