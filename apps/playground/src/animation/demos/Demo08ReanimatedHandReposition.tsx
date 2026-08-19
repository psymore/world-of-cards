import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { createDeck } from "@world-of-cards/engine";
import type { Card } from "@world-of-cards/engine";
import { SimpleCard, SIMPLE_CARD_HEIGHT, SIMPLE_CARD_WIDTH } from "../components/SimpleCard";
import { FanLayoutConfig } from "../components/fanLayout";
import {
  railAngleStepDeg,
  railAngles,
  railFanWidth,
  railPosition,
  RailSlot,
} from "../components/railFanLayout";
import { FanConfigControls } from "../components/FanConfigControls";
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
const HAND_CARD_REPOSITION_DURATION_MS = 320;
const REPOSITION_EASING = Easing.inOut(Easing.cubic);
const TRAVEL_EASING = Easing.out(Easing.cubic);
const HAND_CONTAINER_HEIGHT = SIMPLE_CARD_HEIGHT + HAND_TOP_OFFSET + 20;

type PlayMode = "oneTap" | "twoTap";

// Demo 08: same objective as Demo06HandReposition.tsx (the remaining hand's reflow
// when a card is played), rebuilt on react-native-reanimated + react-native-gesture-handler
// instead of Animated + Pressable — see docs/animation/ADR/ADR-001-reanimated-demo08-experiment.md
// for the full two-week investigation this responds to. Demo06 itself is NOT modified by
// this file; this is a standalone comparison, per direct user instruction.
//
// The one structural difference from Demo06 that matters most: every card's outer
// Pressable-equivalent box is positioned via a FIXED left/top (the fan's own pivot,
// centerX/HAND_TOP_OFFSET, identical for every card, every render, forever) — never
// recomputed per card, never touched by a reflow. ALL positioning — including a card's
// resting rail position — is expressed as translateX/translateY/rotate on top of that
// fixed box. This is deliberate: Demo06-ReflowStutter-Audit.md's still-open hypothesis is
// that the remaining cards' reflow stutter is a real Yoga layout pass, caused by every
// remaining card's `left`/`top` changing simultaneously — a cost that has nothing to do
// with which library drives the `transform` layered on top. Fixing the box in place
// structurally rules that cost out, rather than optimizing around it.
//
// Touch-tracking (Constitution §5.VII) is handled by react-native-gesture-handler's
// Gesture.Tap(), bound directly to each card's own transformed view — gesture-handler's
// native recognizers hit-test against a view's actual rendered position (the OS applies a
// view's transform matrix during its own touch dispatch), unlike the plain RN
// Pressable/responder path this app's own Constitution §5.VII evidence names as
// layout-frame-only. This is the reason this experiment reaches for gesture-handler
// specifically, not just Reanimated alone.
export function Demo08ReanimatedHandReposition() {
  const [handSize, setHandSize] = useState(DEFAULT_HAND_SIZE);
  const [overlap, setOverlap] = useState(DEFAULT_FAN_CONFIG.overlap);
  const [arcDegrees, setArcDegrees] = useState(DEFAULT_FAN_CONFIG.arcDegrees);
  const [maxRotationDeg, setMaxRotationDeg] = useState(DEFAULT_FAN_CONFIG.maxRotationDeg);
  const [spacingPx, setSpacingPx] = useState(DEFAULT_FAN_CONFIG.spacingPx);
  const fanConfig: FanLayoutConfig = useMemo(
    () => ({ overlap, arcDegrees, maxRotationDeg, spacingPx }),
    [overlap, arcDegrees, maxRotationDeg, spacingPx],
  );

  // Unlike Demo06's `cards` (which actually removes/re-adds the played card), every
  // dealt card here stays mounted for the demo's entire life — see the file-level
  // comment: there is no forced-remount PlayedCard, so there is no reason to ever
  // remove a card from this array. `cards`' own array order IS the stable original
  // deal order for the whole session (zIndex and slot-count both read directly from
  // it), replacing Demo06's separate originalIndexById map.
  const [cards, setCards] = useState<Card[]>(() => FULL_DECK.slice(0, DEFAULT_HAND_SIZE));
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [playMode, setPlayMode] = useState<PlayMode>("twoTap");
  // The one card currently mid depart/hold/return cycle, if any — mirrors Demo06's
  // isPlayLocked gate (only one card can ever be mid-cycle at a time).
  const [playingCardId, setPlayingCardId] = useState<string | null>(null);
  // Set TRAVEL_DURATION_MS after a play starts, cleared once that card's full cycle
  // completes — the same "delay the reflow until the departure lands" behavior
  // Demo06 already ships (per direct user request, 2026-07-29), reproduced here for
  // a fair comparison rather than re-opened as a new variable.
  const [excludedFromLayoutId, setExcludedFromLayoutId] = useState<string | null>(null);
  const pressFns = useRef<Map<string, () => void>>(new Map());
  const registerPress = useCallback((cardId: string, press: () => void) => {
    pressFns.current.set(cardId, press);
  }, []);

  useEffect(() => {
    setCards(FULL_DECK.slice(0, handSize));
    setSelectedCardId(null);
    setPlayingCardId(null);
    setExcludedFromLayoutId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handSize]);

  const angleStepDeg = useMemo(
    () => railAngleStepDeg(fanConfig, handSize),
    [fanConfig, handSize],
  );

  // Slots for whichever cards currently count toward the fan (everything except the
  // one excluded during its departure window) — recomputed whenever that set's SIZE
  // changes, exactly mirroring Demo06's own `angles`/`slots` derivation from
  // `cards.length`.
  const layoutCards = useMemo(
    () => cards.filter(c => c.id !== excludedFromLayoutId),
    [cards, excludedFromLayoutId],
  );
  const angles = useMemo(
    () => railAngles(layoutCards.length, angleStepDeg, maxRotationDeg),
    [layoutCards.length, angleStepDeg, maxRotationDeg],
  );
  const slotByCardId = useMemo(() => {
    const map = new Map<string, RailSlot>();
    layoutCards.forEach((c, i) => map.set(c.id, { angleDeg: angles[i] }));
    return map;
  }, [layoutCards, angles]);

  const maxHandWidth = useMemo(
    () => railFanWidth(handSize, angleStepDeg, maxRotationDeg),
    [handSize, angleStepDeg, maxRotationDeg],
  );
  const centerX = maxHandWidth / 2;

  const departTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (departTimerRef.current != null) clearTimeout(departTimerRef.current);
    };
  }, []);

  const handlePlay = useCallback((cardId: string) => {
    setSelectedCardId(null);
    setPlayingCardId(cardId);
    departTimerRef.current = setTimeout(() => {
      setExcludedFromLayoutId(cardId);
    }, TRAVEL_DURATION_MS);
  }, []);

  const handleCompletedPlay = useCallback((cardId: string) => {
    setPlayingCardId(null);
    setExcludedFromLayoutId(null);
  }, []);

  const isPlayLocked = playingCardId !== null;

  function resetDemo() {
    setHandSize(DEFAULT_HAND_SIZE);
    setOverlap(DEFAULT_FAN_CONFIG.overlap);
    setArcDegrees(DEFAULT_FAN_CONFIG.arcDegrees);
    setMaxRotationDeg(DEFAULT_FAN_CONFIG.maxRotationDeg);
    setSpacingPx(DEFAULT_FAN_CONFIG.spacingPx);
    setCards(FULL_DECK.slice(0, DEFAULT_HAND_SIZE));
    setSelectedCardId(null);
    setPlayingCardId(null);
    setExcludedFromLayoutId(null);
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

  // Deselect-on-background-tap, mirroring Demo06's identical feature. A real, live
  // bug was found and fixed here (2026-07-29): the first version made this a
  // Gesture Handler Gesture.Tap() wrapping the ENTIRE screen INCLUDING the cards, on
  // the (wrong) assumption that Gesture Handler gives a nested descendant view
  // automatic priority the way RN's classic Pressable-in-Pressable responder
  // negotiation does (which is how Demo06 gets this same feature "for free"). It
  // doesn't — RNGH delivers a touch to every attached handler whose view contains
  // it, with no implicit parent/child priority: this gesture was winning outright,
  // so two-tap mode's first tap (select) never registered at all (confirmed via
  // temporary diagnostic logging, then confirmed fixed live on-device). Neither
  // `.blocksExternalGesture` nor `.maxDuration` tuning fixed this. The actual,
  // verified fix is structural, not a gesture-relation flag: this gesture's own
  // GestureDetector now wraps ONLY the mode-row/spacer region, which never
  // geometrically overlaps a card — no ambiguity to arbitrate, since the two
  // gestures no longer share any touch point at all. `handWrapper`/
  // `FanConfigControls` are now siblings, not descendants, of this GestureDetector;
  // tapping between/around cards inside `handWrapper` itself no longer deselects, a
  // narrower scope than Demo06's version but a deliberate, small trade for a fix
  // that's actually verified to work.
  const backgroundTap = Gesture.Tap().onEnd((_e, success) => {
    if (success) runOnJS(setSelectedCardId)(null);
  });

  return (
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
      <View style={styles.container}>
        <GestureDetector gesture={backgroundTap}>
          <View style={styles.backgroundTapZone}>
            <View style={styles.modeRow}>
              {(["twoTap", "oneTap"] as const).map(mode => (
                <Pressable
                  key={mode}
                  testID={`demo08-mode-${mode}`}
                  onPress={() => setPlayMode(mode)}
                  style={[styles.modeButton, playMode === mode && styles.modeButtonActive]}>
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
                testID="demo08-stress-test"
                onPress={runStressTest}
                style={[styles.modeButton, styles.stressButton]}>
                <Text style={styles.stressButtonText}>⚡ Play all</Text>
              </Pressable>
              <Pressable
                testID="demo08-reset"
                onPress={resetDemo}
                style={[styles.modeButton, styles.resetButton]}>
                <Text style={styles.resetButtonText}>↺ Reset</Text>
              </Pressable>
            </View>
            <View style={styles.spacer} />
          </View>
        </GestureDetector>
        <View
          style={[styles.handWrapper, { width: maxHandWidth, height: HAND_CONTAINER_HEIGHT }]}>
          {cards.map((card, i) => (
            <HandCard
              key={card.id}
              card={card}
              slot={slotByCardId.get(card.id) ?? null}
              centerX={centerX}
              selected={selectedCardId === card.id}
              playMode={playMode}
              onSelect={setSelectedCardId}
              onPlay={handlePlay}
              onComplete={handleCompletedPlay}
              registerPress={registerPress}
              zIndex={i}
              isPlaying={playingCardId === card.id}
              isPlayLocked={isPlayLocked}
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
      </View>
    </ScrollView>
  );
}

function HandCardComponent({
  card,
  slot,
  centerX,
  selected,
  playMode,
  onSelect,
  onPlay,
  onComplete,
  registerPress,
  zIndex,
  isPlaying,
  isPlayLocked,
}: {
  card: Card;
  // Null only while this SAME card is isPlaying (it ignores slot targeting during
  // its own depart/hold/return cycle, driving its own position directly instead).
  slot: RailSlot | null;
  centerX: number;
  selected: boolean;
  playMode: PlayMode;
  onSelect: (cardId: string | null) => void;
  onPlay: (cardId: string) => void;
  onComplete: (cardId: string) => void;
  registerPress: (cardId: string, press: () => void) => void;
  zIndex: number;
  isPlaying: boolean;
  isPlayLocked: boolean;
}) {
  const initialSlot = useRef(slot ?? { angleDeg: 0 }).current;
  const initialOrigin = railPosition(initialSlot.angleDeg, 0);
  // Every output here is ABSOLUTE (offset from the fan's fixed pivot box below), never
  // a delta from a moving static box — see the file-level comment for why. Starting
  // value is this card's own initial rail position; nothing ever "jumps" on mount.
  const translateX = useSharedValue(initialOrigin.x);
  const translateY = useSharedValue(initialOrigin.y);
  const rotate = useSharedValue(initialSlot.angleDeg);
  const scale = useSharedValue(1);

  // Select/deselect: a pure radial offset along this card's own current angle,
  // exactly mirroring Demo06's select-lift semantics. Skipped entirely while
  // isPlaying — the depart sequence below owns these shared values during that
  // window.
  useEffect(() => {
    if (isPlaying || !slot) return;
    const target = railPosition(slot.angleDeg, selected ? SELECT_LIFT_PX : 0);
    const duration = selected ? 0 : DESELECT_DURATION_MS;
    translateX.value = withTiming(target.x, { duration, easing: Easing.out(Easing.cubic) });
    translateY.value = withTiming(target.y, { duration, easing: Easing.out(Easing.cubic) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  // Reflow: this card's angle changed because a sibling departed/returned. No jumpTo/
  // reprojection step is needed here (contrast Demo06's useLayoutEffect dance) — since
  // translateX/Y/rotate already hold this card's true current value at all times
  // (never reset, never reinterpreted), withTiming continues from wherever it
  // genuinely is, satisfying Constitution §5.V for free.
  useEffect(() => {
    if (isPlaying || !slot) return;
    const target = railPosition(slot.angleDeg, selected ? SELECT_LIFT_PX : 0);
    translateX.value = withTiming(target.x, {
      duration: HAND_CARD_REPOSITION_DURATION_MS,
      easing: REPOSITION_EASING,
    });
    translateY.value = withTiming(target.y, {
      duration: HAND_CARD_REPOSITION_DURATION_MS,
      easing: REPOSITION_EASING,
    });
    rotate.value = withTiming(slot.angleDeg, {
      duration: HAND_CARD_REPOSITION_DURATION_MS,
      easing: REPOSITION_EASING,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slot?.angleDeg]);

  // Depart -> hold -> return, triggered once when isPlaying flips true. Every
  // property runs its own withSequence chain in parallel (Constitution §5.VI: one
  // physical motion, coordinated as a unit, whatever primitives implement it) —
  // only translateY's final leg carries the onComplete callback, since it's
  // sufficient for exactly one property to signal "the cycle is over."
  useEffect(() => {
    if (!isPlaying) return;
    const origin = railPosition(initialSlot.angleDeg, selected ? SELECT_LIFT_PX : 0);
    const departX = 0; // converges toward the fan's own pivot (angle 0's own x)
    const departY = origin.y - (SELECT_LIFT_PX + TRAVEL_DISTANCE);

    translateX.value = withSequence(
      withTiming(departX, { duration: TRAVEL_DURATION_MS, easing: TRAVEL_EASING }),
      withDelay(HOLD_MS, withTiming(origin.x, { duration: TRAVEL_DURATION_MS, easing: TRAVEL_EASING })),
    );
    translateY.value = withSequence(
      withTiming(departY, { duration: TRAVEL_DURATION_MS, easing: TRAVEL_EASING }),
      withDelay(
        HOLD_MS,
        withTiming(
          origin.y,
          { duration: TRAVEL_DURATION_MS, easing: TRAVEL_EASING },
          finished => {
            "worklet";
            if (finished) runOnJS(onComplete)(card.id);
          },
        ),
      ),
    );
    scale.value = withSequence(
      withTiming(RESTING_SCALE, { duration: TRAVEL_DURATION_MS, easing: TRAVEL_EASING }),
      withDelay(HOLD_MS, withTiming(1, { duration: TRAVEL_DURATION_MS, easing: TRAVEL_EASING })),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying]);

  function handlePress() {
    if (isPlayLocked) return;
    if (playMode === "twoTap" && !selected) {
      onSelect(card.id);
      return;
    }
    onSelect(null);
    onPlay(card.id);
  }

  const handlePressRef = useRef(handlePress);
  handlePressRef.current = handlePress;

  useEffect(() => {
    registerPress(card.id, () => handlePressRef.current());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registerPress, card.id]);

  // Deliberately NOT reading handlePressRef.current here — that ref exists only for
  // the stress-test's registerPress plumbing (plain JS, JS-thread only). Gesture
  // Handler's .onEnd callback is itself a worklet (runs on the UI thread); reading a
  // plain React ref's `.current` from inside a worklet is unsafe (confirmed by a
  // real "[Worklets] Tried to modify key `current`" runtime warning during this
  // demo's own live verification) — `handlePress` is captured directly by closure
  // instead, rebuilt fresh every render, which is what actually runs on the UI
  // thread's copy of this callback.
  const tap = Gesture.Tap()
    .maxDuration(250)
    .hitSlop(selected ? { top: SELECT_LIFT_PX } : undefined)
    .onEnd((_e, success) => {
      if (success) runOnJS(handlePress)();
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotate: `${rotate.value}deg` },
      { scale: scale.value },
    ],
  }));

  // This box's left/top is fixed for the lifetime of the component — it never reads
  // `slot`, `selected`, or anything reflow-related. This is the whole point of the
  // experiment: see the file-level comment.
  return (
    <GestureDetector gesture={tap}>
      <Animated.View
        testID={`demo08-card-${card.id}`}
        style={[
          styles.cardSlot,
          {
            left: centerX - SIMPLE_CARD_WIDTH / 2,
            top: HAND_TOP_OFFSET,
            zIndex,
          },
          animatedStyle,
        ]}>
        <SimpleCard card={card} />
      </Animated.View>
    </GestureDetector>
  );
}

const HandCard = React.memo(HandCardComponent);

const styles = StyleSheet.create({
  scrollView: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  container: { flexGrow: 1, alignItems: "center" },
  // Wraps only the mode-row/spacer region for the background-deselect gesture — see
  // this file's own comment above backgroundTap for why this can't wrap handWrapper
  // too. flex: 1 + alignItems: 'center' reproduces exactly what `container` provided
  // to these two children when they were direct siblings of it, so this extra
  // wrapping View changes zero visual layout.
  backgroundTapZone: { flex: 1, alignItems: "center" },
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
  spacer: { flex: 1, minHeight: SELECT_LIFT_PX + TRAVEL_DISTANCE + 40 },
  handWrapper: { position: "relative", alignSelf: "center" },
  cardSlot: { position: "absolute" },
});
