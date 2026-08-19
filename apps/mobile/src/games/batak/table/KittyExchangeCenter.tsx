import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Card } from '@world-of-cards/engine';
import type { BatakState } from '@world-of-cards/engine/games/batak';
import { PressableFeedback } from '@world-of-cards/ui';
import { centerPanelStyles } from './centerPanelStyles';
import { BurySlots } from './BurySlots';
import { GatherCard } from '../../../table/GatherCard';
import { KittyCollectCard } from '../../../table/KittyRevealCard';
import { revealOriginOffset } from '../../../table/seating';
import type { PendingBury } from '../BatakScreen';

export function KittyExchangeCenter({
  state,
  playerNames,
  humanPlayerId,
  slotCardIds,
  cardsById,
  onTapSlotCard,
  canConfirm,
  onConfirm,
  pendingBury,
}: {
  state: BatakState;
  playerNames: Record<string, string>;
  humanPlayerId: string;
  slotCardIds: (string | null)[];
  cardsById: Map<string, Card>;
  onTapSlotCard: (cardId: string) => void;
  canConfirm: boolean;
  onConfirm: () => void;
  pendingBury?: PendingBury | null;
}) {
  const isHumanBidder = state.bidWinner === humanPlayerId;
  const statusText = isHumanBidder
    ? 'Choose four cards to bury.'
    : `${playerNames[state.bidWinner ?? ''] ?? state.bidWinner} is choosing four cards to bury…`;

  if (pendingBury && pendingBury.stage === 'burying') {
    const buriedCards = pendingBury.cardIds
      .map((id) => state.table.zones[`hand-${pendingBury.playerId}`].cards.find((c) => c.id === id))
      .filter((c): c is Card => c != null);
    return (
      <View style={centerPanelStyles.centerPanel}>
        <Text style={centerPanelStyles.centerHeading}>{statusText}</Text>
        <View style={styles.buryFlightRow} testID="kitty-burying">
          {buriedCards.map((card) =>
            isHumanBidder ? (
              <GatherCard key={card.id} card={card} destinationOffset={revealOriginOffset('top')} />
            ) : (
              <KittyCollectCard
                key={card.id}
                card={card}
                destinationOffset={revealOriginOffset('top')}
                faceDown
              />
            ),
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={centerPanelStyles.centerPanel}>
      <Text style={centerPanelStyles.centerHeading}>{statusText}</Text>
      {isHumanBidder && !pendingBury && (
        <>
          <BurySlots slotCardIds={slotCardIds} cardsById={cardsById} onTapCard={onTapSlotCard} />
          <PressableFeedback
            onPress={onConfirm}
            disabled={!canConfirm}
            accessibilityRole="button"
            style={[styles.confirmButton, !canConfirm && styles.confirmButtonDisabled]}
            overlayBorderRadius={8}>
            <Text style={styles.confirmText}>Confirm</Text>
          </PressableFeedback>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  buryFlightRow: { flexDirection: 'row', gap: 10, minHeight: 56 },
  confirmButton: {
    marginTop: 4,
    paddingVertical: 8,
    paddingHorizontal: 24,
    borderRadius: 8,
    backgroundColor: '#f4c542',
  },
  confirmButtonDisabled: { backgroundColor: 'rgba(244, 197, 66, 0.35)' },
  confirmText: { fontSize: 15, fontWeight: '700', color: '#12121f' },
});
