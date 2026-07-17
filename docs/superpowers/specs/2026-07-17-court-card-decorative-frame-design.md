# Court card decorative frame — design spec

## Goal

Add a thin decorative frame around the center-art illustration on King/Queen/Jack cards, echoing the rectilinear frame seen on classic playing cards (the user supplied a real reference photo and an isolated line tracing — see `docs/references/card-art/this what I want to achive.png` and `docs/references/card-art/frame.png`). The frame should read as surrounding the character illustration while never crossing the corner rank/suit indices.

## Scope

**King, Queen, Jack only — not Aces.** `PlayingCard.tsx` already has an `isFaceCard` boolean (`card.rank === 'K' || 'Q' || 'J'`) used to enlarge court-card art; this reuses the same predicate. Aces were explicitly considered and excluded: `COURT_CARD_ART`'s ace entries (`A-hearts`, `A-spades`) are ornamental heart/spade motifs, not a character illustration, and they already fill most of the card face with their own scrollwork — an added frame would be redundant and would visually compete with the existing ornament. Clubs/diamonds have no ace art at all (falls back to the plain suit watermark).

The frame only renders when real `courtArt` exists for that card (i.e., not the plain-suit-watermark fallback path) and the card is face-up.

## Geometry

### Derivation

The frame is **two disconnected pieces**, not one continuous line — confirmed from `frame.png`, which traces the reference photo's frame in isolation. Each piece is 2 straight, axis-aligned segments meeting at exactly one 90° corner:

- **Top-right bracket**: starts clear of the top-left corner index, runs along the top, turns 90° at the card's true top-right corner (empty — no index there), runs down the right side, stops clear of the bottom-right corner index.
- **Bottom-left bracket**: starts clear of the top-left corner index (its left side), runs down the left side, turns 90° at the card's true bottom-left corner (also empty), runs along the bottom, stops clear of the bottom-right corner index.

Both closed corners (top-right, bottom-left) sit at the two corners with no rank/suit index, so the frame closes cleanly there with no obstruction. Both open ends simply stop short of whichever corner index box they're approaching — no touching or jogging needed, which trivially satisfies "never cross the rank text or suit glyph."

Only straight, axis-aligned segments are used — no diagonal chamfers — so a repeating stroke pattern (dashes, a chevron/rope motif, etc., if adopted in a future style pass) holds a consistent rhythm on every run and only has to turn cleanly around one corner per piece.

### Measured proportions

The closed corners' inset from the card's true edge was measured directly from the reference files with a pixel scanner (found the true card boundary by detecting the green table background in `this what I want to achive.png`, and the frame's turn coordinates in `frame.png` — both files share the same 558×773 canvas, so they line up):

- Top-right corner: 16.9% inset from the right edge, 9.2% from the top edge
- Bottom-left corner: 12.2% inset from the left edge, 12.1% from the bottom edge

Rounded to a single uniform **13% inset** on all four sides for both corners, rather than four slightly-different magic numbers.

### Coordinates (derived, not eyeballed — verified against `PlayingCard.tsx`'s real box geometry)

Both sizes below were checked against the actual corner-index box dimensions already in `PlayingCard.tsx` (`CORNER_INDEX_WIDTH`, corner text/icon sizing) so the open ends clear the box with a small (~2–2.5px) gap, never touching or entering it.

**Normal size (card 84×132):**

```
Piece 1 (top-right bracket): M32.5,17.25 L73,17.25 L73,83.5
Piece 2 (bottom-left bracket): M11,48.5 L11,114.75 L51.5,114.75
```

**Small size (card 54×86):**

```
Piece 1 (top-right bracket): M22,11 L47,11 L47,52
Piece 2 (bottom-left bracket): M7,34 L7,75 L32,75
```

These are reference values for the initial implementation. If they need hand-tuning once rendered on a real card (e.g., the open-end clearance looks too tight/loose at actual mobile render size), adjust in place — the derivation method (13% inset for closed corners, box-edge + small gap for open ends) is what matters, not that these exact numbers are sacred.

## Style

**Clean thin black, solid stroke, sharp corners** — directly matching the reference photo/`frame.png` as drawn, with no dashing or ornament. `stroke="#111"` (matching the existing corner-index text color), stroke-width scaled to size (something like 1.5 normal / 1 small — thin enough to read as a fine line at actual card render size, tuned visually once on a real device/screenshot).

Two other style directions (dashed gold with a black outline; a "vintage French ornamental" variant with small diamond/dot accents at the corners) were mocked up and explicitly deferred, not built now — may be revisited as an alternate style later.

## Component design

New file `packages/ui/src/CourtCardFrame.tsx`, following the existing convention set by `TableWoodCorners`/`CardBackPattern`/`SuitIcon`: a small, zero-dependency, `React.memo`'d SVG component.

```ts
interface CourtCardFrameProps {
  size: PlayingCardSize; // 'normal' | 'small' — picks the coordinate set above
}
```

Renders an `<Svg>` sized to the card's own dimensions (`CARD_DIMS[size]`) containing two `<Path>` elements (one per bracket), absolutely positioned to fill the card face — same `AbsoluteOverlay` pattern already used for `TableFelt`/`CardBackPattern`.

### Integration point

In `PlayingCard.tsx`'s `PlayingCardComponent`, rendered as a sibling alongside `CenterArt` (inside `CardFrame`, after the two `CornerIndex` elements), gated on:

```ts
const isFaceCard = card.rank === 'K' || card.rank === 'Q' || card.rank === 'J';
const courtArt = card.suit != null ? COURT_CARD_ART[`${card.rank}-${card.suit}`] : undefined;
// render <CourtCardFrame size={size} /> only when courtArt != null && isFaceCard
```

This condition already exists in `CenterArt` today (`isFaceCard` gates the enlarged-art style) — the new frame reuses the same check rather than duplicating slightly-different logic. No `overlayImage` interaction needed: the frame is skipped whenever `overlayImage` is set (playground template previews, etc.), since those aren't necessarily K/Q/J court art at all.

## Testing

No new automated tests, per the project's standing 2026-07-07 mobile-UI testing policy (decorative, presentational-only component — same treatment as `CardBackPattern`, `TableWoodCorners`, `PlayerAvatar`). Verify visually via the existing browser/Playwright workflow before merging: check all four suits' K/Q/J render with the frame correctly clearing both corner indices, at both `normal` and `small` sizes, and confirm Aces are unaffected.

## Cross-cutting note (per CLAUDE.md's standing rule)

`PlayingCard` is shared by `apps/mobile` and `apps/playground` via `packages/ui`. Per the project's standing rule, whether/how `apps/playground`'s card template editor should expose or preview this frame is a separate discussion to have explicitly once this ships — not auto-mirrored, not silently skipped.
