import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';
import { AuthProvider, useAuth } from '../lib/auth';
import { ThemeProvider, useColors, useTheme } from '../lib/theme';

// Auth gating lives here so it holds for every route, not just "/". Without it,
// signing out from Settings left you on a blank screen: the token was cleared but
// nothing navigated. When a guard flips false expo-router redirects to the anchor
// (index), which sends you on to onboarding or the board depending on `me`.
function Gate() {
  const { me, loading } = useAuth();
  const C = useColors();
  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={C.accent} />
      </View>
    );
  }
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg } }}>
      <Stack.Screen name="index" />
      <Stack.Protected guard={!me}>
        <Stack.Screen name="onboarding" />
      </Stack.Protected>
      <Stack.Protected guard={!!me}>
        <Stack.Screen name="(tabs)" />
      </Stack.Protected>
    </Stack>
  );
}

function Themed() {
  const { colors } = useTheme();
  return (
    <AuthProvider>
      <StatusBar style={colors.barStyle} />
      <Gate />
    </AuthProvider>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <Themed />
    </ThemeProvider>
  );
}
