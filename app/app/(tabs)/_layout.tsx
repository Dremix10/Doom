// The tab bar, at iOS proportions: a 49pt bar sitting on top of the home-indicator
// inset, hairline separator, SF-style filled icons that change colour rather than
// shape when selected.
import { Tabs } from 'expo-router';
import { ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, IconName } from '../../components/Icon';
import { T, HAIRLINE, TAB_BAR_HEIGHT, useColors } from '../../lib/theme';

const tab = (name: IconName) =>
  function TabIcon({ color }: { color: ColorValue }) {
    return <Icon name={name} color={color as string} size={26} />;
  };

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const C = useColors();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: C.card,
          borderTopWidth: HAIRLINE,
          borderTopColor: C.line,
          height: TAB_BAR_HEIGHT + insets.bottom,
          paddingBottom: insets.bottom,
          paddingTop: 5,
        },
        tabBarLabelStyle: { ...T.tabLabel, marginTop: 1 },
        tabBarItemStyle: { paddingTop: 2 },
        tabBarActiveTintColor: C.accent,
        tabBarInactiveTintColor: C.faint,
      }}
    >
      <Tabs.Screen name="leaderboard" options={{ title: 'Board', tabBarIcon: tab('chart') }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: tab('gear') }} />
    </Tabs>
  );
}
