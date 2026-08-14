// scripts/assets/build-felt-hole-mask.js
// One-off dev tool: masks the felt image to only render inside table-shell-frame.png's actual
// center hole, fixing a real leak — the frame's alpha is 0 both in the true hole (where felt
// should show) and in the area outside the wooden ring's oval silhouette (where it should not),
// so the un-masked felt showed green through the corners past the ring, not just in the hole.
//
// Reuses scripts/lib/floodFillHoleMask.js unmodified, same technique as
// scripts/assets/build-table-shell-frame.js's original hole-punch and scripts/assets/build-seat-plaque-assets.js's
// background-punch — a corner seed, guaranteed to be in the "outer background," can never reach
// the hole because the frame's own opaque wood ring physically blocks the path between them.
// Unlike those two scripts, there's no luminance-derivation step here: table-shell-frame.png's
// alpha channel is already correct (photoroom-processed, verified separately), so this floods
// through a synthetic "luminance" buffer built directly from that alpha (R=G=B=alpha per pixel)
// rather than re-deriving anything from raw color — the flood-fill lib only knows how to walk
// luminance, so this is the cheapest way to reuse it unmodified for an alpha-driven walk.
//
// Depends on packages/ui/assets/table/table-shell-frame.png already being built (run
// build-table-shell-frame.js first if that's stale).
//
// Not part of the app build — run manually: node scripts/assets/build-felt-hole-mask.js
const path = require('path');
const sharp = require('sharp');
const { floodFillHoleMask } = require('./lib/floodFillHoleMask');
const { blurAlphaChannel } = require('./lib/blurAlphaChannel');

const FRAME = path.join(__dirname, '..', '..', 'packages', 'ui', 'assets', 'table', 'table-shell-frame.png');
const FELT_SOURCE = path.join(
  __dirname, '..', '..', 'docs', 'references', 'GPT-powerful-assets-review', 'FELT-GREEN-BORDERED-01.png'
);
const OUTPUT = path.join(__dirname, '..', '..', 'packages', 'ui', 'assets', 'table', 'felt-green-bordered-masked.png');

const OUTER_BACKGROUND_ALPHA_THRESHOLD = 10;
const EDGE_BLUR_RADIUS = 2;

async function main() {
  const { data: frameData, info } = await sharp(FRAME).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const pixelCount = width * height;

  // Synthetic RGBA buffer whose "luminance" (0.2126R + 0.7152G + 0.0722B, weights sum to 1) is
  // exactly the frame's own alpha value, so floodFillHoleMask's luminance walk is really an
  // alpha walk without needing a new lib function.
  const alphaAsLuminance = new Uint8Array(pixelCount * 4);
  for (let i = 0; i < pixelCount; i++) {
    const a = frameData[i * 4 + 3];
    alphaAsLuminance[i * 4] = a;
    alphaAsLuminance[i * 4 + 1] = a;
    alphaAsLuminance[i * 4 + 2] = a;
    alphaAsLuminance[i * 4 + 3] = 255;
  }

  // Corner seed: guaranteed to be outside the wood ring (confirmed directly against this file
  // during design), and physically unreachable from the hole through any path of transparent
  // pixels, since the opaque ring fully encloses the hole.
  const outerBackgroundMask = floodFillHoleMask(alphaAsLuminance, width, height, 0, 0, {
    floodThreshold: OUTER_BACKGROUND_ALPHA_THRESHOLD,
  });

  // The hole is whatever's transparent but NOT part of the outer-background flood.
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

  // Verify: corners (outer background) now transparent, a known hole-interior point still opaque,
  // and the overall "green leak" ratio (the metric used to first confirm the bug) is now ~0.
  const { data: verifyData, info: verifyInfo } = await sharp(OUTPUT).raw().toBuffer({ resolveWithObject: true });
  const alphaAt = (x, y) => verifyData[(y * verifyInfo.width + x) * 4 + 3];

  const cornerSamples = [[10, 10], [60, 60], [100, 100]].map(([x, y]) => alphaAt(x, y));
  const holeInteriorAlpha = alphaAt(470, 800);

  if (cornerSamples.some((a) => a > 20)) {
    throw new Error(`outer-background corner sample(s) not transparent: ${cornerSamples.join(', ')} (expected <=20)`);
  }
  if (holeInteriorAlpha < 235) {
    throw new Error(`hole-interior sample not opaque: ${holeInteriorAlpha} (expected >=235)`);
  }

  // Corner-region leak check, not a whole-image one: the original 78.4% "leak ratio" measured
  // during design counted every frame-transparent pixel, which is dominated by the legitimate
  // hole interior (transparent in the frame, and *correctly* opaque-green in the masked felt —
  // that's the feature, not a bug). The real regression to guard is specifically the four corner
  // regions (outside the wood ring, never part of the hole), which should now read transparent.
  const measureRegionAlpha = (x1, y1, x2, y2, step = 4) => {
    let sum = 0;
    let count = 0;
    for (let y = y1; y <= y2; y += step) {
      for (let x = x1; x <= x2; x += step) {
        sum += verifyData[(y * verifyInfo.width + x) * 4 + 3];
        count++;
      }
    }
    return count > 0 ? sum / count : 0;
  };
  const cornerRegions = [
    [0, 0, 130, 130],
    [width - 131, 0, width - 1, 130],
    [0, height - 131, 130, height - 1],
    [width - 131, height - 131, width - 1, height - 1],
  ];
  const cornerRegionAvgs = cornerRegions.map(([x1, y1, x2, y2]) => measureRegionAlpha(x1, y1, x2, y2));
  if (cornerRegionAvgs.some((avg) => avg > 20)) {
    throw new Error(`corner region average(s) not transparent: ${cornerRegionAvgs.map((a) => a.toFixed(1)).join(', ')} (expected <=20)`);
  }

  console.log(`wrote ${OUTPUT}`);
  console.log(`verified: corners=${cornerSamples.join(',')}, hole-interior=${holeInteriorAlpha}, corner region avgs=${cornerRegionAvgs.map((a) => a.toFixed(1)).join(',')}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
