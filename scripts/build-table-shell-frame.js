// scripts/build-table-shell-frame.js
// One-off dev tool: alpha-punches FRAME-C-NOFELT-01A.png's opaque-black center into real
// transparency so packages/ui/src/TableShell.tsx can composite it over a felt image at
// runtime. Not part of the app build — run manually: node scripts/build-table-shell-frame.js
const path = require('path');
const sharp = require('sharp');
const { punchBlackToAlpha } = require('./lib/punchBlackToAlpha');

const SOURCE = path.join(
  __dirname, '..', 'docs', 'references', 'GPT-powerful-assets-review', 'FRAME-C-NOFELT-01A.png'
);
const OUTPUT = path.join(__dirname, '..', 'packages', 'ui', 'assets', 'table', 'table-shell-frame.png');

const LOW_THRESHOLD = 25;
const HIGH_THRESHOLD = 100;

async function main() {
  const { data, info } = await sharp(SOURCE).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const punched = punchBlackToAlpha(data, { lowThreshold: LOW_THRESHOLD, highThreshold: HIGH_THRESHOLD });

  await sharp(punched, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png()
    .toFile(OUTPUT);

  // Sanity-check before trusting the result: sample the known-black center and a known-bright-frame
  // pixel, so a bad threshold or wrong source crop fails loudly here instead of silently
  // shipping a broken asset into packages/ui.
  const { data: verifyData, info: verifyInfo } = await sharp(OUTPUT).raw().toBuffer({ resolveWithObject: true });
  const centerIndex = (Math.round(verifyInfo.height * 0.5) * verifyInfo.width + Math.round(verifyInfo.width * 0.5)) * 4;
  const frameIndex = (Math.round(verifyInfo.height * 0.5) * verifyInfo.width + Math.round(verifyInfo.width * 0.1)) * 4;
  const centerAlpha = verifyData[centerIndex + 3];
  const frameAlpha = verifyData[frameIndex + 3];

  if (centerAlpha > 10) {
    throw new Error(`Center pixel alpha is ${centerAlpha}, expected near 0 (felt hole not punched out)`);
  }
  if (frameAlpha < 245) {
    throw new Error(`Frame pixel alpha is ${frameAlpha}, expected near 255 (frame wrongly punched out)`);
  }

  console.log(`wrote ${OUTPUT}`);
  console.log(`verified: center alpha=${centerAlpha}, frame alpha=${frameAlpha}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
