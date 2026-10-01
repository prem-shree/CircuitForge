// Structural validation: JSON shape, component types, pins, connections and the
// optional blocks (layout, validation, measurements, …). Everything a later stage
// relies on is checked here, so layout and routing can trust their input.
//
// Every problem is { code, message, path?, component?, pin?, ref?, fix? }:
//   path  where in the JSON it is (components[2].type), for line numbers
//   fix   { label, path, value } — a one-step correction the editor can apply
import { parseCircuit, normalizeConnections, parseRef } from '../parser/index.js';
import { canonicalType, resolveSymbol, resolvePin, listTypes, pinSpecProblems, UNSUPPORTED_TYPES } from '../symbol-loader/index.js';
import { normAngle, snap } from '../utils/geometry.js';
import { RESERVED_NAMES, MAX_COORD, isObject, has } from '../utils/safe.js';
import { formatPath } from '../utils/path.js';
import { SPACING_PRESETS } from '../layout/config.js';
import { RULE_CODES } from './electrical.js';
import { closest, didYouMean } from './suggest.js';

// Upper bounds that keep a hostile or accidental document from exhausting the
// browser tab or an API server. Override per call: validate(circuit, { limits }).
export const LIMITS = {
  components: 1500,
  connections: 6000,
  endpointsPerConnection: 500,
  endpoints: 20000, // pins named by all connections together
  errors: 100, // problems reported before the list is cut off
  warnings: 300,
};

// Work bounds inside the validator itself, so a hostile document costs a fixed
// amount however it is shaped: "did you mean" searches are limited in number (and,
// in suggest.js, in the length of what they compare).
const MAX_SUGGESTIONS = 40;
const MAX_DUPLICATE_WARNINGS = 25;

const TOP_KEYS = ['$schema', 'version', 'title', 'name', 'description', 'metadata', 'layout', 'validation', 'simulation', 'education', 'components', 'connections', 'nets', 'junctions', 'annotations', 'measurements', 'bom', 'notes'];
const LAYOUT_KEYS = ['spacing', 'bridges', 'optimize', 'grid', 'componentGap', 'wireGap', 'labelGap', 'sectionGap', 'direction'];
const SECTIONS = ['input', 'process', 'output', 'power'];
const ELECTRICAL_TYPES = ['in', 'out', 'passive', 'power', 'power_in', 'power_out', 'bidirectional', 'tristate', 'open_collector', 'open_drain', 'unspecified'];
const CONNECTION_CLASSES = ['signal', 'power', 'ground', 'bus', 'analog', 'clock', 'differential'];

const typeCandidates = () => listTypes().flatMap(({ type, aliases }) => [type, ...aliases].map((c) => [c, type]));
const suggestType = (t) => closest(t, typeCandidates(), 2);

// "an object", "a list", "true" … for messages about wrongly-typed fields.
const describe = (v) => (v === null ? 'null' : Array.isArray(v) ? 'a list' : typeof v === 'object' ? 'an object' : typeof v === 'string' ? `the text ${JSON.stringify(v)}` : String(v));
const isText = (v) => typeof v === 'string' || (typeof v === 'number' && Number.isFinite(v));

// Returns { valid, errors, warnings, circuit, resolved } where `resolved` holds
// the per-component symbols and per-connection resolved endpoints for the engine.
export function validateCircuit(input, options = {}) {
  const limits = { ...LIMITS, ...options.limits };
  const errors = [], warnings = [];
  const error = (code, message, extra = {}) => errors.push({ code, message, ...extra });
  const warn = (code, message, extra = {}) => warnings.push({ code, message, ...extra });
  const finish = (circuit, extra = {}) => {
    if (errors.length > limits.errors) {
      const more = errors.length - limits.errors;
      errors.length = limits.errors;
      errors.push({ code: 'TOO_MANY_ERRORS', message: `${more} more error${more > 1 ? 's' : ''} not shown. Fix the ones above first.` });
    }
    if (warnings.length > limits.warnings) {
      const more = warnings.length - limits.warnings;
      warnings.length = limits.warnings;
      warnings.push({ code: 'TOO_MANY_WARNINGS', message: `${more} more warning${more > 1 ? 's' : ''} not shown.` });
    }
    return { valid: errors.length === 0, errors, warnings, circuit, wrapped, ...extra };
  };

  let suggestions = 0;
  let truncated = false; // stopped early at the error cap: later passes would be working from a partial picture
  const suggest = (fn) => (suggestions++ < MAX_SUGGESTIONS ? fn() : null);
  const { circuit, errors: parseErrors, wrapped } = parseCircuit(input);
  if (parseErrors.length) return { valid: false, errors: parseErrors, warnings, circuit: null };

  if (!isObject(circuit)) {
    error('INVALID_SCHEMA', 'The circuit must be a JSON object with "components" and "connections".');
    return finish(circuit);
  }
  if (!Array.isArray(circuit.components)) {
    error('INVALID_SCHEMA', '"components" must be an array of parts like { "id": "R1", "type": "resistor" }.', { path: 'components' });
    return finish(circuit);
  }
  if (circuit.connections !== undefined && !Array.isArray(circuit.connections)) {
    error('INVALID_SCHEMA', '"connections" must be an array of pin lists like ["R1.2", "C1.1"].', { path: 'connections' });
  }
  if (circuit.components.length > limits.components) {
    error('LIMIT_EXCEEDED', `The circuit has ${circuit.components.length} components; the limit is ${limits.components}. Split it into sub-circuits.`, { path: 'components' });
    return finish(circuit);
  }
  if (Array.isArray(circuit.connections) && circuit.connections.length > limits.connections) {
    error('LIMIT_EXCEEDED', `The circuit has ${circuit.connections.length} connections; the limit is ${limits.connections}.`, { path: 'connections' });
    return finish(circuit);
  }

  {
    // everything that names pins counts: the connection lists and the "nets" form
    const lists = [...(Array.isArray(circuit.connections) ? circuit.connections : []), ...(isObject(circuit.nets) ? Object.values(circuit.nets) : [])];
    if (lists.length > limits.connections) {
      error('LIMIT_EXCEEDED', `The circuit has ${lists.length} connections and nets together; the limit is ${limits.connections}.`, { path: 'connections' });
      return finish(circuit);
    }
    let total = 0;
    for (const c of lists) total += Array.isArray(c) ? c.length : Array.isArray(c?.pins) ? c.pins.length : 2;
    if (total > limits.endpoints) {
      error('LIMIT_EXCEEDED', `The connections name ${total} pins in total; the limit is ${limits.endpoints}. Split the circuit into sub-circuits.`, { path: 'connections' });
      return finish(circuit);
    }
  }

  // ---- optional top-level blocks (metadata, layout, teaching material, …)
  for (const key of Object.keys(circuit)) {
    if (!TOP_KEYS.includes(key)) {
      const s = closest(key, TOP_KEYS);
      warn('UNKNOWN_FIELD', `Unknown top-level field "${key}".${didYouMean(s) || ` Known fields: ${TOP_KEYS.join(', ')}.`}`, { path: formatPath([key]) });
    }
  }
  for (const key of ['metadata', 'layout', 'validation', 'simulation', 'education', 'nets']) {
    const v = circuit[key];
    if (v !== undefined && !isObject(v)) error('INVALID_SCHEMA', `"${key}" must be an object, not ${describe(v)}.`, { path: key });
  }
  for (const key of ['annotations', 'measurements', 'bom', 'junctions']) {
    const v = circuit[key];
    if (v === undefined) continue;
    if (!Array.isArray(v)) { error('INVALID_SCHEMA', `"${key}" must be an array, not ${describe(v)}.`, { path: key }); continue; }
    if (key === 'junctions') continue;
    v.forEach((item, i) => {
      if (!isObject(item)) {
        error('INVALID_SCHEMA', key === 'measurements'
          ? `Each measurement must be an object with "type" and "at" (measurements[${i}] is ${describe(item)}).`
          : `${key}[${i}] must be an object, not ${describe(item)}.`, { path: `${key}[${i}]` });
      }
    });
  }
  if (isObject(circuit.layout)) {
    for (const [k, v] of Object.entries(circuit.layout)) {
      const path = formatPath(['layout', k]);
      if (k === 'spacing') {
        if (v !== 'auto' && !has(SPACING_PRESETS, v)) error('INVALID_PROPERTY', `layout.spacing must be "auto", ${Object.keys(SPACING_PRESETS).map((p) => `"${p}"`).join(', ')}.`, { path });
      } else if (k === 'bridges' || k === 'optimize') {
        if (typeof v !== 'boolean') error('INVALID_PROPERTY', `layout.${k} must be true or false.`, { path });
      } else if (!LAYOUT_KEYS.includes(k)) {
        warn('UNKNOWN_FIELD', `Unknown layout option "${k}".${didYouMean(closest(k, LAYOUT_KEYS)) || ` Known options: ${LAYOUT_KEYS.join(', ')}.`}`, { path });
      } else if (k !== 'direction' && v !== undefined && !Number.isFinite(v)) {
        error('INVALID_PROPERTY', `layout.${k} must be a number.`, { path });
      }
    }
  }
  if (isObject(circuit.validation)) {
    const { rules, supplyVoltage } = circuit.validation;
    if (supplyVoltage !== undefined && !(Number.isFinite(supplyVoltage) && supplyVoltage > 0)) {
      error('INVALID_PROPERTY', 'validation.supplyVoltage must be a positive number of volts.', { path: 'validation.supplyVoltage' });
    }
    if (rules !== undefined && !isObject(rules)) error('INVALID_SCHEMA', '"validation.rules" must be an object of rule code → level.', { path: 'validation.rules' });
    else if (rules) {
      for (const [code, level] of Object.entries(rules)) {
        const path = formatPath(['validation', 'rules', code]);
        if (!['off', 'info', 'warning', 'error'].includes(level)) {
          error('INVALID_PROPERTY', `Rule level for ${code} must be "off", "info", "warning" or "error".`, { path });
        }
        if (!RULE_CODES.includes(code)) {
          warn('UNKNOWN_RULE', `"${code}" is not a rule code, so this setting has no effect.${didYouMean(closest(code, RULE_CODES, 3)) || ''}`, { path });
        }
      }
    }
  }
  (Array.isArray(circuit.measurements) ? circuit.measurements : []).forEach((m, i) => {
    if (isObject(m) && m.type && !['voltage', 'current', 'resistance', 'frequency'].includes(String(m.type).toLowerCase())) {
      warn('INVALID_PROPERTY', `Unknown measurement type "${m.type}"; expected voltage, current, resistance or frequency.`, { path: `measurements[${i}].type` });
    }
  });

  // ---- components
  const comps = new Map();
  const paths = new Map(); // id -> JSON path of the component
  const allIds = circuit.components.map((c) => (isObject(c) && typeof c.id === 'string' ? c.id : null)).filter(Boolean);
  circuit.components.forEach((c, i) => {
    if (errors.length > limits.errors) { truncated = true; return; } // the list is cut off anyway
    const path = `components[${i}]`;
    if (!isObject(c)) {
      error('INVALID_SCHEMA', `Component #${i + 1} must be an object like { "id": "R1", "type": "resistor" }, not ${describe(c)}.`, { path });
      return;
    }
    if (c.id === undefined || c.id === null || (typeof c.id === 'string' && !c.id.trim())) {
      error('MISSING_ID', `Component #${i + 1} has no "id".`, { path });
      return;
    }
    if (typeof c.id !== 'string') {
      error('INVALID_ID', `Component #${i + 1} has an id that is not text (${JSON.stringify(c.id)}). Use a string such as "R${i + 1}".`, { path: `${path}.id` });
      return;
    }
    const id = c.id;
    if (/[.\s]/.test(id)) {
      error('INVALID_ID', `Component id "${id}" must not contain dots or spaces.`, { component: id, path: `${path}.id` });
      return;
    }
    if (RESERVED_NAMES.has(id.toLowerCase())) {
      error('INVALID_ID', `"${id}" is a reserved word and cannot be used as a component id.`, { component: id, path: `${path}.id` });
      return;
    }
    if (comps.has(id)) {
      error('DUPLICATE_ID', `Duplicate component id "${id}" (already used by ${paths.get(id)}).`, { component: id, path: `${path}.id` });
      return;
    }
    paths.set(id, path);
    if (c.type === undefined || c.type === null || c.type === '') {
      error('MISSING_TYPE', `Component ${id} has no "type".`, { component: id, path });
      comps.set(id, null);
      return;
    }
    if (typeof c.type !== 'string') {
      error('UNKNOWN_TYPE', `The type of ${id} must be text such as "resistor", not ${describe(c.type)}.`, { component: id, path: `${path}.type` });
      comps.set(id, null);
      return;
    }
    const t = c.type.toLowerCase().replace(/[\s-]+/g, '_');
    if (UNSUPPORTED_TYPES.includes(t)) {
      error('UNSUPPORTED_COMPONENT', `Component type "${c.type}" (${id}) is not supported yet. Use "microcontroller" with custom pins instead.`, { component: id, type: c.type, path: `${path}.type` });
      comps.set(id, null);
      return;
    }
    if (!canonicalType(c.type)) {
      const s = suggest(() => suggestType(c.type));
      error('UNKNOWN_TYPE', `Unknown component type "${c.type}" on ${id}.${didYouMean(s)}`, {
        component: id, type: c.type, path: `${path}.type`,
        ...(s ? { fix: { label: `Change type to "${s}"`, path: `${path}.type`, value: s } } : {}),
      });
      comps.set(id, null);
      return;
    }
    // Rotation: any angle in degrees, clockwise ("angle" is accepted as an alias).
    let comp = c;
    const turns = [['rotation', c.rotation], ['angle', c.angle]].filter(([, v]) => v !== undefined);
    for (const [key, v] of turns) {
      if (typeof v !== 'number' || !Number.isFinite(v)) {
        error('INVALID_PROPERTY', `${key === 'angle' ? 'Angle' : 'Rotation'} of ${id} must be a number of degrees, e.g. 0, 45, 90.`, { component: id, path: `${path}.${key}` });
      }
    }
    if (turns.length === 2 && typeof c.rotation === 'number' && typeof c.angle === 'number' && normAngle(c.rotation) !== normAngle(c.angle)) {
      error('INVALID_PROPERTY', `${id} has both "rotation" (${c.rotation}) and "angle" (${c.angle}); use one.`, { component: id, path: `${path}.angle` });
    }
    const turn = turns.find(([, v]) => typeof v === 'number' && Number.isFinite(v));
    if (turn) {
      comp = { ...c, rotation: normAngle(turn[1]) };
      delete comp.angle;
    }
    if (c.position !== undefined) {
      const p = c.position;
      if (!(isObject(p) && Number.isFinite(p.x) && Number.isFinite(p.y))) {
        error('INVALID_PROPERTY', `Position of ${id} must be {"x": number, "y": number}.`, { component: id, path: `${path}.position` });
      } else if (Math.abs(p.x) > MAX_COORD || Math.abs(p.y) > MAX_COORD) {
        error('INVALID_PROPERTY', `Position of ${id} is outside the sheet: x and y must be between -${MAX_COORD} and ${MAX_COORD}.`, { component: id, path: `${path}.position` });
      }
    }
    for (const key of ['value', 'label']) {
      if (c[key] != null && !isText(c[key])) {
        error('INVALID_PROPERTY', `"${key}" of ${id} must be text or a number (for example "10kΩ"), not ${describe(c[key])}.`, { component: id, path: `${path}.${key}` });
      }
    }
    if (c.mirror !== undefined && typeof c.mirror !== 'boolean') {
      error('INVALID_PROPERTY', `"mirror" of ${id} must be true or false, not ${describe(c.mirror)}.`, { component: id, path: `${path}.mirror` });
    }
    if (c.section !== undefined && !SECTIONS.includes(c.section)) {
      error('INVALID_PROPERTY', `Section of ${id} must be input, process, output or power.`, { component: id, path: `${path}.section` });
    }
    for (const key of ['params', 'bom', 'education', 'pinTypes', 'simulation']) {
      if (c[key] !== undefined && !isObject(c[key])) {
        error('INVALID_PROPERTY', `"${key}" of ${id} must be an object, not ${describe(c[key])}.`, { component: id, path: `${path}.${key}` });
      }
    }
    for (const problem of pinSpecProblems(c)) {
      // a "pins" field that a part ignores is harmless; one that is malformed is not
      const ignored = /has no effect/.test(problem);
      (ignored ? warn : error)(ignored ? 'IGNORED_PROPERTY' : 'INVALID_PROPERTY', `${id}: ${problem}`, { component: id, path: `${path}.pins` });
    }
    const sym = resolveSymbol(comp);
    if (isObject(c.pinTypes)) {
      for (const [pin, et] of Object.entries(c.pinTypes)) {
        const at = formatPath(['components', i, 'pinTypes', pin]);
        if (!ELECTRICAL_TYPES.includes(et)) {
          error('INVALID_PROPERTY', `Electrical pin type "${et}" is not one of: ${ELECTRICAL_TYPES.join(', ')}.`, { component: id, path: at });
        } else if (!resolvePin(sym, pin)) {
          warn('INVALID_PROPERTY', `pinTypes names pin "${pin}", which ${id} does not have. Pins: ${sym.pinOrder.join(', ')}.`, { component: id, path: at });
        }
      }
    }
    comps.set(id, { comp, sym });
  });

  // ---- connections
  const connections = [];
  let duplicateWarnings = 0, duplicates = 0;
  const pinConns = new Map(); // pin -> indices of the connections that name it
  let connIndex = 0;
  const connectedPins = new Map(); // id -> Set(pin)
  const mentioned = new Set(); // ids referenced by any connection, valid or not
  const inBadConnection = new Set(); // ids in a connection that failed: the pin is wired, just wrongly
  for (const conn of normalizeConnections(circuit)) {
    if (errors.length > limits.errors) { truncated = true; break; }
    const { path } = conn;
    if (!Array.isArray(conn.refs)) {
      error('INVALID_CONNECTION', `${path} must be an array of pin references like ["R1.1", "C1.2"].`, { path });
      continue;
    }
    if (conn.refs.length < 2) {
      error('INVALID_CONNECTION', `${path} needs at least two endpoints.`, { path });
      continue;
    }
    if (conn.refs.length > limits.endpointsPerConnection) {
      error('LIMIT_EXCEEDED', `${path} joins ${conn.refs.length} pins; the limit is ${limits.endpointsPerConnection}.`, { path });
      continue;
    }
    const ends = [];
    let bad = false;
    conn.refs.forEach((raw, k) => {
      const at = conn.refPaths[k] || path;
      const ref = parseRef(raw);
      if (!ref) {
        error('INVALID_CONNECTION', `Invalid pin reference ${JSON.stringify(raw)} in ${path}. Use "ComponentId.pin", for example "R1.2".`, { path: at });
        bad = true; return;
      }
      mentioned.add(ref.comp);
      if (!comps.has(ref.comp)) {
        // Designators such as R1/R12/R13 differ by a digit, which is a different part, not a typo:
        // only a case slip (or, for long names, one edit) is suggested.
        const s = suggest(() => closest(ref.comp, allIds, ref.comp.length >= 6 ? 1 : 0));
        error('MISSING_COMPONENT', `Connection references missing component "${ref.comp}" (${raw}).${didYouMean(s)}`, {
          component: ref.comp, ref: raw, path: at,
          ...(s ? { fix: { label: `Use "${s}" instead`, path: at, value: ref.pin == null ? s : `${s}.${ref.pin}` } } : {}),
        });
        bad = true; return;
      }
      const entry = comps.get(ref.comp);
      if (!entry) { bad = true; return; } // component already reported
      const { sym, comp } = entry;
      let pin;
      if (ref.pin == null) {
        if (sym.pinOrder.length === 1) pin = sym.pinOrder[0];
        else {
          error('INVALID_PIN', `Connection to ${ref.comp} must name a pin (${sym.pinOrder.join(', ')}).`, { component: ref.comp, pin: null, ref: raw, path: at });
          bad = true; return;
        }
      } else {
        pin = resolvePin(sym, ref.pin);
        if (!pin) {
          const s = suggest(() => closest(ref.pin, [...sym.pinOrder, ...Object.keys(sym.aliases)].map((n) => [n, sym.aliases[n.toLowerCase()] || n])));
          error('INVALID_PIN', `Pin ${ref.pin} does not exist on ${sym.name.toLowerCase()} ${ref.comp}. Available: ${sym.pinOrder.join(', ')}.${didYouMean(s)}`, {
            component: ref.comp, pin: ref.pin, ref: raw, path: at,
            ...(s ? { fix: { label: `Use pin "${s}"`, path: at, value: `${ref.comp}.${s}` } } : {}),
          });
          bad = true; return;
        }
      }
      ends.push({ comp: comp.id, pin });
    });
    if (bad) {
      for (const raw of conn.refs) { const r = parseRef(raw); if (r) inBadConnection.add(r.comp); }
      continue;
    }
    const keys = ends.map((e) => `${e.comp}.${e.pin}`);
    if (new Set(keys).size !== keys.length) {
      error('INVALID_CONNECTION', `${path} connects a pin to itself (${keys.join(', ')}).`, { path });
      continue;
    }
    // A pair listed twice: two pins that an earlier connection already joins. Found by
    // counting, per earlier connection, how many of these pins it names (linear in the
    // pins, however long the connections are).
    const here = connIndex++;
    const shared = new Map(); // earlier connection -> the first two of our pins it also names
    for (const key of keys) {
      for (const j of pinConns.get(key) || []) {
        const seen = shared.get(j);
        if (!seen) shared.set(j, [key]); else if (seen.length === 1) seen.push(key);
      }
      if (!pinConns.has(key)) pinConns.set(key, []);
      pinConns.get(key).push(here);
    }
    for (const pair of shared.values()) {
      if (pair.length < 2) continue;
      if (duplicates++ < MAX_DUPLICATE_WARNINGS) warn('DUPLICATE_CONNECTION', `Duplicate connection between ${pair[0]} and ${pair[1]}.`, { path });
    }
    for (const e of ends) {
      if (!connectedPins.has(e.comp)) connectedPins.set(e.comp, new Set());
      connectedPins.get(e.comp).add(e.pin);
    }
    // Optional wire hints: waypoints the router must pass through, or a fully
    // manual orthogonal route. Both are validated here so the router can trust them.
    const pts = (list, field) => {
      if (list == null) return null;
      const where = `${path}.${field}`;
      if (!Array.isArray(list)) {
        error('INVALID_CONNECTION', `${where} must be a list of points like [{"x":120,"y":80}] or [[120,80]].`, { path: where });
        return null;
      }
      const out = [];
      for (const p of list) {
        const x = Array.isArray(p) ? p[0] : p?.x, y = Array.isArray(p) ? p[1] : p?.y;
        if (!Number.isFinite(x) || !Number.isFinite(y)) {
          error('INVALID_CONNECTION', `${where} must be points like [{"x":120,"y":80}] or [[120,80]].`, { path: where });
          return null;
        }
        if (Math.abs(x) > MAX_COORD || Math.abs(y) > MAX_COORD) {
          error('INVALID_CONNECTION', `${where} has a point outside the sheet: x and y must be between -${MAX_COORD} and ${MAX_COORD}.`, { path: where });
          return null;
        }
        out.push({ x: snap(x, 10), y: snap(y, 10) });
      }
      return out.length ? out : null;
    };
    const route = pts(conn.route, 'route');
    if (route) {
      for (let i = 1; i < route.length; i++) {
        if (route[i].x !== route[i - 1].x && route[i].y !== route[i - 1].y) {
          error('INVALID_CONNECTION', `${path}.route must be orthogonal: point ${i + 1} is diagonal from the previous one.`, { path: `${path}.route` });
          break;
        }
      }
    }
    if (conn.class && !CONNECTION_CLASSES.includes(conn.class)) {
      warn('INVALID_PROPERTY', `Unknown connection class "${conn.class}"; expected ${CONNECTION_CLASSES.join(', ')}.${didYouMean(closest(conn.class, CONNECTION_CLASSES))}`, { path });
    }
    connections.push({ ends, name: conn.name, path, class: conn.class, waypoints: pts(conn.waypoints, 'waypoints'), route, locked: conn.locked, label: conn.label });
  }

  if (duplicates > MAX_DUPLICATE_WARNINGS) warn('DUPLICATE_CONNECTION', `${duplicates - MAX_DUPLICATE_WARNINGS} more duplicate connections not shown.`);
  for (const [id, entry] of comps) {
    if (!entry || truncated) continue; // after an early stop, "not connected" would be a guess
    const used = connectedPins.get(id);
    if (!used) {
      if (!mentioned.has(id)) warn('UNCONNECTED_COMPONENT', `${id} is not connected to anything.`, { component: id, path: paths.get(id) });
      continue;
    }
    if (inBadConnection.has(id)) continue; // already reported against the connection itself
    for (const req of entry.sym.required || []) {
      const pin = resolvePin(entry.sym, req);
      if (pin && !used.has(pin)) warn('MISSING_REQUIRED_PIN', `Required pin ${pin} of ${id} is not connected.`, { component: id, pin, path: paths.get(id) });
    }
  }

  return finish(circuit, { resolved: { comps, connections, paths } });
}
