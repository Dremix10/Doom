// "Account": who you're signed in as, the human check, and the way out.
import { useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api } from '../../../lib/api';
import { useAuth } from '../../../lib/auth';
import { Row, Section } from '../../../components/SettingsList';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { Palette, T, S, useColors, useStyles } from '../../../lib/theme';

export default function Account() {
  const { me, refresh, logout } = useAuth();
  const C = useColors();
  const s = useStyles(makeStyles);
  const [busy, setBusy] = useState(false);
  if (!me) return null;

  const verify = async () => {
    setBusy(true);
    try { await api.personaVerify(); await refresh(); } finally { setBusy(false); }
  };

  const confirmLogout = () => {
    if (Platform.OS === 'web') { logout(); return; }
    Alert.alert('Sign out?', 'You can sign back in with your email and password.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: logout },
    ]);
  };

  return (
    <ScrollView style={s.wrap} contentContainerStyle={{ paddingHorizontal: S.gutter, paddingBottom: S.xxl + S.md }}>
      <ScreenHeader title="Account" />

      <Section title="Signed in as">
        <Row first label="Name" value={me.name} />
        <Row label="Email" value={me.email ?? '—'} />
        <Row label="Friend code" value={me.invite_code} />
      </Section>

      <Section
        title="Human check"
        footer="The people in your groups should be real, so pull-outs can't be spoofed. Verified with Persona."
      >
        {me.persona_verified ? (
          <Row first label="Verified human" value="✓" />
        ) : (
          <Row
            first
            label={busy ? 'Verifying…' : 'Verify with Persona'}
            onPress={verify}
            disabled={busy}
          />
        )}
      </Section>

      <Section>
        <Row first label="Sign out" destructive onPress={confirmLogout} />
      </Section>

      <Text style={s.meta}>Sensor id {me.client_id}</Text>
      <Text style={s.meta}>API {api.base}</Text>
    </ScrollView>
  );
}

const makeStyles = (C: Palette) => StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg },
  meta: { ...T.caption, color: C.faint, textAlign: 'center', marginTop: S.xs },
});
