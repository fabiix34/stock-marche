import { Ticket, sumW } from './ticket';
import { r3, round2 } from './money';
import { venteId } from './catalog';

export type CardInfo = { txId: string; brand?: string; last4?: string; authCode?: string; terminal?: string };

/* Une ligne du journal de ventes, compatible avec l'appli web (t, s, l, k, v)
   + champs ajoutés par la caisse mobile : b (total avant geste), m (mode), cb (paiement carte). */
export type LogEntry = {
  t: number;
  s?: string;
  l: Record<string, number>;
  k: Record<string, number[]>;
  v: number;
  b?: number;
  m?: 'cb' | 'esp';
  cb?: CardInfo;
};

export type VenteDoc = {
  id: string;
  date: string;
  market: string;
  items: Record<string, number>;
  ca: number;
  n: number;
  log: LogEntry[];
  savedAt?: number;
};

export function emptyVente(date: string, market: string): VenteDoc {
  return { id: venteId(date, market), date, market, items: {}, ca: 0, n: 0, log: [] };
}

/* Ajoute un ticket encaissé au document du jour (sans le modifier : renvoie une copie). */
export function addSale(doc: VenteDoc | null, date: string, market: string, e: LogEntry): VenteDoc {
  const v: VenteDoc = doc ? JSON.parse(JSON.stringify(doc)) : emptyVente(date, market);
  v.items = v.items || {};
  v.log = v.log || [];
  Object.keys(e.l).forEach((p) => (v.items[p] = r3((v.items[p] || 0) + e.l[p])));
  Object.keys(e.k).forEach((p) => (v.items[p] = r3((v.items[p] || 0) + sumW(e.k[p]))));
  v.ca = round2((v.ca || 0) + e.v);
  v.n = (v.n || 0) + 1;
  v.log.push(e);
  return v;
}

export function entryFrom(ticket: Ticket, seller: string, paid: number, brut: number, mode: 'cb' | 'esp', cb?: CardInfo, at = Date.now()): LogEntry {
  const e: LogEntry = { t: at, l: { ...ticket.pieces }, k: JSON.parse(JSON.stringify(ticket.weights)), v: round2(paid), b: round2(brut), m: mode };
  if (seller) e.s = seller;
  if (cb) e.cb = cb;
  return e;
}

/* Récap du jour par vendeur : encaissé, gestes commerciaux, carte / espèces. */
export function summary(doc: VenteDoc | null) {
  const by: Record<string, { name: string; n: number; paid: number; cb: number; esp: number; remise: number }> = {};
  (doc?.log || []).forEach((e) => {
    const k = e.s || '(sans vendeur)';
    const o = (by[k] = by[k] || { name: k, n: 0, paid: 0, cb: 0, esp: 0, remise: 0 });
    o.n++;
    o.paid = round2(o.paid + e.v);
    if (e.m === 'cb') o.cb = round2(o.cb + e.v);
    else o.esp = round2(o.esp + e.v);
    if (e.b != null && e.b > e.v) o.remise = round2(o.remise + e.b - e.v);
  });
  return Object.values(by).sort((a, b) => b.paid - a.paid);
}
