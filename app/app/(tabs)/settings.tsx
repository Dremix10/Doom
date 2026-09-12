// "Settings": install the DNS sensor profile, verify you're human (Persona), and
// sign out. Adding people lives in the Groups tab now — a group's join code is
// the only invite this app needs.
import { View, Text, ScrollView, StyleSheet, Pressable, Linking, Platform, Alert } from 'react-native';
import { useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { C, T, S, R, CONTINUOUS, HAIRLINE, MIN_TAP } from '../../lib/theme';

export default function Settings() {
  const { me, refresh, logout } = useAuth();
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);
  if (!me) return null;

  const openSetup = () => Linking.openURL(me.setup_url);
  const verify = async () => { setBusy(true); try { await api.personaVerify(); await refresh(); } finally { setBusy(false); } };

  return (
    <ScrollView
      style={s.wrap}
      contentContainerStyle={{
        paddingHorizontal: S.gutter,
        paddingTop: (insets.top || S.md) + S.sm,
        paddingBottom: S.xxl + S.md,
      }}
    >
      <Text style={s.h1}>Settings</Text>

      <View style={s.card}>
        <Text style={s.step}>1 · Install the sensor</Text>
        <Text style={s.body}>
          One tap installs a DNS profile so Nudge can tell when a scroll has gone too long.
          Nothing runs on your phone. Remove it any time in Settings.
        </Text>
        <Pressable style={({ pressed }) => [s.btn, pressed && s.pressed]} onPress={openSetup}>
          <Text style={s.btnText}>Open install page</Text>
        </Pressable>
        <Text style={s.hint}>Turn off iCloud Private Relay and any VPN, or they bypass the sensor.</Text>
      </View>

      <View style={s.card}>
        <Text style={s.step}>2 · Prove you're human</Text>
        <Text style={s.body}>
          The people in your groups should be real, so pull-outs can't be spoofed. Verified with Persona.
        </Text>
        {me.persona_verified ? (
          <Text style={s.verified}>✓ Verified human</Text>
        ) : (
          <Pressable style={({ pressed }) => [s.btn, busy && { opacity: 0.5 }, pressed && s.pressed]} onPress={verify} disabled={busy}>
            <Text style={s.btnText}>Verify with Persona</Text>
          </Pressable>
        )}
      </View>

      <Pressable style={({ pressed }) => [s.logout, pressed && s.pressed]} onPress={logout}>
        <Text style={s.logoutText}>Sign out</Text>
      </Pressable>
      <Text style={s.meta}>Signed in as {me.name}</Text>
      <Text style={s.meta}>Sensor id {me.client_id}</Text>
      <Text style={s.meta}>API {api.base}</Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg },
  h1: { ...T.largeTitle, color: C.text, marginBottom: S.lg },
  card: {
    backgroundColor: C.card, borderRadius: R.lg, ...CONTINUOUS, padding: S.lg + 2,
    marginBottom: S.md + 2, borderWidth: HAIRLINE, borderColor: C.line,
  },
  step: { ...T.footnote, fontWeight: '600', color: C.accent, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: S.sm },
  body: { ...T.subhead, color: C.dim, lineHeight: 21 },
  btn: {
    backgroundColor: C.accent, borderRadius: R.md, ...CONTINUOUS, minHeight: MIN_TAP,
    alignItems: 'center', justifyContent: 'center', marginTop: S.md + 2,
  },
  btnText: { ...T.headline, color: '#fff' },
  pressed: { opacity: 0.75 },
  hint: { ...T.caption, color: C.faint, marginTop: S.sm + 2, lineHeight: 17 },
  verified: { ...T.headline, color: C.fine, marginTop: S.md },
  logout: { minHeight: MIN_TAP, alignItems: 'center', justifyContent: 'center', marginTop: S.xs + 2 },
  logoutText: { ...T.body, color: C.problem, fontWeight: '600' },
  meta: { ...T.caption, color: C.faint, textAlign: 'center', marginTop: S.xs },
});
