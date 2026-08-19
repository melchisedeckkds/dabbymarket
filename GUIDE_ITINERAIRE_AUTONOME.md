# DabbyMarket — Mise à jour "Itinéraire autonome" (+ rattrapage découverte locale)

## ⚠️ Contexte important

Mon environnement de travail a redémarré entre deux messages, ce qui a effacé
ma copie de travail précédente (pas ton dépôt — juste mon brouillon local).
J'ai tout reconstruit à partir de zéro, **vérifié par un vrai build de
production** (`npm run build` propre, aucune erreur TypeScript) avant de te
l'envoyer. Ce paquet contient donc à la fois le rattrapage du module
"découverte locale" (déjà livré précédemment, mais que ma copie avait perdu)
ET la nouveauté de ce tour : l'itinéraire 100% autonome.

## A. Réponse à ta question

**Non**, le mode itinéraire n'était pas autonome : `RouteSheet` ouvrait un
nouvel onglet vers Google Maps. Un second point similaire existait dans la
messagerie (position partagée par un client). Les deux sont corrigés.

## B. Fichiers à copier dans ton dépôt

**Nouveau :**
- `src/lib/routing.ts` — calcul d'itinéraire via **OSRM** (Open Source
  Routing Machine, open source, gratuit, sur données OpenStreetMap).

**À remplacer intégralement :**
- `src/components/map-view.tsx` — dessine le tracé sur la carte Leaflet de
  l'app, logos sur les pins, détection de déplacement manuel.
- `src/pages/Carte.tsx` — `RouteSheet` réécrit (distance, durée, marche/
  voiture, étapes) + tout le module découverte locale (quartier, "ouvert
  maintenant", vue liste, "rechercher dans cette zone").
- `src/pages/Messages.tsx` — la position partagée ouvre `/carte?lat=&lng=`
  au lieu de Google Maps.
- `src/pages/CreerBoutique.tsx`, `src/pages/Boutique.tsx` — module
  découverte locale (type de boutique, quartier, repère, photos, horaires).
- `src/components/la-guerite-chat.tsx` — correction de la hiérarchie de
  recommandation (pertinence avant boost) + quartier/statut ouvert transmis
  à l'IA.
- `src/lib/queries.ts`, `src/lib/i18n.ts` — hooks et traductions associés.

**Nouveau (SQL, si pas déjà fait)** :
- `supabase/migrations/0011_geo_discovery.sql` — si tu l'as déjà exécutée
  lors du lot précédent, ignore-la (elle est de toute façon idempotente,
  `if not exists` partout).

Rien d'autre n'est modifié.

## C. Comment fonctionne l'itinéraire maintenant

1. Tu cliques "Itinéraire" sur une boutique → un calcul est lancé via OSRM
   (routage réel sur les rues, comme Google Maps, mais open source).
2. Le tracé s'affiche directement sur la carte Leaflet de DabbyMarket — le
   trait doré si le calcul a réussi, un trait gris pointillé si seul un
   calcul approximatif (ligne directe) a pu être fait.
3. Une fiche en bas d'écran indique distance, durée, et propose de basculer
   à pied / en voiture, avec la liste des étapes dépliable.
4. **Aucun lien externe, aucune app tierce ouverte.**

## D. Limite honnête à connaître

Le serveur utilisé (`router.project-osrm.org`) est le **serveur de
démonstration public d'OSRM** : gratuit, mais à usage raisonnable (~1
requête/seconde, sans garantie officielle de disponibilité). C'est
largement suffisant pour lancer DabbyMarket, mais si le volume grossit
fortement, la solution propre est d'auto-héberger OSRM : c'est le même
logiciel open source, gratuit, tournant sur un petit serveur (quelques
dollars/mois) avec les données OpenStreetMap du Cameroun téléchargées une
fois pour toutes. Le code de `routing.ts` n'aurait alors qu'une seule ligne
à changer (`OSRM_BASE`) — je peux préparer cette bascule quand tu seras
prêt à passer à l'échelle.

Autre point à surveiller : la précision des itinéraires dépend de la
qualité des données OpenStreetMap à Yaoundé, qui peut être inégale selon
les quartiers (certaines petites rues non cartographiées). Le repli en
ligne directe (clairement annoncé "trajet approximatif") gère ce cas sans
jamais bloquer l'utilisateur.

## E. Test à faire

1. Ouvrir une boutique physique sur la Carte → "Itinéraire" → vérifier
   qu'aucun onglet externe ne s'ouvre et qu'un tracé apparaît.
2. Couper la position (refuser la géolocalisation) → vérifier le message
   "active ta position" au lieu d'un écran vide.
3. Basculer à pied / en voiture → vérifier que la distance/durée changent.
4. Dans une conversation avec une position partagée → vérifier qu'elle
   ouvre `/carte` en interne.
