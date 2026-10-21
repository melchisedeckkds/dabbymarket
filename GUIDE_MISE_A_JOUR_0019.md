# Mise à jour 0019 — Guide d'installation

## Ce que contient la mise à jour
Voir `README_NOUVEAUTES_0019.md` pour le détail fonctionnel.

## Ordre d'installation (≈ 10 minutes)
1. **Sauvegarde** : dans Supabase → Database → Backups (ou export SQL) avant toute chose.
2. **Base de données** : Supabase → SQL Editor → coller et exécuter
   `supabase/migrations/0019_flash_marketplace_boost_and_hardening.sql`.
   Le script est rejouable sans risque (idempotent). Aucune erreur attendue.
3. **Fonction La Guérite** (optionnel mais recommandé) : redéployer
   `supabase/functions/la-guerite-chat/index.ts` (`supabase functions deploy la-guerite-chat`).
   Bascule automatique sur des modèles de secours quand Gemini est saturé.
4. **Code** : copier les fichiers du ZIP par-dessus votre dépôt (mêmes chemins), puis
   `npm ci && npm run build` (ou simplement pousser sur GitHub : Netlify rebuild).
5. **Vérifier** (section ci-dessous).

## Vérifications après installation
- Publier une Vente Flash (compte test) → elle apparaît **en tête du Marché** (rail « Ventes Flash — à la une », badge sponsorisé), dans `/flash`, sur la Carte.
- Fiche de l'annonce côté vendeur : message « Mise en avant automatique jusqu'au … », plus de bouton « Booster ».
- Marquer vendue / attendre l'expiration → l'annonce disparaît du Marché ; Admin → Contenu → *Archives des Ventes Flash* la montre (filtre statut, recherche, export CSV).
- Admin → Économie : en bas, *Audit des Pépites* (doit afficher « Aucun écart »), *Origine des inscrits*, *Candidats au badge*.
- Publier un article : le bloc « Coût » affiche « Gratuit (x/3) » puis « 10 Pépites/mois » au-delà du quota.
- Recharge : la liste des coûts affiche les tarifs Vente Flash lus depuis la configuration.

## Tarifs Pépites en vigueur (tous modifiables dans Admin → Économie)
| Élément | Tarif |
|---|---|
| Packs | 100 = 500 F · 250 = 1 200 F · 500 = 2 300 F · 1 000 = 4 400 F · 2 500 = 10 000 F |
| Quota gratuit | 3 articles actifs par boutique ; au-delà 10 Pépites/mois/article (facturé le 1er) |
| Bonus de bienvenue | 150 Pépites, 30 jours, déclenché par la 1ère annonce avec photo |
| Vente Flash | 1ʳᵉ offerte 48 h ; ensuite 24 h = 10, 48 h = 15, 7 j = 25 (prolongation au même tarif) |
| Boost article | 24 h = 25 · 48 h = 45 · 7 j = 100 |
| Boost boutique | 3 j = 60 · 7 j = 100 · 30 j = 350 |
| Carte | 24 h = 20 · 7 j = 90 |
| Recherche | 48 h = 35 · 7 j = 80 |
| La Guérite (IA) | 7 j = 70 · 30 j = 220 |
| Accueil | 24 h = 150 (5 créneaux/jour) |

Le boost « Vente Flash 48 h » (30 Pépites) est **désactivé** : la mise en avant est désormais incluse dans le prix de la Vente Flash.

## Correctifs de sécurité/justesse inclus
- Affichage trompeur « Coût : 15 Pépites » à la publication d'un article → remplacé par le vrai coût.
- `purchase_boost` : refuse un boost incompatible avec la cible (ex. Carte sur un article), refuse « Accueil » (qui contournait la limite de créneaux), refuse le boost Flash payant.
- `extend_flash_listing` / `publish_flash_listing` : verrou sur le solde (pas de double débit simultané).
- `request_recharge` : montant obligatoirement égal à un pack actif, référence unique (anti-réutilisation d'un même code MoMo/OM), 5 demandes en attente max.
- Liste publique des Ventes Flash : filtre sur l'heure d'expiration (plus de dépendance au cron).
- Textes : « Mes Achats » → « Mes Favoris », meta description et onboarding sans « livraison », CGU : badge = double vérification.

## Retour arrière
`supabase/rollback/ROLLBACK_0019.sql` restaure les anciennes fonctions et retire les nouveaux objets (les archives sont conservées).

## Tests SQL
`supabase/tests/pepites_flow_test.sql` : sur une base de **test** uniquement
(`psql "$TEST_DB" -v ON_ERROR_STOP=1 -f supabase/tests/pepites_flow_test.sql`). Tout est annulé en fin de script.

## Mesure des campagnes (sans outil externe)
Ajoutez à vos liens : `https://dabbymarket.netlify.app/?utm_source=whatsapp&utm_campaign=etoudi`.
L'origine est rattachée au compte à la première connexion et visible dans Admin → Économie → *Origine des inscrits*.
