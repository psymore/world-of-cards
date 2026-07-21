import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Card } from '@world-cards/engine';
import type { BatakState } from '@world-cards/engine/games/batak';
import { centerPanelStyles } from './centerPanelStyles';
import { BurySlots } from './BurySlots';

export function KittyExchangeCenter({
  state,
  playerNames,
  humanPlayerId,
  slotCardIds,
  cardsById,
  onTapSlotCard,
  canConfirm,
  onConfirm,
}: {
  state: BatakState;
  playerNames: Record<string, string>;
  humanPlayerId: string;
  slotCardIds: (string | null)[];
  cardsById: Map<string, Card>;
  onTapSlotCard: (cardId: string) => void;
  canConfirm: boolean;
  onConfirm: () => void;
}) {
  const isHumanBidder = state.bidWinner === humanPlayerId;
  const statusText = isHumanBidder
    ? 'Choose four cards to bury.'
    : `${playerNames[state.bidWinner ?? ''] ?? state.bidWinner} is choosing four cards to bury…`;

  return (
    <View style={centerPanelStyles.centerPanel}>
      <Text style={centerPanelStyles.centerHeading}>{statusText}</Text>
      {isHumanBidder && (
        <>
          <BurySlots slotCardIds={slotCardIds} cardsById={cardsById} onTapCard={onTapSlotCard} />
          <Pressable
            onPress={onConfirm}
            disabled={!canConfirm}
            accessibilityRole="button"
            style={[styles.confirmButton, !canConfirm && styles.confirmButtonDisabled]}>
            <Text style={styles.confirmText}>Confirm</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
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
