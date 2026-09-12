// Home: the league table. One group, one ranking, one period — all three chosen
// from the tappable title.
//
// Rank 1 is always the position you want to be in — least time for social,
// entertainment and total, most time for productivity — so the sort direction
// comes from the category (`lower_is_better`) rather than being fixed here.
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { api, Leaderboard as Board, LeaderboardRow } from '../../lib/api';
import { MenuSection, TitleMenu } from '../../components/TitleMenu';
import { PersonSheet } from '../../components/PersonSheet';
import { AddFriendSheet } from '../../components/AddFriendSheet';
import { C, T, S, R, CONTINUOUS, HAIRLINE, stateColor } from '../../lib/theme';

const WINDOW_LABEL: Record<string, string> = { today: 'Today', week: 'This week' };
// Sentinel ids the group section uses alongside real group ids.
const ALL = 'all';
const MANAGE = '__manage';

function duration(mins: number): string {
  const m = Math.round(mins);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h}h ${rest}m` : `${h}h`;
}

export default function LeaderboardScreen() {
  const insets = useSafeAreaInsets();
  const [groupId, setGroupId] = useState<string | null>(null);
  const [category, setCategory] = useState('social');
  const [period, setPeriod] = useState('today');
  const [board, setBoard] = useState<Board | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<LeaderboardRow | null>(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    try {
      const b = await api.leaderboard(groupId, category, period);
      setBoard(b);
      // The API picks a default group when we haven't chosen one; adopt it so the
      // menu shows a checkmark against the group we're actually looking at.
      if (!groupId && b.group_id) setGroupId(b.group_id);
    } catch { /* ignore transient */ }
  }, [groupId, category, period]);

  useEffect(() => { load(); const id = setInterval(load, 5000); return () => clearInterval(id); }, [load]);

  const current = board?.categories.find((c) => c.id === board.category);
  const group = board?.groups.find((g) => g.id === board.group_id);

  const sections: MenuSection[] = [
    {
      id: 'group',
      title: 'Group',
      selected: board?.group_id ?? ALL,
      items: [
        { id: ALL, label: 'All friends', detail: 'everyone you\u2019ve added' },
        ...(board?.groups ?? []).map((g) => ({
          id: g.id,
          label: g.name,
          detail: `${g.member_count} ${g.member_count === 1 ? 'member' : 'members'}`,
        })),
        { id: MANAGE, label: 'Manage groups\u2026', action: true },
      ],
    },
  ];
  sections.push(
    {
      id: 'category',
      title: 'Ranking',
      selected: category,
      items: (board?.categories ?? []).map((c) => ({ id: c.id, label: c.label, detail: c.blurb })),
    },
    {
      id: 'window',
      title: 'Period',
      selected: period,
      items: (board?.windows ?? []).map((w) => ({ id: w, label: WINDOW_LABEL[w] ?? w })),
    },
  );

  const onSelect = (sectionId: string, itemId: string) => {
    if (itemId === MANAGE) { router.push('/settings'); return; }
    if (sectionId === 'group') setGroupId(itemId);
    else if (sectionId === 'category') setCategory(itemId);
    else setPeriod(itemId);
    setBoard(null); // don't show the old ranking under the new title
  };

  const rows = board?.rows ?? [];

  return (
    <>
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
        <View style={s.navBar}>
          <Pressable
            onPress={() => setAdding(true)}
            hitSlop={8}
            style={({ pressed }) => [s.navBtn, pressed && { opacity: 0.6 }]}
          >
            <Text style={s.navBtnText}>Add Friend</Text>
          </Pressable>
        </View>
        <TitleMenu
          label={board?.group_id === ALL ? 'All friends' : group?.name ?? 'Leaderboard'}
          sections={sections}
          onSelect={onSelect}
        />
        <Text style={s.caption}>
          {current?.label ?? 'Social media'} · {WINDOW_LABEL[period] ?? period}
          {current ? ` · ${current.blurb}` : ''}
        </Text>

        {!board && <ActivityIndicator color={C.accent} style={{ marginTop: S.xxl }} />}

        {board && rows.map((r) => (
          <Pressable
            key={r.id}
            onPress={() => setSelected(r)}
            style={({ pressed }) => [s.row, r.is_me && s.rowMe, pressed && { opacity: 0.6 }]}
          >
            <Text style={[s.rank, r.rank === 1 && { color: C.accent }]}>{r.rank}</Text>
            <View style={[s.dot, { backgroundColor: stateColor(r.state) }]} />
            <View style={{ flex: 1 }}>
              <Text style={s.name} numberOfLines={1}>{r.is_me ? 'You' : r.name}</Text>
              <Text style={s.sub} numberOfLines={1}>
                {r.top_service ?? 'nothing yet'}
                {r.ratio > 0 ? ` · ${r.ratio.toFixed(1)}× usual` : ''}
              </Text>
            </View>
            <Text style={s.minutes}>{duration(r.minutes)}</Text>
          </Pressable>
        ))}

        {board && rows.length <= 1 && (
          <Text style={s.empty}>
            {board.group_id === ALL
              ? "No friends yet. Tap Add Friend and share your code or link."
              : 'Nobody else in this group yet. Share its join code from Settings.'}
          </Text>
        )}
      </ScrollView>

      <PersonSheet row={selected} onClose={() => setSelected(null)} onChanged={load} />
      <AddFriendSheet visible={adding} onClose={() => setAdding(false)} onAdded={load} />
    </>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg },
  navBar: { flexDirection: 'row', alignItems: 'center', minHeight: 34, marginBottom: S.xs },
  navBtn: { justifyContent: 'center' },
  navBtnText: { ...T.body, color: C.accent, fontWeight: '600' },
  caption: { ...T.footnote, color: C.faint, marginTop: S.xs, marginBottom: S.lg },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: S.md,
    paddingVertical: S.md, paddingHorizontal: S.md,
    borderBottomWidth: HAIRLINE, borderBottomColor: C.line,
  },
  rowMe: {
    backgroundColor: 'rgba(124,123,255,0.12)',
    borderRadius: R.md, ...CONTINUOUS, borderBottomWidth: 0,
  },
  rank: { ...T.headline, color: C.faint, width: 20, textAlign: 'right' },
  dot: { width: 9, height: 9, borderRadius: R.full },
  name: { ...T.headline, color: C.text },
  sub: { ...T.footnote, color: C.dim, marginTop: 1 },
  minutes: { ...T.title3, color: C.text, fontWeight: '600' },
  empty: { ...T.subhead, color: C.faint, marginTop: S.xl, lineHeight: 21 },
});
