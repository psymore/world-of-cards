import React from 'react';
import { Image, Modal, Pressable, StyleSheet, Switch, Text, useWindowDimensions, View } from 'react-native';
import {
  BODY_REGULAR,
  DISPLAY_BOLD,
  MODAL_CARD_SMALL_ASPECT_RATIO,
  MODAL_CARD_SMALL_IMAGE,
  ModalCloseButton,
} from '@world-cards/ui';
import { useSettingsStore } from '../../state/settingsStore';

export interface BatakSettingsModalProps {
  visible: boolean;
  onClose: () => void;
}

// Same MODAL_CARD_SMALL_IMAGE-backed, contain-fit-sized, outside-tap-to-close shape as
// DevTuningModalShell (apps/mobile/src/components/devTuning/DevTuningControls.tsx) — this
// modal's content is one static row, short enough that it never needs DevTuningModalShell's
// scroll/swipe-to-dismiss machinery, so it stays a small standalone component rather than
// sharing that shell.
export function BatakSettingsModal({ visible, onClose }: BatakSettingsModalProps) {
  const dimUnplayableCards = useSettingsStore((s) => s.dimUnplayableCards);
  const setDimUnplayableCards = useSettingsStore((s) => s.setDimUnplayableCards);

  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const maxWidth = windowWidth * 0.9;
  const maxHeight = windowHeight * 0.8;
  const cardWidth = Math.min(maxWidth, maxHeight * MODAL_CARD_SMALL_ASPECT_RATIO);
  const cardHeight = cardWidth / MODAL_CARD_SMALL_ASPECT_RATIO;

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} testID="batak-settings-modal-backdrop">
        {/* No-op onPress claims the touch responder so an inside tap doesn't fall through to the
            backdrop's own onPress above and close the modal — same reasoning as
            DevTuningModalShell's identical wrapper. */}
        <Pressable onPress={() => {}}>
          <View style={[styles.card, { width: cardWidth, height: cardHeight }]}>
            <Image
              source={MODAL_CARD_SMALL_IMAGE}
              resizeMode="stretch"
              style={[StyleSheet.absoluteFill, styles.cardImage]}
            />
            <Text style={styles.heading}>Settings</Text>
            <View style={styles.row}>
              <Text style={styles.label}>Dim Unplayable Cards</Text>
              <Switch value={dimUnplayableCards} onValueChange={setDimUnplayableCards} />
            </View>
            <ModalCloseButton onPress={onClose} style={styles.closeButton} testID="batak-settings-modal-close" />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  // No backgroundColor/borderRadius of its own — MODAL_CARD_SMALL_IMAGE (an absoluteFill sibling,
  // painted first) is the entire visible card, gold rim and rounded corners baked in.
  card: { overflow: 'hidden', padding: 24, justifyContent: 'center' },
  // react-native-web's Image falls back to the loaded image's natural pixel size unless width/
  // height are explicit (see DevTuningControls.tsx's own styles.cardImage for the full reasoning).
  cardImage: { width: '100%', height: '100%' },
  // Gold/cream, matching this app's established dark-felt palette (e.g. BatakSetupView's title/
  // body text) — the previous #241a10 near-black was tuned for the old light modal-card-small.png
  // and read as near-invisible against the new dark green-felt background (2026-08-15).
  heading: { fontFamily: DISPLAY_BOLD, fontSize: 20, marginBottom: 16, textAlign: 'center', color: '#f4c542' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  label: { fontFamily: BODY_REGULAR, fontSize: 15, flexShrink: 1, color: '#f5f0e6' },
  // Absolute against `card` (position:'relative' by default in RN) rather than flowing below the
  // row, so it sits fixed at the card's own top-right corner regardless of content height — same
  // placement convention as DevTuningModalShell's own close button.
  closeButton: { position: 'absolute', top: 10, right: 10 },
});
