\set ON_ERROR_STOP on
create or replace function t(label text, ok boolean) returns void language plpgsql as $$
begin if not ok then raise exception 'ÉCHEC : %', label; else raise notice 'OK   : %', label; end if; end $$;
grant execute on function t(text, boolean) to anon;
set role anon;
select t('25.1 « etoudi » trouve Étoudi', exists (select 1 from map_search_zones('etoudi') where name = 'Étoudi' and kind = 'pilot'));
select t('25.2 « ÉTOUDI » (accents, casse) trouve Étoudi', exists (select 1 from map_search_zones('ÉTOUDI')));
select t('25.3 « yaounde » trouve la ville', exists (select 1 from map_search_zones('yaounde') where code = 'yaounde' and kind = 'city'));
select t('25.4 le pays n''est pas proposé', not exists (select 1 from map_search_zones('cameroun')));
select t('25.5 requête courte : rien', (select count(*) from map_search_zones('e')) = 0);
select t('25.6 % ne renvoie pas tout', (select count(*) from map_search_zones('%%')) = 0);
select t('25.7 coordonnées renvoyées', (select center_lat from map_search_zones('etoudi') limit 1) between 3.9 and 3.93);
select t('25.8 faute légère tolérée (etoudy)', exists (select 1 from map_search_zones('etoudy')));
\echo === FIN TESTS 0025 ===
