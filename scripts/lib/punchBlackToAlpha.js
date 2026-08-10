// scripts/lib/punchBlackToAlpha.js
// Pure pixel-buffer transform: fades near-black RGB pixels to transparent so a raster asset's
// unlit "hole" (baked as opaque black, not real alpha) can be composited over another image.
// Operates on a raw RGBA Buffer (4 bytes/pixel) — the same layout sharp's .raw() produces.
function punchBlackToAlpha(rgba, { lowThreshold, highThreshold }) {
  if (highThreshold <= lowThreshold) {
    throw new Error('highThreshold must be greater than lowThreshold');
  }
  const out = Buffer.from(rgba);
  for (let i = 0; i < out.length; i += 4) {
    const r = out[i];
    const g = out[i + 1];
    const b = out[i + 2];
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    let alpha;
    if (luminance <= lowThreshold) {
      alpha = 0;
    } else if (luminance >= highThreshold) {
      alpha = 255;
    } else {
      alpha = Math.round(((luminance - lowThreshold) / (highThreshold - lowThreshold)) * 255);
    }
    out[i + 3] = alpha;
  }
  return out;
}

module.exports = { punchBlackToAlpha };
