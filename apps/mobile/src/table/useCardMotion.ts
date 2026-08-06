import { useRef } from 'react';
import { Easing, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

export interface CardMotionTarget {
  x?: number;
  y?: number;
  angleDeg?: number;
  scale?: number;
  // delay: fires the withTiming itself after this many ms — distinct from duration, which is how
  // long the timing itself takes once it starts.
  timing?: { duration: number; easing?: (t: number) => number; delay?: number };
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
    const animate = (toValue: number) => {
      const timing = withTiming(toValue, { duration, easing });
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
