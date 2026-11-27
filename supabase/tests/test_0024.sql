-- Tests 0024 DabbyMap (PostgreSQL 16 simulant Supabase ; PostGIS simulé). Chaque test lève une exception en cas d'échec.
\set ON_ERROR_STOP on
\set ADM '''a0000000-0000-0000-0000-00000000000a'''
\set B '''b0000000-0000-0000-0000-00000000000b'''
\set C '''c0000000-0000-0000-0000-00000000000c'''
\set D '''d0000000-0000-0000-0000-00000000000d'''
reset role;
insert into auth.users (id, phone, raw_user_meta_data) values
  (:ADM, '+237600000010', '{"name":"Admin","phone":"+237600000010"}'),
  (:B, '+237600000011', '{"name":"Citoyen B","phone":"+237600000011"}'),
  (:C, '+237600000012', '{"name":"Agent C","phone":"+237600000012"}'),
  (:D, '+237600000013', '{"name":"Agent D","phone":"+237600000013"}');
update profiles set is_admin = true where id = :ADM;
insert into mapper_permissions (user_id, permission_code, zone_id) values
  (:C, 'moderate', (select id from geo_zones where code = 'etoudi')),
  (:D, 'moderate', (select id from geo_zones where code = 'douala'));

create or replace function t(label text, ok boolean) returns void language plpgsql as $$
begin if not ok then raise exception 'ÉCHEC : %', label; else raise notice 'OK   : %', label; end if; end $$;
create or replace function expect_error(label text, stmt text, frag text) returns void language plpgsql as $$
begin
  begin execute stmt; exception when others then
    if sqlerrm ilike '%' || frag || '%' then raise notice 'OK   : % (%)', label, sqlerrm; return; end if;
    raise exception 'ÉCHEC : % — message inattendu : %', label, sqlerrm;
  end;
  raise exception 'ÉCHEC : % — aucune erreur levée', label;
end $$;
grant execute on function t(text, boolean), expect_error(text, text, text) to anon, authenticated;

-- 1. Jeu de départ
select t('1. 52 repères importés et publiés', (select count(*) from landmarks where source_type = 'osm' and publication_status = 'published') = 52);
select t('1b. tous rattachés à une zone', (select count(*) from landmarks where zone_id is null) = 0);
select t('1c. au moins 40 dans la zone pilote Étoudi', (select count(*) from landmarks l join geo_zones z on z.id = l.zone_id where z.code = 'etoudi') >= 40);
select t('1d. attribution ODbL présente partout', (select count(*) from landmarks where source_attribution like '%OpenStreetMap%') = 52);
select t('1e. catégories toutes connues (clé étrangère)', (select count(*) from landmarks l left join landmark_categories c on c.code = l.category_code where c.code is null) = 0);

-- 2. Lecture publique (anon)
set role anon; select set_config('request.jwt.claim.sub', '', false);
select t('2. map_nearby autour d''Étoudi renvoie des repères', (select count(*) from map_nearby(3.9177, 11.5285, 1500)) > 10);
select t('2b. tri : importance décroissante', (select bool_and(i >= nxt) from (select importance i, lead(importance) over () nxt from map_nearby(3.9177, 11.5285, 1500)) s where nxt is not null));
select t('2c. plafond de limite respecté', (select count(*) from map_nearby(3.9177, 11.5285, 5000, null, 1, 5)) = 5);
select t('2d. filtre d''importance (zoom éloigné)', (select max(importance) = min(importance) and min(importance) >= 4 from map_nearby(3.9177, 11.5285, 1500, null, 4, 60)));
select t('2e. coordonnées invalides : aucun résultat, aucune erreur', (select count(*) from map_nearby(999, 11.5, 1500)) = 0);
select t('2f. recherche « etoudi » trouve le marché', exists (select 1 from map_search('etoudi') where name ilike 'Marché%'));
select t('2g. recherche insensible aux accents et à la casse (ECOLE)', exists (select 1 from map_search('ECOLE sainte') where name ilike 'École%'));
select t('2h. recherche avec % ne renvoie pas tout', (select count(*) from map_search('%%')) = 0);
select t('2i. requête trop courte : rien', (select count(*) from map_search('a')) = 0);
select expect_error('3. anon ne peut pas insérer un repère', $$insert into landmarks (name, category_code, lat, lng) values ('X','autre',3.9,11.5)$$, 'permission denied');
select expect_error('3b. anon ne peut pas contribuer', $$select map_contribute('create', null, '{"name":"X","lat":3.9,"lng":11.5}')$$, 'permission denied');
select expect_error('3c. anon n''accède pas aux droits des cartographes', $$select count(*) from mapper_permissions$$, 'permission denied');
select expect_error('3d. anon n''accède pas à l''historique', $$select count(*) from landmark_edit_history$$, 'permission denied');

-- 4. Citoyen B : contributions
set role authenticated; select set_config('request.jwt.claim.sub', 'b0000000-0000-0000-0000-00000000000b', false);
select expect_error('4. B ne peut pas insérer directement un repère', $$insert into landmarks (name, category_code, lat, lng, publication_status) values ('Faux','autre',3.9,11.5,'published')$$, 'permission denied');
select expect_error('4b. B ne peut pas modifier un repère', $$update landmarks set name = 'Piraté'$$, 'permission denied');
select expect_error('4c. B ne peut pas s''octroyer des droits', $$insert into mapper_permissions (user_id, permission_code) values ('b0000000-0000-0000-0000-00000000000b','moderate')$$, 'permission denied');
select expect_error('4d. position hors Cameroun refusée', $$select map_contribute('create', null, '{"name":"Loin","lat":48.85,"lng":2.35}')$$, 'hors du Cameroun');
select expect_error('4e. champ non autorisé refusé', $$select map_contribute('create', null, '{"name":"Test","lat":3.9,"lng":11.5,"publication_status":"published"}')$$, 'non autorisé');
select expect_error('4f. nom trop court refusé', $$select map_contribute('create', null, '{"name":"A","lat":3.9,"lng":11.5}')$$, 'Nom invalide');
select expect_error('4g. catégorie inconnue refusée', $$select map_contribute('create', null, '{"name":"Test","lat":3.9,"lng":11.5,"category_code":"nimporte"}')$$, 'Catégorie inconnue');
select expect_error('4h. valeur non numérique refusée', $$select map_contribute('create', null, '{"name":"Test","lat":"abc","lng":11.5}')$$, 'numérique');
create temp table ctx (k text primary key, v uuid);
grant all on ctx to public;
insert into ctx select 'b_create', map_contribute('create', null, '{"name":"Boulangerie du Carrefour Etoudi","lat":3.9170,"lng":11.5290,"category_code":"commerce","access_hint":"à côté du grand arbre"}');
select t('4i. contribution de B en attente, repère non créé', (select status from landmark_contributions where id = (select v from ctx where k='b_create')) = 'pending'
   and not exists (select 1 from landmarks where name like 'Boulangerie du Carrefour%'));
select t('4j. B lit sa propre contribution', (select count(*) from landmark_contributions) = 1);
select expect_error('4k. B ne peut pas modérer', format($$select map_review_contribution(%L, true)$$, (select v from ctx where k='b_create')), 'Droits insuffisants');
select expect_error('4l. B ne peut pas vérifier', $$select map_verify((select id from landmarks limit 1), 'field_visit', 'confirmed')$$, 'Droits insuffisants');
insert into ctx select 'b_edit', map_contribute('edit', (select id from landmarks where name like 'Marché Étoudi'), '{"name":"Marché Étoudi (nouveau nom)","importance":1}');
select t('4m. modification par B : en attente, nom inchangé', (select name from landmarks where name like 'Marché Étoudi%') = 'Marché Étoudi');
insert into ctx select 'b_report', map_contribute('report', (select id from landmarks where name like 'Neptune Etoudi'), '{"note":"La station est fermée depuis un mois"}');
select expect_error('4n. signalement sans explication refusé', $$select map_contribute('report', (select id from landmarks where name like 'Neptune Etoudi'), '{}')$$, 'expliquer');
-- limite quotidienne : B a 3 contributions ; on en ajoute 27 puis la 31e échoue
do $$ begin for i in 1..27 loop perform map_contribute('create', null, jsonb_build_object('name','Repère test '||i,'lat',3.91,'lng',11.52)); end loop; end $$;
select expect_error('4o. 31e contribution du jour refusée', $$select map_contribute('create', null, '{"name":"Trop","lat":3.9,"lng":11.5}')$$, 'Limite quotidienne');

-- 5. Agent C (modère Étoudi)
set role authenticated; select set_config('request.jwt.claim.sub', 'c0000000-0000-0000-0000-00000000000c', false);
select t('5. C voit les contributions d''Étoudi en attente', (select count(*) from landmark_contributions where status = 'pending') >= 3);
select map_review_contribution((select v from ctx where k='b_create'), true, 'Confirmé sur place');
select t('5b. repère créé, publié, « localisé », source citoyen', exists (select 1 from landmarks where name = 'Boulangerie du Carrefour Etoudi' and publication_status = 'published'
   and verification_status = 'located' and source_type = 'user' and created_by = 'b0000000-0000-0000-0000-00000000000b'));
select t('5c. zone Étoudi attribuée automatiquement', (select z.code from landmarks l join geo_zones z on z.id = l.zone_id where l.name = 'Boulangerie du Carrefour Etoudi') = 'etoudi');
select map_review_contribution((select v from ctx where k='b_edit'), true);
select t('5d. modification approuvée : nom changé, importance de B ignorée (non modérateur)', (select name from landmarks where id = (select landmark_id from landmark_contributions where id=(select v from ctx where k='b_edit'))) = 'Marché Étoudi (nouveau nom)'
   and (select importance from landmarks where name like 'Marché Étoudi%') = 4);
select map_review_contribution((select v from ctx where k='b_report'), true);
select t('5e. signalement approuvé : repère « à corriger »', (select publication_status from landmarks where name like 'Neptune Etoudi') = 'to_fix');
select t('5f. repère à corriger absent de la carte publique', not exists (select 1 from map_nearby(3.9177, 11.5285, 1500) where name like 'Neptune Etoudi'));
select map_verify((select id from landmarks where name like 'Neptune Etoudi'), 'field_visit', 'confirmed', 'rouvert');
select t('5g. vérification « confirmé » : republié et vérifié', (select publication_status || '/' || verification_status from landmarks where name like 'Neptune Etoudi') = 'published/verified');
-- création directe par un agent
insert into ctx select 'c_create', map_contribute('create', null, '{"name":"Quincaillerie Mvog Etoudi","lat":3.9181,"lng":11.5270,"category_code":"commerce"}');
select t('5h. création par l''agent : publiée immédiatement, source « agent »', exists (select 1 from landmarks where name = 'Quincaillerie Mvog Etoudi' and publication_status = 'published' and source_type = 'agent'));
insert into ctx select 'c_edit', map_contribute('edit', (select id from landmarks where name = 'Quincaillerie Mvog Etoudi'), '{"importance":5,"access_hint":"face au marché"}');
select t('5i. l''agent peut fixer l''importance', (select importance from landmarks where name = 'Quincaillerie Mvog Etoudi') = 5);
select t('5j. historique des modifications alimenté', (select count(*) from landmark_edit_history where landmark_id = (select id from landmarks where name = 'Quincaillerie Mvog Etoudi')) >= 1);
-- agent hors zone : C ne peut pas agir à Douala
select t('5l. création de C à Douala : mise en attente, pas publiée', (with x as (select map_contribute('create', null, '{"name":"Test Douala Akwa","lat":4.0511,"lng":9.7679}') id)
   select not exists (select 1 from landmarks where name = 'Test Douala Akwa') from x));

-- 6. Agent D (Douala) ne peut pas modérer Étoudi
set role authenticated; select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-00000000000d', false);
select expect_error('6. D ne peut pas vérifier un repère d''Étoudi', $$select map_verify((select id from landmarks where name like 'TOTAL Etoudi'), 'field_visit', 'confirmed')$$, 'Droits insuffisants');
select t('6b. D peut modérer la contribution de Douala', (select count(*) from landmark_contributions where status = 'pending' and proposed_changes->>'name' = 'Test Douala Akwa') = 1);
select map_review_contribution((select id from landmark_contributions where proposed_changes->>'name' = 'Test Douala Akwa'), true);
select t('6c. repère de Douala publié par D', (select z.code from landmarks l join geo_zones z on z.id=l.zone_id where l.name='Test Douala Akwa') = 'douala');

-- 7. Photos
set role authenticated; select set_config('request.jwt.claim.sub', 'b0000000-0000-0000-0000-00000000000b', false);
select expect_error('7. B ne peut pas déposer une photo dans le dossier d''un autre', $$insert into landmark_photos (landmark_id, storage_path, author_id) values ((select id from landmarks where name like 'TOTAL Etoudi'), 'c0000000-0000-0000-0000-00000000000c/x.webp', 'b0000000-0000-0000-0000-00000000000b')$$, 'row-level security');
select expect_error('7b. B ne peut pas se faire passer pour un autre auteur', $$insert into landmark_photos (landmark_id, storage_path, author_id) values ((select id from landmarks where name like 'TOTAL Etoudi'), 'c0000000-0000-0000-0000-00000000000c/x.webp', 'c0000000-0000-0000-0000-00000000000c')$$, 'row-level security');
select expect_error('7c. B ne peut pas s''auto-approuver', $$insert into landmark_photos (landmark_id, storage_path, author_id, verification_status) values ((select id from landmarks where name like 'TOTAL Etoudi'), 'b0000000-0000-0000-0000-00000000000b/x.webp', 'b0000000-0000-0000-0000-00000000000b', 'approved')$$, 'row-level security');
insert into landmark_photos (landmark_id, storage_path, thumbnail_path, author_id) values
  ((select id from landmarks where name like 'TOTAL Etoudi'), 'b0000000-0000-0000-0000-00000000000b/total.webp', 'b0000000-0000-0000-0000-00000000000b/total_t.webp', 'b0000000-0000-0000-0000-00000000000b');
set role anon; select set_config('request.jwt.claim.sub', '', false);
select t('7d. photo en attente invisible au public', (select count(*) from landmark_photos) = 0);
set role authenticated; select set_config('request.jwt.claim.sub', 'c0000000-0000-0000-0000-00000000000c', false);
select map_review_photo((select id from landmark_photos limit 1), true);
set role anon; select set_config('request.jwt.claim.sub', '', false);
select t('7e. photo approuvée visible au public', (select count(*) from landmark_photos) = 1);
select t('7f. map_nearby renvoie la miniature', (select thumbnail_path from map_nearby(3.9177, 11.5285, 1500) where name like 'TOTAL Etoudi') like '%total_t.webp');

-- 8. Lieux enregistrés et signalements
set role authenticated; select set_config('request.jwt.claim.sub', 'b0000000-0000-0000-0000-00000000000b', false);
insert into saved_places (user_id, landmark_id) values ('b0000000-0000-0000-0000-00000000000b', (select id from landmarks limit 1));
select expect_error('8. B ne peut pas enregistrer un lieu au nom d''un autre', $$insert into saved_places (user_id, landmark_id) values ('c0000000-0000-0000-0000-00000000000c', (select id from landmarks limit 1))$$, 'row-level security');
insert into navigation_reports (user_id, report_type, lat, lng, description) values ('b0000000-0000-0000-0000-00000000000b', 'missing_road', 3.91, 11.52, 'Route absente de la carte');
select t('8b. B voit uniquement ses signalements', (select count(*) from navigation_reports) = 1);
select expect_error('8c. signalement avec type invalide refusé', $$insert into navigation_reports (user_id, report_type) values ('b0000000-0000-0000-0000-00000000000b', 'pirate')$$, 'check');

-- 9. Droits de fonctions internes
select expect_error('9. map__apply non appelable par un utilisateur', $$select map__apply(gen_random_uuid(), null)$$, 'permission denied');
select expect_error('9b. les fonctions de déclencheur ne sont pas appelables', $$select landmarks_biu()$$, 'permission denied');

-- 10. Admin
set role authenticated; select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-00000000000a', false);
select t('10. admin voit tout (repères non publiés inclus)', (select count(*) from landmarks) >= (select count(*) from landmarks where publication_status = 'published'));
select t('10b. admin voit les droits des cartographes', (select count(*) from mapper_permissions) = 2);

-- 11. Rejouer l'import ne crée aucun doublon
reset role;
select count(*) as avant from landmarks where source_type = 'osm' \gset
\i /tmp/seed_only.sql
select t('11. import rejouable sans doublon', (select count(*) from landmarks where source_type = 'osm') = :avant);
insert into landmark_aliases (landmark_id, alias, alias_type) values ((select id from landmarks where name like 'Marché Étoudi%'), 'Marché de Mvog-Ada', 'popular');
set role anon; select set_config('request.jwt.claim.sub', '', false);
select t('11b. recherche par alias (sans accent)', exists (select 1 from map_search('marche de mvog') where matched_alias = 'Marché de Mvog-Ada'));
\echo === FIN DES TESTS 0024 ===
