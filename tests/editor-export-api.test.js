import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildScene, render } from '../src/engine.js';
import { formatJSON, deleteComponent, renameComponent, pinLayout, rotateComponent, clearLayout, addComponent } from '../src/editor/model.js';
import { History } from '../src/editor/history.js';
import { buildPDF } from '../src/exporters/pdf.js';
import { handleRequest } from '../src/api/handler.js';

const bjt = JSON.parse(fs.readFileSync(new URL('../samples/07-bjt-amplifier.json', import.meta.url), 'utf8'));

test('formatJSON round-trips and keeps connections one per line', () => {
  const text = formatJSON(bjt);
  assert.deepEqual(JSON.parse(text), bjt);
  assert.ok(text.includes('\n    ["VIN.positive", "C1.1"],\n'));
});

test('deleteComponent removes the part and every reference to it', () => {
  const c = deleteComponent(bjt, 'C2');
  assert.ok(!c.components.some((x) => x.id === 'C2'));
  assert.ok(!JSON.stringify(c.connections).includes('C2.'));
  assert.ok(render(c).valid);
});

test('renameComponent rewrites connection references', () => {
  const c = renameComponent(bjt, 'Q1', 'Q7');
  assert.ok(JSON.stringify(c.connections).includes('"Q7.B"'));
  assert.ok(!JSON.stringify(c.connections).includes('Q1.'));
  assert.ok(render(c).valid);
});

test('pinLayout freezes positions so the drawing is reproduced exactly', () => {
  const { scene } = buildScene(bjt);
  const pinned = pinLayout(bjt, scene.instances);
  assert.ok(pinned.components.every((x) => x.position && x.rotation !== undefined || ['vcc', 'ground'].includes(x.type)));
  const again = buildScene(pinned).scene;
  for (const [id, I] of scene.instances) {
    const J = again.instances.get(id);
    assert.deepEqual([J.x, J.y, J.rot], [I.x, I.y, I.rot], id);
  }
  const moved = buildScene(pinLayout(bjt, scene.instances, { RL: { x: 900, y: 300 } })).scene;
  assert.deepEqual([moved.instances.get('RL').x, moved.instances.get('RL').y], [900, 300]);
  const rotated = rotateComponent(bjt, scene.instances, 'Q1');
  assert.equal(rotated.components.find((x) => x.id === 'Q1').rotation, 90);
  assert.ok(render(rotated).valid);
  assert.ok(clearLayout(pinned).components.every((x) => !x.position));
});

test('addComponent picks a free designator', () => {
  const { circuit, id } = addComponent(bjt, 'resistor');
  assert.equal(id, 'R3');
  assert.ok(circuit.components.some((x) => x.id === 'R3'));
});

test('history undo/redo', () => {
  const h = new History();
  h.push('a'); h.push('b'); h.push('c');
  assert.equal(h.undo(), 'b');
  assert.equal(h.undo(), 'a');
  assert.equal(h.undo(), null);
  assert.equal(h.redo(), 'b');
  h.push('x');
  assert.equal(h.redo(), null);
});

test('PDF writer produces a structurally valid file', async () => {
  const pw = 4, ph = 3;
  const rgb = new Uint8Array(pw * ph * 3).fill(200);
  const bytes = await buildPDF({ width: 30, height: 22.5, pw, ph, rgb, title: 'Test (1)' });
  const text = Buffer.from(bytes).toString('latin1');
  assert.ok(text.startsWith('%PDF-1.4'));
  assert.ok(text.trimEnd().endsWith('%%EOF'));
  const startxref = Number(/startxref\n(\d+)/.exec(text)[1]);
  assert.ok(text.slice(startxref).startsWith('xref'));
  const offsets = [...text.slice(startxref).matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]));
  assert.equal(offsets.length, 6);
  offsets.forEach((o, i) => assert.ok(text.slice(o).startsWith(`${i + 1} 0 obj`), `object ${i + 1} offset`));
  assert.ok(text.includes('/Width 4 /Height 3'));
});

test('API handler: render, validate, auth and unsupported formats', () => {
  const ok = handleRequest({ method: 'POST', path: '/api/v1/render', body: JSON.stringify({ circuit: bjt, format: 'svg' }) });
  assert.equal(ok.status, 200);
  assert.match(ok.headers['content-type'], /image\/svg\+xml/);
  assert.match(ok.body, /^<svg/);

  const bad = handleRequest({ method: 'POST', path: '/api/v1/validate', body: { circuit: { components: [{ id: 'R1', type: 'resistor' }], connections: [['R1.9', 'R1.1']] } } });
  assert.equal(bad.status, 422);
  const parsed = JSON.parse(bad.body);
  assert.equal(parsed.valid, false);
  assert.equal(parsed.errors[0].code, 'INVALID_PIN');

  assert.equal(handleRequest({ method: 'POST', path: '/api/v1/render', body: { circuit: bjt, format: 'png' } }).status, 501);
  assert.equal(handleRequest({ method: 'GET', path: '/api/v1/render' }).status, 405);
  assert.equal(handleRequest({ method: 'POST', path: '/api/v1/nope', body: {} }).status, 404);
  assert.equal(handleRequest({ method: 'POST', path: '/api/v1/render', body: { circuit: bjt } }, { apiKeys: ['k'] }).status, 401);
  assert.equal(handleRequest({ method: 'POST', path: '/api/v1/render', headers: { authorization: 'Bearer k' }, body: { circuit: bjt } }, { apiKeys: ['k'] }).status, 200);
  assert.equal(handleRequest({ method: 'POST', path: '/api/v1/render', body: '{oops' }).status, 400);
});
