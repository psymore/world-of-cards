# Court-card art integration pipeline

**Date:** 2026-07-11
**Status:** Approved

## Context

The user generated 12 candidate court-card illustrations via external AI image tools (ChatGPT/Gemini), dropped into `apps/mobile/assets/card-art/`. They split across two incompatible art directions:

- **Direction A** (not used by this design): painted bust portraits, medieval-robe styling, single upright pose. Covers King♠/♥/♣, Queen♠, Jack♠ (5 of 12 court slots) but doesn't use the traditional double-headed mirrored card layout.
- **Direction B** (chosen): armored-knight style, double-headed mirrored layout (art reads upright from either end of the card, matching real playing-card convention). Only 3 images exist:
  - `Gemini_..._fwc3sx...png` — King of Diamonds (crown + diamond emblems), already double-headed mirrored.
  - `Gemini_..._ag7232...png` — Jack of Spades (confirmed via the same flat-top fleur-de-lis cap as the Direction A Jack, plus a spade shield emblem on the chest), single upright figure — **not** mirrored.
  - `Gemini_..._2sqk8m...png` — generic armored knight, double-headed mirrored, but no suit emblem anywhere — can't be mapped to a specific card. Excluded from integration; kept only as a style reference.

**Scope update (2026-07-11, same day):** this is a demo pass, not a production-accurate mapping. Rather than landing 2 exact-match cards, illustrate every **King/Queen/Jack across all 4 suits** (12 cards; Aces and number cards 2-10 stay as the plain suit-icon watermark — Aces were tried and then explicitly dropped the same day, see below). Since usable source art doesn't cover every rank per suit, each suit gets **one representative image reused across whichever of K/Q/J it lacks exact art for**:

| Suit | Exact-match art | Reused for |
|---|---|---|
| Spades | King♠, Queen♠, Jack♠ (all Direction A, for one consistent "royal family" look within the suit) | (full coverage, no reuse needed) |
| Hearts | King♥ (Direction A, transparent variant) | Queen♥/Jack♥ → King♥ art |
| Clubs | King♣ (Direction A) | Queen♣/Jack♣ → King♣ art |
| Diamonds | King♦ (Direction B, already mirrored — initially misidentified as Jack♦, corrected after re-inspecting the crown/diamond emblems) | Queen♦/Jack♦ → King♦ art |

Direction B's Jack♠ (`ag7232`) is dropped in favor of Direction A's Jack♠ so all three spade face cards share one visual family instead of mixing painted-portrait Kings/Queen with an armored-knight Jack. Direction B's suit-less generic knight (`2sqk8m`) stays excluded (no way to map it to a card). This reuse-by-suit approach is explicitly a demo compromise, not the final per-card art plan — a real pass would need dedicated art for all 12 (or more) slots.

**Aces dropped (2026-07-11, later same day):** Ace coverage (reusing each suit's King art) was implemented and then explicitly removed at the user's request — illustrated art is now K/Q/J only.

`PlayingCard.tsx` (`apps/mobile/src/components/PlayingCard.tsx`) is shared by every game on the roadmap, so this needs to degrade to today's exact behavior (SuitIcon watermark) for every card that has no illustrated art yet.

## Asset organization

Raw AI-generated sources are 2-3MB each (~28MB across all 12) and most will never ship. `apps/mobile/assets/` is Expo's real app-bundle folder, so raw sources don't belong there.

- Move the raw PNGs from `apps/mobile/assets/card-art/` to `.superpowers/card-art-sources/` (already fully gitignored — confirmed via `git check-ignore`). This is where the user drops new source art going forward.
- Processed, optimized output lives at `apps/mobile/assets/card-art/processed/<rank-name>-of-<suit>.png` (e.g. `jack-of-spades.png`, `king-of-diamonds.png`) and **is** committed — these are real shipped assets, small enough (a few hundred KB) to check in like any other image asset.

## Mirror-composite script

New one-off dev script: `scripts/process-card-art.js` (Node, run manually via `node scripts/process-card-art.js`, not part of the app build or CI). New devDependency: `sharp` (already a transitive dependency of Expo's own asset tooling, so it's a well-trodden install path for this ecosystem).

The script has a small hardcoded manifest of `{ source, suit, rank, mirrored }` entries (not a generic directory scan — new entries are added by hand as new source art is confirmed usable, since suit/rank identification and mirrored-vs-not is a judgment call, not something to infer automatically). For each entry:

1. Load the source PNG, trim transparent margins.
2. If `mirrored: false` — crop to the bust (top portion), then build the final composite by stacking the trimmed bust on top of a 180°-rotated copy of itself, sized/proportioned to match the already-mirrored references (Jack♦) so the two don't look inconsistent side by side.
3. If `mirrored: true` — just trim and resize.
4. Resize to a shared target canvas (~300×430px — roughly 3.5x the card's 84×120 display box, enough headroom for @3x density) and write to `apps/mobile/assets/card-art/processed/<rank-name>-of-<suit>.png`.

Initial manifest (6 entries, producing 6 processed files):

| Output | Source | Mirrored already? |
|---|---|---|
| `king-of-spades.png` | ChatGPT `05_02_21 PM` | no |
| `queen-of-spades.png` | ChatGPT `05_04_12 PM` | no |
| `jack-of-spades.png` | ChatGPT `05_04_17 PM` (Direction A) | no |
| `king-of-hearts.png` | ChatGPT `05_02_35 PM` (transparent variant) | no |
| `king-of-clubs.png` | Gemini `qcvz4l` | no |
| `king-of-diamonds.png` | Gemini `fwc3sx` (Direction B) | yes |

## PlayingCard integration

New `apps/mobile/src/components/courtCardArt.ts`:

```ts
const KING_OF_SPADES = require('../../assets/card-art/processed/king-of-spades.png');
const KING_OF_HEARTS = require('../../assets/card-art/processed/king-of-hearts.png');
const KING_OF_CLUBS = require('../../assets/card-art/processed/king-of-clubs.png');
const KING_OF_DIAMONDS = require('../../assets/card-art/processed/king-of-diamonds.png');

export const COURT_CARD_ART: Partial<Record<`${Rank}-${Suit}`, ImageSourcePropType>> = {
  'K-spades': KING_OF_SPADES,
  'Q-spades': require('../../assets/card-art/processed/queen-of-spades.png'),
  'J-spades': require('../../assets/card-art/processed/jack-of-spades.png'),
  'K-hearts': KING_OF_HEARTS,
  'Q-hearts': KING_OF_HEARTS,
  'J-hearts': KING_OF_HEARTS,
  'K-clubs': KING_OF_CLUBS,
  'Q-clubs': KING_OF_CLUBS,
  'J-clubs': KING_OF_CLUBS,
  'K-diamonds': KING_OF_DIAMONDS,
  'Q-diamonds': KING_OF_DIAMONDS,
  'J-diamonds': KING_OF_DIAMONDS,
};
```

(React Native's bundler requires statically-analyzable `require()` calls — no dynamic path construction — so this map is hand-maintained. 12 rank/suit keys resolve to only 6 actual image files per the reuse table above; more lines get added/repointed as more exact-match art is generated.)

In `PlayingCard.tsx`'s `centerArt` block: look up `COURT_CARD_ART[`${card.rank}-${card.suit}`]`. If found, render an `Image` (`resizeMode="contain"`, sized to fill the existing `centerArt` box) **instead of** the `SuitIcon` watermark — the illustration already carries its own suit emblem, so layering both would be redundant. If not found (every other card today), fall through to the exact current `SuitIcon` watermark behavior — zero visual change for the ~46 other cards in the deck.

This is an intentional visual asymmetry: illustrated court cards will look noticeably richer than pip/number cards, matching how real decks work.

## Non-goals for this pass

- Number cards (2-10) — these keep today's plain `SuitIcon` watermark; only A/K/Q/J get illustrated art.
- Exact per-card art for all 16 A/K/Q/J slots — this is an explicit demo compromise (reuse-by-suit table above), not the final production mapping.
- Generating more art (still a manual, external-to-this-session step for the user).
- Any changes to corner-index rendering or card backs.
- A generic/automated directory-scanning pipeline — the manifest is hand-curated because suit/rank/mirror-state identification needs human judgment.
- Any test additions — this is decorative UI, same policy as `CardBackPattern`/`SuitIcon` (verify visually instead, per project testing policy).

## Verification plan

- Run the script, visually inspect the two processed outputs (does the Jack♠ mirror-composite look consistent with the Jack♦ reference, no visible seam/asymmetry).
- Browser/Playwright screenshot of a Pişti table hand containing a Jack♠ and/or Jack♦ next to ordinary number cards, confirming: illustrated art renders correctly sized inside the card face, other cards are pixel-unchanged, no console errors.
- Typecheck + existing mobile test suite still green (no test should reference `centerArt` internals beyond the existing testID).
