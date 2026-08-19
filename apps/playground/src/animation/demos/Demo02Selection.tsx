import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { createDeck } from '@world-of-cards/engine';
import type { Card } from '@world-of-cards/engine';
import { SimpleCard, SIMPLE_CARD_HEIGHT } from '../components/SimpleCard';
import { computeFanSlot, computeFanWidth, FanLayoutConfig, FanSlot } from '../components/fanLayout';
import { FanConfigControls } from '../components/FanConfigControls';
import { useCardMotion } from '../engine/useCardMotion';
import { idleKeyframe } from '../types';

const FULL_DECK = createDeck({ deckCount: 1, includeJokers: false });
const DEFAULT_HAND_SIZE = 8;
const DEFAULT_FAN_CONFIG: FanLayoutConfig = { overlap: 0.6, arcDegrees: 40, maxRotationDeg: 20, spacingPx: 40 };
const SELECT_LIFT_PX = 28;
// Mirrors apps/mobile/src/components/SelectableCard.tsx's own asymmetry: selecting
// snaps instantly (a player tapping a different card right away shouldn't see a
// mid-flight lift on the new one), while deselecting eases out for polish since
// there's no such urgency — see that file's doc comment for the full rationale.
const SELECT_SNAP_DURATION_MS = 0;
const DESELECT_DURATION_MS = 150;
const HAND_TOP_OFFSET = 30;

function SelectableDemoCard({
  card,
  slot,
  selected,
  onSelect,
}: {
  card: Card;
  slot: FanSlot;
  selected: boolean;
  onSelect: (cardId: string) => void;
}) {
  const motion = useCardMotion({
    initial: idleKeyframe({ rotateDeg: slot.rotateDeg }),
    defaultDurationMs: DESELECT_DURATION_MS,
    defaultEasing: Easing.out(Easing.cubic),
  });
  // Skips the redundant retarget-to-self on first mount (selected starts false for
  // every card, matching the initial keyframe already at rest).
  const wasSelected = useRef(selected);

  useEffect(() => {
    if (wasSelected.current === selected) return;
    wasSelected.current = selected;
    // Rotation is carried over unchanged in both keyframes — only y (the lift)
    // differs — satisfying Demo 02's "Rotation must remain unchanged" requirement.
    motion.retarget(
      idleKeyframe({ rotateDeg: slot.rotateDeg, y: selected ? -SELECT_LIFT_PX : 0 }),
      { durationMs: selected ? SELECT_SNAP_DURATION_MS : DESELECT_DURATION_MS },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  return (
    <Pressable
      testID={`demo02-card-${card.id}`}
      onPress={() => onSelect(card.id)}
      style={[styles.cardSlot, { left: slot.x, top: HAND_TOP_OFFSET + slot.y }]}>
      <Animated.View style={{ transform: motion.transform }}>
        <SimpleCard card={card} />
      </Animated.View>
    </Pressable>
  );
}

// Demo 02: tap-to-select lift, one card selected at a time (matches
// useCardSelection's real-game single-selection rule) — tapping a different card
// switches directly: the old card eases back down while the new one snaps up, and
// tapping the already-selected card deselects it. Previously each card tracked its
// own independent `selected` boolean, so switching cards left the old one stuck
// lifted (never rejoining the fan) instead of dropping — this shared selectedCardId
// is what makes exactly one card lifted at a time, always.
export function Demo02Selection() {
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [handSize, setHandSize] = useState(DEFAULT_HAND_SIZE);
  const [overlap, setOverlap] = useState(DEFAULT_FAN_CONFIG.overlap);
  const [arcDegrees, setArcDegrees] = useState(DEFAULT_FAN_CONFIG.arcDegrees);
  const [maxRotationDeg, setMaxRotationDeg] = useState(DEFAULT_FAN_CONFIG.maxRotationDeg);
  const [spacingPx, setSpacingPx] = useState(DEFAULT_FAN_CONFIG.spacingPx);
  const fanConfig: FanLayoutConfig = useMemo(
    () => ({ overlap, arcDegrees, maxRotationDeg, spacingPx }),
    [overlap, arcDegrees, maxRotationDeg, spacingPx],
  );

  const cards = useMemo(() => FULL_DECK.slice(0, handSize), [handSize]);
  const totalWidth = computeFanWidth(cards.length, fanConfig);

  const handleSelect = useCallback((cardId: string) => {
    setSelectedCardId(current => (current === cardId ? null : cardId));
  }, []);

  return (
    // Wrapped in a ScrollView: the hand area plus the controls panel below it can
    // together be taller than the screen (especially once TRAVEL_DISTANCE-reserving
    // demos are involved) — without this, RN has no way to make room for content
    // that doesn't fit and either clips it or squeezes a flexed sibling toward zero
    // height, which is what made the controls panel appear to "disappear."
    <ScrollView contentContainerStyle={styles.scrollContent}>
      {/* Mirrors apps/mobile/src/components/DeselectableSurface.tsx: wrapping the
          content in a Pressable clears selection on any tap that isn't already
          claimed by a more specific Pressable (a card's own onPress fires first via
          RN's normal touch-responder negotiation) — proven safe in both BatakTable
          and PistiTable, and still fires normally for a plain tap inside a
          ScrollView (only an actual drag/scroll gesture would suppress it). */}
      <Pressable style={styles.container} onPress={() => setSelectedCardId(null)}>
        <View style={[styles.hand, { width: totalWidth, height: SIMPLE_CARD_HEIGHT + HAND_TOP_OFFSET + 40 }]}>
          {cards.map((card, i) => (
            <SelectableDemoCard
              key={card.id}
              card={card}
              slot={computeFanSlot(i, cards.length, fanConfig)}
              selected={selectedCardId === card.id}
              onSelect={handleSelect}
            />
          ))}
        </View>
        <FanConfigControls
          handSize={handSize}
          onHandSizeChange={setHandSize}
          overlap={overlap}
          onOverlapChange={setOverlap}
          arcDegrees={arcDegrees}
          onArcDegreesChange={setArcDegrees}
          maxRotationDeg={maxRotationDeg}
          onMaxRotationDegChange={setMaxRotationDeg}
          spacingPx={spacingPx}
          onSpacingPxChange={setSpacingPx}
        />
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: { flexGrow: 1 },
  container: { flexGrow: 1, alignItems: 'center' },
  hand: { position: 'relative' },
  cardSlot: { position: 'absolute' },
});
