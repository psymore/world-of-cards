import React from "react";
import { Image, StyleSheet } from "react-native";
import { AbsoluteOverlay } from "./AbsoluteOverlay";

const FRAME_IMAGE = require("../assets/table/default/TABLE-FRAME-MAHOGANY-BURGUNDY-photoroom-trimmed.png");

// The full-bleed carved wood-frame border, stretched non-uniformly to all four edges of its
// container (its own aspect ratio is NOT preserved — same tradeoff LEGACY_STRETCHED_FELT_IMAGE/
// HandFrame already accept for a flat panel with no fine detail sensitive to it). A plain
// width/height: '100%' stretch is safe here — no per-edge overscan or measured-layout workaround
// needed — because the source PNG's own file edges now ARE the artwork's edges (see the
// "-trimmed" file's own doc comment on TABLE_FRAME_MAHOGANY_BURGUNDY_PLAQUE_IMAGE in index.ts for
// the crop that fixed this at the source). Game-agnostic, like TableFelt: no
// props, painted once — pair with a game's own <TableFelt /> underneath as the actual playing
// surface, since this frame's own center is alpha-cut hollow (it reads as a border around the
// felt, not a full replacement background).
function DefaultTableFrameComponent() {
  return (
    <AbsoluteOverlay>
      <Image
        source={FRAME_IMAGE}
        resizeMode="stretch"
        style={styles.imageFill}
      />
    </AbsoluteOverlay>
  );
}

export const DefaultTableFrame = React.memo(DefaultTableFrameComponent);

const styles = StyleSheet.create({
  imageFill: { width: "100%", height: "100%" },
});
