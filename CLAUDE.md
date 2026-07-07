@AGENTS.md

# World Cards

A cross-platform mobile platform for traditional card games (Expo/React Native/TypeScript), designed to scale to 100+ games over years. See the full product vision and constraints in the system-level project brief (also summarized in the design spec below).

## Architecture

Full architecture decisions live in:
- `docs/superpowers/specs/2026-07-06-core-architecture-design.md` — the approved design (repo structure, Card/Rule/AI engine contracts, state management, persistence, testing strategy, risks)
- `docs/superpowers/plans/2026-07-06-core-architecture.md` — the 17-task implementation plan that built it

**Repo structure:**
- `packages/engine` — pure TypeScript, zero React/React Native/Expo dependency. Card Engine, `RuleEngine`/`AIStrategy` contracts, game registry, persistence interface, statistics, and a reusable `simulateGames` test harness. Every game's rules/AI live here as pure functions over immutable, JSON-serializable state.
- `apps/mobile` — the Expo app. All RN/Expo/Reanimated/Zustand/React Navigation code lives here. Consumes `packages/engine` via an npm workspace link (`@world-cards/engine`).

**Key conventions established in Phase 1** (see the spec for full rationale):
- Engine is a pure functional core: no classes, no internal mutable state, no `Math.random()` (use the seeded `RNG` from `packages/engine/src/core/rng.ts`).
- Adding a new game = two new folders only: `packages/engine/src/games/<id>/` (rules + AI) and `apps/mobile/src/games/<id>/` (screen), registered via `registerGame`. No shared/shell code should need editing.
- Zustand: one small global store (settings) + one short-lived per-game-session store (via `createGameSessionStore`) — never one mega-store.
- Testing: Jest multi-project (`packages/engine` on Node, `apps/mobile` on jest-expo + RNTL). Every game should get simulation tests via `@world-cards/engine/testing`'s `simulateGames`, asserting card-conservation invariants over hundreds of simulated games.

## Status

**Phase 1 (core architecture): complete**, merged to `master`. Validated end-to-end against an internal test-only fixture game (`cardDraftGame`, in `packages/engine/src/rules/__fixtures__/`) — not a real game, just proof the shared contracts work. No real game exists yet.

**Phase 2 (Pişti): rules + state model + RuleEngine + AI + registration all complete**, merged to `master`. Only the mobile UI/screen remains. Per the project roadmap, games are built in this order: Pişti → Klondike Solitaire → Spider Solitaire → FreeCell → Hearts → Spades → Gin Rummy → Crazy Eights → Blackjack → Texas Hold'em. Each game follows: research rules → rules doc → game state design → rule engine → UI → Easy/Medium/Hard AI → tests → simulate hundreds of games → done, then move to the next game. (Pişti deliberately did AI before UI so `simulateGames`-based testing and `registerGame` — which requires `aiStrategies` — were unlocked earlier; see the AI-strategies spec below for the rationale.)

Pişti design/plan docs so far:
- `docs/superpowers/specs/2026-07-07-pisti-rules-and-state-design.md` — rules doc + `GameState`/`Move` data model
- `docs/superpowers/plans/2026-07-07-pisti-state-model.md` — implemented the `moveAllCards` core primitive + `PistiState`/`PistiMove`/`PistiSetupOptions` types
- `docs/superpowers/specs/2026-07-07-pisti-rule-engine-design.md` — `RuleEngine` file structure, `validateMove` semantics, test-coverage plan
- `docs/superpowers/plans/2026-07-07-pisti-rule-engine.md` — implemented `pistiGame: RuleEngine<PistiState, PistiMove>` in `packages/engine/src/games/pisti/rules.ts`
- `docs/superpowers/specs/2026-07-07-pisti-ai-strategies-design.md` — Easy/Medium/Hard AI approach, registration, `simulateGames` testing plan
- `docs/superpowers/plans/2026-07-07-pisti-ai-strategies.md` — implemented `pistiEasyAI`/`pistiMediumAI`/`pistiHardAI` (`packages/engine/src/games/pisti/ai/`), registered `pistiDescriptor` (new `'fishing'` `GameCategory`) via `packages/engine/src/games/pisti/index.ts`

Pişti is now registered: `getGame('pisti')` returns a full `GameDescriptor` with all three AI difficulties. `simulateGames`-based tests pass (500 easy-vs-easy games with no card-conservation violations; Hard beat Easy 154/200).

Pişti UI design/plan docs:
- `docs/superpowers/specs/2026-07-07-pisti-ui-design.md` — navigation, screen/component breakdown, state flow, testing plan
- `docs/superpowers/plans/2026-07-07-pisti-ui.md` — implemented the full playable slice: `apps/mobile/src/components/{PlayingCard,GameScreenLayout,GameResultModal}.tsx` (shared, reusable by future games), `apps/mobile/src/games/pisti/{PistiSetupView,PistiTable,PistiScreen,useAITurn}.tsx`, `apps/mobile/src/games/registry.ts`, and a new `@world-cards/engine/games/pisti` subpath export

Pişti is now fully playable end-to-end: Home → pick a difficulty → play a full hand against Easy/Medium/Hard AI → see the result → play again or return home. `useAITurn` uses `InteractionManager.runAfterInteractions` + a thinking delay as planned, but **frame timing has still not been profiled on a real mid-range Android device** — this remains the standing Phase 1 performance risk and should happen before Hard AI is trusted in more complex future games.

Deliberately deferred from this UI sub-project (see the design doc for rationale): Reanimated/animated transitions, save/resume via `PersistenceAdapter`, `stats:<gameId>` recording, multi-hand match play, the 4-player/2v2 variant, human-vs-human pass-and-play, and lifting `useAITurn` into a shared cross-game hook (revisit once Hearts is built). `GameResultModal`'s tests also have a known, deferred `act()` warning from the Modal's fade animation — not fixed in this pass; the correct fix if revisited is `animationType="none"` instead of `"fade"`.

**Next up:** manually smoke-test the Pişti screen in Expo Go / a simulator (`npm run mobile`), then profile Hard AI's frame timing on a real device. After that, Klondike Solitaire is next in the game build order.

Known follow-up items deferred from Phase 1 (non-blocking, noted in the final whole-branch review):
- `RuleEngine.setup(options: unknown, ...)` loses type safety across the options-passing chain — consider a `TOptions` generic once real games multiply.
- `GameState.rngState` exists for reproducible resume but still isn't exercised by mid-game randomness: Pişti's `setup` pre-shuffles the whole deck up front, and its mid-hand redeals just deal from the already-ordered `stock` zone, consuming no further RNG. This remains open for a future game whose mid-game randomness is genuinely re-rolled (e.g. a game that reshuffles a discard pile back into a live deck).
