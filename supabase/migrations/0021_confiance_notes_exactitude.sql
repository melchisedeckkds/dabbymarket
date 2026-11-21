-- =========================================================
-- DabbyMarket — 0021 : CONFIANCE — notes ouvertes, exactitude, fiabilité
--
-- Objectif : permettre aux utilisateurs de noter / commenter une boutique et un
-- article, et lutter contre les fausses déclarations, SANS récompense financière
-- (décision : badges d'abord, pas de Pépites offertes pour noter).
--
-- Trois jugements séparés (jamais confondus) :
--   1. EXACTITUDE de l'information : « trouvé / épuisé / prix différent »
--      (signalements existants `availability_reports`) -> taux d'exactitude par boutique.
--   2. QUALITÉ de l'offre : note par article (`product_reviews`, déjà en place).
--   3. CRÉDIBILITÉ de la boutique : note + commentaire (`reviews`), désormais
--      OUVERTE à toute personne ayant une trace d'interaction (contact,
--      itinéraire, signalement) et PONDÉRÉE selon la force de la preuve.
--
-- Additive. Retour arrière : ROLLBACK_0021.sql
-- Les seuils ci-dessous sont des HYPOTHÈSES de départ, réglables dans app_config.
-- =========================================================

insert into app_config (key, value, description) values
  ('review_weight_received', '100', 'Poids (%) d''un avis dont la réception a été confirmée dans la messagerie'),
  ('review_weight_report',   '80',  'Poids (%) d''un avis d''un utilisateur ayant signalé l''exactitude d''une information de la boutique'),
  ('review_weight_contact',  '70',  'Poids (%) d''un avis d''un utilisateur ayant contacté la boutique'),
  ('review_weight_route',    '50',  'Poids (%) d''un avis d''un utilisateur ayant demandé l''itinéraire'),
  ('accuracy_min_reports',   '5',   'Nombre minimal de signalements (90 j) avant d''afficher un taux d''exactitude'),
  ('accuracy_min_reporters', '3',   'Nombre minimal de signalants distincts avant d''afficher un taux d''exactitude'),
  ('reliability_watch_below',      '70', 'Taux d''exactitude (%) sous lequel une boutique passe « à surveiller »'),
  ('reliability_unreliable_below', '50', 'Taux d''exactitude (%) sous lequel une boutique passe « peu fiable » (boosts suspendus)'),
  ('rating_prompt_delay_minutes',  '120', 'Délai avant d''inviter à confirmer l''exactitude après un contact ou un itinéraire'),
  ('rating_prompt_window_days',    '7',   'Durée pendant laquelle l''invitation reste proposée'),
  ('contributor_bronze', '3',  'Contributions (180 j) pour le badge bronze'),
  ('contributor_silver', '15', 'Contributions (180 j) pour le badge argent'),
  ('contributor_gold',   '50', 'Contributions (180 j) pour le badge or')
on conflict (key) do nothing;

-- Nouveaux types de notification
alter table notifications drop constraint if exists notifications_kind_check;
alter table notifications add constraint notifications_kind_check
  check (kind in ('restock','price_change','new_product','review_received','availability_report','demand',
                  'stale_reminder','system','showcase_reduced','shop_review_received','reliability_changed'));

-- ---------------------------------------------------------
-- 1. Traces d'interaction (preuve légère qu'un utilisateur a approché la boutique)
-- ---------------------------------------------------------
create table if not exists interaction_traces (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  shop_id uuid not null references shops(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  kind text not null check (kind in ('route','contact')),
  created_at timestamptz not null default now(),
  dismissed_at timestamptz,
  answered_at timestamptz
);
create index if not exists interaction_traces_user_idx on interaction_traces (user_id, created_at desc);
create index if not exists interaction_traces_shop_idx on interaction_traces (shop_id, user_id);
alter table interaction_traces enable row level security;
drop policy if exists "Traces : lecture propre" on interaction_traces;
create policy "Traces : lecture propre" on interaction_traces for select using (auth.uid() = user_id);
-- Aucune politique d'écriture : uniquement par record_interaction / dismiss_rating_prompt.
-- Aucune position précise n'est stockée (vie privée).

create or replace function record_interaction(p_shop_id uuid, p_product_id uuid, p_kind text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null then return null; end if;
  if p_kind not in ('route','contact') then raise exception 'Type d''interaction invalide'; end if;
  if exists (select 1 from shops where id = p_shop_id and owner_id = auth.uid()) then return null; end if;
  if not exists (select 1 from shops where id = p_shop_id) then return null; end if;
  if (select count(*) from interaction_traces where user_id = auth.uid() and created_at > now() - interval '1 day') >= 100 then
    return null;
  end if;
  select id into v_id from interaction_traces
    where user_id = auth.uid() and shop_id = p_shop_id and kind = p_kind and created_at > now() - interval '6 hours'
    limit 1;
  if v_id is not null then return v_id; end if;
  insert into interaction_traces (user_id, shop_id, product_id, kind)
    values (auth.uid(), p_shop_id, p_product_id, p_kind) returning id into v_id;
  return v_id;
end; $$;
grant execute on function record_interaction(uuid, uuid, text) to authenticated;

create or replace function pending_rating_prompts()
returns table (trace_id uuid, shop_id uuid, product_id uuid, shop_name text, product_name text, kind text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select t.id, t.shop_id, t.product_id, s.name, p.name, t.kind, t.created_at
  from interaction_traces t
  join shops s on s.id = t.shop_id and not s.is_blocked
  left join products p on p.id = t.product_id
  where t.user_id = auth.uid()
    and t.dismissed_at is null and t.answered_at is null
    and t.created_at <= now() - make_interval(mins => coalesce(config_int('rating_prompt_delay_minutes'), 120))
    and t.created_at >= now() - make_interval(days => coalesce(config_int('rating_prompt_window_days'), 7))
    and not exists (select 1 from availability_reports r where r.reporter_id = t.user_id and r.shop_id = t.shop_id and r.created_at >= t.created_at)
    and not exists (select 1 from reviews rv where rv.user_id = t.user_id and rv.shop_id = t.shop_id and rv.created_at >= now() - interval '30 days')
  order by t.created_at desc
  limit 3;
$$;
grant execute on function pending_rating_prompts() to authenticated;

create or replace function dismiss_rating_prompt(p_trace_id uuid)
returns void language sql security definer set search_path = public as $$
  update interaction_traces set dismissed_at = now() where id = p_trace_id and user_id = auth.uid();
$$;
grant execute on function dismiss_rating_prompt(uuid) to authenticated;

-- ---------------------------------------------------------
-- 2. Avis boutique ouverts et pondérés (table `reviews` étendue, rien de supprimé)
-- ---------------------------------------------------------
alter table reviews alter column conversation_id drop not null;
alter table reviews add column if not exists evidence text not null default 'received'
  check (evidence in ('received','report','contact','route'));
alter table reviews add column if not exists weight numeric(3,2) not null default 1.00 check (weight between 0 and 1);
alter table reviews add column if not exists status text not null default 'visible' check (status in ('visible','hidden','removed'));
alter table reviews add column if not exists updated_at timestamptz not null default now();
create index if not exists reviews_shop_status_idx on reviews (shop_id, status);
create unique index if not exists reviews_open_one_per_user_shop on reviews (shop_id, user_id) where conversation_id is null;

drop policy if exists "Avis visibles par tous" on reviews;
drop policy if exists "Avis visibles" on reviews;
create policy "Avis visibles" on reviews for select using (
  status = 'visible' or user_id = auth.uid() or dm_is_admin()
  or exists (select 1 from shops s where s.id = shop_id and s.owner_id = auth.uid())
);

-- Note de boutique : moyenne PONDÉRÉE par la force de la preuve, avis visibles seulement.
drop view if exists public.shop_ratings;
create view public.shop_ratings with (security_invoker = true) as
select r.shop_id,
       round((sum(r.rating * r.weight) / nullif(sum(r.weight), 0))::numeric, 1) as avg_rating,
       count(*)::int as ratings_count
from reviews r where r.status = 'visible'
group by r.shop_id;
grant select on public.shop_ratings to anon, authenticated;
grant all on public.shop_ratings to service_role;

create or replace function submit_shop_review(p_shop_id uuid, p_rating integer, p_comment text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_s shops%rowtype; v_id uuid; v_age numeric;
  v_comment text := nullif(btrim(coalesce(p_comment, '')), '');
  v_evidence text; v_weight numeric; v_old reviews%rowtype;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if p_rating is null or p_rating < 1 or p_rating > 5 then raise exception 'Note invalide (1 à 5)'; end if;
  if v_comment is not null and char_length(v_comment) > 600 then raise exception 'Commentaire trop long (600 caractères maximum)'; end if;
  if v_comment ~* '(https?://|www\.)' then raise exception 'Les liens ne sont pas autorisés dans les avis.'; end if;
  if exists (select 1 from profiles where id = auth.uid() and is_blocked) then raise exception 'Compte suspendu'; end if;
  select * into v_s from shops where id = p_shop_id;
  if v_s.id is null then raise exception 'Boutique introuvable'; end if;
  if v_s.owner_id = auth.uid() then raise exception 'Vous ne pouvez pas noter votre propre boutique'; end if;
  if v_comment is not null and dm_is_health_shop(p_shop_id) then
    raise exception 'Les commentaires libres sont désactivés pour les établissements de santé : utilisez la confirmation d''exactitude et la note.';
  end if;

  select extract(epoch from (now() - created_at)) / 3600 into v_age from profiles where id = auth.uid();
  if v_age < coalesce(config_int('review_min_account_age_hours'), 12) then
    raise exception 'Votre compte est trop récent pour publier un avis (% h minimum).', coalesce(config_int('review_min_account_age_hours'), 12);
  end if;
  select * into v_old from reviews where shop_id = p_shop_id and user_id = auth.uid() order by created_at desc limit 1;
  if v_old.id is null and (select count(*) from reviews where user_id = auth.uid() and updated_at > now() - interval '1 day') >= coalesce(config_int('review_daily_limit'), 10) then
    raise exception 'Limite quotidienne d''avis atteinte.';
  end if;

  -- Force de la preuve : réception confirmée > signalement d'exactitude > contact > itinéraire
  if exists (select 1 from conversations c where c.buyer_id = auth.uid() and c.shop_id = p_shop_id and c.order_confirmed) then
    v_evidence := 'received'; v_weight := coalesce(config_int('review_weight_received'), 100);
  elsif exists (select 1 from availability_reports r where r.reporter_id = auth.uid() and r.shop_id = p_shop_id) then
    v_evidence := 'report'; v_weight := coalesce(config_int('review_weight_report'), 80);
  elsif exists (select 1 from conversations c where c.buyer_id = auth.uid() and c.shop_id = p_shop_id)
     or exists (select 1 from interaction_traces t where t.user_id = auth.uid() and t.shop_id = p_shop_id and t.kind = 'contact') then
    v_evidence := 'contact'; v_weight := coalesce(config_int('review_weight_contact'), 70);
  elsif exists (select 1 from interaction_traces t where t.user_id = auth.uid() and t.shop_id = p_shop_id and t.kind = 'route') then
    v_evidence := 'route'; v_weight := coalesce(config_int('review_weight_route'), 50);
  else
    raise exception 'Pour noter une boutique, contactez-la, demandez l''itinéraire ou signalez l''exactitude d''une information.';
  end if;

  if v_old.id is not null then
    update reviews set rating = p_rating, comment = v_comment, updated_at = now(),
           evidence = v_evidence, weight = round(v_weight / 100.0, 2), status = case when status = 'removed' then status else 'visible' end
     where id = v_old.id returning id into v_id;
  else
    insert into reviews (shop_id, user_id, conversation_id, rating, comment, evidence, weight)
      values (p_shop_id, auth.uid(), null, p_rating, v_comment, v_evidence, round(v_weight / 100.0, 2))
      returning id into v_id;
  end if;

  update interaction_traces set answered_at = now() where user_id = auth.uid() and shop_id = p_shop_id and answered_at is null;
  perform dm_push_notification(v_s.owner_id, 'merchant', 'shop_review_received', 'Nouvel avis sur votre boutique',
    p_rating::text || '/5' || coalesce(' — ' || left(v_comment, 80), ''), '/boutique/' || v_s.id,
    jsonb_build_object('shop_id', v_s.id, 'review_id', v_id), 'srev:' || v_id || ':' || to_char(now(), 'YYYYMMDD'), 'merchant_reviews');
  return v_id;
end; $$;
grant execute on function submit_shop_review(uuid, integer, text) to authenticated;

create or replace function delete_my_shop_review(p_shop_id uuid)
returns void language sql security definer set search_path = public as $$
  delete from reviews where shop_id = p_shop_id and user_id = auth.uid();
$$;
grant execute on function delete_my_shop_review(uuid) to authenticated;

create or replace function admin_set_shop_review_status(p_review_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not dm_is_admin() then raise exception 'Réservé aux administrateurs'; end if;
  if p_status not in ('visible','hidden','removed') then raise exception 'Statut invalide'; end if;
  update reviews set status = p_status where id = p_review_id;
end; $$;
grant execute on function admin_set_shop_review_status(uuid, text) to authenticated;

-- Signalement d'un avis boutique : masquage automatique à N signalants distincts (comme les avis article)
alter table reports drop constraint if exists reports_target_type_check;
alter table reports add constraint reports_target_type_check
  check (target_type in ('shop','product','post','user','flash_listing','product_review','shop_review'));
create or replace function handle_review_report()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_distinct integer; v_hide integer := coalesce(config_int('review_report_hide_threshold'), 3);
begin
  if new.target_type not in ('product_review', 'shop_review') then return new; end if;
  select count(distinct reporter_id) into v_distinct from reports
    where target_type = new.target_type and target_id = new.target_id and status = 'pending';
  if v_distinct >= v_hide then
    if new.target_type = 'product_review' then
      update product_reviews set status = 'hidden' where id = new.target_id and status = 'visible';
    else
      update reviews set status = 'hidden' where id = new.target_id and status = 'visible';
    end if;
  end if;
  return new;
end; $$;

-- ---------------------------------------------------------
-- 3. Taux d'exactitude par boutique (90 jours)
-- ---------------------------------------------------------
create table if not exists shop_accuracy_stats (
  shop_id uuid primary key references shops(id) on delete cascade,
  reports_90d integer not null default 0,
  reporters_90d integer not null default 0,
  found_90d integer not null default 0,
  accuracy_pct numeric(5,1),            -- null tant que l'échantillon est insuffisant : jamais affiché
  updated_at timestamptz not null default now()
);
alter table shop_accuracy_stats enable row level security;
drop policy if exists "Exactitude lisible" on shop_accuracy_stats;
create policy "Exactitude lisible" on shop_accuracy_stats for select using (true);

create or replace function refresh_shop_accuracy(p_shop uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_min_r integer := coalesce(config_int('accuracy_min_reports'), 5);
        v_min_u integer := coalesce(config_int('accuracy_min_reporters'), 3);
begin
  insert into shop_accuracy_stats (shop_id, reports_90d, reporters_90d, found_90d, accuracy_pct, updated_at)
  select r.shop_id, count(*)::int, count(distinct r.reporter_id)::int, count(*) filter (where r.kind = 'found')::int,
         case when count(*) >= v_min_r and count(distinct r.reporter_id) >= v_min_u
              then round(100.0 * count(*) filter (where r.kind = 'found') / count(*), 1) end,
         now()
  from availability_reports r
  where r.created_at > now() - interval '90 days' and (p_shop is null or r.shop_id = p_shop)
  group by r.shop_id
  on conflict (shop_id) do update set reports_90d = excluded.reports_90d, reporters_90d = excluded.reporters_90d,
    found_90d = excluded.found_90d, accuracy_pct = excluded.accuracy_pct, updated_at = now();
  -- boutiques dont tous les signalements ont expiré
  update shop_accuracy_stats s set reports_90d = 0, reporters_90d = 0, found_90d = 0, accuracy_pct = null, updated_at = now()
   where (p_shop is null or s.shop_id = p_shop) and s.reports_90d > 0
     and not exists (select 1 from availability_reports r where r.shop_id = s.shop_id and r.created_at > now() - interval '90 days');
end; $$;
revoke execute on function refresh_shop_accuracy(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------
-- 4. Échelle de fiabilité (avec droit de contestation)
-- ---------------------------------------------------------
alter table shops add column if not exists reliability_status text not null default 'normal'
  check (reliability_status in ('normal','watch','unreliable','boost_suspended'));
alter table shops add column if not exists reliability_note text;
alter table shops add column if not exists reliability_manual boolean not null default false;
alter table shops add column if not exists reliability_review_after timestamptz;
alter table shops add column if not exists reliability_updated_at timestamptz;

create or replace function guard_shops_sensitive_columns()
returns trigger language plpgsql as $$
begin
  if current_user in ('authenticated', 'anon') then
    if new.verified is distinct from old.verified
       or new.is_blocked is distinct from old.is_blocked
       or new.blocked_reason is distinct from old.blocked_reason
       or new.owner_id is distinct from old.owner_id
       or new.reliability_status is distinct from old.reliability_status
       or new.reliability_note is distinct from old.reliability_note
       or new.reliability_manual is distinct from old.reliability_manual
       or new.reliability_review_after is distinct from old.reliability_review_after
       or new.reliability_updated_at is distinct from old.reliability_updated_at
    then
      raise exception 'Modification non autorisée : colonne protégée de la boutique.' using errcode = '42501';
    end if;
  end if;
  return new;
end; $$;

create or replace function evaluate_shop_reliability(p_shop uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_s shops%rowtype; v_st shop_accuracy_stats%rowtype; v_new text; v_old text;
        v_watch numeric := coalesce(config_int('reliability_watch_below'), 70);
        v_bad numeric := coalesce(config_int('reliability_unreliable_below'), 50);
begin
  select * into v_s from shops where id = p_shop;
  if v_s.id is null or v_s.reliability_manual then return; end if;
  if v_s.reliability_review_after is not null and v_s.reliability_review_after > now() then return; end if;
  select * into v_st from shop_accuracy_stats where shop_id = p_shop;
  v_old := v_s.reliability_status;
  v_new := case
    when v_st.accuracy_pct is null then 'normal'
    when v_st.accuracy_pct < v_bad then 'unreliable'
    when v_st.accuracy_pct < v_watch then 'watch'
    else 'normal' end;
  if v_new = v_old then return; end if;
  update shops set reliability_status = v_new, reliability_updated_at = now(),
         reliability_note = case when v_new = 'normal' then null
           else 'Taux d''exactitude de ' || v_st.accuracy_pct || ' % sur ' || v_st.reports_90d || ' signalements (90 jours).' end
   where id = p_shop;
  if v_new <> 'normal' and (v_old = 'normal' or v_new = 'unreliable') then
    perform dm_push_notification(v_s.owner_id, 'merchant', 'reliability_changed',
      case v_new when 'watch' then 'Vos informations sont à vérifier' else 'Fiabilité insuffisante : boosts suspendus' end,
      'Plusieurs clients signalent que vos informations ne correspondent pas à la réalité. Mettez vos disponibilités à jour ; vous pouvez contester depuis votre espace.',
      '/disponibilite', jsonb_build_object('shop_id', p_shop, 'status', v_new),
      'rel:' || p_shop || ':' || v_new || ':' || to_char(now(), 'YYYYMMDD'), 'merchant_reports');
  end if;
end; $$;
revoke execute on function evaluate_shop_reliability(uuid) from public, anon, authenticated;

create or replace function availability_report_after()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform refresh_shop_accuracy(new.shop_id);
  perform evaluate_shop_reliability(new.shop_id);
  update interaction_traces set answered_at = now()
    where user_id = new.reporter_id and shop_id = new.shop_id and answered_at is null;
  perform refresh_contributor_badge(new.reporter_id);
  return new;
end; $$;

create or replace function evaluate_all_shop_reliability()
returns void language plpgsql security definer set search_path = public as $$
declare r record;
begin
  perform refresh_shop_accuracy(null);
  for r in select shop_id from shop_accuracy_stats loop perform evaluate_shop_reliability(r.shop_id); end loop;
  -- boutiques revenues à l'état normal faute de données récentes
  for r in select id from shops where reliability_status in ('watch','unreliable') and not reliability_manual loop
    perform evaluate_shop_reliability(r.id);
  end loop;
end; $$;
revoke execute on function evaluate_all_shop_reliability() from public, anon, authenticated;
select cron.schedule('dabbymarket-evaluate-reliability', '15 5 * * *', $$select evaluate_all_shop_reliability();$$);

-- Un boost ne s'achète pas quand la fiabilité est en cause (la visibilité payante ne masque pas un défaut d'exactitude)
create or replace function boosts_reliability_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_shop uuid; v_status text;
begin
  v_shop := case new.target_type when 'shop' then new.target_id
                                 when 'product' then (select shop_id from products where id = new.target_id) end;
  if v_shop is null then return new; end if;
  select reliability_status into v_status from shops where id = v_shop;
  if v_status in ('unreliable', 'boost_suspended') then
    raise exception 'Les boosts sont suspendus pour cette boutique (fiabilité des informations insuffisante). Vous pouvez contester depuis votre espace marchand.';
  end if;
  return new;
end; $$;
drop trigger if exists trg_boosts_reliability_guard on boosts;
create trigger trg_boosts_reliability_guard before insert on boosts for each row execute function boosts_reliability_guard();

create table if not exists reliability_appeals (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  message text not null check (char_length(message) between 20 and 800),
  status text not null default 'open' check (status in ('open','accepted','rejected')),
  admin_note text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create unique index if not exists reliability_appeals_one_open on reliability_appeals (shop_id) where status = 'open';
alter table reliability_appeals enable row level security;
drop policy if exists "Contestations : lecture propriétaire ou admin" on reliability_appeals;
create policy "Contestations : lecture propriétaire ou admin" on reliability_appeals for select using (user_id = auth.uid() or dm_is_admin());

create or replace function appeal_reliability(p_shop_id uuid, p_message text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if not exists (select 1 from shops where id = p_shop_id and owner_id = auth.uid() and reliability_status <> 'normal') then
    raise exception 'Aucune contestation possible pour cette boutique.';
  end if;
  insert into reliability_appeals (shop_id, user_id, message) values (p_shop_id, auth.uid(), btrim(p_message))
    returning id into v_id;
  return v_id;
exception when unique_violation then raise exception 'Une contestation est déjà en cours pour cette boutique.';
end; $$;
grant execute on function appeal_reliability(uuid, text) to authenticated;

create or replace function admin_set_reliability(p_shop_id uuid, p_status text, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_owner uuid;
begin
  if not dm_is_admin() then raise exception 'Réservé aux administrateurs'; end if;
  if p_status not in ('normal','watch','unreliable','boost_suspended') then raise exception 'Statut invalide'; end if;
  update shops set reliability_status = p_status, reliability_note = nullif(btrim(coalesce(p_note, '')), ''),
         reliability_manual = (p_status <> 'normal'), reliability_review_after = null, reliability_updated_at = now()
   where id = p_shop_id returning owner_id into v_owner;
  if v_owner is null then raise exception 'Boutique introuvable'; end if;
  perform dm_push_notification(v_owner, 'merchant', 'reliability_changed', 'Statut de fiabilité mis à jour',
    coalesce(nullif(btrim(coalesce(p_note, '')), ''), 'Un administrateur a mis à jour le statut de votre boutique.'), '/disponibilite',
    jsonb_build_object('shop_id', p_shop_id, 'status', p_status), 'relm:' || p_shop_id || ':' || p_status || ':' || to_char(now(), 'YYYYMMDDHH24MI'), 'merchant_reports');
end; $$;
grant execute on function admin_set_reliability(uuid, text, text) to authenticated;

create or replace function admin_resolve_appeal(p_appeal_id uuid, p_accept boolean, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_a reliability_appeals%rowtype;
begin
  if not dm_is_admin() then raise exception 'Réservé aux administrateurs'; end if;
  select * into v_a from reliability_appeals where id = p_appeal_id and status = 'open';
  if v_a.id is null then raise exception 'Contestation introuvable ou déjà traitée'; end if;
  update reliability_appeals set status = case when p_accept then 'accepted' else 'rejected' end,
         admin_note = p_note, resolved_at = now() where id = p_appeal_id;
  if p_accept then
    -- remise à « normal » avec 30 jours de répit avant réévaluation automatique
    update shops set reliability_status = 'normal', reliability_note = null, reliability_manual = false,
           reliability_review_after = now() + interval '30 days', reliability_updated_at = now()
     where id = v_a.shop_id;
  end if;
  perform dm_push_notification(v_a.user_id, 'merchant', 'reliability_changed',
    case when p_accept then 'Contestation acceptée' else 'Contestation refusée' end,
    coalesce(p_note, case when p_accept then 'Votre boutique est de nouveau en statut normal.' else 'Le statut de votre boutique est maintenu.' end),
    '/disponibilite', jsonb_build_object('shop_id', v_a.shop_id), 'relapp:' || v_a.id, 'merchant_reports');
end; $$;
grant execute on function admin_resolve_appeal(uuid, boolean, text) to authenticated;

-- ---------------------------------------------------------
-- 5. Badges de contribution (non financiers ; neutres : positif ou négatif comptent pareil)
-- ---------------------------------------------------------
create table if not exists contributor_badges (
  user_id uuid primary key references profiles(id) on delete cascade,
  contributions integer not null default 0,
  level text not null default 'none' check (level in ('none','bronze','silver','gold')),
  updated_at timestamptz not null default now()
);
alter table contributor_badges enable row level security;
drop policy if exists "Badges lisibles" on contributor_badges;
create policy "Badges lisibles" on contributor_badges for select using (true);

create or replace function refresh_contributor_badge(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_n integer; v_level text;
begin
  if p_user is null then return; end if;
  select (select count(*) from availability_reports where reporter_id = p_user and created_at > now() - interval '180 days')
       + (select count(*) from reviews where user_id = p_user and status = 'visible' and created_at > now() - interval '180 days')
       + (select count(*) from product_reviews where user_id = p_user and status = 'visible' and created_at > now() - interval '180 days')
    into v_n;
  v_level := case when v_n >= coalesce(config_int('contributor_gold'), 50) then 'gold'
                  when v_n >= coalesce(config_int('contributor_silver'), 15) then 'silver'
                  when v_n >= coalesce(config_int('contributor_bronze'), 3) then 'bronze'
                  else 'none' end;
  insert into contributor_badges (user_id, contributions, level, updated_at) values (p_user, v_n, v_level, now())
    on conflict (user_id) do update set contributions = excluded.contributions, level = excluded.level, updated_at = now();
end; $$;
revoke execute on function refresh_contributor_badge(uuid) from public, anon, authenticated;

create or replace function review_badge_after()
returns trigger language plpgsql security definer set search_path = public as $$
begin perform refresh_contributor_badge(new.user_id); return new; end; $$;

drop trigger if exists trg_availability_report_after on availability_reports;
create trigger trg_availability_report_after after insert or update on availability_reports
  for each row execute function availability_report_after();
drop trigger if exists trg_reviews_badge_after on reviews;
create trigger trg_reviews_badge_after after insert or update on reviews for each row execute function review_badge_after();
drop trigger if exists trg_product_reviews_badge_after on product_reviews;
create trigger trg_product_reviews_badge_after after insert or update on product_reviews for each row execute function review_badge_after();

-- ---------------------------------------------------------
-- 6. Détection d'anomalies (administrateur) : boutiques dont les avis viennent surtout de comptes tout neufs
-- ---------------------------------------------------------
create or replace function admin_review_anomalies()
returns table (shop_id uuid, shop_name text, reviews_30d integer, young_account_share numeric)
language plpgsql stable security definer set search_path = public as $$
begin
  if not dm_is_admin() then raise exception 'Réservé aux administrateurs'; end if;
  return query
  select s.id, s.name, count(*)::int,
         round(avg((p.created_at > r.created_at - interval '7 days')::int)::numeric, 2)
  from reviews r join profiles p on p.id = r.user_id join shops s on s.id = r.shop_id
  where r.created_at > now() - interval '30 days' and r.status = 'visible'
  group by s.id, s.name
  having count(*) >= 5 and avg((p.created_at > r.created_at - interval '7 days')::int) >= 0.6
  order by 4 desc, 3 desc;
end; $$;
grant execute on function admin_review_anomalies() to authenticated;
