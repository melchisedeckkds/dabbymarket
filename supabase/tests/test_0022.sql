-- Tests 0022 : santé (S0/S1/S2), garde-fous, confidentialité.
\set ON_ERROR_STOP on
reset role;
create or replace function uid(n int) returns uuid language sql immutable as $$ select ('dddddddd-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid $$;
create or replace function su(n int) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', uid(n)::text, false); execute 'set role authenticated'; end $$;
create or replace function t(label text, ok boolean) returns void language plpgsql as $$
begin if not ok then raise exception 'ÉCHEC : %', label; else raise notice 'OK   : %', label; end if; end $$;
create or replace function expect_err(label text, q text, frag text) returns void language plpgsql as $$
begin
  begin execute q; raise exception 'ÉCHEC (aucune erreur) : %', label;
  exception when others then
    if sqlerrm like '%ÉCHEC (aucune erreur)%' then raise; end if;
    if sqlerrm ilike '%' || frag || '%' then raise notice 'OK   : % -> %', label, left(sqlerrm, 90); else raise exception 'ÉCHEC : % (erreur inattendue : %)', label, sqlerrm; end if;
  end;
end $$;

-- Comptes : 200 = pharmacien, 201 = client, 202 = admin, 203 = boutique générale, 204 = autre pharmacien
insert into auth.users (id, phone, raw_user_meta_data)
select uid(n), '+2376' || lpad(n::text, 8, '0'), jsonb_build_object('name', 'S' || n, 'phone', '+2376' || lpad(n::text, 8, '0'))
from generate_series(200, 204) n;
update profiles set created_at = now() - interval '5 days', pepites_balance = 500 where id in (select uid(n) from generate_series(200, 204) n);
update profiles set is_admin = true where id = uid(202);
insert into shops (id, owner_id, name, category, lat, lng, city, neighborhood, shop_type) values
 ('eeeeeeee-0000-0000-0000-000000000201', uid(200), 'Pharmacie du Centre', 'sante', 3.87, 11.50, 'Yaoundé', 'Centre', 'physical'),
 ('eeeeeeee-0000-0000-0000-000000000203', uid(203), 'Quincaillerie Mvog', 'maison', 3.85, 11.51, 'Yaoundé', 'Mvog', 'physical');
insert into catalog_items (id, category_id, name_fr, name_en, slug, synonyms) values
 ('cccccccc-0000-0000-0000-000000000201', 'sante-pharmacie', 'Amoxicilline 500 mg', 'Amoxicillin 500 mg', 'amoxicilline-500', '{amox}'),
 ('cccccccc-0000-0000-0000-000000000202', 'sante-pharmacie', 'Produit contrôlé X', 'Controlled X', 'controle-x', '{}'),
 ('cccccccc-0000-0000-0000-000000000203', 'sante-services', 'Consultation généraliste', 'GP consultation', 'consultation-generaliste', '{}'),
 ('cccccccc-0000-0000-0000-000000000204', 'sante-equipements', 'Tensiomètre', 'Blood pressure monitor', 'tensiometre', '{}');
insert into drug_reference (catalog_item_id, dci, dosage, forme, rx_status) values
 ('cccccccc-0000-0000-0000-000000000201', 'amoxicilline', '500 mg', 'gélule', 'prescription'),
 ('cccccccc-0000-0000-0000-000000000202', 'produit-x', null, null, 'controlled');

-- 1. Une boutique non vérifiée ne peut pas publier en santé
select su(200);
select expect_err('1. offre santé refusée sans vérification',
  $q$insert into products (shop_id, name, price_xaf, category, condition, images, listing_kind, catalog_item_id)
     values ('eeeeeeee-0000-0000-0000-000000000201', 'Consultation', 5000, 'sante-services', 'Neuf', '{x}', 'showcase', 'cccccccc-0000-0000-0000-000000000203')$q$, 'vérifiés');
reset role;

-- 2. Dépôt de dossier par le propriétaire, pas par un tiers ; pas d'écriture directe
select su(203);
select expect_err('2. un tiers ne peut pas déposer le dossier', $q$select submit_health_profile('eeeeeeee-0000-0000-0000-000000000201','pharmacie','AUT-001','Dr X')$q$, 'non autorisée');
select expect_err('2b. pas d''écriture directe de profil', $q$insert into health_profiles (shop_id, facility_type, authorization_ref, responsible_name, status) values ('eeeeeeee-0000-0000-0000-000000000203','pharmacie','A1X','Zz','verified')$q$, 'row-level security');
reset role;
select su(200); select submit_health_profile('eeeeeeee-0000-0000-0000-000000000201', 'pharmacie', 'AUT-2026-001', 'Dr Ngo'); reset role;
select t('2c. dossier en attente', (select status from health_profiles where shop_id = 'eeeeeeee-0000-0000-0000-000000000201') = 'pending');
select t('2d. pas dans l''annuaire public', (select count(*) from health_facilities_public) = 0);
select su(201); select t('2e. le client ne voit pas les champs privés', (select count(*) from health_profiles) = 0); reset role;
select su(200); select t('2f. le propriétaire voit son dossier', (select count(*) from health_profiles) = 1); reset role;

-- 3. Seul l'admin vérifie ; refus sans motif impossible
select su(200);
select expect_err('3. le marchand ne peut pas se vérifier lui-même', $q$select admin_set_health_status('eeeeeeee-0000-0000-0000-000000000201','verified')$q$, 'administrateurs');
reset role; select su(202);
select expect_err('3b. refus sans motif', $q$select admin_set_health_status('eeeeeeee-0000-0000-0000-000000000201','rejected')$q$, 'motif');
select admin_set_health_status('eeeeeeee-0000-0000-0000-000000000201', 'verified');
reset role;
select t('3c. vérifié + date d''expiration', (select expires_at > now() + interval '11 months' from health_profiles where shop_id = 'eeeeeeee-0000-0000-0000-000000000201'));
select t('3d. visible dans l''annuaire', (select count(*) from health_facilities_public) = 1);
select t('3e. le propriétaire est notifié', (select count(*) from notifications where user_id = uid(200) and data->>'health_status' = 'verified') = 1);

-- 4. S1 : services et équipements publiables ; jamais en vitrine
select su(200);
insert into products (id, shop_id, name, price_xaf, category, condition, images, listing_kind, catalog_item_id)
values ('ffffffff-0000-0000-0000-000000000211', 'eeeeeeee-0000-0000-0000-000000000201', 'Consultation généraliste', 5000, 'sante-services', 'Neuf', '{x}', 'showcase', 'cccccccc-0000-0000-0000-000000000203');
insert into products (id, shop_id, name, price_xaf, category, condition, images, listing_kind, catalog_item_id)
values ('ffffffff-0000-0000-0000-000000000212', 'eeeeeeee-0000-0000-0000-000000000201', 'Tensiomètre', 18000, 'sante-equipements', 'Neuf', '{x}', 'showcase', 'cccccccc-0000-0000-0000-000000000204');
select t('4. service publié', (select count(*) from products where id = 'ffffffff-0000-0000-0000-000000000211') = 1);
reset role;
select t('4b. jamais en vitrine', (select count(*) from products where category like 'sante%' and is_showcased) = 0);
select expect_err('4c. catégorie racine refusée', $q$insert into products (shop_id, name, price_xaf, category, condition, images, listing_kind) values ('eeeeeeee-0000-0000-0000-000000000201','X',1000,'sante','Neuf','{x}','showcase')$q$, 'sous-catégorie');

-- 5. S2 fermé par défaut
select su(200);
select expect_err('5. médicament refusé tant que S2 est fermé',
  $q$insert into products (shop_id, name, price_xaf, category, condition, images, listing_kind, catalog_item_id) values ('eeeeeeee-0000-0000-0000-000000000201','Amoxicilline 500 mg',2500,'sante-pharmacie','Neuf','{x}','showcase','cccccccc-0000-0000-0000-000000000201')$q$, 'pas encore ouverte');
reset role;

-- 6. S2 ouvert : référentiel obligatoire, produits contrôlés interdits
update app_config set value = '1' where key = 'health_s2_enabled';
select su(200);
select expect_err('6. saisie libre refusée', $q$insert into products (shop_id, name, price_xaf, category, condition, images, listing_kind) values ('eeeeeeee-0000-0000-0000-000000000201','Un truc',2500,'sante-pharmacie','Neuf','{x}','showcase')$q$, 'référentiel');
select expect_err('6b. produit contrôlé refusé', $q$insert into products (shop_id, name, price_xaf, category, condition, images, listing_kind, catalog_item_id) values ('eeeeeeee-0000-0000-0000-000000000201','X',2500,'sante-pharmacie','Neuf','{x}','showcase','cccccccc-0000-0000-0000-000000000202')$q$, 'ne peut pas');
insert into products (id, shop_id, name, price_xaf, category, condition, images, listing_kind, catalog_item_id, availability_status)
values ('ffffffff-0000-0000-0000-000000000213', 'eeeeeeee-0000-0000-0000-000000000201', 'Amoxicilline 500 mg', 2500, 'sante-pharmacie', 'Neuf', '{x}', 'showcase', 'cccccccc-0000-0000-0000-000000000201', 'available');
select t('6c. médicament du référentiel publié', (select count(*) from products where id = 'ffffffff-0000-0000-0000-000000000213') = 1);
reset role;

-- 7. Recherche : santé trouvable pour tous, prix masqué
select su(201);
select t('7. la recherche trouve le service de santé', (select count(*) from catalog_search('consultation')) = 1);
select t('7b. le prix de santé est masqué', (select price_xaf is null from catalog_search('consultation') limit 1));
reset role;
update app_config set value = '1' where key = 'health_show_prices';
select su(201); select t('7c. prix affiché si réglage activé', (select price_xaf = 5000 from catalog_search('consultation') limit 1)); reset role;
update app_config set value = '0' where key = 'health_show_prices';

-- 8. Pas de boost, pas de vente flash, pas d'avis produit, pas de vitrine payante
select expect_err('8. boost refusé (produit de santé)', $q$insert into boosts (buyer_id, target_type, target_id, boost_catalog_id, boost_type, expires_at) values (uid(200),'product','ffffffff-0000-0000-0000-000000000211','article_24h','article', now()+interval '1 day')$q$, 'santé');
select expect_err('8b. boost refusé (boutique de santé)', $q$insert into boosts (buyer_id, target_type, target_id, boost_catalog_id, boost_type, expires_at) values (uid(200),'shop','eeeeeeee-0000-0000-0000-000000000201','article_24h','shop', now()+interval '1 day')$q$, 'santé');
select expect_err('8c. vente flash refusée', $q$insert into flash_listings (seller_id, title, category, price_xaf, neighborhood, duration_hours, expires_at, condition, images) values (uid(200),'Médoc','sante-pharmacie',1000,'Centre',24,now()+interval '1 day','Neuf','{x}')$q$, 'Santé');
select expect_err('8d. avis produit refusé', $q$insert into product_reviews (product_id, shop_id, user_id, rating, comment) values ('ffffffff-0000-0000-0000-000000000211','eeeeeeee-0000-0000-0000-000000000201',uid(201),1,'nul')$q$, 'désactivés');
select su(200);
select expect_err('8e. emplacement de vitrine payant refusé', $q$select buy_showcase_slot('eeeeeeee-0000-0000-0000-000000000201')$q$, 'santé');
reset role;

-- 9. Avis boutique : étoiles seulement, pas de commentaire libre
select su(201); select record_interaction('eeeeeeee-0000-0000-0000-000000000201', null, 'route');
select expect_err('9. commentaire libre refusé', $q$select submit_shop_review('eeeeeeee-0000-0000-0000-000000000201', 4, 'ils m''ont soigné de ma maladie')$q$, '');
select submit_shop_review('eeeeeeee-0000-0000-0000-000000000201', 4, null);
select t('9b. note sans commentaire acceptée', (select count(*) from reviews where shop_id = 'eeeeeeee-0000-0000-0000-000000000201') = 1);
reset role;

-- 10. Confidentialité : recherches et alertes
select su(201);
select log_search_demand('amoxicilline', null, 'Centre', 'Yaoundé', 0);
select log_search_demand('test de grossesse', null, 'Centre', 'Yaoundé', 0);
select log_search_demand('tensiometre', 'cccccccc-0000-0000-0000-000000000204', 'Centre', 'Yaoundé', 0);
select log_search_demand('marteau', null, 'Centre', 'Yaoundé', 0);
reset role;
select t('10. seules les recherches non-santé sont journalisées', (select count(*) from search_demand_log) = 1 and exists (select 1 from search_demand_log where query_norm = 'marteau'));
insert into search_demand_log (user_id, query_norm) values (uid(201), 'paracetamol');
select t('10b. filet de sécurité : insertion directe filtrée', (select count(*) from search_demand_log where query_norm = 'paracetamol') = 0);
select su(201);
select expect_err('10c. alerte sur un médicament refusée', $q$insert into availability_alerts (user_id, kind, catalog_item_id) values (uid(201), 'catalog_item', 'cccccccc-0000-0000-0000-000000000201')$q$, 'santé');
select expect_err('10d. alerte sur requête de santé refusée', $q$insert into availability_alerts (user_id, kind, query) values (uid(201), 'query', 'amoxicilline')$q$, 'santé');
reset role;

-- 11. Fermeture de S2 : les médicaments sont retirés
update app_config set value = '0' where key = 'health_s2_enabled';
select t('11. fermer S2 désactive les médicaments', (select not is_active from products where id = 'ffffffff-0000-0000-0000-000000000213'));
select t('11b. les services restent actifs', (select is_active from products where id = 'ffffffff-0000-0000-0000-000000000211'));

-- 12. Suspension : retrait immédiat de l'annuaire et des offres
select su(202); select admin_set_health_status('eeeeeeee-0000-0000-0000-000000000201', 'suspended', 'Autorisation non valide'); reset role;
select t('12. suspendu : hors annuaire', (select count(*) from health_facilities_public) = 0);
select t('12b. suspendu : offres retirées', (select count(*) from products where shop_id = 'eeeeeeee-0000-0000-0000-000000000201' and is_active) = 0);
select su(201); select t('12c. suspendu : introuvable par la recherche', (select count(*) from catalog_search('consultation')) = 0); reset role;

-- 13. Expiration automatique
select su(202); select admin_set_health_status('eeeeeeee-0000-0000-0000-000000000201', 'verified'); reset role;
update health_profiles set expires_at = now() - interval '1 day' where shop_id = 'eeeeeeee-0000-0000-0000-000000000201';
select t('13. expiré : hors annuaire même avant le passage du job', (select count(*) from health_facilities_public) = 0);
select t('13b. le job expire 1 dossier', health_expire_profiles() = 1);
select t('13c. statut expired', (select status from health_profiles where shop_id = 'eeeeeeee-0000-0000-0000-000000000201') = 'expired');

-- 14. Modification du dossier : retrait jusqu'à nouvelle vérification
select su(202); select admin_set_health_status('eeeeeeee-0000-0000-0000-000000000201', 'verified'); reset role;
select su(200);
update products set is_active = true where id = 'ffffffff-0000-0000-0000-000000000211';
select submit_health_profile('eeeeeeee-0000-0000-0000-000000000201', 'pharmacie', 'AUT-2026-002', 'Dr Ngo');
reset role;
select t('14. nouveau dossier : repasse en attente', (select status from health_profiles where shop_id = 'eeeeeeee-0000-0000-0000-000000000201') = 'pending');
select t('14b. offres retirées', (select count(*) from products where shop_id = 'eeeeeeee-0000-0000-0000-000000000201' and is_active) = 0);

-- 15. Garde : seul un établissement vérifié gère ses périodes
select su(200);
select expect_err('15. non vérifié : pas de garde', $q$insert into health_duty_periods (shop_id, starts_at, ends_at) values ('eeeeeeee-0000-0000-0000-000000000201', now(), now()+interval '1 day')$q$, 'row-level security');
reset role;
select su(202); select admin_set_health_status('eeeeeeee-0000-0000-0000-000000000201', 'verified'); reset role;
select su(200); insert into health_duty_periods (shop_id, starts_at, ends_at, note) values ('eeeeeeee-0000-0000-0000-000000000201', now() - interval '1 hour', now() + interval '10 hours', 'Garde de nuit'); reset role;
select t('15b. pharmacie de garde signalée', (select on_duty_now from health_facilities_public where shop_id = 'eeeeeeee-0000-0000-0000-000000000201'));

-- 16. Les produits non santé ne sont pas affectés
select su(203);
insert into products (shop_id, name, price_xaf, category, condition, images, listing_kind) values ('eeeeeeee-0000-0000-0000-000000000203', 'Marteau', 4000, 'maison', 'Neuf', '{x}', 'showcase');
select t('16. une boutique générale publie normalement', (select count(*) from products where shop_id = 'eeeeeeee-0000-0000-0000-000000000203') = 1);
select expect_err('16b. une boutique générale ne peut pas publier en santé', $q$insert into products (shop_id, name, price_xaf, category, condition, images, listing_kind) values ('eeeeeeee-0000-0000-0000-000000000203','Tensiomètre',1000,'sante-equipements','Neuf','{x}','showcase')$q$, 'vérifiés');
reset role;
\echo === 0022 : tous les tests passent ===
