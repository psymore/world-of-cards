import React from 'react';
import Svg, { Circle, G, Path } from 'react-native-svg';
import type { Suit } from '@world-of-cards/engine';

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

// Classic convex pip (no concave waist) matching the user-supplied reference photo at
// docs/references/card-art/SPADE.jpeg — see the 2026-07-18 design spec for the brainstorming
// history (this was the first candidate shown, confirmed after later "wider base" and "traced
// from a hand sketch" alternatives were both tried and rejected in its favor). Leaf and stem
// are two separate paths so the stem's flare can be tuned independently of the leaf curve.
const SPADE_PATH =
  'M12,1.5 C7.5,7 2,10.8 2,15 C2,18.6 4.9,21.2 8.2,21.2 C10,21.2 11.4,20.3 12,18.8 C12.6,20.3 14,21.2 15.8,21.2 C19.1,21.2 22,18.6 22,15 C22,10.8 16.5,7 12,1.5 Z';
const SPADE_STEM_PATH =
  'M9.3,22.7 C10.7,21.5 11.6,20 12,18.3 C12.4,20 13.3,21.5 14.7,22.7 C15,23 14.8,23.4 14.3,23.4 L9.7,23.4 C9.2,23.4 9,23 9.3,22.7 Z';

const CLUB_STEM_PATH =
  'M11,15 C11,17.2 10.2,19.8 8.6,21.2 C8.2,21.5 8.4,21.9 8.9,21.9 L15.1,21.9 C15.6,21.9 15.8,21.5 15.4,21.2 C13.8,19.8 13,17.2 13,15 Z';

function SuitIconComponent({ suit, size, color, opacity = 1, testID }: SuitIconProps) {
  return (
    <Svg testID={testID} width={size} height={size} viewBox="0 0 24 24" opacity={opacity}>
      {suit === 'hearts' && <Path d={HEART_PATH} fill={color} />}
      {suit === 'diamonds' && <Path d={DIAMOND_PATH} fill={color} />}
      {suit === 'spades' && (
        <>
          <Path d={SPADE_PATH} fill={color} />
          <Path d={SPADE_STEM_PATH} fill={color} />
        </>
      )}
      {suit === 'clubs' && (
        <G>
          <Circle cx={12} cy={6.3} r={5.3} fill={color} />
          <Circle cx={7.4} cy={14} r={5.3} fill={color} />
          <Circle cx={16.6} cy={14} r={5.3} fill={color} />
          <Path d={CLUB_STEM_PATH} fill={color} />
        </G>
      )}
    </Svg>
  );
}

// Props (suit/size/color) rarely change once a card is dealt, and this renders many times per
// table — memoize so it only redraws when its own inputs actually change, not on every
// unrelated re-render of the PlayingCard/table it lives in.
export const SuitIcon = React.memo(SuitIconComponent);
