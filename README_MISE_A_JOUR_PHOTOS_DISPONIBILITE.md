# Mise à jour — Photos des articles en disponibilité

Aucune migration SQL : le champ `products.images` et le bucket `product-images` existent déjà.

## Ce qui change
- **Disponibilité (marchand)** : « Ajouter un article » propose une photo (1 image, compressée automatiquement). Chaque article existant a une vignette cliquable pour ajouter ou remplacer sa photo.
- **Carte** : si l'article mis en avant a une photo, la bulle devient une bulle « photo » (vignette 52 px à bordure de la couleur du statut, nom, prix doré, statut, fraîcheur). Les listes de la Carte affichent aussi la photo.
- **Marketplace** : nouvelle rangée « Disponible maintenant » (cartes carrées plein cadre, bordure colorée selon le statut, prix en bandeau). Seuls les articles en stock, avec photo, « disponibles » ou « limités » ET non périmés y figurent. Elle réagit à la recherche.
- **Correctif** : l'unité de vente n'est plus imposée par la catégorie (fini « FCFA / kg » pour des crêpes). Elle est facultative et choisie par le marchand.

## Déploiement
1. Copier les fichiers du ZIP dans le dépôt (mêmes chemins).
2. `npm run build` puis déployer sur Netlify.

## Limites à connaître
- Une boutique « sans emplacement » (ex. Dabby Secret's) n'apparaît pas sur la Carte : sa photo s'affiche dans la Marketplace et sa fiche, pas sur la Carte.
- Les articles existants n'ont pas de photo tant que le marchand n'en ajoute pas.
