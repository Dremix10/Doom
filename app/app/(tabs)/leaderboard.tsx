// Home: the league table. One group, one ranking, one period — all three chosen
// from the tappable title.
//
// Rank 1 is always the position you want to be in — least time for social,
// entertainment and total, most time for productivity — so the sort direction
// comes from the category (`lower_is_better`) rather than being fixed here, and
// the chip beside the title says which way it's running.
//
// Whoever is doomscrolling right now stays in their own rank rather than being
// pinned to the top — pinning showed them twice and broke reading the table
// straight down. Their row turns crimson and grows a Pull out button instead, so
// the action is where the person is.
//
// Crimson means exactly one thing on this screen: someone is scrolling now. It is
// deliberately not used for last place, or an idle row would look actionable.
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { api, Leaderboard as Board, LeaderboardRow } from '../../lib/api';
import { MenuSection, TitleMenu } from '../../components/TitleMenu';
import { PersonSheet } from '../../components/PersonSheet';
import { AddFriendSheet } from '../../components/AddFriendSheet';
import { Wordmark } from '../../components/Wordmark';
import { Palette, T, S, R, CONTINUOUS, HAIRLINE, useColors, useStyles } from '../../lib/theme';

const WINDOW_LABEL: Record<string, string> = { today: 'Today', week: 'This week' };
// The pill has to fit beside a large title, so it gets the short forms.
const SHORT_CATEGORY: Record<string, string> = {
  social: 'Social', productivity: 'Productivity',
  entertainment: 'Entertainment', total: 'Total',
};
const ALL = 'all';
const MANAGE = '__manage';

// A ratio is only worth showing when it's actually unusual — "1.0× usual" on
// every row is noise that makes the badge meaningless when it matters.
const HIGH = 1.3;
const LOW = 0.6;
const notable = (ratio: number) => ratio > 0 && (ratio >= HIGH || ratio <= LOW);

function duration(mins: number): string {
  const m = Math.round(mins);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h}h ${rest}m` : `${h}h`;
}

export default function LeaderboardScreen() {
  const insets = useSafeAreaInsets();
  const C = useColors();
  const s = useStyles(makeStyles);
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
      if (!groupId && b.group_id) setGroupId(b.group_id);
    } catch { /* ignore transient */ }
  }, [groupId, category, period]);

  useEffect(() => { load(); const id = setInterval(load, 5000); return () => clearInterval(id); }, [load]);

  const current = board?.categories.find((c) => c.id === board.category);
  const group = board?.groups.find((g) => g.id === board.group_id);
  const isAll = board?.group_id === ALL;

  // Left menu: who the board is about. Right menu: what it measures and when.
  const groupSections: MenuSection[] = [
    {
      id: 'group',
      title: 'Group',
      selected: board?.group_id ?? ALL,
      items: [
        { id: ALL, label: 'All friends', detail: 'everyone you’ve added' },
        ...(board?.groups ?? []).map((g) => ({
          id: g.id,
          label: g.name,
          detail: `${g.member_count} ${g.member_count === 1 ? 'member' : 'members'}`,
        })),
        { id: MANAGE, label: 'Manage groups…', action: true },
      ],
    },
  ];

  const filterSections: MenuSection[] = [
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
  ];

  const onSelect = (sectionId: string, itemId: string) => {
    if (itemId === MANAGE) { router.push('/settings/groups'); return; }
    if (sectionId === 'group') setGroupId(itemId);
    else if (sectionId === 'category') setCategory(itemId);
    else setPeriod(itemId);
    setBoard(null);
  };

  const rows = board?.rows ?? [];
  const peak = Math.max(1, ...rows.map((r) => r.minutes));

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
          <View style={s.navTitle}>
            <Wordmark size={19} />
          </View>
        </View>

        <View style={s.titleRow}>
          <View style={{ flexShrink: 1 }}>
            <TitleMenu
              label={isAll ? 'All friends' : group?.name ?? 'Leaderboard'}
              sections={groupSections}
              onSelect={onSelect}
            />
          </View>
          <TitleMenu
            variant="pill"
            align="right"
            label={SHORT_CATEGORY[category] ?? current?.label ?? 'Social'}
            sections={filterSections}
            onSelect={onSelect}
          />
        </View>
        <Text style={s.caption}>
          {WINDOW_LABEL[period] ?? period}
          {current ? ` · ${board?.lower_is_better ? '↓' : '↑'} ${current.blurb}` : ''}
        </Text>

        {!board && <ActivityIndicator color={C.accent} style={{ marginTop: S.xxl }} />}

        {rows.map((r) => {
          const live = r.state === 'problem';
          const drifting = r.state === 'drifting';
          return (
            <Pressable
              key={r.id}
              onPress={() => setSelected(r)}
              style={({ pressed }) => [
                s.row,
                live && s.rowLive,
                r.is_me && s.rowMe,
                pressed && { opacity: 0.6 },
              ]}
            >
              <RankBadge rank={r.rank} />
              <View style={{ flex: 1 }}>
                <View style={s.nameRow}>
                  <Text style={s.name} numberOfLines={1}>{r.is_me ? 'You' : r.name}</Text>
                  {drifting && <Text style={[s.tag, { color: C.drifting }]}>drifting</Text>}
                </View>
                <View style={s.track}>
                  <View
                    style={[
                      s.bar,
                      { width: `${Math.max(2, Math.round((r.minutes / peak) * 100))}%` },
                      live && { backgroundColor: C.problem },
                      drifting && { backgroundColor: C.drifting },
                    ]}
                  />
                </View>
                {live && (
                  <View style={s.liveRow}>
                    <Text style={s.liveText} numberOfLines={1}>
                      {r.top_service ? `on ${r.top_service} now` : 'scrolling now'}
                      {notable(r.ratio) ? ` · ${r.ratio.toFixed(1)}× usual` : ''}
                    </Text>
                    {!r.is_me && (
                      <Pressable
                        onPress={() => setSelected(r)}
                        style={({ pressed }) => [s.pull, pressed && { opacity: 0.75 }]}
                      >
                        <Text style={s.pullText}>Pull out</Text>
                      </Pressable>
                    )}
                  </View>
                )}
              </View>
              <View style={s.rowRight}>
                <Text style={s.minutes}>{duration(r.minutes)}</Text>
                {notable(r.ratio) && <Text style={s.ratio}>{r.ratio.toFixed(1)}×</Text>}
              </View>
            </Pressable>
          );
        })}

        {board && rows.length <= 1 && (
          <Text style={s.empty}>
            {isAll
              ? 'No friends yet. Tap Add Friend and share your code or link.'
              : 'Nobody else in this group yet. Share its join code from Settings.'}
          </Text>
        )}
      </ScrollView>

      <PersonSheet row={selected} onClose={() => setSelected(null)} onChanged={load} />
      <AddFriendSheet visible={adding} onClose={() => setAdding(false)} onAdded={load} />
    </>
  );
}

// Medals for the top three, as filled badges rather than coloured numerals: a
// gold numeral would read as the `drifting` state and a bronze one as the accent,
// but nothing else on this screen is a filled circle.
const medalFor = (C: Palette, rank: number): string | undefined =>
  ({ 1: C.gold, 2: C.silver, 3: C.bronze } as Record<number, string>)[rank];

function RankBadge({ rank }: { rank: number }) {
  const C = useColors();
  const s = useStyles(makeStyles);
  const medal = medalFor(C, rank);
  if (!medal) return <Text style={s.rank}>{rank}</Text>;
  return (
    <View style={[s.medal, { backgroundColor: medal }]}>
      <Text style={s.medalText}>{rank}</Text>
    </View>
  );
}

const makeStyles = (C: Palette) => StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg },
  navBar: { flexDirection: 'row', alignItems: 'center', minHeight: 38, marginBottom: S.xs },
  navBtn: { justifyContent: 'center' },
  navBtnText: { ...T.body, color: C.accent, fontWeight: '600' },
  navTitle: {
    position: 'absolute', left: 0, right: 0, top: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
    pointerEvents: 'none',   // never swallow taps meant for Add Friend
  },

  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: S.sm + 2 },
  caption: { ...T.footnote, color: C.dim, marginTop: S.xs, marginBottom: S.lg },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: S.md,
    paddingVertical: S.md - 2, paddingHorizontal: S.md,
    borderBottomWidth: HAIRLINE, borderBottomColor: C.line,
    borderRadius: R.md, ...CONTINUOUS,
  },
  // Crimson only ever means "scrolling right now".
  rowLive: {
    backgroundColor: C.problemWash, borderBottomWidth: 0,
    borderLeftWidth: 3, borderLeftColor: C.problem,
  },
  rowMe: { backgroundColor: C.accentWash, borderBottomWidth: 0 },

  rank: { ...T.headline, color: C.faint, width: 24, textAlign: 'center' },
  medal: {
    width: 24, height: 24, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  medalText: { ...T.footnote, color: '#140f0d', fontWeight: '800' },

  nameRow: { flexDirection: 'row', alignItems: 'baseline', gap: S.sm },
  name: { ...T.headline, color: C.text, flexShrink: 1 },
  tag: { ...T.caption, fontWeight: '600' },
  track: { height: 4, borderRadius: R.full, backgroundColor: C.card2, marginTop: 6, overflow: 'hidden' },
  bar: { height: 4, borderRadius: R.full, backgroundColor: C.accent },

  // Only appears on the row of whoever is scrolling, so nothing else gets squeezed.
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: S.sm, marginTop: S.sm },
  liveText: { ...T.caption, color: C.problem, fontWeight: '600', flexShrink: 1 },
  pull: {
    backgroundColor: C.problem, borderRadius: R.sm, ...CONTINUOUS,
    paddingHorizontal: S.md - 2, paddingVertical: 5,
  },
  pullText: { ...T.caption, color: '#fff', fontWeight: '700' },

  rowRight: { alignItems: 'flex-end', minWidth: 62 },
  minutes: { ...T.headline, color: C.text },
  ratio: { ...T.caption, color: C.faint, marginTop: 1 },

  empty: { ...T.subhead, color: C.faint, marginTop: S.xl, lineHeight: 21 },
});
