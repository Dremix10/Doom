// "What friends can see": one switch per app. Hiding an app conceals its name,
// never its minutes — that time still counts toward your totals and your rank, or
// everyone would hide their worst app and the leaderboard would mean nothing.
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { api, PrivacyApp } from '../../../lib/api';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { Palette, T, S, R, CONTINUOUS, HAIRLINE, MIN_TAP, useColors, useStyles } from '../../../lib/theme';

const CATEGORY_ORDER = ['social', 'entertainment', 'productivity'];
const CATEGORY_LABEL: Record<string, string> = {
  social: 'Social media',
  entertainment: 'Entertainment',
  productivity: 'Productivity',
};

export default function Privacy() {
  const [apps, setApps] = useState<PrivacyApp[]>([]);
  const C = useColors();
  const s = useStyles(makeStyles);

  const load = useCallback(async () => {
    try { setApps((await api.privacy()).apps); } catch { /* ignore */ }
  }, []);
  useEffect(() => { load(); }, [load]);

  // Optimistic: flip the switch immediately, then persist the whole hidden set.
  const toggle = async (service: string, visible: boolean) => {
    const next = apps.map((a) => (a.service === service ? { ...a, visible } : a));
    setApps(next);
    try {
      const saved = await api.setPrivacy(next.filter((a) => !a.visible).map((a) => a.service));
      setApps(saved.apps);
    } catch { setApps(apps); }
  };

  const hidden = apps.filter((a) => !a.visible).length;
  const groups = CATEGORY_ORDER
    .map((c) => ({ key: c, label: CATEGORY_LABEL[c], apps: apps.filter((a) => a.category === c) }))
    .filter((g) => g.apps.length > 0);

  return (
    <ScrollView style={s.wrap} contentContainerStyle={{ paddingHorizontal: S.gutter, paddingBottom: S.xxl + S.md }}>
      <ScreenHeader title="What friends can see" />
      <Text style={s.intro}>
        {hidden === 0
          ? 'Friends can see which apps your time went to.'
          : `${hidden} ${hidden === 1 ? 'app is' : 'apps are'} hidden from friends.`}
        {' '}Hidden apps still count toward your totals and your rank — friends just see the
        time as "Hidden" instead of the app's name.
      </Text>

      {groups.map((g) => (
        <View key={g.key} style={s.section}>
          <Text style={s.sectionTitle}>{g.label}</Text>
          <View style={s.card}>
            {g.apps.map((a, i) => (
              <View key={a.service} style={[s.row, i > 0 && s.divided]}>
                <Text style={s.name}>{a.label}</Text>
                <Switch
                  value={a.visible}
                  onValueChange={(v) => toggle(a.service, v)}
                  trackColor={{ false: C.line, true: C.accent }}
                  thumbColor="#fff"
                  ios_backgroundColor={C.line}
                />
              </View>
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const makeStyles = (C: Palette) => StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg },
  intro: { ...T.subhead, color: C.dim, lineHeight: 21, marginBottom: S.lg },
  section: { marginBottom: S.lg },
  sectionTitle: {
    ...T.footnote, fontWeight: '600', color: C.dim, textTransform: 'uppercase',
    letterSpacing: 0.6, marginBottom: S.sm, marginLeft: S.xs,
  },
  card: {
    backgroundColor: C.card, borderRadius: R.lg, ...CONTINUOUS,
    borderWidth: HAIRLINE, borderColor: C.line, overflow: 'hidden',
  },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    gap: S.md, paddingHorizontal: S.lg, minHeight: MIN_TAP + 2,
  },
  divided: { borderTopWidth: HAIRLINE, borderTopColor: C.line },
  name: { ...T.body, color: C.text, flex: 1 },
});
