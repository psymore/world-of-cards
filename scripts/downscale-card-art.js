// One-off dev tool: downscales the AI-generated court-card art + card-back images in
// packages/ui/assets/card-art/processed/ai-generated/, which were sourced at full
// AI-generation resolution (up to 1024x1536, ~2MB each) despite rendering at ~50-80px
// on an actual card (see PlayingCard.tsx's CARD_DIMS/courtArtFrame). This was causing a
// visible load delay on web, since every court card renders a real Image that has to
// fetch its full multi-MB source before it can paint.
//
// Resizes each PNG in place (same filename/path, so no code changes needed) to fit
// within a 600x900 bounding box, preserving aspect ratio and transparency, and
// withoutEnlargement so nothing already smaller gets upscaled. 600x900 is deliberately
// generous headroom above today's actual render size (leaves room for cards to be
// rendered somewhat larger in the future, and for high-DPI/retina displays) while still
// cutting the pixel count dramatically versus the ~1024x1536 sources.
//
// Not part of the app build — run manually: node scripts/downscale-card-art.js
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT_DIR = path.join(
  __dirname,
  '..',
  'packages',
  'ui',
  'assets',
  'card-art',
  'processed',
  'ai-generated'
);

const MAX_WIDTH = 600;
const MAX_HEIGHT = 900;

function findPngFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...findPngFiles(fullPath));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.png')) {
      files.push(fullPath);
    }
  }
  return files;
}

async function downscaleFile(filePath) {
  const before = fs.statSync(filePath).size;
  const buffer = await sharp(filePath)
    .resize({
      width: MAX_WIDTH,
      height: MAX_HEIGHT,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();
  fs.writeFileSync(filePath, buffer);
  const after = buffer.length;
  const relPath = path.relative(ROOT_DIR, filePath);
  console.log(
    `${relPath}: ${(before / 1024).toFixed(0)}KB -> ${(after / 1024).toFixed(0)}KB`
  );
}

async function main() {
  const files = findPngFiles(ROOT_DIR);
  for (const file of files) {
    await downscaleFile(file);
  }
  console.log(`Done. ${files.length} files processed.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
