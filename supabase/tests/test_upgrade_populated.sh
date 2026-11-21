#!/bin/bash
# Test de montée de version sur base peuplée, puis retour arrière complet, puis remontée.
S=/tmp/claude-0/-home-claude/807d12e6-fc0d-5a46-afeb-467b3ddec7de/scratchpad
P="psql -h /var/tmp/dmpg -p 5433 -U postgres -d dmtest -v ON_ERROR_STOP=1 -q"
bash $S/harness/replay.sh 19 >/dev/null 2>&1
bash $S/harness/snap.sh $S/diff/before
$P <<'SQL' >/dev/null
insert into auth.users (id, phone, raw_user_meta_data)
select ('dddddddd-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid, '+2376' || lpad(n::text, 8, '0'), jsonb_build_object('name','P'||n,'phone','+2376'||lpad(n::text,8,'0')) from generate_series(300, 312) n;
update profiles set created_at = now() - interval '9 days', pepites_balance = 300;
-- 3 boutiques : A = 7 articles (dont 1 boosté), B = 2 articles, C = 4 articles dont 1 en rupture
insert into shops (id, owner_id, name, category, lat, lng, city, neighborhood, shop_type) values
 ('eeeeeeee-0000-0000-0000-000000000301', 'dddddddd-0000-0000-0000-000000000300', 'Boutique A', 'maison', 3.87, 11.5, 'Yaoundé', 'Mokolo', 'physical'),
 ('eeeeeeee-0000-0000-0000-000000000302', 'dddddddd-0000-0000-0000-000000000301', 'Boutique B', 'mode', 3.86, 11.4, 'Yaoundé', 'Bastos', 'physical'),
 ('eeeeeeee-0000-0000-0000-000000000303', 'dddddddd-0000-0000-0000-000000000302', 'Boutique C', 'maison', 3.85, 11.6, 'Yaoundé', 'Mvog', 'physical');
insert into products (shop_id, name, price_xaf, category, condition, images, availability_status, created_at)
select 'eeeeeeee-0000-0000-0000-000000000301', 'Article A' || i, 1000 * i, 'maison', 'Neuf', '{x}', 'available', now() - (i || ' days')::interval from generate_series(1, 7) i;
insert into products (shop_id, name, price_xaf, category, condition, images) select 'eeeeeeee-0000-0000-0000-000000000302', 'Robe ' || i, 5000, 'mode', 'Neuf', '{x}' from generate_series(1, 2) i;
insert into products (shop_id, name, price_xaf, category, condition, images, availability_status) select 'eeeeeeee-0000-0000-0000-000000000303', 'Chaise ' || i, 8000, 'maison', 'Neuf', '{x}', case when i = 4 then 'out' else 'available' end from generate_series(1, 4) i;
update products set boosted_until = now() + interval '2 days' where name = 'Article A7';
-- données de recherche existantes, dont une requête de santé
insert into search_demand_log (user_id, query_norm, day) values
 ('dddddddd-0000-0000-0000-000000000303', 'marteau', current_date), ('dddddddd-0000-0000-0000-000000000304', 'amoxicilline', current_date), ('dddddddd-0000-0000-0000-000000000305', 'test de grossesse', current_date);
SQL
SQL_OUT=$($P -tA <<'SQL'
select 'avant: produits=' || count(*) || ' actifs=' || count(*) filter (where is_active) from products;
SQL
)
echo "$SQL_OUT"
for f in 0020_vitrine_catalogue 0021_confiance_notes_exactitude 0022_sante; do $P -f $S/out/$f.sql >/dev/null 2>&1 || { echo "ÉCHEC montée $f"; exit 1; }; done
$P -tA <<'SQL'
select 'après: produits=' || count(*) || ' actifs=' || count(*) filter (where is_active) || ' en vitrine=' || count(*) filter (where is_showcased) from products;
select 'vitrine A=' || count(*) || ' (le boosté en fait partie: ' || bool_or(boosted_until is not null) || ')' from products where is_showcased and shop_id = 'eeeeeeee-0000-0000-0000-000000000301';
select 'vitrine B=' || count(*) from products where is_showcased and shop_id = 'eeeeeeee-0000-0000-0000-000000000302';
select 'vitrine C=' || count(*) from products where is_showcased and shop_id = 'eeeeeeee-0000-0000-0000-000000000303';
select 'recherche: tout le catalogue trouvable=' || ((select count(*) from catalog_search(p_limit => 100)) = (select count(*) from products where is_active));
select 'rupture trouvable=' || exists (select 1 from catalog_search('chaise') where effective_status = 'out');
select 'journal de demande conservé=' || (select string_agg(query_norm, ',') from search_demand_log);
select 'tâche de facturation supprimée=' || not exists (select 1 from cron.jobs where name = 'dabbymarket-bill-quota-overage');
SQL
# retour arrière complet
for f in ROLLBACK_0022 ROLLBACK_0021 ROLLBACK_0020; do $P -f $S/out/$f.sql >/dev/null 2>$S/diff/rb.err || { echo "ÉCHEC $f"; cat $S/diff/rb.err | head -5; exit 1; }; done
bash $S/harness/snap.sh $S/diff/after
echo "écart de schéma après retour arrière complet (vide = identique) :"; diff $S/diff/before $S/diff/after
echo "produits après retour arrière: $($P -tA -c 'select count(*) from products')"
# remontée
for f in 0020_vitrine_catalogue 0021_confiance_notes_exactitude 0022_sante; do $P -f $S/out/$f.sql >/dev/null 2>&1 || { echo "ÉCHEC remontée $f"; exit 1; }; done
echo "remontée OK: vitrine A=$($P -tA -c "select count(*) from products where is_showcased and shop_id='eeeeeeee-0000-0000-0000-000000000301'")"
