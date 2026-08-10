// scripts/build-table-shell-frame.js
// One-off dev tool: alpha-punches FRAME-C-NOFELT-01A.png's opaque-black center into real
// transparency so packages/ui/src/TableShell.tsx can composite it over a felt image at
// runtime. Uses flood-fill connectivity masking to distinguish the felt hole from disconnected
// dark regions like plaques and buttons (kept opaque).
//
// The final alpha is derived BINARILY from the (closed) connectivity mask — mask[i] ? 0 : 255
// — not from punchBlackToAlpha's per-pixel luminance feather. Connectivity already proved which
// pixels are part of the hole; re-deriving alpha from a masked-in pixel's own luminance let dust/
// grain/highlight specks inside the hole (which are still <= the flood threshold, or get pulled
// in by closeMaskGaps, but have elevated luminance) produce visible mid-range alpha "speckle".
// The binary mask has a hard, jagged 0/255 edge, so the alpha channel is blurred afterward to
// soften that edge into a smooth few-pixel transition, without reintroducing luminance
// sensitivity (the blur smooths the mask's edge geometry, not per-pixel brightness).
//
// Not part of the app build — run manually: node scripts/build-table-shell-frame.js
const path = require('path');
const sharp = require('sharp');
const { floodFillHoleMask, closeMaskGaps } = require('./lib/floodFillHoleMask');
const { blurAlphaChannel } = require('./lib/blurAlphaChannel');

const SOURCE = path.join(
  __dirname, '..', 'docs', 'references', 'GPT-powerful-assets-review', 'FRAME-C-NOFELT-01A.png'
);
const OUTPUT = path.join(__dirname, '..', 'packages', 'ui', 'assets', 'table', 'table-shell-frame.png');

// Retuned down from 40: under the old per-pixel-luminance-feather approach, masked pixels with
// luminance in the (22,40] band still contributed nonzero opacity (up to ~79 alpha), which
// happened to keep the plaque/gear/hamburger region-average checks above their thresholds even
// though a modest amount of their shadow area gets pulled into the connectivity mask by
// FLOOD_THRESHOLD=40. Switching to binary mask->alpha (this rework) removes that nonzero
// contribution entirely (masked now always means alpha=0), so that same amount of mask
// over-inclusion now reads as a real opacity drop and regresses those checks. Measured directly:
// FLOOD_THRESHOLD=40 covers the felt hole box at 100.00% either way, and 27 still covers it at
// 99.99% (i.e. the actual hole is unaffected), while whole-image mask coverage barely moves
// (40.57% -> 40.36%) — the difference is only the marginal shadow-bridging into frame regions
// that the old feathering was inadvertently compensating for. 27 keeps a comfortable safety
// margin below FLOOD_THRESHOLD=29, where a single connectivity bridge pixel flips the
// gear-icon region from passing to failing.
const FLOOD_THRESHOLD = 27;
const EDGE_BLUR_RADIUS = 3;

async function main() {
  const { data, info } = await sharp(SOURCE).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const pixelCount = info.width * info.height;

  // Compute flood-fill mask from the known center seed, generously including antialiased edges
  const seedX = Math.round(info.width * 0.5);
  const seedY = Math.round(info.height * 0.5);
  let holeMask = floodFillHoleMask(data, info.width, info.height, seedX, seedY, { floodThreshold: FLOOD_THRESHOLD });

  // Close small gaps (isolated bright specks inside the hole that failed the flood threshold)
  // Use moderate threshold (0.5 = 50% neighbors masked) to absorb boundary speckles without
  // over-closing into frame regions
  holeMask = closeMaskGaps(holeMask, info.width, info.height, 3, 0.5);

  // Binary alpha from the mask: no per-pixel luminance check left to trip over a dust speck
  // once a pixel is inside the connected hole.
  const binaryAlpha = new Uint8Array(pixelCount);
  for (let i = 0; i < pixelCount; i++) {
    binaryAlpha[i] = holeMask[i] === 1 ? 0 : 255;
  }

  // Soften the hard binary edge into a smooth few-pixel transition by blurring the alpha
  // channel itself (edge geometry), not by re-deriving alpha from brightness.
  const blurredAlpha = blurAlphaChannel(binaryAlpha, info.width, info.height, EDGE_BLUR_RADIUS);

  // Recombine the blurred alpha with the original RGB (unchanged).
  const output = Buffer.from(data);
  for (let i = 0; i < pixelCount; i++) {
    output[i * 4 + 3] = blurredAlpha[i];
  }

  await sharp(output, { raw: { width: info.width, height: info.height, channels: 4 } })
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
