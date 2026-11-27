# DabbyMap — Lot 0 + base des repères + écrans (mise à jour du 27/11/2026)

Suivez les étapes dans l'ordre, sans en sauter. Durée : environ 40 minutes.
**Tous les fichiers cités ci-dessous sont dans le ZIP, avec le même chemin.** Il n'y a rien d'autre à chercher ailleurs.

## ÉTAPE 0 — Vérification avant de commencer (2 minutes)
Ce paquet suppose que la mise à jour « DabbyMarket 2.0 » est déjà en ligne.
1. Ouvrez votre dépôt GitHub → dossier `supabase` → `migrations`.
2. Vous devez voir le fichier **`0023_securite_paiement.sql`**.
   - Oui → continuez.
   - Non → **arrêtez-vous** et écrivez-moi « il manque la 2.0 ». Je vous prépare un paquet complet. N'installez rien de ce ZIP avant.

## Ce que ce paquet fait
- **Carte** : fonds CARTO / OpenStreetMap / Esri / OpenTopoMap retirés, remplacés par 2 fonds OpenFreeMap (**Plan** et **Rues**). Satellite et Relief disparaissent.
- **Repères DabbyMap** : bouton « 📍 Repères » (affiche/masque), icônes par type de lieu, noms visibles en zoomant, fiche d'un repère (nom, type, statut de vérification, indication d'accès, photo), recherche de repères dans la barre de recherche de la carte.
- **Contribuer** : bouton « ＋ Ajouter un repère », « Signaler » et « Corriger » sur chaque repère (connexion requise). Les propositions des citoyens sont **validées par vos agents** avant publication.
- **Espace agent** (`/agent-carte`) : file « À valider », liste « À vérifier sur place », vérification (confirmé / déplacé / fermé) et photo prise sur place.
- **Base de données** : migration `0024` (PostGIS, zones, catégories, repères, droits, photos) + **52 repères d'Étoudi** issus d'OpenStreetMap, marqués « non vérifié ».
- **Itinéraires** : plus d'appel au serveur public d'OSRM. Tant qu'aucun moteur n'est branché, la carte trace une ligne **pointillée « approximative »**.

## ÉTAPE 1 — Supabase : exécuter la migration
1. https://supabase.com/dashboard → votre projet → **SQL Editor** → **New query**.
2. Ouvrez `supabase/migrations/0024_dabbymap.sql` du ZIP, copiez **tout**, collez, cliquez **Run**.
3. Attendez « Success ». Puis nouvelle requête :
   ```sql
   select (select count(*) from landmarks) as reperes,
          (select count(*) from geo_zones) as zones,
          (select count(*) from landmark_categories) as categories;
   ```
   Attendu : `52 | 4 | 10`.
- En cas d'erreur : **ne relancez pas**, copiez le message et envoyez-le-moi.

## ÉTAPE 2 — GitHub : déposer les fichiers
Pour chaque ligne : GitHub → votre dépôt → ouvrez le dossier indiqué → **Add file → Upload files** → glissez le fichier du ZIP → **Commit changes**. (Si le dossier n'existe pas, créez-le en glissant le fichier avec son dossier.)

| # | Fichier (chemin exact) | Action |
|---|---|---|
| 1 | `package.json` | remplacer |
| 2 | `package-lock.json` | remplacer |
| 3 | `src/App.tsx` | remplacer |
| 4 | `src/styles.css` | remplacer |
| 5 | `src/pages/Carte.tsx` | remplacer |
| 6 | `src/pages/AgentCarte.tsx` | **nouveau** |
| 7 | `src/components/map-view.tsx` | remplacer |
| 8 | `src/components/landmark-sheet.tsx` | **nouveau** |
| 9 | `src/components/landmark-add-sheet.tsx` | **nouveau** |
| 10 | `src/lib/routing.ts` | remplacer |
| 11 | `src/lib/availability-i18n.ts` | remplacer |
| 12 | `src/lib/dabbymap.ts` | **nouveau** |
| 13 | `src/lib/dabbymap-i18n.ts` | **nouveau** |
| 14 | `supabase/functions/route/index.ts` | **nouveau** (facultatif aujourd'hui) |
| 15 | `supabase/migrations/0024_dabbymap.sql` | **nouveau** (archivage) |
| 16 | `supabase/rollbacks/ROLLBACK_0024.sql` | **nouveau** (archivage) |
| 17 | `supabase/tests/test_0024.sql` | **nouveau** (archivage) |
| 18 | `supabase/seed/reperes_etoudi.csv` | **nouveau** (archivage) |
| 19 | `supabase/seed/modele_collecte_agents.csv` | **nouveau** (archivage) |
| 20 | `GUIDE_LOT0_DABBYMAP.md` | **nouveau** (ce guide) |

Les lignes 1 à 13 sont **obligatoires** : si une seule manque, Netlify affichera une erreur rouge.

## ÉTAPE 3 — Netlify
1. Netlify → votre site → **Deploys** : attendez **Published** (vert). Si rouge : ouvrez le déploiement, copiez les 20 dernières lignes du journal, envoyez-les-moi.
2. Site configuration → Environment variables : supprimez `VITE_CARTO_API_KEY` si elle existe (plus utilisée ; l'échéance CARTO du 1er décembre ne vous concerne plus).

## ÉTAPE 4 — Donner des droits à vos agents (SQL Editor, une fois par agent)
Chaque agent crée d'abord un compte DabbyMarket. Remplacez le numéro (format `+237…`, identique à son compte) :
```sql
insert into mapper_permissions (user_id, permission_code, zone_id)
select id, 'moderate', (select id from geo_zones where code = 'etoudi')
from profiles where phone = '+237600000000';
```
Vérifiez : `select count(*) from mapper_permissions;` augmente de 1. Ce droit n'est valable **qu'à Étoudi**.
Retrait : `update mapper_permissions set is_active = false where user_id = (select id from profiles where phone = '+237600000000');`
(Le compte administrateur a automatiquement tous les droits.)

## ÉTAPE 5 — Contrôle sur le téléphone (rechargez la page Carte)
1. Fond de carte visible ; en bas : « © contributeurs OpenStreetMap · fond de carte OpenFreeMap ».
2. Panneau de droite : **Plan / Rues**, puis **📍 Repères**, **＋ Ajouter un repère** et, pour un agent, **🛡️ Espace agent**.
3. Zoomez sur Étoudi (zoom ≥ 13) : des icônes apparaissent ; plus vous zoomez, plus il y en a. Touchez-en une : la fiche s'ouvre.
4. Compte **citoyen** : « Signaler » → message envoyé. « ＋ Ajouter un repère » → « sera publié après validation ».
5. Compte **agent** : ouvrez 🛡️ Espace agent → onglet « À valider » : validez/refusez. Onglet « À vérifier sur place » : 52 repères à confirmer.
6. Agent sur le terrain : touchez un repère → **Ajouter une photo** (la photo est réduite automatiquement sur le téléphone) → **Vérifier sur place**.

## À SAVOIR (risques)
- OpenFreeMap n'a **aucune garantie de disponibilité** ; en cas de panne, la carte reste utilisable sans fond.
- Les 52 repères viennent d'OpenStreetMap et peuvent être faux : à confirmer sur place. Ne retirez pas la mention OpenStreetMap (licence ODbL).
- Les agents peuvent publier directement dans leur zone : choisissez-les avec soin.
- Les photos sont limitées à 1 Mo ; seuls les agents peuvent en ajouter pour l'instant.
- Itinéraires réels : il faut un moteur compatible OSRM que vous hébergez (je vous guiderai) ; n'utilisez jamais `router.project-osrm.org`.
- Les tests de la migration ont été faits avec un PostGIS simulé : le premier vrai essai est l'étape 1.

## Retour arrière
- Site : Netlify → Deploys → un déploiement précédent → **Publish deploy**.
- Base : `supabase/rollbacks/ROLLBACK_0024.sql` (supprime repères et contributions : exportez avant).
