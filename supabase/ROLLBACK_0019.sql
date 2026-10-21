-- ROLLBACK de 0019 : restaure les fonctions d'avant (0001/0016) et retire
-- les objets ajoutés. Les colonnes boosted_until/archived_at des Ventes
-- Flash sont conservées (inoffensives) pour ne rien perdre des archives.
begin;
drop trigger if exists trg_flash_lifecycle on flash_listings;
drop function if exists flash_lifecycle();
drop function if exists admin_flash_archive(text,text,integer,integer);
drop function if exists admin_pepites_audit();
drop function if exists admin_acquisition_stats();
drop function if exists record_acquisition(text,text,text);
drop function if exists admin_badge_candidates();
drop table if exists user_acquisition;
update boost_catalog set active = true where id = 'flash_48h';
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

create or replace function request_recharge(p_amount integer, p_method text, p_reference text)
returns uuid
language plpgsql security definer as $$
declare v_id uuid;
begin
  insert into pepites_transactions (user_id, type, amount, method, reference_code, status)
    values (auth.uid(), 'recharge', p_amount, p_method, p_reference, 'pending')
    returning id into v_id;
  return v_id;
end; $$;

commit;
