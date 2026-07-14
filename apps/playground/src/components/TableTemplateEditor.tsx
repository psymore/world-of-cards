import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { usePlaygroundStore } from '../state/playgroundStore';
import { ColorPicker } from './ColorPicker';

// No standalone preview swatch here on purpose: the CardGallery above now renders the real
// TableFelt/TableWoodCorners components (not a duplicate), and it already reads table color
// state live from the same store — a second, smaller table rendering here would look like a
// different, "redesigned" table instead of the genuine one.
export function TableTemplateEditor() {
  const table = usePlaygroundStore((state) => state.table);
  const setFeltColor = usePlaygroundStore((state) => state.setFeltColor);
  const setWoodColor = usePlaygroundStore((state) => state.setWoodColor);
  const resetTableTemplate = usePlaygroundStore((state) => state.resetTableTemplate);

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Table</Text>
      <ColorPicker label="Felt color" color={table.feltColor} onChange={setFeltColor} />
      <ColorPicker label="Wood corner color" color={table.woodColor} onChange={setWoodColor} />
      <Pressable testID="reset-table-button" onPress={resetTableTemplate} style={styles.resetButton}>
        <Text style={styles.resetButtonLabel}>Reset Table</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  heading: { fontSize: 18, fontWeight: 'bold', marginBottom: 8, color: '#f4c542' },
  resetButton: { backgroundColor: '#c0392b', padding: 10, borderRadius: 6, alignItems: 'center', marginTop: 8 },
  resetButtonLabel: { color: '#ffffff', fontWeight: 'bold' },
});
