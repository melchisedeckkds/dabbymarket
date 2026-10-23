# Mise à jour — Refonte de la Carte

Aucune migration SQL. Copier les fichiers du ZIP (mêmes chemins) puis `npm run build` et déployer.

## Nouveautés
- **4 fonds de carte** (panneau à droite, choix mémorisé sur l'appareil) : Plan (CARTO, thème clair/sombre), Rues (OpenStreetMap, défaut), Satellite (Esri + noms de lieux), Relief (OpenTopoMap, utile à Yaoundé).
- **Boutons zoom + / −.**
- **Recentrage** : un appui sur la cible centre sur vous ; un second appui « décentre » et cadre toutes les boutiques. Glisser la carte décentre aussi.
- **Rail de boutiques en bas, synchronisé avec la carte** : toucher un pin met la boutique en surbrillance et fait défiler le rail jusqu'à sa carte ; faire glisser le rail recadre la carte sur la boutique. Toucher une carte du rail ouvre la fiche.
- **Cartes du rail enrichies** : note, distance, Ouvert/Fermé, disponibilité et photo.
- **Cadrage plus stable** : un rafraîchissement de données (avis, disponibilités) ne ramène plus la carte de force ; le zoom courant est conservé quand il est déjà élevé.
- Crédits des fonds affichés en bas à gauche.

## À savoir
- Les fonds OpenStreetMap, Esri et OpenTopoMap sont des services tiers gratuits à usage raisonnable ; si le trafic grandit, prévoir une clé (MapTiler, etc.).
- Le fond Plan garde la clé CARTO si `VITE_CARTO_API_KEY` est définie.
