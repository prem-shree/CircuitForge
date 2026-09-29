import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildScene, render, validate } from '../src/engine.js';
import {
  moveComponents, rotateComponents, mirrorComponents, deleteComponents, extractSubcircuit, pasteSubcircuit, duplicateComponents,
  connectPins, disconnectPin, addComponent, freeId, pinLayout, updateComponent, deleteComponent, renameComponent,
} from '../src/editor/model.js';
import { History } from '../src/editor/history.js';
import { LRU, hashText } from '../src/editor/cache.js';
import { selectionBounds, partsInRect, rectFrom, applyClick, cycleSelection, describeIds, pruneSelection, centerOf } from '../src/editor/selection.js';
import { loadExamples, clone, minimal } from './helpers.js';

const ex = loadExamples();
const bjt = ex['08-bjt-amplifier.json'];
const scene = (c) => buildScene(c).scene;
const pos = (c, id) => c.components.find((x) => x.id === id).position;
const comp = (c, id) => c.components.find((x) => x.id === id);

test('moveComponents shifts every selected part by the same amount and pins the rest', () => {
  const s = scene(bjt);
  const moved = moveComponents(bjt, s.instances, ['R1', 'Q1'], 40, -20);
  for (const id of ['R1', 'Q1']) {
    const I = s.instances.get(id);
    assert.deepEqual(pos(moved, id), { x: I.x + 40, y: I.y - 20 }, id);
  }
  // the unselected parts are frozen where they were
  const still = s.instances.get('RL');
  assert.deepEqual(pos(moved, 'RL'), { x: still.x, y: still.y });
  assert.ok(render(moved).valid);
  assert.deepEqual(bjt.components.filter((x) => x.position), [], 'input is not mutated');
  // unknown ids are ignored
  assert.doesNotThrow(() => moveComponents(bjt, s.instances, ['NOPE'], 10, 10));
});

test('rotating one part turns it about its own pin; rotating a group keeps its shape', () => {
  const s = scene(bjt);
  const one = rotateComponents(bjt, s.instances, ['Q1'], 90);
  assert.equal(comp(one, 'Q1').rotation, 90);
  assert.deepEqual(pos(one, 'Q1'), { x: s.instances.get('Q1').x, y: s.instances.get('Q1').y });

  const ids = ['R1', 'R2', 'Q1'];
  const group = rotateComponents(bjt, s.instances, ids, 90);
  const mean = (key) => ids.reduce((sum, id) => sum + s.instances.get(id)[key], 0) / ids.length;
  const cx = Math.round(mean('x') / 10) * 10, cy = Math.round(mean('y') / 10) * 10;
  for (const id of ids) {
    const I = s.instances.get(id);
    assert.equal(comp(group, id).rotation, (I.rot + 90) % 360, `${id} turns`);
    // clockwise quarter turn about the centroid: (dx, dy) -> (-dy, dx)
    assert.deepEqual(pos(group, id), { x: cx - (I.y - cy), y: cy + (I.x - cx) }, `${id} moves round the centre`);
    assert.ok(pos(group, id).x % 10 === 0 && pos(group, id).y % 10 === 0, `${id} stays on the grid`);
  }
  // four quarter turns come back to the start
  let c = bjt, sc = s;
  for (let i = 0; i < 4; i++) { c = rotateComponents(c, sc.instances, ids, 90); sc = scene(c); }
  for (const id of ids) assert.deepEqual(pos(c, id), pos(pinLayout(bjt, s.instances), id), `${id} back home`);
  assert.ok(render(group).valid);
  // 45 degrees still produces a drawable circuit
  assert.ok(render(rotateComponents(bjt, s.instances, ids, 45)).valid);
  assert.deepEqual(rotateComponents(bjt, s.instances, [], 90), bjt);
});

test('mirrorComponents flips each selected part in place', () => {
  const s = scene(bjt);
  const flipped = mirrorComponents(bjt, s.instances, ['Q1', 'R1']);
  assert.equal(comp(flipped, 'Q1').mirror, true);
  assert.equal(comp(flipped, 'R1').mirror, true);
  assert.equal(comp(flipped, 'R2').mirror, undefined);
  const back = mirrorComponents(flipped, scene(flipped).instances, ['Q1']);
  assert.equal(comp(back, 'Q1').mirror, undefined);
  assert.ok(render(flipped).valid);
});

test('deleteComponents removes every part and every reference', () => {
  const c = deleteComponents(bjt, ['R1', 'C1']);
  assert.ok(!c.components.some((x) => ['R1', 'C1'].includes(x.id)));
  assert.ok(!/"(R1|C1)\./.test(JSON.stringify(c.connections)));
  assert.ok(render(c).valid);
  assert.deepEqual(deleteComponents(bjt, []), bjt);
});

test('extract and paste move a sub-circuit between documents, renaming clashes', () => {
  const snippet = extractSubcircuit(bjt, null, ['R1', 'R2']);
  assert.equal(snippet.components.length, 2);
  // only connections wholly inside the selection come along
  for (const conn of snippet.connections) for (const ref of conn.pins || conn) assert.ok(/^(R1|R2)\./.test(ref), ref);
  // into an empty document: ids are kept
  const empty = pasteSubcircuit({ components: [], connections: [] }, snippet, { x: 0, y: 0 });
  assert.deepEqual(empty.ids, ['R1', 'R2']);
  // into the same document: new designators, connections follow
  const twice = pasteSubcircuit(bjt, snippet);
  assert.equal(twice.ids.length, 2);
  assert.ok(twice.ids.every((id) => !bjt.components.some((x) => x.id === id)), 'fresh ids');
  const ids = new Set(twice.circuit.components.map((x) => x.id));
  assert.equal(ids.size, twice.circuit.components.length, 'no duplicate ids');
  assert.equal(validate(twice.circuit).errors.length, 0);
  // a snippet from elsewhere with junk in it cannot break the document
  assert.doesNotThrow(() => pasteSubcircuit(bjt, { components: [null, 5, { id: 7 }], connections: [null, 'x'] }));
  assert.doesNotThrow(() => pasteSubcircuit(bjt, null));
});

test('duplicateComponents copies parts and their internal wiring beside the originals', () => {
  const s = scene(bjt);
  const { circuit, ids } = duplicateComponents(bjt, s.instances, ['R1', 'R2'], { x: 60, y: 0 });
  assert.equal(ids.length, 2);
  for (const [i, from] of ['R1', 'R2'].entries()) {
    const a = s.instances.get(from), b = pos(circuit, ids[i]);
    assert.deepEqual(b, { x: Math.round((a.x + 60) / 10) * 10, y: Math.round(a.y / 10) * 10 }, 'offset from the original');
    assert.equal(comp(circuit, ids[i]).type, comp(bjt, from).type);
    assert.equal(comp(circuit, ids[i]).value, comp(bjt, from).value);
  }
  assert.equal(validate(circuit).errors.length, 0);
  // R1 and R2 share a net in this amplifier, so their connection is copied too
  const before = bjt.connections.length;
  const linked = circuit.connections.slice(before);
  assert.ok(linked.every((conn) => (conn.pins || conn).every((r) => ids.includes(r.split('.')[0]))), 'copied wiring stays inside the copies');
});

test('connectPins extends an existing connection, or adds a pair', () => {
  const c = minimal();
  c.components.push({ id: 'R2', type: 'resistor' }, { id: 'R3', type: 'resistor' });
  // R1.2 is already wired to V1.negative: R2.1 joins that connection
  const a = connectPins(c, 'R2.1', 'R1.2');
  assert.deepEqual(a.connections[1], ['R1.2', 'V1.negative', 'R2.1']);
  assert.equal(a.connections.length, c.connections.length, 'no new list');
  // neither pin is wired yet: a new pair
  const b = connectPins(c, 'R2.2', 'R3.1');
  assert.deepEqual(b.connections.at(-1), ['R2.2', 'R3.1']);
  // both already together, or the same pin: nothing changes
  assert.deepEqual(connectPins(c, 'R1.2', 'V1.negative'), c);
  assert.deepEqual(connectPins(c, 'R1.1', 'R1.1'), c);
  // the {pins, net} and {from, to} forms are extended, not replaced
  const named = { ...c, connections: [{ pins: ['V1.positive', 'R1.1'], net: 'VIN' }, { from: 'R1.2', to: 'V1.negative' }] };
  assert.deepEqual(connectPins(named, 'R2.1', 'V1.positive').connections[0], { pins: ['V1.positive', 'R1.1', 'R2.1'], net: 'VIN' });
  const grown = connectPins(named, 'R2.1', 'R1.2').connections[1];
  assert.deepEqual(grown.pins, ['R1.2', 'V1.negative', 'R2.1']);
  assert.equal(validate(connectPins(named, 'R2.1', 'R1.2')).errors.length, 0);
});

test('connectPins and disconnectPin understand pin aliases', () => {
  const c = { components: [{ id: 'D1', type: 'led' }, { id: 'R1', type: 'resistor' }], connections: [['D1.A', 'R1.1']] };
  assert.deepEqual(connectPins(c, 'D1.anode', 'R1.1'), c, 'D1.A is D1.anode');
  assert.deepEqual(disconnectPin(c, 'D1.anode').connections, [], 'removed by canonical name');
});

test('disconnectPin removes a pin and drops connections that would have one pin left', () => {
  const c = { ...minimal(), connections: [['V1.positive', 'R1.1', 'R1.2'], ['R1.2', 'V1.negative'], { from: 'V1.negative', to: 'R1.1' }] };
  const out = disconnectPin(c, 'R1.2');
  assert.deepEqual(out.connections, [['V1.positive', 'R1.1'], { from: 'V1.negative', to: 'R1.1' }]);
  assert.deepEqual(disconnectPin(c, 'R9.9').connections, c.connections, 'unknown pin: unchanged');
  assert.doesNotThrow(() => disconnectPin({ components: [], connections: 'x' }, 'A.1'));
});

test('addComponent can drop a part where the user is looking', () => {
  const s = scene(bjt);
  const { circuit, id } = addComponent(bjt, 'resistor', { at: { x: 333, y: 187 }, instances: s.instances });
  assert.equal(id, 'R3');
  assert.deepEqual(pos(circuit, id), { x: 330, y: 190 });
  assert.ok(circuit.components.filter((x) => x.position).length > 2, 'the layout was frozen so nothing jumps');
  assert.equal(addComponent({ components: [] }, 'ground').id, 'GND', 'first ground is plain GND');
  assert.equal(addComponent({ components: [{ id: 'GND', type: 'ground' }] }, 'ground').id, 'GND1', 'then GND1, GND2, …');
  assert.equal(freeId(new Set(['R1', 'R2', 'R4']), 'R1'), 'R3');
  assert.equal(freeId(new Set(['GND']), 'GND'), 'GND2');
  assert.equal(freeId(new Set(), 'U0'), 'U1');
});

test('editing helpers survive documents that are not valid', () => {
  for (const bad of [{}, { components: 5 }, { components: [null] }, { components: [{ id: 'R1' }], connections: 'x' }]) {
    assert.doesNotThrow(() => {
      deleteComponent(bad, 'R1'); renameComponent(bad, 'R1', 'R2'); updateComponent(bad, 'R1', { value: '1' });
      duplicateComponents(bad, new Map(), ['R1']); connectPins(bad, 'R1.1', 'R1.2'); disconnectPin(bad, 'R1.1');
      mirrorComponents(bad, new Map(), ['R1']); rotateComponents(bad, new Map(), ['R1']); moveComponents(bad, new Map(), ['R1'], 1, 1);
    }, JSON.stringify(bad));
  }
});

// ---- selection geometry

test('selection geometry: bounds, marquee, click modifiers, cycling', () => {
  const s = scene(bjt);
  const all = [...s.instances.keys()];
  const box = selectionBounds(s.instances, all);
  for (const I of s.instances.values()) {
    assert.ok(I.body.x >= box.x - 0.01 && I.body.x + I.body.w <= box.x + box.w + 0.01);
  }
  assert.equal(selectionBounds(s.instances, []), null);
  assert.deepEqual(partsInRect(s.instances, { x: box.x - 5, y: box.y - 5, w: box.w + 10, h: box.h + 10 }).sort(), all.sort(), 'a marquee around everything selects everything');
  assert.deepEqual(partsInRect(s.instances, { x: -9999, y: -9999, w: 5, h: 5 }), []);
  const q1 = s.instances.get('Q1');
  assert.deepEqual(partsInRect(s.instances, q1.body, { contain: true }), ['Q1'], 'contain mode');
  assert.ok(partsInRect(s.instances, { x: q1.body.x + 1, y: q1.body.y + 1, w: 1, h: 1 }).includes('Q1'), 'touching is enough by default');
  assert.deepEqual(rectFrom({ x: 10, y: 50 }, { x: 4, y: 20 }), { x: 4, y: 20, w: 6, h: 30 });

  const a = applyClick(new Set(['R1']), 'R2', { additive: true });
  assert.deepEqual([...a].sort(), ['R1', 'R2']);
  assert.deepEqual([...applyClick(a, 'R1', { additive: true })], ['R2'], 'toggles off');
  assert.deepEqual([...applyClick(a, 'Q1')], ['Q1'], 'plain click replaces');
  assert.deepEqual([...applyClick(a, null)], [], 'click on empty space clears');
  assert.deepEqual([...applyClick(a, null, { additive: true })].sort(), ['R1', 'R2'], 'shift-click on empty space keeps it');

  const seen = new Set();
  let cur = null;
  for (let i = 0; i < all.length; i++) { cur = cycleSelection(s.instances, cur, 1); seen.add(cur); }
  assert.equal(seen.size, all.length, 'Tab visits every part once');
  assert.equal(cycleSelection(s.instances, cur, 1), [...seen][0], 'and wraps');
  assert.equal(cycleSelection(new Map(), null), null);
  assert.deepEqual(pruneSelection(['R1', 'GONE'], s.instances), ['R1']);
  assert.equal(describeIds(['R1']), 'R1');
  assert.equal(describeIds(['R1', 'R2', 'C1']), '3 parts');
});

// ---- history

test('history: labels, coalescing, selection and the redo branch', () => {
  let t = 0;
  const h = new History(200, { now: () => t });
  h.push('doc0', { label: 'Open', selection: [] });
  t = 1000; h.push('doc1', { label: 'Move R1', key: 'move:R1', selection: ['R1'] });
  assert.equal(h.undoLabel, 'Move R1');
  // the same edit again, moments later, merges into the same step
  t = 1200; h.push('doc2', { label: 'Move R1', key: 'move:R1', selection: ['R1'] });
  t = 1400; h.push('doc3', { label: 'Move R1', key: 'move:R1', selection: ['R1'] });
  assert.equal(h.size, 2, 'three nudges are one undo step');
  assert.equal(h.undo(), 'doc0');
  assert.equal(h.entry.text, 'doc0');
  assert.equal(h.redoLabel, 'Move R1');
  assert.equal(h.redo(), 'doc3');
  assert.deepEqual(h.entry.selection, ['R1']);
  // a different key, or a pause, starts a new step
  t = 1500; h.push('doc4', { label: 'Rotate R1', key: 'rotate:R1' });
  t = 9000; h.push('doc5', { label: 'Rotate R1', key: 'rotate:R1' });
  assert.equal(h.size, 4);
  // editing after an undo discards the redo branch
  h.undo();
  h.push('branch', { label: 'Delete R2' });
  assert.equal(h.canRedo, false);
  assert.equal(h.redoLabel, null);
  // the opening state is never merged into
  const g = new History(200, { now: () => 0 });
  g.push('a', { key: 'k' }); g.push('b', { key: 'k' });
  assert.equal(g.undo(), 'a');
  // identical text is not a step
  assert.equal(g.push('a'), false);
});

test('history stays within its step and size limits', () => {
  const h = new History(5);
  for (let i = 0; i < 20; i++) h.push(`state ${i}`);
  assert.equal(h.size, 5);
  assert.equal(h.entry.text, 'state 19');
  let steps = 0;
  while (h.undo() !== null) steps++;
  assert.equal(steps, 4);
  const big = new History(1000, { maxChars: 100 });
  for (let i = 0; i < 10; i++) big.push(String(i).repeat(30));
  assert.ok(big.chars <= 100 + 30, `bounded by size (${big.chars})`);
  assert.equal(big.entry.text, '9'.repeat(30), 'the current state is never dropped');
  big.reset('fresh');
  assert.equal(big.size, 1);
  assert.equal(big.canUndo, false);
});

test('LRU cache evicts the least recently used entry', () => {
  const c = new LRU(2);
  c.set('a', 1); c.set('b', 2);
  c.get('a');
  c.set('c', 3);
  assert.equal(c.has('b'), false);
  assert.equal(c.get('a'), 1);
  assert.equal(c.size, 2);
  c.clear();
  assert.equal(c.size, 0);
  assert.notEqual(hashText('abc'), hashText('abd'));
  assert.equal(hashText('abc'), hashText('abc'));
  assert.notEqual(hashText(''), hashText(' '));
});
