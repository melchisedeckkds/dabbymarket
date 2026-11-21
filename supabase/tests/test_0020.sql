-- Tests 0020 (exécutés sur PostgreSQL 16 simulant Supabase). Chaque test lève une exception en cas d'échec.
\set ON_ERROR_STOP on
\set A '''aaaaaaaa-0000-0000-0000-000000000001'''
\set B '''bbbbbbbb-0000-0000-0000-000000000002'''
reset role;
insert into auth.users (id, phone, raw_user_meta_data) values
  (:A, '+237600000001', '{"name":"Marchand A","phone":"+237600000001"}'),
  (:B, '+237600000002', '{"name":"Client B","phone":"+237600000002"}');
update profiles set created_at = now() - interval '3 days', pepites_balance = 100 where id in (:A, :B);
insert into shops (id, owner_id, name, category, lat, lng, city, neighborhood, shop_type)
values ('cccccccc-0000-0000-0000-00000000000a', :A, 'Quincaillerie Etoudi', 'maison', 3.90, 11.52, 'Yaoundé', 'Etoudi', 'physical');

create or replace function t(label text, ok boolean) returns void language plpgsql as $$
begin if not ok then raise exception 'ÉCHEC : %', label; else raise notice 'OK   : %', label; end if; end $$;

-- 1. 5 articles publiés par le client : 3 en vitrine, 2 au catalogue
set role authenticated; select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false);
insert into products (shop_id, name, price_xaf, category, condition, images) values
  ('cccccccc-0000-0000-0000-00000000000a', 'Ciment CPJ 42,5 sac 50 kg', 5000, 'maison', 'Neuf', '{x}'),
  ('cccccccc-0000-0000-0000-00000000000a', 'Peinture blanche 20 L',     35000, 'maison', 'Neuf', '{x}'),
  ('cccccccc-0000-0000-0000-00000000000a', 'Marteau',                    4000, 'maison', 'Neuf', '{x}'),
  ('cccccccc-0000-0000-0000-00000000000a', 'Tournevis cruciforme',       1500, 'maison', 'Neuf', '{x}'),
  ('cccccccc-0000-0000-0000-00000000000a', 'Fer à béton 8 mm barre',     3500, 'maison', 'Neuf', '{x}');
reset role;
select t('1. 3 articles en vitrine sur 5', (select count(*) from products where is_showcased) = 3);
select t('1b. les 2 derniers sont au catalogue (actifs, hors vitrine)', (select count(*) from products where is_active and not is_showcased) = 2);

-- 2. Le client ne peut pas forcer la vitrine
set role authenticated; select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false);
do $$ begin
  update products set is_showcased = true where name = 'Tournevis cruciforme';
  raise exception 'ÉCHEC : la mise à jour directe aurait dû être refusée';
exception when sqlstate '42501' then raise notice 'OK   : 2. mise en vitrine directe refusée'; end $$;

-- 3. Vitrine pleine, puis échange via RPC
do $$ declare id4 uuid; id1 uuid; begin
  select id into id4 from products where name = 'Tournevis cruciforme';
  select id into id1 from products where name = 'Ciment CPJ 42,5 sac 50 kg';
  begin perform set_showcase(id4, true); raise exception 'ÉCHEC : vitrine pleine non détectée';
  exception when others then
    if sqlerrm like 'Vitrine pleine%' then raise notice 'OK   : 3. vitrine pleine refusée (%)', sqlerrm; else raise; end if; end;
  perform set_showcase(id1, false);
  perform set_showcase(id4, true);
  raise notice 'OK   : 3b. échange de vitrine accepté';
end $$;

-- 3c. Un tiers ne peut pas gérer la vitrine d'un autre
select set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-000000000002', false);
do $$ begin
  perform set_showcase((select id from products where name = 'Marteau'), false);
  raise exception 'ÉCHEC : un tiers a modifié la vitrine';
exception when others then
  if sqlerrm like 'Article introuvable%' then raise notice 'OK   : 3c. tiers refusé'; else raise; end if; end $$;

-- 4. Achat d'un emplacement
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false);
select buy_showcase_slot('cccccccc-0000-0000-0000-00000000000a') is not null as achete;
select set_showcase((select id from products where name = 'Fer à béton 8 mm barre'), true);
reset role;
select t('4. solde débité de 30 Pépites', (select pepites_balance from profiles where id = :A) = 70);
select t('4b. 4 articles en vitrine (limite 3 + 1 emplacement)', (select count(*) from products where is_showcased) = 4);
select t('4c. transaction showcase_slot enregistrée', (select count(*) from pepites_transactions where type = 'showcase_slot') = 1);

-- 5. Expiration de l'emplacement : retour à 3, notification envoyée
update showcase_slots set expires_at = now() - interval '1 hour';
select expire_showcase_slots();
select t('5. vitrine ramenée à 3 après expiration', (select count(*) from products where is_showcased) = 3);
select t('5b. propriétaire prévenu', (select count(*) from notifications where user_id = :A and kind = 'showcase_reduced') = 1);

-- 6. Plafond de catalogue
update app_config set value = '5' where key = 'catalog_max_items_per_shop';
set role authenticated; select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false);
do $$ begin
  insert into products (shop_id, name, price_xaf, category, condition, images) values ('cccccccc-0000-0000-0000-00000000000a', 'Sixième', 100, 'maison', 'Neuf', '{x}');
  raise exception 'ÉCHEC : plafond non appliqué';
exception when others then
  if sqlerrm like 'Limite de 5 articles%' then raise notice 'OK   : 6. plafond de catalogue appliqué'; else raise; end if; end $$;
reset role;
update app_config set value = '200' where key = 'catalog_max_items_per_shop';

-- 7. Recherche : trouve le catalogue hors vitrine, avec statuts honnêtes et ordre correct
update products set availability_status = 'available', listing_kind = 'stock', category = 'maison' where false;
do $$ declare r record; n int := 0; begin
  for r in select id, name from products where is_active and not is_showcased loop
    if not exists (select 1 from catalog_search(split_part(r.name, ' ', 1)) c where c.product_id = r.id) then
      raise exception 'ÉCHEC : 7. article hors vitrine introuvable par la recherche : %', r.name; end if;
    n := n + 1;
  end loop;
  if n <> 2 then raise exception 'ÉCHEC : 7. attendu 2 articles hors vitrine, trouvé %', n; end if;
  raise notice 'OK   : 7. la recherche trouve les % articles HORS vitrine', n;
end $$;
select t('7b. la recherche sans mot-clé renvoie tout le catalogue actif', (select count(*) from catalog_search()) = 5);
-- statuts : un article disponible remonte avant un article non renseigné, un article en rupture reste visible
update products set availability_status = 'out', availability_confirmed_at = now(), listing_kind = 'showcase' where name = 'Marteau';
update products set availability_status = 'available', availability_confirmed_at = now() where name = 'Peinture blanche 20 L';
select t('7c. article en rupture reste visible avec statut « out »',
  (select effective_status from catalog_search('marteau') limit 1) = 'out');
select t('7d. disponible classé avant non renseigné/rupture (même pertinence)',
  (select product_id from catalog_search(null) limit 1) = (select id from products where name = 'Peinture blanche 20 L'));
select t('7e. filtre « disponible uniquement » exclut rupture et inconnu',
  (select count(*) from catalog_search(null, null, null, null, null, null, null, true)) = 1);

-- 8. Boost : drapeau sponsorisé, mais aucun effet sur le classement
insert into boosts (buyer_id, target_type, target_id, boost_catalog_id, boost_type, expires_at)
  select :A, 'product', (select id from products where name = 'Tournevis cruciforme'),
         (select id from boost_catalog where boost_type = 'recherche' limit 1), 'recherche', now() + interval '1 day';
select t('8. le boost est signalé `sponsored`', (select sponsored from catalog_search('tournevis') limit 1));
select t('8b. le boost ne fait pas passer l''article devant un article disponible',
  (select product_id from catalog_search(null) limit 1) = (select id from products where name = 'Peinture blanche 20 L'));

-- 9. Facturation des dépassements désactivée
select bill_quota_overage();
select t('9. aucune facturation de dépassement', (select count(*) from pepites_transactions where type like 'quota_overage%') = 0);
select t('9b. tâche cron supprimée', (select count(*) from cron.jobs where name = 'dabbymarket-bill-quota-overage') = 0);

-- 10. Santé : jamais en vitrine, jamais dans les résultats tant que 0022 n'est pas installé
set role authenticated; select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false);
insert into products (shop_id, name, price_xaf, category, condition, images) values ('cccccccc-0000-0000-0000-00000000000a', 'Paracétamol 500 mg', 500, 'sante', 'Neuf', '{x}');
reset role;
select t('10. une offre santé n''est pas mise en vitrine', not (select is_showcased from products where name = 'Paracétamol 500 mg'));
select t('10b. une offre santé n''apparaît pas dans la recherche', (select count(*) from catalog_search('paracetamol')) = 0);
\echo === 0020 : tous les tests passent ===
