# Seat Identity (Avatar + Nameplate) — Design

**Status:** Approved by user 2026-08-10 (fast-tracked per explicit "go with the flow" instruction — decisions below resolve the open questions myself rather than pausing for confirmation). Next: `writing-plans` for implementation.

**Builds on:** `docs/superpowers/specs/2026-08-10-table-shell-redesign-design.md` (the `TableShell` component and its 4 fixed seat anchors are unchanged; this spec only replaces what gets rendered *inside* those anchors).

## Goal

Replace `TableShellPreview`'s plain-text `SeatBadge` with a real seat-identity module — avatar + name + trick count — built from the cataloged GPT-review assets, contained entirely within the existing baked plaque bounds (no anchor resize, no breaking free of the rim).

## Decisions

### 1. Composition: contained, per `SCENE-TABLE-01A`

Confirmed earlier in this session (superseding an initial "avatar breaks free of the plaque, mounted like a porthole" exploration): the avatar is a small inset silhouette living *inside* the existing plaque, next to the name and trick-count text — nothing overlaps the wood/gold rim, and `SEAT_ANCHOR_STYLE` in `TableShell.tsx` stays untouched.

### 2. Nameplate pattern: `TABLE-010` Section 3, rebuilt from real assets

`TABLE-010.png`'s Section 3 ("Player Nameplate Styles") establishes the compositional pattern to copy: **avatar circle + name text + a small badge/score circle, in one row.** The sheet itself isn't used as a pixel asset (1024×1536 master library sheet, RGB, no alpha, busy backdrop — not worth keying) — only its layout is copied, rebuilt from two assets that already key out cleanly:

- **Plaque background:** one small horizontal glass-pill shape from `PANELKIT-GLASS-01A.png`, crop box `{ left: 20, top: 1150, width: 450, height: 90 }` (verified by direct crop during design — a plain rounded pill, cleanly isolated on pure `#000000` background). This sheet's background has no other content sharing that luminance near the cropped pill, so keying it to alpha is a trivial uniform-black flood-fill from a corner seed — nothing like Task 1's connectivity problem (that image had a frame with plaques/icons at similar luminance elsewhere in the *same* crop; here the pill is the only non-background content in its crop box). Its dark-green-glass-in-gold-rim look already matches `FRAME-C`'s baked plaques almost exactly, so it drops in without a style mismatch.
- **Avatar ring:** the "Classic Gold" style from `TABLE-010` Section 1 is just a plain gold ring around a silhouette — which is what `apps/mobile`'s existing `PlayerAvatar.tsx` placeholder (silhouette in a thin circular border, `Circle`+`Path` via `react-native-svg`) already is. `packages/ui` cannot import from `apps/mobile` (cross-app isolation rule, `docs/domains/ui-visual-system/overview.md` §"cross-app isolation rule") and `apps/playground` cannot either, so `SeatIdentity` draws its own small silhouette directly (same two SVG shapes, duplicated intentionally across the isolation boundary — not a DRY violation to fix here). No pixel-asset extraction needed for the avatar ring; `BADGE-ROUND-01B.png` is not used.
- **Badge/score accent:** a second, smaller crop from the *same* `PANELKIT-GLASS-01A.png` sheet — one of its small glass circles, crop box `{ left: 30, top: 1020, width: 130, height: 110 }` (also verified by direct crop — clean isolation on pure black, identical extraction technique to the plaque). Used as the small badge slot on the nameplate's trailing edge — a decorative accent `FRAME-C` doesn't already have baked in.

**`KIT-HARDWARE-02.png` was evaluated and rejected for this pass:** it's the one sheet among the six hardware/panel sheets with a real (if fully-opaque-as-authored) alpha channel, and its diamond/sparkle badge shapes looked like a natural accent — but its background is a warm gold-to-tan *gradient*, not a uniform color, and its objects have a dark center *and* a bright rim, i.e. three luminance bands instead of two. `floodFillHoleMask`'s flood fill compares each pixel to a fixed absolute `floodThreshold`, not to its neighbors' local color — exactly the shape of problem that made Task 1 take 4 fix rounds (an absolute threshold can't separate "background" from "object" when the object's own darkest pixels fall in the same range as the background). Sourcing both pieces from `PANELKIT-GLASS-01A` instead keeps this pass genuinely low-cost, matching what "start with 1-2 highest-value pieces" was meant to buy. `KIT-HARDWARE-01/02/03/04` and `PANELKIT-GLASS-01B` are not used in this pass.

### 3. Rotation for left/right seats

`TABLE-010` Section 10's full-table preview shows left/right nameplates only lightly angled (following a real oval's curve) — not a solution to our problem, since our `TableShell` seat anchors for left/right are a narrow, tall rail (9.5% wide), not a wide oval flank. Per the user's explicit instruction, the fix is a genuine 90° rotation: the same horizontal pill asset, rotated in code so its long axis runs vertically, fitting the tall/narrow anchor the way it fits the wide/short one at top/bottom. Left rotates +90°, right rotates −90° (both "lean into" the table, text reading top-to-bottom on the left and bottom-to-top on the right) — a plain `transform: [{ rotate: '90deg' }]` / `'-90deg'` on the whole seat module, same rigid-block pattern already used for `TableShell`'s own tilt transform.

### 4. New component: `SeatIdentity`

Lives in `packages/ui` next to `TableShell`. Replaces `TableShellPreview`'s local `SeatBadge`.

```
SeatIdentity({ name, trickCount, orientation }: {
  name: string;
  trickCount: number;
  orientation: 'horizontal' | 'rotated-left' | 'rotated-right';
})
```

Renders, inside the plaque-background image (the extracted pill crop):
- the silhouette avatar ring (small, code-drawn — SVG, same two shapes as `PlayerAvatar`, duplicated per Decision 2)
- `name` text
- `trickCount` as "`N` tricks" (matches the existing in-game copy convention)
- the extracted small-circle badge accent image, fixed decorative position

`orientation` selects the rotation transform from Decision 3; `horizontal` (no transform) is used for top/bottom, `rotated-left`/`rotated-right` for the left/right seats respectively.

### 5. Asset extraction approach

One new build script, reusing `scripts/lib/floodFillHoleMask.js` and `scripts/lib/blurAlphaChannel.js` as-is (no algorithm changes needed). The technique is Task 1's *final* (round-4) architecture, mirrored: binary alpha from a connectivity mask, no per-pixel luminance feather, edge-blurred. The one structural difference is the seed point and mask polarity — Task 1 seeded from the *center* to find a hole surrounded by opaque content; here the seed is a *corner* of each crop (guaranteed background) to find the background surrounding an opaque object, so the mask semantics are inverted (`mask[i] ? backgroundAlpha=0 : objectAlpha=255` — same formula, opposite meaning). Both crops (Decision 2's plaque and badge) sit on flat, isolated `#000000` with the extracted object as the only other content in the crop box, so a corner-seeded flood fill at a conservative threshold (comfortably above pure-black, comfortably below the object's darkest pixel — measure both directly against the actual crop, don't guess) cleanly separates them, same as Task 1's round-4 fix but without needing `closeMaskGaps`' gap-closing tuning (no plaque/icon collision risk inside a single-object crop).

## Explicitly out of scope

- `BADGE-ROUND-01B.png` / `BADGE-PILL-01A.png` extraction — superseded by Decision 2 (reusing the existing code-drawn avatar ring, and `PANELKIT-GLASS-01A` for the plaque).
- `KIT-HARDWARE-01/02/03/04.png`, `PANELKIT-GLASS-01B.png` — not used; scope stays at the 2 pieces in Decision 2 (both cropped from `PANELKIT-GLASS-01A.png`).
- Any change to `TableShell.tsx`'s `SEAT_ANCHOR_STYLE` — anchors stay exactly as calibrated in the prior plan.
- Live game data wiring (real player names/trick counts from Pişti state) — this spec covers the Playground prototype only, matching the prior spec's build order (Playground → `packages/ui` → Pişti pilot).
- The still-open repo-bloat housekeeping question (`git rm --cached` on the 70 already-tracked upscaled files) — unrelated to this spec, left for the user separately.

## Testing / verification

Same approach as the base `TableShell` work: visual verification via react-native-web + Playwright/local Chrome screenshots in the Playground (all 4 seats, both rotations legible), plus a build-script region-average check on the extracted assets (plaque interior alpha, badge-accent alpha) mirroring Task 1's pattern.
