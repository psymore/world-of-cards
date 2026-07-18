import React from 'react';
import { Image, StyleSheet, View, useWindowDimensions } from 'react-native';

const FRAME_IMAGE = require('../assets/table/wooden-background.png');

// wooden-background.png (992x1586) is a fully opaque RGB image — no alpha channel, unlike
// wooden-background-frame-1.png's transparent-cutout frame. There's no arch/corner-ornament
// depth to avoid clipping, so this is a plain rectangular crop of the top of the image: any
// fraction works, 0.18 was chosen to include the decorative corner motifs without cropping too
// tight or too deep into the plain wood grain below them.
export const HEADER_FRAME_ASPECT_RATIO = 1586 / 992;
export const HEADER_FRAME_CROP_FRACTION = 0.18;

export interface HeaderWoodFrameProps {
  // Target visible strip height in dp — the caller measures its own header row (e.g. via
  // onLayout) and passes that real height, rather than this component guessing one.
  height: number;
}

// Renders just the top HEADER_FRAME_CROP_FRACTION slice of the frame image, stretched to fill
// exactly `height`: the same "render oversized + overflow:hidden" crop technique HandFrame uses
// whenever its own `height` prop overrides the natural aspect ratio.
function HeaderWoodFrameComponent({ height }: HeaderWoodFrameProps) {
  const { width } = useWindowDimensions();
  const imageHeight = height / HEADER_FRAME_CROP_FRACTION;
  return (
    <View style={[styles.clip, { height }]} pointerEvents="none">
      <Image
        source={FRAME_IMAGE}
        // 'stretch' (RN's Image default is 'cover') is required whenever the rendered height is
        // forced independently of the natural aspect ratio — 'cover' would scale uniformly and
        // crop the overflow instead of stretching it down to size.
        resizeMode="stretch"
        style={{ width, height: imageHeight }}
      />
    </View>
  );
}

export const HeaderWoodFrame = React.memo(HeaderWoodFrameComponent);

const styles = StyleSheet.create({
  clip: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    overflow: 'hidden',
  },
});
