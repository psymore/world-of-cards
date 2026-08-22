import { create } from 'zustand';

// Lives here (packages/ui) rather than apps/mobile's devTuningStore.ts, unlike every other
// dev-tuning field (tableSurfaceMaterial, pistiTableBackground, etc.) — those are each read by
// exactly one or two render sites, cheaply prop-drilled in from the app layer. PlayingCard has
// dozens of call sites across both games' hand fans, trick piles, and table centers; requiring
// every one of them to thread a cardFaceStyle prop down from apps/mobile's store just to reach
// this one component would be a much bigger, riskier change than the toggle itself. Putting the
// store here instead lets PlayingCard read it directly, and apps/mobile's dev-tuning modals write
// to it the same way they write to devTuningStore — same zustand shape, just owned by the package
// that actually needs to read it everywhere.
// v3 reuses v2's exact art assets (courtCardArtV2.ts) and background/border/shadow treatment —
// see PlayingCard.tsx's isV2Family — differing only in how the K/Q/J art is presented: v2
// stretches it edge-to-edge as the whole card background, v3 shows it smaller and centered
// (contain-fit) with the parchment background visible as a margin around it.
export type CardFaceStyle = 'v1' | 'v2' | 'v3';

export interface CardFaceStyleState {
  cardFaceStyle: CardFaceStyle;
  setCardFaceStyle: (v: CardFaceStyle) => void;
}

export const useCardFaceStyleStore = create<CardFaceStyleState>((set) => ({
  // Shipped default for both dev and APK builds — this literal is the only place either default
  // is set (see the doc comment above).
  cardFaceStyle: 'v3',
  setCardFaceStyle: (cardFaceStyle) => set({ cardFaceStyle }),
}));
