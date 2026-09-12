// "Friends": everyone's live state, and the Pull out button — the human half of
// the accountability loop.
import { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput, RefreshControl, Alert, Platform } from 'react-native';
import { api, FriendState } from '../../lib/api';
import { C, stateColor, stateWord } from '../../lib/theme';

export default function Friends() {
  const [friends, setFriends] = useState<FriendState[]>([]);
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { setFriends(await api.friends()); } catch { /* ignore */ }
  }, []);
  useEffect(() => { load(); const id = setInterval(load, 4000); return () => clearInterval(id); }, [load]);

  const add = async () => {
    if (!code.trim()) return;
    try { await api.addFriend(code.trim().toUpperCase()); setCode(''); setMsg(''); load(); }
    catch (e: any) { setMsg(e.message); }
  };

  const pull = async (f: FriendState) => {
    try {
      await api.pullOut(f.id, `Hey ${f.name}, put the phone down 🙂`);
      const t = `Pulled ${f.name} out. Their app is paused for a few minutes.`;
      if (Platform.OS === 'web') setMsg(t); else Alert.alert('Sent', t);
      load();
    } catch (e: any) { setMsg(e.message); }
  };

  const sorted = [...friends].sort((a, b) => {
    const rank: Record<string, number> = { problem: 0, drifting: 1, fine: 2, offline: 3 };
    return (rank[a.state] ?? 9) - (rank[b.state] ?? 9);
  });

  return (
    <ScrollView
      style={s.wrap}
      contentContainerStyle={{ padding: 20, paddingTop: 64, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={C.accent} />}
    >
      <Text style={s.h1}>Friends</Text>

      <View style={s.addRow}>
        <TextInput
          style={s.input} placeholder="Enter invite code" placeholderTextColor={C.faint}
          value={code} onChangeText={setCode} autoCapitalize="characters" onSubmitEditing={add}
        />
        <Pressable style={s.addBtn} onPress={add}><Text style={s.addBtnText}>Add</Text></Pressable>
      </View>
      {!!msg && <Text style={s.msg}>{msg}</Text>}

      {sorted.length === 0 && <Text style={s.empty}>No friends yet. Share your invite code (Setup tab) or add theirs above.</Text>}

      {sorted.map((f) => {
        const alarming = f.state === 'problem' || f.state === 'drifting';
        return (
          <View key={f.id} style={s.card}>
            <View style={[s.dot, { backgroundColor: stateColor(f.state) }]} />
            <View style={{ flex: 1 }}>
              <Text style={s.name}>{f.name}</Text>
              <Text style={[s.state, { color: stateColor(f.state) }]}>
                {stateWord(f.state)}
                {f.service ? ` · ${f.minutes.toFixed(0)}m on ${f.service}` : ''}
                {f.ratio > 1.2 ? `  (${f.ratio.toFixed(1)}× usual)` : ''}
              </Text>
            </View>
            {alarming && (
              <Pressable style={[s.pull, f.state === 'problem' && { backgroundColor: C.problem }]} onPress={() => pull(f)}>
                <Text style={s.pullText}>Pull out</Text>
              </Pressable>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg },
  h1: { color: C.text, fontSize: 30, fontWeight: '800', marginBottom: 16 },
  addRow: { flexDirection: 'row', gap: 10, marginBottom: 6 },
  input: { flex: 1, backgroundColor: C.card, color: C.text, borderRadius: 12, padding: 13, borderWidth: 1, borderColor: C.line, fontSize: 16, letterSpacing: 2 },
  addBtn: { backgroundColor: C.accent, borderRadius: 12, paddingHorizontal: 20, justifyContent: 'center' },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  msg: { color: C.drifting, marginTop: 8 },
  empty: { color: C.faint, fontSize: 14, lineHeight: 20, marginTop: 20 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: 16, padding: 16, marginTop: 12, gap: 14 },
  dot: { width: 14, height: 14, borderRadius: 7 },
  name: { color: C.text, fontSize: 18, fontWeight: '700' },
  state: { fontSize: 14, marginTop: 2 },
  pull: { backgroundColor: C.drifting, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 16 },
  pullText: { color: '#0b0b0f', fontWeight: '800', fontSize: 15 },
});
