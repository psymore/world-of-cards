# CLAUDE_ANIMATION_RULES.md

# Purpose

This document defines the working methodology for developing the card animation system.

The goal is **not to finish features as quickly as possible**.

The goal is to achieve **production-quality, highly polished, reusable animations** that can later be integrated into the Batak game.

Animation quality always has priority over implementation speed.

---

# General Principles

## One Problem at a Time

Claude should focus on solving **one animation problem at a time**.

Never attempt to improve multiple unrelated behaviors in the same iteration.

Examples:

✅ Improve fan layout.

✅ Improve selection animation.

✅ Improve travel animation.

❌ Improve fan layout, selection, scaling and landing simultaneously.

---

## Demo First

Every new animation idea must first be implemented inside the Playground.

Never begin implementation inside the Batak game unless the animation has already been validated in the Playground.

The Playground exists to isolate animation problems from gameplay logic.

---

## Preserve Working Code

Avoid unnecessary refactoring.

If an animation already behaves correctly, do not redesign it unless there is a measurable improvement.

Working behavior should be preserved whenever possible.

---

## Incremental Development

Animations should evolve through small iterations.

Each iteration should improve one specific aspect.

Examples:

Iteration 1

Improve selection lift.

Iteration 2

Improve movement trajectory.

Iteration 3

Improve landing.

Iteration 4

Improve scaling.

Small improvements are preferred over large rewrites.

---

# Animation Philosophy

Cards should never appear to execute multiple independent animations.

The player should perceive one continuous physical movement.

The ideal perception is:

> "The card naturally left my hand."

instead of

> "The card moved upward, then translated, then resized."

---

# Single Timeline Principle

Whenever possible, animated properties should be derived from a single animation timeline.

Avoid animation chains.

Preferred architecture:

One progress value

↓

Everything derives from progress.

Examples:

- translateX
- translateY
- rotation
- scale
- shadow
- elevation
- opacity
- glyph size

should evolve together.

---

# Smoothness First

Visual smoothness is always more important than implementation simplicity.

If a simpler implementation produces visible discontinuities, prefer the more complex solution that produces smoother motion.

---

# No Visual Snapping

Avoid:

- sudden jumps
- position snapping
- scale popping
- rotation snapping
- z-index flickering

Every visible transition should be continuous.

---

# Physical Motion

Animations should resemble real physical motion.

Preferred characteristics:

- smooth acceleration
- soft deceleration
- natural momentum
- consistent velocity

Avoid robotic movement.

Avoid perfectly linear motion unless explicitly intended.

---

# Preserve Spatial Continuity

A card should always begin moving from its actual visible position.

Never restart movement from a recalculated layout position.

If the card has already been lifted,

the travel animation must begin from that lifted position.

---

# Stable Rotation

The card's rotation belongs to its position within the hand.

Once movement begins,

rotation should normally remain constant unless a specific effect requires otherwise.

Avoid rotating the card toward the destination.

---

# Stable Layout

Selection should not cause neighboring cards to unexpectedly shift unless that behavior is intentionally designed.

Layout stability improves perceived quality.

---

# Performance

Target:

- 60 FPS
- UI-thread animations
- minimal re-renders
- efficient interpolation
- avoid unnecessary state updates

Animation quality includes performance.

---

# Reusability

Animation logic should remain reusable.

Avoid writing Batak-specific animation code unless absolutely necessary.

The animation engine should be usable for:

- Batak
- Poker
- Hearts
- Spades
- Bridge
- other trick-taking card games

---

# Validation Process

After every implementation, evaluate:

## Motion

Does it feel natural?

## Continuity

Are there any visible discontinuities?

## Scaling

Does scaling blend naturally?

## Landing

Does the card settle smoothly?

## Rotation

Does the angle remain visually correct?

## Performance

Is the animation consistently smooth?

Only after passing these checks should the implementation be considered complete.

---

# Refactoring Policy

Do not refactor code simply because it can be cleaner.

Refactoring is encouraged only if it provides at least one of the following:

- smoother animation
- improved maintainability
- better reusability
- better performance
- simpler architecture without changing behavior

Otherwise, preserve the existing implementation.

---

# Completion Criteria

A demo is considered complete only when:

- animation feels physically believable
- motion is continuous
- there are no visible jumps
- there are no abrupt transitions
- performance remains excellent
- the implementation is reusable
- the visual quality is suitable for a commercial card game

Only then should work begin on the next demo.

---

# Final Objective

The Playground is the animation laboratory.

The Batak project is the final consumer.

Animations should be perfected inside the Playground first, and only then integrated into the game with minimal modification.

Never optimize for speed of development at the expense of animation quality.
