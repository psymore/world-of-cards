# Pişti Table Shell Pilot — Design

**Status:** Approved by user 2026-08-12. Next: `writing-plans` for implementation.

**Builds on:** `docs/superpowers/specs/2026-08-10-table-shell-redesign-design.md` and `docs/superpowers/specs/2026-08-10-seat-identity-design.md` — this is their build order's step 3 ("Pilot in Pişti"), which those specs left unimplemented. It supersedes those specs' §3 asset choice (`FRAME-C-NOFELT-01A.png` + separate felt) with a different asset discovered afterward, and extends scope to include the turn-indicator ring/crossfade work built during Playground iteration (not covered by either prior spec).

## Goal

Replace Pişti's current `TableFelt`/`HandFrame`(background)/`PlayerBadge`/`PlayerAvatar` table chrome with `TableShell` + `SeatIdentity` from `packages/ui`, using `TABLE-ASSEMBLED-TRY-02-GLOW.png` as the table surface. One coherent visual change — table surface and seat/avatar rendering move together, not a partial swap. Batak and Home are untouched, per the prior specs' explicit decision to keep those on the old look until a separate follow-up.

## Current state (for contrast)

- Table surface: `TableFelt` (or `GeminiTableBackground` in `__DEV__`) full-bleed, plus `HandFrame` (wooden arch) behind the human's hand row. No distinct floating table object.
- Seats: a local `OpponentSeat` (`apps/mobile/src/games/pisti/PistiTable.tsx:126-173`) via the shared `OpponentSeatGroup`/`PlayerBadge` (`apps/mobile/src/table/PlayerBadge.tsx`), positioned by `assignSeats`/`pistiSeating.ts`.
- `PlayerBadge` props: `name`, `statusText`, `active` (boolean), `isHuman`, `compact`. Turn highlighting is binary — `active` triggers a green border/glow (`glowShadow('#4ade80', 8)`); there is no "next" concept anywhere.
- `PlayerAvatar` draws one fixed generic silhouette (SVG circle+path), recolored by an `accent` boolean — never varies per player.
- Turn order already exists in engine state (`state.players`, `state.currentPlayerIndex`, round-robin per `packages/engine/src/games/pisti/rules.ts:112`) but `PistiTable.tsx` only ever derives the binary "is this the current player" from it — `(currentPlayerIndex + 1) % players.length` is not computed anywhere today.

## Decisions

### 1. Table asset: `TABLE-ASSEMBLED-TRY-02-GLOW.png`, single merged image

Unlike the prior spec's `FRAME-C-NOFELT-01A.png` (frame only, felt composited separately in code), this asset is a single pre-merged wood-frame + green-felt + ambient-glow image (confirmed: alpha 0 outside the wood ring, alpha ~253 inside — already cleanly cut, no additional hole-punching needed). `TableShell` drops its separate `FELT_IMAGE` layer entirely; the merged image becomes the sole `FRAME_IMAGE`. `TABLE_SHELL_ASPECT_RATIO` updates to this image's 1024×1536. Copied into `packages/ui/assets/table/table-shell-surface.png` as the new default; the old `table-shell-frame.png`/`felt-green-bordered-masked.png` are deleted (nothing else references them).

### 2. Seat anchors: recalibrated to the new frame's plaque bars

`SEAT_ANCHOR_STYLE` in `TableShell.tsx` is recalibrated to this frame's own baked plaque-bar positions — reusing the percentages already worked out against this exact frame geometry in the Playground's v1 tab (`apps/playground/src/components/TableShellPreview.tsx`'s `V1_SEAT_ANCHOR_STYLE`), not re-derived from scratch.

### 3. `SeatIdentity`: `trickCount: number` → `statusText: string`

Pişti calls these "captured cards" (`🂠 N`, `apps/mobile/src/games/pisti/PistiTable.tsx:110-112`), not "tricks" — `SeatIdentity` currently hardcodes the English word "tricks" (`{trickCount} tricks`). `PlayerBadge` already solved this correctly (each game formats its own status string; the shared component just lays it out) — `SeatIdentity` adopts the same pattern: a `statusText: string` prop, caller-formatted, rendered verbatim. This is a breaking prop change to `SeatIdentity`, made freely since nothing shipped depends on it yet. `SeatIdentity.test.tsx` updates accordingly (its trick-count-specific assertions become status-string assertions).

### 4. `SeatIdentity`: real turn-state ring art via explicit `turnStateFrames`

The idle/glow/apeak-glow ring set (`AVATAR-FRAME-MEDIUM-IDLE-03-Photoroom.png`, `AVATAR-FRAME-MEDIUM-GLOW-02.png`, `AVATAR-FRAME-MEDIUM-APEAK-GLOW-01-Photoroom.png`) moves from `apps/playground/assets/table-shell-versions/` into `packages/ui/assets/table/` as `avatar-frame-idle.png`, `avatar-frame-next.png`, `avatar-frame-active.png` (named for the state they represent, matching `SeatIdentityTurnState`'s own values, not the source filenames) and becomes Pişti's real `turnStateFrames` prop value (passed explicitly from Pişti's call sites), using the existing cross-fade `Animated.timing` behavior already built into `SeatIdentity` unchanged. `SeatIdentity`'s own bare default (no `turnStateFrames` supplied) stays the plain `glowShadow` placeholder — not replaced globally — since only Pişti is adopting this ring art now.

### 5. Turn state is computed from real engine state, not seat geometry

`PistiTable.tsx` already has `state.players` and `state.currentPlayerIndex` in scope at both `OpponentSeat` and the human seat's call site. Turn state per rendered seat:
- `active`: `state.players[state.currentPlayerIndex] === playerId` (unchanged from today's `isCurrentTurn`).
- `next`: `state.players[(state.currentPlayerIndex + 1) % state.players.length] === playerId`.
- `idle`: neither of the above.

This replaces the Playground prototype's clockwise-seat-order approximation with the real round-robin turn order already driving gameplay — no geometric guessing needed in the real game.

### 6. Avatar assignment: fixed by seat position

Each of the four rendered seats gets a fixed avatar from the existing 6-image set, assigned by seat position rather than derived from player identity — the simplest deterministic scheme, trivial to change later if per-player-identity avatars become desirable: `top` → `female-01`, `left` → `male-01`, `right` → `male-02`, human (`bottom`) → `female-02`. Pişti's 2-player mode only ever renders `top`/`bottom` (per Decision 2's inherited seat-count handling), so `left`/`right`'s assignments only matter in 4-player mode.

### 7. `PlayerBadge`/`PlayerAvatar` are not deleted

Batak still uses both. They become unused by Pişti specifically, not dead code repo-wide.

## Explicitly out of scope

- Batak, Home, `TableEdgeRails`, gömmeli's 3-seat layout — untouched, per the prior specs' decision.
- The 2.5D tilt (`TableShell`'s `tilt` prop already exists and works; Pişti's pilot does not need to turn it on as part of this spec — it's an independent, separately-toggleable enhancement, not blocking).
- Per-player-identity avatar assignment (Decision 6 picks the simplest scheme; a richer mapping is future work if wanted).

Note: unlike `FRAME-C-NOFELT-01A.png` (the prior spec's asset), `TABLE-ASSEMBLED-TRY-02-GLOW.png` has no baked-in gear/hamburger menu icons — just plain corner rivets and decorative clover emblems — so there's no equivalent "wire the baked icons to real actions" item to carry over from that spec.

## Testing / verification

- `SeatIdentity.test.tsx`: update for the `statusText` rename.
- `PistiTable.test.tsx`: add coverage asserting the correct seat receives `active`/`next`/`idle` given a known `state.currentPlayerIndex`, using real engine state (not prop-level mocking of a geometric approximation).
- Visual: react-native-web + Playwright/local Chrome screenshots of Pişti's real table in both 2-player (top+bottom only) and 4-player (all 4 seats) modes, confirming the crossfade and seat-anchor fit hold up with live game data, not just the Playground's static sample data.
