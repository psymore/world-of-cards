// apps/mobile/src/games/pisti/PistiDevTuningModal.tsx
import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { CARD_DIMS, PressableFeedback } from '@world-cards/ui';
import { useDevTuningStore } from '../../state/devTuningStore';
import { PISTI_RAIL_CONFIG } from './table/pistiRailFan';
import { CollapsibleSection, DevTuningModalShell, StepperRow } from '../../components/devTuning/DevTuningControls';

export interface PistiDevTuningModalProps {
  visible: boolean;
  onClose: () => void;
}

const OVERLAP_STEP = 0.01;
const OVERLAP_MIN = 0;
const OVERLAP_MAX = 0.9;
const SPACING_STEP = 2;
const SPACING_MIN = CARD_DIMS.normal.width * 0.2;
const SPACING_MAX = 200;
const ARC_STEP = 5;
const ARC_MIN = 0;
const ARC_MAX = 180;

const SWITCH_BUTTON_RADIUS = 8;

// Pişti's hand is one row (PISTI_RAIL_CONFIG, no Standard/Compact split like Batak's) — one
// overlap/spacing/arcDegrees each, not top/bottom pairs. Table Background reuses the same shared
// devTuningStore.tableBackground field Batak's own modal writes — one dev-tuning background
// choice, not a separate one per game (see PistiTable.tsx's identical read).
export function PistiDevTuningModal({ visible, onClose }: PistiDevTuningModalProps) {
  const tableBackground = useDevTuningStore((s) => s.tableBackground);
  const setTableBackground = useDevTuningStore((s) => s.setTableBackground);
  const overlap = useDevTuningStore((s) => s.pistiOverlap);
  const setOverlap = useDevTuningStore((s) => s.setPistiOverlap);
  const spacingPx = useDevTuningStore((s) => s.pistiSpacingPx);
  const setSpacingPx = useDevTuningStore((s) => s.setPistiSpacingPx);
  const arcDegrees = useDevTuningStore((s) => s.pistiArcDegrees);
  const setArcDegrees = useDevTuningStore((s) => s.setPistiArcDegrees);

  return (
    <DevTuningModalShell visible={visible} onClose={onClose} title="Dev Tuning">
      <CollapsibleSection title="Table Background">
        <PressableFeedback
          onPress={() => setTableBackground(tableBackground === 'felt' ? 'gemini' : 'felt')}
          accessibilityRole="button"
          style={styles.switchButton}
          overlayBorderRadius={SWITCH_BUTTON_RADIUS}
          testID="pisti-dev-tuning-background-switch">
          <Text style={styles.switchButtonText}>
            {tableBackground === 'felt' ? 'Switch to Gemini table' : 'Switch to felt table'}
          </Text>
        </PressableFeedback>
      </CollapsibleSection>

      <CollapsibleSection title="Hand Fan">
        <StepperRow
          label="Overlap"
          value={overlap ?? PISTI_RAIL_CONFIG.overlap}
          step={OVERLAP_STEP}
          min={OVERLAP_MIN}
          max={OVERLAP_MAX}
          onChange={setOverlap}
        />
        <StepperRow
          label="Spacing (px)"
          value={spacingPx ?? PISTI_RAIL_CONFIG.spacingPx}
          step={SPACING_STEP}
          min={SPACING_MIN}
          max={SPACING_MAX}
          onChange={setSpacingPx}
        />
        {/* Same role as Batak's Arc degrees control: railAngleStepDeg() caps each card's angle
            step at arcDegrees / (count - 1), so once that cap is what's binding, moving Overlap
            or Spacing further does nothing until this is raised too. */}
        <StepperRow
          label="Arc degrees"
          value={arcDegrees ?? PISTI_RAIL_CONFIG.arcDegrees}
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
