import React from 'react';
import Svg, { Circle, G, Path } from 'react-native-svg';
import type { Suit } from '@world-cards/engine';

export interface SuitIconProps {
  suit: Suit;
  size: number;
  color: string;
  opacity?: number;
  testID?: string;
}

// Sides pulled inward (a defined waist between the lobes and the point) instead of a smooth,
// uninterrupted convex curve — see docs/superpowers/specs/2026-07-14-suit-icon-glyph-refinement-design.md.
const HEART_PATH =
  'M12,21 C9,17 2.5,13.5 3,8.5 C3,5.5 5.5,3 8.5,3 C10.36,3 12,4.5 12,6.5 C12,4.5 13.64,3 15.5,3 C18.5,3 21,5.5 21,8.5 C21.5,13.5 15,17 12,21 Z';

// Each straight edge replaced with a curve bowing toward the center, reading as a traditional
// four-pointed lozenge rather than a plain rotated square.
const DIAMOND_PATH =
  'M12,2 Q15.15,8.5 21,12 Q15.15,15.5 12,22 Q8.85,15.5 3,12 Q8.85,8.5 12,2 Z';

// Same waist treatment as the heart, mirrored above the stem.
const SPADE_PATH =
  'M12,2 C13.5,8 22,11 21,14.5 C21,17.5 18.5,20 15.5,20 C14.1,20 12.85,19.3 12,18.2 C12.4,19.6 13.3,20.8 14.5,21.5 C14.9,21.7 14.7,22 14.3,22 L9.7,22 C9.3,22 9.1,21.7 9.5,21.5 C10.7,20.8 11.6,19.6 12,18.2 C11.15,19.3 9.9,20 8.5,20 C5.5,20 3,17.5 3,14.5 C2,11 10.5,8 12,2 Z';

const CLUB_STEM_PATH =
  'M11,15 C11,17.2 10.2,19.8 8.6,21.2 C8.2,21.5 8.4,21.9 8.9,21.9 L15.1,21.9 C15.6,21.9 15.8,21.5 15.4,21.2 C13.8,19.8 13,17.2 13,15 Z';

// The three lobes sit at true equilateral spacing (each circle's center is the same distance from
// the shape's center, and none individually reaches it), so a real gap opens up on its own. The
// small white circle at the center punches that gap open further, guaranteeing it stays visible
// even at the corner index's smallest render size — this assumes a white/light card face behind
// the icon, true everywhere SuitIcon is used today.
const CLUB_CENTER_HOLE = { cx: 12, cy: 11, r: 1.4 };

function SuitIconComponent({ suit, size, color, opacity = 1, testID }: SuitIconProps) {
  return (
    <Svg testID={testID} width={size} height={size} viewBox="0 0 24 24" opacity={opacity}>
      {suit === 'hearts' && <Path d={HEART_PATH} fill={color} />}
      {suit === 'diamonds' && <Path d={DIAMOND_PATH} fill={color} />}
      {suit === 'spades' && <Path d={SPADE_PATH} fill={color} />}
      {suit === 'clubs' && (
        <G>
          <Circle cx={12} cy={6} r={4.6} fill={color} />
          <Circle cx={7.67} cy={13.5} r={4.6} fill={color} />
          <Circle cx={16.33} cy={13.5} r={4.6} fill={color} />
          <Path d={CLUB_STEM_PATH} fill={color} />
          <Circle cx={CLUB_CENTER_HOLE.cx} cy={CLUB_CENTER_HOLE.cy} r={CLUB_CENTER_HOLE.r} fill="#ffffff" />
        </G>
      )}
    </Svg>
  );
}

// Props (suit/size/color) rarely change once a card is dealt, and this renders many times per
// table — memoize so it only redraws when its own inputs actually change, not on every
// unrelated re-render of the PlayingCard/table it lives in.
export const SuitIcon = React.memo(SuitIconComponent);
