// scripts/build-modal-badge-rect-assets.js
// One-off dev tool: crops the two glass/brass rectangle badges used as modal-card backgrounds
// (apps/mobile/src/components/devTuning/DevTuningControls.tsx's DevTuningModalShell, and the
// smaller confirm-style dialogs) out of their own sheets.
//
// Same reasoning as build-name-badge-pill-asset.js: both sources already ship a real alpha
// channel with a soft ambient glow falloff (0 at all four corners, rising gradually toward the
// rectangle) rather than a hard-cut background, so a plain alpha-bounding-box trim is enough — no
// flood-fill punching needed. threshold=30 keeps a bit of that glow halo (consistent with the
// name-badge-pill asset and the table's own glow assets) while dropping the long, barely-nonzero
// gradient tail further out.
//
// BADGE-RECT-01B has no un-upscaled counterpart in the `sheets/` folder (it only exists under the
// upscayl_png_upscayl-standard-4x_4x/ folder, at 1024x1536 — not actually 4x anything, just where
// this particular variant happens to live); BADGE-RECT-01A-dup is sourced from `sheets/` like the
// other badges.
//
// Not part of the app build — run manually: node scripts/build-modal-badge-rect-assets.js
const fs = require('fs/promises');
const path = require('path');
const sharp = require('sharp');

const ASSETS_ROOT = path.join(__dirname, '..', 'docs', 'references', 'GPT-powerful-assets-review');
const OUTPUT_DIR = path.join(__dirname, '..', 'packages', 'ui', 'assets', 'plaques');
const TRIM_THRESHOLD = 30;

const PIECES = [
  {
    source: path.join(ASSETS_ROOT, 'sheets', 'BADGE-RECT-01A-dup.png'),
    output: path.join(OUTPUT_DIR, 'modal-card-small.png'),
  },
  {
    source: path.join(ASSETS_ROOT, 'upscayl_png_upscayl-standard-4x_4x', 'BADGE-RECT-01B.png'),
    output: path.join(OUTPUT_DIR, 'modal-card-large.png'),
  },
];

async function main() {
  for (const piece of PIECES) {
    const { data, info } = await sharp(piece.source).trim({ threshold: TRIM_THRESHOLD }).toBuffer({ resolveWithObject: true });
    await fs.writeFile(piece.output, data);
    console.log(`${path.basename(piece.output)}: OK (${info.width}x${info.height})`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
