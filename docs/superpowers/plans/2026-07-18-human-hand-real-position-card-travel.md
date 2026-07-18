# Human Hand Real-Position Card-Travel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the human player's played-card travel animation originate from the card's real on-screen position in the hand (instead of a fixed generic direction), in both Pişti and Batak. Opponent plays are unaffected.

**Architecture:** Live-measure both ends of the travel: the destination (pile/trick-slot) once via `onLayout` + `measureInWindow`, cached in state; the played card's own position live via `measureInWindow` at the moment of the confirming tap. Compute the delta between the two as the travel origin offset. Falls back to the existing fixed `'bottom'` offset whenever either measurement isn't available (ref missing, destination not yet measured) — this is not a hypothetical: this repo's Jest/RNTL test environment never resolves host-component refs (no `createNodeMock` configured — confirmed empirically), so every existing test naturally exercises this fallback path and keeps passing unchanged.

**Tech Stack:** React Native (`View.measureInWindow`), Expo, TypeScript, Jest + `@testing-library/react-native`.

## Global Constraints

- No new automated tests — decorative/interaction-timing UI, per the standing 2026-07-07 mobile-UI testing policy. Verification steps below run the *existing* suite for regression, not new tests.
- No unsolicited screenshot/browser visual verification — per the user's 2026-07-17 direction. Don't run the Playwright workflow unless asked.
- Fallback origin offset, whenever live measurement isn't available, is the existing fixed `'bottom'` direction offset (`revealOriginOffset('bottom')`) — never a new analytical/computed guess. This was confirmed as the right call directly with the user during planning: the fixed offset already functions as a reasonable default (it's what the app has always shipped with), so no new computation is needed for the fallback path.
- AI plays are never affected by any change in this plan — they always use the fixed per-seat offset, exactly as today.
- Spec: `docs/superpowers/specs/2026-07-18-human-hand-real-position-card-travel-design.md`.

---

### Task 1: Pişti — measured origin for human plays

**Files:**
- Modify: `apps/mobile/src/games/pisti/PistiTable.tsx`
- Modify: `apps/mobile/src/games/pisti/PistiScreen.tsx`
- (No new files, no test files touched — existing `PistiTable.test.tsx` / `PistiScreen.test.tsx` must keep passing unmodified.)

**Interfaces:**
- Produces: `PistiTableProps.onPlayCard: (cardId: string, originOffset?: { x: number; y: number }) => void` (was `(cardId: string) => void`).
- Produces: `PistiRevealCard.originOffset?: { x: number; y: number }` (new optional field).

- [ ] **Step 1: Widen `PistiRevealCard` and `PistiTableProps.onPlayCard` types**

In `apps/mobile/src/games/pisti/PistiTable.tsx`, change:

```ts
export interface PistiRevealCard {
  card: Card;
  playerId: string;
}
```

to:

```ts
export interface PistiRevealCard {
  card: Card;
  playerId: string;
  originOffset?: { x: number; y: number };
}
```

And change:

```ts
  onPlayCard: (cardId: string) => void;
```

to:

```ts
  onPlayCard: (cardId: string, originOffset?: { x: number; y: number }) => void;
```

- [ ] **Step 2: Make `RevealCard` prefer a measured origin when present**

Still in `PistiTable.tsx`, inside the `RevealCard` function, change:

```ts
  const offset = PILE_CARD_OFFSETS[MAX_STACKED_PILE_CARDS];
  const origin = revealOriginOffset(originDirection);
```

to:

```ts
  const offset = PILE_CARD_OFFSETS[MAX_STACKED_PILE_CARDS];
  const origin = revealCard.originOffset ?? revealOriginOffset(originDirection);
```

- [ ] **Step 3: Add destination + hand-card ref plumbing inside `PistiTable`**

Still in `PistiTable.tsx`, inside the main `PistiTable` function body, immediately after the existing `middleRowHeight` state block (right after `handleMiddleRowLayout`'s closing `}`), add:

```ts
  // Destination for the human's play-travel origin delta: the pile's on-screen center,
  // measured live (not derived from layout constants — see the design doc for why analytical
  // computation was rejected) and re-measured on every layout pass so window resize/rotation
  // can't leave it stale.
  const destRef = useRef<View>(null);
  const [destCenter, setDestCenter] = useState<{ x: number; y: number } | null>(null);
  function handlePileMatLayout() {
    destRef.current?.measureInWindow((x, y, width, height) => {
      setDestCenter({ x: x + width / 2, y: y + height / 2 });
    });
  }

  // One ref per currently-rendered human hand card, keyed by card id, so the confirming tap can
  // measure that exact card's live position. Entries are added/removed as cards mount/unmount
  // (played, or hand reshuffled) via the ref callback below.
  const handCardRefs = useRef(new Map<string, View>()).current;
  function registerHandCardRef(cardId: string, node: View | null) {
    if (node) {
      handCardRefs.set(cardId, node);
    } else {
      handCardRefs.delete(cardId);
    }
  }

  // Replaces a direct onPlayCard(cardId) call: measures the tapped card's real on-screen
  // position relative to the pile's, so the reveal travels from where the card actually was.
  // Falls back to a plain onPlayCard(cardId) call (no origin — RevealCard then uses the fixed
  // 'bottom' offset, same as today) whenever either measurement isn't ready, which is always the
  // case in this project's Jest/RNTL tests (host refs never resolve there — no createNodeMock
  // configured) and is a defensive path on a real device too.
  function playWithMeasuredOrigin(cardId: string) {
    const node = handCardRefs.get(cardId);
    if (!node || !destCenter) {
      onPlayCard(cardId);
      return;
    }
    node.measureInWindow((x, y, width, height) => {
      onPlayCard(cardId, {
        x: x + width / 2 - destCenter.x,
        y: y + height / 2 - destCenter.y,
      });
    });
  }
```

- [ ] **Step 4: Wire `useCardSelection` to the new measuring function**

Still in `PistiTable.tsx`, change:

```ts
  const { selectedCardId, selectCard, clearSelection } = useCardSelection(onPlayCard);
```

to:

```ts
  const { selectedCardId, selectCard, clearSelection } = useCardSelection(playWithMeasuredOrigin);
```

- [ ] **Step 5: Attach the destination ref to `pileMat`**

Still in `PistiTable.tsx`, change:

```tsx
            <View style={styles.pileMat}>
```

to:

```tsx
            <View style={styles.pileMat} ref={destRef} onLayout={handlePileMatLayout}>
```

- [ ] **Step 6: Attach a per-card ref to each human hand-row card**

Still in `PistiTable.tsx`, in the human hand row map, change:

```tsx
              <View key={card.id}>
                <SelectableCard
                  card={card}
                  selected={selectedCardId === card.id}
                  disabled={!isHumanInteractive}
                  onPress={() => selectCard(card.id)}
                />
              </View>
```

to:

```tsx
              <View key={card.id} ref={(node) => registerHandCardRef(card.id, node)}>
                <SelectableCard
                  card={card}
                  selected={selectedCardId === card.id}
                  disabled={!isHumanInteractive}
                  onPress={() => selectCard(card.id)}
                />
              </View>
```

- [ ] **Step 7: Thread `originOffset` through `PistiScreen.tsx`'s reveal state**

In `apps/mobile/src/games/pisti/PistiScreen.tsx`, change the `RevealedMove` interface:

```ts
interface RevealedMove {
  move: PistiMove;
  card: Card;
  playerId: PlayerId;
}
```

to:

```ts
interface RevealedMove {
  move: PistiMove;
  card: Card;
  playerId: PlayerId;
  originOffset?: { x: number; y: number };
}
```

- [ ] **Step 8: Thread `originOffset` through `revealThenCommit` and `handlePlayCard`**

Still in `PistiScreen.tsx`, change:

```ts
  function revealThenCommit(move: PistiMove, playerId: PlayerId) {
    const playedCard = state.table.zones[`hand-${playerId}`].cards.find((c) => c.id === move.cardId);
    if (!playedCard) {
      applyMove(move, playerId);
      return;
    }
    setRevealedMove({ move, card: playedCard, playerId });
    revealTimeoutRef.current = setTimeout(() => {
      applyMove(move, playerId);
      setRevealedMove(null);
    }, REVEAL_DELAY_MS);
  }
```

to:

```ts
  function revealThenCommit(move: PistiMove, playerId: PlayerId, originOffset?: { x: number; y: number }) {
    const playedCard = state.table.zones[`hand-${playerId}`].cards.find((c) => c.id === move.cardId);
    if (!playedCard) {
      applyMove(move, playerId);
      return;
    }
    setRevealedMove({ move, card: playedCard, playerId, originOffset });
    revealTimeoutRef.current = setTimeout(() => {
      applyMove(move, playerId);
      setRevealedMove(null);
    }, REVEAL_DELAY_MS);
  }
```

And change:

```ts
  function handlePlayCard(cardId: string) {
    revealThenCommit({ type: 'play', cardId }, HUMAN_ID);
  }
```

to:

```ts
  function handlePlayCard(cardId: string, originOffset?: { x: number; y: number }) {
    revealThenCommit({ type: 'play', cardId }, HUMAN_ID, originOffset);
  }
```

(`useAITurn`'s own `onMove: revealThenCommit` call site is untouched — it always calls with exactly 2 arguments, so `originOffset` is simply omitted for AI plays, matching the existing `useAITurn.test.ts` assertion shape.)

- [ ] **Step 9: Pass the measured origin into the `revealCard` prop**

Still in `PistiScreen.tsx`, change:

```tsx
        revealCard={revealedMove ? { card: revealedMove.card, playerId: revealedMove.playerId } : null}
```

to:

```tsx
        revealCard={
          revealedMove
            ? { card: revealedMove.card, playerId: revealedMove.playerId, originOffset: revealedMove.originOffset }
            : null
        }
```

- [ ] **Step 10: Typecheck**

Run: `npx tsc --noEmit -p apps/mobile/tsconfig.json`
Expected: no errors.

- [ ] **Step 11: Run existing Pişti UI tests**

Run: `npx jest apps/mobile/src/games/pisti/PistiTable.test.tsx apps/mobile/src/games/pisti/PistiScreen.test.tsx`
Expected: all tests pass unchanged (the `toHaveBeenCalledWith('h1')`-style assertions in `PistiTable.test.tsx` must still pass — they rely on the fallback path calling `onPlayCard` with exactly one argument, since host refs never resolve in this test environment).

- [ ] **Step 12: Run the full existing suite for regression**

Run: `npx jest`
Expected: all suites pass (same pass count as before this task).

- [ ] **Step 13: Commit**

```bash
git add apps/mobile/src/games/pisti/PistiTable.tsx apps/mobile/src/games/pisti/PistiScreen.tsx
git commit -m "Travel Pişti's human-played card from its real hand position"
```

---

### Task 2: Batak — measured origin for human plays

**Files:**
- Modify: `apps/mobile/src/games/batak/BatakTable.tsx`
- Modify: `apps/mobile/src/games/batak/BatakScreen.tsx`
- (No existing UI tests exist for these two files today — only the unrelated `engineImport.smoke.test.ts` — so there is no pre-existing assertion shape to preserve here, unlike Task 1.)

**Interfaces:**
- Produces: `BatakTableProps.onPlayCard: (cardId: string, originOffset?: { x: number; y: number }) => void` (new prop, separate from the existing `onMove`).
- Produces: `PendingBatakPlay.originOffset?: { x: number; y: number }` (new optional field).

- [ ] **Step 1: Add the `onPlayCard` prop and widen `PendingBatakPlay`**

In `apps/mobile/src/games/batak/BatakTable.tsx`, change:

```ts
export interface PendingBatakPlay {
  playerId: string;
  card: Card;
}
```

to:

```ts
export interface PendingBatakPlay {
  playerId: string;
  card: Card;
  originOffset?: { x: number; y: number };
}
```

And change:

```ts
export interface BatakTableProps {
  state: BatakState;
  humanPlayerId: string;
  // Exactly 3 entries for this fixed-4-player scope.
  opponentPlayerIds: string[];
  playerNames: Record<string, string>;
  // Legal moves for humanPlayerId's current turn, or [] when it isn't their turn / a move is
  // pending. Drives which bid amounts, trump suits, and hand cards are actually tappable.
  legalMoves: BatakMove[];
  onMove: (move: BatakMove) => void;
  pendingPlay?: PendingBatakPlay | null;
  dealPhase: BatakDealPhase;
}
```

to:

```ts
export interface BatakTableProps {
  state: BatakState;
  humanPlayerId: string;
  // Exactly 3 entries for this fixed-4-player scope.
  opponentPlayerIds: string[];
  playerNames: Record<string, string>;
  // Legal moves for humanPlayerId's current turn, or [] when it isn't their turn / a move is
  // pending. Drives which bid amounts, trump suits, and hand cards are actually tappable.
  legalMoves: BatakMove[];
  onMove: (move: BatakMove) => void;
  // Separate from onMove (which also carries bid/pass/selectTrump, none of which have an
  // origin) — called only for the human's own card plays, with a measured travel-origin offset
  // when available.
  onPlayCard: (cardId: string, originOffset?: { x: number; y: number }) => void;
  pendingPlay?: PendingBatakPlay | null;
  dealPhase: BatakDealPhase;
}
```

- [ ] **Step 2: Make `TrickCenter` accept and use a measured origin for the pending play**

Still in `BatakTable.tsx`, change the `TrickCenter` function's parameter type:

```ts
function TrickCenter({
  state,
  seats,
  humanPlayerId,
  playerNames,
  pendingPlay,
}: {
  state: BatakState;
  seats: Seat[];
  humanPlayerId: string;
  playerNames: Record<string, string>;
  pendingPlay?: PendingBatakPlay | null;
}) {
```

to:

```ts
function TrickCenter({
  state,
  seats,
  humanPlayerId,
  playerNames,
  pendingPlay,
  destRef,
  onDestLayout,
}: {
  state: BatakState;
  seats: Seat[];
  humanPlayerId: string;
  playerNames: Record<string, string>;
  pendingPlay?: PendingBatakPlay | null;
  destRef: React.RefObject<View>;
  onDestLayout: () => void;
}) {
```

- [ ] **Step 3: Use the measured origin in `slotFor`'s `TravelCard`, and attach the destination ref to the `'bottom'` slot**

Still in `BatakTable.tsx`, inside `TrickCenter`'s `slotFor`, change:

```tsx
    return (
      <View
        key={position}
        testID={`trick-slot-${position}`}
        style={[
          styles.trickSlot,
          { zIndex, transform: [{ translateX: offset.x }, { translateY: offset.y }] },
        ]}>
        {card ? (
          isPending ? (
            <TravelCard
              originOffset={revealOriginOffset(resolveRevealOrigin(playerId!, humanPlayerId, seats))}
              resetKey={card.id}>
              <PlayingCard card={card} size="small" />
            </TravelCard>
          ) : (
            <PlayingCard card={card} size="small" />
          )
        ) : null}
      </View>
    );
```

to:

```tsx
    return (
      <View
        key={position}
        testID={`trick-slot-${position}`}
        ref={position === "bottom" ? destRef : undefined}
        onLayout={position === "bottom" ? onDestLayout : undefined}
        style={[
          styles.trickSlot,
          { zIndex, transform: [{ translateX: offset.x }, { translateY: offset.y }] },
        ]}>
        {card ? (
          isPending ? (
            <TravelCard
              originOffset={
                pendingPlay?.originOffset ??
                revealOriginOffset(resolveRevealOrigin(playerId!, humanPlayerId, seats))
              }
              resetKey={card.id}>
              <PlayingCard card={card} size="small" />
            </TravelCard>
          ) : (
            <PlayingCard card={card} size="small" />
          )
        ) : null}
      </View>
    );
```

(`isPending` already guarantees `pendingPlay.playerId === playerId` for this exact slot, so `pendingPlay?.originOffset` correctly resolves to this card's measured origin when it's the human's play, and stays `undefined` — falling back to the fixed offset — for every AI play.)

- [ ] **Step 4: Add destination + hand-card ref plumbing inside `BatakTable`, and pass the new props to `TrickCenter`**

Still in `BatakTable.tsx`, inside the main `BatakTable` function body, immediately after the existing `bottomRowMargin` line (right before the `handFramePeakTarget` block), add:

```ts
  // Destination for the human's play-travel origin delta: the 'bottom' trick slot's on-screen
  // center, measured live and re-measured on every layout pass. See
  // docs/superpowers/specs/2026-07-18-human-hand-real-position-card-travel-design.md.
  const destRef = useRef<View>(null);
  const [destCenter, setDestCenter] = useState<{ x: number; y: number } | null>(null);
  function handleDestLayout() {
    destRef.current?.measureInWindow((x, y, width, height) => {
      setDestCenter({ x: x + width / 2, y: y + height / 2 });
    });
  }

  // One ref per currently-rendered human hand card, keyed by card id.
  const handCardRefs = useRef(new Map<string, View>()).current;
  function registerHandCardRef(cardId: string, node: View | null) {
    if (node) {
      handCardRefs.set(cardId, node);
    } else {
      handCardRefs.delete(cardId);
    }
  }

  // Replaces a direct onPlayCard(cardId) call: measures the tapped card's real on-screen
  // position relative to the trick slot's, so the travel animation starts from where the card
  // actually was. Falls back to a plain onPlayCard(cardId) call (no origin — TravelCard then
  // uses the fixed 'bottom' offset, same as today) whenever either measurement isn't ready.
  function playWithMeasuredOrigin(cardId: string) {
    const node = handCardRefs.get(cardId);
    if (!node || !destCenter) {
      onPlayCard(cardId);
      return;
    }
    node.measureInWindow((x, y, width, height) => {
      onPlayCard(cardId, {
        x: x + width / 2 - destCenter.x,
        y: y + height / 2 - destCenter.y,
      });
    });
  }
```

Then change the `useCardSelection` call:

```ts
  const { selectedCardId, selectCard, clearSelection } = useCardSelection(
    cardId => onMove({ type: "play", cardId }),
  );
```

to:

```ts
  const { selectedCardId, selectCard, clearSelection } = useCardSelection(playWithMeasuredOrigin);
```

Then change the `TrickCenter` call site:

```tsx
        {state.phase === "playing" && (
          <TrickCenter
            state={state}
            seats={seats}
            humanPlayerId={humanPlayerId}
            playerNames={playerNames}
            pendingPlay={pendingPlay}
          />
        )}
```

to:

```tsx
        {state.phase === "playing" && (
          <TrickCenter
            state={state}
            seats={seats}
            humanPlayerId={humanPlayerId}
            playerNames={playerNames}
            pendingPlay={pendingPlay}
            destRef={destRef}
            onDestLayout={handleDestLayout}
          />
        )}
```

- [ ] **Step 5: Thread a per-card ref through `HandRow`**

Still in `BatakTable.tsx`, change `HandRow`'s parameter type:

```ts
function HandRow({
  cards,
  legalCardIds,
  isHumanInteractive,
  selectedCardId,
  selectCard,
  playEntrance,
  cardMarginLeft,
}: {
  cards: Card[];
  legalCardIds: Set<string>;
  isHumanInteractive: boolean;
  selectedCardId: string | null;
  selectCard: (cardId: string) => void;
  playEntrance: boolean;
  cardMarginLeft: number | undefined;
}) {
```

to:

```ts
function HandRow({
  cards,
  legalCardIds,
  isHumanInteractive,
  selectedCardId,
  selectCard,
  playEntrance,
  cardMarginLeft,
  registerCardRef,
}: {
  cards: Card[];
  legalCardIds: Set<string>;
  isHumanInteractive: boolean;
  selectedCardId: string | null;
  selectCard: (cardId: string) => void;
  playEntrance: boolean;
  cardMarginLeft: number | undefined;
  registerCardRef: (cardId: string, node: View | null) => void;
}) {
```

Then change its render body:

```tsx
  return (
    <View style={styles.handFanRow}>
      {cards.map((card, i) => {
        const interactive = isHumanInteractive && legalCardIds.has(card.id);
        return (
          <EntranceCard key={card.id} index={i} playEntrance={playEntrance}>
            <SelectableCard
              card={card}
              size="normal"
              selected={selectedCardId === card.id}
              disabled={!interactive}
              onPress={() => selectCard(card.id)}
              rotateDeg={fanRotationDeg(i, cards.length, HUMAN_HAND_DEGREES_PER_STEP)}
              curveOffsetY={fanCurveY(i, cards.length, 1, HUMAN_HAND_CURVE_MULTIPLIER)}
              marginLeft={i > 0 ? cardMarginLeft : undefined}
              liftDistance={SELECTED_LIFT_DISTANCE}
              // Kept even without the front-stacking zIndex below: it independently shrinks the
              // selected card's own touch bounds, which is what actually prevents a stray tap
              // from landing on it instead of an exposed neighbor — orthogonal to stacking order.
              hitSlop={selectedCardId === card.id ? SELECTED_CARD_HIT_SLOP : undefined}
            />
          </EntranceCard>
        );
      })}
    </View>
  );
```

to:

```tsx
  return (
    <View style={styles.handFanRow}>
      {cards.map((card, i) => {
        const interactive = isHumanInteractive && legalCardIds.has(card.id);
        return (
          <View key={card.id} ref={(node) => registerCardRef(card.id, node)}>
            <EntranceCard index={i} playEntrance={playEntrance}>
              <SelectableCard
                card={card}
                size="normal"
                selected={selectedCardId === card.id}
                disabled={!interactive}
                onPress={() => selectCard(card.id)}
                rotateDeg={fanRotationDeg(i, cards.length, HUMAN_HAND_DEGREES_PER_STEP)}
                curveOffsetY={fanCurveY(i, cards.length, 1, HUMAN_HAND_CURVE_MULTIPLIER)}
                marginLeft={i > 0 ? cardMarginLeft : undefined}
                liftDistance={SELECTED_LIFT_DISTANCE}
                // Kept even without the front-stacking zIndex below: it independently shrinks
                // the selected card's own touch bounds, which is what actually prevents a stray
                // tap from landing on it instead of an exposed neighbor — orthogonal to stacking
                // order.
                hitSlop={selectedCardId === card.id ? SELECTED_CARD_HIT_SLOP : undefined}
              />
            </EntranceCard>
          </View>
        );
      })}
    </View>
  );
```

- [ ] **Step 6: Pass `registerHandCardRef` into both `HandRow` call sites**

Still in `BatakTable.tsx`, change:

```tsx
          <HandRow
            cards={topRow}
            legalCardIds={legalCardIds}
            isHumanInteractive={isHumanInteractive}
            selectedCardId={selectedCardId}
            selectCard={selectCard}
            playEntrance={dealPhase === "revealing"}
            cardMarginLeft={topRowMargin}
          />
          <View style={styles.bottomHandRow}>
            <HandRow
              cards={bottomRow}
              legalCardIds={legalCardIds}
              isHumanInteractive={isHumanInteractive}
              selectedCardId={selectedCardId}
              selectCard={selectCard}
              playEntrance={dealPhase === "revealing"}
              cardMarginLeft={bottomRowMargin}
            />
          </View>
```

to:

```tsx
          <HandRow
            cards={topRow}
            legalCardIds={legalCardIds}
            isHumanInteractive={isHumanInteractive}
            selectedCardId={selectedCardId}
            selectCard={selectCard}
            playEntrance={dealPhase === "revealing"}
            cardMarginLeft={topRowMargin}
            registerCardRef={registerHandCardRef}
          />
          <View style={styles.bottomHandRow}>
            <HandRow
              cards={bottomRow}
              legalCardIds={legalCardIds}
              isHumanInteractive={isHumanInteractive}
              selectedCardId={selectedCardId}
              selectCard={selectCard}
              playEntrance={dealPhase === "revealing"}
              cardMarginLeft={bottomRowMargin}
              registerCardRef={registerHandCardRef}
            />
          </View>
```

- [ ] **Step 7: Thread `originOffset` through `BatakScreen.tsx`'s `commitMove`**

In `apps/mobile/src/games/batak/BatakScreen.tsx`, change:

```ts
  function commitMove(move: BatakMove, playerId: PlayerId) {
    // Every card play now gets staged (not just the trick-completing 4th) so the new play-travel
    // animation has something to animate from for every play; bid/pass/selectTrump still commit
    // instantly since engine state already reflects them visibly with nothing to bridge.
    if (move.type === 'play') {
      const hand = state.table.zones[`hand-${playerId}`].cards;
      const card = hand.find((c) => c.id === move.cardId);
      if (!card) {
        performMove(move);
        return;
      }
      const delay = state.currentTrick.length === 3 ? TRICK_COMPLETION_PAUSE_MS : PLAY_TRAVEL_DELAY_MS;
      setPendingPlay({ playerId, card });
      pendingTimeoutRef.current = setTimeout(() => {
        performMove(move);
        setPendingPlay(null);
      }, delay);
      return;
    }
    performMove(move);
  }
```

to:

```ts
  function commitMove(move: BatakMove, playerId: PlayerId, originOffset?: { x: number; y: number }) {
    // Every card play now gets staged (not just the trick-completing 4th) so the new play-travel
    // animation has something to animate from for every play; bid/pass/selectTrump still commit
    // instantly since engine state already reflects them visibly with nothing to bridge.
    if (move.type === 'play') {
      const hand = state.table.zones[`hand-${playerId}`].cards;
      const card = hand.find((c) => c.id === move.cardId);
      if (!card) {
        performMove(move);
        return;
      }
      const delay = state.currentTrick.length === 3 ? TRICK_COMPLETION_PAUSE_MS : PLAY_TRAVEL_DELAY_MS;
      setPendingPlay({ playerId, card, originOffset });
      pendingTimeoutRef.current = setTimeout(() => {
        performMove(move);
        setPendingPlay(null);
      }, delay);
      return;
    }
    performMove(move);
  }
```

- [ ] **Step 8: Add `handleHumanPlayCard` and wire it into `<BatakTable>`**

Still in `BatakScreen.tsx`, change:

```ts
  function handleHumanMove(move: BatakMove) {
    commitMove(move, HUMAN_ID);
  }
```

to:

```ts
  function handleHumanMove(move: BatakMove) {
    commitMove(move, HUMAN_ID);
  }

  function handleHumanPlayCard(cardId: string, originOffset?: { x: number; y: number }) {
    commitMove({ type: 'play', cardId }, HUMAN_ID, originOffset);
  }
```

Then change the `<BatakTable>` JSX:

```tsx
      <BatakTable
        state={state}
        humanPlayerId={HUMAN_ID}
        opponentPlayerIds={AI_IDS}
        playerNames={PLAYER_NAMES}
        legalMoves={legalMoves}
        onMove={handleHumanMove}
        pendingPlay={pendingPlay}
        dealPhase={dealPhase}
      />
```

to:

```tsx
      <BatakTable
        state={state}
        humanPlayerId={HUMAN_ID}
        opponentPlayerIds={AI_IDS}
        playerNames={PLAYER_NAMES}
        legalMoves={legalMoves}
        onMove={handleHumanMove}
        onPlayCard={handleHumanPlayCard}
        pendingPlay={pendingPlay}
        dealPhase={dealPhase}
      />
```

(`useAITurn`'s own `onMove: commitMove` call site is untouched — it always calls with exactly 2 arguments, so AI plays never carry an `originOffset`.)

- [ ] **Step 9: Typecheck**

Run: `npx tsc --noEmit -p apps/mobile/tsconfig.json`
Expected: no errors.

- [ ] **Step 10: Run the full existing suite for regression**

Run: `npx jest`
Expected: all suites pass (same pass count as before this task; `engineImport.smoke.test.ts` is unaffected by these UI-only changes).

- [ ] **Step 11: Commit**

```bash
git add apps/mobile/src/games/batak/BatakTable.tsx apps/mobile/src/games/batak/BatakScreen.tsx
git commit -m "Travel Batak's human-played card from its real hand position"
```
