import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Slider from '@react-native-community/slider';

export interface LabeledSliderProps {
  label: string;
  testID: string;
  minimumValue: number;
  maximumValue: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
}

// Minimal labeled slider for this module's live-tunable demo controls. Deliberately
// separate from apps/playground/src/components/CardTemplateEditor.tsx's own (private,
// unexported) SliderWithInput — this module stays self-contained, per the design spec.
export function LabeledSlider({
  label,
  testID,
  minimumValue,
  maximumValue,
  step,
  value,
  onChange,
}: LabeledSliderProps) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>
        {label}: {Number(value.toFixed(2))}
      </Text>
      <Slider
        testID={testID}
        minimumValue={minimumValue}
        maximumValue={maximumValue}
        step={step}
        value={value}
        onValueChange={onChange}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { marginHorizontal: 16, marginBottom: 8 },
  label: { color: '#fff', fontSize: 13, marginBottom: 2 },
});
