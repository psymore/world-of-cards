import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { BODY_REGULAR, BODY_SEMIBOLD, PressableFeedback } from '@world-of-cards/ui';
import type { GameCategory } from '@world-of-cards/engine';
import { MiniCardFan } from './MiniCardFan';
import { accentColorForCategory, categoryLabel, playerRangeLabel } from './gameDisplay';
import { useReducedMotion } from '../../components/useReducedMotion';

export interface GameMenuRowProps {
  displayName: string;
  category: GameCategory;
  minPlayers: number;
  maxPlayers: number;
  onPress: () => void;
  entranceDelayMs?: number;
  testID?: string;
}

export const GameMenuRow = React.memo(function GameMenuRow({
  displayName,
  category,
  minPlayers,
  maxPlayers,
  onPress,
  entranceDelayMs = 0,
  testID,
}: GameMenuRowProps) {
  const accent = accentColorForCategory(category);
  const subtitle = `${categoryLabel(category)} · ${playerRangeLabel(minPlayers, maxPlayers)}`;
  const reducedMotion = useReducedMotion();
  const progress = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;

  useEffect(() => {
    if (reducedMotion) {
      progress.setValue(1);
      return;
    }
    Animated.timing(progress, {
      toValue: 1,
      duration: 260,
      delay: entranceDelayMs,
      useNativeDriver: true,
    }).start();
  }, [reducedMotion, entranceDelayMs, progress]);

  return (
    <Animated.View
      style={{
        opacity: progress,
        transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
      }}>
      <PressableFeedback
        onPress={onPress}
        testID={testID}
        style={[styles.row, { borderLeftColor: accent }]}
        overlayBorderRadius={12}>
        <MiniCardFan />
        <View style={styles.textBlock}>
          <Text style={styles.name}>{displayName}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
      </PressableFeedback>
    </Animated.View>
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
  // #f2e6ff (lavender) was a leftover from this screen's pre-gold-palette purple design phase —
  // replaced with the same gold/cream pairing established everywhere else (SeatIdentity,
  // BatakSetupView, the modals touched in this same pass).
  name: { fontFamily: BODY_SEMIBOLD, fontSize: 14, color: '#f4c542', letterSpacing: 0.3 },
  subtitle: { fontFamily: BODY_REGULAR, fontSize: 11, color: '#f5f0e6', opacity: 0.75, marginTop: 2 },
});
