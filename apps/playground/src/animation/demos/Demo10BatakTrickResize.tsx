import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { PlayingCard, CARD_DIMS } from '@world-cards/ui';
import { createDeck, createRng, shuffle } from '@world-cards/engine';
import { LabeledSlider } from '../components/LabeledSlider';

// Starting point: the real CARD_DIMS ratio (small.width / normal.width ≈ 0.745) for the outer
// scale, and a contentScale that lands the corner index at real "small"'s own proportion
// (CORNER_INDEX_WIDTH.small / CORNER_INDEX_WIDTH.normal ≈ 0.679) once composed with that outer
// scale: 0.679 / 0.745 ≈ 0.91. Both are first-pass numbers — tune live via the sliders below;
// they're the two values this whole demo exists to let you replace with real, eyeballed numbers.
const INITIAL_SCALE = 0.75;
const INITIAL_CONTENT_SCALE = 0.91;

// Mirrors TrickCenter.tsx's own TRICK_SLOT_OFFSETS, recomputed locally rather than imported
// (apps/playground never imports from apps/mobile) — proportioned the same relative way (small
// enough that adjacent slots' cards overlap slightly at their inner corners).
const CROSS_OFFSETS = [
  { label: 'top', x: 0, y: -38 },
  { label: 'left', x: -30, y: 0 },
  { label: 'bottom', x: 0, y: 38 },
  { label: 'right', x: 30, y: 0 },
];

export function Demo10BatakTrickResize() {
  const [scale, setScale] = useState(INITIAL_SCALE);
  const [contentScale, setContentScale] = useState(INITIAL_CONTENT_SCALE);

  const [seed] = useState(() => Date.now());
  const sampleCards = useMemo(
    () => shuffle(createDeck({ deckCount: 1, includeJokers: false }), createRng(seed)).slice(0, 4),
    [seed],
  );

  const trickCardWidth = CARD_DIMS.normal.width * scale;
  const trickCardHeight = CARD_DIMS.normal.height * scale;

  return (
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
      <View style={styles.container}>
        <View style={styles.compareRow}>
          <View style={styles.compareColumn}>
            <Text style={styles.label}>In-hand (reference)</Text>
            <PlayingCard card={sampleCards[0]} size="normal" />
          </View>
          <View style={styles.compareColumn}>
            <Text style={styles.label}>Trick center (tuned)</Text>
            <View style={{ transform: [{ scale }] }}>
              <PlayingCard card={sampleCards[0]} size="normal" contentScale={contentScale} />
            </View>
          </View>
        </View>

        <Text style={styles.label}>Trick cross preview (4 tuned cards, overlapping)</Text>
        <View style={[styles.crossWrapper, { width: trickCardWidth + 80, height: trickCardHeight + 80 }]}>
          {CROSS_OFFSETS.map((slot, i) => (
            <View
              key={slot.label}
              style={[
                styles.crossSlot,
                {
                  width: trickCardWidth,
                  height: trickCardHeight,
                  marginLeft: -trickCardWidth / 2,
                  marginTop: -trickCardHeight / 2,
                  zIndex: i + 1,
                  transform: [{ translateX: slot.x * scale }, { translateY: slot.y * scale }],
                },
              ]}>
              <View style={{ transform: [{ scale }] }}>
                <PlayingCard card={sampleCards[i]} size="normal" contentScale={contentScale} />
              </View>
            </View>
          ))}
        </View>

        <View style={styles.sliders}>
          <LabeledSlider
            label="Trick card scale"
            testID="control-trick-scale"
            minimumValue={0.4}
            maximumValue={1}
            step={0.01}
            value={scale}
            onChange={setScale}
          />
          <LabeledSlider
            label="Content scale (corner index / watermark)"
            testID="control-content-scale"
            minimumValue={0.5}
            maximumValue={1.2}
            step={0.01}
            value={contentScale}
            onChange={setContentScale}
          />
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  container: { flexGrow: 1, alignItems: 'center', paddingTop: 20, gap: 16 },
  compareRow: { flexDirection: 'row', gap: 32, alignItems: 'flex-end' },
  compareColumn: { alignItems: 'center', gap: 8 },
  label: { color: '#ffffffcc', fontSize: 13 },
  crossWrapper: { position: 'relative', alignSelf: 'center' },
  crossSlot: { position: 'absolute', left: '50%', top: '50%', alignItems: 'center', justifyContent: 'center' },
  sliders: { alignSelf: 'stretch', paddingTop: 8 },
});
