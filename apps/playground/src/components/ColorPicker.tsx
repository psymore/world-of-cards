import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { PRESET_COLORS } from '../types';

export const HEX_COLOR_PATTERN = /^#([0-9a-fA-F]{6})$/;

export interface ColorPickerProps {
  label: string;
  color: string;
  onChange: (color: string) => void;
}

export function ColorPicker({ label, color, onChange }: ColorPickerProps) {
  const [hexInput, setHexInput] = useState(color);

  // Keep the text input in sync when the color changes from outside this
  // component (e.g. a preset swatch tap, or a "Reset" button elsewhere).
  useEffect(() => {
    setHexInput(color);
  }, [color]);

  function handleHexSubmit() {
    const candidate = hexInput.startsWith('#') ? hexInput : `#${hexInput}`;
    if (HEX_COLOR_PATTERN.test(candidate)) {
      onChange(candidate);
    } else {
      setHexInput(color);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.swatchRow}>
        {PRESET_COLORS.map((preset) => (
          <Pressable
            key={preset}
            testID={`color-swatch-${preset}`}
            onPress={() => onChange(preset)}
            style={[styles.swatch, { backgroundColor: preset }, preset === color && styles.swatchSelected]}
          />
        ))}
      </View>
      <TextInput
        testID="color-hex-input"
        value={hexInput}
        onChangeText={setHexInput}
        onSubmitEditing={handleHexSubmit}
        onBlur={handleHexSubmit}
        autoCapitalize="none"
        style={styles.hexInput}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginVertical: 8 },
  label: { fontWeight: 'bold', marginBottom: 4, color: '#eeeeee' },
  swatchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  swatch: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: '#00000033' },
  swatchSelected: { borderWidth: 3, borderColor: '#f4c542' },
  hexInput: {
    borderWidth: 1,
    borderColor: '#cccccc',
    borderRadius: 4,
    padding: 6,
    width: 100,
    backgroundColor: '#ffffff',
    color: '#111111',
  },
});
