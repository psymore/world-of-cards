# Table Shell Redesign — Design

**Status:** Approved by user 2026-08-10. Next: `writing-plans` for implementation.

## Goal

Replace the current full-bleed felt+corner-frame table look with a distinct, floating table object — matching the direction the user settled on with ChatGPT (`docs/references/GPT-powerful-assets-review/BRAND-001-A.png`, `BRAND-001-B.png`) — with player panels fused into the table's rim, and (in a later phase) a subtle 2.5D tilt so the table reads as laying in front of the player rather than viewed from directly above.

## Current state (for contrast)

`packages/ui`'s `TableFelt`, `TableWoodCorners`, and `TableEdgeRails` paint a flat, top-down felt image full-bleed across the entire screen, with SVG wood wedges/rails framing just the screen's corners/edges. There is no distinct table object with visible background around it, and no baked-in player-panel geometry — panels are positioned by each game independently. This pattern stays as-is for Batak and Home during this work; only Pişti (the pilot) moves to the new approach.

## Decisions

### 1. Floating object, not full-bleed

The table becomes a distinct object sitting on a dark backdrop, with visible margin/background around it — matching BRAND-001-A/B's hero render, not the full-bleed `docs/references/table-design/*.jpeg` alternative (which matches today's code and was explicitly rejected in favor of this direction).

### 2. Player panels fused into the rim

Panels (name, avatar, trick count, turn indicator) must read as built into the table's edge, not floating separately beside it — per the majority of table-design references the user has been working from.

### 3. Source asset: `FRAME-C-NOFELT-01A.png`

Of the three real candidates considered:

| Option | Verdict |
|---|---|
| `FRAME-A-FELT-01B.png` (frame+felt baked, panels built in code) | **Rejected.** Its insert-channel geometry differs by side (short curved strips top/bottom vs. long straight strips left/right), so generically-positioned code panels visibly misalign against it. |
| `FRAME-C-NOFELT-01A.png` (frame with 4 glass panel plaques + gear/hamburger icons already artist-placed, no felt) | **Chosen.** Panels are already correctly fused and symmetric for all 4 seats; the only gap is felt. |
| Cropping BRAND-001-B's exact hero table out of its master sheet | Rejected — needs isolating from a busy sheet and removing baked "You / West AI" placeholder text, for no fidelity advantage over option 2 given both lock in exactly 4 seats anyway. |

Before finalizing, compare `FRAME-C-NOFELT-01A.png` against its near-duplicate `FRAME-C-NOFELT-01A-dup.png` (cataloged as a marginally sharper render) and pick whichever composites more cleanly.

### 4. Felt compositing via alpha-punch script, not manual editing

`FRAME-C-NOFELT-01A.png` has no alpha channel (confirmed: `PNG image data, 941 x 1672, 8-bit/color RGB`) — its center is opaque black, not transparent. A one-time, checked-in script (Python/PIL or ImageMagick) thresholds the near-black center to transparent, producing `table-shell.png`. This gets layered in code over an existing felt image (`FELT-GREEN-01A.png`/`FELT-GREEN-BORDERED-01.png` from the catalog, or the felt already in `packages/ui/assets/table/green.png`) — same "frame image over felt image" pattern the codebase already anticipated (`TableFelt`'s own precedent of using a real photo asset over a hand-rolled SVG approximation).

### 5. New component: `TableShell`

Lives in `packages/ui`, alongside the existing table components. Renders, as one inset unit (not full-bleed):
- A solid dark backdrop (the "room" the table sits in — plain color for the pilot; texture/vignette is a later enhancement, not blocking).
- The felt image, then the alpha-punched frame image on top.
- 4 fixed seat anchors (top/bottom = horizontal pill, left/right = vertical pill) as layout constants, matching the baked plaque positions in the source art, for callers to position the actual `PlayerBadge`/avatar/trick-count components against.

### 6. Seat-count handling

Anchors are fixed at 4; unused ones simply render nothing. Pişti's 2-player mode uses only top+bottom, leaving left/right empty — no additional art asset needed per seat count. This needs a compatibility check during implementation: Pişti's existing `pistiSeating.ts` coordinate system must map cleanly onto the top/bottom/left/right anchor scheme.

### 7. The 2.5D tilt is a later, separate step

Confirmed via the visual companion: the tilt is a genuine addition, not something already in BRAND-001-A/B's art (their hero render is close to flat top-down). Direction: far seat compresses/shrinks, near seat (the human player's) reads bigger/closer — like sitting at the table, not a satellite view. Magnitude: subtle — between a 12°-`rotateX` mockup (too flat) and a 38°-`rotateX` mockup (too dramatic), leaning toward the subtler end; the exact value gets tuned visually against the real built component, not locked from a CSS approximation now.

Sequencing is deliberate: build and validate the flat table first, then add the tilt as a single `transform: [{ perspective }, { rotateX }]` wrapping the whole shell + seat-anchor layer as one nested unit, so the baked art and the live panel overlays tilt together rigidly. Building panels as code (not baked pixels) is what makes this retrofit cheap later.

### 8. Build order

1. **Prototype in `apps/playground`** (isolated from shipped games, per existing precedent for visual/animation experiments):
   - Run the alpha-punch script on `FRAME-C-NOFELT-01A.png` (and its `-dup` twin for comparison).
   - Build `TableShell` with dark backdrop + felt + frame layering, hardcoded 4 seats, no live game data — validate no visible seam at the felt/frame boundary and consistent lighting/color between the two source images.
   - Add static panel placeholders at all 4 anchors; confirm the 2-seat case (left/right hidden) reads as intentional empty seats, not broken layout.
   - Apply the tilt last, once the flat version is settled.
2. **Port into `packages/ui`** once Playground validates the look.
3. **Pilot in Pişti**: swap `TableFelt`/`TableWoodCorners`/`TableEdgeRails` for `TableShell` on Pişti's table screen, wire real seat data through the existing `PlayerBadge`/seating logic into the 4 anchors.
4. **Batak and Home stay on the old full-bleed look** until a separate, explicit follow-up decision — per the cross-app visual-consistency guardrail (`docs/governance/guardrails.md` §4), rolling this out further is not automatic just because the pilot succeeds.

## Explicitly out of scope

- Batak and Home migration (future decision, not part of this spec).
- Center gameplay elements (fanned hand, card piles, chip stacks, deck art) — untouched, remain existing separate components layered over the felt as today.
- Wiring the gear/hamburger icons baked into the frame art to real settings/menu actions — this spec covers the visual frame/felt/panel-anchor system only.
- Exact final tilt angle — tuned during implementation against the real component, not specified numerically here.

## Testing / verification

Almost entirely visual; no `packages/engine` logic changes. Verification is react-native-web + Playwright/local Chrome screenshots at a couple of representative phone aspect ratios, plus the 2p/4p empty-seat case — not unit tests.
