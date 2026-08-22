// scripts/assets/build-side-nameplate-glow-asset.js
// One-off dev tool: turns docs/references/GPT-powerful-assets-review/assets-v1/BUTTON-GREEN-GLOW-02.png
// into the left/right (compact) PlayerBadge pill background.
//
// The source has no alpha channel at all (colorType 2, plain RGB) — its background is a flat solid
// black fill, not a checkerboard or a soft ambient glow, so using it as-is behind a nameplate would
// show a black box on the felt instead of a floating pill. Same class of fix as
// build-table-frame-try-hole-punch.js, simpler case: the background here is uniformly pure black
// (luminance 0) everywhere it touches the four image edges, while the felt interior (even at its
// darkest, center ~(8,27,13), luminance ~22) and the gold rim (~luminance 100+) are both well above
// a small flood threshold — so a single corner-seeded flood fill cleanly separates "background" from
// "pill" without eating into the felt.
//
// Also rotates the output 90° so the pill is upright/vertical (baked into the asset, not a runtime
// transform — RN's transform:[{rotate}] doesn't swap the element's own layout width/height, which
// would make sizing this into a narrow vertical seat slot awkward).
//
// Not part of the app build — run manually: node scripts/assets/build-side-nameplate-glow-asset.js
const path = require('path');
const sharp = require('sharp');
const { floodFillHoleMask } = require('./lib/floodFillHoleMask');
const { blurAlphaChannel } = require('./lib/blurAlphaChannel');

const SOURCE = path.join(
  __dirname, '..', '..', 'docs', 'references', 'GPT-powerful-assets-review', 'assets-v1', 'BUTTON-GREEN-GLOW-02.png',
);
const OUTPUT = path.join(__dirname, '..', '..', 'packages', 'ui', 'assets', 'plaques', 'side-nameplate-green-glow.png');

const FLOOD_THRESHOLD = 12;
const EDGE_BLUR_RADIUS = 2;

async function main() {
  const { data, info } = await sharp(SOURCE).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const pixelCount = width * height;

  const backgroundMask = floodFillHoleMask(data, width, height, 0, 0, { floodThreshold: FLOOD_THRESHOLD });

  const binaryAlpha = new Uint8Array(pixelCount);
  for (let i = 0; i < pixelCount; i++) {
    binaryAlpha[i] = backgroundMask[i] === 1 ? 0 : 255;
  }
  const blurredAlpha = blurAlphaChannel(binaryAlpha, width, height, EDGE_BLUR_RADIUS);

  const output = Buffer.from(data);
  for (let i = 0; i < pixelCount; i++) {
    output[i * 4 + 3] = blurredAlpha[i];
  }

  await sharp(output, { raw: { width, height, channels: 4 } })
    .rotate(90)
    .png()
    .toFile(OUTPUT);

  const { data: verifyData, info: verifyInfo } = await sharp(OUTPUT).raw().toBuffer({ resolveWithObject: true });
  const alphaAt = (x, y) => verifyData[(y * verifyInfo.width + x) * 4 + 3];
  // Post-rotation (90°), the original top-left corner (0,0) lands at the new bottom-left corner.
  const cornerAlpha = alphaAt(5, verifyInfo.height - 6);
  const centerAlpha = alphaAt(Math.floor(verifyInfo.width / 2), Math.floor(verifyInfo.height / 2));

  if (cornerAlpha > 20) {
    throw new Error(`background not transparent: ${cornerAlpha} (expected <=20)`);
  }
  if (centerAlpha < 235) {
    throw new Error(`felt lost opacity: ${centerAlpha} (expected >=235)`);
  }

  console.log(`wrote ${OUTPUT} (${verifyInfo.width}x${verifyInfo.height})`);
  console.log(`verified: corner=${cornerAlpha}, center=${centerAlpha}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
