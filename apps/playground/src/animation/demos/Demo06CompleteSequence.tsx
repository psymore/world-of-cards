import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Card } from '@world-cards/engine';
import { SimpleCard, SIMPLE_CARD_HEIGHT, SIMPLE_CARD_WIDTH } from '../components/SimpleCard';
import { computeFanSlot, computeFanWidth, FanLayoutConfig, FanSlot } from '../components/fanLayout';
import { useCardMotion } from '../engine/useCardMotion';
import { idleKeyframe } from '../types';
import { SEAT_COUNT, useDealLoop } from '../state/useDealLoop';

const FAN_CONFIG: FanLayoutConfig = { overlap: 0.6, arcDegrees: 40, maxRotationDeg: 20, spacingPx: 40 };
const SELECT_LIFT_PX = 28;
const TRAVEL_DISTANCE = 260;
const TRAVEL_DURATION_MS = 450;
const TRICK_HOLD_MS = 1100;
const RESTING_SCALE = 0.7;
const RESTING_GLYPH_SCALE = 0.75;
const AI_THINK_DELAY_MS = 900;
const HAND_TOP_OFFSET = 30;
const HUMAN_SEAT = 0;

// Fixed offset each non-human seat's card travels FROM, relative to its own resting
// trick-slot position (see TrickCard) — deliberately not measured from a rendered
// opponent hand, since opponents are represented only by a card-count label here
// (this demo's animation focus is the travel itself, not opponent hand visuals).
const SEAT_ORIGIN_OFFSET: Record<number, { x: number; y: number }> = {
  0: { x: 0, y: SELECT_LIFT_PX + TRAVEL_DISTANCE }, // human — overridden per-play, see below
  1: { x: 220, y: 0 }, // right
  2: { x: 0, y: -180 }, // top
  3: { x: -220, y: 0 }, // left
};

// Small stagger per seat so 4 resting trick cards don't perfectly overlap.
const TRICK_SLOT_OFFSET: Record<number, { x: number; y: number }> = {
  0: { x: 0, y: 20 },
  1: { x: 20, y: 0 },
  2: { x: 0, y: -20 },
  3: { x: -20, y: 0 },
};

type HumanStage = 'idle' | 'selected';

function TrickCard({
  card,
  seat,
  originOffset,
}: {
  card: Card;
  seat: number;
  originOffset: { x: number; y: number };
}) {
  const motion = useCardMotion({
    initial: idleKeyframe({ x: originOffset.x, y: originOffset.y }),
    defaultDurationMs: TRAVEL_DURATION_MS,
    defaultEasing: Easing.out(Easing.cubic),
  });
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    // Animates from its origin offset down to {0,0,scale:RESTING_SCALE,...} — its
    // own resting position, laid out via TRICK_SLOT_OFFSET below.
    motion.retarget(idleKeyframe({ scale: RESTING_SCALE, glyphScale: RESTING_GLYPH_SCALE }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const slotOffset = TRICK_SLOT_OFFSET[seat] ?? { x: 0, y: 0 };
  // The per-seat stagger is applied via `transform`, not by overriding left/top —
  // styles.trickSlot's left/top: '50%' (plus its negative margins) is what centers
  // this card in trickArea in the first place; setting left/top here directly would
  // clobber that centering instead of composing with it (RN merges array styles by
  // later-key-wins, it doesn't add them).
  return (
    <View
      style={[
        styles.trickSlot,
        { transform: [{ translateX: slotOffset.x }, { translateY: slotOffset.y }] },
      ]}>
      <Animated.View style={{ transform: motion.transform }}>
        <SimpleCard card={card} glyphStyle={{ transform: [{ scale: motion.glyphScale }] }} />
      </Animated.View>
    </View>
  );
}

function HumanHandCard({
  card,
  slot,
  isTurn,
  onPlay,
}: {
  card: Card;
  slot: FanSlot;
  isTurn: boolean;
  onPlay: (originOffset: { x: number; y: number }) => void;
}) {
  const [stage, setStage] = useState<HumanStage>('idle');
  const motion = useCardMotion({
    initial: idleKeyframe({ rotateDeg: slot.rotateDeg }),
    defaultDurationMs: 200,
    defaultEasing: Easing.out(Easing.cubic),
  });

  function handlePress() {
    if (!isTurn) return;
    if (stage === 'idle') {
      setStage('selected');
      motion.retarget(idleKeyframe({ rotateDeg: slot.rotateDeg, y: -SELECT_LIFT_PX }));
      return;
    }
    // Captures this card's exact current lifted position as the trick card's origin
    // offset (converging horizontally to the hand's own left edge, same convention
    // as Demo 03) — the human's own play uses its real position, not a generic
    // per-seat constant, unlike the other 3 seats (see SEAT_ORIGIN_OFFSET above).
    onPlay({ x: -slot.x, y: -(SELECT_LIFT_PX + TRAVEL_DISTANCE) });
  }

  return (
    <Pressable
      testID={`demo06-human-card-${card.id}`}
      onPress={handlePress}
      style={[styles.cardSlot, { left: slot.x, top: HAND_TOP_OFFSET + slot.y }]}>
      <Animated.View style={{ transform: motion.transform }}>
        <SimpleCard card={card} />
      </Animated.View>
    </Pressable>
  );
}

// Demo 06: everything from Demos 01-05 combined, driven by useDealLoop's continuous
// 4-seat turn cycle. Only the human seat (0) is tap-interactive; seats 1-3 auto-play
// their first card after a short delay once it's their turn.
export function Demo06CompleteSequence() {
  const { seats, turnSeat, currentTrick, playCard, clearTrick } = useDealLoop();
  const humanOriginsRef = useRef<Map<string, { x: number; y: number }>>(new Map());

  // Auto-play for AI seats (1-3): plays the first card in hand shortly after it
  // becomes that seat's turn. No legality constraint exists in this playground (no
  // trump, no suit-following), so "auto-play" just means "play the first card."
  useEffect(() => {
    if (turnSeat === HUMAN_SEAT) return;
    const hand = seats[turnSeat];
    if (hand.length === 0) return;
    const timer = setTimeout(() => {
      playCard(turnSeat, hand[0].id);
    }, AI_THINK_DELAY_MS);
    return () => clearTimeout(timer);
  }, [turnSeat, seats, playCard]);

  // Once all 4 seats have played into the current trick, hold briefly (matching
  // this repo's existing "trick completing" pause convention) then clear.
  useEffect(() => {
    if (currentTrick.length < 4) return;
    const timer = setTimeout(() => {
      humanOriginsRef.current.clear();
      clearTrick();
    }, TRICK_HOLD_MS);
    return () => clearTimeout(timer);
  }, [currentTrick, clearTrick]);

  const humanHand = seats[HUMAN_SEAT];
  const totalWidth = computeFanWidth(humanHand.length, FAN_CONFIG);
  // turnSeat advances immediately on each play, so after the 4th (last) card of a
  // trick lands, turnSeat has already wrapped back around to HUMAN_SEAT even though
  // currentTrick is still sitting there mid-hold, waiting for the TRICK_HOLD_MS
  // pause above to clear it. Without the currentTrick.length check, the human could
  // tap and play a 5th card into that same not-yet-cleared trick during the hold
  // window.
  const isHumanTurn = turnSeat === HUMAN_SEAT && currentTrick.length < SEAT_COUNT;

  return (
    <View style={styles.container}>
      <View style={styles.opponentRow}>
        {[2, 1, 3].map(seat => (
          <Text key={seat} style={styles.opponentLabel}>
            Seat {seat}: {seats[seat].length} cards {turnSeat === seat ? '(thinking...)' : ''}
          </Text>
        ))}
      </View>
      <View style={[styles.trickArea, { width: SIMPLE_CARD_WIDTH + 80, height: SIMPLE_CARD_HEIGHT + 80 }]}>
        {currentTrick.map(({ seat, card }) => (
          <TrickCard
            key={card.id}
            card={card}
            seat={seat}
            originOffset={
              seat === HUMAN_SEAT
                ? humanOriginsRef.current.get(card.id) ?? SEAT_ORIGIN_OFFSET[HUMAN_SEAT]
                : SEAT_ORIGIN_OFFSET[seat]
            }
          />
        ))}
      </View>
      <View style={[styles.hand, { width: totalWidth, height: SIMPLE_CARD_HEIGHT + HAND_TOP_OFFSET + 40 }]}>
        {humanHand.map((card, i) => (
          <HumanHandCard
            key={card.id}
            card={card}
            slot={computeFanSlot(i, humanHand.length, FAN_CONFIG)}
            isTurn={isHumanTurn}
            onPlay={originOffset => {
              humanOriginsRef.current.set(card.id, originOffset);
              playCard(HUMAN_SEAT, card.id);
            }}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'space-between', paddingVertical: 12 },
  opponentRow: { flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 12 },
  opponentLabel: { color: '#fff', fontSize: 12 },
  trickArea: { alignSelf: 'center', position: 'relative' },
  trickSlot: { position: 'absolute', left: '50%', top: '50%', marginLeft: -SIMPLE_CARD_WIDTH / 2, marginTop: -SIMPLE_CARD_HEIGHT / 2 },
  hand: { alignSelf: 'center', position: 'relative' },
  cardSlot: { position: 'absolute' },
});
