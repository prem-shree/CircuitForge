// A placed component: world pins, body, rail markers, labels and total extent.
import { DIRS, OPPOSITE, xform, xformDir, xformRect, rotateVec, vecToDir, unionRect, boundsOf, textWidth } from '../utils/geometry.js';

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

export function makeInstance(part, x, y, rot, mirror, nets, cfg = {}) {
  const s = part.sym;
  const t = { x, y, rot, mirror, ox: s.origin.x, oy: s.origin.y };
  const pins = {};
  for (const n of s.pinOrder) {
    const w = xform(s.pins[n], t);
    pins[n] = { x: w.x, y: w.y, dir: xformDir(s.pins[n].dir, t) };
  }
  const inst = { id: part.id, part, t, x, y, rot, mirror, pins, body: xformRect(s.body, t) };
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
    const corner = (x, anchor) => {
      const out = [label(ref, x, b.y + 3, anchor, 'ref', REF_SIZE)];
      if (value) out.push(label(value, x, b.y + 15, anchor, 'value', VALUE_SIZE));
      return out;
    };
    sets.push(corner(cx + 16, 'start'), corner(b.x - gap, 'end'), stack('above'));
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
