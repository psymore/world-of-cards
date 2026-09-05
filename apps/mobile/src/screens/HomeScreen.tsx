import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { getGames } from '@world-of-cards/engine';
import { BODY_REGULAR, TableFelt } from '@world-of-cards/ui';
import { HeroCard } from './home/HeroCard';
import { HomeWordmark } from './home/HomeWordmark';
import { GameMenuRow } from './home/GameMenuRow';
import { RulesSummaryModal } from '../components/RulesSummaryModal';
import { gameRules } from '../games/rulesRegistry';

export interface HomeScreenProps {
  onSelectGame: (gameId: string) => void;
}

export function HomeScreen({ onSelectGame }: HomeScreenProps) {
  const games = getGames();
  const [rulesModalGameId, setRulesModalGameId] = useState<string | null>(null);
  const activeRules = rulesModalGameId ? gameRules[rulesModalGameId] : null;

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
                onInfoPress={gameRules[game.id] ? () => setRulesModalGameId(game.id) : undefined}
                entranceDelayMs={index * 60}
                testID={`game-menu-row-${game.id}`}
              />
            ))
          )}
        </View>
      </ScrollView>
      {activeRules && (
        <RulesSummaryModal rules={activeRules} visible={!!rulesModalGameId} onClose={() => setRulesModalGameId(null)} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a2e1f' },
  content: { flexGrow: 1, paddingTop: 48, paddingBottom: 40 },
  menu: { paddingHorizontal: 22, marginTop: 20, gap: 12 },
  empty: { fontFamily: BODY_REGULAR, fontSize: 14, color: '#f5f0e688', textAlign: 'center', marginTop: 20 },
});
