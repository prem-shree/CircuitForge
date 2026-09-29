// A small least-recently-used cache. The editor keeps the last few rendered
// scenes so undo, redo and switching theme do not run layout and routing again.
export class LRU {
  constructor(max = 6) {
    this.max = max;
    this.map = new Map();
  }
  get(key) {
    if (!this.map.has(key)) return undefined;
    const value = this.map.get(key);
    this.map.delete(key);
    this.map.set(key, value); // now the most recently used
    return value;
  }
  set(key, value) {
    this.map.delete(key);
    this.map.set(key, value);
    while (this.map.size > this.max) this.map.delete(this.map.keys().next().value);
    return value;
  }
  has(key) { return this.map.has(key); }
  clear() { this.map.clear(); }
  get size() { return this.map.size; }
}

// FNV-1a: a short key for a long text (collisions are made vanishingly unlikely
// by also keying on the length).
export function hashText(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `${(h >>> 0).toString(36)}.${text.length}`;
}
