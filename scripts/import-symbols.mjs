// Converts symbols from chris-pikul/electronic-symbols (MIT) into the
// CircuitForge normalized format: src/symbols/<type>/{symbol.svg,metadata.json}.
//
//   git clone --depth 1 https://github.com/chris-pikul/electronic-symbols /tmp/es
//   node scripts/import-symbols.mjs /tmp/es
//
// The source tiles are 150x150 on a 25px grid; we scale by 0.4 so leads land
// on CircuitForge's 10px routing grid. Pin coordinates below are in SOURCE units
// (read off each SVG's path data) and are snapped to the grid after scaling.
import fs from 'node:fs';
import path from 'node:path';

const SRC = process.argv[2];
if (!SRC || !fs.existsSync(path.join(SRC, 'SVG'))) {
  console.error('usage: node scripts/import-symbols.mjs <path-to-electronic-symbols-clone>');
  process.exit(1);
}
const OUT = path.resolve('src/symbols');
const SCALE = 0.4;
const LIB = { library: 'chris-pikul/electronic-symbols', url: 'https://github.com/chris-pikul/electronic-symbols', license: 'MIT', copyright: 'Copyright (c) 2022 Chris Pikul' };

const two = (a = '1', b = '2') => ({ [a]: [0, 75, 'left'], [b]: [150, 75, 'right'] });
const DIODE_PINS = { anode: [0, 75, 'left', 'in'], cathode: [150, 75, 'right', 'out'] };
const DIODE_ALIASES = { a: 'anode', k: 'cathode', '1': 'anode', '2': 'cathode', '+': 'anode', '-': 'cathode' };
// Sources are redrawn vertically (positive on top) so polarity glyphs and the
// sine stay upright; circle/lead/glyph geometry is taken from the upstream files.
const SRC_PINS = { positive: [75, 0, 'up'], negative: [75, 150, 'down'] };
const V = (inner) => '<g fill="none" stroke="#000" stroke-miterlimit="10" stroke-width="5">' + inner + '</g>';
const VSRC = {
  dc: V('<circle cx="75" cy="75" r="50"/><path d="M75 25V0m0 125v25M62.5 50h25M75 37.5v25M62.5 100h25"/>'),
  ac: V('<circle cx="75" cy="75" r="50"/><path d="M75 25V0m0 125v25M37 75.38s6.38-15.63 22.13-15.63 9.5 30.75 31.5 30.75S112 75.38 112 75.38"/>'),
  current: V('<circle cx="75" cy="75" r="50"/><path d="M75 25V0m0 125v25M75 112.5V59"/>') + '<path d="M60.04 63.41 75 37.5l14.96 25.91z"/>',
  battery: V('<path d="M50 65.75h50M62.5 84.25h25M75 65.75V0m0 84.25V150M87.5 37.5h25M100 25v25M87.5 112.5h25"/>'),
};
const SRC_ALIASES = { '+': 'positive', '-': 'negative', '1': 'positive', '2': 'negative', p: 'positive', n: 'negative', vcc: 'positive', gnd: 'negative' };
const GATE2 = { A: [0, 50, 'left', 'in'], B: [0, 100, 'left', 'in'], Y: [150, 75, 'right', 'out'] };
const GATE2_ALIASES = { '1': 'A', '2': 'B', '3': 'Y', in1: 'A', in2: 'B', out: 'Y', q: 'Y', o: 'Y', output: 'Y' };
const GATE1 = { A: [0, 75, 'left', 'in'], Y: [150, 75, 'right', 'out'] };
const GATE1_ALIASES = { '1': 'A', '2': 'Y', in: 'A', out: 'Y', input: 'A', output: 'Y' };
const FF_OUT = { Q: [150, 50, 'right', 'out'], QN: [150, 100, 'right', 'out'] };
const FF_ALIASES = { 'q̄': 'QN', q_bar: 'QN', qbar: 'QN', nq: 'QN', '~q': 'QN', clock: 'CLK', clk: 'CLK' };

const M = [
  // ---- passive
  { type: 'resistor', file: 'Resistor-IEEE-Standard', name: 'Resistor', category: 'passive', pins: two(), body: [31, 50, 119, 100], prefix: 'R', typeAliases: ['res', 'r'] },
  { type: 'variable_resistor', file: 'Resistor-IEEE-Rheostat', name: 'Variable resistor', category: 'passive', pins: two(), body: [25, 25, 125, 125], prefix: 'R', typeAliases: ['rheostat'] },
  { type: 'potentiometer', file: 'Resistor-IEEE-Potentiometer', name: 'Potentiometer', category: 'passive', pins: { ...two(), wiper: [75, 150, 'down'] }, aliases: { '3': 'wiper', w: 'wiper' }, body: [31, 50, 119, 125], prefix: 'RV', typeAliases: ['pot'] },
  { type: 'capacitor', file: 'Capacitor-IEEE-NonPolarized', name: 'Capacitor', category: 'passive', pins: two(), body: [50, 44, 88, 106], prefix: 'C', typeAliases: ['cap', 'c'] },
  { type: 'capacitor_polarized', file: 'Capacitor-IEEE-Polarized', name: 'Polarized capacitor', category: 'passive', pins: { negative: [0, 75, 'left'], positive: [150, 75, 'right'] }, aliases: { '+': 'positive', '-': 'negative', '1': 'positive', '2': 'negative' }, body: [50, 30, 134, 106], prefix: 'C', typeAliases: ['electrolytic', 'polarized_capacitor'] },
  { type: 'inductor', file: 'Inductor-COM-Air', name: 'Inductor', category: 'passive', pins: two(), body: [12, 54, 138, 78], prefix: 'L', typeAliases: ['coil', 'l'] },
  { type: 'transformer', file: 'Transformer-COM-Standard', name: 'Transformer', category: 'passive', pins: { p1: [0, 12.5, 'left'], p2: [0, 137.5, 'left'], s1: [150, 12.5, 'right'], s2: [150, 137.5, 'right'] }, aliases: { '1': 'p1', '2': 'p2', '3': 's1', '4': 's2', pri1: 'p1', pri2: 'p2', sec1: 's1', sec2: 's2' }, body: [20, 4, 130, 146], prefix: 'T', shift: [0, 12.5], tile: [150, 175] },
  { type: 'crystal', file: 'Miscellaneous-COM-Crystal_Oscillator', name: 'Crystal', category: 'passive', pins: two(), body: [35, 25, 115, 125], prefix: 'Y', typeAliases: ['xtal'] },
  { type: 'fuse', file: 'Fuse-IEEE', name: 'Fuse', category: 'passive', pins: two(), body: [25, 50, 125, 100], prefix: 'F' },
  { type: 'switch', file: 'Switch-COM-SPST', name: 'Switch (SPST)', category: 'passive', pins: two(), body: [30, 34, 120, 82], prefix: 'SW', typeAliases: ['spst'] },
  { type: 'push_button', file: 'Switch-COM-Pushbutton-NO', name: 'Push button', category: 'passive', pins: two(), body: [37, 28, 113, 82], prefix: 'SW', typeAliases: ['button', 'pushbutton'] },
  // ---- semiconductor
  { type: 'diode', file: 'Diode-COM-Standard', name: 'Diode', category: 'semiconductor', pins: DIODE_PINS, aliases: DIODE_ALIASES, body: [50, 40, 100, 110], prefix: 'D', typeAliases: ['d'] },
  { type: 'led', file: 'Diode-COM-LED', name: 'LED', category: 'semiconductor', pins: DIODE_PINS, aliases: DIODE_ALIASES, body: [50, 4, 146, 110], prefix: 'D' },
  { type: 'zener', file: 'Diode-COM-Zener', name: 'Zener diode', category: 'semiconductor', pins: DIODE_PINS, aliases: DIODE_ALIASES, body: [50, 38, 115, 112], prefix: 'D', typeAliases: ['zener_diode'] },
  { type: 'photodiode', file: 'Diode-COM-Photodiode', name: 'Photodiode', category: 'semiconductor', pins: DIODE_PINS, aliases: DIODE_ALIASES, body: [50, 10, 125, 110], prefix: 'D' },
  { type: 'schottky', file: 'Diode-COM-Shottky', name: 'Schottky diode', category: 'semiconductor', pins: DIODE_PINS, aliases: DIODE_ALIASES, body: [50, 38, 115, 112], prefix: 'D', typeAliases: ['schottky_diode'] },
  { type: 'npn', file: 'Transistor-COM-BJT-NPN', name: 'NPN transistor', category: 'semiconductor', pins: { B: [0, 75, 'left', 'in'], C: [100, 0, 'up'], E: [100, 150, 'down'] }, aliases: { base: 'B', collector: 'C', emitter: 'E' }, body: [25, 25, 125, 125], prefix: 'Q', labels: 'right', required: ['B', 'C', 'E'], typeAliases: ['bjt_npn', 'npn_transistor'] },
  { type: 'pnp', file: 'Transistor-COM-BJT-PNP', name: 'PNP transistor', category: 'semiconductor', pins: { B: [0, 75, 'left', 'in'], E: [100, 0, 'up'], C: [100, 150, 'down'] }, aliases: { base: 'B', collector: 'C', emitter: 'E' }, body: [25, 25, 125, 125], prefix: 'Q', labels: 'right', required: ['B', 'C', 'E'], typeAliases: ['bjt_pnp', 'pnp_transistor'] },
  { type: 'nmos', file: 'Transistor-COM-MOSFET-N-Enhancement', name: 'N-channel MOSFET', category: 'semiconductor', pins: { G: [0, 75, 'left', 'in'], D: [100, 0, 'up'], S: [100, 150, 'down'] }, aliases: { gate: 'G', drain: 'D', source: 'S' }, body: [25, 25, 125, 125], prefix: 'Q', labels: 'right', required: ['G', 'D', 'S'], typeAliases: ['nmosfet', 'mosfet_n'] },
  { type: 'pmos', file: 'Transistor-COM-MOSFET-P-Enhancement', name: 'P-channel MOSFET', category: 'semiconductor', pins: { G: [0, 75, 'left', 'in'], S: [100, 0, 'up'], D: [100, 150, 'down'] }, aliases: { gate: 'G', drain: 'D', source: 'S' }, body: [25, 25, 125, 125], prefix: 'Q', labels: 'right', required: ['G', 'D', 'S'], typeAliases: ['pmosfet', 'mosfet_p'] },
  { type: 'jfet', file: 'Transistor-COM-JFET-N', name: 'N-channel JFET', category: 'semiconductor', pins: { G: [0, 75, 'left', 'in'], D: [100, 0, 'up'], S: [100, 150, 'down'] }, aliases: { gate: 'G', drain: 'D', source: 'S' }, body: [25, 25, 125, 125], prefix: 'Q', labels: 'right', required: ['G', 'D', 'S'], typeAliases: ['jfet_n', 'njfet'] },
  { type: 'jfet_p', file: 'Transistor-COM-JFET-P', name: 'P-channel JFET', category: 'semiconductor', pins: { G: [0, 75, 'left', 'in'], S: [100, 0, 'up'], D: [100, 150, 'down'] }, aliases: { gate: 'G', drain: 'D', source: 'S' }, body: [25, 25, 125, 125], prefix: 'Q', labels: 'right', required: ['G', 'D', 'S'], typeAliases: ['pjfet'] },
  // ---- analog
  { type: 'opamp', file: 'IC-COM-OpAmp', name: 'Op-amp', category: 'analog', pins: { 'in+': [0, 50, 'left', 'in'], 'in-': [0, 100, 'left', 'in'], out: [150, 75, 'right', 'out'], 'v+': [75, 0, 'up', 'power'], 'v-': [75, 150, 'down', 'power'] }, aliases: { '+': 'in+', '-': 'in-', non_inverting: 'in+', inverting: 'in-', inp: 'in+', inn: 'in-', output: 'out', o: 'out', vcc: 'v+', vee: 'v-', 'vs+': 'v+', 'vs-': 'v-' }, body: [25, 25, 125, 125], prefix: 'U', labels: 'topright', required: ['in+', 'in-', 'out'], typeAliases: ['op_amp', 'operational_amplifier'] },
  { type: 'comparator', file: 'IC-COM-Comparator', name: 'Comparator', category: 'analog', pins: { 'in+': [0, 50, 'left', 'in'], 'in-': [0, 100, 'left', 'in'], out: [150, 75, 'right', 'out'] }, aliases: { '+': 'in+', '-': 'in-', inp: 'in+', inn: 'in-', output: 'out' }, body: [25, 25, 125, 125], prefix: 'U', labels: 'topright', required: ['in+', 'in-', 'out'] },
  { type: 'dc_source', file: 'Source-COM-DC', name: 'DC voltage source', category: 'analog', pins: SRC_PINS, aliases: SRC_ALIASES, body: [25, 25, 125, 125], prefix: 'V', source: true, svg: VSRC.dc, required: ['positive', 'negative'], typeAliases: ['dc_supply', 'voltage_source', 'vsource', 'dc'] },
  { type: 'ac_source', file: 'Source-COM-AC', name: 'AC voltage source', category: 'analog', pins: SRC_PINS, aliases: { ...SRC_ALIASES, l: 'positive', n: 'negative' }, body: [25, 25, 125, 125], prefix: 'V', source: true, svg: VSRC.ac, required: ['positive', 'negative'], typeAliases: ['ac', 'sine_source'] },
  { type: 'current_source', file: 'Source-COM-Current', name: 'Current source', category: 'analog', pins: SRC_PINS, aliases: SRC_ALIASES, body: [25, 25, 125, 125], prefix: 'I', source: true, svg: VSRC.current, required: ['positive', 'negative'], typeAliases: ['isource'] },
  { type: 'battery', file: 'Source-COM-Battery-Single', name: 'Battery', category: 'power', pins: SRC_PINS, aliases: SRC_ALIASES, body: [45, 25, 115, 120], prefix: 'BT', source: true, svg: VSRC.battery, required: ['positive', 'negative'], typeAliases: ['cell'] },
  // ---- digital
  { type: 'and', file: 'IC-COM-Logic-AND', name: 'AND gate', category: 'digital', pins: GATE2, aliases: GATE2_ALIASES, body: [31, 37.5, 112.5, 112.5], prefix: 'U', labels: 'top', typeAliases: ['and_gate'] },
  { type: 'or', file: 'IC-COM-Logic-OR', name: 'OR gate', category: 'digital', pins: GATE2, aliases: GATE2_ALIASES, body: [31, 37.5, 112.5, 112.5], prefix: 'U', labels: 'top', typeAliases: ['or_gate'] },
  { type: 'nand', file: 'IC-COM-Logic-NAND', name: 'NAND gate', category: 'digital', pins: GATE2, aliases: GATE2_ALIASES, body: [31, 37.5, 135, 112.5], prefix: 'U', labels: 'top', typeAliases: ['nand_gate'] },
  { type: 'nor', file: 'IC-COM-Logic-NOR', name: 'NOR gate', category: 'digital', pins: GATE2, aliases: GATE2_ALIASES, body: [31, 37.5, 135, 112.5], prefix: 'U', labels: 'top', typeAliases: ['nor_gate'] },
  { type: 'xor', file: 'IC-COM-Logic-XOR', name: 'XOR gate', category: 'digital', pins: GATE2, aliases: GATE2_ALIASES, body: [18, 37.5, 112.5, 112.5], prefix: 'U', labels: 'top', typeAliases: ['xor_gate'] },
  { type: 'xnor', file: 'IC-COM-Logic-XNOR', name: 'XNOR gate', category: 'digital', pins: GATE2, aliases: GATE2_ALIASES, body: [18, 37.5, 135, 112.5], prefix: 'U', labels: 'top', typeAliases: ['xnor_gate'] },
  { type: 'buffer', file: 'IC-COM-Logic-Buffer', name: 'Buffer', category: 'digital', pins: GATE1, aliases: GATE1_ALIASES, body: [25, 37.5, 112.5, 112.5], prefix: 'U', labels: 'top' },
  { type: 'not', file: 'IC-COM-Logic-Inverter', name: 'NOT gate (inverter)', category: 'digital', pins: GATE1, aliases: GATE1_ALIASES, body: [22, 37.5, 138, 112.5], prefix: 'U', labels: 'top', typeAliases: ['inverter', 'not_gate'] },
  // Derived: buffer + enable input drawn to the triangle's upper edge.
  { type: 'tristate_buffer', file: 'IC-COM-Logic-Buffer', name: 'Tri-state buffer', category: 'digital', pins: { ...GATE1, EN: [75, 0, 'up', 'in'] }, aliases: { ...GATE1_ALIASES, oe: 'EN', en: 'EN', enable: 'EN', '3': 'EN' }, body: [25, 37.5, 112.5, 112.5], prefix: 'U', labels: 'right', extra: '<path fill="none" stroke="#000" stroke-width="5" d="M75 0v58.9"/>', derived: true, typeAliases: ['tristate', 'tri_state_buffer'] },
  { type: 'd_flipflop', file: 'IC-COM-FlipFlop-ClockedD', name: 'D flip-flop', category: 'digital', pins: { D: [0, 50, 'left', 'in'], CLK: [0, 100, 'left', 'in'], ...FF_OUT, S: [75, 0, 'up', 'in'], R: [75, 150, 'down', 'in'] }, aliases: { ...FF_ALIASES, set: 'S', pre: 'S', preset: 'S', reset: 'R', clr: 'R', clear: 'R' }, body: [25, 12.5, 125, 137.5], prefix: 'U', labels: 'top', required: ['D', 'CLK'], typeAliases: ['dff', 'flipflop_d'] },
  { type: 'jk_flipflop', file: 'IC-COM-FlipFlop-ClockedJK', name: 'JK flip-flop', category: 'digital', pins: { J: [0, 50, 'left', 'in'], CLK: [0, 75, 'left', 'in'], K: [0, 100, 'left', 'in'], ...FF_OUT }, aliases: FF_ALIASES, body: [25, 12.5, 125, 137.5], prefix: 'U', labels: 'top', required: ['J', 'K', 'CLK'], typeAliases: ['jkff', 'flipflop_jk'] },
  { type: 't_flipflop', file: 'IC-COM-FlipFlop-ClockedT', name: 'T flip-flop', category: 'digital', pins: { T: [0, 50, 'left', 'in'], CLK: [0, 100, 'left', 'in'], ...FF_OUT }, aliases: FF_ALIASES, body: [25, 12.5, 125, 137.5], prefix: 'U', labels: 'top', required: ['T', 'CLK'], typeAliases: ['tff', 'flipflop_t'] },
  { type: 'sr_flipflop', file: 'IC-COM-FlipFlop-GatedSR', name: 'SR flip-flop (gated)', category: 'digital', pins: { S: [0, 50, 'left', 'in'], E: [0, 75, 'left', 'in'], R: [0, 100, 'left', 'in'], ...FF_OUT }, aliases: { ...FF_ALIASES, en: 'E', enable: 'E', CLK: 'E' }, body: [25, 12.5, 125, 137.5], prefix: 'U', labels: 'top', required: ['S', 'R'], typeAliases: ['srff', 'sr_latch', 'flipflop_sr'] },
  // ---- converters
  { type: 'adc', file: 'Miscellaneous-COM-ADC', name: 'ADC', category: 'ic', pins: { IN: [0, 75, 'left', 'in'], OUT: [150, 75, 'right', 'out'] }, aliases: { ain: 'IN', dout: 'OUT', '1': 'IN', '2': 'OUT' }, body: [25, 37.5, 125, 112.5], prefix: 'U', labels: 'top', typeAliases: ['analog_to_digital'] },
  { type: 'dac', file: 'Miscellaneous-COM-DAC', name: 'DAC', category: 'ic', pins: { IN: [0, 75, 'left', 'in'], OUT: [150, 75, 'right', 'out'] }, aliases: { din: 'IN', aout: 'OUT', '1': 'IN', '2': 'OUT' }, body: [25, 37.5, 125, 112.5], prefix: 'U', labels: 'top', typeAliases: ['digital_to_analog'] },
  // ---- power markers
  { type: 'ground', file: 'Ground-COM-General', name: 'Ground', category: 'power', pins: { '1': [75, 0, 'up'] }, aliases: { gnd: '1' }, body: [25, 70, 125, 128], rail: 'ground', typeAliases: ['gnd', 'earth'] },
];

const snap = (v) => Math.round(v / 10) * 10;
const sc = (v) => +(v * SCALE).toFixed(2);

for (const m of M) {
  const file = path.join(SRC, 'SVG', m.file + '.svg');
  let svg = fs.readFileSync(file, 'utf8');
  let inner = m.svg || svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').trim();
  if (m.extra) inner += '\n' + m.extra;
  // Normalize colors: strokes follow currentColor, unfilled glyph paths get currentColor fill.
  // Shapes with no fill of their own (and no inherited fill from a <g>) are solid glyphs.
  const stack = [];
  inner = inner
    .replace(/stroke="#000"/g, 'stroke="currentColor"')
    .replace(/stroke-width="5"/g, 'stroke-width="4"')
    .replace(/<(\/?)(\w+)([^>]*?)(\/?)>/g, (all, close, tag, attrs, self) => {
      if (tag === 'g') {
        if (close) stack.pop(); else stack.push(/\bfill=/.test(attrs));
        return all;
      }
      if (!close && (tag === 'path' || tag === 'circle') && !/\bfill=/.test(attrs) && !stack.some(Boolean))
        return `<${tag} fill="currentColor"${attrs}${self}>`;
      return all;
    });
  const [shx, shy] = m.shift || [0, 0];
  const [tw, th] = (m.tile || [150, 150]).map(sc);
  const out = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${tw} ${th}" width="${tw}" height="${th}">\n<g transform="scale(${SCALE}) translate(${shx} ${shy})">\n${inner}\n</g>\n</svg>\n`;

  const pins = {};
  for (let [name, [x, y, dir, io]] of Object.entries(m.pins)) {
    x += shx; y += shy;
    const sx = snap(x * SCALE), sy = snap(y * SCALE);
    if (Math.abs(sx - x * SCALE) > 1 || Math.abs(sy - y * SCALE) > 1) throw new Error(`${m.type}.${name} off-grid`);
    pins[name] = { x: sx, y: sy, dir, ...(io ? { io } : {}) };
  }
  const [bx0, by0, bx1, by1] = [m.body[0] + shx, m.body[1] + shy, m.body[2] + shx, m.body[3] + shy];
  const meta = {
    type: m.type,
    name: m.name,
    category: m.category,
    svg: 'symbol.svg',
    width: tw,
    height: th,
    pins,
    ...(m.aliases ? { aliases: m.aliases } : {}),
    body: { x: sc(bx0), y: sc(by0), w: sc(bx1 - bx0), h: sc(by1 - by0) },
    ...(m.prefix ? { prefix: m.prefix } : {}),
    ...(m.labels ? { labels: m.labels } : {}),
    ...(m.required ? { required: m.required } : {}),
    ...(m.source ? { source: true } : {}),
    ...(m.rail ? { rail: m.rail } : {}),
    ...(m.defaultRotation ? { defaultRotation: m.defaultRotation } : {}),
    ...(m.typeAliases ? { typeAliases: m.typeAliases } : {}),
    origin: { ...LIB, file: `SVG/${m.file}.svg`, ...(m.derived ? { modified: 'enable pin added by CircuitForge' } : {}), ...(m.svg ? { modified: 'redrawn vertically (positive up) from the upstream geometry' } : {}), modified_note: 'scaled 0.4, stroke normalized to currentColor' },
  };
  const dir = path.join(OUT, m.type);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'symbol.svg'), out);
  fs.writeFileSync(path.join(dir, 'metadata.json'), JSON.stringify(meta, null, 2) + '\n');
}
console.log(`imported ${M.length} symbols from ${LIB.library}`);
