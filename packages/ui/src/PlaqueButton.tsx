import React from "react";
import { Image, StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";
import { PressableFeedback } from "./PressableFeedback";
import { glowShadow } from "./glowShadow";
import { BODY_SEMIBOLD } from "./typography";

// Cut from packages/ui/assets/reference-sheets/icons-bottom-tag.png (2026-08-15) — a plain
// gold-bordered plaque (no ornate corner flourishes, unlike that sheet's larger name-plate
// banners) sized for a compact text-labeled action button rather than a stat/name display.
export const TAG_PLAQUE_IMAGE: number = require("../assets/icons/tag-plaque.png");
export const TAG_PLAQUE_ASPECT_RATIO = 463 / 112;

const PRESS_GLOW_COLOR = "#f5c542";
const PRESS_GLOW_RADIUS = 8;
const DEFAULT_WIDTH = 150;

export interface PlaqueButtonProps {
  label: string;
  onPress: () => void;
  width?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

// A text-labeled action button on the same gold-plaque art as the rest of this app's chrome,
// with the same press cue every icon button here uses (PressableFeedback's dark overlay + a gold
// glowShadow while pressed) — the text-button equivalent of ModalCloseButton/IconButton for
// actions that need a label (e.g. GameResultModal's "Play Again" / "Back to Home"), not just an
// icon.
export function PlaqueButton({ label, onPress, width = DEFAULT_WIDTH, style, testID }: PlaqueButtonProps) {
  const height = width / TAG_PLAQUE_ASPECT_RATIO;
  return (
    <PressableFeedback
      onPress={onPress}
      accessibilityRole="button"
      style={[{ width, height }, style]}
      testID={testID}>
      {(state) => (
        <View style={[styles.fill, state.pressed && glowShadow(PRESS_GLOW_COLOR, PRESS_GLOW_RADIUS)]}>
          <Image source={TAG_PLAQUE_IMAGE} resizeMode="stretch" style={StyleSheet.absoluteFill} />
          <Text style={styles.label} numberOfLines={1} adjustsFontSizeToFit>
            {label}
          </Text>
        </View>
      )}
    </PressableFeedback>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, alignItems: "center", justifyContent: "center" },
  label: { fontFamily: BODY_SEMIBOLD, fontSize: 15, color: "#f5f0e6", paddingHorizontal: 6 },
});
