# Suit icon glyph refinement design

**Date:** 2026-07-14
**Status:** approved

## Problem

`SuitIcon.tsx`'s four hand-drawn SVG suit shapes (introduced to replace inconsistently-rendering Unicode suit glyphs — see the card center art work in `CLAUDE.md`) were a first pass: simple geometric shapes, not refined against a visual reference. Once seen at real render size (corner index ~18-20px, center watermark ~50-64px) against the project's established Batak-HD visual reference, four specific shape issues stood out:

- Diamonds, hearts, and spades had straight or smoothly convex sides, reading as generic/rounded rather than traditional playing-card suit shapes.
- Clubs' three lobes (drawn as three overlapping circles) had no visible negative space between them — the top circle's lower edge reached far enough down to fully plug the gap between the bottom two circles, so the shape read as one solid blob rather than three distinct lobes.

## Process

Reviewed via a side-by-side visual comparison (current vs. proposed SVG paths, rendered at both real sizes) built as a Claude Artifact, iterated across two rounds:

1. First pass proposed concave-side tweaks for hearts/diamonds/spades and a wider-spaced (but still solid) club — approved for hearts/diamonds/spades as-is; the club revision was rejected because it only re-spaced the same three circles without fixing the underlying cause (the top circle geometrically still covered the center).
2. Second pass diagnosed the real cause and compared two fixes for clubs — "Option B" (true equilateral spacing, so no single circle's radius reaches the shape's center) and "Option C" (Option B plus an explicit small white circle punched through the center to guarantee visibility at the smallest render size). Option C was chosen.

## Design

### Hearts, diamonds, spades — approved as designed in the first pass

- **Hearts / spades:** the side segment between each lobe and the bottom/top point now pulls toward the shape's centerline partway down before flaring back out, creating a visible waist instead of a single smooth convex curve. Both suits share this same curve language for visual consistency.
- **Diamonds:** the four straight edges of the original rhombus (`M12,2 L21,12 L12,22 L3,12 Z`) are replaced with quadratic curves that bow toward the center, reading as a traditional four-pointed lozenge.

### Clubs — Option C

The three lobe circles move to true equilateral spacing around the shape's center (`(12,6)`, `(7.67,13.5)`, `(16.33,13.5)`, each `r=4.6`), so — unlike the original layout, where the top circle's lower edge extended well past the midpoint between the bottom two circles — no single circle's radius reaches the shape's actual center point. This alone produces a small, honest negative-space gap, but it's subtle at the corner index's smallest render size.

A fourth shape, a small circle (`cx=12, cy=11, r=1.4`) filled `#ffffff`, is layered on top at the center to guarantee that gap stays clearly visible regardless of render size. This relies on an explicit assumption: **the card face directly behind the icon is white** (or effectively white/light enough that a solid white circle is indistinguishable from the background). This is true everywhere `SuitIcon` is used today (`PlayingCard.tsx`'s corner index and center watermark both render on the card's white face), but is a real constraint on any future reuse of `SuitIcon` on a non-white background — the punched-through circle would show as a visible white dot rather than a transparent gap. Noted as a forward risk, not fixed now (no such reuse exists yet — YAGNI).

## Non-goals

- No changes to `PlayingCard.tsx`, corner sizing, or watermark opacity — this is scoped entirely to `SuitIcon.tsx`'s path/shape data.
- No attempt at a true transparent knockout (SVG mask) instead of a hardcoded white circle — rejected as unnecessary complexity given `SuitIcon` has exactly one real-world usage context (white card face) today.

## Testing

No new automated tests — pure decorative SVG shape data, consistent with this project's standing policy against writing new tests for UI polish. `SuitIcon.test.tsx` / `PlayingCard.test.tsx` assert on `testID`s and suit/rank content, not path data, so they are expected to pass unmodified. Verification is visual: browser/Playwright screenshots of the corner index and center watermark for all four suits, at both card sizes.

## Risks / follow-ups

- The white center-hole circle in clubs is background-color-dependent (see above) — revisit if `SuitIcon` is ever reused on a non-white surface.
- Not verified on a native on-device build (consistent with the standing, already-tracked native-verification gap for this project's UI work).
