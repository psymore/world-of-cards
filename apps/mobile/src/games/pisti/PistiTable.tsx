import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
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
  TableFelt,
  HandFrame,
  HAND_FRAME_PEAK_FRACTION,
  CARD_DIMS,
  CONTAINER_BOTTOM_PADDING,
  HAND_BADGE_HEIGHT,
  HAND_FRAME_REVEAL_MARGIN,
  HAND_FRAME_BOTTOM_OVERSHOOT,
} from '@world-cards/ui';
import { SelectableCard, DEFAULT_LIFT_DISTANCE } from '../../components/SelectableCard';
import { DeselectableSurface } from '../../components/DeselectableSurface';
import { useCardSelection } from '../../components/useCardSelection';
import { useReducedMotion } from '../../components/useReducedMotion';
import { PlayerBadge } from '../../table/PlayerBadge';
import { OpponentSeatGroup, seatLayoutStyles } from '../../table/OpponentSeatGroup';
import {
  assignSeats,
  fillWidthMarginPx,
  resolveRevealOrigin,
  revealOriginOffset,
} from './pistiSeating';
import type { RevealOrigin, Seat } from './pistiSeating';
import { CARD_TRAVEL_DURATION_MS, CARD_TRAVEL_EASING } from '../../table/travelAnimation';
import { DealFlightOverlay } from '../../table/DealFlightOverlay';
import type { DealFlightSeat } from '../../table/DealFlightOverlay';
import type { DealPhase } from '../../hooks/useDealSequence';

export interface PistiRevealCard {
  card: Card;
  playerId: string;
  originOffset?: { x: number; y: number };
}

export interface PistiTableProps {
  state: PistiState;
  humanPlayerId: string;
  // Ordered opponent seats: 1 entry seats them at the top (2-player table), 3 entries seat
  // them left/top/right around the human (4-player table).
  opponentPlayerIds: string[];
  playerNames: Record<string, string>;
  onPlayCard: (cardId: string, originOffset?: { x: number; y: number }) => void;
  bannerText?: string | null;
  revealCard?: PistiRevealCard | null;
  dealPhase: DealPhase;
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

// The human hand row used to be plain flex children (`handRow`'s old flexDirection/gap), which
// reflow instantly (no animation) whenever a card is removed — playing a card snapped the
// remaining hand straight to its new layout. Each card now gets its own absolutely-positioned
// slot (centered around the row's midpoint, same spacing the old `gap: 8` produced) driven by an
// Animated translateX that eases to a new target whenever its index/count within the hand changes
// — mirrors Batak's AnimatedFanCard reflow (HumanHandFan.tsx), just single-row/no-curve since
// Pişti's hand never exceeds 4 cards and doesn't fan.
const HAND_CARD_GAP = 8; // matches the pre-existing handRow gap
const HAND_CARD_STEP = CARD_DIMS.normal.width + HAND_CARD_GAP;
const HAND_CARD_REPOSITION_DURATION_MS = 220;
const HAND_CARD_REPOSITION_EASING = Easing.inOut(Easing.ease);

// Horizontal offset from the row's own center — negative/positive symmetric around 0, matching
// styles.handCardSlot's `left: '50%'` anchor regardless of hand size.
function handCardSlotX(index: number, count: number): number {
  return (index - (count - 1) / 2) * HAND_CARD_STEP;
}

function AnimatedHandCard({
  card,
  index,
  count,
  selected,
  disabled,
  onPress,
}: {
  card: Card;
  index: number;
  count: number;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const targetX = handCardSlotX(index, count);
  const x = useRef(new Animated.Value(targetX)).current;
  const mounted = useRef(false);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (!mounted.current) {
      // First render (initial deal, or a stock-redeal adding a fresh card): jump straight to its
      // slot — there's no prior position to reflow from.
      mounted.current = true;
      return;
    }
    if (reducedMotion) {
      x.setValue(targetX);
      return;
    }
    Animated.timing(x, {
      toValue: targetX,
      duration: HAND_CARD_REPOSITION_DURATION_MS,
      easing: HAND_CARD_REPOSITION_EASING,
      useNativeDriver: true,
    }).start();
  }, [targetX, reducedMotion, x]);

  return (
    <Animated.View style={[styles.handCardSlot, { transform: [{ translateX: x }] }]}>
      <SelectableCard card={card} selected={selected} disabled={disabled} onPress={onPress} />
    </Animated.View>
  );
}

function RevealCard({
  revealCard,
  label,
  originDirection,
  destinationOffset,
}: {
  revealCard: PistiRevealCard;
  label: string;
  originDirection: RevealOrigin;
  // The pile slot this card will actually rest at once it commits (see revealDestinationOffset
  // where this is computed) — the flight must end exactly here, not a fixed "reserved slot", or
  // the swap from this animated card to the real static one snaps by the difference.
  destinationOffset: { x: number; y: number };
}) {
  const anim = useRef(new Animated.Value(0)).current;
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    // With reduce-motion on, the card appears already at rest instead of traveling in — an
    // instant transition rather than the full directional-travel effect.
    if (reducedMotion) {
      anim.setValue(1);
      return;
    }
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1,
      duration: CARD_TRAVEL_DURATION_MS,
      easing: CARD_TRAVEL_EASING,
      useNativeDriver: true,
    }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealCard.card.id, reducedMotion]);

  const offset = destinationOffset;
  const origin = revealCard.originOffset ?? revealOriginOffset(originDirection);

  return (
    <>
      <Text style={styles.revealLabel}>{label}</Text>
      <Animated.View
        style={[
          styles.pileCardSlot,
          {
            zIndex: MAX_STACKED_PILE_CARDS + 1,
            // Fully opaque/full-size for the entire flight (no fade-in or scale-up) so the card
            // reads as physically traveling along the path, not materializing at the end of it —
            // see docs/superpowers/specs/2026-07-18-card-travel-full-visibility-design.md.
            transform: [
              {
                translateX: anim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [offset.x + origin.x, offset.x],
                }),
              },
              {
                translateY: anim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [offset.y + origin.y, offset.y],
                }),
              },
            ],
          },
        ]}
      >
        <PlayingCard card={revealCard.card} highlighted />
      </Animated.View>
    </>
  );
}

// Pişti's badge shows a captured-card count (🂠 N) rather than Batak's bid/tricks text — each
// game formats its own statusText string, the shared PlayerBadge just lays it out.
function capturedStatusText(capturedCount: number): string {
  return `🂠 ${capturedCount}`;
}

interface OpponentSeatProps {
  seat: Seat;
  state: PistiState;
  playerNames: Record<string, string>;
  revealCard?: PistiRevealCard | null;
  dealPhase: DealPhase;
  // Measured height of the middle row (see PistiTable's onLayout below) — the real available
  // vertical space for a side seat's card stack, which can't be derived from window height alone
  // since the side seats live inside a centered (non-stretching) flex row.
  sideStackHeight: number;
}

function OpponentSeat({ seat, state, playerNames, revealCard, dealPhase, sideStackHeight }: OpponentSeatProps) {
  const { position, playerId } = seat;
  const isSide = position !== 'top';
  const hand = state.table.zones[`hand-${playerId}`].cards;
  const isRevealing = revealCard != null && revealCard.playerId === playerId;
  // No face-down cards render until the deal-flight animation finishes, so the opponent's hand
  // doesn't pop in ahead of the cards that are still visually traveling toward them.
  const count = dealPhase !== 'revealing' ? 0 : Math.max(isRevealing ? hand.length - 1 : hand.length, 0);
  const capturedCount = state.table.zones[`captured-${playerId}`].cards.length;
  const isCurrentTurn = state.players[state.currentPlayerIndex] === playerId;

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
    <View style={[styles.opponentArea, isSide && seatLayoutStyles.opponentAreaSide, isCurrentTurn && styles.activeArea]}>
      <PlayerBadge
        name={playerNames[playerId] ?? playerId}
        statusText={capturedStatusText(capturedCount)}
        active={isCurrentTurn}
        isHuman={false}
        compact={isSide}
      />
      <View style={isSide ? styles.opponentColumn : styles.opponentRow} testID={`opponent-hand-${playerId}`}>
        {cardStyles.map((style, i) => (
          <PlayingCard key={i} faceDown size="small" style={style} />
        ))}
      </View>
    </View>
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
}: PistiTableProps) {
  const isHumanTurn = state.players[state.currentPlayerIndex] === humanPlayerId;
  // While the human's own play is revealing (traveling to the pile), the engine state hasn't
  // committed the move yet, so `isHumanTurn` alone would still say it's their turn. Hide the
  // in-flight card from the hand row (it's already rendered by RevealCard at the pile) and treat
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

  // The hand row's own on-screen center — measured once (re-measured on every layout pass, same
  // as destCenter above) directly off the row container, which carries no transform of its own
  // (only its individual cards do, via AnimatedHandCard's translateX). Deliberately NOT measuring
  // an individual card and adding handCardSlotX's offset to it: whether measureInWindow on a node
  // reflects an *ancestor's* transform (as opposed to a descendant's, which every RN platform
  // agrees never affects it) is platform-dependent — if the runtime already includes it, adding
  // the offset again double-counts it, pushing the card further off-center than it should go
  // (worse the further from center the card sits — exactly the "jumps left/right" symptom this
  // replaced). Measuring the untransformed row itself and adding the known, deterministic
  // handCardSlotX offset sidesteps that ambiguity entirely, the same way the Y-lift correction
  // below avoids depending on whether a *descendant* transform is reflected.
  const handRowRef = useRef<View>(null);
  const [handRowCenter, setHandRowCenter] = useState<{ x: number; y: number } | null>(null);
  function handleHandRowLayout() {
    handRowRef.current?.measureInWindow((x, y, width, height) => {
      setHandRowCenter({ x: x + width / 2, y: y + height / 2 });
    });
  }

  // Replaces a direct onPlayCard(cardId) call: computes the tapped card's real on-screen position
  // relative to the pile's, so the reveal travels from where the card actually was. Purely
  // arithmetic (no per-card measurement, no async callback) — every card in the row shares the
  // same measured row center and only differs by its own deterministic handCardSlotX offset.
  // Falls back to a plain onPlayCard(cardId) call (no origin — RevealCard then uses the fixed
  // 'bottom' offset, same as today) whenever either measurement isn't ready, which is always the
  // case in this project's Jest/RNTL tests (host refs never resolve there — no createNodeMock
  // configured) and is a defensive path on a real device too.
  function playWithMeasuredOrigin(cardId: string) {
    if (!handRowCenter || !destCenter) {
      onPlayCard(cardId);
      return;
    }
    const index = humanHand.findIndex((c) => c.id === cardId);
    const rowOffsetX = index >= 0 ? handCardSlotX(index, humanHand.length) : 0;
    onPlayCard(cardId, {
      x: handRowCenter.x + rowOffsetX - destCenter.x,
      // This card is necessarily selected (playWithMeasuredOrigin only ever fires as the
      // confirming second tap on an already-selected card), so it's currently lifted by exactly
      // DEFAULT_LIFT_DISTANCE — see that constant's doc for why this can't just be measured off
      // the transformed node directly.
      y: handRowCenter.y - DEFAULT_LIFT_DISTANCE - destCenter.y,
    });
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
      <TableFelt />
      <OpponentSeatGroup
        position="top"
        seats={seats}
        renderSeat={(seat) => (
          <OpponentSeat
            seat={seat}
            state={state}
            playerNames={playerNames}
            revealCard={revealCard}
            dealPhase={dealPhase}
            sideStackHeight={middleRowHeight}
          />
        )}
      />

      <View style={seatLayoutStyles.middleRow} onLayout={handleMiddleRowLayout}>
        <OpponentSeatGroup
          position="left"
          seats={seats}
          renderSeat={(seat) => (
            <OpponentSeat
              seat={seat}
              state={state}
              playerNames={playerNames}
              revealCard={revealCard}
              dealPhase={dealPhase}
              sideStackHeight={middleRowHeight}
            />
          )}
        />

        <View style={styles.pileArea}>
          <View style={styles.pileMat} ref={destRef} onLayout={handlePileMatLayout}>
            <View style={styles.pileStack}>
              {stackedPile.map((card, i) => (
                <View
                  key={card.id}
                  style={[
                    styles.pileCardSlot,
                    {
                      zIndex: i,
                      transform: [{ translateX: PILE_CARD_OFFSETS[i].x }, { translateY: PILE_CARD_OFFSETS[i].y }],
                    },
                  ]}
                >
                  <PlayingCard card={card} />
                </View>
              ))}
              {revealCard && (
                <RevealCard
                  revealCard={revealCard}
                  destinationOffset={revealDestinationOffset}
                  label={
                    revealCard.playerId === humanPlayerId
                      ? 'You played'
                      : `${playerNames[revealCard.playerId] ?? revealCard.playerId} played`
                  }
                  originDirection={resolveRevealOrigin(revealCard.playerId, humanPlayerId, seats)}
                />
              )}
            </View>
            <Text style={styles.pileCount}>{`${pile.length} card${pile.length === 1 ? '' : 's'}`}</Text>
          </View>
        </View>

        <OpponentSeatGroup
          position="right"
          seats={seats}
          renderSeat={(seat) => (
            <OpponentSeat
              seat={seat}
              state={state}
              playerNames={playerNames}
              revealCard={revealCard}
              dealPhase={dealPhase}
              sideStackHeight={middleRowHeight}
            />
          )}
        />
      </View>

      <View style={styles.bannerArea}>{bannerText ? <Text style={styles.banner}>{bannerText}</Text> : null}</View>

      <HandFrame bottomOffset={handFrameBottomOffset} height={handFrameHeight} />
      <View style={[styles.handArea, isHumanInteractive && styles.activeArea]}>
        <View style={styles.handRow} testID="human-hand" ref={handRowRef} onLayout={handleHandRowLayout}>
          {dealPhase === 'revealing' &&
            humanHand.map((card, index) => (
              // Off-turn "not tappable" styling comes from SelectableCard's own disabled scrim
              // now (a dark overlay keeping the card art fully visible), replacing the old
              // 0.5-opacity wrapper — keeping both would double-dim the hand.
              <AnimatedHandCard
                key={card.id}
                card={card}
                index={index}
                count={humanHand.length}
                selected={selectedCardId === card.id}
                disabled={!isHumanInteractive}
                onPress={() => selectCard(card.id)}
              />
            ))}
        </View>
        <PlayerBadge name={playerNames[humanPlayerId] ?? 'You'} statusText={capturedStatusText(capturedHuman)} active={isHumanTurn} isHuman />
      </View>
      {dealPhase !== 'revealing' && <DealFlightOverlay seats={dealSeats} />}
    </DeselectableSurface>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingVertical: 12 },
  opponentArea: { minHeight: 135, justifyContent: 'center', alignItems: 'center', borderRadius: 12, paddingVertical: 4 },
  handArea: { minHeight: 177, justifyContent: 'center', borderRadius: 12, paddingVertical: 4 },
  activeArea: { backgroundColor: 'rgba(244, 197, 66, 0.14)' },
  opponentRow: { flexDirection: 'row', justifyContent: 'center' },
  opponentColumn: { flexDirection: 'column', alignItems: 'center' },
  // Same cross-subtree reasoning as seatLayoutStyles.middleRow's own zIndex, one level down:
  // outranks the left/right OpponentSeatGroup siblings within middleRow, so a reveal traveling
  // from either side seat paints above that seat's own remaining cards too.
  pileArea: { flex: 1, alignItems: 'center', justifyContent: 'center', zIndex: 10 },
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
  banner: { fontSize: 16, fontWeight: '700', color: '#ffd966' },
  // Fixed height since every card inside is now absolutely positioned (see AnimatedHandCard) and
  // can no longer contribute to an auto-computed height the way normal-flow flex children would.
  handRow: { height: HUMAN_CARD_HEIGHT },
  // Each hand card's positioning anchor: centered horizontally (left: '50%' + a negative
  // marginLeft of half the card's own width), with AnimatedHandCard supplying the actual per-card
  // translateX offset from that center point via handCardSlotX — mirrors Batak's
  // HumanHandFan.fanCardSlot convention.
  handCardSlot: {
    position: 'absolute',
    left: '50%',
    top: 0,
    marginLeft: -CARD_DIMS.normal.width / 2,
  },
});
