import { PermissionsAndroid, Platform } from 'react-native';
import RNBluetoothClassic from 'react-native-bluetooth-classic';
import { Receipt, toBase64 } from './escpos';

/* Imprimante thermique Bluetooth "classique" (profil série SPP), le cas de la plupart des imprimantes
   de marché 58/80 mm. Elle doit d'abord être appairée dans les réglages Bluetooth d'Android. */

export type BtDevice = { address: string; name: string };

async function askPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  if (Number(Platform.Version) >= 31) {
    const r = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
    ]);
    return Object.values(r).every((v) => v === PermissionsAndroid.RESULTS.GRANTED);
  }
  return true;
}

export async function pairedPrinters(): Promise<BtDevice[]> {
  if (!(await askPermissions())) throw new Error('Autorise le Bluetooth pour cette appli');
  if (!(await RNBluetoothClassic.isBluetoothEnabled())) {
    const on = await RNBluetoothClassic.requestBluetoothEnabled().catch(() => false);
    if (!on) throw new Error('Active le Bluetooth');
  }
  const list = await RNBluetoothClassic.getBondedDevices();
  return list.map((d) => ({ address: d.address, name: d.name || d.address }));
}

export async function printReceipt(address: string, r: Receipt): Promise<void> {
  if (!(await askPermissions())) throw new Error('Autorise le Bluetooth pour cette appli');
  const connected = await RNBluetoothClassic.isDeviceConnected(address).catch(() => false);
  if (!connected) await RNBluetoothClassic.connectToDevice(address, { delimiter: '', charset: 'ascii' } as never);
  const bytes = r.toUint8();
  /* Envoi par paquets : certaines imprimantes perdent des données si le flux est trop long d'un coup. */
  for (let i = 0; i < bytes.length; i += 512) {
    await RNBluetoothClassic.writeToDevice(address, toBase64(bytes.subarray(i, i + 512)), 'base64');
  }
}
