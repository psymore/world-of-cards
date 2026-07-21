// 3-player "gömmeli" is the only 3-player Batak variant that exists (no other 3-player ruleset
// is implemented), so this is a straight binary choice rather than a separate player-count
// control — picking 'gomeli' always means 3 total players (human + 2 AI).
export type BatakVariant = 'standard' | 'gomeli';
