import { test } from 'node:test';
import assert from 'node:assert/strict';
import { render, validate, buildScene, explainCircuit, LIMITS } from '../src/engine.js';
import { validateCircuit } from '../src/validator/index.js';
import { buildNetlist } from '../src/graph/index.js';
import { layoutCircuit } from '../src/layout/index.js';
import { routeCircuit, MAX_CELLS } from '../src/router/index.js';
import { formatJSON, deleteComponent, renameComponent, pinLayout, rotateComponent, clearLayout, addComponent } from '../src/editor/model.js';
import { loadExamples, clone, lcg, gateNetwork, minimal } from './helpers.js';

const codes = (r) => r.errors.map((e) => e.code);

test('names that exist on Object.prototype are never mistaken for types, pins or ids', () => {
  for (const word of ['constructor', '__proto__', 'toString', 'hasOwnProperty', 'prototype']) {
    const asType = minimal();
    asType.components[1].type = word;
    const r = render(asType);
    assert.equal(r.valid, false, `type ${word}`);
    assert.ok(codes(r).includes('UNKNOWN_TYPE'), `type ${word}: ${codes(r)}`);

    const asPin = minimal();
    asPin.connections[0] = ['V1.positive', `R1.${word}`];
    const p = render(asPin);
    assert.ok(codes(p).includes('INVALID_PIN'), `pin ${word}: ${codes(p)}`);

    const asId = minimal();
    asId.components[1].id = word;
    asId.connections = [['V1.positive', `${word}.1`], [`${word}.2`, 'V1.negative']];
    assert.ok(codes(validate(asId)).length === 0 || codes(validate(asId)).includes('INVALID_ID'), `id ${word}`);
    assert.doesNotThrow(() => render(asId));
  }
  assert.ok(codes(render({ components: [{ id: '__proto__', type: 'resistor' }], connections: [] })).includes('INVALID_ID'));
});

test('box-part pin lists are checked instead of silently repaired', () => {
  const withPins = (pins) => ({ components: [{ id: 'U1', type: 'generic_ic', pins }], connections: [] });
  const problems = (pins) => validate(withPins(pins)).errors.filter((e) => e.path === 'components[0].pins').map((e) => e.message);

  assert.deepEqual(problems(['A', 'B', 'C', 'D']), []);
  assert.deepEqual(problems({ left: ['A'], right: ['B'], top: ['C'], bottom: ['D'] }), []);
  assert.deepEqual(problems(4), []);
  assert.match(problems(0)[0], /whole number from 1 to 64/);
  assert.match(problems(1e9)[0], /whole number from 1 to 64/);
  assert.match(problems(2.5)[0], /whole number/);
  assert.match(problems(['A', 'a'])[0], /more than once/);
  assert.match(problems(['A', ''])[0], /empty pin name/);
  assert.match(problems(['__proto__'])[0], /reserved/);
  assert.match(problems({ left: 'A' })[0], /must be an array/);
  assert.match(problems({ middle: ['A'] })[0], /unknown side "middle"/);
  assert.match(problems('abc')[0], /must be a number, an array/);
  assert.match(problems([null])[0], /not text/);
  // fixed-pin parts ignore "pins": worth a warning, not an error
  const r = validate({ components: [{ id: 'R1', type: 'resistor', pins: 3 }], connections: [] });
  assert.ok(r.warnings.some((w) => w.code === 'IGNORED_PROPERTY'));
  assert.equal(r.errors.length, 0);
});

test('field types are checked: value, label, mirror, route, annotations', () => {
  const bad = minimal();
  bad.components[1].value = { ohms: 1000 };
  bad.components[1].label = ['a'];
  bad.components[1].mirror = 'yes';
  bad.connections[0] = { pins: ['V1.positive', 'R1.1'], route: 'straight' };
  bad.annotations = [null, 5];
  bad.bom = [null];
  const paths = validate(bad).errors.map((e) => e.path);
  for (const p of ['components[1].value', 'components[1].label', 'components[1].mirror', 'connections[0].route', 'annotations[0]', 'annotations[1]', 'bom[0]']) {
    assert.ok(paths.includes(p), `${p} in ${paths}`);
  }
  // numbers are fine for value/label; null means "not set"
  const ok = minimal();
  ok.components[1].value = 1000;
  ok.components[1].label = 7;
  ok.components[0].value = null;
  assert.equal(validate(ok).errors.length, 0);
});

test('coordinates outside the sheet are rejected', () => {
  const far = minimal();
  far.components[1].position = { x: 1e7, y: 0 };
  far.connections[0] = { pins: ['V1.positive', 'R1.1'], waypoints: [{ x: 0, y: -1e9 }] };
  const r = validate(far);
  assert.ok(r.errors.some((e) => e.path === 'components[1].position' && /outside the sheet/.test(e.message)));
  assert.ok(r.errors.some((e) => /waypoints has a point outside/.test(e.message)));
});

test('size limits stop oversized documents before any real work', () => {
  const many = { components: Array.from({ length: LIMITS.components + 1 }, (_, i) => ({ id: `R${i}`, type: 'resistor' })), connections: [] };
  const t0 = Date.now();
  const r = render(many);
  assert.ok(codes(r).includes('LIMIT_EXCEEDED'));
  assert.ok(Date.now() - t0 < 500);
  assert.equal(validate(many, { limits: { components: 5000 } }).errors.length, 0, 'limits are overridable');
  const wide = { components: [{ id: 'R1', type: 'resistor' }], connections: [Array.from({ length: LIMITS.endpointsPerConnection + 1 }, () => 'R1.1')] };
  assert.ok(codes(validate(wide)).includes('LIMIT_EXCEEDED'));
});

test('the error list is capped so a garbage document cannot flood the caller', () => {
  const junk = { components: Array.from({ length: 400 }, () => 5), connections: [] };
  const r = validate(junk);
  assert.equal(r.errors.length, LIMITS.errors + 1);
  assert.equal(r.errors.at(-1).code, 'TOO_MANY_ERRORS');
});

test('parts placed absurdly far apart are drawn with direct wires, quickly', () => {
  // valid coordinates, but the routing grid between them would need gigabytes
  const c = minimal();
  c.components[0].position = { x: 0, y: 0 };
  c.components[1].position = { x: 19000, y: 19000 };
  const t0 = Date.now();
  const r = render(c);
  assert.ok(Date.now() - t0 < 2000, 'no giant allocation');
  assert.equal(r.valid, true);
  assert.ok(r.warnings.some((w) => w.code === 'ROUTING_FAILURE' && /too large/.test(w.message)));
  assert.ok(r.svg.includes('<svg'));
  assert.ok(r.scene.routing.nets.size > 0, 'nets are still drawn');
  assert.ok(MAX_CELLS > 100000);
});

test('routing effort is capped deterministically; the rest falls back to direct wires', () => {
  const c = gateNetwork(40, 3);
  const v = validateCircuit(c);
  const nl = buildNetlist(v);
  const placement = layoutCircuit(nl, c);
  const full = routeCircuit(nl, placement.instances);
  assert.equal(full.failures.length, 0);
  assert.ok(full.work > 20000, `work is counted (${full.work})`);
  const capped = routeCircuit(nl, placement.instances, { maxWork: 20000 });
  assert.ok(capped.failures.length > 0);
  assert.ok(capped.failures.every((f) => f.reason === 'work-limit'));
  assert.equal(capped.nets.size, full.nets.size, 'every net still has geometry');
  assert.deepEqual(routeCircuit(nl, placement.instances, { maxWork: 20000 }).failures, capped.failures, 'deterministic');
  // through the engine: one aggregated warning, not one per wire
  const limited = render(gateNetwork(160, 5));
  assert.ok(limited.valid);
  assert.ok(limited.warnings.filter((w) => w.code === 'ROUTING_FAILURE').length <= 1);
});

test('render, validate and the explainers never throw, whatever the input', () => {
  const inputs = [undefined, null, 0, 5, true, '', ' ', 'not json', '{', '[]', '{}', [], [1], {}, { components: 5 }, { components: [null] },
    { components: [], connections: 'x' }, { circuit: 5 }, { circuit: { components: [] } }, { components: [{}] },
    { components: [{ id: 1, type: 2 }] }, { components: [{ id: 'a', type: {} }] }];
  for (const input of inputs) {
    assert.doesNotThrow(() => { validate(input); render(input); explainCircuit(input); }, JSON.stringify(input));
    const r = render(input);
    for (const list of ['errors', 'warnings', 'findings']) assert.ok(Array.isArray(r[list]), `${list} for ${JSON.stringify(input)}`);
    assert.equal(typeof r.valid, 'boolean');
    if (!r.valid) assert.equal(r.svg, null);
  }
});

// Mutation fuzzing: corrupt real examples in random ways. Anything that goes wrong
// inside the engine surfaces as INTERNAL_ERROR (the safety net) or LAYOUT_FAILURE.
const JUNK = [null, true, false, 0, -1, 1e9, 0.5, '', 'x', 'R1.1', 'constructor', '__proto__', [], {}, [null], [1, 2], { x: 1, y: 2 }, { x: 'a' }, ['R1.1'], 'resistor', 'A.B.C', '.', '.1', '💥', { left: ['A'], right: [null] }];
function nodePaths(o, base = []) {
  const out = [];
  if (o && typeof o === 'object') for (const k of Object.keys(o)) { const p = base.concat(Array.isArray(o) ? Number(k) : k); out.push(p, ...nodePaths(o[k], p)); }
  return out;
}
function corrupt(orig, rnd) {
  const c = clone(orig);
  for (let n = 1 + rnd.int(3); n > 0; n--) {
    const ps = nodePaths(c);
    if (!ps.length) break;
    const p = rnd.pick(ps);
    let parent = c;
    for (let j = 0; j < p.length - 1; j++) parent = parent[p[j]];
    const key = p[p.length - 1];
    const op = rnd();
    if (op < 0.55) parent[key] = clone(rnd.pick(JUNK));
    else if (op < 0.75) { if (Array.isArray(parent)) parent.splice(key, 1); else delete parent[key]; }
    else if (typeof parent[key] === 'string') { const s = parent[key]; const at = rnd.int(s.length + 1); parent[key] = s.slice(0, at) + s.slice(at + 1); }
  }
  return c;
}
const refsOf = (c) => (c.connections || []).flatMap((x) => (Array.isArray(x) ? x : [])).filter((r) => typeof r === 'string');
function rewire(orig, rnd) {
  const c = clone(orig);
  const refs = refsOf(c);
  for (let n = 1 + rnd.int(4); n > 0; n--) {
    const comp = rnd.pick(c.components);
    const op = rnd();
    if (op < 0.25 && refs.length > 1) c.connections.push([...new Set([rnd.pick(refs), rnd.pick(refs)])]);
    else if (op < 0.45) comp.rotation = rnd.pick([0, 45, 90, 135, 180, 270, 30, 17.5, -90, 720]);
    else if (op < 0.55) comp.mirror = !comp.mirror;
    else if (op < 0.75) comp.position = { x: rnd.int(150) * 10 - 200, y: rnd.int(90) * 10 - 200 };
    else if (op < 0.85 && c.connections.length) c.connections.splice(rnd.int(c.connections.length), 1);
    else if (op < 0.92) c.layout = { spacing: rnd.pick(['compact', 'spacious', 'auto']), bridges: rnd() < 0.5, optimize: rnd() < 0.5 };
    else comp.section = rnd.pick(['input', 'output', 'process', 'power']);
  }
  return c;
}

test('fuzz: corrupted and rewired examples are handled without internal errors', () => {
  const examples = Object.values(loadExamples());
  const rnd = lcg(20240607);
  const explicit = new Set(['INTERNAL_ERROR', 'LAYOUT_FAILURE']);
  for (let i = 0; i < 350; i++) {
    const c = i % 2 ? corrupt(rnd.pick(examples), rnd) : rewire(rnd.pick(examples), rnd);
    const label = `case ${i}: ${JSON.stringify(c).slice(0, 160)}`;
    let r;
    assert.doesNotThrow(() => { r = render(c); validate(c); explainCircuit(c, r.findings); }, label);
    assert.ok(!r.errors.some((e) => explicit.has(e.code)), `${label} -> ${r.errors.map((e) => e.message)}`);
    if (r.svg) assert.ok(!/NaN|undefined|Infinity/.test(r.svg), `bad number in SVG: ${label}`);
    // the editor helpers run on whatever is in the text box, valid or not
    assert.doesNotThrow(() => {
      if (r.scene) { pinLayout(c, r.scene.instances); const id = r.scene.instances.keys().next().value; if (id) rotateComponent(c, r.scene.instances, id); }
      const first = Array.isArray(c.components) && c.components[0]?.id;
      if (typeof first === 'string') { deleteComponent(c, first); renameComponent(c, first, 'ZZ9'); }
      clearLayout(c); addComponent(c, 'resistor'); formatJSON(c);
    }, label);
  }
});

test('buildScene mirrors render for invalid input', () => {
  const { scene, v } = buildScene({ components: 'nope' });
  assert.equal(scene, null);
  assert.equal(v.valid, false);
});

test('validation cost is bounded whatever the document looks like', () => {
  const comps = Array.from({ length: 1500 }, (_, i) => ({ id: `R${i}`, type: 'resistor' }));
  const timed = (c) => { const t0 = Date.now(); const r = validate(c); return { ms: Date.now() - t0, r }; };
  // wide buses: every pin named, then pairs compared only along the bus
  const bus = timed({ components: comps, connections: Array.from({ length: 30 }, () => Array.from({ length: 500 }, (_, j) => `R${j}.1`)) });
  assert.ok(bus.ms < 1500, `buses: ${bus.ms} ms`);
  // thousands of bad references: suggestions stop after a budget, errors after the cap
  const bad = timed({ components: comps, connections: Array.from({ length: 20 }, (_, k) => Array.from({ length: 500 }, (_, j) => `Z${k}_${j}.1`)) });
  assert.ok(bad.ms < 1500, `bad references: ${bad.ms} ms`);
  assert.equal(bad.r.errors.length, LIMITS.errors + 1);
  assert.equal(bad.r.warnings.at(-1).code, 'TOO_MANY_WARNINGS');
  // more pins than the limit names in total is refused outright
  const huge = timed({ components: comps, connections: Array.from({ length: 6000 }, () => Array.from({ length: 500 }, (_, j) => `R${j}.1`)) });
  assert.ok(huge.ms < 200);
  assert.ok(huge.r.errors.some((e) => e.code === 'LIMIT_EXCEEDED' && /in total/.test(e.message)));
  // a long duplicate list cannot flood the warnings
  const dup = validate({ components: comps.slice(0, 5), connections: Array.from({ length: 200 }, () => ['R0.1', 'R1.1']) });
  assert.ok(dup.warnings.filter((w) => w.code === 'DUPLICATE_CONNECTION').length <= 25);
});

test('a short id is never "corrected" to a different part', () => {
  const c = { components: ['V1', 'R1', 'C1', 'D1'].map((id, i) => ({ id, type: ['dc_source', 'resistor', 'capacitor', 'diode'][i] })), connections: [['V1.positive', 'X9.1'], ['R5.1', 'C1.1'], ['r1.1', 'C1.2']] };
  const errs = validate(c).errors.filter((e) => e.code === 'MISSING_COMPONENT');
  assert.equal(errs.length, 3);
  assert.equal(errs[0].fix, undefined, 'X9 has no plausible match');
  assert.equal(errs[1].fix, undefined, 'R5 is not R1');
  assert.equal(errs[2].fix.value, 'R1.1', 'a case slip is corrected');
});

test('a measurement or annotation pointing at an inherited name draws no NaN', () => {
  const c = minimal();
  c.measurements = [{ at: 'R1.constructor', label: 'a' }, { at: 'R1.__proto__', label: 'b' }, { at: 'R1.toString' }];
  c.annotations = [{ text: 'x', at: 'V1.hasOwnProperty' }];
  const r = render(c);
  assert.ok(r.svg && !/NaN|undefined|Infinity/.test(r.svg));
  assert.ok(Number.isFinite(r.viewBox.x) && Number.isFinite(r.viewBox.w));
  // pin aliases work, and pin names containing a dot are not cut short
  const d = { components: [{ id: 'D1', type: 'led' }, { id: 'U1', type: 'generic_ic', pins: ['P0.1', 'P0.2'] }, { id: 'R1', type: 'resistor' }], connections: [['D1.A', 'R1.1'], ['U1.P0.1', 'R1.2']],
    measurements: [{ at: 'D1.A', label: 'alias' }, { at: 'U1.P0.1', label: 'dotted' }] };
  const out = render(d);
  assert.deepEqual(out.errors, []);
  assert.equal(out.svg.match(/cf-measurement/g).length, 2);
});
