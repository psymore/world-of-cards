import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { createDeck } from "@world-cards/engine";
import type { Card } from "@world-cards/engine";
import { SimpleCard, SIMPLE_CARD_HEIGHT, SIMPLE_CARD_WIDTH } from "../components/SimpleCard";
import { FanLayoutConfig } from "../components/fanLayout";
import {
  railAngleStepDeg,
  railAngles,
  railFanWidth,
  railPosition,
  RailSlot,
} from "../components/railFanLayout";
import { CardMotionValuePool, useCardMotion } from "../engine/useCardMotion";
import { FanConfigControls } from "../components/FanConfigControls";
import { idleKeyframe } from "../types";
import { TRAVEL_DISTANCE, TRAVEL_DURATION_MS } from "./Demo03PlayTravel";

const FULL_DECK = createDeck({ deckCount: 1, includeJokers: false });
const DEFAULT_HAND_SIZE = 6;
// Matches FanConfigControls' own hand-size slider maximumValue — the largest
// hand this demo can ever show, so the pool below always has enough slots.
const MAX_HAND_SIZE = 13;

// Fixed pool of per-slot Animated.Values, created ONCE at module load and
// reused for the lifetime of the app — never torn down when
// Demo06HandReposition itself unmounts/remounts (e.g. switching demo tabs and
// back). This is fix attempt #2 for the 2026-07-29 revisit-stutter
// investigation: every mount previously created a fresh set of 5
// Animated.Values per card, each backed by a native-driver node once
// animated, with nothing forcing their release on unmount — cleanup depended
// entirely on JS garbage collection actually reclaiming the old objects,
// which isn't immediate (fix #1, an explicit stopAnimation() on unmount,
// didn't help — measured no change — because by the time a revisit happens
// the previous mount's animations have long since finished naturally; there
// was nothing in-flight left to stop). Pooling removes the GC-timing
// dependency entirely: nothing new is ever created after the very first
// launch, so there's nothing stale left to interfere.
//
// Keyed by a card's STABLE original-deal slot (originalIndexById below), not
// its live position in `cards` — a card's own slot never changes for as long
// as it's still in the hand (only reassigned to a DIFFERENT card once THIS
// mount ends and a new one begins), so a pool slot's ownership can never
// reassign mid-animation within a single mount.
function createMotionValuePool(size: number): CardMotionValuePool[] {
  return Array.from({ length: size }, () => ({
    x: new Animated.Value(0),
    y: new Animated.Value(0),
    rotate: new Animated.Value(0),
    scale: new Animated.Value(1),
    glyphScale: new Animated.Value(1),
  }));
}
const HAND_MOTION_POOL = createMotionValuePool(MAX_HAND_SIZE);
// PlayedCard's own pool — a single slot, not an array like HAND_MOTION_POOL's
// per-card-identity one, since only one card can ever be mid-departure at a
// time (isPlayLocked enforces this). PlayedCard force-remounts on every play
// (key={playedCard.card.id}, so a different card gets a genuinely fresh
// component instance), which previously meant a fresh, unpooled set of 5
// Animated.Values per play too — the exact same GC-timing-dependent stutter
// source HAND_MOTION_POOL was built to eliminate for HandCard, just never
// extended to this sibling component. See HAND_MOTION_POOL's own comment for
// the full rationale.
const PLAYED_CARD_MOTION_POOL: CardMotionValuePool = {
  x: new Animated.Value(0),
  y: new Animated.Value(0),
  rotate: new Animated.Value(0),
  scale: new Animated.Value(1),
  glyphScale: new Animated.Value(1),
};
const DEFAULT_FAN_CONFIG: FanLayoutConfig = {
  overlap: 0.6,
  arcDegrees: 40,
  maxRotationDeg: 20,
  spacingPx: 40,
};
const SELECT_LIFT_PX = 28;
const DESELECT_DURATION_MS = 150;
const HOLD_MS = 700;
const HAND_TOP_OFFSET = 30;
const RESTING_SCALE = 0.7;
const RESTING_GLYPH_SCALE = 0.75;
const HAND_CARD_REPOSITION_DURATION_MS = 320;
const HAND_CARD_REPOSITION_EASING = Easing.inOut(Easing.cubic);
// Sized to just the resting fan row, not the departure flight — the departing
// card's motion overflows UPWARD (transform: translateY(-(SELECT_LIFT_PX +
// TRAVEL_DISTANCE))), past this box's own top edge, not downward within it, so
// reserving that distance in this box's own height doesn't actually keep the
// flight visible — it just eats vertical budget that the SPACER below (which
// sits ABOVE this box, where the flight actually needs headroom) could use
// instead. See Demo03PlayTravel.tsx's identical spacer/hand-height split for the
// full rationale.
const HAND_CONTAINER_HEIGHT = SIMPLE_CARD_HEIGHT + HAND_TOP_OFFSET + 20;

type PlayMode = "oneTap" | "twoTap";

// Demo 06: rail-constrained hand reflow — every card's RESTING position (see
// components/railFanLayout.ts) sits on one fixed-radius arc, per the user's own
// rail-fan-layout.png reference. An earlier version of this file also drove the
// MOTION between two rail positions from a single interpolated angle, via a
// custom requestAnimationFrame-stepped hook (useRailCardMotion, since removed) —
// that guaranteed the in-flight path stayed exactly on the arc, but JS-thread rAF
// stepping (manual per-frame trig + Animated.setValue) is inherently more prone to
// stutter than native Animated.timing, and it showed up as a real, reported
// stutter on deselect. Reworked to reuse useCardMotion — the exact same
// native-driven (useNativeDriver: true), Animated.timing-per-property primitive
// Demo 02/03/05 already prove is stutter-free — treating each card's rail
// position as a plain (x, y, rotateDeg) keyframe. The one thing this trades away:
// a mid-transition reposition now eases x/y independently (a straight chord
// between the old and new rail position) rather than literally curving along the
// arc — but every card still STARTS and LANDS exactly on the rail (nothing about
// railPosition/railAngles/railAngleStepDeg's geometry changed), and the chord is
// short/brief enough (~320ms, a few degrees of arc) that it reads as equivalent in
// practice. This is the "workaround with an equivalent outcome" tradeoff, made
// deliberately and flagged here rather than silently.
function HandCardComponent({
  card,
  slot,
  centerX,
  selected,
  playMode,
  onSelect,
  onPlay,
  registerPress,
  zIndex,
  motionPool,
  isPlayLocked,
}: {
  card: Card;
  slot: RailSlot;
  // Fixed horizontal midpoint of the hand's own display envelope (see
  // Demo06HandReposition below) — a card's angle is always centered on 0, so this
  // is the ONLY horizontal reference every card shares; nothing else about a
  // card's position depends on anything outside its own angle.
  centerX: number;
  selected: boolean;
  playMode: PlayMode;
  onSelect: (cardId: string | null) => void;
  onPlay: (cardId: string, slot: RailSlot, wasSelected: boolean) => void;
  registerPress: (cardId: string, press: () => void) => void;
  // True while ANY card (not just this one) is mid departure/hold/return
  // cycle — see Demo06HandReposition's own isPlayLocked doc comment for why
  // this exists. Blocks the entire handlePress (selection included, not just
  // playing) so a locked card simply doesn't respond to taps at all, rather
  // than allowing a select that could never complete.
  isPlayLocked: boolean;
  // This card's own current index in the hand — see Demo06HandReposition's render
  // for why paint order is now controlled via this style property rather than
  // JSX/parent position.
  zIndex: number;
  // This card's stable pool slot (HAND_MOTION_POOL[originalIndexById.get(card.id)])
  // — see the pool's own module-level doc comment for why this exists and why
  // it's keyed by original deal position, not live array index.
  motionPool: CardMotionValuePool;
}) {
  const motion = useCardMotion({
    initial: idleKeyframe({ rotateDeg: slot.angleDeg }),
    defaultDurationMs: DESELECT_DURATION_MS,
    defaultEasing: Easing.out(Easing.cubic),
    pool: motionPool,
  });
  const wasSelected = useRef(selected);
  const prevAngleRef = useRef(slot.angleDeg);

  // useCardMotion's (x, y) here are a DELTA from this card's own static resting
  // box (see the Pressable below, and its own comment) — never an absolute
  // position — mirroring Demo02Selection.tsx's own pattern exactly. Select lift is
  // a pure radial offset (railPosition's extraRadius): angle never changes here,
  // only how far out from the pivot the card sits.
  useEffect(() => {
    if (wasSelected.current === selected) return;
    wasSelected.current = selected;
    const origin = railPosition(slot.angleDeg, 0);
    const target = railPosition(slot.angleDeg, selected ? SELECT_LIFT_PX : 0);
    motion.retarget(
      idleKeyframe({
        rotateDeg: slot.angleDeg,
        x: target.x - origin.x,
        y: target.y - origin.y,
      }),
      { durationMs: selected ? 0 : DESELECT_DURATION_MS },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  // Rail-constrained reflow. The outer Pressable's static box moves to the new
  // resting position in this SAME render (it's computed straight from `slot`,
  // below) — so the delta useCardMotion is currently holding, which was relative
  // to the OLD box, has to be reprojected onto the NEW box before paint, or the
  // card flashes at the wrong spot for one frame. jumpTo exists on useCardMotion
  // specifically for this (see its own doc comment) — reproject instantly, then
  // retarget for real toward the new resting delta. useLayoutEffect (not
  // useEffect) so this lands before paint, not after.
  useLayoutEffect(() => {
    if (prevAngleRef.current === slot.angleDeg) return;
    const oldOrigin = railPosition(prevAngleRef.current, 0);
    const newOrigin = railPosition(slot.angleDeg, 0);
    prevAngleRef.current = slot.angleDeg;

    const current = motion.getCurrentKeyframe();
    motion.jumpTo({
      ...current,
      x: oldOrigin.x + current.x - newOrigin.x,
      y: oldOrigin.y + current.y - newOrigin.y,
    });

    const target = railPosition(slot.angleDeg, selected ? SELECT_LIFT_PX : 0);
    motion.retarget(
      idleKeyframe({
        rotateDeg: slot.angleDeg,
        x: target.x - newOrigin.x,
        y: target.y - newOrigin.y,
      }),
      {
        durationMs: HAND_CARD_REPOSITION_DURATION_MS,
        easing: HAND_CARD_REPOSITION_EASING,
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slot.angleDeg]);

  function handlePress() {
    if (isPlayLocked) return;
    if (playMode === "twoTap" && !selected) {
      onSelect(card.id);
      return;
    }
    onSelect(null);
    onPlay(card.id, slot, selected);
  }

  const handlePressRef = useRef(handlePress);
  handlePressRef.current = handlePress;

  useEffect(() => {
    registerPress(card.id, () => handlePressRef.current());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registerPress, card.id]);

  // The Pressable's static box must be THIS card's own resting rail position, not
  // a fixed point shared by every card in the hand — RN hit-testing goes by a
  // view's layout frame, never its transform, so if every card shared one static
  // box, only the topmost-painted one (the rightmost card, by stacking order)
  // could ever receive a tap regardless of where it visually sat. motion.transform
  // renders as a delta from this same resting position, so the visible result is
  // unchanged — only the touch target now actually tracks the card.
  const restPos = railPosition(slot.angleDeg, 0);

  return (
    <Pressable
      testID={`demo06-card-${card.id}`}
      onPress={handlePress}
      hitSlop={selected ? { top: SELECT_LIFT_PX } : undefined}
      style={[
        styles.cardSlot,
        {
          left: centerX + restPos.x - SIMPLE_CARD_WIDTH / 2,
          top: HAND_TOP_OFFSET + restPos.y,
          zIndex,
        },
      ]}>
      <Animated.View style={{ transform: motion.transform }}>
        <SimpleCard card={card} />
      </Animated.View>
    </Pressable>
  );
}

const HandCard = React.memo(HandCardComponent);

// The played card leaves the rail entirely — it's departing the fan, not
// repositioning within it — so it uses the same Cartesian useCardMotion as
// Demo03/04/05's own travel, starting from wherever the card actually was the
// instant it was played.
function PlayedCard({
  card,
  departureAngleDeg,
  centerXAtPlay,
  wasSelected,
  zIndex,
  onComplete,
}: {
  card: Card;
  departureAngleDeg: number;
  centerXAtPlay: number;
  // Whether the HandCard was showing its select-lift at the moment of play. This
  // matters for where this component MOUNTS: getting it wrong was a real, confirmed
  // bug — railPosition(departureAngleDeg) alone (ignoring the lift) put this card at
  // its unlifted resting spot, which is NOT where the HandCard visually was in
  // two-tap mode's second tap, so the card would instantly snap down before flying
  // up, breaking "single continuous motion."
  wasSelected: boolean;
  // This card's own stable, once-per-deal original position — the SAME value
  // (and the SAME source: Demo06HandReposition's originalIndexById map) every
  // remaining HandCard's own zIndex is read from, so this card stays correctly
  // interleaved with its former neighbors (below the one originally to its
  // right, above the one originally to its left) for its entire flight,
  // instead of an earlier version's fixed "always on top" constant, which
  // fixed the SSOT drift but lost that stacking relationship. See
  // docs/animation/audits/Demo06-ZIndexFix-Audit.md's Correction section.
  zIndex: number;
  // Called once this card's full departure -> hold -> return cycle finishes,
  // with the card itself, so the parent can re-add it to `cards` (see
  // docs/animation/audits/Demo06-ReturnToHand-Audit.md).
  onComplete: (card: Card) => void;
}) {
  const origin = railPosition(departureAngleDeg, wasSelected ? SELECT_LIFT_PX : 0);
  // centerXAtPlay + origin.x is this card's CENTER (railPosition's x is always
  // center-relative, same convention HandCard's Pressable already accounts for via
  // its own "- SIMPLE_CARD_WIDTH / 2") — this was missing that same subtraction,
  // a real, confirmed bug: the card mounted (and therefore appeared to "jump")
  // half a card-width too far right the instant it left the hand.
  const absoluteX = centerXAtPlay + origin.x - SIMPLE_CARD_WIDTH / 2;

  const motion = useCardMotion({
    initial: idleKeyframe({ rotateDeg: origin.rotateDeg }),
    defaultDurationMs: TRAVEL_DURATION_MS,
    defaultEasing: Easing.out(Easing.cubic),
    pool: PLAYED_CARD_MOTION_POOL,
  });

  // useLayoutEffect, not useEffect: unlike Demo 03/05's persistent per-card
  // component (which calls retarget() directly from an event handler on an
  // already-mounted instance), this component mounts FRESH on every play. A
  // passive effect fires after paint, so the browser/native renderer would get one
  // real frame to paint the static "initial" keyframe (unmoving, full scale)
  // before the animation actually starts — a visible pause-then-jump, not a single
  // continuous motion. A layout effect fires before that first paint instead, so
  // the very first rendered frame is already the start of the eased motion.
  //
  // Three legs, chained via nested timers (all cleared on unmount): depart ->
  // hold -> RETURN back to this card's own resting keyframe -> onComplete. The
  // return leg's destination is simply `idleKeyframe({ rotateDeg:
  // origin.rotateDeg })` — this card's own angle, at zero extra radius — which
  // is only valid because Demo06HandReposition's play-lock (isPlayLocked)
  // guarantees no OTHER card can be played while this one is mid-cycle: the
  // hand's composition when this card returns is provably identical to what it
  // was the instant this card departed, so the same symmetric rail-distribution
  // formula (railAngles) resolves to the exact same angle both times — no
  // re-simulation of a hypothetical future array needed. See
  // docs/animation/audits/Demo06-ReturnToHand-Audit.md.
  useLayoutEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    motion.retarget(
      idleKeyframe({
        rotateDeg: origin.rotateDeg,
        // Converge toward the fan's own center as it flies away — same "cards
        // funnel toward one point" look this demo has always had, just converging
        // on the rail's own center (angle 0) instead of the old Cartesian model's
        // left edge. centerXAtPlay - SIMPLE_CARD_WIDTH / 2 matches the exact left
        // edge a center-card HandCard (angleDeg: 0) itself resolves to — without
        // that same subtraction here, the card would land centered a half-width
        // too far right, the same bug as the mount position above.
        x: centerXAtPlay - SIMPLE_CARD_WIDTH / 2 - absoluteX,
        y: -(SELECT_LIFT_PX + TRAVEL_DISTANCE),
        scale: RESTING_SCALE,
        glyphScale: RESTING_GLYPH_SCALE,
      }),
      { durationMs: TRAVEL_DURATION_MS, easing: Easing.out(Easing.cubic) },
    );
    timers.push(
      setTimeout(() => {
        motion.retarget(idleKeyframe({ rotateDeg: origin.rotateDeg }), {
          durationMs: TRAVEL_DURATION_MS,
          easing: Easing.out(Easing.cubic),
        });
        timers.push(setTimeout(() => onComplete(card), TRAVEL_DURATION_MS));
      }, TRAVEL_DURATION_MS + HOLD_MS),
    );
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.View
      style={[
        styles.playedCard,
        {
          left: absoluteX,
          top: HAND_TOP_OFFSET + origin.y,
          transform: motion.transform,
          zIndex,
        },
      ]}>
      <SimpleCard
        card={card}
        glyphStyle={{ transform: [{ scale: motion.glyphScale }] }}
      />
    </Animated.View>
  );
}

// Demo 06: an isolated lab for the "remaining hand reflows when a card leaves"
// problem specifically — no trick center, no multi-seat, no dealing loop (see
// Demo07CompleteSequence.tsx for that). A flat 6-card hand a human can tap through
// (one/two-tap), watching just the remaining cards' reflow quality against the
// rail model: does it read as one continuous motion, does overlap stay
// fixed-or-decreasing as the hand shrinks, does the played card respect the
// stacking order it was already sitting in.
export function Demo06HandReposition() {
  const [handSize, setHandSize] = useState(DEFAULT_HAND_SIZE);
  const [overlap, setOverlap] = useState(DEFAULT_FAN_CONFIG.overlap);
  const [arcDegrees, setArcDegrees] = useState(DEFAULT_FAN_CONFIG.arcDegrees);
  const [maxRotationDeg, setMaxRotationDeg] = useState(DEFAULT_FAN_CONFIG.maxRotationDeg);
  const [spacingPx, setSpacingPx] = useState(DEFAULT_FAN_CONFIG.spacingPx);
  const fanConfig: FanLayoutConfig = useMemo(
    () => ({ overlap, arcDegrees, maxRotationDeg, spacingPx }),
    [overlap, arcDegrees, maxRotationDeg, spacingPx],
  );

  const [cards, setCards] = useState<Card[]>(() =>
    FULL_DECK.slice(0, DEFAULT_HAND_SIZE),
  );
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [playMode, setPlayMode] = useState<PlayMode>("twoTap");
  const [playedCard, setPlayedCard] = useState<{
    card: Card;
    departureAngleDeg: number;
    centerXAtPlay: number;
    wasSelected: boolean;
  } | null>(null);
  const pressFns = useRef<Map<string, () => void>>(new Map());
  const registerPress = useCallback((cardId: string, press: () => void) => {
    pressFns.current.set(cardId, press);
  }, []);

  // Changing the Hand size slider is a redeal, not a reflow — reset everything
  // back to a fresh, full hand at the new size rather than trying to smoothly
  // grow/shrink an in-progress game. (Also runs harmlessly once on mount,
  // resetting to the same initial slice it already started with.)
  useEffect(() => {
    setCards(FULL_DECK.slice(0, handSize));
    setSelectedCardId(null);
    setPlayedCard(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handSize]);

  // The FIXED per-card angular increment, derived from the Overlap/Spacing sliders
  // at the reference hand size (not the current, possibly-reduced count) — this is
  // what keeps overlap ratio constant (never worse) regardless of how many cards
  // remain: see railAngleStepDeg's own doc comment. Depends on handSize (the
  // slider), never on cards.length, so playing a card never itself changes it.
  const angleStepDeg = useMemo(
    () => railAngleStepDeg(fanConfig, handSize),
    [fanConfig, handSize],
  );

  const angles = useMemo(
    () => railAngles(cards.length, angleStepDeg, maxRotationDeg),
    [cards.length, angleStepDeg, maxRotationDeg],
  );
  const slots: RailSlot[] = useMemo(
    () => angles.map(angleDeg => ({ angleDeg })),
    [angles],
  );

  // The hand's own fixed display envelope — sized from handSize (the reference
  // full hand), not cards.length, so it never itself shrinks/shifts as cards are
  // played (only the config sliders change it). Because the rail model is
  // inherently symmetric around its own pivot, centerX alone is enough to keep
  // every card centered for any card count — unlike the old Cartesian model,
  // there's no separate per-play recentering step needed at all.
  const maxHandWidth = useMemo(
    () => railFanWidth(handSize, angleStepDeg, maxRotationDeg),
    [handSize, angleStepDeg, maxRotationDeg],
  );
  const centerX = maxHandWidth / 2;

  // Every card's STABLE, once-per-deal stacking slot — keyed only on handSize
  // (this round's original deal), never on the live, shrinking `cards` array.
  // Both HandCard and PlayedCard read their zIndex from this SAME map, so
  // there is exactly one computation of "this card's stacking order," not two
  // independently drifting ones (the original bug: HandCard's zIndex tracked
  // the live, reflowed array position while PlayedCard's tracked a frozen
  // snapshot of that same live position — two different reference frames for
  // one fact). Because a remaining card's own entry here never changes when a
  // sibling leaves, a departing card's entry (looked up the same way) stays
  // correctly interleaved with its original neighbors — below the one
  // originally to its right, above the one originally to its left — for its
  // entire flight, matching Demo05Transform.tsx's own behavior (which never
  // removes a played card from its array at all, so it never faces this
  // problem in the first place). See
  // docs/animation/audits/Demo06-ZIndexFix-Audit.md's Correction section.
  const originalIndexById = useMemo(
    () => new Map(FULL_DECK.slice(0, handSize).map((c, i) => [c.id, i])),
    [handSize],
  );

  // Cleanup for departTimerRef (set inside handlePlay below) — mirrors
  // PlayedCard's own timer cleanup pattern (see its useLayoutEffect). Only one
  // play can ever be in flight at a time (isPlayLocked), so a single ref (not
  // an array) is enough.
  const departTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (departTimerRef.current != null) clearTimeout(departTimerRef.current);
    };
  }, []);

  const handlePlay = useCallback(
    (cardId: string, slot: RailSlot, wasSelected: boolean) => {
      const card = cards.find(c => c.id === cardId);
      if (!card) return;
      setSelectedCardId(null);
      setPlayedCard({
        card,
        departureAngleDeg: slot.angleDeg,
        centerXAtPlay: centerX,
        wasSelected,
      });
      // Per direct user request (2026-07-29): the remaining hand's reflow
      // previously started in the SAME instant the played card began its
      // departure flight (this setCards call used to fire immediately,
      // above). Now it's delayed until the departure has actually landed —
      // TRAVEL_DURATION_MS, the depart leg's own duration, not the full
      // depart->hold->return cycle — so only one thing is visibly moving at
      // a time: first the card leaves, then the hand closes the gap.
      // `cards` still includes the departing card until this fires, so the
      // OTHER cards keep their pre-play slot positions during the flight
      // (see the render below, which explicitly skips rendering the
      // departing card as a HandCard in the meantime).
      departTimerRef.current = setTimeout(() => {
        setCards(prev => prev.filter(c => c.id !== cardId));
      }, TRAVEL_DURATION_MS);
    },
    [cards, centerX],
  );

  // Re-adds the card to `cards`, sorted back into its original deal position
  // (via originalIndexById — the same stable SSOT the zIndex/pool-slot fixes
  // already rely on), so it reuses all of that existing machinery with no new
  // cases: a reinserted card is indistinguishable from one that never left.
  // See docs/animation/audits/Demo06-ReturnToHand-Audit.md.
  const handleCompletedPlay = useCallback(
    (card: Card) => {
      setPlayedCard(null);
      setCards(prev => {
        const next = [...prev, card];
        next.sort(
          (a, b) => (originalIndexById.get(a.id) ?? 0) - (originalIndexById.get(b.id) ?? 0),
        );
        return next;
      });
    },
    [originalIndexById],
  );

  // Only one card can ever be mid-cycle (departing -> holding -> returning) at
  // a time — the direct fix for the collision risk flagged in
  // docs/animation/audits/Demo06-ReturnToHand-Audit.md: re-adding a returning
  // card to `cards` triggers the same reflow effect a departure triggers, and
  // two overlapping reflow-triggering events (from two simultaneously-cycling
  // cards) could compete for the same per-card jumpTo/retarget calls. Gating
  // on this in HandCardComponent.handlePress means `cards` can only ever
  // change once per full cycle, never with two cycles overlapping — and it's
  // also what makes the return leg's angle-reuse simplification above valid
  // (see that comment).
  const isPlayLocked = playedCard !== null;

  // Full reset to this demo's initial mount conditions — every piece of state
  // this component owns, not just the hand. Explicit here rather than relying
  // on the handSize effect above, since that effect only fires on a CHANGE to
  // handSize and would silently no-op if handSize is already at its default.
  function resetDemo() {
    setHandSize(DEFAULT_HAND_SIZE);
    setOverlap(DEFAULT_FAN_CONFIG.overlap);
    setArcDegrees(DEFAULT_FAN_CONFIG.arcDegrees);
    setMaxRotationDeg(DEFAULT_FAN_CONFIG.maxRotationDeg);
    setSpacingPx(DEFAULT_FAN_CONFIG.spacingPx);
    setCards(FULL_DECK.slice(0, DEFAULT_HAND_SIZE));
    setSelectedCardId(null);
    setPlayedCard(null);
    setPlayMode("twoTap");
  }

  function runStressTest() {
    const ids = cards.map(card => card.id);
    ids.forEach((cardId, i) => {
      setTimeout(() => {
        const press = pressFns.current.get(cardId);
        if (!press) return;
        press();
      }, i * 150);
    });
  }

  return (
    // Wrapped in a ScrollView — see Demo02Selection.tsx's identical wrapper for why.
    // style={styles.scrollView} (flex: 1) makes this stretch to its own parent's
    // full available height (confirmed via DOM measurement, not assumed) — needed
    // for the bottom-anchoring spacer below to have real slack to grow into.
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
      <Pressable style={styles.container} onPress={() => setSelectedCardId(null)}>
        <View style={styles.modeRow}>
          {(["twoTap", "oneTap"] as const).map(mode => (
            <Pressable
              key={mode}
              testID={`demo06-mode-${mode}`}
              onPress={() => setPlayMode(mode)}
              style={[
                styles.modeButton,
                playMode === mode && styles.modeButtonActive,
              ]}>
              <Text
                style={[
                  styles.modeButtonText,
                  playMode === mode && styles.modeButtonTextActive,
                ]}>
                {mode === "twoTap" ? "Two-tap play" : "One-tap play"}
              </Text>
            </Pressable>
          ))}
          <Pressable
            testID="demo06-stress-test"
            onPress={runStressTest}
            style={[styles.modeButton, styles.stressButton]}>
            <Text style={styles.stressButtonText}>⚡ Play all</Text>
          </Pressable>
          <Pressable
            testID="demo06-reset"
            onPress={resetDemo}
            style={[styles.modeButton, styles.resetButton]}>
            <Text style={styles.resetButtonText}>↺ Reset</Text>
          </Pressable>
        </View>
        {/* Pushes the hand down toward the bottom of the screen and guarantees
            real room ABOVE it for the departing card's upward flight to be
            visible — see Demo03PlayTravel.tsx's identical spacer/hand-height
            pair (HAND_CONTAINER_HEIGHT above) for the full rationale. */}
        <View style={styles.spacer} />
        <View
          style={[
            styles.handWrapper,
            { width: maxHandWidth, height: HAND_CONTAINER_HEIGHT },
          ]}>
          {/* Every remaining card renders as a direct sibling here, under ONE shared
              parent, in ITS OWN stable JSX position (key={card.id}) for its entire
              life in the hand — an earlier version split cards into two separate
              parent Views (before/after the played card) to make the departing
              card stack correctly between its former neighbors, but React only
              reconciles by key WITHIN one parent's children array: a card moving
              from one parent's array to the other (which happens for every card
              whose before/after group shifts as the split point moves) was
              silently unmounted and remounted, resetting its useCardMotion state
              and snapping instead of easing — a real, confirmed bug that only
              showed up for some plays (e.g. anything except the rightmost card,
              which never needs to change groups) and not others. zIndex controls
              stacking without ever moving a card's JSX position: both HandCard
              and PlayedCard read their zIndex from originalIndexById (defined
              above) — a card's STABLE original deal position, never its live,
              reflowed array position. An earlier version used the live index
              `i` for HandCard and a frozen originalIndex + 0.5 (or later, a
              fixed "always on top" constant) for PlayedCard — two independent
              computations of the same "stacking slot" fact, which either
              silently disagreed once `cards` reindexed post-play, or agreed but
              lost the "beneath its original right neighbor, above its original
              left neighbor" stacking a real fanned hand should have (Constitution
              §5.II; see docs/animation/audits/Demo06-ZIndexFix-Audit.md and its
              Correction section). One shared map, read identically by both,
              has nothing left to drift and reproduces that stacking for free. */}
          {cards.map((card, i) => {
            // The departing card stays in `cards` (and therefore still owns
            // slots[i]) until departTimerRef fires — see handlePlay's own
            // comment. It's already rendered via <PlayedCard> below, so skip
            // it here rather than double-rendering; every OTHER card keeps
            // its pre-play slot (slots[i], from the still-unshrunk count)
            // until that timer actually removes this card from `cards`.
            if (playedCard && card.id === playedCard.card.id) return null;
            const poolIndex = originalIndexById.get(card.id) ?? i;
            return (
              <HandCard
                key={card.id}
                card={card}
                slot={slots[i]}
                centerX={centerX}
                selected={selectedCardId === card.id}
                playMode={playMode}
                onSelect={setSelectedCardId}
                onPlay={handlePlay}
                registerPress={registerPress}
                zIndex={poolIndex}
                motionPool={HAND_MOTION_POOL[poolIndex % HAND_MOTION_POOL.length]}
                isPlayLocked={isPlayLocked}
              />
            );
          })}
          {playedCard ? (
            <PlayedCard
              // Forces a genuine unmount/remount whenever a DIFFERENT card
              // becomes playedCard — without this, React reuses the same
              // PlayedCard instance (same type, same JSX slot) across two
              // different cards, and its one-time mount effect (empty deps,
              // by design — see the component's own comment) silently never
              // re-fires for the second card, omitting its departure
              // animation entirely. See
              // docs/animation/audits/Demo06-TrickCenterKeyFix-QuickAudit.md.
              key={playedCard.card.id}
              card={playedCard.card}
              departureAngleDeg={playedCard.departureAngleDeg}
              centerXAtPlay={playedCard.centerXAtPlay}
              wasSelected={playedCard.wasSelected}
              zIndex={originalIndexById.get(playedCard.card.id) ?? 0}
              onComplete={handleCompletedPlay}
            />
          ) : null}
        </View>
        <FanConfigControls
          handSize={handSize}
          onHandSizeChange={setHandSize}
          overlap={overlap}
          onOverlapChange={setOverlap}
          arcDegrees={arcDegrees}
          onArcDegreesChange={setArcDegrees}
          maxRotationDeg={maxRotationDeg}
          onMaxRotationDegChange={setMaxRotationDeg}
          spacingPx={spacingPx}
          onSpacingPxChange={setSpacingPx}
        />
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  container: { flexGrow: 1, alignItems: "center" },
  modeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    marginBottom: 16,
    gap: 8,
  },
  modeButton: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#ffffff55",
  },
  modeButtonActive: { backgroundColor: "#ffffff22", borderColor: "#fff" },
  modeButtonText: { color: "#ffffff99", fontSize: 13 },
  modeButtonTextActive: { color: "#fff", fontWeight: "700" },
  stressButton: { backgroundColor: "#ff8c0033", borderColor: "#ff8c00" },
  stressButtonText: { color: "#ffb366", fontSize: 13, fontWeight: "700" },
  resetButton: { backgroundColor: "#4a90e233", borderColor: "#4a90e2" },
  resetButtonText: { color: "#9cc4f0", fontSize: 13, fontWeight: "700" },
  // minHeight guarantees the upward flight's landing point stays visible
  // regardless of viewport size; flex: 1 grows it further when there's slack.
  spacer: { flex: 1, minHeight: SELECT_LIFT_PX + TRAVEL_DISTANCE + 40 },
  handWrapper: { position: "relative", alignSelf: "center" },
  cardSlot: { position: "absolute" },
  playedCard: { position: "absolute" },
});
