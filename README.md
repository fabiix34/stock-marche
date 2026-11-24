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
Base Firestore via la capacité `db` des artifacts Claude, avec repli en `localStorage`.
