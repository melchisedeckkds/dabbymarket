# DabbyMarket — Correctifs + emplacements multiples

## ⚠️ A. Sur ton correctif SQL d'urgence — important

Ton correctif a bien réglé le bug d'inscription (bravo pour le réflexe
`ON CONFLICT DO NOTHING` + `EXCEPTION WHEN OTHERS`, c'est exactement la
bonne intuition de robustesse). **Mais** il a réintroduit `500` en dur
comme solde initial (`VALUES (..., 500, FALSE)`), ce qui ramène l'ancien
modèle "500 Pépites à l'inscription" — exactement ce qu'on a supprimé
lors du passage au Modèle 1 (le bonus de bienvenue ne doit se déclencher
qu'après la première publication avec photo, jamais à l'inscription).

**`supabase/migrations/0014_fix_signup_trigger.sql`** corrige les deux à
la fois : garde ta robustesse (gestion d'erreur, pas de blocage de
l'inscription), remet `0` comme solde de départ, et **remet à zéro les
comptes qui auraient reçu les 500 Pépites par erreur entre-temps** — mais
seulement s'ils n'ont encore rien dépensé ni publié, pour ne jamais toucher
un compte avec une activité réelle derrière ce solde.

Exécute cette migration pour remplacer ton correctif d'urgence par la
version définitive.

## B. La Guérite qui coupe ses phrases (voir tes captures)

Cause trouvée : `supabase/functions/la-guerite-chat/index.ts` limitait la
réponse à `maxOutputTokens: 400` — beaucoup trop court depuis que le
prompt système est devenu plus riche (règles de classement, étiquetage
sponsorisé, etc.), ce qui coupait la réponse en plein milieu d'un mot.
Corrigé à 900, plus un filet de sécurité : si jamais la réponse est
malgré tout coupée, elle se termine proprement par "…" au lieu de s'arrêter
en plein mot. **Déploie cette fonction Edge** (`supabase functions deploy
la-guerite-chat`) pour que le correctif prenne effet.

## C. Textes obsolètes corrigés ("500 Pépites à l'inscription")

Retrouvés et corrigés dans `src/lib/i18n.ts` (FR + EN) : l'écran de
connexion, le toast de bienvenue, la popup d'engagement "connecte-toi", le
message invité, et le tutoriel d'accueil affichaient tous encore l'ancienne
promesse de 500 Pépites gratuites à l'inscription. Reformulés pour refléter
le vrai mécanisme (bonus après la première publication avec photo), sans
figer de montant en dur dans le texte — le montant reste modifiable depuis
l'onglet admin Économie sans jamais recréer ce genre de décalage.

`src/pages/Recharge.tsx` avait déjà été corrigé au tour précédent.

## D. Emplacements multiples + déménagement — nouvelle fonctionnalité

**Migration `0015_shop_locations.sql`** — nouvelle table `shop_locations` :
- Une boutique physique peut avoir **plusieurs emplacements actifs**
  simultanément (succursales).
- **Déménager** un emplacement conserve l'ancien comme historique
  (visible par tous, marqué comme tel) et active le nouveau — la Carte ne
  lit que les emplacements courants, donc elle s'adapte **automatiquement**
  sans aucun code supplémentaire côté carte.
- Rétro-compatible : les boutiques déjà créées reçoivent automatiquement
  leur emplacement "principal" reconstruit depuis leurs `lat/lng` actuels ;
  toute nouvelle boutique physique en reçoit un dès sa création (trigger),
  sans rien changer à `CreerBoutique.tsx`.
- `shops.lat/lng/neighborhood/landmark` restent synchronisés avec
  l'emplacement principal, donc tout le code existant continue de
  fonctionner sans modification.

**Fichiers modifiés :**
- `src/lib/queries.ts` — `useActiveShopLocations`, `useShopLocations`,
  `useAddShopLocation`, `useRelocateShopLocation`, `useCloseShopLocation`.
- `src/pages/Carte.tsx` — affiche désormais **un pin par emplacement actif**
  (une boutique à 2 succursales apparaît 2 fois, à ses deux vraies
  adresses), plus un `locationId` distinct de l'id boutique pour les clés
  React et éviter les doublons dans les listes/notes/boosts.
- `src/components/map-view.tsx` — clé de marqueur adaptée en conséquence.
- `src/pages/Boutique.tsx` — nouveau bloc dans l'onglet "Localisation" :
  liste des adresses actuelles (si plusieurs), historique des anciennes
  adresses (avec date de déménagement), et pour le propriétaire : bouton
  "Ajouter une succursale" et "Déménager" par adresse (réutilise la
  géolocalisation + les listes de quartiers déjà existantes).

## Actions à faire de ton côté

1. Exécuter `0014_fix_signup_trigger.sql` puis `0015_shop_locations.sql`
   dans l'éditeur SQL Supabase (dans cet ordre).
2. Déployer la fonction Edge `la-guerite-chat` mise à jour.
3. Copier les fichiers `.tsx`/`.ts` listés ci-dessus.
4. Tester : créer un nouveau compte (doit réussir, solde à 0) ; publier un
   article avec photo (doit déclencher le bonus) ; sur une boutique
   physique existante, ajouter une succursale puis déménager l'adresse
   principale — vérifier que la Carte affiche bien les deux pins puis se
   met à jour après le déménagement, et que l'ancienne adresse apparaît en
   historique sur la page boutique.

## Ce qui reste (non traité dans ce lot)

Je n'ai pas eu le temps, dans ce tour, de relire l'intégralité des textes
de l'application au-delà des occurrences explicitement liées aux "500
Pépites" — une relecture exhaustive de tous les textes (guide d'aide,
CGU, tous les écrans) reste à faire si tu veux une passe complète, et je
peux m'y consacrer spécifiquement si tu me dis lesquels te semblent encore
à côté.
