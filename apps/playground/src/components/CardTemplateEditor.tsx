import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Slider from '@react-native-community/slider';
import type { Card } from '@world-cards/engine';
import type { CardGroup } from '../types';
import { MAX_CARD_BORDERS } from '../types';
import { usePlaygroundStore } from '../state/playgroundStore';
import { PlaygroundCard } from './PlaygroundCard';
import { ColorPicker } from './ColorPicker';
import { pickCardImage, buildCardImage } from '../utils/imagePicker';

const GROUP_LABELS: Record<CardGroup, string> = {
  number: '2–10',
  face: 'J · Q · K',
  ace: 'Aces',
};

const GROUP_ORDER: CardGroup[] = ['number', 'face', 'ace'];

const GROUP_PREVIEW_CARD: Record<CardGroup, Card> = {
  number: { id: 'preview-number', suit: 'spades', rank: '7' },
  face: { id: 'preview-face', suit: 'hearts', rank: 'Q' },
  ace: { id: 'preview-ace', suit: 'clubs', rank: 'A' },
};

export function CardTemplateEditor() {
  const [selectedGroup, setSelectedGroup] = useState<CardGroup>('number');
  const template = usePlaygroundStore((state) => state.templates[selectedGroup]);
  const setBorderRadius = usePlaygroundStore((state) => state.setBorderRadius);
  const setBorderWidth = usePlaygroundStore((state) => state.setBorderWidth);
  const setBorderColor = usePlaygroundStore((state) => state.setBorderColor);
  const addBorder = usePlaygroundStore((state) => state.addBorder);
  const removeBorder = usePlaygroundStore((state) => state.removeBorder);
  const setCardImage = usePlaygroundStore((state) => state.setCardImage);
  const updateCardImage = usePlaygroundStore((state) => state.updateCardImage);
  const clearCardImage = usePlaygroundStore((state) => state.clearCardImage);
  const resetCardTemplate = usePlaygroundStore((state) => state.resetCardTemplate);

  async function handleAddImage() {
    const picked = await pickCardImage();
    if (picked != null) {
      setCardImage(selectedGroup, buildCardImage(picked));
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.groupRow}>
        {GROUP_ORDER.map((group) => (
          <Pressable
            key={group}
            testID={`group-tab-${group}`}
            onPress={() => setSelectedGroup(group)}
            style={[styles.groupTab, group === selectedGroup && styles.groupTabActive]}
          >
            <Text style={styles.groupTabLabel}>{GROUP_LABELS[group]}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.editorBody}>
        <PlaygroundCard card={GROUP_PREVIEW_CARD[selectedGroup]} template={template} size="large" />

        <View style={styles.controls}>
          <Text style={styles.controlLabel}>Border radius: {template.borderRadius}</Text>
          <Slider
            testID="border-radius-slider"
            minimumValue={0}
            maximumValue={40}
            step={1}
            value={template.borderRadius}
            onValueChange={(value) => setBorderRadius(selectedGroup, value)}
          />

          {template.borders.map((border, index) => (
            <View key={index} style={styles.borderLayer}>
              <View style={styles.borderLayerHeader}>
                <Text style={styles.controlLabel}>Border {index + 1}</Text>
                {template.borders.length > 1 && (
                  <Pressable
                    testID={`remove-border-${index}`}
                    onPress={() => removeBorder(selectedGroup, index)}
                    style={styles.removeBorderButton}
                  >
                    <Text style={styles.removeBorderButtonLabel}>Remove</Text>
                  </Pressable>
                )}
              </View>
              <Text style={styles.controlLabel}>Size: {border.width}</Text>
              <Slider
                testID={`border-width-slider-${index}`}
                minimumValue={1}
                maximumValue={12}
                step={1}
                value={border.width}
                onValueChange={(value) => setBorderWidth(selectedGroup, index, value)}
              />
              <ColorPicker
                label="Color"
                color={border.color}
                onChange={(color) => setBorderColor(selectedGroup, index, color)}
              />
            </View>
          ))}

          {template.borders.length < MAX_CARD_BORDERS && (
            <Pressable testID="add-border-button" onPress={() => addBorder(selectedGroup)} style={styles.actionButton}>
              <Text style={styles.actionButtonLabel}>+ Add Border</Text>
            </Pressable>
          )}

          {template.image == null ? (
            <Pressable testID="add-image-button" onPress={handleAddImage} style={styles.actionButton}>
              <Text style={styles.actionButtonLabel}>Add Image</Text>
            </Pressable>
          ) : (
            <View>
              <Text style={styles.controlLabel}>Scale: {template.image.scale.toFixed(2)}</Text>
              <Slider
                testID="image-scale-slider"
                minimumValue={0.3}
                maximumValue={2.5}
                step={0.05}
                value={template.image.scale}
                onValueChange={(value) => updateCardImage(selectedGroup, { scale: value })}
              />
              <Text style={styles.controlLabel}>Horizontal offset: {template.image.offsetX}</Text>
              <Slider
                testID="image-offset-x-slider"
                minimumValue={-60}
                maximumValue={60}
                step={1}
                value={template.image.offsetX}
                onValueChange={(value) => updateCardImage(selectedGroup, { offsetX: value })}
              />
              <Text style={styles.controlLabel}>Vertical offset: {template.image.offsetY}</Text>
              <Slider
                testID="image-offset-y-slider"
                minimumValue={-60}
                maximumValue={60}
                step={1}
                value={template.image.offsetY}
                onValueChange={(value) => updateCardImage(selectedGroup, { offsetY: value })}
              />
              <Pressable
                testID="remove-image-button"
                onPress={() => clearCardImage(selectedGroup)}
                style={styles.actionButton}
              >
                <Text style={styles.actionButtonLabel}>Remove Image</Text>
              </Pressable>
            </View>
          )}

          <Pressable
            testID="reset-group-button"
            onPress={() => resetCardTemplate(selectedGroup)}
            style={styles.resetButton}
          >
            <Text style={styles.actionButtonLabel}>Reset {GROUP_LABELS[selectedGroup]}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  groupRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  groupTab: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, backgroundColor: '#eeeeee' },
  groupTabActive: { backgroundColor: '#f4c542' },
  groupTabLabel: { fontWeight: 'bold' },
  editorBody: { flexDirection: 'row', gap: 16, alignItems: 'flex-start' },
  controls: { flex: 1 },
  controlLabel: { marginTop: 8, marginBottom: 2, color: '#eeeeee' },
  borderLayer: { borderWidth: 1, borderColor: '#ffffff33', borderRadius: 8, padding: 10, marginTop: 8 },
  borderLayerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  removeBorderButton: { backgroundColor: '#c0392b', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 6 },
  removeBorderButtonLabel: { color: '#ffffff', fontWeight: 'bold', fontSize: 12 },
  actionButton: { backgroundColor: '#1c2451', padding: 10, borderRadius: 6, alignItems: 'center', marginTop: 8 },
  resetButton: { backgroundColor: '#c0392b', padding: 10, borderRadius: 6, alignItems: 'center', marginTop: 16 },
  actionButtonLabel: { color: '#ffffff', fontWeight: 'bold' },
});
