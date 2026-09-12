// Tap a row on the board to get here. Your own row shows the agent's decision log
// — the "here's why I stayed quiet / spoke up" view that makes the policy legible
// — and everyone else's shows their numbers plus the Pull out button, which is
// where you'd want it: you pull someone out because you just saw them last.
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, Decision, LeaderboardRow } from '../lib/api';
import { C, T, S, R, CONTINUOUS, HAIRLINE, MIN_TAP, stateColor, stateWord } from '../lib/theme';

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

function duration(mins: number): string {
  const m = Math.round(mins);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h}h ${rest}m` : `${h}h`;
}

type Props = { row: LeaderboardRow | null; onClose: () => void; onChanged: () => void };

export function PersonSheet({ row, onClose, onChanged }: Props) {
  const insets = useSafeAreaInsets();
  const [timeline, setTimeline] = useState<Decision[] | null>(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const isMe = !!row?.is_me;

  const loadTimeline = useCallback(async () => {
    if (!isMe) return;
    try { setTimeline(await api.timeline()); } catch { setTimeline([]); }
  }, [isMe]);

  useEffect(() => {
    setMsg(''); setTimeline(null);
    if (row && isMe) loadTimeline();
  }, [row, isMe, loadTimeline]);

  const pull = async () => {
    if (!row) return;
    setBusy(true);
    try {
      await api.pullOut(row.id, `Hey ${row.name}, put the phone down 🙂`);
      setMsg(`Pulled ${row.name} out. Their app is paused for a few minutes.`);
      onChanged();
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={!!row} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose} />
      <View style={[s.sheet, { paddingBottom: insets.bottom + S.xl }]}>
        <View style={s.grabber} />
        {row && (
          <ScrollView style={{ maxHeight: 460 }} contentContainerStyle={{ paddingBottom: S.md }}>
            <Text style={s.name}>{isMe ? 'You' : row.name}</Text>
            <View style={s.stateRow}>
              <View style={[s.dot, { backgroundColor: stateColor(row.state) }]} />
              <Text style={[s.state, { color: stateColor(row.state) }]}>{stateWord(row.state)}</Text>
            </View>

            <View style={s.stats}>
              <Stat label="this period" value={duration(row.minutes)} />
              <Stat label="vs usual" value={row.ratio > 0 ? `${row.ratio.toFixed(1)}×` : '—'} />
              <Stat label="rank" value={`#${row.rank}`} />
            </View>
            {!!row.top_service && <Text style={s.top}>Mostly {row.top_service}.</Text>}

            {isMe ? (
              <>
                <Text style={s.h2}>What the agent has been doing</Text>
                {timeline === null && <ActivityIndicator color={C.accent} style={{ marginTop: S.md }} />}
                {timeline?.length === 0 && (
                  <Text style={s.empty}>No decisions yet. Open a feed app and watch this fill in.</Text>
                )}
                {timeline?.slice(0, 12).map((d) => {
                  const m = ACTION_META[d.action] || ACTION_META.quiet;
                  return (
                    <View key={d.id} style={s.logRow}>
                      <View style={[s.logDot, { backgroundColor: m.color }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={s.logAction}>
                          <Text style={{ color: m.color, fontWeight: '600' }}>{m.label}</Text>
                          {d.service ? <Text style={s.logSvc}>  · {d.service}</Text> : null}
                          {d.source === 'gemini' ? <Text style={s.gemini}>  · Gemini</Text> : null}
                        </Text>
                        <Text style={s.logWhy}>{d.justification}</Text>
                        <Text style={s.logAgo}>{ago(d.created_at)}</Text>
                      </View>
                    </View>
                  );
                })}
              </>
            ) : (
              <Pressable
                style={({ pressed }) => [s.pull, busy && { opacity: 0.5 }, pressed && { opacity: 0.75 }]}
                onPress={pull}
                disabled={busy}
              >
                <Text style={s.pullText}>Pull {row.name} out</Text>
              </Pressable>
            )}

            {!!msg && <Text style={s.msg}>{msg}</Text>}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.stat}>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: C.card, borderTopLeftRadius: 22, borderTopRightRadius: 22, ...CONTINUOUS,
    paddingHorizontal: S.gutter, paddingTop: S.sm,
    borderTopWidth: HAIRLINE, borderColor: C.line,
    ...Platform.select({ web: { maxWidth: 560, marginHorizontal: 'auto' as any }, default: {} }),
  },
  grabber: {
    width: 36, height: 5, borderRadius: R.full, backgroundColor: C.line,
    alignSelf: 'center', marginBottom: S.md,
  },
  name: { ...T.title1, color: C.text },
  stateRow: { flexDirection: 'row', alignItems: 'center', gap: S.sm, marginTop: S.xs },
  dot: { width: 9, height: 9, borderRadius: R.full },
  state: { ...T.subhead, fontWeight: '600' },
  stats: { flexDirection: 'row', gap: S.sm, marginTop: S.lg },
  stat: {
    flex: 1, backgroundColor: C.card2, borderRadius: R.md, ...CONTINUOUS,
    paddingVertical: S.md, alignItems: 'center',
  },
  statValue: { ...T.title3, color: C.text, fontWeight: '600' },
  statLabel: { ...T.caption, color: C.faint, marginTop: 2 },
  top: { ...T.footnote, color: C.dim, marginTop: S.md },
  h2: {
    ...T.footnote, fontWeight: '600', color: C.dim, textTransform: 'uppercase',
    letterSpacing: 0.6, marginTop: S.xl, marginBottom: S.sm,
  },
  empty: { ...T.subhead, color: C.faint },
  logRow: {
    flexDirection: 'row', gap: S.md, paddingVertical: S.md - 2,
    borderBottomWidth: HAIRLINE, borderBottomColor: C.line,
  },
  logDot: { width: 9, height: 9, borderRadius: R.full, marginTop: 6 },
  logAction: { ...T.subhead },
  logSvc: { color: C.dim },
  gemini: { ...T.footnote, color: C.accent },
  logWhy: { ...T.subhead, color: C.dim, marginTop: 2 },
  logAgo: { ...T.caption, color: C.faint, marginTop: 3 },
  pull: {
    backgroundColor: C.problem, borderRadius: R.md, ...CONTINUOUS, minHeight: MIN_TAP + 4,
    alignItems: 'center', justifyContent: 'center', marginTop: S.xl,
  },
  pullText: { ...T.headline, color: '#fff' },
  msg: { ...T.subhead, color: C.drifting, marginTop: S.md, textAlign: 'center' },
});
