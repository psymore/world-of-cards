import { useRef } from 'react';
import { Easing, useSharedValue, withTiming } from 'react-native-reanimated';

export interface BatakCardTarget {
  x?: number;
  y?: number;
  angleDeg?: number;
  scale?: number;
  timing?: { duration: number; easing?: (t: number) => number };
}

const DEFAULT_DURATION_MS = 320;
const DEFAULT_EASING = Easing.inOut(Easing.cubic);

export function useBatakCardMotion(initial: { x: number; y: number; angleDeg: number; scale: number }) {
  const translateX = useSharedValue(initial.x);
  const translateY = useSharedValue(initial.y);
  const rotate = useSharedValue(initial.angleDeg);
  const scale = useSharedValue(initial.scale);

  // JS-thread mirror of each shared value, kept in sync only by setTarget itself (never read from
  // the native/UI thread) — good enough for getValues()'s purpose (BatakTable reading a card's
  // "last commanded target" at tap time, not a frame-accurate live sample), and avoids the
  // permanent per-frame addListener bridge cost this codebase has already identified and removed
  // once (see useCardMotion.ts's own 2026-07-26 fix history).
  const lastValues = useRef({ x: initial.x, y: initial.y, angleDeg: initial.angleDeg, scale: initial.scale });

  function setTarget(target: BatakCardTarget) {
    const duration = target.timing?.duration ?? DEFAULT_DURATION_MS;
    const easing = target.timing?.easing ?? DEFAULT_EASING;
    if (target.x !== undefined) {
      translateX.value = withTiming(target.x, { duration, easing });
      lastValues.current.x = target.x;
    }
    if (target.y !== undefined) {
      translateY.value = withTiming(target.y, { duration, easing });
      lastValues.current.y = target.y;
    }
    if (target.angleDeg !== undefined) {
      rotate.value = withTiming(target.angleDeg, { duration, easing });
      lastValues.current.angleDeg = target.angleDeg;
    }
    if (target.scale !== undefined) {
      scale.value = withTiming(target.scale, { duration, easing });
      lastValues.current.scale = target.scale;
    }
  }

  function getValues() {
    return { ...lastValues.current };
  }

  return { shared: { translateX, translateY, rotate, scale }, setTarget, getValues };
}
