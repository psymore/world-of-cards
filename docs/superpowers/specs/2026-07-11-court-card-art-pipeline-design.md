# Court-card art integration pipeline

**Date:** 2026-07-11
**Status:** Approved

## Context

The user generated 12 candidate court-card illustrations via external AI image tools (ChatGPT/Gemini), dropped into `apps/mobile/assets/card-art/`. They split across two incompatible art directions:

- **Direction A** (not used by this design): painted bust portraits, medieval-robe styling, single upright pose. Covers King♠/♥/♣, Queen♠, Jack♠ (5 of 12 court slots) but doesn't use the traditional double-headed mirrored card layout.
- **Direction B** (chosen): armored-knight style, double-headed mirrored layout (art reads upright from either end of the card, matching real playing-card convention). Only 3 images exist:
  - `Gemini_..._fwc3sx...png` — Jack of Diamonds, already double-headed mirrored.
  - `Gemini_..._ag7232...png` — Jack of Spades (confirmed via the same flat-top fleur-de-lis cap as the Direction A Jack, plus a spade shield emblem on the chest), single upright figure — **not** mirrored.
  - `Gemini_..._2sqk8m...png` — generic armored knight, double-headed mirrored, but no suit emblem anywhere — can't be mapped to a specific card. Excluded from integration; kept only as a style reference.

This is a scoped slice: land 2 court cards now (Jack♠, Jack♦) with a repeatable pipeline so more cards can be added as more matching art is generated later. Full-suit coverage is an explicit non-goal of this pass.

`PlayingCard.tsx` (`apps/mobile/src/components/PlayingCard.tsx`) is shared by every game on the roadmap, so this needs to degrade to today's exact behavior (SuitIcon watermark) for every card that has no illustrated art yet.

## Asset organization

Raw AI-generated sources are 2-3MB each (~28MB across all 12) and most will never ship. `apps/mobile/assets/` is Expo's real app-bundle folder, so raw sources don't belong there.

- Move the raw PNGs from `apps/mobile/assets/card-art/` to `.superpowers/card-art-sources/` (already fully gitignored — confirmed via `git check-ignore`). This is where the user drops new source art going forward.
- Processed, optimized output lives at `apps/mobile/assets/card-art/processed/<rank-name>-of-<suit>.png` (e.g. `jack-of-spades.png`, `jack-of-diamonds.png`) and **is** committed — these are real shipped assets, small enough (a few hundred KB) to check in like any other image asset.

## Mirror-composite script

New one-off dev script: `scripts/process-card-art.js` (Node, run manually via `node scripts/process-card-art.js`, not part of the app build or CI). New devDependency: `sharp` (already a transitive dependency of Expo's own asset tooling, so it's a well-trodden install path for this ecosystem).

The script has a small hardcoded manifest of `{ source, suit, rank, mirrored }` entries (not a generic directory scan — new entries are added by hand as new source art is confirmed usable, since suit/rank identification and mirrored-vs-not is a judgment call, not something to infer automatically). For each entry:

1. Load the source PNG, trim transparent margins.
2. If `mirrored: false` — crop to the bust (top portion), then build the final composite by stacking the trimmed bust on top of a 180°-rotated copy of itself, sized/proportioned to match the already-mirrored references (Jack♦) so the two don't look inconsistent side by side.
3. If `mirrored: true` — just trim and resize.
4. Resize to a shared target canvas (~300×430px — roughly 3.5x the card's 84×120 display box, enough headroom for @3x density) and write to `apps/mobile/assets/card-art/processed/<rank-name>-of-<suit>.png`.

Initial manifest: Jack♠ (`mirrored: false`), Jack♦ (`mirrored: true`).

## PlayingCard integration

New `apps/mobile/src/components/courtCardArt.ts`:

```ts
export const COURT_CARD_ART: Partial<Record<`${Rank}-${Suit}`, ImageSourcePropType>> = {
  'J-spades': require('../../assets/card-art/processed/jack-of-spades.png'),
  'J-diamonds': require('../../assets/card-art/processed/jack-of-diamonds.png'),
};
```

(React Native's bundler requires statically-analyzable `require()` calls — no dynamic path construction — so this map is hand-maintained, one line per card as art is added.)

In `PlayingCard.tsx`'s `centerArt` block: look up `COURT_CARD_ART[`${card.rank}-${card.suit}`]`. If found, render an `Image` (`resizeMode="contain"`, sized to fill the existing `centerArt` box) **instead of** the `SuitIcon` watermark — the illustration already carries its own suit emblem, so layering both would be redundant. If not found (every other card today), fall through to the exact current `SuitIcon` watermark behavior — zero visual change for the ~46 other cards in the deck.

This is an intentional visual asymmetry: illustrated court cards will look noticeably richer than pip/number cards, matching how real decks work.

## Non-goals for this pass

- Generating more art (still a manual, external-to-this-session step for the user).
- Any changes to Direction A images, corner-index rendering, or card backs.
- A generic/automated directory-scanning pipeline — the manifest is hand-curated because suit/rank/mirror-state identification needs human judgment.
- Any test additions — this is decorative UI, same policy as `CardBackPattern`/`SuitIcon` (verify visually instead, per project testing policy).

## Verification plan

- Run the script, visually inspect the two processed outputs (does the Jack♠ mirror-composite look consistent with the Jack♦ reference, no visible seam/asymmetry).
- Browser/Playwright screenshot of a Pişti table hand containing a Jack♠ and/or Jack♦ next to ordinary number cards, confirming: illustrated art renders correctly sized inside the card face, other cards are pixel-unchanged, no console errors.
- Typecheck + existing mobile test suite still green (no test should reference `centerArt` internals beyond the existing testID).
