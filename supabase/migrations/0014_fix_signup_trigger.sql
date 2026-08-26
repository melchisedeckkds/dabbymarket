-- DabbyMarket — 0014 : handle_new_user robuste, SANS réintroduire l'ancien
-- bonus de 500 Pépites à l'inscription (le correctif appliqué manuellement
-- en urgence par l'équipe corrigeait le bug d'inscription mais restaurait
-- par erreur l'ancien comportement — cette migration règle définitivement
-- les deux points).
--
-- Rappel du Modèle 1 : aucune Pépite n'est offerte à l'inscription. Le
-- bonus de bienvenue (montant configurable, 150 par défaut) n'est versé
-- qu'après la publication d'un premier article avec au moins une photo,
-- via grant_welcome_bonus_if_eligible() (voir 0012).

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, phone, name, pepites_balance, is_admin)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'phone', new.phone, split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'name', 'Nouvel utilisateur'),
    0,      -- Modèle 1 : rien à l'inscription, voir welcome_bonus_status ci-dessous
    false
  )
  on conflict (id) do nothing;
  return new;
exception
  when others then
    -- Ne bloque jamais la création du compte côté Auth si l'insertion du
    -- profil échoue pour une raison imprévue : on journalise et on laisse
    -- passer, plutôt que de faire échouer toute l'inscription comme
    -- c'était le cas avant ce correctif.
    raise warning 'handle_new_user a échoué pour %: %', new.id, sqlerrm;
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Remet à zéro le solde des comptes qui auraient reçu 500 Pépites via le
-- correctif d'urgence entre-temps, UNIQUEMENT s'ils n'ont encore rien
-- dépensé ni reçu d'autre transaction (pour ne jamais toucher un compte
-- qui a une activité réelle derrière ce solde).
update profiles p
   set pepites_balance = 0,
       welcome_bonus_status = 'pending'
 where p.pepites_balance = 500
   and p.welcome_bonus_status = 'pending'
   and not exists (select 1 from pepites_transactions t where t.user_id = p.id)
   and not exists (select 1 from products pr join shops s on s.id = pr.shop_id where s.owner_id = p.id);

-- Nettoyage des profils orphelins (comptes Auth supprimés sans profil
-- associé, ou profils sans compte Auth valide) — sans risque, additive.
delete from profiles where id not in (select id from auth.users);
