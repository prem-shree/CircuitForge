export const GRID = 10;

export const DIRS = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
};
export const OPPOSITE = { left: 'right', right: 'left', up: 'down', down: 'up' };

export const snap = (v, g = GRID) => Math.round(v / g) * g;

export function vecToDir(v) {
  if (Math.abs(v.x) >= Math.abs(v.y)) return v.x < 0 ? 'left' : 'right';
  return v.y < 0 ? 'up' : 'down';
}

// Rotate a vector clockwise (screen coordinates, y down) by 0/90/180/270.
export function rotateVec(x, y, rot) {
  switch (((rot % 360) + 360) % 360) {
    case 90: return { x: -y, y: x };
    case 180: return { x: -x, y: -y };
    case 270: return { x: y, y: -x };
    default: return { x, y };
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

export function xformDir(dir, t) {
  const d = DIRS[dir];
  const r = rotateVec(t.mirror ? -d.x : d.x, d.y, t.rot);
  return vecToDir(r);
}

export function xformRect(r, t) {
  const pts = [
    xform({ x: r.x, y: r.y }, t), xform({ x: r.x + r.w, y: r.y }, t),
    xform({ x: r.x, y: r.y + r.h }, t), xform({ x: r.x + r.w, y: r.y + r.h }, t),
  ];
  return boundsOf(pts);
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
