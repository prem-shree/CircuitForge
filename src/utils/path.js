// JSON paths in the notation the validator uses in error messages:
//   components[2].type   connections[0][1]   nets.VOUT[0]   nets["V-OUT"]
// A path is an array of segments (strings for keys, numbers for indices).

const IDENT = /^[A-Za-z0-9_$]+$/;

export function formatPath(segments) {
  let out = '';
  for (const seg of segments) {
    if (typeof seg === 'number') out += `[${seg}]`;
    else if (IDENT.test(seg)) out += out ? `.${seg}` : seg;
    else out += `[${JSON.stringify(seg)}]`;
  }
  return out;
}

export function parsePath(path) {
  const segs = [];
  const s = String(path);
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === '.') { i++; continue; }
    if (c === '[') {
      if (s[i + 1] === '"') {
        let j = i + 2;
        while (j < s.length && !(s[j] === '"' && s[j - 1] !== '\\')) j++;
        segs.push(JSON.parse(s.slice(i + 1, j + 1)));
        i = j + 2;
      } else {
        const j = s.indexOf(']', i);
        if (j < 0) break;
        segs.push(Number(s.slice(i + 1, j)));
        i = j + 1;
      }
      continue;
    }
    let j = i;
    while (j < s.length && s[j] !== '.' && s[j] !== '[') j++;
    segs.push(s.slice(i, j));
    i = j;
  }
  return segs;
}

const hasOwn = (o, k) => o != null && Object.prototype.hasOwnProperty.call(o, k);

export function getPath(root, path) {
  let cur = root;
  for (const seg of Array.isArray(path) ? path : parsePath(path)) {
    if (cur == null || typeof cur !== 'object' || !hasOwn(cur, seg)) return undefined;
    cur = cur[seg];
  }
  return cur;
}

// Set the value at `path` (which must already lead to a container); returns false
// when the path cannot be followed. `undefined` removes the key / array item.
export function setPath(root, path, value) {
  const segs = Array.isArray(path) ? path : parsePath(path);
  if (!segs.length) return false;
  let cur = root;
  for (let i = 0; i < segs.length - 1; i++) {
    if (cur == null || typeof cur !== 'object' || !hasOwn(cur, segs[i])) return false;
    cur = cur[segs[i]];
  }
  const last = segs[segs.length - 1];
  if (cur == null || typeof cur !== 'object') return false;
  if (value === undefined) {
    if (Array.isArray(cur)) { if (!(last >= 0 && last < cur.length)) return false; cur.splice(last, 1); } else delete cur[last];
  } else if (Array.isArray(cur)) {
    if (!(last >= 0 && last < cur.length)) return false;
    cur[last] = value;
  } else {
    // "__proto__" as a key would rewrite the prototype rather than add a property
    Object.defineProperty(cur, last, { value, writable: true, enumerable: true, configurable: true });
  }
  return true;
}
