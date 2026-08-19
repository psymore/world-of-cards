import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Animated,
  Easing,
  EasingFunction,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { Card } from "@world-of-cards/engine";
import {
  SimpleCard,
  SIMPLE_CARD_HEIGHT,
  SIMPLE_CARD_WIDTH,
} from "../components/SimpleCard";
import {
  computeFanSlot,
  computeFanWidth,
  FanLayoutConfig,
  FanSlot,
} from "../components/fanLayout";
import { useCardMotion } from "../engine/useCardMotion";
import { FanConfigControls } from "../components/FanConfigControls";
import { idleKeyframe } from "../types";
import { SEAT_COUNT, useDealLoop } from "../state/useDealLoop";

const DEFAULT_FAN_CONFIG: FanLayoutConfig = {
  overlap: 0.6,
  arcDegrees: 40,
  maxRotationDeg: 20,
  spacingPx: 40,
};
const SELECT_LIFT_PX = 28;
const TRAVEL_DISTANCE = 260;
const TRAVEL_DURATION_MS = 450;
const TRICK_HOLD_MS = 1100;
const RESTING_SCALE = 0.7;
const RESTING_GLYPH_SCALE = 0.75;
const AI_THINK_DELAY_MS = 900;
const HAND_TOP_OFFSET = 30;
const HUMAN_SEAT = 0;
// Mirrors Demo03PlayTravel.tsx/SelectableCard.tsx's own asymmetry: selecting snaps
// instantly, deselecting eases out for polish.
const SELECT_SNAP_DURATION_MS = 0;
const DESELECT_DURATION_MS = 150;
// Mirrors apps/mobile/src/games/batak/table/HumanHandFan.tsx's own local-departure
// design (docs/superpowers/specs/2026-07-22-batak-play-travel-local-departure-design.md):
// the played card's brief "leave the hand" leg happens BEFORE handing off to the
// globally-elevated TrickCard, so it never has to instantly jump to a higher
// stacking context while still sitting among its fan neighbors — see
// HumanHandCardComponent's `play()` for the full mechanism. The real-world distance
// requirement (clear the row before it's safe to elevate) — everything about HOW
// LONG that takes and what curve it follows is derived from this via
// splitEaseOutCubic below, not authored as separate fixed constants.
const LOCAL_DEPARTURE_DISTANCE = SIMPLE_CARD_HEIGHT;

// The exact Easing.out(cubic) curve used for the whole human-play travel, as a
// plain callable function rather than an opaque RN EasingFunction — needed so it
// can be analytically split below.
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

// Splits ONE continuous easeOutCubic journey (spanning the full TRAVEL_DURATION_MS)
// into two legs at the exact point where `progressFraction` of the total distance
// has been covered. This is the fix for the local-departure/trick-center handoff
// reading as two separate travel phases: an earlier version authored the local
// leg's easing independently (linear) and let the trick-center leg restart its own
// fresh Easing.out(cubic) — even with matching endpoint VALUES at the seam, "linear,
// then a curve that begins at its own steepest slope" is a genuinely different
// velocity-over-time shape than one continuous decelerating curve, and reads as a
// seam no matter how the constants are tuned. Splitting the SAME function
// algebraically instead — reparametrizing each leg's own [0,1] input so it
// reproduces exactly what evaluating easeOutCubic continuously would show at that
// real elapsed time — makes both value AND velocity match exactly at the splice,
// because it's literally the same curve, not two curves glued together. Applied
// identically to position AND scale/glyphScale (see HumanHandCardComponent's
// `play()`), so everything stays in lockstep exactly like Demo 05's single-timeline
// travel already does.
function splitEaseOutCubic(progressFraction: number): {
  timeFraction: number;
  localEasing: EasingFunction;
  remainingEasing: EasingFunction;
} {
  const splitValue = progressFraction; // by construction, easeOutCubic(timeFraction) === progressFraction
  const timeFraction = 1 - Math.pow(1 - progressFraction, 1 / 3);
  const localEasing: EasingFunction = tau => easeOutCubic(tau * timeFraction) / splitValue;
  const remainingEasing: EasingFunction = tau =>
    (easeOutCubic(timeFraction + tau * (1 - timeFraction)) - splitValue) / (1 - splitValue);
  return { timeFraction, localEasing, remainingEasing };
}

// Fixed offset each non-human seat's card travels FROM, relative to its own resting
// trick-slot position (see TrickCard) — deliberately not measured from a rendered
// opponent hand, since opponents are represented only by a card-count label here
// (this demo's animation focus is the travel itself, not opponent hand visuals).
const SEAT_ORIGIN_OFFSET: Record<number, { x: number; y: number }> = {
  0: { x: 0, y: SELECT_LIFT_PX + TRAVEL_DISTANCE }, // human — overridden per-play, see below
  1: { x: 220, y: 0 }, // right
  2: { x: 0, y: -180 }, // top
  3: { x: -220, y: 0 }, // left
};

// Small stagger per seat so 4 resting trick cards don't perfectly overlap.
const TRICK_SLOT_OFFSET: Record<number, { x: number; y: number }> = {
  0: { x: 0, y: 20 },
  1: { x: 20, y: 0 },
  2: { x: 0, y: -20 },
  3: { x: -20, y: 0 },
};

type PlayMode = "oneTap" | "twoTap";

// What the human's own play hands off to TrickCard with — see TrickCardComponent's
// own prop doc comments for what each field means and why it's optional.
interface HumanPlayOrigin {
  x: number;
  y: number;
  rotateDeg: number;
  durationMs: number;
  startScale?: number;
  startGlyphScale?: number;
  easing?: EasingFunction;
}

function TrickCardComponent({
  card,
  seat,
  originOffset,
  originRotateDeg = 0,
  travelDurationMs = TRAVEL_DURATION_MS,
  startScale = 1,
  startGlyphScale = 1,
  easing = Easing.out(Easing.cubic),
}: {
  card: Card;
  seat: number;
  originOffset: { x: number; y: number };
  // Confirmed against the real apps/mobile/src/games/batak/table/TrickCenter.tsx:
  // TravelCard holds originRotateDeg FIXED for its entire flight (never eases toward
  // upright), and the resting card afterward keeps that exact same angle forever
  // (via restingRotations) rather than snapping flat — a card never straightens out,
  // in flight or at rest. This prop is that same fixed angle, applied identically to
  // both this card's initial AND destination keyframe below. Always 0 for AI seats
  // (no rendered hand to depart from, so no angle to preserve).
  originRotateDeg?: number;
  // Shorter than TRAVEL_DURATION_MS for a human play that already spent
  // LOCAL_DEPARTURE_DURATION_MS on its local-departure leg — see
  // HumanHandCardComponent's `play()` — so the two legs' combined duration still
  // equals one full, natural-feeling travel. Always the full TRAVEL_DURATION_MS for
  // AI seats and for a human play that skipped local departure entirely (see
  // canLocalDepart).
  travelDurationMs?: number;
  // The scale/glyphScale the local-departure leg already eased this card down to
  // (see HumanHandCardComponent's `play()`/onDepartWithLocalLeg — mirrors
  // Demo05Transform.tsx's identical fix) — this card's own resize picks up exactly
  // where that leg left off, in both value and rate, instead of starting fresh from
  // 1 and freezing the shrink for the whole local-departure window. Always 1 for AI
  // seats and for a human play that skipped local departure.
  startScale?: number;
  startGlyphScale?: number;
  // The easing this card's arrival should use — for a human play following a
  // local-departure leg, this is the exact remaining-portion easing derived by
  // splitEaseOutCubic (see HumanHandCardComponent's `play()`), so this leg
  // continues the SAME curve the local leg started rather than a fresh,
  // independently-authored Easing.out(cubic). Defaults to plain Easing.out(cubic)
  // for AI seats and for a human play that skipped local departure — both cases
  // that never split a curve to begin with, so there's nothing to continue.
  easing?: EasingFunction;
}) {
  const motion = useCardMotion({
    initial: idleKeyframe({
      x: originOffset.x,
      y: originOffset.y,
      rotateDeg: originRotateDeg,
      scale: startScale,
      glyphScale: startGlyphScale,
    }),
    defaultDurationMs: travelDurationMs,
    defaultEasing: easing,
  });
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    // Animates from its origin offset (and origin scale) down to
    // {0,0,scale:RESTING_SCALE,...} — its own resting position, laid out via
    // TRICK_SLOT_OFFSET below. rotateDeg is repeated here (not omitted) — omitting
    // it would default to 0 via idleKeyframe, exactly the "eases back to upright"
    // bug this fix corrects.
    motion.retarget(
      idleKeyframe({
        rotateDeg: originRotateDeg,
        scale: RESTING_SCALE,
        glyphScale: RESTING_GLYPH_SCALE,
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const slotOffset = TRICK_SLOT_OFFSET[seat] ?? { x: 0, y: 0 };
  // The per-seat stagger is applied via `transform`, not by overriding left/top —
  // styles.trickSlot's left/top: '50%' (plus its negative margins) is what centers
  // this card in trickArea in the first place; setting left/top here directly would
  // clobber that centering instead of composing with it (RN merges array styles by
  // later-key-wins, it doesn't add them).
  return (
    <View
      style={[
        styles.trickSlot,
        {
          transform: [
            { translateX: slotOffset.x },
            { translateY: slotOffset.y },
          ],
        },
      ]}>
      <Animated.View style={{ transform: motion.transform }}>
        <SimpleCard
          card={card}
          glyphStyle={{ transform: [{ scale: motion.glyphScale }] }}
        />
      </Animated.View>
    </View>
  );
}

// React.memo'd — card/seat/originOffset are all referentially stable across parent
// re-renders for the lifetime of a given trick-card entry (see Demo07CompleteSequence
// below: currentTrick's array is rebuilt on each play, but existing elements are
// carried over unchanged via spread, not recreated).
const TrickCard = React.memo(TrickCardComponent);

// React.memo'd — see Demo03PlayTravel.tsx's PlayableDemoCard for the full rationale;
// identical reasoning applies here now that `slot` is memoized and `onPlay`/`onSelect`
// are stable references (see Demo07CompleteSequence below).
function HumanHandCardComponent({
  card,
  slot,
  isTurn,
  selected,
  playMode,
  onSelect,
  onPlay,
  onDepartureStart,
  getTrickDestination,
}: {
  card: Card;
  slot: FanSlot;
  isTurn: boolean;
  selected: boolean;
  playMode: PlayMode;
  onSelect: (cardId: string | null) => void;
  onPlay: (cardId: string, originOffset: HumanPlayOrigin) => void;
  // Marks (or clears) which card is currently running its local-departure leg — see
  // `play()` below — so the parent can freeze every other card's interactivity for
  // that brief window, matching Batak's `pendingPlay == null && localDeparture ==
  // null` legal-moves gate.
  onDepartureStart: (cardId: string | null) => void;
  // Returns the trick area's real, measured window position (see
  // Demo07CompleteSequence's measureTrickDestination) — null until the first layout
  // pass has fired.
  getTrickDestination: () => { x: number; y: number } | null;
}) {
  const motion = useCardMotion({
    initial: idleKeyframe({ rotateDeg: slot.rotateDeg }),
    defaultDurationMs: DESELECT_DURATION_MS,
    defaultEasing: Easing.out(Easing.cubic),
  });
  const wasSelected = useRef(selected);
  const pressableRef = useRef<React.ElementRef<typeof Pressable> | null>(null);
  // Set synchronously the instant this card commits to playing (before onSelect(null)
  // below even runs) — guards the deselect effect just below from easing this card
  // back down to y=0 while its local-departure leg (or the async position
  // measurement preceding it) is already underway. Needs to be a ref, not state: it
  // must take effect before the NEXT render (when `selected` flips to false and the
  // effect would otherwise fire), and a same-tick ref write is the only way to
  // guarantee that ordering — see the effect's own comment.
  const isPlayingRef = useRef(false);
  const departureTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (departureTimerRef.current) clearTimeout(departureTimerRef.current);
    };
  }, []);

  // Drives the select-lift/deselect ease. Guarded on isPlayingRef: without it, the
  // instant `onSelect(null)` fires (inside handlePress, synchronously, before the
  // async position measurement or local-departure leg even starts), this effect
  // would run on the next render and ease the card back down to y=0 — visibly
  // fighting the local-departure retarget that's about to move it the opposite way.
  useEffect(() => {
    if (wasSelected.current === selected) return;
    wasSelected.current = selected;
    if (isPlayingRef.current) return;
    motion.retarget(
      idleKeyframe({
        rotateDeg: slot.rotateDeg,
        y: selected ? -SELECT_LIFT_PX : 0,
      }),
      { durationMs: selected ? SELECT_SNAP_DURATION_MS : DESELECT_DURATION_MS },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  function handlePress() {
    if (!isTurn) return;
    if (playMode === "twoTap" && !selected) {
      onSelect(card.id);
      return;
    }
    // `selected` reflects this render's (pre-play) value even after the onSelect(null)
    // call below — props don't change until the next render — so it's safe to read
    // here to know whether the card is currently lifted.
    const wasLifted = selected;
    isPlayingRef.current = true;
    onSelect(null);
    play(wasLifted);
  }

  // Resolves the trick card's real starting position from this card's actual,
  // currently-rendered position (measured live, via measureInWindow) relative to
  // the trick area's own real position (cached once via onLayout in the parent) —
  // rather than Demo03/04/05's within-one-container math, which doesn't apply here
  // since the played card hands off to a separate TrickCard mounted in a different
  // container (see Demo07CompleteSequence's own doc comment on this difference from
  // Demo 05). Falls back to the old fixed-formula approximation if either
  // measurement isn't available yet (e.g. the very first frame, before either
  // view's onLayout/measureInWindow has resolved) — no local-departure leg in that
  // case either, since there's no real measured vector to depart along.
  function play(wasLifted: boolean) {
    const fallbackOrigin = { x: -slot.x, y: SELECT_LIFT_PX + TRAVEL_DISTANCE };
    const destination = getTrickDestination();
    const node = pressableRef.current;
    if (!destination || !node) {
      onPlay(card.id, {
        ...fallbackOrigin,
        rotateDeg: slot.rotateDeg,
        durationMs: TRAVEL_DURATION_MS,
      });
      return;
    }
    node.measureInWindow((x, y, width, height) => {
      // measureInWindow reports the Pressable's untransformed layout box — it never
      // moves, even while this card is visually lifted (see the hitSlop comment
      // below) — so the lift has to be subtracted back in by hand to get the card's
      // real, currently-visible center.
      const visualY = wasLifted ? y - SELECT_LIFT_PX : y;
      const cardCenter = { x: x + width / 2, y: visualY + height / 2 };
      const fullOrigin = {
        x: cardCenter.x - destination.x,
        y: cardCenter.y - destination.y,
      };

      // Only worth a separate local leg if the card starts far enough away that
      // LOCAL_DEPARTURE_DISTANCE doesn't exceed (or equal) the whole trip — see
      // splitEaseOutCubic, which requires progressFraction < 1.
      const progressFraction = LOCAL_DEPARTURE_DISTANCE / fullOrigin.y;
      if (progressFraction >= 1) {
        onPlay(card.id, {
          ...fullOrigin,
          rotateDeg: slot.rotateDeg,
          durationMs: TRAVEL_DURATION_MS,
        });
        return;
      }

      // Local departure: this SAME HumanHandCard instance keeps animating within the
      // hand's own natural stacking order (no unmount, no elevated container yet) —
      // moving along the real straight-line vector toward the trick center (both x
      // and y, proportioned so y covers exactly LOCAL_DEPARTURE_DISTANCE) rather than
      // straight up, so the flight reads as one continuous motion once TrickCard
      // takes over — matching HumanHandFan.tsx's own identical reasoning. The split
      // point (in both time and progress) is derived from the real ease-out-cubic
      // curve via splitEaseOutCubic, not a fixed guess — see its own doc comment for
      // why this, not independently-authored easing per leg, is what actually removes
      // the "two separate travel phases" feel. Scale/glyphScale ride the exact same
      // split, so they stay in lockstep with position throughout, matching Demo 05's
      // single-timeline travel.
      onDepartureStart(card.id);
      const { timeFraction, localEasing, remainingEasing } = splitEaseOutCubic(progressFraction);
      const localDurationMs = Math.round(timeFraction * TRAVEL_DURATION_MS);
      const departureDeltaX = fullOrigin.x * progressFraction;
      const localScale = 1 - progressFraction * (1 - RESTING_SCALE);
      const localGlyphScale = 1 - progressFraction * (1 - RESTING_GLYPH_SCALE);
      motion.retarget(
        idleKeyframe({
          rotateDeg: slot.rotateDeg,
          x: -departureDeltaX,
          y: (wasLifted ? -SELECT_LIFT_PX : 0) - LOCAL_DEPARTURE_DISTANCE,
          scale: localScale,
          glyphScale: localGlyphScale,
        }),
        {
          durationMs: localDurationMs,
          easing: localEasing,
        },
      );
      departureTimerRef.current = setTimeout(() => {
        onDepartureStart(null);
        onPlay(card.id, {
          x: fullOrigin.x - departureDeltaX,
          y: fullOrigin.y - LOCAL_DEPARTURE_DISTANCE,
          rotateDeg: slot.rotateDeg,
          durationMs: TRAVEL_DURATION_MS - localDurationMs,
          startScale: localScale,
          startGlyphScale: localGlyphScale,
          easing: remainingEasing,
        });
      }, localDurationMs);
    });
  }

  return (
    <Pressable
      ref={pressableRef}
      testID={`demo07-human-card-${card.id}`}
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
      ]}>
      <Animated.View style={{ transform: motion.transform }}>
        <SimpleCard card={card} />
      </Animated.View>
    </Pressable>
  );
}

const HumanHandCard = React.memo(HumanHandCardComponent);

// Demo 07: everything from Demos 01-05 combined, driven by useDealLoop's continuous
// 4-seat turn cycle. Only the human seat (0) is tap-interactive; seats 1-3 auto-play
// their first card after a short delay once it's their turn. Shares Demo03/04/05's
// mechanics for the human hand specifically: one/two-tap play mode, a single shared
// `selectedCardId` (rather than each card tracking its own local selection — the same
// "two cards lifted at once" bug Demo02 originally had), tap-outside-to-deselect, and
// the select-lift hitSlop touch-target fix. Deliberately NOT ported: the Stress Test
// button — this demo's turn-based single-active-seat rule means the human can only
// ever have one playable card at a time (control passes to the next seat the instant
// a card is played), so there's no "several of the human's own cards played back to
// back" scenario for a stress test to exercise the way Demo03/04/05's free-standing
// fans allow; the continuous AI auto-play already exercises concurrent trick-card
// travel on an ongoing basis.
//
// The human's own play additionally runs a brief local-departure leg
// (HumanHandCardComponent's `play()`) before handing off to the globally-elevated
// TrickCard — mirroring apps/mobile/src/games/batak/table/HumanHandFan.tsx's own
// design. Without it, the played card would instantly jump from the hand's natural
// per-card stacking order into TrickCard's always-on-top container the instant it's
// tapped, reading as an artificial "pop to the front" before the card even starts
// moving — especially visible for a card sitting between two neighbors in the fan.
// The local leg keeps the SAME HumanHandCard instance mounted (same JSX position,
// same natural stacking among its siblings, no elevated zIndex) for
// LOCAL_DEPARTURE_DURATION_MS, moving it along the real straight-line vector toward
// the trick center by one card-height — by the time TrickCard takes over, the card
// has already visually cleared the row, so there's nothing left for the stacking
// jump to visibly clip in front of.
export function Demo07CompleteSequence() {
  const { seats, turnSeat, currentTrick, playCard, clearTrick } = useDealLoop();
  const humanOriginsRef = useRef<Map<string, HumanPlayOrigin>>(new Map());
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [playMode, setPlayMode] = useState<PlayMode>("twoTap");
  // No Hand size slider here — the human hand's size is driven by useDealLoop's
  // shared 4-seat, 52-card deal, not a free variable like every other demo's static
  // hand — see FanConfigControls' own comment on the handSize prop being optional.
  const [overlap, setOverlap] = useState(DEFAULT_FAN_CONFIG.overlap);
  const [arcDegrees, setArcDegrees] = useState(DEFAULT_FAN_CONFIG.arcDegrees);
  const [maxRotationDeg, setMaxRotationDeg] = useState(DEFAULT_FAN_CONFIG.maxRotationDeg);
  const [spacingPx, setSpacingPx] = useState(DEFAULT_FAN_CONFIG.spacingPx);
  const fanConfig: FanLayoutConfig = useMemo(
    () => ({ overlap, arcDegrees, maxRotationDeg, spacingPx }),
    [overlap, arcDegrees, maxRotationDeg, spacingPx],
  );
  // The human card currently running its local-departure leg (HumanHandCardComponent's
  // `play()`), or null the rest of the time — freezes every hand card's interactivity
  // for that brief window (folded into isHumanTurn below), matching Batak's own
  // `pendingPlay == null && localDeparture == null` legal-moves gate.
  const [departingCardId, setDepartingCardId] = useState<string | null>(null);
  const trickAreaRef = useRef<React.ElementRef<typeof View> | null>(null);
  // The trick area's real, measured window position (its center, plus the human
  // seat's own resting stagger — see TRICK_SLOT_OFFSET) — what a played card's
  // measured position is compared against to get its real travel origin. Cached via
  // measureTrickDestination below rather than measured fresh on every play, since
  // the trick area's own position doesn't change once laid out.
  const trickDestinationRef = useRef<{ x: number; y: number } | null>(null);

  const measureTrickDestination = useCallback(() => {
    trickAreaRef.current?.measureInWindow((x, y, width, height) => {
      const stagger = TRICK_SLOT_OFFSET[HUMAN_SEAT] ?? { x: 0, y: 0 };
      trickDestinationRef.current = {
        x: x + width / 2 + stagger.x,
        y: y + height / 2 + stagger.y,
      };
    });
  }, []);
  const getTrickDestination = useCallback(
    () => trickDestinationRef.current,
    [],
  );

  // Stable across renders (playCard itself is useCallback([])'d inside useDealLoop) —
  // see Demo03PlayTravel.tsx's registerPress for why a stable callback matters once
  // HumanHandCard is React.memo'd.
  const handleHumanPlay = useCallback(
    (cardId: string, originOffset: HumanPlayOrigin) => {
      humanOriginsRef.current.set(cardId, originOffset);
      playCard(HUMAN_SEAT, cardId);
    },
    [playCard],
  );

  // Auto-play for AI seats (1-3): plays the first card in hand shortly after it
  // becomes that seat's turn. No legality constraint exists in this playground (no
  // trump, no suit-following), so "auto-play" just means "play the first card."
  useEffect(() => {
    if (turnSeat === HUMAN_SEAT) return;
    const hand = seats[turnSeat];
    if (hand.length === 0) return;
    const timer = setTimeout(() => {
      playCard(turnSeat, hand[0].id);
    }, AI_THINK_DELAY_MS);
    return () => clearTimeout(timer);
  }, [turnSeat, seats, playCard]);

  // Once all 4 seats have played into the current trick, hold briefly (matching
  // this repo's existing "trick completing" pause convention) then clear.
  useEffect(() => {
    if (currentTrick.length < 4) return;
    const timer = setTimeout(() => {
      humanOriginsRef.current.clear();
      clearTrick();
    }, TRICK_HOLD_MS);
    return () => clearTimeout(timer);
  }, [currentTrick, clearTrick]);

  const humanHand = seats[HUMAN_SEAT];
  const totalWidth = computeFanWidth(humanHand.length, fanConfig);
  // Memoized so each card's `slot` prop keeps a stable reference across re-renders
  // (this demo re-renders often, e.g. every AI auto-play timer) — see
  // Demo03PlayTravel.tsx's identical `slots` memo for why this matters for
  // HumanHandCard's React.memo above. Recomputed whenever humanHand itself changes
  // (a play or a reshuffle) or fanConfig changes (a slider drag), which is exactly
  // when positions actually need to shift.
  const slots = useMemo(
    () =>
      humanHand.map((_, i) => computeFanSlot(i, humanHand.length, fanConfig)),
    [humanHand, fanConfig],
  );
  // turnSeat advances immediately on each play, so after the 4th (last) card of a
  // trick lands, turnSeat has already wrapped back around to HUMAN_SEAT even though
  // currentTrick is still sitting there mid-hold, waiting for the TRICK_HOLD_MS
  // pause above to clear it. Without the currentTrick.length check, the human could
  // tap and play a 5th card into that same not-yet-cleared trick during the hold
  // window. The departingCardId check freezes every other hand card while one is
  // mid local-departure — see HumanHandCardComponent's `play()`.
  const isHumanTurn =
    turnSeat === HUMAN_SEAT &&
    currentTrick.length < SEAT_COUNT &&
    departingCardId == null;

  return (
    // Wrapped in a ScrollView — see Demo02Selection.tsx's identical wrapper for why.
    <ScrollView contentContainerStyle={styles.scrollContent}>
      {/* Same DeselectableSurface-style wrapper as Demo02Selection.tsx/Demo03PlayTravel.tsx. */}
      <Pressable style={styles.container} onPress={() => setSelectedCardId(null)}>
        <View style={styles.modeRow}>
          {(["twoTap", "oneTap"] as const).map(mode => (
            <Pressable
              key={mode}
              testID={`demo07-mode-${mode}`}
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
        </View>
        <View style={styles.opponentRow}>
          {[2, 1, 3].map(seat => (
            <Text key={seat} style={styles.opponentLabel}>
              Seat {seat}: {seats[seat].length} cards{" "}
              {turnSeat === seat ? "(thinking...)" : ""}
            </Text>
          ))}
        </View>
        <View
          ref={trickAreaRef}
          onLayout={measureTrickDestination}
          style={[
            styles.trickArea,
            { width: SIMPLE_CARD_WIDTH + 80, height: SIMPLE_CARD_HEIGHT + 80 },
          ]}>
          {currentTrick.map(({ seat, card }) => {
            const humanOrigin =
              seat === HUMAN_SEAT
                ? humanOriginsRef.current.get(card.id)
                : undefined;
            return (
              <TrickCard
                key={card.id}
                card={card}
                seat={seat}
                originOffset={
                  humanOrigin ??
                  (seat === HUMAN_SEAT
                    ? SEAT_ORIGIN_OFFSET[HUMAN_SEAT]
                    : SEAT_ORIGIN_OFFSET[seat])
                }
                originRotateDeg={humanOrigin?.rotateDeg}
                travelDurationMs={humanOrigin?.durationMs}
                startScale={humanOrigin?.startScale}
                startGlyphScale={humanOrigin?.startGlyphScale}
                easing={humanOrigin?.easing}
              />
            );
          })}
        </View>
        <View
          style={[
            styles.hand,
            {
              width: totalWidth,
              height: SIMPLE_CARD_HEIGHT + HAND_TOP_OFFSET + 40,
            },
          ]}>
          {humanHand.map((card, i) => (
            <HumanHandCard
              key={card.id}
              card={card}
              slot={slots[i]}
              isTurn={isHumanTurn}
              selected={selectedCardId === card.id}
              playMode={playMode}
              onSelect={setSelectedCardId}
              onPlay={handleHumanPlay}
              onDepartureStart={setDepartingCardId}
              getTrickDestination={getTrickDestination}
            />
          ))}
        </View>
        <FanConfigControls
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
  container: { flexGrow: 1, paddingVertical: 12 },
  modeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
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
  opponentRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingHorizontal: 12,
  },
  opponentLabel: { color: "#fff", fontSize: 12 },
  // zIndex above `hand` (a later JSX sibling, which would otherwise paint on top by
  // default): the human's just-played card travels from down near the hand's own
  // screen region up to here, so without this, a newly-mounted TrickCard would
  // render BEHIND the hand fan for the early part of its flight instead of in front
  // of it — the "z-index respected" fix requested alongside the real-position one.
  trickArea: {
    alignSelf: "center",
    position: "relative",
    zIndex: 10,
    elevation: 10,
  },
  trickSlot: {
    position: "absolute",
    left: "50%",
    top: "50%",
    marginLeft: -SIMPLE_CARD_WIDTH / 2,
    marginTop: -SIMPLE_CARD_HEIGHT / 2,
  },
  hand: { alignSelf: "center", position: "relative" },
  cardSlot: { position: "absolute" },
});
