# DabbyMarket — Correctif SQL + Phase 3 (classement) + Recharge.tsx

## A. Correctif SQL (à exécuter en premier)

`supabase/migrations/0013_fix_security_definer_views.sql` corrige les deux
alertes "Security Definer View" du linter Supabase (`active_boosts` et
`shop_active_listing_counts`, créées par la migration 0012). Même cause et
même correctif que `shop_ratings` en son temps : `CREATE OR REPLACE VIEW`
ne suffit pas à changer le mode d'exécution, il faut `DROP` puis recréer
avec `security_invoker = true` déclaré à la création.

Exécute-la dans l'éditeur SQL Supabase, puis relance le linter
(Database → Linter) pour confirmer que les deux alertes ont disparu.

## B. Fichiers Phase 3 — la vraie règle de classement

- `src/lib/queries.ts` — nouveaux `useActiveBoostIds()` et `applyRankCap()`
  (bonus de rang plafonné, jamais un réordonnancement libre).
- `src/pages/Marche.tsx` — Boost Recherche : capé, actif seulement quand
  une recherche/catégorie est en cours.
- `src/components/product-card.tsx` — badge "Sponsorisé" unifié (remplace
  l'ancien "Boosté" fait main), couvre Boost Article et Boost Recherche.
- `src/pages/Carte.tsx` — Boost Carte : capé, badge Sponsorisé sur le
  carrousel et la vue liste.
- `src/components/la-guerite-chat.tsx` — Boost Recommandation IA :
  l'assistant sait désormais quelles boutiques/articles y ont droit, mais
  ne peut les mentionner que s'ils sont déjà pertinents, et doit toujours
  l'étiqueter explicitement (règle non négociable du cahier des charges).

## C. `src/pages/Recharge.tsx` — remise à niveau complète

Cet écran n'avait pas été touché lors des phases précédentes et affichait
encore l'ancien barème (200/500/1200/3000 Pépites à 1000/2500/5000/12000
FCFA, "publier = 15 Pépites", "booster = 80/120 Pépites", et une mention
"recommandé en priorité par La Guérite" qui contredit directement la
nouvelle règle de classement). Corrigé :

- Les **5 vrais packs** (Micro/Starter/Standard/Pro/Business) viennent
  maintenant de la table `pepite_packs` — si tu changes un prix dans
  l'onglet admin Économie, cet écran se met à jour automatiquement.
- **Nom du bénéficiaire** : Kondjebe Melchisedeck Stanley Daniel.
- Le bloc "Coûts des actions" reflète le vrai modèle : publication
  gratuite jusqu'au quota (lu depuis la configuration, donc toujours
  exact même si tu changes le quota plus tard), dépassement à 10
  Pépites/mois, et renvoie vers le sélecteur de boosts au lieu de
  réafficher des prix qui deviendraient vite faux.
- **Supprimé** : la mention "recommandé en priorité par La Guérite" —
  remplacée par une phrase qui dit l'inverse et le confirme clairement :
  un boost ne change jamais la pertinence affichée.

## D. Ton compte admin (+237 696 430 723) n'a pas les droits admin

C'est normal et sans rapport avec le fait que ce numéro soit affiché comme
bénéficiaire des paiements sur l'écran de recharge — ce sont deux choses
totalement indépendantes. Le bénéficiaire est juste un texte affiché ;
les droits admin dépendent uniquement de la colonne `is_admin` dans la
table `profiles`, à `false` par défaut pour tout le monde.

**Pour te donner les droits admin**, exécute dans l'éditeur SQL Supabase :

```sql
update profiles set is_admin = true where phone = '+237696430723';
```

Le numéro est stocké sans espaces avec l'indicatif collé (format exact
utilisé par ton app à l'inscription). Si la requête ne modifie aucune
ligne (`0 rows affected`), vérifie le format réel avec :

```sql
select id, phone, name, is_admin from profiles where phone ilike '%696430723%';
```

puis relance la mise à jour avec le numéro exact retourné. Une fois fait,
déconnecte-toi et reconnecte-toi dans l'app (le rôle admin est chargé au
login) — l'onglet `/admin` et toutes ses fonctions (dont le nouvel onglet
Économie) deviennent alors accessibles.
