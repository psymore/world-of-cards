import { useMemo, useRef } from 'react';
import { Animated, EasingFunction } from 'react-native';
import type { CardMotionKeyframe } from '../types';

export interface RetargetOptions {
  durationMs?: number;
  easing?: EasingFunction;
}

// A pre-created set of Animated.Values a caller can hand in instead of letting
// useCardMotion create its own — see the `pool` option below.
export interface CardMotionValuePool {
  x: Animated.Value;
  y: Animated.Value;
  rotate: Animated.Value;
  scale: Animated.Value;
  glyphScale: Animated.Value;
}

export interface UseCardMotionOptions {
  initial: CardMotionKeyframe;
  defaultDurationMs: number;
  defaultEasing: EasingFunction;
  // Opt-in: reuse these externally-owned Animated.Values instead of creating a
  // fresh set on every mount. For the 2026-07-29 Demo 6 revisit-stutter
  // investigation — every mount normally creates its own 5 Animated.Values per
  // card, each backed by a native-driver node once animated; nothing tears
  // those down on unmount, so cleanup depends entirely on the JS objects
  // actually being garbage-collected, which isn't immediate. A caller that
  // owns a fixed, module-scoped pool of these (surviving every mount/unmount
  // of the component that calls this hook) can pass it here so nothing new is
  // ever created after the very first app launch — see
  // Demo06HandReposition.tsx's HAND_MOTION_POOL for the real usage. Omit for
  // the normal case (every other demo); this is purely additive.
  pool?: CardMotionValuePool;
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
  // Immediately sets every output value to the supplied keyframe, preserving
  // visual continuity across a render that has already changed the caller's
  // container/base position. Used by Demo 06's hand reflow to keep a card
  // visually in place while its slot style jumps to the new layout.
  jumpTo: (to: CardMotionKeyframe) => void;
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
  pool,
}: UseCardMotionOptions): CardMotionResult {
  // Always constructed (rules-of-hooks requires an unconditional call here),
  // but thrown away unused whenever `pool` is provided — a bare, never-animated
  // Animated.Value has no native-driver footprint, so this costs one small,
  // immediately-GC-eligible allocation per mount in the pooled case. Simpler
  // than conditionally skipping the useRef call, which would vary the number of
  // hooks called between renders if `pool` ever changed (it doesn't in
  // practice, but this reads correctly either way).
  const ownX = useRef(new Animated.Value(initial.x)).current;
  const ownY = useRef(new Animated.Value(initial.y)).current;
  const ownRotate = useRef(new Animated.Value(initial.rotateDeg)).current;
  const ownScale = useRef(new Animated.Value(initial.scale)).current;
  const ownGlyphScale = useRef(new Animated.Value(initial.glyphScale)).current;

  const xRef = pool?.x ?? ownX;
  const yRef = pool?.y ?? ownY;
  const rotateRef = pool?.rotate ?? ownRotate;
  const scaleRef = pool?.scale ?? ownScale;
  const glyphScaleRef = pool?.glyphScale ?? ownGlyphScale;

  // A pooled value's CURRENT state is whatever its previous occupant (a
  // different card, from a previous mount) last left it at — reset explicitly
  // to THIS mount's own initial keyframe rather than visibly inheriting stale
  // state. Run directly in the render body (not an effect) so it lands before
  // this component's very first paint, not one frame after — mirrors why
  // Demo06HandReposition's own reflow correction uses useLayoutEffect rather
  // than useEffect. Guarded to run once per component instance; plain
  // (non-pooled) callers skip this entirely since a freshly-constructed
  // Animated.Value already starts at `initial` by construction.
  const didInitPool = useRef(false);
  if (pool && !didInitPool.current) {
    didInitPool.current = true;
    xRef.setValue(initial.x);
    yRef.setValue(initial.y);
    rotateRef.setValue(initial.rotateDeg);
    scaleRef.setValue(initial.scale);
    glyphScaleRef.setValue(initial.glyphScale);
  }

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

  // Retarget/jumpTo below skip a property's native call entirely when its target
  // exactly equals its current value — a very common case in practice (any caller
  // that constructs its `to` keyframe via idleKeyframe's defaults for properties
  // it isn't intentionally changing — e.g. Demo06HandReposition.tsx's HandCard,
  // whose scale/glyphScale never leave 1 — was otherwise paying for a real native
  // bridge round-trip per property per call for zero visual effect). Exact
  // equality only (no epsilon): conservative by design, so this can never skip a
  // property that should genuinely animate, only ones that are provably already
  // exactly where they need to be. See
  // docs/animation/audits/Demo06-ReflowStutter-Audit.md for the root cause this
  // addresses (native-only stutter during Demo 06's multi-card hand reflow, where
  // this waste was concentrated across every remaining card at once).
  function retarget(to: CardMotionKeyframe, options?: RetargetOptions) {
    const current = getCurrentKeyframe();
    fromRef.current = current;
    toRef.current = to;
    const duration = options?.durationMs ?? defaultDurationMs;
    const easing = options?.easing ?? defaultEasing;
    durationRef.current = duration;
    easingRef.current = easing;
    legStartTimeRef.current = Date.now();

    const config = { duration, easing, useNativeDriver: true };
    if (to.x !== current.x) Animated.timing(xRef, { toValue: to.x, ...config }).start();
    if (to.y !== current.y) Animated.timing(yRef, { toValue: to.y, ...config }).start();
    if (to.rotateDeg !== current.rotateDeg) {
      Animated.timing(rotateRef, { toValue: to.rotateDeg, ...config }).start();
    }
    if (to.scale !== current.scale) {
      Animated.timing(scaleRef, { toValue: to.scale, ...config }).start();
    }
    if (to.glyphScale !== current.glyphScale) {
      Animated.timing(glyphScaleRef, { toValue: to.glyphScale, ...config }).start();
    }
  }

  function jumpTo(to: CardMotionKeyframe) {
    const current = getCurrentKeyframe();
    if (to.x !== current.x) xRef.setValue(to.x);
    if (to.y !== current.y) yRef.setValue(to.y);
    if (to.rotateDeg !== current.rotateDeg) rotateRef.setValue(to.rotateDeg);
    if (to.scale !== current.scale) scaleRef.setValue(to.scale);
    if (to.glyphScale !== current.glyphScale) glyphScaleRef.setValue(to.glyphScale);
    fromRef.current = to;
    toRef.current = to;
    legStartTimeRef.current = Date.now();
    durationRef.current = 0;
    easingRef.current = defaultEasing;
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

  return { transform, glyphScale: glyphScaleRef, retarget, jumpTo, getCurrentKeyframe };
}
