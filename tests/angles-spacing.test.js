// Arbitrary rotation angles, automatic bridge diamonds and the spacing
// optimizer. As everywhere else, the net graph is the source of truth.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildScene, render, validate } from '../src/engine.js';
import { placeMeasurements } from '../src/renderer/index.js';
import { bodyPoly } from '../src/layout/instance.js';
import { segHitsPoly, overlaps } from '../src/utils/geometry.js';

const EX = new URL('../examples/', import.meta.url);
const load = (f) => JSON.parse(fs.readFileSync(new URL(f, EX), 'utf8'));
const examples = fs.readdirSync(EX).filter((f) => f.endsWith('.json')).map((f) => ({ name: f, circuit: load(f) }));
const wires = (scene) => [...scene.routing.nets.values()].flatMap((n) => n.segments);
const touches = (segs, p) => segs.some((s) => (s.x1 === p.x && s.y1 === p.y) || (s.x2 === p.x && s.y2 === p.y));

// ---------------------------------------------------------------- angles
const angled = {
  components: [
    { id: 'IN', type: 'input' },
    { id: 'R1', type: 'resistor', value: '1k', rotation: 30 },
    { id: 'R2', type: 'resistor', value: '2k', rotation: 200 },
    { id: 'C1', type: 'capacitor', value: '1u', angle: 135 },
    { id: 'D1', type: 'diode', rotation: -45 },
    { id: 'OUT', type: 'output' },
    { id: 'GND', type: 'ground' },
  ],
  connections: [['IN', 'R1.1'], ['R1.2', 'R2.1', 'C1.1'], ['R2.2', 'D1.anode'], ['D1.cathode', 'OUT'], ['C1.2', 'GND']],
};

test('any angle: pins land on the grid, just outside their exact lead end', () => {
  const { scene } = buildScene(angled);
  assert.equal(scene.instances.get('D1').rot, 315, 'negative angles normalise');
  assert.equal(scene.instances.get('C1').rot, 135, '"angle" is an alias of "rotation"');
  for (const I of scene.instances.values()) {
    if (I.rot % 90 === 0) continue;
    for (const [name, p] of Object.entries(I.pins)) {
      assert.ok(p.x % 10 === 0 && p.y % 10 === 0, `${I.id}.${name} off grid at ${p.x},${p.y}`);
      assert.ok(p.exits.length >= 1 && p.exits.length <= 2, `${I.id}.${name} exits`);
      if (!p.ext) continue;
      const [exact, tip] = p.ext;
      const d = { x: tip.x - exact.x, y: tip.y - exact.y };
      assert.ok(Math.hypot(d.x, d.y) < 15, `${I.id}.${name} lead extension is short`);
      assert.ok(d.x * p.vec.x + d.y * p.vec.y >= -1e-6, `${I.id}.${name} extension points outward`);
    }
  }
});

test('any angle: every pin gets a wire and no wire crosses a rotated body', () => {
  const { scene } = buildScene(angled);
  assert.deepEqual(scene.routing.failures, []);
  assert.deepEqual(scene.routing.violations, []);
  const segs = wires(scene);
  for (const I of scene.instances.values()) {
    for (const [name, p] of Object.entries(I.pins)) {
      if (I.part.pinNets[name] && !I.part.sym.rail) assert.ok(touches(segs, p) || I.markers.length, `${I.id}.${name} has no wire`);
    }
    const poly = bodyPoly(I, -1.5);
    assert.ok(!segs.some((s) => segHitsPoly(s, poly)), `a wire crosses ${I.id}`);
  }
});

test('angles are validated', () => {
  assert.equal(validate({ components: [{ id: 'R1', type: 'resistor', rotation: 22.5 }] }).errors.length, 0);
  const bad = validate({ components: [{ id: 'R1', type: 'resistor', rotation: 'diagonal' }] });
  assert.ok(bad.errors.some((e) => e.code === 'INVALID_PROPERTY'));
});

// ---------------------------------------------------------------- bridges
test('a bridge rectifier becomes a diamond with the right polarity', () => {
  const { scene } = buildScene(load('27-bridge-rectifier.json'));
  assert.equal(scene.layoutInfo.bridges, 1);
  const pin = (ref) => { const [c, p] = ref.split('.'); return scene.instances.get(c).pins[p]; };
  const same = (a, b) => assert.deepEqual([pin(a).x, pin(a).y], [pin(b).x, pin(b).y], `${a} meets ${b}`);
  // each corner is one point shared by the two diodes on that net
  same('D1.anode', 'D3.cathode');
  same('D2.anode', 'D4.cathode');
  same('D1.cathode', 'D2.cathode');
  same('D3.anode', 'D4.anode');
  for (const id of ['D1', 'D2', 'D3', 'D4']) assert.ok([45, 315].includes(scene.instances.get(id).rot), `${id} is diagonal`);
  // AC on top and bottom, DC+ on the right, DC- on the left
  assert.ok(pin('D1.anode').y < pin('D2.anode').y);
  assert.ok(pin('D1.cathode').x > pin('D3.anode').x);
  assert.equal(scene.routing.junctions.length, 4);
  assert.deepEqual(scene.routing.violations, []);
});

test('a Wheatstone bridge keeps its meter inside the diamond, labels outside', () => {
  const { scene } = buildScene(load('28-wheatstone-bridge.json'));
  assert.equal(scene.layoutInfo.bridges, 1);
  const arms = ['R1', 'R2', 'R3', 'RX'].map((id) => scene.instances.get(id));
  const xs = arms.flatMap((I) => Object.values(I.pins).map((p) => p.x));
  const ys = arms.flatMap((I) => Object.values(I.pins).map((p) => p.y));
  const G = scene.instances.get('G1');
  const gx = G.body.x + G.body.w / 2, gy = G.body.y + G.body.h / 2;
  assert.ok(gx > Math.min(...xs) && gx < Math.max(...xs) && gy > Math.min(...ys) && gy < Math.max(...ys), 'meter between the corners');
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  for (const I of arms) {
    const l = I.labelsFinal[0].box;
    const body = I.body;
    const out = { x: body.x + body.w / 2 - cx, y: body.y + body.h / 2 - cy };
    const lab = { x: l.x + l.w / 2 - cx, y: l.y + l.h / 2 - cy };
    assert.ok(out.x * lab.x + out.y * lab.y > 0, `${I.id} label is on the outside`);
  }
});

test('bridges are only formed from real bridges, and can be turned off', () => {
  assert.equal(buildScene(load('complete-circuit.json')).scene.layoutInfo.bridges, 0, 'no false diamond through the rails');
  const c = load('27-bridge-rectifier.json');
  const { scene } = buildScene({ ...c, layout: { bridges: false } });
  assert.equal(scene.layoutInfo.bridges, 0);
  for (const I of scene.instances.values()) assert.equal(I.rot % 90, 0, `${I.id} stays square`);
  assert.deepEqual(scene.routing.failures, []);
});

// ---------------------------------------------------------------- spacing
test('spacing presets order the sheet from compact to spacious', () => {
  const c = load('08-bjt-amplifier.json');
  const widths = ['compact', 'normal', 'comfortable', 'spacious'].map((spacing) => render({ ...c, layout: { spacing } }).width);
  for (let i = 1; i < widths.length; i++) assert.ok(widths[i] > widths[i - 1], `preset widths ${widths}`);
  assert.ok(validate({ ...c, layout: { spacing: 'huge' } }).errors.some((e) => e.path === 'layout.spacing'));
});

test('the optimizer keeps its best attempt, stops when clean and leaves pinned values alone', () => {
  for (const { name, circuit } of examples) {
    const info = buildScene(circuit).scene.layoutInfo;
    const scores = info.history.map((h) => h.score);
    assert.equal(info.score, Math.min(...scores), `${name}: best attempt kept`);
    if (info.history[0].clean) assert.equal(info.attempts, 1, `${name}: a clean first attempt is final`);
    assert.ok(info.attempts <= 4, `${name}: bounded`);
  }
  const busy = load('26-rgb-seven-segment.json');
  const pinned = buildScene({ ...busy, layout: { wireGap: 16, labelGap: 6 } }).scene.layoutInfo;
  assert.ok(pinned.history.every((h) => h.wireGap === 16 && h.labelGap === 6), 'user values are fixed');
  assert.equal(buildScene({ ...busy, layout: { optimize: false } }).scene.layoutInfo.attempts, 1);
});

test('layout is deterministic', () => {
  for (const f of ['26-rgb-seven-segment.json', '27-bridge-rectifier.json', 'complete-circuit.json']) {
    assert.equal(render(load(f)).svg, render(load(f)).svg, f);
  }
});

test('a follower drives its load downstream', () => {
  // U1.in- shares the output net; R1 still belongs to the right of U1
  const { scene } = buildScene(load('21-adc-input.json'));
  const U1 = scene.instances.get('U1'), R1 = scene.instances.get('R1');
  assert.ok(R1.body.x > U1.body.x + U1.body.w, 'R1 sits after the buffer');
});

test('measurement probes keep their text off parts, labels and wires', () => {
  for (const f of ['07-transistor-switch.json', '11-comparator.json', '17-button-input.json', '21-adc-input.json']) {
    const { scene } = buildScene(load(f));
    for (const p of placeMeasurements(scene)) assert.ok(p.score < 1, `${f}: ${p.label} collides`);
  }
  // two probes never share a spot
  const { scene } = buildScene(load('11-comparator.json'));
  const [a, b] = placeMeasurements(scene);
  assert.ok(!overlaps(a.box, b.box));
});
