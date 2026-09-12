// "Connect your phone": the two ways to get real usage in. They're genuinely
// different trade-offs rather than a primary and a fallback, so they're presented
// as equals with the catch spelled out on each.
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../../../lib/auth';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { Palette, T, S, R, CONTINUOUS, HAIRLINE, MIN_TAP, useColors, useStyles } from '../../../lib/theme';

export default function Phone() {
  const { me } = useAuth();
  const C = useColors();
  const s = useStyles(makeStyles);
  if (!me) return null;

  return (
    <ScrollView style={s.wrap} contentContainerStyle={{ paddingHorizontal: S.gutter, paddingBottom: S.xxl + S.md }}>
      <ScreenHeader title="Connect your phone" />
      <Text style={s.intro}>
        Doom needs to know when a scroll has gone on too long. Two ways to do that — pick either.
      </Text>

      <View style={s.card}>
        <Text style={s.kicker}>Shortcuts automations</Text>
        <Text style={s.body}>
          Two automations per app — when it opens and when it closes — so Doom sees exactly how
          long the app was on screen. Nothing is installed on your phone.
        </Text>
        <Text style={s.catch}>Catch: you add them per app, by hand, on each phone.</Text>
        <Pressable style={({ pressed }) => [s.btn, pressed && s.pressed]} onPress={() => Linking.openURL(me.shortcuts_url)}>
          <Text style={s.btnText}>Open Shortcuts setup</Text>
        </Pressable>
      </View>

      <View style={s.card}>
        <Text style={s.kicker}>DNS profile</Text>
        <Text style={s.body}>
          One tap installs an encrypted-DNS profile, and every app is covered at once —
          nothing to add per app. Remove it any time in iOS Settings.
        </Text>
        <Text style={s.catch}>
          Catch: iCloud Private Relay or a VPN bypasses it, and usage is inferred from DNS
          rather than measured.
        </Text>
        <Pressable style={({ pressed }) => [s.btn, pressed && s.pressed]} onPress={() => Linking.openURL(me.setup_url)}>
          <Text style={s.btnText}>Open install page</Text>
        </Pressable>
      </View>

      <Text style={s.meta}>Sensor id {me.client_id}</Text>
    </ScrollView>
  );
}

const makeStyles = (C: Palette) => StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg },
  intro: { ...T.subhead, color: C.dim, lineHeight: 21, marginBottom: S.lg },
  card: {
    backgroundColor: C.card, borderRadius: R.lg, ...CONTINUOUS, padding: S.lg,
    marginBottom: S.md, borderWidth: HAIRLINE, borderColor: C.line,
  },
  kicker: { ...T.headline, color: C.text, marginBottom: S.sm },
  body: { ...T.subhead, color: C.dim, lineHeight: 21 },
  catch: { ...T.footnote, color: C.faint, lineHeight: 18, marginTop: S.sm },
  btn: {
    backgroundColor: C.accent, borderRadius: R.md, ...CONTINUOUS, minHeight: MIN_TAP,
    alignItems: 'center', justifyContent: 'center', marginTop: S.md,
  },
  btnText: { ...T.headline, color: C.onAccent },
  pressed: { opacity: 0.75 },
  meta: { ...T.caption, color: C.faint, textAlign: 'center', marginTop: S.sm },
});
