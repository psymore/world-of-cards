// scripts/lib/blurAlphaChannel.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { blurAlphaChannel } = require('./blurAlphaChannel');

test('radius 0 returns an unchanged copy', () => {
  const input = Uint8Array.from([0, 255, 0, 255, 0, 255, 0, 255, 0]);
  const output = blurAlphaChannel(input, 3, 3, 0);
  assert.deepEqual(Array.from(output), Array.from(input));
  assert.notEqual(output, input, 'should return a new array, not the same reference');
});

test('uniform field is unchanged by blurring', () => {
  const input = new Uint8Array(25).fill(128);
  const output = blurAlphaChannel(input, 5, 5, 2);
  for (const value of output) {
    assert.equal(value, 128);
  }
});

test('a hard binary edge is softened into an intermediate ramp', () => {
  // 9x1 row: left half 0 (transparent), right half 255 (opaque), hard edge at x=4/5
  const width = 9;
  const input = Uint8Array.from([0, 0, 0, 0, 0, 255, 255, 255, 255]);
  const output = blurAlphaChannel(input, width, 1, 2);

  // Pixels far from the edge stay at their extreme values.
  assert.equal(output[0], 0, 'far-left stays fully transparent');
  assert.equal(output[8], 255, 'far-right stays fully opaque');

  // Pixels straddling the boundary become intermediate values, not still hard 0/255.
  assert.ok(output[4] > 0 && output[4] < 255, `pixel at boundary should be intermediate, got ${output[4]}`);
  assert.ok(output[5] > 0 && output[5] < 255, `pixel just past boundary should be intermediate, got ${output[5]}`);
});

test('edge pixels use clamped sampling, not wraparound', () => {
  // A single opaque pixel in an otherwise transparent field, in the corner.
  const width = 5;
  const height = 5;
  const input = new Uint8Array(width * height).fill(0);
  input[0] = 255; // top-left corner
  const output = blurAlphaChannel(input, width, height, 1);

  // The corner pixel's blurred value should reflect clamped edge replication (not wrap to the
  // opposite corner), so the opposite corner must remain unaffected (0).
  assert.equal(output[width * height - 1], 0, 'opposite corner unaffected by clamped blur');
  assert.ok(output[0] > 0, 'the corner itself should still show some of its own contribution');
});

test('throws on mismatched buffer length', () => {
  assert.throws(() => blurAlphaChannel(new Uint8Array(10), 3, 3, 1));
});

test('throws on negative or non-integer radius', () => {
  assert.throws(() => blurAlphaChannel(new Uint8Array(9), 3, 3, -1));
  assert.throws(() => blurAlphaChannel(new Uint8Array(9), 3, 3, 1.5));
});
