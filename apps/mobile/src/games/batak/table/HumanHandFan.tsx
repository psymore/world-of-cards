import React from "react";
import { StyleSheet, View } from "react-native";
import type { Card, Suit } from "@world-cards/engine";
import { compareRanks } from "@world-cards/engine/games/batak";
import { CARD_DIMS } from "@world-cards/ui";
import { BatakHandCard } from "./BatakHandCard";
import type { useCardMotion } from "../../../table/useCardMotion";
import { STANDARD_RAIL_CONFIG, COMPACT_RAIL_CONFIG } from "./batakRailFan";
import { railAngleStepDeg, railAngles, railPosition } from "../../../table/railFan";

const HUMAN_CARD_HEIGHT = CARD_DIMS.normal.height;

// The bottom hand row overlaps the top row instead of sitting below it with a gap, so the two
// rows read as one imbricated fan rather than two stacked blocks. Tuned live against real
// PlayingCards and Batak's real two-row hand — see Task 1 of
// docs/superpowers/plans/2026-07-30-batak-hand-fan-demo08-migration.md (Demo09BatakHandTuning).
// Same value for both Standard and compact/gömmeli modes (batakRailFan.ts's radius/spacing/arc
// tuning differs per mode instead). Exported: BatakTable's own HandFrame-positioning math needs to
// know how far the two rows overlap to compute where the fan's top-row peak sits.
export const HAND_ROW_OVERLAP_PX = 40;

// Total footprint of the two-row fan (top row's full height, plus the bottom row's additional
// visible height once the overlap above is applied) — given explicitly to styles.handFan since its
// children are absolutely positioned (see BatakHandCard) and can't contribute to an auto-computed
// parent height the way normal-flow children would.
const HAND_FAN_HEIGHT = HUMAN_CARD_HEIGHT + (HUMAN_CARD_HEIGHT - HAND_ROW_OVERLAP_PX);

// The played card's brief "lift-off" leg before it hands off to the elevated trick-center travel
// animation (BatakScreen.tsx/TrickCenter.tsx) — see
// docs/superpowers/specs/2026-07-22-batak-play-travel-local-departure-design.md. Moving up by a
// full card height guarantees it fully clears the row's own vertical band (same-row neighbors
// paint over it purely by later render-order, regardless of vertical position), so by the time
// TrickCenter's globally-elevated TravelCard takes over, there's no longer any hand content left
// to visually "pop" in front of.
export const LOCAL_DEPARTURE_DISTANCE = HUMAN_CARD_HEIGHT;
export const LOCAL_DEPARTURE_DURATION_MS = 200;

// How far a selected card is pushed outward along its own rail angle (railPosition's extraRadius —
// never sideways along the rail). 2.5x SelectableCard's own pre-migration default (16px) — Batak-
// only override, see docs/superpowers/specs/2026-07-17-batak-deal-selection-and-trick-motion-
// polish-design.md section C. No BatakTable compensation is needed for this anymore: the played
// card's travel-origin now reads the motion registry's real committed position directly (which
// already includes the lift), rather than measuring an unlifted node and subtracting this
// constant back out.
export const SELECTED_LIFT_DISTANCE = 40;

const HAND_SUIT_ORDER = ["hearts", "spades", "diamonds", "clubs"] as const;

// Exported so BatakTable can compute a card's real fan angle at the moment it's tapped (for the
// played-card travel animation's origin rotation) without duplicating batakRailFan.ts's formula.
// Always the Standard config, matching pre-rewrite behavior — BatakTable's existing call site
// doesn't pass `compact` (see docs/superpowers/plans/2026-07-30-batak-hand-fan-demo08-migration.md
// Task 5 Step 1).
export function handCardRotationDeg(indexInRow: number, rowCount: number): number {
  const angleStepDeg = railAngleStepDeg(STANDARD_RAIL_CONFIG, rowCount);
  const angles = railAngles(rowCount, angleStepDeg, STANDARD_RAIL_CONFIG.maxRotationDeg);
  return angles[indexInRow] ?? 0;
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
// shrinks).
export interface HandSlot {
  card: Card;
  row: "top" | "bottom";
  indexInRow: number;
  rowCount: number;
  // Non-null only for a card returning to the hand from a Batak gömmeli bury slot — makes its
  // very first render (in this component instance's lifetime) animate in from this offset using
  // the same reposition timing/easing every other hand reflow already uses.
  enterFromOffset?: { x: number; y: number } | null;
}

// Each row is its own independent rail (batakRailFan.ts's STANDARD_RAIL_CONFIG/
// COMPACT_RAIL_CONFIG), with the bottom row's pivot offset down by the imbrication amount above.
// extraRadius (0 for resting, SELECTED_LIFT_DISTANCE for the selection lift) pushes the card
// straight out along its own angle — see railPosition's own doc comment.
function slotPosition(
  slot: HandSlot,
  compact: boolean,
  extraRadius: number,
): { x: number; y: number; angleDeg: number } {
  const config = compact ? COMPACT_RAIL_CONFIG : STANDARD_RAIL_CONFIG;
  const angleStepDeg = railAngleStepDeg(config, slot.rowCount);
  const angles = railAngles(slot.rowCount, angleStepDeg, config.maxRotationDeg);
  const angleDeg = angles[slot.indexInRow] ?? 0;
  const pos = railPosition(angleDeg, config.radius, extraRadius);
  const rowYOffset = slot.row === "top" ? 0 : HUMAN_CARD_HEIGHT - HAND_ROW_OVERLAP_PX;
  return { x: pos.x, y: pos.y + rowYOffset, angleDeg };
}

// Renders every human-hand card (both rows) under one shared parent — a lifted bottom-row card
// still paints over the top row purely by render order (top row's slots render first), no zIndex
// needed. Layout/orchestration only: each BatakHandCard owns its own motion (position/rotation/
// scale/opacity) and gesture entirely — this component computes targets, it doesn't animate
// anything itself.
export function HumanHandFan({
  slots,
  legalCardIds,
  isHumanInteractive,
  selectedCardId,
  selectCard,
  playEntrance,
  compact = false,
  departingCard = null,
  registerHandMotion,
  handFanRef,
  onHandFanLayout,
}: {
  slots: HandSlot[];
  legalCardIds: Set<string>;
  isHumanInteractive: boolean;
  selectedCardId: string | null;
  selectCard: (cardId: string) => void;
  playEntrance: boolean;
  // Tighter horizontal card spacing for Batak gömmeli's larger hand — see batakRailFan.ts's
  // COMPACT_RAIL_CONFIG. Defaults to false (Standard Batak's spacing).
  compact?: boolean;
  // The card currently running its local-departure leg (BatakScreen.tsx) and the horizontal
  // component of that leg's motion, or null the rest of the time.
  departingCard?: { cardId: string; deltaX: number } | null;
  // Hands the caller (BatakTable) each card's live motion controller as it mounts/unmounts —
  // replaces the old handCardRefs-based measureInWindow approach entirely.
  registerHandMotion: (cardId: string, motion: ReturnType<typeof useCardMotion> | null) => void;
  // Exposes this component's own root View so BatakTable can measure its real absolute window
  // position — every card's motion (translateX/translateY, read via getValues() at tap time) is
  // relative to THIS container's own top/center, not the screen, so playWithMeasuredOrigin needs
  // this exact anchor (not an ancestor's) to convert a card's position into absolute/dest-relative
  // space correctly. See BatakTable.tsx's playWithMeasuredOrigin doc comment for the bug this
  // fixes.
  handFanRef: React.RefObject<View | null>;
  onHandFanLayout: () => void;
}) {
  return (
    <View style={styles.handFan} ref={handFanRef} onLayout={onHandFanLayout} testID="human-hand">
      {slots.map((slot) => {
        const restTarget = slotPosition(slot, compact, 0);
        const liftedTarget = slotPosition(slot, compact, SELECTED_LIFT_DISTANCE);
        const isDeparting = departingCard?.cardId === slot.card.id;
        return (
          <BatakHandCard
            key={slot.card.id}
            cardId={slot.card.id}
            card={slot.card}
            restTarget={restTarget}
            liftedTarget={liftedTarget}
            enterFromOffset={slot.enterFromOffset}
            interactive={isHumanInteractive && legalCardIds.has(slot.card.id)}
            selected={selectedCardId === slot.card.id}
            playEntrance={playEntrance}
            entranceIndex={slot.indexInRow}
            isDeparting={isDeparting}
            departureDeltaX={isDeparting && departingCard ? departingCard.deltaX : 0}
            localDepartureDistance={LOCAL_DEPARTURE_DISTANCE}
            localDepartureDurationMs={LOCAL_DEPARTURE_DURATION_MS}
            onPress={() => selectCard(slot.card.id)}
            registerMotion={registerHandMotion}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  // Fixed height since every card inside is absolutely positioned (see BatakHandCard) and can't
  // contribute to an auto-computed height the way normal-flow children would.
  handFan: { height: HAND_FAN_HEIGHT },
});
