import React from 'react';
import Svg, { Circle, G, Path } from 'react-native-svg';
import type { Suit } from '@world-cards/engine';

export interface SuitGlyphProps {
  suit: Suit;
  size: number;
  color: string;
  opacity?: number;
  testID?: string;
}

const HEART_PATH =
  'M12,21 C12,21 3,14.5 3,8.5 C3,5.5 5.5,3 8.5,3 C10.36,3 12,4.5 12,6.5 C12,4.5 13.64,3 15.5,3 C18.5,3 21,5.5 21,8.5 C21,14.5 12,21 12,21 Z';

const DIAMOND_PATH = 'M12,2 L21,12 L12,22 L3,12 Z';

const SPADE_PATH =
  'M12,2 C12,2 21,9.5 21,14.5 C21,17.5 18.5,20 15.5,20 C14.1,20 12.85,19.3 12,18.2 C12.4,19.6 13.3,20.8 14.5,21.5 C14.9,21.7 14.7,22 14.3,22 L9.7,22 C9.3,22 9.1,21.7 9.5,21.5 C10.7,20.8 11.6,19.6 12,18.2 C11.15,19.3 9.9,20 8.5,20 C5.5,20 3,17.5 3,14.5 C3,9.5 12,2 12,2 Z';

const CLUB_STEM_PATH =
  'M11,15 C11,17 10.3,19.5 8.7,20.8 C8.3,21.1 8.5,21.5 9,21.5 L15,21.5 C15.5,21.5 15.7,21.1 15.3,20.8 C13.7,19.5 13,17 13,15 Z';

function SuitGlyphComponent({ suit, size, color, opacity = 1, testID }: SuitGlyphProps) {
  return (
    <Svg testID={testID} width={size} height={size} viewBox="0 0 24 24" opacity={opacity}>
      {suit === 'hearts' && <Path d={HEART_PATH} fill={color} />}
      {suit === 'diamonds' && <Path d={DIAMOND_PATH} fill={color} />}
      {suit === 'spades' && <Path d={SPADE_PATH} fill={color} />}
      {suit === 'clubs' && (
        <G>
          <Circle cx={12} cy={8} r={4.2} fill={color} />
          <Circle cx={7.3} cy={14} r={4.2} fill={color} />
          <Circle cx={16.7} cy={14} r={4.2} fill={color} />
          <Path d={CLUB_STEM_PATH} fill={color} />
        </G>
      )}
    </Svg>
  );
}

export const SuitGlyph = React.memo(SuitGlyphComponent);
