import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import type { TableTemplate } from '../types';

const WEDGE_SIZE = 56;
const TRIM_COLOR = '#ffd966';

type Corner = 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';

interface WedgeGeometry {
  fillPath: string;
  trimPath: string;
  positionStyle: { top?: number; bottom?: number; left?: number; right?: number };
}

const S = WEDGE_SIZE;

const WEDGE_GEOMETRY: Record<Corner, WedgeGeometry> = {
  topLeft: {
    fillPath: `M0,0 L${S},0 A${S},${S} 0 0 1 0,${S} Z`,
    trimPath: `M${S},0 A${S},${S} 0 0 1 0,${S}`,
    positionStyle: { top: 0, left: 0 },
  },
  topRight: {
    fillPath: `M${S},0 L0,0 A${S},${S} 0 0 0 ${S},${S} Z`,
    trimPath: `M0,0 A${S},${S} 0 0 0 ${S},${S}`,
    positionStyle: { top: 0, right: 0 },
  },
  bottomLeft: {
    fillPath: `M0,${S} L${S},${S} A${S},${S} 0 0 0 0,0 Z`,
    trimPath: `M${S},${S} A${S},${S} 0 0 0 0,0`,
    positionStyle: { bottom: 0, left: 0 },
  },
  bottomRight: {
    fillPath: `M${S},${S} L0,${S} A${S},${S} 0 0 1 ${S},0 Z`,
    trimPath: `M0,${S} A${S},${S} 0 0 1 ${S},0`,
    positionStyle: { bottom: 0, right: 0 },
  },
};

const CORNERS: Corner[] = ['topLeft', 'topRight', 'bottomLeft', 'bottomRight'];

function Wedge({ corner, color }: { corner: Corner; color: string }) {
  const { fillPath, trimPath, positionStyle } = WEDGE_GEOMETRY[corner];
  return (
    <View style={[styles.wedgeWrap, positionStyle]} testID={`table-backdrop-wood-${corner}`}>
      <Svg width={S} height={S} viewBox={`0 0 ${S} ${S}`}>
        <Path d={fillPath} fill={color} />
        <Path d={trimPath} fill="none" stroke={TRIM_COLOR} strokeOpacity={0.85} strokeWidth={2} />
      </Svg>
    </View>
  );
}

export interface TableBackdropProps {
  table: TableTemplate;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

function TableBackdropComponent({ table, style, children }: TableBackdropProps) {
  return (
    <View testID="table-backdrop" style={[styles.container, { backgroundColor: table.feltColor }, style]}>
      {CORNERS.map((corner) => (
        <Wedge key={corner} corner={corner} color={table.woodColor} />
      ))}
      {children}
    </View>
  );
}

export const TableBackdrop = React.memo(TableBackdropComponent);

const styles = StyleSheet.create({
  container: { position: 'relative', overflow: 'hidden' },
  wedgeWrap: { position: 'absolute', width: S, height: S },
});
