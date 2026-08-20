import React from "react";
import { Image, StyleSheet, useWindowDimensions } from "react-native";

const FRAME_IMAGE = require("../assets/table/themes/wooden-frame-long-Photoroom.png");

// Measured directly from the asset's own pixel/alpha data (not eyeballed): its native
// height/width ratio, and how far down its top-edge arch peaks (fraction of the image's own
// height, measured from the top, at the horizontal center). This asset also has taller corner
// hook flourishes that peak higher still (~0.045) than the main arch (~0.084) — the main arch is
// what's used here, same convention as the original thin-arc candidate asset.
export const HAND_FRAME_ASPECT_RATIO = 1005 / 1566;
export const HAND_FRAME_PEAK_FRACTION = 0.084;

// The artwork doesn't bleed all the way to the image's own left/right edges — there's a small
// transparent margin on each side (measured from the alpha channel: the first opaque column is
// 2.3% in from the left, the last is 2.4% in from the right). Rendering the raw image at exactly
// window width would leave that margin as a visible felt gap at the screen edges instead of the
// ornamental hooks touching them.
const LEFT_CONTENT_MARGIN_FRACTION = 36 / 1566;
const RIGHT_CONTENT_MARGIN_FRACTION = 37 / 1566;
const CONTENT_WIDTH_FRACTION =
  1 - LEFT_CONTENT_MARGIN_FRACTION - RIGHT_CONTENT_MARGIN_FRACTION;

export interface HandFrameProps {
  // Distance in dp from the containing box's true bottom edge to the image's own bottom edge.
  // Each game computes this from its own hand-row geometry so the frame's measured arch-peak
  // lands at that row's peak — see BatakTable for the actual derivation.
  bottomOffset: number;
  // Optional explicit height (dp), overriding the natural rendered-width * HAND_FRAME_ASPECT_RATIO
  // height. Lets a caller stretch the image non-uniformly when it needs to satisfy two
  // constraints at once — e.g. reaching flush to the screen's true bottom edge while keeping its
  // arch peak at a specific height (see BatakTable's derivation). Omit for the undistorted
  // natural aspect.
  height?: number;
}

// Spans the full window width (not just the parent's content width) so the panel's ornamental
// corners reach the phone's true edges even if a future container ever adds horizontal padding.
function HandFrameComponent({ bottomOffset, height }: HandFrameProps) {
  const { width } = useWindowDimensions();
  // Render the full image (margins included) wide enough that its CONTENT — not its own raw
  // bounding box — spans exactly `width`, then shift left so the margin falls off-screen instead
  // of the artwork falling short of the edges (same "overshoot off-screen" idea as bottomOffset).
  const renderedWidth = width / CONTENT_WIDTH_FRACTION;
  const leftOffset = -LEFT_CONTENT_MARGIN_FRACTION * renderedWidth;
  const resolvedHeight = height ?? renderedWidth * HAND_FRAME_ASPECT_RATIO;
  return (
    <Image
      source={FRAME_IMAGE}
      // 'stretch' (RN's Image default is 'cover') is required whenever `height` overrides the
      // natural aspect ratio: 'cover' would scale uniformly and crop the overflow instead —
      // cropping the width and clipping the ornamental corner hooks, not stretching the height.
      resizeMode="stretch"
      style={[
        styles.image,
        {
          width: renderedWidth,
          height: resolvedHeight,
          left: leftOffset,
          bottom: bottomOffset,
        },
      ]}
    />
  );
}

export const HandFrame = React.memo(HandFrameComponent);

const styles = StyleSheet.create({
  image: { position: "absolute", pointerEvents: "none" },
});
