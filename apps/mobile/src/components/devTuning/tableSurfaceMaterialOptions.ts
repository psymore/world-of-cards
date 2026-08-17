import type { TableSurfaceMaterial } from '@world-cards/ui';

// Shared between PistiDevTuningModal and BatakDevTuningModal — both games read/write the same
// tableSurfaceMaterial store field (see its own doc comment in devTuningStore.ts), so the option
// list driving it is identical for both rather than duplicated per-game. Only visible/relevant
// when a game's own Table Background selection actually renders MahoganyTableSurface ('frameOnly'
// for Pişti, 'frame' for Batak). Listed greenFelt-first (2026-08-15) since it's now the actual
// shipped default; classicFelt is the pre-2026-08-15 look, kept as a comparison.
export const TABLE_SURFACE_MATERIAL_OPTIONS: { value: TableSurfaceMaterial; label: string }[] = [
  { value: 'greenFelt', label: 'New Green Felt (current default)' },
  { value: 'classicFelt', label: 'Classic Felt (legacy default)' },
  { value: 'nightBlueFelt', label: 'Night Blue Felt' },
  { value: 'wood', label: 'Wood' },
];
