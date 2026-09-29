// Guards against regressions in speed and drawing quality.
//
// Routing effort is counted in A* expansions, which is deterministic, so those
// limits are tight. Wall-clock limits are generous (they only catch a return to
// the old behaviour, e.g. seconds where it should be fractions of one).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { render, buildScene } from '../src/engine.js';
import { validateCircuit } from '../src/validator/index.js';
import { buildNetlist } from '../src/graph/index.js';
import { layoutCircuit } from '../src/layout/index.js';
import { placeLabels } from '../src/layout/labels.js';
import { routeCircuit } from '../src/router/index.js';
import { planLayout, WORK_BUDGET } from '../src/layout/optimize.js';
import { loadExamples, gateNetwork, ladder } from './helpers.js';

const routeOnce = (circuit) => {
  const nl = buildNetlist(validateCircuit(circuit));
  const placement = layoutCircuit(nl, circuit);
  placeLabels(placement.instances, { nets: new Map() });
  return routeCircuit(nl, placement.instances);
};

// [crossings, bends, score] for every shipped example. These are ceilings: a change
// may improve a drawing, but must not make one worse.
const CEILING = {
  '01-led-resistor': [0, 2, 40], '02-voltage-divider': [0, 4, 43], '03-rc-lowpass': [0, 2, 49], '04-rl-circuit': [0, 2, 46],
  '05-rlc-series': [0, 4, 53], '06-diode-rectifier': [0, 4, 61], '07-transistor-switch': [0, 0, 51], '08-bjt-amplifier': [0, 3, 79],
  '09-mosfet-switch': [0, 3, 83], '10-opamp-inverting': [0, 4, 67], '11-comparator': [0, 10, 104], '12-555-astable': [0, 9, 97],
  '13-logic-full-adder': [4, 14, 153], '14-flipflop-counter': [2, 14, 119], '15-counter': [0, 10, 85], '16-shift-register': [1, 12, 136],
  '17-button-input': [0, 2, 70], '18-microcontroller': [0, 16, 161], '19-pwm-motor': [0, 9, 113], '20-regulated-supply': [0, 4, 64],
  '21-adc-input': [0, 5, 82], '22-uart-link': [0, 1, 66], '23-i2c-bus': [0, 9, 111], '24-spi-bus': [4, 20, 209],
  '25-mcu-led-button': [0, 5, 85], '26-rgb-seven-segment': [0, 6, 117], '27-bridge-rectifier': [0, 6, 73], '28-wheatstone-bridge': [0, 2, 45],
  '29-adjustable-supply': [0, 14, 123], '30-ripple-adder': [2, 14, 148], '31-bcd-display': [7, 28, 293], 'complete-circuit': [0, 17, 235],
};

test('every example draws no worse than its recorded ceiling', () => {
  const examples = loadExamples();
  for (const [file, doc] of Object.entries(examples)) {
    const name = file.replace(/\.json$/, '');
    assert.ok(CEILING[name], `${name}: add it to CEILING (measure with layoutInfo)`);
    const info = buildScene(doc).scene.layoutInfo;
    const [cross, bends, score] = CEILING[name];
    assert.equal(info.failures, 0, `${name}: routing fallbacks`);
    assert.equal(info.violations, 0, `${name}: wires through parts or on each other`);
    assert.ok(info.crossings <= cross, `${name}: ${info.crossings} crossings (ceiling ${cross})`);
    assert.ok(info.bends <= bends + 1, `${name}: ${info.bends} bends (ceiling ${bends})`);
    assert.ok(info.score <= score * 1.03 + 1, `${name}: score ${info.score} (ceiling ${score})`);
  }
});

test('routing effort on dense logic stays within its recorded budget', () => {
  // measured: 52k, 280k, 1.08M expansions; allow 15% before this fails
  for (const [n, seed, limit] of [[20, 1, 60000], [40, 3, 322000], [80, 5, 1245000]]) {
    const r = routeOnce(gateNetwork(n, seed));
    assert.equal(r.failures.length, 0, `${n} gates: routed completely`);
    assert.ok(r.work <= limit, `${n} gates: ${r.work} expansions (limit ${limit})`);
  }
});

test('the same circuit always draws the same way, however large', () => {
  for (const c of [gateNetwork(30, 4), ladder(40), loadExamples()['30-ripple-adder.json']]) {
    assert.equal(render(c).svg, render(c).svg);
  }
});

test('the optimizer never spends more than its work budget after the first attempt', () => {
  const c = gateNetwork(60, 2);
  const nl = buildNetlist(validateCircuit(c));
  const tight = planLayout(nl, c, { workBudget: 1 });
  assert.equal(tight.metrics.attempts, 1, 'a tiny budget allows only the first attempt');
  const roomy = planLayout(nl, c, { workBudget: WORK_BUDGET * 10 });
  assert.ok(roomy.metrics.attempts >= 1);
  assert.ok(roomy.metrics.score <= tight.metrics.score, 'more effort never gives a worse sheet');
});

test('big sheets render in reasonable time', () => {
  const timed = (c) => { const t0 = Date.now(); const r = render(c); return { ms: Date.now() - t0, r }; };
  const wide = timed(ladder(100)); // 200 parts in a row
  assert.ok(wide.r.valid);
  assert.ok(wide.ms < 3000, `ladder(100): ${wide.ms} ms`);
  const dense = timed(gateNetwork(80, 5));
  assert.ok(dense.r.valid);
  assert.ok(dense.ms < 6000, `80 gates: ${dense.ms} ms`);
  assert.equal(dense.r.warnings.filter((w) => w.code === 'ROUTING_FAILURE').length, 0);
});

test('the router treats grid cells, not pixels, as its unit of memory', () => {
  // a normal sheet needs a few tens of thousands of cells, far below the cap
  const r = render(gateNetwork(40, 3));
  assert.ok(r.width * r.height < 4e6);
  assert.ok(r.scene.routing.work > 0);
});
