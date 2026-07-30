import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

export const HomeBackground = React.memo(function HomeBackground() {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  return (
    <View
      style={[StyleSheet.absoluteFill, styles.noPointerEvents]}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setSize({ width, height });
      }}>
      {size && (
        <Svg width={size.width} height={size.height}>
          <Defs>
            <LinearGradient id="homeBackgroundGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0%" stopColor="#1a0f2e" />
              <Stop offset="55%" stopColor="#2b1149" />
              <Stop offset="100%" stopColor="#180a26" />
            </LinearGradient>
          </Defs>
          <Rect width={size.width} height={size.height} fill="url(#homeBackgroundGradient)" />
        </Svg>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  noPointerEvents: { pointerEvents: 'none' },
});
