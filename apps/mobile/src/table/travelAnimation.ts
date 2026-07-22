import { Easing } from "react-native";

// Shared timing for every "played card travels from its origin seat to its resting spot"
// animation across every game (Pişti's pile RevealCard, Batak's trick TravelCard) — kept
// separate from DealFlightOverlay's own faster per-card timing, which is a deliberately
// different, much quicker "rapid-fire dealt cards" motion, not a single deliberate play. One
// shared constant here means tuning the play-travel feel once updates every consumer instead of
// the two games drifting apart from each other.
export const CARD_TRAVEL_DURATION_MS = 530;
export const CARD_TRAVEL_EASING = Easing.out(Easing.cubic);
