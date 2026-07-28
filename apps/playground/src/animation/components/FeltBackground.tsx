import React from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Defs, Line, Pattern, RadialGradient, Rect, Stop } from 'react-native-svg';

// The felt/table backdrop from the Demo 6 reflow-options comparison artifact — a
// dark, slightly warm green radial gradient with a faint diagonal weave, in place
// of the previous flat single-color fill. Purely decorative, behind every demo's
// own content (rendered once in AnimationPlaygroundScreen.tsx rather than per-demo)
// — never intercepts touches, so it doesn't affect any demo's own hit-testing.
export const FeltBackground = React.memo(function FeltBackground() {
  return (
    <Svg style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]}>
      <Defs>
        <RadialGradient id="felt" cx="50%" cy="0%" r="85%">
          <Stop offset="0" stopColor="#163524" />
          <Stop offset="0.7" stopColor="#0e2419" />
          <Stop offset="1" stopColor="#0b1d15" />
        </RadialGradient>
        <Pattern id="weave" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <Line x1="0" y1="0" x2="0" y2="10" stroke="#ffffff" strokeOpacity={0.025} strokeWidth={2} />
        </Pattern>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#felt)" />
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#weave)" />
    </Svg>
  );
});
