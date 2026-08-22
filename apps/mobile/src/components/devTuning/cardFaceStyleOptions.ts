import type { CardFaceStyle } from '@world-of-cards/ui';

// Shared between PistiDevTuningModal and BatakDevTuningModal, same reasoning as
// TABLE_SURFACE_MATERIAL_OPTIONS — both games read/write the same cardFaceStyle store field (it
// lives in packages/ui itself; see cardFaceStyleStore.ts's own doc comment for why), so the option
// list driving it is identical for both. 'v3' (small centered court art) is the shipped default
// as of 2026-08-22; 'v1'/'v2' remain selectable via each game's own dev-tuning panel.
export const CARD_FACE_STYLE_OPTIONS: { value: CardFaceStyle; label: string }[] = [
  { value: 'v1', label: 'Card Art v1 (legacy)' },
  { value: 'v2', label: 'Card Art v2 (full-bleed)' },
  { value: 'v3', label: 'Card Art v3 (small centered, current)' },
];
