import { Tabs } from 'expo-router';
import { Text, ColorValue } from 'react-native';
import { C } from '../../lib/theme';

function Icon({ label, color }: { label: string; color: ColorValue }) {
  return <Text style={{ fontSize: 20, color }}>{label}</Text>;
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: C.card, borderTopColor: C.line, height: 62, paddingBottom: 8, paddingTop: 6 },
        tabBarActiveTintColor: C.accent,
        tabBarInactiveTintColor: C.faint,
      }}
    >
      <Tabs.Screen name="you" options={{ title: 'You', tabBarIcon: ({ color }) => <Icon label="◎" color={color} /> }} />
      <Tabs.Screen name="friends" options={{ title: 'Friends', tabBarIcon: ({ color }) => <Icon label="♦" color={color} /> }} />
      <Tabs.Screen name="setup" options={{ title: 'Setup', tabBarIcon: ({ color }) => <Icon label="⚙" color={color} /> }} />
    </Tabs>
  );
}
