-- =========================================================
-- DabbyMarket — 0019 : Vente Flash visible et boostée sur le Marché,
-- archives admin, durcissement des Pépites, prix de référence,
-- attribution d'acquisition, candidats au badge.
--
-- Rollback : supabase/rollback/ROLLBACK_0019.sql
-- Tout est idempotent (rejouable sans risque).
-- =========================================================

-- ---------------------------------------------------------
-- 1. Vente Flash : boost automatique + archive
--    boosted_until : suit expires_at tant que l'annonce est active
--                    (= "boostée juste le temps souscrit").
--    archived_at   : posé dès que l'annonce quitte l'état 'active'
--                    (expirée, vendue, retirée, suspendue).
-- ---------------------------------------------------------
alter table flash_listings add column if not exists boosted_until timestamptz;
alter table flash_listings add column if not exists archived_at timestamptz;

create or replace function flash_lifecycle()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    if new.status = 'active' then
      new.boosted_until := new.expires_at;
      new.archived_at := null;
    else
      new.boosted_until := null;
      new.archived_at := coalesce(new.archived_at, now());
    end if;
    return new;
  end if;

  if new.status = 'active' then
    -- Annonce active (publication, prolongation, réactivation admin) :
    -- le boost couvre exactement la durée souscrite.
    new.boosted_until := new.expires_at;
    new.archived_at := null;
  else
    -- Sortie de l'état actif : le boost s'arrête, l'annonce est archivée
    -- (jamais supprimée — l'admin la retrouve dans les archives).
    new.boosted_until := null;
    new.archived_at := coalesce(old.archived_at, now());
  end if;
  return new;
end; $$;

drop trigger if exists trg_flash_lifecycle on flash_listings;
create trigger trg_flash_lifecycle
  before insert or update on flash_listings
  for each row execute function flash_lifecycle();

-- Rattrapage des annonces déjà présentes.
update flash_listings set status = 'expired' where status = 'active' and expires_at <= now();
update flash_listings set updated_at = updated_at;  -- déclenche le trigger sur toutes les lignes

create index if not exists flash_listings_market_idx
  on flash_listings (status, visibility, expires_at desc);
create index if not exists flash_listings_archive_idx
  on flash_listings (archived_at desc) where archived_at is not null;

-- Le boost automatique remplace l'ancien boost payant 'flash_48h'
-- (qui aurait fait payer deux fois la même visibilité).
update boost_catalog set active = false where id = 'flash_48h';

-- Archives pour l'administrateur : filtres statut / recherche / pagination.
create or replace function admin_flash_archive(
  p_status text default null,
  p_search text default null,
  p_limit integer default 50,
  p_offset integer default 0
) returns table (
  id uuid, title text, category text, price_xaf integer, city text, neighborhood text,
  status text, visibility text, duration_hours integer, is_free_listing boolean,
  created_at timestamptz, expires_at timestamptz, archived_at timestamptz,
  seller_id uuid, seller_name text, seller_phone text, images text[]
) language plpgsql security definer as $$
begin
  if not exists (select 1 from profiles pa where pa.id = auth.uid() and pa.is_admin) then
    raise exception 'Réservé aux administrateurs';
  end if;
  return query
    select f.id, f.title, f.category, f.price_xaf, f.city, f.neighborhood,
           f.status, f.visibility, f.duration_hours, f.is_free_listing,
           f.created_at, f.expires_at, f.archived_at,
           f.seller_id, p.name, p.phone, f.images
      from flash_listings f join profiles p on p.id = f.seller_id
     where f.archived_at is not null
       and (p_status is null or p_status = '' or f.status = p_status)
       and (p_search is null or p_search = ''
            or f.title ilike '%' || p_search || '%'
            or p.name ilike '%' || p_search || '%'
            or f.neighborhood ilike '%' || p_search || '%')
     order by f.archived_at desc
     limit least(greatest(p_limit, 1), 200) offset greatest(p_offset, 0);
end; $$;
grant execute on function admin_flash_archive(text, text, integer, integer) to authenticated;

-- ---------------------------------------------------------
-- 2. Pépites : durcissement des achats
-- ---------------------------------------------------------
-- 2a. purchase_boost : cohérence type de boost <-> cible, 'accueil'
--     interdit ici (il passe par purchase_home_feature qui gère les
--     créneaux), 'flash' interdit (boost automatique désormais).
create or replace function purchase_boost(p_target_type text, p_target_id uuid, p_boost_catalog_id text)
returns uuid language plpgsql security definer as $$
declare
  v_catalog boost_catalog%rowtype;
  v_balance integer;
  v_boost_id uuid;
begin
  if auth.uid() is null then raise exception 'Connectez-vous d''abord'; end if;

  select * into v_catalog from boost_catalog where id = p_boost_catalog_id and active;
  if v_catalog.id is null then raise exception 'Boost introuvable ou inactif'; end if;

  if v_catalog.boost_type = 'accueil' then
    raise exception 'La mise en avant Accueil passe par la file de créneaux';
  end if;
  if v_catalog.boost_type = 'flash' then
    raise exception 'La Vente Flash est boostée automatiquement pendant sa durée';
  end if;

  if v_catalog.boost_type = 'article' and p_target_type <> 'product' then
    raise exception 'Ce boost ne s''applique qu''à un article';
  end if;
  if v_catalog.boost_type in ('shop','carte') and p_target_type <> 'shop' then
    raise exception 'Ce boost ne s''applique qu''à une boutique';
  end if;
  if v_catalog.boost_type in ('recherche','ia') and p_target_type not in ('product','shop') then
    raise exception 'Cible invalide pour ce boost';
  end if;

  if p_target_type = 'product' then
    if not exists (select 1 from products pr join shops s on s.id = pr.shop_id
                   where pr.id = p_target_id and s.owner_id = auth.uid()) then
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
    values (auth.uid(), p_target_type, p_target_id, v_catalog.id, v_catalog.boost_type,
            now() + make_interval(hours => v_catalog.duration_hours))
    returning id into v_boost_id;

  insert into pepites_transactions (user_id, type, amount, status, admin_note)
    values (auth.uid(), 'boost_purchase', -v_catalog.cost_pepites, 'confirmed', v_catalog.label);

  if p_target_type = 'product' and v_catalog.boost_type = 'article' then
    update products
       set boosted_until = greatest(coalesce(boosted_until, now()), now()) + make_interval(hours => v_catalog.duration_hours)
     where id = p_target_id;
  end if;

  return v_boost_id;
end; $$;
grant execute on function purchase_boost(text, uuid, text) to authenticated;

-- 2b. extend_flash_listing : verrou du solde (évite le double débit
--     concurrent) + refus d'une annonce déjà expirée.
create or replace function extend_flash_listing(p_flash_id uuid, p_extra_hours integer)
returns void language plpgsql security definer as $$
declare
  v_key text;
  v_price integer;
  v_balance integer;
  v_owner uuid;
  v_status text;
  v_expires timestamptz;
begin
  select seller_id, status, expires_at into v_owner, v_status, v_expires
    from flash_listings where id = p_flash_id for update;
  if v_owner is null or v_owner <> auth.uid() then raise exception 'Vous ne pouvez prolonger que votre propre annonce'; end if;
  if v_status <> 'active' or v_expires <= now() then raise exception 'Cette annonce n''est plus active'; end if;

  v_key := case p_extra_hours when 24 then 'flash_price_24h' when 48 then 'flash_price_48h' when 168 then 'flash_price_7d' else null end;
  if v_key is null then raise exception 'Durée invalide'; end if;
  v_price := config_int(v_key);

  select pepites_balance into v_balance from profiles where id = auth.uid() for update;
  if v_balance < v_price then raise exception 'Solde de Pépites insuffisant'; end if;

  update profiles set pepites_balance = pepites_balance - v_price where id = auth.uid();
  insert into pepites_transactions (user_id, type, amount, status, admin_note)
    values (auth.uid(), 'flash_extend', -v_price, 'confirmed', p_extra_hours || 'h — Prolongation Vente Flash');

  update flash_listings
     set expires_at = expires_at + make_interval(hours => p_extra_hours),
         duration_hours = duration_hours + p_extra_hours,
         updated_at = now()
   where id = p_flash_id;   -- le trigger recale boosted_until
end; $$;
grant execute on function extend_flash_listing(uuid, integer) to authenticated;

-- 2c. publish_flash_listing : verrou du solde (le select du profil
--     verrouille déjà la ligne ; on relit le solde après verrou) et
--     bornes de prix.
create or replace function publish_flash_listing(
  p_title text, p_description text, p_category text, p_condition text,
  p_price_xaf integer, p_negotiable boolean, p_images text[],
  p_city text, p_neighborhood text, p_landmark text, p_duration_hours integer
) returns uuid language plpgsql security definer as $$
declare
  v_welcome_status text;
  v_balance integer;
  v_is_free boolean := false;
  v_duration integer := p_duration_hours;
  v_price integer;
  v_key text;
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Connectez-vous d''abord'; end if;
  if coalesce(trim(p_title), '') = '' then raise exception 'Le titre est requis'; end if;
  if p_price_xaf is null or p_price_xaf <= 0 then raise exception 'Prix invalide'; end if;
  if p_images is null or array_length(p_images, 1) is null or array_length(p_images, 1) < 1 then
    raise exception 'Au moins une photo est requise';
  end if;
  if array_length(p_images, 1) > 5 then raise exception 'Maximum 5 photos'; end if;
  if coalesce(trim(p_neighborhood), '') = '' then raise exception 'Le quartier est requis'; end if;

  select welcome_bonus_status, pepites_balance into v_welcome_status, v_balance
    from profiles where id = auth.uid() for update;

  if v_welcome_status = 'pending' then
    v_is_free := true;
    v_duration := config_int('flash_free_duration_hours');
  else
    v_key := case v_duration when 24 then 'flash_price_24h' when 48 then 'flash_price_48h' when 168 then 'flash_price_7d' else null end;
    if v_key is null then raise exception 'Durée invalide'; end if;
    v_price := config_int(v_key);
    if v_balance < v_price then raise exception 'Solde de Pépites insuffisant'; end if;
    update profiles set pepites_balance = pepites_balance - v_price where id = auth.uid();
    insert into pepites_transactions (user_id, type, amount, status, admin_note)
      values (auth.uid(), 'flash_publish', -v_price, 'confirmed', v_duration || 'h — Vente Flash');
  end if;

  insert into flash_listings (
    seller_id, title, description, category, condition, price_xaf, negotiable,
    images, city, neighborhood, landmark, duration_hours, expires_at, is_free_listing
  ) values (
    auth.uid(), trim(p_title), p_description, p_category, p_condition, p_price_xaf, coalesce(p_negotiable, false),
    p_images, coalesce(p_city, 'Yaoundé'), p_neighborhood, p_landmark, v_duration,
    now() + make_interval(hours => v_duration), v_is_free
  ) returning id into v_id;

  perform grant_welcome_bonus_if_eligible_flash(v_id);
  return v_id;
end; $$;
grant execute on function publish_flash_listing(text, text, text, text, integer, boolean, text[], text, text, text, integer) to authenticated;

-- 2d. request_recharge : montant = un pack actif du catalogue, méthode
--     connue, référence non vide et jamais déjà utilisée, 5 demandes
--     en attente maximum par utilisateur.
create or replace function request_recharge(p_amount integer, p_method text, p_reference text)
returns uuid language plpgsql security definer as $$
declare v_id uuid; v_ref text := trim(coalesce(p_reference, ''));
begin
  if auth.uid() is null then raise exception 'Connectez-vous d''abord'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Montant invalide'; end if;
  if not exists (select 1 from pepite_packs where pepites = p_amount and active) then
    raise exception 'Ce montant ne correspond à aucun pack proposé';
  end if;
  if p_method not in ('OrangeMoney','MTNMoMo','card') then raise exception 'Moyen de paiement invalide'; end if;
  if length(v_ref) < 4 then raise exception 'Référence de transaction requise'; end if;
  if exists (select 1 from pepites_transactions
              where type = 'recharge' and lower(reference_code) = lower(v_ref) and status in ('pending','confirmed')) then
    raise exception 'Cette référence de transaction a déjà été utilisée';
  end if;
  if (select count(*) from pepites_transactions where user_id = auth.uid() and type = 'recharge' and status = 'pending') >= 5 then
    raise exception 'Trop de demandes en attente — patientez la validation';
  end if;

  insert into pepites_transactions (user_id, type, amount, method, reference_code, status)
    values (auth.uid(), 'recharge', p_amount, p_method, v_ref, 'pending')
    returning id into v_id;
  return v_id;
end; $$;
grant execute on function request_recharge(integer, text, text) to authenticated;

-- 2e. Audit Pépites (admin) : détecte les soldes négatifs et les écarts
--     entre solde et somme des transactions confirmées.
create or replace function admin_pepites_audit()
returns table (user_id uuid, name text, balance integer, ledger integer, gap integer)
language plpgsql security definer as $$
begin
  if not exists (select 1 from profiles pa where pa.id = auth.uid() and pa.is_admin) then
    raise exception 'Réservé aux administrateurs';
  end if;
  return query
    select p.id, p.name, p.pepites_balance,
           coalesce(sum(t.amount) filter (where t.status = 'confirmed'), 0)::int,
           (p.pepites_balance - coalesce(sum(t.amount) filter (where t.status = 'confirmed'), 0))::int
      from profiles p left join pepites_transactions t on t.user_id = p.id
     group by p.id, p.name, p.pepites_balance
    having p.pepites_balance < 0
        or p.pepites_balance <> coalesce(sum(t.amount) filter (where t.status = 'confirmed'), 0)
     order by 5 desc;
end; $$;
grant execute on function admin_pepites_audit() to authenticated;

-- ---------------------------------------------------------
-- 3. Prix de référence (produits en tension : gaz, etc.)
--    Information, jamais une promotion : l'application n'encourage pas
--    les prix hors référence, elle les signale.
-- ---------------------------------------------------------
alter table catalog_items add column if not exists reference_price_xaf integer check (reference_price_xaf is null or reference_price_xaf > 0);
alter table catalog_items add column if not exists reference_price_note text;

update catalog_items
   set reference_price_xaf = 6500,
       reference_price_note = 'Prix de référence indicatif, modifiable par l''administrateur'
 where slug in ('bouteille-gaz-12-5kg','gaz-12-5kg','bouteille-de-gaz-12-5-kg')
   and reference_price_xaf is null;

-- ---------------------------------------------------------
-- 4. Attribution d'acquisition (mesure manuelle des campagnes)
-- ---------------------------------------------------------
create table if not exists user_acquisition (
  user_id uuid primary key references profiles(id) on delete cascade,
  source text,
  campaign text,
  ref text,
  created_at timestamptz not null default now()
);
alter table user_acquisition enable row level security;

drop policy if exists "Acquisition : insertion par soi-même" on user_acquisition;
create policy "Acquisition : insertion par soi-même" on user_acquisition for insert
  with check (user_id = auth.uid());
drop policy if exists "Acquisition : lecture admin" on user_acquisition;
create policy "Acquisition : lecture admin" on user_acquisition for select
  using (dm_is_admin());

create or replace function record_acquisition(p_source text, p_campaign text, p_ref text)
returns void language plpgsql security definer as $$
begin
  if auth.uid() is null then return; end if;
  insert into user_acquisition (user_id, source, campaign, ref)
    values (auth.uid(), left(nullif(trim(p_source), ''), 40), left(nullif(trim(p_campaign), ''), 60), left(nullif(trim(p_ref), ''), 60))
    on conflict (user_id) do nothing;
end; $$;
grant execute on function record_acquisition(text, text, text) to authenticated;

create or replace function admin_acquisition_stats()
returns table (source text, campaign text, users bigint, with_shop bigint)
language plpgsql security definer as $$
begin
  if not exists (select 1 from profiles pa where pa.id = auth.uid() and pa.is_admin) then
    raise exception 'Réservé aux administrateurs';
  end if;
  return query
    select coalesce(a.source, 'direct'), coalesce(a.campaign, '—'), count(*)::bigint,
           count(*) filter (where exists (select 1 from shops s where s.owner_id = a.user_id))::bigint
      from user_acquisition a
     group by 1, 2 order by 3 desc;
end; $$;
grant execute on function admin_acquisition_stats() to authenticated;

-- ---------------------------------------------------------
-- 5. Badge « Boutique vérifiée » : double vérification
--    (avis des utilisateurs + validation administrateur).
--    Cette vue liste les boutiques qui remplissent le critère « avis » ;
--    le badge lui-même reste posé par un administrateur.
-- ---------------------------------------------------------
insert into app_config (key, value, description) values
  ('verification_min_rating', '4', 'Note moyenne minimale pour être candidate au badge Boutique vérifiée'),
  ('verification_min_reviews', '5', 'Nombre minimal d''avis pour être candidate au badge')
on conflict (key) do nothing;

create or replace function admin_badge_candidates()
returns table (shop_id uuid, shop_name text, owner_name text, avg_rating numeric, ratings_count integer, verified boolean)
language plpgsql security definer as $$
begin
  if not exists (select 1 from profiles pa where pa.id = auth.uid() and pa.is_admin) then
    raise exception 'Réservé aux administrateurs';
  end if;
  return query
    select s.id, s.name, p.name, r.avg_rating, r.ratings_count, s.verified
      from shops s
      join profiles p on p.id = s.owner_id
      join shop_ratings r on r.shop_id = s.id
     where r.ratings_count >= config_int('verification_min_reviews')
       and r.avg_rating >= config_int('verification_min_rating')
     order by s.verified, r.avg_rating desc, r.ratings_count desc;
end; $$;
grant execute on function admin_badge_candidates() to authenticated;
