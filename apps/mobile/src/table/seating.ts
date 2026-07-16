// Pure geometry for seating opponents around a 4-player table and fanning/stacking their
// face-down hands. No React/RN dependency, shared by every game whose table needs the same
// "3 opponents at left/top/right, human at bottom" layout (first shared use: Pişti's 4-player
// free-for-all mode; second: Batak, which is fixed 4-player).

export type SeatPosition = "top" | "left" | "right";

export interface Seat {
  position: SeatPosition;
  playerId: string;
}

// 1 opponent sits across the table (top); 3 sit left/top/right around the human, who is
// always at the bottom. Turn order (state.players, human first) proceeds counter-clockwise —
// bottom → right → top → left → bottom — so the first opponent in turn order sits on the
// right, not the left. Any other count falls back to seating everyone across the top.
export function assignSeats(opponentPlayerIds: string[]): Seat[] {
  if (opponentPlayerIds.length === 3) {
    const [right, top, left] = opponentPlayerIds;
    return [
      { position: "left", playerId: left },
      { position: "top", playerId: top },
      { position: "right", playerId: right },
    ];
  }
  return opponentPlayerIds.map(playerId => ({
    position: "top" as const,
    playerId,
  }));
}

const OPPONENT_FAN_DEGREES_PER_STEP = 8;
const OPPONENT_FAN_CURVE = 3;

export function fanRotationDeg(
  index: number,
  count: number,
  degreesPerStep: number = OPPONENT_FAN_DEGREES_PER_STEP,
): number {
  if (count <= 1) return 0;
  const mid = (count - 1) / 2;
  return (index - mid) * degreesPerStep;
}

// Cards further from the center card droop down slightly, like a fan held from below and
// spread facing the viewer, rather than sitting on a flat line. Pass direction: -1 to flip the
// curve (ends rise instead of droop — center card lowest); the default of 1 preserves the
// original droop for every existing call site.
export function fanCurveY(
  index: number,
  count: number,
  direction: 1 | -1 = 1,
  curveMultiplier: number = OPPONENT_FAN_CURVE,
): number {
  if (count <= 1) return 0;
  return (
    Math.pow(Math.abs(index - (count - 1) / 2), 2) *
    curveMultiplier *
    direction
  );
}

// The human's own hand (Batak, and any future game with a large face-up hand) splits into two
// rows once it can't read cleanly as one — always rebalanced as the hand shrinks, rather than
// keeping one row's size fixed, so the fan stays visually centered and full-looking at every
// hand size.
export function splitTwoRows(count: number): [number, number] {
  const top = Math.ceil(count / 2);
  return [top, count - top];
}

// Computes the per-card marginLeft needed so a row of `count` cards (each `cardWidth` wide) spans
// close to `targetSpan` total width — negative for overlap (a full hand needs more cards than fit
// at full width), positive for a gap (a near-empty hand where cards alone would undershoot the
// target span). `count <= 1` needs no margin at all (nothing to space). `maxGap` clamps the
// positive case so a 1-2 card hand doesn't scatter across the full target span with unnaturally
// large gaps — once the natural gap would exceed it, extra width is simply left unused around a
// normally-spaced row instead of stretching further. Originally written for the human hand's
// width-fill; also reused for opponent hands' auto-fit spacing (both the top seat's horizontal
// row and the side seats' vertical stack — the "cardWidth"/`marginLeft` naming is a leftover from
// that first use, the math itself is dimension-agnostic).
export function fillWidthMarginPx(
  cardWidth: number,
  count: number,
  targetSpan: number,
  maxGap: number,
): number | undefined {
  if (count <= 1) return undefined;
  const step = (targetSpan - cardWidth) / (count - 1) - cardWidth;
  return Math.min(step, maxGap);
}
