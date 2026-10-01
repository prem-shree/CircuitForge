// Map JSON paths to source positions, so a problem reported against
// "components[3].type" can point at the exact line and column of the text.
//
//   const index = indexJSON(text);
//   index.locate('components[3].type')  -> { line, column, offset, end } | null
//
// The scanner assumes the text is valid JSON (parseJSON reports syntax errors);
// on invalid text it returns whatever it indexed before stopping. When a path
// does not exist (a missing property) the nearest existing parent is used.
import { formatPath, parsePath } from '../utils/path.js';

const MAX_DEPTH = 256;

export function indexJSON(text) {
  const s = String(text);
  const spans = new Map(); // path string -> [start, end)
  let i = 0;

  const ws = () => { while (i < s.length && (s[i] === ' ' || s[i] === '\t' || s[i] === '\n' || s[i] === '\r')) i++; };
  const string = () => {
    const start = i++;
    while (i < s.length && s[i] !== '"') i += s[i] === '\\' ? 2 : 1;
    i++;
    return s.slice(start, Math.min(i, s.length));
  };
  const value = (path, depth) => {
    ws();
    const start = i;
    const c = s[i];
    if (c === '{' || c === '[') {
      const isObj = c === '{';
      i++; ws();
      let n = 0;
      while (i < s.length && s[i] !== (isObj ? '}' : ']')) {
        const before = i;
        let key = n;
        if (isObj) {
          key = JSON.parse(string());
          ws(); i++; // ':'
        }
        const child = path.concat(key);
        if (depth < MAX_DEPTH) value(child, depth + 1); else skip();
        n++;
        ws();
        if (s[i] === ',') { i++; ws(); }
        // Malformed text (a "}" closing an array, say) can leave the scanner where it
        // was; stop rather than loop. The caller keeps whatever was indexed so far.
        if (i === before) throw new Error('no progress');
      }
      i++;
    } else if (c === '"') string();
    else while (i < s.length && !',]} \t\n\r'.includes(s[i])) i++;
    spans.set(formatPath(path), [start, i]);
  };
  // beyond MAX_DEPTH: skip a value without indexing it
  const skip = () => {
    ws();
    let depth = 0;
    do {
      const c = s[i];
      if (c === '"') { string(); continue; }
      if (c === '{' || c === '[') depth++;
      else if (c === '}' || c === ']') depth--;
      else if (depth === 0 && (c === ',' || c === '}' || c === ']')) return;
      i++;
    } while (i < s.length && depth > 0);
  };

  try { value([], 0); } catch { /* keep the partial index */ }

  // offset -> line/column through a table of line starts
  const starts = [0];
  for (let k = 0; k < s.length; k++) if (s[k] === '\n') starts.push(k + 1);
  const position = (offset) => {
    let lo = 0, hi = starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (starts[mid] <= offset) lo = mid; else hi = mid - 1;
    }
    return { line: lo + 1, column: offset - starts[lo] + 1 };
  };

  return {
    has: (path) => spans.has(formatPath(Array.isArray(path) ? path : parsePath(path))),
    locate(path) {
      const segs = Array.isArray(path) ? path.slice() : parsePath(path);
      for (;;) {
        const span = spans.get(formatPath(segs));
        if (span) return { ...position(span[0]), offset: span[0], end: span[1] };
        if (!segs.length) return null;
        segs.pop();
      }
    },
  };
}

// An index built on first use and then shared: a caller that may annotate several lists
// of problems for the same text pays for the scan once, and only if a line is needed.
export function lazyIndex(text) {
  let idx = null;
  return () => (idx ||= indexJSON(text));
}

// Add line/column to every problem that carries a path, when the text is known.
// `root` is the path of the circuit inside the text (['circuit'] for an API envelope).
// `index` may be an index already built for this text, or a function returning one (see lazyIndex).
export function annotateLines(problems, text, root = [], index = null) {
  const need = problems.filter((p) => p.path && !p.line);
  if (!need.length) return problems; // syntax errors carry their own line; nothing to look up
  const idx = typeof index === 'function' ? index() : index || indexJSON(text);
  for (const p of need) {
    const at = idx.locate([...root, ...parsePath(p.path)]);
    if (at) { p.line = at.line; p.column = at.column; }
  }
  return problems;
}
