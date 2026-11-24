/* Fonction serverless Vercel : création d'un compte par un administrateur.
   La clé "service_role" de Supabase reste ici, côté serveur (variable d'environnement
   SUPABASE_SERVICE_ROLE_KEY dans Vercel) : elle ne doit jamais apparaître dans index.html.
   Seul un utilisateur connecté ET administrateur actif peut appeler cette fonction. */
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://uvjiyzaonvxioehsovni.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function send(res, status, body) {
  res.status(status).setHeader('Cache-Control', 'no-store').json(body);
}

async function sb(path, { method = 'GET', token, body, headers = {} } = {}) {
  const r = await fetch(SUPABASE_URL + path, {
    method,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: 'Bearer ' + (token || SERVICE_KEY),
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await r.json(); } catch (e) { /* réponse vide */ }
  return { ok: r.ok, status: r.status, data };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Méthode non autorisée' });
  if (!SERVICE_KEY) return send(res, 500, { error: 'SUPABASE_SERVICE_ROLE_KEY manquante dans les variables d’environnement Vercel' });

  // 1. Qui appelle ? (jeton de connexion de l'utilisateur)
  const auth = String(req.headers.authorization || '');
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return send(res, 401, { error: 'Non connecté' });
  const who = await sb('/auth/v1/user', { token });
  if (!who.ok || !who.data || !who.data.id) return send(res, 401, { error: 'Session invalide, reconnecte-toi' });

  // 2. Est-ce un administrateur actif ?
  const prof = await sb('/rest/v1/profiles?select=role,actif&id=eq.' + encodeURIComponent(who.data.id));
  const me = prof.ok && Array.isArray(prof.data) ? prof.data[0] : null;
  if (!me || me.role !== 'admin' || me.actif === false) return send(res, 403, { error: 'Réservé aux administrateurs' });

  // 3. Données du nouveau compte
  const b = (typeof req.body === 'string' ? safeParse(req.body) : req.body) || {};
  const email = String(b.email || '').trim().toLowerCase();
  const password = String(b.password || '');
  const nom = String(b.nom || '').trim().slice(0, 80);
  const role = b.role === 'admin' ? 'admin' : 'vendeur';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return send(res, 400, { error: 'Adresse e-mail invalide' });
  if (password.length < 8) return send(res, 400, { error: 'Mot de passe : 8 caractères minimum' });

  // 4. Création du compte (déjà confirmé, pas de mail à valider)
  const created = await sb('/auth/v1/admin/users', {
    method: 'POST',
    body: { email, password, email_confirm: true, user_metadata: nom ? { nom } : {} },
  });
  if (!created.ok) {
    const msg = (created.data && (created.data.msg || created.data.message || created.data.error_description)) || 'Création impossible';
    const exists = /already|registered|exists/i.test(msg);
    return send(res, exists ? 409 : 400, { error: exists ? 'Cette adresse e-mail a déjà un compte' : msg });
  }
  const id = created.data.id || (created.data.user && created.data.user.id);

  // 5. Profil : créé par le déclencheur (vendeur) ; on l'écrase (upsert) avec le rôle et le nom demandés
  const patch = await sb('/rest/v1/profiles', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: { id, email, role, nom: nom || null, actif: true },
  });
  if (!patch.ok) return send(res, 500, { error: 'Compte créé mais profil non mis à jour : ' + JSON.stringify(patch.data) });

  return send(res, 200, { ok: true, id, email, role });
};

function safeParse(s) { try { return JSON.parse(s); } catch (e) { return null; } }
