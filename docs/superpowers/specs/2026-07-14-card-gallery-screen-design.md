# Card Gallery Screen (apps/mobile)

## Problem

The `apps/playground` app already has a `CardGallery` component for checking card/table visual designs, but it's a separate isolated app (deliberately — see CLAUDE.md's playground isolation rule) and its gallery renders fine on mobile but is problematic on web. There's no way to see all 52 cards rendered through the *real* `apps/mobile` `PlayingCard` component (actual card art, fonts, sizing) without starting an actual Pişti game. Card-art tweaks (e.g. court-card image sizing) currently require starting a game and finding the right cards to check.

## Goal

Add a second screen to `apps/mobile`, reachable from the Home screen, that displays all 52 cards face-up using the real `PlayingCard` component, so visual changes can be checked directly without starting a game session.

## Design

### `apps/mobile/src/screens/CardGalleryScreen.tsx` (new)

- Props: `{ onBack: () => void }`.
- Background: full-screen felt, matching the existing in-game table convention (`PistiTable.tsx`) — a container `View` with `backgroundColor: '#0b6623'`, `TableFelt` and `TableWoodCorners` layered on top (both are zero-prop `AbsoluteOverlay`-based decorations, already `React.memo`'d, safe to reuse as-is).
- Header: a small local header row — "‹ Back" `Pressable` (calls `onBack` directly, no confirmation) and a "Card Gallery" title, styled consistently with the app's navy/gold palette. Not `GameScreenLayout`: that component's exit button shows a "Discard this game?" alert, which is the wrong semantic for a non-game dev screen.
- Body: a `ScrollView` containing one section per suit (`spades`, `hearts`, `clubs`, `diamonds`, in that order), each with a suit label and a wrapped row (`flexDirection: 'row', flexWrap: 'wrap'`) of all 13 `PlayingCard` components for that suit, `size="normal"`, `faceDown={false}`. Same suit-grouping convention as `apps/playground/src/components/CardGallery.tsx`, but built from a real `createDeck({ deckCount: 1, includeJokers: false })` (from `@world-cards/engine`) and rendered through the actual `apps/mobile` `PlayingCard`, so this is the same rendering path a real game uses — not a reimplementation.

### Navigation wiring

- `apps/mobile/src/navigation/RootNavigator.tsx`: add `CardGallery: undefined` to `RootStackParamList`, and a new `Stack.Screen name="CardGallery"` with `headerShown: false` (the screen owns its own header), rendering `<CardGalleryScreen onBack={() => navigation.navigate('Home')} />`.
- `apps/mobile/src/screens/HomeScreen.tsx`: add a `Card Gallery` entry below the existing game list, visually distinct from a game card (this isn't a game) but consistent with the existing navy/gold theme. Takes a new `onOpenCardGallery: () => void` prop, wired from `RootNavigator`.

## Out of scope

- No size toggle (normal/small), no face-down/back-pattern sample, no highlighted/selected state preview — all deliberately deferred; the recommended minimal scope (all 52 cards face-up, grouped by suit) was chosen over these.
- No changes to `apps/playground`'s existing `CardGallery` or its web rendering issue — this is a separate, `apps/mobile`-only screen, not a fix for the playground.
- No new tests — pure presentational dev screen, same policy as other decorative/dev-only UI per CLAUDE.md's testing policy (existing tests must still pass unmodified, except `HomeScreen.test.tsx`/`RootNavigator` tests if they assert on exact prop shapes touched by this change).

## Testing / verification

- Typecheck + existing mobile test suite must still pass.
- Visual verification via the existing browser/Playwright workflow (`react-native-web` + local Chrome) — screenshot the new screen showing all 4 suits, confirm the K/Q/J court-card art (and its recent 1.3x enlargement) renders correctly, and confirm back-navigation to Home works.
- No native on-device verification (per the standing sandbox limitation) — flag as usual, not a new gap introduced by this work.
