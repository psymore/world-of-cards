import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { CARD_DIMS, PlayingCard } from '@world-of-cards/ui';
import { revealOriginOffset } from './seating';
import type { RevealOrigin } from './seating';

export interface DealFlightSeat {
  // Direction this seat's cards fly toward (the same directional vectors play-travel animations
  // fly *from* — see ../table/seating's revealOriginOffset).
  origin: RevealOrigin;
  cardCount: number;
}

export interface DealFlightOverlayProps {
  // Seats in deal order (human first, then opponents in turn order) — see useDealSequence for
  // the total duration this is tuned to fit inside.
  seats: DealFlightSeat[];
  // Pişti-only (opt-in, defaults to false so Batak's identical shuffle/cut replacement usage of
  // this same overlay stays untouched): renders a small stacked deck on the screen's left, and
  // flies cards from its position instead of the table's dead center, so the deal reads as coming
  // from a real deck rather than materializing out of nothing.
  showDeckStack?: boolean;
}

const BLOCK_MS = 340;
const BLOCK_GAP_MS = 60;
const CARD_FLIGHT_MS = 220;
const MIN_CARD_STAGGER_MS = 15;

// Where the deck sits, in the same origin-relative coordinate space as REVEAL_ORIGIN_OFFSETS
// (seating.ts) — left of center, slightly below the left seat's own offset (x:-165, y:0) so the
// two don't visually collide.
const DECK_STACK_OFFSET = { x: -130, y: 40 };
const DECK_STACK_CARD_COUNT = 5;
// Tiny per-card nudge so the stack reads as a real pile of cards, not one flat sprite.
const DECK_STACK_CARD_STEP = { x: 1, y: -1 };
const DECK_STACK_FADE_MS = 200;

interface FlightCard {
  key: string;
  origin: RevealOrigin;
  delay: number;
}

function buildFlightCards(seats: DealFlightSeat[]): FlightCard[] {
  const cards: FlightCard[] = [];
  seats.forEach((seat, seatIndex) => {
    const blockStart = seatIndex * (BLOCK_MS + BLOCK_GAP_MS);
    const stagger = seat.cardCount > 1 ? Math.max(BLOCK_MS / seat.cardCount, MIN_CARD_STAGGER_MS) : 0;
    for (let i = 0; i < seat.cardCount; i += 1) {
      cards.push({
        key: `${seatIndex}-${i}`,
        origin: seat.origin,
        delay: blockStart + i * stagger,
      });
    }
  });
  return cards;
}

function FlyingCard({
  origin,
  delay,
  from,
}: {
  origin: RevealOrigin;
  delay: number;
  // Travel start point — the table's dead center ({x:0, y:0}, matching this overlay's own
  // centered View) unless showDeckStack supplies the deck's own position instead.
  from: { x: number; y: number };
}) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: CARD_FLIGHT_MS,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }).start();
  }, []);

  const target = revealOriginOffset(origin);

  return (
    <Animated.View
      style={[
        styles.card,
        {
          opacity: progress.interpolate({ inputRange: [0, 0.15, 0.85, 1], outputRange: [0, 1, 1, 0] }),
          transform: [
            { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [from.x, target.x] }) },
            { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [from.y, target.y] }) },
          ],
        },
      ]}>
      <PlayingCard faceDown size="small" />
    </Animated.View>
  );
}

// A small, static stacked-deck sprite at DECK_STACK_OFFSET — reuses the same faceDown PlayingCard
// rendering as the flying cards themselves rather than a bespoke asset, so it always matches
// whatever card-back art is live. Fades out over the overlay's final DECK_STACK_FADE_MS once
// dealing is done, instead of just vanishing when the whole overlay unmounts.
function DeckStack({ visibleForMs }: { visibleForMs: number }) {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 0,
      duration: DECK_STACK_FADE_MS,
      delay: Math.max(visibleForMs - DECK_STACK_FADE_MS, 0),
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }).start();
  }, []);

  return (
    <Animated.View
      testID="deal-deck-stack"
      style={[
        styles.deckStack,
        {
          opacity,
          transform: [
            { translateX: DECK_STACK_OFFSET.x },
            { translateY: DECK_STACK_OFFSET.y },
          ],
        },
      ]}>
      {Array.from({ length: DECK_STACK_CARD_COUNT }, (_, i) => (
        <PlayingCard
          key={i}
          faceDown
          size="small"
          style={[
            styles.deckStackCard,
            { transform: [{ translateX: i * DECK_STACK_CARD_STEP.x }, { translateY: i * DECK_STACK_CARD_STEP.y }] },
          ]}
        />
      ))}
    </Animated.View>
  );
}

// No backdrop — the felt/table stays fully visible throughout, unlike the shuffle/cut overlay
// this replaces for Batak. Cards fly individually, straight-line, from the table center (or, for
// Pişti, the deck stack's own position — see showDeckStack) to each seat's directional offset,
// grouped into per-seat blocks in deal order with a fast per-card stagger inside each block (the
// "individual rapid-fire" style approved via the brainstorming visual companion, over a single-
// clustered-burst-per-player alternative). Renders its own absolute-fill View (not
// AbsoluteOverlay) because — like the overlay it replaces — it's meant to block interaction with
// the table underneath while a deal is in progress; it just no longer paints a dark backdrop while
// doing so.
export function DealFlightOverlay({ seats, showDeckStack = false }: DealFlightOverlayProps) {
  const flightCards = useMemo(() => buildFlightCards(seats), [seats]);
  const from = showDeckStack ? DECK_STACK_OFFSET : ORIGIN;
  // Matches buildFlightCards' own scheduling: the last card's block start plus its flight time is
  // when the overlay's visible motion actually finishes (a hair before useDealSequence's own
  // DEAL_FLIGHT_MS flips dealPhase, which is fine — the deck just fades a beat early rather than
  // being cut off mid-fade).
  const totalMs = seats.length * (BLOCK_MS + BLOCK_GAP_MS) + CARD_FLIGHT_MS;

  return (
    <View style={styles.overlay}>
      {showDeckStack && <DeckStack visibleForMs={totalMs} />}
      {flightCards.map((card) => (
        <FlyingCard key={card.key} origin={card.origin} delay={card.delay} from={from} />
      ))}
    </View>
  );
}

const ORIGIN = { x: 0, y: 0 };

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  card: { position: 'absolute' },
  deckStack: {
    position: 'absolute',
    width: CARD_DIMS.small.width,
    height: CARD_DIMS.small.height,
  },
  deckStackCard: { position: 'absolute', top: 0, left: 0 },
});
