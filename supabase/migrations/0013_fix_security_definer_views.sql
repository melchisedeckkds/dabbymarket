-- DabbyMarket — 0013 : correctif linter Supabase "Security Definer View"
-- sur les deux vues créées par 0012 (active_boosts, shop_active_listing_counts).
-- Même cause et même correctif que shop_ratings (0010) : CREATE OR REPLACE
-- VIEW ne suffit pas à changer le mode d'exécution, il faut DROP puis
-- recréer avec security_invoker déclaré à la création.

drop view if exists public.active_boosts;

create view public.active_boosts
with (security_invoker = true) as
select * from boosts where status = 'active' and expires_at > now();

grant select on public.active_boosts to anon, authenticated;
grant all    on public.active_boosts to service_role;

drop view if exists public.shop_active_listing_counts;

create view public.shop_active_listing_counts
with (security_invoker = true) as
select shop_id, count(*) as active_count
from products where is_active
group by shop_id;

grant select on public.shop_active_listing_counts to anon, authenticated;
grant all    on public.shop_active_listing_counts to service_role;
