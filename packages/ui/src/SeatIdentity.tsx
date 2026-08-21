import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Image,
  LayoutChangeEvent,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import { glowShadow } from "./glowShadow";
import { DISPLAY_BOLD } from "./typography";

const BADGE_IMAGE = require("../assets/avatars/seat-badge.png");
// Decorative ring (silver band, gold rim, two diamond accents) that replaces the plain
// code-drawn gold border. Source was docs/references/GPT-powerful-assets-review/
// diamond-avatar-frame-Photoroom-textcut.heic — actually a HEIF file despite its original .png
// extension (Photoroom's mobile export); `sharp`/libvips here can't decode it, so it was
// converted once via Windows' own WinRT imaging APIs (BitmapDecoder -> BitmapEncoder), not by a
// checked-in script — there's no cross-platform Node tool in this repo's toolchain that reads
// HEIF, so unlike the other table assets this one isn't mechanically reproducible from source on
// every machine. If this needs to change again, re-export from Photoroom as a real PNG/JPEG
// first to avoid repeating the manual conversion.
const AVATAR_FRAME_IMAGE = require("../assets/avatars/diamond-avatar-frame.png");

export type SeatIdentityAvatar =
  | "male-01"
  | "female-01"
  | "male-02"
  | "female-02"
  | "male-03"
  | "female-03"
  | "female-01-photoroom";

// The six dedicated face-crop images (avatar-male-01/02/03.png, avatar-female-01/02/03.png,
// built by build-avatar-assets.js) were deleted as unused; every SeatIdentityAvatar key now
// resolves to this same self-framed portrait for now, rather than leaving those keys dangling on
// missing files.
const SHARED_AVATAR_IMAGE = require("../assets/avatars/avatar-female01-Photoroom.png");
const AVATAR_IMAGES: Record<SeatIdentityAvatar, number> = {
  "male-01": SHARED_AVATAR_IMAGE,
  "female-01": SHARED_AVATAR_IMAGE,
  "male-02": SHARED_AVATAR_IMAGE,
  "female-02": SHARED_AVATAR_IMAGE,
  "male-03": SHARED_AVATAR_IMAGE,
  "female-03": SHARED_AVATAR_IMAGE,
  "female-01-photoroom": SHARED_AVATAR_IMAGE,
};

// avatar-female01-Photoroom.png already comes with its own baked-in circular gold ring straight
// out of Photoroom's export, with the portrait deliberately overflowing that ring's top/bottom
// edge. Stacking the default diamond ring (or a turn-state ring) on top of it would double up two
// mismatched rings, and "cover" resizeMode would crop the ring itself off the sides — so every
// avatar key skips the frame overlay entirely (its own ring is the frame) and uses "contain" so
// the full circle stays visible. All seven keys share this one image now, so all seven are
// self-framed.
const SELF_FRAMED_AVATARS = new Set<SeatIdentityAvatar>([
  "male-01",
  "female-01",
  "male-02",
  "female-02",
  "male-03",
  "female-03",
  "female-01-photoroom",
]);

// The desired shape of the content row (avatar + name/tricks + badge). Not tied to any image
// asset — there's no background plaque image anymore (see the comment above ORIENTATION_TRANSFORM
// for why one existed briefly and was removed) — this is purely a layout choice.
const CONTENT_ASPECT_RATIO = 450 / 90;

// Used before the anchor's real size is known (first render, or a test environment that never
// fires onLayout) — deliberately small and unobtrusive rather than a guess at the real anchor
// size, since it's replaced the instant a real measurement arrives in any environment that
// actually lays views out.
const FALLBACK_SIZE = { width: 100, height: 100 / CONTENT_ASPECT_RATIO };

export type SeatIdentityOrientation =
  | "horizontal"
  | "rotated-left"
  | "rotated-right";

// Modeled on TABLE-034's "2. TURN INDICATOR" reference (docs/references/GPT-powerful-assets-review/):
// active = bright glow halo around the plain avatar ring, next = a partially-lit segmented dial
// (reads as "coming up soon"), idle = the same dial mostly unlit. Placeholder styling below —
// glowShadow only — until the real glow-halo/segmented-ring assets are cut from that reference.
export type SeatIdentityTurnState = "active" | "next" | "idle";

// One ring image per turn state, e.g. the AVATAR-FRAME-MEDIUM-{IDLE,GLOW,APEAK-GLOW} set — an
// alternative to the default static AVATAR_FRAME_IMAGE for callers that have real per-state ring
// art instead of the code-drawn glowShadow placeholder. When provided, all three are rendered
// stacked and cross-faded (see turnOpacities below) instead of glowShadow being applied.
export interface SeatIdentityTurnStateFrames {
  idle: number;
  next: number;
  active: number;
}

export interface SeatIdentityProps {
  name: string;
  // Caller-formatted status text (e.g. Pişti's "🂠 N" captured-card count, or "N tricks" for a
  // trick-taking game) — SeatIdentity just lays it out, matching apps/mobile's PlayerBadge
  // pattern instead of assuming trick-taking terminology.
  statusText: string;
  orientation?: SeatIdentityOrientation;
  avatar?: SeatIdentityAvatar;
  turnState?: SeatIdentityTurnState;
  turnStateFrames?: SeatIdentityTurnStateFrames;
}

// Rotating a View via `transform` is paint-only — it never changes the element's own layout box.
// That means the content row can't be sized with ordinary width/height percentages: a percentage
// only ever resolves against its *own* parent axis (width% against parent width, height% against
// parent height), but a rotated box needs its pre-rotation width constrained by the anchor's
// HEIGHT (since that's what the rotated footprint's long axis lands in) and vice versa — a
// same-axis percentage can't express that. So the anchor is measured for real via onLayout, and
// contentSize() below does a manual "contain fit": pick whichever anchor dimension is the rotated
// long axis, fit the desired aspect ratio into it, and clamp to the short axis if that would
// overflow it. This is the fix for a real bug: an earlier fixed-pixel version rendered flush at
// the anchor's top-left (View children don't stretch/center under RN's layout defaults when the
// child has an explicit size, and nothing here was centering it) and, for the rotated seats, the
// rotated footprint landed partly outside the anchor entirely.
const ORIENTATION_TRANSFORM: Record<
  SeatIdentityOrientation,
  ViewStyle["transform"] | undefined
> = {
  horizontal: undefined,
  "rotated-left": [{ rotate: "90deg" }],
  "rotated-right": [{ rotate: "-90deg" }],
};

// Sideways text reads as an intentional style (labels on the side of a table); a sideways face
// does not. So the avatar ring gets the exact inverse rotation of its rotated parent, canceling
// the outer rotation out and keeping the photo upright regardless of which seat it's in.
const AVATAR_COUNTER_TRANSFORM: Record<
  SeatIdentityOrientation,
  ViewStyle["transform"] | undefined
> = {
  horizontal: undefined,
  "rotated-left": [{ rotate: "-90deg" }],
  "rotated-right": [{ rotate: "90deg" }],
};

// Base (unscaled) glowShadow radius per turn state — active reads as a strong halo (closest
// placeholder to TABLE-034's "ACTIVE (GLOW)" ring), next as a faint hint (standing in for that
// reference's partially-lit segmented dial), idle as none (its dial is essentially unlit).
const TURN_STATE_GLOW_RADIUS: Record<SeatIdentityTurnState, number> = {
  active: 14,
  next: 4,
  idle: 0,
};

// How long the ring takes to cross-fade from one turn state's art to another's — long enough to
// read as a deliberate transition ("this player is coming up"), short enough not to lag behind
// the actual turn change.
const TURN_STATE_CROSSFADE_MS = 350;
const TURN_STATES: SeatIdentityTurnState[] = ["idle", "next", "active"];

function contentSize(
  anchorWidth: number,
  anchorHeight: number,
  rotated: boolean,
): { width: number; height: number } {
  const availableLong = rotated ? anchorHeight : anchorWidth;
  const availableShort = rotated ? anchorWidth : anchorHeight;
  const heightFromLong = availableLong / CONTENT_ASPECT_RATIO;
  if (heightFromLong <= availableShort) {
    return { width: availableLong, height: heightFromLong };
  }
  return {
    width: availableShort * CONTENT_ASPECT_RATIO,
    height: availableShort,
  };
}

function SeatIdentityComponent({
  name,
  statusText,
  orientation = "horizontal",
  avatar = "male-01",
  turnState = "idle",
  turnStateFrames,
}: SeatIdentityProps) {
  const rotated = orientation !== "horizontal";
  const transform = ORIENTATION_TRANSFORM[orientation];
  const selfFramed = SELF_FRAMED_AVATARS.has(avatar);
  const [anchorSize, setAnchorSize] = useState<{
    width: number;
    height: number;
  } | null>(null);

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setAnchorSize({ width, height });
  }, []);

  const size = anchorSize
    ? contentSize(anchorSize.width, anchorSize.height, rotated)
    : FALLBACK_SIZE;
  // Every inner element (avatar ring, badge, text) was originally sized against a 100-wide
  // content row. Scaling them by how much bigger/smaller the measured size actually is keeps
  // their proportions correct instead of staying pinned at one fixed pixel size on every table
  // size.
  const scale = size.width / FALLBACK_SIZE.width;
  const turnGlowRadius = TURN_STATE_GLOW_RADIUS[turnState] * scale;

  // One Animated.Value per state, each holding that state's current opacity (1 = fully shown).
  // Initialized directly to the starting turnState rather than always starting at 0 and fading
  // in, so the very first render shows the correct ring immediately with no unwanted flash.
  const idleOpacity = useRef(
    new Animated.Value(turnState === "idle" ? 1 : 0),
  ).current;
  const nextOpacity = useRef(
    new Animated.Value(turnState === "next" ? 1 : 0),
  ).current;
  const activeOpacity = useRef(
    new Animated.Value(turnState === "active" ? 1 : 0),
  ).current;
  const turnOpacities: Record<SeatIdentityTurnState, Animated.Value> = {
    idle: idleOpacity,
    next: nextOpacity,
    active: activeOpacity,
  };

  useEffect(() => {
    if (turnStateFrames == null) return;
    // Cross-fades by animating every state's opacity toward whether it's the current one —
    // the outgoing state's ring fades out at the same time the incoming one fades in, rather
    // than a hard cut.
    Animated.parallel(
      TURN_STATES.map(state =>
        Animated.timing(turnOpacities[state], {
          toValue: state === turnState ? 1 : 0,
          duration: TURN_STATE_CROSSFADE_MS,
          useNativeDriver: true,
        }),
      ),
    ).start();
    // turnOpacities is rebuilt every render from the same three ref-backed Animated.Values, so
    // it isn't a stable dependency — depending on the refs directly instead avoids re-running
    // this effect on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turnState, turnStateFrames, idleOpacity, nextOpacity, activeOpacity]);

  return (
    <View style={styles.anchorFill} onLayout={handleLayout}>
      <View
        style={[
          styles.content,
          {
            width: size.width,
            height: size.height,
            paddingHorizontal: 4 * scale,
            gap: 3 * scale,
          },
          transform ? { transform } : null,
        ]}
        testID="seat-identity">
        <View
          style={[
            styles.avatarRing,
            { width: 14 * scale, height: 14 * scale },
            turnStateFrames == null && turnGlowRadius > 0
              ? glowShadow("#f4c542", turnGlowRadius)
              : null,
          ]}
          testID="seat-identity-avatar">
          <View style={styles.avatarPhotoClip}>
            <Image
              source={AVATAR_IMAGES[avatar]}
              style={[
                styles.avatarImage,
                AVATAR_COUNTER_TRANSFORM[orientation]
                  ? { transform: AVATAR_COUNTER_TRANSFORM[orientation] }
                  : null,
              ]}
              resizeMode={selfFramed ? "contain" : "cover"}
              testID="seat-identity-avatar-image"
            />
          </View>
          {selfFramed ? null : turnStateFrames == null ? (
            <Image
              source={AVATAR_FRAME_IMAGE}
              style={[
                StyleSheet.absoluteFill,
                styles.avatarFrameOverlay,
                AVATAR_COUNTER_TRANSFORM[orientation]
                  ? { transform: AVATAR_COUNTER_TRANSFORM[orientation] }
                  : null,
              ]}
              resizeMode="contain"
              testID="seat-identity-avatar-frame"
            />
          ) : (
            TURN_STATES.map(state => (
              <Animated.Image
                key={state}
                source={turnStateFrames[state]}
                style={[
                  StyleSheet.absoluteFill,
                  styles.avatarFrameOverlay,
                  { opacity: turnOpacities[state] },
                  AVATAR_COUNTER_TRANSFORM[orientation]
                    ? { transform: AVATAR_COUNTER_TRANSFORM[orientation] }
                    : null,
                ]}
                resizeMode="contain"
                testID={`seat-identity-avatar-frame-${state}`}
              />
            ))
          )}
        </View>
        <View style={styles.textColumn}>
          <Text
            style={[
              styles.nameText,
              { fontSize: 7 * scale, lineHeight: 9 * scale },
            ]}
            numberOfLines={1}>
            {name}
          </Text>
          <Text
            style={[
              styles.trickText,
              { fontSize: 5.5 * scale, lineHeight: 7 * scale },
            ]}
            numberOfLines={1}>
            {statusText}
          </Text>
        </View>
        <Image
          source={BADGE_IMAGE}
          style={[styles.badge, { width: 12 * scale, height: 12 * scale }]}
          resizeMode="contain"
          testID="seat-identity-badge"
        />
      </View>
    </View>
  );
}

export const SeatIdentity = React.memo(SeatIdentityComponent);

const styles = StyleSheet.create({
  // Fills and centers the content row inside whatever seat anchor this is placed in.
  anchorFill: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 4,
    gap: 3,
  },
  // Just a positioning box now — the photo's circular clip and the ring's visible border both
  // come from its two children below, not from this container's own style.
  avatarRing: { width: 14, height: 14 },
  avatarPhotoClip: {
    width: "100%",
    height: "100%",
    borderRadius: 9999,
    backgroundColor: "rgba(0, 0, 0, 0.35)",
    // Clips the avatar photo to the circle regardless of what's in the source crop's corners —
    // see build-avatar-assets.js's header for why the crop itself doesn't need to be pre-masked.
    overflow: "hidden",
  },
  avatarImage: { width: "100%", height: "100%" },
  // Drawn on top of the photo at the same box; diamond-avatar-frame.png's own hole is where the
  // photo shows through, so this doesn't need its own circular clip — it's already a ring shape.
  avatarFrameOverlay: { width: "100%", height: "100%" },
  textColumn: { flex: 1, minWidth: 0 },
  nameText: {
    color: "#e8e3d2",
    fontFamily: DISPLAY_BOLD,
    fontSize: 7,
    lineHeight: 9,
  },
  trickText: {
    color: "#b8b3a2",
    fontSize: 5.5,
    lineHeight: 7,
  },
  badge: { width: 12, height: 12 },
});
