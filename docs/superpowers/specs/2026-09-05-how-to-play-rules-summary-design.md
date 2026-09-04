# "How to Play" Rules Summary — Design

**Type:** Specification (WKA v1.0 Artifact). **Status:** Approved 2026-09-05 (brainstorming design phase) — not yet implemented.
**Owning Domain:** Cross-cutting between `ui-visual-system` (the shared modal component) and each of `games/pisti`, `games/batak`, `games/pis-yedili` (their own rules content). No single domain owns the whole feature; each domain owns its own slice per Engineering Principle 2 ("adding a new game touches exactly two folders").
**Traces to:** `docs/governance/engineering-principles.md` Principle 1 (engine has zero React dependency — rules prose cannot live in `packages/engine`) and Principle 2 (a game's own folder owns its own content). Resolves the known-issue filed at `docs/domains/ui-visual-system/known-issues.md#no-in-app-rules-or-onboarding-for-any-game`. Originates from `docs/superpowers/specs/2026-09-04-ux-monetization-research-backlog.md` §1.1.

---

## 1. Problem

Confirmed via `docs/domains/ui-visual-system/known-issues.md#no-in-app-rules-or-onboarding-for-any-game`: no game in this repo (Pişti, Batak, Pis Yedili) has any in-app rules explanation. A player who doesn't already know a game's rules — Batak's bidding/trump/gömmeli variant in particular — has no way to learn them without leaving the app. This violates Nielsen heuristics #10 (help and documentation) and #6 (recognition rather than recall).

## 2. Scope

A **static, text-only rules-summary screen**, one per game, reachable on demand from the Home screen's game list. Explicitly out of scope, per the approved design conversation:

- No guided/interactive first-hand tutorial.
- No automatic first-launch presentation or "seen it" tracking — on-demand only.
- No new engine code, no new game state, no analytics.

All three currently-built games (Pişti, Batak, Pis Yedili) are in scope for one pass, not a single-game pilot — the marginal cost per additional game is one content file, not new component engineering.

## 3. Architecture

### 3.1 Content location

Per Engineering Principle 1, rules prose cannot live in `packages/engine` (zero React/content dependency — engine holds only rules/AI logic as pure data/functions). Per Principle 2, each game's own content stays inside that game's own folder:

- `apps/mobile/src/games/pisti/rules.ts`
- `apps/mobile/src/games/batak/rules.ts`
- `apps/mobile/src/games/pis-yedili/rules.ts`

Each exports a single `GameRules` value:

```ts
export interface GameRulesSection {
  heading: string;
  body: string; // one or more short paragraphs; plain string, no markup
}

export interface GameRules {
  title: string; // e.g. "Pişti Nasıl Oynanır?"
  sections: GameRulesSection[];
}
```

Kept deliberately flat (no markup, no nested lists as data) — the rendering component (§3.2) owns all visual formatting; content files stay pure text so a future non-React consumer (e.g. a future web/desktop shell, per Engineering Principle 1's stated reusability goal) could reuse the same content without pulling in the modal's JSX.

### 3.2 Rendering component

New, fully game-agnostic component: `apps/mobile/src/components/RulesSummaryModal.tsx`.

```ts
export interface RulesSummaryModalProps {
  rules: GameRules;
  visible: boolean;
  onClose: () => void;
}
```

Lives in `apps/mobile`, not `packages/ui` — `packages/ui` today holds only visual, content-free components (`PlayingCard`, `TableFelt`, `SuitIcon`); this component's entire purpose is rendering prose content, which doesn't fit that package's existing boundary. Follows the same modal-shell visual language already established by `DevTuningModalShell`/`BatakSettingsModal` (emerald-felt + gold-rim panel, per `GameMenuRow.tsx`'s own comment referencing that shared pattern) rather than inventing a new modal style. A simple `ScrollView` of section heading/body pairs plus a close affordance — no tabs, no pagination, since content is a short summary by design (§2).

### 3.3 Entry point

`GameMenuRow.tsx` gets one addition: a small "i" (info) affordance rendered inside the row, alongside the existing content, wired to open `RulesSummaryModal` for that row's game — the rest of the row's existing `PressableFeedback` still opens the game as today.

Nested-touch-target risk: the row's entire surface is currently one `PressableFeedback`. Adding a second, smaller touch target inside it needs its own `Pressable`/`PressableFeedback` with adequate `hitSlop`, positioned so it doesn't visually or functionally compete with the row's primary tap area (e.g. a fixed-width icon slot to the right of `textBlock`, not overlapping `MiniCardFan` or the text). The implementation plan should call out on-device/emulator verification of this specifically, since RN's responder system can behave surprisingly with nested pressables.

`HomeScreen.tsx` passes each game's `GameRules` down to its `GameMenuRow` (imported per-game from each game's own `rules.ts`, the same way `apps/mobile/src/games/registry.ts` already wires per-game modules into the shared shell) and owns the open/close state for whichever modal is currently visible (one shared piece of state — which `gameId`'s rules modal is open, or none — rather than one state variable per game).

## 4. Content authorship

No player-facing rules prose exists anywhere in the repo today — existing specs (e.g. `2026-07-07-pisti-rules-and-state-design.md`) describe engine/state design, not prose a player reads. Content will be drafted by Claude, sourced from each game's actual implemented rule engine and its own rules-and-state-design spec (not generic outside knowledge of "how Batak is normally played") — so the text matches this repo's actual implemented variant (e.g. Batak's gömmeli 3-player variant, Pişti's pişti/çift-pişti scoring) rather than a generic version of the game.

**Review checkpoint, not a nice-to-have:** the drafted Turkish text for all three games is reviewed and approved by the user as its own step, before it's wired into the app — rules text is the one part of this feature where a subtly wrong sentence is a real, player-visible correctness bug, not a style nit. The implementation plan must make this an explicit, separate task, not folded silently into a "build the feature" step.

## 5. Testing

Per Engineering Principle 4, no new tests are written proactively for this mobile-UI feature by default. If the nested-touch-target concern (§3.3) turns out to need one to pin down a real regression, that's an explicit ask-first exception at implementation time, not a default.

## 6. Out of scope / explicitly deferred

- First-launch automatic presentation or any "seen" tracking (§2).
- Any interactive/guided tutorial.
- Localization beyond Turkish (matches the app's current all-Turkish UI copy; not revisited here).
- Rules content for not-yet-built games (Klondike, Spider, etc.) — added when each game is built, following the same `rules.ts` pattern, per Engineering Principle 2.
