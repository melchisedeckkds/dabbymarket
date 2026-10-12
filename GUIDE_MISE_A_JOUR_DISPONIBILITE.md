# Guide de mise à jour — Dabby Disponibilité

Ce guide explique, pas à pas, comment appliquer la mise à jour **Dabby Disponibilité** à votre dépôt GitHub `dabbymarket` et à votre projet Supabase.

- **Durée estimée** : 30 à 45 minutes.
- **Nouvelle dépendance npm** : aucune (`package.json` et `package-lock.json` ne changent pas).
- **Fonction Edge** : aucune modification (`la-guerite-chat` reste telle quelle).
- **Contenu** : 31 fichiers (16 modifiés, 15 nouveaux) + 1 script de retour arrière.

> ⚠️ **Règle n° 1 : la base de données d'abord, le code ensuite.** Le nouveau code interroge de nouvelles colonnes et fonctions SQL. Si vous déployez le code avant les migrations, la fiche boutique et la carte retomberont sur leur comportement d'avant (les lectures sont tolérantes), mais les nouvelles fonctions ne marcheront pas.

---

## 0. Avant de commencer

1. **Sauvegarde Supabase** : *Dashboard → Database → Backups* (ou `pg_dump`). Notez l'heure.
2. **Branche Git dédiée** (jamais directement sur `main`) :
   ```bash
   git checkout main && git pull
   git checkout -b feature/dabby-disponibilite
   ```
3. Vérifiez que l'extension **pg_cron** est active (elle l'est déjà si la migration 0012 est passée) : *Database → Extensions → pg_cron*.

---

## 1. Copier les fichiers dans le dépôt

Le dossier de cette archive reproduit **exactement** l'arborescence du dépôt. Copiez son contenu à la racine du dépôt en acceptant le remplacement des fichiers existants :

```bash
# depuis le dossier du dépôt, en supposant l'archive décompressée à côté :
cp -R ../dabby-disponibilite-update/* .
git status        # doit lister 16 fichiers modifiés et 15 nouveaux (+ 3 documents)
```

### Fichiers NOUVEAUX (15)

| Fichier | Rôle |
|---|---|
| `supabase/migrations/0017_security_hardening.sql` | Correctif de sécurité (voir §2.1 — **à lire**) |
| `supabase/migrations/0018_dabby_disponibilite.sql` | Module Disponibilité (tables, règles, RPC) |
| `src/lib/availability.ts` | Types, couleurs, fraîcheur, échappement HTML |
| `src/lib/availability-i18n.ts` | Textes FR/EN du module |
| `src/lib/availability-queries.ts` | Tous les accès aux données du module |
| `src/components/availability-badge.tsx` | Pastille d'état, fraîcheur, fiabilité |
| `src/components/availability-report-sheet.tsx` | Signalement communautaire |
| `src/components/alert-button.tsx` | Alertes « M'avertir… » |
| `src/components/product-reviews.tsx` | Notes et avis par article |
| `src/components/shop-availability-catalog.tsx` | Catalogue de disponibilité d'une boutique |
| `src/components/trouvailles-strip.tsx` | Bandeau « Les Trouvailles » |
| `src/components/notification-center.tsx` | Cloche + écoute temps réel |
| `src/components/admin-disponibilite.tsx` | Onglet Admin « Disponibilité » |
| `src/pages/Disponibilite.tsx` | Espace marchand `/disponibilite` |
| `src/pages/Notifications.tsx` | Notifications, alertes, préférences `/notifications` |

### Fichiers MODIFIÉS (16) — remplacez-les entièrement

| Fichier | Nature de la modification | Lignes touchées* |
|---|---|---|
| `src/App.tsx` | 2 routes, écoute des notifications | 12 |
| `src/components/map-view.tsx` | Bulles produit, point d'état, anti-surcharge, **échappement HTML (correctif XSS)**, cache d'icônes | 109 |
| `src/components/la-guerite-chat.tsx` | Disponibilité réelle dans le prompt, liens internes | 43 |
| `src/components/report-dialog.tsx` | Accepte le type `product_review` | 2 |
| `src/components/top-bar.tsx` | Cloche de notifications (la messagerie passe à l'icône message) | 6 |
| `src/lib/queries.ts` | 1 type étendu (`product_review`) | 2 |
| `src/pages/Admin.tsx` | Onglet « Disponibilité » | 8 |
| `src/pages/Boutique.tsx` | Catalogue par état de disponibilité | 14 |
| `src/pages/Carte.tsx` | Disponibilité sur la carte, filtres, alerte ; **correctif `owner_id`** | 201 |
| `src/pages/Compte.tsx` | Liens « Ma disponibilité » et « Notifications » | 8 |
| `src/pages/CreerBoutique.tsx` | Catégories administrables | 7 |
| `src/pages/Marche.tsx` | Recherche de disponibilité, Trouvailles, catégories dynamiques | 53 |
| `src/pages/Produit.tsx` | Bloc disponibilité + avis par article | 37 |
| `src/pages/Publier.tsx` | Catégories administrables | 7 |
| `src/pages/PublierFlash.tsx` | Catégories administrables | 7 |
| `src/styles.css` | Styles de la bulle produit (ajout en fin de fichier) | 71 |

\* Lignes ajoutées ou supprimées par rapport au dépôt d'origine (`diff`).

---

## 2. Appliquer les migrations Supabase

*Dashboard → SQL Editor → New query.* Exécutez **dans cet ordre**, une migration à la fois (copier-coller le contenu complet du fichier, puis **Run**).

### 2.1 — `0017_security_hardening.sql` (sécurité, **prioritaire**)

**Pourquoi c'est important.** La migration d'origine `0001_init.sql` tente de protéger le solde de Pépites avec `revoke update (pepites_balance) …`. Sur Supabase, le rôle `authenticated` possède déjà le droit `UPDATE` sur **toute la table** ; retirer ce droit pour une seule colonne n'a aucun effet. Dans une base de test qui rejoue vos migrations 0001 → 0016, un utilisateur connecté a pu exécuter :

```sql
update profiles set is_admin = true, pepites_balance = 999999 where id = auth.uid();
```

…et la requête a **réussi**. Il en va de même pour `shops.verified` (auto-certification) et `products.boosted_until` (boost gratuit).

> Cette reproduction a été faite sur PostgreSQL avec les droits par défaut de Supabase **simulés**, pas sur votre projet réel. **Confirmez-le sur votre projet** avec la requête de contrôle ci-dessous (§2.3) *avant* d'appliquer 0017, pour savoir si la faille était exploitable chez vous.

**Ce que fait 0017** : trois déclencheurs refusent toute modification de `is_admin`, `pepites_balance`, `is_blocked`, `welcome_bonus_*`, `phone` (profil), `verified`, `is_blocked`, `owner_id` (boutique) et `boosted_until` (article) lorsqu'elle vient d'un client. Les fonctions serveur existantes (achat de boost, recharge, modération…) et l'éditeur SQL continuent de fonctionner. Test réalisé : 4 attaques refusées, 3 opérations légitimes (changement de nom, modification de boutique, achat de boost) préservées.

### 2.2 — `0018_dabby_disponibilite.sql`

C'est une migration **additive et rejouable** : aucune table existante n'est supprimée, aucune donnée n'est modifiée. Tous vos articles actuels restent des « vitrines » dont la disponibilité est « non renseignée » (jamais présentés comme disponibles).

### 2.3 — Contrôles après migration

```sql
-- 1) Les 3 déclencheurs de sécurité sont en place (attendu : 3 lignes)
select tgname from pg_trigger where tgname like 'trg_guard_%';

-- 2) Les nouvelles tables existent (attendu : 7 lignes)
select table_name from information_schema.tables
 where table_schema = 'public' and table_name in
 ('product_categories','catalog_items','availability_events','availability_reports','product_reviews','notifications','availability_alerts');

-- 3) Les 12 catégories et 3 produits de référence (gaz) sont chargés
select count(*) from product_categories;      -- attendu : 12
select count(*) from catalog_items;           -- attendu : 3

-- 4) Vos anciens articles sont intacts et en « non renseigné »
select availability_status, listing_kind, count(*) from products group by 1, 2;   -- attendu : unknown | showcase | <votre total>

-- 5) Tâches planifiées (attendu : 2 lignes)
select jobname, schedule from cron.job where jobname like 'dabbymarket-%';

-- 6) Realtime : la table notifications est publiée (attendu : 1 ligne)
select tablename from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'notifications';
```

**Si le contrôle 6 ne renvoie rien** : *Database → Replication → supabase_realtime → ajoutez la table `notifications`* (ou exécutez `alter publication supabase_realtime add table notifications;`). Sans cela, les notifications apparaissent quand même dans le centre de notifications, mais pas en direct.

**Test de la faille (à faire AVANT d'appliquer 0017, si vous voulez savoir si vous étiez exposé)** — connectez-vous à l'application avec un compte de test, puis, dans la console du navigateur de l'application ouverte :

```js
const { supabase } = await import('/src/lib/supabase.ts'); // en dev (npm run dev) uniquement
await supabase.from('profiles').update({ pepites_balance: 12345 }).eq('id', (await supabase.auth.getUser()).data.user.id);
```
Une réponse sans erreur signifie que la faille est exploitable sur votre projet ; après 0017, la même commande doit renvoyer l'erreur « Modification non autorisée ». Si vous avez déjà des comptes avec des soldes ou des droits admin suspects : `select id, name, is_admin, pepites_balance from profiles where is_admin or pepites_balance > 0 order by pepites_balance desc;`.

---

## 3. Vérifier et déployer le code

```bash
npm install                 # aucune nouvelle dépendance, mais sans risque
npx tsc -b                  # doit se terminer sans erreur
npm run lint                # 28 avertissements préexistants, 0 erreur (inchangé par cette mise à jour)
npm run build               # doit se terminer par « ✓ built »
```

Puis :
```bash
git add -A
git commit -m "feat: Dabby Disponibilité (disponibilité géolocalisée, avis par article, notifications) + durcissement sécurité"
git push -u origin feature/dabby-disponibilite
```
Ouvrez une *Pull Request*. Si votre site Netlify génère des *Deploy Previews*, testez dessus (§5) **avant** de fusionner dans `main`.

---

## 4. Configuration initiale (après déploiement)

Connectez-vous avec votre compte administrateur → **Admin → onglet « Disponibilité »**.

1. **Catégories** : 12 sont préchargées (`mode`, `electronique`, `alimentation`, `beaute`, `maison`, `services` — vos 6 existantes, mêmes identifiants — plus `energie`, `gaz-domestique`, `construction`, `pieces-auto`, `agriculture`, `sante`). Ajustez les durées de validité d'une confirmation (gaz : 8 h, alimentation : 12 h, mode/électronique : 72 h).
   - `sante` est **réglementée et fermée** aux articles de disponibilité (le système refuse d'y créer des articles tant que vous ne l'ouvrez pas explicitement).
   - `services` est également fermée aux articles de disponibilité (non pertinent).
2. **Catalogue de référence** : 3 bouteilles de gaz (6 kg, 12,5 kg, 38 kg) sont préchargées. Ajoutez vos autres produits comparables.
3. **Règles** : 14 paramètres modifiables sans redéploiement (voir `README_DISPONIBILITE.md`, §4). Deux méritent une décision de votre part avant le lancement (§7 ci-dessous).
4. **Pilote** : demandez à 3-5 commerçants de gaz d'un même quartier (Etoudi, par exemple) d'ouvrir **Compte → Ma disponibilité**, d'ajouter leurs bouteilles via le catalogue et de déclarer leur stock.

---

## 5. Recette manuelle (à faire sur un compte de test)

| # | Test | Résultat attendu |
|---|---|---|
| 1 | Compte → Ma disponibilité → Ajouter « Bouteille de gaz 12,5 kg », 6 500, Disponible | Article créé, badge vert « Disponible », « déclaré il y a … » |
| 2 | Passer l'article en « Rupture de stock » puis « Stock limité » | Le badge change, aucun rechargement |
| 3 | Boutique sur la carte, zoom ≥ 14 | Bulle au-dessus du marqueur : nom, état, prix, fraîcheur |
| 4 | Carte → rechercher « gaz 12,5 kg » | Boutiques correspondantes en tête, produit recherché dans la bulle |
| 5 | Filtres « Disponible uniquement », « Confirmé récemment », prix max | La liste se restreint |
| 6 | Recherche d'un produit introuvable (« xyz ») | Message « Aucun commerce… » + bouton « M'avertir… » |
| 7 | Créer l'alerte, puis, avec le compte marchand, passer l'article à « Disponible » | Notification reçue (cloche + bandeau en direct) |
| 8 | Fiche boutique | Articles regroupés : Disponibles / Stock limité / À reconfirmer / Indisponibles |
| 9 | Fiche article → « Signaler » → « Produit épuisé » (2 comptes anciens, ≥ 12 h) | Statut « Information contestée » |
| 10 | Le marchand appuie sur « Toujours là » | Le statut contesté disparaît |
| 11 | Fiche article → noter 4★ + commentaire ; modifier la note | Une seule note par utilisateur, modifiable |
| 12 | Commentaire contenant `https://…` | Refusé (« Les liens ne sont pas autorisés ») |
| 13 | Le marchand tente de noter son propre article | Refusé |
| 14 | Compte < 12 h d'ancienneté : noter ou signaler | Refusé avec message clair |
| 15 | Signaler un avis (3 comptes distincts) | L'avis est masqué automatiquement, visible dans Admin → Disponibilité → Avis masqués |
| 16 | Compte → Notifications → Préférences | Cases à cocher, plafond quotidien |
| 17 | Marché | Encart « Trouvez un produit disponible », bandeau « Les Trouvailles » (après ≥ 2 avis sur un article) |
| 18 | « La Guérite » : « Où trouver du gaz ? » | Réponse fondée sur la base, avec fraîcheur ; jamais de stock inventé |
| 19 | Messagerie, Pépites, boosts, Ventes Flash, création de boutique | Comportement identique à avant la mise à jour |
| 20 | Écran de téléphone (≈ 380 px) | Bulle lisible, aucune superposition de bulles |

> **Ce qui a été testé et ce qui ne l'a pas été** : voir `README_DISPONIBILITE.md`, §9. En bref, la base de données (règles métier, sécurité, performances, migration, retour arrière) a été exécutée et vérifiée ; le front-end a été **compilé et analysé** (tsc, build, oxlint) mais **pas exécuté dans un navigateur** — cette recette est donc indispensable.

---

## 6. Retour arrière

### Code
```bash
git revert <hash-du-commit>      # ou : ne pas fusionner la PR
```
L'ancien code ignore simplement les nouvelles colonnes : il continue de fonctionner sur la base migrée.

### Base de données
Le script `supabase/rollback/ROLLBACK_0018_0017.sql` retire le module Disponibilité (et, en option commentée, le durcissement 0017, dont le maintien est **recommandé**).

⚠️ **Il supprime les données du module** : articles « disponibilité » (`listing_kind = 'stock'`), historique, avis par article, signalements, notifications, alertes. Avant de l'exécuter, exportez ce que vous voulez garder :

```sql
copy (select * from product_reviews) to stdout with csv header;   -- ou via l'interface « Export CSV » du Table Editor
```
Vos boutiques, articles « vitrine », messages, avis boutique, Pépites, abonnements et Ventes Flash ne sont **pas** touchés.

Le script a été testé : après exécution, le schéma public est **identique** à celui d'une base 0001 → 0017 (comparaison colonne par colonne, tables, fonctions, déclencheurs), et la migration 0018 peut être ré-appliquée ensuite.

> Ne copiez pas le script dans `supabase/migrations/` : il serait exécuté automatiquement par `supabase db push`. Il est volontairement rangé dans `supabase/rollback/`.

---

## 7. Décisions à valider avant le lancement

1. **Facturation des articles « disponibilité » (paramètre `stock_items_count_toward_quota`, défaut `0`).**
   Votre modèle économique donne 3 articles actifs gratuits par boutique, puis 10 Pépites par article et par mois au-delà. Un dépôt de gaz avec 20 références paierait donc 170 Pépites/mois. J'ai fait le choix, pour l'adoption, de **ne pas** compter ces articles dans ce quota (plafond de 60 articles par boutique pour éviter les abus). Mettez la valeur à `1` dans *Admin → Disponibilité → Règles* si vous préférez les facturer.
2. **Ancienneté minimale des comptes pour noter ou signaler (12 h par défaut).** Protège contre les faux comptes ; pendant un pilote où tous les comptes sont récents, mettez `0` si cela bloque vos testeurs, puis remontez la valeur.
3. **Nom « Trouvailles ».** Dans votre code, « Pépites » désigne la **monnaie virtuelle** (solde, recharges, boosts) — il n'existe aucun flux de publications appelé « Pépites ». J'ai donc nommé le nouveau bandeau « Les Trouvailles » pour éviter une collision de sens. Le libellé est modifiable dans `src/lib/availability-i18n.ts` (`tv_title`).
4. **Cloche de la barre supérieure.** Elle ouvrait la messagerie. Pour éviter deux cloches, la messagerie prend l'icône « message » et la cloche ouvre désormais les notifications. Le compteur de messages non lus est conservé.
5. **Notifications push (application fermée) : non livrées** (voir README §8). Les notifications arrivent dans l'application, en direct quand elle est ouverte.

---

## 8. Dépannage

| Symptôme | Cause probable | Solution |
|---|---|---|
| La carte n'affiche aucune bulle | Aucun article « disponibilité » déclaré, ou zoom < 14 | Déclarer un article (Compte → Ma disponibilité) ; zoomer |
| « permission denied for table availability_reports » dans la console | Lecture directe de la table | Normal : seules les colonnes non identifiantes sont lisibles, via la vue `product_availability` |
| « Votre compte est trop récent… » | Règle anti-abus | Attendre, ou baisser `review_min_account_age_hours` / `report_min_account_age_hours` |
| « La catégorie … n'accepte pas encore les articles de disponibilité » | Catégorie fermée ou réglementée | Admin → Disponibilité → Catégories → cocher « Autoriser les articles de disponibilité » |
| « Limite de 60 articles… » | Plafond par boutique | Augmenter `max_stock_items_per_shop` |
| Les notifications n'arrivent pas en direct | Table non publiée dans Realtime | Voir §2.3, contrôle 6 |
| Erreur `cron.schedule` à l'exécution de 0018 | pg_cron inactif | Activer l'extension pg_cron, puis relancer 0018 (rejouable) |
| La messagerie n'a plus de cloche | Changement voulu (voir §7.4) | — |

---

## 9. Hygiène du dépôt (observations, hors périmètre de cette mise à jour)

Ces points n'ont **pas** été modifiés, mais méritent votre attention :

- `src1/`, `supabase1/`, `src/pages2/`, `package1.json`, `README1.md` et deux archives `.zip` dans `src/` sont des copies anciennes : elles alourdissent le dépôt et `src/pages2/` est compilée par `tsc` (risque de faux positifs d'erreurs).
- `.env` est présent dans l'archive du dépôt et n'est pas dans `.gitignore`. La clé publique « anon » de Supabase est faite pour être publique ; vérifiez néanmoins qu'aucune clé **secrète** (service role, clé de paiement) ne s'y trouve, et ajoutez `.env` au `.gitignore`.
- Le `README.md` mentionne `0009_moderation_ratings.sql`, alors que le fichier s'appelle `0009_admin_moderation.sql`.
