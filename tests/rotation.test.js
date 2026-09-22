// Rotation is load-bearing: the drawing, the pin coordinates, the labels, the
// bounding box used for collision, and the wires must all agree. These tests run
// every component through all four rotations and both mirror states.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { render, buildScene, listTypes } from '../src/engine.js';
import { resolveSymbol } from '../src/symbol-loader/index.js';
import { makeInstance } from '../src/layout/instance.js';
import { rotateVec, segHitsRect, inflate, overlaps } from '../src/utils/geometry.js';

const ROTATIONS = [0, 90, 180, 270];
const TYPES = listTypes().map((t) => t.type).filter((t) => !['junction', 'net_label'].includes(t));
const part = (type, comp = {}) => ({ id: 'X1', comp: { id: 'X1', type, ...comp }, sym: resolveSymbol({ type, ...comp }), pinNets: {} });

const DIR_VEC = { left: { x: -1, y: 0 }, right: { x: 1, y: 0 }, up: { x: 0, y: -1 }, down: { x: 0, y: 1 } };
const vecDir = (v) => Object.entries(DIR_VEC).find(([, d]) => d.x === v.x && d.y === v.y)?.[0];

test('every component rotates its pin geometry with its drawing', () => {
  for (const type of TYPES) {
    const p = part(type);
    const s = p.sym;
    for (const rot of ROTATIONS) {
      for (const mirror of [false, true]) {
        const I = makeInstance(p, 200, 100, rot, mirror);
        assert.equal(I.rot, rot);
        for (const name of s.pinOrder) {
          const local = s.pins[name];
          // expected: mirror about the origin, then rotate clockwise, then translate
          const rel = { x: (mirror ? -1 : 1) * (local.x - s.origin.x), y: local.y - s.origin.y };
          const r = rotateVec(rel.x, rel.y, rot);
          assert.deepEqual(
            { x: I.pins[name].x, y: I.pins[name].y },
            { x: 200 + r.x, y: 100 + r.y },
            `${type} @${rot}${mirror ? '+mirror' : ''} pin ${name} position`,
          );
          const dv = DIR_VEC[local.dir];
          const rd = rotateVec((mirror ? -1 : 1) * dv.x, dv.y, rot);
          assert.equal(I.pins[name].dir, vecDir(rd), `${type} @${rot}${mirror ? '+mirror' : ''} pin ${name} direction`);
          // pins stay on the 10px routing grid relative to each other
          assert.ok((I.pins[name].x - 200) % 10 === 0 && (I.pins[name].y - 100) % 10 === 0, `${type} @${rot} pin ${name} off grid`);
        }
      }
    }
  }
});

test('rotation keeps body, extent and labels consistent', () => {
  for (const type of TYPES) {
    const p = part(type, { value: '1k' });
    for (const rot of ROTATIONS) {
      const I = makeInstance(p, 0, 0, rot, false);
      const pins = Object.values(I.pins);
      // the extent covers every pin, the body and the labels
      for (const q of pins) {
        assert.ok(q.x >= I.extent.x - 0.01 && q.x <= I.extent.x + I.extent.w + 0.01, `${type} @${rot}: pin outside extent`);
        assert.ok(q.y >= I.extent.y - 0.01 && q.y <= I.extent.y + I.extent.h + 0.01, `${type} @${rot}: pin outside extent`);
      }
      for (const l of I.labels) {
        assert.ok(overlaps(inflate(l.box, 1), inflate(I.extent, 1)), `${type} @${rot}: label outside extent`);
      }
      // a 90° turn swaps the body's width and height
      const flat = makeInstance(p, 0, 0, 0, false);
      if (rot === 90 || rot === 270) {
        assert.ok(Math.abs(I.body.w - flat.body.h) < 0.01 && Math.abs(I.body.h - flat.body.w) < 0.01, `${type} @${rot}: body not transposed`);
      } else {
        assert.ok(Math.abs(I.body.w - flat.body.w) < 0.01, `${type} @${rot}: body width changed`);
      }
      // pins are never inside the body (they must stay reachable for wires)
      for (const q of pins) assert.ok(!overlaps({ x: q.x - 0.5, y: q.y - 0.5, w: 1, h: 1 }, inflate(I.body, -2)), `${type} @${rot}: pin inside body`);
    }
  }
});

test('the SVG transform matches the instance rotation', () => {
  for (const rot of ROTATIONS) {
    const r = render({
      components: [
        { id: 'R1', type: 'resistor', value: '1k', rotation: rot, position: { x: 100, y: 100 } },
        { id: 'R2', type: 'resistor', value: '2k', position: { x: 400, y: 100 } },
      ],
      connections: [['R1.2', 'R2.1'], ['R1.1', 'R2.2']],
    });
    assert.ok(r.svg.includes(`data-id="R1"`));
    const g = /<g id="part-R1"[^>]*transform="([^"]+)"/.exec(r.svg);
    assert.ok(g, 'R1 group found');
    if (rot) assert.match(g[1], new RegExp(`rotate\\(${rot}\\)`), `transform for ${rot}`);
    else assert.ok(!/rotate\(/.test(g[1]));
    assert.match(g[1], /^translate\(100 100\)/);
  }
});

// Wires must land exactly on the rotated pins, for every rotation of both parts.
test('wires stay attached to pins through every rotation', () => {
  for (const type of ['resistor', 'capacitor_polarized', 'led', 'npn', 'nmos', 'opamp', 'timer_555', 'd_flipflop', 'seven_segment', 'relay', 'transformer', 'arduino_uno']) {
    const sym = resolveSymbol({ type });
    const first = sym.pinOrder[0], second = sym.pinOrder[1] || sym.pinOrder[0];
    for (const rot of ROTATIONS) {
      const circuit = {
        components: [
          { id: 'X1', type, rotation: rot },
          { id: 'T1', type: 'input' },
          { id: 'T2', type: 'output' },
        ],
        connections: [['T1', `X1.${first}`], [`X1.${second}`, 'T2']],
      };
      const { v, scene } = buildScene(circuit);
      assert.ok(v.valid, `${type} @${rot}: ${JSON.stringify(v.errors)}`);
      const I = scene.instances.get('X1');
      assert.equal(I.rot, rot);
      for (const [netId, wires] of scene.routing.nets) {
        const pins = scene.netlist.nets.get(netId).pins.map((e) => scene.instances.get(e.comp).pins[e.pin]);
        const ends = new Set();
        for (const s of wires.segments) { ends.add(`${s.x1},${s.y1}`); ends.add(`${s.x2},${s.y2}`); }
        for (const q of pins) {
          assert.ok(ends.has(`${q.x},${q.y}`), `${type} @${rot}: net ${netId} does not touch pin at ${q.x},${q.y}`);
        }
        // and no wire cuts through the rotated body
        for (const s of wires.segments) {
          for (const J of scene.instances.values()) {
            assert.ok(!segHitsRect(s, inflate(J.body, -1.5)), `${type} @${rot}: wire crosses ${J.id}`);
          }
        }
      }
      // junction dots, if any, sit on the wiring of their own net
      for (const j of scene.routing.junctions) {
        const segs = scene.routing.nets.get(j.net).segments;
        assert.ok(segs.some((s) => segHitsRect({ x1: j.x, y1: j.y, x2: j.x, y2: j.y }, { x: Math.min(s.x1, s.x2) - 0.5, y: Math.min(s.y1, s.y2) - 0.5, w: Math.abs(s.x2 - s.x1) + 1, h: Math.abs(s.y2 - s.y1) + 1 })),
          `${type} @${rot}: junction off its net`);
      }
    }
  }
});

test('rotating a part re-routes instead of leaving wires behind', () => {
  const base = {
    components: [
      { id: 'V1', type: 'dc_source', value: '5V', position: { x: 100, y: 200 } },
      { id: 'R1', type: 'resistor', value: '1k', position: { x: 300, y: 100 } },
      { id: 'GND', type: 'ground' },
    ],
    connections: [['V1.positive', 'R1.1'], ['R1.2', 'GND'], ['V1.negative', 'GND']],
  };
  const a = buildScene(base).scene;
  const rotated = structuredClone(base);
  // the automatic orientation is vertical here, so force the horizontal one
  rotated.components[1].rotation = 0;
  const b = buildScene(rotated).scene;
  const wiring = (s) => [...s.routing.nets.values()].flatMap((n) => n.segments);
  assert.notDeepEqual(wiring(a), wiring(b), 'routing changed with the part');
  for (const scene of [a, b]) {
    for (const [netId, wires] of scene.routing.nets) {
      for (const e of scene.netlist.nets.get(netId).pins) {
        const q = scene.instances.get(e.comp).pins[e.pin];
        assert.ok(wires.segments.some((s) => (s.x1 === q.x && s.y1 === q.y) || (s.x2 === q.x && s.y2 === q.y)), `pin ${e.comp}.${e.pin} connected`);
      }
    }
  }
});
