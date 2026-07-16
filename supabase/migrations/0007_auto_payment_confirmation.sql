-- Prépare le terrain pour l'Option B (passerelle de paiement automatisée :
-- CinetPay, Notchpay ou Monetbil). Cette fonction est destinée à être
-- appelée UNIQUEMENT par la fonction Edge "payment-webhook" (avec la clé
-- de service), jamais directement par un client.

alter table pepites_transactions add column if not exists provider_reference text;
create index if not exists idx_pepites_tx_provider_reference on pepites_transactions (provider_reference);

-- Confirme automatiquement une recharge à partir de la référence fournie
-- par le client au moment de la demande (reference_code), après que le
-- webhook du prestataire de paiement ait confirmé la réception réelle des
-- fonds. Idempotent : rejouer le même webhook ne credite pas deux fois.
create or replace function auto_confirm_recharge(p_reference_code text, p_provider_reference text default null)
returns boolean
language plpgsql security definer as $$
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
end; $$;
