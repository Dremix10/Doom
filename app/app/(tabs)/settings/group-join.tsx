// The other half of the split: joining takes a code, creating takes a name, and
// they no longer sit on top of each other looking like the same form.
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput } from 'react-native';
import { router } from 'expo-router';
import { api } from '../../../lib/api';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { Palette, T, S, R, CONTINUOUS, HAIRLINE, MIN_TAP, useColors, useStyles } from '../../../lib/theme';

export default function JoinGroup() {
  const C = useColors();
  const s = useStyles(makeStyles);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const join = async () => {
    if (!code.trim() || busy) return;
    setBusy(true); setErr('');
    try {
      const g = await api.joinGroup(code.trim().toUpperCase());
      router.replace({ pathname: '/settings/group', params: { id: g.id } });
    } catch (e: any) { setErr(e.message); setBusy(false); }
  };

  return (
    <ScrollView style={s.wrap} contentContainerStyle={{ paddingHorizontal: S.gutter, paddingBottom: S.xxl }}>
      <ScreenHeader title="Join with a code" back="Your groups" />
      <Text style={s.body}>Ask a friend for their group's six-character code.</Text>
      <TextInput
        style={[s.input, { letterSpacing: 6, textAlign: 'center' }]}
        placeholder="ABC123"
        placeholderTextColor={C.faint}
        value={code}
        onChangeText={setCode}
        autoCapitalize="characters"
        autoCorrect={false}
        autoFocus
        maxLength={8}
        onSubmitEditing={join}
        returnKeyType="done"
      />
      {!!err && <Text style={s.err}>{err}</Text>}
      <Pressable
        style={({ pressed }) => [s.btn, (!code.trim() || busy) && { opacity: 0.5 }, pressed && { opacity: 0.75 }]}
        onPress={join}
        disabled={busy || !code.trim()}
      >
        {busy ? <ActivityIndicator color={C.onAccent} /> : <Text style={s.btnText}>Join</Text>}
      </Pressable>
    </ScrollView>
  );
}

const makeStyles = (C: Palette) => StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg },
  body: { ...T.subhead, color: C.dim, marginBottom: S.lg, lineHeight: 21 },
  input: {
    backgroundColor: C.card, color: C.text, borderRadius: R.lg, ...CONTINUOUS,
    paddingHorizontal: S.lg, minHeight: MIN_TAP + 6, ...T.title3, fontWeight: '600',
    borderWidth: HAIRLINE, borderColor: C.line,
  },
  err: { ...T.subhead, color: C.problem, marginTop: S.sm },
  btn: {
    backgroundColor: C.accent, borderRadius: R.lg, ...CONTINUOUS, minHeight: MIN_TAP + 4,
    alignItems: 'center', justifyContent: 'center', marginTop: S.lg,
  },
  btnText: { ...T.headline, color: C.onAccent },
});
