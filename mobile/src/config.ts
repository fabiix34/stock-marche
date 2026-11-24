/* Clé "publishable" : publique par nature, protégée par les règles RLS de Supabase.
   La clé service_role et la clé API SumUp ne doivent JAMAIS être ici : elles restent dans Vercel. */
export const SUPABASE_URL = 'https://uvjiyzaonvxioehsovni.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_2yPUnVhppfOuLRtvtICuqQ_R8EmXgpw';

/* Fonctions serveur (Vercel) : /api/terminal pour piloter les terminaux de paiement. */
export const DEFAULT_API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://stock-marche.vercel.app';
