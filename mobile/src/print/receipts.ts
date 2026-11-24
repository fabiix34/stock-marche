import { Receipt } from './escpos';
import { Line } from '../lib/ticket';
import { CardInfo } from '../lib/sales';
import { eur, kg } from '../lib/money';

const plainEur = (n: number) => eur(n).replace(/[\u00a0\u202f]/g, ' ');
const when = (t: number) => {
  const d = new Date(t);
  const p = (n: number) => String(n).padStart(2, '0');
  return p(d.getDate()) + '/' + p(d.getMonth() + 1) + '/' + d.getFullYear() + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
};

export type SaleForPrint = {
  shop: string;
  market: string;
  seller?: string;
  at: number;
  lines: Line[];
  brut: number;
  paid: number;
  mode: 'cb' | 'esp';
  given?: number | null;
  change?: number | null;
  cb?: CardInfo;
};

/* Ticket de caisse : détail des articles, geste commercial éventuel, mode de paiement. */
export function cashReceipt(s: SaleForPrint, cols: number): Receipt {
  const r = new Receipt(cols);
  r.align('center').bold(true).line(s.shop || 'Ticket de caisse').bold(false);
  r.line(s.market).line(when(s.at));
  if (s.seller) r.line('Servi par ' + s.seller);
  r.align('left').rule();
  s.lines.forEach((l) => {
    if (l.unit === 'kg') {
      r.line(l.name);
      r.lr('  ' + kg(l.qty) + ' x ' + (l.price != null ? plainEur(l.price) + '/kg' : '?'), plainEur(l.amount));
    } else if (l.qty > 1) {
      r.line(l.name);
      r.lr('  ' + l.qty + ' x ' + (l.price != null ? plainEur(l.price) : '?'), plainEur(l.amount));
    } else r.lr(l.name, plainEur(l.amount));
  });
  r.rule();
  if (s.brut > s.paid) {
    r.lr('Sous-total', plainEur(s.brut));
    r.lr('Geste commercial', '-' + plainEur(s.brut - s.paid));
  }
  r.bold(true).big(true).lr('TOTAL', plainEur(s.paid), Math.floor(cols / 2)).big(false).bold(false);
  r.lr(s.mode === 'cb' ? 'Payé par carte' : 'Payé en espèces', plainEur(s.paid));
  if (s.mode === 'cb' && s.cb?.last4) r.lr('Carte', '**** ' + s.cb.last4);
  if (s.mode === 'esp' && s.given != null) {
    r.lr('Reçu', plainEur(s.given));
    r.lr('Rendu', plainEur(s.change || 0));
  }
  r.rule().align('center').line('Merci et à bientôt !').feed(3).cut();
  return r;
}

/* Ticket CB (prototype) : reprend les informations renvoyées par le terminal.
   Un vrai reçu carte doit contenir les mentions de l'acquéreur : à reprendre de la réponse du prestataire. */
export function cardReceipt(s: { shop: string; market: string; at: number; amount: number; cb: CardInfo }, cols: number): Receipt {
  const r = new Receipt(cols);
  r.align('center').bold(true).line('CARTE BANCAIRE').bold(false).line(s.shop || '').line(s.market).line(when(s.at));
  r.align('left').rule();
  if (s.cb.brand) r.lr('Carte', s.cb.brand);
  if (s.cb.last4) r.lr('Numéro', '**** **** **** ' + s.cb.last4);
  r.lr('Transaction', s.cb.txId.slice(-12));
  if (s.cb.authCode) r.lr('Autorisation', s.cb.authCode);
  if (s.cb.terminal) r.lr('Terminal', s.cb.terminal);
  r.rule().bold(true).big(true).lr('MONTANT', plainEur(s.amount), Math.floor(cols / 2)).big(false).bold(false);
  r.line('DEBIT').rule().align('center').line('Ticket client - à conserver').feed(3).cut();
  return r;
}
