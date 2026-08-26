import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  BODY_REGULAR,
  BODY_SEMIBOLD,
  DISPLAY_BOLD,
  IconButton,
  ICON_HOME_IMAGE,
  PressableFeedback,
  TableFelt,
} from '@world-of-cards/ui';
import type { Difficulty } from '@world-of-cards/engine';
import { useSettingsStore } from '../../state/settingsStore';
import { DifficultyStars } from '../../components/DifficultyStars';

const HOME_ICON_SIZE = 32;

export type PisYedeliPlayerCount = 2 | 3 | 4;

export interface PisYedeliSetupViewProps {
  defaultDifficulty: Difficulty;
  onStart: (difficulty: Difficulty, playerCount: PisYedeliPlayerCount) => void;
  onBack: () => void;
}

const DIFFICULTIES: { value: Difficulty; label: string }[] = [
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
];

const PLAYER_COUNTS: { value: PisYedeliPlayerCount; label: string }[] = [
  { value: 2, label: '2 Players' },
  { value: 3, label: '3 Players' },
  { value: 4, label: '4 Players' },
];

export function PisYedeliSetupView({ defaultDifficulty, onStart, onBack }: PisYedeliSetupViewProps) {
  const [playerCount, setPlayerCount] = useState<PisYedeliPlayerCount>(2);

  function handlePress(value: Difficulty) {
    useSettingsStore.getState().setDefaultDifficulty(value);
    onStart(value, playerCount);
  }

  return (
    <View style={styles.container}>
      <TableFelt />
      <View style={styles.header}>
        <Text style={styles.pageTitle}>Pis Yedili</Text>
        <IconButton
          source={ICON_HOME_IMAGE}
          size={HOME_ICON_SIZE}
          onPress={onBack}
          accessibilityLabel="Home"
          testID="pis-yedili-setup-home-button"
        />
      </View>

      <Text style={styles.title}>Table size</Text>
      <View style={styles.playerCountRow}>
        {PLAYER_COUNTS.map(({ value, label }) => (
          <PressableFeedback
            key={value}
            onPress={() => setPlayerCount(value)}
            style={[styles.playerCountOption, value === playerCount && styles.optionDefault]}
            overlayBorderRadius={8}>
            <Text style={styles.optionText}>{label}</Text>
          </PressableFeedback>
        ))}
      </View>

      <Text style={styles.title}>Choose a difficulty</Text>
      {DIFFICULTIES.map(({ value, label }) => (
        <PressableFeedback
          key={value}
          onPress={() => handlePress(value)}
          style={[styles.option, value === defaultDifficulty && styles.optionDefault]}
          overlayBorderRadius={8}>
          <View style={styles.difficultyRow}>
            <Text style={styles.optionText}>{label}</Text>
            <DifficultyStars difficulty={value} />
          </View>
          {value === defaultDifficulty && <Text style={styles.defaultBadge}>Last played</Text>}
        </PressableFeedback>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 48, paddingHorizontal: 16, backgroundColor: '#0a2e1f' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 },
  pageTitle: {
    fontFamily: DISPLAY_BOLD,
    fontSize: 26,
    color: '#f4c542',
    letterSpacing: 1,
    textShadowColor: '#7a5c00',
    textShadowRadius: 6,
  },
  title: { fontFamily: BODY_SEMIBOLD, fontSize: 18, marginBottom: 16, textAlign: 'center', color: '#f5f0e6' },
  option: {
    backgroundColor: 'rgba(255,255,255,0.09)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    borderRadius: 8,
    paddingVertical: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  optionDefault: { borderColor: '#f4c542', backgroundColor: 'rgba(244, 197, 66, 0.2)' },
  difficultyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  optionText: { fontFamily: BODY_REGULAR, fontSize: 18, color: '#eee' },
  defaultBadge: { fontFamily: BODY_SEMIBOLD, fontSize: 12, color: '#f4c542', marginTop: 2 },
  playerCountRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  playerCountOption: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.09)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
});
