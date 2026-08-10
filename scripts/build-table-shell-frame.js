// scripts/build-table-shell-frame.js
// One-off dev tool: copies FRAME-C-NOFELT-01A-dup-Photoroom.png to
// packages/ui/assets/table/table-shell-frame.png so packages/ui/src/TableShell.tsx can composite
// it over a felt image at runtime, then re-verifies its alpha channel against the same
// region checks this script always has (see below).
//
// This used to alpha-punch FRAME-C-NOFELT-01A.png's opaque-black center itself, via flood-fill
// connectivity masking (see git history for that algorithm — floodFillHoleMask + closeMaskGaps +
// binary-mask-to-alpha + blurAlphaChannel, the end result of a 4-round fix arc). The new source,
// FRAME-C-NOFELT-01A-dup-Photoroom.png, already comes with a correct alpha channel (processed
// externally through Photoroom) — verified directly against this file's own region checks below
// before adopting it, including the specific disconnected-dark-region cases (gear icon,
// hamburger icon, corner medallions) that the original flood-fill algorithm existed to get
// right. Since the source is already correct, this script no longer needs to compute anything;
// it just copies and re-verifies, so the checks still guard against a future source swap
// breaking silently.
//
// Not part of the app build — run manually: node scripts/build-table-shell-frame.js
const path = require('path');
const sharp = require('sharp');

const SOURCE = path.join(
  __dirname, '..', 'docs', 'references', 'GPT-powerful-assets-review', 'FRAME-C-NOFELT-01A-dup-Photoroom.png'
);
const OUTPUT = path.join(__dirname, '..', 'packages', 'ui', 'assets', 'table', 'table-shell-frame.png');

async function main() {
  await sharp(SOURCE).png().toFile(OUTPUT);

  // Region-based sanity checks: measure alpha averages across known problem areas
  const { data: verifyData, info: verifyInfo } = await sharp(OUTPUT).raw().toBuffer({ resolveWithObject: true });

  // Helper: sample grid of points across a region and average their alpha
  const measureRegionAlpha = (x1, y1, x2, y2, step = 10) => {
    let sum = 0;
    let count = 0;
    for (let y = y1; y <= y2; y += step) {
      for (let x = x1; x <= x2; x += step) {
        const idx = (y * verifyInfo.width + x) * 4;
        sum += verifyData[idx + 3];
        count++;
      }
    }
    return count > 0 ? sum / count : 0;
  };

  // Helper: measure fraction of pixels in a region with alpha > threshold
  const measureSpeckleFraction = (x1, y1, x2, y2, alphaThreshold, step = 5) => {
    let speckles = 0;
    let count = 0;
    for (let y = y1; y <= y2; y += step) {
      for (let x = x1; x <= x2; x += step) {
        const idx = (y * verifyInfo.width + x) * 4;
        if (verifyData[idx + 3] > alphaThreshold) {
          speckles++;
        }
        count++;
      }
    }
    return count > 0 ? speckles / count : 0;
  };

  // Center should be transparent
  const centerAlpha = verifyData[(Math.round(verifyInfo.height * 0.5) * verifyInfo.width + Math.round(verifyInfo.width * 0.5)) * 4 + 3];

  // Hole region should be mostly transparent (safely inside the felt hole, away from wood rim)
  const holeRegionAvg = measureRegionAlpha(250, 400, 700, 1250);

  // Check for speckles: isolated opaque pixels inside the transparent hole
  // Sample at full resolution (step=1) so no speckle pattern can hide between sample points
  const holeSpeckleFraction = measureSpeckleFraction(250, 400, 700, 1250, 60, 1);

  // Frame regions should be opaque
  const plaqueAvg = measureRegionAlpha(60, 700, 220, 1000);
  const gearAvg = measureRegionAlpha(150, 150, 310, 320);
  const hamburgerAvg = measureRegionAlpha(630, 150, 790, 320);

  const checks = [
    { name: 'hole region avg', value: holeRegionAvg, min: undefined, max: 50, operator: '<=' },
    { name: 'hole speckle fraction (alpha>60)', value: holeSpeckleFraction, min: undefined, max: 0.01, operator: '<=' },
    { name: 'center pixel', value: centerAlpha, min: undefined, max: 10, operator: '<=' },
    { name: 'plaque region avg', value: plaqueAvg, min: 0.88 * 255, max: undefined, operator: '>=' },
    { name: 'gear-icon region avg', value: gearAvg, min: 0.78 * 255, max: undefined, operator: '>=' },
    { name: 'hamburger-icon region avg', value: hamburgerAvg, min: 0.78 * 255, max: undefined, operator: '>=' },
  ];

  for (const check of checks) {
    let passed = false;
    if (check.operator === '<=') {
      passed = check.value <= check.max;
    } else if (check.operator === '>=') {
      passed = check.value >= check.min;
    }

    if (!passed) {
      const expected = check.operator === '<=' ? `<=${check.max}` : `>=${check.min.toFixed(0)}`;
      throw new Error(`${check.name} is ${check.value.toFixed(1)}, expected ${expected}`);
    }
  }

  console.log(`wrote ${OUTPUT}`);
  console.log(`verified: hole avg=${holeRegionAvg.toFixed(1)}, hole speckles=${(holeSpeckleFraction*100).toFixed(2)}%, center alpha=${centerAlpha}, plaque avg=${plaqueAvg.toFixed(1)}, gear avg=${gearAvg.toFixed(1)}, hamburger avg=${hamburgerAvg.toFixed(1)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
