import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Card } from '@world-cards/engine';
import type { BatakState } from '@world-cards/engine/games/batak';
import { PlayingCard, SuitIcon, CARD_DIMS } from '@world-cards/ui';
import { TravelCard } from '../../../table/TravelCard';
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

export function TrickCenter({
  state,
  seats,
  humanPlayerId,
  playerNames,
  pendingPlay,
  gatheringTrick,
  destRef,
  onDestLayout,
}: {
  state: BatakState;
  seats: Seat[];
  humanPlayerId: string;
  playerNames: Record<string, string>;
  pendingPlay?: PendingBatakPlay | null;
  gatheringTrick?: GatheringTrick | null;
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
            <TravelCard
              originOffset={
                pendingPlay?.originOffset ?? revealOriginOffset(resolveRevealOrigin(playerId!, humanPlayerId, seats))
              }
              resetKey={card.id}>
              <PlayingCard card={card} size="small" />
            </TravelCard>
          ) : (
            <PlayingCard card={card} size="small" />
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
                  <GatherCard card={card} destinationOffset={gatherDestinationOffset!} />
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
