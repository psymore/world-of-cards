import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PersistenceAdapter } from '@world-of-cards/engine';

export const asyncStorageAdapter: PersistenceAdapter = {
  async save(key, data) {
    await AsyncStorage.setItem(key, JSON.stringify(data));
  },
  async load(key) {
    const raw = await AsyncStorage.getItem(key);
    return raw === null ? null : JSON.parse(raw);
  },
  async remove(key) {
    await AsyncStorage.removeItem(key);
  },
};
