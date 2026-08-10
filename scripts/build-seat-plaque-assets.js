// scripts/build-seat-plaque-assets.js
// One-off dev tool: crops two small ornament pieces (a glass pill, a glass badge circle) out of
// PANELKIT-GLASS-01A.png's flat-black sheet and alpha-punches the surrounding black into real
// transparency, so packages/ui/src/SeatIdentity.tsx can composite them over TableShell's felt/
// frame at runtime.
//
// Uses the same flood-fill connectivity masking + binary-alpha + edge-blur pipeline as
// scripts/build-table-shell-frame.js's Task 1 (see that file's header for the full history of
// why binary-mask-then-blur beats per-pixel luminance feathering). The one difference: that
// script seeds from the CENTER to find a hole surrounded by opaque content; this one seeds from
// a CORNER (guaranteed background) to find the background surrounding an opaque object. Both
// crops here sit on flat, isolated #000000 with the object as the only other content in the crop
// box (verified via direct luminance histogram during design — see
// docs/superpowers/specs/2026-08-10-seat-identity-design.md, Decision 5), so a single
// conservative threshold per crop is enough; no closeMaskGaps gap-closing is needed (no other
// dark region in either crop to accidentally bridge into).
//
// Not part of the app build — run manually: node scripts/build-seat-plaque-assets.js
const path = require('path');
const sharp = require('sharp');
const { floodFillHoleMask } = require('./lib/floodFillHoleMask');
const { blurAlphaChannel } = require('./lib/blurAlphaChannel');

const SOURCE = path.join(
  __dirname, '..', 'docs', 'references', 'GPT-powerful-assets-review', 'PANELKIT-GLASS-01A.png'
);
const OUTPUT_DIR = path.join(__dirname, '..', 'packages', 'ui', 'assets', 'table');
const EDGE_BLUR_RADIUS = 2;

// Crop boxes and flood thresholds were measured directly against the source sheet during
// design: both crops' backgrounds are pure #000000 (luminance 0) with a soft antialiased glow
// around the object before its solid material starts. floodThreshold sits in the low-count
// valley between the background spike and the object's material, per crop (measured separately
// because the pill's glow valley sits ~14-18 and the badge's sits ~9-13).
const PIECES = [
  {
    name: 'seat-plaque.png',
    crop: { left: 20, top: 1150, width: 450, height: 90 },
    floodThreshold: 16,
    backgroundSample: { x: 2, y: 2 },
    objectSample: { x: 225, y: 45 },
  },
  {
    name: 'seat-badge.png',
    crop: { left: 30, top: 1020, width: 130, height: 110 },
    floodThreshold: 11,
    backgroundSample: { x: 2, y: 2 },
    objectSample: { x: 65, y: 55 },
  },
];

async function buildPiece(piece) {
  const { data, info } = await sharp(SOURCE)
    .extract(piece.crop)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const pixelCount = info.width * info.height;

  const backgroundMask = floodFillHoleMask(data, info.width, info.height, 0, 0, {
    floodThreshold: piece.floodThreshold,
  });

  const binaryAlpha = new Uint8Array(pixelCount);
  for (let i = 0; i < pixelCount; i++) {
    binaryAlpha[i] = backgroundMask[i] === 1 ? 0 : 255;
  }

  const blurredAlpha = blurAlphaChannel(binaryAlpha, info.width, info.height, EDGE_BLUR_RADIUS);

  const output = Buffer.from(data);
  for (let i = 0; i < pixelCount; i++) {
    output[i * 4 + 3] = blurredAlpha[i];
  }

  const outputPath = path.join(OUTPUT_DIR, piece.name);
  await sharp(output, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png()
    .toFile(outputPath);

  const { data: verifyData, info: verifyInfo } = await sharp(outputPath)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const alphaAt = (x, y) => verifyData[(y * verifyInfo.width + x) * 4 + 3];

  const backgroundAlpha = alphaAt(piece.backgroundSample.x, piece.backgroundSample.y);
  const objectAlpha = alphaAt(piece.objectSample.x, piece.objectSample.y);

  if (backgroundAlpha > 20) {
    throw new Error(
      `${piece.name}: background sample point not transparent (alpha=${backgroundAlpha}, expected <=20)`
    );
  }
  if (objectAlpha < 235) {
    throw new Error(
      `${piece.name}: object sample point not opaque (alpha=${objectAlpha}, expected >=235)`
    );
  }

  console.log(`${piece.name}: OK (background alpha=${backgroundAlpha}, object alpha=${objectAlpha})`);
}

async function main() {
  for (const piece of PIECES) {
    await buildPiece(piece);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
