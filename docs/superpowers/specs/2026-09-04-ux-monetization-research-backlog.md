# UX & Monetization Research — Backlog Plan

**Type:** Research-grounded backlog plan (not a WKA design Specification — no architecture or code contract is being proposed here). **Status:** Decided 2026-09-05 on all four §2 items — see §0. Superseded as the source of truth for §2.1's text by `docs/governance/monetization-principles.md`, which now holds the accepted version.

## 0. Decisions (2026-09-05)

- **§2.1 Monetization principles — accepted as drafted, no edits.** Moved verbatim into `docs/governance/monetization-principles.md`.
- **§1.1 Onboarding known-issue — proceeding to a plan now**, via `superpowers:brainstorming` → `superpowers:writing-plans`, rather than staying parked.
- **§2.2 Analytics SDK — deferred, no SDK adopted.** Explicit decision, not a default: stay local-stats-only until there's a real audience to measure. Revisit by re-reading this section, not by re-deriving it.
- **§2.3 Octalysis-lite idea — accepted onto the backlog.** Added as `docs/status/roadmap.md` item 12 ("Next up" list), unscoped and unscheduled.
- **§2.4 GDC talk bookmarks — no action taken**, left as a passive bookmark per the original text.
**Owning Domain:** Cross-cutting — touches `ui-visual-system` (onboarding), a not-yet-existing `monetization`/`analytics` concern, and general product direction. Not assigned to a single domain.
**Origin:** 2026-09-04 conversation — the user asked for free/credible mobile card-game UX and monetization research, it was compiled into two artifacts (below), then the user asked for whichever parts of an integration plan could be done solo while they were away from the keyboard, with the explicit instruction to *plan* the parts that are really theirs to decide rather than deciding them unilaterally.
**Companion artifacts (published, not part of this repo):**
- [Kart Kataloğu](https://claude.ai/code/artifact/7364c818-20d8-4ae5-b98f-50e6614943cd) — the underlying research catalog (books, papers, industry blogs, KPI benchmarks) this plan draws on. Citations below use its call numbers (e.g. `AK-01`, `BE-03`, `KPI-02`).
- [Tasarım Panosu](https://claude.ai/code/artifact/fecc782c-fda9-421d-be95-806fc3cea00e) — index of this project's own past design artifacts, referenced in §2 below.

---

## 1. Done this pass — findings, not decisions

Two items below required only reading code/docs already in the repo, not a product judgment call, so they're written up as confirmed findings rather than left as open questions.

### 1.1 Onboarding/FTUE heuristic audit

Filed as a real known-issue, not just noted here: **[No in-app rules or onboarding for any game](../../domains/ui-visual-system/known-issues.md#no-in-app-rules-or-onboarding-for-any-game)**.

Method: applied Nielsen's 10 usability heuristics (per Kart Kataloğu `UX-05`, NNG's own note that they transfer to game UX) to the app's actual entry flow, not a generic checklist pass — grounded in `apps/mobile/src/screens/HomeScreen.tsx` and a repo-wide grep for any onboarding/tutorial code (`apps/mobile/src` — zero matches).

- **Heuristic #10 (Help and documentation) — violated.** No game has any in-app rules explanation at any layer.
- **Heuristic #6 (Recognition rather than recall) — violated, same root cause.** `HomeScreen` → `GameMenuRow` → `onSelectGame` is the entire chain; nothing between "pick a game" and "play it."
- **Heuristic #4 (Consistency and standards) — already tracked, not re-filed here.** The settings-icon asymmetry (`docs/domains/ui-visual-system/known-issues.md#settings-icon-asymmetry`) is the same category of problem, already owned.
- **Heuristic #1 (Visibility of system status) — not audited.** Would need an actual pass through live gameplay screens (browser or device), which is exactly the kind of "together" verification this plan is deferring — see `docs/governance/guardrails.md` rule 3 on screenshot verification and this repo's general practice of confirming UI work in a running app before calling it checked.

No fix is proposed or scheduled — the known-issues entry names the cheapest plausible shape (a static per-game rules screen) as a starting point for discussion, not a decision.

### 1.2 Competitive-pattern tie-ins (no new item — links research to existing backlog)

- Hearthstone's board being sized so its 7-minion cap fits exactly one screen row (Kart Kataloğu `KRT-01`) is the same class of problem as `docs/status/roadmap.md`'s already-open item 11 ("Porting the Demo 01 fan-arc-smoothness fix... Pişti/Batak share the identical underlying bug") and the reflow exploration already sitting in [Tasarım Panosu](https://claude.ai/code/artifact/fecc782c-fda9-421d-be95-806fc3cea00e#ortak) (*Reflow Options — Demo 6*, *Rail-Constrained Reflow — Demo 6*): designing a hand's layout to a fixed constraint, rather than asking reflow logic to smooth over an unconstrained one, has external precedent. Worth citing when that item is picked back up — not a new action today.
- GDKeys' card-UI layout method (Kart Kataloğu `KRT-02`) is the right lens for roadmap.md item 10 ("Batak's visual polish against the Alper Games reference checklist") when that's next in queue.

---

## 2. Open decisions — needs your call, drafted so it's ready to accept or edit

Nothing in this section has been written into `docs/governance/`, `docs/status/roadmap.md`, or any `decisions.md` — those all carry either explicit ownership ("Owner: Project owner") or the repo's stated convention that rules get established by direct agreement, not unilaterally. Everything here is a ready-to-copy draft.

### 2.1 Monetization principles (draft for `docs/governance/monetization-principles.md`)

Grounded in Kart Kataloğu `AK-01` (King, Delfabbro et al., *Addiction* 2018 — loot-box/gambling structural similarity), `AK-03` (PMC review of F2P spending motives), `BE-03` (Luton's "4 C's of IAP"), and `KPI-02` (Tenjin 2025 — rewarded video positively received by 87% of players, vs. forced interstitials).

> 1. **No randomized-outcome paid mechanics** (loot boxes, gacha, card packs with hidden contents) in any game in this repo. Reasoning: King et al. (2018) found these mechanics structurally resemble gambling; every game here already has a fixed, fully-known deck, so a randomized-pack mechanic would introduce a new category of risk rather than extend an existing pattern.
> 2. **No pay-to-win.** AI difficulty, rule variants, and gameplay depth stay free. If monetization ever exists, it's confined to Luton's Content/Convenience/Customization categories (cosmetics, ad removal) — never Competitive Advantage.
> 3. **If ads are ever added: rewarded-only, opt-in.** No forced interstitials. Per Tenjin's benchmark, rewarded video is the one format most players view positively.
> 4. **This document schedules nothing.** It's a constraint on *how* monetization would work if it's ever built, not a decision to build it — no monetization work is implied on `docs/status/roadmap.md` by this doc's existence.

**Your call:** accept as-is, edit, or reject. If accepted, this block moves verbatim into `docs/governance/monetization-principles.md`.

### 2.2 Retention KPIs & analytics — decision needed before either is meaningful

Current state, confirmed by reading `packages/engine/src/statistics/types.ts`: stats are a **local running aggregate only** (`gamesPlayed`, `wins`, `losses`, `highScore`) — no event stream, no session data, no analytics SDK anywhere in the repo. Any retention *target* is meaningless until an SDK exists to measure it.

**Decision needed:** which analytics approach, if any — options, not a recommendation:
- **None for now** — stay local-stats-only until there's a real distribution/audience to measure.
- **Firebase Analytics** — free, standard Expo integration, but sends data to Google.
- **GameAnalytics** — free tier, game-specific KPIs (retention curves, funnels) out of the box, per Kart Kataloğu `KPI-01`'s Unity/GameAnalytics benchmarks.
- **PostHog** (self-hostable) — more setup, full data ownership.

**If/when an SDK is chosen**, proposed starting point (not a commitment):
- Baseline targets from Kart Kataloğu `KPI-01`: D1 retention ≥30% = published "excellent" tier for casual mobile games — a comparison point once real data exists, not a target to hit blind.
- Minimal event taxonomy, additive to the existing `GameStats` shape, not replacing it: `session_start`, `session_end`, `game_selected {gameId}`, `game_started {gameId, mode, playerCount}`, `game_completed {gameId, won, score, durationMs}`, `game_abandoned {gameId, phase}`. Deliberately small — expand only after the SDK decision, not before.

### 2.3 Octalysis-lite core-drive audit (Kart Kataloğu `BE-01`, free-blog version — not the paid book)

Mapped against the 8 Octalysis core drives using only the game mechanics already described in `docs/status/roadmap.md`'s build-status section:

- **Present:** Development & Accomplishment (win/loss stats, AI difficulty ladder Easy/Medium/Hard). Ownership & Possession (per-game local `highScore`/stats).
- **Thin or absent:** Social Influence & Relatedness (no friends, leaderboard, or sharing surface found anywhere). Unpredictability & Curiosity — **deliberately** thin, and should stay that way per §2.1's draft principle 1; this is not a gap to close.
- **One low-cost, unscheduled idea:** a local "best score this week" or "longest win streak" stat, extending the existing `GameStats` shape, would add Accomplishment without any networked/social surface. Flagged as a backlog candidate only — not urged, not sized.

### 2.4 Free GDC talks — bookmark, not a decision

Two talks from Kart Kataloğu (`END-02`, `END-03`) worth a watch when there's time: *"It's About Time: System Design for Mobile Free-to-Play"* and *"Mobile Game Launch Best Practices."* Both are GDC Vault links (paid access) — GDC's official YouTube channel often mirrors same-era talks for free with a delay, worth checking there first before assuming a Vault subscription is needed.

---

## 3. Suggested order, when you're back

1. §2.1 (monetization principles) first — it's pure text, lowest cost to decide, and everything else in this doc is written to already respect it.
2. The known-issues finding in §1.1 — decide whether a rules screen is worth spec'ing now or stays parked.
3. §2.2's SDK choice — the one item here with real integration cost, worth its own discussion rather than a quick yes/no.
4. §2.3 and §2.4 — low-stakes, can be decided in passing.

Per `docs/governance/guardrails.md` rule 1: once you're ready to keep this doc, it's worth committing early rather than leaving it untracked — nothing here has been committed yet.
