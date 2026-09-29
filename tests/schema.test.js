import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validate, render, listTypes, LIMITS } from '../src/engine.js';
import { loadExamples, minimal } from './helpers.js';

const schema = JSON.parse(fs.readFileSync(new URL('../schema/circuit.schema.json', import.meta.url), 'utf8'));

// A checker for the subset of JSON Schema that circuit.schema.json uses: enough to
// prove the schema and the validator agree, with no dependency.
function check(value, sch, root = schema, path = '$') {
  const errors = [];
  const fail = (msg) => errors.push(`${path}: ${msg}`);
  if (sch.$ref) {
    const target = sch.$ref.replace(/^#\//, '').split('/').reduce((o, k) => o[k], root);
    return check(value, target, root, path);
  }
  const typeOf = (v) => (v === null ? 'null' : Array.isArray(v) ? 'array' : Number.isInteger(v) ? 'integer' : typeof v);
  if (sch.type) {
    const allowed = [].concat(sch.type);
    const t = typeOf(value);
    if (!allowed.includes(t) && !(t === 'integer' && allowed.includes('number'))) return [`${path}: expected ${allowed.join('|')}, got ${t}`];
  }
  if (sch.enum && !sch.enum.includes(value)) fail(`${JSON.stringify(value)} is not one of ${sch.enum.join(', ')}`);
  if (typeof value === 'string' && sch.pattern && !new RegExp(sch.pattern).test(value)) fail(`does not match ${sch.pattern}`);
  if (typeof value === 'number') {
    if (sch.minimum !== undefined && value < sch.minimum) fail(`below ${sch.minimum}`);
    if (sch.maximum !== undefined && value > sch.maximum) fail(`above ${sch.maximum}`);
  }
  if (Array.isArray(value)) {
    if (sch.minItems !== undefined && value.length < sch.minItems) fail(`fewer than ${sch.minItems} items`);
    if (sch.maxItems !== undefined && value.length > sch.maxItems) fail(`more than ${sch.maxItems} items`);
    if (sch.items) value.forEach((v, i) => errors.push(...check(v, sch.items, root, `${path}[${i}]`)));
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const k of sch.required || []) if (!(k in value)) fail(`missing "${k}"`);
    for (const [k, v] of Object.entries(value)) {
      if (sch.properties && k in sch.properties) errors.push(...check(v, sch.properties[k], root, `${path}.${k}`));
      else if (sch.additionalProperties === false) fail(`unexpected property "${k}"`);
      else if (sch.additionalProperties && typeof sch.additionalProperties === 'object') errors.push(...check(v, sch.additionalProperties, root, `${path}.${k}`));
    }
  }
  if (sch.oneOf) {
    const passing = sch.oneOf.filter((s) => check(value, s, root, path).length === 0).length;
    if (passing !== 1) fail(`matches ${passing} of the oneOf alternatives (needs exactly 1)`);
  }
  return errors;
}
const conforms = (doc) => check(doc, schema);

test('the schema is valid JSON Schema of the kind the checker understands', () => {
  assert.equal(schema.type, 'object');
  assert.ok(schema.$defs.points);
  assert.deepEqual(conforms({ components: [] }), []);
  assert.ok(conforms({}).some((e) => /missing "components"/.test(e)));
});

test('every example conforms to the schema', () => {
  for (const [name, doc] of Object.entries(loadExamples())) assert.deepEqual(conforms(doc), [], name);
});

test('the schema lists exactly the types in the library (run `npm run schema` if this fails)', () => {
  const listed = schema.properties.components.items.properties.type.examples;
  assert.deepEqual([...listed].sort(), listTypes().map((t) => t.type).sort());
});

test('the limits in the schema are the limits the validator enforces', () => {
  assert.equal(schema.properties.components.maxItems, LIMITS.components);
  assert.equal(schema.properties.connections.maxItems, LIMITS.connections);
  const pins = schema.properties.connections.items.oneOf;
  assert.equal(pins[0].maxItems, LIMITS.endpointsPerConnection);
  assert.equal(pins[2].properties.pins.maxItems, LIMITS.endpointsPerConnection);
});

// For the mistakes below, schema and validator must agree that the document is wrong.
const MISTAKES = {
  'mirror is not a boolean': (c) => { c.components[1].mirror = 'yes'; },
  'rotation is not a number': (c) => { c.components[1].rotation = 'sideways'; },
  'id with a dot': (c) => { c.components[1].id = 'R.1'; c.connections = []; },
  'position without y': (c) => { c.components[1].position = { x: 5 }; },
  'position outside the sheet': (c) => { c.components[1].position = { x: 1e6, y: 0 }; },
  'section is not one of the four': (c) => { c.components[1].section = 'middle'; },
  'connection with one pin': (c) => { c.connections = [['V1.positive']]; },
  'connection is a string': (c) => { c.connections = ['V1.positive R1.1']; },
  'layout spacing unknown': (c) => { c.layout = { spacing: 'huge' }; },
  'layout bridges not boolean': (c) => { c.layout = { bridges: 'no' }; },
  'rule level unknown': (c) => { c.validation = { rules: { FLOATING_INPUT: 'loud' } }; },
  'pinTypes value unknown': (c) => { c.components[1].pinTypes = { 1: 'sideways' }; },
  'pins count out of range': (c) => { c.components.push({ id: 'U1', type: 'generic_ic', pins: 500 }); },
  'waypoint outside the sheet': (c) => { c.connections[0] = { pins: ['V1.positive', 'R1.1'], waypoints: [[0, 99999999]] }; },
  'components is not an array': (c) => { c.components = {}; },
};

// Mistakes the drawing survives: the schema flags them for editors, the validator warns.
test('mistakes that only earn a warning', () => {
  const doc = minimal();
  doc.connections[0] = { pins: ['V1.positive', 'R1.1'], class: 'purple' };
  assert.ok(conforms(doc).length > 0);
  const r = validate(doc);
  assert.equal(r.errors.length, 0);
  assert.ok(r.warnings.some((w) => /Unknown connection class "purple"/.test(w.message)));
  assert.ok(render(doc).svg, 'still drawn');
});

test('schema and validator agree on what is wrong', () => {
  for (const [name, mutate] of Object.entries(MISTAKES)) {
    const doc = minimal();
    mutate(doc);
    assert.ok(conforms(doc).length > 0, `schema should reject: ${name}`);
    assert.ok(validate(doc).errors.length > 0, `validator should reject: ${name}`);
  }
  // and the good document passes both
  assert.deepEqual(conforms(minimal()), []);
  assert.equal(validate(minimal()).errors.length, 0);
});

test('unknown fields: the schema is strict, the validator only warns', () => {
  const doc = { ...minimal(), mystery: 1 };
  assert.ok(conforms(doc).some((e) => /unexpected property "mystery"/.test(e)));
  const r = validate(doc);
  assert.equal(r.errors.length, 0);
  assert.ok(r.warnings.some((w) => w.code === 'UNKNOWN_FIELD'));
});
