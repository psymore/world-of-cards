import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  LayoutChangeEvent,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import type { Card } from '@world-cards/engine';
import type { PistiState } from '@world-cards/engine/games/pisti';
import {
  PlayingCard,
  TableShell,
  SeatIdentity,
  HandFrame,
  HAND_FRAME_PEAK_FRACTION,
  CARD_DIMS,
  CONTAINER_BOTTOM_PADDING,
  HAND_BADGE_HEIGHT,
  HAND_FRAME_REVEAL_MARGIN,
  HAND_FRAME_BOTTOM_OVERSHOOT,
  WOOD_TRIM_COLOR,
  AVATAR_FRAME_IDLE_IMAGE,
  AVATAR_FRAME_NEXT_IMAGE,
  AVATAR_FRAME_ACTIVE_IMAGE,
} from '@world-cards/ui';
import type { SeatIdentityTurnState, SeatIdentityAvatar, SeatIdentityTurnStateFrames } from '@world-cards/ui';
import { DeselectableSurface } from '../../components/DeselectableSurface';
import { useCardSelection } from '../../components/useCardSelection';
import { OpponentSeatGroup, seatLayoutStyles } from '../../table/OpponentSeatGroup';
import {
  assignSeats,
  fillWidthMarginPx,
  resolveRevealOrigin,
  revealOriginOffset,
} from './pistiSeating';
import type { Seat } from './pistiSeating';
import { TravelCard } from '../../table/TravelCard';
import { DealFlightOverlay } from '../../table/DealFlightOverlay';
import type { DealFlightSeat } from '../../table/DealFlightOverlay';
import type { DealPhase } from '../../hooks/useDealSequence';
import { PistiHandFan, pistiCardRotationDeg } from './table/PistiHandFan';
import { useCardMotion } from '../../table/useCardMotion';

// The real per-state ring art (idle/next/active), replacing SeatIdentity's default glowShadow
// placeholder — see docs/superpowers/specs/2026-08-12-pisti-table-shell-pilot-design.md Decision 4.
// Sourced via named exports from @world-cards/ui rather than a direct
// require('@world-cards/ui/assets/...') — that package's `exports` map only publishes ".", so the
// asset subpath isn't resolvable from a consuming app.
const PISTI_TURN_STATE_FRAMES: SeatIdentityTurnStateFrames = {
  idle: AVATAR_FRAME_IDLE_IMAGE,
  next: AVATAR_FRAME_NEXT_IMAGE,
  active: AVATAR_FRAME_ACTIVE_IMAGE,
};

export interface PistiRevealCard {
  card: Card;
  playerId: string;
  originOffset?: { x: number; y: number };
  // The human's real fan-rotation angle at the moment this card was played, held fixed for the
  // whole flight and kept once landed (see pileRestingRotations below) — undefined/0 for AI plays
  // (no rendered AI hand card to derive an angle from, so they always land flat).
  originRotateDeg?: number;
}

export interface PistiTableProps {
  state: PistiState;
  humanPlayerId: string;
  // Ordered opponent seats: 1 entry seats them at the top (2-player table), 3 entries seat
  // them left/top/right around the human (4-player table).
  opponentPlayerIds: string[];
  playerNames: Record<string, string>;
  onPlayCard: (cardId: string, originOffset?: { x: number; y: number }, originRotateDeg?: number) => void;
  bannerText?: string | null;
  revealCard?: PistiRevealCard | null;
  dealPhase: DealPhase;
  // Each already-landed pile card's angle, keyed by card id — kept once a human-played card lands
  // (see PistiScreen.tsx), so the pile reads as a natural, slightly messy stack instead of every
  // card snapping flat the instant it's buried. Defaults to {} (today's flat-everywhere look) so
  // callers that don't pass it (tests) are unaffected.
  pileRestingRotations?: Record<string, number>;
}

// How many of the most recent pile cards to render stacked, plus one extra slot reserved
// for the in-flight reveal card. Older cards are fully covered anyway, so capping this
// keeps the pile view cheap even late in a hand.
const MAX_STACKED_PILE_CARDS = 5;

// Precomputed per-index offsets so stacking cost is a plain array lookup, not per-render math.
const PILE_CARD_OFFSETS = Array.from({ length: MAX_STACKED_PILE_CARDS + 1 }, (_, i) => ({
  x: i * 6,
  y: i * -4.5,
}));

const SMALL_CARD_WIDTH = CARD_DIMS.small.width;
const SMALL_CARD_HEIGHT = CARD_DIMS.small.height;
// Opponent hands render flat (no rotation/curve). Spacing auto-scales via fillWidthMarginPx: a
// small hand (Pişti's max-4 opponent cards) spreads into an evenly-gapped row (capped at
// *_MAX_GAP so it doesn't look sparse); a larger hand compresses into overlap automatically as
// count grows — one continuous rule instead of two separate "row" vs. "fan" modes.
const TOP_FAN_WIDTH_FRACTION = 0.85; // fraction of window width the top seat's row may use
const TOP_FAN_MAX_GAP = 10;
const SIDE_STACK_HEIGHT_FRACTION = 0.82; // fraction of the measured middle-row height the side stack may use
const SIDE_FAN_MAX_GAP = 10;

// First-pass constants for positioning HandFrame behind the human hand row, derived from this
// file's own layout below (not measured on a real device — tune these if the frame's arch peak
// doesn't line up with the hand row once visually checked). Simpler than Batak's version: Pişti's
// human hand is a single flat row (no curve/second row), so its "peak" is just the row's own top
// edge, uniform across every card.
const HUMAN_CARD_HEIGHT = CARD_DIMS.normal.height;
const HAND_AREA_HEIGHT = 177; // matches styles.handArea.minHeight
const HAND_CONTENT_HEIGHT = HAND_BADGE_HEIGHT + HUMAN_CARD_HEIGHT;
const HAND_AREA_TOP_INSET = (HAND_AREA_HEIGHT - HAND_CONTENT_HEIGHT) / 2;
// Distance from the container's true bottom edge (where HandFrame's own bottom:0 would sit,
// since absolute positioning ignores the container's own paddingVertical) up to the hand row's
// top edge.
const HAND_ROW_PEAK_DISTANCE_FROM_BOTTOM =
  CONTAINER_BOTTOM_PADDING + HAND_AREA_HEIGHT - HAND_AREA_TOP_INSET - HAND_BADGE_HEIGHT;

// Pişti's badge shows a captured-card count (🂠 N) rather than Batak's bid/tricks text — each
// game formats its own statusText string, the shared PlayerBadge just lays it out.
function capturedStatusText(capturedCount: number): string {
  return `🂠 ${capturedCount}`;
}

// Real turn order from engine state, replacing the Playground prototype's clockwise-seat-order
// approximation — active/next both derive from state.players/state.currentPlayerIndex, which is
// already a plain round-robin (packages/engine/src/games/pisti/rules.ts's nextIndex derivation).
export function turnStateForPlayer(playerId: string, state: PistiState): SeatIdentityTurnState {
  if (state.players[state.currentPlayerIndex] === playerId) return 'active';
  const nextIndex = (state.currentPlayerIndex + 1) % state.players.length;
  if (state.players[nextIndex] === playerId) return 'next';
  return 'idle';
}

// Fixed by seat position, not derived from player identity (docs/superpowers/specs/2026-08-12-
// pisti-table-shell-pilot-design.md Decision 6) — the simplest deterministic scheme.
export const AVATAR_BY_POSITION: Record<'top' | 'left' | 'right' | 'bottom', SeatIdentityAvatar> = {
  top: 'female-01',
  left: 'male-01',
  right: 'male-02',
  bottom: 'female-02',
};

// The opponent's face-down card stack only. The nameplate half of what used to be one combined
// `OpponentSeat` now renders separately via renderOpponentNameplate below, because the two halves
// no longer live in the same place on screen: nameplates are handed to TableShell, which draws
// them inside its own baked plaque anchors, while the card stacks stay in this file's own
// top-row/middle-row flex layout.
interface OpponentHandStackProps {
  seat: Seat;
  state: PistiState;
  revealCard?: PistiRevealCard | null;
  dealPhase: DealPhase;
  // Measured height of the middle row (see PistiTable's onLayout below) — the real available
  // vertical space for a side seat's card stack, which can't be derived from window height alone
  // since the side seats live inside a centered (non-stretching) flex row.
  sideStackHeight: number;
}

function OpponentHandStack({ seat, state, revealCard, dealPhase, sideStackHeight }: OpponentHandStackProps) {
  const { position, playerId } = seat;
  const isSide = position !== 'top';
  const hand = state.table.zones[`hand-${playerId}`].cards;
  const isRevealing = revealCard != null && revealCard.playerId === playerId;
  // No face-down cards render until the deal-flight animation finishes, so the opponent's hand
  // doesn't pop in ahead of the cards that are still visually traveling toward them.
  const count = dealPhase !== 'revealing' ? 0 : Math.max(isRevealing ? hand.length - 1 : hand.length, 0);

  const { width: windowWidth } = useWindowDimensions();
  const cardMargin = isSide
    ? fillWidthMarginPx(SMALL_CARD_HEIGHT, count, sideStackHeight * SIDE_STACK_HEIGHT_FRACTION, SIDE_FAN_MAX_GAP)
    : fillWidthMarginPx(SMALL_CARD_WIDTH, count, windowWidth * TOP_FAN_WIDTH_FRACTION, TOP_FAN_MAX_GAP);
  // Precomputed per-index style array (stable reference when count/cardMargin/isSide don't
  // change) so PlayingCard's React.memo can still skip re-rendering unchanged face-down cards —
  // the same reasoning as the PILE_CARD_OFFSETS array above, just computed dynamically instead
  // of statically since the margin now depends on measured layout.
  const cardStyles = useMemo(
    () =>
      Array.from({ length: count }, (_, i) =>
        i === 0 ? undefined : isSide ? { marginTop: cardMargin } : { marginLeft: cardMargin }
      ),
    [count, cardMargin, isSide]
  );

  return (
    <View
      style={[
        styles.opponentArea,
        isSide ? seatLayoutStyles.opponentAreaSide : styles.opponentAreaTop,
      ]}>
      <View style={isSide ? styles.opponentColumn : styles.opponentRow} testID={`opponent-hand-${playerId}`}>
        {cardStyles.map((style, i) => (
          <PlayingCard key={i} faceDown size="small" style={style} />
        ))}
      </View>
    </View>
  );
}

// The nameplate half of the old OpponentSeat: a plain function (not a component) because its
// output is handed to TableShell as a `seats` entry, which renders it inside its own anchor View
// — there's no separate element for a component wrapper to own here.
function renderOpponentNameplate(seat: Seat, state: PistiState, playerNames: Record<string, string>) {
  const { position, playerId } = seat;
  const capturedCount = state.table.zones[`captured-${playerId}`].cards.length;
  const orientation = position === 'left' ? 'rotated-left' : position === 'right' ? 'rotated-right' : 'horizontal';
  return (
    <SeatIdentity
      name={playerNames[playerId] ?? playerId}
      statusText={capturedStatusText(capturedCount)}
      orientation={orientation}
      avatar={AVATAR_BY_POSITION[position]}
      turnState={turnStateForPlayer(playerId, state)}
      turnStateFrames={PISTI_TURN_STATE_FRAMES}
    />
  );
}

export function PistiTable({
  state,
  humanPlayerId,
  opponentPlayerIds,
  playerNames,
  onPlayCard,
  bannerText,
  revealCard,
  dealPhase,
  pileRestingRotations = {},
}: PistiTableProps) {
  const isHumanTurn = state.players[state.currentPlayerIndex] === humanPlayerId;
  // While the human's own play is revealing (traveling to the pile), the engine state hasn't
  // committed the move yet, so `isHumanTurn` alone would still say it's their turn. Hide the
  // in-flight card from the hand row (it's already rendered via TravelCard at the pile) and treat
  // the hand as non-interactive until the move actually commits.
  const isHumanRevealing = revealCard != null && revealCard.playerId === humanPlayerId;
  const isHumanInteractive = isHumanTurn && !isHumanRevealing;
  const humanHand = state.table.zones[`hand-${humanPlayerId}`].cards.filter(
    (card) => !(isHumanRevealing && card.id === revealCard!.card.id)
  );
  const pile = state.table.zones['pile'].cards;
  const stackedPile = pile.slice(-MAX_STACKED_PILE_CARDS);
  // Where the just-played card actually ends up once it commits and joins `pile`: stackedPile
  // always renders the newest card at its own last index, which is `pile.length` (pre-commit)
  // while the stack is still filling up, then pins to MAX_STACKED_PILE_CARDS - 1 once the pile
  // has enough cards that older ones start falling out of the slice(-N) window. RevealCard's
  // flight must target this same slot — a fixed "reserved 6th slot" only coincidentally matched
  // it once the pile already held 5+ cards, and was off by one slot even then, so the flight
  // eased to a stop at the wrong spot and then snapped to the real one once the card committed.
  const revealDestinationOffset = PILE_CARD_OFFSETS[Math.min(pile.length, MAX_STACKED_PILE_CARDS - 1)];
  const capturedHuman = state.table.zones[`captured-${humanPlayerId}`].cards.length;

  const { selectedCardId, selectCard, clearSelection } = useCardSelection(playWithMeasuredOrigin);
  useEffect(() => {
    if (!isHumanTurn) clearSelection();
  }, [isHumanTurn, clearSelection]);

  const seats = assignSeats(opponentPlayerIds);

  // Every seat's nameplate, keyed by the table position TableShell draws it at. The human's is
  // built inline (its data comes straight from this function's own scope); the opponents' come
  // from renderOpponentNameplate, which each seat's own zones supply.
  const tableShellSeats: Partial<Record<'top' | 'bottom' | 'left' | 'right', React.ReactNode>> = {
    bottom: (
      <SeatIdentity
        name={playerNames[humanPlayerId] ?? 'You'}
        statusText={capturedStatusText(capturedHuman)}
        avatar={AVATAR_BY_POSITION.bottom}
        turnState={turnStateForPlayer(humanPlayerId, state)}
        turnStateFrames={PISTI_TURN_STATE_FRAMES}
      />
    ),
  };
  for (const seat of seats) {
    tableShellSeats[seat.position] = renderOpponentNameplate(seat, state, playerNames);
  }

  // Side seats live inside a centered (non-stretching) flex row, so there's no way to derive
  // their available vertical space from window height alone — measure the row itself. 280 is a
  // reasonable pre-layout guess (corrected after the first onLayout pass), the same pattern
  // BatakTable's handAreaWidth already uses for its own width-fill measurement.
  const [middleRowHeight, setMiddleRowHeight] = useState(280);
  function handleMiddleRowLayout(event: LayoutChangeEvent) {
    setMiddleRowHeight(event.nativeEvent.layout.height);
  }

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

  const handFanRef = useRef<View>(null);
  const [handFanOrigin, setHandFanOrigin] = useState<{ x: number; y: number } | null>(null);
  function handleHandFanLayout() {
    handFanRef.current?.measureInWindow((x, y, width) => {
      setHandFanOrigin({ x: x + width / 2, y });
    });
  }

  const handMotionRef = useRef(new Map<string, ReturnType<typeof useCardMotion>>()).current;
  const registerHandMotion = useCallback(
    (cardId: string, motion: ReturnType<typeof useCardMotion> | null) => {
      if (motion) handMotionRef.set(cardId, motion);
      else handMotionRef.delete(cardId);
    },
    [handMotionRef],
  );

  // Replaces a direct onPlayCard(cardId) call: reads the tapped card's real, currently-committed
  // motion (position it's actually rendered at, lift included) directly from its own useCardMotion
  // controller, converted into a delta from the pile's measured center — no DOM re-derivation, no
  // staleness risk (mirrors BatakTable's playWithMeasuredOrigin, post-fix — see
  // docs/superpowers/specs/2026-08-06-pisti-hand-fan-gesture-migration-design.md §3). Falls back to
  // a plain onPlayCard(cardId) call (no origin — the pile-landing flight then uses the fixed
  // 'bottom' offset, same as today) whenever any measurement isn't ready, which is always the case
  // in this project's Jest/RNTL tests (host refs never resolve there) and is a defensive path on a
  // real device too.
  function playWithMeasuredOrigin(cardId: string) {
    const index = humanHand.findIndex((c) => c.id === cardId);
    if (!handFanOrigin || !destCenter || index < 0) {
      onPlayCard(cardId);
      return;
    }
    const originRotateDeg = pistiCardRotationDeg(index, humanHand.length);
    const motion = handMotionRef.get(cardId);
    if (!motion) {
      onPlayCard(cardId);
      return;
    }
    const values = motion.getValues();
    onPlayCard(
      cardId,
      {
        x: handFanOrigin.x + values.x - destCenter.x,
        y: handFanOrigin.y + values.y - destCenter.y,
      },
      originRotateDeg,
    );
  }

  // Deal order: human first, then opponents in existing turn order. Card counts come from the
  // real dealt hand size, not a hardcoded 4, so this stays correct for both the 2-player and
  // 4-player table.
  const dealSeats: DealFlightSeat[] = [
    { origin: 'bottom', cardCount: state.table.zones[`hand-${humanPlayerId}`].cards.length },
    ...opponentPlayerIds.map((playerId) => ({
      origin: resolveRevealOrigin(playerId, humanPlayerId, seats),
      cardCount: state.table.zones[`hand-${playerId}`].cards.length,
    })),
  ];

  // Anchored below the screen's true bottom edge (covers the full bottom side with margin to
  // spare — the overshoot itself is off-screen) while keeping the peak at the same height as
  // before. Width stays exactly windowWidth; only height is stretched (via HandFrame's `height`
  // prop + resizeMode="stretch") to satisfy both constraints — see HandFrame's prop doc.
  const handFramePeakTarget = HAND_ROW_PEAK_DISTANCE_FROM_BOTTOM + HAND_FRAME_REVEAL_MARGIN;
  const handFrameBottomOffset = -HAND_FRAME_BOTTOM_OVERSHOOT;
  const handFrameHeight =
    (handFramePeakTarget + HAND_FRAME_BOTTOM_OVERSHOOT) / (1 - HAND_FRAME_PEAK_FRACTION);

  return (
    <DeselectableSurface style={styles.container} onDeselect={clearSelection}>
      <View style={styles.tableArea}>
        <TableShell seats={tableShellSeats}>
          <View style={styles.pileMat} ref={destRef} onLayout={handlePileMatLayout}>
            <View style={styles.pileStack}>
              {stackedPile.map((card, i) => (
                <View
                  key={card.id}
                  style={[
                    styles.pileCardSlot,
                    {
                      zIndex: i,
                      transform: [
                        { translateX: PILE_CARD_OFFSETS[i].x },
                        { translateY: PILE_CARD_OFFSETS[i].y },
                        { rotate: `${pileRestingRotations[card.id] ?? 0}deg` },
                      ],
                    },
                  ]}
                >
                  <PlayingCard card={card} />
                </View>
              ))}
              {revealCard && (
                <>
                  <Text style={styles.revealLabel}>
                    {revealCard.playerId === humanPlayerId
                      ? 'You played'
                      : `${playerNames[revealCard.playerId] ?? revealCard.playerId} played`}
                  </Text>
                  <View
                    style={[
                      styles.pileCardSlot,
                      {
                        zIndex: MAX_STACKED_PILE_CARDS + 1,
                        transform: [
                          { translateX: revealDestinationOffset.x },
                          { translateY: revealDestinationOffset.y },
                        ],
                      },
                    ]}
                  >
                    <TravelCard
                      originOffset={
                        revealCard.originOffset ??
                        revealOriginOffset(resolveRevealOrigin(revealCard.playerId, humanPlayerId, seats))
                      }
                      originRotateDeg={revealCard.originRotateDeg ?? 0}
                      resetKey={revealCard.card.id}
                    >
                      <PlayingCard card={revealCard.card} highlighted />
                    </TravelCard>
                  </View>
                </>
              )}
            </View>
            <Text style={styles.pileCount}>{`${pile.length} card${pile.length === 1 ? '' : 's'}`}</Text>
          </View>
        </TableShell>

        <View style={styles.handStackOverlay} pointerEvents="box-none">
          <OpponentSeatGroup
            position="top"
            seats={seats}
            renderSeat={(seat) => (
              <OpponentHandStack seat={seat} state={state} revealCard={revealCard} dealPhase={dealPhase} sideStackHeight={middleRowHeight} />
            )}
          />
          <View
            style={[seatLayoutStyles.middleRow, styles.middleRowInset]}
            onLayout={handleMiddleRowLayout}
            pointerEvents="box-none"
          >
            <OpponentSeatGroup
              position="left"
              seats={seats}
              renderSeat={(seat) => (
                <OpponentHandStack seat={seat} state={state} revealCard={revealCard} dealPhase={dealPhase} sideStackHeight={middleRowHeight} />
              )}
            />
            <View style={styles.pileSpacer} pointerEvents="none" />
            <OpponentSeatGroup
              position="right"
              seats={seats}
              renderSeat={(seat) => (
                <OpponentHandStack seat={seat} state={state} revealCard={revealCard} dealPhase={dealPhase} sideStackHeight={middleRowHeight} />
              )}
            />
          </View>
        </View>
      </View>

      <View style={styles.bannerArea}>{bannerText ? <Text style={styles.banner}>{bannerText}</Text> : null}</View>

      <HandFrame bottomOffset={handFrameBottomOffset} height={handFrameHeight} />
      <View style={styles.handArea}>
        <PistiHandFan
          slots={
            dealPhase === 'revealing'
              ? humanHand.map((card, index) => ({ card, index, count: humanHand.length }))
              : []
          }
          isHumanInteractive={isHumanInteractive}
          selectedCardId={selectedCardId}
          selectCard={selectCard}
          registerHandMotion={registerHandMotion}
          handFanRef={handFanRef}
          onHandFanLayout={handleHandFanLayout}
        />
      </View>
      {dealPhase !== 'revealing' && <DealFlightOverlay seats={dealSeats} />}
    </DeselectableSurface>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingVertical: 12 },
  opponentArea: { minHeight: 135, justifyContent: 'center', alignItems: 'center', borderRadius: 12, paddingVertical: 4 },
  // Top opponent only: a fixed (not minHeight-floored) height and a top-anchored badge, so neither
  // the box nor the badge moves when the face-down row empties out at the end of a hand — with
  // justifyContent: 'center' (opponentArea's own default), a taller badge+row block (cards present)
  // vs. a shorter one (row collapsed to 0 height, no cards) recenter to different positions, which
  // read as the badge (and everything visually anchored near it, including the trick pile just
  // below) jumping at that exact moment. Height is derived, not guessed: badge height + one row of
  // face-down cards + the area's own paddingVertical (4 top + 4 bottom).
  opponentAreaTop: { height: HAND_BADGE_HEIGHT + SMALL_CARD_HEIGHT + 8, justifyContent: 'flex-start' },
  handArea: { minHeight: 177, justifyContent: 'center', borderRadius: 12, paddingVertical: 4 },
  opponentRow: { flexDirection: 'row', justifyContent: 'center' },
  opponentColumn: { flexDirection: 'column', alignItems: 'center' },
  // Wraps TableShell plus the overlaid opponent card-stacks so they share one positioning
  // context — everything in here visually belongs to "the table," even though the pile and
  // nameplates render inside TableShell while the card stacks render as siblings above it.
  // `flex: 1` (rather than an auto height) is what actually reserves the table its share of the
  // screen: TableShell's own root is flex: 1, so with an auto-height parent it would collapse to
  // its intrinsic aspect-ratio height and every following sibling (banner, hand area) would be
  // pushed past the bottom of the screen instead of sharing the remaining space.
  tableArea: { flex: 1, position: 'relative' },
  // The card stacks overlay TableShell rather than stacking below it: they're an absolute layer
  // over the exact same box, so they read as cards lying on the table instead of the whole
  // table+stacks column growing taller than the screen. `pointerEvents="box-none"` here and on
  // middleRow so the table underneath still receives taps. (Longhand rather than
  // StyleSheet.absoluteFillObject, which isn't a TypeScript-visible API on this RN version — see
  // TableShell.tsx's `fill` style for the same note.)
  //
  // The two insets keep the stacks off TableShell's baked plaques, which the stacks would
  // otherwise cover completely: `top` drops the top seat's card row below the top plaque, and
  // `bottom` shortens the middle row — the side stacks size themselves from its measured height —
  // so their lower ends stay clear of the human's own plaque. Percentages, not pixels, so they
  // track the table box, which is itself sized as a fraction of the screen. Eyeballed against the
  // rendered table rather than derived; provisional tuning the plan's visual pass may revisit.
  handStackOverlay: { position: 'absolute', top: '13%', left: 0, right: 0, bottom: '15%' },
  // Same idea on the other axis: pushes the left/right card columns inboard of the side plaques so
  // they sit on the felt beside each nameplate instead of on top of it. Kept as a Pişti-local
  // style rather than folded into the shared seatLayoutStyles.opponentAreaSide, which Batak's
  // table also uses. 21% is a compromise, not a clean fit — at phone width the felt isn't wide
  // enough for two card columns, the pile, AND both side plaques to be mutually clear, so this
  // leaves a few px of overlap at each column's inner and outer edge instead of fully hiding
  // either the plaques (a smaller inset) or the pile (a larger one). Flagged for the visual pass.
  middleRowInset: { paddingHorizontal: '21%' },
  // Occupies the middle row's center slot now that the pile itself lives inside TableShell as
  // its `children` — without this, middleRow's `justifyContent: 'space-between'` would pull the
  // left/right card stacks together with no gap between them.
  pileSpacer: { flex: 1 },
  pileMat: {
    width: 195,
    height: 225,
    borderRadius: 98,
    backgroundColor: 'rgba(0, 0, 0, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pileStack: { width: 114, height: 144 },
  pileCardSlot: { position: 'absolute', left: 0, bottom: 0 },
  revealLabel: {
    position: 'absolute',
    top: -24,
    left: -32,
    width: 140,
    fontSize: 12,
    fontWeight: '700',
    color: '#fff8dc',
    textAlign: 'center',
  },
  pileCount: { marginTop: 8, fontSize: 13, color: '#f5f0e6' },
  bannerArea: { minHeight: 24, alignItems: 'center', justifyContent: 'center' },
  banner: { fontSize: 16, fontWeight: '700', color: WOOD_TRIM_COLOR },
});
