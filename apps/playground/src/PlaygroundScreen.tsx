import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { usePlaygroundStore } from "./state/playgroundStore";
import { TableTemplateEditor } from "./components/TableTemplateEditor";
import { CardTemplateEditor } from "./components/CardTemplateEditor";
import { CardGallery } from "./components/CardGallery";
import { TableShellPreview } from "./components/TableShellPreview";

// The functionality panels below the gallery share the felt color as their background
// (not a fixed dark shade) so the table reads as one continuous surface from the card
// gallery down through the editors, rather than two visually disconnected sections.
//
// contentWrapper caps content at a phone-like width and centers it. Without this, native
// rendering was fine (a phone's own screen width is already narrower than the cap), but
// on web (expo start --web) the root container filled the full desktop browser window —
// often 1500px+ wide — so any percentage-based sizing inside scaled up proportionally,
// making cards render far larger than intended. Capping the width makes web layout match
// native regardless of the actual browser window size.
export function PlaygroundScreen() {
  const feltColor = usePlaygroundStore(state => state.table.feltColor);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: feltColor }]}
      contentContainerStyle={styles.scrollContent}>
      <View style={styles.contentWrapper}>
        <Text style={styles.title}>Card Playground</Text>
        <TableShellPreview />
        <CardGallery />
        <TableTemplateEditor />
        <CardTemplateEditor />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingBottom: 40, alignItems: "center" },
  contentWrapper: { width: "100%", maxWidth: 480 },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#f4c542",
    textAlign: "center",
    marginVertical: 16,
  },
});
