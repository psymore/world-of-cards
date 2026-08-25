import React from 'react';
import { Image, Modal, StyleSheet, Text, View } from 'react-native';
import {
  BODY_REGULAR,
  DISPLAY_BOLD,
  MODAL_CARD_SMALL_ASPECT_RATIO,
  MODAL_CARD_SMALL_IMAGE,
  PlaqueButton,
} from '@world-of-cards/ui';
import type { PlayerId, ScoreBoard } from '@world-of-cards/engine';

export interface GameResultModalProps {
  scores: ScoreBoard;
  winners: PlayerId[];
  playerNames: Record<PlayerId, string>;
  humanPlayerId: PlayerId;
  onPlayAgain: () => void;
  onBackHome: () => void;
  // Partnerships, if this game has any (e.g. 4-player "with a partner" mode). When two
  // teammates both win, they share one pooled score and both appear in `winners` — that's a
  // clean win for their team, not a tie, so tie detection needs to count distinct *teams*
  // among the winners rather than just the number of winning player ids.
  teams?: PlayerId[][];
}

function teamKey(playerId: PlayerId, teams: PlayerId[][] | undefined): string {
  const team = teams?.find((t) => t.includes(playerId));
  return team ? team.slice().sort().join('+') : playerId;
}

// Card sizing matches BatakSettingsModal's own contain-fit approach against
// MODAL_CARD_SMALL_ASPECT_RATIO — kept as a plain constant here (not useWindowDimensions) since
// this modal's content is a short, fixed set of lines that never needs to react to window size
// beyond a simple cap.
const CARD_WIDTH = 300;
const CARD_PADDING = 24;
// MODAL_CARD_SMALL_ASPECT_RATIO's own proportions, kept as a *minimum* height (not a fixed one —
// see styles.card) so a longer scoreboard (4 players, long names) can grow the card taller instead
// of clipping under a fixed height, which is what pushed the actions row below the card's visible
// bottom edge for anything longer than 2 short lines.
const CARD_MIN_HEIGHT = CARD_WIDTH / MODAL_CARD_SMALL_ASPECT_RATIO;
const ACTIONS_GAP = 12;
// Two side-by-side buttons must fit within the card's content width (CARD_WIDTH minus its own
// horizontal padding on each side, minus the gap between them) — computed from CARD_WIDTH/
// CARD_PADDING/ACTIONS_GAP directly instead of a separate hardcoded guess, so the two can never
// drift out of sync and push the buttons past the card's own edges again.
const ACTION_BUTTON_WIDTH = (CARD_WIDTH - CARD_PADDING * 2 - ACTIONS_GAP) / 2;
// typography.png's own "Positive (WIN)" / "Negative (LOSS)" value-display colors (section 9) —
// the headline is the one place in this modal a plain win/lose result benefits from that
// semantic color instead of the gold used for every other heading in this pass. A tie stays gold
// (neutral, matches every other heading) rather than picking a third color for a rare case.
const WIN_COLOR = '#5cb95c';
const LOSE_COLOR = '#d64545';

export function GameResultModal({
  scores,
  winners,
  playerNames,
  humanPlayerId,
  onPlayAgain,
  onBackHome,
  teams,
}: GameResultModalProps) {
  const winningTeamKeys = new Set(winners.map((w) => teamKey(w, teams)));
  const isTie = winningTeamKeys.size > 1;
  const humanWon = !isTie && winners.includes(humanPlayerId);
  const headline = isTie ? "It's a tie!" : humanWon ? 'You win!' : 'You lose';
  const headlineColor = isTie ? undefined : humanWon ? WIN_COLOR : LOSE_COLOR;

  return (
    <Modal transparent animationType="fade" visible>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Image
            source={MODAL_CARD_SMALL_IMAGE}
            resizeMode="stretch"
            style={[StyleSheet.absoluteFill, styles.cardImage]}
          />
          <View style={styles.content}>
            <Text style={[styles.headline, headlineColor ? { color: headlineColor } : null]}>{headline}</Text>
            {Object.keys(scores).map((playerId) => (
              <Text key={playerId} style={styles.scoreLine}>
                {(playerNames[playerId] ?? playerId) + ': ' + scores[playerId]}
              </Text>
            ))}
            <View style={styles.actions}>
              <PlaqueButton label="Play Again" onPress={onPlayAgain} width={ACTION_BUTTON_WIDTH} />
              <PlaqueButton label="Back to Home" onPress={onBackHome} width={ACTION_BUTTON_WIDTH} />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  // No backgroundColor/borderRadius of its own — MODAL_CARD_SMALL_IMAGE (an absoluteFill sibling,
  // painted first) is the entire visible card, gold rim baked in — same convention as
  // BatakSettingsModal's identical card.
  card: {
    width: CARD_WIDTH,
    minHeight: CARD_MIN_HEIGHT,
    overflow: 'hidden',
  },
  cardImage: { width: '100%', height: '100%' },
  // 2026-08-25: padding lives here, not on `card` — `card` also hosts cardImage's absoluteFill
  // sibling, and an absolutely-positioned child's 0-offsets resolve against the *padding* edge of
  // its containing block, not the border edge. Padding directly on `card` was silently shrinking
  // the background art to the card's inner content box while the actions row still measured
  // against the full card, making the buttons look like they'd overflowed it (the original report
  // this pass was chasing) — same root cause as BatakSettingsModal's identical bug.
  content: { flex: 1, padding: CARD_PADDING, justifyContent: 'center' },
  headline: { fontFamily: DISPLAY_BOLD, fontSize: 24, marginBottom: 12, textAlign: 'center', color: '#f4c542' },
  scoreLine: { fontFamily: BODY_REGULAR, fontSize: 16, marginBottom: 4, textAlign: 'center', color: '#f5f0e6' },
  actions: { flexDirection: 'row', justifyContent: 'center', gap: ACTIONS_GAP, marginTop: 16 },
});
