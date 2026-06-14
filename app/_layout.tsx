import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { View, ActivityIndicator, Text, Pressable, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import './global.css';
import { database } from '../services/database';

export default function RootLayout() {
  const [isDbReady, setIsDbReady] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  const [fontsLoaded] = useFonts({
    Syne: require('../assets/fonts/Syne-Bold.ttf'),
    'Syne-ExtraBold': require('../assets/fonts/Syne-ExtraBold.ttf'),
    'DM Sans': require('../assets/fonts/DMSans-Regular.ttf'),
    'DM Mono': require('../assets/fonts/DMMono-Regular.ttf'),
    'DM Mono Medium': require('../assets/fonts/DMMono-Medium.ttf'),
  });

  const initDb = () => {
    setIsDbReady(false);
    setDbError(null);
    database
      .init()
      .then(() => {
        console.log('[RootLayout] Database ready');
        setIsDbReady(true);
      })
      .catch((error) => {
        console.error('[RootLayout] Database init failed:', error);
        setDbError(error instanceof Error ? error.message : 'Database initialization failed');
      });
  };

  useEffect(() => {
    initDb();
  }, []);

  if (dbError) {
    return (
      <View style={styles.errorContainer}>
        <StatusBar style="light" backgroundColor="#0A0A0F" translucent={false} />
        <Text style={styles.errorTitle}>Initialization Error</Text>
        <Text style={styles.errorMessage}>{dbError}</Text>
        <Pressable style={styles.retryButton} onPress={initDb}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  if (!isDbReady || !fontsLoaded) {
    return (
      <View style={styles.splash}>
        <StatusBar style="light" backgroundColor="#0A0A0F" translucent={false} />
        <ActivityIndicator size="large" color="#4F8EF7" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <StatusBar style="light" backgroundColor="#0A0A0F" translucent={false} />
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: '#0A0A0F' },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="focus/[taskId]" options={{ headerShown: false }} />
        <Stack.Screen name="new" options={{ headerShown: false, animation: 'slide_from_right' }} />
        <Stack.Screen name="sync-center" options={{ headerShown: false, animation: 'slide_from_right' }} />
        <Stack.Screen name="knowledge" options={{ headerShown: false, animation: 'slide_from_right' }} />
        <Stack.Screen name="oauth/notion" options={{ headerShown: false }} />
      </Stack>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  splash: {
    flex: 1,
    backgroundColor: '#0A0A0F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorContainer: {
    flex: 1,
    backgroundColor: '#0A0A0F',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  errorTitle: {
    fontFamily: 'Syne',
    fontSize: 18,
    fontWeight: '700',
    color: '#E8E8F0',
  },
  errorMessage: {
    fontSize: 13,
    color: '#FF6B6B',
    textAlign: 'center',
    lineHeight: 18,
  },
  retryButton: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#3B7BF5',
  },
  retryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
