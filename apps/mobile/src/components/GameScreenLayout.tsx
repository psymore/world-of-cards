import React from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

export interface GameScreenLayoutProps {
  title: string;
  onExit: () => void;
  children: React.ReactNode;
}

export function GameScreenLayout({ title, onExit, children }: GameScreenLayoutProps) {
  function handleExitPress() {
    Alert.alert('Discard this game?', 'Your progress in this hand will be lost.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: onExit },
    ]);
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <Pressable onPress={handleExitPress} accessibilityRole="button">
          <Text style={styles.exit}>Exit</Text>
        </Pressable>
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
  exit: { fontSize: 16, color: '#c0392b' },
  content: { flex: 1 },
});
