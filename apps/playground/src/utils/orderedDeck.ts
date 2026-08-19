import { createDeck } from '@world-of-cards/engine';
import type { Card } from '@world-of-cards/engine';

// Single source of truth for full-deck ordering, shared by CardGallery (which groups this by
// suit for display) and CardTemplateEditor (which pages through it one card at a time via the
// ‹/› arrows) — both need the exact same 52-card array so "card 14" means the same card in both.
export const ORDERED_DECK: Card[] = createDeck({ deckCount: 1, includeJokers: false });
