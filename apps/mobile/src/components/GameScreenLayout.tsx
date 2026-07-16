import React from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

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

  return (
    <View style={[styles.container, backgroundColor ? { backgroundColor } : null]}>
      <View style={styles.header}>
        <Text style={[styles.title, titleColor ? { color: titleColor } : null]}>{title}</Text>
        <View style={styles.headerActions}>
          {onSettingsPress && (
            <Pressable onPress={onSettingsPress} accessibilityRole="button" testID="game-settings-button">
              <Text style={styles.settingsIcon}>⚙</Text>
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

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 48 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  title: { fontSize: 20, fontWeight: 'bold' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  settingsIcon: { fontSize: 20 },
  exit: { fontSize: 16, color: '#c0392b' },
  content: { flex: 1 },
});
