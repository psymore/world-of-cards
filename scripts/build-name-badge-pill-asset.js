// scripts/build-name-badge-pill-asset.js
// One-off dev tool: crops the wood/brass nameplate pill out of BADGE-PILL-02A.png's own sheet.
//
// Unlike build-seat-plaque-assets.js's PANELKIT-GLASS-01A source, this sheet already ships with a
// real alpha channel (soft radial falloff around the pill, not a hard cut, verified directly:
// alpha is 0 at all four corners but rises gradually toward the pill) — no flood-fill punching
// needed, just a plain alpha-bounding-box trim (sharp's own .trim()). threshold=30 keeps a bit of
// the sheet's own ambient glow halo around the pill (consistent with how TABLE_BACKDROP_GLASS_
// GOLD_GLOW_IMAGE and similar glow assets are used elsewhere in this repo) while dropping the
// long, barely-nonzero gradient tail further out that a threshold near 0 would otherwise keep.
//
// Not part of the app build — run manually: node scripts/build-name-badge-pill-asset.js
const fs = require('fs/promises');
const path = require('path');
const sharp = require('sharp');

const SOURCE = path.join(
  __dirname, '..', 'docs', 'references', 'GPT-powerful-assets-review', 'sheets', 'BADGE-PILL-02A.png'
);
const OUTPUT_PATH = path.join(__dirname, '..', 'packages', 'ui', 'assets', 'plaques', 'name-badge-pill.png');
const TRIM_THRESHOLD = 30;

async function main() {
  // No .raw() before .toBuffer() — the result is already a re-encoded PNG (trim() only changes
  // the crop box), so it can be written to disk directly instead of round-tripped through sharp
  // again as if it were untagged pixel data.
  const { data, info } = await sharp(SOURCE).trim({ threshold: TRIM_THRESHOLD }).toBuffer({ resolveWithObject: true });
  await fs.writeFile(OUTPUT_PATH, data);
  console.log(`name-badge-pill.png: OK (${info.width}x${info.height})`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
