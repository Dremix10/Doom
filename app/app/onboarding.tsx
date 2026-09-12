// Entry gate: if signed in, go to the app; otherwise a zero-friction sign-up.
// The whole product promise is "add your friends, and that's it", so onboarding
// is one field. No tab bar here, so this screen owns both safe-area insets.
import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { Redirect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../lib/auth';
import { C, T, S, R, CONTINUOUS, HAIRLINE, MIN_TAP } from '../lib/theme';

export default function Index() {
  const { me, signup } = useAuth();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  if (me) return <Redirect href="/leaderboard" />;

  const go = async () => {
    if (!name.trim()) return;
    setBusy(true); setErr('');
    try { await signup(name.trim()); } catch (e: any) { setErr(e.message); setBusy(false); }
  };

  return (
    <View style={[s.wrap, { paddingTop: insets.top + S.xxl, paddingBottom: insets.bottom + S.xxl }]}>
      <View style={{ flex: 1 }} />
      <Text style={s.logo}>Nudge</Text>
      <Text style={s.tag}>Screen-time accountability with zero settings.</Text>
      <Text style={s.sub}>
        Add your friends, and that's it. An agent watches your usage against your own baseline
        and asks the one friend most likely to get through when you're doomscrolling.
      </Text>
      <View style={{ height: S.xxl }} />
      <Text style={s.label}>What's your name?</Text>
      <TextInput
        style={s.input}
        placeholder="e.g. Demetris"
        placeholderTextColor={C.faint}
        value={name}
        onChangeText={setName}
        autoCapitalize="words"
        autoCorrect={false}
        onSubmitEditing={go}
        returnKeyType="go"
      />
      {!!err && <Text style={s.err}>{err}</Text>}
      <Pressable
        style={({ pressed }) => [s.btn, (!name.trim() || busy) && { opacity: 0.5 }, pressed && { opacity: 0.75 }]}
        onPress={go}
        disabled={busy || !name.trim()}
      >
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Get started</Text>}
      </Pressable>
      <Text style={s.fine}>No schedules. No limits. No blocklists.</Text>
      <View style={{ flex: 1 }} />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg, paddingHorizontal: S.xxl },
  logo: { ...T.largeTitle, color: C.text, fontSize: 44, lineHeight: 50, letterSpacing: -0.5 },
  tag: { ...T.title3, color: C.accent, marginTop: S.xs + 2 },
  sub: { ...T.callout, color: C.dim, lineHeight: 22, marginTop: S.md + 2 },
  label: { ...T.subhead, color: C.dim, marginBottom: S.sm },
  input: {
    backgroundColor: C.card, color: C.text, borderRadius: R.lg, ...CONTINUOUS,
    paddingHorizontal: S.lg, minHeight: MIN_TAP + 10, ...T.title3, fontWeight: '400',
    borderWidth: HAIRLINE, borderColor: C.line,
  },
  err: { ...T.subhead, color: C.problem, marginTop: S.sm + 2 },
  btn: {
    backgroundColor: C.accent, borderRadius: R.lg, ...CONTINUOUS, minHeight: MIN_TAP + 8,
    alignItems: 'center', justifyContent: 'center', marginTop: S.lg,
  },
  btnText: { ...T.title3, color: '#fff', fontWeight: '600' },
  fine: { ...T.footnote, color: C.faint, textAlign: 'center', marginTop: S.xl },
});
