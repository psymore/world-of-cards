import { GameDescriptor } from './types';

const registry = new Map<string, GameDescriptor<any, any>>();

export function registerGame(descriptor: GameDescriptor<any, any>): void {
  if (registry.has(descriptor.id)) {
    throw new Error(`registerGame: a game with id "${descriptor.id}" is already registered`);
  }
  registry.set(descriptor.id, descriptor);
}

export function getGames(): GameDescriptor<any, any>[] {
  return Array.from(registry.values());
}

export function getGame(id: string): GameDescriptor<any, any> | undefined {
  return registry.get(id);
}

export function clearRegistry(): void {
  registry.clear();
}
