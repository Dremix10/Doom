// Settings is a stack inside its tab, so sub-pages push over it with the tab bar
// still showing and the iOS swipe-back gesture intact.
import { Stack } from 'expo-router';
import { useColors } from '../../../lib/theme';

export default function SettingsLayout() {
  const C = useColors();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg } }} />
  );
}
