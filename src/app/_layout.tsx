import { DMSans_400Regular } from '@expo-google-fonts/dm-sans/400Regular';
import { DMSans_500Medium } from '@expo-google-fonts/dm-sans/500Medium';
import { DMSans_700Bold } from '@expo-google-fonts/dm-sans/700Bold';
import { Fraunces_400Regular } from '@expo-google-fonts/fraunces/400Regular';
import { Fraunces_400Regular_Italic } from '@expo-google-fonts/fraunces/400Regular_Italic';
import { Fraunces_600SemiBold } from '@expo-google-fonts/fraunces/600SemiBold';
import { useFonts } from 'expo-font';
import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { ErrorState, Skeleton } from '@/components/ui/Feedback';
import { StoreProvider, useStore } from '@/data/store';
import { color, font, space } from '@/theme/tokens';

SplashScreen.preventAutoHideAsync();

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: color.accent,
    background: color.bg,
    card: color.bg,
    text: color.text,
    border: color.line,
    notification: color.accent,
  },
};

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Fraunces_400Regular,
    Fraunces_400Regular_Italic,
    Fraunces_600SemiBold,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
  });
  const ready = fontsLoaded || !!fontError;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <ThemeProvider value={navTheme}>
      <StoreProvider>
        <StatusBar style="light" />
        <DataGate>
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: color.bg },
              headerTintColor: color.text,
              headerTitleStyle: { fontFamily: font.bodyBold },
              headerShadowVisible: false,
              contentStyle: { backgroundColor: color.bg },
            }}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false, animation: 'fade' }} />
            <Stack.Screen name="regret" options={{ presentation: 'modal', title: 'Peşman olacam?' }} />
            <Stack.Screen name="persona" options={{ title: 'Gələcəkdəki sən' }} />
            <Stack.Screen name="letters/new" options={{ presentation: 'modal', title: 'Yeni məktub' }} />
            <Stack.Screen name="letters/[id]" options={{ title: '' }} />
            <Stack.Screen name="goals/new" options={{ presentation: 'modal', title: 'Yeni hədəf' }} />
            <Stack.Screen name="missions/new" options={{ presentation: 'modal', title: 'Yeni missiya' }} />
            <Stack.Screen name="focus" options={{ presentation: 'fullScreenModal', headerShown: false }} />
            <Stack.Screen name="court" options={{ title: 'Gələcək Məhkəməsi' }} />
          </Stack>
        </DataGate>
      </StoreProvider>
    </ThemeProvider>
  );
}

/** Holds the app on a skeleton until the first load finishes, so screens can assume data. */
function DataGate({ children }: { children: ReactNode }) {
  const { status, error, reload } = useStore();
  if (status === 'ready') return children;
  if (status === 'error') {
    return (
      <View style={styles.gate}>
        <ErrorState message={error ?? 'Məlumatlar yüklənmədi.'} onRetry={reload} />
      </View>
    );
  }
  return (
    <View style={styles.gate} accessibilityLabel="Yüklənir" accessibilityRole="progressbar">
      <Skeleton height={14} width="40%" />
      <Skeleton height={36} width="70%" />
      <Skeleton height={160} />
      <Skeleton height={56} />
      <Skeleton height={56} />
    </View>
  );
}

const styles = StyleSheet.create({
  gate: { flex: 1, backgroundColor: color.bg, padding: space.lg, paddingTop: 96, gap: space.lg },
});
