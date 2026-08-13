import type { TableSurfaceMaterial } from '@world-cards/ui';

// Shared between PistiDevTuningModal and BatakDevTuningModal — both games read/write the same
// tableSurfaceMaterial store field (see its own doc comment in devTuningStore.ts), so the option
// list driving it is identical for both rather than duplicated per-game. Only visible/relevant
// when a game's own Table Background selection actually renders MahoganyTableSurface ('frameOnly'
// for Pişti, 'frame' for Batak). Listed classicFelt-first since it's the default and matches the
// table's look before this selector existed.
export const TABLE_SURFACE_MATERIAL_OPTIONS: { value: TableSurfaceMaterial; label: string }[] = [
  { value: 'classicFelt', label: 'Classic Felt (current default)' },
  { value: 'greenFelt', label: 'New Green Felt' },
  { value: 'nightBlueFelt', label: 'Night Blue Felt' },
  { value: 'wood', label: 'Wood' },
];
