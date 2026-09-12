// Settings: a grouped list that shows the state of everything on the right, so
// the numbered "step 1 / 1b / 2 / 3" sequence this screen used to be isn't needed
// — "Not connected" says the same thing without the numbering. Each row opens its
// own page; nothing on this screen is a form.
import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, Group, PrivacyApp } from '../../../lib/api';
import { useAuth } from '../../../lib/auth';
import { permissionState } from '../../../lib/push';
import { Row, Section } from '../../../components/SettingsList';
import { Palette, T, S, R, CONTINUOUS, HAIRLINE, useColors, useStyles, useTheme } from '../../../lib/theme';

export default function SettingsIndex() {
  const { me } = useAuth();
  const insets = useSafeAreaInsets();
  const { mode, resolved } = useTheme();
  const C = useColors();
  const s = useStyles(makeStyles);
  const [groups, setGroups] = useState<Group[]>([]);
  const [privacy, setPrivacy] = useState<PrivacyApp[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [pushOn, setPushOn] = useState(permissionState() === 'granted');

  const load = useCallback(async () => {
    try { setGroups(await api.groups()); } catch { /* ignore */ }
    try { setPrivacy((await api.privacy()).apps); } catch { /* ignore */ }
    setPushOn(permissionState() === 'granted');
  }, []);
  useEffect(() => { load(); }, [load]);

  if (!me) return null;

  const hidden = privacy.filter((a) => !a.visible).length;

  return (
    <ScrollView
      style={s.wrap}
      contentContainerStyle={{
        paddingHorizontal: S.gutter,
        paddingTop: (insets.top || S.md) + S.sm,
        paddingBottom: S.xxl + S.md,
      }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}
          tintColor={C.accent}
        />
      }
    >
      <Text style={s.h1}>Settings</Text>

      <View style={s.identity}>
        <View style={s.avatar}><Text style={s.avatarText}>{me.name.slice(0, 1).toUpperCase()}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={s.name}>{me.name}</Text>
          <Text style={s.email} numberOfLines={1}>{me.email ?? 'no email on this account'}</Text>
        </View>
      </View>

      <Section title="Set up">
        <Row first label="Connect your phone" onPress={() => router.push('/settings/phone')} />
        <Row
          label="Notifications"
          value={pushOn ? 'On' : 'Off'}
          onPress={() => router.push('/settings/notifications')}
        />
        <Row
          label="Appearance"
          value={mode === 'system' ? `System · ${resolved}` : mode === 'light' ? 'Light' : 'Dark'}
          onPress={() => router.push('/settings/appearance')}
        />
      </Section>

      <Section title="Social">
        <Row
          first
          label="Your groups"
          value={String(groups.length)}
          onPress={() => router.push('/settings/groups')}
        />
        <Row
          label="What friends can see"
          value={hidden === 0 ? 'All visible' : `${hidden} hidden`}
          onPress={() => router.push('/settings/privacy')}
        />
      </Section>

      <Section title="Account">
        <Row
          first
          label="Account"
          value={me.persona_verified ? 'Verified' : 'Unverified'}
          onPress={() => router.push('/settings/account')}
        />
      </Section>
    </ScrollView>
  );
}

const makeStyles = (C: Palette) => StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg },
  h1: { ...T.largeTitle, color: C.text, marginBottom: S.lg },
  identity: {
    flexDirection: 'row', alignItems: 'center', gap: S.md,
    backgroundColor: C.card, borderRadius: R.lg, ...CONTINUOUS,
    borderWidth: HAIRLINE, borderColor: C.line, padding: S.lg, marginBottom: S.xl,
  },
  avatar: {
    width: 46, height: 46, borderRadius: R.full, backgroundColor: C.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { ...T.title3, color: C.onAccent, fontWeight: '700' },
  name: { ...T.title3, color: C.text, fontWeight: '600' },
  email: { ...T.footnote, color: C.dim, marginTop: 1 },
});
