import { Easing } from 'react-native';

// Shared timing for every "played card travels from its origin seat to its resting spot"
// animation across every game (Pişti's pile RevealCard, Batak's trick TravelCard) — kept
// separate from DealFlightOverlay's own faster per-card timing, which is a deliberately
// different, much quicker "rapid-fire dealt cards" motion, not a single deliberate play. One
// shared constant here means tuning the play-travel feel once updates every consumer instead of
// the two games drifting apart from each other.
export const CARD_TRAVEL_DURATION_MS = 530;
export const CARD_TRAVEL_EASING = Easing.out(Easing.cubic);
// For TravelCard's optional scale interpolation (Batak's own played card only — see
// originScale/restScale on TravelCard): deliberately linear-in-time, not eased. Its only job is to
// track real elapsed time honestly, so CARD_SCALE_HOLD_FRACTION below means what it says — a
// curve like CARD_TRAVEL_EASING is heavily front-loaded (already ~88% done by the halfway point),
// so gating "when the shrink starts" off of it would make the shrink start much earlier in real
// time than the fraction implies.
export const CARD_SCALE_EASING = Easing.linear;
// The card travels at its full origin size for this fraction of the flight and shrinks to
// restScale only over the remainder — no gradual resize "on the way," just a size change
// concentrated near landing. See TravelCard's scale interpolation for how this is applied (a
// 3-point inputRange, not a continuously-changing output across the whole flight). 0.7 (not a
// shorter fraction like 0.8): measured live, a 20%-of-380ms (~76ms) tail produced a fast, *linear*
// shrink that read as a mechanical pop rather than a polished motion — widened for a bit more
// room, paired with CARD_SCALE_SHRINK_EASING below so the shrink itself isn't just a constant rate.
export const CARD_SCALE_HOLD_FRACTION = 0.7;
// Shapes the shrink itself (the tail segment only, from CARD_SCALE_HOLD_FRACTION to 1 — see
// TravelCard's interpolate call, which applies `easing` per-segment, not across the whole [0,1]
// range). CARD_SCALE_EASING above must stay linear-in-time for the hold fraction to mean what it
// says; this is a separate, purely cosmetic curve for how the shrink itself decelerates into its
// final size instead of shrinking at a constant rate.
export const CARD_SCALE_SHRINK_EASING = Easing.out(Easing.quad);
