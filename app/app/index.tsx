// Entry gate: if signed in, go to the app; otherwise a zero-friction sign-up.
// The whole product promise is "add your friends, and that's it", so onboarding
// is one field.
import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '../lib/auth';
import { C } from '../lib/theme';

export default function Index() {
  const { me, signup } = useAuth();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  if (me) return <Redirect href="/(tabs)" />;

  const go = async () => {
    if (!name.trim()) return;
    setBusy(true); setErr('');
    try { await signup(name.trim()); } catch (e: any) { setErr(e.message); setBusy(false); }
  };

  return (
    <View style={s.wrap}>
      <View style={{ flex: 1 }} />
      <Text style={s.logo}>Nudge</Text>
      <Text style={s.tag}>Screen-time accountability with zero settings.</Text>
      <Text style={s.sub}>
        Add your friends, and that's it. An agent watches your usage against your own baseline
        and asks the one friend most likely to get through when you're doomscrolling.
      </Text>
      <View style={{ height: 28 }} />
      <Text style={s.label}>What's your name?</Text>
      <TextInput
        style={s.input}
        placeholder="e.g. Demetris"
        placeholderTextColor={C.faint}
        value={name}
        onChangeText={setName}
        autoCapitalize="words"
        onSubmitEditing={go}
        returnKeyType="go"
      />
      {!!err && <Text style={s.err}>{err}</Text>}
      <Pressable style={[s.btn, (!name.trim() || busy) && { opacity: 0.5 }]} onPress={go} disabled={busy || !name.trim()}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Get started</Text>}
      </Pressable>
      <Text style={s.fine}>No schedules. No limits. No blocklists.</Text>
      <View style={{ flex: 1 }} />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg, padding: 28 },
  logo: { color: C.text, fontSize: 44, fontWeight: '800', letterSpacing: -1 },
  tag: { color: C.accent, fontSize: 18, fontWeight: '600', marginTop: 6 },
  sub: { color: C.dim, fontSize: 15, lineHeight: 22, marginTop: 14 },
  label: { color: C.dim, fontSize: 14, marginBottom: 8 },
  input: {
    backgroundColor: C.card, color: C.text, borderRadius: 14, padding: 16, fontSize: 18,
    borderWidth: 1, borderColor: C.line,
  },
  err: { color: C.problem, marginTop: 10 },
  btn: { backgroundColor: C.accent, borderRadius: 14, padding: 17, alignItems: 'center', marginTop: 16 },
  btnText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  fine: { color: C.faint, fontSize: 13, textAlign: 'center', marginTop: 20 },
});
