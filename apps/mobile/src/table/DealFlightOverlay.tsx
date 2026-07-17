import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { PlayingCard } from '@world-cards/ui';
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
}

const BLOCK_MS = 340;
const BLOCK_GAP_MS = 60;
const CARD_FLIGHT_MS = 220;
const MIN_CARD_STAGGER_MS = 15;

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

function FlyingCard({ origin, delay }: { origin: RevealOrigin; delay: number }) {
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
            { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [0, target.x] }) },
            { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [0, target.y] }) },
          ],
        },
      ]}>
      <PlayingCard faceDown size="small" />
    </Animated.View>
  );
}

// No backdrop — the felt/table stays fully visible throughout, unlike the shuffle/cut overlay
// this replaces for Batak. Cards fly individually, straight-line, from the table center to each
// seat's directional offset, grouped into per-seat blocks in deal order with a fast per-card
// stagger inside each block (the "individual rapid-fire" style approved via the brainstorming
// visual companion, over a single-clustered-burst-per-player alternative). Renders its own
// absolute-fill View (not AbsoluteOverlay) because — like the overlay it replaces — it's meant to
// block interaction with the table underneath while a deal is in progress; it just no longer
// paints a dark backdrop while doing so.
export function DealFlightOverlay({ seats }: DealFlightOverlayProps) {
  const flightCards = useMemo(() => buildFlightCards(seats), [seats]);

  return (
    <View style={styles.overlay}>
      {flightCards.map((card) => (
        <FlyingCard key={card.key} origin={card.origin} delay={card.delay} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  card: { position: 'absolute' },
});
