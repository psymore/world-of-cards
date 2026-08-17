import React from "react";
import { Image, ImageSourcePropType, StyleProp, View, ViewStyle } from "react-native";
import { PressableFeedback } from "./PressableFeedback";
import { glowShadow } from "./glowShadow";

// Gold, matching this app's icon art's own ring/metal color — shared by every icon button
// (ModalCloseButton included) so every "tap an icon" interaction in the app reads as the same
// kind of glow, not a one-off invented per button.
const PRESS_GLOW_COLOR = "#f5c542";
const PRESS_GLOW_RADIUS = 10;

export interface IconButtonProps {
  source: ImageSourcePropType;
  size: number;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityLabel?: string;
}

// The base "tap a gold icon" interaction every icon button in the app shares: PressableFeedback's
// dark-overlay tap cue layered with a gold glowShadow while pressed. ModalCloseButton is a thin
// wrapper around this with its own fixed source/size; other icon buttons (e.g. the home icon on
// setup/game screens) use this directly.
export function IconButton({ source, size, onPress, style, testID, accessibilityLabel }: IconButtonProps) {
  return (
    <PressableFeedback
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={12}
      overlayBorderRadius={size / 2}
      style={[{ width: size, height: size }, style]}
      testID={testID}>
      {(state) => (
        // glowShadow() returns a ViewStyle (see ModalCloseButton's own doc comment on why this
        // can't apply directly to the Image) — applied to this wrapping View instead.
        <View style={state.pressed && glowShadow(PRESS_GLOW_COLOR, PRESS_GLOW_RADIUS)}>
          <Image source={source} resizeMode="contain" style={{ width: size, height: size }} />
        </View>
      )}
    </PressableFeedback>
  );
}
