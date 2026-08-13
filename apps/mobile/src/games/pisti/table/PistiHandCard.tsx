import React, { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { Easing, runOnJS, useAnimatedStyle } from 'react-native-reanimated';
import type { Card } from '@world-cards/engine';
import { PlayingCard, CARD_DIMS, PlayingCardSize } from '@world-cards/ui';
import { useReducedMotion } from '../../../components/useReducedMotion';
import { useSettingsStore } from '../../../state/settingsStore';
import { useCardMotion } from '../../../table/useCardMotion';

// Reflow (a sibling added/removed, shrinking/growing the row) — matches Pişti's pre-migration
// AnimatedHandCard's own HAND_CARD_REPOSITION_DURATION_MS/EASING exactly.
const REPOSITION_DURATION_MS = 220;
const REPOSITION_EASING = Easing.inOut(Easing.ease);

// Selecting snaps instantly (a fast two-tap play must not still be mid-rise when the confirming
// tap lands); deselecting eases back down — matches the pre-migration SelectableCard's own
// LIFT_ANIM_DURATION_MS/asymmetry exactly.
const DESELECT_DURATION_MS = 150;
const SELECT_EASING = Easing.out(Easing.cubic);
// Matches the pre-migration SelectableCard's exported SELECTED_SCALE (1.05) — duplicated rather
// than imported so this file has zero dependency on SelectableCard.tsx/Batak's BatakHandCard.tsx,
// per this migration's cross-game-isolation constraint (see the design spec §1).
const SELECTED_SCALE = 1.05;

export interface PistiHandCardTarget {
  x: number;
  y: number;
  angleDeg: number;
}

export interface PistiHandCardProps {
  cardId: string;
  card: Card;
  // This slot's resting (unselected) position/angle — recomputed by PistiHandFan every render
  // from rail geometry, consulted here at mount time and inside the reflow effect only, never
  // re-read directly during render.
  restTarget: PistiHandCardTarget;
  // Same x/y with the selection lift's extraRadius already applied (same angleDeg) — precomputed
  // by the caller since only it has the RailAngleConfig this needs.
  liftedTarget: { x: number; y: number };
  interactive: boolean;
  selected: boolean;
  onPress: () => void;
  // Hands the parent this card's own motion controller (setTarget/getValues) once, on mount —
  // PistiHandFan uses this to retarget the card on every reflow, and PistiTable's
  // playWithMeasuredOrigin uses it to read the card's real current position at tap time.
  registerMotion: (cardId: string, motion: ReturnType<typeof useCardMotion> | null) => void;
  // Caller-supplied (not a fixed constant here) since Pişti now renders the human hand two ways:
  // "small" inside TableShell's felt (narrower usable width than a full-size hand area) and
  // "normal" in the legacy Dev Tuning table-background comparison, which still has its own
  // dedicated hand area with room for full-size cards.
  cardSize: PlayingCardSize;
}

function PistiHandCardComponent({
  cardId,
  card,
  restTarget,
  liftedTarget,
  interactive,
  selected,
  onPress,
  registerMotion,
  cardSize,
}: PistiHandCardProps) {
  const cardWidth = CARD_DIMS[cardSize].width;
  const reducedMotion = useReducedMotion();
  const dimUnplayableCards = useSettingsStore((s) => s.dimUnplayableCards);

  const initialDest = selected ? liftedTarget : restTarget;
  const initial = {
    x: initialDest.x,
    y: initialDest.y,
    angleDeg: restTarget.angleDeg,
    scale: selected ? SELECTED_SCALE : 1,
  };
  const motion = useCardMotion(initial);

  useEffect(() => {
    registerMotion(cardId, motion);
    return () => registerMotion(cardId, null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardId]);

  // Reflow: this card's resting slot changed because a sibling was added/removed. Skipped on
  // mount — `initial` above already placed it at its resting spot, since Pişti's hand has no
  // entrance flourish of its own (it only ever renders once dealPhase === 'revealing', after the
  // deal-flight overlay's own fly-in animation already finished).
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    const dest = selected ? liftedTarget : restTarget;
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
  // and easing back out on deselect. Skipped on mount (a card never mounts pre-selected).
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

  function handlePress() {
    if (!interactive) return;
    onPress();
  }

  // Captured directly by closure, rebuilt fresh every render — NOT read via a ref inside the
  // worklet callback below (unsafe — see Batak's own ADR-001 for the runtime warning this caused).
  const tap = Gesture.Tap().onEnd((_e, success) => {
    if (success) runOnJS(handlePress)();
  });

  const animatedStyle = useAnimatedStyle(() => ({
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
        testID={`pisti-hand-card-${cardId}`}
        style={[{ position: 'absolute', left: '50%', top: 0, marginLeft: -cardWidth / 2 }, animatedStyle]}>
        <View>
          <PlayingCard card={card} size={cardSize} highlighted={selected} />
          {!interactive && dimUnplayableCards && (
            // Dark scrim marking the hand as "not currently tappable" while keeping card art fully
            // visible underneath — carries over the pre-migration SelectableCard's exact behavior
            // (BatakHandCard.tsx's own migration dropped this, since Batak dims per-card legality
            // instead; Pişti has no per-card legality, only a whole-hand on/off, so this is the
            // right visual to preserve here).
            <View
              testID="selectable-card-disabled-scrim"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.35)',
                borderRadius: 6,
                pointerEvents: 'none',
              }}
            />
          )}
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

// PistiHandFan recomputes restTarget/liftedTarget as fresh object literals every render (rail
// geometry is cheap to recompute, not memoized upstream), which would defeat React.memo's default
// shallow comparison and re-render every hand card whenever any one of them changes. Deliberately
// NOT comparing onPress/registerMotion by reference — those closures behave identically for this
// specific card regardless of identity, as long as every value below is unchanged (mirrors
// BatakHandCard.tsx's own areBatakHandCardPropsEqual reasoning).
function arePistiHandCardPropsEqual(prev: PistiHandCardProps, next: PistiHandCardProps): boolean {
  return (
    prev.cardId === next.cardId &&
    prev.restTarget.x === next.restTarget.x &&
    prev.restTarget.y === next.restTarget.y &&
    prev.restTarget.angleDeg === next.restTarget.angleDeg &&
    prev.liftedTarget.x === next.liftedTarget.x &&
    prev.liftedTarget.y === next.liftedTarget.y &&
    prev.interactive === next.interactive &&
    prev.selected === next.selected &&
    prev.cardSize === next.cardSize
  );
}

export const PistiHandCard = React.memo(PistiHandCardComponent, arePistiHandCardPropsEqual);
