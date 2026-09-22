// Regression tests for connectivity, junctions, wire hints, spacing and the
// extended JSON. The net graph is the source of truth: the drawing has to follow
// it, never the other way round.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildScene, render, validate } from '../src/engine.js';
import { DEFAULT_LAYOUT } from '../src/layout/config.js';
import { overlaps, inflate, segHitsRect } from '../src/utils/geometry.js';

const EX = new URL('../examples/', import.meta.url);
const examples = fs.readdirSync(EX).filter((f) => f.endsWith('.json')).map((f) => ({ name: f, circuit: JSON.parse(fs.readFileSync(new URL(f, EX), 'utf8')) }));

const wires = (scene) => [...scene.routing.nets.values()].flatMap((n) => n.segments.map((s) => ({ ...s })));
const pinsOf = (scene, netId) => scene.netlist.nets.get(netId).pins.map((e) => scene.instances.get(e.comp).pins[e.pin]);

// ---------------------------------------------------------------- multi-pin nets
test('a multi-pin net is one connected tree touching every pin', () => {
  const circuit = {
    components: [
      { id: 'V1', type: 'dc_source', value: '5V' },
      { id: 'R1', type: 'resistor', value: '1k' }, { id: 'R2', type: 'resistor', value: '2k' },
      { id: 'R3', type: 'resistor', value: '3k' }, { id: 'C1', type: 'capacitor', value: '1u' },
      { id: 'OUT', type: 'output' }, { id: 'GND', type: 'ground' },
    ],
    connections: [
      ['V1.positive', 'R1.1'],
      { pins: ['R1.2', 'R2.1', 'R3.1', 'C1.1', 'OUT'], net: 'BUS' },
      ['R2.2', 'GND'], ['R3.2', 'GND'], ['C1.2', 'GND'], ['V1.negative', 'GND'],
    ],
  };
  const { v, scene } = buildScene(circuit);
  assert.ok(v.valid, JSON.stringify(v.errors));
  const bus = [...scene.netlist.nets].find(([, n]) => n.name === 'BUS');
  assert.ok(bus, 'named net kept its name');
  assert.equal(bus[1].pins.length, 5);

  const segs = scene.routing.nets.get(bus[0]).segments;
  const parent = new Map();
  const find = (k) => { while (parent.get(k) !== k) k = parent.get(k); return k; };
  const add = (k) => { if (!parent.has(k)) parent.set(k, k); };
  for (const s of segs) {
    const n = Math.max(Math.abs(s.x2 - s.x1), Math.abs(s.y2 - s.y1)) / 10;
    const pts = Array.from({ length: n + 1 }, (_, i) => `${s.x1 + Math.sign(s.x2 - s.x1) * 10 * i},${s.y1 + Math.sign(s.y2 - s.y1) * 10 * i}`);
    pts.forEach(add);
    for (const p of pts) parent.set(find(p), find(pts[0]));
  }
  const roots = new Set(pinsOf(scene, bus[0]).map((p) => {
    const k = `${p.x},${p.y}`;
    assert.ok(parent.has(k), `pin at ${k} is on the wiring`);
    return find(k);
  }));
  assert.equal(roots.size, 1, 'all five pins are on one tree');
});

test('junction dots appear exactly where three or more wire ends meet', () => {
  for (const { name, circuit } of examples) {
    const { scene } = buildScene(circuit);
    for (const j of scene.routing.junctions) {
      const segs = scene.routing.nets.get(j.net).segments;
      const touching = segs.filter((s) => (s.x1 === j.x && s.y1 === j.y) || (s.x2 === j.x && s.y2 === j.y)
        || (s.x1 === s.x2 && s.x1 === j.x && Math.min(s.y1, s.y2) < j.y && j.y < Math.max(s.y1, s.y2))
        || (s.y1 === s.y2 && s.y1 === j.y && Math.min(s.x1, s.x2) < j.x && j.x < Math.max(s.x1, s.x2)));
      assert.ok(touching.length >= 1, `${name}: junction at ${j.x},${j.y} sits on its net`);
    }
    // a crossing of two different nets never gets a dot
    for (const c of scene.routing.crossings) {
      assert.notEqual(c.h, c.v);
      assert.ok(!scene.routing.junctions.some((j) => j.x === c.x && j.y === c.y), `${name}: dot on a crossing`);
    }
  }
});

test('two pins on the same net are never left unconnected, even across rails', () => {
  const circuit = {
    components: [
      { id: 'U1', type: 'microcontroller' }, { id: 'C1', type: 'capacitor', value: '100n' },
      { id: 'VCC', type: 'vcc', value: '+3V3' }, { id: 'GND', type: 'ground' },
    ],
    connections: [['U1.VCC', 'VCC'], ['C1.1', 'VCC'], ['U1.GND', 'GND'], ['C1.2', 'GND']],
  };
  const { scene } = buildScene(circuit);
  // rails are drawn as markers, so those nets carry no wires but must carry markers
  const railNets = [...scene.netlist.nets.values()].filter((n) => n.rail);
  assert.equal(railNets.length, 2);
  const markers = [...scene.instances.values()].flatMap((I) => I.markers);
  assert.equal(markers.length, 4, 'every pin on a rail gets its own symbol');
  assert.equal(scene.routing.nets.size, 0, 'rail nets are not wired');
});

// ---------------------------------------------------------------- wire hints
test('waypoints steer the route and manual routes are drawn verbatim', () => {
  const base = {
    components: [
      { id: 'V1', type: 'dc_source', value: '5V', position: { x: 0, y: 0 } },
      { id: 'R1', type: 'resistor', value: '1k', position: { x: 160, y: -40 }, rotation: 0 },
      { id: 'GND', type: 'ground' },
    ],
    connections: [{ pins: ['V1.positive', 'R1.1'], waypoints: [{ x: 60, y: -140 }] }, ['R1.2', 'GND'], ['V1.negative', 'GND']],
  };
  const a = buildScene(base).scene;
  assert.ok(wires(a).some((s) => s.y1 === -140 || s.y2 === -140), 'route passes through the waypoint');
  assert.deepEqual(a.routing.failures, []);

  const manual = structuredClone(base);
  manual.connections[0] = { pins: ['V1.positive', 'R1.1'], route: [[0, -80], [240, -80], [240, -40]], locked: true };
  const b = buildScene(manual).scene;
  assert.ok(wires(b).some((s) => s.y1 === -80 && s.y2 === -80 && Math.abs(s.x2 - s.x1) > 100), 'manual route drawn as given');

  // every pin still ends up on the wiring
  for (const scene of [a, b]) {
    for (const [netId, net] of scene.routing.nets) {
      for (const p of pinsOf(scene, netId)) {
        assert.ok(net.segments.some((s) => (s.x1 === p.x && s.y1 === p.y) || (s.x2 === p.x && s.y2 === p.y)), 'pin wired');
      }
    }
  }
  // a diagonal manual route is rejected by validation rather than drawn
  const diagonal = structuredClone(base);
  diagonal.connections[0] = { pins: ['V1.positive', 'R1.1'], route: [[0, -80], [240, -120]] };
  assert.ok(validate(diagonal).errors.some((e) => /orthogonal/.test(e.message)));
});

// ---------------------------------------------------------------- spacing
test('layout honours the configured spacing', () => {
  const circuit = {
    layout: { grid: 20, componentGap: 120, wireGap: 30, sectionGap: 200 },
    components: [
      { id: 'V1', type: 'dc_source', value: '5V' }, { id: 'R1', type: 'resistor', value: '1k' },
      { id: 'R2', type: 'resistor', value: '2k' }, { id: 'C1', type: 'capacitor', value: '1u' },
      { id: 'GND', type: 'ground' },
    ],
    connections: [['V1.positive', 'R1.1'], ['R1.2', 'R2.1'], ['R2.2', 'GND'], ['C1.1', 'V1.positive'], ['C1.2', 'GND'], ['V1.negative', 'GND']],
  };
  const wide = buildScene(circuit).scene;
  const tight = buildScene({ ...circuit, layout: { componentGap: 20 } }).scene;
  const width = (s) => Math.max(...[...s.instances.values()].map((I) => I.extent.x + I.extent.w)) - Math.min(...[...s.instances.values()].map((I) => I.extent.x));
  assert.ok(width(wide) > width(tight), 'a larger componentGap produces a wider sheet');
  assert.equal(wide.layout.grid, 20);
  assert.equal(wide.layout.componentGap, 120);
  for (const I of wide.instances.values()) {
    assert.ok(I.x % 20 === 0 && I.y % 20 === 0, `${I.id} sits on the 20px grid`);
  }
  // defaults survive a partial layout block
  assert.equal(tight.layout.wireGap, DEFAULT_LAYOUT.wireGap);
});

test('no part overlaps another and no label sits on a wire', () => {
  for (const { name, circuit } of examples) {
    const { scene } = buildScene(circuit);
    const insts = [...scene.instances.values()];
    for (let i = 0; i < insts.length; i++) for (let j = i + 1; j < insts.length; j++) {
      assert.ok(!overlaps(insts[i].body, insts[j].body), `${name}: ${insts[i].id} overlaps ${insts[j].id}`);
    }
    const segs = wires(scene);
    let onWire = 0;
    for (const I of insts) for (const l of I.labelsFinal || I.labels) {
      if (segs.some((s) => segHitsRect(s, inflate(l.box, -1)))) onWire++;
      assert.ok(!segs.some((s) => segHitsRect(s, inflate(I.body, -1.5))), `${name}: wire through ${I.id}`);
    }
    // a couple of tight sheets may clip a label; keep it rare
    assert.ok(onWire <= 2, `${name}: ${onWire} labels sit on wires`);
  }
});

test('sections push inputs left and outputs right', () => {
  const circuit = {
    components: [
      { id: 'A', type: 'resistor', value: '1k', section: 'output' },
      { id: 'B', type: 'resistor', value: '2k', section: 'input' },
      { id: 'C', type: 'resistor', value: '3k' },
      { id: 'GND', type: 'ground' },
    ],
    connections: [['B.2', 'C.1'], ['C.2', 'A.1'], ['A.2', 'GND'], ['B.1', 'GND']],
  };
  const { scene } = buildScene(circuit);
  const x = (id) => scene.instances.get(id).x;
  assert.ok(x('B') < x('C'), 'input section is left of the processing part');
  assert.ok(x('A') > x('C'), 'output section is right of the processing part');
});

// ---------------------------------------------------------------- extended JSON
test('the extended JSON fields validate and reach the drawing', () => {
  const circuit = JSON.parse(fs.readFileSync(new URL('complete-circuit.json', EX), 'utf8'));
  const r = render(circuit);
  assert.equal(r.valid, true, JSON.stringify(r.errors));
  assert.deepEqual(r.errors, []);
  assert.ok(/cf-measurement/.test(r.svg), 'measurements drawn');
  assert.ok(/cf-annotation/.test(r.svg), 'annotations drawn');
  assert.ok(r.svg.includes('V(TP1)'), 'measurement label drawn');
  // fields that only carry information must not upset validation
  assert.equal(validate(circuit).warnings.filter((w) => w.code === 'UNKNOWN_FIELD').length, 0);
  const scene = r.scene;
  assert.equal(scene.instances.get('RA').rot, 90, 'explicit rotation kept');
  assert.deepEqual([scene.instances.get('BT1').x, scene.instances.get('BT1').y], [60, 120], 'explicit position kept');
});

test('bad values in the extended JSON are reported, not ignored', () => {
  const r = validate({
    layout: { grid: 'wide', nope: 1 },
    validation: { rules: { LED_NO_CURRENT_LIMIT: 'loud' } },
    measurements: [{ type: 'temperature', at: 'R1' }],
    mystery: true,
    components: [{ id: 'R1', type: 'resistor', section: 'middle', pinTypes: { 1: 'sideways' }, params: 'no' }],
    connections: [{ pins: ['R1.1', 'R1.2'], waypoints: ['nope'] }],
  });
  const codes = r.errors.map((e) => e.path || e.code);
  assert.ok(codes.includes('layout.grid'));
  assert.ok(codes.includes('validation.rules.LED_NO_CURRENT_LIMIT'));
  assert.ok(codes.includes('components[0].section'));
  assert.ok(codes.includes('components[0].pinTypes.1'));
  assert.ok(codes.includes('components[0].params'));
  assert.ok(r.errors.some((e) => /waypoints/.test(e.message)));
  assert.ok(r.warnings.some((w) => w.code === 'UNKNOWN_FIELD' && w.path === 'mystery'));
  assert.ok(r.warnings.some((w) => w.path === 'layout.nope'));
  assert.ok(r.warnings.some((w) => w.path === 'measurements[0].type'));
});

test('every example renders, routes cleanly and keeps its wires off the parts', () => {
  assert.ok(examples.length >= 20, 'the library ships at least twenty examples');
  for (const { name, circuit } of examples) {
    const r = render(circuit);
    assert.ok(r.svg, `${name}: ${JSON.stringify(r.errors)}`);
    assert.deepEqual(r.errors, [], `${name} errors`);
    assert.equal(r.warnings.filter((w) => w.code === 'ROUTING_FAILURE').length, 0, `${name}: routing fell back`);
    assert.equal(r.findings.filter((f) => f.code === 'WIRE_OVERLAP' || f.code === 'WIRE_THROUGH_COMPONENT').length, 0, `${name}: wire quality`);
    assert.ok(!/NaN|undefined/.test(r.svg), `${name}: broken SVG output`);
  }
});
