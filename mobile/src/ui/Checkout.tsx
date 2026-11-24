import React, { useRef, useState } from 'react';
import { ActivityIndicator, Text, TextInput, View } from 'react-native';
import { Btn, Check, Chip, Sheet } from './kit';
import { C, s } from './theme';
import { change, eur, parseAmount, roundingOptions } from '../lib/money';
import { Line, Ticket } from '../lib/ticket';
import { CardInfo, LogEntry, entryFrom } from '../lib/sales';
import { PaymentSession, Provider } from '../payments';
import { cardReceipt, cashReceipt } from '../print/receipts';
import { printReceipt } from '../print/printer';
import { DeviceSettings } from '../services/settings';

type Step = 'amount' | 'paying' | 'done' | 'failed' | 'preview';

/* Monté seulement pendant un encaissement : chaque ouverture repart de zéro (montant exact, carte, cases décochées). */
export type CheckoutProps = {
  seller: string;
  terminal: string;
  market: string;
  ticket: Ticket;
  lines: Line[];
  brut: number;
  settings: DeviceSettings;
  provider: Provider;
  record(e: LogEntry): Promise<unknown>;
  onCancel(): void; // fermé sans vente : le ticket reste ouvert
  onDone(): void; // vente enregistrée : le ticket du vendeur est vidé
};

export function Checkout(p: CheckoutProps) {
  const [step, setStep] = useState<Step>('amount');
  const [amount, setAmount] = useState(p.brut);
  const [custom, setCustom] = useState('');
  const [mode, setMode] = useState<'cb' | 'esp'>('cb');
  const [given, setGiven] = useState('');
  const [status, setStatus] = useState('');
  const [reason, setReason] = useState('');
  const [card, setCard] = useState<CardInfo | undefined>();
  const [entry, setEntry] = useState<LogEntry | null>(null);
  const [save, setSave] = useState<'saving' | 'saved' | 'error'>('saving');
  const [saveErr, setSaveErr] = useState('');
  const [wantCb, setWantCb] = useState(false);
  const [wantCaisse, setWantCaisse] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [previews, setPreviews] = useState<{ title: string; text: string }[]>([]);
  const [canSimulate, setCanSimulate] = useState(false);
  const session = useRef<PaymentSession | null>(null);

  const remise = Math.max(0, Math.round((p.brut - amount) * 100) / 100);
  const givenN = parseAmount(given);
  const rendu = change(amount, givenN);
  const amountOk = amount > 0 && amount <= p.brut;

  function chooseCustom(t: string) {
    setCustom(t);
    const v = parseAmount(t);
    if (v != null) setAmount(v);
  }

  async function persist(e: LogEntry) {
    setSave('saving');
    setSaveErr('');
    try {
      await p.record(e);
      setSave('saved');
    } catch (x) {
      setSave('error');
      setSaveErr((x as Error).message || 'connexion');
    }
  }

  function finalize(m: 'cb' | 'esp', c?: CardInfo) {
    const e = entryFrom(p.ticket, p.seller, amount, p.brut, m, c);
    setEntry(e);
    setCard(c);
    setStep('done');
    persist(e);
  }

  function payCard() {
    const ref = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
    setStatus('Préparation…');
    setStep('paying');
    const ss = p.provider.start({ amount, terminal: p.terminal, seller: p.seller, ref, onStatus: setStatus });
    session.current = ss;
    setCanSimulate(!!ss.simulate);
    ss.result.then((r) => {
      if (session.current !== ss) return;
      session.current = null;
      if (r.ok) finalize('cb', r.card);
      else {
        setReason(r.reason);
        setStep('failed');
      }
    });
  }

  async function finish() {
    if (!entry) return;
    const jobs: { title: string; r: ReturnType<typeof cashReceipt> }[] = [];
    if (wantCb && card) jobs.push({ title: 'Ticket CB', r: cardReceipt({ shop: p.settings.shop, market: p.market, at: entry.t, amount, cb: card }, p.settings.cols) });
    if (wantCaisse)
      jobs.push({
        title: 'Ticket de caisse',
        r: cashReceipt(
          { shop: p.settings.shop, market: p.market, seller: p.seller, at: entry.t, lines: p.lines, brut: p.brut, paid: amount, mode: entry.m || 'cb', given: givenN, change: rendu, cb: card },
          p.settings.cols,
        ),
      });
    if (!jobs.length) return p.onDone();
    if (!p.settings.printer) {
      setPreviews(jobs.map((j) => ({ title: j.title, text: j.r.preview.join('\n') })));
      setStep('preview');
      return;
    }
    setPrinting(true);
    try {
      for (const j of jobs) await printReceipt(p.settings.printer.address, j.r);
      p.onDone();
    } catch (x) {
      setPreviews([{ title: 'Impression impossible : ' + ((x as Error).message || 'imprimante injoignable'), text: '' }, ...jobs.map((j) => ({ title: j.title, text: j.r.preview.join('\n') }))]);
      setStep('preview');
    } finally {
      setPrinting(false);
    }
  }

  const sellerTxt = p.seller ? ' de ' + p.seller : '';
  const close =
    step === 'amount' || step === 'failed'
      ? p.onCancel
      : step === 'preview' || (step === 'done' && save === 'saved')
        ? p.onDone
        : undefined;

  let body: React.ReactNode = null;
  let footer: React.ReactNode = null;

  if (step === 'amount') {
    const opts = roundingOptions(p.brut);
    body = (
      <>
        <View style={s.card}>
          <Text style={s.muted}>Total du ticket{sellerTxt}</Text>
          <Text style={[s.h1, { fontSize: 30 }]}>{eur(p.brut)}</Text>
          <Text style={[s.muted, { marginTop: 12, marginBottom: 6 }]}>Montant à encaisser</Text>
          <View style={[s.row, { flexWrap: 'wrap' }]}>
            <Chip label={'Exact ' + eur(p.brut)} on={amount === p.brut && !custom} onPress={() => { setCustom(''); setAmount(p.brut); }} />
            {opts.map((o) => (
              <Chip key={o.label} label={o.label} on={amount === o.amount && !custom} onPress={() => { setCustom(''); setAmount(o.amount); }} />
            ))}
          </View>
          <TextInput style={s.input} keyboardType="decimal-pad" placeholder="Autre montant (ex. 65)" value={custom} onChangeText={chooseCustom} />
          {remise > 0 ? <Text style={{ color: C.amber, marginTop: 8, fontWeight: '600' }}>Geste commercial : {eur(remise)}</Text> : null}
          {!amountOk ? <Text style={{ color: C.red, marginTop: 8 }}>Le montant doit être positif et pas plus élevé que le ticket.</Text> : null}
        </View>
        <View style={s.card}>
          <Text style={s.h2}>Paiement</Text>
          <View style={s.row}>
            <Chip label="💳 Carte" on={mode === 'cb'} onPress={() => setMode('cb')} />
            <Chip label="💶 Espèces" on={mode === 'esp'} onPress={() => setMode('esp')} />
          </View>
          {mode === 'cb' ? (
            <Text style={s.muted}>
              {p.provider.id === 'simule' ? 'Terminal simulé (Réglages pour brancher SumUp).' : p.terminal ? 'Terminal : ' + p.terminal : 'Aucun terminal associé' + sellerTxt + ' (Réglages).'}
            </Text>
          ) : (
            <>
              <TextInput style={s.input} keyboardType="decimal-pad" placeholder="Somme donnée par le client (facultatif)" value={given} onChangeText={setGiven} />
              {givenN != null ? (
                <Text style={[s.txt, { marginTop: 8, fontWeight: '700' }]}>{rendu == null ? 'Somme insuffisante' : 'À rendre : ' + eur(rendu)}</Text>
              ) : null}
            </>
          )}
        </View>
      </>
    );
    footer =
      mode === 'cb' ? (
        <Btn title={'Envoyer ' + eur(amount) + ' au terminal'} disabled={!amountOk || (p.provider.id !== 'simule' && !p.terminal)} onPress={payCard} />
      ) : (
        <Btn title={'Encaisser ' + eur(amount) + ' en espèces'} disabled={!amountOk || (givenN != null && rendu == null)} onPress={() => finalize('esp')} />
      );
  } else if (step === 'paying') {
    body = (
      <View style={[s.card, { alignItems: 'center', paddingVertical: 28 }]}>
        <Text style={[s.h1, { fontSize: 32 }]}>{eur(amount)}</Text>
        <Text style={[s.muted, { marginBottom: 18 }]}>envoyé au terminal{sellerTxt}</Text>
        <ActivityIndicator size="large" color={C.green} />
        <Text style={[s.txt, { marginTop: 14, textAlign: 'center' }]}>{status}</Text>
      </View>
    );
    footer = (
      <>
        {canSimulate ? (
          <View style={[s.row, { marginBottom: 10 }]}>
            <Btn style={{ flex: 1, marginRight: 8 }} title="Simuler : acceptée" onPress={() => session.current?.simulate?.(true)} />
            <Btn style={{ flex: 1 }} danger title="Simuler : refusée" onPress={() => session.current?.simulate?.(false)} />
          </View>
        ) : null}
        <Btn ghost title="Annuler le paiement" onPress={() => session.current?.cancel()} />
      </>
    );
  } else if (step === 'failed') {
    body = (
      <View style={[s.card, { alignItems: 'center', paddingVertical: 24 }]}>
        <Text style={{ fontSize: 40 }}>⚠️</Text>
        <Text style={[s.h2, { textAlign: 'center' }]}>{reason}</Text>
        <Text style={[s.muted, { textAlign: 'center' }]}>Rien n’a été encaissé, le ticket reste ouvert.</Text>
      </View>
    );
    footer = (
      <View style={s.row}>
        <Btn ghost style={{ flex: 1, marginRight: 8 }} title="Fermer" onPress={p.onCancel} />
        <Btn style={{ flex: 1 }} title="Réessayer" onPress={() => setStep('amount')} />
      </View>
    );
  } else if (step === 'done') {
    body = (
      <>
        <View style={[s.card, { alignItems: 'center', backgroundColor: C.greenSoft, borderColor: C.greenSoft }]}>
          <Text style={{ fontSize: 34 }}>✅</Text>
          <Text style={s.h2}>{entry?.m === 'cb' ? 'Paiement accepté' : 'Encaissé en espèces'} · {eur(amount)}</Text>
          {remise > 0 ? <Text style={{ color: C.amber }}>Geste commercial {eur(remise)}</Text> : null}
          <Text style={[s.muted, { marginTop: 6 }]}>
            {save === 'saving' ? 'Enregistrement…' : save === 'saved' ? 'Vente enregistrée' + sellerTxt : 'Vente PAS encore enregistrée : ' + saveErr}
          </Text>
          {save === 'error' && entry ? <Btn style={{ marginTop: 10 }} title="Réessayer l'enregistrement" onPress={() => persist(entry)} /> : null}
        </View>
        <View style={s.card}>
          <Text style={s.h2}>Le client veut-il un ticket ?</Text>
          {entry?.m === 'cb' ? <Check label="Ticket CB" sub="Reçu du paiement par carte" on={wantCb} onToggle={() => setWantCb(!wantCb)} /> : null}
          <Check label="Ticket de caisse" sub="Détail des articles" on={wantCaisse} onToggle={() => setWantCaisse(!wantCaisse)} />
          {!p.settings.printer ? <Text style={s.muted}>Aucune imprimante reliée : un aperçu s’affichera.</Text> : null}
        </View>
      </>
    );
    footer = <Btn title={wantCb || wantCaisse ? 'Imprimer et terminer' : 'Terminer sans ticket'} busy={printing} disabled={save !== 'saved'} onPress={finish} />;
  } else if (step === 'preview') {
    body = previews.map((pv, i) => (
      <View key={i} style={s.card}>
        <Text style={[s.h2, pv.text ? null : { color: C.red }]}>{pv.title}</Text>
        {pv.text ? <Text style={s.mono}>{pv.text}</Text> : null}
      </View>
    ));
    footer = <Btn title="Terminer" onPress={p.onDone} />;
  }

  return (
    <Sheet visible title={step === 'preview' ? 'Aperçu des tickets' : 'Encaissement' + sellerTxt} onClose={close} footer={footer}>
      {body}
    </Sheet>
  );
}
