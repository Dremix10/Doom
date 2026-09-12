// "Settings": your groups, the DNS sensor profile, Persona verification, and sign
// out. Groups live here rather than in their own tab because the board can now
// show "All friends" and add people directly — but they're still one tap from the
// board via "Manage groups…" in its title menu, since creating a group mid-demo
// shouldn't mean hunting through settings.
import { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, Group } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { C, T, S, R, CONTINUOUS, HAIRLINE, MIN_TAP } from '../../lib/theme';

export default function Settings() {
  const { me, refresh, logout } = useAuth();
  const insets = useSafeAreaInsets();
  const [groups, setGroups] = useState<Group[]>([]);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { setGroups(await api.groups()); } catch { /* ignore */ }
  }, []);
  useEffect(() => { load(); }, [load]);

  if (!me) return null;

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

  const copy = (text: string, what: string) => {
    if (Platform.OS === 'web') {
      try { navigator.clipboard.writeText(text); setMsg(`${what} copied.`); } catch { /* ignore */ }
    } else {
      Alert.alert(what, text);
    }
  };

  const openSetup = () => Linking.openURL(me.setup_url);
  const verify = async () => { setBusy(true); try { await api.personaVerify(); await refresh(); } finally { setBusy(false); } };

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

      <Text style={s.h2}>Your groups</Text>
      <Text style={s.caption}>Each group is its own leaderboard.</Text>

      {groups.length === 0 && (
        <Text style={s.empty}>No groups yet. Create one below and share the code, or join a friend's.</Text>
      )}

      {groups.map((g) => (
        <View key={g.id} style={s.card}>
          <View style={s.cardHead}>
            <View style={{ flex: 1 }}>
              <Text style={s.groupName}>{g.name}</Text>
              <Text style={s.members} numberOfLines={2}>
                {g.member_count} {g.member_count === 1 ? 'member' : 'members'} · {g.members.join(', ')}
              </Text>
            </View>
            <Pressable hitSlop={8} onPress={() => leave(g)} style={({ pressed }) => pressed && { opacity: 0.6 }}>
              <Text style={s.leave}>Leave</Text>
            </Pressable>
          </View>
          <Pressable onPress={() => copy(g.join_code, 'Join code')} style={({ pressed }) => pressed && { opacity: 0.7 }}>
            <Text style={s.code}>{g.join_code}</Text>
          </Pressable>
          <Text style={s.hint}>Tap to copy · share this so people can join</Text>
        </View>
      ))}

      <View style={s.row}>
        <TextInput
          style={s.input} placeholder="New group name" placeholderTextColor={C.faint}
          value={name} onChangeText={setName} onSubmitEditing={create} returnKeyType="done"
        />
        <Pressable style={({ pressed }) => [s.btnSmall, pressed && s.pressed]} onPress={create}>
          <Text style={s.btnSmallText}>Create</Text>
        </Pressable>
      </View>
      <View style={[s.row, { marginTop: S.sm }]}>
        <TextInput
          style={[s.input, { letterSpacing: 2 }]} placeholder="Join code" placeholderTextColor={C.faint}
          value={code} onChangeText={setCode} autoCapitalize="characters" autoCorrect={false}
          onSubmitEditing={join} returnKeyType="done"
        />
        <Pressable style={({ pressed }) => [s.btnSmall, pressed && s.pressed]} onPress={join}>
          <Text style={s.btnSmallText}>Join</Text>
        </Pressable>
      </View>
      {!!msg && <Text style={s.msg}>{msg}</Text>}

      <Text style={s.h2}>Your phone</Text>
      <View style={s.card}>
        <Text style={s.step}>1 · Install the sensor</Text>
        <Text style={s.body}>
          One tap installs a DNS profile so Nudge can tell when a scroll has gone too long.
          Nothing runs on your phone. Remove it any time in Settings.
        </Text>
        <Pressable style={({ pressed }) => [s.btn, pressed && s.pressed]} onPress={openSetup}>
          <Text style={s.btnText}>Open install page</Text>
        </Pressable>
        <Text style={s.hint}>Turn off iCloud Private Relay and any VPN, or they bypass the sensor.</Text>
      </View>

      <View style={s.card}>
        <Text style={s.step}>2 · Prove you're human</Text>
        <Text style={s.body}>
          The people in your groups should be real, so pull-outs can't be spoofed. Verified with Persona.
        </Text>
        {me.persona_verified ? (
          <Text style={s.verified}>✓ Verified human</Text>
        ) : (
          <Pressable style={({ pressed }) => [s.btn, busy && { opacity: 0.5 }, pressed && s.pressed]} onPress={verify} disabled={busy}>
            <Text style={s.btnText}>Verify with Persona</Text>
          </Pressable>
        )}
      </View>

      <Pressable style={({ pressed }) => [s.logout, pressed && s.pressed]} onPress={logout}>
        <Text style={s.logoutText}>Sign out</Text>
      </Pressable>
      <Text style={s.meta}>Signed in as {me.name} · code {me.invite_code}</Text>
      <Text style={s.meta}>Sensor id {me.client_id}</Text>
      <Text style={s.meta}>API {api.base}</Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg },
  h1: { ...T.largeTitle, color: C.text, marginBottom: S.lg },
  h2: {
    ...T.footnote, fontWeight: '600', color: C.dim, textTransform: 'uppercase',
    letterSpacing: 0.6, marginTop: S.xl, marginBottom: S.xs,
  },
  caption: { ...T.footnote, color: C.faint, marginBottom: S.md },
  empty: { ...T.subhead, color: C.faint, lineHeight: 21, marginBottom: S.md },
  card: {
    backgroundColor: C.card, borderRadius: R.lg, ...CONTINUOUS, padding: S.lg,
    marginBottom: S.md, borderWidth: HAIRLINE, borderColor: C.line,
  },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: S.md },
  groupName: { ...T.title3, color: C.text, fontWeight: '600' },
  members: { ...T.footnote, color: C.dim, marginTop: 2 },
  leave: { ...T.subhead, color: C.problem, fontWeight: '600' },
  code: {
    ...T.title2, color: C.text, letterSpacing: 6, textAlign: 'center', marginTop: S.md,
    backgroundColor: C.card2, borderRadius: R.md, ...CONTINUOUS, paddingVertical: S.md,
  },
  step: { ...T.footnote, fontWeight: '600', color: C.accent, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: S.sm },
  body: { ...T.subhead, color: C.dim, lineHeight: 21 },
  row: { flexDirection: 'row', gap: S.sm + 2 },
  input: {
    flex: 1, backgroundColor: C.card, color: C.text, borderRadius: R.md, ...CONTINUOUS,
    paddingHorizontal: S.md + 2, minHeight: MIN_TAP, borderWidth: HAIRLINE, borderColor: C.line,
    ...T.body,
  },
  btnSmall: {
    backgroundColor: C.accent, borderRadius: R.md, ...CONTINUOUS,
    paddingHorizontal: S.lg, minHeight: MIN_TAP, justifyContent: 'center',
  },
  btnSmallText: { ...T.headline, color: '#fff' },
  btn: {
    backgroundColor: C.accent, borderRadius: R.md, ...CONTINUOUS, minHeight: MIN_TAP,
    alignItems: 'center', justifyContent: 'center', marginTop: S.md + 2,
  },
  btnText: { ...T.headline, color: '#fff' },
  pressed: { opacity: 0.75 },
  hint: { ...T.caption, color: C.faint, marginTop: S.sm, lineHeight: 17, textAlign: 'center' },
  verified: { ...T.headline, color: C.fine, marginTop: S.md },
  logout: { minHeight: MIN_TAP, alignItems: 'center', justifyContent: 'center', marginTop: S.lg },
  logoutText: { ...T.body, color: C.problem, fontWeight: '600' },
  meta: { ...T.caption, color: C.faint, textAlign: 'center', marginTop: S.xs },
  msg: { ...T.subhead, color: C.drifting, marginTop: S.md },
});
