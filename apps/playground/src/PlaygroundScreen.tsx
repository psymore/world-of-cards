import React from "react";
import { ScrollView, StyleSheet, Text } from "react-native";
import { usePlaygroundStore } from "./state/playgroundStore";
import { TableTemplateEditor } from "./components/TableTemplateEditor";
import { CardTemplateEditor } from "./components/CardTemplateEditor";
import { CardGallery } from "./components/CardGallery";

// The functionality panels below the gallery share the felt color as their background
// (not a fixed dark shade) so the table reads as one continuous surface from the card
// gallery down through the editors, rather than two visually disconnected sections.
export function PlaygroundScreen() {
  const feltColor = usePlaygroundStore(state => state.table.feltColor);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: feltColor }]}
      contentContainerStyle={styles.content}>
      <Text style={styles.title}>Card Playground</Text>
      <CardGallery />
      <TableTemplateEditor />
      <CardTemplateEditor />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingBottom: 40 },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#f4c542",
    textAlign: "center",
    marginVertical: 16,
  },
});
