# Batak bid buttons: number-only, Baldur's Gate 3-inspired styling

**Date:** 2026-07-19
**Status:** approved, not yet implemented

## Problem

Batak's bid buttons (`BidControls` in `apps/mobile/src/games/batak/BatakTable.tsx`) currently render as a flex-wrapped row of plain rectangles reading "Bid 5", "Bid 6", ... "Bid 13", plus "Pass" — generic styling, no visual identity. The user supplied a reference button design (Aaron Iker's ["CSS Baldur's Gate 3 Button Hover Animation"](https://codepen.io/aaroniker/pen/XWoYByX) on CodePen) and asked for the bid buttons to (a) drop the word "Bid" and show only the number, and (b) look close to that reference.

The reference's actual CSS/HTML was fetched and reviewed in full. It has two visually distinct parts: the button itself (cut-corner octagon silhouette, dark bronze-brown gradient fill, warm gold gradient-clipped text, a soft top/bottom radial "shine" overlay that brightens on hover, an overall drop shadow) and an elaborate ornamental border ("frame") built from multiple SVG line/path pieces with masked corner shadows. The user explicitly scoped the ask down to just the button itself, not the frame.

## Design, iterated live via an HTML mockup (Artifact)

Two style variants were mocked up with the reference's real colors/gradients: Variant A kept the reference's cut-corner octagon shape (as an SVG shape, matching how this codebase already draws `CourtCardFrame`/`TableWoodCorners`); Variant B used a plain rounded-rect border (a normal RN border, no new SVG shape). **The user picked Variant B.**

Two rounds of refinement on B, confirmed against the live mockup:
1. **Layout**: a fixed 3×3 grid (5/6/7, 8/9/10, 11/12/13) instead of the previous flex-wrap row, with Pass as its own full-width row below the grid — not merged into the number grid.
2. **Hover color**: first tried swapping the border/text gold to a much brighter, different hue (`#F4C542`, the app's own existing gold accent) — user rejected this, wanted the original muted gold back (`#B19B7E` idle → `#CEB390` hover). What the user actually wanted was for the **button's own fill/body color** to also shift a bit on hover (previously only the border, text opacity, and shine overlay changed on hover — the fill gradient was static). Final: fill gradient warms from `#31221B`/`#341307` (idle) to `#40291d`/`#4a2a10` (hover), alongside the existing border/text/shine hover changes, which are otherwise unchanged from the reference's own values.

## Final visual spec

**Per-button shape**: plain rounded rectangle (`borderRadius` ~10, at the RN scale used — mockup used 10px CSS px against 56×56 buttons), not the reference's cut-corner octagon. No SVG shape needed.

**Fill** (idle → hover): `linear-gradient(#31221B, #341307)` → `linear-gradient(#40291d, #4a2a10)`, both blended with the same soft diagonal white/black overlay gradient the reference uses for a beveled-metal look (`rgba(255,255,255,0) → rgba(255,255,255,0.4) → rgba(0,0,0,0.3) → rgba(0,0,0,0)` at 0/50/50.01/100%).

**Border**: single-tone border/glow, not the reference's multi-piece SVG frame. Idle: 1.4px `#B19B7E` + a faint inset top highlight. Hover: 1.6px `#CEB390` + a slightly stronger inset highlight + a soft outer glow (`rgba(206,179,144,0.55)`, ~8px blur).

**Shine overlay**: a radial white gradient across the top ~60% of the button, `mix-blend-mode: overlay`, opacity 0.6 idle → 1 on hover (unchanged from the reference's own top-shine behavior).

**Text (bid number)**: gradient-clipped text, `#cdaf87` idle → `linear-gradient(#ffe5c2, #CEB390)` on hover — same gold family as the border, per the reference. Font: a serif face (reference used "Cormorant Garamond"; RN implementation should reuse whatever serif is already available/bundled in this app, or fall back to the system serif — no new font dependency for this pass). No "Bid" prefix — the label is the number alone (`"5"`, `"6"`, ... `"13"`).

**Pass button**: same shape/fill/shine/border mechanics, its own reddish-brown accent instead of gold — idle `#8a5a4a` → hover `#c98a6f` for border/glow, `#d9a98f` → `#f0c9b8` for text. Renders as its own full-width row below the 3×3 number grid, not folded into it. Label stays `"Pass"`.

**Layout**: `BidControls`'s `bidGrid` becomes a fixed 3-column grid for the 9 possible bid amounts (5 through 13 — Batak's real bid range, unchanged), Pass rendered separately below as a wide button. `modalCard` (the surrounding panel) is unchanged.

**Sizing**: number buttons ~56×56 (square); Pass spans the grid's width at a shorter height (~44). Exact RN dp values should match the mockup's px values 1:1 as a starting point, adjusted only if they don't fit `modalCard`'s existing `maxWidth: 320`.

## Explicitly out of scope

- The reference's cut-corner octagon silhouette (Variant A) — considered, not chosen.
- The reference's full ornamental SVG border/corner-shadow system — the user's explicit "not its frame" steer.
- Any change to bid legality/logic, `legalMoves`, or the `modalCard` panel styling around the grid.
- Reusing this button style anywhere outside Batak's `BidControls` (not Pişti — Pişti has no bidding; not Batak's trump-suit picker, which is a separate component (`TrumpSuitPicker`) not touched by this request).

## Testing

No new automated tests — pure decorative UI restyle, consistent with the standing 2026-07-07 mobile-UI testing policy (CLAUDE.md). Existing suite must still pass unchanged (no prop/behavior changes to `BidControls`'s inputs, only its internal rendering). No proactive screenshot/visual verification per the user's 2026-07-17 direction — verification for this pass was the live HTML mockup (Artifact), already reviewed and approved by the user; native on-device confirmation remains the standing, previously-flagged gap for the whole app.
