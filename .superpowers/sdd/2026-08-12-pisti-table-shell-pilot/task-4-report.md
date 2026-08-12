# Task 4 Report — Split `OpponentSeat` and restructure `PistiTable`'s JSX around `TableShell`

**Status:** DONE_WITH_CONCERNS
**Branch:** `game/pisti-table-shell-pilot`
**Commit:** `f3394b9` — `feat(pisti): pilot TableShell + SeatIdentity, real turn state, animated ring`
**Files changed:** `apps/mobile/src/games/pisti/PistiTable.tsx`, `packages/ui/src/index.ts`

---

## What was done

### Step 1 — `OpponentSeat` split (as briefed)

`OpponentSeat` is gone. In its place:

- `OpponentHandStack` (`OpponentHandStackProps`) — the face-down card stack only. Dropped
  `playerNames` from the props, and dropped the now-dead `capturedCount` / `isCurrentTurn` locals.
  The `testID={`opponent-hand-${playerId}`}` view and its `fillWidthMarginPx` / `cardStyles` math
  are byte-identical to before, which is why the existing tests kept passing untouched.
- `renderOpponentNameplate(seat, state, playerNames)` — a plain function (not a component)
  returning a `SeatIdentity`, since its output is handed to `TableShell` as a `seats` entry.

### Step 2 — imports

`TableFelt` / `GeminiTableBackground` → `TableShell` / `SeatIdentity`. `PlayerBadge` and
`useDevTuningStore` imports removed, along with the `devTableBackground` read inside `PistiTable`.
`SeatIdentityTurnStateFrames` added to the type import.

`PistiDevTuningModal.tsx` still imports `devTuningStore` — left alone; it's out of this task's
scope and the store itself is still live for Batak.

### Step 3 — `PISTI_TURN_STATE_FRAMES` — **used the named-export fallback**

Checked `packages/ui/src/index.ts` first, as instructed. Findings:

- The brief claims the named-export pattern "matches how every other `packages/ui` image asset is
  already exposed to consuming apps." **That is not accurate** — before this change `index.ts`
  exported *zero* image assets. There was no existing convention either way.
- The deciding evidence is `packages/ui/package.json`: its `exports` map is
  `{ ".": "./src/index.ts" }`. With package-exports resolution (on by default in this Expo/Metro
  version), `require('@world-cards/ui/assets/table/avatar-frame-idle.png')` is not a resolvable
  subpath. The brief's primary strategy would have failed at bundle time.

So I added the three re-exports to `packages/ui/src/index.ts` (typed `: number`, matching
`SeatIdentityTurnStateFrames`'s field type and `SeatIdentity`'s own `AVATAR_IMAGES` record) and
consumed them from `PistiTable.tsx`. Verified working in the real web bundle — the rings render.

### Steps 4-6 — `tableShellSeats`, render tree, styles

All as briefed. `capturedHuman` reused, not recomputed. `styles.pileArea` removed; `pileMat`,
`pileStack`, `pileCardSlot`, `revealLabel`, `pileCount` kept unchanged. `pileMat`'s existing
`195x225` was left alone — it reads correctly at the new proportions (see screenshots), so no
blind resize.

### Steps 7-8 — typecheck and tests

- `npx tsc --noEmit -p apps/mobile` → clean, no output.
- `npx jest apps/mobile/src/games/pisti/PistiTable.test.tsx` → **7/7 passed**.
- Also ran, unprompted, as a blast-radius check: `npx jest apps/mobile` → **14 suites / 37 tests
  passed**; `npx jest packages/ui` → **4 suites / 15 tests passed** (the `index.ts` change touches
  that package).

---

## Step 9 — visual verification (web build)

Ran `npx expo start --web --port 8090` (port 8081 was already occupied by an unrelated process)
and drove it with `playwright-core` + local Chrome at 412x915 CSS / DSF 2. All screenshots and
scripts went to the session scratchpad; nothing was written into the repo (`git status` confirmed
clean apart from the two intended files). Dev server stopped afterwards and port 8090 confirmed
freed.

**No page errors or console errors in any run.**

### Finding 1 (blocking) — the brief's layout overflowed the screen

With the brief's literal `tableArea: { position: 'relative' }`, the render tree laid out as a
plain vertical column: `TableShell` (auto height, collapsing to its own aspect-ratio height)
*then* the top card stack *then* the middle row. Measured DOM:

```
scrollHeight:        1406   (viewport 915)
table-shell:         y 106 .. 675
opponent-hand-ai-2:  y 574 .. 675   (below the table, not on it)
opponent-hand-ai-3:  y 757 .. 1157  (~240px past the bottom of the screen)
```

The human's hand fan rendered zero cards on screen, both side stacks were off-screen, and on the
first frames the table painted over the app header. Root cause: `TableShell`'s own root is
`flex: 1`, so under an auto-height parent it takes only its intrinsic height and every following
sibling is pushed past the viewport (RN's default `flexShrink: 0` means nothing compresses).

**Fix (deviation 1):** `tableArea: { flex: 1, position: 'relative' }`, and the top group +
middle row wrapped in a new `styles.handStackOverlay` absolute-fill layer with
`pointerEvents="box-none"`. This is what actually implements the intent already written into the
brief's own style comment ("the **overlaid** opponent card-stacks", "the card stacks render as
siblings **above** it") and the design spec §"Face-down opponent card stacks ... render layered
around/over the new floating `TableShell` object". After the fix: `scrollHeight` 931 vs viewport
915, human hand visible, everything on screen.

### Finding 2 — the stacks covered every plaque

With a plain absolute fill, the stacks landed exactly on `TableShell`'s baked plaque anchors and
hid all three opponent nameplates completely — which would make the entire point of Tasks 3-4
invisible.

**Fix (deviation 2):** two percentage insets, chosen by measuring the rendered plaque anchors:

- `handStackOverlay: { top: '13%', bottom: '15%' }` — drops the top stack below the top plaque,
  and shortens the middle row (the side stacks derive their height from its measured height) so
  their lower ends clear the human's bottom plaque.
- `styles.middleRowInset: { paddingHorizontal: '21%' }` — pushes the side columns inboard of the
  side plaques. Applied as a Pişti-local style composed onto `seatLayoutStyles.middleRow` rather
  than edited into that shared style, since **Batak's table uses it too**.

Percentages, not pixels, so they track the table box (itself a percentage of screen width).

### Verified end state

All measurements at 412x915:

| element | box (x, y, w, h) |
|---|---|
| `table-shell` | 16, 106, 379, 569 |
| seat-top plaque | 134, 135, 152, 26 |
| seat-bottom plaque | 134, 587, 152, 28 |
| seat-left plaque | 44, 304, 52, 154 |
| seat-right plaque | 316, 304, 52, 154 |
| top stack | 51, 166, 310, 101 |
| left stack | 100, 332, 70, 247 |
| right stack | 242, 332, 70, 247 |

Confirmed by reading the screenshots directly:

- **TableShell surface renders** — merged wood frame + felt + glow, correct aspect, centered.
- **All 4 nameplates visible inside their plaque anchors**, correctly oriented (top/bottom
  horizontal, left `rotated-left`, right `rotated-right`), with avatar, name, and `🂠 N` status.
- **Turn ring art is live** — the active seat's avatar shows the lit gold ring, others don't, and
  the ring moves to the correct seat as turns advance (confirmed across the post-AI-play frame,
  where AI 1's captured count also correctly ticked to 6).
- **Card stacks sit beside their nameplates**, on the felt, not floating away and not covering the
  plaques.
- **Pile centered inside the table**, `pileMat` at its existing size reads correctly; the
  `N cards` label and the `You played` reveal label both land legibly.
- **Play interaction works on web** — tap-to-select then tap-to-play fired through the RNGH
  `GestureDetector` (unlike the emulator's synthetic taps), the card traveled from the real hand
  position up into the pile with its fan rotation preserved, landed in the correct slot, and the
  trick was gathered. **Travel direction is correct**; nothing here needs Task 5's
  `REVEAL_ORIGIN_OFFSETS` tuning on the strength of what I saw.
- **Both table sizes verified** — 4-player FFA (left/top/right nameplates) and 2-player (top +
  bottom only; the unused side plaques render bare, which is correct).

---

## Deviations from the brief — summary

1. **`tableArea: { flex: 1 }` + absolute `handStackOverlay`** instead of bare
   `{ position: 'relative' }`. Not optional — the briefed version pushes the hand fan and both
   side stacks off-screen. Implements the brief's own stated "overlaid" intent.
2. **`handStackOverlay` top/bottom insets + `styles.middleRowInset`.** Beyond the brief's
   "nudge only if something is visibly wrong" allowance in letter but squarely within it in
   spirit: without them, every opponent nameplate is 100% occluded.
3. **`packages/ui/src/index.ts` touched** (3 asset re-exports). The controller's scope note said
   PistiTable.tsx only, but the brief's Step 3 fallback explicitly prescribes this file, and the
   package's `exports` map makes the alternative unresolvable. Additive only; `packages/ui` tests
   still pass.
4. **Did not touch** `seatLayoutStyles.opponentAreaSide` / `middleRow` directly despite the brief
   naming them as nudge knobs — they're shared with Batak.

## Concerns / notes for Task 5

1. **`middleRowInset: '21%'` is a genuine compromise, not a solved layout.** At phone width the
   felt cannot simultaneously clear two side card columns, the centered pile, and both side
   plaques. 21% leaves a few px of overlap at each column's inner edge (against the pile) and
   outer edge (against the plaque). Alternatives worth considering in the visual pass: shrink the
   side stacks (a `size="tiny"` card or a fanned/overlapped column instead of a spread one),
   or move the side stacks outside the table box entirely onto the black backdrop.
2. **`HAND_CONTENT_HEIGHT` is now stale.** It's still `HAND_BADGE_HEIGHT + HUMAN_CARD_HEIGHT`, but
   the human's `PlayerBadge` no longer renders in `handArea` — the content is just the card row.
   That feeds `HAND_ROW_PEAK_DISTANCE_FROM_BOTTOM` and hence `HandFrame`'s computed peak, so the
   arch is now derived from a content height ~`HAND_BADGE_HEIGHT` too large. It looks fine in the
   screenshots (the hand row sits comfortably above the arch), so I did not touch it — but it's a
   real latent inconsistency and a one-line fix if the visual pass wants the arch tightened.
3. **Top stack re-centers when a card is played.** Going 4→3 cards visibly shifts the whole top
   row horizontally (`fillWidthMarginPx` recenters). Pre-existing behavior, not introduced here,
   but much more noticeable now that the row sits against a fixed plaque above it.
4. **The top stack's outermost cards overhang the wood frame** onto the black backdrop at
   4-player width. Cosmetic; `TOP_FAN_WIDTH_FRACTION` (0.85 of *window* width, not table width)
   is the knob.
5. **Verification was web-only** — no adb/emulator in this environment. Native layout should match
   (nothing used here is web-specific), but the percentage insets in particular are worth one
   on-device confirmation.

---

## Fix round 1 — 3 Important review bugs + 2 cleanups

A code review of Task 4 raised 3 Important bugs. All 3, plus 2 related one-line cleanups, are
fixed in the current diff to `apps/mobile/src/games/pisti/PistiTable.tsx` (no other files
touched).

### Bug 1 — reveal card painted under opponent stacks (z-order)

Root cause: `revealCard`'s JSX used to render as a child of `pileStack`, inside `TableShell`'s
children — an ordinary sibling with no explicit `zIndex`. The opponent hand stacks render later,
inside `handStackOverlay`, whose `middleRow` (shared with Batak via `seatLayoutStyles`) carries
`zIndex: 10`. Since the side stacks overlap `pileMat`'s horizontal span, a card traveling out from
a side seat painted *behind* that seat's own remaining face-down cards.

Fix: the whole `revealCard` block was hoisted out of `pileStack`/`TableShell` and now renders as
its own top-level sibling, `styles.revealLayer` — `position: 'absolute'`, full-bleed, `zIndex: 20`,
`pointerEvents: 'none'` — placed after `handStackOverlay` in the JSX so it's both a later sibling
and layered above it. Because the reveal card's existing `translateX`/`translateY` offsets
(`revealDestinationOffset`) are expressed in `pileStack`'s local coordinate space, `revealLayer`
reproduces that space exactly via a `revealPileMatGhost`/`revealPileStackGhost` pair: same
`PILE_MAT_WIDTH`/`PILE_MAT_HEIGHT`/`PILE_STACK_WIDTH`/`PILE_STACK_HEIGHT` box, centered the same
way inside the container, background-less ("positioning ghost, not a second mat"). The ghost
stack's own position within the ghost mat is set from a newly measured `pileStackOffset`
(`{x, y}`), because that offset isn't derivable — the real `pileMat` centers `pileStack` together
with the `N cards` label below it, so the stack's actual top offset depends on that label's
rendered line height. A new `handlePileStackLayout` (`onLayout` added to the real `pileStack`)
measures it, defaulting to the label-free centering math until the first layout pass corrects it.

### Bug 2 — vertical insets resolved against the wrong axis

Root cause: `handStackOverlay`'s `top: '13%'` / `bottom: '15%'` are percentages of the
*container*'s height, but `TableShell`'s table box (and hence the baked plaque anchors the insets
exist to clear) derives both its height and its vertical centering from the container's *width*
(`width: '92%'` then `aspectRatio`). The two only agree at the one viewport shape the percentages
were eyeballed against; at any other aspect ratio the insets drift off the plaques.

Fix: a new `handleTableAreaLayout` (`onLayout` on `styles.tableArea`) measures `tableAreaSize`.
A `useMemo`-computed `stackOverlayInsets` then derives the table box's real geometry
algebraically — `boxHeight = tableAreaSize.width * TABLE_BOX_WIDTH_FRACTION /
TABLE_SHELL_ASPECT_RATIO` (mirroring `TableShell`'s own `tableBox` style, since `TableShell`
exposes no ref/onLayout for it), `boxTop = (tableAreaSize.height - boxHeight) / 2` (matching its
`justifyContent: 'center'` backdrop), and `spaceBelowBox` symmetric to that — then adds
`STACK_OVERLAY_TOP_FRACTION` / `STACK_OVERLAY_BOTTOM_FRACTION` (fractions of `boxHeight`, not the
container) on top. Deliberately unclamped, so on a short/wide container where the box overflows
its space the insets follow it out of bounds rather than snapping back to tracking the container.
The style array `[styles.handStackOverlay, stackOverlayInsets]` keeps the original percentage
values in `styles.handStackOverlay` as a pre-measurement fallback (`stackOverlayInsets` is `null`
until the first `onLayout` fires), then overrides them with the real pixel values once known.

### Bug 3 — stale badge-height constants

Three places still assumed the human's `PlayerBadge` rendered inside `handArea` (and the
equivalent for opponents inside `opponentAreaTop`), even though that nameplate moved into
`TableShell`'s seat anchors as part of Task 4 itself:

- `HAND_CONTENT_HEIGHT` was `HAND_BADGE_HEIGHT + HUMAN_CARD_HEIGHT`; now just `HUMAN_CARD_HEIGHT`,
  since `handArea`'s whole content is the card row.
- `HAND_ROW_PEAK_DISTANCE_FROM_BOTTOM` was `CONTAINER_BOTTOM_PADDING + HAND_AREA_HEIGHT -
  HAND_AREA_TOP_INSET - HAND_BADGE_HEIGHT`; the trailing `- HAND_BADGE_HEIGHT` term is dropped,
  since with the badge gone the row's top edge is the content's top edge already.
- `opponentAreaTop`'s height was `HAND_BADGE_HEIGHT + SMALL_CARD_HEIGHT + 8`; now
  `SMALL_CARD_HEIGHT + 8`.

The now-unused `HAND_BADGE_HEIGHT` import was dropped from the `@world-cards/ui` import list.
Comments at each site were rewritten to explain the nameplate's move rather than describe stale
behavior.

### Cleanup 1 — `tableShellSeats` typed with the real union

`Partial<Record<'top' | 'bottom' | 'left' | 'right', React.ReactNode>>` replaced with
`Partial<Record<TableSeatPosition, React.ReactNode>>`, importing `TableSeatPosition` from
`@world-cards/ui` instead of re-spelling the literal union locally — so it can't drift from
`TableShell`'s own seat-position type.

### Cleanup 2 — stale `PlayerBadge` comment

`capturedStatusText`'s doc comment ("...each game formats its own statusText string, the shared
`PlayerBadge` just lays it out") corrected to name `SeatIdentity`, the component that actually lays
it out now.

### Verification (run by the controller, not re-run here)

- `npx jest apps/mobile/src/games/pisti/PistiTable.test.tsx` — 7/7 passed.
- `npx tsc --noEmit -p apps/mobile` — clean, no errors.
- Visual verification via web build (playwright + local Chrome, 412×915): drove both 4-player and
  2-player modes through several AI plays. In 4-player mode, a screenshot (`p4-ai-flight-0.png`)
  showing an "8♠" card traveling from the right AI seat confirmed the reveal card now paints
  clearly on top of that seat's own face-down stack — the exact bug Fix 1 targets. One caveat: an
  automated `elementFromPoint`-based hit-test in the verification script reported
  `topIsInsideStack: true` at the overlap point, which reads as a contradiction but is a
  methodology false-negative — `revealLayer` has `pointerEvents: 'none'`, so the browser's
  hit-testing skips it regardless of visual paint order and `elementFromPoint` reports whatever is
  beneath it. The screenshot, not the hit-test, is the authoritative check for a paint-order bug.
  In 2-player mode there are no side stacks to overlap, so nothing exercises Fix 1 directly, but no
  errors and correct layout were confirmed (only top+bottom seats used; side plaques render bare,
  as expected).
- `git status` confirmed clean of stray files (only the intended `PistiTable.tsx` diff, plus this
  report).
