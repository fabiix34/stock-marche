import { sb } from './supabase';
import { ArticleRow, Product, productsFromArticles, slug, venteId } from '../lib/catalog';
import { LogEntry, VenteDoc, addSale } from '../lib/sales';

/* Même stockage que l'appli web : table `docs` (path, data jsonb) + table `articles`. */

export type Profile = { id: string; email: string; nom?: string; role: 'admin' | 'responsable'; actif: boolean; marches: string[] };
export type Market = { name: string; key: string };
export type Equipe = { market: string; vendeurs: string[]; terminaux?: Record<string, string> };

async function getDoc<T>(path: string): Promise<T | null> {
  const r = await sb.from('docs').select('data').eq('path', path).maybeSingle();
  if (r.error) throw new Error(r.error.message);
  return (r.data?.data as T) ?? null;
}

async function setDoc(path: string, data: unknown): Promise<void> {
  const r = await sb.from('docs').upsert({ path, data, updated_at: new Date().toISOString() });
  if (r.error) throw new Error(r.error.message);
}

export async function getProfile(uid: string): Promise<Profile | null> {
  const r = await sb.from('profiles').select('*').eq('id', uid).maybeSingle();
  if (r.error) throw new Error(r.error.message);
  if (!r.data) return null;
  return { ...r.data, marches: r.data.marches || [] } as Profile;
}

export async function getMarkets(p: Profile): Promise<Market[]> {
  const d = await getDoc<{ list?: { name: string }[] }>('config/marches');
  const seen = new Set<string>();
  const out: Market[] = [];
  (d?.list || []).forEach((m) => {
    const key = slug(m.name);
    if (key && !seen.has(key) && (p.role === 'admin' || p.marches.indexOf(key) >= 0)) {
      seen.add(key);
      out.push({ name: m.name, key });
    }
  });
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getProducts(): Promise<Product[]> {
  let all: ArticleRow[] = [];
  for (let from = 0; ; from += 1000) {
    const r = await sb.from('articles').select('*').order('ordre', { ascending: true }).range(from, from + 999);
    if (r.error) throw new Error(r.error.message);
    all = all.concat((r.data || []) as ArticleRow[]);
    if ((r.data || []).length < 1000) break;
  }
  return productsFromArticles(all);
}

export async function getEquipe(market: string): Promise<Equipe> {
  const d = await getDoc<Equipe>('equipes/' + slug(market));
  return { market, vendeurs: d?.vendeurs || [], terminaux: d?.terminaux || {} };
}

/* Terminal de paiement associé à chaque vendeur, enregistré avec l'équipe du marché. */
export async function saveTerminals(market: string, terminaux: Record<string, string>): Promise<void> {
  const path = 'equipes/' + slug(market);
  const cur = (await getDoc<Equipe>(path)) || { market, vendeurs: [] };
  await setDoc(path, { ...cur, market: cur.market || market, terminaux });
}

/* Marché choisi : même document par utilisateur que l'appli web (etat/marche-<uid>). */
export async function getSavedMarket(uid: string): Promise<string> {
  const d = await getDoc<{ market?: string }>('etat/marche-' + uid);
  return d?.market || '';
}
export async function saveMarket(uid: string, market: string): Promise<void> {
  await setDoc('etat/marche-' + uid, { market });
}

export async function getVente(date: string, market: string): Promise<VenteDoc | null> {
  return getDoc<VenteDoc>('ventes/' + venteId(date, market));
}

/* Enregistre un ticket encaissé : on relit le document du jour juste avant d'écrire,
   pour ne pas écraser une vente faite entre-temps sur l'appli web. */
export async function recordSale(date: string, market: string, e: LogEntry): Promise<VenteDoc> {
  const cur = await getVente(date, market);
  const next = addSale(cur, date, market, e);
  next.savedAt = Date.now();
  await setDoc('ventes/' + next.id, next);
  return next;
}

/* Prévenu à chaque changement du document de ventes du jour (autre appareil, appli web). */
export function watchVente(date: string, market: string, cb: (d: VenteDoc | null) => void): () => void {
  const path = 'ventes/' + venteId(date, market);
  const ch = sb
    .channel('vente-' + path)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'docs', filter: 'path=eq.' + path }, () => {
      getVente(date, market).then(cb, () => {});
    })
    .subscribe();
  return () => {
    sb.removeChannel(ch);
  };
}
