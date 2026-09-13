// One group: who's in it, the code to share, who you can invite, and the way out.
// Leaving sits at the bottom as a destructive row rather than as red text beside
// the group's name, where it was one mis-tap from dropping you off a leaderboard.
import { useCallback, useEffect, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { api, FriendState, Group } from '../../../lib/api';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { Row, Section } from '../../../components/SettingsList';
import { Palette, T, S, R, CONTINUOUS, HAIRLINE, MIN_TAP, useColors, useStyles } from '../../../lib/theme';

export default function GroupDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const C = useColors();
  const s = useStyles(makeStyles);
  const [group, setGroup] = useState<Group | null>(null);
  const [friends, setFriends] = useState<FriendState[]>([]);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    try { setGroup((await api.groups()).find((g) => g.id === id) ?? null); } catch { /* ignore */ }
    try { setFriends(await api.friends()); } catch { /* ignore */ }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  if (!group) {
    return (
      <ScrollView style={s.wrap} contentContainerStyle={{ paddingHorizontal: S.gutter }}>
        <ScreenHeader title="Group" back="Your groups" />
      </ScrollView>
    );
  }

  const copy = () => {
    if (Platform.OS === 'web') {
      try { navigator.clipboard.writeText(group.join_code); setMsg('Code copied.'); } catch { /* ignore */ }
    } else {
      Alert.alert('Join code', group.join_code);
    }
  };

  const invite = async (f: FriendState) => {
    setBusy(f.id);
    try { await api.inviteToGroup(group.id, f.id); setMsg(`Invited ${f.name}.`); load(); }
    catch (e: any) { setMsg(e.message); }
    finally { setBusy(''); }
  };

  const leave = () => {
    const go = async () => { await api.leaveGroup(group.id); router.back(); };
    if (Platform.OS === 'web') { go(); return; }
    Alert.alert(`Leave ${group.name}?`, "You'll drop off its leaderboard.", [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: go },
    ]);
  };

  const eligible = friends.filter((f) => !group.member_ids.includes(f.id));

  return (
    <ScrollView
      style={s.wrap}
      contentContainerStyle={{ paddingHorizontal: S.gutter, paddingBottom: S.xxl + S.md }}
    >
      <ScreenHeader title={group.name} back="Your groups" />

      <Section title={`${group.member_count} ${group.member_count === 1 ? 'member' : 'members'}`}>
        {group.members.map((name, i) => (
          <Row key={name} first={i === 0} label={name} />
        ))}
      </Section>

      <Text style={s.h2}>Join code</Text>
      <Pressable onPress={copy} style={({ pressed }) => pressed && { opacity: 0.7 }}>
        <Text style={s.code}>{group.join_code}</Text>
      </Pressable>
      <Text style={s.hint}>Tap to copy · anyone with this can join</Text>

      <Text style={s.h2}>Invite a friend</Text>
      {eligible.length === 0 ? (
        <Text style={s.note}>All of your friends are already in this group.</Text>
      ) : (
        <View style={s.card}>
          {eligible.map((f, i) => (
            <View key={f.id} style={[s.inviteRow, i > 0 && s.divided]}>
              <Text style={s.name} numberOfLines={1}>{f.name}</Text>
              <Pressable
                onPress={() => invite(f)}
                disabled={!!busy}
                style={({ pressed }) => [s.inviteBtn, !!busy && { opacity: 0.5 }, pressed && { opacity: 0.75 }]}
              >
                <Text style={s.inviteBtnText}>{busy === f.id ? 'Inviting…' : 'Invite'}</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}

      <Section>
        <Row first label={`Leave ${group.name}`} destructive onPress={leave} />
      </Section>

      {!!msg && <Text style={s.msg}>{msg}</Text>}
    </ScrollView>
  );
}

const makeStyles = (C: Palette) => StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg },
  h2: {
    ...T.footnote, fontWeight: '600', color: C.dim, textTransform: 'uppercase',
    letterSpacing: 0.6, marginBottom: S.sm, marginLeft: S.xs,
  },
  code: {
    ...T.title2, color: C.text, letterSpacing: 6, textAlign: 'center',
    backgroundColor: C.card, borderRadius: R.lg, ...CONTINUOUS,
    borderWidth: HAIRLINE, borderColor: C.line, paddingVertical: S.md + 2,
  },
  hint: { ...T.caption, color: C.faint, textAlign: 'center', marginTop: S.sm, marginBottom: S.xl },
  note: { ...T.subhead, color: C.faint, marginBottom: S.xl, marginLeft: S.xs },
  card: {
    backgroundColor: C.card, borderRadius: R.lg, ...CONTINUOUS,
    borderWidth: HAIRLINE, borderColor: C.line, overflow: 'hidden', marginBottom: S.xl,
  },
  inviteRow: {
    flexDirection: 'row', alignItems: 'center', gap: S.md,
    paddingHorizontal: S.lg, minHeight: MIN_TAP + 6,
  },
  divided: { borderTopWidth: HAIRLINE, borderTopColor: C.line },
  name: { ...T.body, color: C.text, flex: 1 },
  inviteBtn: {
    backgroundColor: C.accentWash, borderRadius: R.full,
    paddingHorizontal: S.md + 2, paddingVertical: 6,
  },
  inviteBtnText: { ...T.footnote, color: C.accent, fontWeight: '700' },
  msg: { ...T.subhead, color: C.drifting, marginTop: S.md, marginLeft: S.xs },
});
