# UI Visual System — Decisions

**Owner:** whoever maintains `packages/ui` and cross-game UI. **Load:** when asking "why is this shared UI built this way." **Not** a development diary — see `architecture/phase-2-knowledge-architecture-design.md` §6.1. Implementation history lives in `docs/superpowers/specs/`, `docs/superpowers/plans/`, and git history instead.

**Why this file exists despite Phase 2's tree not listing it:** Phase 2's illustrative knowledge tree (`architecture/phase-2-knowledge-architecture-design.md` §1) named only `overview.md`/`known-issues.md` for `ui-visual-system`. This file was added during the Phase 3A Safety Checkpoint walk because real, genuinely architectural decisions exist for cross-game UI (the HomeScreen redesign below) with no other domain able to own them — `games/pisti`/`games/batak` are the wrong owner (HomeScreen isn't game-specific), and `overview.md` explicitly may not hold decision-reasoning. Per §10's checkpoint rule 3, a knowledge block with no clean destination is a signal the tree missed a category, and the correct fix is to add the destination, not drop the content. **Reviewed and confirmed during the Phase 3A audit remediation pass:** this is treated as a deliberate, necessary extension of the existing `decisions.md` pattern (already used for other domains) to a domain Phase 2 didn't pre-populate one for — not a new architectural concept, and not something requiring a new document *type* to be invented.

---

## HomeScreen redesign: its own distinct visual identity, not a reuse of the table look

**Decision:** the HomeScreen (navy-to-plum gradient, hero illustrated court card, gold serif wordmark, per-game menu rows) was built as its own deliberate identity, explicitly not a reuse of the felt/wood table look used in-game.

**Why:** confirmed with the user rather than assumed. Per-game menu rows (subtitle, accent color, suit-tinted card-fan preview) are derived entirely from existing `GameDescriptor` fields (`category`, `minPlayers`/`maxPlayers`) via pure functions — zero `packages/engine` changes needed, keeping the redesign additive rather than requiring new engine-level metadata.

## Illustrated hero art was sourced narrowly, not as the full court-card-art initiative

**Decision:** the hero Queen of Hearts illustration was sourced from `htdebeer/SVG-cards` (LGPL-2.1, attributed in `apps/mobile/assets/CARD_ART_ATTRIBUTION.md`) as a small, deliberately-scoped-down step — not the full illustrated-court-card-art system still tracked as an open roadmap item (`docs/status/roadmap.md`).

**Why:** one hero image for one screen is a bounded, low-risk art-sourcing decision; a full illustrated deck is a bigger, separate investment that shouldn't be smuggled in as a side effect of a HomeScreen pass.

## Two deliberate divergences from the `expo` skill's default guidance

**Decision:** kept `react-native-svg`'s `LinearGradient` instead of the `expo` skill's recommended `experimental_backgroundImage`, and kept the existing shared `glowShadow` helper instead of switching to CSS `boxShadow`.

**Why:** `experimental_backgroundImage` doesn't work in Expo Go per its own docs, and this app has no `expo-dev-client`; switching the shadow vocabulary for one screen would have meant maintaining two shadow systems instead of one. Did adopt the skill's `expo-image` recommendation for the hero card, since nothing in the app used core RN `Image` yet — a clean win, not a blanket rejection of the skill's guidance.

## Entrance animation used the full Constitution audit process, not a self-selected shortcut

**Decision:** the staggered mount-entrance animation went through `docs/animation/`'s full `AuditTemplate.md`, not the lighter `QuickAuditTemplate.md`.

**Why:** per the standing guardrail (`docs/governance/guardrails.md` §5), the user was asked explicitly rather than letting the implementer self-select — chosen because this introduces a new animation mechanism, not a tuning pass on an already-shipped one. Engine choice was plain `Animated`, per `docs/animation/ADR/ADR-003-scope-reanimated-migration-to-evidenced-need.md` (no evidenced reflow/gesture need on this screen).
