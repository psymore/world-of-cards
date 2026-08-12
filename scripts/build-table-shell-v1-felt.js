// scripts/build-table-shell-v1-felt.js
// One-off dev tool: masks TABLE-FELT-PANEL-TRY-03-RED-GLOW.png to only render inside
// apps/playground/assets/table-shell-versions/v1-frame.png's actual center hole, producing
// v1-felt.png in the same folder for the Playground's "v1" Table Shell tab.
//
// v1-frame.png's alpha is 0 both in its true hole AND in the area outside its wood-ring
// silhouette (Photoroom cut the outer background; build-table-frame-try-hole-punch.js cut the
// inner hole) — exactly the same shape of problem build-felt-hole-mask.js solved for the
// shipped v0 frame, so this reuses that exact corner-seeded flood-fill technique unmodified: a
// corner seed (guaranteed outer background) can never reach the hole because the frame's own
// opaque wood ring physically blocks the path between them.
//
// No resize step: the felt source and v1-frame.png are already both 1024x1536 (same batch of
// reference sheets), so this only crops the felt down to the hole's shape — it does not need to
// stretch or warp it to fit.
//
// Not part of the app build — run manually: node scripts/build-table-shell-v1-felt.js
const path = require('path');
const sharp = require('sharp');
const { floodFillHoleMask } = require('./lib/floodFillHoleMask');
const { blurAlphaChannel } = require('./lib/blurAlphaChannel');

const PLAYGROUND_ASSETS = path.join(__dirname, '..', 'apps', 'playground', 'assets', 'table-shell-versions');
const FRAME = path.join(PLAYGROUND_ASSETS, 'v1-frame.png');
const FELT_SOURCE = path.join(
  __dirname, '..', 'docs', 'references', 'GPT-powerful-assets-review', 'assets-v1', 'TABLE-FELT-PANEL-TRY-03-RED-GLOW.png'
);
const OUTPUT = path.join(PLAYGROUND_ASSETS, 'v1-felt.png');

const OUTER_BACKGROUND_ALPHA_THRESHOLD = 10;
const EDGE_BLUR_RADIUS = 2;

async function main() {
  const { data: frameData, info } = await sharp(FRAME).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const pixelCount = width * height;

  const alphaAsLuminance = new Uint8Array(pixelCount * 4);
  for (let i = 0; i < pixelCount; i++) {
    const a = frameData[i * 4 + 3];
    alphaAsLuminance[i * 4] = a;
    alphaAsLuminance[i * 4 + 1] = a;
    alphaAsLuminance[i * 4 + 2] = a;
    alphaAsLuminance[i * 4 + 3] = 255;
  }

  const outerBackgroundMask = floodFillHoleMask(alphaAsLuminance, width, height, 0, 0, {
    floodThreshold: OUTER_BACKGROUND_ALPHA_THRESHOLD,
  });

  const holeMask = new Uint8Array(pixelCount);
  for (let i = 0; i < pixelCount; i++) {
    const isTransparent = frameData[i * 4 + 3] < OUTER_BACKGROUND_ALPHA_THRESHOLD;
    holeMask[i] = isTransparent && outerBackgroundMask[i] === 0 ? 1 : 0;
  }

  const binaryAlpha = new Uint8Array(pixelCount);
  for (let i = 0; i < pixelCount; i++) {
    binaryAlpha[i] = holeMask[i] === 1 ? 255 : 0;
  }
  const blurredAlpha = blurAlphaChannel(binaryAlpha, width, height, EDGE_BLUR_RADIUS);

  const { data: feltData, info: feltInfo } = await sharp(FELT_SOURCE)
    .resize(width, height)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (feltInfo.width !== width || feltInfo.height !== height) {
    throw new Error(`felt/frame dimension mismatch after resize: ${feltInfo.width}x${feltInfo.height} vs ${width}x${height}`);
  }

  const output = Buffer.from(feltData);
  for (let i = 0; i < pixelCount; i++) {
    output[i * 4 + 3] = blurredAlpha[i];
  }

  await sharp(output, { raw: { width, height, channels: 4 } }).png().toFile(OUTPUT);

  const { data: verifyData, info: verifyInfo } = await sharp(OUTPUT).raw().toBuffer({ resolveWithObject: true });
  const alphaAt = (x, y) => verifyData[(y * verifyInfo.width + x) * 4 + 3];

  const cornerSamples = [[10, 10], [60, 60], [100, 100]].map(([x, y]) => alphaAt(x, y));
  const holeInteriorAlpha = alphaAt(Math.floor(width / 2), Math.floor(height / 2));

  if (cornerSamples.some((a) => a > 20)) {
    throw new Error(`outer-background corner sample(s) not transparent: ${cornerSamples.join(', ')} (expected <=20)`);
  }
  if (holeInteriorAlpha < 235) {
    throw new Error(`hole-interior sample not opaque: ${holeInteriorAlpha} (expected >=235)`);
  }

  console.log(`wrote ${OUTPUT}`);
  console.log(`verified: corners=${cornerSamples.join(',')}, hole-interior=${holeInteriorAlpha}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
