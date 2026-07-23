import { useEffect, useMemo, useRef, useState } from 'react';
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
    { translateX: Animated.AnimatedInterpolation<number> },
    { translateY: Animated.AnimatedInterpolation<number> },
    { rotate: Animated.AnimatedInterpolation<string> },
    { scale: Animated.AnimatedInterpolation<number> },
  ];
  glyphScale: Animated.AnimatedInterpolation<number>;
  // Re-targets the animation toward `to`, starting from wherever the card visually
  // is right now (not the original `from`) — see ANIMATION_ARCHITECTURE.md's
  // "Preserve Spatial Continuity" rule. Safe to call while a previous retarget is
  // still animating.
  retarget: (to: CardMotionKeyframe, options?: RetargetOptions) => void;
  // The card's current interpolated keyframe, read synchronously.
  getCurrentKeyframe: () => CardMotionKeyframe;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// The single reusable motion primitive this whole sub-project exists to build.
// Drives exactly one Animated.Value (0 -> 1) via Animated.timing; every visual
// output below is an .interpolate() off that same value — see
// ANIMATION_ARCHITECTURE.md's "One source of truth" rule. zIndex/shadow are
// deliberately NOT produced here — see the design spec's documented exception;
// callers that need them derive discrete step changes from getCurrentKeyframe()
// themselves.
export function useCardMotion({
  initial,
  defaultDurationMs,
  defaultEasing,
}: UseCardMotionOptions): CardMotionResult {
  const progress = useRef(new Animated.Value(0)).current;
  const progressValueRef = useRef(0);
  const fromRef = useRef<CardMotionKeyframe>(initial);
  const toRef = useRef<CardMotionKeyframe>(initial);
  const durationRef = useRef(defaultDurationMs);
  const easingRef = useRef(defaultEasing);
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    const id = progress.addListener(({ value }) => {
      progressValueRef.current = value;
    });
    return () => progress.removeListener(id);
  }, [progress]);

  function getCurrentKeyframe(): CardMotionKeyframe {
    const t = progressValueRef.current;
    const from = fromRef.current;
    const to = toRef.current;
    return {
      x: lerp(from.x, to.x, t),
      y: lerp(from.y, to.y, t),
      rotateDeg: lerp(from.rotateDeg, to.rotateDeg, t),
      scale: lerp(from.scale, to.scale, t),
      glyphScale: lerp(from.glyphScale, to.glyphScale, t),
    };
  }

  function retarget(to: CardMotionKeyframe, options?: RetargetOptions) {
    const current = getCurrentKeyframe();
    progress.stopAnimation();
    fromRef.current = current;
    toRef.current = to;
    progress.setValue(0);
    progressValueRef.current = 0;
    durationRef.current = options?.durationMs ?? defaultDurationMs;
    easingRef.current = options?.easing ?? defaultEasing;
    // Bumps so the useMemo below rebuilds its .interpolate() calls around the new
    // from/to refs — the single underlying `progress` Value keeps flowing on the
    // native thread across this re-render, it isn't restarted.
    setGeneration(g => g + 1);
    Animated.timing(progress, {
      toValue: 1,
      duration: durationRef.current,
      easing: easingRef.current,
      useNativeDriver: true,
    }).start();
  }

  const { transform, glyphScale } = useMemo(() => {
    const from = fromRef.current;
    const to = toRef.current;
    const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [from.x, to.x] });
    const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [from.y, to.y] });
    const rotate = progress.interpolate({
      inputRange: [0, 1],
      outputRange: [`${from.rotateDeg}deg`, `${to.rotateDeg}deg`],
    });
    const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [from.scale, to.scale] });
    const glyphScaleInterp = progress.interpolate({
      inputRange: [0, 1],
      outputRange: [from.glyphScale, to.glyphScale],
    });
    return {
      transform: [{ translateX }, { translateY }, { rotate }, { scale }] as CardMotionResult['transform'],
      glyphScale: glyphScaleInterp,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generation]);

  return { transform, glyphScale, retarget, getCurrentKeyframe };
}
