import React, { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';
import { useSession } from '@/hooks/useSession';

// La pantalla de carga se mantiene hasta que sabemos si hay sesión; así el
// usuario no ve un parpadeo del login antes de entrar a la app.
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <ErrorBoundary>
          <RootNavigator />
        </ErrorBoundary>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function RootNavigator() {
  const t = useTheme();
  const { session, loading } = useSession();
  const router = useRouter();
  const segments = useSegments();
  const [ready, setReady] = useState(false);

  const hideSplash = useCallback(async () => {
    await SplashScreen.hideAsync().catch(() => {});
    setReady(true);
  }, []);

  useEffect(() => {
    if (!loading) hideSplash();
  }, [loading, hideSplash]);

  useEffect(() => {
    if (loading) return;

    const group = segments[0];
    const inAuth = group === '(auth)';
    // Los textos legales deben poder leerse sin haber iniciado sesión: la
    // pantalla de registro enlaza a ellos antes de que exista la cuenta.
    const isPublic = inAuth || group === 'legal';

    if (!session && !isPublic) router.replace('/(auth)/welcome');
    else if (session && inAuth) router.replace('/(tabs)');
  }, [session, loading, segments, router]);

  if (loading || !ready) {
    return <View style={{ flex: 1, backgroundColor: t.colors.background }} />;
  }

  return (
    <>
      <StatusBar style={t.colors.statusBar === 'light' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: t.colors.background },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="(auth)" options={{ animation: 'fade' }} />
        <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
        <Stack.Screen name="parking" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="legal" options={{ presentation: 'modal' }} />
      </Stack>
    </>
  );
}
