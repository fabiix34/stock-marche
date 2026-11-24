import { CardInfo } from '../lib/sales';
import { toCents } from '../lib/money';
import { sb } from '../services/supabase';

/* ============== PAIEMENT PAR TERMINAL ==============
   Couche indépendante du prestataire : la caisse appelle start() et attend `result`.
   Pour brancher un autre prestataire (Stripe Terminal, Adyen...), il suffit d'ajouter un Provider ici
   (et une fonction serveur si le prestataire exige une clé secrète). */

export type PayResult = { ok: true; card: CardInfo } | { ok: false; reason: string; cancelled?: boolean };

export type PaymentSession = {
  result: Promise<PayResult>;
  cancel(): void;
  /* Seulement pour le terminal simulé : décide de l'issue du paiement. */
  simulate?(ok: boolean): void;
};

export type StartOptions = {
  amount: number; // en euros, déjà ajusté (geste commercial compris)
  terminal: string; // identifiant du terminal du vendeur
  seller: string;
  ref: string; // référence unique de la vente
  onStatus(s: string): void;
};

export type Provider = { id: 'simule' | 'sumup'; label: string; start(o: StartOptions): PaymentSession };

/* ---------- Terminal simulé : pour tester tout le parcours sans matériel ---------- */
export const simulated: Provider = {
  id: 'simule',
  label: 'Terminal simulé',
  start(o) {
    let done: (r: PayResult) => void = () => {};
    const result = new Promise<PayResult>((res) => (done = res));
    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(setTimeout(() => o.onStatus('Montant affiché sur le terminal de ' + (o.seller || 'la caisse')), 600));
    timers.push(setTimeout(() => o.onStatus('En attente de la carte du client…'), 1400));
    const stop = () => timers.forEach(clearTimeout);
    return {
      result,
      cancel() {
        stop();
        done({ ok: false, reason: 'Paiement annulé', cancelled: true });
      },
      simulate(ok) {
        stop();
        if (ok)
          done({
            ok: true,
            card: {
              txId: 'SIM-' + o.ref,
              brand: 'VISA',
              last4: String(1000 + Math.floor(Math.random() * 9000)),
              authCode: String(100000 + Math.floor(Math.random() * 900000)),
              terminal: o.terminal || 'simulé',
            },
          });
        else done({ ok: false, reason: 'Carte refusée' });
      },
    };
  },
};

/* ---------- SumUp Solo via l'API Cloud ----------
   Le téléphone ne parle jamais directement à SumUp : il passe par la fonction serveur /api/terminal (Vercel),
   qui détient la clé API SumUp et vérifie que l'utilisateur est bien connecté. */
export function sumup(apiUrl: string): Provider {
  async function call(body: object) {
    const { data } = await sb.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error('Session expirée : reconnecte-toi');
    const r = await fetch(apiUrl.replace(/\/$/, '') + '/api/terminal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify(body),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'Erreur ' + r.status);
    return j;
  }
  return {
    id: 'sumup',
    label: 'SumUp Solo',
    start(o) {
      let stopped = false;
      let cancelled = false;
      const result = (async (): Promise<PayResult> => {
        if (!o.terminal) return { ok: false, reason: 'Aucun terminal associé à ' + (o.seller || 'ce vendeur') };
        try {
          o.onStatus('Envoi au terminal…');
          const c = await call({ action: 'checkout', reader: o.terminal, cents: toCents(o.amount), ref: o.ref, seller: o.seller });
          o.onStatus('En attente de la carte du client…');
          const t0 = Date.now();
          while (!stopped && Date.now() - t0 < 180000) {
            await new Promise((r) => setTimeout(r, 2000));
            if (stopped) break;
            const s = await call({ action: 'status', id: c.id });
            if (s.status === 'SUCCESSFUL')
              return { ok: true, card: { txId: s.code || c.id, brand: s.brand, last4: s.last4, authCode: s.authCode, terminal: o.terminal } };
            if (s.status === 'FAILED') return { ok: false, reason: 'Paiement refusé' };
            if (s.status === 'CANCELLED') return { ok: false, reason: 'Paiement annulé sur le terminal', cancelled: true };
          }
          if (cancelled) return { ok: false, reason: 'Paiement annulé', cancelled: true };
          return { ok: false, reason: 'Pas de réponse du terminal' };
        } catch (e) {
          return { ok: false, reason: (e as Error).message || 'Erreur de connexion' };
        }
      })();
      return {
        result,
        cancel() {
          stopped = true;
          cancelled = true;
          call({ action: 'terminate', reader: o.terminal }).catch(() => {});
        },
      };
    },
  };
}
