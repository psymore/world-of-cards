import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, Text } from "react-native";
import { PressableFeedback } from "@world-cards/ui";
import type { Difficulty, PlayerId, RNG } from "@world-cards/engine";
import { createRng } from "@world-cards/engine";
import {
  batakDescriptor,
  BatakState,
  BatakMove,
  trickWinnerIndex,
} from "@world-cards/engine/games/batak";
import { createGameSessionStore } from "../../state/createGameSessionStore";
import { useSettingsStore } from "../../state/settingsStore";
import { GameScreenLayout } from "../../components/GameScreenLayout";
import { GameResultModal } from "../../components/GameResultModal";
import { useReducedMotion } from "../../components/useReducedMotion";
import { useAITurn } from "../../hooks/useAITurn";
import { useDealSequence } from "../../hooks/useDealSequence";
import { CARD_TRAVEL_DURATION_MS } from "../../table/travelAnimation";
import { BatakSetupView } from "./BatakSetupView";
import { BatakTable, PendingBatakPlay, GatheringTrick } from "./BatakTable";
import {
  LOCAL_DEPARTURE_DISTANCE,
  LOCAL_DEPARTURE_DURATION_MS,
} from "./table/HumanHandFan";
import { BatakSettingsModal } from "./BatakSettingsModal";
import { BatakDevTuningModal } from "./BatakDevTuningModal";
import type { BatakVariant } from "./batakVariant";

const HUMAN_ID: PlayerId = "human";

const AI_IDS_BY_VARIANT: Record<BatakVariant, PlayerId[]> = {
  standard: ["ai-1", "ai-2", "ai-3"],
  gomeli: ["ai-1", "ai-2"],
};

const PLAYER_NAMES_BY_VARIANT: Record<
  BatakVariant,
  Record<PlayerId, string>
> = {
  standard: {
    [HUMAN_ID]: "You",
    "ai-1": "AI 1",
    "ai-2": "AI 2",
    "ai-3": "AI 3",
  },
  gomeli: {
    [HUMAN_ID]: "You",
    "ai-1": "AI 1",
    "ai-2": "AI 2",
  },
};

// Pause before a trick-completing 4th play actually commits, so the full 4-card trick is
// readable before it sweeps to the winner's pile. batakGame.performMove resolves a completed
// trick atomically (computes the winner and sweeps to won-<winner> within one call), so without
// this pause the UI would show the 4th card appear and the whole trick vanish in the same
// instant, with no way to see what everyone played.
const TRICK_COMPLETION_PAUSE_MS = 1100;
// Pause before a non-trick-completing play (1st-3rd card of a trick) commits, giving the new
// play-travel animation (BatakTable's TrickCenter) time to finish before the card's resting state
// takes over. Derived directly from CARD_TRAVEL_DURATION_MS (the actual TravelCard flight
// duration) plus a small buffer, rather than a separately hand-picked number — this was
// previously a bare 300 next to a 530ms flight, so the commit fired ~230ms before TravelCard
// finished, snapping the card the rest of the way to its resting spot instead of easing in.
const PLAY_TRAVEL_DELAY_MS = CARD_TRAVEL_DURATION_MS + 40;

export interface PendingBury {
  playerId: PlayerId;
  cardIds: [string, string, string, string];
  stage: "burying" | "revealing" | "collecting";
}

// The 3 legs of the staged bury-then-reveal sequence (see
// docs/superpowers/specs/2026-07-21-batak-gomeli-ui-design.md Section 4). First-pass values;
// KITTY_REVEAL_HOLD_MS is the one the spec calls out explicitly (bump to 4000 if 3500 reads as
// too short once it's running) — the two travel durations are ordinary first-pass animation
// timing, tunable like every other duration in this file.
const BURY_TRAVEL_MS = 500;
const KITTY_REVEAL_HOLD_MS = 3500;
const KITTY_COLLECT_MS = 500;

export interface BatakScreenProps {
  onExitToHome: () => void;
}

interface BatakSession {
  difficulty: Difficulty;
  variant: BatakVariant;
  rng: RNG;
  useSessionStore: ReturnType<
    typeof createGameSessionStore<BatakState, BatakMove>
  >;
}

export function BatakScreen({ onExitToHome }: BatakScreenProps) {
  const [session, setSession] = useState<BatakSession | null>(null);
  const [sessionKey, setSessionKey] = useState(0);
  const defaultDifficulty = useSettingsStore(s => s.defaultDifficulty);

  function startGame(difficulty: Difficulty, variant: BatakVariant) {
    const rng = createRng(Date.now());
    const aiIds = AI_IDS_BY_VARIANT[variant];
    const initialState = batakDescriptor.ruleEngine.setup(
      {
        players: [HUMAN_ID, ...aiIds],
        guaranteeStrongHand: difficulty === "easy",
      },
      rng,
    );
    const useSessionStore = createGameSessionStore(
      batakDescriptor.ruleEngine,
      initialState,
    );
    setSession({ difficulty, variant, rng, useSessionStore });
    setSessionKey(k => k + 1);
  }

  if (!session) {
    return (
      <BatakSetupView
        defaultDifficulty={defaultDifficulty}
        onStart={startGame}
        onBack={onExitToHome}
      />
    );
  }

  return (
    <ActiveGame
      key={sessionKey}
      difficulty={session.difficulty}
      variant={session.variant}
      rng={session.rng}
      useSessionStore={session.useSessionStore}
      onPlayAgain={() => startGame(session.difficulty, session.variant)}
      onBackHome={onExitToHome}
    />
  );
}

interface ActiveGameProps {
  difficulty: Difficulty;
  variant: BatakVariant;
  rng: RNG;
  useSessionStore: ReturnType<
    typeof createGameSessionStore<BatakState, BatakMove>
  >;
  onPlayAgain: () => void;
  onBackHome: () => void;
}

function ActiveGame({
  difficulty,
  variant,
  rng,
  useSessionStore,
  onPlayAgain,
  onBackHome,
}: ActiveGameProps) {
  const aiIds = AI_IDS_BY_VARIANT[variant];
  const playerNames = PLAYER_NAMES_BY_VARIANT[variant];
  const state = useSessionStore(s => s.state);
  const performMove = useSessionStore(s => s.performMove);
  const [pendingPlay, setPendingPlay] = useState<PendingBatakPlay | null>(null);
  // deltaX: the horizontal component of the local-departure leg's motion (see canLocalDepart
  // below) — the leg moves the card along the real straight-line vector toward the trick center,
  // not straight up, so HumanHandFan needs this to animate `x` in sync with `y`.
  const [localDeparture, setLocalDeparture] = useState<{
    cardId: string;
    deltaX: number;
  } | null>(null);
  // The angle each currently-in-trick card keeps once it lands — captured from the exact
  // originRotateDeg its TravelCard was frozen at (see
  // docs/superpowers/specs/2026-07-22-batak-travel-preserve-hand-rotation-design.md), so the
  // resting trick display (and the gather-sweep that follows it) never un-rotates a card back to
  // flat. Keyed by playerId, since each player plays at most once per trick; cleared once the
  // trick actually sweeps, since a stale entry would otherwise sit unread until that player's next
  // play overwrites it anyway — cleared just to avoid accumulating dead data across a full hand.
  const [restingRotations, setRestingRotations] = useState<
    Record<PlayerId, number>
  >({});
  const [gatheringTrick, setGatheringTrick] = useState<GatheringTrick | null>(
    null,
  );
  const [pendingBury, setPendingBury] = useState<PendingBury | null>(null);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [devTuningVisible, setDevTuningVisible] = useState(false);
  const pendingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const localDepartureTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const gatherTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const buryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dealPhase = useDealSequence();
  const reducedMotion = useReducedMotion();

  const aiStrategy = batakDescriptor.aiStrategies[difficulty];

  useEffect(() => {
    return () => {
      if (pendingTimeoutRef.current) clearTimeout(pendingTimeoutRef.current);
      if (localDepartureTimeoutRef.current)
        clearTimeout(localDepartureTimeoutRef.current);
      if (gatherTimeoutRef.current) clearTimeout(gatherTimeoutRef.current);
      if (buryTimeoutRef.current) clearTimeout(buryTimeoutRef.current);
    };
  }, []);

  function commitMove(
    move: BatakMove,
    playerId: PlayerId,
    originOffset?: { x: number; y: number },
    originRotateDeg?: number,
  ) {
    if (move.type === "bury") {
      setPendingBury({ playerId, cardIds: move.cardIds, stage: "burying" });
      buryTimeoutRef.current = setTimeout(() => {
        setPendingBury(prev => (prev ? { ...prev, stage: "revealing" } : prev));
        buryTimeoutRef.current = setTimeout(() => {
          setPendingBury(prev =>
            prev ? { ...prev, stage: "collecting" } : prev,
          );
          buryTimeoutRef.current = setTimeout(() => {
            performMove(move);
            setPendingBury(null);
          }, KITTY_COLLECT_MS);
        }, KITTY_REVEAL_HOLD_MS);
      }, BURY_TRAVEL_MS);
      return;
    }
    // Every card play now gets staged (not just the trick-completing 4th) so the new play-travel
    // animation has something to animate from for every play; bid/pass/selectTrump still commit
    // instantly since engine state already reflects them visibly with nothing to bridge.
    if (move.type === "play") {
      const hand = state.table.zones[`hand-${playerId}`].cards;
      const card = hand.find(c => c.id === move.cardId);
      if (!card) {
        performMove(move);
        return;
      }
      // Generalized from the old hardcoded `=== 3` (which only worked for the fixed 4-player
      // game): a trick completes once every player but the current one has already played.
      const isTrickCompleting =
        state.currentTrick.length === state.players.length - 1;
      const delay = isTrickCompleting
        ? TRICK_COMPLETION_PAUSE_MS
        : PLAY_TRAVEL_DELAY_MS;

      // Stages the actual pendingPlay (removes the card from the hand fan, hands it to
      // TrickCenter's globally-elevated TravelCard) — factored out so the human's own play can
      // optionally run the local-departure leg below first, without duplicating the trick-
      // completion logic that follows the delay.
      function armPendingPlay(
        resolvedOriginOffset: { x: number; y: number } | undefined,
        travelDurationMs: number | undefined,
        remainingDelay: number,
      ) {
        // The human hand's own reflow (remaining cards sliding/rising into their new slots) is
        // now animated internally by BatakTable's AnimatedFanCard, driven directly off the
        // shrinking hand array — no LayoutAnimation trigger needed here anymore.
        setPendingPlay({
          playerId,
          card: card!,
          originOffset: resolvedOriginOffset,
          originRotateDeg,
          travelDurationMs,
        });
        pendingTimeoutRef.current = setTimeout(() => {
          setPendingPlay(null);
          // Captured here, at the exact moment the card stops being a TravelCard, so the resting
          // render (or the gather-sweep, if this was the trick-completing 4th play) picks up
          // seamlessly at the identical angle instead of snapping to flat.
          setRestingRotations(prev => ({
            ...prev,
            [playerId]: originRotateDeg ?? 0,
          }));
          if (!isTrickCompleting) {
            performMove(move);
            return;
          }
          // The trick just completed: snapshot all 4 plays + the winner (computed with the exact
          // same pure function the engine itself uses internally) before committing, so
          // GatherCard has a stable 4-card view to animate away from while engine state is still
          // mid-trick — performMove resolves a completed trick atomically and would otherwise
          // leave nothing to animate.
          //
          // The non-null assertions below are safe specifically because `state` here is the
          // pre-4th-play snapshot (captured when this commitMove call started, before performMove
          // has run): the trick zone is guaranteed to already hold the 3 prior cards, and
          // trumpSuit is always set once the game has reached the playing phase.
          const priorEntries = state.currentTrick;
          const priorCards = priorEntries.map(
            e => state.table.zones["trick"].cards.find(c => c.id === e.cardId)!,
          );
          const fullTrickCards = [...priorCards, card!];
          const fullTrickPlayerIds = [
            ...priorEntries.map(e => e.playerId),
            playerId,
          ];
          const winnerPos = trickWinnerIndex(fullTrickCards, state.trumpSuit!);
          const winnerId = fullTrickPlayerIds[winnerPos];
          const entries = fullTrickPlayerIds.map((pid, i) => ({
            playerId: pid,
            card: fullTrickCards[i],
          }));
          setGatheringTrick({ entries, winnerId });
          if (reducedMotion) {
            // GatherCard jumps straight to its faded-out end state under reduced motion (see
            // GatherCard.tsx), so there's nothing left to wait for — arming the full-duration
            // timer here would just leave an empty trick center for CARD_TRAVEL_DURATION_MS
            // before the score updates, with no animation happening to justify the wait.
            performMove(move);
            setGatheringTrick(null);
            setRestingRotations({});
          } else {
            gatherTimeoutRef.current = setTimeout(() => {
              performMove(move);
              setGatheringTrick(null);
              setRestingRotations({});
            }, CARD_TRAVEL_DURATION_MS);
          }
        }, remainingDelay);
      }

      // The human's own play gets a brief local-departure leg first: the card keeps animating
      // inside HumanHandFan's own hand-fan stacking (still potentially "behind" a same-row
      // neighbor, exactly as it was while merely selected) for LOCAL_DEPARTURE_DURATION_MS, and
      // only afterward hands off to TrickCenter's globally-elevated TravelCard — by which point
      // it's moved a full card-height clear of the row, so there's nothing left for it to visibly
      // "pop" in front of. See docs/superpowers/specs/2026-07-22-batak-play-travel-local-
      // departure-design.md. Skipped (falls straight through to the original single-stage
      // behavior) whenever there's no measured origin to depart from (AI plays never supply one —
      // they have no per-card hand visual to begin with), under reduced motion, or when the
      // measured origin is already closer than the local-departure distance itself (a fixed local
      // leg would overshoot past the destination).
      //
      // This leg moves along the real straight-line vector toward the trick center (both x and y,
      // proportioned so the y component covers exactly LOCAL_DEPARTURE_DISTANCE), not straight up —
      // an earlier version moved only vertically, which produced a visible kink in the flight path
      // (a purely-vertical hop, then a sharp turn onto the diagonal for the remaining distance).
      // Moving along the same vector from the first frame reads as one continuous motion while
      // preserving the original fix's invariant (the card is fully clear of the row's stacking band
      // before the parent-swap to TravelCard happens, so there's still nothing to visibly pop in
      // front of).
      const measuredOrigin = originOffset;
      const canLocalDepart =
        playerId === HUMAN_ID &&
        measuredOrigin != null &&
        !reducedMotion &&
        measuredOrigin.y > LOCAL_DEPARTURE_DISTANCE * 1.5;

      if (canLocalDepart) {
        const departureFraction = LOCAL_DEPARTURE_DISTANCE / measuredOrigin.y;
        const departureDeltaX = measuredOrigin.x * departureFraction;
        setLocalDeparture({ cardId: move.cardId, deltaX: departureDeltaX });
        localDepartureTimeoutRef.current = setTimeout(() => {
          setLocalDeparture(null);
          armPendingPlay(
            {
              x: measuredOrigin.x - departureDeltaX,
              y: measuredOrigin.y - LOCAL_DEPARTURE_DISTANCE,
            },
            CARD_TRAVEL_DURATION_MS - LOCAL_DEPARTURE_DURATION_MS,
            delay - LOCAL_DEPARTURE_DURATION_MS,
          );
        }, LOCAL_DEPARTURE_DURATION_MS);
        return;
      }

      armPendingPlay(originOffset, undefined, delay);
      return;
    }
    performMove(move);
  }

  useAITurn({
    state,
    aiPlayerIds: aiIds,
    aiStrategy,
    ruleEngine: batakDescriptor.ruleEngine,
    rng,
    onMove: commitMove,
  });

  function handleHumanMove(move: BatakMove) {
    commitMove(move, HUMAN_ID);
  }

  function handleHumanPlayCard(
    cardId: string,
    originOffset?: { x: number; y: number },
    originRotateDeg?: number,
  ) {
    commitMove(
      { type: "play", cardId },
      HUMAN_ID,
      originOffset,
      originRotateDeg,
    );
  }

  function handleHumanBury(cardIds: [string, string, string, string]) {
    commitMove({ type: "bury", cardIds }, HUMAN_ID);
  }

  const legalMoves =
    state.players[state.currentPlayerIndex] === HUMAN_ID &&
    pendingPlay == null &&
    localDeparture == null &&
    gatheringTrick == null &&
    pendingBury == null
      ? batakDescriptor.ruleEngine.getLegalMoves(state, HUMAN_ID)
      : [];

  const gameOver = batakDescriptor.ruleEngine.gameOver(state);

  return (
    <GameScreenLayout
      title="Batak"
      onExit={onBackHome}
      backgroundColor="#0b6623"
      titleColor="#f4c542"
      darkGlowHeader
      onSettingsPress={() => setSettingsVisible(true)}
      extraHeaderActions={
        __DEV__ ? (
          <PressableFeedback
            onPress={() => setDevTuningVisible(true)}
            accessibilityRole="button"
            testID="batak-dev-tuning-button">
            <Text style={styles.devIcon}>{'\u{1F39B}\u{FE0F}'}</Text>
          </PressableFeedback>
        ) : undefined
      }>
      <BatakTable
        state={state}
        humanPlayerId={HUMAN_ID}
        opponentPlayerIds={aiIds}
        playerNames={playerNames}
        legalMoves={legalMoves}
        onMove={handleHumanMove}
        onPlayCard={handleHumanPlayCard}
        onBury={handleHumanBury}
        pendingPlay={pendingPlay}
        gatheringTrick={gatheringTrick}
        pendingBury={pendingBury}
        localDeparture={localDeparture}
        restingRotations={restingRotations}
        dealPhase={dealPhase}
      />
      {gameOver && (
        <GameResultModal
          scores={batakDescriptor.ruleEngine.calculateScore(state)}
          winners={batakDescriptor.ruleEngine.determineWinner(state) ?? []}
          playerNames={playerNames}
          humanPlayerId={HUMAN_ID}
          onPlayAgain={onPlayAgain}
          onBackHome={onBackHome}
        />
      )}
      <BatakSettingsModal
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
      />
      {__DEV__ && (
        <BatakDevTuningModal
          visible={devTuningVisible}
          onClose={() => setDevTuningVisible(false)}
        />
      )}
    </GameScreenLayout>
  );
}

const styles = StyleSheet.create({
  // Matches SettingsIcon's enlarged 27px default (see packages/ui/src/SettingsIcon.tsx) so both
  // header icons read as the same visual size.
  devIcon: { fontSize: 27 },
});
