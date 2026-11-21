# DabbyMarket 2.0 — Guide de mise à jour (GitHub + Supabase + Netlify)

Suivez les étapes **dans l'ordre**. Comptez 45 à 60 minutes la première fois. À chaque étape, une **vérification** vous dit si vous pouvez continuer.

**Ce que contient la mise à jour**

| Domaine | Nouveauté |
|---|---|
| Marché | Le Marché affiche la **vitrine** (3 articles gratuits par boutique + articles boostés). La **recherche** interroge tout le catalogue, même les articles en rupture ou non confirmés, avec leur vrai statut. |
| Boutiques | « Ma vitrine » : choisir ses articles en vitrine, acheter un emplacement supplémentaire en Pépites. Publier est toujours gratuit (plus de facturation de dépassement). |
| Confiance | Avis boutique ouverts et pondérés par la preuve (contact, itinéraire, signalement), exactitude des informations, statut de fiabilité avec contestation, badges de contributeur, invitations à noter. |
| Santé | Rubrique Santé : annuaire d'établissements vérifiés, services et équipements, périodes de garde. La vente de **médicaments est fermée par défaut**. |
| Sécurité | Faille de crédit de Pépites corrigée (migration 0023), webhook de paiement durci, règles du chatbot imposées côté serveur, `.env` protégé, fichiers inutiles retirés. |

Aucune donnée n'est supprimée. Les 3 articles les plus récents de chaque boutique (les boostés d'abord) sont placés automatiquement en vitrine.

---

## Étape 0 — Avant de commencer (10 min)

1. **Sauvegarde Supabase** : Supabase → *Database → Backups* → vérifiez qu'une sauvegarde récente existe, ou exportez-en une. **Ne continuez pas sans sauvegarde.**
2. **Vérifiez que les migrations 0001 à 0019 sont déjà appliquées.** Supabase → *SQL Editor* → exécutez :

```sql
select
  to_regclass('public.product_availability')  is not null as dispo_ok,
  to_regclass('public.flash_listings')        is not null as flash_ok,
  to_regclass('public.availability_reports')  is not null as signalements_ok,
  to_regprocedure('public.config_int(text)')  is not null as config_ok,
  exists (select 1 from pg_proc where proname = 'guard_shops_sensitive_columns') as verrou_0017_ok,
  exists (select 1 from cron.job where jobname = 'dabbymarket-bill-quota-overage') as cron_ok;
```

**Attendu : 6 colonnes à `true`.** Si l'une est `false`, appliquez d'abord les migrations manquantes du dossier `supabase/migrations/` (dans l'ordre des numéros), puis revenez ici. (`verrou_0017_ok` à `false` = la migration 0017 manque : c'est une protection de sécurité importante.)

3. **Notez vos réglages Netlify** (variables `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`). Ils ne changent pas.

---

## Étape 1 — Mettre le code sur GitHub (15 min)

La mise à jour vient dans l'archive `dabbymarket-2.0.zip`. On travaille sur une **branche** : votre version actuelle reste intacte tant que vous n'avez pas fusionné.

### Option A — avec Git (recommandé, permet de supprimer les fichiers inutiles)

```bash
git clone https://github.com/VOTRE_COMPTE/dabbymarket.git      # ou, si déjà cloné : git pull
cd dabbymarket
git checkout -b maj-2-0
cp .env /tmp/dabbymarket.env.sauvegarde 2>/dev/null            # garde votre .env à part
```

1. **Vider le dossier du dépôt sauf `.git`** puis **copier le contenu du ZIP dedans** (décompressez le ZIP dans un dossier temporaire : ses fichiers sont à la racine, copiez-les tous). Ainsi les fichiers supprimés dans la 2.0 (`src1/`, `supabase1/`, `src/pages2/`, `package1.json`, archives `.zip`) disparaissent bien.
2. Remettez votre `.env` local s'il existe : `cp /tmp/dabbymarket.env.sauvegarde .env` (il est désormais ignoré par Git, c'est voulu).
3. Publiez la branche :

```bash
git add -A
git status          # vérifiez : plus de fichier .env dans la liste « à ajouter »
git commit -m "DabbyMarket 2.0 : vitrine, recherche catalogue, confiance, santé, sécurité"
git push -u origin maj-2-0
```

### Option B — sans Git, depuis le site GitHub

1. GitHub → votre dépôt → bouton **Branch** → créez `maj-2-0`.
2. **Add file → Upload files** : glissez le contenu décompressé du ZIP (par lots si besoin) → *Commit changes* sur la branche `maj-2-0`.
3. Supprimez à la main (icône corbeille de chaque fichier) : `src1/`, `supabase1/`, `src/pages2/`, `package1.json`, `src/pages.zip`, `src/dabbymarket-pages-redesigned.zip`, et le fichier `.env` s'il est présent dans le dépôt.

> **Important — secrets.** Si votre fichier `.env` a déjà été publié sur GitHub à un moment, considérez ses clés comme exposées : Supabase → *Settings → API* → régénérez la clé *anon* si vous le pouvez, puis mettez à jour Netlify. (La clé *service_role* ne doit **jamais** être dans le dépôt.)

**Vérification :** sur GitHub, la branche `maj-2-0` contient `supabase/migrations/0023_securite_paiement.sql` et `src/pages/Sante.tsx`.

---

## Étape 2 — Mettre à jour la base de données (15 min)

Supabase → *SQL Editor* → **New query**. Pour **chacun** des 4 fichiers, dans cet ordre : ouvrez le fichier (GitHub ou dossier local), copiez tout, collez, **Run**. Attendez « Success » avant de passer au suivant. Chaque script peut être relancé sans danger si vous avez un doute.

| Ordre | Fichier | Rôle |
|---|---|---|
| 1 | `supabase/migrations/0020_vitrine_catalogue.sql` | Vitrine, catalogue, recherche serveur, emplacements |
| 2 | `supabase/migrations/0021_confiance_notes_exactitude.sql` | Avis, exactitude, fiabilité, badges |
| 3 | `supabase/migrations/0022_sante.sql` | Rubrique Santé (médicaments fermés) |
| 4 | `supabase/migrations/0023_securite_paiement.sql` | Sécurisation du crédit de Pépites |

**Vérification après les 4 scripts :**

```sql
select
  (select count(*) from products where is_showcased) as articles_en_vitrine,
  (select count(*) from products where is_active)    as articles_actifs,
  (select value from app_config where key = 'health_s2_enabled') as medicaments_s2,
  has_function_privilege('authenticated', 'auto_confirm_recharge(text,text,integer)', 'execute') as client_peut_crediter,
  exists (select 1 from cron.job where jobname = 'dabbymarket-expire-showcase-slots') as cron_vitrine,
  exists (select 1 from cron.job where jobname = 'dabbymarket-health-expire') as cron_sante,
  not exists (select 1 from cron.job where jobname = 'dabbymarket-bill-quota-overage') as facturation_depassement_arretee;
```

**Attendu :** `articles_en_vitrine` > 0 et ≤ 3 × nombre de boutiques ; `medicaments_s2` = `0` ; **`client_peut_crediter` = `false`** (c'est la faille corrigée) ; les trois derniers à `true`.

Si une erreur apparaît : copiez le message, ne relancez rien d'autre, et consultez la section « En cas de problème » plus bas.

---

## Étape 3 — Fonctions Edge Supabase (10 min)

Prérequis : l'outil `supabase` en ligne de commande, connecté à votre projet (`supabase login`, puis `supabase link --project-ref VOTRE_REF`). Si vous ne l'avez pas, passez par Supabase → *Edge Functions* → ouvrez la fonction → collez le contenu du fichier → *Deploy*.

1. **Chatbot La Guérite** (recommandé, sécurité) :
   `supabase functions deploy la-guerite-chat`
   Les règles (jamais de conseil médical, ne pas révéler ses consignes) sont maintenant imposées côté serveur.
2. **Webhook de paiement** : à déployer **seulement si** vous branchez un prestataire de paiement. Sinon, ne faites rien : le flux manuel (validation par l'admin) continue de fonctionner.
   ```bash
   supabase secrets set PAYMENT_WEBHOOK_SECRET=$(openssl rand -hex 32)
   supabase functions deploy payment-webhook --no-verify-jwt
   ```
   Puis adaptez dans `supabase/functions/payment-webhook/index.ts` le nom de l'en-tête de signature et les champs du prestataire (zones marquées « À ADAPTER »), et testez en mode *sandbox* avant d'activer.

---

## Étape 4 — Déployer le site (10 min)

1. GitHub → **Pull requests → New pull request** : `maj-2-0` vers `main`. Netlify crée un **aperçu de déploiement** (« Deploy Preview ») : ouvrez-le.
2. Faites les **tests de l'étape 5 sur l'aperçu**.
3. Tout est bon : **Merge pull request**. Netlify republie le site de production en 1 à 2 minutes. Aucune variable d'environnement à changer.
4. Application Android (Capacitor) : si vous publiez aussi l'app, relancez votre procédure habituelle (`npm run build`, `npx cap sync android`, puis build Android Studio) **après** la fusion.

---

## Étape 5 — Tests à faire (15 min)

Utilisez deux comptes : un marchand de test et un client de test, plus votre compte admin.

**Vitrine et recherche**
- [ ] Le Marché n'affiche que la vitrine (pas plus de 3 articles par boutique, hors boostés).
- [ ] Tapez le nom d'un article **qui n'est pas en vitrine** : il apparaît dans les résultats, avec son statut (disponible, en rupture, non renseigné…).
- [ ] Un article en rupture est trouvé et marqué « Rupture de stock ».
- [ ] Marchand : *Ma boutique → onglet Produits* → bloc « Ma vitrine » avec compteur `x / 3`, boutons mettre/retirer. Avec la vitrine pleine, le bouton « Mettre en vitrine » est grisé.
- [ ] Marchand : publier un 4ᵉ article → message « ajouté au catalogue », coût **Gratuit**.
- [ ] Un article sponsorisé garde sa place dans l'ordre des résultats (il porte seulement l'étiquette « Sponsorisé »).

**Confiance**
- [ ] Client : ouvrir l'itinéraire d'une boutique sur la Carte, puis (attendre ou contourner le délai de 2 h, voir plus bas) → une invitation « Avez-vous trouvé ce que vous cherchiez ? » apparaît.
- [ ] Client sans aucune interaction : « Noter cette boutique » → refus avec message clair (contactez, itinéraire ou signalement).
- [ ] Client ayant contacté la boutique : la note est acceptée, la mention « A contacté la boutique » s'affiche sous l'avis.
- [ ] Marchand : bloc « Fiabilité de ma boutique » visible ; la boutique reçoit une notification d'avis.
- [ ] Admin : onglets **Avis et anomalies**, **Fiabilité**, **Santé** présents.

**Santé**
- [ ] Marchand de test : créer une boutique de catégorie santé → *Dossier santé* → envoyer le dossier.
- [ ] Avant vérification : essayer de publier un service de santé → refusé (« réservée aux établissements vérifiés »).
- [ ] Admin → onglet Santé → *Vérifier* le dossier. La rubrique **Santé** (lien sur le Marché et dans le menu) liste l'établissement.
- [ ] Publier un service (catégorie santé) → visible dans Santé → *Services et équipements*, **sans prix** (voir réglages).
- [ ] Boost et vente flash refusés pour la santé ; aucune vitrine payante ; commentaire libre refusé sur la boutique de santé (étoiles seulement).
- [ ] Admin → Santé : l'interrupteur **S2 est décoché** (ne le cochez pas, voir « Avant d'ouvrir S2 »).

**Sécurité**
- [ ] Un compte client ne peut plus appeler le crédit de Pépites : la requête de l'étape 2 donne `client_peut_crediter = false`.
- [ ] Le dépôt GitHub ne contient aucun fichier `.env`.

> **Astuce pour tester sans attendre** (comptes de test seulement) : dans Supabase → *Table Editor → app_config*, mettez `rating_prompt_delay_minutes` à `0` (invitation immédiate) et `review_min_account_age_hours` à `0` (un compte neuf peut noter ; sinon il faut 12 h d'ancienneté). Remettez ensuite 120 et 12.

---

## Réglages utiles (table `app_config`, modifiable dans Supabase → Table Editor ; certains aussi dans Admin → Économie)

| Réglage | Valeur de départ | Effet |
|---|---|---|
| `free_active_listings_quota` | 3 | Articles en vitrine gratuits par boutique |
| `showcase_slot_price_pepites` / `showcase_slot_days` | 30 / 30 | Prix et durée d'un emplacement supplémentaire |
| `catalog_max_items_per_shop` | 200 | Plafond anti-abus du catalogue |
| `review_weight_received/report/contact/route` | 100 / 80 / 70 / 50 | Poids d'un avis selon la preuve |
| `reliability_watch_below` / `reliability_unreliable_below` | 70 / 50 | Seuils d'exactitude (%) |
| `accuracy_min_reports` / `accuracy_min_reporters` | 5 / 3 | Minimum pour afficher un taux d'exactitude |
| `rating_prompt_delay_minutes` | 120 | Délai avant l'invitation à noter |
| `contributor_bronze/silver/gold` | 3 / 15 / 50 | Contributions (180 jours) pour chaque badge |
| `health_show_prices` | 0 | 1 = afficher les prix des offres de santé |
| `health_s2_enabled` | **0** | Vente de médicaments (voir ci-dessous) |

Toutes ces valeurs sont des **hypothèses de départ** : ajustez-les avec vos données réelles.

## Avant d'ouvrir S2 (médicaments) — ne pas sauter

Des articles de presse indiquent que les médicaments exigent une ordonnance valide au Cameroun ; je n'ai pas lu le texte officiel. La loi sur les données personnelles de 2024 s'applique depuis le 23 juin 2026. **Obtenez l'avis d'un juriste ou de l'ordre des pharmaciens avant de cocher S2.** Ensuite : Admin → Santé → *Référentiel de médicaments* pour saisir les médicaments autorisés (les « contrôlés » ne sont jamais publiables), puis cochez S2. Décocher S2 retire immédiatement toutes les offres de médicaments.

---

## En cas de problème

| Symptôme | Cause probable | Action |
|---|---|---|
| Erreur « function config_int does not exist » ou « relation … does not exist » à l'étape 2 | Une migration 0001–0019 manque | Refaites l'étape 0, appliquez les migrations manquantes, relancez le script |
| Le Marché est vide après la mise à jour | La migration 0020 n'a pas été exécutée (colonne `is_showcased` absente) | Exécutez 0020 puis rechargez |
| La recherche affiche une erreur | Migration 0020 ou 0022 manquante (fonction `catalog_search`) | Exécutez les migrations dans l'ordre |
| « Ma vitrine » ne montre rien | 0020 non appliquée | idem |
| Impossible de noter, message de preuve | Normal : il faut contacter, demander l'itinéraire ou signaler | Voir tests |
| Build Netlify en échec | Fichier manquant lors de la copie | Comparez avec la branche, vérifiez `src/lib/v2-queries.ts`, `src/components/` et `src/pages/Sante*.tsx` |

**Retour arrière (urgence)** : exécutez dans le SQL Editor, dans cet ordre, `supabase/rollbacks/ROLLBACK_0022.sql`, puis `ROLLBACK_0021.sql`, puis `ROLLBACK_0020.sql`, et redéployez l'ancienne version du site (Netlify → *Deploys* → choisir l'ancienne → *Publish deploy*). Attention : le retour arrière supprime les avis « ouverts », les dossiers santé et les emplacements achetés. **N'exécutez pas `ROLLBACK_0023.sql`** sauf demande expresse : il rouvre la faille de crédit des Pépites.

## Ce qui a été vérifié, et ce qui ne l'a pas été

- Vérifié : les 4 migrations passent sur PostgreSQL 16 avec leurs tests (`supabase/tests/`), y compris la montée sur une base déjà peuplée, le rejeu et le retour arrière ; le code TypeScript compile et le site se construit (`npm run build`).
- **Non vérifié** : le fonctionnement dans un navigateur sur votre vraie base Supabase (d'où les tests de l'étape 5 sur l'aperçu Netlify), l'application Android, et le webhook avec un vrai prestataire de paiement.
- Hors périmètre : la validation juridique de S2, les numéros d'urgence officiels à afficher dans la rubrique Santé (le texte d'urgence est générique), et le contenu de votre référentiel de médicaments.
