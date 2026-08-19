import React, { useState } from 'react';
import { Alert, LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { DISPLAY_BOLD, HeaderWoodFrame, IconButton, ICON_HOME_IMAGE, ICON_SETTINGS_IMAGE } from '@world-of-cards/ui';

const HOME_ICON_SIZE = 30;
const SETTINGS_ICON_SIZE = 30;

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
  // a green glow — originally chosen to match HomeScreen's old HeroCard glow (#1f5c3a) over its
  // dark purple background (#180a26); HomeScreen moved to a shared TableFelt background on
  // 2026-08-07 (HomeBackground.tsx no longer exists), and Batak itself has since moved off the
  // #180a26 fill too (now overrides it black via darkGlowHeaderColor, matching its root
  // backgroundColor) — only the green glow itself remains Batak's own deliberate leftover choice.
  // Edge-to-edge, same footprint HeaderWoodFrame used (full width, from the very top, covering
  // CONTAINER_PADDING_TOP too) — an inset/rounded version left slivers of the screen's own
  // `backgroundColor` showing at the edges. Opt-in and defaults to false so every existing caller
  // (Pişti, and Batak unless it passes this) is visually unchanged.
  darkGlowHeader?: boolean;
  // Overrides headerGlowBackdrop's default #180a26 fill. Both Pişti and Batak now pass '#000000'
  // here for a pitch-black bar, matching their root backgroundColor — Batak keeps its own green
  // shadowColor glow on top of it (see darkGlowHeader's own doc above).
  darkGlowHeaderColor?: string;
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
  darkGlowHeaderColor,
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
          <IconButton
            source={ICON_SETTINGS_IMAGE}
            size={SETTINGS_ICON_SIZE}
            onPress={onSettingsPress}
            accessibilityLabel="Settings"
            testID="game-settings-button"
          />
        )}
        <IconButton
          source={ICON_HOME_IMAGE}
          size={HOME_ICON_SIZE}
          onPress={handleExitPress}
          accessibilityLabel="Exit to home"
          testID="game-exit-button"
        />
      </View>
    </View>
  );

  return (
    <View style={[styles.container, backgroundColor ? { backgroundColor } : null]}>
      {/* Hides the system status bar (wifi/battery/time) only while a game screen is mounted —
          expo-status-bar merges multiple mounted <StatusBar> instances, most-recently-mounted
          taking priority for props it specifies, so this reverts to App.tsx's `style="light"`
          (not hidden) the instant this screen unmounts on Exit, with no manual toggle needed. */}
      <StatusBar hidden />
      {/* Rendered at the container level (not inside header) so it also covers the container's
          own paddingTop gap above the header row — an absolutely positioned child ignores its
          parent's padding and anchors to the container's true top edge, same trick HandFrame
          already relies on for its own bottom-edge coverage. Full width, no margin/borderRadius —
          anything less than edge-to-edge left the screen's own `backgroundColor` visible in
          slivers around it. */}
      {headerHeight > 0 &&
        (darkGlowHeader ? (
          <View
            style={[
              styles.headerGlowBackdrop,
              { height: CONTAINER_PADDING_TOP + headerHeight },
              darkGlowHeaderColor ? { backgroundColor: darkGlowHeaderColor } : null,
            ]}
            pointerEvents="none"
          />
        ) : (
          <HeaderWoodFrame height={CONTAINER_PADDING_TOP + headerHeight} />
        ))}
      {headerRow}
      <View style={styles.content}>{children}</View>
    </View>
  );
}

// Matches styles.container's own paddingTop below — extracted so HeaderWoodFrame's height
// calculation stays in sync with it instead of duplicating the literal. Bumped from the original
// 28 now that the status bar is hidden in-game (see the <StatusBar hidden /> above) — this is
// pure breathing room from the screen's top edge now, not a safe-area correctness fix.
const CONTAINER_PADDING_TOP = 44;

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: CONTAINER_PADDING_TOP },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 6,
  },
  title: { fontFamily: DISPLAY_BOLD, fontSize: 18 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  // paddingTop gives the table a little breathing room below the header bar, separate from the
  // header row's own paddingBottom above (which is internal to the header row's own content).
  content: { flex: 1, paddingTop: 12 },
  // Solid, edge-to-edge near-black backdrop for darkGlowHeader (same footprint HeaderWoodFrame
  // used — full width, top:0, height covers the paddingTop gap too) with a green glow on its
  // bottom edge, matching HeroCard.tsx's glowShadow('#1f5c3a', 20) over the same dark tone
  // (#180a26) HomeScreen's old purple background used to bottom out at (that background was
  // replaced by a shared TableFelt on 2026-08-07; this bar's own color choice is unchanged and
  // stands on its own now). No borderRadius/margin — the header row itself renders on
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
