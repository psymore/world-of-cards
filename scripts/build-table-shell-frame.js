// scripts/build-table-shell-frame.js
// One-off dev tool: alpha-punches FRAME-C-NOFELT-01A.png's opaque-black center into real
// transparency so packages/ui/src/TableShell.tsx can composite it over a felt image at
// runtime. Uses flood-fill connectivity masking to distinguish the felt hole (punched
// transparent) from disconnected dark regions like plaques and buttons (kept opaque).
// Not part of the app build — run manually: node scripts/build-table-shell-frame.js
const path = require('path');
const sharp = require('sharp');
const { punchBlackToAlpha } = require('./lib/punchBlackToAlpha');
const { floodFillHoleMask } = require('./lib/floodFillHoleMask');

const SOURCE = path.join(
  __dirname, '..', 'docs', 'references', 'GPT-powerful-assets-review', 'FRAME-C-NOFELT-01A.png'
);
const OUTPUT = path.join(__dirname, '..', 'packages', 'ui', 'assets', 'table', 'table-shell-frame.png');

const LOW_THRESHOLD = 22;
const HIGH_THRESHOLD = 80;
const FLOOD_THRESHOLD = 40;

async function main() {
  const { data, info } = await sharp(SOURCE).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  // Compute flood-fill mask from the known center seed, generously including antialiased edges
  const seedX = Math.round(info.width * 0.5);
  const seedY = Math.round(info.height * 0.5);
  const holeMask = floodFillHoleMask(data, info.width, info.height, seedX, seedY, { floodThreshold: FLOOD_THRESHOLD });

  // Apply alpha punch to all pixels
  const punched = punchBlackToAlpha(data, { lowThreshold: LOW_THRESHOLD, highThreshold: HIGH_THRESHOLD });

  // Restrict transparency to only masked pixels (the connected hole); force masked-out pixels back to opaque
  for (let i = 0; i < holeMask.length; i++) {
    if (holeMask[i] === 0) {
      // Not part of the hole region: force alpha to 255 (fully opaque)
      punched[i * 4 + 3] = 255;
    }
  }

  await sharp(punched, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png()
    .toFile(OUTPUT);

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

  // Center should be transparent
  const centerAlpha = verifyData[(Math.round(verifyInfo.height * 0.5) * verifyInfo.width + Math.round(verifyInfo.width * 0.5)) * 4 + 3];

  // Hole region should be mostly transparent (safely inside the felt hole, away from wood rim)
  const holeRegionAvg = measureRegionAlpha(250, 400, 700, 1250);

  // Frame regions should be opaque
  const plaqueAvg = measureRegionAlpha(60, 700, 220, 1000);
  const gearAvg = measureRegionAlpha(150, 150, 310, 320);
  const hamburgerAvg = measureRegionAlpha(630, 150, 790, 320);

  const checks = [
    { name: 'hole region avg', value: holeRegionAvg, min: undefined, max: 50, operator: '<=' },
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
  console.log(`verified: hole avg=${holeRegionAvg.toFixed(1)}, center alpha=${centerAlpha}, plaque avg=${plaqueAvg.toFixed(1)}, gear avg=${gearAvg.toFixed(1)}, hamburger avg=${hamburgerAvg.toFixed(1)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
