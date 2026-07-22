import { useEffect, useState } from 'react';
import { useReducedMotion } from '../components/useReducedMotion';

export type DealPhase = 'dealing' | 'revealing';

// Total time DealFlightOverlay's own per-seat/per-card timing needs to finish before the real
// hands appear — see DealFlightOverlay.tsx. Shared by every game using this hook, so the flight
// animation's internal constants are what's tuned for hand-size differences, not this duration.
const DEAL_FLIGHT_MS = 1700;

// Runs once per mount for free (i.e. once per hand for Batak/standard Pişti — a fresh mount
// happens on every new deal, since each game's screen remounts its active-game subtree via
// key={sessionKey} on every "Play Again" / initial start), and can also be explicitly re-run
// mid-mount by changing `resetKey` — Pişti's mid-hand stock redeal (dealing 4 fresh cards to
// every hand once they've all emptied) is a second, later "deal" within the same session/mount,
// so it needs the same flourish to replay without a full screen remount. Originally written for
// Batak only; now shared so Pişti doesn't reimplement the same reduced-motion-aware phase timing
// a second time. `resetKey` defaults to a stable constant so every consumer that never changes it
// (Batak; Pişti's own initial deal) is byte-identical to before this parameter existed — it only
// ever re-fires the sequence when the caller deliberately changes the value.
export function useDealSequence(resetKey: string | number = 0): DealPhase {
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
  }, [reducedMotion, resetKey]);

  return dealPhase;
}
