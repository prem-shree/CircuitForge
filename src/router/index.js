// Orthogonal wire router.
//
// Grid A* (10px cells) with state = (cell, heading), so bends are costed.
// Each net is grown as a tree: first pin seeds it, every further pin is routed
// to the nearest point of the existing tree (T-junctions appear naturally).
// Rules: wires leave/enter pins straight along the pin direction, never run
// through bodies or leads, never overlap another net, only cross another net
// perpendicularly on a straight run (no corner/junction sharing), and avoid
// 4-way junctions (allowed at a cost). If a net can't be routed strictly, a relaxed pass allows
// violations at high cost; failing that, an L-shaped fallback is drawn and a
// ROUTING_FAILURE warning is raised.
import { GRID, DIRS, OPPOSITE, unionRect, inflate } from '../utils/geometry.js';

const DX = [1, 0, -1, 0], DY = [0, 1, 0, -1];
const DIR_INDEX = { right: 0, down: 1, left: 2, up: 3 };
const BIT = [1, 2, 4, 8]; // bit for "connected towards direction i"
const BEND = 5, CROSS = 8, VIOLATION = 400;

const popcount = (b) => (b & 1) + ((b >> 1) & 1) + ((b >> 2) & 1) + ((b >> 3) & 1);

export function routeCircuit(nl, instances) {
  const insts = [...instances.values()];
  let bounds = null;
  for (const I of insts) bounds = unionRect(bounds, I.extent);
  bounds = bounds || { x: 0, y: 0, w: 0, h: 0 };
  const PAD = 80;
  const x0 = Math.floor((bounds.x - PAD) / GRID) * GRID;
  const y0 = Math.floor((bounds.y - PAD) / GRID) * GRID;
  const W = Math.ceil((bounds.x + bounds.w + PAD - x0) / GRID) + 1;
  const H = Math.ceil((bounds.y + bounds.h + PAD - y0) / GRID) + 1;
  const N = W * H;
  const cellOf = (x, y) => {
    const cx = Math.round((x - x0) / GRID), cy = Math.round((y - y0) / GRID);
    return cx < 0 || cy < 0 || cx >= W || cy >= H ? -1 : cy * W + cx;
  };
  const cx = (c) => x0 + (c % W) * GRID, cy = (c) => y0 + Math.floor(c / W) * GRID;

  const blocked = new Uint8Array(N);
  const soft = new Float32Array(N);
  const pinOwner = new Int32Array(N).fill(-1); // routed net index, or -2 for "no one"
  const pinEntry = new Int8Array(N).fill(-1);
  const occH = new Int32Array(N), occV = new Int32Array(N); // net index + 1

  const fillRect = (r, fn) => {
    const ax = Math.ceil((r.x - x0) / GRID), bx = Math.floor((r.x + r.w - x0) / GRID);
    const ay = Math.ceil((r.y - y0) / GRID), by = Math.floor((r.y + r.h - y0) / GRID);
    for (let j = Math.max(0, ay); j <= Math.min(H - 1, by); j++)
      for (let i = Math.max(0, ax); i <= Math.min(W - 1, bx); i++) fn(j * W + i);
  };

  // ---- routed nets
  const routed = [];
  const netIndex = new Map();
  for (const [id, net] of nl.nets) {
    if (net.rail) continue;
    const pins = net.pins.filter((e) => instances.has(e.comp)).map((e) => {
      const p = instances.get(e.comp).pins[e.pin];
      return { ...e, x: p.x, y: p.y, dir: p.dir, cell: cellOf(p.x, p.y) };
    });
    if (pins.length < 2) continue;
    netIndex.set(id, routed.length);
    routed.push({ id, pins });
  }

  // ---- obstacles
  for (const I of insts) {
    const body = inflate(I.body, 3);
    fillRect(body, (c) => { blocked[c] = 1; });
    fillRect(inflate(I.body, 11), (c) => { soft[c] += 0.6; });
    for (const l of I.labels) fillRect(inflate(l.box, 2), (c) => { soft[c] += 6; });
    for (const [name, p] of Object.entries(I.pins)) {
      const c = cellOf(p.x, p.y);
      if (c < 0) continue;
      const net = I.part.pinNets[name];
      const ni = netIndex.has(net) ? netIndex.get(net) : -2;
      // lead cells between the pin tip and the body
      const d = DIRS[p.dir];
      for (let k = 1; k <= 6; k++) {
        const lx = p.x - d.x * GRID * k, ly = p.y - d.y * GRID * k;
        const lc = cellOf(lx, ly);
        if (lc < 0) break;
        blocked[lc] = 1;
        if (lx >= body.x && lx <= body.x + body.w && ly >= body.y && ly <= body.y + body.h) break;
      }
      blocked[c] = 1;
      pinOwner[c] = ni;
      pinEntry[c] = DIR_INDEX[OPPOSITE[p.dir]];
    }
    for (const m of I.markers) {
      fillRect(inflate(m.bbox, 3), (c) => { if (pinOwner[c] === -1) blocked[c] = 1; });
    }
  }

  // ---- per-net state
  const bits = routed.map(() => new Map()); // cell -> connectivity bits
  const addBit = (ni, c, b) => bits[ni].set(c, (bits[ni].get(c) || 0) | b);
  routed.forEach((net, ni) => {
    for (const p of net.pins) if (p.cell >= 0) addBit(ni, p.cell, BIT[DIR_INDEX[OPPOSITE[p.dir]]]);
  });

  // ---- A*
  const S = N * 4;
  const g = new Float64Array(S);
  const stamp = new Uint32Array(S);
  const prev = new Int32Array(S);
  let gen = 0;
  const heap = [];
  const push = (f, s) => {
    heap.push([f, s]);
    let i = heap.length - 1;
    while (i > 0) { const pa = (i - 1) >> 1; if (heap[pa][0] <= heap[i][0]) break; [heap[pa], heap[i]] = [heap[i], heap[pa]]; i = pa; }
  };
  const pop = () => {
    const top = heap[0], last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]]; i = m;
      }
    }
    return top;
  };

  const foreign = (occ, c, ni) => occ[c] !== 0 && occ[c] !== ni + 1;
  const foreignBits = (c, ni) => {
    const o = occH[c] && occH[c] !== ni + 1 ? occH[c] - 1 : occV[c] && occV[c] !== ni + 1 ? occV[c] - 1 : -1;
    return o < 0 ? 0 : bits[o].get(c) || 0;
  };

  function search(ni, start, startDir, tree, relaxed) {
    gen++;
    heap.length = 0;
    let bx1 = Infinity, by1 = Infinity, bx2 = -Infinity, by2 = -Infinity;
    for (const c of tree) {
      const x = c % W, y = (c / W) | 0;
      bx1 = Math.min(bx1, x); bx2 = Math.max(bx2, x); by1 = Math.min(by1, y); by2 = Math.max(by2, y);
    }
    const h = (c) => {
      const x = c % W, y = (c / W) | 0;
      return Math.max(0, bx1 - x, x - bx2) + Math.max(0, by1 - y, y - by2);
    };
    const s0 = start * 4 + startDir;
    g[s0] = 0; stamp[s0] = gen; prev[s0] = -1;
    push(h(start), s0);
    let iter = 0;
    while (heap.length) {
      if (++iter > 400000) break;
      const [f, s] = pop();
      const c = s >> 2, d = s & 3;
      const gc = g[s];
      if (f - h(c) > gc + 1e-9) continue;
      if (c !== start && tree.has(c)) return s;
      for (let nd = 0; nd < 4; nd++) {
        if (nd === ((d + 2) & 3)) continue;
        const x = (c % W) + DX[nd], y = ((c / W) | 0) + DY[nd];
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const n = y * W + x;
        let cost = 1 + soft[n];
        if (nd !== d) {
          if (c === start) continue; // leave pins straight
          cost += BEND;
          if (foreign(occH, c, ni) || foreign(occV, c, ni)) { if (!relaxed) continue; cost += VIOLATION; }
        }
        const owner = pinOwner[n];
        if (owner !== -1) {
          if (owner !== ni || nd !== pinEntry[n]) { if (!relaxed || owner === ni) continue; cost += VIOLATION * 2; }
        } else if (blocked[n]) {
          if (!relaxed) continue;
          cost += VIOLATION * 2;
        }
        const horiz = nd === 0 || nd === 2;
        if (foreign(horiz ? occH : occV, n, ni)) { if (!relaxed) continue; cost += VIOLATION; }
        if (foreign(horiz ? occV : occH, n, ni)) {
          const fb = foreignBits(n, ni);
          const straight = horiz ? fb === (BIT[1] | BIT[3]) : fb === (BIT[0] | BIT[2]);
          if (!straight) { if (!relaxed) continue; cost += VIOLATION; }
          cost += CROSS;
        }
        if (tree.has(n) && owner === -1) {
          const nb = (bits[ni].get(n) || 0) | BIT[(nd + 2) & 3];
          if (popcount(nb) > 3) cost += BEND;
        }
        const ns = n * 4 + nd;
        const ng = gc + cost;
        if (stamp[ns] === gen && g[ns] <= ng) continue;
        stamp[ns] = gen; g[ns] = ng; prev[ns] = s;
        push(ng + h(n), ns);
      }
    }
    return -1;
  }

  const commitPath = (ni, cells) => {
    for (let i = 0; i + 1 < cells.length; i++) {
      const a = cells[i], b = cells[i + 1];
      const horiz = Math.abs(a - b) === 1;
      const occ = horiz ? occH : occV;
      if (!occ[a]) occ[a] = ni + 1;
      if (!occ[b]) occ[b] = ni + 1;
      const d = horiz ? (b > a ? 0 : 2) : (b > a ? 1 : 3);
      addBit(ni, a, BIT[d]);
      addBit(ni, b, BIT[(d + 2) & 3]);
    }
  };

  const failures = [];
  const paths = routed.map(() => []);
  const order = routed.map((_, i) => i).sort((a, b) => span(routed[a].pins) - span(routed[b].pins));
  for (const ni of order) {
    const net = routed[ni];
    const pins = net.pins.filter((p) => p.cell >= 0);
    const first = pins.reduce((m, p) => (p.x < m.x || (p.x === m.x && p.y < m.y) ? p : m), pins[0]);
    const tree = new Set([first.cell]);
    const todo = pins.filter((p) => p !== first);
    while (todo.length) {
      // nearest unconnected pin to the tree
      let bi = 0, bd = Infinity;
      todo.forEach((p, i) => {
        for (const c of tree) {
          const dd = Math.abs(cx(c) - p.x) + Math.abs(cy(c) - p.y);
          if (dd < bd) { bd = dd; bi = i; }
        }
      });
      const p = todo.splice(bi, 1)[0];
      if (tree.has(p.cell)) continue;
      const sd = DIR_INDEX[p.dir];
      let end = search(ni, p.cell, sd, tree, false);
      if (end < 0) end = search(ni, p.cell, sd, tree, true);
      let cells;
      if (end >= 0) {
        cells = [];
        for (let s = end; s >= 0; s = prev[s]) cells.push(s >> 2);
        cells.reverse();
      } else {
        failures.push({ net: net.id, comp: p.comp, pin: p.pin });
        const t = [...tree][0];
        const mid = cellOf(cx(t), p.y);
        cells = [p.cell, mid, t].filter((c, i, a) => c >= 0 && c !== a[i - 1]);
        cells = expandCells(cells, W);
      }
      commitPath(ni, cells);
      for (const c of cells) tree.add(c);
      paths[ni].push(cells.map((c) => ({ x: cx(c), y: cy(c) })));
    }
  }

  // ---- results
  const nets = new Map();
  routed.forEach((net, ni) => nets.set(net.id, { id: net.id, paths: paths[ni].map(simplify), segments: toSegments(paths[ni]) }));
  const junctions = [];
  routed.forEach((net, ni) => {
    for (const [c, b] of bits[ni]) if (popcount(b) >= 3) junctions.push({ x: cx(c), y: cy(c), net: net.id });
  });
  const crossings = [];
  for (let c = 0; c < N; c++) {
    if (occH[c] && occV[c] && occH[c] !== occV[c]) {
      crossings.push({ x: cx(c), y: cy(c), h: routed[occH[c] - 1].id, v: routed[occV[c] - 1].id });
    }
  }
  return { nets, junctions, crossings, failures };
}

function span(pins) {
  const xs = pins.map((p) => p.x), ys = pins.map((p) => p.y);
  return Math.max(...xs) - Math.min(...xs) + Math.max(...ys) - Math.min(...ys);
}

// Fill in intermediate cells of an axis-aligned cell polyline.
function expandCells(cells, W) {
  const out = [cells[0]];
  for (let i = 1; i < cells.length; i++) {
    let a = out[out.length - 1];
    const b = cells[i];
    const bx = b % W, by = (b / W) | 0;
    // horizontal first then vertical
    while (a % W !== bx) { a += bx > a % W ? 1 : -1; out.push(a); }
    while (((a / W) | 0) !== by) { a += by > ((a / W) | 0) ? W : -W; out.push(a); }
  }
  return out;
}

export function simplify(pts) {
  const out = [];
  for (const p of pts) {
    if (out.length >= 2) {
      const a = out[out.length - 2], b = out[out.length - 1];
      if ((a.x === b.x && b.x === p.x) || (a.y === b.y && b.y === p.y)) { out[out.length - 1] = p; continue; }
    }
    if (!out.length || out[out.length - 1].x !== p.x || out[out.length - 1].y !== p.y) out.push(p);
  }
  return out;
}

function toSegments(paths) {
  const segs = [];
  for (const path of paths) {
    const s = simplify(path);
    for (let i = 0; i + 1 < s.length; i++) segs.push({ x1: s[i].x, y1: s[i].y, x2: s[i + 1].x, y2: s[i + 1].y });
  }
  return segs;
}
