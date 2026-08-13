import React from "react";
import { Image, StyleSheet } from "react-native";
import { AbsoluteOverlay } from "./AbsoluteOverlay";

const FELT_IMAGE = require("../assets/table/alternatives/green.png");

// A photo-textured green felt, reusable by any game with a tabletop playing surface, not just
// Pişti. Pure decoration: no props, painted once, never redone by game state changes. Replaces
// the earlier hand-drawn SVG weave+vignette (same "real asset over hand-rolled approximation"
// call already made for PlayingCard's card-back art).
function TableFeltComponent() {
  return (
    <AbsoluteOverlay>
      <Image source={FELT_IMAGE} style={styles.image} resizeMode="cover" />
    </AbsoluteOverlay>
  );
}

// Takes no props and its output never changes — memoizing makes it provably a one-time paint,
// never redone on the move-by-move re-renders that drive the rest of a table.
export const TableFelt = React.memo(TableFeltComponent);

const styles = StyleSheet.create({
  image: { width: "100%", height: "100%" },
});
