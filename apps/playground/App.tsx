import { StatusBar } from 'expo-status-bar';
import { PlaygroundScreen } from './src/PlaygroundScreen';

export default function App() {
  return (
    <>
      <PlaygroundScreen />
      <StatusBar style="light" />
    </>
  );
}
