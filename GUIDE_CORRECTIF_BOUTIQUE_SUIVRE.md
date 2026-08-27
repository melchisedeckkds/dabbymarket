# DabbyMarket — Correctif page boutique + bouton Suivre sur les articles

## A. La page boutique blanche — cause trouvée et corrigée

**Cause réelle : une violation des Règles des Hooks React**, introduite
lors d'un ajout précédent (module découverte locale). Dans
`src/pages/Boutique.tsx`, le hook `useShops()` était appelé **après**
deux `return` conditionnels (écran de chargement, puis "boutique
introuvable"). Or React exige que **tous les hooks soient appelés dans le
même ordre à chaque rendu**, sans jamais dépendre d'une condition ou
d'un retour anticipé.

Concrètement : au premier rendu (`isLoading = true`), React s'arrête au
`return <ShopHeaderSkeleton />` et n'exécute jamais `useShops()`. Au
rendu suivant (les données arrivent, `isLoading = false`), React essaie
d'exécuter `useShops()` alors qu'il n'a jamais été "vu" au rendu
précédent — ce décalage fait planter le composant silencieusement.
En production (build optimisé), ce plantage ne produit ni message
d'erreur ni contenu : juste une page blanche, exactement ce que tu as
vu. C'est un bug classique et je suis responsable de l'avoir introduit —
corrigé en remontant `useShops()` avant les deux `return`.

**Fichiers concernés :**
- `src/pages/Boutique.tsx` — correctif de l'ordre des hooks, plus les
  hooks `useIsFollowing`/`useToggleFollow` déplacés vers `queries.ts`
  (pour être réutilisables ailleurs, voir point B).
- `src/lib/queries.ts` — accueille désormais ces deux hooks.

## B. Bouton Suivre/Suivi sur chaque article

Ajouté dans `src/components/product-card.tsx` — chaque carte d'article
affiche désormais, à côté du nom de la boutique, un bouton :
- **"Suivre"** (fond doré) si tu ne suis pas encore la boutique,
- **"Suivi"** (fond neutre) si tu la suis déjà,
- **masqué** si l'article vient de ta propre boutique (pas de sens de se
  suivre soi-même).

Cliquer dessus ne t'emmène pas sur la page boutique (le clic est
intercepté) — exactement le réflexe attendu sur les autres réseaux
sociaux. Réutilise le système d'abonnement déjà existant (table
`follows`, déjà utilisée sur la page boutique elle-même) — aucune
migration SQL nécessaire, c'est un pur ajout d'interface.

## Actions à faire de ton côté

1. Copier les 3 fichiers dans ton dépôt (aucune migration SQL cette
   fois-ci).
2. Redéployer.
3. Tester : ouvrir une page boutique depuis un article ou depuis un profil
   → elle doit maintenant s'afficher normalement. Suivre/ne plus suivre
   une boutique depuis une carte d'article dans Le Marché doit se
   refléter immédiatement sur la page boutique elle-même (et
   inversement).
