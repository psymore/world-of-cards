import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { GameCategory } from '@world-cards/engine';
import { MiniCardFan } from './MiniCardFan';
import { accentColorForCategory, categoryLabel, playerRangeLabel } from './gameDisplay';

export interface GameMenuRowProps {
  displayName: string;
  category: GameCategory;
  minPlayers: number;
  maxPlayers: number;
  onPress: () => void;
  testID?: string;
}

export const GameMenuRow = React.memo(function GameMenuRow({
  displayName,
  category,
  minPlayers,
  maxPlayers,
  onPress,
  testID,
}: GameMenuRowProps) {
  const accent = accentColorForCategory(category);
  const subtitle = `${categoryLabel(category)} · ${playerRangeLabel(minPlayers, maxPlayers)}`;
  return (
    <Pressable onPress={onPress} testID={testID} style={[styles.row, { borderLeftColor: accent }]}>
      <MiniCardFan />
      <View style={styles.textBlock}>
        <Text style={styles.name}>{displayName}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: '#d9b34a55',
    borderLeftWidth: 3,
  },
  textBlock: { flex: 1 },
  name: { fontSize: 14, fontWeight: '600', color: '#f2e6ff', letterSpacing: 0.3 },
  subtitle: { fontSize: 11, color: '#f2e6ff', opacity: 0.55, marginTop: 2 },
});
