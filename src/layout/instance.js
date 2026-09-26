// A placed component: world pins, body, rail markers, labels and total extent.
//
// Any rotation angle is allowed. At right angles every pin lands on the 10px
// routing grid by construction. At other angles each pin tip is moved to the
// nearest grid point that lies further out along the pin (preferring points on
// the pin's own line), and a short lead extension is drawn from the symbol's
// lead to that point, so wires still end exactly on the pin.
import {
  DIRS, OPPOSITE, GRID, xform, xformVec, xformRect, rectPoly, rotateVec, vecToDir, unionRect, boundsOf, textWidth,
  normAngle, inflate,
} from '../utils/geometry.js';

export const REF_SIZE = 11;
export const VALUE_SIZE = 10.5;

function textBox(text, x, y, anchor, size) {
  const w = textWidth(text, size);
  const x0 = anchor === 'start' ? x : anchor === 'end' ? x - w : x - w / 2;
  return { x: x0, y: y - size * 0.82, w, h: size * 1.05 };
}

function label(text, x, y, anchor, cls, size) {
  return { text: String(text), x, y, anchor, cls, size, box: textBox(text, x, y, anchor, size) };
}

// Grid point for an angled pin: never inside the lead (no spur past the tip),
// close by, and preferably on the pin's own line so the extension is straight.
function outwardGridPoint(p, v) {
  const bx = Math.floor(p.x / GRID) * GRID, by = Math.floor(p.y / GRID) * GRID;
  let best = null, bestScore = Infinity;
  for (let i = -1; i <= 2; i++) for (let j = -1; j <= 2; j++) {
    const c = { x: bx + i * GRID, y: by + j * GRID };
    const dx = c.x - p.x, dy = c.y - p.y;
    const along = dx * v.x + dy * v.y;
    if (along < -1e-6) continue;
    const perp = Math.abs(dx * v.y - dy * v.x);
    const score = Math.hypot(dx, dy) + 3 * perp;
    if (score < bestScore) { bestScore = score; best = c; }
  }
  return best;
}

// Axis directions a wire may leave an angled pin by (those pointing outward).
function exitsFor(v) {
  return Object.entries(DIRS)
    .map(([name, d]) => [name, d.x * v.x + d.y * v.y])
    .filter(([, dot]) => dot > 0.2)
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name);
}

// Where the lead of a pin meets the body, in symbol coordinates.
function leadInner(sym, p) {
  const b = sym.body, d = DIRS[p.dir];
  let dist = d.x < 0 ? b.x - p.x : d.x > 0 ? p.x - (b.x + b.w) : d.y < 0 ? b.y - p.y : p.y - (b.y + b.h);
  const inside = d.x ? p.y >= b.y && p.y <= b.y + b.h : p.x >= b.x && p.x <= b.x + b.w;
  if (!inside) dist = Math.min(dist, 30);
  dist = Math.max(0, Math.min(60, dist));
  return { x: p.x - d.x * dist, y: p.y - d.y * dist };
}

// Rotated body outline, optionally grown or shrunk by d on every side.
export const bodyPoly = (I, d = 0) => rectPoly(d ? inflate(I.part.sym.body, d) : I.part.sym.body, I.t);

export function makeInstance(part, x, y, rot, mirror, nets, cfg = {}) {
  const s = part.sym;
  const angle = normAngle(rot);
  const ortho = angle % 90 === 0;
  const t = { x, y, rot: angle, mirror, ox: s.origin.x, oy: s.origin.y };
  // part.cluster (set by bridge layouts) pins tips and exit sides explicitly
  const ov = part.cluster || null;
  const pins = {};
  for (const n of s.pinOrder) {
    const lp = s.pins[n];
    const exact = xform(lp, t);
    const vec = xformVec(DIRS[lp.dir], t);
    let tip = exact;
    if (ov?.tips?.[n]) tip = { x: x + ov.tips[n].dx, y: y + ov.tips[n].dy };
    else if (!ortho || exact.x % GRID || exact.y % GRID) tip = outwardGridPoint(exact, vec);
    const dir = ov?.dirs?.[n] || vecToDir(vec);
    const exits = ov?.dirs?.[n] || ortho ? [dir] : exitsFor(vec);
    const pin = { x: tip.x, y: tip.y, dir, exits, vec, inner: xform(leadInner(s, lp), t) };
    if (Math.hypot(tip.x - exact.x, tip.y - exact.y) > 0.01) pin.ext = [exact, { x: tip.x, y: tip.y }];
    pins[n] = pin;
  }
  const poly = rectPoly(s.body, t);
  const inst = { id: part.id, part, t, x, y, rot: angle, mirror, pins, poly, body: boundsOf(poly) };
  inst.markers = buildMarkers(inst, nets);
  const sets = buildLabels(inst, cfg.labelGap ?? 6).filter(Boolean);
  inst.labelSets = sets;
  inst.labels = sets[0] || [];
  inst.labelAlt = sets[1] || [];
  computeExtent(inst);
  return inst;
}

export function computeExtent(inst) {
  let e = unionRect(inst.body, boundsOf(Object.values(inst.pins)));
  for (const m of inst.markers) e = unionRect(e, m.bbox);
  for (const l of inst.labels) e = unionRect(e, l.box);
  inst.extent = e;
}

function rotFor(localDir, worldDir) {
  for (const r of [0, 90, 180, 270]) {
    const d = DIRS[localDir];
    if (vecToDir(rotateVec(d.x, d.y, r)) === worldDir) return r;
  }
  return 0;
}

const railFace = (rail, pinDir) => (rail.kind === 'ground' || rail.kind === 'negative' ? 'down' : rail.kind === 'power' ? 'up' : pinDir);

function buildMarkers(inst, nets) {
  const out = [];
  if (!nets) return out;
  // Adjacent pins on the same side going to the same rail share one marker
  // (e.g. a 555's VCC and RESET): short stubs joined by a bus.
  const groups = new Map();
  for (const [pinName, net] of Object.entries(inst.part.pinNets)) {
    const info = nets.get(net);
    if (!info?.rail) continue;
    const pin = inst.pins[pinName];
    const key = railFace(info.rail, pin.dir) === pin.dir && info.rail.kind !== 'label' ? net + '|' + pin.dir : pinName;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(pinName);
  }
  for (const pinNames of groups.values()) {
    const net = inst.part.pinNets[pinNames[0]];
    const rail = nets.get(net).rail;
    let pin = inst.pins[pinNames[0]];
    let face = railFace(rail, pin.dir);
    let stub = 0;
    const stubs = [];
    let bus = null;
    if (pinNames.length > 1) {
      const d = DIRS[pin.dir];
      const ends = pinNames.map((n) => {
        const p = inst.pins[n];
        stubs.push({ x1: p.x, y1: p.y, x2: p.x + d.x * 10, y2: p.y + d.y * 10 });
        return { x: p.x + d.x * 10, y: p.y + d.y * 10 };
      });
      const b = boundsOf(ends);
      bus = { x1: b.x, y1: b.y, x2: b.x + b.w, y2: b.y + b.h };
      stubs.push(bus);
      const mid = { x: Math.round((b.x + b.w / 2) / 10) * 10, y: Math.round((b.y + b.h / 2) / 10) * 10 };
      pin = { ...mid, dir: pin.dir };
    }
    if (face === OPPOSITE[pin.dir]) face = pin.dir;
    else if (face !== pin.dir) stub = rail.kind === 'label' ? 10 : 30;
    const d = DIRS[pin.dir];
    const at = { x: pin.x + d.x * stub, y: pin.y + d.y * stub };
    if (stub) stubs.push({ x1: pin.x, y1: pin.y, x2: at.x, y2: at.y });
    const m = { net, pin: pinNames[0], pins: pinNames, rail, face, stubs, dot: bus ? { x: pin.x, y: pin.y } : null };
    if (rail.kind === 'label') {
      buildLabelFlag(m, at, face);
    } else {
      const ms = rail.sym;
      const mt = { x: at.x, y: at.y, rot: rotFor(ms.pins[ms.pinOrder[0]].dir, OPPOSITE[face]), mirror: false, ox: ms.origin.x, oy: ms.origin.y };
      m.t = mt;
      m.sym = ms;
      m.bbox = xformRect(ms.body, mt);
      if (ms.text) {
        const p = xform(ms.text, mt);
        // Keep rail text upright and on the far side of the marker.
        const y = face === 'down' ? m.bbox.y + m.bbox.h + 11 : face === 'up' ? m.bbox.y - 5 : p.y + 4;
        const x = face === 'left' ? m.bbox.x - 3 : face === 'right' ? m.bbox.x + m.bbox.w + 3 : p.x;
        const anchor = face === 'left' ? 'end' : face === 'right' ? 'start' : 'middle';
        m.text = label(rail.name, x, y, anchor, 'rail', 10);
        m.bbox = unionRect(m.bbox, m.text.box);
      }
    }
    for (const st of stubs) m.bbox = unionRect(m.bbox, boundsOf([{ x: st.x1, y: st.y1 }, { x: st.x2, y: st.y2 }]));
    out.push(m);
  }
  return out;
}

function buildLabelFlag(m, at, face) {
  const name = m.rail.name;
  const w = textWidth(name, 10) + 14, h = 14;
  const { x, y } = at;
  let pts, tx, ty, anchor;
  if (face === 'right' || face === 'left') {
    const s = face === 'right' ? 1 : -1;
    pts = [[x, y], [x + s * 7, y - h / 2], [x + s * w, y - h / 2], [x + s * w, y + h / 2], [x + s * 7, y + h / 2]];
    tx = x + s * 9; ty = y + 3.5; anchor = face === 'right' ? 'start' : 'end';
  } else {
    const s = face === 'down' ? 1 : -1;
    const top = face === 'down' ? y + 7 : y - 7 - h;
    pts = [[x, y], [x, y + s * 7]]; // short stem into a boxed label
    m.box = { x: x - w / 2, y: top, w, h };
    tx = x; ty = top + h / 2 + 3.5; anchor = 'middle';
  }
  m.flag = pts;
  m.text = label(name, tx, ty, anchor, 'netlabel', 10);
  m.bbox = boundsOf([...pts.map(([px, py]) => ({ x: px, y: py })), ...(m.box ? [{ x: m.box.x, y: m.box.y }, { x: m.box.x + m.box.w, y: m.box.y + m.box.h }] : [])]);
}

function buildLabels(inst, gap) {
  const s = inst.part.sym, c = inst.part.comp;
  const b = inst.body;
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
  const ref = c.label ?? c.id;
  const value = c.value != null && c.value !== '' ? String(c.value) : null;
  const sets = [];

  if (s.text) {
    const p = xform(s.text, inst.t);
    const txt = s.text.default === '$id' ? (c.label ?? c.value ?? c.id) : (c.value ?? s.text.default);
    // Terminal text always reads outward from the pin.
    const pinDir = inst.pins[s.pinOrder[0]].dir;
    let anchor = s.text.anchor;
    if (s.terminal) {
      anchor = pinDir === 'right' ? 'end' : pinDir === 'left' ? 'start' : 'middle';
      const q = anchor === 'end' ? { x: b.x - 4, y: cy + 4 } : anchor === 'start' ? { x: b.x + b.w + 4, y: cy + 4 } : { x: cx, y: pinDir === 'down' ? b.y - 4 : b.y + b.h + 12 };
      sets.push([label(txt, q.x, q.y, anchor, 'text', REF_SIZE)]);
      sets.push([label(txt, cx, b.y - gap, 'middle', 'text', REF_SIZE)]);
      sets.push([label(txt, cx, b.y + b.h + gap + 9, 'middle', 'text', REF_SIZE)]);
    } else sets.push([label(txt, p.x, p.y + 4, anchor, 'text', REF_SIZE)]);
    return sets;
  }
  if (s.labels === 'none') return [[]];

  const side = (right) => {
    const x = right ? b.x + b.w + gap : b.x - gap;
    const a = right ? 'start' : 'end';
    const out = [];
    if (value) {
      out.push(label(ref, x, cy - 1, a, 'ref', REF_SIZE));
      out.push(label(value, x, cy + 11, a, 'value', VALUE_SIZE));
    } else out.push(label(ref, x, cy + 4, a, 'ref', REF_SIZE));
    return out;
  };
  const horizontalPins = s.twoTerminal && ['left', 'right'].includes(inst.pins[s.pinOrder[0]].dir);

  // Angled parts: text beside the part, offset square to its axis.
  if (inst.rot % 90 !== 0 && s.twoTerminal) {
    const a = inst.pins[s.pinOrder[0]], z = inst.pins[s.pinOrder[1]];
    const len = Math.hypot(z.x - a.x, z.y - a.y) || 1;
    const ax = { x: (z.x - a.x) / len, y: (z.y - a.y) / len };
    const mid = boundsOf(inst.poly);
    const center = { x: mid.x + mid.w / 2, y: mid.y + mid.h / 2 };
    const off0 = Math.min(s.body.w, s.body.h) / 2 + gap + 6;
    const beside = (px, py, off = off0, slide = 0) => {
      const p = { x: center.x + px * off + ax.x * slide, y: center.y + py * off + ax.y * slide };
      const anchor = px > 0.3 ? 'start' : px < -0.3 ? 'end' : 'middle';
      const lines = value ? [[ref, 'ref', REF_SIZE], [value, 'value', VALUE_SIZE]] : [[ref, 'ref', REF_SIZE]];
      // stack away from the part: upward when above it, downward when below
      const firstY = py < -0.3 ? p.y - (lines.length - 1) * 12 : py > 0.3 ? p.y + 9 : p.y + 4 - (lines.length - 1) * 6;
      return lines.map(([txt, cls, size], i) => label(txt, p.x, firstY + i * 12, anchor, cls, size));
    };
    const n1 = { x: -ax.y, y: ax.x }, n2 = { x: ax.y, y: -ax.x };
    const cc = inst.part.cluster?.center;
    if (cc) {
      // on a bridge diamond, text goes on the outside, never in the middle
      const toPart = { x: center.x - (inst.x + cc.dx), y: center.y - (inst.y + cc.dy) };
      const out = n1.x * toPart.x + n1.y * toPart.y >= 0 ? n1 : n2;
      const spots = [];
      for (const off of [off0, off0 + 14]) for (const slide of [0, -16, 16]) spots.push(beside(out.x, out.y, off, slide));
      return spots;
    } else {
      // the upper side first: text above a diagonal part reads most naturally
      const [up, down] = n1.y <= n2.y ? [n1, n2] : [n2, n1];
      sets.push(beside(up.x, up.y), beside(down.x, down.y));
    }
  }

  // Stacked above / below / split, used by the flat orientations.
  const stack = (where) => {
    const out = [];
    if (where === 'split') {
      out.push(label(ref, cx, b.y - gap, 'middle', 'ref', REF_SIZE));
      if (value) out.push(label(value, cx, b.y + b.h + gap + 7, 'middle', 'value', VALUE_SIZE));
    } else if (where === 'above') {
      out.push(label(ref, cx, b.y - (value ? gap + 12 : gap), 'middle', 'ref', REF_SIZE));
      if (value) out.push(label(value, cx, b.y - gap, 'middle', 'value', VALUE_SIZE));
    } else {
      out.push(label(ref, cx, b.y + b.h + gap + 9, 'middle', 'ref', REF_SIZE));
      if (value) out.push(label(value, cx, b.y + b.h + gap + 21, 'middle', 'value', VALUE_SIZE));
    }
    return out;
  };

  if (s.twoTerminal && horizontalPins) {
    sets.push(stack('split'), stack('above'), stack('below'), side(true), side(false));
  } else if (s.twoTerminal || s.labels === 'right') {
    sets.push(side(true), side(false), stack('above'), stack('below'));
  } else if (s.labels === 'topright') {
    const corner = (x, anchor, y = b.y + 3) => {
      const out = [label(ref, x, y, anchor, 'ref', REF_SIZE)];
      if (value) out.push(label(value, x, y + 12, anchor, 'value', VALUE_SIZE));
      return out;
    };
    // the last two clear supply-pin markers above and below the body
    sets.push(corner(cx + 16, 'start'), corner(b.x - gap, 'end'), stack('above'),
      corner(cx + 14, 'start', b.y - gap - (value ? 12 : 0)), corner(cx + 14, 'start', b.y + b.h + gap + 9));
  } else if (s.labels === 'box') {
    // the value is drawn inside the box by the symbol generator
    sets.push(
      [label(ref, b.x + b.w, b.y - gap, 'end', 'ref', REF_SIZE)],
      [label(ref, b.x, b.y - gap, 'start', 'ref', REF_SIZE)],
      [label(ref, b.x + b.w, b.y + b.h + gap + 9, 'end', 'ref', REF_SIZE)],
    );
  } else {
    sets.push(stack('split'), stack('above'), stack('below'), side(true));
  }
  return sets;
}
