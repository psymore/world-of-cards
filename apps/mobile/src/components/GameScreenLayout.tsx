import React, { useState } from 'react';
import { Alert, LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import { HeaderWoodFrame, PressableFeedback, SettingsIcon } from '@world-cards/ui';

export interface GameScreenLayoutProps {
  title: string;
  onExit: () => void;
  children: React.ReactNode;
  backgroundColor?: string;
  titleColor?: string;
  // When provided, renders a small gear button in the header. Omitted by call sites that don't
  // have a settings surface yet (e.g. Pişti today) — the header is visually unchanged for them.
  onSettingsPress?: () => void;
  // Extra header buttons rendered just before the settings button (e.g. Batak's __DEV__-only
  // tuning-panel icon). Generic React content so this layout stays game-agnostic — a caller with
  // nothing to add simply omits it, unchanged from today.
  extraHeaderActions?: React.ReactNode;
  // Swaps the header row's default HeaderWoodFrame photo backing for a solid near-black bar with
  // a green glow, matching the homescreen's HeroCard glow (#1f5c3a) over its dark background
  // (#180a26) — see HeroCard.tsx/HomeBackground.tsx. Edge-to-edge, same footprint HeaderWoodFrame
  // used (full width, from the very top, covering CONTAINER_PADDING_TOP too) — an inset/rounded
  // version left slivers of the screen's own `backgroundColor` showing at the edges. Opt-in and
  // defaults to false so every existing caller (Pişti, and Batak unless it passes this) is
  // visually unchanged.
  darkGlowHeader?: boolean;
}

export function GameScreenLayout({
  title,
  onExit,
  children,
  backgroundColor,
  titleColor,
  onSettingsPress,
  extraHeaderActions,
  darkGlowHeader = false,
}: GameScreenLayoutProps) {
  function handleExitPress() {
    Alert.alert('Discard this game?', 'Your progress in this hand will be lost.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: onExit },
    ]);
  }

  // Sizes HeaderWoodFrame to the header row's own real rendered height (padding + title/icon
  // row) rather than a hardcoded guess, so it stays correct if font scaling/accessibility
  // settings change the title's rendered height — same pattern as BatakTable's handAreaWidth.
  const [headerHeight, setHeaderHeight] = useState(0);
  function handleHeaderLayout(event: LayoutChangeEvent) {
    setHeaderHeight(event.nativeEvent.layout.height);
  }

  const headerRow = (
    <View style={styles.header} onLayout={handleHeaderLayout}>
      <Text style={[styles.title, titleColor ? { color: titleColor } : null]}>{title}</Text>
      <View style={styles.headerActions}>
        {extraHeaderActions}
        {onSettingsPress && (
          <PressableFeedback onPress={onSettingsPress} accessibilityRole="button" testID="game-settings-button">
            <SettingsIcon />
          </PressableFeedback>
        )}
        <PressableFeedback onPress={handleExitPress} accessibilityRole="button">
          <Text style={styles.exit}>Exit</Text>
        </PressableFeedback>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, backgroundColor ? { backgroundColor } : null]}>
      {/* Rendered at the container level (not inside header) so it also covers the container's
          own paddingTop gap above the header row — an absolutely positioned child ignores its
          parent's padding and anchors to the container's true top edge, same trick HandFrame
          already relies on for its own bottom-edge coverage. Full width, no margin/borderRadius —
          anything less than edge-to-edge left the screen's own `backgroundColor` (e.g. Batak's
          green) visible in slivers around it. */}
      {headerHeight > 0 &&
        (darkGlowHeader ? (
          <View style={[styles.headerGlowBackdrop, { height: CONTAINER_PADDING_TOP + headerHeight }]} pointerEvents="none" />
        ) : (
          <HeaderWoodFrame height={CONTAINER_PADDING_TOP + headerHeight} />
        ))}
      {headerRow}
      <View style={styles.content}>{children}</View>
    </View>
  );
}

// Matches styles.container's own paddingTop below — extracted so HeaderWoodFrame's height
// calculation stays in sync with it instead of duplicating the literal.
const CONTAINER_PADDING_TOP = 28;

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: CONTAINER_PADDING_TOP },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 6,
  },
  title: { fontSize: 16, fontWeight: 'bold' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  exit: { fontSize: 21, color: '#c0392b' },
  content: { flex: 1 },
  // Solid, edge-to-edge near-black backdrop for darkGlowHeader (same footprint HeaderWoodFrame
  // used — full width, top:0, height covers the paddingTop gap too) with a green glow on its
  // bottom edge, matching HeroCard.tsx's glowShadow('#1f5c3a', 20) over HomeBackground.tsx's
  // darkest gradient stop (#180a26). No borderRadius/margin — the header row itself renders on
  // top of this with its own transparent background, so title/icons/Exit sit directly on solid
  // black with nothing showing through around it.
  headerGlowBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#180a26',
    shadowColor: '#1f5c3a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.9,
    shadowRadius: 10,
    elevation: 10,
  },
});
