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
