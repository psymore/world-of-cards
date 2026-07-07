import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HomeScreen } from '../screens/HomeScreen';
import { gameScreens } from '../games/registry';

export type RootStackParamList = {
  Home: undefined;
  Game: { gameId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="Home" options={{ title: 'World Cards' }}>
          {({ navigation }) => (
            <HomeScreen onSelectGame={(gameId) => navigation.navigate('Game', { gameId })} />
          )}
        </Stack.Screen>
        <Stack.Screen name="Game" options={{ headerShown: false }}>
          {({ navigation, route }) => {
            const ScreenComponent = gameScreens[route.params.gameId];
            if (!ScreenComponent) {
              return null;
            }
            return <ScreenComponent onExitToHome={() => navigation.navigate('Home')} />;
          }}
        </Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
  );
}
