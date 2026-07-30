import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { DemoId } from './types';
import { DEMO_LABELS, DEMO_ORDER } from './types';
import { Demo01FanLayout } from './demos/Demo01FanLayout';
import { Demo02Selection } from './demos/Demo02Selection';
import { Demo03PlayTravel } from './demos/Demo03PlayTravel';
import { Demo04Landing } from './demos/Demo04Landing';
import { Demo05Transform } from './demos/Demo05Transform';
import { Demo06HandReposition } from './demos/Demo06HandReposition';
import { Demo07CompleteSequence } from './demos/Demo07CompleteSequence';
import { Demo08ReanimatedHandReposition } from './demos/Demo08ReanimatedHandReposition';
import { Demo09BatakHandTuning } from './demos/Demo09BatakHandTuning';
import { FeltBackground } from './components/FeltBackground';

function renderDemo(demo: DemoId): React.ReactElement {
  switch (demo) {
    case 'fan-layout':
      return <Demo01FanLayout />;
    case 'selection':
      return <Demo02Selection />;
    case 'play-travel':
      return <Demo03PlayTravel />;
    case 'landing':
      return <Demo04Landing />;
    case 'transform':
      return <Demo05Transform />;
    case 'hand-reposition':
      return <Demo06HandReposition />;
    case 'complete-sequence':
      return <Demo07CompleteSequence />;
    case 'reanimated-hand-reposition':
      return <Demo08ReanimatedHandReposition />;
    case 'batak-hand-tuning':
      return <Demo09BatakHandTuning />;
  }
}

export function AnimationPlaygroundScreen() {
  const [activeDemo, setActiveDemo] = useState<DemoId>('fan-layout');

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        style={styles.tabBar}
        contentContainerStyle={styles.tabBarContent}
        showsHorizontalScrollIndicator={false}>
        {DEMO_ORDER.map(demo => (
          <Pressable
            key={demo}
            testID={`demo-tab-${demo}`}
            onPress={() => setActiveDemo(demo)}
            style={[styles.tab, activeDemo === demo && styles.tabActive]}>
            <Text style={[styles.tabText, activeDemo === demo && styles.tabTextActive]}>
              {DEMO_LABELS[demo]}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      <View style={styles.demoArea}>
        <FeltBackground />
        {renderDemo(activeDemo)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b1d15' },
  tabBar: { flexGrow: 0, backgroundColor: '#1c2451' },
  tabBarContent: { paddingHorizontal: 8, paddingVertical: 6 },
  tab: { paddingHorizontal: 12, paddingVertical: 8, marginHorizontal: 4, borderRadius: 6 },
  tabActive: { backgroundColor: '#f4c542' },
  tabText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: '#1c2451' },
  demoArea: { flex: 1 },
});
