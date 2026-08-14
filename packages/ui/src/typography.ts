import type { TextStyle } from "react-native";

export const PRIMARY_SERIF_REGULAR = "Cinzel-Regular" as const;
export const PRIMARY_SERIF_BOLD = "Cinzel-Bold" as const;
export const SECONDARY_SANS_REGULAR = "Inter-Regular" as const;
export const SECONDARY_SANS_BOLD = "Inter-Bold" as const;

export type TypeScaleLevel = "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "h7";

export interface TypeScaleEntry {
  fontFamily:
    | typeof PRIMARY_SERIF_REGULAR
    | typeof PRIMARY_SERIF_BOLD
    | typeof SECONDARY_SANS_REGULAR
    | typeof SECONDARY_SANS_BOLD;
  fontSize: number;
  lineHeight: number;
}

// Sizes derived from TABLE-029's own annotated anchors (Player Name 32px/H4, Score 28px/H5 —
// an exact 8:7 step), extended in clean px with ~1.2x line-heights. H1-H4 (titles/numbers/
// premium UI) use the primary serif; H5-H7 (labels/body/system UI) use the secondary sans —
// see docs/superpowers/specs/2026-08-14-typography-foundation-design.md.
export const TYPE_SCALE: Record<TypeScaleLevel, TypeScaleEntry> = {
  h1: { fontFamily: PRIMARY_SERIF_BOLD, fontSize: 48, lineHeight: 58 },
  h2: { fontFamily: PRIMARY_SERIF_BOLD, fontSize: 40, lineHeight: 48 },
  h3: { fontFamily: PRIMARY_SERIF_REGULAR, fontSize: 36, lineHeight: 44 },
  h4: { fontFamily: PRIMARY_SERIF_BOLD, fontSize: 32, lineHeight: 40 },
  h5: { fontFamily: SECONDARY_SANS_REGULAR, fontSize: 28, lineHeight: 34 },
  h6: { fontFamily: SECONDARY_SANS_REGULAR, fontSize: 24, lineHeight: 30 },
  h7: { fontFamily: SECONDARY_SANS_REGULAR, fontSize: 20, lineHeight: 26 },
} satisfies Record<TypeScaleLevel, TextStyle>;
