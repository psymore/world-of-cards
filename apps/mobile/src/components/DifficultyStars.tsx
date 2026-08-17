import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { ICON_STAR_IMAGE } from '@world-cards/ui';
import type { Difficulty } from '@world-cards/engine';

const FILLED_STARS: Record<Difficulty, number> = { easy: 1, medium: 2, hard: 3 };
const MAX_STARS = 3;
const STAR_SIZE = 14;

export interface DifficultyStarsProps {
  difficulty: Difficulty;
}

// A per-difficulty rating glyph (1/2/3 gold stars for Easy/Medium/Hard) shown alongside the
// difficulty label on both games' setup screens — cheap scan-ability win over text alone, using
// the same icon-sheet cut (icon-star.png) as this session's other icon work.
export function DifficultyStars({ difficulty }: DifficultyStarsProps) {
  const filled = FILLED_STARS[difficulty];
  return (
    <View style={styles.row}>
      {Array.from({ length: MAX_STARS }, (_, i) => (
        <Image
          key={i}
          source={ICON_STAR_IMAGE}
          resizeMode="contain"
          style={[styles.star, i >= filled && styles.starDim]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 3 },
  star: { width: STAR_SIZE, height: STAR_SIZE },
  starDim: { opacity: 0.25 },
});
