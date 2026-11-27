# DabbyMap — Lot 0 (conformité) + Lot 2 (base de données des repères)

Suivez les étapes dans l'ordre. Ne sautez rien. Durée : environ 30 minutes.

## Ce que ce paquet change
- **Fonds de carte** : CARTO, OpenStreetMap (tuiles officielles), Esri et OpenTopoMap sont retirés. Il reste 2 fonds, **Plan** et **Rues**, fournis par OpenFreeMap (gratuit, sans clé). Les boutons Satellite et Relief disparaissent.
- **Itinéraires** : l'application n'appelle plus le serveur public d'OSRM. Elle appelle votre fonction Edge `route`. **Tant que vous n'avez pas branché un moteur d'itinéraires, l'application trace une ligne directe marquée « approximative »**, comme avant en cas de panne.
- **Base de données** : migration `0024` = PostGIS, zones, catégories, repères, contributions, droits des cartographes, photos, + **52 repères d'Étoudi** (OpenStreetMap, statut « non vérifié »).
- Rien n'est supprimé dans vos données existantes (migration uniquement additive).

## ÉTAPE 1 — Supabase : exécuter la migration
1. Ouvrez https://supabase.com/dashboard → votre projet DabbyMarket.
2. Menu de gauche : **SQL Editor** → **New query**.
3. Ouvrez le fichier `supabase/migrations/0024_dabbymap.sql` (dans le ZIP), **copiez tout son contenu**, collez-le dans l'éditeur.
4. Cliquez **Run**. Attendez « Success. No rows returned ».
5. Vérification : nouvelle requête, collez puis Run :
   ```sql
   select (select count(*) from landmarks) as reperes,
          (select count(*) from geo_zones) as zones,
          (select count(*) from landmark_categories) as categories;
   ```
   Résultat attendu : `52 | 4 | 10`.
- Si vous voyez une erreur, **ne relancez pas** : copiez le message et envoyez-le-moi.

## ÉTAPE 2 — GitHub : déposer les fichiers
Dans le ZIP, les fichiers gardent leurs chemins. Pour chacun : GitHub → votre dépôt → ouvrez le dossier → **Add file → Upload files** (ou le crayon pour les modifier) → remplacez → **Commit changes**.
Fichiers à remplacer/ajouter :
1. `package.json` et `package-lock.json` (racine) — **les deux**, sinon Netlify échoue.
2. `src/components/map-view.tsx`
3. `src/pages/Carte.tsx`
4. `src/lib/routing.ts`
5. `src/lib/availability-i18n.ts`
6. `src/styles.css`
7. `supabase/functions/route/index.ts` (nouveau)
8. `supabase/migrations/0024_dabbymap.sql`, `supabase/rollbacks/ROLLBACK_0024.sql`, `supabase/tests/test_0024.sql`, `supabase/seed/*.csv` (archivage, optionnels pour le site)
9. `GUIDE_LOT0_DABBYMAP.md`, `GUIDE_ITINERAIRE_AUTONOME.md`, `README_MISE_A_JOUR_CARTE.md`

## ÉTAPE 3 — Netlify : vérifier le déploiement
1. Netlify → votre site → **Deploys**. Un déploiement démarre seul après votre commit.
2. Attendez **Published** (vert). S'il est rouge : ouvrez-le, copiez les 20 dernières lignes du journal et envoyez-les-moi.
3. **Supprimez la clé CARTO** : Site configuration → Environment variables → supprimez `VITE_CARTO_API_KEY` si elle existe (elle n'est plus utilisée ; l'échéance CARTO du 1er décembre ne vous concerne plus).

## ÉTAPE 4 — Contrôle sur le téléphone
1. Ouvrez DabbyMarket → **Carte** (rechargez la page).
2. Le fond doit s'afficher (Plan par défaut ou Rues). En bas à gauche : « © contributeurs OpenStreetMap · fond de carte OpenFreeMap ».
3. Le panneau de droite n'a plus que **Plan** et **Rues**.
4. Demandez un itinéraire vers une boutique : une ligne **pointillée grise « approximative »** est normale pour l'instant.

## ÉTAPE 5 — Donner des droits à vos agents d'Étoudi
Chaque agent doit avoir un compte DabbyMarket. Dans **SQL Editor**, remplacez le numéro (format `+237…`, identique à celui de son compte) puis Run, une fois par agent :
```sql
insert into mapper_permissions (user_id, permission_code, zone_id)
select id, 'moderate', (select id from geo_zones where code = 'etoudi')
from profiles where phone = '+237600000000';
```
Vérification : `select count(*) from mapper_permissions;` → augmente de 1. « moderate » permet de créer, modifier, vérifier et valider **uniquement à Étoudi**.
Pour retirer un droit : `update mapper_permissions set is_active = false where user_id = (select id from profiles where phone = '+237600000000');`

## À SAVOIR (risques)
- **OpenFreeMap n'a aucune garantie de disponibilité.** Si le fond tombe en panne, la carte reste utilisable mais sans fond. Prévu : passage à votre propre hébergement (PMTiles) quand le trafic le justifie.
- **Itinéraires réels** : il faut un moteur compatible OSRM que vous hébergez (un petit serveur) ; ensuite `supabase secrets set ROUTING_BASE_URL=https://…` et `supabase functions deploy route`. Je vous guiderai quand vous aurez décidé ; ne pointez **jamais** vers `router.project-osrm.org`.
- Les 52 repères viennent d'OpenStreetMap et peuvent contenir des erreurs : vos agents doivent les confirmer sur place. La licence ODbL impose la mention affichée en bas de la carte — ne la retirez pas.
- Le fond sombre est obtenu par un filtre de couleur sur le fond clair : il est correct mais pas parfait.
- Le déploiement de la fonction Edge `route` est facultatif aujourd'hui.

## Retour arrière
- Site : Netlify → Deploys → un déploiement précédent → **Publish deploy**.
- Base : `supabase/rollbacks/ROLLBACK_0024.sql` (supprime les repères et contributions — exportez avant).
