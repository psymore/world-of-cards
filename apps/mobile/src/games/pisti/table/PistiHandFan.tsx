import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { Card } from '@world-cards/engine';
import { CARD_DIMS, PlayingCardSize } from '@world-cards/ui';
import { railAngleStepDeg, railAngles, railPosition } from '../../../table/railFan';
import type { RailAngleConfig } from '../../../table/railFan';
import { useCardMotion } from '../../../table/useCardMotion';
import { PISTI_RAIL_CONFIG, PISTI_SELECTED_LIFT_DISTANCE } from './pistiRailFan';
import { PistiHandCard } from './PistiHandCard';
import { useDevTuningStore } from '../../../state/devTuningStore';

// Extra vertical room the arc-fan's curve needs below center (railPosition's y grows away from 0
// as |angle| increases) — computed from PISTI_RAIL_CONFIG's own worst case (a 4-card hand's outer
// card sits near maxRotationDeg): radius * (1 - cos(maxRotationDeg)) ≈ 320 * (1 - cos(20°)) ≈ 19px,
// rounded up for margin. A starting point — adjust live once running, per the design spec.
const FAN_CURVE_MARGIN_PX = 24;
// Nudges the whole fan down from handArea's centered position, opening up a clearer gap below the
// "You" badge above it. A starting point — adjust live once running, per the design spec.
const HAND_FAN_TOP_MARGIN = 16;

// One human-hand card's slot: its index within the row and how many cards currently share the
// row (count, not the initial deal size — the fan recenters as the row shrinks).
export interface PistiHandSlot {
  card: Card;
  index: number;
  count: number;
}

// Exported so PistiTable can compute a card's real fan angle at the moment it's tapped (for the
// played-card travel animation's origin rotation) without duplicating pistiRailFan.ts's formula —
// mirrors Batak's HumanHandFan.handCardRotationDeg.
export function pistiCardRotationDeg(index: number, count: number): number {
  const angleStepDeg = railAngleStepDeg(PISTI_RAIL_CONFIG, count);
  const angles = railAngles(count, angleStepDeg, PISTI_RAIL_CONFIG.maxRotationDeg);
  return angles[index] ?? 0;
}

// Takes a resolved config rather than reaching for PISTI_RAIL_CONFIG itself (unlike
// pistiCardRotationDeg above, which stays on the static config — it's used elsewhere for the
// played-card travel-origin rotation estimate, out of scope for dev-tuning) — this is what lets
// PistiHandFan's __DEV__-only overlap/spacing/arcDegrees overrides (below) actually take effect.
function slotPosition(
  slot: PistiHandSlot,
  config: RailAngleConfig,
  extraRadius: number,
): { x: number; y: number; angleDeg: number } {
  const angleStepDeg = railAngleStepDeg(config, slot.count);
  const angles = railAngles(slot.count, angleStepDeg, config.maxRotationDeg);
  const angleDeg = angles[slot.index] ?? 0;
  const pos = railPosition(angleDeg, config.radius, extraRadius);
  return { x: pos.x, y: pos.y, angleDeg };
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
  cardSize,
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
  // Caller-supplied — see PistiHandCard's own cardSize doc for why this varies by which table
  // background is active rather than being a fixed constant here.
  cardSize: PlayingCardSize;
}) {
  // Read as three separate scalars, unconditionally — never an object literal (zustand 5's
  // useStore has no shallow-equality shim; a selector returning a fresh object every call never
  // structurally equals its previous snapshot and re-renders forever). Matches every other
  // zustand call site in this codebase, including Batak's own dev-tuning reads.
  const devOverlap = useDevTuningStore((s) => s.pistiOverlap);
  const devSpacingPx = useDevTuningStore((s) => s.pistiSpacingPx);
  const devArcDegrees = useDevTuningStore((s) => s.pistiArcDegrees);

  // Pişti's hand is one row (no Standard/Compact, no top/bottom split), so unlike Batak's
  // per-row configForRow, this resolves once for the whole fan. __DEV__-gated overrides (only
  // applied once the panel's control has actually been touched, i.e. non-null) are
  // dead-code-eliminated from a release build.
  const config: RailAngleConfig =
    __DEV__
      ? {
          ...PISTI_RAIL_CONFIG,
          ...(devOverlap != null ? { overlap: devOverlap } : {}),
          ...(devSpacingPx != null ? { spacingPx: devSpacingPx } : {}),
          ...(devArcDegrees != null ? { arcDegrees: devArcDegrees } : {}),
        }
      : PISTI_RAIL_CONFIG;

  const fanHeight = CARD_DIMS[cardSize].height + FAN_CURVE_MARGIN_PX;

  return (
    <View style={[styles.handFan, { height: fanHeight }]} ref={handFanRef} onLayout={onHandFanLayout} testID="human-hand">
      {slots.map((slot) => {
        const restTarget = slotPosition(slot, config, 0);
        const liftedTarget = slotPosition(slot, config, PISTI_SELECTED_LIFT_DISTANCE);
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
            cardSize={cardSize}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  // Height comes from a per-render inline override (see fanHeight above) since every card inside
  // is absolutely positioned (see PistiHandCard) and can't contribute to an auto-computed parent
  // height the way normal-flow children would, and the right height now depends on cardSize.
  handFan: { marginTop: HAND_FAN_TOP_MARGIN },
});
