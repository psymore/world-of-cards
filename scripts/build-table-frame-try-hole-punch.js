// scripts/build-table-frame-try-hole-punch.js
// One-off dev tool: punches a real transparent hole into
// docs/references/GPT-powerful-assets-review/assets-v1/TABLE-FRAME-TRY-02-GLOW-Photoroom.png.
//
// Photoroom's background removal already cut the outer background to alpha 0, but the enclosed
// center hole (where the checkerboard-look "empty" area is) stayed fully opaque (alpha 255) —
// a background remover treats the connected outer region as background, not a hole its own ring
// fully encloses. Same class of bug as build-felt-hole-mask.js, different fix: that script had a
// correct alpha channel to derive shape from; this file's alpha can't distinguish the hole from
// the wood ring (both opaque), so this floods through raw pixel COLOR instead.
//
// The hole's checkerboard fill is near-neutral gray/white (R≈G≈B) and bright; every part of the
// actual frame — wood, gold trim, dark plaques, gold rivets, even its bright sparkle highlights —
// is warm-toned (R notably higher than B) even where it's also bright. So the flood only grows
// through pixels that are BOTH bright AND near-neutral, which the frame surfaces never are.
// Reuses scripts/lib/floodFillHoleMask.js unmodified (same trick as build-felt-hole-mask.js: feed
// it a synthetic buffer so its "luminance <= threshold" walk does what this case needs — here,
// synthetic value is 0 for qualifying hole-colored pixels and 255 otherwise, so a low
// floodThreshold picks out exactly the qualifying pixels).
//
// Not part of the app build — run manually: node scripts/build-table-frame-try-hole-punch.js
const path = require('path');
const sharp = require('sharp');
const { floodFillHoleMask } = require('./lib/floodFillHoleMask');
const { blurAlphaChannel } = require('./lib/blurAlphaChannel');

const ASSETS_V1 = path.join(__dirname, '..', 'docs', 'references', 'GPT-powerful-assets-review', 'assets-v1');
const SOURCE = path.join(ASSETS_V1, 'TABLE-FRAME-TRY-02-GLOW-Photoroom.png');
const OUTPUT = path.join(ASSETS_V1, 'TABLE-FRAME-TRY-02-GLOW-Photoroom-holepunched.png');

// Seed sampled directly against this file: (512, 768) is the image's exact center and confirmed
// inside the checkerboard hole (opaque, near-neutral gray) before this fix.
const SEED_X = 512;
const SEED_Y = 768;
const MIN_LUMINANCE = 150;
const MAX_CHROMA = 20;
const EDGE_BLUR_RADIUS = 2;

async function main() {
  const { data, info } = await sharp(SOURCE).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const pixelCount = width * height;

  const qualifiesAsHole = new Uint8Array(pixelCount * 4);
  for (let i = 0; i < pixelCount; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const chroma = Math.max(r, g, b) - Math.min(r, g, b);
    const qualifies = luminance >= MIN_LUMINANCE && chroma <= MAX_CHROMA;
    const syntheticValue = qualifies ? 0 : 255;
    qualifiesAsHole[i * 4] = syntheticValue;
    qualifiesAsHole[i * 4 + 1] = syntheticValue;
    qualifiesAsHole[i * 4 + 2] = syntheticValue;
    qualifiesAsHole[i * 4 + 3] = 255;
  }

  const holeMask = floodFillHoleMask(qualifiesAsHole, width, height, SEED_X, SEED_Y, {
    floodThreshold: 10,
  });

  const binaryAlpha = new Uint8Array(pixelCount);
  for (let i = 0; i < pixelCount; i++) {
    binaryAlpha[i] = holeMask[i] === 1 ? 0 : 255;
  }
  const blurredAlpha = blurAlphaChannel(binaryAlpha, width, height, EDGE_BLUR_RADIUS);

  const output = Buffer.from(data);
  for (let i = 0; i < pixelCount; i++) {
    // Only the newly-found hole pixels change — everywhere else keeps its existing alpha
    // (already 0 outside the ring, already 255 on the ring itself).
    if (holeMask[i] === 1 || blurredAlpha[i] < 255) {
      output[i * 4 + 3] = Math.min(output[i * 4 + 3], blurredAlpha[i]);
    }
  }

  await sharp(output, { raw: { width, height, channels: 4 } }).png().toFile(OUTPUT);

  const { data: verifyData, info: verifyInfo } = await sharp(OUTPUT).raw().toBuffer({ resolveWithObject: true });
  const alphaAt = (x, y) => verifyData[(y * verifyInfo.width + x) * 4 + 3];

  const holeInteriorAlpha = alphaAt(SEED_X, SEED_Y);
  const ringAlpha = alphaAt(Math.floor(width / 2), 60);
  const outerAlpha = alphaAt(5, 5);

  if (holeInteriorAlpha > 20) {
    throw new Error(`hole interior not transparent: ${holeInteriorAlpha} (expected <=20)`);
  }
  if (ringAlpha < 235) {
    throw new Error(`wood ring lost opacity: ${ringAlpha} (expected >=235)`);
  }
  if (outerAlpha > 20) {
    throw new Error(`outer background not transparent: ${outerAlpha} (expected <=20, was already 0 pre-fix)`);
  }

  console.log(`wrote ${OUTPUT}`);
  console.log(`verified: hole-interior=${holeInteriorAlpha}, ring=${ringAlpha}, outer=${outerAlpha}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
