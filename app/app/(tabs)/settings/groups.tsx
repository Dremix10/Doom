// "Your groups": a list, nothing more. Everything a single group carries — its
// code, its members, invitations, leaving — lives on that group's own page, so
// this screen stays four rows instead of a stack of dashboards.
import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { api, Group } from '../../../lib/api';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { Row, Section } from '../../../components/SettingsList';
import { Palette, T, S, useColors, useStyles } from '../../../lib/theme';

export default function Groups() {
  const C = useColors();
  const s = useStyles(makeStyles);
  const [groups, setGroups] = useState<Group[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { setGroups(await api.groups()); } catch { /* ignore */ }
  }, []);
  // Reload on focus so creating, joining or leaving is reflected on the way back.
  useFocusEffect(useCallback(() => { load(); }, [load]));
  useEffect(() => { load(); }, [load]);

  return (
    <ScrollView
      style={s.wrap}
      contentContainerStyle={{ paddingHorizontal: S.gutter, paddingBottom: S.xxl + S.md }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}
          tintColor={C.accent}
        />
      }
    >
      <ScreenHeader title="Your groups" />

      {groups.length === 0 ? (
        <Text style={s.empty}>
          No groups yet. Each group is its own leaderboard — create one and share the code, or
          join a friend's.
        </Text>
      ) : (
        <Section footer="Each group is its own leaderboard.">
          {groups.map((g, i) => (
            <Row
              key={g.id}
              first={i === 0}
              label={g.name}
              value={`${g.member_count}`}
              onPress={() => router.push({ pathname: '/settings/group', params: { id: g.id } })}
            />
          ))}
        </Section>
      )}

      <Section>
        <Row first label="Create a group" onPress={() => router.push('/settings/group-new')} />
        <Row label="Join with a code" onPress={() => router.push('/settings/group-join')} />
      </Section>
    </ScrollView>
  );
}

const makeStyles = (C: Palette) => StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg },
  empty: { ...T.subhead, color: C.faint, lineHeight: 21, marginBottom: S.lg },
});
