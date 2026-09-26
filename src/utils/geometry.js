export const GRID = 10;

export const DIRS = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
};
export const OPPOSITE = { left: 'right', right: 'left', up: 'down', down: 'up' };

export const snap = (v, g = GRID) => Math.round(v / g) * g;

// Angles are degrees, clockwise on screen (y points down), kept in [0, 360).
export function normAngle(a) {
  const r = Math.round(((((Number(a) || 0) % 360) + 360) % 360) * 100) / 100;
  return r >= 360 ? 0 : r;
}
export const isOrthogonal = (a) => normAngle(a) % 90 === 0;

// Dominant axis of a vector; an exact diagonal counts as horizontal.
export function vecToDir(v) {
  if (Math.abs(v.x) >= Math.abs(v.y) - 1e-9) return v.x < 0 ? 'left' : 'right';
  return v.y < 0 ? 'up' : 'down';
}

// Rotate a vector clockwise (screen coordinates). Right angles are exact.
export function rotateVec(x, y, rot) {
  const a = normAngle(rot);
  switch (a) {
    case 0: return { x, y };
    case 90: return { x: -y, y: x };
    case 180: return { x: -x, y: -y };
    case 270: return { x: y, y: -x };
    default: {
      const r = (a * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r);
      return { x: x * c - y * s, y: x * s + y * c };
    }
  }
}

// Placement transform: local point -> world. `t` = {x, y, rot, mirror, ox, oy},
// where (ox, oy) is the symbol origin that lands on (x, y).
export function xform(p, t) {
  let x = p.x - t.ox;
  const y = p.y - t.oy;
  if (t.mirror) x = -x;
  const r = rotateVec(x, y, t.rot);
  return { x: r.x + t.x, y: r.y + t.y };
}

// Direction vector through the same mirror + rotation (no translation).
export const xformVec = (v, t) => rotateVec(t.mirror ? -v.x : v.x, v.y, t.rot);

export const xformDir = (dir, t) => vecToDir(xformVec(DIRS[dir], t));

// World corners of a local rectangle, in order (a convex polygon).
export function rectPoly(r, t) {
  return [
    xform({ x: r.x, y: r.y }, t), xform({ x: r.x + r.w, y: r.y }, t),
    xform({ x: r.x + r.w, y: r.y + r.h }, t), xform({ x: r.x, y: r.y + r.h }, t),
  ];
}

export const xformRect = (r, t) => boundsOf(rectPoly(r, t));

// Point inside (or on the edge of) a convex polygon.
export function pointInPoly(p, poly) {
  let sign = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const cross = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
    if (Math.abs(cross) < 1e-9) continue;
    const s = Math.sign(cross);
    if (sign && s !== sign) return false;
    sign = s;
  }
  return true;
}

function segsCross(a, b, c, d) {
  const o = (p, q, r) => Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x));
  return o(a, b, c) !== o(a, b, d) && o(c, d, a) !== o(c, d, b);
}

// Segment {x1,y1,x2,y2} touches a convex polygon.
export function segHitsPoly(s, poly) {
  const a = { x: s.x1, y: s.y1 }, b = { x: s.x2, y: s.y2 };
  if (pointInPoly(a, poly) || pointInPoly(b, poly)) return true;
  for (let i = 0; i < poly.length; i++) if (segsCross(a, b, poly[i], poly[(i + 1) % poly.length])) return true;
  return false;
}

// Axis-aligned rect {x,y,w,h} overlaps a convex polygon.
export function rectHitsPoly(r, poly) {
  const corners = [{ x: r.x, y: r.y }, { x: r.x + r.w, y: r.y }, { x: r.x + r.w, y: r.y + r.h }, { x: r.x, y: r.y + r.h }];
  if (corners.some((c) => pointInPoly(c, poly))) return true;
  if (poly.some((p) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h)) return true;
  for (let i = 0; i < 4; i++) {
    const a = corners[i], b = corners[(i + 1) % 4];
    for (let j = 0; j < poly.length; j++) if (segsCross(a, b, poly[j], poly[(j + 1) % poly.length])) return true;
  }
  return false;
}

// Distance from a point to a segment.
export function distToSeg(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2)) : 0;
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

export function boundsOf(pts) {
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const p of pts) {
    x1 = Math.min(x1, p.x); y1 = Math.min(y1, p.y);
    x2 = Math.max(x2, p.x); y2 = Math.max(y2, p.y);
  }
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

export function unionRect(a, b) {
  if (!a) return b;
  if (!b) return a;
  const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
}

export const inflate = (r, d) => ({ x: r.x - d, y: r.y - d, w: r.w + 2 * d, h: r.h + 2 * d });

export const overlaps = (a, b) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

export const translateRect = (r, dx, dy) => ({ x: r.x + dx, y: r.y + dy, w: r.w, h: r.h });

// Segment (axis-aligned) vs rect intersection.
export function segHitsRect(s, r) {
  const x1 = Math.min(s.x1, s.x2), x2 = Math.max(s.x1, s.x2);
  const y1 = Math.min(s.y1, s.y2), y2 = Math.max(s.y1, s.y2);
  return x1 <= r.x + r.w && x2 >= r.x && y1 <= r.y + r.h && y2 >= r.y;
}

// Approximate text width for Helvetica/Arial-like fonts.
export function textWidth(s, size = 11) {
  let w = 0;
  for (const ch of String(s)) {
    if ('il.,:;|!\'1'.includes(ch)) w += 0.3;
    else if ('MWmw@%'.includes(ch)) w += 0.85;
    else if (ch >= 'A' && ch <= 'Z') w += 0.68;
    else w += 0.56;
  }
  return w * size;
}
