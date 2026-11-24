import { StyleSheet } from 'react-native';

export const C = {
  bg: '#f6f4ef',
  card: '#ffffff',
  ink: '#1f2a24',
  muted: '#6b7280',
  line: '#e5e1d8',
  green: '#2f7d4f',
  greenSoft: '#e3f1e8',
  red: '#b42318',
  amber: '#b45309',
  amberSoft: '#fdf1dc',
};

export const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  card: { backgroundColor: C.card, borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: C.line },
  h1: { fontSize: 22, fontWeight: '700', color: C.ink },
  h2: { fontSize: 17, fontWeight: '700', color: C.ink, marginBottom: 8 },
  txt: { fontSize: 15, color: C.ink },
  muted: { fontSize: 13, color: C.muted },
  input: { borderWidth: 1, borderColor: C.line, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, backgroundColor: '#fff', color: C.ink },
  btn: { backgroundColor: C.green, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16, alignItems: 'center' },
  btnTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
  btnGhost: { borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, alignItems: 'center', borderWidth: 1, borderColor: C.line, backgroundColor: '#fff' },
  btnGhostTxt: { color: C.ink, fontSize: 15, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center' },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, borderWidth: 1, borderColor: C.line, backgroundColor: '#fff', marginRight: 8, marginBottom: 8 },
  chipOn: { backgroundColor: C.green, borderColor: C.green },
  chipTxt: { fontSize: 15, color: C.ink, fontWeight: '600' },
  chipTxtOn: { color: '#fff' },
  mono: { fontFamily: 'monospace', fontSize: 12, color: C.ink },
});
