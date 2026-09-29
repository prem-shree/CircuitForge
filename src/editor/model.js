// Pure mutations on the circuit JSON object. Canvas edits go through these so
// the JSON stays the single source of truth.
import { parseRef } from '../parser/index.js';
import { resolveSymbol, resolvePin } from '../symbol-loader/index.js';
import { normAngle } from '../utils/geometry.js';
import { setPath } from '../utils/path.js';
import { has } from '../utils/safe.js';

const clone = (o) => JSON.parse(JSON.stringify(o));

// Compact, readable JSON: short arrays/objects stay on one line.
export function formatJSON(value, indent = '') {
  const flat = JSON.stringify(value);
  if (flat === undefined) return 'null';
  const simple = (v) => v === null || typeof v !== 'object' || (Array.isArray(v) ? v.every((x) => x === null || typeof x !== 'object') : Object.values(v).every((x) => x === null || typeof x !== 'object'));
  if (value === null || typeof value !== 'object') return flat;
  const primitive = (x) => x === null || typeof x !== 'object';
  const inline = (Array.isArray(value) ? value.every(primitive) : Object.values(value).every(simple)) && flat.length + indent.length <= 100;
  if (inline) return Array.isArray(value) ? flat.replace(/","/g, '", "') : prettyInline(value);
  const next = indent + '  ';
  if (Array.isArray(value)) {
    if (!value.length) return '[]';
    return '[\n' + value.map((v) => next + formatJSON(v, next)).join(',\n') + '\n' + indent + ']';
  }
  const keys = Object.keys(value);
  if (!keys.length) return '{}';
  return '{\n' + keys.map((k) => `${next}${JSON.stringify(k)}: ${formatJSON(value[k], next)}`).join(',\n') + '\n' + indent + '}';
}

function prettyInline(o) {
  const parts = Object.entries(o).map(([k, v]) => `${JSON.stringify(k)}: ${Array.isArray(v) ? JSON.stringify(v).replace(/","/g, '", "') : v && typeof v === 'object' ? prettyInline(v) : JSON.stringify(v)}`);
  return parts.length ? `{ ${parts.join(', ')} }` : '{}';
}

// The edit functions run on whatever the user has typed, valid or not, so they
// only touch a field when it has the expected shape.
const compsOf = (c) => (Array.isArray(c.components) ? c.components : []);
const isComp = (x) => x !== null && typeof x === 'object';

const refsOf = (circuit) => {
  const lists = [];
  (Array.isArray(circuit.connections) ? circuit.connections : []).forEach((c, i) => {
    if (Array.isArray(c)) lists.push({ get: () => c, set: (v) => (circuit.connections[i] = v), kind: 'array' });
    else if (c && Array.isArray(c.pins)) lists.push({ get: () => c.pins, set: (v) => (c.pins = v), kind: 'pins' });
    else if (c && typeof c === 'object') lists.push({ get: () => [c.from, c.to], set: (v) => { c.from = v[0]; c.to = v[1]; }, kind: 'pair' });
  });
  if (circuit.nets && typeof circuit.nets === 'object' && !Array.isArray(circuit.nets)) {
    for (const k of Object.keys(circuit.nets)) if (Array.isArray(circuit.nets[k])) lists.push({ get: () => circuit.nets[k], set: (v) => (circuit.nets[k] = v), kind: 'net' });
  }
  return lists;
};

export function deleteComponent(circuit, id) {
  const c = clone(circuit);
  if (Array.isArray(c.components)) c.components = c.components.filter((x) => !(isComp(x) && x.id === id));
  const keep = (r) => parseRef(r)?.comp !== id;
  if (Array.isArray(c.connections)) {
    c.connections = c.connections.map((x) => {
      if (Array.isArray(x)) { const r = x.filter(keep); return r.length >= 2 ? r : null; }
      if (x && Array.isArray(x.pins)) { const r = x.pins.filter(keep); return r.length >= 2 ? { ...x, pins: r } : null; }
      if (x && typeof x === 'object') return keep(x.from) && keep(x.to) ? x : null;
      return x;
    }).filter((x) => x !== null);
  }
  if (c.nets && typeof c.nets === 'object' && !Array.isArray(c.nets)) {
    for (const k of Object.keys(c.nets)) if (Array.isArray(c.nets[k])) c.nets[k] = c.nets[k].filter(keep);
  }
  return c;
}

export function renameComponent(circuit, oldId, newId) {
  const c = clone(circuit);
  const comp = compsOf(c).find((x) => isComp(x) && x.id === oldId);
  if (!comp) return c;
  comp.id = newId;
  for (const l of refsOf(c)) {
    l.set(l.get().map((r) => {
      const p = parseRef(r);
      return p && p.comp === oldId ? (p.pin == null ? newId : `${newId}.${p.pin}`) : r;
    }));
  }
  return c;
}

export function updateComponent(circuit, id, patch) {
  const c = clone(circuit);
  const comp = compsOf(c).find((x) => isComp(x) && x.id === id);
  if (!comp) return c;
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined || v === '' || v === null) delete comp[k];
    else comp[k] = v;
  }
  return c;
}

// Freeze the current automatic layout into the JSON (position + rotation for
// every part), then apply `moves` { id: {x, y} }.
export function pinLayout(circuit, instances, moves = {}) {
  const c = clone(circuit);
  for (const comp of compsOf(c)) {
    const I = isComp(comp) && instances.get(comp.id);
    if (!I) continue;
    const m = has(moves, comp.id) ? moves[comp.id] : undefined;
    const r2 = (v) => Math.round(v * 100) / 100;
    comp.position = { x: m ? m.x : r2(I.x), y: m ? m.y : r2(I.y) };
    comp.rotation = I.rot;
    delete comp.angle;
    if (I.mirror) comp.mirror = true; else delete comp.mirror;
  }
  return c;
}

export function rotateComponent(circuit, instances, id, step = 90) {
  const I = instances.get(id);
  const c = pinLayout(circuit, instances);
  const comp = compsOf(c).find((x) => isComp(x) && x.id === id);
  if (comp && I) comp.rotation = normAngle(I.rot + step);
  return c;
}

// Pick a spacing preset ("" = automatic, by circuit size).
export function setSpacing(circuit, spacing) {
  const c = clone(circuit);
  const layout = { ...c.layout, spacing: spacing || undefined };
  if (!spacing) delete layout.spacing;
  if (Object.keys(layout).length) c.layout = layout; else delete c.layout;
  return c;
}

export function clearLayout(circuit) {
  const c = clone(circuit);
  for (const comp of compsOf(c)) if (isComp(comp)) { delete comp.position; delete comp.rotation; delete comp.mirror; delete comp.angle; }
  return c;
}

// Add a part with a free designator. With `at` (a world point) and the current
// `instances`, the layout is frozen first and the part is dropped at that point,
// so it appears where the user is looking instead of wherever auto-layout puts it.
export function addComponent(circuit, type, { at = null, instances = null } = {}) {
  const c = at && instances ? pinLayout(circuit, instances) : clone(circuit);
  if (!Array.isArray(c.components)) c.components = [];
  const sym = resolveSymbol({ type });
  const prefix = sym?.prefix || (sym?.rail ? (RAIL_IDS[sym.type] || sym.type.toUpperCase()) : 'X');
  const ids = new Set(c.components.map((x) => (isComp(x) ? x.id : undefined)));
  const id = sym?.rail && !ids.has(prefix) ? prefix : freeId(ids, prefix + 0);
  const comp = { id, type };
  if (at && instances) comp.position = { x: snap10(at.x), y: snap10(at.y) };
  c.components.push(comp);
  return { circuit: c, id };
}

const snap10 = (v) => Math.round(v / 10) * 10;

// Designators for parts that have no reference prefix of their own.
const RAIL_IDS = { ground: 'GND', net_label: 'NET', junction: 'J' };

// The next unused designator after `base`: R7 -> R8 (or the first free number
// above it), GND -> GND2.
export function freeId(taken, base) {
  const m = /^(.*?)(\d+)$/.exec(base);
  const stem = m ? m[1] : base;
  let n = m ? Number(m[2]) + 1 : 2;
  while (taken.has(stem + n)) n++;
  return stem + n;
}


// ---- operations on several parts at once ------------------------------------
// All of them freeze the automatic layout first (see pinLayout), because moving
// or turning a part only means something relative to where the others are.

const uniq = (ids) => [...new Set(ids)];

// Move parts by (dx, dy). Positions stay on the 10px grid the router works on.
export function moveComponents(circuit, instances, ids, dx, dy) {
  const moves = Object.create(null);
  for (const id of uniq(ids)) {
    const I = instances.get(id);
    if (I) moves[id] = { x: Math.round((I.x + dx) * 100) / 100, y: Math.round((I.y + dy) * 100) / 100 };
  }
  return pinLayout(circuit, instances, moves);
}

// Turn parts by `step` degrees clockwise. One part turns about its own first
// pin; several turn together, as one rigid arrangement, about the centroid of
// their positions (which stays put however often it is turned, so four quarter
// turns bring everything home).
export function rotateComponents(circuit, instances, ids, step = 90) {
  const list = uniq(ids).filter((id) => instances.has(id));
  if (list.length <= 1) return list.length ? rotateComponent(circuit, instances, list[0], step) : clone(circuit);
  const cx = snap10(list.reduce((sum, id) => sum + instances.get(id).x, 0) / list.length);
  const cy = snap10(list.reduce((sum, id) => sum + instances.get(id).y, 0) / list.length); // on the grid, so right angles stay on it
  const a = (step * Math.PI) / 180, cos = Math.cos(a), sin = Math.sin(a);
  const c = pinLayout(circuit, instances);
  for (const comp of compsOf(c)) {
    if (!isComp(comp) || !list.includes(comp.id)) continue;
    const I = instances.get(comp.id);
    const rx = I.x - cx, ry = I.y - cy;
    comp.position = { x: snap10(cx + rx * cos - ry * sin), y: snap10(cy + rx * sin + ry * cos) };
    comp.rotation = normAngle(I.rot + step);
  }
  return c;
}

// Flip parts left-to-right in place.
export function mirrorComponents(circuit, instances, ids) {
  const list = new Set(uniq(ids));
  const c = pinLayout(circuit, instances);
  for (const comp of compsOf(c)) {
    if (!isComp(comp) || !list.has(comp.id) || !instances.has(comp.id)) continue;
    if (comp.mirror) delete comp.mirror; else comp.mirror = true;
  }
  return c;
}

export function deleteComponents(circuit, ids) {
  let c = clone(circuit);
  for (const id of uniq(ids)) c = deleteComponent(c, id);
  return c;
}

// The selected parts and every connection wholly inside the selection, as a
// snippet that can be pasted into this or another circuit.
export function extractSubcircuit(circuit, instances, ids) {
  const want = new Set(uniq(ids));
  const components = compsOf(circuit).filter((x) => isComp(x) && want.has(x.id)).map((x) => {
    const copy = clone(x);
    const I = instances?.get(x.id);
    if (I) { copy.position = { x: Math.round(I.x * 100) / 100, y: Math.round(I.y * 100) / 100 }; copy.rotation = I.rot; delete copy.angle; if (I.mirror) copy.mirror = true; else delete copy.mirror; }
    return copy;
  });
  const inside = (r) => { const p = parseRef(r); return !!p && want.has(p.comp); };
  const connections = [];
  for (const x of Array.isArray(circuit.connections) ? circuit.connections : []) {
    if (Array.isArray(x)) { if (x.length >= 2 && x.every(inside)) connections.push(clone(x)); }
    else if (x && Array.isArray(x.pins)) { if (x.pins.length >= 2 && x.pins.every(inside)) connections.push(clone(x)); }
    else if (x && typeof x === 'object' && inside(x.from) && inside(x.to)) connections.push(clone(x));
  }
  return { format: 'circuitforge-selection', components, connections };
}

// Add a snippet to a circuit. Parts keep their ids unless the circuit already
// uses them, in which case they get the next free designator; connections are
// rewritten to follow. `offset` shifts the positions (so a copy does not land on
// the original). Returns { circuit, ids } with the ids of the new parts.
export function pasteSubcircuit(circuit, snippet, offset = { x: 40, y: 40 }) {
  const c = clone(circuit);
  if (!Array.isArray(c.components)) c.components = [];
  if (!Array.isArray(c.connections)) c.connections = [];
  const taken = new Set(c.components.map((x) => (isComp(x) ? x.id : undefined)));
  const rename = new Map();
  const ids = [];
  for (const src of Array.isArray(snippet?.components) ? snippet.components : []) {
    if (!isComp(src) || typeof src.id !== 'string') continue;
    const comp = clone(src);
    let id = comp.id;
    if (taken.has(id)) id = freeId(taken, id);
    taken.add(id);
    rename.set(comp.id, id);
    comp.id = id;
    if (comp.position && Number.isFinite(comp.position.x) && Number.isFinite(comp.position.y)) {
      comp.position = { x: snap10(comp.position.x + (offset?.x || 0)), y: snap10(comp.position.y + (offset?.y || 0)) };
    }
    c.components.push(comp);
    ids.push(id);
  }
  const remap = (r) => { const p = parseRef(r); return p && rename.has(p.comp) ? (p.pin == null ? rename.get(p.comp) : `${rename.get(p.comp)}.${p.pin}`) : r; };
  for (const x of Array.isArray(snippet?.connections) ? snippet.connections : []) {
    const y = clone(x);
    if (Array.isArray(y)) c.connections.push(y.map(remap));
    else if (y && Array.isArray(y.pins)) c.connections.push({ ...y, pins: y.pins.map(remap) });
    else if (y && typeof y === 'object') c.connections.push({ ...y, from: remap(y.from), to: remap(y.to) });
  }
  return { circuit: c, ids };
}

// Copy parts (with the wiring between them) next to the originals.
export function duplicateComponents(circuit, instances, ids, offset = { x: 40, y: 40 }) {
  const frozen = pinLayout(circuit, instances);
  return pasteSubcircuit(frozen, extractSubcircuit(frozen, instances, ids), offset);
}

// Pins may be written with aliases in the JSON ("D1.A" for "D1.anode"); compare
// them by their canonical names.
function canonicalizer(circuit) {
  const byId = new Map();
  for (const x of compsOf(circuit)) if (isComp(x) && typeof x.id === 'string') byId.set(x.id, x);
  return (ref) => {
    const p = parseRef(ref);
    const comp = p && byId.get(p.comp);
    if (!comp) return ref;
    const sym = resolveSymbol(comp);
    const pin = sym && (p.pin == null ? (sym.pinOrder.length === 1 ? sym.pinOrder[0] : null) : resolvePin(sym, p.pin));
    return pin ? `${p.comp}.${pin}` : ref;
  };
}

// Join two pins. If either is already in a connection list, the other joins that
// list (so the JSON stays as short as a person would write it); otherwise a new
// pair is added. Joining a pin to itself, or a pair already listed together, is a no-op.
export function connectPins(circuit, a, b) {
  const c = clone(circuit);
  const canon = canonicalizer(c);
  if (canon(a) === canon(b)) return c;
  if (!Array.isArray(c.connections)) c.connections = [];
  const lists = refsOf(c).filter((l) => l.kind !== 'net');
  const withA = lists.find((l) => l.get().some((r) => canon(r) === canon(a)));
  const withB = lists.find((l) => l.get().some((r) => canon(r) === canon(b)));
  if (withA && withA === withB) return c;
  const grow = (list, ref) => {
    const cur = list.get();
    if (list.kind === 'pair') {
      // { from, to } holds exactly two: turn it into a pins list first
      const conn = c.connections.find((x) => x && typeof x === 'object' && !Array.isArray(x) && x.from === cur[0] && x.to === cur[1]);
      if (conn) { const { from, to, ...rest } = conn; Object.keys(conn).forEach((k) => delete conn[k]); Object.assign(conn, { pins: [from, to, ref] }, rest); return; }
    }
    list.set([...cur, ref]);
  };
  if (withA && !withB) grow(withA, b);
  else if (withB && !withA) grow(withB, a);
  else c.connections.push([a, b]);
  return c;
}

// Take one pin out of every connection it appears in; a connection left with a
// single pin disappears.
export function disconnectPin(circuit, ref) {
  const c = clone(circuit);
  const canon = canonicalizer(c);
  const target = canon(ref);
  const keep = (r) => canon(r) !== target;
  if (Array.isArray(c.connections)) {
    c.connections = c.connections.map((x) => {
      if (Array.isArray(x)) { const r = x.filter(keep); return r.length >= 2 ? r : null; }
      if (x && Array.isArray(x.pins)) { const r = x.pins.filter(keep); return r.length >= 2 ? { ...x, pins: r } : null; }
      if (x && typeof x === 'object') return keep(x.from) && keep(x.to) ? x : null;
      return x;
    }).filter((x) => x !== null);
  }
  if (c.nets && typeof c.nets === 'object' && !Array.isArray(c.nets)) {
    for (const k of Object.keys(c.nets)) if (Array.isArray(c.nets[k])) c.nets[k] = c.nets[k].filter(keep);
  }
  return c;
}

// Apply the `fix` attached to a validation problem: { label, path, value }.
// Returns the corrected circuit, or null when the path no longer leads anywhere
// (the document changed since the problem was reported).
export function applyFix(circuit, fix) {
  if (!fix || typeof fix.path !== 'string') return null;
  const c = clone(circuit);
  return setPath(c, fix.path, fix.value) ? c : null;
}

export const EMPTY_CIRCUIT = { title: 'Untitled circuit', components: [], connections: [] };
