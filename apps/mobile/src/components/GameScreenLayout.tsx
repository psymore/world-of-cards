import React, { useState } from 'react';
import { Alert, LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import { HeaderWoodFrame, SettingsIcon } from '@world-cards/ui';

export interface GameScreenLayoutProps {
  title: string;
  onExit: () => void;
  children: React.ReactNode;
  backgroundColor?: string;
  titleColor?: string;
  // When provided, renders a small gear button in the header. Omitted by call sites that don't
  // have a settings surface yet (e.g. Pişti today) — the header is visually unchanged for them.
  onSettingsPress?: () => void;
}

export function GameScreenLayout({
  title,
  onExit,
  children,
  backgroundColor,
  titleColor,
  onSettingsPress,
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

  return (
    <View style={[styles.container, backgroundColor ? { backgroundColor } : null]}>
      {/* Rendered at the container level (not inside header) so it also covers the container's
          own paddingTop gap above the header row — an absolutely positioned child ignores its
          parent's padding and anchors to the container's true top edge, same trick HandFrame
          already relies on for its own bottom-edge coverage. */}
      {headerHeight > 0 && <HeaderWoodFrame height={CONTAINER_PADDING_TOP + headerHeight} />}
      <View style={styles.header} onLayout={handleHeaderLayout}>
        <Text style={[styles.title, titleColor ? { color: titleColor } : null]}>{title}</Text>
        <View style={styles.headerActions}>
          {onSettingsPress && (
            <Pressable onPress={onSettingsPress} accessibilityRole="button" testID="game-settings-button">
              <SettingsIcon />
            </Pressable>
          )}
          <Pressable onPress={handleExitPress} accessibilityRole="button">
            <Text style={styles.exit}>Exit</Text>
          </Pressable>
        </View>
      </View>
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
  exit: { fontSize: 14, color: '#c0392b' },
  content: { flex: 1 },
});
