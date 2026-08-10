# GPT Asset Review — Naming Catalog

Cataloging pass over the 88 GPT-generated images in this folder. **Files have been renamed on disk** to the IDs below — this document is the permanent record of the original filename → new name mapping, plus which renders are duplicate/near-duplicate "shinier clones."

## Naming convention

| Prefix | Meaning |
|---|---|
| `CARD-FACE-<RANK>-<SUIT>[-PORTRAIT]-0N[A/B/C]` | Illustrated hero court-card / character art |
| `TABLE-0NN[-A/B]` | Numbered "Master Asset Library" HUD/design-system sheets — ID is baked into the image itself by GPT; suffix added only when two different renders share the same baked-in number |
| `BRAND-001-A/B` | The unnumbered "World of Cards — Design Language v1.0" master style-guide sheets |
| `FRAME-<A/B/C>-<FELT/NOFELT>-0N[A/B]` | Physical wood+brass table-frame renders, grouped by the three distinct frame designs found (A: medallion+plaque racetrack, B: rivet+side-pad oval/pill, C: rivet+gear/hamburger+nameplate shell) |
| `SCENE-TABLE-01A/B` | Fully populated 4-seat gameplay table mockups (not library grids) |
| `BADGE-ROUND-0N` / `BADGE-PILL-0N` / `BADGE-RECT-0N` | Frosted-glass + brass badge/plaque component renders |
| `FELT-GREEN-0N[A]` | Plain felt texture swatches |
| `ICONSET-0N[A/B/C]` | Icon-library sprite sheets |
| `PANELKIT-GLASS-0N[A/B]` | Blank glass-morphic UI panel/shape template sheets |
| `KIT-HARDWARE-0N` | Raw brass/wood hardware & ornament parts kits (rivets, medallions, dividers, blank label outlines) |
| `PLAQUE-WOOD-01` | Flat wood nameplate/plaque background (singleton) |

Where GPT already baked a `TABLE-0NN` label into the artwork, that number was preserved as the canonical ID. Two numbers were reused across genuinely different renders (`TABLE-025`, `TABLE-035`) — both variants were kept with `-A`/`-B` suffixes; see the duplicates table below for which one is recommended as the true canonical `TABLE-025` / `TABLE-035`.

Files with a `-dup`/`-dup1`/`-dup2` suffix are near-identical re-renders kept under a distinguishing name rather than deleted — delete them yourself if you want to de-duplicate the folder.

---

## Duplicates & Shiny Clones — summary

Recommended keeper is **bold**.

| Group | Files (new names) | Recommended keeper |
|---|---|---|
| King of Spades (striped, color) | CARD-FACE-KING-SPADES-01A.jpg, CARD-FACE-KING-SPADES-01B.jpg, CARD-FACE-KING-SPADES-01B-dup.jpg | **01B** (01B-dup is an identical tighter crop; 01A is a distinct color variant, worth keeping separately) |
| King of Spades (jeweled crown, upgraded) | CARD-FACE-KING-SPADES-02A.png, CARD-FACE-KING-SPADES-02B.png | **02B** (adds belt roundel, richer contrast) |
| King of Clubs | CARD-FACE-KING-CLUBS-01A.png, CARD-FACE-KING-CLUBS-01A-dup.png | **01A** (dup is the same render, cropped) |
| King of Diamonds (axe, single bottom-left axe) | CARD-FACE-KING-DIAMONDS-01A.png, -01A-dup1.png, -01A-dup2.png | **01A** (dup1/dup2 are exact repeats) |
| King of Diamonds (axe, open-hand/stacked) | CARD-FACE-KING-DIAMONDS-02A.png, -02A-dup.png | **02A** |
| King of Hearts | CARD-FACE-KING-HEARTS-01A.png, -01B.png | **01A** (fist vs. open-hand — pick by pose preference) |
| Icon Style Library (uncategorized) | ICONSET-01A.png, -01B.png, -01C.png | **01B** (has notification badge + extra icon row) |
| Round frosted badge (checkered bg) | BADGE-ROUND-01A/B/C/D.png | **01B** (cleanest, no over-glow) |
| Pill badge, empty, checkered bg | BADGE-PILL-01A.png, -01A-dup.png | **01A** |
| Pill badge on gradient-glow bg | BADGE-PILL-02A.png, -02A-dup.png | **02A** |
| Rectangular gold plaque, glow halo | BADGE-RECT-01A.png, -01A-dup.png | **01A** |
| Wood/brass Frame B, no felt, flat bg | FRAME-B-NOFELT-01A.png, -01A-dup.png | **01A** |
| Wood/brass Frame C (gear/hamburger shell), no felt | FRAME-C-NOFELT-01A.png, -01A-dup.png | **01A-dup** (marginally sharper render — consider swapping names) |
| TABLE-025 "Chips/Tokens/Counters" (two different content passes, same baked number) | TABLE-025-A.png, TABLE-025-B.png | **TABLE-025-B** (broader denomination range + material diagram) |
| TABLE-035 "Menu/Overlay System" (two different content passes, same baked number) | TABLE-035-A.png, TABLE-035-B.png | **TABLE-035-B** (cleaner layout, no photo backdrop) |
| "Design Language v1.0" master style sheet | BRAND-001-A.png, BRAND-001-B.png | **BRAND-001-B** (landscape, more complete swatch set) |
| Plain green felt texture (no border) | FELT-GREEN-01A.png, -01A-dup.png | **01A** |

Variant pairs kept **intentionally distinct** (not true duplicates — different art direction, lighting pass, or compositing purpose):
- `CARD-FACE-KING-DIAMONDS-01B.png` (mirrored dual-axe) — genuine pose variant of the 01A family, not a clone.
- `FRAME-A-FELT-01A.png` / `FRAME-A-FELT-01B.png` — same design, different end-cap geometry.
- `FRAME-B-FELT-02A.png` (opaque bg) / `FRAME-B-FELT-02B.png` (transparent cutout) — same table, different compositing use case.
- `SCENE-TABLE-01A.png` (clean UI style) / `SCENE-TABLE-01B.png` (ornate jeweled style) — same 4-seat layout, deliberately different art direction.
- `CARD-FACE-KING-SPADES-PORTRAIT-01A.png` (moody vignette) / `-01B.png` (flat graphic) — companion treatments.

**Totals:** 88 images → **~55 distinct visual concepts** after grouping → **~24 images** are exact/near-exact clones, kept under `-dup` names, safe to delete if you want to de-duplicate.

---

## Full mapping (original filename → new name)

### Court-card illustrations (18 files)

| Original Filename | New Filename | Notes |
|---|---|---|
| 1783864657542.jpg | CARD-FACE-KING-SPADES-01A.jpg | Green center stripe, 3 spade pips |
| 1783864657557.jpg | CARD-FACE-KING-SPADES-01B.jpg | Navy/red pinstripe stripe — keeper of this sub-group |
| 1783864657574.jpg | CARD-FACE-KING-SPADES-01B-dup.jpg | Near-identical to 01B, tighter crop — delete candidate |
| 1783864657611.png | CARD-FACE-KING-SPADES-02A.png | Jeweled crown upgrade, mixed spade/heart pips |
| 1783864657711.png | CARD-FACE-KING-SPADES-02B.png | Same + belt roundel emblem — keeper of this sub-group |
| 1783864657753.png | CARD-FACE-KING-CLUBS-01A.png | Orb+cross+sword, profile — keeper |
| 1783864657792.png | CARD-FACE-KING-CLUBS-01A-dup.png | Same render, tighter crop — delete candidate |
| 1783864657832.png | CARD-FACE-KING-DIAMONDS-01A.png | Axe king, single bottom-left axe — keeper |
| 1783864657872.png | CARD-FACE-KING-DIAMONDS-01B.png | Mirrored dual-axe variant — genuine pose variant, keep |
| 1783864657908.png | CARD-FACE-KING-DIAMONDS-01A-dup1.png | Identical to 01A — delete candidate |
| 1783864657948.png | CARD-FACE-KING-DIAMONDS-01A-dup2.png | Identical to 01A — delete candidate |
| 1783864657987.png | CARD-FACE-KING-DIAMONDS-01C.png | Same king + added gold filigree frame border |
| 1783864658027.png | CARD-FACE-KING-HEARTS-01A.png | Raised sword, open hand |
| 1783864658071.png | CARD-FACE-KING-DIAMONDS-02A.png | Axe king, open hand, stacked same-side axes — keeper |
| 1783864658125.png | CARD-FACE-KING-DIAMONDS-02A-dup.png | Identical to 02A — delete candidate |
| 1783864658161.png | CARD-FACE-KING-HEARTS-01B.png | Same as 01A, closed fist instead of open hand |
| 1783864658195.png | CARD-FACE-KING-SPADES-PORTRAIT-01A.png | Single portrait, moody vignette lighting |
| 1783864658216.png | CARD-FACE-KING-SPADES-PORTRAIT-01B.png | Single portrait, flat graphic-novel treatment |

### TABLE-0NN Master Asset Library sheets (29 files)

| Original Filename | New Filename | Baked-in title | Notes |
|---|---|---|---|
| 1786357228023.png | TABLE-034.png | Gameplay HUD Master | Unique |
| 1786357228034.png | TABLE-033.png | Player Hand System | Unique |
| 1786357228047.png | TABLE-032.png | Deck / Card Stack System | Unique |
| 1786357228054.png | TABLE-031.png | Card Face System | Unique |
| 1786357228066.png | TABLE-030.png | Card Back Master Variations | Unique |
| 1786357228087.png | TABLE-029.png | Typography & Text Treatment Library | Unique |
| 1786357228118.png | TABLE-028.png | Final Table Assembly / Master Gameplay Composition | Unique |
| 1786357228132.png | TABLE-027.png | Gameplay Micro-Interaction Effects | Unique |
| 1786357228147.png | TABLE-026.png | Dealer / Turn / Trick Indicators | Unique |
| 1786357228155.png | TABLE-025-A.png | Chips / Tokens / Counters | Same baked number as TABLE-025-B, different denomination set |
| 1786357228164.png | TABLE-025-B.png | Chips / Tokens / Counters | Recommended canonical TABLE-025 |
| 1786357228182.png | TABLE-024.png | Card Interaction & Selection States | Unique |
| 1786357228197.png | TABLE-023.png | Deck / Card Back System | Unique |
| 1786357228214.png | TABLE-022.png | Card System Master | Unique |
| 1786357228241.png | TABLE-021.png | Motion Glow & Reflection Animation Frames | Unique |
| 1786357228256.png | TABLE-020.png | Player Panel Lighting | Unique |
| 1786357228279.png | TABLE-019.png | Player Seat Module | Unique |
| 1786357228482.png | TABLE-039.png | Motion / Animation Library | Unique |
| 1786357228493.png | TABLE-038.png | Responsive 9:16 Layouts | Unique |
| 1786357228505.png | TABLE-037.png | Victory / Results System | Unique |
| 1786357228516.png | TABLE-036.png | Tutorial / Onboarding System | Unique |
| 1786357228526.png | TABLE-035-A.png | Menu / Overlay System | Same baked number as TABLE-035-B, blurred photo backdrop |
| 1786357228539.png | TABLE-035-B.png | Menu / Overlay System | Recommended canonical TABLE-035 |
| 1786357228592.png | TABLE-014.png | Full Gameplay Composition Kit | Unique — numbered out of sequence with the rest |
| 1786357228604.png | TABLE-013.png | Typography & Number Treatment Library | Unique |
| 1786357228623.png | TABLE-012.png | Interface States & Micro Effect Library | Baked-in text is garbled/hallucinated — lowest quality sheet, consider regenerating |
| 1786357228638.png | TABLE-011.png | Chips, Tokens & Score Marker Library | Unique |
| 1786357228648.png | TABLE-010.png | Player Avatar & Seat Identity Library | Unique |
| 1786357228666.png | TABLE-009.png | Playing Card Library | Unique |

### Brand / design-language master sheets (2 files)

| Original Filename | New Filename | Notes |
|---|---|---|
| 1786357228582.png | BRAND-001-A.png | "World of Cards — Design Language v1.0", portrait |
| 1786357229157.png | BRAND-001-B.png | Same title/content, landscape, more complete swatch set — recommended keeper |

### Table-frame renders — wood + brass, ± felt (11 files, 3 design families)

| Original Filename | New Filename | Family | Notes |
|---|---|---|---|
| 1786357228849.png | FRAME-A-NOFELT-01.png | A (medallion + plaque racetrack) | Hollow/transparent center |
| 1786357228883.png | FRAME-A-FELT-01A.png | A | Felt insert, rounded plaque caps |
| 1786357228901.png | FRAME-A-FELT-01B.png | A | Felt insert, flared/stepped plaque caps — geometry variant, keep both |
| 1786357228374.png | FRAME-B-FELT-01.png | B (rivet + side-pad oval/pill) | Portrait narrow oval, with felt |
| 1786357228396.png | FRAME-B-NOFELT-01A.png | B | Flat bg, no felt — keeper |
| 1786357228414.png | FRAME-B-NOFELT-01A-dup.png | B | Near-identical — delete candidate |
| 1786357228425.png | FRAME-B-NOFELT-01B.png | B | Same frame + added glow background — distinct lighting pass, keep |
| 1786357228447.png | FRAME-B-FELT-02A.png | B | Landscape wide oval, opaque gradient bg |
| 1786357228459.png | FRAME-B-FELT-02B.png | B | Same table, transparent cutout bg — different use case, keep |
| 1786357228562.png | FRAME-C-NOFELT-01A.png | C (rivet + gear/hamburger + nameplate shell) | Keeper candidate |
| 1786357228573.png | FRAME-C-NOFELT-01A-dup.png | C | Marginally sharper render than 01A — consider swapping names |

### Gameplay scene mockups (2 files)

| Original Filename | New Filename | Notes |
|---|---|---|
| 1786357228916.png | SCENE-TABLE-01A.png | Clean/UI art style, "You / West AI / East AI / South AI — 0 tricks" |
| 1786357228929.png | SCENE-TABLE-01B.png | Same 4-seat layout, ornate/jeweled art direction, no baked text — kept as alt art direction |

### Badge / plaque component renders (11 files)

| Original Filename | New Filename | Notes |
|---|---|---|
| 1786357228946.png | BADGE-ROUND-01A.png | Round frosted badge, glow ring |
| 1786357228998.png | BADGE-ROUND-01B.png | Cleaner, no over-glow — recommended keeper |
| 1786357229042.png | BADGE-ROUND-01C.png | Near-dup — delete candidate |
| 1786357229059.png | BADGE-ROUND-01D.png | Near-dup — delete candidate |
| 1786357228957.png | BADGE-PILL-01-SAMPLE.png | Pill badge with sample text "12 / TRICKS" — useful as annotated reference |
| 1786357228976.png | BADGE-PILL-01A.png | Empty, checkered bg — keeper |
| 1786357229025.png | BADGE-PILL-01A-dup.png | Near-identical — delete candidate |
| 1786357229014.png | BADGE-PILL-02A.png | On warm gradient-glow bg — keeper |
| 1786357229087.png | BADGE-PILL-02A-dup.png | Near-identical — delete candidate |
| 1786357229107.png | BADGE-RECT-01A.png | Rectangular gold plaque, glow halo — keeper |
| 1786357229139.png | BADGE-RECT-01A-dup.png | Near-identical — delete candidate |

### Felt texture swatches (4 files)

| Original Filename | New Filename | Notes |
|---|---|---|
| 1786357229181.png | FELT-GREEN-01A.png | Plain texture, no border — keeper |
| 1786357229210.png | FELT-GREEN-01A-dup.png | Near-identical — delete candidate |
| 1786357228871.png | FELT-GREEN-BORDERED-01.png | Same texture family, thin gold border added — distinct, keep |
| 1786357228800.png | FELT-LIGHTING-REF-01.png | Multi-swatch lighting reference sheet (1–4 spotlights, ambient, beams) |

### Icon library sheets (4 files)

| Original Filename | New Filename | Notes |
|---|---|---|
| 1786357228681.png | ICONSET-01A.png | Uncategorized vertical sheet |
| 1786357228701.png | ICONSET-01B.png | Adds notification badge + extra row — recommended keeper |
| 1786357228735.png | ICONSET-01C.png | Near-dup, minor variation — delete candidate |
| 1786357228716.png | ICONSET-02.png | Categorized (Material/Navigation/Gameplay banners), distinct landscape composition |

### UI panel/shape template sheets (2 files)

| Original Filename | New Filename | Notes |
|---|---|---|
| 1786357228749.png | PANELKIT-GLASS-01A.png | Blank glass-morphic shapes, gold borders visible |
| 1786357228763.png | PANELKIT-GLASS-01B.png | Same shapes, glow-only/unlit pass — distinct lighting variant, keep |

### Raw hardware/ornament parts kits (4 files)

| Original Filename | New Filename | Notes |
|---|---|---|
| 1786357228309.png | KIT-HARDWARE-01.png | Brass chip-well / cup-holder ring renders |
| 1786357228347.png | KIT-HARDWARE-02.png | Gold metal parts kit (bars, studs, rosette, brackets) + blank nameplate |
| 1786357228816.png | KIT-HARDWARE-03.png | Wood+brass blank label/plaque shape sprite sheet |
| 1786357228834.png | KIT-HARDWARE-04.png | Brass rivet/medallion/divider hardware kit |

### Singleton (1 file)

| Original Filename | New Filename | Notes |
|---|---|---|
| 1786357228471.png | PLAQUE-WOOD-01.png | Flat wood nameplate/plaque background, no felt, no table shape |
