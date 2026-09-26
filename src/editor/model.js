// Pure mutations on the circuit JSON object. Canvas edits go through these so
// the JSON stays the single source of truth.
import { parseRef } from '../parser/index.js';
import { resolveSymbol } from '../symbol-loader/index.js';
import { normAngle } from '../utils/geometry.js';

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

const refsOf = (circuit) => {
  const lists = [];
  (circuit.connections || []).forEach((c, i) => {
    if (Array.isArray(c)) lists.push({ get: () => c, set: (v) => (circuit.connections[i] = v), kind: 'array' });
    else if (c && Array.isArray(c.pins)) lists.push({ get: () => c.pins, set: (v) => (c.pins = v), kind: 'pins' });
    else if (c && typeof c === 'object') lists.push({ get: () => [c.from, c.to], set: (v) => { c.from = v[0]; c.to = v[1]; }, kind: 'pair' });
  });
  if (circuit.nets && typeof circuit.nets === 'object') {
    for (const k of Object.keys(circuit.nets)) if (Array.isArray(circuit.nets[k])) lists.push({ get: () => circuit.nets[k], set: (v) => (circuit.nets[k] = v), kind: 'net' });
  }
  return lists;
};

export function deleteComponent(circuit, id) {
  const c = clone(circuit);
  c.components = (c.components || []).filter((x) => x.id !== id);
  const keep = (r) => parseRef(r)?.comp !== id;
  if (Array.isArray(c.connections)) {
    c.connections = c.connections.map((x) => {
      if (Array.isArray(x)) { const r = x.filter(keep); return r.length >= 2 ? r : null; }
      if (x && Array.isArray(x.pins)) { const r = x.pins.filter(keep); return r.length >= 2 ? { ...x, pins: r } : null; }
      if (x && typeof x === 'object') return keep(x.from) && keep(x.to) ? x : null;
      return x;
    }).filter((x) => x !== null);
  }
  if (c.nets && typeof c.nets === 'object') {
    for (const k of Object.keys(c.nets)) if (Array.isArray(c.nets[k])) c.nets[k] = c.nets[k].filter(keep);
  }
  return c;
}

export function renameComponent(circuit, oldId, newId) {
  const c = clone(circuit);
  const comp = c.components.find((x) => x.id === oldId);
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
  const comp = c.components.find((x) => x.id === id);
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
  for (const comp of c.components || []) {
    const I = instances.get(comp.id);
    if (!I) continue;
    const m = moves[comp.id];
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
  const comp = c.components.find((x) => x.id === id);
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
  for (const comp of c.components || []) { delete comp.position; delete comp.rotation; delete comp.mirror; }
  return c;
}

export function addComponent(circuit, type) {
  const c = clone(circuit);
  c.components = c.components || [];
  const sym = resolveSymbol({ type });
  const prefix = sym?.prefix || (sym?.rail ? type.toUpperCase() : 'X');
  let n = 1;
  const ids = new Set(c.components.map((x) => x.id));
  while (ids.has(prefix + n)) n++;
  const id = sym?.rail && !ids.has(prefix) ? prefix : prefix + n;
  c.components.push({ id, type });
  return { circuit: c, id };
}

export const EMPTY_CIRCUIT = { title: 'Untitled circuit', components: [], connections: [] };
