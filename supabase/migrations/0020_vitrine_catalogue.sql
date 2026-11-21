-- =========================================================
-- DabbyMarket — 0020 : VITRINE (3 articles) et CATALOGUE (tout)
--
-- Décision (20-21 nov. 2026) :
--   * Le Marché n'est qu'une VITRINE : 3 articles par boutique (quota
--     gratuit existant `free_active_listings_quota`), + emplacements
--     supplémentaires payants et facultatifs.
--   * Le CATALOGUE est illimité (plafond anti-abus configurable) : tous les
--     articles actifs sont trouvables par la recherche, y compris ceux dont
--     la disponibilité n'est pas confirmée ou qui sont en rupture (affichés
--     avec leur vrai statut, jamais masqués).
--   * Un boost ne modifie jamais le classement de recherche : il est
--     renvoyé comme indicateur `sponsored` pour un encart séparé.
--   * La facturation automatique des dépassements (0012) est supprimée :
--     les articles au-delà de la vitrine sont du catalogue, pas du hors-quota.
--
-- Additive : aucune colonne ni donnée existante n'est supprimée.
-- Retour arrière : ROLLBACK_0020.sql
-- =========================================================

-- ---------------------------------------------------------
-- 1. Réglages (modifiables sans déploiement, onglet Économie de l'admin)
-- ---------------------------------------------------------
insert into app_config (key, value, description) values
  ('catalog_max_items_per_shop', '200', 'Plafond anti-abus : nombre maximal d''articles de catalogue (hors disponibilité) par boutique. Hypothèse de départ.'),
  ('showcase_slot_price_pepites', '30', 'Prix (en Pépites) d''un emplacement de vitrine supplémentaire. Hypothèse à valider.'),
  ('showcase_slot_days', '30', 'Durée (jours) d''un emplacement de vitrine supplémentaire acheté')
on conflict (key) do nothing;

-- ---------------------------------------------------------
-- 2. Colonnes de vitrine sur products
-- ---------------------------------------------------------
alter table products add column if not exists is_showcased boolean not null default false;
alter table products add column if not exists showcased_at timestamptz;
create index if not exists products_showcase_idx on products (shop_id) where is_showcased;
create index if not exists products_showcased_feed_idx on products (created_at desc) where is_showcased;

-- ---------------------------------------------------------
-- 3. Emplacements de vitrine supplémentaires (achetés avec des Pépites)
-- ---------------------------------------------------------
create table if not exists showcase_slots (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,
  buyer_id uuid not null references profiles(id) on delete cascade,
  slots integer not null default 1 check (slots between 1 and 20),
  starts_at timestamptz not null default now(),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists showcase_slots_shop_idx on showcase_slots (shop_id, expires_at);
alter table showcase_slots enable row level security;
drop policy if exists "Emplacements : lecture propriétaire ou admin" on showcase_slots;
create policy "Emplacements : lecture propriétaire ou admin" on showcase_slots for select using (
  exists (select 1 from shops s where s.id = shop_id and s.owner_id = auth.uid()) or dm_is_admin()
);
-- Aucune politique d'écriture : seuls les achats par fonction serveur créent des lignes.

alter table pepites_transactions drop constraint if exists pepites_transactions_type_check;
alter table pepites_transactions add constraint pepites_transactions_type_check
  check (type in ('recharge','publish','boost_product','boost_shop','admin_grant','admin_adjustment',
                  'boost_purchase','welcome_bonus','welcome_bonus_expired','quota_overage','quota_overage_failed',
                  'flash_publish','flash_extend','showcase_slot'));

-- Nouveau type de notification (centre de notifications de 0018)
alter table notifications drop constraint if exists notifications_kind_check;
alter table notifications add constraint notifications_kind_check
  check (kind in ('restock','price_change','new_product','review_received','availability_report','demand',
                  'stale_reminder','system','showcase_reduced'));

-- ---------------------------------------------------------
-- 4. Fonctions utilitaires
-- ---------------------------------------------------------
-- Vrai si la catégorie appartient à l'arbre « sante » (voir 0022).
create or replace function dm_category_is_health(p_cat text)
returns boolean language sql stable set search_path = public as $$
  with recursive up as (
    select id, parent_id from product_categories where id = p_cat
    union all
    select c.id, c.parent_id from product_categories c join up on up.parent_id = c.id
  )
  select coalesce(bool_or(id = 'sante'), false) from up;
$$;
grant execute on function dm_category_is_health(text) to anon, authenticated;

-- Substituts redéfinis par 0022 (santé) : tant que le module santé n'est pas
-- installé, aucun établissement n'est « de santé » et rien de réglementé n'est visible.
create or replace function dm_health_visible(p_shop uuid)
returns boolean language sql stable as $$ select false $$;
create or replace function dm_is_health_shop(p_shop uuid)
returns boolean language sql stable as $$ select false $$;
grant execute on function dm_health_visible(uuid) to anon, authenticated;
grant execute on function dm_is_health_shop(uuid) to anon, authenticated;

-- Nombre d'emplacements de vitrine autorisés = quota gratuit + emplacements achetés actifs.
create or replace function shop_showcase_limit(p_shop uuid)
returns integer language sql stable security definer set search_path = public as $$
  select coalesce(config_int('free_active_listings_quota'), 3)
       + coalesce((select sum(slots)::int from showcase_slots where shop_id = p_shop and expires_at > now()), 0);
$$;
grant execute on function shop_showcase_limit(uuid) to anon, authenticated;

-- ---------------------------------------------------------
-- 5. Remplissage initial : 3 articles par boutique (boostés d'abord, puis récents)
-- ---------------------------------------------------------
with ranked as (
  select p.id,
         row_number() over (
           partition by p.shop_id
           order by (p.boosted_until is not null and p.boosted_until > now()) desc, p.created_at desc
         ) as rn
  from products p
  where p.is_active and p.listing_kind = 'showcase' and not dm_category_is_health(p.category)
)
update products p set is_showcased = true, showcased_at = now()
from ranked r
where p.id = r.id and r.rn <= coalesce(config_int('free_active_listings_quota'), 3);

-- ---------------------------------------------------------
-- 6. Déclencheur : le client ne choisit jamais la vitrine directement
-- ---------------------------------------------------------
create or replace function products_showcase_guard()
returns trigger language plpgsql as $$
declare
  v_client boolean := current_user in ('authenticated', 'anon');
  v_cap integer; v_n integer; v_limit integer;
begin
  if tg_op = 'INSERT' then
    if new.listing_kind = 'showcase' then
      v_cap := coalesce(config_int('catalog_max_items_per_shop'), 200);
      select count(*) into v_n from products where shop_id = new.shop_id and listing_kind = 'showcase';
      if v_n >= v_cap then
        raise exception 'Limite de % articles au catalogue atteinte pour cette boutique.', v_cap;
      end if;
    end if;
    -- Mise en vitrine automatique tant qu'il reste un emplacement.
    new.is_showcased := false;
    new.showcased_at := null;
    if new.is_active and new.listing_kind = 'showcase' and not dm_category_is_health(new.category) then
      v_limit := shop_showcase_limit(new.shop_id);
      select count(*) into v_n from products where shop_id = new.shop_id and is_showcased;
      if v_n < v_limit then
        new.is_showcased := true;
        new.showcased_at := now();
      end if;
    end if;
    return new;
  end if;

  -- UPDATE
  if v_client and new.is_showcased is distinct from old.is_showcased then
    raise exception 'Modification non autorisée : gérez votre vitrine depuis « Ma vitrine ».' using errcode = '42501';
  end if;
  if new.listing_kind <> 'showcase' or not new.is_active or dm_category_is_health(new.category) then
    new.is_showcased := false;
  end if;
  if new.is_showcased and not old.is_showcased then
    v_limit := shop_showcase_limit(new.shop_id);
    select count(*) into v_n from products where shop_id = new.shop_id and is_showcased and id <> new.id;
    if v_n >= v_limit then
      raise exception 'Vitrine pleine (% / %). Retirez un article ou achetez un emplacement.', v_n, v_limit;
    end if;
    new.showcased_at := now();
  elsif not new.is_showcased then
    new.showcased_at := null;
  end if;
  return new;
end; $$;
drop trigger if exists trg_products_showcase_guard on products;
create trigger trg_products_showcase_guard before insert or update on products
  for each row execute function products_showcase_guard();

-- ---------------------------------------------------------
-- 7. Gestion de la vitrine par le propriétaire
-- ---------------------------------------------------------
create or replace function set_showcase(p_product_id uuid, p_on boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_p products%rowtype;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  select p.* into v_p from products p join shops s on s.id = p.shop_id
    where p.id = p_product_id and s.owner_id = auth.uid();
  if v_p.id is null then raise exception 'Article introuvable ou non autorisé'; end if;
  if p_on then
    if not v_p.is_active then raise exception 'Cet article n''est pas actif.'; end if;
    if v_p.listing_kind <> 'showcase' then raise exception 'Les articles de disponibilité n''ont pas de vitrine : ils se trouvent par la recherche et la carte.'; end if;
    if dm_category_is_health(v_p.category) then raise exception 'Les offres de santé ne sont pas exposées dans la vitrine du Marché.'; end if;
  end if;
  update products set is_showcased = p_on where id = p_product_id;
end; $$;
grant execute on function set_showcase(uuid, boolean) to authenticated;

create or replace function buy_showcase_slot(p_shop_id uuid)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare v_price integer := coalesce(config_int('showcase_slot_price_pepites'), 30);
        v_days integer := coalesce(config_int('showcase_slot_days'), 30);
        v_exp timestamptz;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if not exists (select 1 from shops where id = p_shop_id and owner_id = auth.uid() and not is_blocked) then
    raise exception 'Boutique introuvable ou non autorisée';
  end if;
  if dm_is_health_shop(p_shop_id) then raise exception 'Non disponible pour les établissements de santé.'; end if;
  perform spend_pepites(v_price, 'showcase_slot');
  v_exp := now() + make_interval(days => v_days);
  insert into showcase_slots (shop_id, buyer_id, slots, expires_at) values (p_shop_id, auth.uid(), 1, v_exp);
  return v_exp;
end; $$;
grant execute on function buy_showcase_slot(uuid) to authenticated;

-- Compteurs affichés dans « Ma vitrine » (ex. « 2 / 3 en vitrine · 14 / 200 au catalogue »)
create or replace function shop_showcase_usage(p_shop_id uuid)
returns table (showcased integer, showcase_limit integer, catalog_items integer, catalog_cap integer, next_slot_expiry timestamptz)
language sql stable security definer set search_path = public as $$
  select (select count(*)::int from products where shop_id = p_shop_id and is_showcased),
         shop_showcase_limit(p_shop_id),
         (select count(*)::int from products where shop_id = p_shop_id and listing_kind = 'showcase'),
         coalesce(config_int('catalog_max_items_per_shop'), 200),
         (select min(expires_at) from showcase_slots where shop_id = p_shop_id and expires_at > now());
$$;
grant execute on function shop_showcase_usage(uuid) to anon, authenticated;

-- Quand un emplacement acheté expire : retire de la vitrine l'excédent (les moins récemment
-- mis en vitrine d'abord, sauf boost actif) et prévient le propriétaire.
create or replace function expire_showcase_slots()
returns void language plpgsql security definer set search_path = public as $$
declare r record; v_limit integer; v_excess integer; v_ids uuid[]; v_owner uuid;
begin
  for r in select distinct p.shop_id from products p where p.is_showcased loop
    v_limit := shop_showcase_limit(r.shop_id);
    select count(*) - v_limit into v_excess from products where shop_id = r.shop_id and is_showcased;
    if v_excess > 0 then
      select array_agg(id) into v_ids from (
        select id from products where shop_id = r.shop_id and is_showcased
        order by (boosted_until is not null and boosted_until > now()), showcased_at nulls first
        limit v_excess) t;
      update products set is_showcased = false where id = any(v_ids);
      select owner_id into v_owner from shops where id = r.shop_id;
      perform dm_push_notification(v_owner, 'merchant', 'showcase_reduced', 'Votre vitrine a été ajustée',
        v_excess || ' article(s) sont repassés au catalogue (emplacement expiré). Ils restent trouvables par la recherche.',
        '/compte', jsonb_build_object('shop_id', r.shop_id),
        'showcase:' || r.shop_id || ':' || to_char(now(), 'YYYYMMDD'), 'merchant_reminders');
    end if;
  end loop;
end; $$;
revoke execute on function expire_showcase_slots() from public, anon, authenticated;
select cron.schedule('dabbymarket-expire-showcase-slots', '30 3 * * *', $$select expire_showcase_slots();$$);

-- ---------------------------------------------------------
-- 8. Fin de la facturation automatique des dépassements
-- ---------------------------------------------------------
create or replace function bill_quota_overage()
returns void language plpgsql security definer as $$
begin
  -- Désactivée (0020) : les articles au-delà de la vitrine sont du catalogue gratuit.
  -- Les emplacements supplémentaires s'achètent à la demande (buy_showcase_slot).
  return;
end; $$;
do $$ begin perform cron.unschedule('dabbymarket-bill-quota-overage'); exception when others then null; end $$;

-- Le compteur « articles actifs » de 0012/0018 compte désormais la vitrine.
drop view if exists public.shop_active_listing_counts;
create view public.shop_active_listing_counts
with (security_invoker = true) as
select shop_id, count(*) as active_count from products where is_showcased group by shop_id;
grant select on public.shop_active_listing_counts to anon, authenticated;
grant all on public.shop_active_listing_counts to service_role;

-- ---------------------------------------------------------
-- 9. RECHERCHE SERVEUR sur tout le catalogue
-- ---------------------------------------------------------
-- * Renvoie tous les articles actifs (vitrine, catalogue, disponibilité), y compris
--   ceux dont la disponibilité est inconnue, périmée, contestée ou en rupture.
-- * Classement : pertinence > statut (disponible d'abord) > distance > récence.
--   Un boost ne change JAMAIS ce classement : `sponsored` sert à un encart séparé.
-- * Santé : seuls les établissements de santé vérifiés sont visibles ; prix masqué
--   sauf si `health_show_prices` = 1 (voir 0022).
create or replace function catalog_search(
  p_query text default null,
  p_category text default null,
  p_city text default null,
  p_neighborhood text default null,
  p_lat double precision default null,
  p_lng double precision default null,
  p_radius_km double precision default null,
  p_only_available boolean default false,
  p_max_price integer default null,
  p_limit integer default 40,
  p_offset integer default 0
) returns table (
  product_id uuid, name text, description text, price_xaf integer, category text, condition text,
  images text[], created_at timestamptz, listing_kind text, is_showcased boolean,
  shop_id uuid, shop_name text, shop_logo text, shop_verified boolean, owner_id uuid,
  neighborhood text, city text, lat double precision, lng double precision,
  effective_status text, confirmed_at timestamptz, stock_qty integer, sale_unit text,
  sponsored boolean, relevance numeric, distance_km double precision
) language plpgsql stable security invoker set search_path = public as $$
declare
  v_tokens text[] := string_to_array(btrim(dm_norm(p_query)), ' ');
  v_has_q boolean := p_query is not null and btrim(p_query) <> '';
  v_lim integer := least(greatest(coalesce(p_limit, 40), 1), 100);
  v_off integer := greatest(coalesce(p_offset, 0), 0);
  v_hide_health_price boolean := coalesce(config_int('health_show_prices'), 0) = 0;
begin
  return query
  with recursive ct as (
    select pc.id from product_categories pc where pc.id = p_category
    union all
    select c.id from product_categories c join ct on c.parent_id = ct.id
  ),
  base as (
    select
      p.id as product_id, p.name, p.description,
      case when v_hide_health_price and dm_category_is_health(p.category) then null else p.price_xaf end as price_xaf,
      p.category, p.condition, p.images, p.created_at, p.listing_kind, p.is_showcased,
      s.id as shop_id, s.name as shop_name, s.logo_url as shop_logo, s.verified as shop_verified, s.owner_id,
      s.neighborhood, s.city, s.lat, s.lng,
      coalesce(pa.effective_status, 'unknown') as effective_status,
      pa.confirmed_at, pa.stock_qty, pa.sale_unit,
      (exists (select 1 from active_boosts b where b.boost_type = 'recherche'
                 and ((b.target_type = 'product' and b.target_id = p.id) or (b.target_type = 'shop' and b.target_id = s.id)))
       and not dm_category_is_health(p.category)) as sponsored,
      case when v_has_q then
        case
          when not exists (select 1 from unnest(v_tokens) tk where tk <> '' and position(tk in hay.h) = 0) then
            case when not exists (select 1 from unnest(v_tokens) tk where tk <> '' and position(tk in dm_norm(p.name)) = 0) then 3.0 else 2.0 end
          else 0 end
        else 1 end::numeric as relevance,
      case when p_lat is not null and p_lng is not null and s.lat is not null and s.lng is not null then
        6371 * 2 * asin(sqrt(power(sin(radians(s.lat - p_lat) / 2), 2)
          + cos(radians(p_lat)) * cos(radians(s.lat)) * power(sin(radians(s.lng - p_lng) / 2), 2)))
      end as distance_km,
      case coalesce(pa.effective_status, 'unknown') when 'available' then 0 when 'limited' then 1 when 'to_reconfirm' then 2
        when 'contested' then 3 when 'unknown' then 4 else 5 end as status_rank
    from products p
    join shops s on s.id = p.shop_id and not s.is_blocked
    left join product_availability pa on pa.product_id = p.id
    left join product_categories pcat on pcat.id = p.category
    left join catalog_items ci on ci.id = p.catalog_item_id
    cross join lateral (
      select dm_norm(p.name || ' ' || coalesce(p.description, '') || ' ' || s.name || ' ' || coalesce(ci.name_fr, '') || ' '
                     || coalesce(array_to_string(ci.synonyms, ' '), '') || ' ' || coalesce(pcat.name_fr, '') || ' ' || coalesce(pcat.name_en, '')) as h
    ) hay
    where p.is_active
      and (not dm_category_is_health(p.category) or dm_health_visible(p.shop_id))
      and (p_category is null or p.category in (select id from ct))
      and (p_city is null or dm_norm(s.city) = dm_norm(p_city))
      and (p_neighborhood is null or dm_norm(s.neighborhood) = dm_norm(p_neighborhood))
      and (p_max_price is null or p.price_xaf <= p_max_price)
      and (not p_only_available or coalesce(pa.effective_status, 'unknown') in ('available', 'limited'))
  )
  select b.product_id, b.name, b.description, b.price_xaf, b.category, b.condition, b.images, b.created_at,
         b.listing_kind, b.is_showcased, b.shop_id, b.shop_name, b.shop_logo, b.shop_verified, b.owner_id,
         b.neighborhood, b.city, b.lat, b.lng, b.effective_status, b.confirmed_at, b.stock_qty, b.sale_unit,
         b.sponsored, b.relevance, b.distance_km
  from base b
  where b.relevance > 0
    and (p_radius_km is null or b.distance_km is null or b.distance_km <= p_radius_km)
  order by b.relevance desc, b.status_rank asc, b.distance_km asc nulls last, b.created_at desc
  limit v_lim offset v_off;
end; $$;
grant execute on function catalog_search(text, text, text, text, double precision, double precision, double precision, boolean, integer, integer, integer) to anon, authenticated;
