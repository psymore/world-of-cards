import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationBar } from 'expo-navigation-bar';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AppState, Platform, StyleSheet } from 'react-native';
import { RootNavigator } from './src/navigation/RootNavigator';
import { FONTS } from '@world-cards/ui';

SplashScreen.preventAutoHideAsync();

// setHidden's TS signature is `void`, but the native side is promise-based underneath, and
// on a real device it can reject with "The current activity is no longer available" if called
// while the Activity is still mid-transition from the splash screen (observed on a physical
// Xiaomi device — never surfaced on the emulator, where the timing didn't race). Harmless to
// ignore: the app.json plugin's native cold-launch style already covers the moment this races
// against, and the AppState listener re-asserts it again once the Activity has settled.
function hideNavigationBar() {
  Promise.resolve(NavigationBar.setHidden(true)).catch(() => {});
}

export default function App() {
  const [fontsLoaded, fontError] = useFonts(FONTS);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  // Android only (NavigationBar.setHidden warns and no-ops on iOS/web) — the app.json
  // expo-navigation-bar plugin already starts the system nav bar hidden at cold launch (native
  // style, applied before JS runs, so there's no flash of it appearing first); this call covers
  // the cases the native style alone doesn't: Android can re-show the bar when the app resumes
  // from the background, which this re-asserts against via the AppState listener.
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    hideNavigationBar();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') hideNavigationBar();
    });
    return () => subscription.remove();
  }, []);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    // Required by react-native-gesture-handler as the single outermost view for its
    // recognizers to work anywhere in the tree — added for the ADR-002 migration
    // (docs/animation/ADR/ADR-002-reanimated-migration-apps-mobile.md). Mirrors
    // apps/playground/App.tsx's existing wrapper.
    <GestureHandlerRootView style={styles.root}>
      <RootNavigator />
      <StatusBar style="light" />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
