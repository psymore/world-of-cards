import React, { useMemo, useRef, useState } from 'react';
import { Animated, Easing, EasingFunction, Pressable, StyleSheet, Text, View } from 'react-native';
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

type EasingPresetId = 'linear' | 'easeOutCubic' | 'easeOutQuart' | 'easeOutBack';

const EASING_PRESETS: Record<EasingPresetId, { label: string; easing: EasingFunction }> = {
  linear: { label: 'Linear (no easing)', easing: Easing.linear },
  easeOutCubic: { label: 'Ease Out Cubic', easing: Easing.out(Easing.cubic) },
  easeOutQuart: { label: 'Ease Out Quart', easing: Easing.out(Easing.poly(4)) },
  easeOutBack: { label: 'Ease Out Back (overshoot)', easing: Easing.out(Easing.back(1.5)) },
};

type CardStage = 'idle' | 'selected' | 'traveling' | 'holding';

function LandingDemoCard({
  card,
  slot,
  easing,
}: {
  card: Card;
  slot: FanSlot;
  easing: EasingFunction;
}) {
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
      motion.retarget(
        idleKeyframe({ rotateDeg: slot.rotateDeg, x: -slot.x, y: -(SELECT_LIFT_PX + TRAVEL_DISTANCE) }),
        { durationMs: TRAVEL_DURATION_MS, easing },
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
      testID={`demo04-card-${card.id}`}
      onPress={handlePress}
      style={[styles.cardSlot, { left: slot.x, top: HAND_TOP_OFFSET + slot.y }]}>
      <Animated.View style={{ transform: motion.transform }}>
        <SimpleCard card={card} />
      </Animated.View>
    </Pressable>
  );
}

// Demo 04: identical mechanic to Demo 03, with the easing curve exposed as a live
// picker so landing quality (soft deceleration, no visible stop) can be A/B'd.
export function Demo04Landing() {
  const cards = useMemo(() => FULL_DECK.slice(0, HAND_SIZE), []);
  const totalWidth = computeFanWidth(cards.length, FAN_CONFIG);
  const [presetId, setPresetId] = useState<EasingPresetId>('easeOutCubic');

  return (
    <View style={styles.container}>
      <View style={styles.presetRow}>
        {(Object.keys(EASING_PRESETS) as EasingPresetId[]).map(id => (
          <Pressable
            key={id}
            testID={`easing-preset-${id}`}
            onPress={() => setPresetId(id)}
            style={[styles.presetButton, presetId === id && styles.presetButtonActive]}>
            <Text style={styles.presetButtonText}>{EASING_PRESETS[id].label}</Text>
          </Pressable>
        ))}
      </View>
      <View
        style={[
          styles.hand,
          { width: totalWidth, height: SIMPLE_CARD_HEIGHT + HAND_TOP_OFFSET + TRAVEL_DISTANCE + 60 },
        ]}>
        {cards.map((card, i) => (
          <LandingDemoCard
            key={card.id}
            card={card}
            slot={computeFanSlot(i, cards.length, FAN_CONFIG)}
            easing={EASING_PRESETS[presetId].easing}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginBottom: 12 },
  presetButton: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, backgroundColor: '#333' },
  presetButtonActive: { backgroundColor: '#f4c542' },
  presetButtonText: { color: '#fff', fontSize: 12 },
  hand: { position: 'relative' },
  cardSlot: { position: 'absolute' },
});
