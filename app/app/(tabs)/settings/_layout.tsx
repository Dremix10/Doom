// Settings is a stack inside its tab, so sub-pages push over it with the tab bar
// still showing and the iOS swipe-back gesture intact.
import { Stack } from 'expo-router';
import { C } from '../../../lib/theme';

export default function SettingsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg } }} />
  );
}
