import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { BatakState, BatakMove } from '@world-cards/engine/games/batak';
import { ruleConstants } from '@world-cards/engine/games/batak';
import {
  TableFelt,
  HandFrame,
  HAND_FRAME_PEAK_FRACTION,
  CARD_DIMS,
  CONTAINER_BOTTOM_PADDING,
  HAND_BADGE_HEIGHT,
  HAND_FRAME_REVEAL_MARGIN,
  HAND_FRAME_BOTTOM_OVERSHOOT,
} from '@world-cards/ui';
import { DeselectableSurface } from '../../components/DeselectableSurface';
import { useCardSelection } from '../../components/useCardSelection';
import { CenteredDecisionModal } from '../../components/CenteredDecisionModal';
import { DealFlightOverlay } from '../../table/DealFlightOverlay';
import type { DealFlightSeat } from '../../table/DealFlightOverlay';
import type { DealPhase } from '../../hooks/useDealSequence';
import { PlayerBadge } from '../../table/PlayerBadge';
import { OpponentSeatGroup, seatLayoutStyles } from '../../table/OpponentSeatGroup';
import { assignSeats, splitTwoRows, resolveRevealOrigin } from '../../table/seating';
import type { Seat } from '../../table/seating';
import { BiddingCenter, TrumpWaitingCenter, TrumpSuitPicker } from './table/PhaseCenterPanels';
import { TrickCenter } from './table/TrickCenter';
import { BidControls } from './table/BidControls';
import { PLATFORM_RAISE_BY } from './table/DecisionPanel';
import { HumanHandFan, HAND_ROW_OVERLAP_PX, sortHandForDisplay } from './table/HumanHandFan';
import type { HandSlot } from './table/HumanHandFan';
import type { PendingBatakPlay, GatheringTrick } from './table/types';
import { KittyPile, kittyPileCards } from './table/KittyPile';
import { useBurySlots } from './table/useBurySlots';
import { KittyExchangeCenter } from './table/KittyExchangeCenter';
import { KittyRevealCard, KittyCollectCard } from '../../table/KittyRevealCard';
import { revealOriginOffset } from '../../table/seating';
import type { PendingBury } from './BatakScreen';

// Re-exported so existing call sites (BatakScreen.tsx) can keep importing these from
// './BatakTable' unchanged — the actual definitions live in ./table/types now, shared with
// TrickCenter and every other extracted sub-component.
export type { PendingBatakPlay, GatheringTrick } from './table/types';

const HUMAN_CARD_HEIGHT = CARD_DIMS.normal.height;

// First-pass constants for positioning HandFrame behind the two-row hand, derived from this
// file's own layout below (not measured on a real device — tune these if the frame's arch peak
// doesn't line up with the top row's peak once visually checked).
const HAND_AREA_HEIGHT = 300; // matches styles.handArea.minHeight
const HAND_AREA_CONTENT_GAP = 4; // matches styles.handArea.gap
// Content centered inside handArea: badge + gap + the two-row fan (top row's full height, plus
// the bottom row's additional visible height once the overlap above is applied).
const HAND_CONTENT_HEIGHT =
  HAND_BADGE_HEIGHT + HAND_AREA_CONTENT_GAP + HUMAN_CARD_HEIGHT + (HUMAN_CARD_HEIGHT - HAND_ROW_OVERLAP_PX);
const HAND_AREA_TOP_INSET = (HAND_AREA_HEIGHT - HAND_CONTENT_HEIGHT) / 2;
// Distance from the container's true bottom edge (where HandFrame's own bottom:0 would sit,
// since absolute positioning ignores the container's own paddingVertical) up to the top row's
// peak — its center card's top edge, where curveOffsetY is 0.
const TOP_ROW_PEAK_DISTANCE_FROM_BOTTOM =
  CONTAINER_BOTTOM_PADDING + HAND_AREA_HEIGHT - HAND_AREA_TOP_INSET - HAND_BADGE_HEIGHT - HAND_AREA_CONTENT_GAP;

export type BatakDealPhase = DealPhase;

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
  // Human's confirmed 4-card bury during 'kitty-exchange' — separate from onMove for the same
  // reason onPlayCard is: BatakScreen stages this into a multi-step animation before it actually
  // reaches performMove, exactly like onPlayCard's trick-completion staging.
  onBury: (cardIds: [string, string, string, string]) => void;
  pendingPlay?: PendingBatakPlay | null;
  gatheringTrick?: GatheringTrick | null;
  pendingBury?: PendingBury | null;
  dealPhase: BatakDealPhase;
}

function bidStatusText(state: BatakState, playerId: string): string {
  const bid = state.bids[playerId];
  if (bid === 'pass') return 'Pass';
  if (typeof bid === 'number') return `Bid ${bid}`;
  return '—';
}

function statusTextFor(state: BatakState, playerId: string): string {
  return state.phase === 'bidding' ? bidStatusText(state, playerId) : `${state.tricksWon[playerId]} tricks`;
}

interface OpponentSeatProps {
  seat: Seat;
  state: BatakState;
  playerNames: Record<string, string>;
  pendingPlay?: PendingBatakPlay | null;
}

function OpponentSeat({ seat, state, playerNames, pendingPlay }: OpponentSeatProps) {
  const { position, playerId } = seat;
  const isSide = position !== 'top';
  const isCurrentTurn = state.players[state.currentPlayerIndex] === playerId && pendingPlay == null;

  return (
    <View style={[styles.opponentArea, isSide && seatLayoutStyles.opponentAreaSide]}>
      <PlayerBadge
        name={playerNames[playerId] ?? playerId}
        statusText={statusTextFor(state, playerId)}
        active={isCurrentTurn}
        isHuman={false}
        compact={isSide}
      />
    </View>
  );
}

// Renders the vacant top slot across the kitty-exchange sequence (see
// docs/superpowers/specs/2026-07-21-batak-gomeli-ui-design.md Section 4): the untouched
// face-down pile before anything is staging, and while the 'burying' leg is in progress (that
// leg's own flying-away cards render in the center panel instead — see KittyExchangeCenter, Step
// 3 above — since that's literally where they started; nothing at the pile itself changes until
// they'd actually arrive); the original kitty cards flipping face-up and holding during
// 'revealing' (KittyRevealCard); and those same cards flying out toward wherever the bidder
// actually is — the human's hand (bottom) or the bidding AI's own seat (left/right) — during
// 'collecting' (KittyCollectCard).
function KittyExchangeStagedPile({
  state,
  pendingBury,
  humanPlayerId,
  seats,
}: {
  state: BatakState;
  pendingBury?: PendingBury | null;
  humanPlayerId: string;
  seats: Seat[];
}) {
  if (!pendingBury || pendingBury.stage === 'burying') {
    return <KittyPile cards={kittyPileCards(state)} />;
  }

  const kittyCards = kittyPileCards(state);

  if (pendingBury.stage === 'revealing') {
    return (
      <View style={styles.pile} testID="kitty-pile-revealing">
        {kittyCards.map((card) => (
          <KittyRevealCard key={card.id} card={card} />
        ))}
      </View>
    );
  }

  // 'collecting'
  const destinationOffset =
    pendingBury.playerId === humanPlayerId
      ? revealOriginOffset('bottom')
      : revealOriginOffset(resolveRevealOrigin(pendingBury.playerId, humanPlayerId, seats));
  return (
    <View style={styles.pile} testID="kitty-pile-collecting">
      {kittyCards.map((card) => (
        <KittyCollectCard key={card.id} card={card} destinationOffset={destinationOffset} />
      ))}
    </View>
  );
}

export function BatakTable({
  state,
  humanPlayerId,
  opponentPlayerIds,
  playerNames,
  legalMoves,
  onMove,
  onPlayCard,
  onBury,
  pendingPlay,
  gatheringTrick,
  pendingBury,
  dealPhase,
}: BatakTableProps) {
  const seats = assignSeats(opponentPlayerIds);
  // Deal order: human first, then opponents in existing turn order (right, top, left for the
  // fixed 4-player table) — see docs/superpowers/specs/2026-07-17-batak-deal-selection-and-
  // trick-motion-polish-design.md section D2. Card counts come from the real dealt hand size,
  // not a hardcoded 13, so this stays correct if hand size ever varies (e.g. the gömmeli variant).
  const dealSeats: DealFlightSeat[] = [
    {
      origin: 'bottom',
      cardCount: state.table.zones[`hand-${humanPlayerId}`].cards.length,
    },
    ...opponentPlayerIds.map((playerId) => ({
      origin: resolveRevealOrigin(playerId, humanPlayerId, seats),
      cardCount: state.table.zones[`hand-${playerId}`].cards.length,
    })),
  ];
  const isHumanTurn = state.players[state.currentPlayerIndex] === humanPlayerId;
  // No trick-completing pause happens during bidding/trump-selection (pendingPlay is always null
  // there), so this single check correctly gates interactivity across every phase: whenever a
  // trick-completing move (human's own or an AI's) is staged, engine state hasn't advanced past
  // the player who made it yet, so disabling on pendingPlay alone — not "is it revealing for the
  // human specifically" — is both correct and simpler than tracking whose reveal it is.
  const isHumanInteractive =
    isHumanTurn && pendingPlay == null && gatheringTrick == null && pendingBury == null;

  const { selectedCardId, selectCard, clearSelection } = useCardSelection(playWithMeasuredOrigin);
  useEffect(() => {
    if (!isHumanInteractive) clearSelection();
  }, [isHumanInteractive, clearSelection]);

  const isHumanBidderInKittyExchange = state.phase === 'kitty-exchange' && state.bidWinner === humanPlayerId;
  const burySlots = useBurySlots(
    ruleConstants(3).kittySize,
    (cardIds) => onBury(cardIds as [string, string, string, string]),
  );
  useEffect(() => {
    if (!isHumanBidderInKittyExchange) burySlots.clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHumanBidderInKittyExchange]);

  // Cards currently animating back into the hand after being tapped out of a bury slot — read
  // once by HandSlot.enterFromOffset (Step 1) and left in place afterward (harmless: once a
  // card's own AnimatedFanCard instance has mounted, its `mounted` ref guards against ever
  // reading this again for that same mount).
  const RETURN_TO_HAND_OFFSET = { x: 0, y: -140 };
  const [returningCardIds, setReturningCardIds] = useState<Set<string>>(new Set());

  // During kitty-exchange, a single tap places/returns a card in a bury slot instead of the
  // normal tap-to-select-then-tap-to-play flow — every remaining hand card is individually legal
  // to bury (there's no per-card legality the way there is for 'play'), so legalCardIds is
  // overridden to "everything currently in hand" for this phase specifically (computed below,
  // once humanHand is available).
  function handleBurySlotTap(cardId: string) {
    const wasPlaced = burySlots.isPlaced(cardId);
    burySlots.toggleCard(cardId);
    if (wasPlaced) {
      setReturningCardIds((prev) => new Set(prev).add(cardId));
    }
  }
  const activeSelectedCardId = isHumanBidderInKittyExchange ? null : selectedCardId;
  const activeSelectCard = isHumanBidderInKittyExchange ? handleBurySlotTap : selectCard;

  const isPendingHuman = pendingPlay != null && pendingPlay.playerId === humanPlayerId;
  const humanGatheringCardId = gatheringTrick?.entries.find((entry) => entry.playerId === humanPlayerId)?.card.id;
  // While the human's own bury is staging, both the just-buried cards (hidden forever once
  // committed) and — once the reveal stage starts — the original kitty cards are shown instead
  // by the staged pile visuals (Step 3 below), so they're filtered out of the ordinary hand
  // render for the same reason a pending play/gathering card already is above. The two id sets
  // can overlap (the human may have chosen to bury some of the actual kitty cards) — a Set
  // naturally dedupes that.
  const kittyExchangeHiddenCardIds = new Set<string>();
  if (isHumanBidderInKittyExchange && state.kittyCardIds) {
    // The bidder chooses their bury from their ORIGINAL cards only (see rules.ts's
    // buriableCards) — the 4 kitty cards they just picked up (already merged into state via
    // selectTrump; the engine is always fully omniscient, same as every opponent hand) stay
    // hidden from the ordinary hand render for the entire kitty-exchange phase, not just once the
    // reveal animation starts. isHumanBidderInKittyExchange stays true through every stage of
    // pendingBury too (state.phase only advances to 'playing' once the staged sequence's final
    // performMove commits), so this single unconditional check already covers the old
    // "only once stage !== 'burying'" case below — that nested check is now provably redundant
    // and removed. Kitty cards become visible again only once the staged sequence actually
    // delivers them (pendingBury clears and phase advances, at which point
    // isHumanBidderInKittyExchange is false).
    state.kittyCardIds.forEach((id) => kittyExchangeHiddenCardIds.add(id));
  }
  if (pendingBury && pendingBury.playerId === humanPlayerId) {
    pendingBury.cardIds.forEach((id) => kittyExchangeHiddenCardIds.add(id));
  }
  const humanHand = state.table.zones[`hand-${humanPlayerId}`].cards.filter(
    (card) =>
      !(isPendingHuman && card.id === pendingPlay!.card.id) &&
      card.id !== humanGatheringCardId &&
      !burySlots.isPlaced(card.id) &&
      !kittyExchangeHiddenCardIds.has(card.id),
  );
  const sortedHand = sortHandForDisplay(humanHand);
  // Each card is assigned to a fixed top/bottom layer once — the first time this component sees
  // it with a non-empty hand, i.e. the initial deal — and never reassigned afterward, so a card
  // never crosses from one layer to the other as the hand shrinks (only its position *within* its
  // own layer reflows). splitTwoRows returns the larger half first; the bottom layer (closer to
  // the viewer) gets the extra card on an odd-sized hand, not the top — e.g. 13 cards is 6 top /
  // 7 bottom.
  const handLayerRef = useRef<Map<string, 'top' | 'bottom'>>(new Map());
  if (handLayerRef.current.size === 0 && sortedHand.length > 0) {
    // Initial deal: split the whole starting hand by splitTwoRows, as before.
    const [largerLayerCount] = splitTwoRows(sortedHand.length);
    const initialTopCount = sortedHand.length - largerLayerCount;
    sortedHand.forEach((card, i) => {
      handLayerRef.current.set(card.id, i < initialTopCount ? 'top' : 'bottom');
    });
  } else {
    // A card can join the hand after the initial deal too — Batak gömmeli's kitty pickup merges 4
    // cards into the bidder's hand mid-hand (selectTrump). Without this branch those cards would
    // have no handLayerRef entry and would match neither topRow's nor bottomRow's filter below —
    // i.e. render in neither row, invisible. Assign each newly-seen card to whichever row
    // currently holds fewer cards, keeping the two rows roughly balanced.
    sortedHand.forEach((card) => {
      if (handLayerRef.current.has(card.id)) return;
      const layers = [...handLayerRef.current.values()];
      const topCount = layers.filter((l) => l === 'top').length;
      const bottomCount = layers.length - topCount;
      handLayerRef.current.set(card.id, topCount <= bottomCount ? 'top' : 'bottom');
    });
  }
  const topRow = sortedHand.filter((card) => handLayerRef.current.get(card.id) === 'top');
  const bottomRow = sortedHand.filter((card) => handLayerRef.current.get(card.id) === 'bottom');
  const handSlots: HandSlot[] = [
    ...topRow.map((card, i): HandSlot => ({
      card,
      row: 'top',
      indexInRow: i,
      rowCount: topRow.length,
      enterFromOffset: returningCardIds.has(card.id) ? RETURN_TO_HAND_OFFSET : null,
    })),
    ...bottomRow.map((card, i): HandSlot => ({
      card,
      row: 'bottom',
      indexInRow: i,
      rowCount: bottomRow.length,
      enterFromOffset: returningCardIds.has(card.id) ? RETURN_TO_HAND_OFFSET : null,
    })),
  ];
  useEffect(() => {
    if (returningCardIds.size > 0) setReturningCardIds(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handSlots.map((s) => s.card.id).join(',')]);
  const legalCardIds = isHumanBidderInKittyExchange
    ? new Set(humanHand.map((c) => c.id))
    : new Set(legalMoves.filter((m): m is Extract<BatakMove, { type: 'play' }> => m.type === 'play').map((m) => m.cardId));

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

  // Anchored below the screen's true bottom edge (covers the full bottom side with margin to
  // spare — the overshoot itself is off-screen) while keeping the peak at the same height as
  // before. Width stays exactly windowWidth; only height is stretched (via HandFrame's `height`
  // prop + resizeMode="stretch") to satisfy both constraints — see HandFrame's prop doc.
  const handFramePeakTarget = TOP_ROW_PEAK_DISTANCE_FROM_BOTTOM + HAND_FRAME_REVEAL_MARGIN;
  const handFrameBottomOffset = -HAND_FRAME_BOTTOM_OVERSHOOT;
  const handFrameHeight = (handFramePeakTarget + HAND_FRAME_BOTTOM_OVERSHOOT) / (1 - HAND_FRAME_PEAK_FRACTION);

  return (
    <DeselectableSurface style={styles.container} onDeselect={clearSelection}>
      <TableFelt />
      <OpponentSeatGroup
        position="top"
        seats={seats}
        renderSeat={(seat) => (
          <OpponentSeat seat={seat} state={state} playerNames={playerNames} pendingPlay={pendingPlay} />
        )}
      />
      {opponentPlayerIds.length === 2 && (
        <KittyExchangeStagedPile
          state={state}
          pendingBury={pendingBury}
          humanPlayerId={humanPlayerId}
          seats={seats}
        />
      )}

      <View style={seatLayoutStyles.middleRow}>
        <OpponentSeatGroup
          position="left"
          seats={seats}
          renderSeat={(seat) => (
            <OpponentSeat seat={seat} state={state} playerNames={playerNames} pendingPlay={pendingPlay} />
          )}
        />

        {state.phase === 'bidding' && <BiddingCenter state={state} playerNames={playerNames} />}
        {state.phase === 'trump-selection' && state.bidWinner !== humanPlayerId && (
          <TrumpWaitingCenter state={state} playerNames={playerNames} />
        )}
        {state.phase === 'kitty-exchange' && (
          <KittyExchangeCenter
            state={state}
            playerNames={playerNames}
            humanPlayerId={humanPlayerId}
            slotCardIds={burySlots.slotCardIds}
            cardsById={new Map(state.table.zones[`hand-${humanPlayerId}`].cards.map((c) => [c.id, c]))}
            onTapSlotCard={handleBurySlotTap}
            canConfirm={burySlots.canConfirm}
            onConfirm={burySlots.confirm}
            pendingBury={pendingBury}
          />
        )}
        {state.phase === 'playing' && (
          <TrickCenter
            state={state}
            seats={seats}
            humanPlayerId={humanPlayerId}
            playerNames={playerNames}
            pendingPlay={pendingPlay}
            gatheringTrick={gatheringTrick}
            destRef={destRef}
            onDestLayout={handleDestLayout}
          />
        )}

        <OpponentSeatGroup
          position="right"
          seats={seats}
          renderSeat={(seat) => (
            <OpponentSeat seat={seat} state={state} playerNames={playerNames} pendingPlay={pendingPlay} />
          )}
        />
      </View>

      <HandFrame bottomOffset={handFrameBottomOffset} height={handFrameHeight} />
      <View style={styles.handArea}>
        <PlayerBadge
          name={playerNames[humanPlayerId] ?? 'You'}
          statusText={statusTextFor(state, humanPlayerId)}
          active={isHumanTurn}
          isHuman
        />
        <HumanHandFan
          slots={handSlots}
          legalCardIds={legalCardIds}
          isHumanInteractive={isHumanInteractive}
          selectedCardId={activeSelectedCardId}
          selectCard={activeSelectCard}
          playEntrance={dealPhase === 'revealing'}
          registerCardRef={registerHandCardRef}
          compact={opponentPlayerIds.length === 2}
        />
      </View>
      {dealPhase !== 'revealing' && <DealFlightOverlay seats={dealSeats} />}
      <CenteredDecisionModal
        raiseBy={PLATFORM_RAISE_BY}
        visible={state.phase === 'bidding' && isHumanInteractive && dealPhase === 'revealing'}>
        <BidControls legalMoves={legalMoves} onMove={onMove} />
      </CenteredDecisionModal>
      <CenteredDecisionModal
        raiseBy={PLATFORM_RAISE_BY}
        visible={state.phase === 'trump-selection' && state.bidWinner === humanPlayerId && dealPhase === 'revealing'}>
        <TrumpSuitPicker state={state} onMove={onMove} />
      </CenteredDecisionModal>
    </DeselectableSurface>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingVertical: 12 },
  opponentArea: {
    minHeight: 56,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    paddingVertical: 4,
  },
  pile: { alignItems: 'center', justifyContent: 'center', minHeight: 56 },
  // 300 hugs the playing-phase content at 'normal' card size (two 120px rows + 6px fan gap +
  // 4px area gap + badge ≈ 296). BidControls now renders in a CenteredDecisionModal rather than
  // here, so this height applies uniformly across every phase.
  handArea: {
    minHeight: 300,
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 4,
    gap: 4,
  },
});
