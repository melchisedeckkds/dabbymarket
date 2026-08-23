# DabbyMarket — Modèle économique v1, Phase 2 (UI)

Fait suite à la Phase 1 (migration `0012_economic_model_v1.sql`, déjà
livrée). Si tu ne l'as pas encore appliquée dans Supabase, fais-le d'abord
— tout ce qui suit en dépend.

## Fichiers de cette livraison

**Nouveaux :**
- `src/components/boost-picker.tsx` — sélecteur des 6 types de boosts ×
  leurs durées, cumul possible, branché sur le vrai catalogue en base
  (donc reflète automatiquement tes changements de prix admin).
- `src/components/sponsored-badge.tsx` — étiquette "Sponsorisé"
  réutilisable.

**À remplacer intégralement :**
- `src/pages/Produit.tsx` — le bouton "Booster" fixe (80 Pépites, 24h) est
  remplacé par l'ouverture du sélecteur complet.
- `src/pages/Boutique.tsx` — le propriétaire voit désormais un bouton
  "Booster ma boutique" (remplace contact/suivre sur sa propre boutique,
  qui n'avait pas de sens) ; badge Sponsorisé affiché si un boost boutique
  est actif.
- `src/pages/Admin.tsx` — nouvel onglet **Économie** : modifier le quota
  gratuit, le prix de dépassement, le bonus de bienvenue, les limites
  anti-abus, les 5 packs et les 13 lignes du catalogue de boosts — tout
  sans déploiement de code, comme demandé en section 8 du cahier des
  charges.
- `src/lib/queries.ts`, `src/lib/i18n.ts` — hooks et traductions.

`npm run build` (tsc -b && vite build) passe sans erreur de mon côté.

## Ce que ça change concrètement

- **Publier un article est gratuit** dans la limite du quota configuré
  (3 au lancement) — plus aucun débit à la publication.
- **Un même article ou boutique peut cumuler plusieurs boosts** de types
  différents (ex. Boost Article + Boost Recherche en même temps) — le
  sélecteur affiche tous les boosts déjà actifs sur la cible.
- **Le bonus de bienvenue** n'est plus versé à l'inscription — il attend
  la publication d'un premier article avec au moins une photo.
- **L'admin peut tout ajuster** (quota, prix, bonus, limites) depuis
  l'onglet Économie, sans toucher au code.

## Ce qui reste à faire (Phase 3, pas encore livrée)

1. **Règle de classement** — encart "mis en avant" séparé + bonus de rang
   plafonné (+3) dans `Carte.tsx` (Boost Carte) et `Marche.tsx`/recherche
   (Boost Recherche). Actuellement, un boost Carte/Recherche est acheté et
   enregistré en base, mais **n'influence pas encore l'affichage** de ces
   deux écrans — c'est purement transactionnel pour l'instant.
2. **Mise en avant Accueil** — la RPC `purchase_home_feature` et la file
   de créneaux existent côté base, mais aucun écran d'accueil dédié ne les
   affiche encore.
3. **La Guérite** — le chatbot ne connaît pas encore le boost "ia" ni
   n'étiquette ses mentions sponsorisées ; à corriger avant mise en
   production, car c'est un point explicitement non négociable du cahier
   des charges (section 5).
4. **OTP téléphonique et limite par appareil/IP réelle** — toujours non
   construits, pour les raisons déjà expliquées en Phase 1 (nécessite un
   choix de fournisseur SMS et un Auth Hook serveur).

Je continue avec le point 1 (le plus important — c'est la "règle non
négociable" du cahier des charges) dans la suite si tu veux que j'enchaîne.
