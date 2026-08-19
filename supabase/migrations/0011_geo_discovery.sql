-- DabbyMarket — 0011 : découverte locale (type de boutique, quartier,
-- repère, photos boutique, horaires).
--
-- ADDITIVE et rétro-compatible : les boutiques déjà créées ne perdent
-- aucune donnée. shop_type est déduit automatiquement de la présence
-- (ou non) de coordonnées GPS, exactement comme le comportement actuel
-- de la Carte, qui n'affichait déjà que les boutiques avec lat/lng.

alter table shops add column if not exists shop_type text not null default 'physical' check (shop_type in ('physical', 'no_location'));
alter table shops add column if not exists neighborhood text;
alter table shops add column if not exists city text not null default 'Yaoundé';
alter table shops add column if not exists landmark text;
alter table shops add column if not exists photos text[] not null default '{}';
alter table shops add column if not exists delivery_zone text;
-- Horaires : { "mon": {"open":"08:00","close":"18:00","closed":false}, ... "alwaysOpen": false }
alter table shops add column if not exists hours jsonb;

-- Rétro-compatibilité : les boutiques existantes sans coordonnées GPS
-- deviennent explicitement "sans emplacement" plutôt que de rester sur
-- la valeur par défaut 'physical' à tort.
update shops set shop_type = 'no_location' where lat is null or lng is null;

create index if not exists shops_shop_type_idx on shops (shop_type);
create index if not exists shops_neighborhood_idx on shops (neighborhood);
