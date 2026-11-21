-- Retour arrière de 0023. ATTENTION : cela RÉOUVRE la faille (n'importe quel utilisateur connecté peut appeler ces fonctions). À n'utiliser qu'en urgence.
begin;
drop function if exists auto_confirm_recharge(text, text, integer);
CREATE OR REPLACE FUNCTION public.auto_confirm_recharge(p_reference_code text, p_provider_reference text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare v_tx pepites_transactions%rowtype;
begin
  select * into v_tx from pepites_transactions
    where reference_code = p_reference_code and status = 'pending'
    order by created_at desc limit 1
    for update;

  if not found then
    return false; -- déjà traité, ou référence inconnue : le webhook ne doit rien faire de plus
  end if;

  update profiles set pepites_balance = pepites_balance + v_tx.amount where id = v_tx.user_id;
  update pepites_transactions
    set status = 'confirmed', confirmed_at = now(), provider_reference = p_provider_reference,
        admin_note = 'Confirmé automatiquement par la passerelle de paiement'
    where id = v_tx.id;

  return true;
end; $function$
;
grant execute on function auto_confirm_recharge(text, text) to public;
grant execute on function check_and_increment_ai_usage(uuid, integer) to public;
commit;
