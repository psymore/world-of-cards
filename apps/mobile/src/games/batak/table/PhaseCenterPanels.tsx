import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Suit } from '@world-cards/engine';
import type { BatakState, BatakMove } from '@world-cards/engine/games/batak';
import { PressableFeedback, SuitIcon } from '@world-cards/ui';
import { centerPanelStyles } from './centerPanelStyles';
import { DecisionPanel } from './DecisionPanel';
import { suitColor } from './suitColor';

const SUITS: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];

export function BiddingCenter({
  state,
  playerNames,
}: {
  state: BatakState;
  playerNames: Record<string, string>;
}) {
  const leaderId = state.players.find((p) => state.bids[p] === state.highestBid);
  return (
    <View style={centerPanelStyles.centerPanel}>
      <Text style={centerPanelStyles.centerHeading}>Bidding</Text>
      <Text style={centerPanelStyles.centerLine}>
        {state.highestBid > 0
          ? `Highest bid: ${state.highestBid} (${playerNames[leaderId ?? ''] ?? leaderId})`
          : 'No bids yet'}
      </Text>
    </View>
  );
}

export function TrumpWaitingCenter({
  state,
  playerNames,
}: {
  state: BatakState;
  playerNames: Record<string, string>;
}) {
  return (
    <View style={centerPanelStyles.centerPanel}>
      <Text style={centerPanelStyles.centerHeading}>
        {`${playerNames[state.bidWinner ?? ''] ?? state.bidWinner} is choosing trump…`}
      </Text>
    </View>
  );
}

export function TrumpSuitPicker({
  state,
  onMove,
}: {
  state: BatakState;
  onMove: (move: BatakMove) => void;
}) {
  return (
    <DecisionPanel>
      <Text style={[centerPanelStyles.centerHeading, styles.trumpModalHeading]}>
        {`Choose trump (contract: ${state.contract})`}
      </Text>
      <View style={centerPanelStyles.suitRow}>
        {SUITS.map((suit) => (
          <PressableFeedback
            key={suit}
            onPress={() => onMove({ type: 'selectTrump', suit })}
            style={centerPanelStyles.suitButton}
            overlayBorderRadius={22}
            accessibilityRole="button">
            <SuitIcon suit={suit} size={28} color={suitColor(suit)} />
          </PressableFeedback>
        ))}
      </View>
    </DecisionPanel>
  );
}

const styles = StyleSheet.create({
  // Only the trump modal's heading needs breathing room above the suit row — the bid modal has no
  // heading of its own, and the ambient centerPanel instances already get spacing from their own
  // `gap`, so this stays scoped here rather than added to the shared centerHeading style.
  trumpModalHeading: { marginBottom: 12 },
});
