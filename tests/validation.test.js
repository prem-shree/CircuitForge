import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validate, render } from '../src/engine.js';
import { indexJSON, annotateLines } from '../src/parser/locate.js';
import { parseJSON } from '../src/parser/index.js';
import { formatPath, parsePath, getPath, setPath } from '../src/utils/path.js';
import { closest, levenshtein } from '../src/validator/suggest.js';
import { applyFix } from '../src/editor/model.js';
import { parseValue } from '../src/utils/units.js';
import { loadExamples, clone, minimal } from './helpers.js';

const find = (r, code) => [...r.errors, ...r.warnings, ...r.findings].find((p) => p.code === code);

test('every problem that can be located carries a JSON path', () => {
  const c = {
    layout: { spacing: 'roomy' },
    components: [{ id: 'R1', type: 'resistor', rotation: 'sideways' }, { id: 'R1', type: 'resistor' }, { id: 'X', type: 'resistr' }, { type: 'npn' }],
    connections: [['R1.1', 'X.1'], ['R1.1', 'Q9.1'], ['R1.7', 'R1.2']],
  };
  const r = validate(c);
  const byCode = Object.fromEntries(r.errors.map((e) => [e.code, e]));
  assert.equal(byCode.DUPLICATE_ID.path, 'components[1].id');
  assert.equal(byCode.UNKNOWN_TYPE.path, 'components[2].type');
  assert.equal(byCode.MISSING_ID.path, 'components[3]');
  assert.equal(byCode.INVALID_PIN.path, 'connections[2][0]');
  assert.equal(byCode.MISSING_COMPONENT.path, 'connections[1][1]');
  assert.ok(r.errors.some((e) => e.path === 'layout.spacing'));
  assert.ok(r.errors.some((e) => e.path === 'components[0].rotation'));
});

test('typos come with a suggestion and a one-step fix that actually fixes them', () => {
  const cases = [
    { mutate: (c) => { c.components[1].type = 'resistr'; }, code: 'UNKNOWN_TYPE', says: /Did you mean "resistor"\?/ },
    { mutate: (c) => { c.connections[0][0] = 'V1.positve'; }, code: 'INVALID_PIN', says: /Did you mean "positive"\?/ },
    { mutate: (c) => { c.connections[1][0] = 'r1.2'; }, code: 'MISSING_COMPONENT', says: /Did you mean "R1"\?/ },
    { mutate: (c) => { c.connections[0][1] = 'R1.pin1'; }, code: 'INVALID_PIN', says: /Available: 1, 2/ },
  ];
  for (const { mutate, code, says } of cases) {
    const c = minimal();
    mutate(c);
    const err = find(validate(c), code);
    assert.ok(err, `${code} raised`);
    assert.match(err.message, says);
    if (!err.fix) continue;
    const fixed = applyFix(c, err.fix);
    assert.ok(fixed, `fix for ${code} applies`);
    assert.equal(validate(fixed).errors.length, 0, `${code} is gone after "${err.fix.label}"`);
  }
  // nothing plausible to suggest -> no suggestion, no fix
  const far = minimal();
  far.components[1].type = 'qwertyuiop';
  const err = find(validate(far), 'UNKNOWN_TYPE');
  assert.doesNotMatch(err.message, /Did you mean/);
  assert.equal(err.fix, undefined);
});

test('applyFix refuses a fix whose path no longer exists', () => {
  assert.equal(applyFix({ components: [] }, { path: 'components[3].type', value: 'x' }), null);
  assert.equal(applyFix({}, null), null);
  const original = minimal();
  const copy = clone(original);
  applyFix(original, { path: 'components[1].value', value: '2k' });
  assert.deepEqual(original, copy, 'input is not mutated');
});

test('an invalid connection does not also report its parts as unconnected', () => {
  const c = minimal();
  c.connections[0][0] = 'V1.positve';
  const r = validate(c);
  assert.equal(r.errors.length, 1);
  assert.ok(!r.warnings.some((w) => w.code === 'MISSING_REQUIRED_PIN' && w.component === 'V1'));
});

test('unknown fields, options and rule codes suggest the closest valid name', () => {
  const c = minimal();
  c.componets = [];
  c.layout = { spacng: 'compact' };
  c.validation = { rules: { FLOATING_INPT: 'off' } };
  const r = validate(c);
  const msg = (p) => r.warnings.find((w) => w.path === p)?.message;
  assert.match(msg('componets'), /Did you mean "components"\?/);
  assert.match(msg('layout.spacng'), /Did you mean "spacing"\?/);
  assert.match(msg('validation.rules.FLOATING_INPT'), /Did you mean "FLOATING_INPUT"\?/);
  assert.equal(r.warnings.find((w) => w.path === 'validation.rules.FLOATING_INPT').code, 'UNKNOWN_RULE');
});

test('one net given two names is reported once', () => {
  const c = minimal();
  c.connections = [{ pins: ['V1.positive', 'R1.1'], net: 'VIN' }, { pins: ['V1.positive', 'R1.1'], net: 'SUPPLY' }, ['R1.2', 'V1.negative']];
  const w = validate(c).warnings.filter((x) => x.code === 'NET_NAME_CONFLICT');
  assert.equal(w.length, 1);
  assert.match(w[0].message, /"VIN", "SUPPLY"/);
});

test('values that look like numbers but are not are flagged; symbolic values are left alone', () => {
  const c = {
    components: ['4,7k', 'Rx', '10kΩ 5%', '1..5k', '2.2kΩ', '10k/1W'].map((value, i) => ({ id: `R${i + 1}`, type: 'resistor', value })),
    connections: [['R1.2', 'R2.1'], ['R2.2', 'R3.1'], ['R3.2', 'R4.1'], ['R4.2', 'R5.1'], ['R5.2', 'R6.1']],
  };
  const flagged = validate(c).findings.filter((f) => f.code === 'INVALID_VALUE').map((f) => f.component);
  assert.deepEqual(flagged, ['R1', 'R4']);
  assert.match(validate(c).findings.find((f) => f.component === 'R1').hint, /decimal point/);
  assert.equal(validate({ ...c, validation: { rules: { INVALID_VALUE: 'off' } } }).findings.filter((f) => f.code === 'INVALID_VALUE').length, 0);
  assert.equal(parseValue('1e3'), 1000);
  assert.equal(parseValue('2.5e-6F'), 2.5e-6);
});

test('none of the shipped examples trips the stricter checks', () => {
  for (const [name, c] of Object.entries(loadExamples())) {
    const r = validate(c);
    assert.deepEqual(r.errors, [], name);
    assert.deepEqual(r.warnings, [], name);
    assert.deepEqual(r.findings.filter((f) => f.code === 'INVALID_VALUE' || f.code === 'NET_NAME_CONFLICT'), [], name);
  }
});

// ---- path notation and the JSON locator

test('paths round-trip through format and parse', () => {
  for (const segs of [['components', 2, 'type'], ['connections', 0, 1], ['nets', 'V-OUT', 0], ['nets', 'a.b'], ['x'], ['pinTypes', '1']]) {
    assert.deepEqual(parsePath(formatPath(segs)).map(String), segs.map(String), formatPath(segs));
  }
  assert.equal(formatPath(['components', 2, 'type']), 'components[2].type');
  assert.equal(formatPath(['nets', 'V-OUT', 0]), 'nets["V-OUT"][0]');
  const o = { a: [{ b: 1 }] };
  assert.equal(getPath(o, 'a[0].b'), 1);
  assert.equal(getPath(o, 'a[3].b'), undefined);
  assert.equal(getPath(o, 'constructor'), undefined);
  assert.equal(setPath(o, 'a[0].b', 2), true);
  assert.equal(o.a[0].b, 2);
  assert.equal(setPath(o, 'a[9].b', 2), false);
  setPath(o, 'a[0].b', undefined);
  assert.deepEqual(o, { a: [{}] });
  setPath(o, '__proto__', 5);
  assert.equal(Object.getPrototypeOf(o), Object.prototype, 'a "__proto__" key does not rewrite the prototype');
});

test('indexJSON maps paths to line and column', () => {
  const text = JSON.stringify(minimal(), null, 2);
  const lines = text.split('\n');
  const index = indexJSON(text);
  const at = index.locate('components[1].type');
  assert.match(lines[at.line - 1], /"type": "resistor"/);
  assert.equal(text.slice(at.offset, at.end), '"resistor"');
  assert.equal(index.locate('connections[1][0]').line, lines.findIndex((l) => l.includes('"R1.2"')) + 1);
  // a missing property falls back to the nearest parent that exists
  assert.equal(index.locate('components[1].nothing').line, index.locate('components[1]').line);
  assert.equal(index.locate('nowhere.at.all').line, 1);
  assert.equal(index.has('components[0].id'), true);
  assert.equal(index.has('components[9]'), false);
  // keys that need quoting, nesting deeper than the scanner indexes, and broken text
  assert.ok(indexJSON('{"nets":{"V-OUT":["R1.1"]}}').has('nets["V-OUT"][0]'));
  const deep = '['.repeat(500) + ']'.repeat(500);
  assert.doesNotThrow(() => indexJSON(deep));
  assert.doesNotThrow(() => indexJSON('{"a": [1, 2'));
  assert.equal(indexJSON('').locate('a').line, 1);
});

test('text input gets line and column on every located problem', () => {
  const text = JSON.stringify({ components: [{ id: 'R1', type: 'resistor' }, { id: 'R2', type: 'nope' }], connections: [['R1.1', 'R2.9']] }, null, 2);
  const r = validate(text);
  const lines = text.split('\n');
  for (const e of r.errors) {
    assert.ok(e.line > 0 && e.column > 0, `${e.code} has a line`);
  }
  const pin = r.errors.find((e) => e.code === 'INVALID_PIN' || e.code === 'UNKNOWN_TYPE');
  assert.match(lines[pin.line - 1], /nope|R2\.9/);
  // objects carry no text, so no lines; wrapped envelopes are not annotated
  assert.equal(validate(JSON.parse(text)).errors[0].line, undefined);
  // an API envelope { "circuit": … } is located too, one level down
  const wrapped = JSON.stringify({ circuit: JSON.parse(text) }, null, 2);
  const env = validate(wrapped).errors.find((e) => e.code === 'UNKNOWN_TYPE');
  assert.equal(env.path, 'components[1].type');
  assert.match(wrapped.split('\n')[env.line - 1], /"type": "nope"/);
  // annotateLines is usable directly (the editor calls it on the textarea)
  const problems = annotateLines([{ path: 'components[1].id' }, { path: 'x' }, { message: 'no path' }], text);
  assert.match(lines[problems[0].line - 1], /"id": "R2"/);
});

test('syntax errors still report their own line and column', () => {
  const e = parseJSON('{\n  "components": [\n    { "id": "R1" "type": "resistor" }\n  ]\n}').errors[0];
  assert.equal(e.code, 'INVALID_JSON');
  assert.equal(e.line, 3);
  assert.match(e.message, /expected ',' or '}'/);
});

test('suggestions: short names must be near-exact, longer ones tolerate two edits', () => {
  assert.equal(levenshtein('kitten', 'sitting'), 3);
  assert.equal(closest('resistr', ['resistor', 'capacitor']), 'resistor');
  assert.equal(closest('ANODE', ['anode', 'cathode']), 'anode');
  assert.equal(closest('99', ['1', '2']), null);
  assert.equal(closest('b', ['a', 'c']), null);
  assert.equal(closest('', ['a']), null);
  assert.equal(closest('xyz123', ['resistor']), null);
  assert.equal(closest('alias', [['al', 'canonical'], ['alias', 'other']]), 'other');
});

test('render passes the same located problems through', () => {
  const c = minimal();
  c.components[1].type = 'resistr';
  const r = render(c);
  assert.equal(r.valid, false);
  assert.equal(r.errors[0].path, 'components[1].type');
  assert.equal(r.svg, null);
});

test('malformed text never hangs the locator, and syntax errors need no index', () => {
  // each of these used to loop forever
  for (const bad of ['[}', '[1,}', '{"a":[1,}', '{"components":[{"id":"R1"}}', '{"a": [}}]']) {
    assert.doesNotThrow(() => indexJSON(bad), bad);
    const r = validate(bad);
    assert.equal(r.errors[0].code, 'INVALID_JSON', bad);
    assert.ok(r.errors[0].line >= 1);
  }
  assert.equal(validate('{"circuit":"[}"}').valid, false);
});

test('paths survive keys that end in a backslash or contain quotes and dots', () => {
  for (const key of ['a\\', 'say "hi"', 'x.y', 'a]b', '[0]']) {
    assert.deepEqual(parsePath(formatPath(['nets', key, 0])), ['nets', key, 0], key);
  }
  const text = '{"components":[{"id":"R1","type":"resistor"}],"connections":[["R1.1","R9.1"]],"nets":{"a\\\\":["R1.1","R9.1"]}}';
  const r = validate(text);
  assert.ok(r.errors.some((e) => e.code === 'MISSING_COMPONENT'), 'the real error, not INTERNAL_ERROR');
  assert.ok(!r.errors.some((e) => e.code === 'INTERNAL_ERROR'));
});

test('everyday value qualifiers and SPICE "meg" are numbers', () => {
  for (const [v, n] of [['12Vdc', 12], ['5Vrms', 5], ['230 Vrms', 230], ['5Vpp', 5], ['100mVp-p', 0.1], ['3.3V typ', 3.3], ['1Meg', 1e6], ['4.7MEGohm', 4.7e6], ['5MV', 5e6], ['5mV', 0.005], ['1m', 0.001]]) {
    assert.ok(Math.abs(parseValue(v) - n) <= Math.abs(n) * 1e-9, `${v} -> ${parseValue(v)}`);
  }
  assert.equal(parseValue('1..5k'), null);
  assert.equal(parseValue('abc'), null);
  const c = { components: [{ id: 'V1', type: 'dc_source', value: '12Vdc' }, { id: 'V2', type: 'ac_source', value: '230Vrms 50Hz' }, { id: 'R1', type: 'resistor', value: '1Meg' }], connections: [['V1.positive', 'R1.1'], ['R1.2', 'V2.positive'], ['V1.negative', 'V2.negative']] };
  assert.deepEqual(validate(c).findings.filter((f) => f.code === 'INVALID_VALUE'), []);
});
