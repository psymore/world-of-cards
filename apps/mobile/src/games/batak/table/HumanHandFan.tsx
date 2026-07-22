import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import type { Card, Suit } from "@world-cards/engine";
import { compareRanks } from "@world-cards/engine/games/batak";
import { CARD_DIMS } from "@world-cards/ui";
import { SelectableCard } from "../../../components/SelectableCard";
import { useReducedMotion } from "../../../components/useReducedMotion";
import { fanCurveY, fanRotationDeg } from "../../../table/seating";

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
export const HAND_ROW_OVERLAP_PX = Math.round(
  HUMAN_CARD_HEIGHT * HAND_ROW_OVERLAP_FRACTION,
);
// Total footprint of the two-row fan (top row's full height, plus the bottom row's additional
// visible height once the overlap above is applied) — given explicitly to styles.handFan since
// its children are now absolutely positioned (see AnimatedFanCard) and can no longer contribute
// to an auto-computed parent height the way normal-flow children would.
const HAND_FAN_HEIGHT =
  HUMAN_CARD_HEIGHT + (HUMAN_CARD_HEIGHT - HAND_ROW_OVERLAP_PX);

// Fixed per-card horizontal spacing (step between adjacent card slots) in the human's own hand —
// deliberately NOT recomputed from the current row length (that previously made the fan spread
// apart as cards were played, since fewer cards meant less overlap was needed to fit the same
// target width). The top row is spaced slightly wider apart (less overlap) than the bottom row
// for visual balance, mirroring HAND_ROW_OVERLAP_FRACTION's own intent for the vertical axis.
const HUMAN_HAND_BOTTOM_ROW_OVERLAP_FRACTION = 0.5;
const HUMAN_HAND_TOP_ROW_OVERLAP_FRACTION = 0.4;
const HUMAN_HAND_BOTTOM_ROW_STEP = Math.round(
  HUMAN_CARD_WIDTH * (1 - HUMAN_HAND_BOTTOM_ROW_OVERLAP_FRACTION),
);
const HUMAN_HAND_TOP_ROW_STEP = Math.round(
  HUMAN_CARD_WIDTH * (1 - HUMAN_HAND_TOP_ROW_OVERLAP_FRACTION),
);
// Batak gömmeli's hand runs materially larger than Standard Batak's fixed 13-card hand (16 cards
// steady-state, up to 20 mid-kitty-exchange while choosing what to bury) — the two fractions
// above were tuned for Standard's max row of 7 and visibly overflow gömmeli's max row of 10.
// Gömmeli-only overrides, applied via HumanHandFan's `compact` prop (set by BatakTable based on
// opponentPlayerIds.length === 2); Standard Batak's own look, and Pişti's separate hand UI, are
// completely untouched. First-pass values — tune further once checked live.
const GOMELI_HAND_BOTTOM_ROW_OVERLAP_FRACTION = 0.75;
const GOMELI_HAND_TOP_ROW_OVERLAP_FRACTION = 0.68;
const GOMELI_HAND_BOTTOM_ROW_STEP = Math.round(
  HUMAN_CARD_WIDTH * (1 - GOMELI_HAND_BOTTOM_ROW_OVERLAP_FRACTION),
);
const GOMELI_HAND_TOP_ROW_STEP = Math.round(
  HUMAN_CARD_WIDTH * (1 - GOMELI_HAND_TOP_ROW_OVERLAP_FRACTION),
);
// Shared timing for every hand-card reposition (a card played, remaining cards sliding/rising to
// close the gap) — see AnimatedFanCard. An ease-in-ease-out curve reads as a natural reflow
// rather than either a sudden snap (no easing) or a bouncy entrance (an "out" curve alone).
const HAND_CARD_REPOSITION_DURATION_MS = 220;
const HAND_CARD_REPOSITION_EASING = Easing.inOut(Easing.ease);

// The played card's brief "lift-off" leg before it hands off to the elevated trick-center travel
// animation (BatakScreen.tsx/TrickCenter.tsx) — see
// docs/superpowers/specs/2026-07-22-batak-play-travel-local-departure-design.md. Moving up by a
// full card height guarantees it fully clears the row's own vertical band (same-row neighbors
// paint over it purely by later render-order, regardless of vertical position), so by the time
// TrickCenter's globally-elevated TravelCard takes over, there's no longer any hand content left
// to visually "pop" in front of. Purely local and vertical — rotation/curve are untouched, so the
// card's angle at handoff still matches what TravelCard's own originRotateDeg expects.
export const LOCAL_DEPARTURE_DISTANCE = HUMAN_CARD_HEIGHT;
export const LOCAL_DEPARTURE_DURATION_MS = 50;
// Easing.in, not Easing.out: this leg hands off directly into TrickCenter's own TravelCard flight,
// which uses CARD_TRAVEL_EASING (Easing.out(cubic) — fast start, decelerating to a stop by
// design). An ease-out *local* leg would also decelerate to a dead stop right at that handoff,
// then TravelCard would immediately burst back up to full speed — a visible "stops, then lurches
// forward again" hitch. Easing.in ends this leg at max velocity instead, matching TravelCard's own
// max-velocity start, so the two legs read as one continuous accelerate-then-decelerate motion
// rather than two animations bolted together. Also fixes a smaller issue for free: the previous
// ease-out start snapped to full speed the instant of the tap; ease-in lifts off gently instead.
const LOCAL_DEPARTURE_EASING = Easing.in(Easing.cubic);

// 2.5x SelectableCard's own default (16px) lift — Batak-only override, see
// docs/superpowers/specs/2026-07-17-batak-deal-selection-and-trick-motion-polish-design.md
// section C. Selection no longer forces the card to the front via zIndex; this larger lift is
// what makes a selected card read as prominent instead.
// Exported: BatakTable's playWithMeasuredOrigin needs this exact value to compensate a measured
// card position for its selection lift — see SelectableCard's DEFAULT_LIFT_DISTANCE doc comment
// for why the lift can't just be measured off the transformed node directly.
export const SELECTED_LIFT_DISTANCE = 40;
// Shrinks only the currently-selected card's touchable width — see SelectableCard's hitSlop doc
// comment. Deliberately conservative (not the full ~25px rotation-widened estimate) so the
// selected card stays comfortably tappable for the second tap that plays it.
const SELECTED_CARD_HIT_SLOP = { left: -20, right: -20 };
const HAND_SUIT_ORDER = ["hearts", "spades", "diamonds", "clubs"] as const;

// Exported so BatakTable can compute a card's real fan angle at the moment it's tapped (for the
// played-card travel animation's origin rotation) without duplicating
// HUMAN_HAND_DEGREES_PER_STEP or reimplementing the fan formula.
export function handCardRotationDeg(
  indexInRow: number,
  rowCount: number,
): number {
  return fanRotationDeg(indexInRow, rowCount, HUMAN_HAND_DEGREES_PER_STEP);
}

export function sortHandForDisplay(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => {
    const suitDiff =
      HAND_SUIT_ORDER.indexOf(a.suit as Suit) -
      HAND_SUIT_ORDER.indexOf(b.suit as Suit);
    if (suitDiff !== 0) return suitDiff;
    return compareRanks(b.rank, a.rank); // descending within suit: A high ... 2 low
  });
}

// One human-hand card's slot: which row it's in, its index within that row, and how many cards
// currently share that row (rowCount, not the initial deal size — the fan recenters as the row
// shrinks, matching the pre-existing recentering behavior, just now animated instead of snapped).
export interface HandSlot {
  card: Card;
  row: "top" | "bottom";
  indexInRow: number;
  rowCount: number;
  // Non-null only for a card returning to the hand from a Batak gömmeli bury slot — makes its
  // very first render (in this component instance's lifetime — it was unmounted while placed in
  // a slot, so this genuinely is a fresh mount) animate in from this offset using the exact same
  // reposition timing/easing every other hand reflow already uses, instead of the initial-deal
  // behavior of snapping straight to its slot with no animation.
  enterFromOffset?: { x: number; y: number } | null;
}

function slotStep(row: "top" | "bottom", compact: boolean): number {
  if (compact)
    return row === "top"
      ? GOMELI_HAND_TOP_ROW_STEP
      : GOMELI_HAND_BOTTOM_ROW_STEP;
  return row === "top" ? HUMAN_HAND_TOP_ROW_STEP : HUMAN_HAND_BOTTOM_ROW_STEP;
}

// Horizontal offset from the row's own center — negative/positive symmetric around 0, so the row
// stays centered under styles.fanCardSlot's left:'50%' anchor regardless of rowCount. Exported:
// BatakTable's playWithMeasuredOrigin computes a played card's travel-origin X analytically from
// this instead of measuring the card's own (transform-nested) node — see its call site's doc
// comment for why.
export function slotTargetX(slot: HandSlot, compact: boolean): number {
  const mid = (slot.rowCount - 1) / 2;
  return (slot.indexInRow - mid) * slotStep(slot.row, compact);
}

// Vertical offset from the fan's own top edge — the bottom row overlaps up into the top row by
// HAND_ROW_OVERLAP_PX, matching the pre-existing two-row imbrication.
function slotTargetY(slot: HandSlot): number {
  return slot.row === "top" ? 0 : HUMAN_CARD_HEIGHT - HAND_ROW_OVERLAP_PX;
}

// A single human-hand card, absolutely positioned within the shared fan container and animated
// (via its own persistent Animated.Value pair) whenever its target slot changes — e.g. a card
// played elsewhere in the hand shifts every card after it to a new index, and shrinking a row can
// even move a card from the top row to the bottom row (or vice versa). Because every card in both
// rows now lives under one shared parent (HumanHandFan) instead of two separate row containers,
// that row-crossing case animates smoothly too, rather than unmounting from one row's tree and
// remounting in the other's.
interface AnimatedFanCardProps {
  slot: HandSlot;
  interactive: boolean;
  selected: boolean;
  selectCard: (cardId: string) => void;
  playEntrance: boolean;
  registerCardRef: (cardId: string, node: View | null) => void;
  compact: boolean;
  // True only for the card the human just confirmed playing, for its brief local-departure leg
  // (see LOCAL_DEPARTURE_DISTANCE above) — every other card's slot/reposition behavior is
  // unaffected.
  isDeparting: boolean;
}

function AnimatedFanCardComponent({
  slot,
  interactive,
  selected,
  selectCard,
  playEntrance,
  registerCardRef,
  compact,
  isDeparting,
}: AnimatedFanCardProps) {
  const { card } = slot;
  const targetX = slotTargetX(slot, compact);
  const targetY = slotTargetY(slot);
  const x = useRef(new Animated.Value(targetX)).current;
  const y = useRef(new Animated.Value(targetY)).current;
  const mounted = useRef(false);
  const reducedMotion = useReducedMotion();
  const departed = useRef(false);

  // Fires once, the instant this specific card starts its local-departure leg — layers an
  // additional upward move on top of whatever slot position `y` already holds (its own reposition
  // effect below is untouched and never fires again for this card, since it's about to unmount).
  // Skipped under reduced motion: BatakScreen's own reducedMotion check already skips the whole
  // local-departure pre-stage in that case, so isDeparting never becomes true here, but the guard
  // is kept for defense in depth (matches every other animation in this file).
  useEffect(() => {
    if (!isDeparting || departed.current || reducedMotion) return;
    departed.current = true;
    Animated.timing(y, {
      toValue: targetY - LOCAL_DEPARTURE_DISTANCE,
      duration: LOCAL_DEPARTURE_DURATION_MS,
      easing: LOCAL_DEPARTURE_EASING,
      useNativeDriver: true,
    }).start();
  }, [isDeparting, reducedMotion, targetY, y]);

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

  return (
    <Animated.View
      style={[
        styles.fanCardSlot,
        { transform: [{ translateX: x }, { translateY: y }] },
      ]}>
      <View ref={node => registerCardRef(card.id, node)}>
        <EntranceCard index={slot.indexInRow} playEntrance={playEntrance}>
          <SelectableCard
            card={card}
            size="normal"
            selected={selected}
            disabled={!interactive}
            onPress={() => selectCard(card.id)}
            rotateDeg={fanRotationDeg(
              slot.indexInRow,
              slot.rowCount,
              HUMAN_HAND_DEGREES_PER_STEP,
            )}
            curveOffsetY={fanCurveY(
              slot.indexInRow,
              slot.rowCount,
              1,
              HUMAN_HAND_CURVE_MULTIPLIER,
            )}
            liftDistance={SELECTED_LIFT_DISTANCE}
            // Kept even without front-stacking zIndex: it independently shrinks the selected
            // card's own touch bounds, which is what actually prevents a stray tap from landing
            // on it instead of an exposed neighbor — orthogonal to stacking order.
            hitSlop={selected ? SELECTED_CARD_HIT_SLOP : undefined}
          />
        </EntranceCard>
      </View>
    </Animated.View>
  );
}

// Batak is strictly turn-based: only one player's action is ever in flight, and while this
// specific card's `selected`/`interactive` props are unchanged, no engine state that
// `selectCard`/`registerCardRef` close over can have changed in a way that affects THIS card's
// behavior either (the human's own turn, and any card sitting selected during it, is
// uninterrupted the whole time). So it's safe to skip re-rendering — and therefore keep a
// technically-stale `selectCard`/`registerCardRef` closure — whenever slot/interactive/selected/
// compact/playEntrance are all unchanged; those closures behave identically for this card either
// way. Deliberately NOT comparing selectCard/registerCardRef by reference: BatakTable recreates
// selectCard's underlying dependency chain on most renders, so comparing it would defeat the memo
// on nearly every re-render, including the "an AI played elsewhere and nothing about this card
// changed" case this exists to fix — see
// docs/superpowers/specs/2026-07-21-batak-card-play-animation-smoothness-design.md.
function areFanCardPropsEqual(
  prev: AnimatedFanCardProps,
  next: AnimatedFanCardProps,
): boolean {
  return (
    prev.slot.card.id === next.slot.card.id &&
    prev.slot.row === next.slot.row &&
    prev.slot.indexInRow === next.slot.indexInRow &&
    prev.slot.rowCount === next.slot.rowCount &&
    prev.slot.enterFromOffset?.x === next.slot.enterFromOffset?.x &&
    prev.slot.enterFromOffset?.y === next.slot.enterFromOffset?.y &&
    prev.interactive === next.interactive &&
    prev.selected === next.selected &&
    prev.compact === next.compact &&
    prev.playEntrance === next.playEntrance &&
    prev.isDeparting === next.isDeparting
  );
}

const AnimatedFanCard = React.memo(
  AnimatedFanCardComponent,
  areFanCardPropsEqual,
);

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
          {
            scale: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [0.4, 1],
            }),
          },
          {
            translateY: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [-40, 0],
            }),
          },
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
  departingCardId = null,
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
  // The card id currently running its local-departure leg (BatakScreen.tsx), or null the rest of
  // the time — see LOCAL_DEPARTURE_DISTANCE above.
  departingCardId?: string | null;
}) {
  return (
    <View style={styles.handFan} testID="human-hand">
      {slots.map(slot => (
        <AnimatedFanCard
          key={slot.card.id}
          slot={slot}
          interactive={isHumanInteractive && legalCardIds.has(slot.card.id)}
          selected={selectedCardId === slot.card.id}
          selectCard={selectCard}
          playEntrance={playEntrance}
          registerCardRef={registerCardRef}
          compact={compact}
          isDeparting={departingCardId === slot.card.id}
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
    position: "absolute",
    left: "50%",
    top: 0,
    marginLeft: -HUMAN_CARD_WIDTH / 2,
  },
});
