# Typography Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a shared Cinzel/Inter typeface pairing and H1–H7 type-scale token module to `packages/ui`, and apply the new typeface identity to `SeatIdentity`, the one existing `packages/ui` component that renders free-form text.

**Architecture:** Two new font files' worth of assets are extracted from the `@expo-google-fonts/cinzel` and `@expo-google-fonts/inter` npm packages (source of the actual `.ttf` binaries, not a runtime dependency) and registered in the existing `FONTS` map that both apps already load via `useFonts(FONTS)`. A new `typography.ts` module exports the H1–H7 scale as plain style-object tokens. `SeatIdentity`'s two `Text` elements switch to the new font-family constants, keeping their existing `fontSize`/`lineHeight`/`scale` math untouched.

**Tech Stack:** React Native / Expo (`expo-font`), TypeScript, Jest + `@testing-library/react-native` (existing `SeatIdentity.test.tsx`).

**Spec:** `docs/superpowers/specs/2026-08-14-typography-foundation-design.md`

## Global Constraints

- Two weights per typeface only: Regular + Bold (matches the existing `PTSerif-Bold`/`PTSerif-Regular` pattern in `packages/ui/src/fonts.ts`) — no Medium/SemiBold/ExtraBold/Black variants.
- `PTSerif-*` and `CARD_RANK_FONT_FAMILY` (`packages/ui/src/fonts.ts`) are extended, never replaced or renamed.
- Font identity only this pass: `SeatIdentity`'s existing `fontSize`/`lineHeight`/`scale` values do not change, per the spec's explicit scope cut.
- No new automated tests (standing 2026-07-07 mobile-UI testing policy, `docs/governance/engineering-principles.md` §4) — only confirm the existing `SeatIdentity.test.tsx` suite still passes.
- Screenshot verification happens via adb on the connected phone and is deleted before merge (`docs/governance/guardrails.md` §3), staying inside the adb whitelist in §7 (no `adb root`/`backup`/etc.).

---

### Task 1: Font assets + `FONTS` registration

**Files:**
- Create (binary): `packages/ui/assets/fonts/Cinzel-Regular.ttf`
- Create (binary): `packages/ui/assets/fonts/Cinzel-Bold.ttf`
- Create (binary): `packages/ui/assets/fonts/Inter-Regular.ttf`
- Create (binary): `packages/ui/assets/fonts/Inter-Bold.ttf`
- Modify: `packages/ui/src/fonts.ts`

**Interfaces:**
- Produces: `FONTS` map gains four new keys — `'Cinzel-Regular'`, `'Cinzel-Bold'`, `'Inter-Regular'`, `'Inter-Bold'` — each a `require(...)` of the corresponding `.ttf`. These four string keys are the `fontFamily` values Task 2's constants point to.

- [ ] **Step 1: Download the two source npm packages into a scratch directory**

```bash
mkdir -p /tmp/font-extract && cd /tmp/font-extract
npm pack @expo-google-fonts/cinzel @expo-google-fonts/inter
```

Expected: two `.tgz` files appear — `expo-google-fonts-cinzel-0.4.2.tgz`, `expo-google-fonts-inter-0.4.2.tgz` (version may differ slightly; that's fine).

- [ ] **Step 2: Extract the four needed `.ttf` files into `packages/ui/assets/fonts/`**

```bash
cd /tmp/font-extract
tar -xzf expo-google-fonts-cinzel-*.tgz package/400Regular/Cinzel_400Regular.ttf package/700Bold/Cinzel_700Bold.ttf
tar -xzf expo-google-fonts-inter-*.tgz package/400Regular/Inter_400Regular.ttf package/700Bold/Inter_700Bold.ttf
```

Then, from the repo root (adjust the source paths to wherever `/tmp/font-extract` resolved on your shell):

```bash
cp /tmp/font-extract/package/400Regular/Cinzel_400Regular.ttf packages/ui/assets/fonts/Cinzel-Regular.ttf
cp /tmp/font-extract/package/700Bold/Cinzel_700Bold.ttf packages/ui/assets/fonts/Cinzel-Bold.ttf
```

Re-run `npm pack`/`tar -xzf` for the `inter` tarball the same way (the two packages' extracted `package/400Regular/`, `package/700Bold/` directories collide by path, so extract+copy Cinzel fully before extracting Inter, or extract each into its own subdirectory):

```bash
mkdir -p /tmp/font-extract/inter && cd /tmp/font-extract/inter
tar -xzf ../expo-google-fonts-inter-*.tgz package/400Regular/Inter_400Regular.ttf package/700Bold/Inter_700Bold.ttf
cd -
cp /tmp/font-extract/inter/package/400Regular/Inter_400Regular.ttf packages/ui/assets/fonts/Inter-Regular.ttf
cp /tmp/font-extract/inter/package/700Bold/Inter_700Bold.ttf packages/ui/assets/fonts/Inter-Bold.ttf
```

Expected: `packages/ui/assets/fonts/` contains `Cinzel-Regular.ttf`, `Cinzel-Bold.ttf`, `Inter-Regular.ttf`, `Inter-Bold.ttf` alongside the existing `PTSerif-Bold.ttf`/`PTSerif-Regular.ttf`.

- [ ] **Step 3: Clean up the scratch directory**

```bash
rm -rf /tmp/font-extract
```

- [ ] **Step 4: Register the new fonts in `FONTS`**

In `packages/ui/src/fonts.ts`, replace the file's contents with:

```ts
export const FONTS = {
  'PTSerif-Bold': require('../assets/fonts/PTSerif-Bold.ttf'),
  'PTSerif-Regular': require('../assets/fonts/PTSerif-Regular.ttf'),
  'Cinzel-Regular': require('../assets/fonts/Cinzel-Regular.ttf'),
  'Cinzel-Bold': require('../assets/fonts/Cinzel-Bold.ttf'),
  'Inter-Regular': require('../assets/fonts/Inter-Regular.ttf'),
  'Inter-Bold': require('../assets/fonts/Inter-Bold.ttf'),
};

// Change this to 'PTSerif-Regular' to switch the card corner-index weight.
// Both weights are already bundled above — no other file needs to change.
export const CARD_RANK_FONT_FAMILY = 'PTSerif-Bold';
```

- [ ] **Step 5: Verify the app still boots with the extended font map**

```bash
npm run test -- packages/ui
```

Expected: existing `packages/ui` test suite (unrelated to fonts) still passes — this step only confirms the `fonts.ts` edit didn't break the module's syntax/exports.

- [ ] **Step 6: Commit**

Ask the user before running `git commit` (standing project guardrail — confirm even mid-plan).

```bash
git add packages/ui/assets/fonts/Cinzel-Regular.ttf packages/ui/assets/fonts/Cinzel-Bold.ttf packages/ui/assets/fonts/Inter-Regular.ttf packages/ui/assets/fonts/Inter-Bold.ttf packages/ui/src/fonts.ts
git commit -m "feat(ui): add Cinzel + Inter font assets"
```

---

### Task 2: `typography.ts` type-scale module

**Files:**
- Create: `packages/ui/src/typography.ts`
- Modify: `packages/ui/src/index.ts`
- Test: `packages/ui/src/typography.test.ts`

**Interfaces:**
- Consumes: the four `FONTS` keys produced by Task 1 (`'Cinzel-Regular'`, `'Cinzel-Bold'`, `'Inter-Regular'`, `'Inter-Bold'`) as literal `fontFamily` string values.
- Produces: `PRIMARY_SERIF_REGULAR`, `PRIMARY_SERIF_BOLD`, `SECONDARY_SANS_REGULAR`, `SECONDARY_SANS_BOLD` (each a `string`), `TypeScaleEntry` (`{ fontFamily: string; fontSize: number; lineHeight: number }`), and `TYPE_SCALE: Record<'h1'|'h2'|'h3'|'h4'|'h5'|'h6'|'h7', TypeScaleEntry>` — Task 3 consumes `PRIMARY_SERIF_BOLD` and `SECONDARY_SANS_REGULAR` directly.

- [ ] **Step 1: Write the failing test**

Create `packages/ui/src/typography.test.ts`:

```ts
import { TYPE_SCALE, PRIMARY_SERIF_BOLD, SECONDARY_SANS_REGULAR } from "./typography";

describe("TYPE_SCALE", () => {
  it("has all seven levels", () => {
    expect(Object.keys(TYPE_SCALE).sort()).toEqual([
      "h1", "h2", "h3", "h4", "h5", "h6", "h7",
    ]);
  });

  it("matches TABLE-029's annotated H4/H5 anchors", () => {
    expect(TYPE_SCALE.h4.fontSize).toBe(32);
    expect(TYPE_SCALE.h5.fontSize).toBe(28);
  });

  it("uses the primary serif for H1-H4 and the secondary sans for H5-H7", () => {
    expect(TYPE_SCALE.h1.fontFamily).toContain("Cinzel");
    expect(TYPE_SCALE.h4.fontFamily).toContain("Cinzel");
    expect(TYPE_SCALE.h5.fontFamily).toContain("Inter");
    expect(TYPE_SCALE.h7.fontFamily).toContain("Inter");
  });

  it("decreases fontSize monotonically from h1 to h7", () => {
    const sizes = ["h1", "h2", "h3", "h4", "h5", "h6", "h7"].map(
      level => TYPE_SCALE[level as keyof typeof TYPE_SCALE].fontSize,
    );
    for (let i = 1; i < sizes.length; i++) {
      expect(sizes[i]).toBeLessThan(sizes[i - 1]);
    }
  });

  it("exports the font family constants used by consumers", () => {
    expect(PRIMARY_SERIF_BOLD).toBe("Cinzel-Bold");
    expect(SECONDARY_SANS_REGULAR).toBe("Inter-Regular");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- packages/ui/src/typography.test.ts`
Expected: FAIL with a module-not-found error for `./typography`.

- [ ] **Step 3: Write the implementation**

Create `packages/ui/src/typography.ts`:

```ts
export const PRIMARY_SERIF_REGULAR = "Cinzel-Regular";
export const PRIMARY_SERIF_BOLD = "Cinzel-Bold";
export const SECONDARY_SANS_REGULAR = "Inter-Regular";
export const SECONDARY_SANS_BOLD = "Inter-Bold";

export interface TypeScaleEntry {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
}

// Sizes derived from TABLE-029's own annotated anchors (Player Name 32px/H4, Score 28px/H5 —
// an exact 8:7 step), extended in clean px with ~1.2x line-heights. H1-H4 (titles/numbers/
// premium UI) use the primary serif; H5-H7 (labels/body/system UI) use the secondary sans —
// see docs/superpowers/specs/2026-08-14-typography-foundation-design.md.
export const TYPE_SCALE: Record<
  "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "h7",
  TypeScaleEntry
> = {
  h1: { fontFamily: PRIMARY_SERIF_BOLD, fontSize: 48, lineHeight: 58 },
  h2: { fontFamily: PRIMARY_SERIF_BOLD, fontSize: 40, lineHeight: 48 },
  h3: { fontFamily: PRIMARY_SERIF_REGULAR, fontSize: 36, lineHeight: 44 },
  h4: { fontFamily: PRIMARY_SERIF_BOLD, fontSize: 32, lineHeight: 40 },
  h5: { fontFamily: SECONDARY_SANS_REGULAR, fontSize: 28, lineHeight: 34 },
  h6: { fontFamily: SECONDARY_SANS_REGULAR, fontSize: 24, lineHeight: 30 },
  h7: { fontFamily: SECONDARY_SANS_REGULAR, fontSize: 20, lineHeight: 26 },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- packages/ui/src/typography.test.ts`
Expected: PASS, all 5 assertions green.

- [ ] **Step 5: Export from `packages/ui/src/index.ts`**

Add, near the existing `export { FONTS, CARD_RANK_FONT_FAMILY } from "./fonts";` line:

```ts
export {
  PRIMARY_SERIF_REGULAR,
  PRIMARY_SERIF_BOLD,
  SECONDARY_SANS_REGULAR,
  SECONDARY_SANS_BOLD,
  TYPE_SCALE,
} from "./typography";
export type { TypeScaleEntry } from "./typography";
```

- [ ] **Step 6: Run the full `packages/ui` suite**

Run: `npm run test -- packages/ui`
Expected: PASS, no regressions.

- [ ] **Step 7: Commit**

Ask the user before running `git commit`.

```bash
git add packages/ui/src/typography.ts packages/ui/src/typography.test.ts packages/ui/src/index.ts
git commit -m "feat(ui): add H1-H7 typography scale module"
```

---

### Task 3: Apply typeface identity to `SeatIdentity`

**Files:**
- Modify: `packages/ui/src/SeatIdentity.tsx:344-350`
- Test: `packages/ui/src/SeatIdentity.test.tsx` (existing — no new file)

**Interfaces:**
- Consumes: `PRIMARY_SERIF_BOLD`, `SECONDARY_SANS_REGULAR` from `./typography` (Task 2).

- [ ] **Step 1: Confirm the existing test suite passes before touching anything (baseline)**

Run: `npm run test -- packages/ui/src/SeatIdentity.test.tsx`
Expected: PASS (establishes the pre-change baseline).

- [ ] **Step 2: Import the font constants**

In `packages/ui/src/SeatIdentity.tsx`, add to the top-level imports (near the existing `import { glowShadow } from "./glowShadow";` line):

```ts
import { PRIMARY_SERIF_BOLD, SECONDARY_SANS_REGULAR } from "./typography";
```

- [ ] **Step 3: Update `nameText` and `trickText` styles**

In the `styles = StyleSheet.create({ ... })` block at the bottom of the file, change:

```ts
  nameText: {
    color: "#e8e3d2",
    fontWeight: "bold",
    fontSize: 7,
    lineHeight: 9,
  },
  trickText: { color: "#b8b3a2", fontSize: 5.5, lineHeight: 7 },
```

to:

```ts
  nameText: {
    color: "#e8e3d2",
    fontFamily: PRIMARY_SERIF_BOLD,
    fontSize: 7,
    lineHeight: 9,
  },
  trickText: {
    color: "#b8b3a2",
    fontFamily: SECONDARY_SANS_REGULAR,
    fontSize: 5.5,
    lineHeight: 7,
  },
```

(`fontWeight: "bold"` is dropped from `nameText` — the bold weight now comes from using the `-Bold` font file directly, the same way `CARD_RANK_FONT_FAMILY` already does it elsewhere in this package.)

- [ ] **Step 4: Run the existing `SeatIdentity` test suite**

Run: `npm run test -- packages/ui/src/SeatIdentity.test.tsx`
Expected: PASS, same result as the Step 1 baseline — this change doesn't alter layout, only which font-family string is applied.

- [ ] **Step 5: Run the full `packages/ui` suite for regressions**

Run: `npm run test -- packages/ui`
Expected: PASS.

- [ ] **Step 6: Commit**

Ask the user before running `git commit`.

```bash
git add packages/ui/src/SeatIdentity.tsx
git commit -m "feat(ui): apply Cinzel/Inter identity to SeatIdentity text"
```

---

### Task 4: Manual on-device verification

**Files:** none (verification only — no code changes)

**Interfaces:** none.

- [ ] **Step 1: Build and install the dev build on the connected phone**

Follow whatever build/install flow is already in use for this project on device `c2a9d642` (confirmed adb-reachable earlier this session). Stay inside the adb whitelist: install/launch the dev build, no `adb root`/`backup`/`pm uninstall` on other apps.

- [ ] **Step 2: Navigate to a screen that renders `SeatIdentity`**

Any Pişti or Batak table screen — `SeatIdentity` is the shared seat/player-badge component both games use.

- [ ] **Step 3: Screenshot and confirm the fonts actually render**

```bash
adb -s c2a9d642 exec-out screencap -p > /d/CodeSpace/world-of-cards/.tmp-seat-identity-check.png
```

Read the resulting PNG and confirm: the player name renders in a serif face with visible small-caps-like inscriptional letterforms (Cinzel), not the system default sans, and it's not falling back to tofu/missing-glyph boxes.

- [ ] **Step 4: Delete the verification screenshot**

```bash
rm /d/CodeSpace/world-of-cards/.tmp-seat-identity-check.png
```

Per the phone-connected-phase screenshot policy (`docs/governance/guardrails.md` §3) — screenshot files never get committed or left in the working tree.

- [ ] **Step 5: Report to the user for their own manual check**

Per this task's explicit instruction, the user does their own final check on the phone before deciding to merge — report that the branch (`ui/typography-foundation`) is ready for that check, rather than proceeding to merge.
