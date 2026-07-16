import React from 'react';
import { Modal, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useSettingsStore } from '../../state/settingsStore';

export interface BatakSettingsModalProps {
  visible: boolean;
  onClose: () => void;
}

export function BatakSettingsModal({ visible, onClose }: BatakSettingsModalProps) {
  const dimUnplayableCards = useSettingsStore((s) => s.dimUnplayableCards);
  const setDimUnplayableCards = useSettingsStore((s) => s.setDimUnplayableCards);

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.heading}>Settings</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Dim Unplayable Cards</Text>
            <Switch value={dimUnplayableCards} onValueChange={setDimUnplayableCards} />
          </View>
          <Pressable onPress={onClose} accessibilityRole="button" style={styles.closeButton}>
            <Text style={styles.closeText}>Done</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 24, minWidth: 260 },
  heading: { fontSize: 18, fontWeight: 'bold', marginBottom: 16, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  label: { fontSize: 15, flexShrink: 1 },
  closeButton: { marginTop: 20, alignSelf: 'center' },
  closeText: { fontSize: 16, color: '#2f5fa8', fontWeight: '600' },
});
