// Shared building blocks for every game's __DEV__-only tuning modal (BatakDevTuningModal.tsx,
// PistiDevTuningModal.tsx) — extracted once a second consumer needed the identical
// stepper-row/collapsible-section/modal-shell shape, rather than each game re-authoring it.
import React, { useEffect, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import {
  MODAL_CARD_LARGE_ASPECT_RATIO,
  MODAL_CARD_LARGE_IMAGE,
  ModalCloseButton,
  PressableFeedback,
} from '@world-of-cards/ui';

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

// Downward drag distance/velocity past which releasing the drag handle dismisses the modal
// instead of springing back to rest — matches the general feel of native bottom-sheet swipe
// thresholds (a deliberate, not-quite-halfway drag, or a quick flick, both count).
const SWIPE_DISMISS_DISTANCE = 120;
const SWIPE_DISMISS_VELOCITY = 800;

// The Modal/backdrop/card/heading/Done-button chrome every dev-tuning modal shares — a caller
// supplies only its own CollapsibleSections as children. Capped at 90vw/80vh (bounded further by
// MODAL_CARD_LARGE_IMAGE's own aspect ratio — its content region only ever exists inside that
// image's own glass panel, and stretching a fixed-art panel to an arbitrary box would visibly
// distort the frame, so this fits *inside* the cap rather than filling it), scrollable (previously
// unbounded content — CollapsibleSections left fully expanded — could render past the card's own
// maxHeight with nothing to clip or scroll it, "extending through the bottom regions" of the
// modal), swipeable via its own drag handle, and dismissible by tapping the backdrop outside it.
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
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const maxWidth = windowWidth * 0.9;
  const maxHeight = windowHeight * 0.8;
  const cardWidth = Math.min(maxWidth, maxHeight * MODAL_CARD_LARGE_ASPECT_RATIO);
  const cardHeight = cardWidth / MODAL_CARD_LARGE_ASPECT_RATIO;

  const translateY = useSharedValue(0);
  // Reset (no leftover drag offset from a previous open) whenever the modal re-opens — translateY
  // is a shared value, so it otherwise survives across visible:false -> true transitions.
  useEffect(() => {
    if (visible) translateY.value = 0;
  }, [visible, translateY]);

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      if (event.translationY > 0) translateY.value = event.translationY;
    })
    .onEnd((event) => {
      if (event.translationY > SWIPE_DISMISS_DISTANCE || event.velocityY > SWIPE_DISMISS_VELOCITY) {
        runOnJS(onClose)();
      }
      translateY.value = withSpring(0, { damping: 18 });
    });

  const dragStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} testID="dev-tuning-modal-backdrop">
        {/* A plain (non-Pressable) View wouldn't claim RN's touch responder, so taps anywhere on
            the card — including its transparent margin outside the rounded glass panel — would
            fall through to the backdrop's own onPress above and close the modal on every inside
            tap. This no-op onPress exists solely to claim the responder instead. */}
        <Pressable onPress={() => {}} style={{ width: cardWidth, maxHeight }}>
          <Animated.View style={[styles.card, { height: cardHeight }, dragStyle]}>
            <Image
              source={MODAL_CARD_LARGE_IMAGE}
              resizeMode="stretch"
              style={[StyleSheet.absoluteFill, styles.cardImage]}
            />
            <GestureDetector gesture={panGesture}>
              <View style={styles.dragHandleArea}>
                <View style={styles.dragHandle} />
                <Text style={styles.heading}>{title}</Text>
              </View>
            </GestureDetector>
            <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
              {children}
            </ScrollView>
            <ModalCloseButton onPress={onClose} style={styles.closeButton} testID="dev-tuning-modal-close" />
          </Animated.View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  // No backgroundColor/borderRadius of its own — MODAL_CARD_LARGE_IMAGE (an absoluteFill sibling,
  // painted first) is the entire visible card, gold rim and rounded corners baked in. width/height
  // are computed inline (contain-fit against the image's own aspect ratio, capped at 90vw/80vh —
  // see the component body) rather than living here, since they depend on the window size.
  card: { overflow: 'hidden' },
  // react-native-web's Image falls back to the loaded image's natural pixel size unless width/
  // height are explicit — StyleSheet.absoluteFill alone leaves them 'auto' on web (see
  // TableShell.tsx's own styles.fill for the same fix), which let the 874x1462-native modal-card
  // art escape its own overflow:hidden-clipped ancestor. Explicit 100%/100% forces the fill on
  // web while staying a no-op on native.
  cardImage: { width: '100%', height: '100%' },
  dragHandleArea: { alignItems: 'center', paddingTop: 14, paddingBottom: 4 },
  // A plain code-drawn grip bar (not part of the source art) — the visual affordance that this
  // header strip is what you drag to swipe the sheet closed, same convention as native bottom
  // sheets. Sits above the heading so it doesn't compete with the title for attention.
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(36, 26, 16, 0.35)',
    marginBottom: 10,
  },
  heading: { fontSize: 18, fontWeight: 'bold', textAlign: 'center', color: '#241a10' },
  scroll: { flexShrink: 1 },
  scrollContent: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 16 },
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
  // Absolute against `card` (the nearest positioned ancestor — Views are position:'relative' by
  // default in RN) rather than flowing after the ScrollView, so it stays fixed to the card's own
  // top-right corner regardless of scroll content length. Painted after dragHandleArea in the tree,
  // so it sits visually on top of — and wins touch priority over — that area's swipe gesture where
  // the two overlap.
  closeButton: { position: 'absolute', top: 10, right: 10 },
});
