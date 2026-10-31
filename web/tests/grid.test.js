import test from 'node:test';
import assert from 'node:assert/strict';
import { gridSpacing } from '../src/drawing/grid.js';

test('grid remains readable across part and building scales without dense subpixel lines', () => {
  assert.equal(gridSpacing(4), 5);
  assert.equal(gridSpacing(0.03), 1000);
  for (const scale of [0.0001, 0.003, 0.0315, 0.2, 1, 4, 100, 10000]) {
    const pixels = gridSpacing(scale) * scale;
    assert.ok(pixels >= 20 - 1e-9 && pixels <= 50 + 1e-9);
  }
  for (const scale of [0, -1, NaN, Infinity]) assert.throws(() => gridSpacing(scale));
});
