// "Your friends": who can see your usage, and the only place to revoke it.
//
// Friends accumulate on their own now — joining a group friends you to everyone
// in it — so there has to be somewhere to see the list and prune it.
//
// Removing is refused for anyone you share a group with, on purpose: visibility
// is granted by friendship OR shared group, so dropping the friendship of a
// group-mate would look like it did something and change nothing. Leaving the
// group is the real action, and removing a friend never touches group membership.
//
// Group invitations land here too. They arrive as notifications, and with no
// inbox screen this is the one place they can be accepted.
import { useCallback, useEffect, useState } from 'react';
import { Alert, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api, FriendState, Note } from '../../../lib/api';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { Palette, T, S, R, CONTINUOUS, HAIRLINE, MIN_TAP, useColors, useStyles, stateColor } from '../../../lib/theme';

export default function Friends() {
  const C = useColors();
  const s = useStyles(makeStyles);
  const [friends, setFriends] = useState<FriendState[]>([]);
  const [invites, setInvites] = useState<Note[]>([]);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { setFriends(await api.friends()); } catch { /* ignore */ }
    try {
      const notes = await api.notifications(true);
      setInvites(notes.filter((n) => n.kind === 'invite' && n.payload?.join_code));
    } catch { /* ignore */ }
  }, []);
  useEffect(() => { load(); }, [load]);

  const remove = (f: FriendState) => {
    const go = async () => {
      setBusy(f.id);
      try { await api.removeFriend(f.id); setMsg(`Removed ${f.name}.`); load(); }
      catch (e: any) { setMsg(e.message); }
      finally { setBusy(''); }
    };
    if (Platform.OS === 'web') { go(); return; }
    Alert.alert(`Remove ${f.name}?`, "They'll no longer see your usage, and you won't see theirs.", [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: go },
    ]);
  };

  const accept = async (n: Note) => {
    setBusy(n.id);
    try {
      const g = await api.joinGroup(String(n.payload.join_code));
      await api.markRead(n.id);
      setMsg(`Joined ${g.name}.`);
      load();
    } catch (e: any) { setMsg(e.message); }
    finally { setBusy(''); }
  };

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
      <ScreenHeader title="Your friends" />

      {invites.length > 0 && (
        <>
          <Text style={s.h2}>Group invitations</Text>
          <View style={s.card}>
            {invites.map((n, i) => (
              <View key={n.id} style={[s.row, i > 0 && s.divided]}>
                <View style={{ flex: 1 }}>
                  <Text style={s.name}>{n.title}</Text>
                  <Text style={s.sub}>{n.body}</Text>
                </View>
                <Pressable
                  onPress={() => accept(n)}
                  disabled={!!busy}
                  style={({ pressed }) => [s.join, !!busy && { opacity: 0.5 }, pressed && { opacity: 0.75 }]}
                >
                  <Text style={s.joinText}>{busy === n.id ? 'Joining…' : 'Join'}</Text>
                </Pressable>
              </View>
            ))}
          </View>
        </>
      )}

      <Text style={s.h2}>{friends.length} {friends.length === 1 ? 'friend' : 'friends'}</Text>
      <Text style={s.intro}>They can see which apps your time goes to, and pull you out.</Text>

      {friends.length === 0 && (
        <Text style={s.empty}>Nobody yet. Add someone from the board, or join a group.</Text>
      )}

      {friends.length > 0 && (
        <View style={s.card}>
          {friends.map((f, i) => (
            <View key={f.id} style={[s.row, i > 0 && s.divided]}>
              <View style={[s.dot, { backgroundColor: stateColor(C, f.state) }]} />
              <View style={{ flex: 1 }}>
                <Text style={s.name}>{f.name}</Text>
                <Text style={s.sub} numberOfLines={2}>
                  {f.shared_groups.length > 0
                    ? `In ${f.shared_groups.join(' and ')} with you`
                    : 'Added directly'}
                </Text>
              </View>
              {f.shared_groups.length === 0 ? (
                <Pressable
                  onPress={() => remove(f)}
                  disabled={!!busy}
                  hitSlop={8}
                  style={({ pressed }) => [!!busy && { opacity: 0.5 }, pressed && { opacity: 0.6 }]}
                >
                  <Text style={s.remove}>{busy === f.id ? 'Removing…' : 'Remove'}</Text>
                </Pressable>
              ) : (
                <Text style={s.locked}>Leave group</Text>
              )}
            </View>
          ))}
        </View>
      )}

      <Text style={s.note}>
        You can only remove someone you added directly. If you're in a group together, they can
        see you because of the group — leave it from Your groups to remove them. Removing a friend
        never removes anyone from a group.
      </Text>

      {!!msg && <Text style={s.msg}>{msg}</Text>}
    </ScrollView>
  );
}

const makeStyles = (C: Palette) => StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg },
  h2: {
    ...T.footnote, fontWeight: '600', color: C.dim, textTransform: 'uppercase',
    letterSpacing: 0.6, marginBottom: S.xs, marginLeft: S.xs, marginTop: S.sm,
  },
  intro: { ...T.footnote, color: C.faint, marginBottom: S.md, marginLeft: S.xs },
  empty: { ...T.subhead, color: C.faint, lineHeight: 21 },
  card: {
    backgroundColor: C.card, borderRadius: R.lg, ...CONTINUOUS,
    borderWidth: HAIRLINE, borderColor: C.line, overflow: 'hidden', marginBottom: S.lg,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: S.md,
    paddingHorizontal: S.lg, paddingVertical: S.md, minHeight: MIN_TAP + 6,
  },
  divided: { borderTopWidth: HAIRLINE, borderTopColor: C.line },
  dot: { width: 9, height: 9, borderRadius: R.full },
  name: { ...T.body, color: C.text },
  sub: { ...T.caption, color: C.faint, marginTop: 1 },
  remove: { ...T.subhead, color: C.problem, fontWeight: '600' },
  locked: { ...T.caption, color: C.faint },
  join: {
    backgroundColor: C.accent, borderRadius: R.full, ...CONTINUOUS,
    paddingHorizontal: S.lg, minHeight: MIN_TAP - 10, justifyContent: 'center',
  },
  joinText: { ...T.subhead, color: C.onAccent, fontWeight: '700' },
  note: { ...T.caption, color: C.faint, lineHeight: 17, marginLeft: S.xs },
  msg: { ...T.subhead, color: C.drifting, marginTop: S.md, marginLeft: S.xs },
});
