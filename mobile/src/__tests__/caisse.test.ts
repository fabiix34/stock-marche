/// <reference types="jest" />
import { change, eur, parseAmount, roundingOptions } from '../lib/money';
import { Product, productsFromArticles, venteId } from '../lib/catalog';
import { addPiece, addWeight, count, emptyTicket, lines, removeWeight, total } from '../lib/ticket';
import { addSale, entryFrom, summary } from '../lib/sales';
import { encodeText, toBase64 } from '../print/escpos';
import { cardReceipt, cashReceipt } from '../print/receipts';

jest.mock('../services/supabase', () => ({ sb: {} }));
// eslint-disable-next-line import/first
import { simulated } from '../payments';

const ps: Product[] = productsFromArticles([
  { id: 'tom', nom: 'Tomates', categorie: 'Légumes', prix: 3.5, unite: 'kg', ordre: 2 },
  { id: 'sal', nom: 'Salade', categorie: 'Légumes', prix: '1.20', unite: 'piece', ordre: 1 },
  { id: 'old', nom: 'Ancien', categorie: 'Fruits', prix: 2, actif: false, ordre: 3 },
]);
const byId = Object.fromEntries(ps.map((p) => [p.id, p]));

test('catalogue : inactifs masqués, ordre, prix numériques', () => {
  expect(ps.map((p) => p.id)).toEqual(['sal', 'tom']);
  expect(byId.sal.price).toBe(1.2);
  expect(byId.tom.unit).toBe('kg');
  expect(venteId('2026-11-24', 'Boissy-Saint-Léger')).toBe('2026-11-24_boissy-saint-leger');
});

test('gestes commerciaux : 72,38 € -> 72 € et 70 €', () => {
  expect(roundingOptions(72.38).map((o) => o.amount)).toEqual([72, 70]);
  expect(roundingOptions(70).map((o) => o.amount)).toEqual([]);
  expect(roundingOptions(0.8)).toEqual([]);
  expect(parseAmount('72,5')).toBe(72.5);
  expect(parseAmount('abc')).toBeNull();
  expect(change(72, 80)).toBe(8);
  expect(change(72, 50)).toBeNull();
  expect(eur(1234.5).replace(/[  ]/g, ' ')).toBe('1 234,50 €');
});

test('ticket : pièces additionnées, une ligne par pesée', () => {
  let t = emptyTicket();
  t = addPiece(t, 'sal');
  t = addPiece(t, 'sal');
  t = addWeight(t, 'tom', 1.245);
  t = addWeight(t, 'tom', 0.5);
  expect(count(t)).toBe(4);
  expect(lines(t, byId).map((l) => l.amount)).toEqual([2.4, 4.36, 1.75]);
  expect(total(t, byId)).toBe(8.51);
  t = removeWeight(t, 'tom', 0);
  t = addPiece(t, 'sal', -2);
  expect(count(t)).toBe(1);
  expect(total(t, byId)).toBe(1.75);
});

test('vente : format compatible web, vendeur, mode et geste commercial', () => {
  let t = addWeight(addPiece(emptyTicket(), 'sal', 3), 'tom', 1);
  const e1 = entryFrom(t, 'Léa', 7, 7.1, 'cb', { txId: 'X', last4: '4242' }, 1000);
  let d = addSale(null, '2026-11-24', 'Boissy', e1);
  t = addPiece(emptyTicket(), 'sal');
  d = addSale(d, '2026-11-24', 'Boissy', entryFrom(t, 'Tom', 1.2, 1.2, 'esp', undefined, 2000));
  expect(d.id).toBe('2026-11-24_boissy');
  expect(d.items).toEqual({ sal: 4, tom: 1 });
  expect(d.ca).toBe(8.2);
  expect(d.n).toBe(2);
  expect(d.log[0]).toMatchObject({ s: 'Léa', v: 7, b: 7.1, m: 'cb', l: { sal: 3 }, k: { tom: [1] } });
  const sum = summary(d);
  expect(sum[0]).toMatchObject({ name: 'Léa', paid: 7, cb: 7, esp: 0, remise: 0.1 });
  expect(sum[1]).toMatchObject({ name: 'Tom', paid: 1.2, esp: 1.2 });
});

test('ESC/POS : accents en CP858, base64', () => {
  expect(encodeText('é€')).toEqual([0x82, 0xd5]);
  expect(encodeText('ő')).toEqual([0x6f]);
  expect(toBase64(Uint8Array.from([0x1b, 0x40, 0x41]))).toBe('G0BB');
  expect(toBase64(Uint8Array.from([0x41]))).toBe('QQ==');
});

test('tickets imprimés : caisse avec geste, CB', () => {
  const t = addWeight(addPiece(emptyTicket(), 'sal', 2), 'tom', 1.245);
  const r = cashReceipt({ shop: 'Primeur', market: 'Boissy', seller: 'Léa', at: Date.now(), lines: lines(t, byId), brut: 6.76, paid: 6, mode: 'esp', given: 10, change: 4 }, 32);
  const txt = r.preview.join('\n');
  expect(txt).toContain('Servi par Léa');
  expect(txt).toContain('Geste commercial');
  expect(txt).toContain('Rendu');
  r.preview.filter((l) => l.trim()).forEach((l) => expect(l.length).toBeLessThanOrEqual(32));
  const c = cardReceipt({ shop: 'Primeur', market: 'Boissy', at: Date.now(), amount: 6, cb: { txId: 'TX123', brand: 'VISA', last4: '4242' } }, 32);
  expect(c.preview.join('\n')).toContain('**** **** **** 4242');
  expect(c.toUint8()[0]).toBe(0x1b);
});

test('terminal simulé : acceptée, refusée, annulée', async () => {
  const st: string[] = [];
  const a = simulated.start({ amount: 72, terminal: 'T1', seller: 'Léa', ref: 'r1', onStatus: (x) => st.push(x) });
  a.simulate!(true);
  const ra = await a.result;
  expect(ra.ok && ra.card.last4?.length).toBe(4);
  const b = simulated.start({ amount: 72, terminal: 'T1', seller: 'Léa', ref: 'r2', onStatus: () => {} });
  b.simulate!(false);
  expect(await b.result).toMatchObject({ ok: false, reason: 'Carte refusée' });
  const c = simulated.start({ amount: 72, terminal: 'T1', seller: 'Léa', ref: 'r3', onStatus: () => {} });
  c.cancel();
  expect(await c.result).toMatchObject({ ok: false, cancelled: true });
});
