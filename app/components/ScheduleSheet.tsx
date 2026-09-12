// "Scheduled": write a message now, and let the agent choose when it lands.
//
// Deliberately not a time picker — the user doesn't pick the moment, the agent
// does, so the copy has to say plainly what will happen or people will go looking
// for a clock.
import { useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../lib/api';
import { Palette, T, S, R, CONTINUOUS, HAIRLINE, MIN_TAP, useColors, useStyles } from '../lib/theme';

type Props = {
  visible: boolean;
  name: string;
  targetId: string;
  topService?: string | null;
  onClose: () => void;
};

export function ScheduleSheet({ visible, name, targetId, topService, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const C = useColors();
  const s = useStyles(makeStyles);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState('');
  const [err, setErr] = useState('');

  const close = () => { setText(''); setDone(''); setErr(''); onClose(); };

  const queue = async () => {
    if (!text.trim() || busy) return;
    setBusy(true); setErr('');
    try {
      await api.queueMessage(targetId, text.trim());
      setDone(`Saved. Doom will send it to ${name} at the right moment.`);
      setText('');
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <Pressable style={s.backdrop} onPress={close} />
      <KeyboardAvoidingView style={s.dock} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[s.sheet, { paddingBottom: insets.bottom + S.xl }]}>
          <View style={s.grabber} />
          <Text style={s.title}>Scheduled message</Text>
          <Text style={s.body}>
            Doom sends this the next time {name} is doomscrolling — or when their usual worst
            stretch of the day comes round, whichever happens first. It won't arrive on top of
            another nudge, and it expires after a week if the moment never comes.
          </Text>

          <TextInput
            style={s.input}
            placeholder={topService ? `Broo, ${topService} again?` : 'Say something that will land'}
            placeholderTextColor={C.faint}
            value={text}
            onChangeText={setText}
            maxLength={280}
            multiline
          />
          {!!err && <Text style={s.err}>{err}</Text>}
          {!!done && <Text style={s.done}>{done}</Text>}

          <View style={s.actions}>
            <Pressable style={({ pressed }) => [s.secondary, pressed && { opacity: 0.7 }]} onPress={close}>
              <Text style={s.secondaryText}>{done ? 'Done' : 'Cancel'}</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [s.primary, (!text.trim() || busy) && { opacity: 0.5 }, pressed && { opacity: 0.75 }]}
              onPress={queue}
              disabled={busy || !text.trim()}
            >
              {busy ? <ActivityIndicator color={C.onAccent} /> : <Text style={s.primaryText}>Schedule it</Text>}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
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
  title: { ...T.title2, color: C.text },
  body: { ...T.subhead, color: C.dim, lineHeight: 21, marginTop: S.sm, marginBottom: S.lg },
  input: {
    backgroundColor: C.card2, color: C.text, borderRadius: R.lg, ...CONTINUOUS,
    paddingHorizontal: S.lg, paddingTop: S.md, paddingBottom: S.md, minHeight: MIN_TAP + 34,
    borderWidth: HAIRLINE, borderColor: C.line, ...T.body,
  },
  err: { ...T.footnote, color: C.problem, marginTop: S.sm },
  done: { ...T.footnote, color: C.fine, marginTop: S.sm },
  actions: { flexDirection: 'row', gap: S.sm + 2, marginTop: S.lg },
  secondary: {
    flex: 1, backgroundColor: C.card2, borderRadius: R.md, ...CONTINUOUS,
    minHeight: MIN_TAP, alignItems: 'center', justifyContent: 'center',
  },
  secondaryText: { ...T.headline, color: C.text },
  primary: {
    flex: 2, backgroundColor: C.accent, borderRadius: R.md, ...CONTINUOUS,
    minHeight: MIN_TAP, alignItems: 'center', justifyContent: 'center',
  },
  primaryText: { ...T.headline, color: C.onAccent },
});
