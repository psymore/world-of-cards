// Shared building blocks for every game's __DEV__-only tuning modal (BatakDevTuningModal.tsx,
// PistiDevTuningModal.tsx) — extracted once a second consumer needed the identical
// stepper-row/collapsible-section/modal-shell shape, rather than each game re-authoring it.
import React, { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, TextInput, View } from 'react-native';
import { PressableFeedback } from '@world-cards/ui';

const STEPPER_BUTTON_RADIUS = 16;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundTo2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function StepperRow({
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
  // A local editable buffer, separate from `value` — lets the user freely type ("0.", a bare "-")
  // without every keystroke being clamped/reformatted out from under them. Only re-synced from
  // `value` here, not on every render, so it doesn't fight typing: `value` only actually changes
  // once a +/- tap or a committed text edit calls `onChange`, never mid-keystroke.
  const [text, setText] = useState(value.toFixed(2));
  useEffect(() => {
    setText(value.toFixed(2));
  }, [value]);

  function commitText() {
    const parsed = parseFloat(text);
    if (Number.isFinite(parsed)) {
      onChange(clamp(roundTo2(parsed), min, max));
    } else {
      setText(value.toFixed(2));
    }
  }

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
        <TextInput
          style={styles.stepperInput}
          value={text}
          onChangeText={setText}
          onEndEditing={commitText}
          onSubmitEditing={commitText}
          keyboardType="decimal-pad"
          selectTextOnFocus
        />
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

export function CollapsibleSection({ title, children }: { title: string; children: React.ReactNode }) {
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

// The Modal/backdrop/card/heading/Done-button chrome every dev-tuning modal shares — a caller
// supplies only its own CollapsibleSections as children.
export function DevTuningModalShell({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.heading}>{title}</Text>
          {children}
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
  stepperInput: {
    fontSize: 14,
    minWidth: 56,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  closeButton: { marginTop: 20, alignSelf: 'center' },
  closeText: { fontSize: 16, color: '#2f5fa8', fontWeight: '600' },
});
