/* Montants : on calcule en centimes pour éviter les erreurs d'arrondi des flottants. */
export const toCents = (eur: number) => Math.round(eur * 100);
export const fromCents = (c: number) => Math.round(c) / 100;
export const round2 = (x: number) => Math.round(x * 100) / 100;
export const r3 = (x: number) => Math.round(x * 1000) / 1000;

export function eur(n: number | null | undefined): string {
  const c = toCents(n || 0);
  const neg = c < 0;
  const abs = Math.abs(c);
  const ent = Math.floor(abs / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return (neg ? '-' : '') + ent + ',' + String(abs % 100).padStart(2, '0') + ' €';
}

export function kg(w: number): string {
  return w.toFixed(3).replace('.', ',') + ' kg';
}

/* Lecture d'un montant tapé à la française ("72,5" ou "72.50") ; null si invalide. */
export function parseAmount(s: string): number | null {
  const t = String(s).trim().replace(/\s/g, '').replace(',', '.');
  if (!t || !/^\d+(\.\d{0,2})?$/.test(t)) return null;
  return round2(Number(t));
}

export type Rounding = { label: string; amount: number };

/* Gestes commerciaux proposés à l'encaissement : arrondi à l'euro, puis aux 5 € et 10 € inférieurs.
   Ex. 72,38 € -> 72 € et 70 €. On ne propose que des montants strictement inférieurs, positifs et distincts. */
export function roundingOptions(total: number): Rounding[] {
  const c = toCents(total);
  const out: Rounding[] = [];
  const seen = new Set<number>([c]);
  for (const step of [100, 500, 1000]) {
    const v = Math.floor(c / step) * step;
    if (v > 0 && v < c && !seen.has(v)) {
      seen.add(v);
      out.push({ label: eur(fromCents(v)), amount: fromCents(v) });
    }
  }
  return out;
}

/* Monnaie à rendre en espèces (null si le client n'a pas donné assez). */
export function change(due: number, given: number | null): number | null {
  if (given == null) return null;
  const d = toCents(given) - toCents(due);
  return d < 0 ? null : fromCents(d);
}
