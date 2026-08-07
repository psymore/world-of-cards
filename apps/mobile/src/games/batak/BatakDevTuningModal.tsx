// apps/mobile/src/games/batak/BatakDevTuningModal.tsx
import React, { useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { CARD_DIMS, PressableFeedback } from '@world-cards/ui';
import { useDevTuningStore } from '../../state/devTuningStore';

export interface BatakDevTuningModalProps {
  visible: boolean;
  onClose: () => void;
}

const OVERLAP_STEP = 0.01;
const OVERLAP_MIN = 0;
const OVERLAP_MAX = 0.9;
const SPACING_STEP = 2;
// Same bounds the playground's FanConfigControls already uses for its own spacing slider.
const SPACING_MIN = CARD_DIMS.normal.width * 0.2;
const SPACING_MAX = CARD_DIMS.normal.width;

const STEPPER_BUTTON_RADIUS = 16;
const SWITCH_BUTTON_RADIUS = 8;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundTo2(value: number): number {
  return Math.round(value * 100) / 100;
}

function StepperRow({
  label,
  value,
  step,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  step: number;
  min: number;
  max: number;
  onChange: (next: number) => void;
}) {
  return (
    <View style={styles.stepperRow}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <View style={styles.stepperControls}>
        <PressableFeedback
          onPress={() => onChange(clamp(roundTo2(value - step), min, max))}
          accessibilityRole="button"
          style={styles.stepperButton}
          overlayBorderRadius={STEPPER_BUTTON_RADIUS}>
          <Text style={styles.stepperButtonText}>{'−'}</Text>
        </PressableFeedback>
        <Text style={styles.stepperValue}>{value.toFixed(2)}</Text>
        <PressableFeedback
          onPress={() => onChange(clamp(roundTo2(value + step), min, max))}
          accessibilityRole="button"
          style={styles.stepperButton}
          overlayBorderRadius={STEPPER_BUTTON_RADIUS}>
          <Text style={styles.stepperButtonText}>+</Text>
        </PressableFeedback>
      </View>
    </View>
  );
}

function CollapsibleSection({ title, children }: { title: string; children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(true);
  return (
    <View style={styles.section}>
      <PressableFeedback
        onPress={() => setIsOpen((o) => !o)}
        accessibilityRole="button"
        style={styles.sectionToggle}>
        <Text style={styles.sectionToggleText}>{(isOpen ? '▾ ' : '▸ ') + title}</Text>
      </PressableFeedback>
      {isOpen && <View style={styles.sectionContent}>{children}</View>}
    </View>
  );
}

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

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.heading}>Dev Tuning</Text>

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
              value={topOverlap}
              step={OVERLAP_STEP}
              min={OVERLAP_MIN}
              max={OVERLAP_MAX}
              onChange={setTopOverlap}
            />
            <StepperRow
              label="Bottom overlap"
              value={bottomOverlap}
              step={OVERLAP_STEP}
              min={OVERLAP_MIN}
              max={OVERLAP_MAX}
              onChange={setBottomOverlap}
            />
            <StepperRow
              label="Top spacing (px)"
              value={topSpacingPx}
              step={SPACING_STEP}
              min={SPACING_MIN}
              max={SPACING_MAX}
              onChange={setTopSpacingPx}
            />
            <StepperRow
              label="Bottom spacing (px)"
              value={bottomSpacingPx}
              step={SPACING_STEP}
              min={SPACING_MIN}
              max={SPACING_MAX}
              onChange={setBottomSpacingPx}
            />
          </CollapsibleSection>

          <PressableFeedback onPress={onClose} accessibilityRole="button" style={styles.closeButton}>
            <Text style={styles.closeText}>Done</Text>
          </PressableFeedback>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 24, minWidth: 300, maxHeight: '80%' },
  heading: { fontSize: 18, fontWeight: 'bold', marginBottom: 16, textAlign: 'center' },
  section: { marginBottom: 12 },
  sectionToggle: { paddingVertical: 6 },
  sectionToggleText: { fontSize: 15, fontWeight: '600' },
  sectionContent: { paddingTop: 8, gap: 10 },
  switchButton: { backgroundColor: '#2f5fa8', borderRadius: SWITCH_BUTTON_RADIUS, paddingVertical: 10, alignItems: 'center' },
  switchButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  stepperRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepperLabel: { fontSize: 14, flexShrink: 1 },
  stepperControls: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepperButton: {
    width: 32,
    height: 32,
    borderRadius: STEPPER_BUTTON_RADIUS,
    backgroundColor: '#eee',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperButtonText: { fontSize: 18, fontWeight: '700' },
  stepperValue: { fontSize: 14, minWidth: 44, textAlign: 'center' },
  closeButton: { marginTop: 20, alignSelf: 'center' },
  closeText: { fontSize: 16, color: '#2f5fa8', fontWeight: '600' },
});
