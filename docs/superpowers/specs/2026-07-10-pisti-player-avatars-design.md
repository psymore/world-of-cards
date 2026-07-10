# Pişti: Per-Seat Avatars (Reference-Checklist Item 6/7)

**Status:** Approved
**Date:** 2026-07-10
**Scope:** The "avatar per seat" item from the Alper Games reference checklist (see `docs/references/pisti/README.md` and the `pisti_table_visual_reference` memory). Last remaining item after this one: per-seat trick layout (biggest lift, done last).

## Context

The reference screenshots show a silhouette icon for AI/opponent seats and a real profile photo for the local human player. This app has no accounts or user photos, so a substitute was needed. Two decisions were made with the user via the brainstorming visual companion (mockups saved under `.superpowers/brainstorm/794-1783669277/content/`, gitignored):

**Avatar glyph style — three options mocked:**
- **A — Generic silhouette** (chosen): a plain person-shaped icon for every seat, literal match to the reference. Human gets a gold ring; AI seats get a plain muted ring — same shape, ring color is the only difference. No per-AI-seat color variation.
- B — Suit-icon monogram (reusing the existing `SuitIcon` component): not chosen.
- C — Initial-letter monogram (Slack/Gmail-style): not chosen.

**Placement — two options mocked, at accurate scale for both a 64dp-wide 4-player side seat and a full-width top/human seat:**
- Stacked (avatar above the existing name/capture-count pill, matching the reference literally): not chosen — doesn't fit the 64dp side-seat width budget without either shrinking to illegibility or growing that footprint, which risks the overflow/crowding concern already flagged for 4-player side seats in `CLAUDE.md`.
- **Inline — avatar merged into the existing pill, before the name text** (chosen): one consistent shape and size everywhere, no new vertical space, no risk to the existing side-seat width.

The gold ring is a **static** "this is you" marker, independent of the existing green active-turn glow on the whole badge (`badgeActive` in `PistiTable.tsx`). The two signals don't compete: gold ring = "you" (always, for the human seat only), green glow = "it's this player's turn right now" (dynamic, any seat). Both can be true at once.

## Component & Rendering

New shared component: `apps/mobile/src/components/PlayerAvatar.tsx`.

- Same convention as `SuitIcon.tsx`: `react-native-svg`-based, `React.memo`'d, small prop surface.
- Props: `accent?: boolean` (default `false`). This is a generic name, not `isHuman` — the component itself has no concept of "the human player"; the caller decides who gets the accent. `accent=true` renders a gold (`#ffd966`) ring + gold-tinted silhouette glyph; the default renders a plain muted ring (`rgba(255,255,255,0.15)`-ish, matching the project's existing muted-chrome tones) + gray glyph.
- Fixed small size (~22dp diameter) — same size in every seat type (top, side, human), no per-seat-type sizing variation, matching the "inline" pick's goal of one consistent shape everywhere.
- Silhouette drawn as simple SVG shapes (a circle for the head + a rounded-top trapezoid/path for the shoulders), in the same "keep it simple at small render size" spirit as `SuitIcon`/`CardBackPattern` — no facial detail, no per-player distinguishing marks beyond the accent ring.

**Integration into `PistiTable.tsx`:**
- `PlayerBadge` (currently a `Text` directly inside a pill `View`) gains a `<PlayerAvatar accent={isHuman} />` rendered before the text, inside the same pill. `PlayerBadge`'s props grow by one: it needs to know whether this seat is the human seat (computed by its caller as `playerId === humanPlayerId`, not derived internally — `PlayerBadge` itself has no concept of "human" any more than `PlayerAvatar` does).
- `styles.badge` changes from a plain padded `Text` container to a row: `flexDirection: 'row'`, `alignItems: 'center'`, a small `gap` between the avatar and the text. The pill's overall height grows slightly to fit the ~22dp circle (previously sized for a text line only) — comfortably inside the existing `opponentArea` (`minHeight: 90`), `opponentAreaSide` (`width: 64`), and `handArea` (`minHeight: 118`) budgets already established for these seats; no dimension changes needed to those container styles.
- Both existing `PlayerBadge` call sites (the opponent seat at `PistiTable.tsx:102` and the human hand area at `PistiTable.tsx:234`, pre-avatar line numbers) pass the new prop.

## Explicitly Not Building This Pass

- No per-AI-seat color/icon variation — all AI opponents render identically (per the chosen option's own description), even in 4-player mode with 3 AI seats.
- No profile photos, avatar picker, or any account/identity system — out of scope, this app has none.
- No variant styling for the deferred "stacked" placement — it's documented above as considered-but-not-chosen, not built as an unused option.
- No new tests. Pure decorative UI, same policy as `TableWoodCorners`/`TableFelt`/`CardBackPattern`. Existing `PistiTable.test.tsx` (query-by-testID/text, not full-tree snapshot per the prior task review's confirmation) should be unaffected, but must still pass unchanged.

## Verification Plan

- Typecheck + full existing mobile test suite pass unchanged.
- Visual verification via the `react-native-web` + Playwright/system-Chrome screenshot workflow (per `dev_sandbox_no_device_access` memory) on both the 2-player and 4-player tables: confirm the human seat's avatar shows a gold ring and the AI seats show identical plain-ring avatars, confirm the pill still fits cleanly in the 64dp 4-player side seats with no text truncation or overflow, confirm the active-turn green glow and the human's gold ring are visually distinguishable when both apply at once (i.e., screenshot a moment when it's the human's turn), and confirm no new console warnings.
