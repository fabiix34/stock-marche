/* Fonction serverless Vercel : pilotage des terminaux SumUp Solo via l'API Cloud de SumUp.
   La clé API SumUp reste ici, côté serveur : elle ne doit jamais être dans l'appli (web ou mobile).
   Seul un utilisateur connecté (admin ou responsable actif) peut l'appeler.

   Variables d'environnement Vercel :
     SUMUP_API_KEY         clé API SumUp (sup_sk_…)
     SUMUP_MERCHANT_CODE   code marchand (ex. MXXXXXXX)
     SUMUP_AFFILIATE_KEY   clé d'affilié créée dans l'espace développeur SumUp
     SUMUP_APP_ID          identifiant d'application associé à la clé d'affilié
     SUPABASE_SERVICE_ROLE_KEY (déjà présente pour la création de comptes)

   Actions (POST JSON) :
     { action:'checkout', reader, cents, ref, seller } -> { id }       envoie le montant au terminal
     { action:'status', id }                           -> { status, brand, last4, code, authCode }
     { action:'terminate', reader }                    -> { ok }       annule le paiement en cours

   PROTOTYPE : endpoints et champs à valider avec le "Virtual Solo" et un compte marchand de test SumUp. */
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://uvjiyzaonvxioehsovni.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUMUP = 'https://api.sumup.com';

function send(res, status, body) {
  res.status(status).setHeader('Cache-Control', 'no-store').json(body);
}
function safeParse(s) {
  try { return JSON.parse(s); } catch (e) { return null; }
}

async function supa(path, token) {
  const r = await fetch(SUPABASE_URL + path, { headers: { apikey: SERVICE_KEY, Authorization: 'Bearer ' + (token || SERVICE_KEY) } });
  let data = null;
  try { data = await r.json(); } catch (e) { /* vide */ }
  return { ok: r.ok, data };
}

async function sumup(path, method, body) {
  const r = await fetch(SUMUP + path, {
    method,
    headers: { Authorization: 'Bearer ' + process.env.SUMUP_API_KEY, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await r.json(); } catch (e) { /* vide */ }
  return { ok: r.ok, status: r.status, data };
}

const errMsg = (d, def) => (d && (d.detail || d.message || d.error_message || (d.errors && JSON.stringify(d.errors)))) || def;

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Méthode non autorisée' });
  if (!SERVICE_KEY) return send(res, 500, { error: 'SUPABASE_SERVICE_ROLE_KEY manquante dans Vercel' });
  if (!process.env.SUMUP_API_KEY || !process.env.SUMUP_MERCHANT_CODE) return send(res, 500, { error: 'Clés SumUp manquantes dans Vercel (SUMUP_API_KEY, SUMUP_MERCHANT_CODE)' });

  // 1. Utilisateur connecté et autorisé
  const auth = String(req.headers.authorization || '');
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return send(res, 401, { error: 'Non connecté' });
  const who = await supa('/auth/v1/user', token);
  if (!who.ok || !who.data || !who.data.id) return send(res, 401, { error: 'Session invalide, reconnecte-toi' });
  const prof = await supa('/rest/v1/profiles?select=role,actif&id=eq.' + encodeURIComponent(who.data.id));
  const me = prof.ok && Array.isArray(prof.data) ? prof.data[0] : null;
  if (!me || me.actif === false || ['admin', 'responsable'].indexOf(me.role) < 0) return send(res, 403, { error: 'Compte non autorisé' });

  const b = (typeof req.body === 'string' ? safeParse(req.body) : req.body) || {};
  const mc = encodeURIComponent(process.env.SUMUP_MERCHANT_CODE);
  const reader = String(b.reader || '');
  const readerOk = /^[A-Za-z0-9_-]{3,80}$/.test(reader);

  if (b.action === 'checkout') {
    const cents = Number(b.cents);
    if (!readerOk) return send(res, 400, { error: 'Terminal invalide' });
    if (!Number.isInteger(cents) || cents < 1 || cents > 500000) return send(res, 400, { error: 'Montant invalide' });
    const body = {
      total_amount: { currency: 'EUR', minor_unit: 2, value: cents },
      description: ('Marché' + (b.seller ? ' · ' + String(b.seller).slice(0, 40) : '')).slice(0, 60),
    };
    if (process.env.SUMUP_AFFILIATE_KEY)
      body.affiliate = { key: process.env.SUMUP_AFFILIATE_KEY, app_id: process.env.SUMUP_APP_ID || '', foreign_transaction_id: String(b.ref || '').slice(0, 60) };
    const r = await sumup('/v0.1/merchants/' + mc + '/readers/' + encodeURIComponent(reader) + '/checkout', 'POST', body);
    const id = r.data && r.data.data && r.data.data.client_transaction_id;
    if (!r.ok || !id) return send(res, 502, { error: 'Terminal : ' + errMsg(r.data, 'envoi refusé (' + r.status + ')') });
    return send(res, 200, { id });
  }

  if (b.action === 'status') {
    const id = String(b.id || '');
    if (!/^[A-Za-z0-9_-]{3,100}$/.test(id)) return send(res, 400, { error: 'Référence invalide' });
    const r = await sumup('/v2.1/merchants/' + mc + '/transactions?client_transaction_id=' + encodeURIComponent(id), 'GET');
    if (r.status === 404) return send(res, 200, { status: 'PENDING' }); // pas encore créée côté SumUp
    if (!r.ok) return send(res, 502, { error: 'Terminal : ' + errMsg(r.data, 'statut indisponible (' + r.status + ')') });
    const t = r.data || {};
    const card = t.card || {};
    return send(res, 200, {
      status: String(t.status || 'PENDING').toUpperCase(),
      brand: card.type || undefined,
      last4: card.last_4_digits || undefined,
      code: t.transaction_code || t.id || undefined,
      authCode: t.auth_code || undefined,
    });
  }

  if (b.action === 'terminate') {
    if (!readerOk) return send(res, 400, { error: 'Terminal invalide' });
    const r = await sumup('/v0.1/merchants/' + mc + '/readers/' + encodeURIComponent(reader) + '/terminate', 'POST');
    return send(res, r.ok ? 200 : 502, r.ok ? { ok: true } : { error: errMsg(r.data, 'annulation impossible') });
  }

  return send(res, 400, { error: 'Action inconnue' });
};
