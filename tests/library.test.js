import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { render, validate, listTypes, explainType } from '../src/engine.js';
import { resolveSymbol, canonicalType, getDef, resolvePin } from '../src/symbol-loader/index.js';
import { COMPONENT_NOTES } from '../src/education/index.js';
import { textWidth } from '../src/utils/geometry.js';
import { minimal } from './helpers.js';

const types = listTypes();
const IO = new Set(['in', 'out', 'passive', 'power', 'power_in', 'power_out', 'bidirectional', 'tristate', 'open_collector', 'open_drain', 'unspecified', undefined]);
const DIRS = new Set(['left', 'right', 'up', 'down']);
const CATEGORIES = new Set(['passive', 'semiconductor', 'analog', 'digital', 'ic', 'power', 'board', 'sensor', 'output_device', 'display', 'connector', 'measurement', 'electromechanical']);

// Types that are added in this release must be documented and tested individually.
const NEW_TYPES = ['thermistor', 'varistor', 'tvs_diode', 'microphone', 'spdt_switch', 'igbt', 'scr', 'triac', 'bridge_rectifier', 'antenna',
  'dip_switch', 'adjustable_regulator', 'stepper_motor', 'and3', 'and4', 'or3', 'or4', 'nand3', 'nand4', 'nor3', 'nor4', 'd_latch',
  'half_adder', 'full_adder', 'bcd_7seg_decoder', 'i2c_eeprom', 'rtc', 'usb_connector', 'power_jack', 'keypad', 'sd_card',
  'humidity_sensor', 'imu', 'pir_sensor', 'bluetooth_module'];

test('the library holds every documented type', () => {
  assert.ok(types.length >= 128, `${types.length} types`);
  for (const t of NEW_TYPES) assert.ok(types.some((x) => x.type === t), `${t} is in the library`);
});

test('every symbol is well formed: pins on the grid, valid directions, sane body', () => {
  for (const { type } of types) {
    const def = getDef(type);
    assert.ok(CATEGORIES.has(def.category), `${type}: category ${def.category}`);
    const sym = resolveSymbol({ type });
    assert.ok(sym.pinOrder.length >= 1, `${type}: has pins`);
    const o = sym.origin;
    for (const name of sym.pinOrder) {
      const p = sym.pins[name];
      assert.ok(DIRS.has(p.dir), `${type}.${name}: dir ${p.dir}`);
      assert.ok(IO.has(p.io), `${type}.${name}: io ${p.io}`);
      // routing works on a 10px grid: every pin must be a whole grid step from the first pin
      assert.ok((p.x - o.x) % 10 === 0, `${type}.${name}: x off grid (${p.x - o.x})`);
      assert.ok((p.y - o.y) % 10 === 0, `${type}.${name}: y off grid (${p.y - o.y})`);
    }
    if (def.kind !== 'label' && def.kind !== 'virtual') {
      assert.ok(sym.body && sym.body.w > 0 && sym.body.h > 0, `${type}: body`);
      assert.ok(Number.isFinite(sym.width) && Number.isFinite(sym.height), `${type}: size`);
    }
    if (!def.kind && !def.rail && def.svg) assert.ok(sym.svgBody && sym.svgBody.length > 10, `${type}: drawing`);
  }
});

test('type names and aliases never collide', () => {
  const owner = new Map();
  const norm = (s) => s.toLowerCase().replace(/[\s-]+/g, '_');
  for (const { type } of types) owner.set(norm(type), type);
  for (const { type, aliases } of types) {
    for (const a of aliases) {
      const key = norm(a);
      assert.ok(!owner.has(key) || owner.get(key) === type, `alias "${a}" of ${type} is already used by ${owner.get(key)}`);
      owner.set(key, type);
      assert.equal(canonicalType(a), type, `"${a}" resolves to ${type}`);
    }
  }
});

test('pin aliases resolve to pins of the same symbol and never hide another pin', () => {
  for (const { type } of types) {
    const sym = resolveSymbol({ type });
    for (const [alias, pin] of Object.entries(sym.aliases)) {
      assert.ok(sym.pinOrder.includes(pin), `${type}: alias "${alias}" -> ${pin}`);
      const own = sym.pinOrder.find((p) => p.toLowerCase() === alias);
      assert.ok(!own || own === pin, `${type}: alias "${alias}" hides pin ${own}`);
    }
  }
});

test('every symbol draws at every rotation without NaN or off-grid pins', () => {
  for (const { type } of types) {
    for (const [rotation, mirror] of [[0, false], [90, false], [180, true], [270, false], [45, false]]) {
      const r = render({ components: [{ id: 'X1', type, rotation, ...(mirror ? { mirror } : {}) }], connections: [] });
      assert.ok(r.svg, `${type} @${rotation}: ${r.errors.map((e) => e.message)}`);
      assert.ok(!/NaN|undefined|Infinity/.test(r.svg), `${type} @${rotation}: bad number`);
      const placed = r.scene.instances.get('X1'); // rails and junctions are drawn as markers, not placed
      if (placed && rotation % 90 === 0) {
        for (const [name, p] of Object.entries(placed.pins)) {
          assert.ok(p.x % 10 === 0 && p.y % 10 === 0, `${type}.${name} @${rotation}: pin at ${p.x},${p.y}`);
        }
      }
    }
  }
});

test('box parts keep neighbouring top and bottom pin names apart', () => {
  for (const { type } of types) {
    const def = getDef(type);
    if (def.kind !== 'box') continue;
    const sym = resolveSymbol({ type });
    for (const dir of ['up', 'down']) {
      const row = sym.pinOrder.filter((n) => sym.pins[n].dir === dir).sort((a, b) => sym.pins[a].x - sym.pins[b].x);
      for (let i = 1; i < row.length; i++) {
        const gap = sym.pins[row[i]].x - sym.pins[row[i - 1]].x;
        const need = (textWidth(row[i].replace(/^~/, ''), 9) + textWidth(row[i - 1].replace(/^~/, ''), 9)) / 2;
        // the 555's VCC/RST pair is the tightest existing symbol; nothing may be worse
        assert.ok(gap >= need - 2, `${type}: ${row[i - 1]} / ${row[i]} labels overlap (${gap}px apart, need ${need.toFixed(1)})`);
      }
    }
  }
});

test('every new part has teaching notes, with pin notes that name real pins', () => {
  for (const type of NEW_TYPES) {
    const note = COMPONENT_NOTES[type];
    assert.ok(note, `${type}: notes`);
    assert.ok(note.purpose && note.purpose.length > 15, `${type}: purpose`);
    assert.ok(note.explanation || note.formulas?.length, `${type}: explanation or formulas`);
    const sym = resolveSymbol({ type });
    for (const pin of Object.keys(note.pins || {})) assert.ok(sym.pinOrder.includes(pin), `${type}: note for missing pin ${pin}`);
    const ex = explainType(type);
    assert.equal(ex.type, type);
    if (note.truthTable) {
      const { inputs, outputs = ['Y'], rows } = note.truthTable;
      assert.ok(rows.length >= 2 ** inputs.length || note.truthTable.rows.length > 2, `${type}: rows`);
      for (const row of rows) assert.equal(row.length, inputs.length + outputs.length, `${type}: row width`);
    }
  }
});

test('multi-input gates: truth tables are correct', () => {
  const table = (t) => COMPONENT_NOTES[t].truthTable;
  assert.deepEqual(table('and3').rows.filter((r) => r.at(-1) === 1), [[1, 1, 1, 1]]);
  assert.deepEqual(table('or3').rows.filter((r) => r.at(-1) === 0), [[0, 0, 0, 0]]);
  assert.equal(table('nand4').rows.length, 16);
  assert.deepEqual(table('nand4').rows.filter((r) => r.at(-1) === 0), [[1, 1, 1, 1, 0]]);
  assert.deepEqual(table('nor3').rows.filter((r) => r.at(-1) === 1), [[0, 0, 0, 1]]);
  for (const n of [3, 4]) for (const g of ['and', 'or', 'nand', 'nor']) {
    const sym = resolveSymbol({ type: `${g}${n}` });
    assert.equal(sym.pinOrder.length, n + 1, `${g}${n} pins`);
    assert.equal(resolvePin(sym, 'Y'), sym.pinOrder.at(-1), `${g}${n}: Y reaches the output`);
    assert.equal(resolvePin(sym, 'out'), sym.pinOrder.at(-1));
    assert.equal(sym.pins[sym.pinOrder.at(-1)].io, 'out');
  }
});

test('adders and the BCD table add up', () => {
  const fa = COMPONENT_NOTES.full_adder.truthTable;
  for (const [a, b, c, s, cout] of fa.rows) assert.equal(a + b + c, s + 2 * cout);
  const ha = COMPONENT_NOTES.half_adder.truthTable;
  for (const [a, b, s, c] of ha.rows) assert.equal(a + b, s + 2 * c);
  const bcd = COMPONENT_NOTES.bcd_7seg_decoder.truthTable;
  assert.equal(bcd.rows.length, 10);
  const lit = (n) => bcd.rows[n].slice(4).reduce((x, y) => x + y, 0);
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(lit), [6, 2, 5, 5, 4, 5, 6, 3, 7, 6]);
});

test('new parts take part in the electrical checks', () => {
  const codes = (c) => validate(c).findings.map((f) => `${f.code}:${f.component}`);
  // an IGBT with nothing on its gate is as undefined as a floating MOSFET gate
  const floating = { components: [{ id: 'Q1', type: 'igbt' }, { id: 'V1', type: 'dc_source', value: '12V' }, { id: 'RL', type: 'resistor', value: '10' }, { id: 'GND', type: 'ground' }],
    connections: [['V1.positive', 'RL.1'], ['RL.2', 'Q1.C'], ['Q1.E', 'GND'], ['V1.negative', 'GND']] };
  assert.ok(codes(floating).includes('TRANSISTOR_CONTROL_FLOATING:Q1'));
  // an adjustable regulator needs its ADJ pin fed; ground is not the reference
  const noAdj = { components: [{ id: 'U1', type: 'adjustable_regulator' }, { id: 'V1', type: 'dc_source', value: '12V' }, { id: 'GND', type: 'ground' }, { id: 'RL', type: 'resistor' }],
    connections: [['V1.positive', 'U1.IN'], ['U1.OUT', 'RL.1'], ['RL.2', 'GND'], ['V1.negative', 'GND']] };
  const f = validate(noAdj).findings.find((x) => x.code === 'REGULATOR_IO');
  assert.ok(f && /ADJ/.test(f.message));
  // and it is quiet once wired properly
  noAdj.components.push({ id: 'R1', type: 'resistor', value: '240' }, { id: 'R2', type: 'resistor', value: '720' });
  noAdj.connections.push(['U1.OUT', 'R1.1'], ['R1.2', 'U1.ADJ', 'R2.1'], ['R2.2', 'GND']);
  assert.ok(!codes(noAdj).some((c) => c.startsWith('REGULATOR_IO')));
  // a gate family member that is a latch counts as memory, so a feedback loop through it is not "combinational"
  const loop = { components: [{ id: 'L1', type: 'd_latch' }, { id: 'N1', type: 'not' }], connections: [['L1.Q', 'N1.A'], ['N1.Y', 'L1.D']] };
  assert.ok(!validate(loop).findings.some((x) => x.code === 'COMBINATIONAL_LOOP'));
});

test('new parts route cleanly inside real circuits', () => {
  const dir = new URL('../examples/', import.meta.url);
  for (const f of ['29-adjustable-supply.json', '30-ripple-adder.json', '31-bcd-display.json']) {
    const r = render(JSON.parse(fs.readFileSync(new URL(f, dir), 'utf8')));
    assert.ok(r.valid, f);
    assert.equal(r.scene.layoutInfo.failures, 0, `${f}: routing fallbacks`);
    assert.equal(r.scene.layoutInfo.violations, 0, `${f}: wires through parts`);
    assert.deepEqual(r.warnings, [], f);
  }
});

test('the multi-pin box parts accept their documented aliases', () => {
  const c = minimal();
  c.components.push({ id: 'U1', type: 'nand3' }, { id: 'S1', type: 'usb' }, { id: 'K1', type: 'rtc' });
  c.connections.push(['U1.in1', 'U1.y'].slice(0, 1).concat('R1.1'), ['S1.VBUS', 'K1.VCC'], ['S1.dm', 'K1.SDA']);
  const r = validate(c);
  assert.deepEqual(r.errors, []);
  assert.equal(canonicalType('lm317'), 'adjustable_regulator');
  assert.equal(canonicalType('DS3231'), 'rtc');
  assert.equal(canonicalType('mov'), 'varistor');
});
