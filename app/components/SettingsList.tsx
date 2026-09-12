// The grouped-list building blocks Settings is made of: a labelled section, and
// rows that show their own state on the right so you can read the whole screen
// without opening anything.
import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from './Icon';
import { Palette, T, S, R, CONTINUOUS, HAIRLINE, MIN_TAP, useColors, useStyles } from '../lib/theme';

export function Section({ title, children, footer }: {
  title?: string; children: ReactNode; footer?: string;
}) {
  const s = useStyles(makeStyles);
  return (
    <View style={s.section}>
      {!!title && <Text style={s.sectionTitle}>{title}</Text>}
      <View style={s.card}>{children}</View>
      {!!footer && <Text style={s.footer}>{footer}</Text>}
    </View>
  );
}

export function Row({ label, value, onPress, first, destructive, disabled }: {
  label: string;
  value?: string;
  onPress?: () => void;
  first?: boolean;
  destructive?: boolean;
  disabled?: boolean;
}) {
  const C = useColors();
  const s = useStyles(makeStyles);
  const body = (
    <>
      <Text style={[s.label, destructive && { color: C.problem }, disabled && { color: C.faint }]}>
        {label}
      </Text>
      {!!value && <Text style={s.value} numberOfLines={1}>{value}</Text>}
      {!!onPress && !destructive && <Icon name="chevron" size={15} color={C.faint} />}
    </>
  );
  if (!onPress) return <View style={[s.row, !first && s.divided]}>{body}</View>;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [s.row, !first && s.divided, pressed && { backgroundColor: C.card2 }]}
    >
      {body}
    </Pressable>
  );
}

const makeStyles = (C: Palette) => StyleSheet.create({
  section: { marginBottom: S.xl },
  sectionTitle: {
    ...T.footnote, fontWeight: '600', color: C.dim, textTransform: 'uppercase',
    letterSpacing: 0.6, marginBottom: S.sm, marginLeft: S.xs,
  },
  card: {
    backgroundColor: C.card, borderRadius: R.lg, ...CONTINUOUS,
    borderWidth: HAIRLINE, borderColor: C.line, overflow: 'hidden',
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: S.md,
    paddingHorizontal: S.lg, minHeight: MIN_TAP + 6,
  },
  divided: { borderTopWidth: HAIRLINE, borderTopColor: C.line },
  label: { ...T.body, color: C.text, flex: 1 },
  value: { ...T.body, color: C.faint, maxWidth: '52%', textAlign: 'right' },
  footer: { ...T.caption, color: C.faint, marginTop: S.sm, marginLeft: S.xs, lineHeight: 17 },
});
