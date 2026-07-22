import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Card } from '@world-cards/engine';
import type { BatakState } from '@world-cards/engine/games/batak';
import { PlayingCard, SuitIcon, CARD_DIMS } from '@world-cards/ui';
import { TravelCard } from '../../../table/TravelCard';
import { SELECTED_SCALE } from '../../../components/SelectableCard';
import { GatherCard } from '../../../table/GatherCard';
import { resolveRevealOrigin, revealOriginOffset } from '../../../table/seating';
import type { Seat, SeatPosition } from '../../../table/seating';
import { centerPanelStyles } from './centerPanelStyles';
import { suitColor } from './suitColor';
import type { PendingBatakPlay, GatheringTrick } from './types';

export type TrickPosition = 'bottom' | SeatPosition;

// Resting offset from dead-center for each seat's slot — small enough (vs. the ~165-195px
// travel-origin offsets below) that adjacent slots' card rectangles overlap slightly at their
// inner corners ("loose, corner-touching" per the brainstorming visual companion mockup, chosen
// over a tighter ~40%-overlap alternative). First-pass values sized against the 'small' card's
// CARD_DIMS.small footprint — confirm via screenshot in the final verification pass.
const TRICK_SLOT_OFFSETS: Record<TrickPosition, { x: number; y: number }> = {
  top: { x: 0, y: -38 },
  bottom: { x: 0, y: 38 },
  left: { x: -30, y: 0 },
  right: { x: 30, y: 0 },
};

// The played card travels at its real, in-hand `size="normal"` for the whole flight (never
// swapping the underlying `size` prop mid-flight, which would force a layout recalculation
// instead of a cheap transform) and is scaled down to this ratio by the time it lands, so it
// occupies the exact same footprint as the real `size="small"` resting trick card. See
// docs/superpowers/specs/2026-07-21-batak-card-play-animation-smoothness-design.md.
const NORMAL_TO_SMALL_SCALE = CARD_DIMS.small.width / CARD_DIMS.normal.width;

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
    if (playerId === humanPlayerId) return 'bottom';
    return seats.find((s) => s.playerId === playerId)?.position ?? 'top';
  }

  function cardFor(playerId: string): Card | null {
    if (pendingPlay != null && pendingPlay.playerId === playerId) return pendingPlay.card;
    const entry = state.currentTrick.find((t) => t.playerId === playerId);
    if (!entry) return null;
    return state.table.zones['trick'].cards.find((c) => c.id === entry.cardId) ?? null;
  }

  // Play order across both already-committed cards and the still-animating pendingPlay (always
  // the newest) — drives each slot's zIndex so the most recently played card renders on top of
  // earlier ones regardless of which seat played it. Trick slots are seat-fixed (TRICK_SLOT_OFFSETS
  // above), so without this the overlap stacking would silently depend on seat position instead
  // of when each card actually arrived.
  const playOrder: string[] = [
    ...state.currentTrick.map((t) => t.playerId),
    ...(pendingPlay ? [pendingPlay.playerId] : []),
  ];

  function slotFor(position: TrickPosition) {
    const playerId = position === 'bottom' ? humanPlayerId : seats.find((s) => s.position === position)?.playerId;
    const card = playerId ? cardFor(playerId) : null;
    const isPending = playerId != null && pendingPlay != null && pendingPlay.playerId === playerId;
    const isHumanPending = isPending && playerId === humanPlayerId;
    const zIndex = playerId ? Math.max(playOrder.indexOf(playerId) + 1, 1) : 1;
    const offset = TRICK_SLOT_OFFSETS[position];

    return (
      <View
        key={position}
        testID={`trick-slot-${position}`}
        ref={position === 'bottom' ? destRef : undefined}
        onLayout={position === 'bottom' ? onDestLayout : undefined}
        style={[
          styles.trickSlot,
          { zIndex, transform: [{ translateX: offset.x }, { translateY: offset.y }] },
        ]}>
        {card ? (
          isPending ? (
            isHumanPending ? (
              // The human's own played card: travels at its real in-hand size and its real
              // fan-rotation angle held fixed for the whole flight (not straightened out along
              // the way — see TravelCard's originRotateDeg doc comment), easing only its
              // selected-lift scale down to the resting trick-card size, instead of snapping to a
              // fresh, flat, differently-sized card the instant it starts moving.
              <TravelCard
                originOffset={pendingPlay?.originOffset ?? revealOriginOffset('bottom')}
                originRotateDeg={pendingPlay?.originRotateDeg ?? 0}
                originScale={SELECTED_SCALE}
                restScale={NORMAL_TO_SMALL_SCALE}
                durationMs={pendingPlay?.travelDurationMs}
                resetKey={card.id}>
                <PlayingCard card={card} size="normal" />
              </TravelCard>
            ) : (
              // An AI's played card: no rendered per-card hand visual exists to depart from (see
              // the 2026-07-18 turn-indicator-simplification pass), so this stays translate-only,
              // unchanged from before.
              <TravelCard
                originOffset={
                  pendingPlay?.originOffset ??
                  revealOriginOffset(resolveRevealOrigin(playerId!, humanPlayerId, seats))
                }
                resetKey={card.id}>
                <PlayingCard card={card} size="small" />
              </TravelCard>
            )
          ) : (
            // Resting (already landed, trick not yet gathered): keeps the exact angle it arrived
            // at — see restingRotations' doc comment above — rather than snapping flat/parallel
            // to the table edges the instant TravelCard hands off.
            <PlayingCard
              card={card}
              size="small"
              style={{ transform: [{ rotate: `${restingRotations?.[playerId!] ?? 0}deg` }] }}
            />
          )
        ) : null}
      </View>
    );
  }

  const gatherDestinationOffset = gatheringTrick
    ? revealOriginOffset(resolveRevealOrigin(gatheringTrick.winnerId, humanPlayerId, seats))
    : null;

  return (
    <View style={centerPanelStyles.centerPanel}>
      <View style={centerPanelStyles.trumpRow}>
        <Text style={centerPanelStyles.centerLine}>Trump:</Text>
        <SuitIcon suit={state.trumpSuit!} size={16} color={suitColor(state.trumpSuit!)} />
        <Text style={centerPanelStyles.centerLine}>
          {`  Contract: ${state.contract} (${playerNames[state.bidWinner ?? ''] ?? state.bidWinner})`}
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
                    { transform: [{ translateX: offset.x }, { translateY: offset.y }] },
                  ]}>
                  <GatherCard
                    card={card}
                    destinationOffset={gatherDestinationOffset!}
                    restRotateDeg={restingRotations?.[playerId] ?? 0}
                  />
                </View>
              );
            })
          : (['top', 'left', 'bottom', 'right'] as TrickPosition[]).map(slotFor)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Fixed-size relative box (RN Views are relatively-positioned by default) so the 4 absolutely-
  // positioned trickSlot children can be offset from a shared center point — see
  // TRICK_SLOT_OFFSETS. Sized generously around the small card's CARD_DIMS.small footprint plus
  // the loose cross-overlap offsets; confirm via screenshot in the final verification pass.
  trickCross: { width: 160, height: 180, alignSelf: 'center' },
  trickSlot: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    marginLeft: -CARD_DIMS.small.width / 2,
    marginTop: -CARD_DIMS.small.height / 2,
    width: CARD_DIMS.small.width,
    height: CARD_DIMS.small.height,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
