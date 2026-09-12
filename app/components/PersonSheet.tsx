// Tap a row on the board to get here. Everyone's sheet shows exactly where their
// time went — per app, today and over the last week. Your own adds the agent's
// decision log; anyone else's adds a message box and the Pull out button, which
// is where you'd want it: you pull someone out because you just saw them last.
//
// Apps a person has hidden arrive as a single "Hidden" row. The minutes are still
// in their total and their rank — only the app name is withheld.
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Modal, Platform, Pressable, ScrollView, StyleSheet, Text,
  TextInput, useWindowDimensions, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, Breakdown, Decision, LeaderboardRow } from '../lib/api';
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
  const { height } = useWindowDimensions();
  const [timeline, setTimeline] = useState<Decision[] | null>(null);
  const [detail, setDetail] = useState<Breakdown | null>(null);
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const isMe = !!row?.is_me;
  const personId = row?.id;

  const loadDetail = useCallback(async () => {
    if (!personId) return;
    try { setDetail(await api.breakdown(personId)); } catch { setDetail(null); }
    if (isMe) {
      try { setTimeline(await api.timeline()); } catch { setTimeline([]); }
    }
  }, [personId, isMe]);

  useEffect(() => {
    setMsg(''); setNote(''); setTimeline(null); setDetail(null);
    if (row) loadDetail();
  }, [row, loadDetail]);

  const pull = async () => {
    if (!row) return;
    setBusy(true);
    try {
      await api.pullOut(row.id, note.trim() || `Hey ${row.name}, put the phone down 🙂`);
      setMsg(`Sent. ${row.name}'s app is paused for a few minutes.`);
      setNote('');
      onChanged();
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  };

  // Bars are scaled to the biggest week figure so the rows compare against each other.
  const peak = Math.max(1, ...(detail?.apps ?? []).map((a) => a.week), detail?.hidden_week ?? 0);
  const topLabel = detail?.apps?.[0]?.label;

  return (
    <Modal visible={!!row} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose} />
      <View style={[s.sheet, { paddingBottom: insets.bottom + S.xl }]}>
        <View style={s.grabber} />
        {row && (
          <ScrollView style={{ maxHeight: height * 0.68 }} contentContainerStyle={{ paddingBottom: S.md }}>
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

            <View style={s.h2Row}>
              <Text style={s.h2}>Where the time went</Text>
              <Text style={s.h2Cols}>today · week</Text>
            </View>
            {!detail && <ActivityIndicator color={C.accent} style={{ marginTop: S.md }} />}
            {detail && (
              <>
                {detail.apps.filter((a) => a.week > 0 || a.today > 0).map((a) => (
                  <AppRow key={a.service} label={a.label} today={a.today} week={a.week} peak={peak} />
                ))}
                {detail.hidden_week > 0 && (
                  <AppRow
                    label="Hidden"
                    today={detail.hidden_today}
                    week={detail.hidden_week}
                    peak={peak}
                    muted
                  />
                )}
                {detail.apps.length === 0 && detail.hidden_week === 0 && (
                  <Text style={s.empty}>No activity recorded this week.</Text>
                )}
                <View style={s.totals}>
                  <Text style={s.totalsText}>
                    {duration(detail.today_total)} today · {duration(detail.week_total)} this week
                  </Text>
                </View>
              </>
            )}

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
              <>
                <Text style={s.h2}>Say something</Text>
                <TextInput
                  style={s.input}
                  placeholder={topLabel ? `Broo stop watching ${topLabel}` : 'Put the phone down'}
                  placeholderTextColor={C.faint}
                  value={note}
                  onChangeText={setNote}
                  maxLength={140}
                  multiline
                  onSubmitEditing={pull}
                  returnKeyType="send"
                />
                <Text style={s.hint}>Leave it blank and we'll send the usual nudge.</Text>
                <Pressable
                  style={({ pressed }) => [s.pull, busy && { opacity: 0.5 }, pressed && { opacity: 0.75 }]}
                  onPress={pull}
                  disabled={busy}
                >
                  <Text style={s.pullText}>Pull {row.name} out</Text>
                </Pressable>
              </>
            )}

            {!!msg && <Text style={s.msg}>{msg}</Text>}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

function AppRow({ label, today, week, peak, muted }: {
  label: string; today: number; week: number; peak: number; muted?: boolean;
}) {
  const pct = Math.max(2, Math.round((week / peak) * 100));
  return (
    <View style={s.appRow}>
      <View style={{ flex: 1 }}>
        <Text style={[s.appName, muted && { color: C.faint, fontStyle: 'italic' }]} numberOfLines={1}>
          {label}
        </Text>
        <View style={s.track}>
          <View style={[s.bar, { width: `${pct}%` }, muted && { backgroundColor: C.line }]} />
        </View>
      </View>
      <Text style={[s.appToday, today === 0 && { color: C.faint }]}>{duration(today)}</Text>
      <Text style={s.appWeek}>{duration(week)}</Text>
    </View>
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
  grabber: { width: 36, height: 5, borderRadius: R.full, backgroundColor: C.line, alignSelf: 'center', marginBottom: S.md },
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
  h2Row: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  h2: {
    ...T.footnote, fontWeight: '600', color: C.dim, textTransform: 'uppercase',
    letterSpacing: 0.6, marginTop: S.xl, marginBottom: S.sm,
  },
  h2Cols: { ...T.caption, color: C.faint, marginBottom: S.sm },
  appRow: { flexDirection: 'row', alignItems: 'center', gap: S.md, paddingVertical: S.sm },
  appName: { ...T.subhead, color: C.text },
  track: { height: 5, borderRadius: R.full, backgroundColor: C.card2, marginTop: 5, overflow: 'hidden' },
  bar: { height: 5, borderRadius: R.full, backgroundColor: C.accent },
  appToday: { ...T.subhead, color: C.text, width: 54, textAlign: 'right' },
  appWeek: { ...T.subhead, color: C.dim, width: 58, textAlign: 'right' },
  totals: {
    marginTop: S.md, paddingTop: S.md, borderTopWidth: HAIRLINE, borderTopColor: C.line,
  },
  totalsText: { ...T.footnote, color: C.faint, textAlign: 'right' },
  empty: { ...T.subhead, color: C.faint },
  input: {
    backgroundColor: C.card2, color: C.text, borderRadius: R.md, ...CONTINUOUS,
    paddingHorizontal: S.md + 2, paddingTop: S.md, paddingBottom: S.md, minHeight: MIN_TAP + 16,
    borderWidth: HAIRLINE, borderColor: C.line, ...T.body,
  },
  hint: { ...T.caption, color: C.faint, marginTop: S.sm },
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
    alignItems: 'center', justifyContent: 'center', marginTop: S.md,
  },
  pullText: { ...T.headline, color: '#fff' },
  msg: { ...T.subhead, color: C.drifting, marginTop: S.md, textAlign: 'center' },
});
