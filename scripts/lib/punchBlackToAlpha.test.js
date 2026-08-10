// scripts/lib/punchBlackToAlpha.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { punchBlackToAlpha } = require('./punchBlackToAlpha');

test('fully black pixel becomes fully transparent', () => {
  const input = Buffer.from([0, 0, 0, 255]);
  const output = punchBlackToAlpha(input, { lowThreshold: 15, highThreshold: 60 });
  assert.equal(output[3], 0);
});

test('bright pixel stays fully opaque', () => {
  const input = Buffer.from([200, 150, 90, 255]);
  const output = punchBlackToAlpha(input, { lowThreshold: 15, highThreshold: 60 });
  assert.equal(output[3], 255);
});

test('mid-luminance pixel gets a partial, feathered alpha', () => {
  const input = Buffer.from([40, 40, 40, 255]); // luminance 40, between 15 and 60
  const output = punchBlackToAlpha(input, { lowThreshold: 15, highThreshold: 60 });
  assert.ok(output[3] > 0 && output[3] < 255);
});

test('leaves RGB channels untouched', () => {
  const input = Buffer.from([10, 20, 30, 255]);
  const output = punchBlackToAlpha(input, { lowThreshold: 15, highThreshold: 60 });
  assert.equal(output[0], 10);
  assert.equal(output[1], 20);
  assert.equal(output[2], 30);
});

test('throws if thresholds are invalid', () => {
  assert.throws(() =>
    punchBlackToAlpha(Buffer.from([0, 0, 0, 255]), { lowThreshold: 60, highThreshold: 15 })
  );
});
