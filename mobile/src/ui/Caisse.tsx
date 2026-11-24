import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { Btn, Chip, Sheet, Toast } from './kit';
import { C, s } from './theme';
import { Checkout } from './Checkout';
import { Product, categories, todayStr } from '../lib/catalog';
import { eur, kg } from '../lib/money';
import { Ticket, addPiece, addWeight, count, emptyTicket, lines, missingPrices, removeWeight, total } from '../lib/ticket';
import { VenteDoc } from '../lib/sales';
import { Equipe, getEquipe, getProducts, getVente, recordSale, watchVente } from '../services/data';
import { DeviceSettings } from '../services/settings';
import { Provider } from '../payments';

/* ============== BALANCE ==============
   Lecture simulée d'une balance : à remplacer par la vraie balance connectée quand elle sera choisie. */
function readWeight(): Promise<number> {
  return new Promise((r) => setTimeout(() => r(Math.round((0.2 + Math.random() * 1.8) * 1000) / 1000), 250));
}

type Props = {
  market: string;
  settings: DeviceSettings;
  provider: Provider;
  equipeVersion: number;
  onJournal(doc: VenteDoc | null, byId: Record<string, Product>): void;
};

export function Caisse(p: Props) {
  const { width } = useWindowDimensions();
  const [products, setProducts] = useState<Product[]>([]);
  const [equipe, setEquipe] = useState<Equipe>({ market: p.market, vendeurs: [], terminaux: {} });
  const [tickets, setTickets] = useState<Record<string, Ticket>>({});
  const [seller, setSeller] = useState('');
  const [cat, setCat] = useState('');
  const [query, setQuery] = useState('');
  const [vente, setVente] = useState<VenteDoc | null>(null);
  const [weighFor, setWeighFor] = useState<Product | null>(null);
  const [weightTxt, setWeightTxt] = useState('');
  const [showTicket, setShowTicket] = useState(false);
  const [paying, setPaying] = useState(false);
  const [toast, setToast] = useState('');
  const [loadErr, setLoadErr] = useState('');
  const toastT = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const say = useCallback((m: string) => {
    setToast(m);
    clearTimeout(toastT.current);
    toastT.current = setTimeout(() => setToast(''), 2200);
  }, []);

  const byId = useMemo(() => Object.fromEntries(products.map((x) => [x.id, x])), [products]);
  const cats = useMemo(() => categories(products), [products]);
  const date = todayStr();

  useEffect(() => {
    getProducts().then((ps) => {
      setProducts(ps);
      setCat((c) => c || categories(ps)[0] || '');
    }, (e) => setLoadErr('Articles : ' + e.message));
    getVente(date, p.market).then(setVente, () => {});
    return watchVente(date, p.market, setVente);
  }, [p.market, date]);

  /* Équipe (prénoms + terminaux) ; rechargée après un changement dans les Réglages. */
  useEffect(() => {
    getEquipe(p.market).then((e) => {
      setEquipe(e);
      setSeller((cur) => (e.vendeurs.length === 1 ? e.vendeurs[0] : e.vendeurs.indexOf(cur) >= 0 ? cur : ''));
    }, (e) => setLoadErr('Équipe : ' + e.message));
  }, [p.market, p.equipeVersion]);

  useEffect(() => p.onJournal(vente, byId), [vente, byId]); // eslint-disable-line react-hooks/exhaustive-deps

  const sellers = equipe.vendeurs;
  const needSeller = sellers.length > 0 && !seller;
  const key = sellers.length ? seller : '';
  const tk = tickets[key] || emptyTicket();
  const tkLines = lines(tk, byId);
  const tkTotal = total(tk, byId);
  const n = count(tk);

  function update(fn: (t: Ticket) => Ticket) {
    if (needSeller) return say('Choisis ton prénom');
    setTickets((all) => ({ ...all, [key]: fn(all[key] || emptyTicket()) }));
  }

  function tap(prod: Product) {
    if (needSeller) return say('Choisis ton prénom');
    if (prod.unit === 'kg') {
      setWeightTxt('');
      setWeighFor(prod);
    } else update((t) => addPiece(t, prod.id));
  }

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q) return products.filter((x) => x.name.toLowerCase().includes(q) || (x.code != null && String(x.code) === q));
    return products.filter((x) => x.cat === cat);
  }, [products, cat, query]);

  function startPay() {
    if (!n) return;
    if (needSeller) return say('Choisis ton prénom');
    const miss = missingPrices(tk, byId);
    if (miss.length) return say('Prix manquant : ' + miss.slice(0, 2).join(', '));
    setShowTicket(false);
    setPaying(true);
  }

  function afterSale() {
    const who = key;
    setPaying(false);
    setTickets((all) => ({ ...all, [who]: emptyTicket() }));
    if (sellers.length > 1) setSeller('');
    say((who ? who + ' · ' : '') + 'Vente enregistrée ✓');
  }

  const qtyIn = (id: string) => (tk.pieces[id] || 0) + (tk.weights[id] || []).length;
  const colsN = width > 700 ? 5 : width > 480 ? 4 : 3;
  const tileW = (width - 24 - (colsN - 1) * 8) / colsN;

  return (
    <View style={{ flex: 1 }}>
      {loadErr ? <Text style={{ color: C.red, padding: 12 }}>{loadErr}</Text> : null}

      {sellers.length ? (
        <View style={{ paddingHorizontal: 12, paddingTop: 10, backgroundColor: needSeller ? C.amberSoft : 'transparent' }}>
          {needSeller ? <Text style={[s.muted, { marginBottom: 6, color: C.amber, fontWeight: '700' }]}>Qui sert ? Touche ton prénom</Text> : null}
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {sellers.map((v) => (
              <Chip key={v} label={v} on={v === seller} badge={count(tickets[v] || emptyTicket())} onPress={() => setSeller(v)} />
            ))}
          </ScrollView>
        </View>
      ) : null}

      <View style={{ paddingHorizontal: 12, paddingTop: 8 }}>
        <TextInput style={[s.input, { paddingVertical: 8 }]} placeholder="Rechercher un produit ou un code" value={query} onChangeText={setQuery} />
      </View>
      {!query ? (
        <View style={{ paddingHorizontal: 12, paddingTop: 8 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {cats.map((c) => (
              <Chip key={c} label={c} on={c === cat} onPress={() => setCat(c)} />
            ))}
          </ScrollView>
        </View>
      ) : null}

      <FlatList
        key={colsN}
        data={shown}
        numColumns={colsN}
        keyExtractor={(x) => x.id}
        contentContainerStyle={{ padding: 12, paddingBottom: 120 }}
        columnWrapperStyle={{ gap: 8 }}
        ListEmptyComponent={<Text style={[s.muted, { textAlign: 'center', marginTop: 30 }]}>{products.length ? 'Aucun produit' : 'Chargement des articles…'}</Text>}
        renderItem={({ item }) => {
          const q = qtyIn(item.id);
          return (
            <Pressable
              onPress={() => tap(item)}
              style={({ pressed }) => ({
                width: tileW, minHeight: 84, marginBottom: 8, borderRadius: 12, padding: 10, justifyContent: 'space-between',
                backgroundColor: q ? C.greenSoft : '#fff', borderWidth: 1, borderColor: q ? C.green : C.line, opacity: pressed ? 0.7 : needSeller ? 0.55 : 1,
              })}
            >
              <Text style={{ fontSize: 14, fontWeight: '600', color: C.ink }} numberOfLines={2}>{item.name}</Text>
              <View style={s.row}>
                <Text style={[s.muted, { flex: 1 }]}>{item.price != null ? eur(item.price) + (item.unit === 'kg' ? '/kg' : '') : 'sans prix'}</Text>
                {q ? <Text style={{ color: C.green, fontWeight: '800' }}>{q}</Text> : null}
              </View>
            </Pressable>
          );
        }}
      />

      {/* Barre du ticket en cours */}
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#fff', borderTopWidth: 1, borderColor: C.line, padding: 12, flexDirection: 'row', alignItems: 'center' }}>
        <Pressable style={{ flex: 1 }} onPress={() => n && setShowTicket(true)}>
          <Text style={s.muted}>{needSeller ? 'Choisis ton prénom' : (key ? key + ' · ' : '') + (n ? n + ' article' + (n > 1 ? 's' : '') + ' ▲' : 'Ticket vide')}</Text>
          <Text style={[s.h1, { fontSize: 24 }]}>{eur(tkTotal)}</Text>
        </Pressable>
        <Btn title="Encaisser" disabled={!n} onPress={startPay} style={{ paddingHorizontal: 26 }} />
      </View>

      {/* Détail du ticket */}
      <Sheet
        visible={showTicket}
        title={'Ticket' + (key ? ' de ' + key : '')}
        onClose={() => setShowTicket(false)}
        footer={
          <View style={s.row}>
            <Btn ghost style={{ marginRight: 8 }} title="Vider" onPress={() => { update(() => emptyTicket()); setShowTicket(false); }} />
            <Btn style={{ flex: 1 }} title={'Encaisser ' + eur(tkTotal)} disabled={!n} onPress={startPay} />
          </View>
        }
      >
        {tkLines.map((l) => (
          <View key={l.id + (l.wi ?? '')} style={[s.card, s.row, { paddingVertical: 10 }]}>
            <View style={{ flex: 1 }}>
              <Text style={s.txt}>{l.name}</Text>
              <Text style={s.muted}>{l.unit === 'kg' ? kg(l.qty) + ' × ' + eur(l.price || 0) + '/kg' : l.qty + ' × ' + eur(l.price || 0)}</Text>
            </View>
            <Text style={[s.txt, { fontWeight: '700', marginRight: 10 }]}>{eur(l.amount)}</Text>
            {l.unit === 'kg' ? (
              <Btn ghost title="✕" onPress={() => update((t) => removeWeight(t, l.id, l.wi || 0))} />
            ) : (
              <View style={s.row}>
                <Btn ghost title="−" onPress={() => update((t) => addPiece(t, l.id, -1))} />
                <Btn ghost style={{ marginLeft: 6 }} title="+" onPress={() => update((t) => addPiece(t, l.id, 1))} />
              </View>
            )}
          </View>
        ))}
      </Sheet>

      {/* Pesée d'un produit au kilo */}
      <Sheet
        visible={!!weighFor}
        title={weighFor ? weighFor.name : ''}
        onClose={() => setWeighFor(null)}
        footer={
          <Btn
            title="Ajouter au ticket"
            disabled={!(Number(weightTxt.replace(',', '.')) > 0)}
            onPress={() => {
              const w = Number(weightTxt.replace(',', '.'));
              if (weighFor && w > 0) update((t) => addWeight(t, weighFor.id, w));
              setWeighFor(null);
            }}
          />
        }
      >
        <Text style={[s.muted, { marginBottom: 6 }]}>{weighFor?.price != null ? eur(weighFor.price) + ' le kilo' : 'Prix au kilo manquant'}</Text>
        <TextInput style={[s.input, { fontSize: 24 }]} keyboardType="decimal-pad" placeholder="Poids en kg (ex. 1,245)" value={weightTxt} onChangeText={setWeightTxt} />
        <Btn ghost style={{ marginTop: 10 }} title="⚖️ Lire la balance (simulée)" onPress={() => readWeight().then((w) => setWeightTxt(String(w).replace('.', ',')))} />
        {Number(weightTxt.replace(',', '.')) > 0 && weighFor?.price != null ? (
          <Text style={[s.h2, { marginTop: 12 }]}>= {eur(Math.round(Number(weightTxt.replace(',', '.')) * weighFor.price * 100) / 100)}</Text>
        ) : null}
      </Sheet>

      {paying ? (
      <Checkout
        seller={key}
        terminal={(equipe.terminaux || {})[key] || ''}
        market={p.market}
        ticket={tk}
        lines={tkLines}
        brut={tkTotal}
        settings={p.settings}
        provider={p.provider}
        record={(e) => recordSale(date, p.market, e).then((d) => setVente(d))}
        onCancel={() => setPaying(false)}
        onDone={afterSale}
      />
      ) : null}

      <Toast msg={toast} />
    </View>
  );
}
