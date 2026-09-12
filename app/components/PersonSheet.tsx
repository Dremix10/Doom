// Tap a row on the board to get here. Everyone's sheet shows where their time
// went — per app, today and over the last week. Your own adds the agent's
// decision log; anyone else's gets a compose bar.
//
// The compose bar is pinned rather than sitting at the end of the content: the
// breakdown runs to sixteen apps, which put the message box a whole sheet-height
// below the fold, and you almost always open a friend's sheet to say something
// rather than to browse. The list is also trimmed to the apps that matter, with
// the tail behind a "show all" — sixteen rows of one-minute entries isn't insight.
//
// Apps a person has hidden arrive as a single "Hidden" row. The minutes are still
// in their total and their rank — only the app name is withheld.
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, useWindowDimensions, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, Breakdown, Decision, LeaderboardRow } from '../lib/api';
import {
  Palette, T, S, R, CONTINUOUS, HAIRLINE, MIN_TAP, stateColor, stateWord, useColors, useStyles,
} from '../lib/theme';

const TOP_APPS = 5;

const actionMeta = (C: Palette): Record<string, { label: string; color: string }> => ({
  quiet: { label: 'stayed quiet', color: C.faint },
  nudge: { label: 'nudged you', color: C.drifting },
  escalate: { label: 'asked a friend', color: C.problem },
  interrupt: { label: 'paused the app', color: C.problem },
});

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
  const C = useColors();
  const s = useStyles(makeStyles);
  const [timeline, setTimeline] = useState<Decision[] | null>(null);
  const [detail, setDetail] = useState<Breakdown | null>(null);
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [showAll, setShowAll] = useState(false);

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
    setMsg(''); setNote(''); setTimeline(null); setDetail(null); setShowAll(false);
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

  const used = useMemo(
    () => (detail?.apps ?? []).filter((a) => a.week > 0 || a.today > 0),
    [detail],
  );
  const visible = showAll ? used : used.slice(0, TOP_APPS);
  const peak = Math.max(1, ...used.map((a) => a.week), detail?.hidden_week ?? 0);
  const topLabel = used[0]?.label;

  return (
    <Modal visible={!!row} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose} />
      <KeyboardAvoidingView
        style={s.dock}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[s.sheet, { paddingBottom: insets.bottom + S.md }]}>
          <View style={s.grabber} />
          {row && (
            <>
              <Text style={s.name}>{isMe ? 'You' : row.name}</Text>
              <View style={s.stateRow}>
                <View style={[s.dot, { backgroundColor: stateColor(C, row.state) }]} />
                <Text style={[s.state, { color: stateColor(C, row.state) }]}>{stateWord(row.state)}</Text>
                <Text style={s.summary} numberOfLines={1}>
                  · {duration(row.minutes)}
                  {row.ratio > 0 ? ` · ${row.ratio.toFixed(1)}× usual` : ''} · #{row.rank}
                </Text>
              </View>

              <ScrollView
                style={{ maxHeight: height * (isMe ? 0.56 : 0.44) }}
                contentContainerStyle={{ paddingBottom: S.md }}
                keyboardShouldPersistTaps="handled"
              >
                <View style={s.h2Row}>
                  <Text style={s.h2}>Where the time went</Text>
                  <Text style={s.h2Cols}>today · week</Text>
                </View>
                {!detail && <ActivityIndicator color={C.accent} style={{ marginTop: S.md }} />}
                {detail && (
                  <>
                    {visible.map((a) => (
                      <AppRow key={a.service} label={a.label} today={a.today} week={a.week} peak={peak} />
                    ))}
                    {detail.hidden_week > 0 && (
                      <AppRow label="Hidden" today={detail.hidden_today} week={detail.hidden_week} peak={peak} muted />
                    )}
                    {used.length > TOP_APPS && (
                      <Pressable
                        onPress={() => setShowAll((v) => !v)}
                        style={({ pressed }) => [s.moreRow, pressed && { opacity: 0.6 }]}
                      >
                        <Text style={s.moreText}>
                          {showAll ? 'Show less' : `Show all ${used.length} apps`}
                        </Text>
                      </Pressable>
                    )}
                    {used.length === 0 && detail.hidden_week === 0 && (
                      <Text style={s.empty}>No activity recorded this week.</Text>
                    )}
                    <View style={s.totals}>
                      <Text style={s.totalsText}>
                        {duration(detail.today_total)} today · {duration(detail.week_total)} this week
                      </Text>
                    </View>
                  </>
                )}

                {isMe && (
                  <>
                    <Text style={s.h2}>What the agent has been doing</Text>
                    {timeline === null && <ActivityIndicator color={C.accent} style={{ marginTop: S.md }} />}
                    {timeline?.length === 0 && (
                      <Text style={s.empty}>No decisions yet. Open a feed app and watch this fill in.</Text>
                    )}
                    {timeline?.slice(0, 12).map((d) => {
                      const meta = actionMeta(C);
                      const m = meta[d.action] || meta.quiet;
                      return (
                        <View key={d.id} style={s.logRow}>
                          <View style={[s.logDot, { backgroundColor: m.color }]} />
                          <View style={{ flex: 1 }}>
                            <Text style={s.logAction}>
                              <Text style={{ color: m.color, fontWeight: '600' }}>{m.label}</Text>
                              {d.service ? <Text style={s.logSvc}>  · {d.service}</Text> : null}
                              {d.source === 'gemini' ? <Text style={s.gemini}>  · Gemini</Text> : null}
                              {d.source === 'claude' ? <Text style={s.gemini}>  · Claude</Text> : null}
                            </Text>
                            <Text style={s.logWhy}>{d.justification}</Text>
                            <Text style={s.logAgo}>{ago(d.created_at)}</Text>
                          </View>
                        </View>
                      );
                    })}
                  </>
                )}
              </ScrollView>

              {!!msg && <Text style={s.msg}>{msg}</Text>}

              {/* Pinned: the reason you opened this sheet shouldn't be below the fold. */}
              {!isMe && (
                <View style={s.compose}>
                  <TextInput
                    style={s.input}
                    placeholder={topLabel ? `Broo stop watching ${topLabel}` : 'Put the phone down'}
                    placeholderTextColor={C.faint}
                    value={note}
                    onChangeText={setNote}
                    maxLength={140}
                    onSubmitEditing={pull}
                    returnKeyType="send"
                  />
                  <Pressable
                    style={({ pressed }) => [s.pull, busy && { opacity: 0.5 }, pressed && { opacity: 0.75 }]}
                    onPress={pull}
                    disabled={busy}
                  >
                    <Text style={s.pullText}>Pull out</Text>
                  </Pressable>
                </View>
              )}
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function AppRow({ label, today, week, peak, muted }: {
  label: string; today: number; week: number; peak: number; muted?: boolean;
}) {
  const C = useColors();
  const s = useStyles(makeStyles);
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

const makeStyles = (C: Palette) => StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)' },
  dock: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  sheet: {
    backgroundColor: C.card, borderTopLeftRadius: 22, borderTopRightRadius: 22, ...CONTINUOUS,
    paddingHorizontal: S.gutter, paddingTop: S.sm,
    borderTopWidth: HAIRLINE, borderColor: C.line,
    ...Platform.select({ web: { maxWidth: 560, marginHorizontal: 'auto' as any }, default: {} }),
  },
  grabber: { width: 36, height: 5, borderRadius: R.full, backgroundColor: C.line, alignSelf: 'center', marginBottom: S.md },
  name: { ...T.title1, color: C.text },
  stateRow: { flexDirection: 'row', alignItems: 'baseline', gap: S.sm, marginTop: S.xs },
  dot: { width: 9, height: 9, borderRadius: R.full },
  state: { ...T.subhead, fontWeight: '600' },
  summary: { ...T.subhead, color: C.dim, flexShrink: 1 },
  h2Row: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  h2: {
    ...T.footnote, fontWeight: '600', color: C.dim, textTransform: 'uppercase',
    letterSpacing: 0.6, marginTop: S.lg, marginBottom: S.sm,
  },
  h2Cols: { ...T.caption, color: C.faint, marginBottom: S.sm },
  appRow: { flexDirection: 'row', alignItems: 'center', gap: S.md, paddingVertical: S.sm },
  appName: { ...T.subhead, color: C.text },
  track: { height: 5, borderRadius: R.full, backgroundColor: C.card2, marginTop: 5, overflow: 'hidden' },
  bar: { height: 5, borderRadius: R.full, backgroundColor: C.accent },
  appToday: { ...T.subhead, color: C.text, width: 54, textAlign: 'right' },
  appWeek: { ...T.subhead, color: C.dim, width: 58, textAlign: 'right' },
  moreRow: { minHeight: MIN_TAP - 8, justifyContent: 'center' },
  moreText: { ...T.subhead, color: C.accent, fontWeight: '600' },
  totals: { marginTop: S.sm, paddingTop: S.sm, borderTopWidth: HAIRLINE, borderTopColor: C.line },
  totalsText: { ...T.footnote, color: C.faint, textAlign: 'right' },
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
  msg: { ...T.footnote, color: C.drifting, marginTop: S.sm, textAlign: 'center' },
  compose: {
    flexDirection: 'row', alignItems: 'center', gap: S.sm,
    marginTop: S.md, paddingTop: S.md,
    borderTopWidth: HAIRLINE, borderTopColor: C.line,
  },
  input: {
    flex: 1, backgroundColor: C.card2, color: C.text, borderRadius: R.full,
    paddingHorizontal: S.lg, minHeight: MIN_TAP, borderWidth: HAIRLINE, borderColor: C.line,
    ...T.subhead,
  },
  pull: {
    backgroundColor: C.problem, borderRadius: R.full,
    paddingHorizontal: S.lg, minHeight: MIN_TAP, alignItems: 'center', justifyContent: 'center',
  },
  pullText: { ...T.subhead, color: '#fff', fontWeight: '700' },
});
