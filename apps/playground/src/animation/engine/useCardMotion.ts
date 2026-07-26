import { useMemo, useRef } from 'react';
import { Animated, EasingFunction } from 'react-native';
import type { CardMotionKeyframe } from '../types';

export interface RetargetOptions {
  durationMs?: number;
  easing?: EasingFunction;
}

export interface UseCardMotionOptions {
  initial: CardMotionKeyframe;
  defaultDurationMs: number;
  defaultEasing: EasingFunction;
}

export interface CardMotionResult {
  // Ready-to-spread transform array for an Animated.View's style.transform.
  transform: [
    { translateX: Animated.Value },
    { translateY: Animated.Value },
    { rotate: Animated.AnimatedInterpolation<string> },
    { scale: Animated.Value },
  ];
  glyphScale: Animated.Value;
  // Re-targets the animation toward `to`, starting from wherever the card visually
  // is right now (not the original `from`) — see ANIMATION_ARCHITECTURE.md's
  // "Preserve Spatial Continuity" rule. Safe to call while a previous retarget is
  // still animating.
  retarget: (to: CardMotionKeyframe, options?: RetargetOptions) => void;
  // The card's current interpolated keyframe, computed synchronously from elapsed
  // time (see legStartTimeRef's comment) — not read off the Animated.Values
  // themselves, which is what makes this safe to call with no native round-trip.
  getCurrentKeyframe: () => CardMotionKeyframe;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function keyframeAt(from: CardMotionKeyframe, to: CardMotionKeyframe, t: number): CardMotionKeyframe {
  return {
    x: lerp(from.x, to.x, t),
    y: lerp(from.y, to.y, t),
    rotateDeg: lerp(from.rotateDeg, to.rotateDeg, t),
    scale: lerp(from.scale, to.scale, t),
    glyphScale: lerp(from.glyphScale, to.glyphScale, t),
  };
}

// The single reusable motion primitive this whole sub-project exists to build.
// Every visual output is driven by its own persistent Animated.Value, animated
// directly with Animated.timing — see ANIMATION_ARCHITECTURE.md's "One source of
// truth" rule (each property IS its own source of truth here; there's no separate
// normalized progress value in between). zIndex/shadow are deliberately NOT
// produced here — see the design spec's documented exception; callers that need
// them derive discrete step changes from getCurrentKeyframe() themselves.
//
// This mirrors apps/mobile/src/components/SelectableCard.tsx's proven pattern
// (Batak/Pişti's own shipped card-lift animation) rather than an earlier design of
// this file that normalized every leg onto one shared 0->1 "progress" value and
// swapped .interpolate() mappings via a re-render on every retarget. That swap
// wasn't atomic with the progress.setValue(0) reset it depended on: native applies
// the reset immediately, but the new interpolation mapping only takes effect once
// React's re-render actually commits, a moment later. In between, the view could
// render one real frame through the OLD mapping at input 0 — pointing at the
// PREVIOUS leg's start position, not the new one — a visible jump on every single
// select/deselect and travel/hold/reset transition. Animated.timing(value,
// {toValue}) has no equivalent gap: it always continues from a value's actual
// current state, whatever that is, with no reset/swap step to be non-atomic.
export function useCardMotion({
  initial,
  defaultDurationMs,
  defaultEasing,
}: UseCardMotionOptions): CardMotionResult {
  const xRef = useRef(new Animated.Value(initial.x)).current;
  const yRef = useRef(new Animated.Value(initial.y)).current;
  const rotateRef = useRef(new Animated.Value(initial.rotateDeg)).current;
  const scaleRef = useRef(new Animated.Value(initial.scale)).current;
  const glyphScaleRef = useRef(new Animated.Value(initial.glyphScale)).current;

  // Tracked purely so getCurrentKeyframe() can answer synchronously with no native
  // round-trip — NOT used to drive the animation itself; each Animated.Value above
  // already knows its own current position natively, which is what retarget()
  // below actually relies on. Animated.timing is deterministic (progress is always
  // exactly easing(elapsed / duration)), so this reproduces the same curve in JS
  // rather than asking native for it.
  const fromRef = useRef<CardMotionKeyframe>(initial);
  const toRef = useRef<CardMotionKeyframe>(initial);
  const legStartTimeRef = useRef(Date.now());
  const durationRef = useRef(defaultDurationMs);
  const easingRef = useRef(defaultEasing);

  function getCurrentKeyframe(): CardMotionKeyframe {
    const duration = durationRef.current;
    const rawT = duration <= 0 ? 1 : Math.min(1, Math.max(0, (Date.now() - legStartTimeRef.current) / duration));
    return keyframeAt(fromRef.current, toRef.current, easingRef.current(rawT));
  }

  function retarget(to: CardMotionKeyframe, options?: RetargetOptions) {
    fromRef.current = getCurrentKeyframe();
    toRef.current = to;
    const duration = options?.durationMs ?? defaultDurationMs;
    const easing = options?.easing ?? defaultEasing;
    durationRef.current = duration;
    easingRef.current = easing;
    legStartTimeRef.current = Date.now();

    const config = { duration, easing, useNativeDriver: true };
    Animated.timing(xRef, { toValue: to.x, ...config }).start();
    Animated.timing(yRef, { toValue: to.y, ...config }).start();
    Animated.timing(rotateRef, { toValue: to.rotateDeg, ...config }).start();
    Animated.timing(scaleRef, { toValue: to.scale, ...config }).start();
    Animated.timing(glyphScaleRef, { toValue: to.glyphScale, ...config }).start();
  }

  // Built once per Animated.Value identity (i.e. once ever, since xRef/yRef/etc.
  // are stable refs) — unlike the old design, there's no from/to baked into these,
  // so there's never a reason to rebuild them on retarget.
  const transform = useMemo(
    () =>
      [
        { translateX: xRef },
        { translateY: yRef },
        {
          // Fixed, never-changing mapping — safe regardless of what rotateDeg
          // values any given leg actually uses, and exactly why rotate needs no
          // rebuilding on retarget the way the old design's from/to-dependent
          // interpolation did.
          rotate: rotateRef.interpolate({ inputRange: [-360, 360], outputRange: ['-360deg', '360deg'] }),
        },
        { scale: scaleRef },
      ] as CardMotionResult['transform'],
    [xRef, yRef, rotateRef, scaleRef],
  );

  return { transform, glyphScale: glyphScaleRef, retarget, getCurrentKeyframe };
}
