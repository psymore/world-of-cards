import type { CardFaceStyle } from '@world-cards/ui';

// Shared between PistiDevTuningModal and BatakDevTuningModal, same reasoning as
// TABLE_SURFACE_MATERIAL_OPTIONS — both games read/write the same cardFaceStyle store field (it
// lives in packages/ui itself; see cardFaceStyleStore.ts's own doc comment for why), so the option
// list driving it is identical for both. 'v1' (today's per-suit court art + code-drawn frame) is
// listed first since it's the shipped default; 'v2' (the 2026-08-18 baked K/Q/J art + new
// parchment background) is opt-in via each game's own dev-tuning panel.
export const CARD_FACE_STYLE_OPTIONS: { value: CardFaceStyle; label: string }[] = [
  { value: 'v1', label: 'Card Art v1 (current)' },
  { value: 'v2', label: 'Card Art v2 (new, full-bleed)' },
  { value: 'v3', label: 'Card Art v3 (new, small centered)' },
];
