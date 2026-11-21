-- Retour arrière de 0020 (vitrine / catalogue). À exécuter dans une transaction après ROLLBACK_0021 et ROLLBACK_0022.
-- Les emplacements achetés (showcase_slots) sont supprimés ; les achats restent dans le registre des Pépites sous le type 'admin_adjustment' (note conservée).
begin;
do $$ begin perform cron.unschedule('dabbymarket-expire-showcase-slots'); exception when others then null; end $$;
drop trigger if exists trg_products_showcase_guard on products;
drop function if exists catalog_search(text,text,text,text,double precision,double precision,double precision,boolean,integer,integer,integer);
drop function if exists products_showcase_guard();
drop function if exists set_showcase(uuid, boolean);
drop function if exists buy_showcase_slot(uuid);
drop function if exists shop_showcase_usage(uuid);
drop function if exists expire_showcase_slots();
drop function if exists shop_showcase_limit(uuid);
drop function if exists dm_health_visible(uuid);
drop function if exists dm_is_health_shop(uuid);
drop function if exists dm_category_is_health(text);
drop table if exists showcase_slots;
drop index if exists products_showcase_idx;
drop index if exists products_showcased_feed_idx;
drop view if exists public.shop_active_listing_counts;
create or replace view public.shop_active_listing_counts as  SELECT shop_id,
    count(*) AS active_count
   FROM products
  WHERE (is_active AND ((listing_kind = 'showcase'::text) OR (COALESCE(config_int('stock_items_count_toward_quota'::text), 0) = 1)))
  GROUP BY shop_id;;
grant select on public.shop_active_listing_counts to anon, authenticated;
alter table products drop column if exists is_showcased, drop column if exists showcased_at;
CREATE OR REPLACE FUNCTION public.bill_quota_overage()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
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
end; $function$
;
select cron.schedule('dabbymarket-bill-quota-overage', '0 4 1 * *', $$select bill_quota_overage();$$);
-- Contraintes d'origine
update pepites_transactions set type = 'admin_adjustment' where type = 'showcase_slot';
delete from notifications where kind = 'showcase_reduced';
alter table pepites_transactions drop constraint if exists pepites_transactions_type_check;
alter table notifications drop constraint if exists notifications_kind_check;
alter table pepites_transactions add constraint pepites_transactions_type_check CHECK ((type = ANY (ARRAY['recharge'::text, 'publish'::text, 'boost_product'::text, 'boost_shop'::text, 'admin_grant'::text, 'admin_adjustment'::text, 'boost_purchase'::text, 'welcome_bonus'::text, 'welcome_bonus_expired'::text, 'quota_overage'::text, 'quota_overage_failed'::text, 'flash_publish'::text, 'flash_extend'::text])));
alter table notifications add constraint notifications_kind_check CHECK ((kind = ANY (ARRAY['restock'::text, 'price_change'::text, 'new_product'::text, 'review_received'::text, 'availability_report'::text, 'demand'::text, 'stale_reminder'::text, 'system'::text])));
delete from app_config where key in ('catalog_max_items_per_shop','showcase_slot_price_pepites','showcase_slot_days');
commit;
