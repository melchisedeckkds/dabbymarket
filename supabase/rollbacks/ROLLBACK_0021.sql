-- Retour arrière de 0021 (confiance, notes, exactitude). SUPPRIME : avis « ouverts » (sans conversation), traces d'interaction, contestations, badges, statistiques d'exactitude. À exécuter dans une transaction après ROLLBACK_0022.
begin;
do $$ begin perform cron.unschedule('dabbymarket-evaluate-reliability'); exception when others then null; end $$;
drop trigger if exists trg_boosts_reliability_guard on boosts;
drop trigger if exists trg_availability_report_after on availability_reports;
drop trigger if exists trg_reviews_badge_after on reviews;
drop trigger if exists trg_product_reviews_badge_after on product_reviews;
drop function if exists boosts_reliability_guard();
drop function if exists availability_report_after();
drop function if exists review_badge_after();
drop function if exists admin_review_anomalies();
drop function if exists admin_resolve_appeal(uuid, boolean, text);
drop function if exists admin_set_reliability(uuid, text, text);
drop function if exists appeal_reliability(uuid, text);
drop function if exists evaluate_all_shop_reliability();
drop function if exists evaluate_shop_reliability(uuid);
drop function if exists refresh_contributor_badge(uuid);
drop function if exists refresh_shop_accuracy(uuid);
drop function if exists admin_set_shop_review_status(uuid, text);
drop function if exists delete_my_shop_review(uuid);
drop function if exists submit_shop_review(uuid, integer, text);
drop function if exists dismiss_rating_prompt(uuid);
drop function if exists pending_rating_prompts();
drop function if exists record_interaction(uuid, uuid, text);
drop table if exists contributor_badges, reliability_appeals, shop_accuracy_stats, interaction_traces cascade;
-- Avis : retour au modèle « réception confirmée requise »
delete from reports where target_type = 'shop_review';
delete from reviews where conversation_id is null;
drop view if exists public.shop_ratings;
drop policy if exists "Avis visibles" on reviews;
drop index if exists reviews_open_one_per_user_shop;
drop index if exists reviews_shop_status_idx;
alter table reviews drop column if exists evidence, drop column if exists weight, drop column if exists status, drop column if exists updated_at;
alter table reviews alter column conversation_id set not null;
create policy "Avis visibles par tous" on reviews for SELECT using (true);
create or replace view public.shop_ratings as  SELECT shop_id,
    round(avg(rating), 1) AS avg_rating,
    (count(*))::integer AS ratings_count
   FROM reviews r
  GROUP BY shop_id;;
grant select on public.shop_ratings to anon, authenticated;
-- Contraintes d'origine
delete from notifications where kind in ('shop_review_received','reliability_changed');
alter table notifications drop constraint if exists notifications_kind_check;
alter table notifications add constraint notifications_kind_check CHECK ((kind = ANY (ARRAY['restock'::text, 'price_change'::text, 'new_product'::text, 'review_received'::text, 'availability_report'::text, 'demand'::text, 'stale_reminder'::text, 'system'::text, 'showcase_reduced'::text])));
alter table reports drop constraint if exists reports_target_type_check;
alter table reports add constraint reports_target_type_check CHECK ((target_type = ANY (ARRAY['shop'::text, 'product'::text, 'post'::text, 'user'::text, 'flash_listing'::text, 'product_review'::text])));
-- Fiabilité des boutiques
alter table shops drop column if exists reliability_status, drop column if exists reliability_note, drop column if exists reliability_manual, drop column if exists reliability_review_after, drop column if exists reliability_updated_at;
CREATE OR REPLACE FUNCTION public.guard_shops_sensitive_columns()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  if current_user in ('authenticated', 'anon') then
    if new.verified is distinct from old.verified
       or new.is_blocked is distinct from old.is_blocked
       or new.blocked_reason is distinct from old.blocked_reason
       or new.owner_id is distinct from old.owner_id
    then
      raise exception 'Modification non autorisée : colonne protégée de la boutique.' using errcode = '42501';
    end if;
  end if;
  return new;
end; $function$
;
CREATE OR REPLACE FUNCTION public.handle_review_report()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_distinct integer; v_hide integer := coalesce(config_int('review_report_hide_threshold'), 3);
begin
  if new.target_type <> 'product_review' then return new; end if;
  select count(distinct reporter_id) into v_distinct from reports
    where target_type = 'product_review' and target_id = new.target_id and status = 'pending';
  if v_distinct >= v_hide then
    update product_reviews set status = 'hidden' where id = new.target_id and status = 'visible';
  end if;
  return new;
end; $function$
;
delete from app_config where key in ('review_weight_received','review_weight_report','review_weight_contact','review_weight_route','accuracy_min_reports','accuracy_min_reporters','reliability_watch_below','reliability_unreliable_below','rating_prompt_delay_minutes','rating_prompt_window_days','contributor_bronze','contributor_silver','contributor_gold');
commit;
