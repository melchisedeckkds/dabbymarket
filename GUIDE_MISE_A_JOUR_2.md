# DabbyMarket — Mise à jour n°2 (dépôt Git)

Comme la fois précédente : **ne remplace pas tout le dépôt**, copie
uniquement les fichiers ci-dessous, au même chemin.

## Fichiers

**Nouveau :**
- `src/components/hashtag-text.tsx` — rend les `#hashtags` et `@mentions`
  cliquables dans une légende.

**À remplacer intégralement :**
- `src/lib/utils.ts` — ajoute `maskPhone()`.
- `src/pages/Profil.tsx` — numéro masqué, vignettes de publications
  cliquables.
- `src/pages/Boutique.tsx` — bannière réduite (h-40 → h-20).
- `src/pages/Marche.tsx` — légende sans nom en double, hashtags/mentions,
  recherche initialisée depuis l'URL (`?q=`), lien profond `?post=`.
- `src/components/image-lightbox.tsx` — accepte désormais légende, likes,
  commentaires en overlay.
- `src/lib/queries.ts` — ajoute `useSinglePost`, sécurise `useLikes`/
  `useComments` contre un id manquant.
- `index.html` — charge la police *Fraunces* (légendes).
- `src/styles.css` — ajoute le token `--font-caption`.

Rien d'autre n'est touché. `npm run build` passe sans erreur de mon côté.

## Ce que ça change concrètement

- **Confidentialité** : sur `/profil/:id`, seul l'indicatif pays du
  numéro est visible (ex. `+237 •• •• •• ••`).
- **Publications → Marché** : cliquer une vignette sur un profil ouvre
  directement la publication en plein écran (légende, likes,
  commentaires), via `/?post=<id>` — fonctionne même si la publication
  est ancienne et pas encore chargée dans le scroll infini.
- **Clic sur une publication dans le Marché** : le fond flouté affiche
  désormais aussi la légende, le nombre de likes et de commentaires.
- **Bannière boutique** réduite de moitié.
- **`#hashtag`** dans une légende → clic renvoie vers `/?q=hashtag`
  (filtre la recherche du Marché).
- **`@nom`** dans une légende → clic cherche un profil portant ce nom
  exact et y renvoie s'il existe (sinon message "Profil introuvable").
- **Légendes** : le nom de l'auteur n'est plus répété devant le texte
  (déjà visible dans l'en-tête), et le texte utilise désormais la police
  *Fraunces* (`font-caption`), plus raffinée.

## Idées supplémentaires à considérer (non implémentées)

Pour rester dans un lot raisonnable, je n'ai codé que ce qui était
explicitement demandé. Quelques pistes à évaluer pour la suite :
- **Suggestions à la saisie** (`#`/`@`) dans `Publier.tsx` — actuellement
  seul l'affichage est cliquable, pas la saisie assistée.
- **Notifications** quand quelqu'un mentionne l'utilisateur (`@nom`).
- **Page de résultats par hashtag** dédiée plutôt qu'un simple filtre de
  recherche.
- **Partage direct d'une publication** (`/?post=id`) — le lien est déjà
  fonctionnel, il ne manque qu'un bouton "copier le lien" dans le menu de
  partage existant.

## ⚠️ Pépites — pas encore mis à jour

Le nouveau barème de Pépites n'est **pas** dans ce lot : tu m'as demandé
d'utiliser celui qui ressortira du dossier investisseur, et ce dossier
n'est pas encore finalisé (voir Phase 1 de l'audit ci-dessous). Le code
sera mis à jour dans un prochain lot une fois le modèle validé avec toi.
