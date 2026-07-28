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
import { useCardMotion } from "../engine/useCardMotion";
import { FanConfigControls } from "../components/FanConfigControls";
import { idleKeyframe } from "../types";
import { TRAVEL_DISTANCE, TRAVEL_DURATION_MS } from "./Demo03PlayTravel";

const FULL_DECK = createDeck({ deckCount: 1, includeJokers: false });
const DEFAULT_HAND_SIZE = 6;
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
const HAND_CONTAINER_HEIGHT =
  SIMPLE_CARD_HEIGHT + HAND_TOP_OFFSET + TRAVEL_DISTANCE + 60;

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
  // This card's own current index in the hand — see Demo06HandReposition's render
  // for why paint order is now controlled via this style property rather than
  // JSX/parent position.
  zIndex: number;
}) {
  const motion = useCardMotion({
    initial: idleKeyframe({ rotateDeg: slot.angleDeg }),
    defaultDurationMs: DESELECT_DURATION_MS,
    defaultEasing: Easing.out(Easing.cubic),
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
  // Fixed at this card's own original position among its former neighbors — see
  // Demo06HandReposition's render for why this replaces the old two-JSX-layer
  // stacking trick.
  zIndex: number;
  onComplete: () => void;
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
  });

  // useLayoutEffect, not useEffect: unlike Demo 03/05's persistent per-card
  // component (which calls retarget() directly from an event handler on an
  // already-mounted instance), this component mounts FRESH on every play. A
  // passive effect fires after paint, so the browser/native renderer would get one
  // real frame to paint the static "initial" keyframe (unmoving, full scale)
  // before the animation actually starts — a visible pause-then-jump, not a single
  // continuous motion. A layout effect fires before that first paint instead, so
  // the very first rendered frame is already the start of the eased motion.
  useLayoutEffect(() => {
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
    const timer = setTimeout(onComplete, TRAVEL_DURATION_MS + HOLD_MS);
    return () => clearTimeout(timer);
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
    // The card's index in the hand array at the moment it was played — used only
    // to derive PlayedCard's zIndex (originalIndex + 0.5), so it stacks between
    // its former neighbors' own zIndex values (see the render below).
    originalIndex: number;
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

  const handlePlay = useCallback(
    (cardId: string, slot: RailSlot, wasSelected: boolean) => {
      const index = cards.findIndex(c => c.id === cardId);
      if (index === -1) return;
      const card = cards[index];
      setCards(prev => prev.filter(c => c.id !== cardId));
      setSelectedCardId(null);
      setPlayedCard({
        card,
        departureAngleDeg: slot.angleDeg,
        centerXAtPlay: centerX,
        wasSelected,
        originalIndex: index,
      });
    },
    [cards, centerX],
  );

  const handleCompletedPlay = useCallback(() => {
    setPlayedCard(null);
  }, []);

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
    <ScrollView contentContainerStyle={styles.scrollContent}>
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
        </View>
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
              which never needs to change groups) and not others. zIndex achieves
              the exact same "stacks between its former neighbors" result without
              ever moving a card's JSX position: each HandCard's zIndex is its own
              current index (matching the pre-existing "higher index paints on
              top" convention), and PlayedCard's zIndex sits at its own original
              index + 0.5 — strictly above every card that was originally before
              it, strictly below every one that was originally after it. */}
          {cards.map((card, i) => (
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
              zIndex={i}
            />
          ))}
          {playedCard ? (
            <PlayedCard
              card={playedCard.card}
              departureAngleDeg={playedCard.departureAngleDeg}
              centerXAtPlay={playedCard.centerXAtPlay}
              wasSelected={playedCard.wasSelected}
              zIndex={playedCard.originalIndex + 0.5}
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
  handWrapper: { position: "relative", alignSelf: "center" },
  cardSlot: { position: "absolute" },
  playedCard: { position: "absolute" },
});
