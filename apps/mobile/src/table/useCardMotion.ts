import { useRef } from 'react';
import { Easing, runOnJS, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

export interface CardMotionTarget {
  x?: number;
  y?: number;
  angleDeg?: number;
  scale?: number;
  // delay: fires the withTiming itself after this many ms — distinct from duration, which is how
  // long the timing itself takes once it starts.
  timing?: { duration: number; easing?: (t: number) => number; delay?: number };
  // Fires once, on the JS thread, when this call's animation actually finishes — not just after
  // its nominal duration elapses. Lets a caller sequence the next phase off the real UI-thread
  // completion instead of a separate JS-thread setTimeout guessing the same duration, which can
  // disagree with it by a frame or more (see
  // docs/animation/audits/BatakPlayTravelHandoff-Audit.md). This is a one-shot completion
  // signal, not live progress observation — it does not reopen the Animation Constitution's
  // rejected "Event-Driven Coordination" proposal (§6), which was specifically about per-frame
  // progress listeners.
  onComplete?: () => void;
}

const DEFAULT_DURATION_MS = 320;
const DEFAULT_EASING = Easing.inOut(Easing.cubic);

// Per-card Reanimated shared-value motion primitive (position/rotation/scale), driven entirely by
// setTarget calls — no game-specific logic. Originally Batak-only (useBatakCardMotion.ts),
// promoted here once Pişti's hand needed the identical primitive — see
// docs/superpowers/specs/2026-08-06-pisti-hand-fan-gesture-migration-design.md §1.
export function useCardMotion(initial: { x: number; y: number; angleDeg: number; scale: number }) {
  const translateX = useSharedValue(initial.x);
  const translateY = useSharedValue(initial.y);
  const rotate = useSharedValue(initial.angleDeg);
  const scale = useSharedValue(initial.scale);

  // JS-thread mirror of each shared value, kept in sync only by setTarget itself (never read from
  // the native/UI thread) — good enough for getValues()'s purpose (a caller reading a card's "last
  // commanded target" at tap time, not a frame-accurate live sample), and avoids the permanent
  // per-frame addListener bridge cost this codebase has already identified and removed once.
  const lastValues = useRef({ x: initial.x, y: initial.y, angleDeg: initial.angleDeg, scale: initial.scale });

  function setTarget(target: CardMotionTarget) {
    const duration = target.timing?.duration ?? DEFAULT_DURATION_MS;
    const easing = target.timing?.easing ?? DEFAULT_EASING;
    const delay = target.timing?.delay;
    // Attached to only the first animated field below (whichever is actually present) — every
    // field set in one setTarget call shares this same duration/easing/delay and therefore
    // completes on the same frame, so firing onComplete per call (not per field) needs exactly
    // one of them to carry it.
    let onCompleteAttached = false;
    const onComplete = target.onComplete;
    // Explicit 'worklet' directive rather than relying on the babel plugin's own detection of
    // withTiming's callback argument position — that detection is AST-shape-based and this
    // callback is constructed conditionally (behind attachOnComplete), not passed as a bare
    // literal, which turned out not to be recognized: omitting this caused a real on-device
    // crash ("[Worklets] Tried to synchronously call a Remote Function"), not just a lint nit.
    const onTimingFinished = (finished?: boolean) => {
      'worklet';
      if (finished && onComplete) {
        runOnJS(onComplete)();
      }
    };
    const animate = (toValue: number) => {
      const attachOnComplete = !onCompleteAttached && onComplete != null;
      if (attachOnComplete) onCompleteAttached = true;
      const timing = withTiming(toValue, { duration, easing }, attachOnComplete ? onTimingFinished : undefined);
      return delay ? withDelay(delay, timing) : timing;
    };
    if (target.x !== undefined) {
      translateX.value = animate(target.x);
      lastValues.current.x = target.x;
    }
    if (target.y !== undefined) {
      translateY.value = animate(target.y);
      lastValues.current.y = target.y;
    }
    if (target.angleDeg !== undefined) {
      rotate.value = animate(target.angleDeg);
      lastValues.current.angleDeg = target.angleDeg;
    }
    if (target.scale !== undefined) {
      scale.value = animate(target.scale);
      lastValues.current.scale = target.scale;
    }
  }

  function getValues() {
    return { ...lastValues.current };
  }

  return { shared: { translateX, translateY, rotate, scale }, setTarget, getValues };
}
