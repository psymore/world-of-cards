// One-off dev tool: builds double-headed court-card art from raw AI-generated
// sources in .superpowers/card-art-sources/ into apps/mobile/assets/card-art/processed/.
// Not part of the app build — run manually: node scripts/assets/process-card-art.js
const path = require('path');
const sharp = require('sharp');

const SOURCE_DIR = path.join(__dirname, '..', '..', '.superpowers', 'card-art-sources');
const OUTPUT_DIR = path.join(__dirname, '..', '..', 'apps', 'mobile', 'assets', 'card-art', 'processed');

const CANVAS_WIDTH = 300;
const CANVAS_HEIGHT = 430;
const HALF_HEIGHT = Math.round(CANVAS_HEIGHT / 2);

const MANIFEST = [
  { output: 'king-of-spades.png', source: 'ChatGPT Image Jul 11, 2026, 05_02_21 PM.png', mirrored: false },
  { output: 'queen-of-spades.png', source: 'ChatGPT Image Jul 11, 2026, 05_04_12 PM.png', mirrored: false },
  { output: 'jack-of-spades.png', source: 'ChatGPT Image Jul 11, 2026, 05_04_17 PM.png', mirrored: false },
  { output: 'king-of-hearts.png', source: 'ChatGPT Image Jul 11, 2026, 05_02_35 PM.png', mirrored: false },
  { output: 'king-of-clubs.png', source: 'Gemini_Generated_Image_qcvz4lqcvz4lqcvz.png', mirrored: false },
  { output: 'king-of-diamonds.png', source: 'Gemini_Generated_Image_fwc3sxfwc3sxfwc3.png', mirrored: true },
];

async function buildMirroredComposite(sourcePath) {
  const trimmed = await sharp(sourcePath).trim().toBuffer();
  const bust = await sharp(trimmed)
    .resize({ width: CANVAS_WIDTH, height: HALF_HEIGHT, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();
  const mirroredBust = await sharp(bust).rotate(180).toBuffer();

  return sharp({
    create: {
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      { input: bust, top: 0, left: 0 },
      { input: mirroredBust, top: HALF_HEIGHT, left: 0 },
    ])
    .png()
    .toBuffer();
}

async function buildPassthrough(sourcePath) {
  return sharp(sourcePath)
    .trim()
    .resize({ width: CANVAS_WIDTH, height: CANVAS_HEIGHT, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
}

async function main() {
  for (const entry of MANIFEST) {
    const sourcePath = path.join(SOURCE_DIR, entry.source);
    const outputPath = path.join(OUTPUT_DIR, entry.output);
    const result = entry.mirrored ? await buildPassthrough(sourcePath) : await buildMirroredComposite(sourcePath);
    await sharp(result).toFile(outputPath);
    console.log(`wrote ${entry.output}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
