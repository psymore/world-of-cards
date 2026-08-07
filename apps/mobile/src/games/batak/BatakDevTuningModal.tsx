// apps/mobile/src/games/batak/BatakDevTuningModal.tsx
import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { CARD_DIMS, PressableFeedback } from '@world-cards/ui';
import { useDevTuningStore } from '../../state/devTuningStore';
import { STANDARD_RAIL_CONFIG, STANDARD_TOP_OVERLAP, STANDARD_BOTTOM_OVERLAP } from './table/batakRailFan';
import { CollapsibleSection, DevTuningModalShell, StepperRow } from '../../components/devTuning/DevTuningControls';

export interface BatakDevTuningModalProps {
  visible: boolean;
  onClose: () => void;
}

const OVERLAP_STEP = 0.01;
const OVERLAP_MIN = 0;
const OVERLAP_MAX = 0.9;
const SPACING_STEP = 2;
const SPACING_MIN = CARD_DIMS.normal.width * 0.2;
// Raised well past CARD_DIMS.normal.width (94) — the playground's own FanConfigControls slider
// caps there, but this panel is for live-tuning against the real hand, where spacing well beyond
// one card width is a legitimate value to try.
const SPACING_MAX = 200;
const ARC_STEP = 5;
const ARC_MIN = 0;
// railAngleStepDeg caps each card's angle step at arcDegrees / (rowCount - 1) — 180 is already
// well past where that cap stops binding for any real hand size, so this is a practical ceiling,
// not an arbitrary one.
const ARC_MAX = 180;

const SWITCH_BUTTON_RADIUS = 8;

export function BatakDevTuningModal({ visible, onClose }: BatakDevTuningModalProps) {
  const tableBackground = useDevTuningStore((s) => s.tableBackground);
  const setTableBackground = useDevTuningStore((s) => s.setTableBackground);
  const topOverlap = useDevTuningStore((s) => s.topOverlap);
  const setTopOverlap = useDevTuningStore((s) => s.setTopOverlap);
  const bottomOverlap = useDevTuningStore((s) => s.bottomOverlap);
  const setBottomOverlap = useDevTuningStore((s) => s.setBottomOverlap);
  const topSpacingPx = useDevTuningStore((s) => s.topSpacingPx);
  const setTopSpacingPx = useDevTuningStore((s) => s.setTopSpacingPx);
  const bottomSpacingPx = useDevTuningStore((s) => s.bottomSpacingPx);
  const setBottomSpacingPx = useDevTuningStore((s) => s.setBottomSpacingPx);
  const arcDegrees = useDevTuningStore((s) => s.arcDegrees);
  const setArcDegrees = useDevTuningStore((s) => s.setArcDegrees);

  return (
    <DevTuningModalShell visible={visible} onClose={onClose} title="Dev Tuning">
      <CollapsibleSection title="Table Background">
        <PressableFeedback
          onPress={() => setTableBackground(tableBackground === 'felt' ? 'gemini' : 'felt')}
          accessibilityRole="button"
          style={styles.switchButton}
          overlayBorderRadius={SWITCH_BUTTON_RADIUS}
          testID="dev-tuning-background-switch">
          <Text style={styles.switchButtonText}>
            {tableBackground === 'felt' ? 'Switch to Gemini table' : 'Switch to felt table'}
          </Text>
        </PressableFeedback>
      </CollapsibleSection>

      <CollapsibleSection title="Hand Fan">
        <StepperRow
          label="Top overlap"
          value={topOverlap ?? STANDARD_TOP_OVERLAP}
          step={OVERLAP_STEP}
          min={OVERLAP_MIN}
          max={OVERLAP_MAX}
          onChange={setTopOverlap}
        />
        <StepperRow
          label="Bottom overlap"
          value={bottomOverlap ?? STANDARD_BOTTOM_OVERLAP}
          step={OVERLAP_STEP}
          min={OVERLAP_MIN}
          max={OVERLAP_MAX}
          onChange={setBottomOverlap}
        />
        <StepperRow
          label="Top spacing (px)"
          value={topSpacingPx ?? STANDARD_RAIL_CONFIG.spacingPx}
          step={SPACING_STEP}
          min={SPACING_MIN}
          max={SPACING_MAX}
          onChange={setTopSpacingPx}
        />
        <StepperRow
          label="Bottom spacing (px)"
          value={bottomSpacingPx ?? STANDARD_RAIL_CONFIG.spacingPx}
          step={SPACING_STEP}
          min={SPACING_MIN}
          max={SPACING_MAX}
          onChange={setBottomSpacingPx}
        />
        {/* Shared across both rows, not per-row — matches how STANDARD_RAIL_CONFIG/
            COMPACT_RAIL_CONFIG already treat arcDegrees as one value for the whole hand. This
            is also the actual ceiling on how far Overlap/Spacing can visibly spread a row:
            railAngleStepDeg() caps each card's angle step at arcDegrees / (rowCount - 1), so
            once that cap is what's binding, moving Overlap or Spacing further does nothing
            until this is raised too. */}
        <StepperRow
          label="Arc degrees"
          value={arcDegrees ?? STANDARD_RAIL_CONFIG.arcDegrees}
          step={ARC_STEP}
          min={ARC_MIN}
          max={ARC_MAX}
          onChange={setArcDegrees}
        />
      </CollapsibleSection>
    </DevTuningModalShell>
  );
}

const styles = StyleSheet.create({
  switchButton: { backgroundColor: '#2f5fa8', borderRadius: SWITCH_BUTTON_RADIUS, paddingVertical: 10, alignItems: 'center' },
  switchButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});
