# ANIMATION_ARCHITECTURE.md

## Playground Scope

Before implementing the animation system, create a dedicated animation playground specifically for this purpose.

This playground should **not** use the actual Batak UI assets. Cards should be rendered in a simplified style using only text and suit symbols. Face cards (Jack, Queen, King, and Ace) should be displayed as their standard letters (J, Q, K, A) together with the appropriate suit symbol. No court artwork or card images should be used.

All cards should use a **single, consistent size** throughout the entire playground. There is no small-table-card version in this project.

The playground should simulate a complete four-player Batak trick-taking flow. There is no bidding, no trump declaration, and no call selection. Turn order should behave exactly like the real game, with players taking turns playing one card at a time.

Once all cards in every player's hand have been played, the deck should automatically be reshuffled and redealt, creating an infinite gameplay loop. This allows continuous testing of card animations without restarting the application.

The primary purpose of this playground is to provide a clean, isolated environment for developing and perfecting production-quality card animations before integrating them into the actual Batak game.

---

## Goal

The objective is **not** to build Batak.

The objective is to create a reusable, production-quality playing card animation engine that can later be integrated into Batak.

This playground is an isolated animation laboratory.

Game rules, networking, AI, trick logic and scoring are intentionally excluded.

Only animation quality matters.

---

# Animation Philosophy

Cards must never look like they are executing multiple unrelated animations.

Instead, every visible property of the card should be derived from one continuous animation timeline.

The animation must feel like one uninterrupted physical movement.

The player should perceive:

> "The card left my hand."

not

> "The card moved up, then translated, then resized."

---

# Golden Rules

## Never chain independent animations.

Avoid:

Move Up

↓

Translate

↓

Resize

↓

Rotate

Instead every property must evolve simultaneously.

---

## One source of truth

Every animated property should depend on one progress value.

Example:

progress = 0

Card is fully inside the hand.

progress = 1

Card is completely inside the trick.

Every frame is computed from this progress.

---

## Properties driven by progress

The following properties must interpolate from progress.

- translateX
- translateY
- rotation
- scale
- shadow
- elevation
- zIndex
- opacity (if required)
- glyphScale
- cornerRadius (optional)

Nothing should animate independently unless absolutely necessary.

---

# Demo Architecture

Every animation challenge must become its own isolated demo.

---

## Demo 01

### Fan Layout

Goal:

Generate a perfect hand of cards.

Requirements

- Configurable hand size
- Configurable overlap
- Configurable arc
- Configurable maximum rotation
- Configurable spacing

No clicking.

No animation.

Only layout.

---

## Demo 02

### Card Selection

Goal

Selecting a card.

Requirements

- Card smoothly rises.
- Rotation must remain unchanged.
- Neighbour cards must stay stable.
- Selection should not affect layout calculations.

---

## Demo 03

### Play Card

Goal

Selected card travels to the table.

Requirements

- Card begins exactly from its current position.
- Not from the original layout.
- Selection offset must already be included.
- Rotation remains fixed.
- Motion must feel continuous.
- No snapping.

---

## Demo 04

### Landing

Goal

Card reaches the trick position.

Requirements

- Soft deceleration.
- Natural easing.
- No visible stop.
- Card must appear to settle naturally.

---

## Demo 05

### Transformation

Goal

Card becomes the table version.

Requirements

- Smooth scale.
- Smooth glyph resize.
- Maintain center alignment.
- No visible popping.

---

## Demo 06

### Complete Sequence

Everything combined.

First tap:

Select.

Second tap:

The entire animation executes using one progress timeline.

No chained animations.

---

# Motion Requirements

Motion must feel physical.

Never robotic.

Avoid linear movement.

Preferred easing:

- easeOutQuart
- easeOutCubic
- or a custom Bézier curve

---

# Rotation Rules

Rotation belongs to the hand.

Once the card starts travelling,

rotation must remain constant.

Never rotate toward the destination.

---

# Translation Rules

Movement begins from the current visible position.

Not from the original layout.

If the card was lifted 24px,

the animation must begin from that lifted position.

---

# Scale Rules

Scale must not begin after translation ends.

Scale must evolve continuously.

Wrong:

Translate

↓

Scale

Correct:

Translation(progress)

Scale(progress)

---

# Z-Index Rules

The travelling card must always remain above every hand card.

After landing,

its z-index becomes the trick order.

---

# Visual Polish

- Card shadow changes gradually.
- Perspective remains stable.
- Edges remain sharp.
- No texture distortion.
- No flickering.
- No layout jumps.

---

# Performance Goals

- 60 FPS minimum.
- No dropped frames.
- No unnecessary re-renders.
- UI-thread animations whenever possible.

---

# Suggested Technology

- React Native
- React Native Reanimated
- Shared Values
- Animated Styles
- Interpolate
- Derived Values
- Worklets

Avoid JavaScript-thread-driven animations whenever possible.

---

# Final Objective

When this playground animation is visually perfect,

only then should it be ported into Batak.

The Batak project must consume this animation system,

not redesign it.
