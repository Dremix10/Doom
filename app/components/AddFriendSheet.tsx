// "Add Friend": share your own code or link, or type in someone else's code.
// Friends added this way don't need to be in a group — they show up under the
// board's "All friends" option.
import { useState } from 'react';
import { Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { C, T, S, R, CONTINUOUS, HAIRLINE, MIN_TAP } from '../lib/theme';

type Props = { visible: boolean; onClose: () => void; onAdded: () => void };

export function AddFriendSheet({ visible, onClose, onAdded }: Props) {
  const { me } = useAuth();
  const insets = useSafeAreaInsets();
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState('');

  // The link only makes sense where there's an origin to build it from.
  const link = Platform.OS === 'web' && typeof window !== 'undefined' && me
    ? `${window.location.origin}/?invite=${me.invite_code}`
    : null;

  const copy = (text: string, what: string) => {
    if (Platform.OS === 'web') {
      try { navigator.clipboard.writeText(text); setMsg(`${what} copied.`); } catch { /* ignore */ }
    } else {
      Alert.alert(what, text);
    }
  };

  const add = async () => {
    if (!code.trim()) return;
    try {
      const f = await api.addFriend(code.trim().toUpperCase());
      setCode(''); setMsg(`Added ${f.name}.`);
      onAdded();
    } catch (e: any) { setMsg(e.message); }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose} />
      <View style={[s.sheet, { paddingBottom: insets.bottom + S.xl }]}>
        <View style={s.grabber} />
        <ScrollView style={{ maxHeight: 460 }} contentContainerStyle={{ paddingBottom: S.md }}>
          <Text style={s.title}>Add a friend</Text>
          <Text style={s.caption}>They'll appear under "All friends" on the board.</Text>

          <Text style={s.h2}>Your code</Text>
          <Pressable onPress={() => me && copy(me.invite_code, 'Code')} style={({ pressed }) => pressed && { opacity: 0.7 }}>
            <Text style={s.code}>{me?.invite_code ?? '······'}</Text>
          </Pressable>
          {link && (
            <Pressable onPress={() => copy(link, 'Link')} style={({ pressed }) => [s.linkBox, pressed && { opacity: 0.7 }]}>
              <Text style={s.link} numberOfLines={1}>{link}</Text>
              <Text style={s.linkHint}>Copy link</Text>
            </Pressable>
          )}
          <Text style={s.hint}>Tap to copy. Opening the link adds you both.</Text>

          <Text style={s.h2}>Have their code?</Text>
          <View style={s.row}>
            <TextInput
              style={s.input} placeholder="ABC123" placeholderTextColor={C.faint}
              value={code} onChangeText={setCode} autoCapitalize="characters" autoCorrect={false}
              onSubmitEditing={add} returnKeyType="done"
            />
            <Pressable style={({ pressed }) => [s.btn, pressed && { opacity: 0.75 }]} onPress={add}>
              <Text style={s.btnText}>Add</Text>
            </Pressable>
          </View>

          {!!msg && <Text style={s.msg}>{msg}</Text>}
        </ScrollView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: C.card, borderTopLeftRadius: 22, borderTopRightRadius: 22, ...CONTINUOUS,
    paddingHorizontal: S.gutter, paddingTop: S.sm,
    borderTopWidth: HAIRLINE, borderColor: C.line,
    ...Platform.select({ web: { maxWidth: 560, marginHorizontal: 'auto' as any }, default: {} }),
  },
  grabber: { width: 36, height: 5, borderRadius: R.full, backgroundColor: C.line, alignSelf: 'center', marginBottom: S.md },
  title: { ...T.title1, color: C.text },
  caption: { ...T.footnote, color: C.faint, marginTop: S.xs },
  h2: {
    ...T.footnote, fontWeight: '600', color: C.dim, textTransform: 'uppercase',
    letterSpacing: 0.6, marginTop: S.xl, marginBottom: S.sm,
  },
  code: {
    ...T.largeTitle, color: C.text, letterSpacing: 8, textAlign: 'center',
    backgroundColor: C.card2, borderRadius: R.md, ...CONTINUOUS, paddingVertical: S.md,
  },
  linkBox: {
    flexDirection: 'row', alignItems: 'center', gap: S.md, marginTop: S.sm,
    backgroundColor: C.card2, borderRadius: R.md, ...CONTINUOUS,
    paddingHorizontal: S.md, minHeight: MIN_TAP,
  },
  link: { ...T.footnote, color: C.dim, flex: 1 },
  linkHint: { ...T.footnote, color: C.accent, fontWeight: '600' },
  hint: { ...T.caption, color: C.faint, marginTop: S.sm, textAlign: 'center' },
  row: { flexDirection: 'row', gap: S.sm + 2 },
  input: {
    flex: 1, backgroundColor: C.card2, color: C.text, borderRadius: R.md, ...CONTINUOUS,
    paddingHorizontal: S.md + 2, minHeight: MIN_TAP, borderWidth: HAIRLINE, borderColor: C.line,
    ...T.body, letterSpacing: 2,
  },
  btn: {
    backgroundColor: C.accent, borderRadius: R.md, ...CONTINUOUS,
    paddingHorizontal: S.xl, minHeight: MIN_TAP, justifyContent: 'center',
  },
  btnText: { ...T.headline, color: '#fff' },
  msg: { ...T.subhead, color: C.drifting, marginTop: S.md },
});
