import React from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { getGames } from '@world-cards/engine';

export function HomeScreen() {
  const games = getGames();
  return (
    <View style={styles.container}>
      <Text style={styles.title}>World Cards</Text>
      <FlatList
        data={games}
        keyExtractor={(game) => game.id}
        renderItem={({ item }) => <Text style={styles.gameItem}>{item.displayName}</Text>}
        ListEmptyComponent={<Text style={styles.empty}>No games installed yet</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 48, paddingHorizontal: 16 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 16 },
  gameItem: { fontSize: 18, paddingVertical: 8 },
  empty: { fontSize: 16, color: '#888' },
});
