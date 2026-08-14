// BFS flood fill from a known seed pixel through contiguous pixels at or below
// floodThreshold luminance. Returns a Uint8Array mask (1 = part of the connected hole
// region reachable from the seed, 0 = not) sized width*height. This is what lets a
// *disconnected* dark region (a dark glass plaque, a shadowed icon button) stay untouched
// even though its raw luminance is similarly low to the actual felt hole — only pixels
// reachable from the seed by walking through other dark pixels get masked in.
function floodFillHoleMask(rgba, width, height, seedX, seedY, { floodThreshold }) {
  const mask = new Uint8Array(width * height);
  const luminanceAt = (index) =>
    0.2126 * rgba[index * 4] + 0.7152 * rgba[index * 4 + 1] + 0.0722 * rgba[index * 4 + 2];
  const seedIndex = seedY * width + seedX;
  mask[seedIndex] = 1;
  const stack = [seedIndex];
  while (stack.length > 0) {
    const index = stack.pop();
    const x = index % width;
    const y = Math.floor(index / width);
    const neighbors = [];
    if (x + 1 < width) neighbors.push(index + 1);
    if (x - 1 >= 0) neighbors.push(index - 1);
    if (y + 1 < height) neighbors.push(index + width);
    if (y - 1 >= 0) neighbors.push(index - width);
    for (const neighborIndex of neighbors) {
      if (mask[neighborIndex] === 1) continue;
      if (luminanceAt(neighborIndex) <= floodThreshold) {
        mask[neighborIndex] = 1;
        stack.push(neighborIndex);
      }
    }
  }
  return mask;
}

// Fills small isolated gaps in a flood-fill mask — a bright dust/grain speck inside the
// hole that failed the flood threshold at its own pixel, but is surrounded by masked
// neighbors, gets absorbed into the mask too. A genuinely separate region (a plaque, an
// icon button) is NOT absorbed: its neighbors are mostly unmasked wood, not hole, so it
// never crosses the majority-neighbors-masked bar below.
// neighborThreshold: minimum fraction of neighbors that must be masked for a pixel to be filled
// (default 0.75 = 3 of 4 neighbors; lower = more aggressive filling)
function closeMaskGaps(mask, width, height, iterations, neighborThreshold = 0.75) {
  let current = mask;
  for (let iter = 0; iter < iterations; iter++) {
    const next = Uint8Array.from(current);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = y * width + x;
        if (current[index] === 1) continue;
        let maskedNeighbors = 0;
        let totalNeighbors = 0;
        if (x + 1 < width) { totalNeighbors++; if (current[index + 1] === 1) maskedNeighbors++; }
        if (x - 1 >= 0) { totalNeighbors++; if (current[index - 1] === 1) maskedNeighbors++; }
        if (y + 1 < height) { totalNeighbors++; if (current[index + width] === 1) maskedNeighbors++; }
        if (y - 1 >= 0) { totalNeighbors++; if (current[index - width] === 1) maskedNeighbors++; }
        if (totalNeighbors > 0 && maskedNeighbors / totalNeighbors >= neighborThreshold) {
          next[index] = 1;
        }
      }
    }
    current = next;
  }
  return current;
}

module.exports = { floodFillHoleMask, closeMaskGaps };
