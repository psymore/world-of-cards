# Table Shell Prototype Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `TableShell` component in `packages/ui` — a floating, dark-backdrop table object (felt + wood/brass frame, alpha-composited from `FRAME-C-NOFELT-01A.png`) with player panels fused into 4 fixed seat anchors and an optional 2.5D perspective tilt — and exercise it in `apps/playground` with static placeholder content. **Wiring this into Pişti's real game screen is a separate, follow-on plan**, not part of this one; this plan's deliverable is the validated, reusable component itself.

**Architecture:** One new build-time script (Node + `sharp`) converts the opaque-black center of the source frame render into real alpha transparency, producing a checked-in asset. `TableShell` layers that asset over the existing felt image and positions caller-supplied seat content at 4 fixed percentage-based anchors; an optional `tilt` prop wraps the whole assembled unit (frame + felt + seat content) in one `perspective`/`rotateX` transform so everything tilts together rigidly. A new Playground preview component exercises both the flat/tilted and 4-seat/2-seat cases with no game-state dependencies.

**Tech Stack:** Node.js + `sharp` (already a root devDependency) for the asset script; React Native + `@testing-library/react-native` (existing `packages/ui` test setup) for the component; Zustand-free local `useState` in the Playground preview (this is throwaway prototype UI, not persisted template state — matches nothing else in `playgroundStore.ts`, which is reserved for persisted card/table templates).

## Global Constraints

- Reuse the existing "real photo/generated asset over hand-rolled SVG" pattern already established by `TableFelt` — do not hand-draw the frame or felt in SVG.
- No changes to `packages/engine` — this is purely visual.
- `TableShell` must not be wired into any shipped game (Pişti, Batak) or Home in this plan — Playground only.
- Batak and Home are not touched at all in this plan.
- The exact tilt angle and seat-anchor percentages are first-pass calibrated values, explicitly to be visually verified/adjusted against the rendered Playground preview as part of Task 5 — not treated as final until that visual check happens.

---

### Task 1: Alpha-punch script for the table frame asset

**Files:**
- Create: `scripts/lib/punchBlackToAlpha.js`
- Create: `scripts/lib/punchBlackToAlpha.test.js`
- Create: `scripts/build-table-shell-frame.js`
- Generates (not hand-written): `packages/ui/assets/table/table-shell-frame.png`

**Interfaces:**
- Produces: `punchBlackToAlpha(rgba: Buffer, opts: { lowThreshold: number, highThreshold: number }): Buffer` — exported from `scripts/lib/punchBlackToAlpha.js`, consumed by `scripts/build-table-shell-frame.js`.
- Produces: the file `packages/ui/assets/table/table-shell-frame.png` (RGBA PNG, same pixel dimensions as `docs/references/GPT-powerful-assets-review/FRAME-C-NOFELT-01A.png`, i.e. 941×1672), consumed by Task 2's `TableShell.tsx` via `require('../assets/table/table-shell-frame.png')`.

- [ ] **Step 1: Write the failing test for the pure alpha-punch function**

```js
// scripts/lib/punchBlackToAlpha.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { punchBlackToAlpha } = require('./punchBlackToAlpha');

test('fully black pixel becomes fully transparent', () => {
  const input = Buffer.from([0, 0, 0, 255]);
  const output = punchBlackToAlpha(input, { lowThreshold: 15, highThreshold: 60 });
  assert.equal(output[3], 0);
});

test('bright pixel stays fully opaque', () => {
  const input = Buffer.from([200, 150, 90, 255]);
  const output = punchBlackToAlpha(input, { lowThreshold: 15, highThreshold: 60 });
  assert.equal(output[3], 255);
});

test('mid-luminance pixel gets a partial, feathered alpha', () => {
  const input = Buffer.from([40, 40, 40, 255]); // luminance 40, between 15 and 60
  const output = punchBlackToAlpha(input, { lowThreshold: 15, highThreshold: 60 });
  assert.ok(output[3] > 0 && output[3] < 255);
});

test('leaves RGB channels untouched', () => {
  const input = Buffer.from([10, 20, 30, 255]);
  const output = punchBlackToAlpha(input, { lowThreshold: 15, highThreshold: 60 });
  assert.equal(output[0], 10);
  assert.equal(output[1], 20);
  assert.equal(output[2], 30);
});

test('throws if thresholds are invalid', () => {
  assert.throws(() =>
    punchBlackToAlpha(Buffer.from([0, 0, 0, 255]), { lowThreshold: 60, highThreshold: 15 })
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/lib/punchBlackToAlpha.test.js`
Expected: FAIL with "Cannot find module './punchBlackToAlpha'"

- [ ] **Step 3: Write the minimal implementation**

```js
// scripts/lib/punchBlackToAlpha.js
// Pure pixel-buffer transform: fades near-black RGB pixels to transparent so a raster asset's
// unlit "hole" (baked as opaque black, not real alpha) can be composited over another image.
// Operates on a raw RGBA Buffer (4 bytes/pixel) — the same layout sharp's .raw() produces.
function punchBlackToAlpha(rgba, { lowThreshold, highThreshold }) {
  if (highThreshold <= lowThreshold) {
    throw new Error('highThreshold must be greater than lowThreshold');
  }
  const out = Buffer.from(rgba);
  for (let i = 0; i < out.length; i += 4) {
    const r = out[i];
    const g = out[i + 1];
    const b = out[i + 2];
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    let alpha;
    if (luminance <= lowThreshold) {
      alpha = 0;
    } else if (luminance >= highThreshold) {
      alpha = 255;
    } else {
      alpha = Math.round(((luminance - lowThreshold) / (highThreshold - lowThreshold)) * 255);
    }
    out[i + 3] = alpha;
  }
  return out;
}

module.exports = { punchBlackToAlpha };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test scripts/lib/punchBlackToAlpha.test.js`
Expected: PASS (5 tests)

- [ ] **Step 5: Write the build script that uses it on the real source asset**

```js
// scripts/build-table-shell-frame.js
// One-off dev tool: alpha-punches FRAME-C-NOFELT-01A.png's opaque-black center into real
// transparency so packages/ui/src/TableShell.tsx can composite it over a felt image at
// runtime. Not part of the app build — run manually: node scripts/build-table-shell-frame.js
const path = require('path');
const sharp = require('sharp');
const { punchBlackToAlpha } = require('./lib/punchBlackToAlpha');

const SOURCE = path.join(
  __dirname, '..', 'docs', 'references', 'GPT-powerful-assets-review', 'FRAME-C-NOFELT-01A.png'
);
const OUTPUT = path.join(__dirname, '..', 'packages', 'ui', 'assets', 'table', 'table-shell-frame.png');

const LOW_THRESHOLD = 15;
const HIGH_THRESHOLD = 60;

async function main() {
  const { data, info } = await sharp(SOURCE).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const punched = punchBlackToAlpha(data, { lowThreshold: LOW_THRESHOLD, highThreshold: HIGH_THRESHOLD });

  await sharp(punched, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png()
    .toFile(OUTPUT);

  // Sanity-check before trusting the result: sample the known-black center and a known-wood
  // pixel, so a bad threshold or wrong source crop fails loudly here instead of silently
  // shipping a broken asset into packages/ui.
  const { data: verifyData, info: verifyInfo } = await sharp(OUTPUT).raw().toBuffer({ resolveWithObject: true });
  const centerIndex = (Math.round(verifyInfo.height * 0.5) * verifyInfo.width + Math.round(verifyInfo.width * 0.5)) * 4;
  const woodIndex = (Math.round(verifyInfo.height * 0.5) * verifyInfo.width + Math.round(verifyInfo.width * 0.05)) * 4;
  const centerAlpha = verifyData[centerIndex + 3];
  const woodAlpha = verifyData[woodIndex + 3];

  if (centerAlpha > 10) {
    throw new Error(`Center pixel alpha is ${centerAlpha}, expected near 0 (felt hole not punched out)`);
  }
  if (woodAlpha < 245) {
    throw new Error(`Wood-frame pixel alpha is ${woodAlpha}, expected near 255 (frame wrongly punched out)`);
  }

  console.log(`wrote ${OUTPUT}`);
  console.log(`verified: center alpha=${centerAlpha}, wood alpha=${woodAlpha}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 6: Run the build script and verify it succeeds**

Run: `node scripts/build-table-shell-frame.js`
Expected: prints `wrote .../packages/ui/assets/table/table-shell-frame.png` and `verified: center alpha=0, wood alpha=255` (or close to those values). If either sanity check throws, adjust `LOW_THRESHOLD`/`HIGH_THRESHOLD` and rerun — do not proceed to Task 2 until this passes.

- [ ] **Step 7: Visually inspect the generated asset**

Open `packages/ui/assets/table/table-shell-frame.png` in an image viewer (or via the Read tool) against a bright background — the wood/brass frame, gear/hamburger icons, and glass seat plaques should be fully opaque, and the center should show through as transparent (checkerboard in most viewers), with a soft rather than jagged edge where they meet.

- [ ] **Step 8: Commit**

```bash
git add scripts/lib/punchBlackToAlpha.js scripts/lib/punchBlackToAlpha.test.js scripts/build-table-shell-frame.js packages/ui/assets/table/table-shell-frame.png
git commit -m "feat(ui): add table-shell-frame asset and its alpha-punch build script"
```

---

### Task 2: `TableShell` component — flat frame, felt, and seat anchors

**Files:**
- Create: `packages/ui/src/TableShell.tsx`
- Create: `packages/ui/src/TableShell.test.tsx`

**Interfaces:**
- Consumes: `packages/ui/assets/table/table-shell-frame.png` (from Task 1), `packages/ui/assets/table/green.png` (existing felt asset already used by `TableFelt.tsx`).
- Produces: `TableShell({ seats, children }: TableShellProps)` React component; `TableSeatPosition = 'top' | 'bottom' | 'left' | 'right'`; `TABLE_SHELL_ASPECT_RATIO: number` — all exported from `TableShell.tsx`, consumed by Task 3 (adds `tilt`) and Task 4 (re-exported from `index.ts`).

- [ ] **Step 1: Write the failing tests**

```tsx
// packages/ui/src/TableShell.test.tsx
import React from 'react';
import { Text } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { TableShell } from './TableShell';

describe('TableShell', () => {
  it('renders the felt and frame layers', async () => {
    await render(<TableShell />);
    expect(screen.getByTestId('table-shell-felt')).toBeTruthy();
    expect(screen.getByTestId('table-shell-frame')).toBeTruthy();
  });

  it('renders seat content only for seats that were provided', async () => {
    await render(<TableShell seats={{ top: <Text>You</Text>, bottom: <Text>South AI</Text> }} />);
    expect(screen.getByTestId('table-shell-seat-top')).toBeTruthy();
    expect(screen.getByTestId('table-shell-seat-bottom')).toBeTruthy();
    expect(screen.queryByTestId('table-shell-seat-left')).toBeNull();
    expect(screen.queryByTestId('table-shell-seat-right')).toBeNull();
    expect(screen.getByText('You')).toBeTruthy();
    expect(screen.getByText('South AI')).toBeTruthy();
  });

  it('renders center content over the felt', async () => {
    await render(
      <TableShell>
        <Text>Center pile</Text>
      </TableShell>
    );
    expect(screen.getByText('Center pile')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest packages/ui/src/TableShell.test.tsx`
Expected: FAIL with "Cannot find module './TableShell'"

- [ ] **Step 3: Write the minimal implementation**

```tsx
// packages/ui/src/TableShell.tsx
import React from 'react';
import { Image, StyleSheet, View, ViewStyle } from 'react-native';

const FRAME_IMAGE = require('../assets/table/table-shell-frame.png');
const FELT_IMAGE = require('../assets/table/green.png');

// Matches table-shell-frame.png's pixel dimensions (941x1672) so the felt and frame layers
// stay pixel-aligned to each other regardless of the width TableShell is rendered at.
export const TABLE_SHELL_ASPECT_RATIO = 941 / 1672;

export type TableSeatPosition = 'top' | 'bottom' | 'left' | 'right';

// First-pass calibration against FRAME-C-NOFELT-01A.png's baked glass-plaque positions.
// Verify/adjust these visually against the rendered Playground preview (Task 5) before
// treating them as final — see this plan's Global Constraints.
const SEAT_ANCHOR_STYLE: Record<TableSeatPosition, ViewStyle> = {
  top: { position: 'absolute', top: '3.6%', left: '29%', right: '30%', height: '10.5%' },
  bottom: { position: 'absolute', bottom: '3.6%', left: '29%', right: '30%', height: '10.5%' },
  left: { position: 'absolute', left: '9%', top: '32.6%', bottom: '32.6%', width: '13%' },
  right: { position: 'absolute', right: '9%', top: '32.6%', bottom: '32.6%', width: '13%' },
};

const SEAT_POSITIONS: TableSeatPosition[] = ['top', 'bottom', 'left', 'right'];

export interface TableShellProps {
  seats?: Partial<Record<TableSeatPosition, React.ReactNode>>;
  children?: React.ReactNode;
}

function TableShellComponent({ seats, children }: TableShellProps) {
  return (
    <View style={styles.backdrop}>
      <View style={styles.tableBox} testID="table-shell">
        <Image source={FELT_IMAGE} style={styles.fill} resizeMode="stretch" testID="table-shell-felt" />
        <Image source={FRAME_IMAGE} style={styles.fill} resizeMode="stretch" testID="table-shell-frame" />
        {children != null ? <View style={styles.centerContent}>{children}</View> : null}
        {SEAT_POSITIONS.map((position) => {
          const content = seats?.[position];
          if (content == null) return null;
          return (
            <View key={position} style={SEAT_ANCHOR_STYLE[position]} testID={`table-shell-seat-${position}`}>
              {content}
            </View>
          );
        })}
      </View>
    </View>
  );
}

export const TableShell = React.memo(TableShellComponent);

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#0a0a0a', alignItems: 'center', justifyContent: 'center' },
  tableBox: { width: '92%', aspectRatio: TABLE_SHELL_ASPECT_RATIO },
  fill: { ...StyleSheet.absoluteFillObject },
  centerContent: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest packages/ui/src/TableShell.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/TableShell.tsx packages/ui/src/TableShell.test.tsx
git commit -m "feat(ui): add flat TableShell component with fused seat anchors"
```

---

### Task 3: Add the optional 2.5D tilt

**Files:**
- Modify: `packages/ui/src/TableShell.tsx`
- Modify: `packages/ui/src/TableShell.test.tsx`

**Interfaces:**
- Consumes: `TableShellProps`, `SEAT_ANCHOR_STYLE`, `styles.tableBox` from Task 2 (same file).
- Produces: `TableShellProps.tilt?: boolean` (new field on the existing type) — consumed by Task 5's Playground preview.

- [ ] **Step 1: Write the failing test**

```tsx
// Add to packages/ui/src/TableShell.test.tsx, inside the existing describe block:

  it('applies no transform by default (flat)', async () => {
    await render(<TableShell />);
    const table = screen.getByTestId('table-shell');
    const styleArray = Array.isArray(table.props.style) ? table.props.style : [table.props.style];
    expect(styleArray.some((s: any) => s != null && s.transform != null)).toBe(false);
  });

  it('applies the perspective tilt transform when tilt is true', async () => {
    await render(<TableShell tilt />);
    const table = screen.getByTestId('table-shell');
    const styleArray = Array.isArray(table.props.style) ? table.props.style : [table.props.style];
    const transformStyle = styleArray.find((s: any) => s != null && s.transform != null);
    expect(transformStyle.transform).toEqual([{ perspective: 1400 }, { rotateX: '20deg' }]);
  });
```

- [ ] **Step 2: Run tests to verify the new one fails**

Run: `npx jest packages/ui/src/TableShell.test.tsx`
Expected: FAIL on "applies the perspective tilt transform when tilt is true" — `tilt` prop doesn't exist yet, no transform ever applied.

- [ ] **Step 3: Implement the tilt prop**

```tsx
// packages/ui/src/TableShell.tsx — modify TableShellProps, TableShellComponent, and styles:

export interface TableShellProps {
  seats?: Partial<Record<TableSeatPosition, React.ReactNode>>;
  tilt?: boolean;
  children?: React.ReactNode;
}

// Starting value picked during brainstorming (subtler than a 38deg mockup, more than a
// 12deg one) — see docs/superpowers/specs/2026-08-10-table-shell-redesign-design.md §7.
// Tune visually against this component, not the CSS mockup, before treating as final.
const TILT_TRANSFORM: NonNullable<ViewStyle['transform']> = [{ perspective: 1400 }, { rotateX: '20deg' }];

function TableShellComponent({ seats, tilt = false, children }: TableShellProps) {
  return (
    <View style={styles.backdrop}>
      <View style={[styles.tableBox, tilt ? { transform: TILT_TRANSFORM } : null]} testID="table-shell">
        <Image source={FELT_IMAGE} style={styles.fill} resizeMode="stretch" testID="table-shell-felt" />
        <Image source={FRAME_IMAGE} style={styles.fill} resizeMode="stretch" testID="table-shell-frame" />
        {children != null ? <View style={styles.centerContent}>{children}</View> : null}
        {SEAT_POSITIONS.map((position) => {
          const content = seats?.[position];
          if (content == null) return null;
          return (
            <View key={position} style={SEAT_ANCHOR_STYLE[position]} testID={`table-shell-seat-${position}`}>
              {content}
            </View>
          );
        })}
      </View>
    </View>
  );
}
```

(Only the `TableShellProps` interface, the `TILT_TRANSFORM` constant, and the `tableBox` View's `style` prop change — everything else in the file stays as Task 2 left it.)

- [ ] **Step 4: Run tests to verify they all pass**

Run: `npx jest packages/ui/src/TableShell.test.tsx`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/TableShell.tsx packages/ui/src/TableShell.test.tsx
git commit -m "feat(ui): add optional 2.5D tilt to TableShell"
```

---

### Task 4: Export `TableShell` from `packages/ui`

**Files:**
- Modify: `packages/ui/src/index.ts`

**Interfaces:**
- Consumes: `TableShell`, `TableShellProps`, `TableSeatPosition`, `TABLE_SHELL_ASPECT_RATIO` from `./TableShell` (Tasks 2–3).
- Produces: `@world-of-cards/ui` now exports all four — consumed by Task 5's Playground preview via `import { TableShell } from '@world-of-cards/ui'`.

- [ ] **Step 1: Write the failing test**

```tsx
// packages/ui/src/index.test.tsx (new file)
import { TableShell } from './index';

describe('index exports', () => {
  it('exports TableShell', () => {
    expect(TableShell).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest packages/ui/src/index.test.tsx`
Expected: FAIL — `TableShell` is `undefined` (not exported from `index.ts` yet).

- [ ] **Step 3: Add the export**

```ts
// packages/ui/src/index.ts — add near the other TableXxx exports:
export { TableShell, TABLE_SHELL_ASPECT_RATIO } from './TableShell';
export type { TableShellProps, TableSeatPosition } from './TableShell';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest packages/ui/src/index.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/index.ts packages/ui/src/index.test.tsx
git commit -m "feat(ui): export TableShell from the ui package"
```

---

### Task 5: Playground preview — 4-seat/2-seat and tilt on/off

**Files:**
- Create: `apps/playground/src/components/TableShellPreview.tsx`
- Modify: `apps/playground/src/PlaygroundScreen.tsx`

**Interfaces:**
- Consumes: `TableShell` from `@world-of-cards/ui` (Task 4).
- Produces: `TableShellPreview()` component, rendered by `PlaygroundScreen`. Nothing else in the repo depends on this — it is prototype-only UI, matching `TableTemplateEditor`'s and `CardTemplateEditor`'s role in the same file.

- [ ] **Step 1: Create the preview component**

```tsx
// apps/playground/src/components/TableShellPreview.tsx
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { TableShell } from '@world-of-cards/ui';

const SEAT_LABEL = { top: 'You', bottom: 'South AI', left: 'West AI', right: 'East AI' } as const;

function SeatBadge({ label }: { label: string }) {
  return (
    <View style={styles.seatBadge}>
      <Text style={styles.seatBadgeText}>{label}</Text>
    </View>
  );
}

// Prototype-only screen: exercises TableShell's flat/tilted and 4-seat/2-seat cases with no
// game-state dependency, so the component can be judged purely on how it looks before it's
// wired into a real game (a separate, later plan). No zustand store entry for tilt/seat-count
// — this is throwaway exploration state, not a persisted card/table template.
export function TableShellPreview() {
  const [tilt, setTilt] = useState(false);
  const [fourSeats, setFourSeats] = useState(true);

  const seats = fourSeats
    ? {
        top: <SeatBadge label={SEAT_LABEL.top} />,
        bottom: <SeatBadge label={SEAT_LABEL.bottom} />,
        left: <SeatBadge label={SEAT_LABEL.left} />,
        right: <SeatBadge label={SEAT_LABEL.right} />,
      }
    : {
        top: <SeatBadge label={SEAT_LABEL.top} />,
        bottom: <SeatBadge label={SEAT_LABEL.bottom} />,
      };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Table Shell (prototype)</Text>
      <View style={styles.controls}>
        <Pressable testID="tilt-toggle" onPress={() => setTilt((v) => !v)} style={styles.toggleButton}>
          <Text style={styles.toggleButtonLabel}>{tilt ? 'Tilt: ON' : 'Tilt: OFF'}</Text>
        </Pressable>
        <Pressable testID="seat-count-toggle" onPress={() => setFourSeats((v) => !v)} style={styles.toggleButton}>
          <Text style={styles.toggleButtonLabel}>{fourSeats ? '4 seats' : '2 seats'}</Text>
        </Pressable>
      </View>
      <View style={styles.tableWrapper}>
        <TableShell seats={seats} tilt={tilt} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  heading: { fontSize: 18, fontWeight: 'bold', marginBottom: 8, color: '#f4c542' },
  controls: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  toggleButton: { backgroundColor: '#2a1a13', padding: 10, borderRadius: 6, alignItems: 'center' },
  toggleButtonLabel: { color: '#e8e3d2', fontWeight: 'bold' },
  tableWrapper: { height: 480 },
  seatBadge: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  seatBadgeText: { color: '#2a1a13', fontWeight: 'bold', fontSize: 12 },
});
```

- [ ] **Step 2: Wire it into `PlaygroundScreen`**

```tsx
// apps/playground/src/PlaygroundScreen.tsx — add the import and render it above CardGallery:
import { TableShellPreview } from "./components/TableShellPreview";
// ... existing imports stay ...

// Inside the returned JSX, add <TableShellPreview /> as the first child of contentWrapper,
// immediately before <CardGallery />:
        <TableShellPreview />
        <CardGallery />
```

- [ ] **Step 3: Run the Playground app and visually verify**

Run: `npm run playground` (or `npm run start --workspace=world-of-cards-playground`), open it in a browser or simulator.

Expected, and required before this task is done:
- The table renders as a floating oval on a dark backdrop, not full-bleed.
- With "4 seats" selected, all 4 labels ("You", "South AI", "West AI", "East AI") visually sit inside the frame's baked glass plaques — if any label is offset from its plaque, adjust the corresponding percentages in `SEAT_ANCHOR_STYLE` (`packages/ui/src/TableShell.tsx`) and re-run until they line up.
- With "2 seats" selected, only "You" and "South AI" show; the left/right glass plaques are empty but the frame still looks intentional, not broken.
- Toggling "Tilt: ON" shows the whole table (frame, felt, and all visible seat labels) tilting together as one rigid unit, with no seam or misalignment between layers.
- No console errors/warnings about missing assets.

- [ ] **Step 4: Commit**

```bash
git add apps/playground/src/components/TableShellPreview.tsx apps/playground/src/PlaygroundScreen.tsx
git commit -m "feat(playground): add TableShell prototype preview with tilt and seat-count toggles"
```

---

## Self-Review Notes

- **Spec coverage:** §1 (floating object) → Task 2's `backdrop`/`tableBox` split. §2 (fused panels) → Task 2's `SEAT_ANCHOR_STYLE`. §3 (source asset) → Task 1. §4 (alpha-punch, not manual editing) → Task 1. §5 (`TableShell` component + anchors) → Task 2. §6 (seat-count handling) → Task 2's `seats?.[position] == null` skip + Task 5's 2-seat toggle. §7 (tilt, deferred/subtle/tuned live) → Task 3 + Task 5 Step 3. §8 build order step 1 (Playground prototype) → Tasks 1–5 in full; steps 2–4 (port to real games) are explicitly out of scope for this plan (see Goal).
- **Placeholder scan:** no TBD/TODO markers; the seat-anchor and tilt-angle constants are real starting values with an explicit, concrete verification step (Task 5 Step 3), not vague "handle appropriately" language.
- **Type consistency:** `TableSeatPosition`, `TableShellProps`, `TABLE_SHELL_ASPECT_RATIO` are introduced once in Task 2 and referenced identically (same names/shapes) in Tasks 3–5.
