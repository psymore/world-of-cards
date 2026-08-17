import type { TextStyle } from "react-native";

export const DISPLAY_REGULAR = "Cinzel-Regular" as const;
export const DISPLAY_BOLD = "Cinzel-Bold" as const;
export const BODY_REGULAR = "Montserrat-Regular" as const;
export const BODY_MEDIUM = "Montserrat-Medium" as const;
export const BODY_SEMIBOLD = "Montserrat-SemiBold" as const;
export const BODY_BOLD = "Montserrat-Bold" as const;

// The two text colors packages/ui/assets/reference-sheets/typography.png ("TABLE-013") calls for
// on modals and in-game UI — gold for headings/emphasis, cream/white for body. Reuses the exact
// shades already established elsewhere in the app (SeatIdentity, BatakSetupView, etc.) rather
// than introducing new near-duplicate hex values from eyeballing the reference sheet.
export const TEXT_GOLD = "#f4c542";
export const TEXT_CREAM = "#f5f0e6";

export type TypeScaleLevel = "h1" | "h2" | "h3" | "h4" | "h5" | "bodyLarge" | "bodyRegular" | "bodySmall";

export interface TypeScaleEntry {
  fontFamily:
    | typeof DISPLAY_REGULAR
    | typeof DISPLAY_BOLD
    | typeof BODY_REGULAR
    | typeof BODY_MEDIUM
    | typeof BODY_SEMIBOLD
    | typeof BODY_BOLD;
  fontSize: number;
  lineHeight: number;
}

// Sizes/weights/fonts read directly off typography.png's sections 1 and 4-5 (Primary Typefaces,
// Headings Hierarchy, Body Text Examples). Cinzel only ships Regular/Bold weights in this app (no
// separate Semibold file) — the sheet's "Cinzel Semibold" entries (h1, h3) use DISPLAY_BOLD as
// the closest available weight.
export const TYPE_SCALE: Record<TypeScaleLevel, TypeScaleEntry> = {
  h1: { fontFamily: DISPLAY_BOLD, fontSize: 48, lineHeight: 56 },
  h2: { fontFamily: DISPLAY_BOLD, fontSize: 32, lineHeight: 40 },
  h3: { fontFamily: DISPLAY_BOLD, fontSize: 24, lineHeight: 32 },
  h4: { fontFamily: BODY_SEMIBOLD, fontSize: 18, lineHeight: 24 },
  h5: { fontFamily: BODY_MEDIUM, fontSize: 14, lineHeight: 20 },
  bodyLarge: { fontFamily: BODY_REGULAR, fontSize: 16, lineHeight: 24 },
  bodyRegular: { fontFamily: BODY_REGULAR, fontSize: 14, lineHeight: 20 },
  bodySmall: { fontFamily: BODY_REGULAR, fontSize: 12, lineHeight: 16 },
} satisfies Record<TypeScaleLevel, TextStyle>;
