import test from 'node:test';
import assert from 'node:assert/strict';
import { ProjectHistory } from '../src/history.js';

test('undo, redo, and branching preserve independent project snapshots', () => {
  const history = new ProjectHistory();
  const first = { model: { width: 80 } };
  history.push(first);
  first.model.width = 999;
  assert.equal(history.current.model.width, 80);
  history.push({ model: { width: 100 } });
  assert.equal(history.peek(-1).model.width, 80);
  history.move(-1);
  assert.equal(history.canRedo, true);
  history.push({ model: { width: 120 } });
  assert.equal(history.canRedo, false);
  assert.equal(history.current.model.width, 120);
  assert.equal(history.peek(-1).model.width, 80);
});

test('bounded history and duplicate updates do not create invalid positions', () => {
  const history = new ProjectHistory(2);
  for (const width of [80, 100, 120, 120]) history.push({ width });
  assert.equal(history.entries.length, 2);
  assert.equal(history.peek(-1).width, 100);
  assert.equal(history.peek(1), null);
  assert.throws(() => history.move(1));
  const snapshot = history.current;
  snapshot.width = 0;
  assert.equal(history.current.width, 120);
});
