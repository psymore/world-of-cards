import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { Card } from '@world-cards/engine';
import { CARD_DIMS } from '@world-cards/ui';
import { railAngleStepDeg, railAngles, railPosition } from '../../../table/railFan';
import { useCardMotion } from '../../../table/useCardMotion';
import { PISTI_RAIL_CONFIG, PISTI_SELECTED_LIFT_DISTANCE } from './pistiRailFan';
import { PistiHandCard } from './PistiHandCard';

const PISTI_CARD_HEIGHT = CARD_DIMS.normal.height;
// Extra vertical room the arc-fan's curve needs below center (railPosition's y grows away from 0
// as |angle| increases) — computed from PISTI_RAIL_CONFIG's own worst case (a 4-card hand's outer
// card sits near maxRotationDeg): radius * (1 - cos(maxRotationDeg)) ≈ 320 * (1 - cos(20°)) ≈ 19px,
// rounded up for margin. A starting point — adjust live once running, per the design spec.
const FAN_CURVE_MARGIN_PX = 24;
const PISTI_HAND_FAN_HEIGHT = PISTI_CARD_HEIGHT + FAN_CURVE_MARGIN_PX;

// One human-hand card's slot: its index within the row and how many cards currently share the
// row (count, not the initial deal size — the fan recenters as the row shrinks).
export interface PistiHandSlot {
  card: Card;
  index: number;
  count: number;
}

function slotPosition(slot: PistiHandSlot, extraRadius: number): { x: number; y: number; angleDeg: number } {
  const angleStepDeg = railAngleStepDeg(PISTI_RAIL_CONFIG, slot.count);
  const angles = railAngles(slot.count, angleStepDeg, PISTI_RAIL_CONFIG.maxRotationDeg);
  const angleDeg = angles[slot.index] ?? 0;
  const pos = railPosition(angleDeg, PISTI_RAIL_CONFIG.radius, extraRadius);
  return { x: pos.x, y: pos.y, angleDeg };
}

// Exported so PistiTable can compute a card's real fan angle at the moment it's tapped (for the
// played-card travel animation's origin rotation) without duplicating pistiRailFan.ts's formula —
// mirrors Batak's HumanHandFan.handCardRotationDeg.
export function pistiCardRotationDeg(index: number, count: number): number {
  const angleStepDeg = railAngleStepDeg(PISTI_RAIL_CONFIG, count);
  const angles = railAngles(count, angleStepDeg, PISTI_RAIL_CONFIG.maxRotationDeg);
  return angles[index] ?? 0;
}

// Renders every human-hand card under one shared parent. Layout/orchestration only: each
// PistiHandCard owns its own motion (position/rotation/scale) and gesture entirely — this
// component computes targets, it doesn't animate anything itself.
export function PistiHandFan({
  slots,
  isHumanInteractive,
  selectedCardId,
  selectCard,
  registerHandMotion,
  handFanRef,
  onHandFanLayout,
}: {
  slots: PistiHandSlot[];
  isHumanInteractive: boolean;
  selectedCardId: string | null;
  selectCard: (cardId: string) => void;
  // Hands the caller (PistiTable) each card's live motion controller as it mounts/unmounts —
  // replaces the old handRowRef/measureInWindow approach entirely.
  registerHandMotion: (cardId: string, motion: ReturnType<typeof useCardMotion> | null) => void;
  // Exposes this component's own root View so PistiTable can measure its real absolute window
  // position — every card's motion (translateX/translateY, read via getValues() at tap time) is
  // relative to THIS container's own top/center, not the screen.
  handFanRef: React.RefObject<View | null>;
  onHandFanLayout: () => void;
}) {
  return (
    <View style={styles.handFan} ref={handFanRef} onLayout={onHandFanLayout} testID="human-hand">
      {slots.map((slot) => {
        const restTarget = slotPosition(slot, 0);
        const liftedTarget = slotPosition(slot, PISTI_SELECTED_LIFT_DISTANCE);
        return (
          <PistiHandCard
            key={slot.card.id}
            cardId={slot.card.id}
            card={slot.card}
            restTarget={restTarget}
            liftedTarget={liftedTarget}
            interactive={isHumanInteractive}
            selected={selectedCardId === slot.card.id}
            onPress={() => selectCard(slot.card.id)}
            registerMotion={registerHandMotion}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  // Fixed height since every card inside is absolutely positioned (see PistiHandCard) and can't
  // contribute to an auto-computed parent height the way normal-flow children would.
  handFan: { height: PISTI_HAND_FAN_HEIGHT },
});
