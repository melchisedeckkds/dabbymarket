# Dabby Disponibilité — nouvelles fonctionnalités de DabbyMarket

> **DabbyMarket — Trouvez ce que vous cherchez, là où c'est disponible.**
> *Rendre visible ce qui existe déjà.*

Ce document décrit ce que la mise à jour apporte, comment cela fonctionne, ce que l'audit du code a révélé, les décisions prises, et — avec la même franchise — ce qui **n'est pas** livré ou **n'a pas** été testé.
Pour installer la mise à jour : voir `GUIDE_MISE_A_JOUR_DISPONIBILITE.md`.

---

## 1. En une page

DabbyMarket savait déjà répondre à « **où se trouve cette boutique ?** ». Il répond maintenant aussi à « **ce produit y est-il disponible, à quel prix, et puis-je faire confiance à cette information avant de me déplacer ?** » — à partir de votre cas d'usage fondateur, la bouteille de gaz à Yaoundé.

| Pour… | Ce qui change |
|---|---|
| **L'utilisateur** | Recherche de produit géolocalisée sur la carte, bulle de produit au-dessus des boutiques, filtres (disponible, récent, prix, distance), alertes de retour en stock, notes et avis par article, signalements, centre de notifications |
| **Le commerçant** | Déclaration de disponibilité en un appui, « Tout est à jour » en un clic, rappels discrets, avis reçus avec droit de réponse, statistiques de demande locale anonymisées |
| **L'administrateur** | Catégories hiérarchiques sans code, catalogue de produits de référence, 14 règles réglables, modération des avis |
| **La confiance** | Chaque information affiche **qui l'affirme et depuis quand** ; une information périmée n'est jamais présentée comme une disponibilité confirmée |

**Principe directeur** : *la fiabilité de la disponibilité passe avant la multiplication des fonctionnalités.* Mieux vaut dix produits correctement actualisés que mille produits périmés.

---

## 2. Fonctionnalités détaillées

### 2.1 Les quatre états (plus un état technique)

| État affiché | Signification | Couleur | Peut être présenté comme « disponible » ? |
|---|---|---|---|
| **Disponible** | Déclaré par la boutique ET confirmé récemment | vert | Oui, avec « déclaré par la boutique · il y a 12 min » |
| **Stock limité** | Idem, en faible quantité | orange | Oui |
| **À reconfirmer** | Déclaré, mais la confirmation est plus ancienne que la durée de validité | gris | **Non** — « le produit n'est pas forcément épuisé » |
| **Information contestée** | ≥ 2 utilisateurs distincts signalent « épuisé » depuis la dernière confirmation | rouge clair | **Non** |
| **Rupture de stock** | Déclarée par la boutique | rouge | Non |
| *Non renseignée* (technique) | La boutique n'a jamais déclaré | — | Non, et absent des bulles de carte |

Un produit en rupture **ne disparaît jamais** de la boutique : il reste visible avec « M'avertir au retour en stock ». Une information périmée devient « à reconfirmer », **jamais** « rupture » : l'application ne transforme pas silencieusement un doute en certitude.

### 2.2 Durée de validité (TTL) — par catégorie

Une confirmation reste « récente » pendant une durée réglable par catégorie (valeurs initiales : gaz 8 h, alimentation 12 h, mode / électronique / maison / beauté / pièces auto 72 h, construction / agriculture 48 h) — ou par article. Valeur globale par défaut : 12 h. *Vérifié : un article confirmé il y a 5 h est « disponible », à 9 h il devient « à reconfirmer » (catégorie gaz, 8 h).*

### 2.3 Carte

- **Point de couleur** sur chaque marqueur qui possède une information de disponibilité.
- **Bulle flottante** au-dessus du marqueur : produit, état, prix déclaré, note, fraîcheur.
- **Choix du produit affiché** : (1) pertinence par rapport à la recherche — le gaz recherché prime sur les boissons « populaires » de la même boutique ; (2) état (disponible avant stock limité avant à reconfirmer…) ; (3) popularité (likes + 2 × avis) ; (4) fraîcheur.
- **Anti-surcharge** : bulles seulement à partir du zoom 14, une seule par cellule d'écran, 14 au maximum, par ordre de pertinence ; la boutique sélectionnée affiche toujours la sienne. Aucune dépendance ajoutée.
- **Filtres** : Disponible uniquement · Confirmé récemment (2 h) · Prix max · Distance · Catégorie · Quartier · Ouvert maintenant (existants conservés).
- **Aucun résultat** : message clair + bouton « M'avertir quand il sera disponible » (alerte sur le produit de référence si la recherche le désigne sans ambiguïté, sinon sur le texte).
- **Fiche boutique de la carte** : « Produits ici » avec état et fraîcheur ; le bouton « Contacter » devient « Confirmer avec la boutique » (messagerie existante).
- Un bandeau rappelle : *« La disponibilité est déclarée par la boutique : ce n'est pas une réservation. »*

### 2.4 Fiche boutique et fiche article

Boutique : articles regroupés **Disponibles / Stock limité / À reconfirmer / Actuellement indisponibles**, puis la grille habituelle pour les autres articles (aucune régression pour les boutiques qui n'utilisent pas la disponibilité). Indicateur de **fiabilité** de la boutique (formulations explicites : « disponibilité régulièrement actualisée », « informations à reconfirmer », « historique insuffisant » — jamais un score opaque, jamais présenté comme une certification).
Article : état, fraîcheur, quantité déclarée (si renseignée), conditions de vente, mention « trouvé récemment par un utilisateur », boutons *Signaler* et *M'avertir*.

### 2.5 Trois notes, jamais confondues

| Indicateur | Ce qu'il mesure | Où |
|---|---|---|
| **Note de l'offre** | L'article **dans cette boutique** | Fiche article (nouveau) |
| **Note du produit de référence** | « Bouteille de gaz 12,5 kg » toutes boutiques confondues | Fiche article, si l'article est rattaché au catalogue |
| **Réputation de la boutique** | Avis boutique existants | Inchangée |
| *Fiabilité de la disponibilité* | Fraîcheur et cohérence des déclarations | Indicateur à part |

Règles des avis : 1 à 5 étoiles + commentaire (600 car.), **un avis par utilisateur et par article, modifiable ou supprimable**, pas de lien, pas d'auto-notation par le marchand, compte d'au moins 12 h, 10 avis/jour maximum, signalement (3 signalants distincts ⇒ masquage automatique en attente de modération), réponse publique du marchand.
**Honnêteté sur la vérification** : le badge **« Réception confirmée »** signifie que l'acheteur a confirmé la réception dans la messagerie (donnée déclarative **existante**). Ce n'est **pas** une preuve d'achat et l'interface ne le présente **pas** comme « achat vérifié ».

### 2.6 « Les Trouvailles » (bandeau du Marché)

Articles appréciés avec leur **statut réel** affiché. Classement : *note bayésienne* (un seul avis 5/5 ne dépasse pas un article 4,8 sur 150 avis) + bonus de récence des avis + bonus de disponibilité confirmée ; diversité : ≤ 2 articles par boutique et ≤ 3 par catégorie ; au moins 2 avis requis ; les articles en rupture ou jamais confirmés n'y figurent pas. Limite connue : sans historique d'usage, le classement est un point de départ (pas de personnalisation, pas de proximité).

### 2.7 Alertes et notifications

- **Alertes** : sur un article (« M'avertir au retour en stock »), sur un produit de référence (avec prix max et quartier) ou sur une recherche. 30 alertes maximum par utilisateur.
- **Événements** : retour en stock, changement de prix d'un article suivi, nouvel article d'une boutique suivie.
- **Marchands** : nouvel avis, signalement d'information incorrecte, forte demande dans le secteur, rappel quotidien « à reconfirmer ».
- **Anti-spam** : déduplication (une alerte de retour en stock par article et par fenêtre de 6 h, même si le marchand alterne les états), plafond quotidien réglable (12 par défaut), préférences par type, 300 abonnés notifiés au maximum par nouvel article.
- **Confidentialité** : chacun ne voit que ses notifications (politique RLS) ; les alertes d'un utilisateur ne sont jamais visibles des commerçants.
- **Canal** : centre de notifications dans l'application + écoute temps réel (Supabase Realtime). **Pas de notification push application fermée** (voir §8).

### 2.8 Demande locale et « Je cherche ce produit »

Livré : chaque recherche sans résultat disponible alimente un **journal anonyme** (un enregistrement par utilisateur, par recherche et par jour, effacé après 90 jours, illisible côté client). Les commerçants voient, dans « Ma disponibilité », les produits recherchés dans leur secteur **uniquement au-delà d'un seuil d'anonymat de 3 personnes** ; un job quotidien (07 h) les prévient quand ≥ 5 personnes ont cherché un produit qu'ils vendent habituellement.
**Décision argumentée — tableau public de demandes reporté** : une demande publiée expose l'identité et la localisation, ouvre la voie au spam commercial et aux fausses demandes, et suppose une masse critique de commerçants actifs. L'alerte privée + la demande agrégée anonyme apportent l'essentiel de la valeur sans ces risques. À reconsidérer après le pilote.

### 2.9 Catégories administrables (Admin → Disponibilité)

Hiérarchie libre (Énergie → Gaz domestique → …), nom FR/EN, icône, ordre, activation, durée de validité, unités de vente, **attributs propres à la catégorie** (texte / nombre / liste, obligatoires ou non), catégorie réglementée, ouverture aux articles de disponibilité. Les 6 identifiants historiques sont conservés : aucun article ni boutique n'est réaffecté. Les sélecteurs (Marché, Carte, Publier, Créer une boutique, Vente Flash) lisent maintenant ces catégories ; si la base n'en renvoie aucune, la liste statique historique reprend la main. Les catégories **réglementées** n'apparaissent pas dans les formulaires de création.

### 2.10 La Guérite (chatbot)

Le chatbot existant a été **enrichi, pas remplacé** : chaque produit du prompt porte sa disponibilité effective et sa fraîcheur, avec des règles explicites (ne jamais inventer un stock/prix/quantité, signaler l'ancienneté ou la contestation, ne jamais déclarer une rupture non marquée, rappeler que ce n'est pas une réservation). Ses réponses peuvent contenir des **liens internes** cliquables (`/boutique/…`, `/produit/…`, `/carte?q=…`) ; les liens externes sont refusés au rendu.

---

## 3. Parcours (A → G)

| Parcours | Entrée | Étapes principales | Écrans |
|---|---|---|---|
| **A. Chercher du gaz** | Marché (encart) ou Carte | Saisir « gaz 12,5 kg » → bulles et liste → filtrer → fiche boutique → *Confirmer avec la boutique* / itinéraire → *Signaler* | Marché, Carte (carte/liste), fiche boutique |
| **B. Découvrir un produit** | Marché → Trouvailles | Carte article → boutique ou carte → vérifier l'état | Marché, fiche boutique/article |
| **C. Suivre un produit** | Fiche article/boutique | *M'avertir* → notification au retour en stock | Notifications → Mes alertes |
| **D. Marchand : mettre à jour** | Compte → Ma disponibilité | 3 boutons Disponible/Limité/Rupture, quantité facultative, prix inline, *Tout est à jour* | `/disponibilite` |
| **E. Marchand : avis** | Notification | Lire, répondre, signaler, mettre à jour l'article | Fiche article |
| **F. Admin** | Admin → Disponibilité | Catégories, catalogue, règles, avis masqués | Admin |
| **G. Aucun résultat** | Carte | Message → *M'avertir…* (+ demande anonyme comptabilisée) | Carte |

États de chargement, vides et d'erreur : chaque lecture du module est tolérante (liste vide plutôt qu'écran cassé) ; chaque action affiche un message d'erreur explicite (« compte trop récent », « limite atteinte », etc.).

---

## 4. Règles métier réglables (Admin → Disponibilité → Règles)

| Clé | Défaut | Effet |
|---|---|---|
| `availability_default_ttl_hours` | 12 | Validité d'une confirmation (défaut global) |
| `availability_contest_threshold` | 2 | Signalants « épuisé » distincts pour contester |
| `availability_contest_window_hours` | 6 | Fenêtre de prise en compte des signalements |
| `report_min_account_age_hours` | 12 | Ancienneté minimale pour signaler |
| `review_min_account_age_hours` | 12 | Ancienneté minimale pour noter |
| `review_daily_limit` | 10 | Avis/jour/utilisateur |
| `review_report_hide_threshold` | 3 | Signalants masquant un avis |
| `max_stock_items_per_shop` | 60 | Plafond d'articles de disponibilité |
| `stock_items_count_toward_quota` | 0 | 1 = facturés comme les articles vitrine |
| `trouvailles_min_reviews` | 2 | Avis minimum pour les Trouvailles |
| `demand_alert_threshold` | 5 | Chercheurs déclenchant l'alerte « forte demande » |
| `demand_k_anonymity` | 3 | Seuil d'anonymat des statistiques de demande |
| `notify_max_per_day_default` | 12 | Plafond de notifications clients |
| `notify_followers_cap` | 300 | Abonnés notifiés par nouvel article |

**Résistance aux abus de signalement** : un signalement n'est compté que s'il vient d'un compte ancien, distinct du marchand, **postérieur à la dernière confirmation** (le marchand peut donc toujours rétablir la situation d'un clic), une seule fois par signalant et par type, et toute déclaration de la communauté « trouvé » **n'écrase jamais** la déclaration du marchand : elle s'ajoute comme indication.

---

## 5. Architecture

### 5.1 Intégration à l'existant (additive)

| Existant | Traitement |
|---|---|
| `products` (déjà propre à une boutique ⇒ c'est déjà une *offre*) | **+10 colonnes** (`listing_kind`, `availability_status`, `availability_confirmed_at`, `stock_qty`, `catalog_item_id`, `sale_unit`, `sale_conditions`, `attributes`, `availability_ttl_hours`, `show_on_map`). Aucun produit existant n'est modifié. |
| Produit générique vs offre | Nouveau `catalog_items` (produit de référence, ex. gaz 12,5 kg) ; `products.catalog_item_id` relie l'offre au produit de référence ⇒ comparaison et note générique possibles |
| Catégories statiques (`categories.ts`) | Nouveau `product_categories` (mêmes ids) ; la liste statique reste le repli |
| Avis boutique `reviews` | **Inchangés** ; nouveau `product_reviews` (par article) |
| Signalements `reports` | Même table, type `product_review` ajouté |
| Carte (`active_shop_locations`) | Réutilisée telle quelle ; la RPC `availability_search` s'appuie sur `shop_locations` |
| Pépites / boosts / quota | Inchangés ; les articles de disponibilité sont exclus du quota (réglable). **Un boost ne peut jamais rendre un article « disponible »** |
| Fil du Marché | Les articles `stock` en sont exclus (ils vivent en boutique, carte et recherche) |

Nouveaux objets SQL : tables `product_categories`, `catalog_items`, `availability_events` (historique), `availability_reports`, `product_reviews`, `notifications`, `notification_prefs`, `availability_alerts`, `search_demand_log` ; vues `product_availability` (état effectif), `product_rating_stats`, `catalog_rating_stats`, `shop_availability_reliability` ; fonctions `availability_search`, `get_trouvailles`, `set_product_availability`, `confirm_product_availability`, `confirm_shop_availability`, `report_availability`, `submit_product_review`, etc. ; 2 tâches `pg_cron`.

### 5.2 Sécurité

- **L'état est calculé à la lecture** (vue `product_availability`, `security_invoker`) : rien à « expirer » par tâche de fond, pas de désynchronisation.
- **Le client ne choisit jamais la date de confirmation** : un déclencheur la pose côté serveur quand le statut ou la quantité change.
- **Avis, signalements, notifications : écriture uniquement par fonctions serveur** ; aucune politique d'insertion directe.
- **Identité des signalants jamais lisible** (droits de colonnes) ; journal de demande illisible par les clients.
- Catégories et catalogue : écriture réservée aux administrateurs (RLS).
- Historique des changements : lisible par le marchand concerné et l'administrateur seulement.

### 5.3 Performance (mesurée)

Environnement : PostgreSQL 16 de test (pas le matériel Supabase), **3 001 boutiques, 15 000 articles de disponibilité, 4 000 avis**.

| Requête | Temps mesuré |
|---|---|
| Carte générale, 10 km autour de Yaoundé, 150 résultats | ≈ 150 ms |
| Recherche « gaz 12,5 kg » avec position, 5 km, 200 résultats | ≈ 490 ms |
| Recherche « gaz », toute la ville, disponibles uniquement, 200 résultats | ≈ 780 ms |
| Fiche boutique (vue de disponibilité) | < 1 ms |

Acceptable pour un pilote ; à surveiller au-delà de quelques dizaines de milliers d'articles. Mesures déjà en place : plafond de 400 lignes par requête, résultats mis en cache 60 s côté client avec clé arrondie (une carte déplacée de quelques mètres ne relance pas la requête), icônes de marqueurs mises en cache, bulles plafonnées. Pistes si besoin : index trigramme sur les noms, vue matérialisée de la disponibilité, PostGIS.

---

## 6. Ce que l'audit du code a révélé

### 6.1 Faits observés (dans le code fourni)
- **Pile** : React 19, Vite 8, TypeScript 6, Tailwind 4, TanStack Query 5, Supabase (Postgres + RLS + Edge Function), Leaflet 1.9 / react-leaflet 5, PWA (service worker) et projet Capacitor Android.
- **Base** : 16 migrations (0001 → 0016) ; boutiques à emplacements multiples (0015) ; Ventes Flash (0016) ; économie en Pépites, boosts, quota gratuit de 3 articles (0012).
- **« Pépites » = monnaie virtuelle**, pas un flux de publications. Le document de départ décrit un flux « Pépites » : il n'existe pas dans le code ⇒ le nouveau bandeau s'appelle « Trouvailles ».
- Les produits sont déjà **par boutique** ; il n'existait ni produit de référence, ni statut de stock, ni note par article (les avis portent sur la boutique), ni centre de notifications (seulement un compteur de messages non lus), ni catégories éditables (6 constantes en code).
- La carte charge **tous** les emplacements actifs puis filtre côté client ; pas de requête spatiale.
- Le chatbot construit son contexte côté client à partir des données publiques.

### 6.2 Problèmes découverts et traités
| # | Constat | Gravité | Statut |
|---|---|---|---|
| 1 | `revoke update (col)` de la migration 0001 sans effet sur Supabase ⇒ un utilisateur connecté pouvait se donner `is_admin` et des Pépites (**reproduit en base de test simulant les droits Supabase ; à confirmer sur votre projet**) ; même schéma pour `shops.verified` et `products.boosted_until` | **Critique** | Corrigé (0017, testé) |
| 2 | Marqueurs de carte : nom, logo injectés dans du HTML **sans échappement** (injection possible si une valeur malveillante est enregistrée) — constat de lecture du code, **non exploité en pratique** | Moyenne | Corrigé (échappement + URL d'image filtrée, testé unitairement) |
| 3 | `Carte.tsx` ne recopie pas `owner_id` dans ses pins alors que la vue le fournit : « Contacter » / « Livraison » depuis la fiche de la carte envoient un vendeur `undefined` — constat de lecture du code, **non reproduit dans un navigateur** | Moyenne | Corrigé (1 ligne) |

### 6.3 Observations non traitées (hors périmètre)
- La fonction Edge du chatbot reçoit le *prompt système* du client : un utilisateur averti peut le modifier (usage détourné du quota d'IA). À envisager : construire le prompt côté serveur.
- Le « achat confirmé » (`conversations.order_confirmed`) est déclaratif : l'acheteur le déclare lui-même. D'où le libellé « réception confirmée » et non « achat vérifié ».
- Hygiène du dépôt (copies `src1/`, `pages2/`, archives, `.env` suivi) : voir le guide, §9.

---

## 7. Décisions de conception (les 15 questions de la mission)

| # | Question | Décision |
|---|---|---|
| 1 | Module indépendant ou évolution transversale ? | **Transversale** : une colonne d'état sur l'article existant, réutilisée par carte, boutique, chatbot, Marché |
| 2 | ON/OFF ou modèle plus riche ? | **4 états affichés** (+ 1 technique) ; le marchand ne manipule que 3 boutons ; le reste est calculé |
| 3 | Surcharge de la carte ? | Zoom ≥ 14, 1 bulle / cellule, ≤ 14 bulles, point de couleur sinon |
| 4 | Produit mis en avant ? | Pertinence > état > popularité > fraîcheur (SQL) |
| 5 | Produit populaire indisponible ? | Visible avec son vrai statut ; exclu des Trouvailles ; jamais présenté comme achetable |
| 6 | Note produit vs réputation boutique ? | Trois indicateurs distincts (§2.5) |
| 7 | Faux avis / fausses déclarations ? | Ancienneté de compte, quotas, 1 avis/article, pas de lien, signalements pondérés par l'ancienneté et la postérité à la confirmation, masquage auto, modération |
| 8 | Motiver les commerçants ? | « Tout est à jour » en 1 clic, « Toujours là », rappel quotidien groupé, indicateur de fiabilité, statistiques de demande locale, visibilité sur la carte |
| 9 | Faibles débits, appareils modestes ? | Requêtes plafonnées, cache, aucune dépendance ajoutée, lectures tolérantes. Poids mesuré (build, avant → après) : Carte 28,9 → 34,5 kB (gzip 7,9 → 9,4), Marché 15,7 → 21,4, Boutique 17,8 → 21,8, Produit 11,4 → 19,8, Admin 64,1 → 80,2 ; bundle principal inchangé (407 → 404 kB) ; nouvelles pages chargées à la demande : Disponibilité 12,8 kB, Notifications 6,6 kB |
| 10 | Complexité ? | Pas de nouvelle page publique ; extensions des pages existantes ; 2 pages seulement (marchand, notifications) |
| 11 | Indispensable | Disponibilité, TTL, carte, fiche boutique, signalements, avis article, alertes retour en stock |
| 12 | Peut attendre | Push, comparaison de prix (écran), demandes publiques, listes de recherche, mode « urgence », statistiques avancées |
| 13 | Risques d'adoption | Marchands qui n'actualisent pas (§10) |
| 14 | Mécanismes de confiance | Qui/quand affiché, TTL, contestation, historique, fiabilité, honnêteté sur ce qui est déclaratif |
| 15 | Avantage concurrentiel | Le **réseau d'information locale actualisée** (pas la carte seule) : données de disponibilité et de demande propres à votre marché |

**Écarté ou modifié par rapport à vos documents** : « Pépites » (nom) → « Trouvailles » ; tableau public de demandes → reporté ; « achat vérifié » → « réception confirmée » ; ON/OFF seul → 3 boutons + 2 états calculés.

---

## 8. Ce qui n'est PAS livré (et pourquoi)

| Élément | Raison / suite |
|---|---|
| **Notifications push (application fermée)** | Exige des clés VAPID, une fonction Edge d'envoi et un gestionnaire dans le service worker, que je ne peux pas tester ici. Les notifications existent en base : l'ajout du push se branchera sur la même table (≈ 1 journée) |
| Écran de **comparaison de prix** | Le modèle de données le permet (produit de référence + prix déclarés) ; pas d'écran dédié dans cette version |
| Tableau public « Je cherche ce produit » | Décision argumentée (§2.8) |
| Listes de recherche, mode « urgence », e-mail/WhatsApp | Après validation du pilote |
| Regroupement de marqueurs (clustering) | Remplacé par l'arbitrage des bulles ; à ajouter si > 500 boutiques par écran |
| Stock par succursale | L'état appartient à l'article : une boutique multi-succursales l'affiche sur chacune de ses adresses |
| Statistiques avancées, gestion de stock niveau 3 (entrées/sorties) | L'historique est enregistré (table `availability_events`) mais sans écran |
| **Recherche externe de marché** | **Non réalisée** dans cette livraison : aucune donnée de marché externe n'est citée dans ce document. Les hypothèses stratégiques viennent de vos documents ; elles restent à confronter à des sources |

---

## 9. Ce qui a été testé — et ce qui ne l'a pas été

| Domaine | Méthode | Résultat |
|---|---|---|
| Migrations 0001 → 0018 | Rejeu complet sur PostgreSQL 16 (Supabase simulé : rôles, `auth`, `storage`, droits par défaut) | ✅ sans erreur ; 0018 rejouable (idempotente) |
| Migration sur base **déjà remplie** | 5 articles, 1 abonnement, boutique existante | ✅ données identiques ; 0 notification ou historique parasite ; anciens articles « non renseignés » et absents de la carte |
| Retour arrière | Script exécuté puis comparaison du schéma | ✅ schéma identique à 0001 → 0017 ; 0018 ré-applicable |
| Sécurité (0017) | 4 attaques + 3 usages légitimes | ✅ |
| Règles métier SQL | Création, statuts, historique, TTL, contestation, reconfirmation, « Tout est à jour », alertes + déduplication + prix max, avis (création, modification, lien refusé, auto-notation refusée, compte neuf refusé, masquage auto à 3 signalants), demande agrégée (seuil d'anonymat), notification aux abonnés, quota, catégorie réglementée refusée, permissions entre marchands | ✅ (≈ 50 vérifications affichées) |
| Lecture publique (`anon`) | Recherche, trouvailles, vues | ✅ ; identité des signalants refusée |
| Performances SQL | 3 001 boutiques / 15 000 articles | ✅ voir §5.3 |
| TypeScript | `tsc -b` | ✅ 0 erreur |
| Build | `vite build` | ✅ |
| Lint | `oxlint` | ✅ 0 erreur, 28 avertissements = identique au dépôt d'origine |
| Utilitaires TS | Normalisation, échappement HTML anti-XSS, fraîcheur, reconnaissance du produit | ✅ 12 vérifications + 4 |
| **Interface dans un navigateur** | — | ❌ **Non exécutée.** Rendu mobile, bulles de carte, Realtime, flux complets : à valider avec la recette du guide (§5) |
| Réseau dégradé / hors ligne | — | ❌ Non testé (les lectures sont conçues pour retomber sur « vide ») |
| Montée en charge côté Supabase réel | — | ❌ Non testé |

---

## 10. Registre des risques

| # | Risque | Cause | Conséquence | Prob. | Gravité | Prévention | Correction |
|---|---|---|---|---|---|---|---|
| R1 | Marchands qui n'actualisent pas | Manque de temps / d'intérêt | Données périmées, perte de confiance | **Élevée** | **Élevée** | TTL ⇒ « à reconfirmer » (jamais affirmatif), « Tout est à jour », rappels groupés, pilote ciblé | Démarrer par un quartier ; visite et formation ; baisser les TTL |
| R2 | Stock vendu entre la déclaration et l'arrivée | Réalité du terrain | Déplacement inutile | **Élevée** | Moyenne | « Ce n'est pas une réservation », *Confirmer avec la boutique*, fraîcheur affichée | Mesurer le taux de confirmation sur place (KPI) |
| R3 | Faux signalements (concurrent) | Malveillance | Disponibilité contestée à tort | Moyenne | Moyenne | Comptes anciens, signalants distincts, postérieur à la confirmation, reconfirmation en 1 clic | Modération ; relever les seuils |
| R4 | Faux avis / avis gonflés | Comptes multiples | Notes trompeuses | Moyenne | Moyenne | Ancienneté, quotas, 1 avis/article, pas de lien, masquage auto, réponse marchand | Modération admin ; relever l'ancienneté |
| R5 | Faille d'escalade de droits (0001) toujours présente | 0017 non appliquée | Prise de contrôle admin, Pépites frauduleuses | Moyenne | **Critique** | Appliquer 0017 en premier | Auditer `is_admin` et soldes (requête du guide) |
| R6 | Coût de facturation perçu par les marchands | Quota de 3 articles | Frein à l'adoption | Moyenne | Moyenne | Articles de disponibilité exclus du quota | Paramètre `stock_items_count_toward_quota` |
| R7 | Dégradation des performances | Croissance du nombre d'articles | Carte lente | Faible (pilote) | Moyenne | Plafonds, cache, rayon | Index trigramme, vue matérialisée, PostGIS |
| R8 | Produits réglementés (médicaments…) | Catalogue ouvert | Risque légal | Faible | **Élevée** | Catégorie `sante` fermée et réglementée par défaut ; absente des formulaires | Liste blanche explicite par l'admin |
| R9 | Notifications perçues comme du spam | Trop d'alertes | Désinscription, désinstallation | Moyenne | Faible | Déduplication, plafond, préférences | Ajuster plafonds |
| R10 | Données de localisation / de recherche exposées | Mauvaise conception | Atteinte à la vie privée | Faible | **Élevée** | Journal illisible côté client, seuil d'anonymat, identité des signalants masquée, pas de position précise stockée | Revue RLS avant ouverture |
| R11 | Régression sur l'existant | Fichiers modifiés (16) | Bug en production | Moyenne | Moyenne | Modifications ciblées, build/lint identiques, lectures tolérantes, retour arrière testé | Revert de la PR |
| R12 | Interface non validée en navigateur | Test non exécuté ici | Défaut visuel | **Élevée** | Faible à moyenne | Recette du guide, Deploy Preview | Correctifs rapides |

---

## 11. Indicateurs de réussite

*Aucun objectif chiffré arbitraire avant d'avoir observé le pilote* (comme dans votre document) ; les mesures sont directement calculables avec les données du module.

| Famille | Indicateur | Source |
|---|---|---|
| **Adoption** | Commerces ayant déclaré ≥ 1 article ; commerces actifs sur 7 jours | `availability_events` |
| | Utilisateurs ayant fait une recherche de disponibilité ; ayant créé une alerte | `search_demand_log`, `availability_alerts` |
| **Qualité des données** | Taux d'articles « récents » (dans leur TTL) | `product_availability` |
| | Délai médian entre deux mises à jour | `availability_events` |
| | Taux de contestation et de reconfirmation après contestation | `availability_reports` + événements |
| | Taux de disponibilité **confirmée sur place** (signalements « trouvé » ÷ visites) | `availability_reports` |
| **Satisfaction** | Note moyenne des offres ; part des avis « réception confirmée » | `product_rating_stats` |
| | Signalements « déplacement inutile » (épuisé / prix différent) | `availability_reports` |
| **Performance commerciale** | Recherches sans résultat par produit (demande non satisfaite) | `search_demand_log` |
| | Délai entre alerte et retour en stock | `availability_alerts.last_notified_at` |
| **Technique** | Temps de réponse de `availability_search` ; erreurs RPC | Logs Supabase |

---

## 12. Feuille de route

| Phase | Contenu | État |
|---|---|---|
| **1 — Socle de disponibilité** | États, historique, catalogue, carte, recherche, catégories | ✅ Livrée |
| **2 — Confiance** | Avis par article, signalements, fraîcheur, fiabilité, modération | ✅ Livrée |
| **3 — Notifications** | Alertes, centre de notifications, préférences, temps réel | ✅ Livrée (hors push) |
| **4 — Découverte et demande** | Trouvailles, demande agrégée | ✅ Partielle — **reste** : comparaison de prix, tableau de demandes (après pilote), listes de recherche |
| **5 — Intelligence commerciale** | Statistiques de demande | ✅ Partielle — **reste** : statistiques détaillées, gestion de stock avancée, services professionnels payants |
| **3b — Push** | Web Push (VAPID + Edge Function + service worker) | ⏳ À planifier |

**Conditions avant ouverture au public** : (1) 0017 appliquée et contrôlée ; (2) recette navigateur complète ; (3) décisions §7 du guide prises ; (4) pilote de 3-5 commerçants de gaz dans un quartier ; (5) catégories sensibles vérifiées (`sante` fermée) ; (6) page CGU mise à jour (déclaratif, signalements, données de recherche anonymes).
