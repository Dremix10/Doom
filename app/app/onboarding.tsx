// The start page: sign in, or create an account. One screen with a segmented
// switch rather than two routes, so the whole thing is reachable without
// navigation — and so the "wrong password" case never loses what you typed.
//
// This screen is guarded in _layout.tsx: once `me` exists the router moves you on
// automatically, and signing out brings you straight back here.
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Wordmark } from '../components/Wordmark';
import { useAuth } from '../lib/auth';
import { C, T, S, R, CONTINUOUS, HAIRLINE, MIN_TAP } from '../lib/theme';

type Mode = 'in' | 'new';

export default function Onboarding() {
  const { signup, login } = useAuth();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode>('in');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const creating = mode === 'new';
  const ready = email.trim() && password && (!creating || name.trim());

  const go = async () => {
    if (!ready || busy) return;
    setBusy(true); setErr('');
    try {
      if (creating) await signup(name.trim(), email.trim(), password);
      else await login(email.trim(), password);
      // On success the auth gate navigates for us; leave `busy` set so the
      // button can't be pressed twice while that happens.
    } catch (e: any) {
      setErr(e.message);
      setBusy(false);
    }
  };

  const switchTo = (next: Mode) => { setMode(next); setErr(''); };

  return (
    <KeyboardAvoidingView
      style={s.wrap}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: S.xxl,
          paddingTop: insets.top + S.xxl,
          paddingBottom: insets.bottom + S.xxl,
          flexGrow: 1,
          justifyContent: 'center',
        }}
        keyboardShouldPersistTaps="handled"
      >
        <Wordmark size={44} />
        <Text style={s.tag}>Screen-time accountability with zero settings.</Text>
        <Text style={s.sub}>
          Add your friends, and that's it. An agent watches your usage against your own baseline
          and asks the one friend most likely to get through when you're doomscrolling.
        </Text>

        <View style={s.segment}>
          {(['in', 'new'] as Mode[]).map((m) => (
            <Pressable
              key={m}
              onPress={() => switchTo(m)}
              style={[s.segmentItem, mode === m && s.segmentItemOn]}
            >
              <Text style={[s.segmentText, mode === m && s.segmentTextOn]}>
                {m === 'in' ? 'Sign in' : 'Create account'}
              </Text>
            </Pressable>
          ))}
        </View>

        {creating && (
          <TextInput
            style={s.input}
            placeholder="Your name"
            placeholderTextColor={C.faint}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            autoCorrect={false}
            returnKeyType="next"
          />
        )}
        <TextInput
          style={s.input}
          placeholder="Email"
          placeholderTextColor={C.faint}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
          returnKeyType="next"
        />
        <TextInput
          style={s.input}
          placeholder={creating ? 'Password (8+ characters)' : 'Password'}
          placeholderTextColor={C.faint}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          textContentType={creating ? 'newPassword' : 'password'}
          onSubmitEditing={go}
          returnKeyType="go"
        />

        {!!err && <Text style={s.err}>{err}</Text>}

        <Pressable
          style={({ pressed }) => [s.btn, (!ready || busy) && { opacity: 0.5 }, pressed && { opacity: 0.75 }]}
          onPress={go}
          disabled={busy || !ready}
        >
          {busy ? <ActivityIndicator color={C.onAccent} /> : (
            <Text style={s.btnText}>{creating ? 'Create account' : 'Sign in'}</Text>
          )}
        </Pressable>

        <Pressable onPress={() => switchTo(creating ? 'in' : 'new')} style={s.switchRow}>
          <Text style={s.switchText}>
            {creating ? 'Already have an account? Sign in' : "New here? Create an account"}
          </Text>
        </Pressable>

        <Text style={s.fine}>No schedules. No limits. No blocklists.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg },
  tag: { ...T.title3, color: C.accent, marginTop: S.xs + 2 },
  sub: { ...T.callout, color: C.dim, lineHeight: 22, marginTop: S.md + 2 },
  segment: {
    flexDirection: 'row', backgroundColor: C.card2, borderRadius: R.md, ...CONTINUOUS,
    padding: 3, marginTop: S.xxl, marginBottom: S.lg,
  },
  segmentItem: { flex: 1, minHeight: MIN_TAP - 8, alignItems: 'center', justifyContent: 'center', borderRadius: R.sm + 2 },
  segmentItemOn: { backgroundColor: C.card, borderWidth: HAIRLINE, borderColor: C.line },
  segmentText: { ...T.subhead, color: C.dim, fontWeight: '600' },
  segmentTextOn: { color: C.text },
  input: {
    backgroundColor: C.card, color: C.text, borderRadius: R.lg, ...CONTINUOUS,
    paddingHorizontal: S.lg, minHeight: MIN_TAP + 6, ...T.body,
    borderWidth: HAIRLINE, borderColor: C.line, marginBottom: S.sm + 2,
  },
  err: { ...T.subhead, color: C.problem, marginTop: S.xs, marginBottom: S.xs },
  btn: {
    backgroundColor: C.accent, borderRadius: R.lg, ...CONTINUOUS, minHeight: MIN_TAP + 8,
    alignItems: 'center', justifyContent: 'center', marginTop: S.sm,
  },
  btnText: { ...T.title3, color: C.onAccent, fontWeight: '600' },
  switchRow: { minHeight: MIN_TAP, alignItems: 'center', justifyContent: 'center', marginTop: S.xs },
  switchText: { ...T.subhead, color: C.accent, fontWeight: '600' },
  fine: { ...T.footnote, color: C.faint, textAlign: 'center', marginTop: S.md },
});
