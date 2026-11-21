-- =========================================================
-- DabbyMarket — 0023 : DURCISSEMENT DU PAIEMENT ET DU QUOTA IA
--
-- Faille corrigée : `auto_confirm_recharge` (crédit de Pépites) et
-- `check_and_increment_ai_usage` étaient exécutables par n'importe quel client
-- (rôles anon / authenticated), car PostgreSQL accorde EXECUTE à PUBLIC par défaut.
-- Un utilisateur pouvait donc se créditer des Pépites sans payer.
-- Désormais seules les Edge Functions (rôle service_role) peuvent les appeler.
--
-- `auto_confirm_recharge` vérifie en plus le MONTANT payé et refuse le rejeu
-- d'un même identifiant de transaction du prestataire.
-- Retour arrière : voir supabase/rollbacks/ROLLBACK_0023.sql
-- =========================================================

drop function if exists auto_confirm_recharge(text, text);

create or replace function auto_confirm_recharge(
  p_reference_code text,
  p_provider_reference text default null,
  p_paid_fcfa integer default null
) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_tx pepites_transactions%rowtype;
  v_price integer;
begin
  if p_provider_reference is not null and exists (
    select 1 from pepites_transactions where provider_reference = p_provider_reference
  ) then
    return false; -- identifiant de transaction déjà utilisé : rejeu refusé
  end if;

  select * into v_tx from pepites_transactions
    where reference_code = p_reference_code and status = 'pending' and type = 'recharge'
    order by created_at desc limit 1
    for update;
  if not found then return false; end if;

  -- Montant : si la recharge correspond à un pack, le montant payé doit être au moins son prix.
  if v_tx.pack_id is not null then
    select price_fcfa into v_price from pepite_packs where id = v_tx.pack_id;
    if v_price is not null then
      if p_paid_fcfa is null or p_paid_fcfa < v_price then
        update pepites_transactions
           set admin_note = 'Paiement automatique refusé : montant reçu (' || coalesce(p_paid_fcfa::text, 'inconnu') || ' FCFA) inférieur au prix du pack (' || v_price || ' FCFA)'
         where id = v_tx.id;
        return false;
      end if;
    end if;
  end if;

  update profiles set pepites_balance = pepites_balance + v_tx.amount where id = v_tx.user_id;
  update pepites_transactions
     set status = 'confirmed', confirmed_at = now(), provider_reference = p_provider_reference,
         admin_note = 'Confirmé automatiquement par la passerelle de paiement'
   where id = v_tx.id;
  return true;
end; $$;

revoke execute on function auto_confirm_recharge(text, text, integer) from public, anon, authenticated;
grant execute on function auto_confirm_recharge(text, text, integer) to service_role;

revoke execute on function check_and_increment_ai_usage(uuid, integer) from public, anon, authenticated;
grant execute on function check_and_increment_ai_usage(uuid, integer) to service_role;
