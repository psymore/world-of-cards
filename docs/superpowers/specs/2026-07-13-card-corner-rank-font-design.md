# Card corner-rank font design

**Date:** 2026-07-13
**Status:** approved

## Problem

`PlayingCard.tsx`'s corner rank index (the `A/2-10/J/Q/K` shown top-left and bottom-right of every card face) currently renders using the RN system default font (`fontWeight: 'bold'`, no `fontFamily`). This has two issues:

1. It looks plain compared to the rest of the card's now-illustrated presentation (suit watermarks, AI-generated court card art, felt/wood table dressing).
2. Relying on the system default font means the rank text is drawn using whatever font each OS supplies (San Francisco on iOS, Roboto on Android) — visually inconsistent across platforms, and dependent on OS/OEM font availability rather than something this app controls directly.

## Goals

- Replace the plain system font with a deliberate, classic-playing-card-style serif typeface for the corner rank index only.
- Guarantee the chosen font renders identically on every device, regardless of OS or installed system fonts.
- Make switching between font weights (Bold/Regular) a one-line change, since the weight choice was made without a rendered preview.

## Non-goals

- Restyling any other text in the app (screen titles, buttons, banners). This is scoped to `PlayingCard.tsx`'s corner rank index only.
- Introducing a general app-wide theming/typography system. (The existing navy/gold color-literal duplication between `HomeScreen`/`PistiSetupView` is a separately-tracked future item, not addressed here.)

## Design

### Font choice

**PT Serif** (Google Fonts, SIL Open Font License) — chosen over Roboto Slab and Cinzel for the best balance of "reads as a traditional playing-card numeral" and legibility at the corner index's small render sizes (17px small / 24px normal). It has true lining (uniform-height) figures, avoiding the uneven baselines of old-style numerals.

Both `PTSerif-Bold.ttf` and `PTSerif-Regular.ttf` are bundled (not just the weight in active use), so switching weights later never requires re-sourcing font files or re-running this design process — it's a one-line constant change (see below).

### Dependencies

Add `expo-font` and `expo-splash-screen`, installed via `npx expo install expo-font expo-splash-screen` so versions match the pinned Expo SDK 57 exactly.

### New files

- `apps/mobile/assets/fonts/PTSerif-Bold.ttf`
- `apps/mobile/assets/fonts/PTSerif-Regular.ttf`
- `apps/mobile/src/theme/fonts.ts`:
  ```ts
  export const FONTS = {
    'PTSerif-Bold': require('../../assets/fonts/PTSerif-Bold.ttf'),
    'PTSerif-Regular': require('../../assets/fonts/PTSerif-Regular.ttf'),
  };

  // Change this to 'PTSerif-Regular' to switch the card corner-index weight.
  export const CARD_RANK_FONT_FAMILY = 'PTSerif-Bold';
  ```
  `CARD_RANK_FONT_FAMILY` is the single line that needs to change to switch weights — both files are already bundled and registered via `FONTS`, so no other file changes are needed to swap.

### Font loading gate (`App.tsx`)

Standard Expo SDK 57 pattern: call `SplashScreen.preventAutoHideAsync()` at module scope, load fonts via `useFonts(FONTS)`, render `null` while `!loaded && !error`, and call `SplashScreen.hideAsync()` once loading settles (loaded or errored). This guarantees the font is fully loaded before any card ever renders — no flash of the system font while the custom font streams in.

### `PlayingCard.tsx` changes

In `styles.cornerRankNormal` and `styles.cornerRankSmall`:
- Add `fontFamily: CARD_RANK_FONT_FAMILY` (imported from `../theme/fonts`).
- Remove the existing `fontWeight: 'bold'`. The loaded font file *is* PT Serif's bold weight already; leaving `fontWeight: 'bold'` on top risks Android synthesizing a second, distorting layer of faux-bold over an already-bold glyph.

### Why this guarantees cross-device consistency

The `.ttf` file is bundled directly into the app binary via `require()` (a standard Metro/Expo asset, not a network font or OS font reference), so every device loads the exact same font file byte-for-byte — it does not depend on whatever fonts are pre-installed on a given iOS version or Android OEM skin, which is precisely why today's system-default rendering looks different across platforms. The corner index only ever needs plain ASCII (`A 2-9 10 J Q K`), well within any font's basic Latin glyph coverage, so there is no glyph-substitution risk. The only device-level variance bundling cannot remove is OS-level sub-pixel anti-aliasing/hinting — a cosmetic rendering nuance, not a correctness or legibility issue.

## Testing

No new automated tests — this is a pure decorative/typography change to existing UI, consistent with this project's standing policy of not writing new tests for mobile UI polish. Verification is visual: the existing browser/Playwright screenshot workflow, confirming the corner index renders in PT Serif Bold at both card sizes with no layout shift or clipping, and confirming no new console warnings from the font-loading gate.

## Risks / follow-ups

- Not verified on a native on-device build (consistent with the standing, already-tracked native-verification gap for the rest of Pişti's UI work).
- If PT Serif Bold looks too thin or too heavy once actually rendered, Roboto Slab Bold was identified as the fallback candidate during design discussion — switching typefaces entirely (not just weight) would require re-sourcing font files, unlike the Bold/Regular weight swap this design already supports for free.
