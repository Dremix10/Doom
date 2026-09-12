// "Groups": the leagues you're in. Create one, share its code, or join someone
// else's. Groups — not friendships — decide who you see on the board, so this is
// the screen that fills the leaderboard up.
import { useCallback, useEffect, useState } from 'react';
import { Alert, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, Group } from '../../lib/api';
import { C, T, S, R, CONTINUOUS, HAIRLINE, MIN_TAP } from '../../lib/theme';

export default function Groups() {
  const insets = useSafeAreaInsets();
  const [groups, setGroups] = useState<Group[]>([]);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { setGroups(await api.groups()); } catch { /* ignore */ }
  }, []);
  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!name.trim()) return;
    try { await api.createGroup(name.trim()); setName(''); setMsg(''); load(); }
    catch (e: any) { setMsg(e.message); }
  };

  const join = async () => {
    if (!code.trim()) return;
    try {
      const g = await api.joinGroup(code.trim().toUpperCase());
      setCode(''); setMsg(`Joined ${g.name}.`); load();
    } catch (e: any) { setMsg(e.message); }
  };

  const leave = (g: Group) => {
    const go = async () => { await api.leaveGroup(g.id); load(); };
    if (Platform.OS === 'web') { go(); return; }
    Alert.alert(`Leave ${g.name}?`, "You'll drop off its leaderboard.", [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: go },
    ]);
  };

  const copy = (text: string) => {
    if (Platform.OS === 'web') {
      try { navigator.clipboard.writeText(text); setMsg(`Copied ${text}`); } catch { /* ignore */ }
    } else {
      Alert.alert('Join code', text);
    }
  };

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
      <Text style={s.h1}>Groups</Text>
      <Text style={s.caption}>Each group is its own leaderboard.</Text>

      {groups.length === 0 && (
        <Text style={s.empty}>
          No groups yet. Create one below and share the code, or join a friend's.
        </Text>
      )}

      {groups.map((g) => (
        <View key={g.id} style={s.card}>
          <View style={s.cardHead}>
            <View style={{ flex: 1 }}>
              <Text style={s.name}>{g.name}</Text>
              <Text style={s.members} numberOfLines={2}>
                {g.member_count} {g.member_count === 1 ? 'member' : 'members'} · {g.members.join(', ')}
              </Text>
            </View>
            <Pressable hitSlop={8} onPress={() => leave(g)} style={({ pressed }) => pressed && { opacity: 0.6 }}>
              <Text style={s.leave}>Leave</Text>
            </Pressable>
          </View>
          <Pressable onPress={() => copy(g.join_code)} style={({ pressed }) => pressed && { opacity: 0.7 }}>
            <Text style={s.code}>{g.join_code}</Text>
          </Pressable>
          <Text style={s.hint}>Tap to copy · share this so people can join</Text>
        </View>
      ))}

      <Text style={s.h2}>Create a group</Text>
      <View style={s.row}>
        <TextInput
          style={s.input} placeholder="e.g. Roommates" placeholderTextColor={C.faint}
          value={name} onChangeText={setName} onSubmitEditing={create} returnKeyType="done"
        />
        <Pressable style={({ pressed }) => [s.btn, pressed && { opacity: 0.75 }]} onPress={create}>
          <Text style={s.btnText}>Create</Text>
        </Pressable>
      </View>

      <Text style={s.h2}>Join with a code</Text>
      <View style={s.row}>
        <TextInput
          style={[s.input, { letterSpacing: 2 }]} placeholder="ABC123" placeholderTextColor={C.faint}
          value={code} onChangeText={setCode} autoCapitalize="characters" autoCorrect={false}
          onSubmitEditing={join} returnKeyType="done"
        />
        <Pressable style={({ pressed }) => [s.btn, pressed && { opacity: 0.75 }]} onPress={join}>
          <Text style={s.btnText}>Join</Text>
        </Pressable>
      </View>

      {!!msg && <Text style={s.msg}>{msg}</Text>}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg },
  h1: { ...T.largeTitle, color: C.text },
  caption: { ...T.footnote, color: C.faint, marginTop: S.xs, marginBottom: S.lg },
  empty: { ...T.subhead, color: C.faint, lineHeight: 21, marginBottom: S.lg },
  card: {
    backgroundColor: C.card, borderRadius: R.lg, ...CONTINUOUS, padding: S.lg,
    marginBottom: S.md, borderWidth: HAIRLINE, borderColor: C.line,
  },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: S.md },
  name: { ...T.title3, color: C.text, fontWeight: '600' },
  members: { ...T.footnote, color: C.dim, marginTop: 2 },
  leave: { ...T.subhead, color: C.problem, fontWeight: '600' },
  code: {
    ...T.title2, color: C.text, letterSpacing: 6, textAlign: 'center', marginTop: S.md,
    backgroundColor: C.card2, borderRadius: R.md, ...CONTINUOUS, paddingVertical: S.md,
  },
  hint: { ...T.caption, color: C.faint, marginTop: S.sm, textAlign: 'center' },
  h2: {
    ...T.footnote, fontWeight: '600', color: C.dim, textTransform: 'uppercase',
    letterSpacing: 0.6, marginTop: S.xl, marginBottom: S.sm,
  },
  row: { flexDirection: 'row', gap: S.sm + 2 },
  input: {
    flex: 1, backgroundColor: C.card, color: C.text, borderRadius: R.md, ...CONTINUOUS,
    paddingHorizontal: S.md + 2, minHeight: MIN_TAP, borderWidth: HAIRLINE, borderColor: C.line,
    ...T.body,
  },
  btn: {
    backgroundColor: C.accent, borderRadius: R.md, ...CONTINUOUS,
    paddingHorizontal: S.xl, minHeight: MIN_TAP, justifyContent: 'center',
  },
  btnText: { ...T.headline, color: '#fff' },
  msg: { ...T.subhead, color: C.drifting, marginTop: S.md },
});
