import React from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View, ViewStyle } from 'react-native';
import { C, s } from './theme';

export function Btn(p: { title: string; onPress(): void; ghost?: boolean; danger?: boolean; disabled?: boolean; busy?: boolean; style?: ViewStyle }) {
  const bg = p.ghost ? s.btnGhost : [s.btn, p.danger ? { backgroundColor: C.red } : null];
  return (
    <Pressable
      accessibilityRole="button"
      onPress={p.disabled || p.busy ? undefined : p.onPress}
      style={({ pressed }) => [bg as ViewStyle, { opacity: p.disabled ? 0.45 : pressed ? 0.8 : 1 }, p.style]}
    >
      {p.busy ? <ActivityIndicator color={p.ghost ? C.ink : '#fff'} /> : <Text style={p.ghost ? s.btnGhostTxt : s.btnTxt}>{p.title}</Text>}
    </Pressable>
  );
}

export function Chip(p: { label: string; on?: boolean; badge?: number; onPress(): void; onLongPress?(): void }) {
  return (
    <Pressable onPress={p.onPress} onLongPress={p.onLongPress} style={[s.chip, p.on && s.chipOn, s.row]}>
      <Text style={[s.chipTxt, p.on && s.chipTxtOn]}>{p.label}</Text>
      {p.badge ? (
        <View style={{ marginLeft: 6, backgroundColor: p.on ? '#fff' : C.green, borderRadius: 999, minWidth: 20, paddingHorizontal: 5, alignItems: 'center' }}>
          <Text style={{ color: p.on ? C.green : '#fff', fontSize: 12, fontWeight: '700' }}>{p.badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export function Check(p: { label: string; on: boolean; onToggle(): void; sub?: string }) {
  return (
    <Pressable onPress={p.onToggle} style={[s.row, { paddingVertical: 12 }]} accessibilityRole="checkbox" accessibilityState={{ checked: p.on }}>
      <View
        style={{ width: 28, height: 28, borderRadius: 7, borderWidth: 2, borderColor: p.on ? C.green : C.muted, backgroundColor: p.on ? C.green : '#fff', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}
      >
        {p.on ? <Text style={{ color: '#fff', fontWeight: '800' }}>✓</Text> : null}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[s.txt, { fontSize: 17, fontWeight: '600' }]}>{p.label}</Text>
        {p.sub ? <Text style={s.muted}>{p.sub}</Text> : null}
      </View>
    </Pressable>
  );
}

/* Feuille modale plein écran (bas de l'écran sur téléphone). */
export function Sheet(p: { visible: boolean; title: string; onClose?(): void; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <Modal visible={p.visible} animationType="slide" transparent onRequestClose={p.onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: C.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '92%', paddingBottom: 18 }}>
          <View style={[s.row, { padding: 16, paddingBottom: 8 }]}>
            <Text style={[s.h1, { flex: 1 }]}>{p.title}</Text>
            {p.onClose ? (
              <Pressable onPress={p.onClose} hitSlop={12}>
                <Text style={{ fontSize: 22, color: C.muted }}>✕</Text>
              </Pressable>
            ) : null}
          </View>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 8 }} keyboardShouldPersistTaps="handled">
            {p.children}
          </ScrollView>
          {p.footer ? <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>{p.footer}</View> : null}
        </View>
      </View>
    </Modal>
  );
}

export function Toast({ msg }: { msg: string }) {
  if (!msg) return null;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 16, right: 16, bottom: 110, alignItems: 'center' }}>
      <View style={{ backgroundColor: C.ink, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10 }}>
        <Text style={{ color: '#fff', fontSize: 15 }}>{msg}</Text>
      </View>
    </View>
  );
}
