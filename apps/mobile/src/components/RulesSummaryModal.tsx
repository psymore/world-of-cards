import React from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import {
  BODY_REGULAR,
  DISPLAY_BOLD,
  MODAL_CARD_LARGE_ASPECT_RATIO,
  MODAL_CARD_LARGE_IMAGE,
  ModalCloseButton,
} from '@world-of-cards/ui';

export interface GameRulesSection {
  heading: string;
  body: string;
}

export interface GameRules {
  title: string;
  sections: GameRulesSection[];
}

export interface RulesSummaryModalProps {
  rules: GameRules;
  visible: boolean;
  onClose: () => void;
}

// Same Modal → backdrop-tap-to-close → inner no-op-Pressable shape as BatakSettingsModal
// (apps/mobile/src/games/batak/BatakSettingsModal.tsx), scaled up to MODAL_CARD_LARGE_IMAGE
// with a ScrollView, since rules content is longer than that modal's one static row.
export function RulesSummaryModal({ rules, visible, onClose }: RulesSummaryModalProps) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const maxWidth = windowWidth * 0.9;
  const maxHeight = windowHeight * 0.85;
  const cardWidth = Math.min(maxWidth, maxHeight * MODAL_CARD_LARGE_ASPECT_RATIO);
  const cardHeight = cardWidth / MODAL_CARD_LARGE_ASPECT_RATIO;

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} testID="rules-summary-modal-backdrop">
        <Pressable onPress={() => {}}>
          <View style={[styles.card, { width: cardWidth, height: cardHeight }]}>
            <Image
              source={MODAL_CARD_LARGE_IMAGE}
              resizeMode="stretch"
              style={[StyleSheet.absoluteFill, styles.cardImage]}
            />
            <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
              <Text style={styles.title}>{rules.title}</Text>
              {rules.sections.map((section) => (
                <View key={section.heading} style={styles.section}>
                  <Text style={styles.sectionHeading}>{section.heading}</Text>
                  <Text style={styles.sectionBody}>{section.body}</Text>
                </View>
              ))}
            </ScrollView>
            <ModalCloseButton onPress={onClose} style={styles.closeButton} testID="rules-summary-modal-close" />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  card: { overflow: 'hidden' },
  cardImage: { width: '100%', height: '100%' },
  content: { flex: 1 },
  contentInner: { padding: 28, paddingTop: 40 },
  title: { fontFamily: DISPLAY_BOLD, fontSize: 20, textAlign: 'center', color: '#f4c542', marginBottom: 18 },
  section: { marginBottom: 16 },
  sectionHeading: { fontFamily: DISPLAY_BOLD, fontSize: 14, color: '#f4c542', marginBottom: 4 },
  sectionBody: { fontFamily: BODY_REGULAR, fontSize: 13.5, color: '#f5f0e6', lineHeight: 19 },
  closeButton: { position: 'absolute', top: 10, right: 10 },
});
