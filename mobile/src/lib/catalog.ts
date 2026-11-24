export type Product = {
  id: string;
  name: string;
  cat: string;
  price: number | null;
  code: number | null;
  unit: 'piece' | 'kg';
};

export type ArticleRow = {
  id: string;
  nom: string;
  categorie?: string | null;
  code?: number | string | null;
  prix?: number | string | null;
  unite?: string | null;
  actif?: boolean | null;
  ordre?: number | null;
};

/* Même règle que l'appli web : la table `articles` est la source du catalogue, les inactifs sont masqués. */
export function productsFromArticles(rows: ArticleRow[]): Product[] {
  return rows
    .filter((r) => r.actif !== false)
    .sort((a, b) => (a.ordre || 0) - (b.ordre || 0))
    .map((r) => ({
      id: r.id,
      name: r.nom,
      cat: r.categorie || 'Autres',
      price: r.prix == null || r.prix === '' ? null : Number(r.prix),
      code: r.code == null || r.code === '' ? null : Number(r.code),
      unit: r.unite === 'kg' ? 'kg' : 'piece',
    }));
}

export function categories(ps: Product[]): string[] {
  const out: string[] = [];
  ps.forEach((p) => {
    if (out.indexOf(p.cat) < 0) out.push(p.cat);
  });
  return out;
}

/* Identifiants de documents, identiques à l'appli web. */
export function slug(s: string): string {
  return String(s)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function todayStr(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

export function venteId(date: string, market: string): string {
  return date + '_' + (slug(market) || 'marche');
}
