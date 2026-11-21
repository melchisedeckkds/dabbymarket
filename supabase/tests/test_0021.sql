-- Tests 0021 : notes ouvertes pondérées, exactitude, fiabilité, contestation, badges.
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

-- Comptes : 100 = marchand, 101 = client route, 102 = client avec réception confirmée, 103 = admin, 104..110 = signalants, 120..124 = comptes neufs
insert into auth.users (id, phone, raw_user_meta_data)
select uid(n), '+2376' || lpad(n::text, 8, '0'), jsonb_build_object('name', 'U' || n, 'phone', '+2376' || lpad(n::text, 8, '0'))
from generate_series(100, 124) n;
update profiles set created_at = now() - interval '3 days', pepites_balance = 500 where id in (select uid(n) from generate_series(100, 119) n);
update profiles set created_at = now() - interval '1 day' where id in (select uid(n) from generate_series(120, 124) n);
update profiles set is_admin = true where id = uid(103);
insert into shops (id, owner_id, name, category, lat, lng, city, neighborhood, shop_type)
values ('eeeeeeee-0000-0000-0000-000000000001', uid(100), 'Pharmacie Mokolo Électro', 'maison', 3.87, 11.50, 'Yaoundé', 'Mokolo', 'physical');
insert into products (id, shop_id, name, price_xaf, category, condition, images, listing_kind, availability_status)
values ('ffffffff-0000-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-000000000001', 'Gaz 12,5 kg', 6500, 'maison', 'Neuf', '{x}', 'showcase', 'available'),
       ('ffffffff-0000-0000-0000-000000000002', 'eeeeeeee-0000-0000-0000-000000000001', 'Ventilateur', 15000, 'maison', 'Neuf', '{x}', 'showcase', 'available');

-- 1. Sans trace d'interaction : pas de note
select su(101);
select expect_err('1. noter sans aucune interaction est refusé', $q$select submit_shop_review('eeeeeeee-0000-0000-0000-000000000001', 5, 'super')$q$, 'contactez-la');

-- 2. Itinéraire -> note possible, poids 0,50
select record_interaction('eeeeeeee-0000-0000-0000-000000000001', 'ffffffff-0000-0000-0000-000000000001', 'route') is not null;
select submit_shop_review('eeeeeeee-0000-0000-0000-000000000001', 1, 'Pas là');
reset role;
select t('2. avis « itinéraire » pondéré 0,50', (select weight from reviews where user_id = uid(101)) = 0.50 and (select evidence from reviews where user_id = uid(101)) = 'route');

-- 3. Réception confirmée -> poids 1 ; moyenne pondérée = (5*1 + 1*0,5)/1,5 = 3,7
insert into conversations (id, buyer_id, seller_id, shop_id, product_id, order_confirmed)
values (gen_random_uuid(), uid(102), uid(100), 'eeeeeeee-0000-0000-0000-000000000001', 'ffffffff-0000-0000-0000-000000000001', true);
select su(102);
select submit_shop_review('eeeeeeee-0000-0000-0000-000000000001', 5, 'Très bien');
reset role;
select t('3. note de boutique = moyenne pondérée (3,7)', (select avg_rating from shop_ratings where shop_id = 'eeeeeeee-0000-0000-0000-000000000001') = 3.7);
select t('3b. 2 avis comptés', (select ratings_count from shop_ratings where shop_id = 'eeeeeeee-0000-0000-0000-000000000001') = 2);
select t('3c. le marchand a été notifié', (select count(*) from notifications where user_id = uid(100) and kind = 'shop_review_received') = 2);

-- 4. Garde-fous
select su(100);
select expect_err('4. auto-notation refusée', $q$select submit_shop_review('eeeeeeee-0000-0000-0000-000000000001', 5)$q$, 'propre boutique');
select su(101);
select expect_err('4b. lien refusé', $q$select submit_shop_review('eeeeeeee-0000-0000-0000-000000000001', 4, 'voir http://x.com')$q$, 'liens');
reset role;
insert into auth.users (id, phone, raw_user_meta_data) values (uid(130), '+237600000130', '{"name":"Neuf","phone":"+237600000130"}');
select su(130);
select expect_err('4c. compte trop récent refusé', $q$select submit_shop_review('eeeeeeee-0000-0000-0000-000000000001', 4)$q$, 'trop récent');
reset role;

-- 5. Un seul avis par utilisateur et par boutique : la 2e note met à jour
select su(101);
select submit_shop_review('eeeeeeee-0000-0000-0000-000000000001', 2, 'Finalement ok');
reset role;
select t('5. un seul avis par utilisateur (mise à jour)', (select count(*) from reviews where user_id = uid(101)) = 1 and (select rating from reviews where user_id = uid(101)) = 2);

-- 6. Invitation à confirmer l'exactitude, puis réponse
update interaction_traces set created_at = now() - interval '3 hours', answered_at = null where user_id = uid(101);
delete from reviews where user_id = uid(101);
select su(101);
select t('6. une invitation est proposée après le délai', (select count(*) from pending_rating_prompts()) = 1);
select report_availability('ffffffff-0000-0000-0000-000000000001', 'out_of_stock');
select t('6b. après le signalement, plus d''invitation', (select count(*) from pending_rating_prompts()) = 0);
reset role;

-- 7. Exactitude : sous le seuil d'échantillon rien n'est affiché
select t('7. 1 signalement : taux non affiché', (select accuracy_pct from shop_accuracy_stats where shop_id = 'eeeeeeee-0000-0000-0000-000000000001') is null);
select su(104); select report_availability('ffffffff-0000-0000-0000-000000000001', 'found');
select su(105); select report_availability('ffffffff-0000-0000-0000-000000000001', 'found');
select su(106); select report_availability('ffffffff-0000-0000-0000-000000000001', 'out_of_stock');
reset role;
select t('7b. 4 signalements : toujours non affiché (minimum 5)', (select accuracy_pct from shop_accuracy_stats where shop_id = 'eeeeeeee-0000-0000-0000-000000000001') is null);
select t('7c. boutique encore « normal »', (select reliability_status from shops where id = 'eeeeeeee-0000-0000-0000-000000000001') = 'normal');
select su(107); select report_availability('ffffffff-0000-0000-0000-000000000001', 'out_of_stock');
reset role;
select t('7d. 5 signalements, 2 « trouvé » : exactitude 40 %', (select accuracy_pct from shop_accuracy_stats where shop_id = 'eeeeeeee-0000-0000-0000-000000000001') = 40.0);
select t('7e. boutique passée « peu fiable » (< 50 %)', (select reliability_status from shops where id = 'eeeeeeee-0000-0000-0000-000000000001') = 'unreliable');
select t('7f. propriétaire prévenu', (select count(*) from notifications where user_id = uid(100) and kind = 'reliability_changed') >= 1);

-- 8. Boosts suspendus ; le client ne peut pas modifier le statut
select su(100);
select expect_err('8. boost refusé (boutique peu fiable)', $q$select purchase_boost('product', 'ffffffff-0000-0000-0000-000000000001', (select id from boost_catalog where boost_type = 'recherche' and active limit 1))$q$, 'suspendus');
select expect_err('8b. le marchand ne peut pas modifier son statut de fiabilité', $q$update shops set reliability_status = 'normal' where id = 'eeeeeeee-0000-0000-0000-000000000001'$q$, 'protégée');
reset role;

-- 9. Contestation -> acceptation -> statut normal avec répit de 30 jours
select su(100);
select appeal_reliability('eeeeeeee-0000-0000-0000-000000000001', 'Nous avons reçu du gaz ce matin, le stock est à jour.') is not null;
select expect_err('9. une seule contestation ouverte', $q$select appeal_reliability('eeeeeeee-0000-0000-0000-000000000001', 'Deuxième tentative pour la même boutique ici.')$q$, 'déjà en cours');
select su(101);
select expect_err('9b. un non-admin ne peut pas trancher', $q$select admin_resolve_appeal((select id from reliability_appeals limit 1), true)$q$, 'administrateurs');
select su(103);
select admin_resolve_appeal((select id from reliability_appeals limit 1), true, 'Vérifié sur place');
reset role;
select t('9c. contestation acceptée : statut normal', (select reliability_status from shops where id = 'eeeeeeee-0000-0000-0000-000000000001') = 'normal');
select su(108); select report_availability('ffffffff-0000-0000-0000-000000000002', 'out_of_stock'); reset role;
select t('9d. pendant le répit, une nouvelle mesure ne rebascule pas la boutique', (select reliability_status from shops where id = 'eeeeeeee-0000-0000-0000-000000000001') = 'normal');

-- 10. Badges de contribution (neutres)
select t('10. le contributeur actif a un badge calculé', (select contributions from contributor_badges where user_id = uid(104)) >= 1);
select su(101); select report_availability('ffffffff-0000-0000-0000-000000000002', 'found'); reset role;
select t('10b. les signalements négatifs et positifs comptent pareil', (select contributions from contributor_badges where user_id = uid(101)) >= 2);

-- 11. Signalement d'un avis boutique : masquage à 3 signalants distincts
insert into reviews (id, shop_id, user_id, conversation_id, rating, comment, evidence, weight)
values ('99999999-0000-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-000000000001', uid(109), null, 1, 'Arnaque !', 'route', 0.5);
insert into reports (reporter_id, target_type, target_id, reason) values
  (uid(104), 'shop_review', '99999999-0000-0000-0000-000000000001', 'abus'),
  (uid(105), 'shop_review', '99999999-0000-0000-0000-000000000001', 'abus');
select t('11. 2 signalants : avis encore visible', (select status from reviews where id = '99999999-0000-0000-0000-000000000001') = 'visible');
insert into reports (reporter_id, target_type, target_id, reason) values (uid(106), 'shop_review', '99999999-0000-0000-0000-000000000001', 'abus');
select t('11b. 3 signalants : avis masqué', (select status from reviews where id = '99999999-0000-0000-0000-000000000001') = 'hidden');
select t('11c. l''avis masqué ne compte plus dans la note', (select ratings_count from shop_ratings where shop_id = 'eeeeeeee-0000-0000-0000-000000000001') = 1);

-- 12. Anomalies : 5 avis de comptes neufs sur une même boutique
insert into shops (id, owner_id, name, category, lat, lng, city, neighborhood, shop_type)
values ('eeeeeeee-0000-0000-0000-000000000002', uid(100), 'Boutique suspecte', 'mode', 3.8, 11.4, 'Yaoundé', 'Bastos', 'physical');
do $$ declare n int; begin
  for n in 120..124 loop
    perform su(n);
    perform record_interaction('eeeeeeee-0000-0000-0000-000000000002', null, 'route');
    perform submit_shop_review('eeeeeeee-0000-0000-0000-000000000002', 5, 'Excellent');
    reset role;
  end loop;
end $$;
select su(103);
select t('12. la boutique aux avis de comptes neufs est signalée à l''admin', (select count(*) from admin_review_anomalies() where shop_name = 'Boutique suspecte') = 1);
reset role;
\echo === 0021 : tous les tests passent ===
