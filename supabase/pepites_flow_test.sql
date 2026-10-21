-- Tests de non-régression Pépites / Vente Flash (0012 → 0019).
-- À exécuter sur une base de test (jamais en production) :
--   psql "$TEST_DB" -v ON_ERROR_STOP=1 -f supabase/tests/pepites_flow_test.sql
-- Tout est annulé à la fin (ROLLBACK).
begin;
-- (Supabase accorde ces droits par défaut ; utile sur une base Postgres nue)
grant select on flash_listings, profiles to authenticated;

create or replace function pg_temp.as_user(u uuid) returns void language sql as
$$ select set_config('request.jwt.claim.sub', u::text, true) $$;

do $$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); adm uuid := gen_random_uuid();
  f1 uuid; f2 uuid; shop uuid; prod uuid; bal int; tx uuid; n int; ok boolean;
begin
  insert into auth.users(id, phone) values (a,'+237600000001'),(b,'+237600000002'),(adm,'+237600000003');
  update profiles set is_admin = true where id = adm;
  insert into shops(owner_id, name, category, city) values (a,'Boutique A','alimentation','Yaoundé') returning id into shop;
  insert into products(shop_id, name, price_xaf, category, condition) values (shop,'Article',1000,'alimentation','Neuf') returning id into prod;

  -- 1. Première Vente Flash gratuite 48h + bonus 150
  perform pg_temp.as_user(a);
  f1 := publish_flash_listing('Canapé','d','maison','Bon état',50000,false,array['x.jpg'],'Yaoundé','Etoudi',null,24);
  select duration_hours into n from flash_listings where id=f1;
  assert n = 48, 'première annonce : durée forcée 48h';
  select pepites_balance into bal from profiles where id=a;
  assert bal = 150, 'bonus de bienvenue 150, obtenu '||bal;

  -- 2. Boost automatique = expires_at
  assert (select boosted_until = expires_at and archived_at is null from flash_listings where id=f1), 'boost auto actif';

  -- 3. Annonce payante 24h = 10 Pépites
  f2 := publish_flash_listing('Table','d','maison','Neuf',20000,true,array['x.jpg'],'Yaoundé','Etoudi',null,24);
  select pepites_balance into bal from profiles where id=a;
  assert bal = 140, '24h coûte 10, solde '||bal;

  -- 4. Prolongation 48h = 15 et boost suit
  perform extend_flash_listing(f2, 48);
  select pepites_balance into bal from profiles where id=a;
  assert bal = 125, 'prolongation 48h = 15';
  assert (select boosted_until = expires_at from flash_listings where id=f2), 'boost suit la prolongation';

  -- 5. Vendu => archivé, boost coupé
  perform mark_flash_status(f2,'sold');
  assert (select archived_at is not null and boosted_until is null from flash_listings where id=f2), 'archivage à la vente';

  -- 6. Expiration => archivé
  update flash_listings set expires_at = now() - interval '1 minute' where id = f1;
  perform expire_flash_listings();
  assert (select status='expired' and archived_at is not null and boosted_until is null from flash_listings where id=f1), 'archivage à l''expiration';

  -- 7. Un tiers ne voit pas les annonces archivées ; l'admin oui
  perform pg_temp.as_user(b);
  set local role authenticated;
  select count(*) into n from flash_listings where id in (f1,f2);
  assert n = 0, 'archives invisibles pour un tiers';
  reset role;
  perform pg_temp.as_user(adm);
  select count(*) into n from admin_flash_archive(null,null,50,0);
  assert n >= 2, 'archives visibles admin';

  -- 8. Boost : type/cible incohérents refusés, accueil refusé, flash refusé
  perform pg_temp.as_user(a);
  update profiles set pepites_balance = 500 where id = a;
  begin perform purchase_boost('product', prod, 'carte_24h'); ok := false; exception when others then ok := true; end;
  assert ok, 'boost carte sur un article refusé';
  begin perform purchase_boost('shop', shop, 'accueil_24h'); ok := false; exception when others then ok := true; end;
  assert ok, 'accueil via purchase_boost refusé';
  begin perform purchase_boost('flash_listing', f2, 'flash_48h'); ok := false; exception when others then ok := true; end;
  assert ok, 'boost flash payant refusé';
  perform purchase_boost('product', prod, 'article_24h');
  select pepites_balance into bal from profiles where id=a;
  assert bal = 475, 'article 24h = 25';
  begin perform purchase_boost('product', prod, 'article_24h'); perform pg_temp.as_user(b); perform purchase_boost('product', prod, 'article_24h'); ok := false; exception when others then ok := true; end;
  assert ok, 'boost sur l''article d''autrui refusé';

  -- 9. Solde insuffisant
  perform pg_temp.as_user(b);
  begin perform publish_flash_listing('X','d','maison','Neuf',1000,false,array['x.jpg'],'Yaoundé','Etoudi',null,24);
        -- b a consommé son annonce gratuite : on vide son solde puis on retente
        update profiles set pepites_balance = 0 where id = b;
        perform publish_flash_listing('Y','d','maison','Neuf',1000,false,array['x.jpg'],'Yaoundé','Etoudi',null,24);
        ok := false; exception when others then ok := sqlerrm like '%insuffisant%'; end;
  assert ok, 'solde insuffisant refusé après annonce gratuite';

  -- 10. Recharge : montant hors pack, négatif, référence dupliquée
  perform pg_temp.as_user(a);
  begin perform request_recharge(-100,'OrangeMoney','REF12345'); ok := false; exception when others then ok := true; end;
  assert ok, 'montant négatif refusé';
  begin perform request_recharge(123,'OrangeMoney','REF12345'); ok := false; exception when others then ok := true; end;
  assert ok, 'montant hors pack refusé';
  tx := request_recharge(250,'OrangeMoney','REF12345');
  begin perform request_recharge(250,'OrangeMoney','ref12345'); ok := false; exception when others then ok := true; end;
  assert ok, 'référence dupliquée refusée';
  perform pg_temp.as_user(adm);
  perform confirm_recharge(tx, true, 'ok');
  select pepites_balance into bal from profiles where id=a;
  assert bal = 725, 'recharge 250 créditée';

  -- 11. Audit : aucun écart sur les comptes manipulés par les RPC (hors set manuel du test)
  select count(*) into n from admin_pepites_audit() where user_id = b;
  assert n = 0, 'audit propre pour b';

  raise notice 'TOUS LES TESTS PEPITES/FLASH PASSENT';
end $$;

rollback;
