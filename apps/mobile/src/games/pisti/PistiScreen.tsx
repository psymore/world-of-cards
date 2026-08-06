import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRng, RNG, Difficulty, PlayerId, Card } from '@world-cards/engine';
import { pistiDescriptor, PistiState, PistiMove } from '@world-cards/engine/games/pisti';
import { createGameSessionStore } from '../../state/createGameSessionStore';
import { useSettingsStore } from '../../state/settingsStore';
import { GameScreenLayout } from '../../components/GameScreenLayout';
import { GameResultModal } from '../../components/GameResultModal';
import { PistiSetupView, PistiPlayerCount, PistiFourPlayerMode } from './PistiSetupView';
import { PistiTable } from './PistiTable';
import { useAITurn } from '../../hooks/useAITurn';
import { useDealSequence } from '../../hooks/useDealSequence';
import { CARD_TRAVEL_DURATION_MS } from '../../table/travelAnimation';
import { PARTNER_SEAT_INDEX } from './pistiSeating';

const HUMAN_ID: PlayerId = 'human';

function buildAiIds(playerCount: PistiPlayerCount): PlayerId[] {
  return Array.from({ length: playerCount - 1 }, (_, i) => `ai-${i + 1}`);
}

// In "with a partner" mode, the partner is whoever sits across the table — PARTNER_SEAT_INDEX
// (shared with PistiTable.assignSeats) is the single source of truth for which seat that is,
// so this and the table's seating layout can't silently drift apart.
function buildTeams(aiIds: PlayerId[], fourPlayerMode: PistiFourPlayerMode): PlayerId[][] | undefined {
  if (aiIds.length !== 3 || fourPlayerMode !== 'team') return undefined;
  const partner = aiIds[PARTNER_SEAT_INDEX];
  const others = aiIds.filter((id) => id !== partner);
  return [
    [HUMAN_ID, partner],
    others,
  ];
}

function buildPlayerNames(aiIds: PlayerId[], teams: PlayerId[][] | undefined): Record<PlayerId, string> {
  const names: Record<PlayerId, string> = { [HUMAN_ID]: 'You' };
  // A single opponent keeps the familiar "Computer" label. With 3 opponents, partner mode
  // names them by role (Partner/Opponent); free-for-all just numbers them.
  if (aiIds.length === 1) {
    names[aiIds[0]] = 'Computer';
  } else if (teams) {
    let opponentNumber = 1;
    aiIds.forEach((id, i) => {
      names[id] = i === PARTNER_SEAT_INDEX ? 'Partner' : `Opponent ${opponentNumber++}`;
    });
  } else {
    aiIds.forEach((id, i) => {
      names[id] = `AI ${i + 1}`;
    });
  }
  return names;
}

// Pause between a move being chosen (AI, via useAITurn's separate thinkingDelayMs, or the human,
// on tap) and it actually being committed to game state, during which the chosen card is shown
// traveling to the pile (PistiTable's RevealCard). Without this, the hand shrinking and the pile
// updating would happen in the same instant, with no readable moment showing which card was
// played or by whom. Derived directly from CARD_TRAVEL_DURATION_MS (RevealCard's actual flight
// duration) plus a real buffer, rather than a separately hand-picked number — this was previously
// a bare 550 next to a 530ms flight, a 20ms margin easily eaten by the ordinary gap between
// setRevealedMove being called here and RevealCard's own useEffect actually starting its native
// animation, which sometimes let this timer fire before the flight finished and snapped the card
// the rest of the way to its resting spot instead of easing in.
const REVEAL_DELAY_MS = CARD_TRAVEL_DURATION_MS + 40;

export interface PistiScreenProps {
  onExitToHome: () => void;
}

interface PistiSession {
  difficulty: Difficulty;
  aiIds: PlayerId[];
  teams: PlayerId[][] | undefined;
  rng: RNG;
  useSessionStore: ReturnType<typeof createGameSessionStore<PistiState, PistiMove>>;
}

export function PistiScreen({ onExitToHome }: PistiScreenProps) {
  const [session, setSession] = useState<PistiSession | null>(null);
  const [sessionKey, setSessionKey] = useState(0);
  const defaultDifficulty = useSettingsStore((s) => s.defaultDifficulty);

  function startGame(difficulty: Difficulty, playerCount: PistiPlayerCount, fourPlayerMode: PistiFourPlayerMode) {
    const aiIds = buildAiIds(playerCount);
    const teams = buildTeams(aiIds, fourPlayerMode);
    const rng = createRng(Date.now());
    const initialState = pistiDescriptor.ruleEngine.setup({ players: [HUMAN_ID, ...aiIds], teams }, rng);
    const useSessionStore = createGameSessionStore(pistiDescriptor.ruleEngine, initialState);
    setSession({ difficulty, aiIds, teams, rng, useSessionStore });
    setSessionKey((k) => k + 1);
  }

  if (!session) {
    return <PistiSetupView defaultDifficulty={defaultDifficulty} onStart={startGame} onBack={onExitToHome} />;
  }

  return (
    <ActiveGame
      key={sessionKey}
      difficulty={session.difficulty}
      aiIds={session.aiIds}
      teams={session.teams}
      rng={session.rng}
      useSessionStore={session.useSessionStore}
      onPlayAgain={() =>
        startGame(session.difficulty, (session.aiIds.length + 1) as PistiPlayerCount, session.teams ? 'team' : 'ffa')
      }
      onBackHome={onExitToHome}
    />
  );
}

interface ActiveGameProps {
  difficulty: Difficulty;
  aiIds: PlayerId[];
  teams: PlayerId[][] | undefined;
  rng: RNG;
  useSessionStore: ReturnType<typeof createGameSessionStore<PistiState, PistiMove>>;
  onPlayAgain: () => void;
  onBackHome: () => void;
}

interface RevealedMove {
  move: PistiMove;
  card: Card;
  playerId: PlayerId;
  originOffset?: { x: number; y: number };
  originRotateDeg?: number;
}

function ActiveGame({ difficulty, aiIds, teams, rng, useSessionStore, onPlayAgain, onBackHome }: ActiveGameProps) {
  const state = useSessionStore((s) => s.state);
  const performMove = useSessionStore((s) => s.performMove);
  const [bannerText, setBannerText] = useState<string | null>(null);
  const [revealedMove, setRevealedMove] = useState<RevealedMove | null>(null);
  // Each landed human-played card's angle, keyed by card id, kept for the rest of the hand so the
  // pile reads as a natural stack rather than every card snapping flat once buried — see
  // docs/superpowers/specs/2026-08-06-pisti-hand-fan-gesture-migration-design.md §4. Never pruned:
  // holds at most one entry per card played this hand (≤52), and a new hand/session gets a fresh
  // ActiveGame mount — unlike Batak's per-trick restingRotations, this isn't reused across many
  // plays of the same slot.
  const [pileRestingRotations, setPileRestingRotations] = useState<Record<string, number>>({});
  // Bumped whenever a stock redeal is detected (see applyMove below) to replay the same
  // fly-out-from-center deal flourish the initial deal gets, instead of the new hands just
  // silently appearing — Pişti-specific (Batak has no mid-hand redeal), so useDealSequence's
  // resetKey param defaults to a stable value everywhere else.
  const [dealResetKey, setDealResetKey] = useState(0);
  const dealPhase = useDealSequence(dealResetKey);

  const aiStrategy = pistiDescriptor.aiStrategies[difficulty];
  // aiIds/teams are fixed for the lifetime of a session (a new session gets a new `key`, see
  // PistiScreen), so this only needs to be rebuilt if either actually changes, not on every move.
  const playerNames = useMemo(() => buildPlayerNames(aiIds, teams), [aiIds, teams]);
  const revealTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (revealTimeoutRef.current) clearTimeout(revealTimeoutRef.current);
    };
  }, []);

  function applyMove(move: PistiMove, playerId: PlayerId) {
    const bonusBefore = state.pistiBonusPoints[playerId];
    const capturedBefore = state.table.zones[`captured-${playerId}`].cards.length;
    // Stock only ever shrinks during a redeal (rules.ts deals handDealTargets(players) cards from
    // it once every hand has emptied) — never during an ordinary play — so a decrease here is an
    // unambiguous "a redeal just happened this move" signal, read after performMove commits it.
    const stockBefore = state.table.zones['stock'].cards.length;

    performMove(move);

    const nextState = useSessionStore.getState().state;
    const capturedAfter = nextState.table.zones[`captured-${playerId}`].cards.length;
    const bonusAfter = nextState.pistiBonusPoints[playerId];
    const who = playerId === HUMAN_ID ? 'You' : playerNames[playerId];

    if (nextState.table.zones['stock'].cards.length < stockBefore) {
      setDealResetKey((k) => k + 1);
    }

    if (capturedAfter > capturedBefore) {
      const bonusGained = bonusAfter - bonusBefore;
      if (bonusGained === 20) {
        setBannerText('Double Pişti! +20');
      } else if (bonusGained === 10) {
        setBannerText('Pişti! +10');
      } else {
        const gained = capturedAfter - capturedBefore;
        setBannerText(`${who} captured ${gained} card${gained === 1 ? '' : 's'}!`);
      }
    } else {
      setBannerText(null);
    }
  }

  // Shared by both AI and human plays: show the chosen card traveling to the pile before actually
  // committing the move to engine state (see REVEAL_DELAY_MS above for why the pause exists).
  function revealThenCommit(
    move: PistiMove,
    playerId: PlayerId,
    originOffset?: { x: number; y: number },
    originRotateDeg?: number,
  ) {
    const playedCard = state.table.zones[`hand-${playerId}`].cards.find((c) => c.id === move.cardId);
    if (!playedCard) {
      applyMove(move, playerId);
      return;
    }
    setRevealedMove({ move, card: playedCard, playerId, originOffset, originRotateDeg });
    setPileRestingRotations((prev) => ({ ...prev, [playedCard.id]: originRotateDeg ?? 0 }));
    revealTimeoutRef.current = setTimeout(() => {
      applyMove(move, playerId);
      setRevealedMove(null);
    }, REVEAL_DELAY_MS);
  }

  useAITurn({
    state,
    aiPlayerIds: aiIds,
    aiStrategy,
    ruleEngine: pistiDescriptor.ruleEngine,
    rng,
    onMove: revealThenCommit,
  });

  function handlePlayCard(cardId: string, originOffset?: { x: number; y: number }, originRotateDeg?: number) {
    revealThenCommit({ type: 'play', cardId }, HUMAN_ID, originOffset, originRotateDeg);
  }

  const gameOver = pistiDescriptor.ruleEngine.gameOver(state);

  return (
    <GameScreenLayout title="Pişti" onExit={onBackHome} backgroundColor="#0b6623" titleColor="#f4c542">
      <PistiTable
        state={state}
        humanPlayerId={HUMAN_ID}
        opponentPlayerIds={aiIds}
        playerNames={playerNames}
        onPlayCard={handlePlayCard}
        bannerText={bannerText}
        revealCard={
          revealedMove
            ? {
                card: revealedMove.card,
                playerId: revealedMove.playerId,
                originOffset: revealedMove.originOffset,
                originRotateDeg: revealedMove.originRotateDeg,
              }
            : null
        }
        pileRestingRotations={pileRestingRotations}
        dealPhase={dealPhase}
      />
      {gameOver && (
        <GameResultModal
          scores={pistiDescriptor.ruleEngine.calculateScore(state)}
          winners={pistiDescriptor.ruleEngine.determineWinner(state) ?? []}
          playerNames={playerNames}
          humanPlayerId={HUMAN_ID}
          teams={teams}
          onPlayAgain={onPlayAgain}
          onBackHome={onBackHome}
        />
      )}
    </GameScreenLayout>
  );
}
