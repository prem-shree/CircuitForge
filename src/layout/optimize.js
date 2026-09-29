// Spacing intelligence.
//
// Every layout is scored after routing: routing fallbacks and wires on top of
// each other or through parts are near-fatal, labels sitting on wires are bad,
// crossings and bends cost readability, and length and area stand in for
// "tidy and compact". Crossings mostly follow from the topology, so they
// count in the score but never trigger a retry on their own. When an attempt
// has problems, the optimizer works out
// *where* they are and opens room only there — the gap between two columns
// where wires crowd, more clearance where parts are packed too tightly — then
// tries again and keeps the best-scoring sheet. Clean layouts stop at once, so
// simple circuits cost a single pass.
import { layoutCircuit, layoutStats } from './index.js';
import { normalizeLayout } from './config.js';
import { placeLabels, labelConflicts } from './labels.js';
import { routeCircuit } from '../router/index.js';
import { unionRect, boundsOf } from '../utils/geometry.js';

const MAX_ATTEMPTS = 4;
// Routing effort (A* expansions) one drawing may spend across all attempts. It
// counts work rather than seconds so the same circuit is drawn the same way on
// every machine. Small circuits never come near it; a very large one gets its
// first attempt and is not retried.
export const WORK_BUDGET = 2.5e6;
const NO_WIRES = { nets: new Map() };

export function measureLayout(placement, routing) {
  const insts = [...placement.instances.values()];
  let bends = 0, length = 0, box = null;
  for (const n of routing.nets.values()) {
    for (const p of n.paths) bends += Math.max(0, p.length - 2);
    for (const s of n.segments) {
      length += Math.abs(s.x2 - s.x1) + Math.abs(s.y2 - s.y1);
      box = unionRect(box, boundsOf([{ x: s.x1, y: s.y1 }, { x: s.x2, y: s.y2 }]));
    }
  }
  for (const I of insts) box = unionRect(box, I.extent);
  const labelHits = labelConflicts(placement.instances, routing);
  const failures = routing.failures.length;
  const violations = routing.violations.length;
  const crossings = routing.crossings.length;
  const width = box ? Math.round(box.w) : 0, height = box ? Math.round(box.h) : 0;
  // a label on a wire costs less than a sheet that sprawls to avoid it
  const score = failures * 1000 + violations * 400 + labelHits.length * 20 + crossings * 12
    + bends * 3 + length * 0.01 + Math.sqrt(width * height) * 0.15;
  const clean = !failures && !violations && !labelHits.length;
  return {
    score: Math.round(score * 10) / 10, clean, failures, violations, crossings, bends,
    wireLength: Math.round(length), labelHits: labelHits.length, width, height, problems: labelHits,
  };
}

// Extra net orders tried on one placement when the first routing leaves a few
// crossings. A handful can often be routed away; hundreds are forced by the
// topology and no order removes them, so those sheets are not retried.
const EXTRA_ORDERS = 3;
const MAX_AVOIDABLE_CROSSINGS = 10;

function attempt(nl, circuit, cfg, extraGap, workLeft, verticalFlex = false) {
  const placement = layoutCircuit(nl, circuit, { cfg, extraGap, verticalFlex });
  // choose label spots first so the router keeps wires off them, then make
  // the final choice once the wires are known
  placeLabels(placement.instances, NO_WIRES);
  const route = (seed) => {
    const routing = routeCircuit(nl, placement.instances, { seed });
    placeLabels(placement.instances, routing);
    return { routing, metrics: measureLayout(placement, routing) };
  };
  let best = route(0), spent = best.routing.work || 0, tried = 1;
  const settled = (m) => (m.clean && !m.crossings) || m.crossings > MAX_AVOIDABLE_CROSSINGS;
  for (let seed = 1; seed <= EXTRA_ORDERS && !settled(best.metrics) && spent + (best.routing.work || 0) <= workLeft; seed++) {
    const alt = route(seed);
    spent += alt.routing.work || 0;
    tried++;
    if (alt.metrics.score < best.metrics.score) best = alt;
  }
  // the last order tried left its labels behind; restore the winner's
  placeLabels(placement.instances, best.routing);
  best.metrics = measureLayout(placement, best.routing);
  return { placement, routing: best.routing, cfg, extraGap, metrics: best.metrics, work: spent, orders: tried, verticalFlex };
}

// Map each problem spot to the column gap it sits in and widen that gap; a
// problem inside a column asks for more clearance around parts instead.
function congestionFix(a, base) {
  const { placement, routing, cfg } = a;
  const extra = [...(a.extraGap || [])];
  const cols = new Map();
  for (const [id, I] of placement.instances) {
    const L = placement.layers.get(id);
    const c = cols.get(L) || { L, x1: Infinity, x2: -Infinity };
    c.x1 = Math.min(c.x1, I.extent.x);
    c.x2 = Math.max(c.x2, I.extent.x + I.extent.w);
    cols.set(L, c);
  }
  const ordered = [...cols.values()].sort((p, q) => p.L - q.L);
  const spots = [
    ...routing.failures.map((f) => placement.instances.get(f.comp)?.pins[f.pin]).filter(Boolean),
    ...routing.violations.filter((v) => Number.isFinite(v.x)),
    ...a.metrics.problems,
  ];
  let inColumn = false, changed = false;
  const cap = base.componentGap * 3;
  for (const s of spots) {
    let hit = false;
    for (let i = 1; i < ordered.length; i++) {
      const prev = ordered[i - 1], col = ordered[i];
      if (s.x > prev.x2 - 5 && s.x < col.x1 + 5) {
        if ((extra[col.L] || 0) < cap) { extra[col.L] = (extra[col.L] || 0) + 20; changed = true; }
        hit = true;
        break;
      }
    }
    if (!hit) inColumn = true;
  }
  const next = { ...cfg };
  if (inColumn && !base.fixed.includes('wireGap') && next.wireGap < base.wireGap + 18) { next.wireGap += 6; changed = true; }
  if (a.metrics.labelHits && !base.fixed.includes('labelGap') && next.labelGap < base.labelGap + 6) { next.labelGap += 2; changed = true; }
  if (!changed && !base.fixed.includes('componentGap') && next.componentGap < base.componentGap * 2) {
    next.componentGap += 20;
    changed = true;
  }
  return changed ? { cfg: next, extra } : null;
}

export function planLayout(nl, circuit = {}, opts = {}) {
  const budget = opts.workBudget ?? WORK_BUDGET;
  const base = normalizeLayout(circuit, layoutStats(nl));
  // nothing to optimize when every part has a position the user chose
  const auto = nl.parts.some((p) => !p.comp.position);
  const optimizing = base.optimize && auto;
  const tries = optimizing ? MAX_ATTEMPTS : 1;
  let cfg = base, extra = [];
  let best = null, chosen = 0, spent = 0, vertical = false;
  const history = [];
  const record = (a) => {
    const { problems, ...summary } = a.metrics;
    history.push({ ...summary, componentGap: a.cfg.componentGap, wireGap: a.cfg.wireGap, labelGap: a.cfg.labelGap, extraGap: (a.extraGap || []).filter(Boolean).length, ...(a.verticalFlex ? { verticalFlex: true } : {}) });
    if (!best || a.metrics.score < best.metrics.score) { best = a; chosen = history.length - 1; }
  };
  for (let i = 0; i < tries; i++) {
    let a = attempt(nl, circuit, cfg, extra, budget - spent, vertical);
    record(a);
    spent += a.work;
    // Parts that bridge two placed nets can also be laid out standing up. That is
    // a different sheet, not a tweak, so lay it out too and keep the better one.
    if (optimizing && i === 0 && a.placement.flex.eligible && spent + a.work <= budget) {
      const v = attempt(nl, circuit, cfg, extra, budget - spent, true);
      if (v.placement.flex.switched) {
        record(v);
        spent += v.work;
        if (v.metrics.score < a.metrics.score) { a = v; vertical = true; }
      }
    }
    if (best.metrics.clean) break;
    // another attempt costs about as much as this one did
    if (spent + a.work > budget) break;
    const next = congestionFix(a, base);
    if (!next) break;
    cfg = next.cfg;
    extra = next.extra;
  }
  const { problems, ...metrics } = best.metrics;
  return {
    placement: best.placement,
    routing: best.routing,
    config: best.cfg,
    metrics: { ...metrics, attempts: history.length, chosen, history, bridges: best.placement.bridges || 0 },
  };
}
