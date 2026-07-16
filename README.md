# DabbyMarket — App indépendante (Web + Android)

Application 100% indépendante de Lovable : React + Vite + TypeScript,
backend réel sur Supabase (base de données, authentification, stockage,
temps réel), IA réelle (Gemini gratuit) via une fonction Edge, et
empaquetage Android via Capacitor.

## 1. Créer le projet Supabase (gratuit)

1. Va sur https://supabase.com → New Project (le plan gratuit suffit largement au démarrage).
2. Une fois créé, ouvre l'éditeur SQL du projet et exécute, **dans l'ordre**, les fichiers de `supabase/migrations/` :
   - `0001_init.sql`
   - `0002_storage.sql`
   - `0003_suggestion_votes_trigger.sql`
   - `0004_views_tracking.sql`
   - `0005_ai_rate_limit.sql`
   - `0006_unread_messages.sql`
   - `0007_auto_payment_confirmation.sql`
3. Dans **Project Settings → API**, récupère `Project URL` et `anon public key`.

## 2. Configurer l'app

```bash
cp .env.example .env
```
Renseigne `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` dans `.env`.

## 3. Déployer la fonction Edge (La Guérite / IA)

1. Récupère une clé API Gemini gratuite : https://aistudio.google.com/apikey
2. Installe la CLI Supabase si besoin : `npm install -g supabase`
3. Depuis la racine du projet :
   ```bash
   supabase login
   supabase link --project-ref TON_PROJECT_REF
   supabase secrets set GEMINI_API_KEY=ta_cle_gemini
   supabase functions deploy la-guerite-chat
   ```

## 4. Te donner les droits admin

Après avoir créé ton propre compte dans l'app (numéro +237 696 430 723 ou
un autre de ton choix), passe cette requête dans l'éditeur SQL Supabase :
```sql
update profiles set is_admin = true where phone = '+237696430723';
```

## 5. Lancer en développement

```bash
npm install
npm run dev
```

## 6. Déployer le web (PWA, gratuit, sans store)

```bash
npm run build
```
Le dossier `dist/` est 100% statique — dépose-le gratuitement sur
Cloudflare Pages, Netlify, GitHub Pages ou Vercel (glisser-déposer `dist/`
ou lier le repo Git). Pense à renseigner les mêmes variables d'environnement
(`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) dans les réglages du service
d'hébergement choisi.

**Important — routage SPA** : le fichier `public/_redirects` (déjà inclus)
fait fonctionner le rafraîchissement de pages comme `/carte` ou `/messages`
sur Netlify et Cloudflare Pages. Sur GitHub Pages, ajoute plutôt une copie
de `index.html` nommée `404.html` dans `dist/` après le build. Sur Vercel,
aucune configuration supplémentaire n'est nécessaire.

## 7. Générer l'application Android

Prérequis : Android Studio installé sur ta machine.

```bash
npm run android:open
```
Cette commande build le web, synchronise Capacitor, puis ouvre le projet
dans Android Studio. De là : Build → Generate Signed App Bundle / APK.

Le projet Android est déjà présent dans `android/` avec les permissions
nécessaires (localisation, caméra/galerie pour les photos, internet).

## Notes importantes

- **Authentification** : par numéro de téléphone + mot de passe (pas de SMS
  payant). Le jour où tu veux un vrai code OTP par SMS, il faudra configurer
  un fournisseur (Twilio, Vonage...) dans Supabase Auth — payant à l'usage.
- **Pépites / paiement réel (Option A)** : les demandes de recharge restent
  "en attente" tant que tu ne les valides pas manuellement dans la Console
  admin après avoir vérifié la réception réelle du paiement sur ton compte
  Mobile Money. Rien n'est crédité automatiquement.
- **Option B (passerelle automatisée)** : si tu crées un compte marchand
  chez CinetPay, Notchpay ou Monetbil, on pourra brancher une fonction Edge
  supplémentaire qui valide les paiements automatiquement.
- **Mama Ngondo renommée en "La Guérite"** : ton plus formel, vouvoiement,
  toujours connectée aux données réelles du marché (boutiques, produits,
  boosts en cours).

## Pages migrées (toutes fonctionnelles, données réelles)

Auth, Marché, Carte, Boutique, Produit, Créer Boutique, Publier, Messages
(temps réel), Compte, Admin, Recharge, Suggestions.

## Ajouts récents

- **Vues réelles** (produits et boutiques) via la table `views`, avec
  historique horodaté permettant de vrais graphiques 7 jours (plus de
  données inventées).
- **Transfert de produit** entre ses propres boutiques (visible dans
  Compte → Ma Boutique dès que tu as 2 boutiques ou plus).
- **Layout desktop plein écran** : barre latérale persistante (façon
  Instagram/Twitter desktop) au-delà de 1024px de large, grille de produits
  à 2 colonnes, navigation mobile (topbar/bottom nav) masquée sur grand
  écran.
- **Animations** : transitions de page douces (framer-motion), apparition
  en cascade des cartes produits dans Le Marché, micro-interactions déjà
  présentes conservées (like, boost, bottom sheets).
- **iOS non encore généré** : seule la plateforme Android est prête. iOS
  nécessite un Mac + Xcode pour la génération finale du projet natif.

## Dernières améliorations (sécurité, qualité, bilinguisme)

- **Compression d'image automatique** avant tout upload (logos, produits,
  posts) — réduit fortement la consommation de données.
- **Galerie multi-photos** (jusqu'à 5) pour chaque produit, avec photo
  principale et compression automatique.
- **Mises à jour optimistes** pour les coups de cœur et le panier d'envie
  — l'interface réagit instantanément, avant même la confirmation serveur.
- **Quota IA réel côté serveur** : 40 messages/jour maximum par utilisateur
  pour La Guérite, appliqué dans la fonction Edge (impossible à contourner
  depuis le client) — protège le quota gratuit Gemini contre les abus.
- **Bilinguisme complet FR/EN** : toute l'interface (navigation, formulaires,
  messages, notifications) est traduite, y compris les réponses de La
  Guérite qui répond dans la langue choisie par l'utilisateur.

## Encore à faire (voir recommandations précédentes)

- CGU rédigées et accessibles dans l'app (Compte → Conditions d'utilisation)
  — fais-les tout de même relire par un professionnel du droit avant un
  lancement public réel, le contenu fourni est un modèle de départ.
- Bundle JS découpé par page (fait) — le chunk principal reste correct pour
  un lancement, à surveiller si l'app grossit beaucoup.

## Activer l'Option B — passerelle de paiement automatisée

Le flux manuel (validation admin) reste actif par défaut et continue de
fonctionner sans rien faire de plus. Pour automatiser la validation des
recharges le jour où tu as un compte marchand (CinetPay, Notchpay ou
Monetbil — tous trois courants au Cameroun pour Orange Money/MTN MoMo) :

1. Crée un compte marchand chez le prestataire choisi et récupère tes clés API.
2. Ouvre `supabase/functions/payment-webhook/index.ts` et adapte les deux
   sections marquées "À ADAPTER" (vérification de signature et noms des
   champs du payload) selon la documentation de ton prestataire.
3. Déploie :
   ```bash
   supabase secrets set PAYMENT_WEBHOOK_SECRET=ton_secret_webhook
   supabase functions deploy payment-webhook --no-verify-jwt
   ```
4. Renseigne l'URL `https://TON_PROJET.supabase.co/functions/v1/payment-webhook`
   comme URL de notification dans le tableau de bord de ton prestataire.

Une fois ça en place, les recharges dont le paiement est confirmé par le
prestataire sont créditées automatiquement, sans validation manuelle — le
flux manuel reste disponible en secours si le webhook échoue.
