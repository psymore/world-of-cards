import React, { useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { createDeck } from '@world-cards/engine';
import type { Card } from '@world-cards/engine';
import { SimpleCard, SIMPLE_CARD_HEIGHT } from '../components/SimpleCard';
import { computeFanSlot, computeFanWidth, FanLayoutConfig, FanSlot } from '../components/fanLayout';
import { useCardMotion } from '../engine/useCardMotion';
import { idleKeyframe } from '../types';

const FULL_DECK = createDeck({ deckCount: 1, includeJokers: false });
const HAND_SIZE = 6;
const FAN_CONFIG: FanLayoutConfig = { overlap: 0.6, arcDegrees: 40, maxRotationDeg: 20, spacingPx: 40 };
const SELECT_LIFT_PX = 28;
const SELECT_DURATION_MS = 200;
export const TRAVEL_DISTANCE = 260;
export const TRAVEL_DURATION_MS = 450;
const HOLD_MS = 700;
const RESET_DURATION_MS = 300;
const HAND_TOP_OFFSET = 30;

type CardStage = 'idle' | 'selected' | 'traveling' | 'holding';

function PlayableDemoCard({ card, slot }: { card: Card; slot: FanSlot }) {
  const [stage, setStage] = useState<CardStage>('idle');
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const motion = useCardMotion({
    initial: idleKeyframe({ rotateDeg: slot.rotateDeg }),
    defaultDurationMs: SELECT_DURATION_MS,
    defaultEasing: Easing.out(Easing.cubic),
  });

  function handlePress() {
    if (resetTimer.current) {
      clearTimeout(resetTimer.current);
      resetTimer.current = null;
    }
    if (stage === 'idle') {
      setStage('selected');
      // Rotation held fixed — only y changes.
      motion.retarget(idleKeyframe({ rotateDeg: slot.rotateDeg, y: -SELECT_LIFT_PX }));
      return;
    }
    if (stage === 'selected') {
      setStage('traveling');
      // Destination: converge horizontally to the hand's own left edge (x: -slot.x
      // cancels this card's own base x offset) and travel up past the lift — begins
      // exactly from the current lifted position (getCurrentKeyframe(), inside
      // retarget), not from the original layout, per "Preserve Spatial Continuity."
      // Rotation is still the same slot.rotateDeg as every prior keyframe — held
      // fixed for the whole flight, per the doc's Rotation Rules.
      motion.retarget(
        idleKeyframe({ rotateDeg: slot.rotateDeg, x: -slot.x, y: -(SELECT_LIFT_PX + TRAVEL_DISTANCE) }),
        { durationMs: TRAVEL_DURATION_MS, easing: Easing.out(Easing.cubic) },
      );
      resetTimer.current = setTimeout(() => {
        setStage('holding');
        resetTimer.current = setTimeout(() => {
          setStage('idle');
          motion.retarget(idleKeyframe({ rotateDeg: slot.rotateDeg }), { durationMs: RESET_DURATION_MS });
        }, HOLD_MS);
      }, TRAVEL_DURATION_MS);
    }
  }

  return (
    <Pressable
      testID={`demo03-card-${card.id}`}
      onPress={handlePress}
      style={[styles.cardSlot, { left: slot.x, top: HAND_TOP_OFFSET + slot.y }]}>
      <Animated.View style={{ transform: motion.transform }}>
        <SimpleCard card={card} />
      </Animated.View>
    </Pressable>
  );
}

// Demo 03: first tap selects (Demo 02's motion), second tap plays — travels toward
// a shared table point, then holds briefly and resets so the demo can be replayed.
export function Demo03PlayTravel() {
  const cards = useMemo(() => FULL_DECK.slice(0, HAND_SIZE), []);
  const totalWidth = computeFanWidth(cards.length, FAN_CONFIG);

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.hand,
          { width: totalWidth, height: SIMPLE_CARD_HEIGHT + HAND_TOP_OFFSET + TRAVEL_DISTANCE + 60 },
        ]}>
        {cards.map((card, i) => (
          <PlayableDemoCard key={card.id} card={card} slot={computeFanSlot(i, cards.length, FAN_CONFIG)} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  hand: { position: 'relative' },
  cardSlot: { position: 'absolute' },
});
