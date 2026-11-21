\set ON_ERROR_STOP on
reset role;
create or replace function uid(n int) returns uuid language sql immutable as $$ select ('dddddddd-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid $$;
create or replace function t(label text, ok boolean) returns void language plpgsql as $$
begin if not ok then raise exception 'ÉCHEC : %', label; else raise notice 'OK   : %', label; end if; end $$;
insert into auth.users (id, phone, raw_user_meta_data) values (uid(400), '+237600000400', '{"name":"R","phone":"+237600000400"}');
insert into pepite_packs (id, label, pepites, price_fcfa) values ('pk-test', 'Test', 100, 1000) on conflict (id) do update set price_fcfa = 1000;
insert into pepites_transactions (id, user_id, type, amount, method, reference_code, status, pack_id) values
 ('aaaaaaaa-0000-0000-0000-000000000401', uid(400), 'recharge', 100, 'OrangeMoney', 'REF-401', 'pending', 'pk-test'),
 ('aaaaaaaa-0000-0000-0000-000000000402', uid(400), 'recharge', 100, 'OrangeMoney', 'REF-402', 'pending', 'pk-test');
-- 1. un client ne peut pas se créditer
set role authenticated; select set_config('request.jwt.claim.sub', uid(400)::text, false);
do $$ begin
  begin perform auto_confirm_recharge('REF-401', 'X1', 1000); raise exception 'ÉCHEC : appel client accepté';
  exception when insufficient_privilege then raise notice 'OK   : 1. un client ne peut pas appeler auto_confirm_recharge'; end;
  begin perform check_and_increment_ai_usage(uid(400), 40); raise exception 'ÉCHEC : appel client accepté (IA)';
  exception when insufficient_privilege then raise notice 'OK   : 1b. un client ne peut pas toucher le quota IA'; end;
end $$;
reset role;
-- 2. service_role : montant insuffisant refusé, solde inchangé
set role service_role;
select t('2. montant insuffisant refusé', not auto_confirm_recharge('REF-401', 'P-401', 500));
select t('2b. montant absent refusé', not auto_confirm_recharge('REF-401', 'P-401', null));
reset role;
select t('2c. solde inchangé', (select pepites_balance from profiles where id = uid(400)) = 0);
-- 3. montant correct accepté, puis rejeu refusé
set role service_role;
select t('3. paiement correct crédité', auto_confirm_recharge('REF-401', 'P-401', 1000));
select t('3b. rejeu de la même référence refusé', not auto_confirm_recharge('REF-401', 'P-401', 1000));
select t('3c. même identifiant prestataire sur une autre recharge refusé', not auto_confirm_recharge('REF-402', 'P-401', 1000));
reset role;
select t('3d. solde = 100', (select pepites_balance from profiles where id = uid(400)) = 100);
\echo === 0023 : tous les tests passent ===
