import React from "react";
import {
  Animated,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import type { Card, Suit } from "@world-of-cards/engine";

export const SIMPLE_CARD_WIDTH = 64;
export const SIMPLE_CARD_HEIGHT = 92;

const SUIT_GLYPHS: Record<Suit, string> = {
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
  spades: "♠",
};

const SUIT_COLORS: Record<Suit, string> = {
  hearts: "#9a2f2f",
  diamonds: "#9a2f2f",
  clubs: "#1c2451",
  spades: "#1c2451",
};

export interface SimpleCardProps {
  card: Card;
  // Optional animated style applied to the rank/suit glyph content only, separate
  // from whatever transform the caller applies to the outer card — see Demo 05
  // (Task 7), which animates this toward a smaller resting size independently of
  // the outer card's own scale.
  glyphStyle?: StyleProp<ViewStyle>;
}

// Deliberately does not use @world-of-cards/ui's PlayingCard/SuitIcon — per
// ANIMATION_ARCHITECTURE.md's "Playground Scope," this module renders cards as plain
// text + Unicode suit glyphs at one fixed size, so animation work here is never
// blocked on (or confused with) the real game's card art.
//
// React.memo'd: `card` is a stable reference per card instance across this whole
// sub-project (every demo builds its hand once via useMemo), so a parent re-render
// caused by some OTHER card's own local animation-stage state changing has no
// reason to re-run this one's Text/View reconciliation too. Safe with an animated
// `glyphStyle` (Demo 05): Animated.View updates its own native props directly off
// the underlying Animated.Value, independent of React re-renders, so skipping a
// render here never stalls that animation — worst case, an unmemoized caller still
// passes a fresh glyphStyle object each render, which is a real prop change and
// re-renders normally either way.
export const SimpleCard = React.memo(function SimpleCard({
  card,
  glyphStyle,
}: SimpleCardProps) {
  const suit = card.suit ?? "spades";
  return (
    <View style={styles.card} testID={`simple-card-${card.id}`}>
      <Animated.View style={glyphStyle}>
        <Text style={[styles.rank, { color: SUIT_COLORS[suit] }]}>
          {card.rank}
        </Text>
        <Text style={[styles.suit, { color: SUIT_COLORS[suit] }]}>
          {SUIT_GLYPHS[suit]}
        </Text>
      </Animated.View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    width: SIMPLE_CARD_WIDTH,
    height: SIMPLE_CARD_HEIGHT,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#d8cca4",
    backgroundColor: "#f3ecd9",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 3,
  },
  rank: { fontSize: 20, fontWeight: "700", textAlign: "center" },
  suit: { fontSize: 22, textAlign: "center" },
});
