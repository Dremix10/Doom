// "Notifications": Web Push. On iOS this only works from a Home Screen install,
// so the requirement is stated up front rather than after a failed attempt.
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { enablePush, isIOS, isStandalone, permissionState, pushSupported } from '../../../lib/push';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { C, T, S, R, CONTINUOUS, HAIRLINE, MIN_TAP } from '../../../lib/theme';

export default function Notifications() {
  const [on, setOn] = useState(permissionState() === 'granted');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const needsHomeScreen = isIOS() && !isStandalone();

  const turnOn = async () => {
    setBusy(true); setMsg('');
    const r = await enablePush();
    if (r.ok) { setOn(true); setMsg('Notifications on for this device.'); }
    else setMsg(r.reason || "Couldn't turn notifications on.");
    setBusy(false);
  };

  return (
    <ScrollView style={s.wrap} contentContainerStyle={{ paddingHorizontal: S.gutter, paddingBottom: S.xxl + S.md }}>
      <ScreenHeader title="Notifications" />

      <View style={s.card}>
        <Text style={s.body}>
          Get a nudge or a pull-out as a real notification, even when Doom is closed.
        </Text>
        {on ? (
          <Text style={s.verified}>✓ On for this device</Text>
        ) : (
          <Pressable
            style={({ pressed }) => [s.btn, busy && { opacity: 0.5 }, pressed && { opacity: 0.75 }]}
            onPress={turnOn}
            disabled={busy}
          >
            <Text style={s.btnText}>Turn on notifications</Text>
          </Pressable>
        )}
        {!!msg && <Text style={s.hint}>{msg}</Text>}
      </View>

      {needsHomeScreen && (
        <View style={[s.card, { borderColor: C.drifting }]}>
          <Text style={s.kicker}>Add Doom to your Home Screen first</Text>
          <Text style={s.body}>
            iOS only allows notifications from an installed app. In Safari: Share → Add to Home
            Screen, then open Doom from the icon and come back here.
          </Text>
        </View>
      )}

      {!pushSupported() && (
        <Text style={s.hint}>This device or browser doesn't support Web Push.</Text>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg },
  card: {
    backgroundColor: C.card, borderRadius: R.lg, ...CONTINUOUS, padding: S.lg,
    marginBottom: S.md, borderWidth: HAIRLINE, borderColor: C.line,
  },
  kicker: { ...T.headline, color: C.text, marginBottom: S.sm },
  body: { ...T.subhead, color: C.dim, lineHeight: 21 },
  btn: {
    backgroundColor: C.accent, borderRadius: R.md, ...CONTINUOUS, minHeight: MIN_TAP,
    alignItems: 'center', justifyContent: 'center', marginTop: S.md,
  },
  btnText: { ...T.headline, color: C.onAccent },
  verified: { ...T.headline, color: C.fine, marginTop: S.md },
  hint: { ...T.footnote, color: C.faint, marginTop: S.sm, lineHeight: 18 },
});
