import React, { useEffect, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { Btn, Chip, Sheet } from './kit';
import { C, s } from './theme';
import { DeviceSettings } from '../services/settings';
import { getEquipe, saveTerminals } from '../services/data';
import { BtDevice, pairedPrinters, printReceipt } from '../print/printer';
import { Receipt } from '../print/escpos';

export function Settings(p: {
  visible: boolean;
  onClose(): void;
  settings: DeviceSettings;
  onChange(s: DeviceSettings): void;
  market: string;
  onTerminalsSaved(): void;
  onChangeMarket(): void;
  onLogout(): void;
  who: string;
}) {
  const st = p.settings;
  const [devices, setDevices] = useState<BtDevice[] | null>(null);
  const [btErr, setBtErr] = useState('');
  const [sellers, setSellers] = useState<string[]>([]);
  const [terms, setTerms] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (!p.visible || !p.market) return;
    getEquipe(p.market).then((e) => {
      setSellers(e.vendeurs);
      setTerms(e.terminaux || {});
    }, () => {});
  }, [p.visible, p.market]);

  const set = (patch: Partial<DeviceSettings>) => p.onChange({ ...st, ...patch });

  async function scan() {
    setBtErr('');
    try {
      setDevices(await pairedPrinters());
    } catch (e) {
      setBtErr((e as Error).message);
    }
  }

  async function test() {
    if (!st.printer) return;
    const r = new Receipt(st.cols).align('center').bold(true).line('Test imprimante').bold(false).line(st.shop || 'Caisse marché').line('éèàçù € ' + st.cols + ' colonnes').rule().feed(3).cut();
    try {
      await printReceipt(st.printer.address, r);
      setBtErr('Test envoyé ✓');
    } catch (e) {
      setBtErr('Échec : ' + (e as Error).message);
    }
  }

  async function saveTerms() {
    setSaving(true);
    setMsg('');
    try {
      const clean: Record<string, string> = {};
      Object.keys(terms).forEach((k) => terms[k].trim() && (clean[k] = terms[k].trim()));
      await saveTerminals(p.market, clean);
      setMsg('Terminaux enregistrés ✓');
      p.onTerminalsSaved();
    } catch (e) {
      setMsg('Échec : ' + (e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet visible={p.visible} title="Réglages" onClose={() => { setMsg(''); p.onClose(); }}>
      <View style={s.card}>
        <Text style={s.h2}>Ticket</Text>
        <Text style={s.muted}>Nom en haut du ticket</Text>
        <TextInput style={s.input} value={st.shop} placeholder="Ex. Primeur Lousado" onChangeText={(t) => set({ shop: t })} />
      </View>

      <View style={s.card}>
        <Text style={s.h2}>Imprimante Bluetooth</Text>
        <Text style={[s.muted, { marginBottom: 8 }]}>
          {st.printer ? 'Reliée : ' + st.printer.name : 'Aucune : les tickets s’affichent en aperçu.'} Appaire-la d’abord dans les réglages Bluetooth d’Android.
        </Text>
        <View style={s.row}>
          <Chip label="58 mm" on={st.cols === 32} onPress={() => set({ cols: 32 })} />
          <Chip label="80 mm" on={st.cols === 48} onPress={() => set({ cols: 48 })} />
        </View>
        <Btn ghost title="Chercher les imprimantes appairées" onPress={scan} />
        {devices?.map((d) => (
          <Chip key={d.address} label={d.name} on={st.printer?.address === d.address} onPress={() => set({ printer: d })} />
        ))}
        {devices && !devices.length ? <Text style={s.muted}>Aucun appareil appairé.</Text> : null}
        {st.printer ? (
          <View style={[s.row, { marginTop: 8 }]}>
            <Btn ghost style={{ flex: 1, marginRight: 8 }} title="Imprimer un test" onPress={test} />
            <Btn ghost title="Oublier" onPress={() => set({ printer: null })} />
          </View>
        ) : null}
        {btErr ? <Text style={{ marginTop: 8, color: btErr.endsWith('✓') ? C.green : C.red }}>{btErr}</Text> : null}
      </View>

      <View style={s.card}>
        <Text style={s.h2}>Terminal de paiement</Text>
        <View style={s.row}>
          <Chip label="Simulé" on={st.provider === 'simule'} onPress={() => set({ provider: 'simule' })} />
          <Chip label="SumUp Solo" on={st.provider === 'sumup'} onPress={() => set({ provider: 'sumup' })} />
        </View>
        {st.provider === 'sumup' ? (
          <>
            <Text style={s.muted}>Adresse du serveur (fonction /api/terminal)</Text>
            <TextInput style={s.input} autoCapitalize="none" value={st.apiUrl} onChangeText={(t) => set({ apiUrl: t })} />
          </>
        ) : (
          <Text style={s.muted}>Le paiement se valide à l’écran (« acceptée » / « refusée ») pour tester sans matériel.</Text>
        )}
        {p.market ? (
          <>
            <Text style={[s.h2, { marginTop: 14 }]}>Un terminal par vendeur · {p.market}</Text>
            {sellers.length ? (
              sellers.map((v) => (
                <View key={v} style={[s.row, { marginBottom: 8 }]}>
                  <Text style={[s.txt, { width: 90 }]}>{v}</Text>
                  <TextInput
                    style={[s.input, { flex: 1 }]}
                    autoCapitalize="none"
                    placeholder="Identifiant du terminal (rdr_…)"
                    value={terms[v] || ''}
                    onChangeText={(t) => setTerms({ ...terms, [v]: t })}
                  />
                </View>
              ))
            ) : (
              <Text style={s.muted}>Aucun vendeur : ajoute les prénoms dans l’onglet Équipe de l’appli web.</Text>
            )}
            {sellers.length ? <Btn title="Enregistrer les terminaux" busy={saving} onPress={saveTerms} /> : null}
            {msg ? <Text style={{ marginTop: 8, color: msg.endsWith('✓') ? C.green : C.red }}>{msg}</Text> : null}
          </>
        ) : null}
      </View>

      <View style={s.card}>
        <Text style={s.muted}>Connecté : {p.who}</Text>
        <View style={[s.row, { marginTop: 8 }]}>
          <Btn ghost style={{ flex: 1, marginRight: 8 }} title="Changer de marché" onPress={p.onChangeMarket} />
          <Btn ghost style={{ flex: 1 }} title="Se déconnecter" onPress={p.onLogout} />
        </View>
      </View>
    </Sheet>
  );
}
