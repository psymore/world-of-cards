import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { getGames } from '@world-cards/engine';

export interface HomeScreenProps {
  onSelectGame: (gameId: string) => void;
}

export function HomeScreen({ onSelectGame }: HomeScreenProps) {
  const games = getGames();
  return (
    <View style={styles.container}>
      <Text style={styles.title}>World Cards</Text>
      <FlatList
        data={games}
        keyExtractor={(game) => game.id}
        renderItem={({ item }) => (
          <Pressable style={styles.gameCard} onPress={() => onSelectGame(item.id)}>
            <Text style={styles.gameItem}>{item.displayName}</Text>
          </Pressable>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No games installed yet</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 48, paddingHorizontal: 16, backgroundColor: '#12121f' },
  title: {
    fontSize: 30,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#f4c542',
    letterSpacing: 1,
    textShadowColor: '#7a5c00',
    textShadowRadius: 6,
  },
  gameCard: {
    backgroundColor: '#1e1e33',
    borderWidth: 1,
    borderColor: '#f4c542',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  gameItem: { fontSize: 18, fontWeight: '600', color: '#eee' },
  empty: { fontSize: 16, color: '#888' },
});
