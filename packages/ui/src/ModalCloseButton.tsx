import React from "react";
import { Image, StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { PressableFeedback } from "./PressableFeedback";
import { glowShadow } from "./glowShadow";

// Cut from packages/ui/assets/buttons/ChatGPT Image Aug 15, 2026, 11_11_16 AM.png (2026-08-15) —
// a gold-ringed circular icon button matching this app's ornate gold/felt aesthetic.
export const MODAL_CLOSE_BUTTON_IMAGE: number = require("../assets/buttons/button-close.png");

const BUTTON_SIZE = 36;
// Gold, matching the button art's own ring color — same glowShadow() utility already used for
// active/selected states elsewhere (highlighted cards, active-turn badges), so this press cue
// reads as "the same kind of glow" rather than a one-off invented for this button alone.
const PRESS_GLOW_COLOR = "#f5c542";
const PRESS_GLOW_RADIUS = 10;

export interface ModalCloseButtonProps {
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

// The single close (X) affordance every modal shell uses — top-right of the card, replacing each
// modal's old bottom "Done" text button. Layers this app's two existing press cues rather than
// inventing a third: PressableFeedback's shared dark-overlay tap cue (every button in the app
// already has this) plus a gold glowShadow while pressed (see PRESS_GLOW_COLOR above).
export function ModalCloseButton({ onPress, style, testID }: ModalCloseButtonProps) {
  return (
    <PressableFeedback
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Close"
      hitSlop={12}
      overlayBorderRadius={BUTTON_SIZE / 2}
      style={[styles.button, style]}
      testID={testID}>
      {(state) => (
        // glowShadow() returns a ViewStyle (shadow props type-incompatible with ImageStyle's
        // narrower `overflow`) — applied to this wrapping View rather than the Image itself,
        // matching how every other glowShadow() call site in this package already does it
        // (PlayingCard.tsx's `highlighted`, SeatIdentity.tsx's turn-glow ring).
        <View style={state.pressed && glowShadow(PRESS_GLOW_COLOR, PRESS_GLOW_RADIUS)}>
          <Image source={MODAL_CLOSE_BUTTON_IMAGE} resizeMode="contain" style={styles.image} />
        </View>
      )}
    </PressableFeedback>
  );
}

const styles = StyleSheet.create({
  button: { width: BUTTON_SIZE, height: BUTTON_SIZE },
  image: { width: BUTTON_SIZE, height: BUTTON_SIZE },
});
