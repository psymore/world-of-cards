// scripts/build-avatar-assets.js
// One-off dev tool: crops the 6 face photos out of TABLE-010.png's "Avatar Content Examples"
// section (Male 01/02/03, Female 01/02/03) for use as SeatIdentity's avatar images, replacing
// the generic code-drawn silhouette.
//
// Unlike scripts/build-seat-plaque-assets.js and scripts/build-table-shell-frame.js, this needs
// no alpha-punching at all: each crop is a plain rectangle (no transparency), and
// packages/ui/src/SeatIdentity.tsx clips it to a circle at render time via
// `overflow: 'hidden'` + `borderRadius: '50%'` on its avatar ring container. Corner pixels
// outside the inscribed circle (which is where each crop box's edge occasionally still shows a
// sliver of TABLE-010's own baked gold ring) are discarded by that clip regardless of what's
// there, so the crop only needs the inscribed circle itself to be clean face photo, not the
// whole square.
//
// Not part of the app build — run manually: node scripts/build-avatar-assets.js
const path = require('path');
const sharp = require('sharp');

const SOURCE = path.join(__dirname, '..', 'docs', 'references', 'GPT-powerful-assets-review', 'TABLE-010.png');
const OUTPUT_DIR = path.join(__dirname, '..', 'packages', 'ui', 'assets', 'table');

// Crop boxes measured directly against the source sheet during design: a 3x2 grid of circular
// portraits, each ~72px across, inset far enough from TABLE-010's own baked gold ring that the
// crop's inscribed circle is clean photo.
const PIECES = [
  { name: 'avatar-male-01.png', crop: { left: 597, top: 142, width: 72, height: 72 } },
  { name: 'avatar-female-01.png', crop: { left: 757, top: 142, width: 72, height: 72 } },
  { name: 'avatar-male-02.png', crop: { left: 917, top: 142, width: 72, height: 72 } },
  { name: 'avatar-female-02.png', crop: { left: 597, top: 292, width: 72, height: 72 } },
  { name: 'avatar-male-03.png', crop: { left: 757, top: 292, width: 72, height: 72 } },
  { name: 'avatar-female-03.png', crop: { left: 917, top: 292, width: 72, height: 72 } },
];

async function main() {
  for (const piece of PIECES) {
    const outputPath = path.join(OUTPUT_DIR, piece.name);
    await sharp(SOURCE).extract(piece.crop).png().toFile(outputPath);
    console.log(`${piece.name}: OK`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
