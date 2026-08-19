import React, { useEffect, useRef } from 'react';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import type { Card } from '@world-of-cards/engine';
import { PlayingCard, CARD_DIMS } from '@world-of-cards/ui';
import { useReducedMotion } from '../../../components/useReducedMotion';
import { useCardMotion } from '../../../table/useCardMotion';
import { LOCAL_DEPARTURE_SCALE } from './trickCardScale';

const CARD_WIDTH = CARD_DIMS.normal.width;

// Shared reposition timing for both a sibling-driven reflow (a card played elsewhere shrinks the
// row) — mirrors HumanHandFan's own pre-rewrite HAND_CARD_REPOSITION_DURATION_MS/EASING exactly.
const REPOSITION_DURATION_MS = 320;
const REPOSITION_EASING = Easing.inOut(Easing.cubic);

// Selecting snaps instantly (a fast two-tap play must not still be mid-rise when the confirming
// tap lands); deselecting eases back down — mirrors SelectableCard's own pre-migration
// LIFT_ANIM_DURATION_MS/asymmetry exactly (see its DEFAULT_LIFT_DISTANCE doc comment).
const DESELECT_DURATION_MS = 150;
const SELECT_EASING = Easing.out(Easing.cubic);
// Matches SelectableCard's exported SELECTED_SCALE (1.05) — duplicated rather than imported so
// this file has zero dependency on SelectableCard.tsx, per this migration's cross-game-safety
// constraint (SelectableCard stays Pişti-only from here on).
const SELECTED_SCALE = 1.05;

// Deal-entrance fade/rise/scale — mirrors HumanHandFan's pre-rewrite EntranceCard exactly
// (progress 0→1 over 350ms, staggered 40ms per hand-index, interpolating scale 0.4→1 and a 40px
// rise). Expressed here as real target values (not an interpolated progress), since entrance now
// animates the SAME translateY/scale shared values position/reflow already own, rather than a
// second wrapping Animated.View layering its own transform on top — that second-owner-per-card
// shape is exactly what broke the reverted migration attempt (see the design spec's Context
// section). Opacity has no home on useCardMotion (a position/rotation/scale primitive), so it
// alone gets a small local shared value here, folded into the SAME useAnimatedStyle call below —
// not a second Animated.View, not even a second useAnimatedStyle merged via a style array (RN
// flattens a style array's `transform` key by simply taking the last one, not merging entries, so
// two separate useAnimatedStyle results both setting `transform` would silently drop one of them).
const ENTRANCE_RISE_PX = 40;
const ENTRANCE_SCALE_FROM = 0.4;
const ENTRANCE_DURATION_MS = 350;
const ENTRANCE_STAGGER_MS = 40;
const ENTRANCE_EASING = Easing.out(Easing.cubic);

export interface BatakHandCardTarget {
  x: number;
  y: number;
  angleDeg: number;
}

export interface BatakHandCardProps {
  cardId: string;
  card: Card;
  // This slot's resting (unlifted) position/angle — recomputed by HumanHandFan every render from
  // rail geometry, but only consulted here at mount time and inside the reflow effect (Step 3);
  // never re-read directly during render the way the pre-rewrite AnimatedFanCard's JSX did.
  restTarget: BatakHandCardTarget;
  // Same x/y with the selection lift's extraRadius already applied (same angleDeg) — precomputed
  // by the caller since only it has the RailAngleConfig this needs.
  liftedTarget: { x: number; y: number };
  // Non-null only on this component's very first mount, for a card returning from a Batak
  // gömmeli bury slot — see HumanHandFan's own HandSlot.enterFromOffset doc comment.
  enterFromOffset?: { x: number; y: number } | null;
  interactive: boolean;
  selected: boolean;
  // True only the render where the deal sequence reaches 'revealing' — see ENTRANCE_* above.
  playEntrance: boolean;
  // This card's index within its row, for the entrance stagger delay — matches the pre-rewrite
  // EntranceCard's own `index` prop exactly.
  entranceIndex: number;
  // True only for the card the human just confirmed playing, for its brief local-departure leg —
  // see HumanHandFan's exported LOCAL_DEPARTURE_DISTANCE doc comment.
  isDeparting: boolean;
  departureDeltaX: number;
  localDepartureDistance: number;
  localDepartureDurationMs: number;
  // Fires once the local-departure leg's own animation actually completes (via useCardMotion's
  // onComplete, not a sibling JS-thread timer) — see BatakScreen.tsx's handleDepartureComplete
  // and docs/animation/audits/BatakPlayTravelHandoff-Audit.md. Passed uniformly to every hand
  // card, but only the one actually departing (isDeparting) ever calls it.
  onDepartureComplete?: () => void;
  onPress: () => void;
  // Hands the parent this card's own motion controller (setTarget/getValues) once, on mount —
  // HumanHandFan uses this to retarget the card on every reflow, and BatakTable's
  // playWithMeasuredOrigin uses it to read the card's real current position at tap time.
  registerMotion: (cardId: string, motion: ReturnType<typeof useCardMotion> | null) => void;
}

function BatakHandCardComponent({
  cardId,
  card,
  restTarget,
  liftedTarget,
  enterFromOffset,
  interactive,
  selected,
  playEntrance,
  entranceIndex,
  isDeparting,
  departureDeltaX,
  localDepartureDistance,
  localDepartureDurationMs,
  onDepartureComplete,
  onPress,
  registerMotion,
}: BatakHandCardProps) {
  const reducedMotion = useReducedMotion();

  // Computed once, at construction, for useCardMotion's own initial shared-value state —
  // subsequent changes to these props reach the card only through the effects below, never by
  // re-deriving this again (the fixed-box/shared-value model — see
  // Demo08ReanimatedHandReposition.tsx's own file-level comment).
  const isFreshDealEntrance = !playEntrance && !enterFromOffset;
  const initialDest = selected ? liftedTarget : restTarget;
  const initial = {
    x: initialDest.x + (enterFromOffset?.x ?? 0),
    y: initialDest.y + (enterFromOffset?.y ?? 0) + (isFreshDealEntrance ? -ENTRANCE_RISE_PX : 0),
    angleDeg: restTarget.angleDeg,
    scale: isFreshDealEntrance ? ENTRANCE_SCALE_FROM : selected ? SELECTED_SCALE : 1,
  };
  const motion = useCardMotion(initial);
  const entranceOpacity = useSharedValue(isFreshDealEntrance ? 0 : 1);

  useEffect(() => {
    registerMotion(cardId, motion);
    return () => registerMotion(cardId, null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardId]);

  // Reflow: this card's resting slot changed because a sibling was added/removed (or top/bottom
  // row membership changed). Skipped on mount — bury re-entry's instant-jump-then-animate is
  // handled here instead; a genuinely fresh deal entrance needs no jump at all, since `initial`
  // above already placed it at its (pre-rise) resting spot. `selected`/liftedTarget are read via
  // closure, not listed as dependencies, so a sibling reflow while THIS card happens to be
  // lifted still targets the lifted position — mirrors Demo08's own HandCardComponent reflow
  // effect (keyed on `[slot?.angleDeg]` alone, same closure-read pattern).
  const mounted = useRef(false);
  useEffect(() => {
    const dest = selected ? liftedTarget : restTarget;
    if (!mounted.current) {
      mounted.current = true;
      if (enterFromOffset && !reducedMotion) {
        motion.setTarget({ x: dest.x + enterFromOffset.x, y: dest.y + enterFromOffset.y, timing: { duration: 0 } });
        motion.setTarget({ x: dest.x, y: dest.y, timing: { duration: REPOSITION_DURATION_MS, easing: REPOSITION_EASING } });
      }
      return;
    }
    if (reducedMotion) {
      motion.setTarget({ x: dest.x, y: dest.y, angleDeg: restTarget.angleDeg, timing: { duration: 0 } });
      return;
    }
    motion.setTarget({
      x: dest.x,
      y: dest.y,
      angleDeg: restTarget.angleDeg,
      timing: { duration: REPOSITION_DURATION_MS, easing: REPOSITION_EASING },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restTarget.x, restTarget.y, restTarget.angleDeg, reducedMotion]);

  // Selection lift/scale: a pure radial offset along this card's own angle, snapping in on select
  // and easing back out on deselect — see DESELECT_DURATION_MS's doc comment above. Skipped on
  // mount (a card never mounts pre-selected in practice, and `initial` above already accounts for
  // it if it somehow did).
  const selectMounted = useRef(false);
  useEffect(() => {
    if (!selectMounted.current) {
      selectMounted.current = true;
      return;
    }
    const dest = selected ? liftedTarget : restTarget;
    if (reducedMotion) {
      motion.setTarget({ x: dest.x, y: dest.y, scale: selected ? SELECTED_SCALE : 1, timing: { duration: 0 } });
      return;
    }
    motion.setTarget({
      x: dest.x,
      y: dest.y,
      scale: selected ? SELECTED_SCALE : 1,
      timing: { duration: selected ? 0 : DESELECT_DURATION_MS, easing: SELECT_EASING },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, reducedMotion]);

  // Deal entrance: fires once, the render `playEntrance` flips true (unless it was already true
  // at construction, matching the pre-rewrite EntranceCard's own `played = useRef(playEntrance)`
  // guard — a card that mounts after the deal has already revealed gets no flourish).
  const entered = useRef(playEntrance);
  useEffect(() => {
    if (!playEntrance || entered.current) return;
    entered.current = true;
    const dest = selected ? liftedTarget : restTarget;
    if (reducedMotion) {
      entranceOpacity.value = 1;
      motion.setTarget({ y: dest.y, scale: selected ? SELECTED_SCALE : 1, timing: { duration: 0 } });
      return;
    }
    const delay = entranceIndex * ENTRANCE_STAGGER_MS;
    entranceOpacity.value = withDelay(delay, withTiming(1, { duration: ENTRANCE_DURATION_MS }));
    motion.setTarget({
      y: dest.y,
      scale: selected ? SELECTED_SCALE : 1,
      timing: { duration: ENTRANCE_DURATION_MS, easing: ENTRANCE_EASING, delay },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playEntrance, reducedMotion]);

  // Local departure: the played card's brief lift-off leg before TrickCenter's TravelCard takes
  // over — see LOCAL_DEPARTURE_DISTANCE's doc comment (HumanHandFan.tsx). Departs from this
  // card's real CURRENT committed position (getValues(), which already reflects the selection lift
  // it's necessarily under — see useCardSelection's own doc comment for why selection is never
  // cleared before a play), not its resting slot target.
  const departed = useRef(false);
  useEffect(() => {
    if (!isDeparting || departed.current || reducedMotion) return;
    departed.current = true;
    const current = motion.getValues();
    motion.setTarget({
      x: current.x - departureDeltaX,
      y: current.y - localDepartureDistance,
      scale: LOCAL_DEPARTURE_SCALE,
      timing: { duration: localDepartureDurationMs, easing: Easing.in(Easing.linear) },
      onComplete: onDepartureComplete,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDeparting, reducedMotion]);

  function handlePress() {
    if (!interactive) return;
    onPress();
  }

  // Captured directly by closure, rebuilt fresh every render — NOT read via a ref inside the
  // worklet callback below. Reading a plain React ref's `.current` from inside a Gesture Handler
  // `.onEnd` worklet is unsafe (Demo08's own file comment documents the exact runtime warning this
  // caused when tried) — see docs/animation/ADR/ADR-001-reanimated-demo08-experiment.md.
  const tap = Gesture.Tap().onEnd((_e, success) => {
    if (success) runOnJS(handlePress)();
  });

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: entranceOpacity.value,
    transform: [
      { translateX: motion.shared.translateX.value },
      { translateY: motion.shared.translateY.value },
      { rotate: `${motion.shared.rotate.value}deg` },
      { scale: motion.shared.scale.value },
    ],
  }));

  return (
    <GestureDetector gesture={tap}>
      <Animated.View
        testID={`batak-hand-card-${cardId}`}
        style={[{ position: 'absolute', left: '50%', top: 0, marginLeft: -CARD_WIDTH / 2 }, animatedStyle]}>
        <PlayingCard card={card} size="normal" highlighted={selected} />
      </Animated.View>
    </GestureDetector>
  );
}

// HumanHandFan recomputes restTarget/liftedTarget as fresh object literals every render (rail
// geometry is cheap to recompute, not memoized upstream), which would defeat React.memo's default
// shallow comparison and re-render every hand card whenever any one of them changes. Deliberately
// NOT comparing onPress/registerMotion by reference for the same reason the pre-rewrite
// AnimatedFanCard's own areFanCardPropsEqual didn't compare selectCard/registerCardRef: those
// closures behave identically for this specific card regardless of identity, as long as every
// value below is unchanged — see docs/superpowers/specs/2026-07-21-batak-card-play-animation-
// smoothness-design.md.
function areBatakHandCardPropsEqual(prev: BatakHandCardProps, next: BatakHandCardProps): boolean {
  return (
    prev.cardId === next.cardId &&
    prev.restTarget.x === next.restTarget.x &&
    prev.restTarget.y === next.restTarget.y &&
    prev.restTarget.angleDeg === next.restTarget.angleDeg &&
    prev.liftedTarget.x === next.liftedTarget.x &&
    prev.liftedTarget.y === next.liftedTarget.y &&
    prev.enterFromOffset?.x === next.enterFromOffset?.x &&
    prev.enterFromOffset?.y === next.enterFromOffset?.y &&
    prev.interactive === next.interactive &&
    prev.selected === next.selected &&
    prev.playEntrance === next.playEntrance &&
    prev.entranceIndex === next.entranceIndex &&
    prev.isDeparting === next.isDeparting &&
    prev.departureDeltaX === next.departureDeltaX &&
    prev.localDepartureDistance === next.localDepartureDistance &&
    prev.localDepartureDurationMs === next.localDepartureDurationMs
  );
}

export const BatakHandCard = React.memo(BatakHandCardComponent, areBatakHandCardPropsEqual);
