import { Product } from './catalog';
import { r3, round2 } from './money';

/* Ticket en cours d'un vendeur, même modèle que l'appli web :
   - pieces[id] = quantité (produits à la pièce, quantités additionnées)
   - weights[id] = liste des pesées en kg (produits au kilo, une ligne par pesée) */
export type Ticket = { pieces: Record<string, number>; weights: Record<string, number[]> };

export const emptyTicket = (): Ticket => ({ pieces: {}, weights: {} });

export const sumW = (a: number[]) => r3(a.reduce((x, y) => x + y, 0));

export function count(t: Ticket): number {
  let n = 0;
  Object.values(t.pieces).forEach((q) => (n += q));
  Object.values(t.weights).forEach((w) => (n += w.length));
  return n;
}

export function addPiece(t: Ticket, id: string, d = 1): Ticket {
  const q = (t.pieces[id] || 0) + d;
  const pieces = { ...t.pieces };
  if (q <= 0) delete pieces[id];
  else pieces[id] = q;
  return { ...t, pieces };
}

export function addWeight(t: Ticket, id: string, w: number): Ticket {
  if (!(w > 0)) return t;
  return { ...t, weights: { ...t.weights, [id]: [...(t.weights[id] || []), r3(w)] } };
}

export function removeWeight(t: Ticket, id: string, i: number): Ticket {
  const list = (t.weights[id] || []).filter((_, j) => j !== i);
  const weights = { ...t.weights };
  if (list.length) weights[id] = list;
  else delete weights[id];
  return { ...t, weights };
}

export type Line = { id: string; name: string; qty: number; unit: 'piece' | 'kg'; price: number | null; amount: number; wi?: number };

/* Lignes affichées / imprimées : une ligne par produit à la pièce, une ligne par pesée. */
export function lines(t: Ticket, byId: Record<string, Product>): Line[] {
  const out: Line[] = [];
  Object.keys(t.pieces).forEach((id) => {
    const p = byId[id];
    const price = p ? p.price : null;
    out.push({ id, name: p ? p.name : id, qty: t.pieces[id], unit: 'piece', price, amount: round2((price || 0) * t.pieces[id]) });
  });
  Object.keys(t.weights).forEach((id) => {
    const p = byId[id];
    const price = p ? p.price : null;
    t.weights[id].forEach((w, wi) => out.push({ id, name: p ? p.name : id, qty: w, unit: 'kg', price, amount: round2((price || 0) * w), wi }));
  });
  return out;
}

export function total(t: Ticket, byId: Record<string, Product>): number {
  return round2(lines(t, byId).reduce((s, l) => s + l.amount, 0));
}

export function missingPrices(t: Ticket, byId: Record<string, Product>): string[] {
  return lines(t, byId)
    .filter((l) => l.price == null)
    .map((l) => l.name);
}
