// apps/mobile/src/games/pisti/PistiDevTuningModal.tsx
import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { CARD_DIMS, PressableFeedback } from '@world-cards/ui';
import { useDevTuningStore } from '../../state/devTuningStore';
import type { PistiTableBackground } from '../../state/devTuningStore';
import { PISTI_RAIL_CONFIG } from './table/pistiRailFan';
import { CollapsibleSection, DevTuningModalShell, StepperRow } from '../../components/devTuning/DevTuningControls';
import { TABLE_SURFACE_MATERIAL_OPTIONS } from '../../components/devTuning/tableSurfaceMaterialOptions';

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

const OPTION_BUTTON_RADIUS = 8;

// Every Pişti table design built so far (docs/superpowers/plans/2026-08-12-pisti-table-shell-
// pilot-design.md and the follow-up dev-tuning work after it) — 'frameOnly' ("Default Frame") is
// the shipped default, listed first so it's immediately visible/selected at the top of the panel;
// the other seven (now ordered by their rough chronological build order) are dev-tuning-only
// comparisons.
const PISTI_TABLE_BACKGROUND_OPTIONS: { value: PistiTableBackground; label: string }[] = [
  { value: 'frameOnly', label: 'Default Frame (current)' },
  { value: 'felt', label: 'Felt (legacy default)' },
  { value: 'gemini', label: 'Gemini (legacy alt)' },
  { value: 'tableShell', label: 'Table Shell (experiment)' },
  { value: 'stretchedFelt', label: 'Stretched felt panel (experiment)' },
  { value: 'legacyRevisited', label: 'Legacy Revisited (experiment)' },
  { value: 'newDesign', label: 'New Design (experiment)' },
  { value: 'frameBottomAnchored', label: 'Default Frame, bottom-anchored (experiment)' },
];

// Pişti's hand is one row (PISTI_RAIL_CONFIG, no Standard/Compact split like Batak's) — one
// overlap/spacing/arcDegrees each, not top/bottom pairs. Table Background uses Pişti's OWN
// pistiTableBackground field — unlike the hand-fan tuning fields, this is deliberately NOT shared
// with Batak's own tableBackground/felt-vs-gemini switch, since Pişti now has a much richer set
// of table designs Batak was never part of (see devTuningStore.ts's PistiTableBackground doc).
export function PistiDevTuningModal({ visible, onClose }: PistiDevTuningModalProps) {
  const pistiTableBackground = useDevTuningStore((s) => s.pistiTableBackground);
  const setPistiTableBackground = useDevTuningStore((s) => s.setPistiTableBackground);
  const tableSurfaceMaterial = useDevTuningStore((s) => s.tableSurfaceMaterial);
  const setTableSurfaceMaterial = useDevTuningStore((s) => s.setTableSurfaceMaterial);
  const overlap = useDevTuningStore((s) => s.pistiOverlap);
  const setOverlap = useDevTuningStore((s) => s.setPistiOverlap);
  const spacingPx = useDevTuningStore((s) => s.pistiSpacingPx);
  const setSpacingPx = useDevTuningStore((s) => s.setPistiSpacingPx);
  const arcDegrees = useDevTuningStore((s) => s.pistiArcDegrees);
  const setArcDegrees = useDevTuningStore((s) => s.setPistiArcDegrees);

  return (
    <DevTuningModalShell visible={visible} onClose={onClose} title="Dev Tuning">
      <CollapsibleSection title="Table Background">
        {PISTI_TABLE_BACKGROUND_OPTIONS.map((option) => {
          const isSelected = option.value === pistiTableBackground;
          return (
            <PressableFeedback
              key={option.value}
              onPress={() => setPistiTableBackground(option.value)}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              style={[styles.optionRow, isSelected && styles.optionRowSelected]}
              overlayBorderRadius={OPTION_BUTTON_RADIUS}
              testID={`pisti-dev-tuning-background-${option.value}`}>
              <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                {(isSelected ? '● ' : '○ ') + option.label}
              </Text>
            </PressableFeedback>
          );
        })}
      </CollapsibleSection>

      <CollapsibleSection title="Table Felt">
        {TABLE_SURFACE_MATERIAL_OPTIONS.map((option) => {
          const isSelected = option.value === tableSurfaceMaterial;
          return (
            <PressableFeedback
              key={option.value}
              onPress={() => setTableSurfaceMaterial(option.value)}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              style={[styles.optionRow, isSelected && styles.optionRowSelected]}
              overlayBorderRadius={OPTION_BUTTON_RADIUS}
              testID={`pisti-dev-tuning-surface-material-${option.value}`}>
              <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                {(isSelected ? '● ' : '○ ') + option.label}
              </Text>
            </PressableFeedback>
          );
        })}
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
  optionRow: {
    backgroundColor: '#eee',
    borderRadius: OPTION_BUTTON_RADIUS,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 6,
  },
  optionRowSelected: { backgroundColor: '#2f5fa8' },
  optionText: { color: '#222', fontSize: 14, fontWeight: '600' },
  optionTextSelected: { color: '#fff' },
});
