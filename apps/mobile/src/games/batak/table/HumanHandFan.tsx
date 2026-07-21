import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import type { Card, Suit } from '@world-cards/engine';
import { compareRanks } from '@world-cards/engine/games/batak';
import { CARD_DIMS } from '@world-cards/ui';
import { SelectableCard } from '../../../components/SelectableCard';
import { useReducedMotion } from '../../../components/useReducedMotion';
import { fanCurveY, fanRotationDeg } from '../../../table/seating';

const HUMAN_CARD_WIDTH = CARD_DIMS.normal.width;
const HUMAN_CARD_HEIGHT = CARD_DIMS.normal.height;
// A flatter arc than the opponents' default fan (half the rotation-per-card and curve
// multiplier) — first-pass values, tune during the manual visual verification pass if needed.
const HUMAN_HAND_DEGREES_PER_STEP = 4;
const HUMAN_HAND_CURVE_MULTIPLIER = 1.5;
// The bottom hand row overlaps the top row instead of sitting below it with a gap, so the two
// rows read as one imbricated fan rather than two stacked blocks.
const HAND_ROW_OVERLAP_FRACTION = 0.25;
// Exported: BatakTable's own HandFrame-positioning math needs to know how far the two rows
// overlap to compute where the fan's top-row peak sits.
export const HAND_ROW_OVERLAP_PX = Math.round(HUMAN_CARD_HEIGHT * HAND_ROW_OVERLAP_FRACTION);
// Total footprint of the two-row fan (top row's full height, plus the bottom row's additional
// visible height once the overlap above is applied) — given explicitly to styles.handFan since
// its children are now absolutely positioned (see AnimatedFanCard) and can no longer contribute
// to an auto-computed parent height the way normal-flow children would.
const HAND_FAN_HEIGHT = HUMAN_CARD_HEIGHT + (HUMAN_CARD_HEIGHT - HAND_ROW_OVERLAP_PX);

// Fixed per-card horizontal spacing (step between adjacent card slots) in the human's own hand —
// deliberately NOT recomputed from the current row length (that previously made the fan spread
// apart as cards were played, since fewer cards meant less overlap was needed to fit the same
// target width). The top row is spaced slightly wider apart (less overlap) than the bottom row
// for visual balance, mirroring HAND_ROW_OVERLAP_FRACTION's own intent for the vertical axis.
const HUMAN_HAND_BOTTOM_ROW_OVERLAP_FRACTION = 0.5;
const HUMAN_HAND_TOP_ROW_OVERLAP_FRACTION = 0.4;
const HUMAN_HAND_BOTTOM_ROW_STEP = Math.round(HUMAN_CARD_WIDTH * (1 - HUMAN_HAND_BOTTOM_ROW_OVERLAP_FRACTION));
const HUMAN_HAND_TOP_ROW_STEP = Math.round(HUMAN_CARD_WIDTH * (1 - HUMAN_HAND_TOP_ROW_OVERLAP_FRACTION));
// Batak gömmeli's hand runs materially larger than Standard Batak's fixed 13-card hand (16 cards
// steady-state, up to 20 mid-kitty-exchange while choosing what to bury) — the two fractions
// above were tuned for Standard's max row of 7 and visibly overflow gömmeli's max row of 10.
// Gömmeli-only overrides, applied via HumanHandFan's `compact` prop (set by BatakTable based on
// opponentPlayerIds.length === 2); Standard Batak's own look, and Pişti's separate hand UI, are
// completely untouched. First-pass values — tune further once checked live.
const GOMELI_HAND_BOTTOM_ROW_OVERLAP_FRACTION = 0.75;
const GOMELI_HAND_TOP_ROW_OVERLAP_FRACTION = 0.68;
const GOMELI_HAND_BOTTOM_ROW_STEP = Math.round(HUMAN_CARD_WIDTH * (1 - GOMELI_HAND_BOTTOM_ROW_OVERLAP_FRACTION));
const GOMELI_HAND_TOP_ROW_STEP = Math.round(HUMAN_CARD_WIDTH * (1 - GOMELI_HAND_TOP_ROW_OVERLAP_FRACTION));
// Shared timing for every hand-card reposition (a card played, remaining cards sliding/rising to
// close the gap) — see AnimatedFanCard. An ease-in-ease-out curve reads as a natural reflow
// rather than either a sudden snap (no easing) or a bouncy entrance (an "out" curve alone).
const HAND_CARD_REPOSITION_DURATION_MS = 220;
const HAND_CARD_REPOSITION_EASING = Easing.inOut(Easing.ease);

// 2.5x SelectableCard's own default (16px) lift — Batak-only override, see
// docs/superpowers/specs/2026-07-17-batak-deal-selection-and-trick-motion-polish-design.md
// section C. Selection no longer forces the card to the front via zIndex; this larger lift is
// what makes a selected card read as prominent instead.
const SELECTED_LIFT_DISTANCE = 40;
// Shrinks only the currently-selected card's touchable width — see SelectableCard's hitSlop doc
// comment. Deliberately conservative (not the full ~25px rotation-widened estimate) so the
// selected card stays comfortably tappable for the second tap that plays it.
const SELECTED_CARD_HIT_SLOP = { left: -20, right: -20 };
const HAND_SUIT_ORDER = ['hearts', 'spades', 'diamonds', 'clubs'] as const;

// Exported so BatakTable can compute a card's real fan angle at the moment it's tapped (for the
// played-card travel animation's origin rotation) without duplicating
// HUMAN_HAND_DEGREES_PER_STEP or reimplementing the fan formula.
export function handCardRotationDeg(indexInRow: number, rowCount: number): number {
  return fanRotationDeg(indexInRow, rowCount, HUMAN_HAND_DEGREES_PER_STEP);
}

export function sortHandForDisplay(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => {
    const suitDiff = HAND_SUIT_ORDER.indexOf(a.suit as Suit) - HAND_SUIT_ORDER.indexOf(b.suit as Suit);
    if (suitDiff !== 0) return suitDiff;
    return compareRanks(b.rank, a.rank); // descending within suit: A high ... 2 low
  });
}

// One human-hand card's slot: which row it's in, its index within that row, and how many cards
// currently share that row (rowCount, not the initial deal size — the fan recenters as the row
// shrinks, matching the pre-existing recentering behavior, just now animated instead of snapped).
export interface HandSlot {
  card: Card;
  row: 'top' | 'bottom';
  indexInRow: number;
  rowCount: number;
  // Non-null only for a card returning to the hand from a Batak gömmeli bury slot — makes its
  // very first render (in this component instance's lifetime — it was unmounted while placed in
  // a slot, so this genuinely is a fresh mount) animate in from this offset using the exact same
  // reposition timing/easing every other hand reflow already uses, instead of the initial-deal
  // behavior of snapping straight to its slot with no animation.
  enterFromOffset?: { x: number; y: number } | null;
}

function slotStep(row: 'top' | 'bottom', compact: boolean): number {
  if (compact) return row === 'top' ? GOMELI_HAND_TOP_ROW_STEP : GOMELI_HAND_BOTTOM_ROW_STEP;
  return row === 'top' ? HUMAN_HAND_TOP_ROW_STEP : HUMAN_HAND_BOTTOM_ROW_STEP;
}

// Horizontal offset from the row's own center — negative/positive symmetric around 0, so the row
// stays centered under styles.fanCardSlot's left:'50%' anchor regardless of rowCount.
function slotTargetX(slot: HandSlot, compact: boolean): number {
  const mid = (slot.rowCount - 1) / 2;
  return (slot.indexInRow - mid) * slotStep(slot.row, compact);
}

// Vertical offset from the fan's own top edge — the bottom row overlaps up into the top row by
// HAND_ROW_OVERLAP_PX, matching the pre-existing two-row imbrication.
function slotTargetY(slot: HandSlot): number {
  return slot.row === 'top' ? 0 : HUMAN_CARD_HEIGHT - HAND_ROW_OVERLAP_PX;
}

// A single human-hand card, absolutely positioned within the shared fan container and animated
// (via its own persistent Animated.Value pair) whenever its target slot changes — e.g. a card
// played elsewhere in the hand shifts every card after it to a new index, and shrinking a row can
// even move a card from the top row to the bottom row (or vice versa). Because every card in both
// rows now lives under one shared parent (HumanHandFan) instead of two separate row containers,
// that row-crossing case animates smoothly too, rather than unmounting from one row's tree and
// remounting in the other's.
function AnimatedFanCard({
  slot,
  legalCardIds,
  isHumanInteractive,
  selectedCardId,
  selectCard,
  playEntrance,
  registerCardRef,
  compact,
}: {
  slot: HandSlot;
  legalCardIds: Set<string>;
  isHumanInteractive: boolean;
  selectedCardId: string | null;
  selectCard: (cardId: string) => void;
  playEntrance: boolean;
  registerCardRef: (cardId: string, node: View | null) => void;
  compact: boolean;
}) {
  const { card } = slot;
  const targetX = slotTargetX(slot, compact);
  const targetY = slotTargetY(slot);
  const x = useRef(new Animated.Value(targetX)).current;
  const y = useRef(new Animated.Value(targetY)).current;
  const mounted = useRef(false);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      if (slot.enterFromOffset && !reducedMotion) {
        // A card returning from a bury slot: start offset from its true target and animate in,
        // reusing the exact same reposition timing/easing as an ordinary reflow.
        x.setValue(targetX + slot.enterFromOffset.x);
        y.setValue(targetY + slot.enterFromOffset.y);
        Animated.parallel([
          Animated.timing(x, {
            toValue: targetX,
            duration: HAND_CARD_REPOSITION_DURATION_MS,
            easing: HAND_CARD_REPOSITION_EASING,
            useNativeDriver: true,
          }),
          Animated.timing(y, {
            toValue: targetY,
            duration: HAND_CARD_REPOSITION_DURATION_MS,
            easing: HAND_CARD_REPOSITION_EASING,
            useNativeDriver: true,
          }),
        ]).start();
      }
      // Plain first render for a genuinely new card (the initial deal, or reducedMotion): jump
      // straight to its slot — EntranceCard supplies the deal's own fade/scale/rise flourish.
      return;
    }
    if (reducedMotion) {
      x.setValue(targetX);
      y.setValue(targetY);
      return;
    }
    Animated.parallel([
      Animated.timing(x, {
        toValue: targetX,
        duration: HAND_CARD_REPOSITION_DURATION_MS,
        easing: HAND_CARD_REPOSITION_EASING,
        useNativeDriver: true,
      }),
      Animated.timing(y, {
        toValue: targetY,
        duration: HAND_CARD_REPOSITION_DURATION_MS,
        easing: HAND_CARD_REPOSITION_EASING,
        useNativeDriver: true,
      }),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetX, targetY, reducedMotion, x, y]);

  const interactive = isHumanInteractive && legalCardIds.has(card.id);

  return (
    <Animated.View style={[styles.fanCardSlot, { transform: [{ translateX: x }, { translateY: y }] }]}>
      <View ref={(node) => registerCardRef(card.id, node)}>
        <EntranceCard index={slot.indexInRow} playEntrance={playEntrance}>
          <SelectableCard
            card={card}
            size="normal"
            selected={selectedCardId === card.id}
            disabled={!interactive}
            onPress={() => selectCard(card.id)}
            rotateDeg={fanRotationDeg(slot.indexInRow, slot.rowCount, HUMAN_HAND_DEGREES_PER_STEP)}
            curveOffsetY={fanCurveY(slot.indexInRow, slot.rowCount, 1, HUMAN_HAND_CURVE_MULTIPLIER)}
            liftDistance={SELECTED_LIFT_DISTANCE}
            // Kept even without front-stacking zIndex: it independently shrinks the selected
            // card's own touch bounds, which is what actually prevents a stray tap from landing
            // on it instead of an exposed neighbor — orthogonal to stacking order.
            hitSlop={selectedCardId === card.id ? SELECTED_CARD_HIT_SLOP : undefined}
          />
        </EntranceCard>
      </View>
    </Animated.View>
  );
}

// Plays a one-shot fade+scale+rise entrance the first time `playEntrance` becomes true (the
// moment the deal sequence reaches 'revealing'), then stays static — re-renders after that
// (card removed by a play, selection state changing) must not replay it, hence the `played` ref.
function EntranceCard({
  index,
  playEntrance,
  children,
}: {
  index: number;
  playEntrance: boolean;
  children: React.ReactNode;
}) {
  const progress = useRef(new Animated.Value(playEntrance ? 1 : 0)).current;
  const played = useRef(playEntrance);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (playEntrance && !played.current) {
      played.current = true;
      if (reducedMotion) {
        progress.setValue(1);
        return;
      }
      Animated.timing(progress, {
        toValue: 1,
        duration: 350,
        delay: index * 40,
        useNativeDriver: true,
      }).start();
    }
  }, [playEntrance, index, progress, reducedMotion]);

  return (
    <Animated.View
      style={{
        opacity: progress,
        transform: [
          { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) },
          { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [-40, 0] }) },
        ],
      }}>
      {children}
    </Animated.View>
  );
}

// Renders every human-hand card (both rows) under one shared parent — see AnimatedFanCard's doc
// comment for why that matters for the top/bottom row-crossing case. Render order (top row's
// slots first) preserves the pre-existing "bottom row paints over the top row where they overlap"
// stacking, since later JSX siblings paint on top with no zIndex needed.
export function HumanHandFan({
  slots,
  legalCardIds,
  isHumanInteractive,
  selectedCardId,
  selectCard,
  playEntrance,
  registerCardRef,
  compact = false,
}: {
  slots: HandSlot[];
  legalCardIds: Set<string>;
  isHumanInteractive: boolean;
  selectedCardId: string | null;
  selectCard: (cardId: string) => void;
  playEntrance: boolean;
  registerCardRef: (cardId: string, node: View | null) => void;
  // Tighter horizontal card spacing for Batak gömmeli's larger hand — see the
  // GOMELI_HAND_*_OVERLAP_FRACTION constants above. Defaults to false (Standard Batak's and
  // Pişti's existing spacing, byte-identical to before this prop existed).
  compact?: boolean;
}) {
  return (
    <View style={styles.handFan} testID="human-hand">
      {slots.map((slot) => (
        <AnimatedFanCard
          key={slot.card.id}
          slot={slot}
          legalCardIds={legalCardIds}
          isHumanInteractive={isHumanInteractive}
          selectedCardId={selectedCardId}
          selectCard={selectCard}
          playEntrance={playEntrance}
          registerCardRef={registerCardRef}
          compact={compact}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  // Fixed height since every card inside is now absolutely positioned (see AnimatedFanCard) and
  // can no longer contribute to an auto-computed height the way normal-flow children would.
  handFan: { height: HAND_FAN_HEIGHT },
  // Each human-hand card's positioning anchor: centered horizontally (left:50% + a negative
  // marginLeft of half the card's own width, the same "center-relative" convention TrickCenter's
  // own trickSlot uses), with AnimatedFanCard supplying the actual per-card translateX/Y offset
  // from that center point. No zIndex — natural render order (HumanHandFan renders the top row's
  // slots before the bottom row's) already makes a lifted bottom-row card paint over the top row
  // on its own, with no per-card override needed.
  fanCardSlot: {
    position: 'absolute',
    left: '50%',
    top: 0,
    marginLeft: -HUMAN_CARD_WIDTH / 2,
  },
});
