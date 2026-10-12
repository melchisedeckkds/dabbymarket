-- =========================================================
-- DabbyMarket — RETOUR ARRIÈRE de 0018 (Dabby Disponibilité) puis 0017
-- ⚠ DESTRUCTIF pour les données du module : articles « disponibilité »
--   (listing_kind = 'stock'), historiques, avis produit, signalements,
--   notifications et alertes sont SUPPRIMÉS. Les boutiques, produits
--   « vitrine », messages, avis boutique, Pépites, etc. ne sont pas touchés.
-- À exécuter dans l'éditeur SQL Supabase, après avoir exporté ce qui doit
-- être conservé (voir GUIDE, section « Retour arrière »).
-- Testé sur une base de test (rejeu 0001→0018 puis ce script).
-- =========================================================
begin;

-- 1. Tâches planifiées (sans erreur si pg_cron est absent ou si une tâche n'existe pas)
do $$ begin perform cron.unschedule('dabbymarket-notify-demand'); exception when others then null; end $$;
do $$ begin perform cron.unschedule('dabbymarket-remind-stale-availability'); exception when others then null; end $$;

-- 2. Les articles « disponibilité » n'existent plus dans l'ancien modèle
delete from products where listing_kind = 'stock';

-- 3. Déclencheurs
drop trigger if exists trg_products_availability_before on products;
drop trigger if exists trg_products_availability_after on products;
drop trigger if exists trg_review_report on reports;
drop trigger if exists trg_alerts_cap on availability_alerts;

-- 4. Vues
drop view if exists shop_availability_reliability;
drop view if exists catalog_rating_stats;
drop view if exists product_rating_stats;
drop view if exists product_availability;
drop view if exists public.shop_active_listing_counts;

-- 5. Fonctions du module
drop function if exists availability_search(text,text,uuid,double precision,double precision,double precision,double precision,double precision,double precision,double precision,boolean,integer,integer,text,boolean,integer,integer);
drop function if exists get_trouvailles(text, integer);
drop function if exists set_product_availability(uuid, text, integer, integer);
drop function if exists confirm_product_availability(uuid);
drop function if exists confirm_shop_availability(uuid);
drop function if exists report_availability(uuid, text, integer);
drop function if exists submit_product_review(uuid, integer, text);
drop function if exists delete_my_product_review(uuid);
drop function if exists reply_to_product_review(uuid, text);
drop function if exists admin_set_review_status(uuid, text);
drop function if exists log_search_demand(text, uuid, text, text, integer);
drop function if exists merchant_demand_insights(uuid);
drop function if exists notify_merchants_demand();
drop function if exists remind_stale_availability();
drop function if exists notify_restock(uuid);
drop function if exists notify_price_change(uuid, integer);
drop function if exists notify_new_product(uuid);
drop function if exists dm_push_notification(uuid,text,text,text,text,text,jsonb,text,text);
drop function if exists mark_notifications_read(uuid[]);
drop function if exists products_availability_before();
drop function if exists products_availability_after();
drop function if exists handle_review_report();
drop function if exists dm_alerts_cap();

-- 6. Tables du module
drop table if exists search_demand_log cascade;
drop table if exists availability_alerts cascade;
drop table if exists notification_prefs cascade;
drop table if exists notifications cascade;
drop table if exists product_reviews cascade;
drop table if exists availability_reports cascade;
drop table if exists availability_events cascade;

-- 7. Colonnes ajoutées à products
drop index if exists products_catalog_item_idx;
drop index if exists products_avail_idx;
drop index if exists products_kind_idx;
alter table products
  drop column if exists listing_kind, drop column if exists catalog_item_id, drop column if exists availability_status,
  drop column if exists availability_confirmed_at, drop column if exists availability_ttl_hours, drop column if exists stock_qty,
  drop column if exists sale_unit, drop column if exists sale_conditions, drop column if exists attributes, drop column if exists show_on_map;

drop table if exists catalog_items cascade;
drop table if exists product_categories cascade;
drop index if exists shops_geo_idx;
drop index if exists shop_locations_geo_idx;

-- 8. Signalements : retour à la contrainte d'origine (0016)
delete from reports where target_type = 'product_review';
alter table reports drop constraint if exists reports_target_type_check;
alter table reports add constraint reports_target_type_check
  check (target_type in ('shop','product','post','user','flash_listing'));

-- 9. Quota gratuit : définition d'origine (0013)
create view public.shop_active_listing_counts with (security_invoker = true) as
  select shop_id, count(*) as active_count from products where is_active group by shop_id;
grant select on public.shop_active_listing_counts to anon, authenticated;
grant all on public.shop_active_listing_counts to service_role;

-- 10. Paramètres
delete from app_config where key in (
  'availability_default_ttl_hours','availability_contest_threshold','availability_contest_window_hours','report_min_account_age_hours',
  'review_min_account_age_hours','review_daily_limit','review_report_hide_threshold','max_stock_items_per_shop','stock_items_count_toward_quota',
  'trouvailles_min_reviews','demand_alert_threshold','demand_k_anonymity','notify_max_per_day_default','notify_followers_cap');

-- 11. Utilitaires (aucun autre objet ne les utilise après les étapes précédentes)
drop function if exists dm_bayes(numeric, integer);
drop function if exists dm_norm(text);
-- dm_is_admin() est retirée en dernier (les politiques des tables supprimées sont parties avec elles)
drop function if exists dm_is_admin();

-- 12. (Optionnel) 0017 : retire le durcissement de sécurité. NON RECOMMANDÉ :
--     laisser ces déclencheurs en place ne gêne aucune fonctionnalité d'origine.
--   drop trigger if exists trg_guard_profiles_sensitive on profiles;
--   drop trigger if exists trg_guard_shops_sensitive on shops;
--   drop trigger if exists trg_guard_products_sensitive on products;
--   drop function if exists guard_profiles_sensitive_columns();
--   drop function if exists guard_shops_sensitive_columns();
--   drop function if exists guard_products_sensitive_columns();

commit;
