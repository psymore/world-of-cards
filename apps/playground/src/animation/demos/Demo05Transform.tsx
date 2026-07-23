import React, { useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { createDeck } from '@world-cards/engine';
import type { Card } from '@world-cards/engine';
import { SimpleCard, SIMPLE_CARD_HEIGHT } from '../components/SimpleCard';
import { computeFanSlot, computeFanWidth, FanLayoutConfig, FanSlot } from '../components/fanLayout';
import { useCardMotion } from '../engine/useCardMotion';
import { idleKeyframe } from '../types';
import { TRAVEL_DISTANCE, TRAVEL_DURATION_MS } from './Demo03PlayTravel';

const FULL_DECK = createDeck({ deckCount: 1, includeJokers: false });
const HAND_SIZE = 6;
const FAN_CONFIG: FanLayoutConfig = { overlap: 0.6, arcDegrees: 40, maxRotationDeg: 20, spacingPx: 40 };
const SELECT_LIFT_PX = 28;
const HOLD_MS = 700;
const RESET_DURATION_MS = 300;
const HAND_TOP_OFFSET = 30;
const RESTING_SCALE = 0.7;
const RESTING_GLYPH_SCALE = 0.75;

type CardStage = 'idle' | 'selected' | 'traveling' | 'holding';

function TransformDemoCard({ card, slot }: { card: Card; slot: FanSlot }) {
  const [stage, setStage] = useState<CardStage>('idle');
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const motion = useCardMotion({
    initial: idleKeyframe({ rotateDeg: slot.rotateDeg }),
    defaultDurationMs: 200,
    defaultEasing: Easing.out(Easing.cubic),
  });

  function handlePress() {
    // See Demo03PlayTravel.tsx's identical guard — without this, a tap during
    // 'traveling'/'holding' permanently freezes the card (found by task review).
    if (stage === 'traveling' || stage === 'holding') return;
    if (resetTimer.current) {
      clearTimeout(resetTimer.current);
      resetTimer.current = null;
    }
    if (stage === 'idle') {
      setStage('selected');
      motion.retarget(idleKeyframe({ rotateDeg: slot.rotateDeg, y: -SELECT_LIFT_PX }));
      return;
    }
    if (stage === 'selected') {
      setStage('traveling');
      // Same travel as Demo 03/04, but the destination keyframe also shrinks scale
      // and glyphScale together with position/rotation — still one timeline, no
      // separate post-arrival "settle" step (Demo 05's own requirement).
      motion.retarget(
        idleKeyframe({
          rotateDeg: slot.rotateDeg,
          x: -slot.x,
          y: -(SELECT_LIFT_PX + TRAVEL_DISTANCE),
          scale: RESTING_SCALE,
          glyphScale: RESTING_GLYPH_SCALE,
        }),
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
      testID={`demo05-card-${card.id}`}
      onPress={handlePress}
      style={[styles.cardSlot, { left: slot.x, top: HAND_TOP_OFFSET + slot.y }]}>
      <Animated.View style={{ transform: motion.transform }}>
        <SimpleCard card={card} glyphStyle={{ transform: [{ scale: motion.glyphScale }] }} />
      </Animated.View>
    </Pressable>
  );
}

// Demo 05: extends Demo 03/04's travel with a scale-down (card + glyph together) to
// the resting trick-card size — still one timeline, per "Scale must not begin after
// translation ends."
export function Demo05Transform() {
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
          <TransformDemoCard key={card.id} card={card} slot={computeFanSlot(i, cards.length, FAN_CONFIG)} />
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
