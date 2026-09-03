-- =========================================================
-- DabbyMarket — 0016 : VENTE FLASH
-- Troisième mode de vente, pour un particulier/vendeur occasionnel qui
-- veut vendre vite un ou plusieurs articles, sans créer de boutique.
--
-- DÉCISIONS D'ARCHITECTURE (voir livrable pour la justification complète) :
-- 1. Table dédiée `flash_listings`, jamais rattachée à `shops` — un
--    vendeur Flash n'a ni vitrine, ni catalogue, ni carte de boutique.
--    C'est ce qui empêche structurellement la Vente Flash de cannibaliser
--    le modèle boutique (section 20 du cahier des charges).
-- 2. Toute mutation qui touche à l'argent ou au cycle de vie passe par une
--    fonction RPC SECURITY DEFINER (aucune police INSERT/UPDATE cliente
--    sur la table) — exactement le même choix que `boosts` /
--    `pepites_transactions` déjà en place. Plus simple et plus sûr que
--    des polices RLS colonne par colonne.
-- 3. Le prix dépend de la durée (24h/48h/7j) — les paliers 14/30 jours
--    évoqués dans les échanges préparatoires sont volontairement écartés
--    du P0 : au-delà d'une semaine il ne s'agit plus d'une vente
--    "flash" mais d'une annonce prolongée, et ce n'est pas ce que ce
--    module doit vendre (voir livrable, section P1/P2).
-- 4. Le "quota gratuit" n'est pas un flag séparé : la 1ère annonce Flash
--    déclenche EXACTEMENT le même bonus de bienvenue (150 Pépites) que le
--    1er article de boutique avec photo — un seul mécanisme économique
--    pour toute la plateforme, au lieu d'en dupliquer un second.
-- =========================================================

-- ---------------------------------------------------------
-- 1. Table principale
-- ---------------------------------------------------------
create table if not exists flash_listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  description text,
  category text not null,
  condition text check (condition in ('Neuf','Comme neuf','Très bon état','Bon état','État moyen')),
  price_xaf integer not null check (price_xaf > 0),
  negotiable boolean not null default false,
  images text[] not null default '{}',
  city text not null default 'Yaoundé',
  neighborhood text not null,
  landmark text,
  duration_hours integer not null,
  is_free_listing boolean not null default false,
  status text not null default 'active' check (status in ('active','sold','removed','expired','suspended')),
  visibility text not null default 'normal' check (visibility in ('normal','reduced')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint flash_listings_has_photo check (array_length(images, 1) >= 1)
);

create index if not exists flash_listings_status_idx on flash_listings (status, expires_at);
create index if not exists flash_listings_seller_idx on flash_listings (seller_id);
create index if not exists flash_listings_category_idx on flash_listings (category);
create index if not exists flash_listings_neighborhood_idx on flash_listings (city, neighborhood);

alter table flash_listings enable row level security;

-- Lecture : tout le monde voit les annonces actives et non expirées ;
-- le vendeur voit toujours les siennes (y compris vendues/retirées) ;
-- l'admin voit tout (modération).
create policy "Ventes Flash visibles selon statut"
  on flash_listings for select
  using (
    (status = 'active' and expires_at > now())
    or seller_id = auth.uid()
    or exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin)
  );

-- Aucune police INSERT/UPDATE cliente : tout passe par les fonctions
-- ci-dessous (SECURITY DEFINER), qui font foi pour le paiement en
-- Pépites et pour les transitions de statut autorisées.

-- ---------------------------------------------------------
-- 2. Paramètres éditables par l'admin (sans déploiement), ajoutés à
--    la table app_config déjà créée en 0012.
-- ---------------------------------------------------------
insert into app_config (key, value, description) values
  ('flash_price_24h', '10', 'Coût en Pépites d''une Vente Flash 24h (au-delà de la 1ère annonce gratuite)'),
  ('flash_price_48h', '15', 'Coût en Pépites d''une Vente Flash 48h'),
  ('flash_price_7d',  '25', 'Coût en Pépites d''une Vente Flash 7 jours'),
  ('flash_free_duration_hours', '48', 'Durée offerte pour la toute première annonce Flash/article d''un nouvel utilisateur'),
  ('flash_report_alert_threshold', '3', 'Nombre de signalants distincts déclenchant une alerte visible en modération'),
  ('flash_report_reduce_threshold', '5', 'Nombre de signalants distincts déclenchant une réduction de visibilité automatique'),
  ('flash_report_suspend_threshold', '10', 'Nombre de signalants distincts déclenchant une suspension automatique en attente de revue')
on conflict (key) do nothing;

-- ---------------------------------------------------------
-- 3. Boost Flash — un seul type en P0, réutilise boost_catalog/boosts.
-- ---------------------------------------------------------
alter table boost_catalog drop constraint if exists boost_catalog_boost_type_check;
alter table boost_catalog add constraint boost_catalog_boost_type_check
  check (boost_type in ('article','shop','carte','recherche','ia','accueil','flash'));

insert into boost_catalog (id, boost_type, duration_hours, cost_pepites, label, sort_order) values
  ('flash_48h', 'flash', 48, 30, 'Boost Vente Flash — 48h', 20)
on conflict (id) do nothing;

alter table boosts drop constraint if exists boosts_target_type_check;
alter table boosts add constraint boosts_target_type_check
  check (target_type in ('product','shop','flash_listing'));

-- purchase_boost() vérifie la propriété de la cible avant de débiter —
-- on étend cette vérification à 'flash_listing' sans dupliquer le reste
-- de la fonction.
create or replace function purchase_boost(p_target_type text, p_target_id uuid, p_boost_catalog_id text)
returns uuid language plpgsql security definer as $$
declare
  v_catalog boost_catalog%rowtype;
  v_balance integer;
  v_boost_id uuid;
begin
  select * into v_catalog from boost_catalog where id = p_boost_catalog_id and active;
  if v_catalog.id is null then raise exception 'Boost introuvable ou inactif'; end if;

  if p_target_type = 'product' then
    if not exists (select 1 from products pr join shops s on s.id = pr.shop_id where pr.id = p_target_id and s.owner_id = auth.uid()) then
      raise exception 'Vous ne pouvez booster que vos propres articles';
    end if;
  elsif p_target_type = 'shop' then
    if not exists (select 1 from shops where id = p_target_id and owner_id = auth.uid()) then
      raise exception 'Vous ne pouvez booster que vos propres boutiques';
    end if;
  elsif p_target_type = 'flash_listing' then
    if not exists (select 1 from flash_listings where id = p_target_id and seller_id = auth.uid() and status = 'active') then
      raise exception 'Vous ne pouvez booster que votre propre Vente Flash active';
    end if;
  else
    raise exception 'Type de cible invalide';
  end if;

  select pepites_balance into v_balance from profiles where id = auth.uid() for update;
  if v_balance < v_catalog.cost_pepites then raise exception 'Solde de Pépites insuffisant'; end if;

  update profiles set pepites_balance = pepites_balance - v_catalog.cost_pepites where id = auth.uid();

  insert into boosts (buyer_id, target_type, target_id, boost_catalog_id, boost_type, expires_at)
    values (auth.uid(), p_target_type, p_target_id, v_catalog.id, v_catalog.boost_type, now() + make_interval(hours => v_catalog.duration_hours))
    returning id into v_boost_id;

  insert into pepites_transactions (user_id, type, amount, status, admin_note)
    values (auth.uid(), 'boost_purchase', -v_catalog.cost_pepites, 'confirmed', v_catalog.label);

  if p_target_type = 'product' and v_catalog.boost_type = 'article' then
    update products set boosted_until = greatest(coalesce(boosted_until, now()), now() + make_interval(hours => v_catalog.duration_hours)) where id = p_target_id;
  end if;

  return v_boost_id;
end; $$;

-- ---------------------------------------------------------
-- 4. Signalements — on étend le type de cible existant (0009).
-- ---------------------------------------------------------
alter table reports drop constraint if exists reports_target_type_check;
alter table reports add constraint reports_target_type_check
  check (target_type in ('shop','product','post','user','flash_listing'));

-- Escalade automatique par seuils, pondérée par SIGNALANT DISTINCT (pas
-- par nombre brut de signalements) — un même compte qui signale 10 fois
-- la même annonce ne compte que pour 1, ce qui limite mécaniquement la
-- manipulation par un concurrent utilisant un seul compte. La
-- pondération par ancienneté de compte / détection de faux signalements
-- est volontairement laissée en P1 (voir livrable, "simple mais robuste"
-- pour le P0).
create or replace function handle_flash_report()
returns trigger language plpgsql security definer as $$
declare
  v_distinct integer;
  v_alert integer := config_int('flash_report_alert_threshold');
  v_reduce integer := config_int('flash_report_reduce_threshold');
  v_suspend integer := config_int('flash_report_suspend_threshold');
begin
  if new.target_type <> 'flash_listing' then
    return new;
  end if;

  select count(distinct reporter_id) into v_distinct
    from reports where target_type = 'flash_listing' and target_id = new.target_id and status = 'pending';

  if v_distinct >= v_suspend then
    update flash_listings set status = 'suspended', visibility = 'reduced', updated_at = now()
      where id = new.target_id and status <> 'suspended';
  elsif v_distinct >= v_reduce then
    update flash_listings set visibility = 'reduced', updated_at = now()
      where id = new.target_id and visibility <> 'reduced';
  end if;
  -- Au palier "alerte" (v_alert), aucune action automatique sur
  -- l'annonce : elle est déjà visible dans la file d'admin_moderation
  -- existante (reports.status = 'pending'), qui liste tous les
  -- signalements sans distinction de cible depuis la migration 0009.

  return new;
end; $$;

drop trigger if exists trg_flash_report on reports;
create trigger trg_flash_report after insert on reports
  for each row execute function handle_flash_report();

-- Action admin manuelle (réexaminer après suspension automatique, ou
-- retirer une annonce frauduleuse sans attendre le seuil).
create or replace function admin_set_flash_status(p_flash_id uuid, p_status text)
returns void language plpgsql security definer as $$
begin
  if not exists (select 1 from profiles where id = auth.uid() and is_admin) then
    raise exception 'Réservé aux administrateurs';
  end if;
  if p_status not in ('active','removed','suspended') then
    raise exception 'Statut invalide';
  end if;
  update flash_listings
    set status = p_status,
        visibility = case when p_status = 'active' then 'normal' else visibility end,
        updated_at = now()
    where id = p_flash_id;
end; $$;
grant execute on function admin_set_flash_status(uuid, text) to authenticated;

-- ---------------------------------------------------------
-- 5. Bonus de bienvenue — extension à la Vente Flash.
--    Même colonne welcome_bonus_status que pour les boutiques (0012) :
--    le bonus n'est versé qu'une fois, quel que soit le premier
--    déclencheur (1er article de boutique avec photo OU 1ère Vente
--    Flash avec photo).
-- ---------------------------------------------------------
create or replace function grant_welcome_bonus_if_eligible_flash(p_flash_id uuid)
returns void language plpgsql security definer as $$
declare
  v_user_id uuid;
  v_has_photo boolean;
  v_status text;
  v_amount integer := config_int('welcome_bonus_amount');
  v_days integer := config_int('welcome_bonus_expiry_days');
begin
  select seller_id, (array_length(images, 1) > 0) into v_user_id, v_has_photo
    from flash_listings where id = p_flash_id;

  if v_user_id is null or not coalesce(v_has_photo, false) then return; end if;

  select welcome_bonus_status into v_status from profiles where id = v_user_id;
  if v_status <> 'pending' then return; end if;

  update profiles
     set pepites_balance = pepites_balance + v_amount,
         welcome_bonus_status = 'granted',
         welcome_bonus_granted_at = now(),
         welcome_bonus_expires_at = now() + make_interval(days => v_days)
   where id = v_user_id;

  insert into pepites_transactions (user_id, type, amount, status, admin_note)
    values (v_user_id, 'welcome_bonus', v_amount, 'confirmed', 'Bonus de bienvenue — 1ère Vente Flash avec photo');
end; $$;
grant execute on function grant_welcome_bonus_if_eligible_flash(uuid) to authenticated;

-- ---------------------------------------------------------
-- 6. Publication d'une Vente Flash — point d'entrée unique.
--    Gratuite (durée forcée à flash_free_duration_hours) si l'utilisateur
--    n'a encore jamais reçu le bonus de bienvenue ; sinon débite le
--    palier de durée choisi.
-- ---------------------------------------------------------
alter table pepites_transactions drop constraint if exists pepites_transactions_type_check;
alter table pepites_transactions add constraint pepites_transactions_type_check
  check (type in ('recharge','publish','boost_product','boost_shop','admin_grant','admin_adjustment',
                   'boost_purchase','welcome_bonus','welcome_bonus_expired','quota_overage','quota_overage_failed',
                   'flash_publish','flash_extend'));

create or replace function publish_flash_listing(
  p_title text,
  p_description text,
  p_category text,
  p_condition text,
  p_price_xaf integer,
  p_negotiable boolean,
  p_images text[],
  p_city text,
  p_neighborhood text,
  p_landmark text,
  p_duration_hours integer
) returns uuid language plpgsql security definer as $$
declare
  v_welcome_status text;
  v_is_free boolean := false;
  v_duration integer := p_duration_hours;
  v_price integer;
  v_key text;
  v_balance integer;
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Connecte-toi d''abord'; end if;
  if p_images is null or array_length(p_images, 1) is null or array_length(p_images, 1) < 1 then
    raise exception 'Au moins une photo est requise';
  end if;
  if array_length(p_images, 1) > 5 then raise exception 'Maximum 5 photos'; end if;
  if coalesce(trim(p_neighborhood), '') = '' then raise exception 'Le quartier est requis'; end if;

  select welcome_bonus_status into v_welcome_status from profiles where id = auth.uid() for update;

  if v_welcome_status = 'pending' then
    v_is_free := true;
    v_duration := config_int('flash_free_duration_hours');
  else
    v_key := case v_duration
      when 24 then 'flash_price_24h'
      when 48 then 'flash_price_48h'
      when 168 then 'flash_price_7d'
      else null
    end;
    if v_key is null then raise exception 'Durée invalide'; end if;
    v_price := config_int(v_key);

    select pepites_balance into v_balance from profiles where id = auth.uid();
    if v_balance < v_price then raise exception 'Solde de Pépites insuffisant'; end if;

    update profiles set pepites_balance = pepites_balance - v_price where id = auth.uid();
    insert into pepites_transactions (user_id, type, amount, status, admin_note)
      values (auth.uid(), 'flash_publish', -v_price, 'confirmed', v_duration || 'h — Vente Flash');
  end if;

  insert into flash_listings (
    seller_id, title, description, category, condition, price_xaf, negotiable,
    images, city, neighborhood, landmark, duration_hours, expires_at, is_free_listing
  ) values (
    auth.uid(), p_title, p_description, p_category, p_condition, p_price_xaf, p_negotiable,
    p_images, coalesce(p_city, 'Yaoundé'), p_neighborhood, p_landmark, v_duration,
    now() + make_interval(hours => v_duration), v_is_free
  ) returning id into v_id;

  perform grant_welcome_bonus_if_eligible_flash(v_id);

  return v_id;
end; $$;
grant execute on function publish_flash_listing(text, text, text, text, integer, boolean, text[], text, text, text, integer) to authenticated;

-- ---------------------------------------------------------
-- 7. Prolongation — même grille de prix que la publication.
-- ---------------------------------------------------------
create or replace function extend_flash_listing(p_flash_id uuid, p_extra_hours integer)
returns void language plpgsql security definer as $$
declare
  v_key text;
  v_price integer;
  v_balance integer;
  v_owner uuid;
  v_status text;
begin
  select seller_id, status into v_owner, v_status from flash_listings where id = p_flash_id for update;
  if v_owner is null or v_owner <> auth.uid() then raise exception 'Vous ne pouvez prolonger que votre propre annonce'; end if;
  if v_status <> 'active' then raise exception 'Cette annonce n''est plus active'; end if;

  v_key := case p_extra_hours
    when 24 then 'flash_price_24h'
    when 48 then 'flash_price_48h'
    when 168 then 'flash_price_7d'
    else null
  end;
  if v_key is null then raise exception 'Durée invalide'; end if;
  v_price := config_int(v_key);

  select pepites_balance into v_balance from profiles where id = auth.uid();
  if v_balance < v_price then raise exception 'Solde de Pépites insuffisant'; end if;

  update profiles set pepites_balance = pepites_balance - v_price where id = auth.uid();
  insert into pepites_transactions (user_id, type, amount, status, admin_note)
    values (auth.uid(), 'flash_extend', -v_price, 'confirmed', p_extra_hours || 'h — Prolongation Vente Flash');

  update flash_listings
    set expires_at = expires_at + make_interval(hours => p_extra_hours),
        duration_hours = duration_hours + p_extra_hours,
        updated_at = now()
    where id = p_flash_id;
end; $$;
grant execute on function extend_flash_listing(uuid, integer) to authenticated;

-- ---------------------------------------------------------
-- 8. Marquer vendu / retirer — pas d'argent en jeu, mais on garde une
--    fonction dédiée plutôt qu'une police UPDATE générique, pour ne
--    jamais laisser un client modifier expires_at/duration_hours/
--    is_free_listing/visibility par ce chemin.
-- ---------------------------------------------------------
create or replace function mark_flash_status(p_flash_id uuid, p_status text)
returns void language plpgsql security definer as $$
begin
  if p_status not in ('sold','removed') then raise exception 'Statut invalide'; end if;
  update flash_listings
    set status = p_status, updated_at = now()
    where id = p_flash_id and seller_id = auth.uid() and status = 'active';
  if not found then raise exception 'Annonce introuvable ou déjà clôturée'; end if;
end; $$;
grant execute on function mark_flash_status(uuid, text) to authenticated;

-- ---------------------------------------------------------
-- 9. Expiration automatique — même mécanique que expire_boosts() (0012),
--    rejouée par le cron déjà en place.
-- ---------------------------------------------------------
create or replace function expire_flash_listings()
returns void language sql as $$
  update flash_listings set status = 'expired', updated_at = now()
    where status = 'active' and expires_at <= now();
$$;

select cron.schedule('dabbymarket-expire-flash-listings', '*/15 * * * *', $$select expire_flash_listings();$$);

-- ---------------------------------------------------------
-- 10bis. Vues (0004) — la Vente Flash réutilise le même compteur de vues
--        que produits/boutiques plutôt que d'en créer un troisième.
-- ---------------------------------------------------------
alter table views drop constraint if exists views_target_type_check;
alter table views add constraint views_target_type_check
  check (target_type in ('product','shop','flash_listing'));

drop policy if exists "Lecture des vues par le propriétaire ou un admin" on views;
create policy "Lecture des vues par le propriétaire ou un admin" on views for select
  using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin)
    or (target_type = 'shop' and exists (select 1 from shops s where s.id = target_id and s.owner_id = auth.uid()))
    or (target_type = 'product' and exists (
      select 1 from products pr join shops s on s.id = pr.shop_id
      where pr.id = target_id and s.owner_id = auth.uid()
    ))
    or (target_type = 'flash_listing' and exists (select 1 from flash_listings f where f.id = target_id and f.seller_id = auth.uid()))
  );

-- ---------------------------------------------------------
-- 10. Stockage — bucket dédié aux photos de Vente Flash (même politique
--     que les buckets existants : lecture publique, écriture dans son
--     propre dossier utilisateur).
-- ---------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('flash-images', 'flash-images', true)
on conflict (id) do nothing;

create policy "Lecture publique des photos Vente Flash"
  on storage.objects for select
  using (bucket_id = 'flash-images');

create policy "Upload Vente Flash dans son propre dossier"
  on storage.objects for insert
  with check (bucket_id = 'flash-images' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Suppression de ses propres photos Vente Flash"
  on storage.objects for delete
  using (bucket_id = 'flash-images' and (storage.foldername(name))[1] = auth.uid()::text);
