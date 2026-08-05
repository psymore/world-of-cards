import React from "react";
import { StyleSheet, Text, View } from "react-native";
import type { Card } from "@world-cards/engine";
import type { BatakState } from "@world-cards/engine/games/batak";
import { PlayingCard, SuitIcon, CARD_DIMS } from "@world-cards/ui";
import { TravelCard } from "../../../table/TravelCard";
import { GatherCard } from "../../../table/GatherCard";
import {
  resolveRevealOrigin,
  revealOriginOffset,
} from "../../../table/seating";
import type { Seat, SeatPosition } from "../../../table/seating";
import { centerPanelStyles } from "./centerPanelStyles";
import { suitColor } from "./suitColor";
import type { PendingBatakPlay, GatheringTrick } from "./types";
import { TRICK_CARD_SCALE, TRICK_CARD_CONTENT_SCALE } from "./trickCardScale";

export type TrickPosition = "bottom" | SeatPosition;

// Resting offset from dead-center for each seat's slot — small enough (vs. the ~165-195px
// travel-origin offsets below) that adjacent slots' card rectangles overlap slightly at their
// inner corners ("loose, corner-touching" per the brainstorming visual companion mockup, chosen
// over a tighter ~40%-overlap alternative). First-pass values sized against the 'small' card's
// CARD_DIMS.small footprint — confirm via screenshot in the final verification pass.
// Base pixel values tuned by eye for the original full-size trick card; scaled by
// TRICK_CARD_SCALE below as a first pass to preserve the same relative overlap at the new,
// smaller trick-card footprint — re-tune BASE_TRICK_SLOT_OFFSETS directly if that proportional
// scaling doesn't look right once checked live.
const BASE_TRICK_SLOT_OFFSETS: Record<TrickPosition, { x: number; y: number }> = {
  top: { x: 0, y: -38 },
  bottom: { x: 0, y: 38 },
  left: { x: -30, y: 0 },
  right: { x: 30, y: 0 },
};
const TRICK_SLOT_OFFSETS: Record<TrickPosition, { x: number; y: number }> = Object.fromEntries(
  Object.entries(BASE_TRICK_SLOT_OFFSETS).map(([position, offset]) => [
    position,
    { x: offset.x * TRICK_CARD_SCALE, y: offset.y * TRICK_CARD_SCALE },
  ]),
) as Record<TrickPosition, { x: number; y: number }>;

export function TrickCenter({
  state,
  seats,
  humanPlayerId,
  playerNames,
  pendingPlay,
  gatheringTrick,
  restingRotations,
  destRef,
  onDestLayout,
}: {
  state: BatakState;
  seats: Seat[];
  humanPlayerId: string;
  playerNames: Record<string, string>;
  pendingPlay?: PendingBatakPlay | null;
  gatheringTrick?: GatheringTrick | null;
  // The angle each currently-in-trick card keeps once it lands — see BatakScreen's doc comment on
  // this state. Applied to both the resting-card render below and GatherCard's sweep-away flight,
  // so a card never snaps back to flat once TravelCard's frozen rotation hands off to either.
  restingRotations?: Record<string, number>;
  destRef: React.RefObject<View | null>;
  onDestLayout: () => void;
}) {
  function trickPositionFor(playerId: string): TrickPosition {
    if (playerId === humanPlayerId) return "bottom";
    return seats.find(s => s.playerId === playerId)?.position ?? "top";
  }

  function cardFor(playerId: string): Card | null {
    if (pendingPlay != null && pendingPlay.playerId === playerId)
      return pendingPlay.card;
    const entry = state.currentTrick.find(t => t.playerId === playerId);
    if (!entry) return null;
    return (
      state.table.zones["trick"].cards.find(c => c.id === entry.cardId) ?? null
    );
  }

  // Play order across both already-committed cards and the still-animating pendingPlay (always
  // the newest) — drives each slot's zIndex so the most recently played card renders on top of
  // earlier ones regardless of which seat played it. Trick slots are seat-fixed (TRICK_SLOT_OFFSETS
  // above), so without this the overlap stacking would silently depend on seat position instead
  // of when each card actually arrived.
  const playOrder: string[] = [
    ...state.currentTrick.map(t => t.playerId),
    ...(pendingPlay ? [pendingPlay.playerId] : []),
  ];

  function slotFor(position: TrickPosition) {
    const playerId =
      position === "bottom"
        ? humanPlayerId
        : seats.find(s => s.position === position)?.playerId;
    const card = playerId ? cardFor(playerId) : null;
    const isPending =
      playerId != null &&
      pendingPlay != null &&
      pendingPlay.playerId === playerId;
    const isHumanPending = isPending && playerId === humanPlayerId;
    const zIndex = playerId ? Math.max(playOrder.indexOf(playerId) + 1, 1) : 1;
    const offset = TRICK_SLOT_OFFSETS[position];

    return (
      <View
        key={position}
        testID={`trick-slot-${position}`}
        ref={position === "bottom" ? destRef : undefined}
        onLayout={position === "bottom" ? onDestLayout : undefined}
        style={[
          styles.trickSlot,
          {
            zIndex,
            transform: [{ translateX: offset.x }, { translateY: offset.y }],
          },
        ]}>
        {card ? (
          isPending ? (
            isHumanPending ? (
              // The human's own played card: keeps its real fan-rotation angle fixed for the
              // whole flight (not straightened out along the way — see TravelCard's
              // originRotateDeg doc comment), but travels at a constant "small" scale rather than
              // easing down from real in-hand size. An earlier version rendered this at
              // size="normal" and interpolated a scale down to match "small"'s footprint — but
              // "small"'s internal proportions (CORNER_INDEX_WIDTH, WATERMARK_ICON_SIZE in
              // packages/ui/src/PlayingCard.tsx) are independently tuned, not a uniform scale of
              // "normal"'s, so even a perfectly smooth interpolation still landed on a slightly
              // different shape than the real resting "small" card it handed off to — reading as
              // an abrupt "settle" right as it arrived. Constant scale removes that mismatch
              // entirely: this is visually identical to the resting card for the whole flight,
              // just translating/rotating.
              <TravelCard
                originOffset={
                  pendingPlay?.originOffset ?? revealOriginOffset("bottom")
                }
                originRotateDeg={pendingPlay?.originRotateDeg ?? 0}
                // Held constant, not interpolated: BatakHandCard's own local-departure leg
                // already did the shrinking (see trickCardScale.ts's LOCAL_DEPARTURE_SCALE doc
                // comment) before this component ever mounts for a human play.
                originScale={TRICK_CARD_SCALE}
                restScale={TRICK_CARD_SCALE}
                durationMs={pendingPlay?.travelDurationMs}
                resetKey={card.id}>
                <PlayingCard card={card} size="normal" contentScale={TRICK_CARD_CONTENT_SCALE} />
              </TravelCard>
            ) : (
              // An AI's played card: no rendered per-card hand visual exists to depart from (see
              // the 2026-07-18 turn-indicator-simplification pass), so this stays translate-only,
              // unchanged from before.
              <TravelCard
                originOffset={
                  pendingPlay?.originOffset ??
                  revealOriginOffset(
                    resolveRevealOrigin(playerId!, humanPlayerId, seats),
                  )
                }
                // No local-departure leg exists for AI plays (no rendered opponent-hand visual
                // to depart from) — TravelCard does the whole shrink itself over the flight.
                originScale={1}
                restScale={TRICK_CARD_SCALE}
                resetKey={card.id}>
                <PlayingCard card={card} size="normal" contentScale={TRICK_CARD_CONTENT_SCALE} />
              </TravelCard>
            )
          ) : (
            // Resting (already landed, trick not yet gathered): keeps the exact angle it arrived
            // at — see restingRotations' doc comment above — rather than snapping flat/parallel
            // to the table edges the instant TravelCard hands off.
            <PlayingCard
              card={card}
              size="normal"
              contentScale={TRICK_CARD_CONTENT_SCALE}
              style={{
                // Both entries live in ONE transform array (not two style objects each setting
                // `transform`) — see this plan's Global Constraints note on why that matters.
                transform: [
                  { rotate: `${restingRotations?.[playerId!] ?? 0}deg` },
                  { scale: TRICK_CARD_SCALE },
                ],
              }}
            />
          )
        ) : null}
      </View>
    );
  }

  const gatherDestinationOffset = gatheringTrick
    ? revealOriginOffset(
        resolveRevealOrigin(gatheringTrick.winnerId, humanPlayerId, seats),
      )
    : null;

  return (
    <View style={centerPanelStyles.centerPanel}>
      <View style={centerPanelStyles.trumpRow}>
        <Text style={centerPanelStyles.centerLine}>Trump:</Text>
        <SuitIcon
          suit={state.trumpSuit!}
          size={16}
          color={suitColor(state.trumpSuit!)}
        />
        <Text style={centerPanelStyles.centerLine}>
          {`  Contract: ${state.contract} (${playerNames[state.bidWinner ?? ""] ?? state.bidWinner})`}
        </Text>
      </View>
      <View style={styles.trickCross}>
        {gatheringTrick
          ? gatheringTrick.entries.map(({ playerId, card }) => {
              const position = trickPositionFor(playerId);
              const offset = TRICK_SLOT_OFFSETS[position];
              return (
                <View
                  key={playerId}
                  style={[
                    styles.trickSlot,
                    {
                      transform: [
                        { translateX: offset.x },
                        { translateY: offset.y },
                      ],
                    },
                  ]}>
                  <GatherCard
                    card={card}
                    destinationOffset={gatherDestinationOffset!}
                    restRotateDeg={restingRotations?.[playerId] ?? 0}
                  />
                </View>
              );
            })
          : (["top", "left", "bottom", "right"] as TrickPosition[]).map(
              slotFor,
            )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Fixed-size relative box (RN Views are relatively-positioned by default) so the 4 absolutely-
  // positioned trickSlot children can be offset from a shared center point — see
  // TRICK_SLOT_OFFSETS. Sized around CARD_DIMS.normal (trick cards render at size="normal" now,
  // not "small" — see isHumanPending's doc comment above) plus room for the cross-overlap
  // offsets; TRICK_SLOT_OFFSETS itself is still tuned for the old, smaller card footprint and
  // will read as much heavier overlap now — worth a visual pass to retune if that's not the look
  // you want.
  trickCross: { width: 200, height: 220, alignSelf: "center" },
  trickSlot: {
    position: "absolute",
    left: "50%",
    top: "50%",
    marginLeft: -CARD_DIMS.normal.width / 2,
    marginTop: -CARD_DIMS.normal.height / 2,
    width: CARD_DIMS.normal.width,
    height: CARD_DIMS.normal.height,
    alignItems: "center",
    justifyContent: "center",
  },
});
