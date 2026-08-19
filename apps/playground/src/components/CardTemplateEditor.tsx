import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Slider from '@react-native-community/slider';
import type { Rank, Suit } from '@world-of-cards/engine';
import type { CardGroup } from '../types';
import { MAX_CARD_BORDERS } from '../types';
import { usePlaygroundStore } from '../state/playgroundStore';
import { PlayingCard } from '@world-of-cards/ui';
import { toPlayingCardOverrides } from '../utils/toPlayingCardOverrides';
import { getCardGroup, formatCardLabel } from '../utils/cardGroups';
import { ORDERED_DECK } from '../utils/orderedDeck';
import { ColorPicker } from './ColorPicker';
import { pickCardImage, buildCardImage } from '../utils/imagePicker';

const GROUP_LABELS: Record<CardGroup, string> = {
  number: '2–10',
  face: 'J · Q · K',
  ace: 'Aces',
};

const GROUP_ORDER: CardGroup[] = ['number', 'face', 'ace'];

// Which card each group tab jumps the browser to when tapped — same representative
// cards the old fixed-preview design used (7♠ / Q♥ / A♣), just resolved against
// ORDERED_DECK's real card objects instead of one-off placeholder Card literals.
const GROUP_REPRESENTATIVE: Record<CardGroup, { rank: Rank; suit: Suit }> = {
  number: { rank: '7', suit: 'spades' },
  face: { rank: 'Q', suit: 'hearts' },
  ace: { rank: 'A', suit: 'clubs' },
};

function findCardIndex(rank: Rank, suit: Suit): number {
  return ORDERED_DECK.findIndex((card) => card.rank === rank && card.suit === suit);
}

// The slider's own layout height before the scaleY transform. The wrapper box reserves
// SLIDER_BASE_HEIGHT * SLIDER_SCALE_Y of layout height so the visually-scaled slider
// neither overlaps its neighbors nor gets clipped.
const SLIDER_BASE_HEIGHT = 22;
const SLIDER_SCALE_Y = 4;

function formatSliderValue(value: number): string {
  // Trims float noise (e.g. 1.1500000000000001 -> "1.15") without forcing decimals on integers.
  return String(Number(value.toFixed(2)));
}

interface SliderWithInputProps {
  label: string;
  testID: string;
  minimumValue: number;
  maximumValue: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
}

// Shared slider + numeric-input control: the input mirrors the slider's value and accepts a
// typed exact value on blur/submit (out-of-range input is clamped to the slider's range,
// non-numeric input reverts to the last valid value — same rejection shape as
// ColorPicker.handleHexSubmit). The slider is wrapped in a scaleY transform to render ~4x
// thicker (track/thumb only; RN transforms don't affect layout, hence the sized wrapper box).
function SliderWithInput({ label, testID, minimumValue, maximumValue, step, value, onChange }: SliderWithInputProps) {
  const [text, setText] = useState(formatSliderValue(value));

  // Keep the text input in sync when the value changes from outside (slider drag,
  // preset apply, group switch, reset) — same pattern as ColorPicker's hex input.
  useEffect(() => {
    setText(formatSliderValue(value));
  }, [value]);

  function handleSubmit() {
    const parsed = Number(text);
    if (text.trim() === '' || !Number.isFinite(parsed)) {
      setText(formatSliderValue(value));
      return;
    }
    const clamped = Math.min(maximumValue, Math.max(minimumValue, parsed));
    // Snap to the slider's own step grid so typed values land on the same values the
    // slider itself can produce (and re-clamp in case snapping pushed past the max).
    const snapped = Number((Math.round((clamped - minimumValue) / step) * step + minimumValue).toFixed(2));
    const next = Math.min(maximumValue, Math.max(minimumValue, snapped));
    onChange(next);
    setText(formatSliderValue(next));
  }

  return (
    <View>
      <Text style={styles.controlLabel}>{label}</Text>
      <View style={styles.sliderRow}>
        <View style={styles.sliderScaleBox}>
          <View style={styles.sliderScaler}>
            <Slider
              testID={testID}
              minimumValue={minimumValue}
              maximumValue={maximumValue}
              step={step}
              value={value}
              onValueChange={onChange}
              style={styles.slider}
            />
          </View>
        </View>
        <TextInput
          testID={`${testID}-input`}
          value={text}
          onChangeText={setText}
          onSubmitEditing={handleSubmit}
          onBlur={handleSubmit}
          keyboardType="numeric"
          autoCapitalize="none"
          style={styles.sliderValueInput}
        />
      </View>
    </View>
  );
}

export function CardTemplateEditor() {
  const [cardIndex, setCardIndex] = useState<number>(() =>
    findCardIndex(GROUP_REPRESENTATIVE.number.rank, GROUP_REPRESENTATIVE.number.suit)
  );
  const currentCard = ORDERED_DECK[cardIndex];
  const selectedGroup = getCardGroup(currentCard.rank);
  const [presetName, setPresetName] = useState('');
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
  const borderPresets = usePlaygroundStore((state) => state.borderPresets);
  const saveBorderPreset = usePlaygroundStore((state) => state.saveBorderPreset);
  const applyBorderPreset = usePlaygroundStore((state) => state.applyBorderPreset);
  const deleteBorderPreset = usePlaygroundStore((state) => state.deleteBorderPreset);

  async function handleAddImage() {
    const picked = await pickCardImage();
    if (picked != null) {
      setCardImage(selectedGroup, buildCardImage(picked));
    }
  }

  function cycleCard(delta: number) {
    setCardIndex((index) => (index + delta + ORDERED_DECK.length) % ORDERED_DECK.length);
  }

  function handleSavePreset() {
    const name = presetName.trim();
    if (name.length === 0) return;
    saveBorderPreset(selectedGroup, name);
    setPresetName('');
  }

  return (
    <View style={styles.container}>
      <View style={styles.groupRow}>
        <Pressable testID="group-nav-prev" onPress={() => cycleCard(-1)} style={styles.groupNavButton}>
          <Text style={styles.groupNavLabel}>‹</Text>
        </Pressable>
        {GROUP_ORDER.map((group) => (
          <Pressable
            key={group}
            testID={`group-tab-${group}`}
            onPress={() => setCardIndex(findCardIndex(GROUP_REPRESENTATIVE[group].rank, GROUP_REPRESENTATIVE[group].suit))}
            style={[styles.groupTab, group === selectedGroup && styles.groupTabActive]}
          >
            <Text style={styles.groupTabLabel}>{GROUP_LABELS[group]}</Text>
          </Pressable>
        ))}
        <Pressable testID="group-nav-next" onPress={() => cycleCard(1)} style={styles.groupNavButton}>
          <Text style={styles.groupNavLabel}>›</Text>
        </Pressable>
      </View>

      <View style={styles.editorBody}>
        <View style={styles.previewColumn}>
          <Text style={styles.previewLabel}>{formatCardLabel(currentCard)}</Text>
          <PlayingCard card={currentCard} size="normal" {...toPlayingCardOverrides(template)} />
        </View>

        <View style={styles.controls}>
          <SliderWithInput
            label="Border radius"
            testID="border-radius-slider"
            minimumValue={0}
            maximumValue={40}
            step={1}
            value={template.borderRadius}
            onChange={(value) => setBorderRadius(selectedGroup, value)}
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
              <SliderWithInput
                label="Size"
                testID={`border-width-slider-${index}`}
                minimumValue={1}
                maximumValue={12}
                step={1}
                value={border.width}
                onChange={(value) => setBorderWidth(selectedGroup, index, value)}
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

          <View style={styles.presetSection}>
            <Text style={styles.presetSectionTitle}>Border presets</Text>
            {borderPresets.map((preset) => (
              <View key={preset.id} style={styles.presetRow}>
                <Pressable
                  testID={`apply-border-preset-${preset.id}`}
                  onPress={() => applyBorderPreset(selectedGroup, preset.id)}
                  style={styles.presetApplyButton}
                >
                  <Text style={styles.presetName}>{preset.name}</Text>
                </Pressable>
                {preset.builtIn !== true && (
                  <Pressable
                    testID={`delete-border-preset-${preset.id}`}
                    onPress={() => deleteBorderPreset(preset.id)}
                    style={styles.presetDeleteButton}
                  >
                    <Text style={styles.presetDeleteLabel}>×</Text>
                  </Pressable>
                )}
              </View>
            ))}
            <View style={styles.presetSaveRow}>
              <TextInput
                testID="preset-name-input"
                value={presetName}
                onChangeText={setPresetName}
                placeholder="Preset name"
                placeholderTextColor="#999999"
                style={styles.presetNameInput}
              />
              <Pressable testID="save-border-preset-button" onPress={handleSavePreset} style={styles.presetSaveButton}>
                <Text style={styles.actionButtonLabel}>Save current as preset</Text>
              </Pressable>
            </View>
          </View>

          {template.image == null ? (
            <Pressable testID="add-image-button" onPress={handleAddImage} style={styles.actionButton}>
              <Text style={styles.actionButtonLabel}>Add Image</Text>
            </Pressable>
          ) : (
            <View>
              <SliderWithInput
                label="Scale"
                testID="image-scale-slider"
                minimumValue={0.3}
                maximumValue={2.5}
                step={0.05}
                value={template.image.scale}
                onChange={(value) => updateCardImage(selectedGroup, { scale: value })}
              />
              <SliderWithInput
                label="Horizontal offset"
                testID="image-offset-x-slider"
                minimumValue={-60}
                maximumValue={60}
                step={1}
                value={template.image.offsetX}
                onChange={(value) => updateCardImage(selectedGroup, { offsetX: value })}
              />
              <SliderWithInput
                label="Vertical offset"
                testID="image-offset-y-slider"
                minimumValue={-60}
                maximumValue={60}
                step={1}
                value={template.image.offsetY}
                onChange={(value) => updateCardImage(selectedGroup, { offsetY: value })}
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
  groupRow: { flexDirection: 'row', gap: 8, marginBottom: 16, alignItems: 'center' },
  groupTab: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, backgroundColor: '#eeeeee' },
  groupTabActive: { backgroundColor: '#f4c542' },
  groupTabLabel: { fontWeight: 'bold' },
  groupNavButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1c2451',
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupNavLabel: { color: '#ffffff', fontSize: 22, fontWeight: 'bold', lineHeight: 24 },
  editorBody: { flexDirection: 'row', gap: 16, alignItems: 'flex-start' },
  previewColumn: { alignItems: 'center', gap: 6 },
  previewLabel: { color: '#eeeeee', fontWeight: 'bold' },
  controls: { flex: 1 },
  controlLabel: { marginTop: 8, marginBottom: 2, color: '#eeeeee' },
  sliderRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sliderScaleBox: {
    flex: 1,
    height: SLIDER_BASE_HEIGHT * SLIDER_SCALE_Y,
    justifyContent: 'center',
  },
  sliderScaler: { transform: [{ scaleY: SLIDER_SCALE_Y }] },
  slider: { height: SLIDER_BASE_HEIGHT },
  sliderValueInput: {
    borderWidth: 1,
    borderColor: '#cccccc',
    borderRadius: 4,
    padding: 6,
    width: 64,
    textAlign: 'center',
    backgroundColor: '#ffffff',
    color: '#111111',
  },
  borderLayer: { borderWidth: 1, borderColor: '#ffffff33', borderRadius: 8, padding: 10, marginTop: 8 },
  borderLayerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  removeBorderButton: { backgroundColor: '#c0392b', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 6 },
  removeBorderButtonLabel: { color: '#ffffff', fontWeight: 'bold', fontSize: 12 },
  actionButton: { backgroundColor: '#1c2451', padding: 10, borderRadius: 6, alignItems: 'center', marginTop: 8 },
  resetButton: { backgroundColor: '#c0392b', padding: 10, borderRadius: 6, alignItems: 'center', marginTop: 16 },
  actionButtonLabel: { color: '#ffffff', fontWeight: 'bold' },
  presetSection: {
    borderWidth: 1,
    borderColor: '#ffffff33',
    borderRadius: 8,
    padding: 10,
    marginTop: 12,
  },
  presetSectionTitle: { fontWeight: 'bold', color: '#eeeeee', marginBottom: 6 },
  presetRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  presetApplyButton: {
    flex: 1,
    backgroundColor: '#eeeeee',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  presetName: { fontWeight: 'bold', color: '#111111' },
  presetDeleteButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#c0392b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetDeleteLabel: { color: '#ffffff', fontWeight: 'bold', fontSize: 16, lineHeight: 18 },
  presetSaveRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  presetNameInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#cccccc',
    borderRadius: 4,
    padding: 6,
    backgroundColor: '#ffffff',
    color: '#111111',
  },
  presetSaveButton: { backgroundColor: '#1c2451', padding: 10, borderRadius: 6, alignItems: 'center' },
});
