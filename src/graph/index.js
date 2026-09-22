// Validated circuit -> electrical netlist.
// Rail components (ground, VCC, net labels…) and junctions are not placed; they
// merge nets and mark them as rails. Rails are drawn as a marker at every pin.
import { resolveSymbol } from '../symbol-loader/index.js';

const RAIL_PRIORITY = { ground: 4, negative: 3, power: 2, label: 1 };

export function buildNetlist(validation) {
  const { comps, connections } = validation.resolved;
  const parent = new Map();
  const find = (k) => {
    if (!parent.has(k)) parent.set(k, k);
    let r = k;
    while (parent.get(r) !== r) r = parent.get(r);
    while (parent.get(k) !== r) { const n = parent.get(k); parent.set(k, r); k = n; }
    return r;
  };
  const union = (a, b) => parent.set(find(a), find(b));

  const parts = [];
  const railOf = new Map(); // rail key -> {kind, name, type}
  for (const [id, entry] of comps) {
    if (!entry) continue;
    const { comp, sym } = entry;
    if (sym.rail) {
      const name = String(comp.value ?? comp.label ?? (sym.rail === 'label' ? id : sym.text?.default ?? 'GND'));
      const key = `rail:${sym.rail === 'ground' ? 'ground:' : ''}${name}`;
      union(`${id}.${sym.pinOrder[0]}`, key);
      const prev = railOf.get(key);
      if (!prev || RAIL_PRIORITY[sym.rail] > RAIL_PRIORITY[prev.kind]) railOf.set(key, { kind: sym.rail, name, type: sym.type });
    } else if (sym.kind === 'virtual') {
      find(`${id}.${sym.pinOrder[0]}`);
    } else {
      parts.push({ id, comp, sym, pinNets: {} });
    }
  }
  for (const c of connections) {
    const keys = c.ends.map((e) => `${e.comp}.${e.pin}`);
    for (let i = 1; i < keys.length; i++) union(keys[0], keys[i]);
    if (c.name) union(keys[0], `named:${c.name}`);
  }

  // Group keys by root.
  const groups = new Map();
  for (const k of parent.keys()) {
    const r = find(k);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r).push(k);
  }
  const partIds = new Set(parts.map((p) => p.id));
  const nets = new Map();
  const keyToNet = new Map();
  let n = 0;
  for (const keys of groups.values()) {
    const pins = [];
    const rails = [];
    let rail = null, name = null;
    for (const k of keys) {
      if (k.startsWith('rail:')) {
        const r = railOf.get(k);
        rails.push(r);
        if (!rail || RAIL_PRIORITY[r.kind] > RAIL_PRIORITY[rail.kind]) rail = r;
      } else if (k.startsWith('named:')) name = name || k.slice(6);
      else {
        const i = k.indexOf('.');
        const comp = k.slice(0, i), pin = k.slice(i + 1);
        if (partIds.has(comp)) pins.push({ comp, pin });
      }
    }
    if (!pins.length) continue;
    const id = `N${++n}`;
    if (rail) rail = { ...rail, sym: resolveSymbol({ type: rail.type }) };
    nets.set(id, { id, name: rail ? rail.name : name, pins, rail, rails });
    for (const k of keys) keyToNet.set(k, id);
  }
  for (const p of parts) {
    for (const pin of p.sym.pinOrder) {
      const net = keyToNet.get(`${p.id}.${pin}`);
      if (net) p.pinNets[pin] = net;
    }
  }

  // Per-connection wire hints (waypoints / manual routes) and net classes.
  const hints = [];
  for (const c of connections) {
    const net = keyToNet.get(`${c.ends[0].comp}.${c.ends[0].pin}`);
    if (!net) continue;
    if (c.class && nets.has(net)) nets.get(net).class = nets.get(net).class || c.class;
    if (c.waypoints || c.route) {
      hints.push({ net, ends: c.ends.filter((e) => partIds.has(e.comp)), waypoints: c.waypoints, route: c.route, locked: c.locked, path: c.path });
    }
  }
  for (const [, net] of nets) {
    if (net.class) continue;
    net.class = net.rail ? (net.rail.kind === 'ground' || net.rail.kind === 'negative' ? 'ground' : net.rail.kind === 'power' ? 'power' : 'signal') : 'signal';
  }

  // Without an explicit ground, the first source's negative net acts as the
  // return path: it is laid out like ground but drawn with real wires.
  let returnNet = null;
  const hasGround = [...nets.values()].some((x) => x.rail && (x.rail.kind === 'ground' || x.rail.kind === 'negative'));
  if (!hasGround) {
    const src = parts.find((p) => p.sym.source && p.pinNets.negative && !nets.get(p.pinNets.negative).rail);
    if (src) returnNet = src.pinNets.negative;
  }
  return { parts, nets, returnNet, hints, connections };
}
