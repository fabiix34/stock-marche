import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_API_URL } from '../config';

/* Réglages propres à CE téléphone (matériel branché dessus) : ils n'ont pas leur place dans la base.
   Les données de l'activité (ventes, équipes, terminaux par vendeur...) restent dans Supabase. */
export type DeviceSettings = {
  provider: 'simule' | 'sumup';
  printer: { address: string; name: string } | null;
  cols: 32 | 48;
  shop: string;
  apiUrl: string;
};

export const defaultSettings: DeviceSettings = { provider: 'simule', printer: null, cols: 32, shop: '', apiUrl: DEFAULT_API_URL };

const KEY = 'reglages-caisse';

export async function loadSettings(): Promise<DeviceSettings> {
  try {
    const s = await AsyncStorage.getItem(KEY);
    return s ? { ...defaultSettings, ...JSON.parse(s) } : defaultSettings;
  } catch {
    return defaultSettings;
  }
}

export async function saveSettings(s: DeviceSettings): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(s));
}
