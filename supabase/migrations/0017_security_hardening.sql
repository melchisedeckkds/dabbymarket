-- =========================================================
-- DabbyMarket — 0017 : durcissement des colonnes sensibles
--
-- CONTEXTE (constat vérifié sur une base de test rejouant 0001→0016) :
-- 0001_init.sql tente de protéger profiles.pepites_balance par
--   revoke update (pepites_balance) on profiles from authenticated;
-- Or, sur Supabase, le rôle `authenticated` reçoit par défaut un droit
-- UPDATE au niveau de la TABLE entière. Révoquer une seule colonne n'a
-- alors AUCUN effet (PostgreSQL ne retire pas un droit de table colonne
-- par colonne). Conséquence : combinée à la politique RLS « Un utilisateur
-- modifie seulement son propre profil », la requête suivante réussissait
-- pour n'importe quel compte connecté :
--   update profiles set is_admin = true, pepites_balance = 999999
--    where id = auth.uid();
--
-- Même schéma pour : shops.verified / is_blocked (auto-certification),
-- products.boosted_until (boost gratuit).
--
-- CORRECTIF : des déclencheurs BEFORE UPDATE refusent toute modification
-- de ces colonnes quand elle vient d'un client (rôles `authenticated` /
-- `anon`). Les fonctions SECURITY DEFINER existantes (achat de boost,
-- recharge, modération admin...) s'exécutent avec les droits de leur
-- propriétaire (`postgres`) et ne sont donc pas affectées, de même que
-- l'éditeur SQL Supabase et les fonctions Edge (clé de service).
--
-- ADDITIVE : aucune donnée n'est modifiée ni supprimée.
-- =========================================================

create or replace function guard_profiles_sensitive_columns()
returns trigger language plpgsql as $$
begin
  if current_user in ('authenticated', 'anon') then
    if new.is_admin is distinct from old.is_admin
       or new.pepites_balance is distinct from old.pepites_balance
       or new.is_blocked is distinct from old.is_blocked
       or new.welcome_bonus_status is distinct from old.welcome_bonus_status
       or new.welcome_bonus_granted_at is distinct from old.welcome_bonus_granted_at
       or new.welcome_bonus_expires_at is distinct from old.welcome_bonus_expires_at
       or new.phone is distinct from old.phone
    then
      raise exception 'Modification non autorisée : colonne protégée du profil.' using errcode = '42501';
    end if;
  end if;
  return new;
end; $$;

drop trigger if exists trg_guard_profiles_sensitive on profiles;
create trigger trg_guard_profiles_sensitive
  before update on profiles
  for each row execute function guard_profiles_sensitive_columns();

create or replace function guard_shops_sensitive_columns()
returns trigger language plpgsql as $$
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
end; $$;

drop trigger if exists trg_guard_shops_sensitive on shops;
create trigger trg_guard_shops_sensitive
  before update on shops
  for each row execute function guard_shops_sensitive_columns();

create or replace function guard_products_sensitive_columns()
returns trigger language plpgsql as $$
begin
  if current_user in ('authenticated', 'anon') then
    if new.boosted_until is distinct from old.boosted_until then
      raise exception 'Modification non autorisée : le boost ne s''achète que via la boutique de Pépites.' using errcode = '42501';
    end if;
  end if;
  return new;
end; $$;

drop trigger if exists trg_guard_products_sensitive on products;
create trigger trg_guard_products_sensitive
  before update on products
  for each row execute function guard_products_sensitive_columns();

-- Requête de contrôle à exécuter après application (doit renvoyer 3 lignes
-- « trg_guard_* » et aucune erreur) :
--   select tgname from pg_trigger where tgname like 'trg_guard_%';
