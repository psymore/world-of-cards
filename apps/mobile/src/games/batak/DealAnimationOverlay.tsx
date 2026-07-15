import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

export interface DealAnimationOverlayProps {
  phase: 'shuffling' | 'cutting';
}

// A generic, decorative shuffle-then-cut animation shown over the table while a new hand is
// being dealt — deliberately not tied to the real 52 cards (see the design spec's "Visual
// treatment" section): four navy/gold card-back rectangles that wiggle-and-resettle during
// 'shuffling', then two packets swap vertical order during 'cutting'. Unlike TableFelt/
// CardBackPattern (which use AbsoluteOverlay's pointerEvents:'none' since they're purely
// decorative backgrounds), this overlay must actually block interaction with the table
// underneath while a deal is in progress, so it renders its own absolute-fill View instead of
// reusing AbsoluteOverlay.
export function DealAnimationOverlay({ phase }: DealAnimationOverlayProps) {
  const wiggle = useRef(new Animated.Value(0)).current;
  const cut = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (phase === 'shuffling') {
      wiggle.setValue(0);
      Animated.timing(wiggle, { toValue: 1, duration: 1000, useNativeDriver: true }).start();
    }
  }, [phase, wiggle]);

  useEffect(() => {
    if (phase === 'cutting') {
      cut.setValue(0);
      Animated.timing(cut, { toValue: 1, duration: 700, useNativeDriver: true }).start();
    }
  }, [phase, cut]);

  const wiggleTranslate = wiggle.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, -14, 0],
  });
  const wiggleRotate = wiggle.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['0deg', '-8deg', '0deg'],
  });

  const cutTopTranslate = cut.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, -30, 14] });
  const cutBottomTranslate = cut.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 6, -14] });

  return (
    <View style={styles.overlay}>
      {phase === 'shuffling' && (
        <Animated.View
          style={[
            styles.cardBack,
            { transform: [{ translateX: wiggleTranslate }, { rotate: wiggleRotate }] },
          ]}
        />
      )}
      {phase === 'shuffling' && (
        <Animated.View
          style={[
            styles.cardBack,
            styles.cardBackOffset,
            {
              transform: [
                { translateX: Animated.multiply(wiggleTranslate, -1) },
                { rotate: wiggle.interpolate({ inputRange: [0, 0.5, 1], outputRange: ['0deg', '8deg', '0deg'] }) },
              ],
            },
          ]}
        />
      )}
      {phase === 'cutting' && (
        <>
          <Animated.View style={[styles.cardBack, { transform: [{ translateY: cutTopTranslate }] }]} />
          <Animated.View
            style={[styles.cardBack, styles.cardBackOffset, { transform: [{ translateY: cutBottomTranslate }] }]}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(11, 102, 35, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  cardBack: {
    position: 'absolute',
    width: 46,
    height: 66,
    borderRadius: 6,
    backgroundColor: '#1c2451',
    borderWidth: 1.5,
    borderColor: '#ffd966',
  },
  cardBackOffset: { marginTop: -4 },
});
