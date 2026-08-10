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

module.exports = { floodFillHoleMask };
