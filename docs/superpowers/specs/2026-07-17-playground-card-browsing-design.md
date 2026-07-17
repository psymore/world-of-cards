# Card Playground — Full-Deck Browsing & Larger Gallery Cards — Design

## Purpose

Two small, related usability fixes to `apps/playground`:

1. The `CardTemplateEditor`'s ‹/› arrow buttons currently cycle between the 3 template groups (`number` / `face` / `ace`), each showing one fixed representative card (7♠ / Q♥ / A♣). The user wants the arrows to browse the entire 52-card deck instead, one card at a time.
2. The full-deck gallery grid (`CardGallery.tsx`) renders every card at `size="small"` (64×86), which is too small to read comfortably — the two-character rank "10" doesn't fit properly at that scale.

Both changes are scoped to `apps/playground` only, following the app's existing isolation rules (see `docs/superpowers/specs/2026-07-12-card-playground-design.md`).

## 1. Full-deck arrow browsing

**New shared util — `apps/playground/src/utils/orderedDeck.ts`:**

```ts
export const ORDERED_DECK: Card[] = createDeck({ deckCount: 1, includeJokers: false });
```

This extracts the canonical 52-card array currently defined locally inside `CardGallery.tsx` (its `DECK` constant, plus the `cardsBySuit` grouping helper stays local to `CardGallery` since only it needs per-suit grouping). Both `CardGallery.tsx` and `CardTemplateEditor.tsx` import `ORDERED_DECK` from this one module, so there's a single source of truth for deck ordering across the two components.

**`CardTemplateEditor.tsx` changes:**

- Replace the `selectedGroup: CardGroup` state with `cardIndex: number` (0–51), initialized to the index of today's `number`-group representative card (7♠) so the editor opens on the same card as before.
- `selectedGroup` becomes a derived value: `getCardGroup(ORDERED_DECK[cardIndex].rank)`. All existing border/radius/image edits already key off `selectedGroup`, so no change needed there — edits keep applying to whichever group the *current* card belongs to.
- `cycleGroup(delta)` is replaced by `cycleCard(delta)`: `setCardIndex((i) => (i + delta + 52) % 52)`. The ‹/› buttons call this instead.
- Group tab `onPress` now jumps `cardIndex` to the index (within `ORDERED_DECK`) of that group's existing representative card (7♠ / Q♥ / A♣) via `ORDERED_DECK.findIndex(...)`, rather than just setting a `selectedGroup` string. The active-tab highlight (`group === selectedGroup`) keeps working unchanged since `selectedGroup` is still computed each render.
- The preview renders `ORDERED_DECK[cardIndex]` instead of the old fixed `GROUP_PREVIEW_CARD[selectedGroup]` lookup (which is removed, now dead).
- **New:** a small text label above the preview card (e.g. "7 of Spades") showing the current card's rank and suit. This didn't matter before (each group only ever showed one fixed card, and the tab label already said what it was), but now that arrows step through all 52 individual cards, the user needs an explicit way to tell which card is currently shown.

**Behavior after this change:** tapping ‹/› moves one card at a time through the full deck in `ORDERED_DECK` order — `createDeck`'s own suit order (hearts → diamonds → clubs → spades), ranks in `createDeck`'s order within each suit. Note this differs from `CardGallery`'s own display order (spades → hearts → clubs → diamonds, via its separate `SUIT_ORDER` constant, unchanged by this spec) — the two components group/display cards differently but now share the same underlying 52-card source array. Tapping a group tab jumps straight to that group's representative card; the border/image controls always edit the group of whatever card is currently displayed.

## 2. Larger gallery cards

`CardGallery.tsx`: change the single `size="small"` prop passed to each `PlayingCard` to `size="normal"` (94×132) — the same size already used in-app (e.g. Pişti/Batak hand cards). No new `PlayingCardSize` variant is introduced. The grid will scroll further since each card is ~1.47× larger per dimension; this is expected for a full-deck preview tool. `CardGallery.tsx` also switches from its local `DECK`/`cardsBySuit` to `ORDERED_DECK` (importing from the new shared util) plus a locally-kept `cardsBySuit` filter helper, so deck ordering is defined once.

## Non-goals (this pass)

- No face-card center-art box-size variation (deferred — dropped from this round to keep this spec focused on the two browsing/sizing fixes).
- No changes to `packages/ui` or any shared component prop surface — everything here is confined to `apps/playground`.
- No new automated tests, per the project's standing mobile/UI testing policy (this is playground UI, not engine logic). Existing playground behavior (border/image editing, presets) is unaffected in shape, only in how the previewed card is selected.

## Files touched

- New: `apps/playground/src/utils/orderedDeck.ts`
- Modified: `apps/playground/src/components/CardTemplateEditor.tsx`
- Modified: `apps/playground/src/components/CardGallery.tsx`
