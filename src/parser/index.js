// JSON text/object -> circuit object + normalized connection list.

export function parseJSON(text) {
  try {
    return { value: JSON.parse(text), errors: [] };
  } catch (e) {
    // Engines word (and locate) syntax errors differently; find it ourselves.
    const found = findSyntaxError(String(text));
    const pos = found ? found.pos : 0;
    const before = String(text).slice(0, pos).split('\n');
    const line = before.length, column = before[before.length - 1].length + 1;
    const message = found ? `Invalid JSON at line ${line}, column ${column}: ${found.message}` : `Invalid JSON: ${e.message}`;
    return { value: null, errors: [{ code: 'INVALID_JSON', message, line, column }] };
  }
}

// Minimal JSON scanner that returns the offset and cause of the first error.
function findSyntaxError(s) {
  let i = 0;
  const fail = (message) => { throw { pos: i, message }; };
  const ws = () => { while (i < s.length && ' \t\n\r'.includes(s[i])) i++; };
  const describe = () => (i >= s.length ? 'unexpected end of input' : `unexpected ${JSON.stringify(s[i])}`);
  const value = () => {
    ws();
    const c = s[i];
    if (c === '{') {
      i++; ws();
      if (s[i] === '}') { i++; return; }
      for (;;) {
        ws();
        if (s[i] !== '"') fail(`${describe()}, expected a "quoted" property name`);
        string(); ws();
        if (s[i] !== ':') fail(`${describe()}, expected ':'`);
        i++; value(); ws();
        if (s[i] === ',') { i++; ws(); if (s[i] === '}') fail('trailing comma before }'); continue; }
        if (s[i] === '}') { i++; return; }
        fail(`${describe()}, expected ',' or '}'`);
      }
    }
    if (c === '[') {
      i++; ws();
      if (s[i] === ']') { i++; return; }
      for (;;) {
        ws();
        if (s[i] === ',' || s[i] === ']') fail(s[i] === ']' ? 'trailing comma before ]' : `${describe()}, expected a value`);
        value(); ws();
        if (s[i] === ',') { i++; continue; }
        if (s[i] === ']') { i++; return; }
        fail(`${describe()}, expected ',' or ']'`);
      }
    }
    if (c === '"') return string();
    const m = /^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?|^(true|false|null)/.exec(s.slice(i, i + 400));
    if (m) { i += m[0].length; return; }
    fail(`${describe()}, expected a value`);
  };
  const string = () => {
    i++;
    while (i < s.length && s[i] !== '"') {
      if (s[i] === '\n') fail('unterminated string');
      if (s[i] === '\\') i++;
      i++;
    }
    if (i >= s.length) fail('unterminated string');
    i++;
  };
  try {
    value(); ws();
    if (i < s.length) fail(`${describe()} after the end of the document`);
    return null;
  } catch (e) {
    return e && typeof e.pos === 'number' ? e : null;
  }
}

// "R1.2" -> { comp: "R1", pin: "2" };  "GND" -> { comp: "GND", pin: null }
export function parseRef(ref) {
  if (typeof ref !== 'string' || !ref.trim()) return null;
  const s = ref.trim();
  const i = s.indexOf('.');
  if (i === 0 || i === s.length - 1) return null;
  return i < 0 ? { comp: s, pin: null, raw: s } : { comp: s.slice(0, i), pin: s.slice(i + 1), raw: s };
}

// Accepted connection forms:
//   ["A.1", "B.2", ...]            (2+ endpoints on one net)
//   { "from": "A.1", "to": "B.2" }
//   { "pins": ["A.1", "B.2"], "net": "VOUT" }
// plus an optional top-level "nets": { "VOUT": ["A.1", "B.2"] }.
export function normalizeConnections(circuit) {
  const list = [];
  const push = (refs, name, path) => list.push({ refs, name: name || null, path });
  const conns = Array.isArray(circuit.connections) ? circuit.connections : [];
  conns.forEach((c, i) => {
    const path = `connections[${i}]`;
    if (Array.isArray(c)) push(c, null, path);
    else if (c && typeof c === 'object') {
      if (Array.isArray(c.pins)) push(c.pins, c.net || c.name, path);
      else push([c.from, c.to], c.net || c.name, path);
    } else push(null, null, path);
  });
  if (circuit.nets && typeof circuit.nets === 'object' && !Array.isArray(circuit.nets)) {
    for (const [name, refs] of Object.entries(circuit.nets)) push(Array.isArray(refs) ? refs : null, name, `nets.${name}`);
  }
  return list;
}

export function parseCircuit(input) {
  if (typeof input === 'string') {
    const r = parseJSON(input);
    if (r.errors.length) return { circuit: null, errors: r.errors };
    input = r.value;
  }
  // Accept API-style envelopes: { circuit: {...} }
  if (input && typeof input === 'object' && input.circuit && !input.components) input = input.circuit;
  return { circuit: input, errors: [] };
}
