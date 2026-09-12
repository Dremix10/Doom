// "Setup": install the DNS sensor profile, share your invite code, verify you're
// human (Persona), and sign out. Everything the demo needs to add a phone.
import { View, Text, ScrollView, StyleSheet, Pressable, Linking, Platform, Alert } from 'react-native';
import { useState } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { C } from '../../lib/theme';

export default function Setup() {
  const { me, refresh, logout } = useAuth();
  const [busy, setBusy] = useState(false);
  if (!me) return null;

  const openSetup = () => Linking.openURL(me.setup_url);
  const copy = (text: string, what: string) => {
    if (Platform.OS === 'web') { try { navigator.clipboard.writeText(text); } catch { /* ignore */ } }
    const t = `${what} copied: ${text}`;
    if (Platform.OS === 'web') Alert.alert?.(t); else Alert.alert('Copied', text);
  };
  const verify = async () => { setBusy(true); try { await api.personaVerify(); await refresh(); } finally { setBusy(false); } };

  return (
    <ScrollView style={s.wrap} contentContainerStyle={{ padding: 20, paddingTop: 64, paddingBottom: 40 }}>
      <Text style={s.h1}>Setup</Text>

      <View style={s.card}>
        <Text style={s.step}>1 · Install the sensor</Text>
        <Text style={s.body}>
          One tap installs a DNS profile so Nudge can tell when a scroll has gone too long.
          Nothing runs on your phone. Remove it any time in Settings.
        </Text>
        <Pressable style={s.btn} onPress={openSetup}><Text style={s.btnText}>Open install page</Text></Pressable>
        <Text style={s.hint}>Turn off iCloud Private Relay and any VPN, or they bypass the sensor.</Text>
      </View>

      <View style={s.card}>
        <Text style={s.step}>2 · Add friends</Text>
        <Text style={s.body}>Share your invite code. They enter it in their Friends tab.</Text>
        <Pressable onPress={() => copy(me.invite_code, 'Invite code')}>
          <Text style={s.code}>{me.invite_code}</Text>
        </Pressable>
        <Text style={s.hint}>Tap to copy</Text>
      </View>

      <View style={s.card}>
        <Text style={s.step}>3 · Prove you're human</Text>
        <Text style={s.body}>
          Friends should be real people, so pull-outs can't be spoofed. Verified with Persona.
        </Text>
        {me.persona_verified ? (
          <Text style={s.verified}>✓ Verified human</Text>
        ) : (
          <Pressable style={[s.btn, busy && { opacity: 0.5 }]} onPress={verify} disabled={busy}>
            <Text style={s.btnText}>Verify with Persona</Text>
          </Pressable>
        )}
      </View>

      <Pressable style={s.logout} onPress={logout}><Text style={s.logoutText}>Sign out</Text></Pressable>
      <Text style={s.meta}>Sensor id {me.client_id}</Text>
      <Text style={s.meta}>API {api.base}</Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg },
  h1: { color: C.text, fontSize: 30, fontWeight: '800', marginBottom: 16 },
  card: { backgroundColor: C.card, borderRadius: 16, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: C.line },
  step: { color: C.accent, fontSize: 14, fontWeight: '700', marginBottom: 8 },
  body: { color: C.dim, fontSize: 14, lineHeight: 21 },
  btn: { backgroundColor: C.accent, borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 14 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  hint: { color: C.faint, fontSize: 12, marginTop: 10, lineHeight: 17 },
  code: { color: C.text, fontSize: 34, fontWeight: '800', letterSpacing: 8, textAlign: 'center', marginTop: 10, backgroundColor: C.card2, borderRadius: 12, paddingVertical: 14 },
  verified: { color: C.fine, fontSize: 17, fontWeight: '700', marginTop: 12 },
  logout: { padding: 14, alignItems: 'center', marginTop: 6 },
  logoutText: { color: C.problem, fontWeight: '600', fontSize: 15 },
  meta: { color: C.faint, fontSize: 12, textAlign: 'center', marginTop: 4 },
});
