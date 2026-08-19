-- DabbyMarket — vue d'agrégation des notes boutique (corrigée : voir échange
-- de debug SQL — CREATE OR REPLACE ne peut pas changer bigint -> int, d'où
-- le DROP explicite, et security_invoker déclaré directement à la création).
drop view if exists public.shop_ratings;

create view public.shop_ratings
with (security_invoker = true) as
select
  r.shop_id,
  round(avg(r.rating)::numeric, 1) as avg_rating,
  count(*)::int as ratings_count
from reviews r
group by r.shop_id;

grant select on public.shop_ratings to anon, authenticated;
grant all    on public.shop_ratings to service_role;
