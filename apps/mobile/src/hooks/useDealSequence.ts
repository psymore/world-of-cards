import { useEffect, useState } from 'react';
import { useReducedMotion } from '../components/useReducedMotion';

export type DealPhase = 'dealing' | 'revealing';

// Total time DealFlightOverlay's own per-seat/per-card timing needs to finish before the real
// hands appear — see DealFlightOverlay.tsx. Shared by every game using this hook, so the flight
// animation's internal constants are what's tuned for hand-size differences, not this duration.
const DEAL_FLIGHT_MS = 1700;

// Runs once per mount (i.e. once per hand — a fresh mount happens on every new deal, since each
// game's screen remounts its active-game subtree via key={sessionKey} on every "Play Again" /
// initial start), so no extra reset logic is needed: a new hand always gets a fresh deal sequence
// for free. Originally written for Batak only; now shared so Pişti doesn't reimplement the same
// reduced-motion-aware phase timing a second time.
export function useDealSequence(): DealPhase {
  const reducedMotion = useReducedMotion();
  const [dealPhase, setDealPhase] = useState<DealPhase>(reducedMotion ? 'revealing' : 'dealing');

  useEffect(() => {
    if (reducedMotion) {
      setDealPhase('revealing');
      return;
    }
    setDealPhase('dealing');
    const toRevealing = setTimeout(() => setDealPhase('revealing'), DEAL_FLIGHT_MS);
    return () => clearTimeout(toRevealing);
  }, [reducedMotion]);

  return dealPhase;
}
