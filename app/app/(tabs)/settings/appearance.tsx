// "Appearance": Light, Dark, or follow the phone. System is the iOS default and
// the one most people expect, so it leads.
import { ScrollView, StyleSheet, Text } from 'react-native';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { Row, Section } from '../../../components/SettingsList';
import { Palette, T, S, ThemeMode, useStyles, useTheme } from '../../../lib/theme';

const OPTIONS: { id: ThemeMode; label: string; detail: string }[] = [
  { id: 'system', label: 'System', detail: 'Follow your phone’s setting' },
  { id: 'light', label: 'Light', detail: 'Cream, like the logo’s wordmark' },
  { id: 'dark', label: 'Dark', detail: 'Near-black, like the logo’s ground' },
];

export default function Appearance() {
  const { mode, setMode, resolved } = useTheme();
  const s = useStyles(makeStyles);

  return (
    <ScrollView style={s.wrap} contentContainerStyle={{ paddingHorizontal: S.gutter, paddingBottom: S.xxl + S.md }}>
      <ScreenHeader title="Appearance" />

      <Section
        footer={
          mode === 'system'
            ? `Following your phone, which is currently ${resolved}.`
            : undefined
        }
      >
        {OPTIONS.map((o, i) => (
          <Row
            key={o.id}
            first={i === 0}
            label={o.label}
            value={mode === o.id ? '✓' : undefined}
            onPress={() => setMode(o.id)}
          />
        ))}
      </Section>

      <Text style={s.note}>
        Doom’s colours come from the logo either way: the cream wordmark and the orange clock
        wedge. Light swaps which one is the page and which is the ink.
      </Text>
    </ScrollView>
  );
}

const makeStyles = (C: Palette) => StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg },
  note: { ...T.footnote, color: C.faint, lineHeight: 18, marginTop: S.sm },
});
