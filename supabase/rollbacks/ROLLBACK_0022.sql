-- Retour arrière de 0022 (santé). À exécuter dans une transaction. Les données santé (profils, médicaments, périodes de garde) sont SUPPRIMÉES : exportez-les avant si besoin.
begin;
do $$ begin perform cron.unschedule('dabbymarket-health-expire'); exception when others then null; end $$;
drop trigger if exists trg_products_health_guard on products;
drop trigger if exists trg_health_s2_switch_sync on app_config;
drop trigger if exists trg_flash_health_guard on flash_listings;
drop trigger if exists trg_product_reviews_health_guard on product_reviews;
drop trigger if exists trg_search_demand_health_filter on search_demand_log;
drop trigger if exists trg_availability_alerts_health_guard on availability_alerts;
-- Les offres de santé existantes sont retirées (désactivées) puis rattachées à la catégorie racine fermée.
update products set is_active = false, is_showcased = false, category = 'sante' where category in ('sante-pharmacie','sante-services','sante-equipements');
update catalog_items set category_id = 'sante', active = false where category_id in ('sante-pharmacie','sante-services','sante-equipements');
delete from product_categories where id in ('sante-pharmacie','sante-services','sante-equipements');
drop view if exists health_facilities_public;
drop table if exists health_duty_periods;
drop table if exists drug_reference;
drop table if exists health_profiles cascade;
-- Fonctions du 0021 / 0020 / 0019 restaurées
CREATE OR REPLACE FUNCTION public.log_search_demand(p_query text, p_catalog_item uuid DEFAULT NULL::uuid, p_neighborhood text DEFAULT NULL::text, p_city text DEFAULT NULL::text, p_results integer DEFAULT 0)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_q text := btrim(dm_norm(p_query));
begin
  if auth.uid() is null or v_q is null or char_length(v_q) < 2 or char_length(v_q) > 80 then return; end if;
  insert into search_demand_log (user_id, query_norm, catalog_item_id, neighborhood, city, results_available)
  values (auth.uid(), v_q, p_catalog_item, nullif(btrim(p_neighborhood), ''), nullif(btrim(p_city), ''), greatest(coalesce(p_results, 0), 0))
  on conflict (user_id, query_norm, day) do nothing;
end; $function$
;
CREATE OR REPLACE FUNCTION public.boosts_reliability_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
end; $function$
;
create or replace function dm_health_visible(p_shop uuid) returns boolean language sql stable as $$ select false $$;
create or replace function dm_is_health_shop(p_shop uuid) returns boolean language sql stable as $$ select false $$;
drop function if exists dm_health_verified(uuid);
drop function if exists admin_set_health_status(uuid, text, text);
drop function if exists submit_health_profile(uuid, text, text, text);
drop function if exists health_expire_profiles();
drop function if exists health_deactivate_offers(uuid);
drop function if exists health_s2_switch_sync();
drop function if exists products_health_guard();
drop function if exists flash_health_guard();
drop function if exists product_reviews_health_guard();
drop function if exists search_demand_health_filter();
drop function if exists availability_alerts_health_guard();
drop function if exists dm_is_health_query(text, uuid);
delete from app_config where key in ('health_s2_enabled','health_show_prices','health_profile_valid_months');
commit;
