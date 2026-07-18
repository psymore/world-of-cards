# Human hand real-position card-travel — design

## Context

Both games' played-card travel animation (Pişti's `RevealCard`, Batak's `TravelCard` usage — see
`docs/superpowers/specs/2026-07-18-shared-card-travel-animation-design.md` for the shared
`TravelCard` component) always animates from a fixed, direction-based offset
(`revealOriginOffset(resolveRevealOrigin(...))`, `apps/mobile/src/table/seating.ts` /
`apps/mobile/src/games/pisti/pistiSeating.ts`) — `bottom: {x:0, y:195}` for the human seat,
regardless of where in the fanned hand the played card actually sat.

This is a reasonable approximation for opponents: Batak's opponent seats render no
individually-positioned cards at all (removed in the 2026-07-18 turn-indicator simplification),
and Pişti's opponent hands are a shared fan/stack, not a single tappable card. But the human's own
hand in both games is a row of individually-rendered, individually-tappable `SelectableCard`s
(`apps/mobile/src/components/SelectableCard.tsx`) spread across most of the screen width — the
played card's real position varies a lot by hand size and which card was tapped, so the fixed
offset looks visibly wrong (a card near the left edge visually snaps to travel straight up from
center).

## Scope

Human hand only, both Pişti and Batak. Opponent plays are untouched — they keep the existing fixed
per-seat offset in both games, unconditionally.

## Approach

Measure both ends live, cached where possible:

- **Destination**, measured once (recomputed on every `onLayout`, so it never goes stale across
  resize/rotation): a ref on the container that visually represents "where a played card lands"
  (Pişti's `pileMat`; Batak's `'bottom'`-position trick slot). Inside that container's existing
  `onLayout` handler, call `ref.current.measureInWindow((x, y, w, h) => ...)` and cache the window
  center point (`{x: x + w/2, y: y + h/2}`) in state.
- **Origin**, measured live at the moment of the confirming tap: each human hand-row card's
  wrapper `View` gets a ref, stored in a `Map<cardId, View>` the table component owns. The
  `useCardSelection` confirm callback (`apps/mobile/src/components/useCardSelection.ts` — fires on
  the second tap of an already-selected card) is wrapped so that, instead of calling the "play"
  callback directly, it looks up that card's ref, calls `measureInWindow` on it, and computes
  `origin = cardCenter - destCenter` before calling through with that offset.

This is neither pure analytical computation (rejected: the trick/pile destination sits in a
variable-height flex region, so its true screen position can't be reliably derived from layout
constants alone) nor double live measurement of both ends on every frame (rejected: unnecessary —
the destination is static once laid out, so it only needs remeasuring on actual layout changes,
not on every play).

**Fallback**: if either measurement isn't available (ref missing, destination not yet measured —
shouldn't normally happen, since layout mounts before any tap is possible, but is a real
degenerate case worth handling defensively rather than crashing or animating from `{0,0}`), the
origin stays `undefined` and the existing fixed `'bottom'` offset is used exactly as today. AI
plays are entirely unaffected by any of this — they never carry a measured origin.

**Known timing nuance**: `measureInWindow` is callback-based, not synchronous, so the actual
reveal/pending-play state update (and therefore the travel animation's start) fires a frame or so
after the tap instead of the same tick. This is expected to be imperceptible given the existing
~300-550ms travel durations, but is a real, deliberate behavior change from today's fully
synchronous path — noted here rather than discovered as a surprise later.

## Pişti wiring (`apps/mobile/src/games/pisti/PistiTable.tsx`, `PistiScreen.tsx`)

- `PistiTableProps.onPlayCard`: `(cardId: string) => void` → `(cardId: string, originOffset?: {x: number, y: number}) => void`.
- `RevealedMove` (in `PistiScreen.tsx`) gains an optional `originOffset?: {x: number, y: number}`
  field, threaded through `revealThenCommit` → `setRevealedMove`. `revealThenCommit` itself is
  shared by AI and human plays today; the human path (`handlePlayCard`) is the only one that ever
  supplies an `originOffset` — AI's call into `revealThenCommit` continues to omit it.
- `RevealCard`'s render picks `revealCard.originOffset ?? revealOriginOffset(originDirection)`
  instead of always computing from direction.
- New `handCardRefs` map (keyed by card id) and a `destRef` (attached to `pileMat`) live in
  `PistiTable`, alongside its existing `useCardSelection` call — the wrapping callback passed to
  `useCardSelection` performs the measurement described above before calling `onPlayCard`.

## Batak wiring (`apps/mobile/src/games/batak/BatakTable.tsx`, `BatakScreen.tsx`)

- New dedicated prop, `onPlayCard: (cardId: string, originOffset?: {x: number, y: number}) => void`,
  separate from the existing generic `onMove: (move: BatakMove) => void` (which also carries
  `bid`/`pass`/`selectTrump` moves that never have an origin) — kept separate rather than adding an
  awkward optional second parameter to a prop used for four different move shapes.
- `BatakTable`'s `useCardSelection` call becomes
  `useCardSelection(cardId => { const origin = measureOrigin(cardId); onPlayCard(cardId, origin); })`.
- `PendingBatakPlay` gains `originOffset?: {x: number, y: number}`, set in `BatakScreen.tsx`'s
  `commitMove` (only for the human's own play — AI plays via `useAITurn`'s `onMove` continue to omit it).
- `slotFor`'s `TravelCard` picks `pendingPlay.originOffset ?? revealOriginOffset(...)` the same way.
- New `handCardRefs` map and `destRef` (attached to the `'bottom'`-position trick slot) live in
  `BatakTable`.

Both games end up with the identical shape (measured-origin-with-fixed-fallback), but this pass
does not extract a shared hook/helper for it — each game's ref/measurement wiring is only a few
lines glued to that game's own hand-row and destination JSX, and a shared abstraction across two
call sites this small would cost more than it saves. Worth reconsidering only if a third game
needs the same thing later.

## Testing

No new automated tests — decorative/interaction-timing UI, matching the standing 2026-07-07
mobile-UI testing policy (the existing reveal/travel animations in both games have none either).
Existing suite re-run for regression after the change.

## Visual verification

Per the user's 2026-07-17 direction, no unsolicited screenshot/browser verification pass — only
if explicitly requested for this work.

## Out of scope / deferred

- Opponent plays in either game: unchanged, always the fixed per-seat offset.
- Extracting a shared measurement hook across Pişti/Batak (see rationale above).
- Native on-device verification — same standing gap as every prior UI pass in this project.
