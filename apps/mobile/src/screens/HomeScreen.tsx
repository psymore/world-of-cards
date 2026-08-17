import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { getGames } from '@world-cards/engine';
import { BODY_REGULAR, TableFelt } from '@world-cards/ui';
import { HeroCard } from './home/HeroCard';
import { HomeWordmark } from './home/HomeWordmark';
import { GameMenuRow } from './home/GameMenuRow';

export interface HomeScreenProps {
  onSelectGame: (gameId: string) => void;
}

export function HomeScreen({ onSelectGame }: HomeScreenProps) {
  const games = getGames();
  return (
    <View style={styles.container}>
      <TableFelt />
      <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
        <HeroCard />
        <HomeWordmark />
        <View style={styles.menu}>
          {games.length === 0 ? (
            <Text style={styles.empty}>No games installed yet</Text>
          ) : (
            games.map((game, index) => (
              <GameMenuRow
                key={game.id}
                displayName={game.displayName}
                category={game.category}
                minPlayers={game.minPlayers}
                maxPlayers={game.maxPlayers}
                onPress={() => onSelectGame(game.id)}
                entranceDelayMs={index * 60}
                testID={`game-menu-row-${game.id}`}
              />
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a2e1f' },
  content: { flexGrow: 1, paddingTop: 48, paddingBottom: 40 },
  menu: { paddingHorizontal: 22, marginTop: 20, gap: 12 },
  // #f2e6ff88 (lavender) was a leftover from this screen's pre-gold-palette purple design phase —
  // same fix as GameMenuRow's identical leftover, see that file's own comment.
  empty: { fontFamily: BODY_REGULAR, fontSize: 14, color: '#f5f0e688', textAlign: 'center', marginTop: 20 },
});
