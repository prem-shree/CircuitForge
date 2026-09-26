import { parseCircuit, normalizeConnections, parseRef } from '../parser/index.js';
import { canonicalType, resolveSymbol, resolvePin, listTypes, UNSUPPORTED_TYPES } from '../symbol-loader/index.js';
import { normAngle } from '../utils/geometry.js';
import { SPACING_PRESETS } from '../layout/config.js';

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

  // ---- optional top-level blocks (metadata, layout, teaching material, …)
  const TOP_KEYS = ['$schema', 'version', 'title', 'name', 'description', 'metadata', 'layout', 'validation', 'simulation', 'education', 'components', 'connections', 'nets', 'junctions', 'annotations', 'measurements', 'bom', 'notes'];
  for (const key of Object.keys(circuit)) {
    if (!TOP_KEYS.includes(key)) {
      warnings.push({ code: 'UNKNOWN_FIELD', path: key, message: `Unknown top-level field "${key}". Known fields: ${TOP_KEYS.join(', ')}.` });
    }
  }
  const objectField = (key) => {
    const v = circuit[key];
    if (v !== undefined && (typeof v !== 'object' || Array.isArray(v) || v === null)) {
      errors.push({ code: 'INVALID_SCHEMA', path: key, message: `"${key}" must be an object.` });
    }
  };
  ['metadata', 'layout', 'validation', 'simulation', 'education', 'nets'].forEach(objectField);
  for (const key of ['annotations', 'measurements', 'bom', 'junctions']) {
    if (circuit[key] !== undefined && !Array.isArray(circuit[key])) {
      errors.push({ code: 'INVALID_SCHEMA', path: key, message: `"${key}" must be an array.` });
    }
  }
  if (circuit.layout && typeof circuit.layout === 'object') {
    for (const [k, v] of Object.entries(circuit.layout)) {
      if (k === 'spacing') {
        if (v !== 'auto' && !SPACING_PRESETS[v]) errors.push({ code: 'INVALID_PROPERTY', path: 'layout.spacing', message: `layout.spacing must be "auto", ${Object.keys(SPACING_PRESETS).map((p) => `"${p}"`).join(', ')}.` });
      } else if (k === 'bridges' || k === 'optimize') {
        if (typeof v !== 'boolean') errors.push({ code: 'INVALID_PROPERTY', path: `layout.${k}`, message: `layout.${k} must be true or false.` });
      } else if (!['grid', 'componentGap', 'wireGap', 'labelGap', 'sectionGap', 'direction'].includes(k)) {
        warnings.push({ code: 'UNKNOWN_FIELD', path: `layout.${k}`, message: `Unknown layout option "${k}".` });
      } else if (k !== 'direction' && v !== undefined && !Number.isFinite(v)) {
        errors.push({ code: 'INVALID_PROPERTY', path: `layout.${k}`, message: `layout.${k} must be a number.` });
      }
    }
  }
  if (circuit.validation?.rules && typeof circuit.validation.rules === 'object') {
    for (const [code, level] of Object.entries(circuit.validation.rules)) {
      if (!['off', 'info', 'warning', 'error'].includes(level)) {
        errors.push({ code: 'INVALID_PROPERTY', path: `validation.rules.${code}`, message: `Rule level for ${code} must be "off", "info", "warning" or "error".` });
      }
    }
  }
  for (const [i, m] of (Array.isArray(circuit.measurements) ? circuit.measurements : []).entries()) {
    if (!m || typeof m !== 'object') errors.push({ code: 'INVALID_SCHEMA', path: `measurements[${i}]`, message: 'Each measurement must be an object with "type" and "at".' });
    else if (m.type && !['voltage', 'current', 'resistance', 'frequency'].includes(String(m.type).toLowerCase())) {
      warnings.push({ code: 'INVALID_PROPERTY', path: `measurements[${i}].type`, message: `Unknown measurement type "${m.type}"; expected voltage, current, resistance or frequency.` });
    }
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
    // Rotation: any angle in degrees, clockwise ("angle" is accepted as an alias).
    let comp = c;
    const turns = [['rotation', c.rotation], ['angle', c.angle]].filter(([, v]) => v !== undefined);
    for (const [key, v] of turns) {
      if (typeof v !== 'number' || !Number.isFinite(v)) {
        errors.push({ code: 'INVALID_PROPERTY', component: id, path: `${path}.${key}`, message: `${key === 'angle' ? 'Angle' : 'Rotation'} of ${id} must be a number of degrees, e.g. 0, 45, 90.` });
      }
    }
    if (turns.length === 2 && typeof c.rotation === 'number' && typeof c.angle === 'number' && normAngle(c.rotation) !== normAngle(c.angle)) {
      errors.push({ code: 'INVALID_PROPERTY', component: id, path: `${path}.angle`, message: `${id} has both "rotation" (${c.rotation}) and "angle" (${c.angle}); use one.` });
    }
    const turn = turns.find(([, v]) => typeof v === 'number' && Number.isFinite(v));
    if (turn) {
      comp = { ...c, rotation: normAngle(turn[1]) };
      delete comp.angle;
    }
    if (c.position !== undefined && !(c.position && Number.isFinite(c.position.x) && Number.isFinite(c.position.y))) {
      errors.push({ code: 'INVALID_PROPERTY', component: id, path: `${path}.position`, message: `Position of ${id} must be {"x": number, "y": number}.` });
    }
    if (c.section !== undefined && !['input', 'process', 'output', 'power'].includes(c.section)) {
      errors.push({ code: 'INVALID_PROPERTY', component: id, path: `${path}.section`, message: `Section of ${id} must be input, process, output or power.` });
    }
    for (const key of ['params', 'bom', 'education', 'pinTypes', 'simulation']) {
      if (c[key] !== undefined && (typeof c[key] !== 'object' || Array.isArray(c[key]) || c[key] === null)) {
        errors.push({ code: 'INVALID_PROPERTY', component: id, path: `${path}.${key}`, message: `"${key}" of ${id} must be an object.` });
      }
    }
    if (c.pinTypes && typeof c.pinTypes === 'object') {
      const ETYPES = ['in', 'out', 'passive', 'power', 'power_in', 'power_out', 'bidirectional', 'tristate', 'open_collector', 'open_drain', 'unspecified'];
      for (const [pin, et] of Object.entries(c.pinTypes)) {
        if (!ETYPES.includes(et)) {
          errors.push({ code: 'INVALID_PROPERTY', component: id, path: `${path}.pinTypes.${pin}`, message: `Electrical pin type "${et}" is not one of: ${ETYPES.join(', ')}.` });
        }
      }
    }
    comps.set(id, { comp, sym: resolveSymbol(comp) });
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
    // Optional wire hints: waypoints the router must pass through, or a fully
    // manual orthogonal route. Both are validated here so the router can trust them.
    const pts = (list, field) => {
      if (!list) return null;
      const out = [];
      for (const p of list) {
        const x = Array.isArray(p) ? p[0] : p?.x, y = Array.isArray(p) ? p[1] : p?.y;
        if (!Number.isFinite(x) || !Number.isFinite(y)) {
          errors.push({ code: 'INVALID_CONNECTION', path, message: `${path}.${field} must be points like [{"x":120,"y":80}] or [[120,80]].` });
          return null;
        }
        out.push({ x: Math.round(x / 10) * 10, y: Math.round(y / 10) * 10 });
      }
      return out.length ? out : null;
    };
    const route = pts(conn.route, 'route');
    if (route) {
      for (let i = 1; i < route.length; i++) {
        if (route[i].x !== route[i - 1].x && route[i].y !== route[i - 1].y) {
          errors.push({ code: 'INVALID_CONNECTION', path, message: `${path}.route must be orthogonal: point ${i + 1} is diagonal from the previous one.` });
          break;
        }
      }
    }
    if (conn.class && !['signal', 'power', 'ground', 'bus', 'analog', 'clock', 'differential'].includes(conn.class)) {
      warnings.push({ code: 'INVALID_PROPERTY', path, message: `Unknown connection class "${conn.class}"; expected signal, power, ground, bus, analog, clock or differential.` });
    }
    connections.push({ ends, name: conn.name, path, class: conn.class, waypoints: pts(conn.waypoints, 'waypoints'), route, locked: conn.locked, label: conn.label });
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
