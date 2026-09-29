// Shared fixtures for the test suites.
import fs from 'node:fs';

const examplesDir = new URL('../examples/', import.meta.url);

// { '01-led-resistor.json': {...}, ... } — every file in examples/
export function loadExamples() {
  const out = {};
  for (const f of fs.readdirSync(examplesDir).filter((n) => n.endsWith('.json')).sort()) {
    out[f] = JSON.parse(fs.readFileSync(new URL(f, examplesDir), 'utf8'));
  }
  return out;
}

export const clone = (o) => JSON.parse(JSON.stringify(o));

// Small deterministic random source, so failures reproduce.
export function lcg(seed) {
  let s = seed >>> 0;
  const next = () => (s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32;
  next.pick = (list) => list[Math.floor(next() * list.length)];
  next.int = (n) => Math.floor(next() * n);
  return next;
}

// A random logic network: `inputs` input terminals feed `n` two-input gates, each
// wired to earlier outputs, ending in one output terminal. Dense, crossing-heavy.
export function gateNetwork(n, seed = 1, inputs = 8) {
  const rnd = lcg(seed);
  const types = ['and', 'or', 'nand', 'nor', 'xor'];
  const components = [], connections = [], outs = [];
  for (let i = 0; i < inputs; i++) { components.push({ id: `IN${i}`, type: 'input' }); outs.push(`IN${i}.1`); }
  for (let i = 0; i < n; i++) {
    components.push({ id: `G${i}`, type: types[i % types.length] });
    const a = rnd.pick(outs);
    let b = rnd.pick(outs);
    if (b === a) b = outs[0] === a ? outs[1] : outs[0];
    connections.push([a, `G${i}.A`], [b, `G${i}.B`]);
    outs.push(`G${i}.Y`);
  }
  components.push({ id: 'OUT', type: 'output' });
  connections.push([outs[outs.length - 1], 'OUT.1']);
  return { title: `gate network ${n}`, components, connections };
}

// A resistor/capacitor ladder of `n` sections between a source and ground.
export function ladder(n) {
  const components = [{ id: 'V1', type: 'dc_source', value: '5V' }, { id: 'GND', type: 'ground' }];
  const connections = [['V1.negative', 'GND']];
  for (let i = 1; i <= n; i++) {
    components.push({ id: `R${i}`, type: 'resistor', value: '1k' }, { id: `C${i}`, type: 'capacitor', value: '100n' });
    connections.push([i === 1 ? 'V1.positive' : `R${i - 1}.2`, `R${i}.1`], [`R${i}.2`, `C${i}.1`], [`C${i}.2`, 'GND']);
  }
  return { title: `ladder ${n}`, components, connections };
}

export const minimal = () => ({
  title: 'Minimal',
  components: [{ id: 'V1', type: 'dc_source', value: '5V' }, { id: 'R1', type: 'resistor', value: '1k' }],
  connections: [['V1.positive', 'R1.1'], ['R1.2', 'V1.negative']],
});
