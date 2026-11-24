import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_KEY, SUPABASE_URL } from '../config';

/* La session (jeton de connexion) est gardée sur le téléphone pour ne pas se reconnecter à chaque ouverture. */
export const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { storage: AsyncStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
});
