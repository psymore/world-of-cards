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

- **Plaque background:** one small horizontal glass-pill shape from `PANELKIT-GLASS-01A.png` (row 2, e.g. the plain rounded pill). This sheet sits on pure `#000000` with no other content sharing that luminance nearby the cropped pill, so keying it to alpha is a trivial uniform-black threshold — nothing like Task 1's connectivity problem (that image had a frame with plaques/icons at similar luminance elsewhere in the same crop; a single isolated pill on flat black has no such collision). Its dark-green-glass-in-gold-rim look already matches `FRAME-C`'s baked plaques almost exactly, so it drops in without a style mismatch.
- **Avatar ring:** the "Classic Gold" style from `TABLE-010` Section 1 is just a plain gold ring around a silhouette — which is what `apps/mobile`'s existing `PlayerAvatar.tsx` placeholder (silhouette in a thin circular border) already approximates. No new asset extraction needed for the avatar ring itself; reuse/lightly restyle the existing silhouette placeholder rather than pulling `BADGE-ROUND-01B.png` (avoids a second extraction job for a look we can already produce in code).
- **Badge/score accent:** one small diamond-or-circle hardware element from `KIT-HARDWARE-02.png` (this sheet is the one real `RGBA` file among the six hardware/panel sheets checked — confirmed via `file`, though its alpha is fully opaque as authored, so it still needs the same uniform-background keying as the glass pill, just without a colorspace conversion first). Use it as the small badge slot on the nameplate's trailing edge — a decorative accent `FRAME-C` doesn't already have baked in, rather than duplicating `FRAME-C`'s existing medallion/rivets.

This resolves both "what are `KIT-HARDWARE` and `PANELKIT-GLASS` actually for" questions from earlier in this session: **`PANELKIT-GLASS-01A` supplies the nameplate's plaque body; `KIT-HARDWARE-02` supplies one small badge accent.** `KIT-HARDWARE-01/03/04` and `PANELKIT-GLASS-01B` are not used — this is the "1-2 highest-value pieces" scope the user already chose, spent across the whole nameplate (not per-sheet).

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

Renders, inside the plaque-background image (the extracted `PANELKIT-GLASS-01A` pill crop):
- the silhouette avatar ring (small, code-drawn — SVG, matching `PlayerAvatar`'s existing approach)
- `name` text
- `trickCount` as "`N` tricks" (matches the existing in-game copy convention)
- the `KIT-HARDWARE-02` badge accent, fixed decorative position

`orientation` selects the rotation transform from Decision 3; `horizontal` (no transform) is used for top/bottom, `rotated-left`/`rotated-right` for the left/right seats respectively.

### 5. Asset extraction approach

One new build script, following Task 1's *final* (round-4) architecture directly — binary alpha from a uniform-background threshold, no per-pixel luminance feather, edge-blurred — since both source crops sit on flat, isolated black with no nearby same-luminance content to protect against. This is strictly simpler than Task 1 (no connectivity/flood-fill needed; a plain luminance threshold is safe here because there's nothing else dark in the crop to accidentally punch).

## Explicitly out of scope

- `BADGE-ROUND-01B.png` / `BADGE-PILL-01A.png` extraction — superseded by Decision 2 (reusing the existing code-drawn avatar ring, and `PANELKIT-GLASS-01A` for the plaque).
- `KIT-HARDWARE-01/03/04.png`, `PANELKIT-GLASS-01B.png` — not used; scope stays at the 2 pieces in Decision 2.
- Any change to `TableShell.tsx`'s `SEAT_ANCHOR_STYLE` — anchors stay exactly as calibrated in the prior plan.
- Live game data wiring (real player names/trick counts from Pişti state) — this spec covers the Playground prototype only, matching the prior spec's build order (Playground → `packages/ui` → Pişti pilot).
- The still-open repo-bloat housekeeping question (`git rm --cached` on the 70 already-tracked upscaled files) — unrelated to this spec, left for the user separately.

## Testing / verification

Same approach as the base `TableShell` work: visual verification via react-native-web + Playwright/local Chrome screenshots in the Playground (all 4 seats, both rotations legible), plus a build-script region-average check on the extracted assets (plaque interior alpha, badge-accent alpha) mirroring Task 1's pattern.
