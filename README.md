# Stock marché

Appli web mobile (un seul fichier `index.html`, sans dépendance) pour les marchés :

- **Saisie** : comptage du stock restant en fin de marché et chargement des caisses (avec provenance des caisses).
- **Vente** : caisse tactile pour la matinée, produits à la pièce ou au kilo (balance simulée).
- **Bilan** : historique, CA, stats, ruptures.
- **Paramètres** : produits (prix, code, pièce/kilo), marchés et jours, achats.

## Balance
La lecture du poids est isolée dans la fonction `readWeight(product)` (bloc « BALANCE » de `index.html`).
Elle simule un poids pour l'instant ; c'est la seule fonction à adapter pour brancher une vraie balance.

## Données
- Dans un artifact Claude : base fournie par Claude (capacité `db`).
- Ailleurs (Vercel) : **Supabase**, table `docs` (voir `supabase.sql`), synchro en direct entre appareils.
- **Aucun stockage local** : tout (relevés, ventes, catalogue, brouillon de saisie) est en base. Si la base est injoignable, un écran « Base de données injoignable » bloque l'appli avec la raison.

- Le catalogue (articles, codes, prix, pièce/kilo, masqués) est lu depuis la table `articles` (`articles.sql`, à exécuter une fois). Si elle est vide, le catalogue intégré à l'appli est utilisé.

L'URL et la clé « publishable » Supabase sont en haut du bloc SUPABASE de `index.html`.

## Déploiement
Hébergé sur Vercel (site statique, aucune étape de build).

## Authentification et permissions
- Connexion e-mail + mot de passe (Supabase Auth), sans inscription libre : l'admin crée les comptes dans Supabase (Authentication > Users).
- Comptes (table `profiles`) : **admin** (tout) et **responsable** (Saisie, Vente, Bilan et Équipe, limités aux marchés qui lui sont confiés dans Paramètres > Comptes). Les vendeurs n'ont pas de compte.
- Les droits sont imposés par la base (RLS) : voir `auth.sql`, à exécuter une fois (avant, créer son compte dans Supabase).

## Création de comptes depuis l'appli (admin)
Paramètres > Équipe > Nouveau compte appelle `api/create-user.js` (fonction serveur Vercel).
Elle vérifie que l'appelant est un administrateur connecté, puis crée le compte avec la clé `service_role`.
À configurer une fois dans Vercel : variable d'environnement **`SUPABASE_SERVICE_ROLE_KEY`** (Supabase > Project Settings > API > `service_role`), puis redéployer. Cette clé ne doit jamais être dans `index.html`.

## Équipes et vendeurs
- Chaque marché a une équipe fixe de vendeurs (prénoms seulement), gérée dans l'onglet **Équipe** (responsable de ce marché ou admin), stockée dans `equipes/<marché>`.
- Une seule caisse partagée, connectée par le responsable : en Vente, chaque vendeur touche son prénom puis ses produits ; chacun a son propre ticket en cours, sans gêner les autres. Le ticket encaissé porte le vendeur (`s`) et le Bilan affiche les ventes par vendeur.
- Les tickets en cours sont en mémoire seulement (perdus si on actualise). Le document de ventes du jour est écrit en entier : une seule caisse par marché.
- Après mise à jour : exécuter `auth.sql` (migre `vendeur` → `responsable`, ajoute `marches`), puis assigner les marchés dans Paramètres > Comptes.
