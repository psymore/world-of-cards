# Typography foundation — design

## Context

`docs/references/GPT-powerful-assets-review/upscayl_png_upscayl-standard-4x_4x/TABLE-029.png` is an
AI-generated "Typography & Text Treatment Library" reference covering 14 areas: typeface pairing,
a 7-level type hierarchy (H1–H7), title/player-name/numeric/button/label/status/panel/counter/
micro-text treatments, text effects, and pixel measurements. Right now `packages/ui` has exactly
one typography decision on record — PT Serif for the `PlayingCard` corner rank
(`docs/superpowers/specs/2026-07-13-card-corner-rank-font-design.md`) — no shared type-scale or
second typeface exists.

## Scope

**In scope (this pass):** the shared foundation only — the typeface pairing, the H1–H7 type-scale
tokens, and applying the new typeface *identity* (font-family/weight, not size) to `SeatIdentity`
(`packages/ui/src/SeatIdentity.tsx`), the one existing `packages/ui` component that renders
free-form text (player name, status/trick count).

**Explicitly out of scope:** the other 12 TABLE-029 sections (button/label/status/panel/counter/
micro-text/effects treatments) and applying the new typefaces to `apps/mobile`'s per-screen text
(`HomeWordmark`, `PistiSetupView`, `BatakSetupView`, `BidControls`, `BatakSettingsModal`,
`GameResultModal`, `DevTuningControls`, `GameScreenLayout`) — none of those have a shared component
to land tokens on yet; they pick up the new typefaces individually as each screen is next touched.
Also out of scope: resizing `SeatIdentity`'s text to literally match TABLE-029's `32px`/`28px`
figures — those are sized for a full desktop-style mockup, not this component's much smaller
rendered anchor; this pass changes font identity only, not the existing `fontSize`/`scale` math.

## Fonts

TABLE-029's font labels ("Trajan-inspired Custom Serif", "Modern Humanist Sans") describe an
aesthetic, not real files. Two OFL-licensed Google Fonts are used instead:

- **Primary serif — Cinzel.** Its Roman-inscriptional capital letterforms are the closest real
  match to the "Trajan-inspired" reference. Used for H1–H4 (titles, numbers, premium UI, player
  names), matching TABLE-029's own "Titles / Numbers / Premium UI" grouping for the primary serif.
- **Secondary sans — Inter.** A modern humanist sans, used for H5–H7 (labels, body text, system
  UI), matching TABLE-029's "Labels / Body Text / System UI" grouping.

Two weights each (Regular, Bold) — same pattern as the existing `PTSerif-Bold`/`PTSerif-Regular`
entries. Files added at `packages/ui/assets/fonts/Cinzel-Regular.ttf`, `Cinzel-Bold.ttf`,
`Inter-Regular.ttf`, `Inter-Bold.ttf`, registered in the existing `FONTS` map in
`packages/ui/src/fonts.ts` (extended, not replaced — `PTSerif-*`/`CARD_RANK_FONT_FAMILY` stay as
they are for the card corner rank). Both `apps/mobile/App.tsx` and `apps/playground/App.tsx`
already call `useFonts(FONTS)` from `@world-cards/ui`, so no other loading code changes.

## Type scale

TABLE-029's own "14. TEXT MEASUREMENTS" panel annotates exactly two literal sizes: Player Name
32px (H4) and Score 28px (H5) — an exact 8:7 step. The rest of the scale extends that ratio,
rounded to clean pixel values, with line-heights at ~1.2×:

| Level | Role (per TABLE-029 §2) | Font | Weight | Size | Line-height |
|---|---|---|---|---|---|
| H1 | Main Title | Cinzel | Bold | 48 | 58 |
| H2 | Section Title | Cinzel | Bold | 40 | 48 |
| H3 | Panel Title | Cinzel | Regular | 36 | 44 |
| H4 | Player Name | Cinzel | Bold | 32 | 40 |
| H5 | Label / Button | Inter | Regular | 28 | 34 |
| H6 | Small Label | Inter | Regular | 24 | 30 |
| H7 | Micro Text | Inter | Regular | 20 | 26 |

## New module: `packages/ui/src/typography.ts`

```ts
export const PRIMARY_SERIF_REGULAR = 'Cinzel-Regular';
export const PRIMARY_SERIF_BOLD = 'Cinzel-Bold';
export const SECONDARY_SANS_REGULAR = 'Inter-Regular';
export const SECONDARY_SANS_BOLD = 'Inter-Bold';

export interface TypeScaleEntry {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
}

export const TYPE_SCALE: Record<'h1'|'h2'|'h3'|'h4'|'h5'|'h6'|'h7', TypeScaleEntry> = {
  h1: { fontFamily: PRIMARY_SERIF_BOLD, fontSize: 48, lineHeight: 58 },
  h2: { fontFamily: PRIMARY_SERIF_BOLD, fontSize: 40, lineHeight: 48 },
  h3: { fontFamily: PRIMARY_SERIF_REGULAR, fontSize: 36, lineHeight: 44 },
  h4: { fontFamily: PRIMARY_SERIF_BOLD, fontSize: 32, lineHeight: 40 },
  h5: { fontFamily: SECONDARY_SANS_REGULAR, fontSize: 28, lineHeight: 34 },
  h6: { fontFamily: SECONDARY_SANS_REGULAR, fontSize: 24, lineHeight: 30 },
  h7: { fontFamily: SECONDARY_SANS_REGULAR, fontSize: 20, lineHeight: 26 },
};
```

Re-exported from `packages/ui/src/index.ts` alongside the existing `FONTS`/`CARD_RANK_FONT_FAMILY`
exports.

## `SeatIdentity.tsx` changes

- `nameText` style: replace `fontWeight: "bold"` with `fontFamily: PRIMARY_SERIF_BOLD` (H4
  identity) — existing `fontSize`/`lineHeight`/`scale` values untouched.
- `trickText` style: add `fontFamily: SECONDARY_SANS_REGULAR` (H5/H6 identity) — existing
  `fontSize`/`lineHeight`/`scale` values untouched.

## Testing

No new automated tests, per the standing 2026-07-07 mobile-UI testing policy — `SeatIdentity.test.tsx`
keeps passing unchanged (RN `Text` renders with an unloaded/unknown `fontFamily` name fine in Jest;
it just won't rasterize with that face). Manual visual confirmation happens on the user's connected
phone: screenshot via adb to confirm Cinzel/Inter actually render (not falling back to
tofu/system font), per the current phone-connected-phase screenshot policy
(`docs/governance/guardrails.md` §3) — screenshots deleted before merge, and the user does their own
final check in the running app before merging.
