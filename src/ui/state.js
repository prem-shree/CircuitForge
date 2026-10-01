// State shared by the UI modules.
import { History } from '../editor/history.js';
import { LRU } from '../editor/cache.js';

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

// localStorage can be missing or throw (private windows, blocked storage).
export const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } },
};

export const state = {
  text: '',
  circuit: null,     // last successfully parsed circuit object (an API envelope is unwrapped)
  wrapped: false,    // the text is { "circuit": {…} }
  syntaxError: false, // the text does not parse right now: edits are refused until it does
  result: null,      // last drawable render (with scene)
  findings: [],
  problems: [],      // everything shown in the problems panel, with lines
  selection: [],     // selected part ids
  net: null,         // highlighted net id
  tool: 'select',    // or 'wire'
  pending: null,     // first pin picked with the wire tool
  snap: store.get('cf-snap') !== '0',
  grid: store.get('cf-grid') !== '0',
  bridges: store.get('cf-bridges') === '1',
  drag: null,
  lastMs: 0,         // how long the last full render took
  clipboard: null,   // sub-circuit copied with Ctrl+C
};

export const history = new History();
export const renderCache = new LRU(6);
