import { parseCircuit, normalizeConnections, parseRef } from '../parser/index.js';
import { canonicalType, resolveSymbol, resolvePin, listTypes, UNSUPPORTED_TYPES } from '../symbol-loader/index.js';

function levenshtein(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

function suggestType(t) {
  const s = String(t).toLowerCase();
  let best = null, bestD = 3;
  for (const { type, aliases } of listTypes()) {
    for (const cand of [type, ...aliases]) {
      const d = levenshtein(s, cand);
      if (d < bestD) { bestD = d; best = type; }
    }
  }
  return best;
}

// Returns { valid, errors, warnings, circuit, resolved } where `resolved` holds
// the per-component symbols and per-connection resolved endpoints for the engine.
export function validateCircuit(input) {
  const errors = [], warnings = [];
  const { circuit, errors: parseErrors } = parseCircuit(input);
  if (parseErrors.length) return { valid: false, errors: parseErrors, warnings, circuit: null };

  if (!circuit || typeof circuit !== 'object' || Array.isArray(circuit)) {
    errors.push({ code: 'INVALID_SCHEMA', message: 'The circuit must be a JSON object with "components" and "connections".' });
    return { valid: false, errors, warnings, circuit };
  }
  if (!Array.isArray(circuit.components)) {
    errors.push({ code: 'INVALID_SCHEMA', path: 'components', message: '"components" must be an array.' });
    return { valid: false, errors, warnings, circuit };
  }
  if (circuit.connections !== undefined && !Array.isArray(circuit.connections)) {
    errors.push({ code: 'INVALID_SCHEMA', path: 'connections', message: '"connections" must be an array.' });
  }

  const comps = new Map();
  circuit.components.forEach((c, i) => {
    const path = `components[${i}]`;
    if (!c || typeof c !== 'object' || Array.isArray(c)) {
      errors.push({ code: 'INVALID_SCHEMA', path, message: `Component #${i + 1} must be an object.` });
      return;
    }
    if (typeof c.id !== 'string' || !c.id.trim()) {
      errors.push({ code: 'MISSING_ID', path, message: `Component #${i + 1} has no "id".` });
      return;
    }
    const id = c.id;
    if (/[.\s]/.test(id)) {
      errors.push({ code: 'INVALID_ID', component: id, path, message: `Component id "${id}" must not contain dots or spaces.` });
      return;
    }
    if (comps.has(id)) {
      errors.push({ code: 'DUPLICATE_ID', component: id, path, message: `Duplicate component id "${id}".` });
      return;
    }
    if (c.type == null || c.type === '') {
      errors.push({ code: 'MISSING_TYPE', component: id, path, message: `Component ${id} has no "type".` });
      comps.set(id, null);
      return;
    }
    const t = String(c.type).toLowerCase().replace(/[\s-]+/g, '_');
    if (UNSUPPORTED_TYPES.includes(t)) {
      errors.push({ code: 'UNSUPPORTED_COMPONENT', component: id, type: c.type, path, message: `Component type "${c.type}" (${id}) is not supported yet. Use "microcontroller" with custom pins instead.` });
      comps.set(id, null);
      return;
    }
    if (!canonicalType(c.type)) {
      const s = suggestType(c.type);
      errors.push({ code: 'UNKNOWN_TYPE', component: id, type: c.type, path, message: `Unknown component type "${c.type}" on ${id}.${s ? ` Did you mean "${s}"?` : ''}` });
      comps.set(id, null);
      return;
    }
    if (c.rotation !== undefined && ![0, 90, 180, 270].includes(c.rotation)) {
      errors.push({ code: 'INVALID_PROPERTY', component: id, path: `${path}.rotation`, message: `Rotation of ${id} must be 0, 90, 180 or 270.` });
    }
    if (c.position !== undefined && !(c.position && Number.isFinite(c.position.x) && Number.isFinite(c.position.y))) {
      errors.push({ code: 'INVALID_PROPERTY', component: id, path: `${path}.position`, message: `Position of ${id} must be {"x": number, "y": number}.` });
    }
    comps.set(id, { comp: c, sym: resolveSymbol(c) });
  });

  const connections = [];
  const seenPairs = new Set();
  const connectedPins = new Map(); // id -> Set(pin)
  const mentioned = new Set(); // ids referenced by any connection, valid or not
  for (const conn of normalizeConnections(circuit)) {
    const { path } = conn;
    if (!Array.isArray(conn.refs)) {
      errors.push({ code: 'INVALID_CONNECTION', path, message: `${path} must be an array of pin references like ["R1.1", "C1.2"].` });
      continue;
    }
    if (conn.refs.length < 2) {
      errors.push({ code: 'INVALID_CONNECTION', path, message: `${path} needs at least two endpoints.` });
      continue;
    }
    const ends = [];
    let bad = false;
    for (const raw of conn.refs) {
      const ref = parseRef(raw);
      if (!ref) {
        errors.push({ code: 'INVALID_CONNECTION', path, message: `Invalid pin reference ${JSON.stringify(raw)} in ${path}. Use "ComponentId.pin".` });
        bad = true; continue;
      }
      mentioned.add(ref.comp);
      if (!comps.has(ref.comp)) {
        errors.push({ code: 'MISSING_COMPONENT', component: ref.comp, ref: raw, path, message: `Connection references missing component "${ref.comp}" (${raw}).` });
        bad = true; continue;
      }
      const entry = comps.get(ref.comp);
      if (!entry) { bad = true; continue; } // component already reported
      const { sym, comp } = entry;
      let pin;
      if (ref.pin == null) {
        if (sym.pinOrder.length === 1) pin = sym.pinOrder[0];
        else {
          errors.push({ code: 'INVALID_PIN', component: ref.comp, pin: null, ref: raw, path, message: `Connection to ${ref.comp} must name a pin (${sym.pinOrder.join(', ')}).` });
          bad = true; continue;
        }
      } else {
        pin = resolvePin(sym, ref.pin);
        if (!pin) {
          errors.push({ code: 'INVALID_PIN', component: ref.comp, pin: ref.pin, ref: raw, path, message: `Pin ${ref.pin} does not exist on ${sym.name.toLowerCase()} ${ref.comp}. Available: ${sym.pinOrder.join(', ')}.` });
          bad = true; continue;
        }
      }
      ends.push({ comp: comp.id, pin });
    }
    if (bad) continue;
    const keys = ends.map((e) => `${e.comp}.${e.pin}`);
    if (new Set(keys).size !== keys.length) {
      errors.push({ code: 'INVALID_CONNECTION', path, message: `${path} connects a pin to itself (${keys.join(', ')}).` });
      continue;
    }
    for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++) {
      const pair = [keys[i], keys[j]].sort().join('|');
      if (seenPairs.has(pair)) warnings.push({ code: 'DUPLICATE_CONNECTION', path, message: `Duplicate connection between ${keys[i]} and ${keys[j]}.` });
      seenPairs.add(pair);
    }
    for (const e of ends) {
      if (!connectedPins.has(e.comp)) connectedPins.set(e.comp, new Set());
      connectedPins.get(e.comp).add(e.pin);
    }
    connections.push({ ends, name: conn.name, path });
  }

  for (const [id, entry] of comps) {
    if (!entry) continue;
    const used = connectedPins.get(id);
    if (!used) {
      if (!mentioned.has(id)) warnings.push({ code: 'UNCONNECTED_COMPONENT', component: id, message: `${id} is not connected to anything.` });
      continue;
    }
    for (const req of entry.sym.required || []) {
      const pin = resolvePin(entry.sym, req);
      if (pin && !used.has(pin)) warnings.push({ code: 'MISSING_REQUIRED_PIN', component: id, pin, message: `Required pin ${pin} of ${id} is not connected.` });
    }
  }

  return { valid: errors.length === 0, errors, warnings, circuit, resolved: { comps, connections } };
}
