// Normalized symbol access. Every symbol, whether imported from an external
// library or generated (box ICs), is exposed in one shape:
// { type, name, category, width, height, pins:{NAME:{x,y,dir,io}}, pinOrder,
//   body:{x,y,w,h}, svgBody, origin:{x,y}, aliases, rail, kind, text, labels, ... }
import LIB from './library.generated.js';
import { textWidth, snap } from '../utils/geometry.js';

const norm = (s) => String(s).trim().toLowerCase().replace(/[\s-]+/g, '_');

const TYPE_ALIAS = {};
for (const [type, def] of Object.entries(LIB)) {
  for (const a of def.typeAliases || []) TYPE_ALIAS[norm(a)] = type;
}

// Board-level parts we deliberately do not support yet (architecture allows them later).
export const UNSUPPORTED_TYPES = ['arduino', 'arduino_uno', 'arduino_nano', 'arduino_mega', 'esp32', 'esp8266', 'nodemcu', 'raspberry_pi', 'rpi', 'raspberry_pi_pico', 'rpi_pico'];

export function canonicalType(type) {
  if (type == null) return null;
  const t = norm(type);
  return LIB[t] ? t : TYPE_ALIAS[t] || null;
}

export function listTypes() {
  return Object.values(LIB).map((d) => ({ type: d.type, name: d.name, category: d.category, aliases: d.typeAliases || [] }));
}

export function getDef(type) {
  return LIB[canonicalType(type)] || null;
}

const cache = new Map();

export function resolveSymbol(component) {
  const type = canonicalType(component.type);
  const def = LIB[type];
  if (!def) return null;
  if (def.kind === 'box') {
    const key = type + '|' + JSON.stringify(component.pins ?? null) + '|' + (component.label ?? '') + '|' + (component.value ?? '');
    if (!cache.has(key)) cache.set(key, buildBox(def, component));
    return cache.get(key);
  }
  if (!cache.has(type)) cache.set(type, finish(def, { ...def }));
  return cache.get(type);
}

function finish(def, sym) {
  sym.pinOrder = Object.keys(sym.pins);
  const first = sym.pins[sym.pinOrder[0]];
  sym.origin = { x: first.x, y: first.y };
  const aliases = {};
  for (const n of sym.pinOrder) {
    aliases[n.toLowerCase()] = n;
    if (n.startsWith('~')) aliases[n.slice(1).toLowerCase()] = n;
  }
  for (const [a, n] of Object.entries(def.aliases || {})) {
    const target = sym.pinOrder.find((p) => p.toLowerCase() === n.toLowerCase());
    if (target && !(a.toLowerCase() in aliases)) aliases[a.toLowerCase()] = target;
  }
  sym.aliases = aliases;
  sym.twoTerminal = sym.pinOrder.length === 2 && !sym.kind && !sym.terminal;
  return sym;
}

export function resolvePin(sym, name) {
  if (!sym || name == null) return null;
  return sym.aliases[String(name).trim().toLowerCase()] || null;
}

// ---- Generated rectangular IC symbols -------------------------------------

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function boxSpec(def, component) {
  const p = component.pins;
  if (p == null) return def.pins;
  const side = Object.keys(def.pins)[0] || 'right';
  if (typeof p === 'number') return { [side]: Array.from({ length: Math.max(1, Math.min(64, p | 0)) }, (_, i) => String(i + 1)) };
  if (Array.isArray(p)) {
    const names = p.map(String);
    if (def.type === 'connector') return { [side]: names };
    const half = Math.ceil(names.length / 2);
    return { left: names.slice(0, half), right: names.slice(half) };
  }
  if (typeof p === 'object') {
    const out = {};
    for (const s of ['left', 'right', 'top', 'bottom']) if (Array.isArray(p[s])) out[s] = p[s].map(String);
    return out;
  }
  return def.pins;
}

function buildBox(def, component) {
  const spec = boxSpec(def, component);
  const L = spec.left || [], R = spec.right || [], T = spec.top || [], B = spec.bottom || [];
  const FS = 9;
  const tw = (s) => textWidth(s.replace(/^~/, ''), FS);
  const title = component.label ?? def.label ?? '';
  const maxL = Math.max(0, ...L.map(tw)), maxR = Math.max(0, ...R.map(tw));
  const value = component.value != null && component.value !== '' ? String(component.value) : '';
  const titleW = Math.max(title ? textWidth(title, 11) : 0, value ? textWidth(value, 10) : 0) + (title || value ? 16 : 0);
  const sideW = Math.max(maxL, maxR);
  let W = Math.max(60, maxL + maxR + titleW + 20, titleW + 2 * sideW + 20, (Math.max(T.length, B.length) + 1) * 20);
  W = Math.ceil(W / 20) * 20;
  const rows = Math.max(L.length, R.length, 1);
  const top = 20;
  const firstY = top + (T.length ? 40 : 20);
  let bottom = firstY + (rows - 1) * 20 + (B.length ? 40 : 20);
  if (title && value && bottom - top < 60) bottom = top + 60;
  const pins = {};
  const parts = [`<rect x="20" y="${top}" width="${W}" height="${bottom - top}" fill="none" stroke="currentColor" stroke-width="1.6"/>`];
  const text = [];
  const label = (x, y, name, anchor) => {
    const over = name.startsWith('~');
    const shown = over ? name.slice(1) : name;
    text.push(`<text x="${x}" y="${y}" font-size="${FS}" text-anchor="${anchor}"${over ? ' text-decoration="overline"' : ''}>${esc(shown)}</text>`);
  };
  const io = (side) => def.io || (side === 'left' ? 'in' : side === 'right' ? 'out' : 'power');
  const isClock = (n) => /^~?(clk|cp|clock)$/i.test(n);
  const lines = [];
  L.forEach((n, i) => {
    const y = firstY + i * 20;
    pins[n] = { x: 0, y, dir: 'left', io: io('left') };
    lines.push(`M0 ${y}H20`);
    if (isClock(n)) { lines.push(`M20 ${y - 5}L27 ${y}L20 ${y + 5}`); label(30, y + 3, n, 'start'); }
    else label(24, y + 3, n, 'start');
  });
  R.forEach((n, i) => {
    const y = firstY + i * 20;
    pins[n] = { x: W + 40, y, dir: 'right', io: io('right') };
    lines.push(`M${W + 20} ${y}H${W + 40}`);
    label(W + 16, y + 3, n, 'end');
  });
  const across = (list, y, dir, ty) => {
    const x0 = 20 + snap((W - (list.length - 1) * 20) / 2);
    list.forEach((n, i) => {
      const x = x0 + i * 20;
      pins[n] = { x, y, dir, io: io(dir === 'up' ? 'top' : 'bottom') };
      lines.push(dir === 'up' ? `M${x} 0V${top}` : `M${x} ${bottom}V${bottom + 20}`);
      label(x, ty, n, 'middle');
    });
  };
  across(T, 0, 'up', top + 11);
  across(B, bottom + 20, 'down', bottom - 5);
  if (lines.length) parts.push(`<path d="${lines.join('')}" fill="none" stroke="currentColor" stroke-width="1.6"/>`);
  const mid = (top + bottom) / 2;
  if (title) text.push(`<text x="${20 + W / 2}" y="${value ? mid - 2 : mid + 4}" font-size="11" font-weight="600" text-anchor="middle">${esc(title)}</text>`);
  if (value) text.push(`<text x="${20 + W / 2}" y="${title ? mid + 11 : mid + 4}" font-size="10" text-anchor="middle" fill-opacity="0.75">${esc(value)}</text>`);
  parts.push(`<g fill="currentColor" stroke="none">${text.join('')}</g>`);
  if (!Object.keys(pins).length) pins['1'] = { x: 0, y: firstY, dir: 'left', io: 'passive' };
  return finish(def, {
    ...def,
    pins,
    width: W + 40,
    height: bottom + 20,
    body: { x: 20, y: top, w: W, h: bottom - top },
    svgBody: parts.join(''),
    labels: 'box',
    boxSpec: spec,
  });
}
