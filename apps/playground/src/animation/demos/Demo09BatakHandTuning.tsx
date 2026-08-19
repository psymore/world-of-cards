import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View, Pressable, Text } from 'react-native';
import { PlayingCard, CARD_DIMS } from '@world-of-cards/ui';
import { createDeck, createRng, shuffle } from '@world-of-cards/engine';
import type { Card } from '@world-of-cards/engine';
import { FanLayoutConfig } from '../components/fanLayout';
import { RAIL_RADIUS, railAngleStepDeg, railAngles, railPosition } from '../components/railFanLayout';
import { FanConfigControls } from '../components/FanConfigControls';
import { LabeledSlider } from '../components/LabeledSlider';

const CARD_WIDTH = CARD_DIMS.normal.width;
const CARD_HEIGHT = CARD_DIMS.normal.height;

// Provisional starting point — scaled up from Demo08's own RAIL_RADIUS=230 to account for a
// real PlayingCard being wider than the playground's SimpleCard it was originally tuned
// against (94px vs 64px) — tune this live via the Radius slider below; it's the first of the
// values this whole demo exists to let you replace with a real number.
const INITIAL_RAIL_RADIUS = 330;

const DEFAULT_FAN_CONFIG: FanLayoutConfig = {
  overlap: 0.55,
  arcDegrees: 40,
  maxRotationDeg: 18,
  spacingPx: CARD_WIDTH * 0.5,
};

// Standard Batak's steady-state max (13 cards) vs. gömmeli's compact mode (up to 20 mid-kitty-
// exchange) — see HumanHandFan.tsx's own GOMELI_* constants for the production numbers this
// toggle is meant to help you replace.
const HAND_SIZES = [13, 16, 20, 8, 4] as const;

export function Demo09BatakHandTuning() {
  const [radius, setRadius] = useState(INITIAL_RAIL_RADIUS);
  const [overlap, setOverlap] = useState(DEFAULT_FAN_CONFIG.overlap);
  const [arcDegrees, setArcDegrees] = useState(DEFAULT_FAN_CONFIG.arcDegrees);
  const [maxRotationDeg, setMaxRotationDeg] = useState(DEFAULT_FAN_CONFIG.maxRotationDeg);
  const [spacingPx, setSpacingPx] = useState(DEFAULT_FAN_CONFIG.spacingPx);
  const [rowOverlapPx, setRowOverlapPx] = useState(Math.round(CARD_HEIGHT * 0.25));
  const [handSizeIndex, setHandSizeIndex] = useState(0);
  const [compact, setCompact] = useState(false);

  const handSize = HAND_SIZES[handSizeIndex];
  const fanConfig: FanLayoutConfig = useMemo(
    () => ({ overlap, arcDegrees, maxRotationDeg, spacingPx }),
    [overlap, arcDegrees, maxRotationDeg, spacingPx],
  );

  const [seed] = useState(() => Date.now());
  const fullDeck = useMemo(
    () => shuffle(createDeck({ deckCount: 1, includeJokers: false }), createRng(seed)),
    [seed],
  );
  const [removedCount, setRemovedCount] = useState(0);
  const cards = useMemo(
    () => fullDeck.slice(0, Math.max(0, handSize - removedCount)),
    [fullDeck, handSize, removedCount],
  );

  const topCount = Math.ceil(cards.length / 2);
  const topRow = cards.slice(0, topCount);
  const bottomRow = cards.slice(topCount);

  function angleStepFor(rowLength: number) {
    // railAngleStepDeg takes a FanLayoutConfig + a reference hand size; reuse the same formula
    // per row, referenced against that row's own current length (mirrors railAngleStepDeg's own
    // "reference size" role — Demo08 uses the whole hand's size since it's one row; here each
    // row is its own independent rail, so its own length is the right reference).
    return railAngleStepDeg(fanConfig, Math.max(rowLength, 1));
  }

  function renderRow(row: Card[], pivotYOffset: number) {
    const angleStepDeg = angleStepFor(row.length);
    const angles = railAngles(row.length, angleStepDeg, maxRotationDeg);
    // The "Radius" slider is meant to tune the fan's actual curvature (the geometric radius
    // cards ride along), not just push the whole row up/down — so it has to reach
    // railPosition's own radius math, which only railFanLayout.ts's RAIL_RADIUS constant
    // otherwise drives. railPosition's extraRadius param moves a point radially outward from
    // the fixed pivot at (0, RAIL_RADIUS); passing the SAME extraRadius for every card in the
    // row is equivalent to re-centering the whole row on a circle of radius `radius` instead
    // of RAIL_RADIUS, still anchored at that same pivot — exactly "change the radius," not an
    // ad hoc offset. At angle 0 (the row's own center card) this shifts pos.y by exactly
    // -extraRadius, so `top` adds back +extraRadius to cancel it — the center card always
    // lands at `pivotYOffset` regardless of the slider value (this is what keeps the row from
    // flying off-screen at any point in the slider's range), while every other card's own
    // droop/spread still scales with the chosen radius, so the slider visibly reshapes the
    // curve.
    const extraRadius = radius - RAIL_RADIUS;
    return row.map((card, i) => {
      const pos = railPosition(angles[i], extraRadius);
      return (
        <View
          key={card.id}
          style={{
            position: 'absolute',
            left: '50%',
            top: pivotYOffset + extraRadius,
            marginLeft: -CARD_WIDTH / 2 + pos.x,
            transform: [{ translateY: pos.y }, { rotate: `${pos.rotateDeg}deg` }],
          }}>
          <PlayingCard card={card} size="normal" />
        </View>
      );
    });
  }

  return (
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
      <View style={styles.container}>
        <View style={styles.modeRow}>
          {HAND_SIZES.map((size, i) => (
            <Pressable
              key={size}
              testID={`demo09-handsize-${size}`}
              onPress={() => {
                setHandSizeIndex(i);
                setRemovedCount(0);
              }}
              style={[styles.modeButton, handSizeIndex === i && styles.modeButtonActive]}>
              <Text style={styles.modeButtonText}>{size} cards</Text>
            </Pressable>
          ))}
          <Pressable
            testID="demo09-compact-toggle"
            onPress={() => setCompact(c => !c)}
            style={[styles.modeButton, compact && styles.modeButtonActive]}>
            <Text style={styles.modeButtonText}>{compact ? 'Compact: on' : 'Compact: off'}</Text>
          </Pressable>
          <Pressable
            testID="demo09-remove-card"
            onPress={() => setRemovedCount(n => Math.min(n + 1, cards.length))}
            style={styles.modeButton}>
            <Text style={styles.modeButtonText}>Remove a card</Text>
          </Pressable>
        </View>
        <View style={[styles.handWrapper, { height: CARD_HEIGHT * 2 }]}>
          {renderRow(topRow, 0)}
          {renderRow(bottomRow, CARD_HEIGHT - rowOverlapPx)}
        </View>
        <View style={styles.extraSliders}>
          <LabeledSlider
            label="Radius"
            testID="control-radius"
            minimumValue={100}
            maximumValue={600}
            step={1}
            value={radius}
            onChange={setRadius}
          />
          <LabeledSlider
            label="Row overlap (px)"
            testID="control-row-overlap"
            minimumValue={0}
            maximumValue={CARD_HEIGHT}
            step={1}
            value={rowOverlapPx}
            onChange={value => setRowOverlapPx(Math.round(value))}
          />
        </View>
        <FanConfigControls
          overlap={overlap}
          onOverlapChange={setOverlap}
          arcDegrees={arcDegrees}
          onArcDegreesChange={setArcDegrees}
          maxRotationDeg={maxRotationDeg}
          onMaxRotationDegChange={setMaxRotationDeg}
          spacingPx={spacingPx}
          onSpacingPxChange={setSpacingPx}
          cardWidth={CARD_WIDTH}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  container: { flexGrow: 1, alignItems: 'center', paddingTop: 20 },
  modeRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginBottom: 16, gap: 8 },
  modeButton: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ffffff55',
  },
  modeButtonActive: { backgroundColor: '#ffffff22', borderColor: '#fff' },
  modeButtonText: { color: '#ffffffcc', fontSize: 13 },
  handWrapper: { position: 'relative', alignSelf: 'stretch' },
  extraSliders: { alignSelf: 'stretch', paddingTop: 8 },
});
