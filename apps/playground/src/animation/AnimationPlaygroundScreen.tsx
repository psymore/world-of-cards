import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { DemoId } from './types';
import { DEMO_LABELS, DEMO_ORDER } from './types';
import { Demo01FanLayout } from './demos/Demo01FanLayout';
import { Demo02Selection } from './demos/Demo02Selection';
import { Demo03PlayTravel } from './demos/Demo03PlayTravel';
import { Demo04Landing } from './demos/Demo04Landing';
import { Demo05Transform } from './demos/Demo05Transform';

// Each placeholder below is replaced by its real demo component in a later task
// (Demo 1 in Task 3, Demo 2 in Task 4, ... Demo 6 in Task 8) — see
// docs/superpowers/plans/2026-07-23-animation-playground.md.
function PlaceholderDemo({ label }: { label: string }) {
  return (
    <View style={styles.placeholder}>
      <Text style={styles.placeholderText}>{label} — not implemented yet</Text>
    </View>
  );
}

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
    default:
      return <PlaceholderDemo label={DEMO_LABELS[demo]} />;
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
      <View style={styles.demoArea}>{renderDemo(activeDemo)}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b6623' },
  tabBar: { flexGrow: 0, backgroundColor: '#1c2451' },
  tabBarContent: { paddingHorizontal: 8, paddingVertical: 6 },
  tab: { paddingHorizontal: 12, paddingVertical: 8, marginHorizontal: 4, borderRadius: 6 },
  tabActive: { backgroundColor: '#f4c542' },
  tabText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: '#1c2451' },
  demoArea: { flex: 1 },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  placeholderText: { color: '#fff', fontSize: 16 },
});
