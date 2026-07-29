import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native';
import { RootNavigator } from './src/navigation/RootNavigator';
import { FONTS } from '@world-cards/ui';

SplashScreen.preventAutoHideAsync();

export default function App() {
  const [fontsLoaded, fontError] = useFonts(FONTS);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

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
      <StatusBar style="auto" />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
