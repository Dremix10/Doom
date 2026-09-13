// One field, one button. Split from "Join with a code" so two near-identical
// forms aren't competing on the same screen.
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput } from 'react-native';
import { router } from 'expo-router';
import { api } from '../../../lib/api';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { Palette, T, S, R, CONTINUOUS, HAIRLINE, MIN_TAP, useColors, useStyles } from '../../../lib/theme';

export default function NewGroup() {
  const C = useColors();
  const s = useStyles(makeStyles);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const create = async () => {
    if (!name.trim() || busy) return;
    setBusy(true); setErr('');
    try {
      const g = await api.createGroup(name.trim());
      router.replace({ pathname: '/settings/group', params: { id: g.id } });
    } catch (e: any) { setErr(e.message); setBusy(false); }
  };

  return (
    <ScrollView style={s.wrap} contentContainerStyle={{ paddingHorizontal: S.gutter, paddingBottom: S.xxl }}>
      <ScreenHeader title="Create a group" back="Your groups" />
      <Text style={s.body}>A group is its own leaderboard. You'll get a code to share.</Text>
      <TextInput
        style={s.input}
        placeholder="e.g. Roommates"
        placeholderTextColor={C.faint}
        value={name}
        onChangeText={setName}
        autoFocus
        onSubmitEditing={create}
        returnKeyType="done"
      />
      {!!err && <Text style={s.err}>{err}</Text>}
      <Pressable
        style={({ pressed }) => [s.btn, (!name.trim() || busy) && { opacity: 0.5 }, pressed && { opacity: 0.75 }]}
        onPress={create}
        disabled={busy || !name.trim()}
      >
        {busy ? <ActivityIndicator color={C.onAccent} /> : <Text style={s.btnText}>Create</Text>}
      </Pressable>
    </ScrollView>
  );
}

const makeStyles = (C: Palette) => StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg },
  body: { ...T.subhead, color: C.dim, marginBottom: S.lg, lineHeight: 21 },
  input: {
    backgroundColor: C.card, color: C.text, borderRadius: R.lg, ...CONTINUOUS,
    paddingHorizontal: S.lg, minHeight: MIN_TAP + 6, ...T.body,
    borderWidth: HAIRLINE, borderColor: C.line,
  },
  err: { ...T.subhead, color: C.problem, marginTop: S.sm },
  btn: {
    backgroundColor: C.accent, borderRadius: R.lg, ...CONTINUOUS, minHeight: MIN_TAP + 4,
    alignItems: 'center', justifyContent: 'center', marginTop: S.lg,
  },
  btnText: { ...T.headline, color: C.onAccent },
});
