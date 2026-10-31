import test from 'node:test';
import assert from 'node:assert/strict';
import { DrawingStore } from '../src/drawing/model.js';
import { CommandEngine } from '../src/drawing/commands.js';
const setup = () => {
  const store = new DrawingStore(),
    log = [];
  return {
    store,
    log,
    engine: new CommandEngine(
      store,
      () => {},
      (text) => log.push(text),
      () => {},
    ),
  };
};
test('a chained LINE command commits atomically and undo removes the command', () => {
  const { store, engine } = setup();
  engine.execute('L 0,0 100,0 @0,50');
  assert.equal(store.document.entities.length, 0);
  engine.execute('');
  assert.equal(store.document.entities.length, 2);
  store.undo();
  assert.equal(store.document.entities.length, 0);
});
test('rectangle and circle commands preserve exact coordinates and reject degenerate geometry', () => {
  const { store, engine } = setup();
  engine.execute('REC 0,0 80,50');
  engine.execute('C 10,10 2.5');
  assert.equal(store.document.entities[0].closed, true);
  assert.equal(store.document.entities[1].radius, 2.5);
  assert.throws(() => engine.execute('REC 0,0 0,50'));
  assert.equal(store.document.entities.length, 2);
});
test('move and copy require selection and use target-minus-base displacement', () => {
  const { store, engine } = setup();
  assert.throws(() => engine.execute('M'));
  engine.execute('C 10,10 5');
  store.select(store.document.entities[0].id);
  engine.execute('CO 10,10 @20,0');
  assert.deepEqual(store.document.entities[1].center, [30, 10]);
  engine.execute('M 0,0 -5,10');
  assert.deepEqual(store.document.entities[0].center, [5, 20]);
});
test('distance is read-only and malformed input preserves the drawing', () => {
  const { store, engine, log } = setup();
  engine.execute('DI 0,0 3,4');
  assert.ok(log.some((line) => line.includes('5.0000 mm')));
  assert.equal(store.document.entities.length, 0);
  assert.throws(() => engine.execute('L 0,0 Infinity,10'));
  assert.equal(store.document.entities.length, 0);
});
test('Gemini review: closed polyline has one entity and command-local undo removes one vertex', () => {
  const { store, engine } = setup();
  engine.execute('PL 0,0 50,0 25,40 10,10');
  engine.execute('U');
  engine.execute('C');
  assert.equal(store.document.entities.length, 1);
  assert.equal(store.document.entities[0].points.length, 3);
  assert.equal(store.document.entities[0].closed, true);
  store.undo();
  assert.equal(store.document.entities.length, 0);
});
test('Gemini review: LINE close is not interpreted as a new CIRCLE command', () => {
  const { store, engine } = setup();
  engine.execute('L 0,0 100,0 100,50');
  engine.execute('C');
  assert.equal(store.document.entities.length, 3);
  assert.deepEqual(store.document.entities[2].points, [
    [100, 50],
    [0, 0],
  ]);
});
test('Gemini review: radius and diameter produce the same circle', () => {
  const { store, engine } = setup();
  engine.execute('C 40,25 15');
  engine.execute('C 40,25 D 30');
  assert.equal(store.document.entities[0].radius, store.document.entities[1].radius);
});
test('second Gemini review: a rejected move target can be corrected without restarting the command', () => {
  const { store, engine } = setup();
  store.add({
    type: 'line',
    points: [
      [999990, 0],
      [999995, 0],
    ],
  });
  store.select(store.document.entities[0].id);
  assert.throws(() => engine.execute('M 0,0 20,0'));
  assert.deepEqual(engine.points, [[0, 0]]);
  engine.execute('5,0');
  assert.deepEqual(store.document.entities[0].points, [
    [999995, 0],
    [1000000, 0],
  ]);
});
test('second Gemini review: failed circle point rolls back when a layer is locked mid-command', () => {
  const { store, engine } = setup();
  engine.execute('C 0,0');
  store.updateLayer('0', { locked: true });
  assert.throws(() => engine.execute('5,0'));
  assert.deepEqual(engine.points, [[0, 0]]);
  store.updateLayer('0', { locked: false });
  engine.execute('10,0');
  assert.equal(store.document.entities[0].radius, 10);
});
test('second Gemini review: CIRCLE accepts polar points, rejects hex and uses the same diameter preview', () => {
  const { store, engine } = setup();
  engine.execute('C 40,25 @15<30');
  assert.ok(Math.abs(store.document.entities[0].radius - 15) < 1e-9);
  assert.throws(() => engine.execute('C 0,0 0x10'));
  engine.cancel();
  engine.execute('C 0,0 D');
  assert.equal(engine.circleRadiusAt([30, 0]), 15);
  engine.execute('30,0');
  assert.equal(store.document.entities[1].radius, 15);
});
test('second Gemini review: Escape completion retains valid segments and always exits a locked command', () => {
  const { store, engine } = setup();
  engine.execute('L 0,0 50,0');
  engine.end();
  assert.equal(store.document.entities.length, 1);
  engine.execute('L 0,0 10,10');
  store.updateLayer('0', { locked: true });
  assert.throws(() => engine.end());
  assert.equal(engine.tool, null);
  assert.deepEqual(engine.points, []);
  assert.equal(store.document.entities.length, 1);
  store.updateLayer('0', { locked: false });
  engine.execute('L 0,0');
  assert.throws(() => engine.execute('C'));
});
