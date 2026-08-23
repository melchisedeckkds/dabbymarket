-- =========================================================
-- DabbyMarket — 0012 : Modèle économique v1 ("Modèle 1")
-- Remplace tout barème antérieur (publication payante, 3 Pépites/500 FCFA,
-- quota de 10, etc.) par : gratuit pour être découvert, payant pour être
-- mis en avant. ADDITIVE (aucune table existante n'est supprimée), mais
-- change le comportement par défaut du solde de bienvenue (voir §5).
-- =========================================================

-- ---------------------------------------------------------
-- 1. Configuration éditable par l'admin (sans déploiement de code)
-- ---------------------------------------------------------
create table if not exists app_config (
  key text primary key,
  value jsonb not null,
  description text,
  updated_at timestamptz not null default now(),
  updated_by uuid references profiles(id)
);

alter table app_config enable row level security;
create policy "Configuration lisible par tous" on app_config for select using (true);

insert into app_config (key, value, description) values
  ('free_active_listings_quota', '3', 'Nombre d''articles actifs gratuits par boutique (Modèle 1 ; passera à 10 au Modèle 2)'),
  ('quota_overage_price_pepites', '10', 'Coût mensuel récurrent par article actif au-delà du quota gratuit'),
  ('welcome_bonus_amount', '150', 'Pépites offertes après la première publication d''un article actif avec photo'),
  ('welcome_bonus_expiry_days', '30', 'Délai d''expiration du bonus de bienvenue non utilisé'),
  ('max_shops_per_phone', '2', 'Nombre maximum de boutiques par numéro de téléphone vérifié'),
  ('max_accounts_per_device_24h', '2', 'Nombre maximum de comptes créés depuis le même appareil sur 24h'),
  ('home_featured_slots_per_day', '5', 'Créneaux "Mise en avant Accueil" disponibles par jour'),
  ('boost_rank_bonus_cap', '3', 'Bonus de rang maximum qu''un boost peut apporter dans un classement organique')
on conflict (key) do nothing;

create or replace function config_int(p_key text)
returns integer language sql stable as $$
  select (value #>> '{}')::int from app_config where key = p_key;
$$;
grant execute on function config_int(text) to anon, authenticated;

-- ---------------------------------------------------------
-- 2. Packs de Pépites (achat via Mobile Money, flux de recharge existant)
-- ---------------------------------------------------------
create table if not exists pepite_packs (
  id text primary key,
  label text not null,
  pepites integer not null,
  price_fcfa integer not null,
  sort_order integer not null default 0,
  active boolean not null default true
);
alter table pepite_packs enable row level security;
create policy "Packs lisibles par tous" on pepite_packs for select using (true);

insert into pepite_packs (id, label, pepites, price_fcfa, sort_order) values
  ('MICRO',    'Micro',    100,  500,   1),
  ('STARTER',  'Starter',  250,  1200,  2),
  ('STANDARD', 'Standard', 500,  2300,  3),
  ('PRO',      'Pro',      1000, 4400,  4),
  ('BUSINESS', 'Business', 2500, 10000, 5)
on conflict (id) do nothing;

-- Traçabilité : quel pack a motivé une demande de recharge (facultatif,
-- l'utilisateur peut aussi saisir un montant libre comme avant).
alter table pepites_transactions add column if not exists pack_id text references pepite_packs(id);

-- ---------------------------------------------------------
-- 3. Catalogue des 6 boosts (type × durée × prix), éditable par l'admin
-- ---------------------------------------------------------
create table if not exists boost_catalog (
  id text primary key,
  boost_type text not null check (boost_type in ('article','shop','carte','recherche','ia','accueil')),
  duration_hours integer not null,
  cost_pepites integer not null,
  label text not null,
  sort_order integer not null default 0,
  active boolean not null default true
);
alter table boost_catalog enable row level security;
create policy "Catalogue boosts lisible par tous" on boost_catalog for select using (true);

insert into boost_catalog (id, boost_type, duration_hours, cost_pepites, label, sort_order) values
  ('article_24h',   'article',   24,  25,  'Boost Article — 24h',                1),
  ('article_48h',   'article',   48,  45,  'Boost Article — 48h',                2),
  ('article_7d',    'article',   168, 100, 'Boost Article — 7 jours',            3),
  ('shop_3d',       'shop',      72,  60,  'Boost Boutique — 3 jours',           4),
  ('shop_7d',       'shop',      168, 100, 'Boost Boutique — 7 jours',           5),
  ('shop_30d',      'shop',      720, 350, 'Boost Boutique — 30 jours',          6),
  ('carte_24h',     'carte',     24,  20,  'Boost Carte — 24h',                  7),
  ('carte_7d',      'carte',     168, 90,  'Boost Carte — 7 jours',              8),
  ('recherche_48h', 'recherche', 48,  35,  'Boost Recherche — 48h',              9),
  ('recherche_7d',  'recherche', 168, 80,  'Boost Recherche — 7 jours',          10),
  ('ia_7d',         'ia',        168, 70,  'Boost Recommandation IA — 7 jours',  11),
  ('ia_30d',        'ia',        720, 220, 'Boost Recommandation IA — 30 jours', 12),
  ('accueil_24h',   'accueil',   24,  150, 'Mise en avant Accueil — 24h',        13)
on conflict (id) do nothing;

-- ---------------------------------------------------------
-- 4. Boosts achetés / actifs (un même article ou boutique peut en cumuler
--    plusieurs, de types différents, simultanément).
-- ---------------------------------------------------------
create table if not exists boosts (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references profiles(id) on delete cascade,
  target_type text not null check (target_type in ('product','shop')),
  target_id uuid not null,
  boost_catalog_id text not null references boost_catalog(id),
  boost_type text not null,
  starts_at timestamptz not null default now(),
  expires_at timestamptz not null,
  status text not null default 'active' check (status in ('active','cancelled','expired')),
  cancelled_by uuid references profiles(id),
  cancelled_reason text,
  created_at timestamptz not null default now()
);
alter table boosts enable row level security;
create policy "Boosts visibles par tous (affichage sponsorisé)" on boosts for select using (true);
create index if not exists boosts_active_lookup_idx on boosts (target_type, target_id, status, expires_at);
create index if not exists boosts_type_active_idx on boosts (boost_type, status, expires_at);

-- Vue pratique : boosts actifs à l'instant présent, quel que soit le type.
create or replace view active_boosts as
  select * from boosts where status = 'active' and expires_at > now();
grant select on active_boosts to anon, authenticated;

-- Achat d'un boost : vérifie le solde, débite, active le boost.
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

  -- Rétro-compatibilité : les boosts "article" et "shop" continuent
  -- d'alimenter les champs existants boosted_until, lus par l'ancien code.
  if p_target_type = 'product' and v_catalog.boost_type = 'article' then
    update products set boosted_until = greatest(coalesce(boosted_until, now()), now() + make_interval(hours => v_catalog.duration_hours)) where id = p_target_id;
  end if;

  return v_boost_id;
end; $$;
grant execute on function purchase_boost(text, uuid, text) to authenticated;

-- Annulation manuelle par l'admin (abus, litige) — section 8 du cahier des charges.
create or replace function admin_cancel_boost(p_boost_id uuid, p_reason text default null)
returns void language plpgsql security definer as $$
begin
  if not exists (select 1 from profiles where id = auth.uid() and is_admin) then
    raise exception 'Réservé aux administrateurs';
  end if;
  update boosts set status = 'cancelled', cancelled_by = auth.uid(), cancelled_reason = p_reason where id = p_boost_id;
end; $$;
grant execute on function admin_cancel_boost(uuid, text) to authenticated;

-- Extension exceptionnelle par l'admin (ajoute des heures à un boost actif).
create or replace function admin_extend_boost(p_boost_id uuid, p_extra_hours integer)
returns void language plpgsql security definer as $$
begin
  if not exists (select 1 from profiles where id = auth.uid() and is_admin) then
    raise exception 'Réservé aux administrateurs';
  end if;
  update boosts set expires_at = expires_at + make_interval(hours => p_extra_hours) where id = p_boost_id;
end; $$;
grant execute on function admin_extend_boost(uuid, integer) to authenticated;

-- Marque périodiquement les boosts expirés (appelé par le cron ci-dessous,
-- mais aussi rejouable manuellement sans risque).
create or replace function expire_boosts()
returns void language sql as $$
  update boosts set status = 'expired' where status = 'active' and expires_at <= now();
$$;

-- ---------------------------------------------------------
-- 5. Mise en avant Accueil — file de créneaux plafonnée
-- ---------------------------------------------------------
create table if not exists home_featured_slots (
  id uuid primary key default gen_random_uuid(),
  slot_date date not null,
  slot_index integer not null,
  boost_id uuid references boosts(id) on delete set null,
  target_type text check (target_type in ('product','shop')),
  target_id uuid,
  reserved_at timestamptz,
  unique (slot_date, slot_index)
);
alter table home_featured_slots enable row level security;
create policy "Créneaux accueil lisibles par tous" on home_featured_slots for select using (true);

-- Réserve le prochain créneau libre du jour (ou du lendemain si complet) et
-- achète le boost "accueil_24h" en une seule transaction.
create or replace function purchase_home_feature(p_target_type text, p_target_id uuid)
returns uuid language plpgsql security definer as $$
declare
  v_catalog boost_catalog%rowtype;
  v_balance integer;
  v_boost_id uuid;
  v_slot_date date := current_date;
  v_slot_index integer;
  v_max_slots integer := config_int('home_featured_slots_per_day');
begin
  select * into v_catalog from boost_catalog where id = 'accueil_24h' and active;

  if p_target_type = 'product' then
    if not exists (select 1 from products pr join shops s on s.id = pr.shop_id where pr.id = p_target_id and s.owner_id = auth.uid()) then
      raise exception 'Vous ne pouvez mettre en avant que vos propres articles';
    end if;
  elsif p_target_type = 'shop' then
    if not exists (select 1 from shops where id = p_target_id and owner_id = auth.uid()) then
      raise exception 'Vous ne pouvez mettre en avant que vos propres boutiques';
    end if;
  else
    raise exception 'Type de cible invalide';
  end if;

  -- Cherche un créneau libre aujourd'hui, sinon les jours suivants (jusqu'à 14 jours).
  for i in 0..14 loop
    v_slot_date := current_date + i;
    select min(s.i) into v_slot_index
      from generate_series(1, v_max_slots) as s(i)
      where not exists (select 1 from home_featured_slots h where h.slot_date = v_slot_date and h.slot_index = s.i);
    exit when v_slot_index is not null;
  end loop;
  if v_slot_index is null then raise exception 'Aucun créneau disponible dans les 14 prochains jours'; end if;

  select pepites_balance into v_balance from profiles where id = auth.uid() for update;
  if v_balance < v_catalog.cost_pepites then raise exception 'Solde de Pépites insuffisant'; end if;

  update profiles set pepites_balance = pepites_balance - v_catalog.cost_pepites where id = auth.uid();

  insert into boosts (buyer_id, target_type, target_id, boost_catalog_id, boost_type, starts_at, expires_at)
    values (auth.uid(), p_target_type, p_target_id, v_catalog.id, 'accueil', v_slot_date, v_slot_date + interval '1 day')
    returning id into v_boost_id;

  insert into home_featured_slots (slot_date, slot_index, boost_id, target_type, target_id, reserved_at)
    values (v_slot_date, v_slot_index, v_boost_id, p_target_type, p_target_id, now());

  insert into pepites_transactions (user_id, type, amount, status, admin_note)
    values (auth.uid(), 'boost_purchase', -v_catalog.cost_pepites, 'confirmed', 'Mise en avant Accueil — ' || v_slot_date);

  return v_boost_id;
end; $$;
grant execute on function purchase_home_feature(text, uuid) to authenticated;

-- ---------------------------------------------------------
-- 6. Bonus de bienvenue — 150 Pépites, déclenché par le 1er article avec
--    photo, jamais à l'inscription. Remplace l'ancien octroi automatique.
-- ---------------------------------------------------------
alter table profiles alter column pepites_balance set default 0;
alter table profiles add column if not exists welcome_bonus_status text not null default 'pending' check (welcome_bonus_status in ('pending','granted','expired','used_marker'));
alter table profiles add column if not exists welcome_bonus_granted_at timestamptz;
alter table profiles add column if not exists welcome_bonus_expires_at timestamptz;

-- L'inscription ne crédite plus aucune Pépite automatiquement.
create or replace function handle_new_user()
returns trigger
language plpgsql security definer as $$
begin
  insert into profiles (id, phone, name, pepites_balance)
    values (new.id, coalesce(new.phone, new.email), coalesce(new.raw_user_meta_data->>'name', 'Nouvel utilisateur'), 0);
  return new;
end; $$;

-- Appelée après la publication d'un article : verse le bonus une seule
-- fois, uniquement si l'article a au moins une photo.
create or replace function grant_welcome_bonus_if_eligible(p_product_id uuid)
returns void language plpgsql security definer as $$
declare
  v_user_id uuid;
  v_has_photo boolean;
  v_status text;
  v_amount integer := config_int('welcome_bonus_amount');
  v_days integer := config_int('welcome_bonus_expiry_days');
begin
  select s.owner_id, (array_length(pr.images, 1) > 0) into v_user_id, v_has_photo
    from products pr join shops s on s.id = pr.shop_id where pr.id = p_product_id;

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
    values (v_user_id, 'welcome_bonus', v_amount, 'confirmed', 'Bonus de bienvenue — 1er article avec photo');
end; $$;
grant execute on function grant_welcome_bonus_if_eligible(uuid) to authenticated;

-- Expire le bonus non utilisé après le délai configuré. "Non utilisé" est
-- interprété prudemment ici comme : le solde courant est encore ≥ au
-- montant du bonus reçu (c-à-d qu'aucune dépense n'a entamé le bonus).
-- Journalise chaque expiration dans pepites_transactions pour audit.
create or replace function expire_welcome_bonuses()
returns void language plpgsql as $$
declare v_row record; v_amount integer;
begin
  for v_row in
    select id, pepites_balance, welcome_bonus_granted_at
    from profiles
    where welcome_bonus_status = 'granted'
      and welcome_bonus_expires_at <= now()
  loop
    select (value #>> '{}')::int into v_amount from app_config where key = 'welcome_bonus_amount';
    if v_row.pepites_balance >= v_amount then
      update profiles set pepites_balance = pepites_balance - v_amount, welcome_bonus_status = 'expired' where id = v_row.id;
      insert into pepites_transactions (user_id, type, amount, status, admin_note)
        values (v_row.id, 'welcome_bonus_expired', -v_amount, 'confirmed', 'Bonus de bienvenue expiré (30 jours, non utilisé)');
    else
      -- Le bonus a déjà été partiellement dépensé : on le considère utilisé,
      -- pas expiré — on ne reprend jamais des Pépites déjà consommées.
      update profiles set welcome_bonus_status = 'used_marker' where id = v_row.id;
    end if;
  end loop;
end; $$;

-- ---------------------------------------------------------
-- 7. Quota gratuit d'articles + facturation récurrente de dépassement
-- ---------------------------------------------------------
alter table products add column if not exists is_active boolean not null default true;

create or replace view shop_active_listing_counts as
  select shop_id, count(*) as active_count
  from products where is_active
  group by shop_id;

-- Facturation mensuelle : pour chaque boutique dépassant le quota gratuit,
-- débite (nombre d'articles au-delà du quota) × prix configuré. Si le
-- solde est insuffisant, NE désactive PAS automatiquement les articles
-- (décision produit volontairement laissée à l'admin) : elle journalise
-- l'échec pour traitement manuel plutôt que de couper un vendeur sans
-- avertissement.
create or replace function bill_quota_overage()
returns void language plpgsql as $$
declare
  v_quota integer := config_int('free_active_listings_quota');
  v_price integer := config_int('quota_overage_price_pepites');
  v_row record;
  v_owner_id uuid;
  v_overage integer;
  v_cost integer;
  v_balance integer;
begin
  for v_row in
    select shop_id, active_count from shop_active_listing_counts where active_count > v_quota
  loop
    select owner_id into v_owner_id from shops where id = v_row.shop_id;
    v_overage := v_row.active_count - v_quota;
    v_cost := v_overage * v_price;

    select pepites_balance into v_balance from profiles where id = v_owner_id for update;
    if v_balance >= v_cost then
      update profiles set pepites_balance = pepites_balance - v_cost where id = v_owner_id;
      insert into pepites_transactions (user_id, type, amount, status, admin_note)
        values (v_owner_id, 'quota_overage', -v_cost, 'confirmed', v_overage || ' article(s) au-delà du quota gratuit');
    else
      insert into pepites_transactions (user_id, type, amount, status, admin_note)
        values (v_owner_id, 'quota_overage_failed', -v_cost, 'rejected', 'Solde insuffisant — ' || v_overage || ' article(s) au-delà du quota, à traiter manuellement');
    end if;
  end loop;
end; $$;

-- ---------------------------------------------------------
-- 8. Élargit les types de transaction autorisés
-- ---------------------------------------------------------
alter table pepites_transactions drop constraint if exists pepites_transactions_type_check;
alter table pepites_transactions add constraint pepites_transactions_type_check
  check (type in ('recharge','publish','boost_product','boost_shop','admin_grant','admin_adjustment',
                   'boost_purchase','welcome_bonus','welcome_bonus_expired','quota_overage','quota_overage_failed'));

-- ---------------------------------------------------------
-- 9. Anti-abus (section 7) — ce que la base de données peut réellement garantir
-- ---------------------------------------------------------
-- Une boutique par téléphone au-delà de la limite configurée : bloqué à
-- l'insertion, avec message explicite (le nombre exact vient de app_config,
-- donc modifiable par l'admin sans déploiement).
create or replace function check_shops_per_phone()
returns trigger language plpgsql as $$
declare v_phone text; v_count integer; v_max integer := config_int('max_shops_per_phone');
begin
  select phone into v_phone from profiles where id = new.owner_id;
  select count(*) into v_count from shops s join profiles p on p.id = s.owner_id where p.phone = v_phone;
  if v_count >= v_max then
    raise exception 'Limite de % boutique(s) par numéro de téléphone atteinte. Contactez le support pour une exception.', v_max;
  end if;
  return new;
end; $$;
drop trigger if exists trg_check_shops_per_phone on shops;
create trigger trg_check_shops_per_phone before insert on shops
  for each row execute function check_shops_per_phone();

-- Journal des créations de compte par appareil, pour la revue admin.
-- NOTE IMPORTANTE (voir guide) : l'IP réelle n'est pas fiable côté client
-- (elle peut être omise ou falsifiée par l'appareil) — un contrôle robuste
-- nécessite un Auth Hook / une fonction Edge côté serveur qui capture l'IP
-- de la requête HTTP elle-même. Cette table est prête à recevoir cette
-- donnée dès que ce hook sera branché ; en l'état, elle journalise ce que
-- le client transmet volontairement, à des fins de revue manuelle.
create table if not exists device_signup_log (
  id uuid primary key default gen_random_uuid(),
  device_id text not null,
  ip_address text,
  user_id uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists device_signup_log_device_idx on device_signup_log (device_id, created_at);

-- ---------------------------------------------------------
-- 10. Avis horodatés non modifiables rétroactivement (section 7)
-- ---------------------------------------------------------
-- Aucune policy UPDATE n'existe pour reviews (vérifié : seules INSERT et
-- SELECT sont définies dans 0001_init.sql) — les avis sont donc déjà non
-- modifiables au niveau base de données. Documenté ici explicitement
-- plutôt que d'ajouter une policy qui dupliquerait ce comportement déjà
-- correct.

-- ---------------------------------------------------------
-- 11. Tâches planifiées (nécessite l'extension pg_cron — voir le guide)
-- ---------------------------------------------------------
create extension if not exists pg_cron;

select cron.schedule('dabbymarket-expire-boosts', '*/15 * * * *', $$select expire_boosts();$$);
select cron.schedule('dabbymarket-expire-welcome-bonus', '0 3 * * *', $$select expire_welcome_bonuses();$$);
select cron.schedule('dabbymarket-bill-quota-overage', '0 4 1 * *', $$select bill_quota_overage();$$);

-- ---------------------------------------------------------
-- 12. Administration — modification des prix/quotas sans déploiement
-- ---------------------------------------------------------
create or replace function admin_update_config(p_key text, p_value jsonb)
returns void language plpgsql security definer as $$
begin
  if not exists (select 1 from profiles where id = auth.uid() and is_admin) then
    raise exception 'Réservé aux administrateurs';
  end if;
  update app_config set value = p_value, updated_at = now(), updated_by = auth.uid() where key = p_key;
end; $$;
grant execute on function admin_update_config(text, jsonb) to authenticated;

create or replace function admin_update_pack(p_id text, p_pepites integer, p_price_fcfa integer, p_active boolean)
returns void language plpgsql security definer as $$
begin
  if not exists (select 1 from profiles where id = auth.uid() and is_admin) then
    raise exception 'Réservé aux administrateurs';
  end if;
  update pepite_packs set pepites = p_pepites, price_fcfa = p_price_fcfa, active = p_active where id = p_id;
end; $$;
grant execute on function admin_update_pack(text, integer, integer, boolean) to authenticated;

create or replace function admin_update_boost_price(p_id text, p_cost_pepites integer, p_active boolean)
returns void language plpgsql security definer as $$
begin
  if not exists (select 1 from profiles where id = auth.uid() and is_admin) then
    raise exception 'Réservé aux administrateurs';
  end if;
  update boost_catalog set cost_pepites = p_cost_pepites, active = p_active where id = p_id;
end; $$;
grant execute on function admin_update_boost_price(text, integer, boolean) to authenticated;
