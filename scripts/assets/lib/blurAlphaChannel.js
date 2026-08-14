// scripts/assets/lib/blurAlphaChannel.js
// Pure box-blur over a single-channel (alpha) array. Used to soften the hard 0/255 edge that
// results from binarizing a flood-fill mask directly into alpha (mask[i] ? 0 : 255): that
// binary edge is geometrically correct (it follows real connectivity) but pixel-jagged, so we
// blur the alpha channel itself — smoothing the mask's edge geometry — rather than re-deriving
// alpha from per-pixel luminance, which is what let dust/grain speckles leak through before.
// Two-pass separable box blur (horizontal then vertical) with edge-clamped sampling.
function blurAlphaChannel(alpha, width, height, radius) {
  if (!Number.isInteger(radius) || radius < 0) {
    throw new Error('radius must be a non-negative integer');
  }
  if (alpha.length !== width * height) {
    throw new Error('alpha length must equal width * height');
  }
  if (radius === 0) {
    return Uint8Array.from(alpha);
  }
  const horizontal = boxBlurPass(alpha, width, height, radius, true);
  return boxBlurPass(horizontal, width, height, radius, false);
}

function boxBlurPass(src, width, height, radius, isHorizontal) {
  const out = new Uint8Array(width * height);
  const windowSize = radius * 2 + 1;
  if (isHorizontal) {
    for (let y = 0; y < height; y++) {
      const rowStart = y * width;
      for (let x = 0; x < width; x++) {
        let sum = 0;
        for (let k = -radius; k <= radius; k++) {
          sum += src[rowStart + clamp(x + k, 0, width - 1)];
        }
        out[rowStart + x] = Math.round(sum / windowSize);
      }
    }
  } else {
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        let sum = 0;
        for (let k = -radius; k <= radius; k++) {
          sum += src[clamp(y + k, 0, height - 1) * width + x];
        }
        out[y * width + x] = Math.round(sum / windowSize);
      }
    }
  }
  return out;
}

function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

module.exports = { blurAlphaChannel };
