import React, { useCallback, useMemo, useRef, useState, useEffect } from "react";
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
import { SimpleCard, SIMPLE_CARD_HEIGHT } from "../components/SimpleCard";
import {
  computeFanSlot,
  computeFanWidth,
  FanLayoutConfig,
  FanSlot,
} from "../components/fanLayout";
import { useCardMotion } from "../engine/useCardMotion";
import { FanConfigControls } from "../components/FanConfigControls";
import { idleKeyframe } from "../types";

const FULL_DECK = createDeck({ deckCount: 1, includeJokers: false });
const DEFAULT_HAND_SIZE = 6;
const DEFAULT_FAN_CONFIG: FanLayoutConfig = {
  overlap: 0.6,
  arcDegrees: 40,
  maxRotationDeg: 20,
  spacingPx: 40,
};
const SELECT_LIFT_PX = 28;
// Mirrors SelectableCard.tsx/Demo 02's own asymmetry: selecting snaps instantly,
// deselecting eases out for polish. See Demo02Selection.tsx for the full rationale.
const SELECT_SNAP_DURATION_MS = 0;
const DESELECT_DURATION_MS = 150;
export const TRAVEL_DISTANCE = 260;
export const TRAVEL_DURATION_MS = 450;
const HOLD_MS = 700;
const RESET_DURATION_MS = 300;
const HAND_TOP_OFFSET = 30;
// How far apart (in ms) the stress test starts each card's own play sequence —
// short enough that several cards are genuinely traveling/holding at once (well
// inside TRAVEL_DURATION_MS + HOLD_MS's ~1150ms per-card window), long enough to
// still read as distinct taps rather than one simultaneous burst.
const STRESS_TEST_CARD_STAGGER_MS = 150;
// Gap between the stress test's two synthetic taps in two-tap mode — mimics a fast
// real double-tap. Can't be 0: the first tap's onSelect() is a state update that
// only reaches this card's `selected` prop on the next render, so an instant second
// call would still see the stale (unselected) value and re-select instead of play.
const STRESS_TEST_DOUBLE_TAP_GAP_MS = 90;

type PlayMode = "oneTap" | "twoTap";
// Whether THIS card is mid-flight. Selection ('selected' prop, shared across the
// whole hand — see Demo03PlayTravel below) is orthogonal: a card can only ever be
// selected while at rest, and starting travel always clears the shared selection
// (see startTravel), so the two never need to be true at once.
type PlayStage = "atRest" | "traveling" | "holding";

// React.memo'd (see PlayableDemoCard below the implementation) — every prop here is
// already stable across parent re-renders once the parent memoizes its `slots`
// array (card/onSelect/registerPress already were: `cards` is a stable useMemo
// array, onSelect is a setState function — always stable — and registerPress is
// its own useCallback with no deps). Without that, a parent re-render (e.g. one
// card's onSelect(card.id) call) would otherwise re-render all 6 cards, not just
// the one whose props actually changed.
function PlayableDemoCardComponent({
  card,
  slot,
  selected,
  playMode,
  onSelect,
  registerPress,
}: {
  card: Card;
  slot: FanSlot;
  selected: boolean;
  playMode: PlayMode;
  onSelect: (cardId: string | null) => void;
  // Lets the stress test (Demo03PlayTravel below) simulate a real tap on this
  // specific card — registered once via a stable wrapper so the parent always
  // invokes today's handlePress, not a stale closure from whichever render it was
  // registered on.
  registerPress: (cardId: string, press: () => void) => void;
}) {
  const [playStage, setPlayStage] = useState<PlayStage>("atRest");
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const motion = useCardMotion({
    initial: idleKeyframe({ rotateDeg: slot.rotateDeg }),
    defaultDurationMs: DESELECT_DURATION_MS,
    defaultEasing: Easing.out(Easing.cubic),
  });
  const wasSelected = useRef(selected);

  // Drives the lift for the two-tap "selected" stage only. Guarded on playStage
  // being 'atRest': startTravel (below) clears the shared selection the instant it
  // fires, in the same handler that also calls motion.retarget toward the travel
  // destination — without this guard, this effect would see `selected` flip back
  // to false on the very next render and retarget the same Animated.Value back
  // toward rest, fighting the travel animation for control mid-flight.
  useEffect(() => {
    if (wasSelected.current === selected) return;
    wasSelected.current = selected;
    if (playStage !== "atRest") return;
    motion.retarget(
      idleKeyframe({
        rotateDeg: slot.rotateDeg,
        y: selected ? -SELECT_LIFT_PX : 0,
      }),
      { durationMs: selected ? SELECT_SNAP_DURATION_MS : DESELECT_DURATION_MS },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, playStage]);

  function startTravel() {
    onSelect(null);
    setPlayStage("traveling");
    // Destination: converge horizontally to the hand's own left edge (x: -slot.x
    // cancels this card's own base x offset) and travel up past the lift — begins
    // exactly from the current position (getCurrentKeyframe(), inside retarget),
    // whether that's the two-tap lifted position or (one-tap mode) straight from
    // rest, per "Preserve Spatial Continuity." Rotation is still the same
    // slot.rotateDeg as every prior keyframe — held fixed for the whole flight.
    motion.retarget(
      idleKeyframe({
        rotateDeg: slot.rotateDeg,
        x: -slot.x,
        y: -(SELECT_LIFT_PX + TRAVEL_DISTANCE),
      }),
      { durationMs: TRAVEL_DURATION_MS, easing: Easing.out(Easing.cubic) },
    );
    resetTimer.current = setTimeout(() => {
      setPlayStage("holding");
      resetTimer.current = setTimeout(() => {
        setPlayStage("atRest");
        motion.retarget(idleKeyframe({ rotateDeg: slot.rotateDeg }), {
          durationMs: RESET_DURATION_MS,
        });
      }, HOLD_MS);
    }, TRAVEL_DURATION_MS);
  }

  function handlePress() {
    // A tap during 'traveling'/'holding' is ignored outright — see
    // Demo03PlayTravel.tsx's pointerEvents fix below anyway, which already removes
    // this card's touch target for the whole non-atRest window, so this guard is
    // mostly a safety net (e.g. for the Stress Test's programmatic press() calls).
    if (playStage !== "atRest") return;
    if (resetTimer.current) {
      clearTimeout(resetTimer.current);
      resetTimer.current = null;
    }
    if (playMode === "oneTap") {
      startTravel();
      return;
    }
    if (selected) {
      startTravel();
    } else {
      onSelect(card.id);
    }
  }

  // "Latest ref" pattern: register a stable function once (registerPress/card.id
  // never change), but have it always call whatever handlePress closure is current
  // — handlePress itself isn't memoized, so registering it directly would re-run
  // this effect (and thrash the parent's map) on every single render.
  const handlePressRef = useRef(handlePress);
  handlePressRef.current = handlePress;
  useEffect(() => {
    registerPress(card.id, () => handlePressRef.current());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registerPress, card.id]);

  return (
    <Pressable
      testID={`demo03-card-${card.id}`}
      onPress={handlePress}
      // Same fix as apps/mobile/src/components/SelectableCard.tsx's own documented
      // hitSlop workaround: the lift transform below is purely visual — RN hit-tests
      // against the Pressable's untransformed layout box, which stays put — so once
      // selected, the card sits SELECT_LIFT_PX px higher than the only place a tap
      // actually registers. Without this, tapping the card's real, visible (lifted)
      // position does nothing; only the empty space it lifted away from still "hits."
      // Extending the box upward by the same distance covers the visible card again.
      hitSlop={selected ? { top: SELECT_LIFT_PX } : undefined}
      style={[
        styles.cardSlot,
        { left: slot.x, top: HAND_TOP_OFFSET + slot.y },
        // The motion above only animates the inner Animated.View's transform —
        // this outer Pressable's own layout box (what RN actually hit-tests
        // against) never moves, so once a card leaves its resting slot, its box
        // would otherwise keep sitting there invisibly, stealing taps meant for
        // whichever neighbor is now visible underneath it. Turning it off the
        // instant the card isn't at rest lets those taps fall through to that
        // neighbor instead. style.pointerEvents (not the deprecated prop form) —
        // see CLAUDE.md's existing note on this.
        playStage !== "atRest" && { pointerEvents: "none" as const },
      ]}>
      <Animated.View style={{ transform: motion.transform }}>
        <SimpleCard card={card} />
      </Animated.View>
    </Pressable>
  );
}

const PlayableDemoCard = React.memo(PlayableDemoCardComponent);

// Demo 03: play a card either in two taps (select/lift, then a second tap travels
// it — Demo 02's motion, reused here) or one tap (travels immediately from rest),
// toggled live via the mode control below; default is two-tap, matching the
// original version of this demo. Exactly one card can be in the lifted "selected"
// stage at a time (shared selectedCardId, same pattern as Demo02Selection.tsx) —
// tapping a different idle card switches directly, and tapping empty space (or any
// other card) clears it, via the same DeselectableSurface-style wrapper Pressable
// Demo 02 uses. Multiple cards ARE allowed to travel/hold at once (tapping a second
// card while the first is still mid-flight is not blocked). No card ever gets a
// dynamic z-index bump for this: every card keeps its own fixed, natural stacking
// order (plain JSX sibling order, by hand position) for its entire lifecycle,
// selected/traveling/holding included — an earlier version bumped a
// playing/traveling card above everything else so simultaneous plays wouldn't
// visually collide, but that made a flying card unnaturally pop in front of its
// still-seated neighbors mid-flight, which reads worse than the rare
// simultaneous-travel overlap it was solving for.
export function Demo03PlayTravel() {
  const [handSize, setHandSize] = useState(DEFAULT_HAND_SIZE);
  const [overlap, setOverlap] = useState(DEFAULT_FAN_CONFIG.overlap);
  const [arcDegrees, setArcDegrees] = useState(DEFAULT_FAN_CONFIG.arcDegrees);
  const [maxRotationDeg, setMaxRotationDeg] = useState(DEFAULT_FAN_CONFIG.maxRotationDeg);
  const [spacingPx, setSpacingPx] = useState(DEFAULT_FAN_CONFIG.spacingPx);
  const fanConfig: FanLayoutConfig = useMemo(
    () => ({ overlap, arcDegrees, maxRotationDeg, spacingPx }),
    [overlap, arcDegrees, maxRotationDeg, spacingPx],
  );

  const cards = useMemo(() => FULL_DECK.slice(0, handSize), [handSize]);
  const totalWidth = computeFanWidth(cards.length, fanConfig);
  // Memoized so each card's `slot` prop keeps the same object reference across
  // parent re-renders — computeFanSlot(...) called inline in JSX would otherwise
  // return a fresh object every render (same values, new reference), which would
  // silently defeat PlayableDemoCard's React.memo below for every single card on
  // every single render, regardless of whether that card's own props actually
  // changed. Same fix pattern as Pişti's PILE_CARD_OFFSETS/SIDE_CARD_STYLES.
  const slots = useMemo(
    () => cards.map((_, i) => computeFanSlot(i, cards.length, fanConfig)),
    [cards, fanConfig],
  );
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [playMode, setPlayMode] = useState<PlayMode>("twoTap");
  const pressFns = useRef<Map<string, () => void>>(new Map());
  const registerPress = useCallback((cardId: string, press: () => void) => {
    pressFns.current.set(cardId, press);
  }, []);

  // Simulates a real user rapidly tapping through the whole hand, left to right —
  // goes through each card's actual handlePress (via the registration above), so
  // it exercises the exact same select/travel/hold logic a real tap would, not a
  // special-cased shortcut. In two-tap mode, fires the second (playing) tap after
  // STRESS_TEST_DOUBLE_TAP_GAP_MS; each card's own sequence starts
  // STRESS_TEST_CARD_STAGGER_MS after the previous card's, so several cards end up
  // genuinely traveling/holding at overlapping times — the scenario worth watching
  // for smoothness/z-order issues.
  function runStressTest() {
    const mode = playMode;
    cards.forEach((card, i) => {
      setTimeout(() => {
        const press = pressFns.current.get(card.id);
        if (!press) return;
        press();
        if (mode === "twoTap") {
          setTimeout(() => press(), STRESS_TEST_DOUBLE_TAP_GAP_MS);
        }
      }, i * STRESS_TEST_CARD_STAGGER_MS);
    });
  }

  return (
    // Wrapped in a ScrollView — see Demo02Selection.tsx's identical wrapper for why.
    // style={styles.scrollView} (flex: 1) makes this stretch to its own parent's
    // full available height (confirmed via DOM measurement, not assumed) — needed
    // for the bottom-anchoring spacer below to have real slack to grow into.
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
      {/* Mirrors apps/mobile/src/components/DeselectableSurface.tsx (see
          Demo02Selection.tsx) — the whole screen is the deselect surface, same as
          Demo 02's own container Pressable, not just the area around the hand.
          Nested Pressables (the cards, the mode buttons below) claim their own taps
          first via RN's normal touch-responder negotiation either way. */}
      <Pressable style={styles.container} onPress={() => setSelectedCardId(null)}>
        <View style={styles.modeRow}>
          {(["twoTap", "oneTap"] as const).map(mode => (
            <Pressable
              key={mode}
              testID={`demo03-mode-${mode}`}
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
            testID="demo03-stress-test"
            onPress={runStressTest}
            style={[styles.modeButton, styles.stressButton]}>
            <Text style={styles.stressButtonText}>⚡ Stress test: play all</Text>
          </Pressable>
        </View>
        {/* Pushes the hand down toward the bottom of the screen and — the actual
            fix for "can't see where cards landed" — guarantees real room ABOVE
            the hand for the upward flight to be visible. The `hand` box below is
            now sized to just its resting row (no travel budget baked in): a
            card's flight is a `transform: translateY` overflowing UPWARD, past
            the box's own top edge, into whatever renders BEFORE it — previously
            that was the mode row with no reserved headroom at all, so a card
            could fly most of the way off the top of the screen before landing.
            minHeight (SELECT_LIFT_PX + TRAVEL_DISTANCE + a landing buffer)
            guarantees that headroom exists regardless of viewport size; flex: 1
            on top of that grows further on a taller screen, pushing the deck
            even closer to the bottom (once the controls panel below is also
            collapsed by default — see FanConfigControls.tsx — so it isn't
            competing for the same space). */}
        <View style={styles.spacer} />
        <View
          style={[
            styles.hand,
            {
              width: totalWidth,
              height: SIMPLE_CARD_HEIGHT + HAND_TOP_OFFSET + 20,
            },
          ]}>
          {cards.map((card, i) => (
            <PlayableDemoCard
              key={card.id}
              card={card}
              slot={slots[i]}
              selected={selectedCardId === card.id}
              playMode={playMode}
              onSelect={setSelectedCardId}
              registerPress={registerPress}
            />
          ))}
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
  // minHeight guarantees the upward flight's landing point stays visible
  // regardless of viewport size; flex: 1 grows it further when there's slack.
  spacer: { flex: 1, minHeight: SELECT_LIFT_PX + TRAVEL_DISTANCE + 40 },
  hand: { position: "relative" },
  cardSlot: { position: "absolute" },
});
