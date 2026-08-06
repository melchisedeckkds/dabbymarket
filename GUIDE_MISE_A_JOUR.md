# Guide de mise à jour — DabbyMarket (audit + correctifs)

Ce document explique **ce qui a été vérifié**, **ce qui manquait**, **ce qui a
été modifié**, et **comment mettre à jour votre dépôt GitHub existant sans
l'écraser**.

---

## 1. Résultat de l'audit

| Fonctionnalité demandée | État trouvé | Action |
|---|---|---|
| Fenêtre d'invitation à installer l'app à chaque chargement | Composant `install-prompt.tsx` présent mais **jamais affiché** (non monté) | Corrigé |
| Photo de profil utilisateur (galerie) | Opérationnel (`Compte.tsx` + bucket `avatars`) | OK |
| Photo de profil des boutiques (galerie) | Opérationnel (`CreerBoutique.tsx`, `Compte.tsx`, bucket `shop-logos`) | OK |
| Publication simple → nom + photo de l'utilisateur | Opérationnel (`Marche.tsx`) | OK |
| Publication d'article → choix de la boutique si plusieurs | Opérationnel (`Publier.tsx`, sélecteur affiché dès 2 boutiques) | OK |
| Article → nom + logo de la boutique affichés | Opérationnel (`product-card.tsx`) | OK |
| Clic sur le profil d'une publication → page utilisateur | Page `Profil.tsx` présente mais **aucune route `/profil/:id`** → lien mort | Corrigé |
| Page utilisateur (nom, numéro, photo, boutiques, publications) | Opérationnel une fois la route ajoutée | OK |
| Clic sur une boutique → page de description boutique | Opérationnel (`Boutique.tsx`) | OK |
| Clic sur le profil d'un article → page de la boutique | Opérationnel | OK |
| Admin : bloquer une boutique | Code front présent, **fonction SQL `admin_set_shop_blocked` et colonne `is_blocked` absentes** | Corrigé |
| Admin : supprimer une publication / un article | Fonctions front présentes mais **aucun écran** pour les utiliser + RPC SQL absentes | Corrigé |
| Admin : suspendre / supprimer un compte | Front présent, **RPC SQL absentes** | Corrigé |
| Admin : confirmer la réception d'un dépôt pour créditer les Pépites | Opérationnel (`confirm_recharge`, onglet Aperçu → recharges en attente) | OK |
| Signalements (utilisateurs → admin) | Front présent, **table `reports` absente en base** | Corrigé |
| Fenêtres d'incitation animées (30 s max, fermables, ciblées) | Composant `engagement-popups.tsx` présent mais **jamais affiché** | Corrigé |
| Scroll infini du Marché | Opérationnel (`useInfiniteProducts` / `useInfinitePosts` + IntersectionObserver) | OK |
| Notation boutique 1→5 étoiles après réception | Front opérationnel (`Messages.tsx`), mais **vue `shop_ratings` absente** → note jamais affichée | Corrigé |
| Note + nombre de votes à côté de chaque boutique et de chaque article | Opérationnel une fois la vue créée | OK |
| Animations générales (transitions de page, cascades, micro-interactions) | Opérationnel (framer-motion) | OK |

**Conclusion :** le code applicatif était à ~90 % prêt. Les deux vrais
blocages étaient (a) trois composants/pages jamais branchés dans `App.tsx`,
et (b) une migration SQL manquante — toute la couche modération + notation
appelait des objets inexistants en base (échec silencieux ou erreur 404 des
RPC).

---

## 2. Fichiers modifiés / ajoutés

### Ajoutés
| Fichier | Contenu |
|---|---|
| `supabase/migrations/0009_moderation_ratings.sql` | **NOUVEAU — indispensable.** Colonnes `shops.is_blocked`, `profiles.is_blocked` ; table `reports` ; vue `shop_ratings` (moyenne + nombre de votes) ; fonction `is_admin()` ; 8 fonctions RPC admin (`admin_set_shop_blocked`, `admin_set_shop_verified`, `admin_delete_post`, `admin_delete_product`, `admin_suspend_account`, `admin_delete_account`, `admin_adjust_pepites`, `admin_resolve_report`) ; politiques RLS pour masquer les boutiques bloquées et empêcher un compte suspendu de publier. |
| `GUIDE_MISE_A_JOUR.md` | Ce document. |

### Modifiés
| Fichier | Modification |
|---|---|
| `src/App.tsx` | Montage de `<InstallPrompt />` et `<EngagementPopups />` ; ajout de la route publique `/profil/:id` (page `Profil`, chargée à la demande). |
| `src/pages/Admin.tsx` | Nouvel onglet **Contenus** : liste des publications et des articles récents avec suppression définitive (confirmation obligatoire). |
| `src/lib/i18n.ts` | 4 clés ajoutées en FR et EN : `admin_tabContent`, `admin_recentPosts`, `admin_recentProducts`, `admin_noContent`. |
| `README.md` | Liste des migrations mise à jour (0009) + guide d'utilisation actualisé. |

Aucun autre fichier n'a été touché. **Rien n'a été supprimé.**

---

## 3. Comment mettre à jour GitHub (sans écraser le dépôt)

### 3.1 Fichiers
Copiez uniquement les **6 fichiers** ci-dessus par-dessus votre copie locale
du dépôt, puis :

```bash
cd chemin/vers/dabbymarket
git checkout -b maj-moderation-notation

git add supabase/migrations/0009_moderation_ratings.sql \
        GUIDE_MISE_A_JOUR.md \
        src/App.tsx src/pages/Admin.tsx src/lib/i18n.ts README.md

git diff --cached          # vérifiez que seuls ces fichiers apparaissent
git commit -m "Modération admin, notation boutiques, fenêtres d'installation et d'engagement"
git push -u origin maj-moderation-notation
```

Ouvrez ensuite la Pull Request sur GitHub et fusionnez-la dans `main`. Cette
méthode ajoute vos modifications à l'historique existant : **aucun fichier
n'est écrasé ni perdu**, et vous pouvez revenir en arrière à tout moment.

> Si vous préférez pousser directement : `git checkout main` puis les mêmes
> `git add` / `git commit` / `git push`. Ne faites **jamais** `git push --force`.

### 3.2 Base de données (obligatoire)
Dans le tableau de bord Supabase → **SQL Editor**, collez et exécutez
**l'intégralité** de `supabase/migrations/0009_moderation_ratings.sql`.
Elle est purement additive (`add column if not exists`, `create or replace`) :
vous pouvez l'exécuter sur la base de production sans perdre de données, et
la rejouer sans risque en cas de doute.

Après exécution, vérifiez rapidement :
```sql
select * from shop_ratings limit 5;
select count(*) from reports;
select is_admin();  -- doit renvoyer true si vous êtes connecté en admin
```

### 3.3 Redéploiement
Rien de particulier : `npm run build` puis redéploiement habituel
(Cloudflare Pages / Netlify / Vercel). Pour Android :
`npm run android:open` puis nouvelle génération de l'APK/AAB.

---

## 4. Guide d'utilisation (mis à jour)

### Pour un visiteur non connecté
- Le Marché, la Carte, les fiches boutique et article sont consultables sans compte.
- Une **fenêtre d'installation** apparaît à chaque chargement tant que
  l'application n'est pas installée sur l'appareil (elle disparaît
  définitivement une fois l'installation faite).
- Des **fenêtres d'incitation** apparaissent régulièrement en bas d'écran :
  se connecter pour recevoir des Pépites gratuites, visiter la Carte, etc.
  Elles disparaissent seules au bout de 30 secondes, peuvent être fermées
  d'un clic, et « Ne plus afficher » les coupe pour toute la session.

### Pour un utilisateur connecté
- **Photo de profil** : Compte → touchez votre avatar → choisissez une image
  dans votre galerie (compression automatique).
- **Créer une boutique** : Compte → Créer une boutique. Logo au choix parmi
  les emojis proposés ou depuis votre galerie. Vous pouvez avoir plusieurs
  boutiques.
- **Publier une publication simple** : bouton central Publier → onglet
  Publication. C'est **votre nom et votre photo** qui apparaissent.
- **Publier un article** : bouton central Publier → onglet Article. Si vous
  avez plusieurs boutiques, un **sélecteur de boutique** apparaît en haut du
  formulaire ; ce sont ensuite **le nom et le logo de la boutique choisie**
  qui s'affichent sur l'article.
- **Consulter un profil** : touchez le nom/la photo au-dessus d'une
  publication → page de l'utilisateur (nom, numéro, photo, ses boutiques avec
  leur note, ses publications). Touchez une boutique → page complète de la
  boutique. Sur un article, toucher le profil renvoie **directement** à la
  boutique.
- **Noter une boutique** : après un achat, dans Messages, confirmez la
  réception du produit — la notation de 1 à 5 étoiles se débloque alors. Une
  note = un achat confirmé, impossible à truquer. La moyenne et le nombre de
  votes s'affichent à côté de la boutique, sur sa page et sur chacun de ses
  articles.
- **Signaler** un contenu abusif : bouton Signaler sur la page boutique.

### Pour l'administrateur (`+237 696 430 723`)
Console admin (Compte → Console admin), 5 onglets :

1. **Aperçu** — métriques, graphiques 7 jours, export CSV, et surtout
   **recharges en attente** : chaque demande affiche le numéro, le montant,
   le moyen de paiement et le code de transaction. Vérifiez la réception
   réelle de l'argent sur votre compte Mobile Money, puis **Valider**
   (crédite les Pépites) ou **Refuser**.
2. **Modération** — signalements envoyés par les utilisateurs : traiter ou
   classer sans suite.
3. **Boutiques** — **bloquer / débloquer** (une boutique bloquée disparaît
   du Marché et de la Carte pour tout le monde, avec motif enregistré) et
   **certifier / décertifier** (badge vérifié).
4. **Comptes** — recherche par nom ou numéro, **suspendre** un compte (ses
   boutiques sont bloquées en même temps, il ne peut plus publier),
   **supprimer définitivement** un compte, et **créditer/débiter des
   Pépites** manuellement avec une note justificative (tracée dans le grand
   livre des transactions).
5. **Contenus** *(nouveau)* — **supprimer définitivement** n'importe quelle
   publication ou n'importe quel article, sans attendre un signalement.

Sécurité : toutes ces actions passent par des fonctions SQL protégées qui
vérifient le rôle administrateur côté serveur. Un utilisateur qui
modifierait le code du navigateur ne peut rien faire. Un administrateur ne
peut ni se supprimer ni se suspendre lui-même.
