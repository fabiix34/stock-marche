# Caisse marché (Android, Expo)

Prototype de caisse mobile, branchée sur la même base Supabase que l'appli web (`../index.html`).
L'appli web garde Saisie, Bilan, Paramètres et Équipe ; cette appli fait la **vente** :

- connexion du responsable (ou de l'admin), choix du marché (mêmes droits que le web) ;
- un ticket en cours par vendeur (prénoms de l'équipe du marché), en parallèle ;
- encaissement avec **montant ajustable** (arrondi proposé : 72,38 € → 72 € ou 70 €, ou montant libre) ; le total réel et le geste commercial sont enregistrés ;
- **carte** : le montant part sur le terminal **du vendeur** (aucune saisie sur le terminal), ou **espèces** avec calcul du rendu ;
- après paiement : cases **Ticket CB** et **Ticket de caisse**, décochées par défaut, imprimées sur une **imprimante thermique Bluetooth** (aperçu à l'écran si aucune n'est reliée) ;
- journal du jour : récap par vendeur (carte / espèces / gestes) et réimpression.

Les ventes sont écrites dans `ventes/<date>_<marché>` au même format que le web, avec en plus `m` (`cb`/`esp`), `b` (total avant geste) et `cb` (infos du paiement carte).
Le terminal de chaque vendeur est enregistré dans `equipes/<marché>` (`terminaux`).

## Lancer l'appli sur un téléphone Android

L'imprimante Bluetooth demande du code natif : **Expo Go ne suffit pas**, il faut construire l'appli.

```bash
cd mobile
npm install
npx eas-cli@latest login            # compte Expo gratuit
npx eas-cli@latest build -p android --profile preview
```

EAS fournit un lien vers un fichier **APK** à installer sur le téléphone de la caisse.
Pour développer avec rechargement à chaud : `--profile development`, puis `npx expo start --dev-client`.

## Réglages (⚙️ dans l'appli)

- **Imprimante** : l'appairer d'abord dans les réglages Bluetooth d'Android, puis « Chercher les imprimantes appairées », choisir 58 ou 80 mm, « Imprimer un test ».
- **Terminal de paiement** : « Simulé » (boutons accepter / refuser, pour tester sans matériel) ou « SumUp Solo ».
- **Un terminal par vendeur** : l'identifiant du lecteur SumUp (`rdr_…`) en face de chaque prénom.

Ces réglages matériels sont propres au téléphone ; tout le reste est dans Supabase.

## SumUp Solo (API Cloud)

L'appli passe par la fonction Vercel `api/terminal.js`, qui garde la clé SumUp. Variables à ajouter dans Vercel :
`SUMUP_API_KEY`, `SUMUP_MERCHANT_CODE`, `SUMUP_AFFILIATE_KEY`, `SUMUP_APP_ID` (en plus de `SUPABASE_SERVICE_ROLE_KEY`).
Chaque Solo doit être appairé au compte marchand (code affiché sur le Solo, API Cloud de SumUp) pour obtenir son identifiant `rdr_…`.
À valider d'abord avec le **Virtual Solo** et un compte marchand de test : les points d'API ont été écrits d'après la documentation, sans test réel.

Pour un autre prestataire (Stripe Terminal, Adyen…), ajouter un `Provider` dans `src/payments/index.ts`.

## Vérifications

```bash
npm test          # logique de caisse, tickets, ESC/POS, terminal simulé
npm run typecheck
npm run lint
```

## Limites du prototype

- Tickets en cours en mémoire : perdus si l'appli est fermée.
- Le ticket CB imprimé reprend ce que renvoie le terminal ; un vrai reçu carte a des mentions obligatoires (à reprendre de la réponse du prestataire).
- Imprimantes Bluetooth « classiques » (SPP) seulement ; module `react-native-bluetooth-classic` en version candidate.
- Aspects légaux (logiciel de caisse certifié, TVA) non traités.
