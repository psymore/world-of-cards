import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';
import type { BatakMove } from '@world-of-cards/engine/games/batak';
import { glowShadow, PressableFeedback } from '@world-of-cards/ui';
import { DecisionPanel } from './DecisionPanel';

// Baldur's Gate 3-inspired bid button palette
// (docs/superpowers/specs/2026-07-19-batak-bid-button-redesign-design.md) — idle vs. "hover"
// colors, where RN's touch-only Pressable has no real hover, so the reference's :hover state maps
// onto Pressable's pressed state instead.
interface BidButtonPalette {
  fillTop: string;
  fillBottom: string;
  fillTopPressed: string;
  fillBottomPressed: string;
  borderIdle: string;
  borderPressed: string;
  textIdle: string;
  textPressed: string;
}

const BID_NUMBER_PALETTE: BidButtonPalette = {
  fillTop: '#31221B',
  fillBottom: '#341307',
  fillTopPressed: '#40291d',
  fillBottomPressed: '#4a2a10',
  borderIdle: '#B19B7E',
  borderPressed: '#CEB390',
  textIdle: '#cdaf87',
  textPressed: '#ffe5c2',
};

const BID_PASS_PALETTE: BidButtonPalette = {
  fillTop: '#31221B',
  fillBottom: '#341307',
  fillTopPressed: '#40291d',
  fillBottomPressed: '#4a2a10',
  borderIdle: '#8a5a4a',
  borderPressed: '#c98a6f',
  textIdle: '#d9a98f',
  textPressed: '#f0c9b8',
};

const BID_BUTTON_SIZE = 56;
const BID_BUTTON_RADIUS = 10;
const PASS_BUTTON_HEIGHT = 44;
const BID_GRID_COLUMNS = 3;
const BID_GRID_GAP = 10;
const BID_GRID_WIDTH = BID_BUTTON_SIZE * BID_GRID_COLUMNS + BID_GRID_GAP * (BID_GRID_COLUMNS - 1);

// The gradient fill/bevel/shine layers are drawn in react-native-svg (already a dependency, used
// the same way by TableWoodCorners/HeaderWoodFrame) rather than a gradient-clipped text label —
// this app has no masked-view dependency, so the label uses a solid idle/pressed color swap
// instead of the reference's literal text gradient.
function BidButton({
  label,
  onPress,
  palette,
  width,
  height,
  fontSize,
}: {
  label: string;
  onPress: () => void;
  palette: BidButtonPalette;
  width: number;
  height: number;
  fontSize: number;
}) {
  return (
    <PressableFeedback
      onPress={onPress}
      accessibilityRole="button"
      style={{ width, height }}
      overlayBorderRadius={BID_BUTTON_RADIUS}>
      {({ pressed }) => {
        const fillTop = pressed ? palette.fillTopPressed : palette.fillTop;
        const fillBottom = pressed ? palette.fillBottomPressed : palette.fillBottom;
        const borderColor = pressed ? palette.borderPressed : palette.borderIdle;
        const textColor = pressed ? palette.textPressed : palette.textIdle;
        return (
          <View style={[styles.bidButtonShadow, { width, height }]}>
            <View
              style={[
                styles.bidButtonClip,
                pressed && glowShadow(borderColor, 8),
                { width, height, borderColor, borderWidth: pressed ? 1.6 : 1.4 },
              ]}>
              <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
                <Defs>
                  <LinearGradient id="bidFill" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset={0} stopColor={fillTop} />
                    <Stop offset={1} stopColor={fillBottom} />
                  </LinearGradient>
                  <LinearGradient id="bidBevel" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset={0} stopColor="#ffffff" stopOpacity={0} />
                    <Stop offset={0.5} stopColor="#ffffff" stopOpacity={0.4} />
                    <Stop offset={0.5} stopColor="#000000" stopOpacity={0.3} />
                    <Stop offset={1} stopColor="#000000" stopOpacity={0} />
                  </LinearGradient>
                  <RadialGradient id="bidShine" cx="50%" cy="0%" rx="70%" ry="60%">
                    <Stop offset={0} stopColor="#ffffff" stopOpacity={0.35} />
                    <Stop offset={1} stopColor="#ffffff" stopOpacity={0} />
                  </RadialGradient>
                </Defs>
                <Rect width={width} height={height} fill="url(#bidFill)" />
                <Rect width={width} height={height} fill="url(#bidBevel)" />
                <Rect width={width} height={height} fill="url(#bidShine)" opacity={pressed ? 1 : 0.6} />
              </Svg>
              <Text style={[styles.bidButtonText, { fontSize, color: textColor }]}>{label}</Text>
            </View>
          </View>
        );
      }}
    </PressableFeedback>
  );
}

export function BidControls({
  legalMoves,
  onMove,
}: {
  legalMoves: BatakMove[];
  onMove: (move: BatakMove) => void;
}) {
  const bidMoves = legalMoves.filter((m): m is Extract<BatakMove, { type: 'bid' }> => m.type === 'bid');
  const hasPass = legalMoves.some((m) => m.type === 'pass');
  return (
    <DecisionPanel testID="bid-controls">
      <View style={styles.bidGrid}>
        {bidMoves.map((move) => (
          <BidButton
            key={move.amount}
            label={`${move.amount}`}
            onPress={() => onMove(move)}
            palette={BID_NUMBER_PALETTE}
            width={BID_BUTTON_SIZE}
            height={BID_BUTTON_SIZE}
            fontSize={20}
          />
        ))}
      </View>
      {hasPass && (
        <View style={styles.passRow}>
          <BidButton
            label="Pass"
            onPress={() => onMove({ type: 'pass' })}
            palette={BID_PASS_PALETTE}
            width={BID_GRID_WIDTH}
            height={PASS_BUTTON_HEIGHT}
            fontSize={14}
          />
        </View>
      )}
    </DecisionPanel>
  );
}

const styles = StyleSheet.create({
  // Fixed 3-column grid (5/6/7, 8/9/10, 11/12/13 — Batak's real bid range) rather than a
  // flex-wrap row, so the layout stays a clean 3-wide rectangle regardless of how many bid
  // amounts are currently legal, per the bid-button redesign spec.
  bidGrid: {
    width: BID_GRID_WIDTH,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: BID_GRID_GAP,
  },
  passRow: { width: BID_GRID_WIDTH, marginTop: BID_GRID_GAP },
  // Outer wrapper carries the drop shadow only (no overflow/borderRadius) — combining overflow:
  // 'hidden' with an elevation-based Android shadow on the same View clips the shadow itself.
  bidButtonShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.45,
    shadowRadius: 3,
    elevation: 3,
  },
  // Inner wrapper clips the SVG fill/bevel/shine layers to the rounded border.
  bidButtonClip: {
    borderRadius: BID_BUTTON_RADIUS,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bidButtonText: {
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    fontWeight: '700',
    textAlign: 'center',
  },
});
