import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { createDeck } from '@world-of-cards/engine';
import { Hand } from '../components/Hand';
import { LabeledSlider } from '../components/LabeledSlider';
import { SIMPLE_CARD_WIDTH } from '../components/SimpleCard';

const FULL_DECK = createDeck({ deckCount: 1, includeJokers: false });

// Demo 01: pure layout, no taps, no animation — see ANIMATION_ARCHITECTURE.md's
// "Demo 01 / Fan Layout" section.
export function Demo01FanLayout() {
  const [handSize, setHandSize] = useState(13);
  const [overlap, setOverlap] = useState(0.6);
  const [arcDegrees, setArcDegrees] = useState(40);
  const [maxRotationDeg, setMaxRotationDeg] = useState(20);
  const [spacingPx, setSpacingPx] = useState(SIMPLE_CARD_WIDTH * 0.6);

  const cards = useMemo(() => FULL_DECK.slice(0, handSize), [handSize]);

  return (
    <View style={styles.container}>
      <View style={styles.handArea}>
        <Hand
          cards={cards}
          overlap={overlap}
          arcDegrees={arcDegrees}
          maxRotationDeg={maxRotationDeg}
          spacingPx={spacingPx}
        />
      </View>
      <ScrollView style={styles.controls} contentContainerStyle={styles.controlsContent}>
        <LabeledSlider
          label="Hand size"
          testID="control-hand-size"
          minimumValue={1}
          maximumValue={13}
          step={1}
          value={handSize}
          onChange={v => setHandSize(Math.round(v))}
        />
        <LabeledSlider
          label="Overlap"
          testID="control-overlap"
          minimumValue={0}
          maximumValue={0.9}
          step={0.01}
          value={overlap}
          onChange={setOverlap}
        />
        <LabeledSlider
          label="Arc degrees"
          testID="control-arc"
          minimumValue={0}
          maximumValue={90}
          step={1}
          value={arcDegrees}
          onChange={setArcDegrees}
        />
        <LabeledSlider
          label="Max rotation"
          testID="control-max-rotation"
          minimumValue={0}
          maximumValue={45}
          step={1}
          value={maxRotationDeg}
          onChange={setMaxRotationDeg}
        />
        <LabeledSlider
          label="Spacing"
          testID="control-spacing"
          minimumValue={SIMPLE_CARD_WIDTH * 0.2}
          maximumValue={SIMPLE_CARD_WIDTH}
          step={1}
          value={spacingPx}
          onChange={setSpacingPx}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  handArea: { height: 220, alignItems: 'center', justifyContent: 'flex-start' },
  controls: { flex: 1, backgroundColor: '#00000066' },
  controlsContent: { paddingVertical: 12 },
});
