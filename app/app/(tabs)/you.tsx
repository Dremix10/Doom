// "You": your live state and the agent's decision log — the part that makes the
// policy legible ("here's why I stayed quiet / spoke up").
import { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, Pressable } from 'react-native';
import { api, Decision, FriendState, Note } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { C, stateColor, stateWord } from '../../lib/theme';

const ACTION_META: Record<string, { label: string; color: string }> = {
  quiet: { label: 'stayed quiet', color: C.faint },
  nudge: { label: 'nudged you', color: C.drifting },
  escalate: { label: 'asked a friend', color: C.problem },
  interrupt: { label: 'paused the app', color: C.problem },
};

function ago(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s | 0}s ago`;
  if (s < 3600) return `${(s / 60) | 0}m ago`;
  return `${(s / 3600) | 0}h ago`;
}

export default function You() {
  const { me } = useAuth();
  const [status, setStatus] = useState<FriendState | null>(null);
  const [timeline, setTimeline] = useState<Decision[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [st, tl, no] = await Promise.all([api.myStatus(), api.timeline(), api.notifications()]);
      setStatus(st); setTimeline(tl); setNotes(no);
    } catch { /* ignore transient */ }
  }, []);

  useEffect(() => { load(); const id = setInterval(load, 4000); return () => clearInterval(id); }, [load]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };
  const play = (url: string) => {
    if (typeof window !== 'undefined') { try { new Audio(api.base + url).play(); } catch { /* ignore */ } }
  };

  const st = status?.state || 'offline';
  return (
    <ScrollView
      style={s.wrap}
      contentContainerStyle={{ padding: 20, paddingTop: 64, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} />}
    >
      <Text style={s.hi}>Hi {me?.name}.</Text>

      <View style={[s.statusCard, { borderColor: stateColor(st) }]}>
        <View style={[s.dot, { backgroundColor: stateColor(st) }]} />
        <View style={{ flex: 1 }}>
          <Text style={[s.statusWord, { color: stateColor(st) }]}>You're {stateWord(st)}</Text>
          {status?.service ? (
            <Text style={s.statusSub}>
              {status.minutes.toFixed(0)} min on {status.service}
              {status.ratio > 1.2 ? `  ·  ${status.ratio.toFixed(1)}× your usual` : ''}
            </Text>
          ) : (
            <Text style={s.statusSub}>Nothing unusual right now.</Text>
          )}
        </View>
      </View>

      {notes.length > 0 && (
        <>
          <Text style={s.h2}>For you</Text>
          {notes.slice(0, 4).map((n) => (
            <View key={n.id} style={s.noteCard}>
              <Text style={s.noteTitle}>{n.title}</Text>
              <Text style={s.noteBody}>{n.body}</Text>
              <View style={s.noteRow}>
                <Text style={s.noteAgo}>{ago(n.created_at)}</Text>
                {n.audio_url && (
                  <Pressable onPress={() => play(n.audio_url!)}><Text style={s.play}>▶ play</Text></Pressable>
                )}
                {!n.read_at && (
                  <Pressable onPress={async () => { await api.markRead(n.id); load(); }}>
                    <Text style={s.ok}>got it</Text>
                  </Pressable>
                )}
              </View>
            </View>
          ))}
        </>
      )}

      <Text style={s.h2}>What the agent has been doing</Text>
      {timeline.length === 0 && <Text style={s.empty}>No decisions yet. Open a feed app and watch this fill in.</Text>}
      {timeline.slice(0, 20).map((d) => {
        const m = ACTION_META[d.action] || ACTION_META.quiet;
        return (
          <View key={d.id} style={s.logRow}>
            <View style={[s.logDot, { backgroundColor: m.color }]} />
            <View style={{ flex: 1 }}>
              <Text style={s.logAction}>
                <Text style={{ color: m.color, fontWeight: '700' }}>{m.label}</Text>
                {d.service ? <Text style={s.logSvc}>  · {d.service}</Text> : null}
                {d.source === 'gemini' ? <Text style={s.gemini}>  · Gemini</Text> : null}
              </Text>
              <Text style={s.logWhy}>{d.justification}</Text>
              <Text style={s.logAgo}>{ago(d.created_at)}</Text>
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg },
  hi: { color: C.text, fontSize: 30, fontWeight: '800', marginBottom: 16 },
  statusCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: 18, padding: 18, borderWidth: 1.5, gap: 14 },
  dot: { width: 16, height: 16, borderRadius: 8 },
  statusWord: { fontSize: 20, fontWeight: '700' },
  statusSub: { color: C.dim, fontSize: 14, marginTop: 3 },
  h2: { color: C.dim, fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginTop: 26, marginBottom: 10 },
  noteCard: { backgroundColor: C.card2, borderRadius: 14, padding: 14, marginBottom: 10 },
  noteTitle: { color: C.text, fontWeight: '700', fontSize: 15 },
  noteBody: { color: C.dim, fontSize: 14, marginTop: 3, lineHeight: 20 },
  noteRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 8 },
  noteAgo: { color: C.faint, fontSize: 12, flex: 1 },
  play: { color: C.accent, fontWeight: '600' },
  ok: { color: C.fine, fontWeight: '600' },
  empty: { color: C.faint, fontSize: 14, lineHeight: 20 },
  logRow: { flexDirection: 'row', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.line },
  logDot: { width: 10, height: 10, borderRadius: 5, marginTop: 5 },
  logAction: { fontSize: 15 },
  logSvc: { color: C.dim },
  gemini: { color: C.accent, fontSize: 13 },
  logWhy: { color: C.dim, fontSize: 14, marginTop: 2, lineHeight: 19 },
  logAgo: { color: C.faint, fontSize: 12, marginTop: 3 },
});
