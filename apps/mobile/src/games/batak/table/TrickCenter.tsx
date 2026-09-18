import React from "react";
import { StyleSheet, Text, View } from "react-native";
import type { Card } from "@world-of-cards/engine";
import type { BatakState } from "@world-of-cards/engine/games/batak";
import { PlayingCard, SuitIcon, CARD_DIMS } from "@world-of-cards/ui";
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
// over a tighter ~40%-overlap alternative). Base pixel values were tuned by eye against the
// original full-size trick card, then scaled by TRICK_CARD_SCALE below as a first pass to
// preserve that same relative overlap at the new, smaller trick-card footprint — re-tune
// BASE_TRICK_SLOT_OFFSETS directly if the proportional scaling doesn't look right once checked
// live.
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
    // Only set when BatakHandCard's local-departure leg actually ran (see BatakScreen.tsx's
    // armPendingPlay) — that leg already did the shrink to TRICK_CARD_SCALE before this
    // component ever mounts. When it didn't run (ENABLE_LOCAL_DEPARTURE off, or a too-short
    // measured origin), the card is still at full size at mount time and needs this component to
    // do the shrink itself instead — see the humanPreShrunk usage below.
    const humanPreShrunk = pendingPlay?.travelDurationMs != null;
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
              // originRotateDeg doc comment). The card stays size="normal" throughout and is
              // uniformly scaled, never switched to the real size="small" variant, whose internal
              // proportions (CORNER_INDEX_WIDTH, WATERMARK_ICON_SIZE in
              // packages/ui/src/PlayingCard.tsx) are independently tuned rather than a uniform
              // scale of "normal"'s. TRICK_CARD_CONTENT_SCALE compensates the corner index/
              // watermark so the shrunk card doesn't read with oversized glyphs.
              <TravelCard
                originOffset={
                  pendingPlay?.originOffset ?? revealOriginOffset("bottom")
                }
                originRotateDeg={pendingPlay?.originRotateDeg ?? 0}
                // humanPreShrunk (local-departure ran): held constant — already at
                // TRICK_CARD_SCALE by the time this component mounts, so no re-interpolation
                // needed. Otherwise (local-departure skipped, e.g. ENABLE_LOCAL_DEPARTURE off):
                // the card is still at full size at mount time, so this interpolates 1 →
                // TRICK_CARD_SCALE itself — the same uniform-within-"normal" interpolation
                // already proven safe below for AI plays. Without this branch, disabling
                // local-departure would make the card visibly snap straight to TRICK_CARD_SCALE
                // the instant it starts flying, instead of shrinking smoothly.
                originScale={humanPreShrunk ? TRICK_CARD_SCALE : 1}
                restScale={TRICK_CARD_SCALE}
                durationMs={pendingPlay?.travelDurationMs}
                resetKey={card.id}>
                <PlayingCard card={card} size="normal" contentScale={TRICK_CARD_CONTENT_SCALE} />
              </TravelCard>
            ) : (
              // An AI's played card: no rendered per-card hand visual exists to depart from (see
              // the 2026-07-18 turn-indicator-simplification pass), so this stays translate-only.
              <TravelCard
                originOffset={
                  pendingPlay?.originOffset ??
                  revealOriginOffset(
                    resolveRevealOrigin(playerId!, humanPlayerId, seats),
                  )
                }
                // Held constant at TRICK_CARD_SCALE for the whole flight — no resize-in-flight.
                // AI plays have no local-departure leg to pre-shrink during (unlike the human
                // branch above), so this arrives at the trick already at its resting size instead
                // of visibly shrinking from full size mid-flight.
                originScale={TRICK_CARD_SCALE}
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
                    // Passed explicitly (GatherCard defaults both to 1) so the sweeping card keeps
                    // the exact footprint of the resting card it replaces — GatherCard itself is
                    // shared and game-agnostic, so it can't assume Batak's trick-card proportions.
                    cardScale={TRICK_CARD_SCALE}
                    contentScale={TRICK_CARD_CONTENT_SCALE}
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
  // offsets; TRICK_SLOT_OFFSETS is itself rescaled by TRICK_CARD_SCALE (see
  // BASE_TRICK_SLOT_OFFSETS above), so the cross keeps the same relative overlap at the smaller
  // trick-card footprint. These box dimensions were deliberately left unshrunk even though the
  // painted cards are now smaller — harmless, since every slot is absolutely positioned and
  // center-anchored — but worth an explicit look during on-device verification if the center
  // panel reads as having too much reserved empty space around a now-smaller trick.
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
