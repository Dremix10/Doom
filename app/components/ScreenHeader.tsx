// Back row plus large title, used by every Settings sub-page. The app draws its
// own titles everywhere else, so a native nav bar here would look grafted on.
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from './Icon';
import { Palette, T, S, MIN_TAP, useColors, useStyles } from '../lib/theme';

export function ScreenHeader({ title, back = 'Settings' }: { title: string; back?: string }) {
  const insets = useSafeAreaInsets();
  const C = useColors();
  const s = useStyles(makeStyles);
  return (
    <View style={{ paddingTop: (insets.top || S.md) + S.sm }}>
      <Pressable
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/settings'))}
        hitSlop={8}
        style={({ pressed }) => [s.back, pressed && { opacity: 0.6 }]}
      >
        <View style={s.caret}>
          <Icon name="chevron" size={17} color={C.accent} />
        </View>
        <Text style={s.backText}>{back}</Text>
      </Pressable>
      <Text style={s.title}>{title}</Text>
    </View>
  );
}

const makeStyles = (C: Palette) => StyleSheet.create({
  back: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: MIN_TAP - 8, alignSelf: 'flex-start' },
  caret: { transform: [{ rotate: '180deg' }] },
  backText: { ...T.body, color: C.accent },
  title: { ...T.largeTitle, color: C.text, marginTop: S.xs, marginBottom: S.lg },
});
