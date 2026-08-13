import React, { useCallback, useState } from "react";
import {
  Image,
  ImageProps,
  ImageSourcePropType,
  LayoutChangeEvent,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";

export interface BottomAnchoredImageProps {
  source: ImageSourcePropType;
  // The source asset's own pixel dimensions — not a target size. Only their ratio matters; it's
  // what renderedHeight is derived from below, so the image is scaled, never distorted.
  assetWidth: number;
  assetHeight: number;
  // Fraction of the asset's own width, on each side, that is transparent padding around the real
  // artwork rather than actual content — common on background-removed ("photoroom"-style) PNGs,
  // where the opaque art doesn't bleed all the way to the file's own edges. 0 by default (the raw
  // image is assumed to already span edge-to-edge). When set, the image is rendered wider than
  // the container by 1 / (1 - left - right) and shifted left so the transparent margin lands
  // off-screen, instead of the visible artwork falling short of the container's true left/right
  // edges. Same technique as HandFrame's own LEFT_CONTENT_MARGIN_FRACTION/
  // RIGHT_CONTENT_MARGIN_FRACTION (packages/ui/src/HandFrame.tsx) — measure once per asset (e.g.
  // scan its alpha channel with sharp) and pass the result as a constant.
  contentInsetLeftFraction?: number;
  contentInsetRightFraction?: number;
  // Applied to the measuring wrapper, not the Image itself — for callers that need to layer this
  // above/below siblings (zIndex) or nudge its stacking position within a shared parent.
  style?: StyleProp<ViewStyle>;
  // Passthrough for standard Image props (testID, accessibilityLabel, etc). source/style/
  // resizeMode are excluded: this component owns all three to guarantee the undistorted,
  // bottom-anchored fill described above.
  imageProps?: Omit<ImageProps, "source" | "style" | "resizeMode">;
}

// renderedWidth * (assetHeight / assetWidth) — the one formula this whole component exists to
// apply consistently. Takes the image's actual rendered width, not the container width directly,
// so the same formula covers both the plain case (renderedWidth === containerWidth) and the
// content-inset case below (renderedWidth is wider than the container). Exported standalone so
// the math is unit-testable without mounting RN's Image/View machinery.
export function computeBottomAnchoredImageHeight(
  assetWidth: number,
  assetHeight: number,
  renderedWidth: number,
): number {
  return renderedWidth * (assetHeight / assetWidth);
}

// Generic "scale an image to the available width, anchor its bottom edge to the parent, never
// distort or crop" layout primitive. Deliberately not window-width-driven (unlike HandFrame,
// which spans useWindowDimensions() because it's always used full-bleed) — this measures its own
// parent via onLayout so it also works inside an arbitrary, narrower-than-window container, per
// its own contract: the parent defines the available space, this component just fills it
// bottom-anchored at the source's true aspect ratio. First real user is the wooden table frame
// (TABLE_FRAME_MAHOGANY_BURGUNDY_PLAQUE_IMAGE); nothing here is specific to that asset.
function BottomAnchoredImageComponent({
  source,
  assetWidth,
  assetHeight,
  contentInsetLeftFraction = 0,
  contentInsetRightFraction = 0,
  style,
  imageProps,
}: BottomAnchoredImageProps) {
  const [containerWidth, setContainerWidth] = useState(0);
  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const width = event.nativeEvent.layout.width;
    setContainerWidth(prev => (prev === width ? prev : width));
  }, []);

  const contentWidthFraction =
    1 - contentInsetLeftFraction - contentInsetRightFraction;
  const renderedWidth = containerWidth / contentWidthFraction;
  const renderedHeight = computeBottomAnchoredImageHeight(
    assetWidth,
    assetHeight,
    renderedWidth,
  );
  const leftOffset = -contentInsetLeftFraction * renderedWidth;

  return (
    <View
      style={[StyleSheet.absoluteFill, style]}
      onLayout={handleLayout}
      pointerEvents="none"
      testID="bottom-anchored-image-container">
      {containerWidth > 0 && (
        <Image
          source={source}
          // 'stretch' fills width x renderedHeight exactly, with no rounding-induced letterbox
          // gap — safe here specifically because that box was already computed at the source's
          // own aspect ratio (renderedHeight above), so nothing is actually distorted.
          resizeMode="stretch"
          style={[
            styles.image,
            { width: renderedWidth, height: renderedHeight, left: leftOffset },
          ]}
          {...imageProps}
        />
      )}
    </View>
  );
}

export const BottomAnchoredImage = React.memo(BottomAnchoredImageComponent);

const styles = StyleSheet.create({
  image: { position: "absolute", bottom: 0 },
});
