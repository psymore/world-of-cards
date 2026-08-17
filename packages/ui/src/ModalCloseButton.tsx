import React from "react";
import { StyleProp, ViewStyle } from "react-native";
import { IconButton } from "./IconButton";

// Cut from packages/ui/assets/buttons/ChatGPT Image Aug 15, 2026, 11_11_16 AM.png (2026-08-15) —
// a gold-ringed circular icon button matching this app's ornate gold/felt aesthetic.
export const MODAL_CLOSE_BUTTON_IMAGE: number = require("../assets/buttons/button-close.png");

const BUTTON_SIZE = 36;

export interface ModalCloseButtonProps {
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

// The single close (X) affordance every modal shell uses — top-right of the card, replacing each
// modal's old bottom "Done" text button. A fixed-source, fixed-size wrapper around the shared
// IconButton (gold press-glow + PressableFeedback's dark-overlay tap cue) every icon button in
// the app now uses.
export function ModalCloseButton({ onPress, style, testID }: ModalCloseButtonProps) {
  return (
    <IconButton
      source={MODAL_CLOSE_BUTTON_IMAGE}
      size={BUTTON_SIZE}
      onPress={onPress}
      accessibilityLabel="Close"
      style={style}
      testID={testID}
    />
  );
}
