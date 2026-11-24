import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Pressable, Text, TextInput, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import type { Session } from '@supabase/supabase-js';
import { sb } from './src/services/supabase';
import { Market, Profile, getMarkets, getProfile, getSavedMarket, saveMarket } from './src/services/data';
import { DeviceSettings, defaultSettings, loadSettings, saveSettings } from './src/services/settings';
import { simulated, sumup } from './src/payments';
import { Caisse } from './src/ui/Caisse';
import { Journal } from './src/ui/Journal';
import { Settings } from './src/ui/Settings';
import { Btn } from './src/ui/kit';
import { C, s } from './src/ui/theme';
import { Product } from './src/lib/catalog';
import { VenteDoc } from './src/lib/sales';

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <SafeAreaView style={s.screen} edges={['top', 'bottom']}>
        <Root />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

function Root() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [authErr, setAuthErr] = useState('');
  const [settings, setSettings] = useState<DeviceSettings>(defaultSettings);

  useEffect(() => {
    loadSettings().then(setSettings);
    sb.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = sb.auth.onAuthStateChange((_e, ss) => setSession(ss));
    return () => data.subscription.unsubscribe();
  }, []);

  function changeSettings(ns: DeviceSettings) {
    setSettings(ns);
    saveSettings(ns).catch(() => {});
  }

  if (session === undefined) return <Center><ActivityIndicator color={C.green} /></Center>;
  if (!session) return <Login err={authErr} clearErr={() => setAuthErr('')} />;
  /* Remonté à chaque changement de compte : rien ne fuit d'un utilisateur à l'autre. */
  return <Signed key={session.user.id} uid={session.user.id} settings={settings} onSettings={changeSettings} onRefused={setAuthErr} />;
}

function Signed(p: { uid: string; settings: DeviceSettings; onSettings(s: DeviceSettings): void; onRefused(msg: string): void }) {
  const settings = p.settings;
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loadErr, setLoadErr] = useState('');
  const [markets, setMarkets] = useState<Market[] | null>(null);
  const [market, setMarket] = useState('');
  const [picking, setPicking] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showJournal, setShowJournal] = useState(false);
  const [journal, setJournal] = useState<{ doc: VenteDoc | null; byId: Record<string, Product> }>({ doc: null, byId: {} });
  const [equipeVersion, setEquipeVersion] = useState(0);
  const [attempt, setAttempt] = useState(0);

  /* Seuls les comptes admin / responsable actifs ont accès ; le responsable ne voit que ses marchés. */
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const pr = await getProfile(p.uid);
        if (!live) return;
        if (!pr || pr.actif === false || ['admin', 'responsable'].indexOf(pr.role) < 0) {
          p.onRefused('Ce compte n’est pas autorisé. Demande à un administrateur de l’activer.');
          await sb.auth.signOut();
          return;
        }
        const ms = await getMarkets(pr);
        const saved = await getSavedMarket(pr.id).catch(() => '');
        if (!live) return;
        setProfile(pr);
        setMarkets(ms);
        const ok = ms.find((m) => m.name === saved);
        if (ok) setMarket(ok.name);
        else if (ms.length === 1) setMarket(ms[0].name);
        else setPicking(true);
      } catch (e) {
        if (live) setLoadErr('Connexion à la base impossible : ' + (e as Error).message);
      }
    })();
    return () => {
      live = false;
    };
  }, [p.uid, attempt]); // eslint-disable-line react-hooks/exhaustive-deps

  const provider = useMemo(() => (settings.provider === 'sumup' ? sumup(settings.apiUrl) : simulated), [settings.provider, settings.apiUrl]);

  function choose(m: string) {
    setMarket(m);
    setPicking(false);
    if (profile) saveMarket(profile.id, m).catch(() => {});
  }

  if (loadErr)
    return (
      <Center>
        <Text style={[s.txt, { textAlign: 'center', marginBottom: 12 }]}>{loadErr}</Text>
        <Btn title="Réessayer" onPress={() => { setLoadErr(''); setAttempt((a) => a + 1); }} />
        <Btn ghost style={{ marginTop: 10 }} title="Se déconnecter" onPress={() => sb.auth.signOut()} />
      </Center>
    );
  if (!profile || !markets) return <Center><ActivityIndicator color={C.green} /></Center>;

  if (picking || !market)
    return (
      <View style={{ flex: 1, padding: 16 }}>
        <Text style={[s.h1, { marginBottom: 14 }]}>Sur quel marché es-tu ?</Text>
        {markets.map((m) => (
          <Btn key={m.key} ghost style={{ marginBottom: 10 }} title={m.name} onPress={() => choose(m.name)} />
        ))}
        {!markets.length ? <Text style={s.muted}>{profile.role === 'admin' ? 'Aucun marché : crée-les dans Paramètres de l’appli web.' : 'Aucun marché ne t’est confié pour l’instant.'}</Text> : null}
        <Btn ghost style={{ marginTop: 20 }} title="Se déconnecter" onPress={() => sb.auth.signOut()} />
      </View>
    );

  return (
    <View style={{ flex: 1 }}>
      <View style={[s.row, { paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderColor: C.line, backgroundColor: '#fff' }]}>
        <Pressable style={{ flex: 1 }} onPress={() => setPicking(true)}>
          <Text style={s.muted}>Caisse · {settings.provider === 'simule' ? 'terminal simulé' : 'SumUp'}{settings.printer ? ' · 🖨️' : ''}</Text>
          <Text style={s.h1}>{market} ▾</Text>
        </Pressable>
        <Btn ghost title="📋" onPress={() => setShowJournal(true)} style={{ marginRight: 8 }} />
        <Btn ghost title="⚙️" onPress={() => setShowSettings(true)} />
      </View>
      {/* key = marché : changer de marché repart avec des tickets vides */}
      <Caisse key={market} market={market} settings={settings} provider={provider} equipeVersion={equipeVersion} onJournal={(doc, byId) => setJournal({ doc, byId })} />
      <Journal visible={showJournal} onClose={() => setShowJournal(false)} doc={journal.doc} byId={journal.byId} market={market} settings={settings} />
      <Settings
        visible={showSettings}
        onClose={() => setShowSettings(false)}
        settings={settings}
        onChange={p.onSettings}
        market={market}
        onTerminalsSaved={() => setEquipeVersion((v) => v + 1)}
        onChangeMarket={() => { setShowSettings(false); setPicking(true); }}
        onLogout={() => { setShowSettings(false); sb.auth.signOut(); }}
        who={profile.email + ' (' + (profile.role === 'admin' ? 'administrateur' : 'responsable') + ')'}
      />
    </View>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>{children}</View>;
}

function Login({ err, clearErr }: { err: string; clearErr(): void }) {
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  async function go() {
    clearErr();
    setMsg('');
    setBusy(true);
    const r = await sb.auth.signInWithPassword({ email: email.trim(), password: pass });
    setBusy(false);
    if (r.error) setMsg('E-mail ou mot de passe incorrect.');
  }

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, justifyContent: 'center', padding: 24 }}>
      <Text style={[s.h1, { fontSize: 26 }]}>Caisse marché</Text>
      <Text style={[s.muted, { marginBottom: 20 }]}>Connexion du responsable</Text>
      <TextInput style={[s.input, { marginBottom: 10 }]} placeholder="E-mail" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
      <TextInput style={[s.input, { marginBottom: 14 }]} placeholder="Mot de passe" secureTextEntry value={pass} onChangeText={setPass} onSubmitEditing={go} />
      <Btn title="Se connecter" busy={busy} disabled={!email || !pass} onPress={go} />
      {msg || err ? <Text style={{ color: C.red, marginTop: 12 }}>{msg || err}</Text> : null}
    </KeyboardAvoidingView>
  );
}
