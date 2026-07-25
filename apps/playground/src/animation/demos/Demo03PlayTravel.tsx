import React, { useCallback, useMemo, useRef, useState, useEffect } from "react";
import {
  Animated,
  Easing,
  Pressable,
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
import { idleKeyframe } from "../types";

const FULL_DECK = createDeck({ deckCount: 1, includeJokers: false });
const HAND_SIZE = 6;
const FAN_CONFIG: FanLayoutConfig = {
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

function PlayableDemoCard({
  card,
  slot,
  selected,
  playMode,
  rapidPlay,
  onSelect,
  registerPress,
}: {
  card: Card;
  slot: FanSlot;
  selected: boolean;
  playMode: PlayMode;
  // When on, tapping a card that's already traveling/holding interrupts it and
  // immediately plays it again, instead of being ignored until its full
  // travel+hold+reset cycle (~1.15s) finishes on its own — see handlePress. This is
  // what actually gated real hand-tapped speed: the stress test never hit this,
  // since it only ever taps each of the 6 distinct cards once.
  rapidPlay: boolean;
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
    if (playStage !== "atRest") {
      if (!rapidPlay) return;
      // Interrupt whatever this card is currently doing (traveling toward the
      // table, or holding there) and play it again right away — re-selecting
      // first wouldn't make sense for a card that's already mid-play, so this
      // skips straight to startTravel regardless of playMode. Safe to retarget
      // mid-flight: motion.retarget always starts from wherever the card's
      // Animated.Value actually is right now, per useCardMotion's own design.
      if (resetTimer.current) {
        clearTimeout(resetTimer.current);
        resetTimer.current = null;
      }
      startTravel();
      return;
    }
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
//
// Rapid Play (off by default): lets a real tap interrupt a card that's still
// traveling/holding and play it again immediately, rather than waiting out its
// ~1.15s cycle — see PlayableDemoCard's rapidPlay prop. This, not anything about
// tap timing itself, is what actually limited how fast a HAND could play cards:
// the Stress Test button never hit it, since it only ever taps each of the 6
// distinct cards once each.
export function Demo03PlayTravel() {
  const cards = useMemo(() => FULL_DECK.slice(0, HAND_SIZE), []);
  const totalWidth = computeFanWidth(cards.length, FAN_CONFIG);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [playMode, setPlayMode] = useState<PlayMode>("twoTap");
  const [rapidPlay, setRapidPlay] = useState(false);
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
    // Mirrors apps/mobile/src/components/DeselectableSurface.tsx (see
    // Demo02Selection.tsx) — the whole screen is the deselect surface, same as
    // Demo 02's own container Pressable, not just the area around the hand.
    // Nested Pressables (the cards, the mode buttons below) claim their own taps
    // first via RN's normal touch-responder negotiation either way.
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
          testID="demo03-rapid-play"
          onPress={() => setRapidPlay(v => !v)}
          style={[
            styles.modeButton,
            styles.rapidButton,
            rapidPlay && styles.rapidButtonActive,
          ]}>
          <Text
            style={[
              styles.rapidButtonText,
              rapidPlay && styles.rapidButtonTextActive,
            ]}>
            🔁 Rapid play: {rapidPlay ? "on" : "off"}
          </Text>
        </Pressable>
        <Pressable
          testID="demo03-stress-test"
          onPress={runStressTest}
          style={[styles.modeButton, styles.stressButton]}>
          <Text style={styles.stressButtonText}>⚡ Stress test: play all</Text>
        </Pressable>
      </View>
      <View
        style={[
          styles.hand,
          {
            width: totalWidth,
            height:
              SIMPLE_CARD_HEIGHT + HAND_TOP_OFFSET + TRAVEL_DISTANCE + 60,
          },
        ]}>
        {cards.map((card, i) => (
          <PlayableDemoCard
            key={card.id}
            card={card}
            slot={computeFanSlot(i, cards.length, FAN_CONFIG)}
            selected={selectedCardId === card.id}
            playMode={playMode}
            rapidPlay={rapidPlay}
            onSelect={setSelectedCardId}
            registerPress={registerPress}
          />
        ))}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "flex-end" },
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
  rapidButton: { borderColor: "#ffffff55" },
  rapidButtonActive: { backgroundColor: "#22cc8833", borderColor: "#22cc88" },
  rapidButtonText: { color: "#ffffff99", fontSize: 13 },
  rapidButtonTextActive: { color: "#7dffcb", fontWeight: "700" },
  stressButton: { backgroundColor: "#ff8c0033", borderColor: "#ff8c00" },
  stressButtonText: { color: "#ffb366", fontSize: 13, fontWeight: "700" },
  hand: { position: "relative" },
  cardSlot: { position: "absolute" },
});
