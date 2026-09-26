import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { render, validate, buildScene, listTypes } from '../src/engine.js';
import { parseJSON } from '../src/parser/index.js';
import { resolveSymbol, canonicalType } from '../src/symbol-loader/index.js';
import { makeInstance } from '../src/layout/instance.js';
import { overlaps, inflate, segHitsRect } from '../src/utils/geometry.js';

const SAMPLE_DIR = new URL('../examples/', import.meta.url);
const samples = fs.readdirSync(SAMPLE_DIR).filter((f) => f.endsWith('.json'))
  .map((f) => ({ name: f, circuit: JSON.parse(fs.readFileSync(new URL(f, SAMPLE_DIR), 'utf8')) }));

const codes = (r) => r.errors.map((e) => e.code);
const example = (needle) => samples.find((s) => s.name.includes(needle)).circuit;

// ---------------------------------------------------------------- parsing
test('JSON parsing reports line and column of syntax errors', () => {
  assert.deepEqual(parseJSON('{"a": 1}').value, { a: 1 });
  const e = parseJSON('{\n  "a": 1,\n  "b": [1,,2]\n}').errors[0];
  assert.equal(e.code, 'INVALID_JSON');
  assert.equal(e.line, 3);
  assert.equal(e.column, 11);
  assert.equal(parseJSON('{\n "a": 1,\n}').errors[0].line, 3); // trailing comma
});

test('render accepts JSON text, objects and {circuit} envelopes', () => {
  const c = example('voltage-divider');
  assert.ok(render(JSON.stringify(c)).valid);
  assert.ok(render(c).valid);
  assert.ok(render({ circuit: c }).valid);
});

// ---------------------------------------------------------------- validation
test('validation: invalid JSON', () => {
  const r = validate('{ nope');
  assert.equal(r.valid, false);
  assert.deepEqual(codes(r), ['INVALID_JSON']);
});

test('validation: invalid pin uses the documented message', () => {
  const r = validate({ components: [{ id: 'R1', type: 'resistor' }, { id: 'R2', type: 'resistor' }], connections: [['R1.99', 'R2.1']] });
  assert.equal(r.valid, false);
  const e = r.errors[0];
  assert.equal(e.code, 'INVALID_PIN');
  assert.equal(e.component, 'R1');
  assert.equal(e.pin, '99');
  assert.match(e.message, /^Pin 99 does not exist on resistor R1\./);
});

test('validation: every error class is detected', () => {
  const r = validate({
    components: [
      { id: 'R1', type: 'resistor' }, { id: 'R1', type: 'resistor' },
      { id: 'X1', type: 'resistr' }, { id: 'M1', type: 'raspberry_pi' }, { type: 'capacitor' },
      { id: 'C1', type: 'capacitor' }, { id: 'Q1', type: 'npn' },
    ],
    connections: [['R1.1', 'Z9.1'], ['R1.1'], ['R1.1', 'R1.1'], ['C1', 'R1.2'], 'bad', ['R1.2', 'C1.1'], ['C1.1', 'R1.2'], ['Q1.B', 'C1.2']],
  });
  for (const c of ['DUPLICATE_ID', 'UNKNOWN_TYPE', 'UNSUPPORTED_COMPONENT', 'MISSING_ID', 'MISSING_COMPONENT', 'INVALID_CONNECTION', 'INVALID_PIN']) {
    assert.ok(codes(r).includes(c), `expected ${c} in ${codes(r)}`);
  }
  const warn = r.warnings.map((w) => w.code);
  assert.ok(warn.includes('DUPLICATE_CONNECTION'));
  assert.ok(warn.includes('MISSING_REQUIRED_PIN'));
  assert.match(r.errors.find((e) => e.code === 'UNKNOWN_TYPE').message, /Did you mean "resistor"/);
});

test('validation: schema errors', () => {
  assert.deepEqual(codes(validate([])), ['INVALID_SCHEMA']);
  assert.deepEqual(codes(validate({ components: 3 })), ['INVALID_SCHEMA']);
  assert.ok(codes(validate({ components: [{ id: 'R1', type: 'resistor', rotation: 'sideways' }] })).includes('INVALID_PROPERTY'));
  assert.ok(codes(validate({ components: [{ id: 'R1', type: 'resistor', rotation: 90, angle: 45 }] })).includes('INVALID_PROPERTY'));
  assert.deepEqual(codes(validate({ components: [{ id: 'R1', type: 'resistor', rotation: 45 }, { id: 'R2', type: 'resistor', angle: -30 }], connections: [['R1.2', 'R2.1']] })), []);
});

test('validation: pin aliases and type aliases resolve', () => {
  const r = validate({ components: [{ id: 'V1', type: 'DC Supply' }, { id: 'D1', type: 'led' }, { id: 'U1', type: '555' }], connections: [['V1.+', 'D1.A'], ['D1.k', 'U1.8'], ['V1.-', 'U1.gnd']] });
  assert.equal(r.valid, true, JSON.stringify(r.errors));
});

// ---------------------------------------------------------------- symbols
test('symbol library covers the required component set', () => {
  const need = ['resistor', 'variable_resistor', 'potentiometer', 'capacitor', 'capacitor_polarized', 'inductor', 'transformer',
    'diode', 'led', 'zener', 'photodiode', 'schottky', 'npn', 'pnp', 'nmos', 'pmos', 'jfet',
    'opamp', 'comparator', 'dc_source', 'current_source', 'voltage_regulator',
    'and', 'or', 'not', 'nand', 'nor', 'xor', 'xnor', 'buffer', 'tristate_buffer', 'd_flipflop', 'jk_flipflop', 't_flipflop', 'sr_flipflop',
    'mux', 'demux', 'encoder', 'decoder', 'counter', 'register', 'generic_ic', 'timer_555', 'microcontroller', 'memory', 'adc', 'dac',
    'battery', 'ac_source', 'ground', 'vcc', 'vdd', 'vss', 'input', 'output', 'connector', 'test_point', 'net_label', 'junction'];
  for (const t of need) assert.ok(canonicalType(t), `missing ${t}`);
  assert.equal(canonicalType('dc_supply'), 'dc_source');
  assert.equal(canonicalType('power_rail'), 'vcc');
  assert.ok(listTypes().length >= need.length);
});

test('component anchors: all pins sit on the 10px grid relative to the origin', () => {
  for (const { type } of listTypes()) {
    const s = resolveSymbol({ type });
    for (const [name, p] of Object.entries(s.pins)) {
      assert.ok((p.x - s.origin.x) % 10 === 0, `${type}.${name} x`);
      assert.ok((p.y - s.origin.y) % 10 === 0, `${type}.${name} y`);
      assert.ok(['left', 'right', 'up', 'down'].includes(p.dir), `${type}.${name} dir`);
    }
  }
});

test('component anchors transform with rotation and mirroring', () => {
  const part = { id: 'R1', comp: { id: 'R1' }, sym: resolveSymbol({ type: 'resistor' }), pinNets: {} };
  const pick = (p) => ({ x: p.x, y: p.y, dir: p.dir });
  const inst = (...args) => { const I = makeInstance(...args); return { pins: Object.fromEntries(Object.entries(I.pins).map(([k, v]) => [k, pick(v)])) }; };
  const a = inst(part, 100, 50, 0, false);
  assert.deepEqual([a.pins['1'], a.pins['2']], [{ x: 100, y: 50, dir: 'left' }, { x: 160, y: 50, dir: 'right' }]);
  const b = inst(part, 100, 50, 90, false);
  assert.deepEqual([b.pins['1'], b.pins['2']], [{ x: 100, y: 50, dir: 'up' }, { x: 100, y: 110, dir: 'down' }]);
  const c = inst(part, 100, 50, 0, true);
  assert.deepEqual(c.pins['2'], { x: 40, y: 50, dir: 'left' });
});

test('box ICs accept custom pin lists', () => {
  const s = resolveSymbol({ type: 'generic_ic', pins: { left: ['A', 'B'], right: ['Y'], top: ['VCC'], bottom: ['GND'] } });
  assert.deepEqual(s.pinOrder.sort(), ['A', 'B', 'GND', 'VCC', 'Y']);
  assert.equal(s.pins.VCC.dir, 'up');
  assert.equal(resolveSymbol({ type: 'connector', pins: 6 }).pinOrder.length, 6);
});

// ---------------------------------------------------------------- layout + routing on every sample
function pointsOf(seg) {
  const pts = [];
  const n = Math.max(Math.abs(seg.x2 - seg.x1), Math.abs(seg.y2 - seg.y1)) / 10;
  for (let i = 0; i <= n; i++) pts.push(`${seg.x1 + Math.sign(seg.x2 - seg.x1) * 10 * i},${seg.y1 + Math.sign(seg.y2 - seg.y1) * 10 * i}`);
  return pts;
}

for (const { name, circuit } of samples) {
  test(`sample ${name}: layout, routing and SVG`, () => {
    const { v, scene } = buildScene(circuit);
    assert.ok(v.valid, JSON.stringify(v.errors));
    assert.deepEqual(v.warnings.filter((w) => w.code === 'ROUTING_FAILURE'), [], 'no routing failures');
    const insts = [...scene.instances.values()];

    // Layout: grid-aligned pins, no overlapping bodies.
    for (const I of insts) for (const [pn, p] of Object.entries(I.pins)) {
      assert.ok(p.x % 10 === 0, `${I.id}.${pn} x on grid`);
      assert.ok(p.y % 10 === 0, `${I.id}.${pn} y on grid`);
    }
    for (let i = 0; i < insts.length; i++) for (let j = i + 1; j < insts.length; j++) {
      assert.ok(!overlaps(insts[i].body, insts[j].body), `${insts[i].id} overlaps ${insts[j].id}`);
    }

    // Routing: each net is one connected tree touching all its pins.
    for (const [netId, net] of scene.routing.nets) {
      const parent = new Map();
      const find = (k) => { while (parent.get(k) !== k) k = parent.get(k); return k; };
      const add = (k) => { if (!parent.has(k)) parent.set(k, k); };
      for (const s of net.segments) {
        const pts = pointsOf(s);
        pts.forEach(add);
        for (let i = 1; i < pts.length; i++) parent.set(find(pts[i]), find(pts[0]));
      }
      const pins = scene.netlist.nets.get(netId).pins.map((e) => scene.instances.get(e.comp).pins[e.pin]);
      const roots = new Set(pins.map((p) => { const k = `${p.x},${p.y}`; assert.ok(parent.has(k), `${netId}: pin ${k} not reached`); return find(k); }));
      assert.equal(roots.size, 1, `${netId} is connected`);
      // Wires stay orthogonal and never cut through a component body.
      for (const s of net.segments) {
        assert.ok(s.x1 === s.x2 || s.y1 === s.y2, 'orthogonal');
        for (const I of insts) assert.ok(!segHitsRect(s, inflate(I.body, -1.5)), `${netId} crosses body of ${I.id}`);
      }
    }
    // Different nets never share a collinear stretch of wire.
    const all = [...scene.routing.nets.values()].flatMap((n) => n.segments.map((s) => ({ ...s, net: n.id })));
    for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
      const a = all[i], b = all[j];
      if (a.net === b.net) continue;
      if (a.y1 === a.y2 && b.y1 === b.y2 && a.y1 === b.y1) {
        const lo = Math.max(Math.min(a.x1, a.x2), Math.min(b.x1, b.x2)), hi = Math.min(Math.max(a.x1, a.x2), Math.max(b.x1, b.x2));
        assert.ok(hi <= lo, `${a.net}/${b.net} overlap horizontally at y=${a.y1}`);
      }
      if (a.x1 === a.x2 && b.x1 === b.x2 && a.x1 === b.x1) {
        const lo = Math.max(Math.min(a.y1, a.y2), Math.min(b.y1, b.y2)), hi = Math.min(Math.max(a.y1, a.y2), Math.max(b.y1, b.y2));
        assert.ok(hi <= lo, `${a.net}/${b.net} overlap vertically at x=${a.x1}`);
      }
    }

    // SVG output: complete, deterministic, contains every part.
    const r1 = render(circuit), r2 = render(circuit);
    assert.equal(r1.svg, r2.svg, 'deterministic');
    assert.match(r1.svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    assert.match(r1.svg, /<\/svg>$/);
    assert.equal((r1.svg.match(/<g\b/g) || []).length, (r1.svg.match(/<\/g>/g) || []).length, 'balanced <g>');
    for (const I of insts) assert.ok(r1.svg.includes(`data-id="${I.id}"`), `svg has ${I.id}`);
    assert.ok(!/NaN|undefined/.test(r1.svg), 'no NaN/undefined in SVG');
  });
}

// ---------------------------------------------------------------- junctions and crossings
test('junctions: dots only where three or more wires/pins meet', () => {
  const vd = buildScene(example('voltage-divider')).scene;
  assert.equal(vd.routing.junctions.length, 0, 'a simple loop has no junctions');
  const rc = buildScene(example('rc-lowpass')).scene;
  assert.ok(rc.routing.junctions.length >= 1, 'R1/C1/VOUT node has a junction');
  const outNet = rc.netlist.nets.get(rc.instances.get('C1').part.pinNets['1']);
  assert.ok(rc.routing.junctions.every((j) => j.net === outNet.id));
});

test('crossings: unconnected crossings get no dot, and bridges are drawn on request', () => {
  const circuit = example('full-adder');
  const { scene } = buildScene(circuit);
  const { crossings, junctions } = scene.routing;
  assert.ok(crossings.length > 0, 'the full adder has wire crossings');
  for (const c of crossings) {
    assert.notEqual(c.h, c.v);
    assert.ok(!junctions.some((j) => j.x === c.x && j.y === c.y), 'no dot on a crossing');
  }
  assert.ok(!/a4\.5 4\.5/.test(render(circuit).svg));
  assert.ok(/a4\.5 4\.5/.test(render(circuit, { bridges: true }).svg), 'bridge arcs rendered');
});

test('rails: ground/VCC become per-pin markers and net labels merge nets', () => {
  const r = buildScene({
    components: [{ id: 'R1', type: 'resistor' }, { id: 'R2', type: 'resistor' }, { id: 'L1', type: 'net_label', value: 'SIG' }, { id: 'L2', type: 'net_label', value: 'SIG' }, { id: 'G', type: 'ground' }],
    connections: [['R1.2', 'L1'], ['R2.1', 'L2'], ['R1.1', 'G'], ['R2.2', 'G']],
  }).scene;
  const nets = [...r.netlist.nets.values()];
  assert.equal(nets.length, 2, 'SIG and GND');
  assert.ok(nets.every((n) => n.rail));
  assert.equal(r.routing.nets.size, 0, 'rail nets are not wired');
  const markers = [...r.instances.values()].flatMap((I) => I.markers);
  assert.equal(markers.length, 4);
});

test('explicit positions are respected and wires re-route', () => {
  const c = structuredClone(example('voltage-divider'));
  c.components.find((x) => x.id === 'R2').position = { x: 400, y: 200 };
  c.components.find((x) => x.id === 'R2').rotation = 90;
  const { scene } = buildScene(c);
  const R2 = scene.instances.get('R2');
  assert.deepEqual([R2.x, R2.y, R2.rot], [400, 200, 90]);
  const seg = [...scene.routing.nets.values()].flatMap((n) => n.segments);
  assert.ok(seg.some((s) => s.x1 === 400 || s.x2 === 400), 'a wire reaches the moved part');
});
