import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
// Mirrors Demo03PlayTravel.tsx/SelectableCard.tsx's own asymmetry: selecting snaps
// instantly, deselecting eases out for polish.
const SELECT_SNAP_DURATION_MS = 0;
const DESELECT_DURATION_MS = 150;
const HOLD_MS = 700;
const RESET_DURATION_MS = 300;
const HAND_TOP_OFFSET = 30;
const RESTING_SCALE = 0.7;
const RESTING_GLYPH_SCALE = 0.75;
// Same stress-test timing constants as Demo03PlayTravel.tsx — kept as local copies
// rather than exported/shared, matching this sub-project's existing convention of
// each demo file staying self-contained (see DEFAULT_FAN_CONFIG/DEFAULT_HAND_SIZE/etc. above, all
// already duplicated rather than imported).
const STRESS_TEST_CARD_STAGGER_MS = 150;
const STRESS_TEST_DOUBLE_TAP_GAP_MS = 90;

type PlayMode = "oneTap" | "twoTap";
// Whether THIS card is mid-flight — see Demo03PlayTravel.tsx's identical type for
// the full rationale (selection is orthogonal, shared across the hand below).
type PlayStage = "atRest" | "traveling" | "holding";

// React.memo'd — see Demo03PlayTravel.tsx's PlayableDemoCard for the full
// rationale; identical reasoning applies here now that `slot` is memoized below.
function TransformDemoCardComponent({
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

  // See Demo03PlayTravel.tsx's identical effect for the full rationale (the
  // playStage guard prevents fighting a travel animation already in flight).
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
    // Same travel as Demo 03/04, but the destination keyframe also shrinks scale
    // and glyphScale together with position/rotation — still one timeline, no
    // separate post-arrival "settle" step (Demo 05's own requirement).
    motion.retarget(
      idleKeyframe({
        rotateDeg: slot.rotateDeg,
        x: -slot.x,
        y: -(SELECT_LIFT_PX + TRAVEL_DISTANCE),
        scale: RESTING_SCALE,
        glyphScale: RESTING_GLYPH_SCALE,
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
    // A tap during 'traveling'/'holding' is ignored outright — see the
    // pointerEvents fix below anyway, which already removes this card's touch
    // target for the whole non-atRest window, so this guard is mostly a safety net
    // (e.g. for the Stress Test's programmatic press() calls).
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

  // "Latest ref" pattern — see Demo03PlayTravel.tsx's identical registration.
  const handlePressRef = useRef(handlePress);
  handlePressRef.current = handlePress;
  useEffect(() => {
    registerPress(card.id, () => handlePressRef.current());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registerPress, card.id]);

  return (
    <Pressable
      testID={`demo05-card-${card.id}`}
      onPress={handlePress}
      // Same fix as Demo03PlayTravel.tsx / apps/mobile/src/components/SelectableCard.tsx's
      // own documented hitSlop workaround: the lift transform below is purely visual —
      // RN hit-tests against the Pressable's untransformed layout box, which stays put —
      // so once selected, the card sits SELECT_LIFT_PX px higher than the only place a tap
      // actually registers. Without this, tapping the card's real, visible (lifted)
      // position does nothing; only the empty space it lifted away from still "hits."
      hitSlop={selected ? { top: SELECT_LIFT_PX } : undefined}
      style={[
        styles.cardSlot,
        { left: slot.x, top: HAND_TOP_OFFSET + slot.y },
        // Same touch-target fix as Demo03PlayTravel.tsx: the outer Pressable's
        // layout box never moves (only the inner Animated.View's transform does),
        // so it must stop hit-testing once the card leaves its resting slot or it
        // steals taps from whichever neighbor is now visibly exposed underneath.
        playStage !== "atRest" && { pointerEvents: "none" as const },
      ]}>
      <Animated.View style={{ transform: motion.transform }}>
        <SimpleCard card={card} glyphStyle={{ transform: [{ scale: motion.glyphScale }] }} />
      </Animated.View>
    </Pressable>
  );
}

const TransformDemoCard = React.memo(TransformDemoCardComponent);

// Demo 05: identical mechanic to Demo 03/04 (one/two-tap play, shared single
// selection, tap-outside-to-deselect, stress test), extending the travel with a
// scale-down (card + glyph together) to the resting trick-card size — still one
// timeline, per "Scale must not begin after translation ends." See
// Demo03PlayTravel.tsx for the full rationale behind each of the shared mechanics
// — duplicated here rather than factored into a shared hook, matching this
// sub-project's existing per-demo-file convention.
export function Demo05Transform() {
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
  // Memoized so each card's `slot` prop keeps a stable reference across re-renders
  // — see Demo03PlayTravel.tsx's identical `slots` memo for why this matters for
  // TransformDemoCard's React.memo above.
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

  // Identical to Demo03PlayTravel.tsx's runStressTest — useful here specifically to
  // exercise several cards' scale/glyph transform landing at once.
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
    <ScrollView contentContainerStyle={styles.scrollContent}>
      {/* Same DeselectableSurface-style wrapper as Demo02Selection.tsx/Demo03PlayTravel.tsx. */}
      <Pressable style={styles.container} onPress={() => setSelectedCardId(null)}>
        <View style={styles.modeRow}>
          {(["twoTap", "oneTap"] as const).map(mode => (
            <Pressable
              key={mode}
              testID={`demo05-mode-${mode}`}
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
            testID="demo05-stress-test"
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
            <TransformDemoCard
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
  hand: { position: "relative" },
  cardSlot: { position: "absolute" },
});
