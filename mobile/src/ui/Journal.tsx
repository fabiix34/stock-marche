import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { Btn, Sheet } from './kit';
import { C, s } from './theme';
import { Product } from '../lib/catalog';
import { eur } from '../lib/money';
import { LogEntry, VenteDoc, summary } from '../lib/sales';
import { lines } from '../lib/ticket';
import { cashReceipt } from '../print/receipts';
import { printReceipt } from '../print/printer';
import { DeviceSettings } from '../services/settings';

const hhmm = (t: number) => new Date(t).toTimeString().slice(0, 5);

/* Ventes du jour sur ce marché : récap par vendeur (carte / espèces / gestes) et réimpression d'un ticket. */
export function Journal(p: { visible: boolean; onClose(): void; doc: VenteDoc | null; byId: Record<string, Product>; market: string; settings: DeviceSettings }) {
  const [preview, setPreview] = useState('');
  const [busy, setBusy] = useState(-1);
  const sum = summary(p.doc);
  const log = (p.doc?.log || []).map((e, i) => ({ e, i })).reverse();

  async function reprint(e: LogEntry, i: number) {
    const tk = { pieces: e.l || {}, weights: e.k || {} };
    const r = cashReceipt(
      { shop: p.settings.shop, market: p.market, seller: e.s, at: e.t, lines: lines(tk, p.byId), brut: e.b ?? e.v, paid: e.v, mode: e.m || 'esp', cb: e.cb },
      p.settings.cols,
    );
    if (!p.settings.printer) return setPreview(r.preview.join('\n'));
    setBusy(i);
    try {
      await printReceipt(p.settings.printer.address, r);
    } catch (x) {
      setPreview('Impression impossible : ' + (x as Error).message + '\n\n' + r.preview.join('\n'));
    } finally {
      setBusy(-1);
    }
  }

  return (
    <Sheet visible={p.visible} title="Ventes du jour" onClose={preview ? () => setPreview('') : p.onClose}>
      {preview ? (
        <View style={s.card}>
          <Text style={s.mono}>{preview}</Text>
          <Btn ghost style={{ marginTop: 10 }} title="Retour" onPress={() => setPreview('')} />
        </View>
      ) : (
        <>
          <View style={s.card}>
            <Text style={s.h2}>Total encaissé : {eur(p.doc?.ca || 0)} · {p.doc?.n || 0} tickets</Text>
            {sum.map((r) => (
              <View key={r.name} style={{ paddingVertical: 6, borderTopWidth: 1, borderColor: C.line }}>
                <View style={s.row}>
                  <Text style={[s.txt, { flex: 1, fontWeight: '700' }]}>{r.name}</Text>
                  <Text style={[s.txt, { fontWeight: '700' }]}>{eur(r.paid)}</Text>
                </View>
                <Text style={s.muted}>
                  {r.n} ticket{r.n > 1 ? 's' : ''} · carte {eur(r.cb)} · espèces {eur(r.esp)}{r.remise ? ' · gestes ' + eur(r.remise) : ''}
                </Text>
              </View>
            ))}
            {!sum.length ? <Text style={s.muted}>Aucune vente aujourd’hui.</Text> : null}
          </View>
          {log.map(({ e, i }) => (
            <View key={i} style={[s.card, s.row, { paddingVertical: 10 }]}>
              <View style={{ flex: 1 }}>
                <Text style={s.txt}>
                  {hhmm(e.t)} · {e.s || '—'} · {e.m === 'cb' ? '💳' : e.m === 'esp' ? '💶' : ''} {eur(e.v)}
                </Text>
                {e.b != null && e.b > e.v ? <Text style={{ color: C.amber, fontSize: 13 }}>Geste {eur(e.b - e.v)} (ticket {eur(e.b)})</Text> : null}
              </View>
              <Btn ghost title="🖨️" busy={busy === i} onPress={() => reprint(e, i)} />
            </View>
          ))}
        </>
      )}
    </Sheet>
  );
}
