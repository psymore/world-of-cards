import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

const STRIP_HEIGHT = 140;

export const BaizeStrip = React.memo(function BaizeStrip() {
  const [width, setWidth] = useState(0);
  return (
    <View style={styles.container} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 && (
        <Svg width={width} height={STRIP_HEIGHT}>
          <Defs>
            <LinearGradient id="baizeStripGradient" x1="0%" y1="100%" x2="0%" y2="0%">
              <Stop offset="0%" stopColor="#0d2818" stopOpacity={0.55} />
              <Stop offset="100%" stopColor="#0d2818" stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Rect width={width} height={STRIP_HEIGHT} fill="url(#baizeStripGradient)" />
        </Svg>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: STRIP_HEIGHT,
    pointerEvents: 'none',
  },
});
