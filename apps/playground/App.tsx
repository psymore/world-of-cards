import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FONTS } from '@world-cards/ui';
import { PlaygroundScreen } from './src/PlaygroundScreen';
import { AnimationPlaygroundScreen } from './src/animation/AnimationPlaygroundScreen';

SplashScreen.preventAutoHideAsync();

type Mode = 'design' | 'animation';

export default function App() {
  const [fontsLoaded, fontError] = useFonts(FONTS);
  const [mode, setMode] = useState<Mode>('design');

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <View style={styles.root}>
      {/* Fixed 44px top padding approximates the status bar height without pulling in
          react-native-safe-area-context (a dependency this dev-tool app doesn't otherwise
          need) — acceptable for a dev tool, not pixel-perfect on every device. */}
      <View style={styles.modeBar}>
        <Pressable
          testID="mode-tab-design"
          onPress={() => setMode('design')}
          style={[styles.modeTab, mode === 'design' && styles.modeTabActive]}>
          <Text style={[styles.modeTabText, mode === 'design' && styles.modeTabTextActive]}>
            Design
          </Text>
        </Pressable>
        <Pressable
          testID="mode-tab-animation"
          onPress={() => setMode('animation')}
          style={[styles.modeTab, mode === 'animation' && styles.modeTabActive]}>
          <Text style={[styles.modeTabText, mode === 'animation' && styles.modeTabTextActive]}>
            Animation
          </Text>
        </Pressable>
      </View>
      {mode === 'design' ? <PlaygroundScreen /> : <AnimationPlaygroundScreen />}
      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  modeBar: {
    flexDirection: 'row',
    backgroundColor: '#111',
    paddingTop: 44,
    paddingBottom: 8,
    justifyContent: 'center',
    gap: 8,
  },
  modeTab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 6, backgroundColor: '#333' },
  modeTabActive: { backgroundColor: '#f4c542' },
  modeTabText: { color: '#fff', fontWeight: '600' },
  modeTabTextActive: { color: '#111' },
});
