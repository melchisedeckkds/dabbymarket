-- =========================================================
-- DabbyMarket — 0018 : DABBY DISPONIBILITÉ
--
-- Disponibilité commerciale géolocalisée et participative, greffée sur
-- l'existant (aucune table existante supprimée, aucune donnée modifiée) :
--
--   * products        : 10 colonnes ajoutées (statut déclaré, dernière
--                       confirmation, quantité, catalogue de référence...).
--                       Tous les produits existants restent « showcase »
--                       avec une disponibilité « unknown » (jamais présentés
--                       comme disponibles tant que le marchand ne l'a pas
--                       déclaré).
--   * product_categories / catalog_items : catégories hiérarchiques
--                       administrables + produits de référence (variantes).
--                       Les 6 identifiants de catégorie actuels sont repris
--                       tels quels : aucun produit/boutique existant n'est
--                       réaffecté.
--   * availability_events / availability_reports : historique + signalements
--                       communautaires.
--   * product_reviews : notes 1-5 par article de boutique (distinct des avis
--                       boutique `reviews`, qui ne changent pas).
--   * notifications / notification_prefs / availability_alerts : centre de
--                       notifications interne (temps réel) + alertes.
--   * RPC de recherche géolocalisée et de « Trouvailles ».
--
-- Ordre d'application : après 0017_security_hardening.sql.
-- =========================================================

-- ---------------------------------------------------------
-- 0. Utilitaires
-- ---------------------------------------------------------

-- Normalisation de recherche : minuscules, accents retirés, virgule
-- décimale -> point (« 12,5 kg » == « 12.5 kg »). Sans dépendance à
-- l'extension unaccent (non garantie sur tous les projets).
create or replace function dm_norm(p text)
returns text language sql immutable as $$
  select regexp_replace(
    replace(
      translate(lower(coalesce(p, '')), 'àâäáãåçéèêëíìîïñóòôöõúùûüýÿœæ', 'aaaaaaceeeeiiiinooooouuuuyyoa'),
      ',', '.'),
    '\s+', ' ', 'g');
$$;

create or replace function dm_is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and is_admin);
$$;
grant execute on function dm_is_admin() to anon, authenticated;

-- Note moyenne « bayésienne » : un seul avis parfait ne dépasse pas un
-- article noté 4,8 par 150 personnes. m = 3.8 (moyenne a priori), C = 5.
create or replace function dm_bayes(p_avg numeric, p_n integer)
returns numeric language sql immutable as $$
  select case when coalesce(p_n, 0) = 0 then null
              else round(((5 * 3.8) + (p_avg * p_n)) / (5 + p_n), 3) end;
$$;

-- ---------------------------------------------------------
-- 1. Paramètres éditables par l'admin (table app_config existante, 0012)
-- ---------------------------------------------------------
insert into app_config (key, value, description) values
  ('availability_default_ttl_hours',  '12', 'Durée (heures) pendant laquelle une confirmation de disponibilité reste « récente » avant de passer à « à reconfirmer » (surchargeable par catégorie)'),
  ('availability_contest_threshold',  '2',  'Nombre de signalants distincts « épuisé » (après la dernière confirmation) qui rend une disponibilité « contestée »'),
  ('availability_contest_window_hours','6', 'Fenêtre (heures) prise en compte pour les signalements communautaires'),
  ('report_min_account_age_hours',    '12', 'Ancienneté minimale (heures) d''un compte pour signaler une disponibilité'),
  ('review_min_account_age_hours',    '12', 'Ancienneté minimale (heures) d''un compte pour publier un avis produit'),
  ('review_daily_limit',              '10', 'Nombre maximum d''avis produit publiés/modifiés par utilisateur et par jour'),
  ('review_report_hide_threshold',    '3',  'Nombre de signalants distincts masquant automatiquement un avis (en attente de modération)'),
  ('max_stock_items_per_shop',        '60', 'Nombre maximum d''articles « disponibilité » par boutique'),
  ('stock_items_count_toward_quota',  '0',  '1 = les articles « disponibilité » comptent dans le quota gratuit et la facturation de dépassement ; 0 = exclus (recommandé pour l''adoption)'),
  ('trouvailles_min_reviews',         '2',  'Nombre minimum d''avis pour qu''un article figure dans « Les Trouvailles »'),
  ('demand_alert_threshold',          '5',  'Nombre de personnes distinctes cherchant un produit dans un secteur déclenchant une alerte aux commerçants'),
  ('demand_k_anonymity',              '3',  'Seuil minimal de personnes distinctes pour afficher une statistique de demande à un commerçant'),
  ('notify_max_per_day_default',      '12', 'Plafond de notifications clients par jour et par utilisateur (modifiable par l''utilisateur)'),
  ('notify_followers_cap',            '300','Nombre maximum d''abonnés notifiés par nouvel article (protection de performance)')
on conflict (key) do nothing;

-- ---------------------------------------------------------
-- 2. Catégories hiérarchiques administrables
-- ---------------------------------------------------------
create table if not exists product_categories (
  id text primary key,
  parent_id text references product_categories(id) on delete set null,
  name_fr text not null,
  name_en text not null,
  description text,
  icon text,
  sort_order integer not null default 0,
  active boolean not null default true,
  ttl_hours integer check (ttl_hours between 1 and 720),
  is_regulated boolean not null default false,
  allow_stock boolean not null default true,
  units text[] not null default '{}',
  attributes jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (id ~ '^[a-z0-9][a-z0-9-]*$'),
  check (parent_id is null or parent_id <> id),
  check (jsonb_typeof(attributes) = 'array')
);
create index if not exists product_categories_parent_idx on product_categories (parent_id);

alter table product_categories enable row level security;
drop policy if exists "Catégories lisibles" on product_categories;
create policy "Catégories lisibles" on product_categories for select using (active or dm_is_admin());
drop policy if exists "Admin gère les catégories" on product_categories;
create policy "Admin gère les catégories" on product_categories for all using (dm_is_admin()) with check (dm_is_admin());

-- Les 6 catégories actuelles (ids inchangés) + nouveaux secteurs. La
-- catégorie « santé » est volontairement créée RÉGLEMENTÉE et fermée aux
-- articles « disponibilité » : l'admin doit l'ouvrir explicitement.
insert into product_categories (id, parent_id, name_fr, name_en, icon, sort_order, ttl_hours, is_regulated, allow_stock, units) values
  ('mode',         null, 'Mode',            'Fashion',      'Shirt',      10, 72,  false, true,  '{pièce,paire}'),
  ('electronique', null, 'Électronique',    'Electronics',  'Smartphone', 20, 72,  false, true,  '{pièce}'),
  ('alimentation', null, 'Alimentation',    'Food',         'Utensils',   30, 12,  false, true,  '{kg,litre,sac,pièce,carton}'),
  ('beaute',       null, 'Beauté',          'Beauty',       'Sparkles',   40, 72,  false, true,  '{pièce,flacon}'),
  ('maison',       null, 'Maison',          'Home',         'Sofa',       50, 72,  false, true,  '{pièce}'),
  ('services',     null, 'Services',        'Services',     'Wrench',     60, null,false, false, '{}'),
  ('energie',      null, 'Énergie',         'Energy',       'Flame',      70, 8,   false, true,  '{}'),
  ('gaz-domestique','energie','Gaz domestique','Domestic gas','Flame',    71, 8,   false, true,  '{bouteille}'),
  ('construction', null, 'Construction',    'Construction', 'Hammer',     80, 48,  false, true,  '{sac,barre,pièce,m²,m³}'),
  ('pieces-auto',  null, 'Pièces auto',     'Auto parts',   'Car',        90, 72,  false, true,  '{pièce}'),
  ('agriculture',  null, 'Agriculture',     'Agriculture',  'Sprout',    100, 48,  false, true,  '{kg,sac,pièce}'),
  ('sante',        null, 'Santé',           'Health',       'HeartPulse',110, 24,  true,  false, '{boîte,flacon}')
on conflict (id) do nothing;

-- Attributs propres à la catégorie « gaz domestique » (exemple fonctionnel)
update product_categories set attributes = '[
  {"key":"consigne","label_fr":"Consigne éventuelle","label_en":"Deposit (if any)","type":"text","required":false},
  {"key":"marque","label_fr":"Marque du gaz","label_en":"Gas brand","type":"text","required":false}
]'::jsonb where id = 'gaz-domestique' and attributes = '[]'::jsonb;

-- ---------------------------------------------------------
-- 3. Produits de référence (catalogue) = variantes comparables
--    « Bouteille de gaz 12,5 kg » est un produit générique ; chaque
--    boutique en publie sa propre OFFRE (une ligne de `products`,
--    déjà propre à une boutique dans le schéma existant).
-- ---------------------------------------------------------
create table if not exists catalog_items (
  id uuid primary key default gen_random_uuid(),
  category_id text not null references product_categories(id) on update cascade,
  name_fr text not null,
  name_en text not null,
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]*$'),
  sale_unit text,
  attributes jsonb not null default '{}',
  synonyms text[] not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists catalog_items_category_idx on catalog_items (category_id);

alter table catalog_items enable row level security;
drop policy if exists "Catalogue lisible" on catalog_items;
create policy "Catalogue lisible" on catalog_items for select using (active or dm_is_admin());
drop policy if exists "Admin gère le catalogue" on catalog_items;
create policy "Admin gère le catalogue" on catalog_items for all using (dm_is_admin()) with check (dm_is_admin());

insert into catalog_items (category_id, name_fr, name_en, slug, sale_unit, synonyms) values
  ('gaz-domestique', 'Bouteille de gaz 6 kg',   'Gas cylinder 6 kg',   'gaz-6kg',   'bouteille', '{gaz,butane,bouteille de gaz,cooking gas}'),
  ('gaz-domestique', 'Bouteille de gaz 12,5 kg','Gas cylinder 12.5 kg','gaz-12-5kg','bouteille', '{gaz,butane,bouteille de gaz,cooking gas}'),
  ('gaz-domestique', 'Bouteille de gaz 38 kg',  'Gas cylinder 38 kg',  'gaz-38kg',  'bouteille', '{gaz,butane,bouteille de gaz,cooking gas}')
on conflict (slug) do nothing;

-- ---------------------------------------------------------
-- 4. Colonnes de disponibilité sur products (ADDITIVES)
-- ---------------------------------------------------------
alter table products add column if not exists listing_kind text not null default 'showcase' check (listing_kind in ('showcase','stock'));
alter table products add column if not exists catalog_item_id uuid references catalog_items(id) on delete set null;
alter table products add column if not exists availability_status text not null default 'unknown' check (availability_status in ('unknown','available','limited','out'));
alter table products add column if not exists availability_confirmed_at timestamptz;
alter table products add column if not exists availability_ttl_hours integer check (availability_ttl_hours between 1 and 720);
alter table products add column if not exists stock_qty integer check (stock_qty >= 0);
alter table products add column if not exists sale_unit text;
alter table products add column if not exists sale_conditions text check (char_length(sale_conditions) <= 300);
alter table products add column if not exists attributes jsonb not null default '{}';
alter table products add column if not exists show_on_map boolean not null default true;

create index if not exists products_catalog_item_idx on products (catalog_item_id) where catalog_item_id is not null;
create index if not exists products_avail_idx on products (shop_id, availability_status);
create index if not exists products_kind_idx on products (listing_kind);
create index if not exists shops_geo_idx on shops (lat, lng) where lat is not null;
create index if not exists shop_locations_geo_idx on shop_locations (lat, lng) where is_current;

-- Le quota gratuit / la facturation de dépassement (0012) ne comptent plus
-- les articles « disponibilité » sauf si l'admin le décide (config).
drop view if exists public.shop_active_listing_counts;
create view public.shop_active_listing_counts
with (security_invoker = true) as
select shop_id, count(*) as active_count
from products
where is_active
  and (listing_kind = 'showcase' or coalesce(config_int('stock_items_count_toward_quota'), 0) = 1)
group by shop_id;
grant select on public.shop_active_listing_counts to anon, authenticated;
grant all on public.shop_active_listing_counts to service_role;

-- ---------------------------------------------------------
-- 5. Historique des changements de disponibilité (append-only)
-- ---------------------------------------------------------
create table if not exists availability_events (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  shop_id uuid not null references shops(id) on delete cascade,
  actor_id uuid references profiles(id) on delete set null,
  source text not null check (source in ('declare','reconfirm','price','create')),
  old_status text,
  new_status text not null,
  old_price_xaf integer,
  new_price_xaf integer,
  stock_qty integer,
  created_at timestamptz not null default now()
);
create index if not exists availability_events_product_idx on availability_events (product_id, created_at desc);
create index if not exists availability_events_shop_idx on availability_events (shop_id, created_at desc);

alter table availability_events enable row level security;
drop policy if exists "Le marchand lit l'historique de ses articles" on availability_events;
create policy "Le marchand lit l'historique de ses articles" on availability_events for select
  using (exists (select 1 from shops s where s.id = shop_id and s.owner_id = auth.uid()) or dm_is_admin());
-- aucune politique INSERT/UPDATE/DELETE : alimenté uniquement par le déclencheur ci-dessous.

-- ---------------------------------------------------------
-- 6. Notifications internes (centre + temps réel) et préférences
-- ---------------------------------------------------------
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  audience text not null default 'customer' check (audience in ('customer','merchant')),
  kind text not null check (kind in ('restock','price_change','new_product','review_received','availability_report','demand','stale_reminder','system')),
  title text not null,
  body text,
  link text,
  data jsonb not null default '{}',
  dedupe_key text,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, dedupe_key)
);
create index if not exists notifications_user_idx on notifications (user_id, created_at desc);
create index if not exists notifications_unread_idx on notifications (user_id) where read_at is null;

alter table notifications enable row level security;
drop policy if exists "Chacun lit ses notifications" on notifications;
create policy "Chacun lit ses notifications" on notifications for select using (auth.uid() = user_id);
drop policy if exists "Chacun supprime ses notifications" on notifications;
create policy "Chacun supprime ses notifications" on notifications for delete using (auth.uid() = user_id);
-- Aucune politique INSERT/UPDATE : création par les fonctions serveur uniquement ;
-- lecture/marquage « lu » via mark_notifications_read().

create table if not exists notification_prefs (
  user_id uuid primary key references profiles(id) on delete cascade,
  restock boolean not null default true,
  price_change boolean not null default true,
  new_product boolean not null default true,
  merchant_reviews boolean not null default true,
  merchant_reports boolean not null default true,
  merchant_demand boolean not null default true,
  merchant_reminders boolean not null default true,
  max_per_day integer not null default 12 check (max_per_day between 1 and 50),
  updated_at timestamptz not null default now()
);
alter table notification_prefs enable row level security;
drop policy if exists "Préférences : lecture propre" on notification_prefs;
create policy "Préférences : lecture propre" on notification_prefs for select using (auth.uid() = user_id);
drop policy if exists "Préférences : création propre" on notification_prefs;
create policy "Préférences : création propre" on notification_prefs for insert with check (auth.uid() = user_id);
drop policy if exists "Préférences : modification propre" on notification_prefs;
create policy "Préférences : modification propre" on notification_prefs for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

do $$ begin
  alter publication supabase_realtime add table notifications;
exception when others then
  raise notice 'Realtime : ajoutez la table notifications à la publication supabase_realtime depuis le dashboard (%).', sqlerrm;
end $$;

-- Création unique d'une notification : respecte les préférences, le
-- plafond quotidien (clients) et la déduplication (user_id, dedupe_key).
create or replace function dm_push_notification(
  p_user uuid, p_audience text, p_kind text, p_title text, p_body text,
  p_link text, p_data jsonb, p_dedupe text, p_pref text
) returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_prefs notification_prefs%rowtype;
  v_allowed boolean := true;
  v_today integer;
  v_cap integer;
begin
  if p_user is null then return false; end if;
  select * into v_prefs from notification_prefs where user_id = p_user;
  if found then
    v_allowed := case p_pref
      when 'restock' then v_prefs.restock
      when 'price_change' then v_prefs.price_change
      when 'new_product' then v_prefs.new_product
      when 'merchant_reviews' then v_prefs.merchant_reviews
      when 'merchant_reports' then v_prefs.merchant_reports
      when 'merchant_demand' then v_prefs.merchant_demand
      when 'merchant_reminders' then v_prefs.merchant_reminders
      else true end;
  end if;
  if not v_allowed then return false; end if;

  if p_audience = 'customer' then
    v_cap := coalesce(v_prefs.max_per_day, config_int('notify_max_per_day_default'), 12);
    select count(*) into v_today from notifications
      where user_id = p_user and audience = 'customer' and created_at > date_trunc('day', now());
    if v_today >= v_cap then return false; end if;
  end if;

  insert into notifications (user_id, audience, kind, title, body, link, data, dedupe_key)
  values (p_user, p_audience, p_kind, p_title, p_body, p_link, coalesce(p_data, '{}'::jsonb), p_dedupe)
  on conflict (user_id, dedupe_key) do nothing;
  return found;
end; $$;
revoke execute on function dm_push_notification(uuid,text,text,text,text,text,jsonb,text,text) from public, anon, authenticated;

create or replace function mark_notifications_read(p_ids uuid[] default null)
returns integer language plpgsql security definer set search_path = public as $$
declare v_n integer;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  update notifications set read_at = now()
    where user_id = auth.uid() and read_at is null and (p_ids is null or id = any(p_ids));
  get diagnostics v_n = row_count;
  return v_n;
end; $$;
grant execute on function mark_notifications_read(uuid[]) to authenticated;

-- ---------------------------------------------------------
-- 7. Alertes de disponibilité (produit, produit de référence, recherche)
-- ---------------------------------------------------------
create table if not exists availability_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  kind text not null check (kind in ('product','catalog_item','search')),
  product_id uuid references products(id) on delete cascade,
  catalog_item_id uuid references catalog_items(id) on delete cascade,
  query text check (char_length(query) <= 80),
  max_price_xaf integer check (max_price_xaf > 0),
  neighborhood text,
  city text,
  active boolean not null default true,
  last_notified_at timestamptz,
  created_at timestamptz not null default now(),
  check (
    (kind = 'product' and product_id is not null) or
    (kind = 'catalog_item' and catalog_item_id is not null) or
    (kind = 'search' and query is not null and char_length(btrim(query)) >= 2)
  )
);
create unique index if not exists availability_alerts_product_uq on availability_alerts (user_id, product_id) where kind = 'product';
create unique index if not exists availability_alerts_item_uq on availability_alerts (user_id, catalog_item_id, coalesce(neighborhood, '')) where kind = 'catalog_item';
create unique index if not exists availability_alerts_search_uq on availability_alerts (user_id, (dm_norm(query)), coalesce(neighborhood, '')) where kind = 'search';
create index if not exists availability_alerts_match_idx on availability_alerts (kind, active) where active;

alter table availability_alerts enable row level security;
drop policy if exists "Alertes : lecture propre" on availability_alerts;
create policy "Alertes : lecture propre" on availability_alerts for select using (auth.uid() = user_id);
drop policy if exists "Alertes : création propre" on availability_alerts;
create policy "Alertes : création propre" on availability_alerts for insert with check (auth.uid() = user_id);
drop policy if exists "Alertes : modification propre" on availability_alerts;
create policy "Alertes : modification propre" on availability_alerts for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Alertes : suppression propre" on availability_alerts;
create policy "Alertes : suppression propre" on availability_alerts for delete using (auth.uid() = user_id);

create or replace function dm_alerts_cap()
returns trigger language plpgsql as $$
begin
  if (select count(*) from availability_alerts where user_id = new.user_id) >= 30 then
    raise exception 'Limite de 30 alertes atteinte. Supprimez-en pour en créer de nouvelles.';
  end if;
  return new;
end; $$;
drop trigger if exists trg_alerts_cap on availability_alerts;
create trigger trg_alerts_cap before insert on availability_alerts for each row execute function dm_alerts_cap();

-- ---------------------------------------------------------
-- 8. Signalements communautaires de disponibilité
--    Une ligne par (article, signalant, type) : un nouveau signalement
--    rafraîchit la ligne => count(*) == signalants distincts.
--    L'identité du signalant n'est jamais lisible côté client.
-- ---------------------------------------------------------
create table if not exists availability_reports (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  shop_id uuid not null references shops(id) on delete cascade,
  reporter_id uuid not null references profiles(id) on delete cascade,
  kind text not null check (kind in ('found','out_of_stock','price_different','shop_closed','wrong_address')),
  observed_price_xaf integer check (observed_price_xaf > 0),
  created_at timestamptz not null default now(),
  unique (product_id, reporter_id, kind)
);
create index if not exists availability_reports_product_idx on availability_reports (product_id, kind, created_at desc);

alter table availability_reports enable row level security;
drop policy if exists "Signalements lisibles (colonnes publiques)" on availability_reports;
create policy "Signalements lisibles (colonnes publiques)" on availability_reports for select using (true);
-- Seules les colonnes non identifiantes sont lisibles par les clients :
revoke all on availability_reports from anon, authenticated;
grant select (id, product_id, shop_id, kind, observed_price_xaf, created_at) on availability_reports to anon, authenticated;
grant all on availability_reports to service_role;

-- ---------------------------------------------------------
-- 9. Avis par article de boutique (distincts des avis boutique `reviews`)
-- ---------------------------------------------------------
create table if not exists product_reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  shop_id uuid not null references shops(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  comment text check (char_length(comment) <= 600),
  status text not null default 'visible' check (status in ('visible','hidden','removed')),
  -- DÉCLARATIF : l'acheteur a confirmé la réception dans la messagerie
  -- (conversations.order_confirmed). Ce n'est PAS une preuve d'achat :
  -- l'interface l'affiche comme « réception confirmée », jamais « vérifié ».
  declared_exchange boolean not null default false,
  merchant_reply text check (char_length(merchant_reply) <= 400),
  merchant_replied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, user_id)
);
create index if not exists product_reviews_product_idx on product_reviews (product_id, status, created_at desc);
create index if not exists product_reviews_shop_idx on product_reviews (shop_id);

alter table product_reviews enable row level security;
drop policy if exists "Avis produit visibles" on product_reviews;
create policy "Avis produit visibles" on product_reviews for select using (
  status = 'visible'
  or user_id = auth.uid()
  or exists (select 1 from shops s where s.id = shop_id and s.owner_id = auth.uid())
  or dm_is_admin()
);
-- Aucune politique INSERT/UPDATE/DELETE : tout passe par les fonctions RPC.

create or replace view product_rating_stats with (security_invoker = true) as
select product_id,
       count(*)::int as ratings_count,
       round(avg(rating)::numeric, 2) as avg_rating,
       count(*) filter (where declared_exchange)::int as declared_count
from product_reviews where status = 'visible'
group by product_id;
grant select on product_rating_stats to anon, authenticated;
grant all on product_rating_stats to service_role;

-- Note du produit de RÉFÉRENCE (toutes boutiques) — distincte de la note de
-- l'offre d'une boutique et de la réputation de la boutique.
create or replace view catalog_rating_stats with (security_invoker = true) as
select p.catalog_item_id,
       count(r.id)::int as ratings_count,
       round(avg(r.rating)::numeric, 2) as avg_rating,
       count(distinct p.shop_id)::int as shops_count
from product_reviews r
join products p on p.id = r.product_id
where r.status = 'visible' and p.catalog_item_id is not null
group by p.catalog_item_id;
grant select on catalog_rating_stats to anon, authenticated;
grant all on catalog_rating_stats to service_role;

-- Les signalements existants (0009/0016) acceptent aussi les avis produit.
alter table reports drop constraint if exists reports_target_type_check;
alter table reports add constraint reports_target_type_check
  check (target_type in ('shop','product','post','user','flash_listing','product_review'));

create or replace function handle_review_report()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_distinct integer; v_hide integer := coalesce(config_int('review_report_hide_threshold'), 3);
begin
  if new.target_type <> 'product_review' then return new; end if;
  select count(distinct reporter_id) into v_distinct from reports
    where target_type = 'product_review' and target_id = new.target_id and status = 'pending';
  if v_distinct >= v_hide then
    update product_reviews set status = 'hidden' where id = new.target_id and status = 'visible';
  end if;
  return new;
end; $$;
drop trigger if exists trg_review_report on reports;
create trigger trg_review_report after insert on reports for each row execute function handle_review_report();

-- ---------------------------------------------------------
-- 10. Règles métier sur products (déclencheurs)
-- ---------------------------------------------------------

-- AVANT écriture : validation + horodatage fiable.
-- Un client ne peut pas choisir la date de confirmation : elle est posée
-- par le serveur quand le statut ou la quantité change. Les fonctions
-- RPC (SECURITY DEFINER) peuvent aussi reconfirmer sans changer le statut.
create or replace function products_availability_before()
returns trigger language plpgsql as $$
declare
  v_cat product_categories%rowtype;
  v_client boolean := current_user in ('authenticated', 'anon');
  v_max integer;
begin
  if new.listing_kind = 'stock' and (tg_op = 'INSERT' or new.category is distinct from old.category or old.listing_kind <> 'stock') then
    select * into v_cat from product_categories where id = new.category;
    if v_cat.id is null or not v_cat.active then
      raise exception 'Catégorie inconnue ou désactivée.';
    end if;
    if not v_cat.allow_stock then
      raise exception 'La catégorie « % » n''accepte pas encore les articles de disponibilité (catégorie réglementée ou fermée par l''administration).', v_cat.name_fr;
    end if;
  end if;

  if tg_op = 'INSERT' then
    if new.listing_kind = 'stock' then
      v_max := coalesce(config_int('max_stock_items_per_shop'), 60);
      if (select count(*) from products where shop_id = new.shop_id and listing_kind = 'stock') >= v_max then
        raise exception 'Limite de % articles de disponibilité par boutique atteinte.', v_max;
      end if;
    end if;
    if new.availability_status <> 'unknown' then
      new.availability_confirmed_at := now();
    else
      new.availability_confirmed_at := null;
    end if;
  else
    if v_client then
      if new.availability_status is distinct from old.availability_status
         or new.stock_qty is distinct from old.stock_qty then
        new.availability_confirmed_at := case when new.availability_status = 'unknown' then null else now() end;
      else
        new.availability_confirmed_at := old.availability_confirmed_at;
      end if;
    elsif (new.availability_status is distinct from old.availability_status or new.stock_qty is distinct from old.stock_qty)
          and new.availability_confirmed_at is not distinct from old.availability_confirmed_at then
      -- éditeur SQL / service : un changement de statut sans date explicite est horodaté
      new.availability_confirmed_at := case when new.availability_status = 'unknown' then null else now() end;
    end if;
  end if;

  if new.availability_status = 'out' then new.stock_qty := coalesce(new.stock_qty, 0); end if;
  return new;
end; $$;
drop trigger if exists trg_products_availability_before on products;
create trigger trg_products_availability_before before insert or update on products
  for each row execute function products_availability_before();

-- APRÈS écriture : journal d'historique + notifications.
create or replace function products_availability_after()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_source text;
begin
  if tg_op = 'INSERT' then
    if new.availability_status <> 'unknown' then
      insert into availability_events (product_id, shop_id, actor_id, source, old_status, new_status, new_price_xaf, stock_qty)
      values (new.id, new.shop_id, auth.uid(), 'create', null, new.availability_status, new.price_xaf, new.stock_qty);
    end if;
    perform notify_new_product(new.id);
    return new;
  end if;

  if new.availability_status is distinct from old.availability_status
     or new.availability_confirmed_at is distinct from old.availability_confirmed_at
     or new.price_xaf is distinct from old.price_xaf
     or new.stock_qty is distinct from old.stock_qty then
    v_source := case
      when new.availability_status is distinct from old.availability_status then 'declare'
      when new.availability_confirmed_at is distinct from old.availability_confirmed_at
           or new.stock_qty is distinct from old.stock_qty then 'reconfirm'
      else 'price' end;
    insert into availability_events (product_id, shop_id, actor_id, source, old_status, new_status, old_price_xaf, new_price_xaf, stock_qty)
    values (new.id, new.shop_id, auth.uid(), v_source, old.availability_status, new.availability_status, old.price_xaf, new.price_xaf, new.stock_qty);
  end if;

  if new.availability_status in ('available','limited') and old.availability_status not in ('available','limited') then
    perform notify_restock(new.id);
  end if;
  if new.price_xaf is distinct from old.price_xaf then
    perform notify_price_change(new.id, old.price_xaf);
  end if;
  return new;
end; $$;
drop trigger if exists trg_products_availability_after on products;
create trigger trg_products_availability_after after insert or update on products
  for each row execute function products_availability_after();

-- ---------------------------------------------------------
-- 11. Vue : disponibilité EFFECTIVE (calculée à la lecture)
--     unknown        : jamais renseignée
--     out            : rupture déclarée par la boutique
--     contested      : >= N signalants « épuisé » depuis la dernière confirmation
--     to_reconfirm   : déclaration plus ancienne que la durée de validité
--                      (NE signifie PAS rupture : le stock est simplement inconnu)
--     available / limited : déclaré ET confirmé récemment
-- ---------------------------------------------------------
create or replace view product_availability with (security_invoker = true) as
select
  p.id as product_id, p.shop_id, p.name, p.price_xaf, p.category, p.catalog_item_id,
  p.listing_kind, p.images, p.show_on_map,
  p.availability_status as declared_status,
  p.availability_confirmed_at as confirmed_at,
  p.stock_qty, p.sale_unit, p.sale_conditions,
  t.ttl_hours,
  coalesce(o.n, 0)::int as out_reports,
  coalesce(f.n, 0)::int as found_reports,
  f.last_at as found_last_at,
  case
    when p.availability_status = 'unknown' then 'unknown'
    when p.availability_status = 'out' then 'out'
    when coalesce(o.n, 0) >= coalesce(config_int('availability_contest_threshold'), 2) then 'contested'
    when p.availability_confirmed_at is null
         or p.availability_confirmed_at < now() - make_interval(hours => t.ttl_hours) then 'to_reconfirm'
    else p.availability_status
  end as effective_status
from products p
left join product_categories c on c.id = p.category
cross join lateral (
  select coalesce(p.availability_ttl_hours, c.ttl_hours, config_int('availability_default_ttl_hours'), 12) as ttl_hours
) t
left join lateral (
  select count(*) as n from availability_reports r
  where r.product_id = p.id and r.kind = 'out_of_stock'
    and r.created_at > coalesce(p.availability_confirmed_at, '-infinity'::timestamptz)
    and r.created_at > now() - make_interval(hours => coalesce(config_int('availability_contest_window_hours'), 6))
) o on true
left join lateral (
  select count(*) as n, max(r.created_at) as last_at from availability_reports r
  where r.product_id = p.id and r.kind = 'found'
    and r.created_at > now() - make_interval(hours => t.ttl_hours)
) f on true;
grant select on product_availability to anon, authenticated;
grant all on product_availability to service_role;

-- ---------------------------------------------------------
-- 12. Fonctions de notification (appelées par les déclencheurs)
-- ---------------------------------------------------------
create or replace function notify_restock(p_product uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_p products%rowtype; v_s shops%rowtype; v_a record;
  v_bucket text := to_char(now(), 'YYYYMMDD') || '-' || (extract(hour from now())::int / 6)::text;
  v_hay text;
begin
  select * into v_p from products where id = p_product;
  select * into v_s from shops where id = v_p.shop_id;
  if v_p.id is null or v_s.id is null or v_s.is_blocked then return; end if;
  v_hay := dm_norm(v_p.name || ' ' || coalesce((select string_agg(coalesce(ci.name_fr,'') || ' ' || array_to_string(ci.synonyms, ' '), ' ') from catalog_items ci where ci.id = v_p.catalog_item_id), ''));

  for v_a in
    select a.* from availability_alerts a
    where a.active and a.user_id <> v_s.owner_id
      and (a.max_price_xaf is null or v_p.price_xaf <= a.max_price_xaf)
      and (
        (a.kind = 'product' and a.product_id = v_p.id)
        or (a.kind in ('catalog_item','search')
            and (a.neighborhood is null or dm_norm(a.neighborhood) = dm_norm(coalesce(v_s.neighborhood, '')))
            and (a.city is null or dm_norm(a.city) = dm_norm(coalesce(v_s.city, '')))
            and (
              (a.kind = 'catalog_item' and a.catalog_item_id = v_p.catalog_item_id)
              or (a.kind = 'search' and not exists (
                    select 1 from unnest(string_to_array(dm_norm(a.query), ' ')) tk
                    where tk <> '' and position(tk in v_hay) = 0))
            ))
      )
  loop
    if dm_push_notification(
      v_a.user_id, 'customer', 'restock',
      'Disponible : ' || v_p.name,
      v_s.name || ' vient de signaler la disponibilité — ' || to_char(v_p.price_xaf, 'FM999G999G999') || ' FCFA (prix déclaré).'
        || coalesce(' ' || nullif(concat_ws(', ', v_s.neighborhood, v_s.city), ''), ''),
      '/boutique/' || v_s.id,
      jsonb_build_object('product_id', v_p.id, 'shop_id', v_s.id),
      'restock:' || v_p.id || ':' || v_bucket, 'restock'
    ) then
      update availability_alerts set last_notified_at = now() where id = v_a.id;
    end if;
  end loop;
end; $$;
revoke execute on function notify_restock(uuid) from public, anon, authenticated;

create or replace function notify_price_change(p_product uuid, p_old integer)
returns void language plpgsql security definer set search_path = public as $$
declare v_p products%rowtype; v_s shops%rowtype; v_a record;
begin
  select * into v_p from products where id = p_product;
  select * into v_s from shops where id = v_p.shop_id;
  if v_p.id is null or v_s.is_blocked or p_old = v_p.price_xaf then return; end if;
  for v_a in select * from availability_alerts where active and kind = 'product' and product_id = p_product and user_id <> v_s.owner_id loop
    perform dm_push_notification(
      v_a.user_id, 'customer', 'price_change',
      'Prix modifié : ' || v_p.name,
      v_s.name || ' : ' || to_char(p_old, 'FM999G999G999') || ' → ' || to_char(v_p.price_xaf, 'FM999G999G999') || ' FCFA (prix déclaré).',
      '/boutique/' || v_s.id,
      jsonb_build_object('product_id', v_p.id, 'shop_id', v_s.id, 'old', p_old, 'new', v_p.price_xaf),
      'price:' || v_p.id || ':' || v_p.price_xaf, 'price_change');
  end loop;
end; $$;
revoke execute on function notify_price_change(uuid, integer) from public, anon, authenticated;

create or replace function notify_new_product(p_product uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_p products%rowtype; v_s shops%rowtype; v_f record; v_cap integer := coalesce(config_int('notify_followers_cap'), 300);
begin
  select * into v_p from products where id = p_product;
  select * into v_s from shops where id = v_p.shop_id;
  if v_p.id is null or v_s.is_blocked then return; end if;
  for v_f in select follower_id from follows where shop_id = v_s.id and follower_id <> v_s.owner_id limit v_cap loop
    perform dm_push_notification(
      v_f.follower_id, 'customer', 'new_product',
      'Nouveau chez ' || v_s.name, v_p.name || ' — ' || to_char(v_p.price_xaf, 'FM999G999G999') || ' FCFA',
      '/produit/' || v_p.id, jsonb_build_object('product_id', v_p.id, 'shop_id', v_s.id),
      'new:' || v_p.id, 'new_product');
  end loop;
end; $$;
revoke execute on function notify_new_product(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------
-- 13. RPC marchand : déclarer / reconfirmer
-- ---------------------------------------------------------
create or replace function set_product_availability(p_product_id uuid, p_status text, p_qty integer default null, p_price integer default null)
returns products language plpgsql security definer set search_path = public as $$
declare v_row products;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if p_status not in ('available','limited','out') then raise exception 'Statut invalide'; end if;
  if p_qty is not null and p_qty < 0 then raise exception 'Quantité invalide'; end if;
  if p_price is not null and p_price <= 0 then raise exception 'Prix invalide'; end if;
  if not exists (select 1 from products pr join shops s on s.id = pr.shop_id where pr.id = p_product_id and s.owner_id = auth.uid()) then
    raise exception 'Vous ne pouvez modifier que vos propres articles';
  end if;
  update products
     set availability_status = p_status,
         stock_qty = case when p_status = 'out' then 0 else p_qty end,
         price_xaf = coalesce(p_price, price_xaf),
         availability_confirmed_at = now()
   where id = p_product_id returning * into v_row;
  return v_row;
end; $$;
grant execute on function set_product_availability(uuid, text, integer, integer) to authenticated;

-- « Toujours disponible » : un clic, sans rien ressaisir.
create or replace function confirm_product_availability(p_product_id uuid)
returns products language plpgsql security definer set search_path = public as $$
declare v_row products;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if not exists (select 1 from products pr join shops s on s.id = pr.shop_id where pr.id = p_product_id and s.owner_id = auth.uid()) then
    raise exception 'Vous ne pouvez modifier que vos propres articles';
  end if;
  update products set availability_confirmed_at = now()
   where id = p_product_id and availability_status in ('available','limited') returning * into v_row;
  if v_row.id is null then
    raise exception 'Seul un article déclaré disponible peut être reconfirmé. Signalez son retour en stock pour le rendre à nouveau disponible.';
  end if;
  return v_row;
end; $$;
grant execute on function confirm_product_availability(uuid) to authenticated;

-- « Tout est à jour » : reconfirme en une fois tous les articles déclarés
-- disponibles / stock limité de la boutique (très peu de friction pour un
-- petit commerçant). N'agit jamais sur les ruptures.
create or replace function confirm_shop_availability(p_shop_id uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare v_n integer;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if not exists (select 1 from shops where id = p_shop_id and owner_id = auth.uid()) then
    raise exception 'Vous ne pouvez modifier que votre propre boutique';
  end if;
  update products set availability_confirmed_at = now()
   where shop_id = p_shop_id and availability_status in ('available','limited');
  get diagnostics v_n = row_count;
  return v_n;
end; $$;
grant execute on function confirm_shop_availability(uuid) to authenticated;

-- ---------------------------------------------------------
-- 14. RPC communauté : signaler une disponibilité
-- ---------------------------------------------------------
create or replace function report_availability(p_product_id uuid, p_kind text, p_price integer default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_p products%rowtype; v_s shops%rowtype; v_age integer; v_min integer;
  v_prev timestamptz; v_status text; v_label text;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if p_kind not in ('found','out_of_stock','price_different','shop_closed','wrong_address') then raise exception 'Type de signalement invalide'; end if;
  select * into v_p from products where id = p_product_id;
  if v_p.id is null then raise exception 'Article introuvable'; end if;
  select * into v_s from shops where id = v_p.shop_id;
  if v_s.owner_id = auth.uid() then raise exception 'Vous ne pouvez pas signaler votre propre article'; end if;
  if exists (select 1 from profiles where id = auth.uid() and is_blocked) then raise exception 'Compte suspendu'; end if;

  v_min := coalesce(config_int('report_min_account_age_hours'), 12);
  select extract(epoch from (now() - created_at)) / 3600 into v_age from profiles where id = auth.uid();
  if v_age < v_min then
    raise exception 'Votre compte est trop récent pour signaler une disponibilité (% h minimum).', v_min;
  end if;
  if (select count(*) from availability_reports where reporter_id = auth.uid() and created_at > now() - interval '1 day') >= 30 then
    raise exception 'Limite quotidienne de signalements atteinte.';
  end if;
  if p_kind = 'price_different' and (p_price is null or p_price <= 0) then raise exception 'Indiquez le prix constaté'; end if;

  select created_at into v_prev from availability_reports where product_id = p_product_id and reporter_id = auth.uid() and kind = p_kind;
  if v_prev is not null and v_prev > now() - interval '3 hours' then
    raise exception 'Vous avez déjà fait ce signalement récemment. Merci !';
  end if;

  insert into availability_reports (product_id, shop_id, reporter_id, kind, observed_price_xaf)
  values (p_product_id, v_p.shop_id, auth.uid(), p_kind, p_price)
  on conflict (product_id, reporter_id, kind) do update set created_at = now(), observed_price_xaf = excluded.observed_price_xaf;

  if p_kind in ('out_of_stock','price_different','shop_closed','wrong_address') then
    v_label := case p_kind when 'out_of_stock' then 'Un client signale que « ' || v_p.name || ' » est épuisé.'
      when 'price_different' then 'Un client a constaté un autre prix pour « ' || v_p.name || ' » (' || to_char(p_price, 'FM999G999G999') || ' FCFA).'
      when 'shop_closed' then 'Un client signale votre boutique fermée alors que « ' || v_p.name || ' » est affiché.'
      else 'Un client signale une adresse incorrecte pour votre boutique.' end;
    perform dm_push_notification(v_s.owner_id, 'merchant', 'availability_report', 'Information à vérifier', v_label || ' Mettez à jour votre disponibilité.',
      '/disponibilite', jsonb_build_object('product_id', v_p.id, 'kind', p_kind),
      'rep:' || v_p.id || ':' || p_kind || ':' || to_char(now(), 'YYYYMMDD') || (extract(hour from now())::int / 3)::text, 'merchant_reports');
  end if;

  select effective_status into v_status from product_availability where product_id = p_product_id;
  return jsonb_build_object('ok', true, 'effective_status', v_status);
end; $$;
grant execute on function report_availability(uuid, text, integer) to authenticated;

-- ---------------------------------------------------------
-- 15. RPC avis produit
-- ---------------------------------------------------------
create or replace function submit_product_review(p_product_id uuid, p_rating integer, p_comment text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_p products%rowtype; v_s shops%rowtype; v_id uuid; v_declared boolean;
  v_age numeric; v_comment text := nullif(btrim(coalesce(p_comment, '')), '');
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if p_rating is null or p_rating < 1 or p_rating > 5 then raise exception 'Note invalide (1 à 5)'; end if;
  if v_comment is not null and char_length(v_comment) > 600 then raise exception 'Commentaire trop long (600 caractères maximum)'; end if;
  if v_comment ~* '(https?://|www\.)' then raise exception 'Les liens ne sont pas autorisés dans les avis.'; end if;
  if exists (select 1 from profiles where id = auth.uid() and is_blocked) then raise exception 'Compte suspendu'; end if;
  select * into v_p from products where id = p_product_id;
  if v_p.id is null then raise exception 'Article introuvable'; end if;
  select * into v_s from shops where id = v_p.shop_id;
  if v_s.owner_id = auth.uid() then raise exception 'Vous ne pouvez pas noter votre propre article'; end if;

  select extract(epoch from (now() - created_at)) / 3600 into v_age from profiles where id = auth.uid();
  if v_age < coalesce(config_int('review_min_account_age_hours'), 12) then
    raise exception 'Votre compte est trop récent pour publier un avis (% h minimum).', coalesce(config_int('review_min_account_age_hours'), 12);
  end if;
  if (select count(*) from product_reviews where user_id = auth.uid() and updated_at > now() - interval '1 day') >= coalesce(config_int('review_daily_limit'), 10)
     and not exists (select 1 from product_reviews where user_id = auth.uid() and product_id = p_product_id) then
    raise exception 'Limite quotidienne d''avis atteinte.';
  end if;

  v_declared := exists (
    select 1 from conversations c
    where c.buyer_id = auth.uid() and c.seller_id = v_s.owner_id and c.order_confirmed
      and (c.product_id = p_product_id or c.product_id is null or c.shop_id = v_s.id));

  insert into product_reviews (product_id, shop_id, user_id, rating, comment, declared_exchange)
  values (p_product_id, v_p.shop_id, auth.uid(), p_rating, v_comment, v_declared)
  on conflict (product_id, user_id) do update
    set rating = excluded.rating, comment = excluded.comment,
        declared_exchange = product_reviews.declared_exchange or excluded.declared_exchange,
        updated_at = now()
  returning id into v_id;

  perform dm_push_notification(v_s.owner_id, 'merchant', 'review_received', 'Nouvel avis sur « ' || v_p.name || ' »',
    p_rating::text || '/5' || coalesce(' — ' || left(v_comment, 80), ''), '/produit/' || v_p.id,
    jsonb_build_object('product_id', v_p.id, 'review_id', v_id), 'rev:' || v_id || ':' || to_char(now(), 'YYYYMMDD'), 'merchant_reviews');
  return v_id;
end; $$;
grant execute on function submit_product_review(uuid, integer, text) to authenticated;

create or replace function delete_my_product_review(p_product_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  delete from product_reviews where product_id = p_product_id and user_id = auth.uid();
end; $$;
grant execute on function delete_my_product_review(uuid) to authenticated;

create or replace function reply_to_product_review(p_review_id uuid, p_reply text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if p_reply is not null and p_reply ~* '(https?://|www\.)' then raise exception 'Les liens ne sont pas autorisés.'; end if;
  update product_reviews r set merchant_reply = nullif(btrim(p_reply), ''), merchant_replied_at = case when nullif(btrim(p_reply), '') is null then null else now() end
   where r.id = p_review_id and exists (select 1 from shops s where s.id = r.shop_id and s.owner_id = auth.uid());
  if not found then raise exception 'Avis introuvable ou non autorisé'; end if;
end; $$;
grant execute on function reply_to_product_review(uuid, text) to authenticated;

create or replace function admin_set_review_status(p_review_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not dm_is_admin() then raise exception 'Réservé aux administrateurs'; end if;
  if p_status not in ('visible','hidden','removed') then raise exception 'Statut invalide'; end if;
  update product_reviews set status = p_status where id = p_review_id;
end; $$;
grant execute on function admin_set_review_status(uuid, text) to authenticated;

-- ---------------------------------------------------------
-- 16. Recherche géolocalisée de disponibilité (carte + liste)
--     SECURITY INVOKER : les politiques RLS s'appliquent (boutiques
--     bloquées masquées). Aucun boost payant n'intervient ici : une
--     promotion ne peut jamais rendre un article « disponible ».
--     p_per_shop = 1 -> « produit phare » affiché au-dessus du marqueur ;
--     p_query renseigné -> produits correspondant à la recherche d'abord.
-- ---------------------------------------------------------
create or replace function availability_search(
  p_query text default null,
  p_category text default null,
  p_catalog_item uuid default null,
  p_lat double precision default null,
  p_lng double precision default null,
  p_radius_km double precision default null,
  p_south double precision default null,
  p_west double precision default null,
  p_north double precision default null,
  p_east double precision default null,
  p_only_available boolean default false,
  p_max_price integer default null,
  p_fresh_minutes integer default null,
  p_city text default null,
  p_include_unknown boolean default false,
  p_per_shop integer default 1,
  p_limit integer default 150
) returns table (
  product_id uuid, shop_id uuid, location_id uuid, shop_name text, logo_url text, verified boolean,
  owner_id uuid, hours jsonb, lat double precision, lng double precision, neighborhood text, city text,
  product_name text, price_xaf integer, category text, catalog_item_id uuid, image text,
  effective_status text, declared_status text, confirmed_at timestamptz, stock_qty integer, sale_unit text,
  rating_avg numeric, rating_count integer, likes_count integer, found_reports integer,
  relevance numeric, distance_km double precision
) language plpgsql stable security invoker set search_path = public as $$
declare
  v_tokens text[] := string_to_array(btrim(dm_norm(p_query)), ' ');
  v_has_q boolean := p_query is not null and btrim(p_query) <> '';
  v_dlat double precision; v_dlng double precision;
begin
  if p_radius_km is not null and p_lat is not null and p_lng is not null then
    v_dlat := p_radius_km / 111.0;
    v_dlng := p_radius_km / (111.0 * greatest(cos(radians(p_lat)), 0.2));
  end if;

  return query
  with recursive ct as (
    select pc.id from product_categories pc where pc.id = p_category
    union all
    select c.id from product_categories c join ct on c.parent_id = ct.id
  ),
  base as (
    select
      pa.product_id, pa.shop_id, sl.id as location_id, s.name as shop_name, s.logo_url, s.verified, s.owner_id, s.hours,
      sl.lat, sl.lng, sl.neighborhood, sl.city, pa.name as product_name, pa.price_xaf, pa.category, pa.catalog_item_id,
      pa.images[1] as image, pa.effective_status, pa.declared_status, pa.confirmed_at, pa.stock_qty, pa.sale_unit,
      rs.avg_rating as rating_avg, coalesce(rs.ratings_count, 0) as rating_count,
      (select count(*)::int from likes l where l.product_id = pa.product_id) as likes_count,
      pa.found_reports,
      case when v_has_q then
        case
          when not exists (select 1 from unnest(v_tokens) tk where tk <> '' and position(tk in hay.h) = 0) then
            case when not exists (select 1 from unnest(v_tokens) tk where tk <> '' and position(tk in dm_norm(pa.name)) = 0) then 3.0 else 2.0 end
          else 0 end
        else 1 end as relevance,
      case when p_lat is not null and p_lng is not null then
        6371 * 2 * asin(sqrt(power(sin(radians(sl.lat - p_lat) / 2), 2)
          + cos(radians(p_lat)) * cos(radians(sl.lat)) * power(sin(radians(sl.lng - p_lng) / 2), 2)))
      end as distance_km,
      case pa.effective_status when 'available' then 0 when 'limited' then 1 when 'to_reconfirm' then 2
        when 'contested' then 3 when 'unknown' then 4 else 5 end as status_rank
    from product_availability pa
    join shops s on s.id = pa.shop_id
    join shop_locations sl on sl.shop_id = s.id and sl.is_current
    left join product_rating_stats rs on rs.product_id = pa.product_id
    left join product_categories pcat on pcat.id = pa.category
    left join catalog_items ci on ci.id = pa.catalog_item_id
    cross join lateral (
      select dm_norm(pa.name || ' ' || coalesce(ci.name_fr, '') || ' ' || coalesce(array_to_string(ci.synonyms, ' '), '')
                     || ' ' || coalesce(pcat.name_fr, '') || ' ' || coalesce(pcat.name_en, '')) as h
    ) hay
    where pa.show_on_map
      and s.shop_type = 'physical'
      and sl.lat is not null and sl.lng is not null
      and (p_include_unknown or pa.effective_status <> 'unknown')
      and (not p_only_available or pa.effective_status in ('available', 'limited'))
      and (p_category is null or pa.category in (select ct.id from ct))
      and (p_catalog_item is null or pa.catalog_item_id = p_catalog_item)
      and (p_max_price is null or pa.price_xaf <= p_max_price)
      and (p_fresh_minutes is null or (pa.confirmed_at is not null and pa.confirmed_at > now() - make_interval(mins => p_fresh_minutes)))
      and (p_city is null or dm_norm(sl.city) = dm_norm(p_city))
      and (p_south is null or (sl.lat between p_south and p_north and sl.lng between p_west and p_east))
      and (v_dlat is null or (sl.lat between p_lat - v_dlat and p_lat + v_dlat and sl.lng between p_lng - v_dlng and p_lng + v_dlng))
  ),
  ranked as (
    select b.*,
      row_number() over (partition by b.location_id
        order by b.relevance desc, b.status_rank, (b.likes_count + 2 * b.rating_count) desc, b.confirmed_at desc nulls last) as rn
    from base b
    where (not v_has_q or b.relevance > 0)
      and (p_radius_km is null or b.distance_km is null or b.distance_km <= p_radius_km)
  )
  select r.product_id, r.shop_id, r.location_id, r.shop_name, r.logo_url, r.verified, r.owner_id, r.hours,
         r.lat, r.lng, r.neighborhood, r.city, r.product_name, r.price_xaf, r.category, r.catalog_item_id, r.image,
         r.effective_status, r.declared_status, r.confirmed_at, r.stock_qty, r.sale_unit,
         r.rating_avg, r.rating_count::int, r.likes_count, r.found_reports, r.relevance::numeric, r.distance_km
  from ranked r
  where r.rn <= greatest(p_per_shop, 1)
  order by r.relevance desc, r.status_rank, r.distance_km nulls last, r.price_xaf
  limit least(greatest(p_limit, 1), 400);
end; $$;
grant execute on function availability_search(text,text,uuid,double precision,double precision,double precision,double precision,double precision,double precision,double precision,boolean,integer,integer,text,boolean,integer,integer) to anon, authenticated;

-- ---------------------------------------------------------
-- 17. « Les Trouvailles » : articles appréciés, avec statut RÉEL affiché
--     Classement : note bayésienne + bonus récence des avis + bonus de
--     disponibilité confirmée ; diversité : <= 2 par boutique, <= 3 par
--     catégorie. Un article en rupture ou jamais confirmé n'y figure pas.
-- ---------------------------------------------------------
create or replace function get_trouvailles(p_city text default null, p_limit integer default 10)
returns table (
  product_id uuid, shop_id uuid, shop_name text, neighborhood text, city text, lat double precision, lng double precision,
  product_name text, price_xaf integer, image text, category text, effective_status text, confirmed_at timestamptz,
  rating_avg numeric, rating_count integer, score numeric, sample_comment text, sample_author text
) language plpgsql stable security invoker set search_path = public as $$
declare v_min integer := coalesce(config_int('trouvailles_min_reviews'), 2);
begin
  return query
  with scored as (
    select pa.product_id, pa.shop_id, s.name as shop_name, s.neighborhood, s.city, s.lat, s.lng,
           pa.name as product_name, pa.price_xaf, pa.images[1] as image, pa.category, pa.effective_status, pa.confirmed_at,
           rs.avg_rating, rs.ratings_count,
           (dm_bayes(rs.avg_rating, rs.ratings_count)
             + 0.15 * ln(1 + (select count(*) from product_reviews r2 where r2.product_id = pa.product_id and r2.status = 'visible' and r2.created_at > now() - interval '30 days'))
             + case when pa.effective_status in ('available','limited') then 0.2 else 0 end) as score
    from product_availability pa
    join shops s on s.id = pa.shop_id
    join product_rating_stats rs on rs.product_id = pa.product_id
    where rs.ratings_count >= v_min
      and pa.effective_status in ('available','limited','to_reconfirm','contested')
      and (p_city is null or dm_norm(s.city) = dm_norm(p_city))
  ),
  diverse as (
    select sc.*,
      row_number() over (partition by sc.shop_id order by sc.score desc) as rn_shop,
      row_number() over (partition by sc.category order by sc.score desc) as rn_cat
    from scored sc
  )
  select d.product_id, d.shop_id, d.shop_name, d.neighborhood, d.city, d.lat, d.lng, d.product_name, d.price_xaf, d.image,
         d.category, d.effective_status, d.confirmed_at, d.avg_rating, d.ratings_count::int, round(d.score::numeric, 3),
         (select r.comment from product_reviews r where r.product_id = d.product_id and r.status = 'visible' and r.rating >= 4 and r.comment is not null
            order by r.created_at desc limit 1),
         (select pr.name from product_reviews r join profiles pr on pr.id = r.user_id where r.product_id = d.product_id and r.status = 'visible' and r.rating >= 4 and r.comment is not null
            order by r.created_at desc limit 1)
  from diverse d
  where d.rn_shop <= 2 and d.rn_cat <= 3
  order by d.score desc
  limit least(greatest(p_limit, 1), 30);
end; $$;
grant execute on function get_trouvailles(text, integer) to anon, authenticated;

-- ---------------------------------------------------------
-- 18. Fiabilité de la disponibilité d'une boutique (indicateur explicite)
--     Volontairement distinct de la note boutique (`shop_ratings`) et des
--     notes produit : ce n'est ni une certification ni une garantie.
-- ---------------------------------------------------------
create or replace view shop_availability_reliability with (security_invoker = true) as
with items as (
  select p.shop_id,
         count(*) filter (where p.availability_status <> 'unknown') as tracked,
         count(*) filter (where pa.effective_status in ('available','limited')) as fresh
  from products p join product_availability pa on pa.product_id = p.id
  group by p.shop_id
),
ev as (
  select shop_id, count(*) filter (where source in ('declare','reconfirm','create')) as updates_30d
  from availability_events where created_at > now() - interval '30 days' group by shop_id
),
rep as (
  select shop_id, count(*) filter (where kind in ('out_of_stock','price_different')) as issues_30d
  from availability_reports where created_at > now() - interval '30 days' group by shop_id
)
select s.id as shop_id,
       coalesce(i.tracked, 0)::int as tracked_items,
       coalesce(e.updates_30d, 0)::int as updates_30d,
       coalesce(r.issues_30d, 0)::int as issues_30d,
       case when coalesce(i.tracked, 0) = 0 then null else round(i.fresh::numeric / i.tracked, 2) end as fresh_ratio,
       case
         when coalesce(e.updates_30d, 0) < 3 then 'insufficient'
         when i.tracked > 0 and i.fresh::numeric / i.tracked >= 0.7 and coalesce(r.issues_30d, 0)::numeric / greatest(e.updates_30d, 1) <= 0.1 then 'high'
         when i.tracked > 0 and i.fresh::numeric / i.tracked >= 0.4 and coalesce(r.issues_30d, 0)::numeric / greatest(e.updates_30d, 1) <= 0.3 then 'medium'
         else 'low' end as level
from shops s
left join items i on i.shop_id = s.id
left join ev e on e.shop_id = s.id
left join rep r on r.shop_id = s.id;
grant select on shop_availability_reliability to anon, authenticated;
grant all on shop_availability_reliability to service_role;

-- ---------------------------------------------------------
-- 19. Demande locale (agrégée, anonyme) : journal de recherches sans
--     résultat, statistiques pour les commerçants (seuil de k-anonymat).
-- ---------------------------------------------------------
create table if not exists search_demand_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  query_norm text not null check (char_length(query_norm) between 2 and 80),
  catalog_item_id uuid references catalog_items(id) on delete set null,
  neighborhood text,
  city text,
  results_available integer not null default 0,
  day date not null default current_date,
  created_at timestamptz not null default now(),
  unique (user_id, query_norm, day)
);
create index if not exists search_demand_idx on search_demand_log (city, neighborhood, created_at desc);
alter table search_demand_log enable row level security;
-- aucune politique : illisible par les clients, uniquement via fonctions définies ci-dessous.

create or replace function log_search_demand(p_query text, p_catalog_item uuid default null, p_neighborhood text default null, p_city text default null, p_results integer default 0)
returns void language plpgsql security definer set search_path = public as $$
declare v_q text := btrim(dm_norm(p_query));
begin
  if auth.uid() is null or v_q is null or char_length(v_q) < 2 or char_length(v_q) > 80 then return; end if;
  insert into search_demand_log (user_id, query_norm, catalog_item_id, neighborhood, city, results_available)
  values (auth.uid(), v_q, p_catalog_item, nullif(btrim(p_neighborhood), ''), nullif(btrim(p_city), ''), greatest(coalesce(p_results, 0), 0))
  on conflict (user_id, query_norm, day) do nothing;
end; $$;
grant execute on function log_search_demand(text, uuid, text, text, integer) to authenticated;

create or replace function merchant_demand_insights(p_shop_id uuid)
returns table (term text, catalog_item_id uuid, searchers integer, waiting_alerts integer, in_catalog boolean)
language plpgsql stable security definer set search_path = public as $$
declare v_s shops%rowtype; v_k integer := coalesce(config_int('demand_k_anonymity'), 3);
begin
  select * into v_s from shops where id = p_shop_id and owner_id = auth.uid();
  if v_s.id is null then raise exception 'Boutique introuvable ou non autorisée'; end if;
  return query
  select coalesce(ci.name_fr, d.query_norm) as term, d.catalog_item_id,
         count(distinct d.user_id)::int as searchers,
         coalesce((select count(*)::int from availability_alerts a where a.active and a.catalog_item_id is not distinct from d.catalog_item_id and d.catalog_item_id is not null), 0) as waiting_alerts,
         exists (select 1 from products p where p.shop_id = v_s.id and d.catalog_item_id is not null and p.catalog_item_id = d.catalog_item_id) as in_catalog
  from search_demand_log d
  left join catalog_items ci on ci.id = d.catalog_item_id
  where d.created_at > now() - interval '7 days'
    and dm_norm(coalesce(d.city, '')) = dm_norm(coalesce(v_s.city, ''))
    and (d.neighborhood is null or dm_norm(d.neighborhood) = dm_norm(coalesce(v_s.neighborhood, '')))
  group by coalesce(ci.name_fr, d.query_norm), d.catalog_item_id
  having count(distinct d.user_id) >= v_k
  order by searchers desc limit 20;
end; $$;
grant execute on function merchant_demand_insights(uuid) to authenticated;

-- Tâche quotidienne : prévenir les commerçants d'une forte demande locale
create or replace function notify_merchants_demand()
returns void language plpgsql security definer set search_path = public as $$
declare v_thr integer := coalesce(config_int('demand_alert_threshold'), 5); r record; s record;
begin
  for r in
    select d.catalog_item_id, ci.name_fr, d.city, d.neighborhood, count(distinct d.user_id)::int as n
    from search_demand_log d join catalog_items ci on ci.id = d.catalog_item_id
    where d.created_at > now() - interval '24 hours' and d.catalog_item_id is not null
    group by d.catalog_item_id, ci.name_fr, d.city, d.neighborhood
    having count(distinct d.user_id) >= v_thr
  loop
    for s in
      select sh.id, sh.owner_id, sh.name from shops sh
      join products p on p.shop_id = sh.id and p.catalog_item_id = r.catalog_item_id
      join product_availability pa on pa.product_id = p.id
      where not sh.is_blocked
        and dm_norm(coalesce(sh.city, '')) = dm_norm(coalesce(r.city, ''))
        and (r.neighborhood is null or dm_norm(coalesce(sh.neighborhood, '')) = dm_norm(r.neighborhood))
        and pa.effective_status in ('out','to_reconfirm','unknown')
      group by sh.id, sh.owner_id, sh.name
    loop
      perform dm_push_notification(s.owner_id, 'merchant', 'demand', 'Forte demande dans votre secteur',
        r.n || ' personnes ont recherché « ' || r.name_fr || ' » aujourd''hui. Vous le commercialisez : si vous en avez, actualisez sa disponibilité.',
        '/disponibilite', jsonb_build_object('shop_id', s.id, 'catalog_item_id', r.catalog_item_id),
        'demand:' || s.id || ':' || r.catalog_item_id || ':' || to_char(now(), 'YYYYMMDD'), 'merchant_demand');
    end loop;
  end loop;
  delete from search_demand_log where created_at < now() - interval '90 days';
end; $$;
revoke execute on function notify_merchants_demand() from public, anon, authenticated;

-- Tâche : rappel discret aux commerçants (1 notification / boutique / jour)
create or replace function remind_stale_availability()
returns void language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in
    select s.id as shop_id, s.owner_id, count(*)::int as n
    from products p join shops s on s.id = p.shop_id
    join product_availability pa on pa.product_id = p.id
    where not s.is_blocked and p.availability_status in ('available','limited')
      and p.availability_confirmed_at < now() - make_interval(secs => pa.ttl_hours * 3600 * 0.8)
    group by s.id, s.owner_id
  loop
    perform dm_push_notification(r.owner_id, 'merchant', 'stale_reminder', 'Votre disponibilité est à reconfirmer',
      r.n || ' article(s) n''ont pas été confirmés récemment. Un seul appui sur « Tout est à jour » suffit si votre stock n''a pas changé.',
      '/disponibilite', jsonb_build_object('shop_id', r.shop_id, 'count', r.n),
      'stale:' || r.shop_id || ':' || to_char(now(), 'YYYYMMDD'), 'merchant_reminders');
  end loop;
end; $$;
revoke execute on function remind_stale_availability() from public, anon, authenticated;

select cron.schedule('dabbymarket-notify-demand', '0 7 * * *', $$select notify_merchants_demand();$$);
select cron.schedule('dabbymarket-remind-stale-availability', '0 */3 * * *', $$select remind_stale_availability();$$);
