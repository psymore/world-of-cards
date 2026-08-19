# Animation Playground — Design

## Source documents

This spec operationalizes two documents the user placed directly in `apps/playground/`, which remain the authoritative source of truth for animation *philosophy* and *working methodology* throughout implementation:

- `apps/playground/ANIMATION_ARCHITECTURE.md` — the animation architecture itself: golden rules (single progress value drives every property, never chain independent animations), the Demo 01–06 breakdown, motion/rotation/translation/scale/z-index rules, and the final objective (Batak consumes this engine, never redesigns it).
- `apps/playground/CLAUDE_ANIMATION_RULES.md` — working methodology: one animation problem at a time, demo-first (never touch Batak until validated here), preserve working code, incremental iteration, a per-demo validation checklist (motion/continuity/scaling/landing/rotation/performance) before moving to the next demo.

This spec does not restate those rules; it decides the concrete architecture and file layout needed to build toward them.

## Goal

Build a new, self-contained "Animation Playground" mode inside the existing `apps/playground` app: an isolated lab for perfecting card-travel animation quality (fan layout → selection → travel → landing → scale transform → the full repeating sequence), producing a reusable motion primitive that Batak (`apps/mobile`) can later consume without redesign. Game rules, AI, scoring, bidding, and trump are explicitly out of scope — only animation quality matters.

## Non-goals

- Not building real Batak rules, bidding, trump selection, or trick-winner logic.
- Not touching `apps/mobile` in this sub-project — this is Playground-only. Per `CLAUDE_ANIMATION_RULES.md`'s "Demo First" rule, porting into Batak only happens after the Playground animations are validated, as a later, separate sub-project.
- Not adopting `react-native-reanimated`. Confirmed with the user: every existing card animation in this repo (Pişti, Batak) already runs on React Native's built-in `Animated` API with `useNativeDriver: true`, which already executes on the UI thread. Introducing Reanimated would mean either a second animation system living alongside `Animated` indefinitely, or a separate future decision to adopt it repo-wide (including `apps/mobile`) just to keep this engine portable. Staying on `Animated` keeps the eventual Batak port a drop-in.
- Not adding a navigation library to `apps/playground` — the existing app has none (`apps/mobile` uses `@react-navigation`, but `apps/playground` has always been a single screen).
- No automated tests, per this repo's standing 2026-07-07 testing policy for mobile/decorative UI work — this whole exercise is judged by eye (the per-demo validation checklist in `CLAUDE_ANIMATION_RULES.md`), not by assertions.

## Entry point

`apps/playground/App.tsx` gains a small local-state mode toggle (two buttons, e.g. "Design" / "Animation") rendered above whichever screen is active:
- `PlaygroundScreen` (existing, untouched) — the current Card/Table design tool (`CardGallery`, `TableTemplateEditor`, `CardTemplateEditor`).
- `AnimationPlaygroundScreen` (new) — the animation lab described below.

No new dependency, no route persistence — a plain `useState<'design' | 'animation'>`.

## Module layout

New, fully self-contained folder — it does not import `@world-of-cards/ui`'s `PlayingCard`/`SuitIcon` or anything from `apps/mobile`. It does import `@world-of-cards/engine`'s root exports (`createDeck`, `shuffle`, `createRng`, `Card`, `Suit`, `Rank`) since `apps/playground` already depends on the engine package and reusing its deck/shuffle/RNG utilities avoids reinventing a shuffle algorithm.

```
apps/playground/src/animation/
  AnimationPlaygroundScreen.tsx   — demo switcher (6 buttons) + renders the active demo
  engine/
    useCardMotion.ts              — the core reusable primitive (see below)
  components/
    SimpleCard.tsx                — single fixed size, rank text + suit glyph, no images
    Hand.tsx                      — configurable fan layout (Demo 01's deliverable)
  demos/
    Demo01FanLayout.tsx
    Demo02Selection.tsx
    Demo03PlayTravel.tsx
    Demo04Landing.tsx
    Demo05Transform.tsx
    Demo06CompleteSequence.tsx
  state/
    useDealLoop.ts                — Demo 06's turn/deal reducer (see below)
  types.ts                        — CardMotionKeyframe, Seat, etc.
```

## Core motion engine: `useCardMotion`

The actual deliverable of this whole sub-project — everything else exists to exercise and validate it.

```ts
interface CardMotionKeyframe {
  x: number;
  y: number;
  rotateDeg: number;
  scale: number;
}

interface CardMotionOptions {
  from: CardMotionKeyframe;
  to: CardMotionKeyframe;
  durationMs: number;
  easing: (t: number) => number;
}
```

`useCardMotion(options)` drives exactly **one** `Animated.Value` (0→1) via a single `Animated.timing` call. Every visual output is an `.interpolate()` off that same value:

- `translateX`, `translateY`, `rotate`, `scale` — continuously interpolated, native-driver-compatible (`useNativeDriver: true`).
- `zIndex` — **not** continuously interpolated (RN's native driver can't animate it, and it's an integer, not a continuous property anyway). Instead it's a discrete step tied to the same progress value: as soon as progress leaves `0`, the card's `zIndex` jumps to "above every hand card" per the doc's Z-Index Rule, then to its final trick-order value once progress reaches `1`. This is a documented, deliberate exception to "every property interpolates" — z-index has no meaningful midpoint.
- Shadow/elevation — same treatment: RN's `elevation` (Android) isn't native-driver-animatable, and `shadowOpacity` (iOS) is technically animatable but not worth JS-thread-driving for a subtle depth cue. These change as a step at the same progress threshold as `zIndex`, matching the precedent already set in this repo's shared `glowShadow.ts` recipe (a fixed "glow" style applied/removed, not continuously animated).

Re-targeting the primitive mid-flight (e.g. a card that's mid-lift when tapped again) is done by calling the hook again with a **new** `from` equal to the interpolated value's *current* live output, never the original layout position — this is what satisfies the doc's "begin exactly from current visible position" rule (Demo 03) and needs a small helper to read an `Animated.Value`'s current numeric output (RN's `Animated.Value` exposes this via a private `_value`/listener; the plan should use the standard listener-based read pattern, not the private field directly).

## Components

**`SimpleCard`** — one fixed size constant (`SIMPLE_CARD_WIDTH`/`HEIGHT`, no `small`/`normal` split, per the doc's "single, consistent size" requirement). Renders rank text (`A`, `2`–`10`, `J`, `Q`, `K`) plus a Unicode suit glyph (`♠ ♥ ♦ ♣`) in the suit's color — no images, no `packages/ui` dependency, matching "Cards should be rendered in a simplified style using only text and suit symbols."

**`Hand`** — the Demo 01 deliverable. Props: `cards`, `overlap`, `arcDegrees`, `maxRotationDeg`, `spacingPx` — all configurable, no hardcoded per-game constants (unlike `apps/mobile`'s seating/layout constants, this is meant to be tunable live while developing).

## Demo breakdown

Mirrors `ANIMATION_ARCHITECTURE.md`'s own Demo 01–06 structure exactly — this doubles as the implementation plan's task breakdown:

- **Demo 01 — Fan Layout**: `Hand` rendered with live sliders for its 5 config props. No taps, no animation — pure layout.
- **Demo 02 — Card Selection**: adds tap-to-select on top of Demo 01. Selecting drives a `useCardMotion` from `{x:0,y:0,rotateDeg:θ,scale:1}` to `{x:0,y:-liftPx,rotateDeg:θ,scale:1}` — rotation (`θ`) explicitly unchanged between from/to, satisfying "rotation must remain unchanged." Neighbor cards' own positions are untouched (no layout recalculation triggered by selection).
- **Demo 03 — Play Card**: second tap re-targets the same card's motion from its *current* interpolated position (see the mid-flight re-targeting note above) to a fixed table destination point, rotation held fixed across the whole `from`/`to` pair.
- **Demo 04 — Landing**: tunes `easing`/`durationMs` on Demo 03's travel so arrival reads as decelerating to a natural stop, not a hard stop — `Easing.out(Easing.cubic)` or a custom Bézier, per the doc's preferred easings.
- **Demo 05 — Transformation**: extends the same `to` keyframe with `scale` shrinking to the resting trick-card size and a `glyphScale` output (an extra interpolated output alongside the four core ones, scaling `SimpleCard`'s internal rank/suit text) — still one timeline, no separate post-arrival "pop."
- **Demo 06 — Complete Sequence**: everything above, combined, driven by the continuous 4-seat deal loop below. First tap selects (Demo 02's motion), second tap plays (Demo 03→05's motion chained onto the same underlying value via re-targeting, not a new animation).

## Demo 06's turn/deal loop

The `ANIMATION_ARCHITECTURE.md` "Playground Scope" section wants real 4-player turn order and an infinite deal loop, but explicitly excludes bidding, trump, and "trick logic" (i.e., no winner computation). Rather than wiring in `packages/engine`'s real `batakGame` (whose `'play'` validation requires a trump suit to exist), `useDealLoop` is a small local reducer scoped entirely to this playground:

1. `createDeck({deckCount: 1, includeJokers: false})` + `shuffle(deck, rng)` (both reused from `@world-of-cards/engine`), deal 13 cards to each of 4 seats.
2. Turn pointer cycles `0 → 1 → 2 → 3 → 0 → …` continuously. Confirmed with the user: this rotation never changes based on who "wins" a trick — there is no winner computation at all, since trick logic is explicitly out of scope. It's a fixed round-robin purely to generate a continuous stream of realistic "play a card" events to animate.
3. A play appends to a `currentTrick` array; once it reaches 4 entries, the 4 cards briefly rest at the trick center (this is where Demo 06 reuses Demo 05's transform-to-resting-size motion), then are cleared (a simple fade/gather, not a new mechanic to design — reuses the existing motion primitive with a destination *off* the visible table).
4. Once every seat's hand is empty (after 13 rounds), reshuffle and redeal automatically — the infinite loop the doc asks for.
5. Only seat 0 (the human/local seat) is tap-interactive (select → play, Demo 02/03 flow). The other 3 seats auto-play their next legal-by-turn-order card on a timer, matching the pacing style (not the code) of `apps/mobile`'s existing `useAITurn` hook — no legality/follow-suit constraint exists here (no trump, no suit-following requirement), so "auto-play" just means "play the first card in hand" after a short delay.

## Performance

Every `Animated.timing` call uses `useNativeDriver: true` for its interpolated outputs (`transform`, `opacity`) — this alone satisfies the doc's "UI-thread animations whenever possible" goal without needing Reanimated. `zIndex`/shadow step-changes (JS-thread, since they're not native-driver-eligible) are single discrete writes at a progress threshold, not per-frame work, so they don't reintroduce a JS-thread animation loop.

## Testing

No new automated tests, per this repo's standing 2026-07-07 mobile-UI testing policy. Every demo's completion is judged against `CLAUDE_ANIMATION_RULES.md`'s own per-demo validation checklist (motion, continuity, scaling, landing, rotation, performance) by visual inspection, one demo at a time — consistent with that document's explicit process (never move to the next demo until the current one passes that checklist).

## Open items for the implementation plan

- Exact numeric defaults for `Hand`'s 5 config props (overlap/arc/rotation/spacing) — left as first-pass tunable values in the plan, refined live per `CLAUDE_ANIMATION_RULES.md`'s incremental-iteration principle, not pre-computed here.
- The specific technique for reading an `Animated.Value`'s current live output when re-targeting mid-flight (Demo 03) — a small, well-known RN pattern (attach a listener, cache the latest value), to be written out precisely in the implementation plan rather than here.

