// scripts/lib/floodFillHoleMask.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { floodFillHoleMask } = require('./floodFillHoleMask');

test('seed pixel itself is masked', () => {
  // 3x3 grid: seed at (1,1) center
  const rgba = Buffer.alloc(9 * 4);
  // All pixels: R=10, G=10, B=10 (luminance ~10)
  for (let i = 0; i < 9; i++) {
    rgba[i * 4] = 10;
    rgba[i * 4 + 1] = 10;
    rgba[i * 4 + 2] = 10;
  }

  const mask = floodFillHoleMask(rgba, 3, 3, 1, 1, { floodThreshold: 50 });
  assert.equal(mask[1 * 3 + 1], 1, 'seed at (1,1) should be masked');
});

test('contiguous dark region all gets masked', () => {
  // 5x5 grid with a cross-shaped dark region connected to seed
  const rgba = Buffer.alloc(25 * 4);
  const setPixel = (x, y, r, g, b) => {
    const idx = (y * 5 + x) * 4;
    rgba[idx] = r;
    rgba[idx + 1] = g;
    rgba[idx + 2] = b;
  };

  // Start with all bright pixels (R=200, G=200, B=200)
  for (let i = 0; i < 25; i++) {
    rgba[i * 4] = 200;
    rgba[i * 4 + 1] = 200;
    rgba[i * 4 + 2] = 200;
  }

  // Create a + shape of dark pixels centered at (2,2)
  setPixel(2, 1, 20, 20, 20); // top
  setPixel(1, 2, 20, 20, 20); // left
  setPixel(2, 2, 20, 20, 20); // center
  setPixel(3, 2, 20, 20, 20); // right
  setPixel(2, 3, 20, 20, 20); // bottom

  const mask = floodFillHoleMask(rgba, 5, 5, 2, 2, { floodThreshold: 50 });

  // All dark pixels should be masked
  assert.equal(mask[1 * 5 + 2], 1, 'top of cross masked');
  assert.equal(mask[2 * 5 + 1], 1, 'left of cross masked');
  assert.equal(mask[2 * 5 + 2], 1, 'center masked');
  assert.equal(mask[2 * 5 + 3], 1, 'right of cross masked');
  assert.equal(mask[3 * 5 + 2], 1, 'bottom of cross masked');

  // Corner bright pixels should not be masked
  assert.equal(mask[0 * 5 + 0], 0, 'corner (0,0) not masked');
  assert.equal(mask[0 * 5 + 4], 0, 'corner (4,0) not masked');
  assert.equal(mask[4 * 5 + 0], 0, 'corner (0,4) not masked');
  assert.equal(mask[4 * 5 + 4], 0, 'corner (4,4) not masked');
});

test('disconnected dark region does NOT get masked', () => {
  // 5x5 grid with two separate dark regions: one connected to seed, one isolated
  const rgba = Buffer.alloc(25 * 4);
  const setPixel = (x, y, r, g, b) => {
    const idx = (y * 5 + x) * 4;
    rgba[idx] = r;
    rgba[idx + 1] = g;
    rgba[idx + 2] = b;
  };

  // Start with all bright
  for (let i = 0; i < 25; i++) {
    rgba[i * 4] = 200;
    rgba[i * 4 + 1] = 200;
    rgba[i * 4 + 2] = 200;
  }

  // Connected dark region at (0-2, 0-1)
  setPixel(0, 0, 20, 20, 20);
  setPixel(1, 0, 20, 20, 20);
  setPixel(2, 0, 20, 20, 20);
  setPixel(1, 1, 20, 20, 20);

  // Isolated dark blob at (3-4, 3-4) - separated by bright pixels
  setPixel(3, 3, 20, 20, 20);
  setPixel(4, 3, 20, 20, 20);
  setPixel(3, 4, 20, 20, 20);
  setPixel(4, 4, 20, 20, 20);

  const mask = floodFillHoleMask(rgba, 5, 5, 1, 0, { floodThreshold: 50 });

  // Connected region should be masked
  assert.equal(mask[0 * 5 + 0], 1, 'connected region at (0,0) masked');
  assert.equal(mask[0 * 5 + 1], 1, 'connected region at (1,0) masked');
  assert.equal(mask[1 * 5 + 1], 1, 'connected region at (1,1) masked');

  // Isolated region should NOT be masked despite being dark
  assert.equal(mask[3 * 5 + 3], 0, 'isolated dark blob at (3,3) NOT masked');
  assert.equal(mask[4 * 5 + 3], 0, 'isolated dark blob at (4,3) NOT masked');
  assert.equal(mask[3 * 5 + 4], 0, 'isolated dark blob at (3,4) NOT masked');
  assert.equal(mask[4 * 5 + 4], 0, 'isolated dark blob at (4,4) NOT masked');
});

test('fully bright grid masks only the seed', () => {
  const rgba = Buffer.alloc(25 * 4);
  // All bright pixels
  for (let i = 0; i < 25; i++) {
    rgba[i * 4] = 200;
    rgba[i * 4 + 1] = 200;
    rgba[i * 4 + 2] = 200;
  }

  const mask = floodFillHoleMask(rgba, 5, 5, 2, 2, { floodThreshold: 50 });

  // Only seed should be masked
  let maskedCount = 0;
  for (let i = 0; i < 25; i++) {
    maskedCount += mask[i];
  }
  assert.equal(maskedCount, 1, 'only seed pixel should be masked');
  assert.equal(mask[2 * 5 + 2], 1, 'seed at (2,2) should be masked');
});

test('threshold boundary is respected', () => {
  // 3x3 grid with seed and neighbors at different luminances
  const rgba = Buffer.alloc(9 * 4);
  const setPixel = (x, y, r, g, b) => {
    const idx = (y * 3 + x) * 4;
    rgba[idx] = r;
    rgba[idx + 1] = g;
    rgba[idx + 2] = b;
  };

  // Center: luminance 20
  setPixel(1, 1, 20, 20, 20);
  // Right neighbor: luminance 30 (just at threshold)
  setPixel(2, 1, 30, 30, 30);
  // Bottom neighbor: luminance 31 (just above threshold)
  setPixel(1, 2, 31, 31, 31);
  // Other pixels: bright
  for (let x = 0; x < 3; x++) {
    for (let y = 0; y < 3; y++) {
      if ((x === 1 && y === 1) || (x === 2 && y === 1) || (x === 1 && y === 2)) continue;
      setPixel(x, y, 200, 200, 200);
    }
  }

  const mask = floodFillHoleMask(rgba, 3, 3, 1, 1, { floodThreshold: 30 });

  assert.equal(mask[1 * 3 + 1], 1, 'center masked');
  assert.equal(mask[1 * 3 + 2], 1, 'right neighbor at exactly threshold (luminance 30) is masked');
  assert.equal(mask[2 * 3 + 1], 0, 'bottom neighbor above threshold (luminance 31) is NOT masked');
});
