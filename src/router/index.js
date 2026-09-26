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
import { GRID, DIRS, OPPOSITE, unionRect, boundsOf, pointInPoly, segHitsPoly, distToSeg } from '../utils/geometry.js';
import { bodyPoly } from '../layout/instance.js';

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
  const PAD = 140; // routing margin around the drawing: room to route around parts
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
  // Bitmask of the moves a wire may use to arrive at a pin: from the outward
  // side only. Several pins can share a point (a bridge corner), so masks OR.
  const pinEntry = new Uint8Array(N);
  // The cell straight in front of a pin is that pin's escape track: no other net
  // may take it, otherwise the pin can end up unreachable and route badly.
  const approach = new Int32Array(N).fill(-1);
  const occH = new Int32Array(N), occV = new Int32Array(N); // net index + 1

  const fillRect = (r, fn) => {
    const ax = Math.ceil((r.x - x0) / GRID), bx = Math.floor((r.x + r.w - x0) / GRID);
    const ay = Math.ceil((r.y - y0) / GRID), by = Math.floor((r.y + r.h - y0) / GRID);
    for (let j = Math.max(0, ay); j <= Math.min(H - 1, by); j++)
      for (let i = Math.max(0, ax); i <= Math.min(W - 1, bx); i++) fn(j * W + i);
  };
  // cells whose centres lie inside a (rotated) outline
  const fillPoly = (poly, fn) => fillRect(boundsOf(poly), (c) => { if (pointInPoly({ x: cx(c), y: cy(c) }, poly)) fn(c); });
  // cells a lead passes through (within 4.5px of it), apart from the pin tip
  const fillLead = (pts, tipCell, fn) => {
    for (let i = 0; i + 1 < pts.length; i++) {
      const a = pts[i], b = pts[i + 1];
      const box = boundsOf([a, b]);
      fillRect({ x: box.x - GRID, y: box.y - GRID, w: box.w + 2 * GRID, h: box.h + 2 * GRID }, (c) => {
        if (c !== tipCell && distToSeg({ x: cx(c), y: cy(c) }, a, b) < 4.5) fn(c);
      });
    }
  };

  // ---- routed nets
  const routed = [];
  const netIndex = new Map();
  for (const [id, net] of nl.nets) {
    if (net.rail) continue;
    const pins = net.pins.filter((e) => instances.has(e.comp)).map((e) => {
      const p = instances.get(e.comp).pins[e.pin];
      return { ...e, x: p.x, y: p.y, dir: p.dir, exits: p.exits || [p.dir], cell: cellOf(p.x, p.y) };
    });
    if (pins.length < 2) continue;
    netIndex.set(id, routed.length);
    routed.push({ id, pins });
  }

  // ---- obstacles (the real, possibly rotated, outline of each part)
  const approachWanted = [];
  for (const I of insts) {
    fillPoly(bodyPoly(I, 3), (c) => { blocked[c] = 1; });
    fillPoly(bodyPoly(I, 11), (c) => { soft[c] += 0.6; });
    // keep wires off the text: the labels already chosen for this part if any
    for (const l of I.labelsFinal || I.labels) fillRect({ x: l.box.x - 2, y: l.box.y - 2, w: l.box.w + 4, h: l.box.h + 4 }, (c) => { soft[c] += 6; });
    for (const [name, p] of Object.entries(I.pins)) {
      const c = cellOf(p.x, p.y);
      if (c < 0) continue;
      const net = I.part.pinNets[name];
      const ni = netIndex.has(net) ? netIndex.get(net) : -2;
      // the lead from the tip back into the body, including any extension
      const leadPts = [{ x: p.x, y: p.y }, ...(p.ext ? [p.ext[0]] : []), p.inner];
      fillLead(leadPts, c, (lc) => { blocked[lc] = 1; });
      blocked[c] = 1;
      if (pinOwner[c] === -1 || pinOwner[c] === ni) {
        pinOwner[c] = ni;
        for (const e of p.exits || [p.dir]) pinEntry[c] |= 1 << DIR_INDEX[OPPOSITE[e]];
      }
      for (const e of p.exits || [p.dir]) approachWanted.push([cellOf(p.x + DIRS[e].x * GRID, p.y + DIRS[e].y * GRID), ni]);
    }
    for (const m of I.markers) {
      fillRect({ x: m.bbox.x - 3, y: m.bbox.y - 3, w: m.bbox.w + 6, h: m.bbox.h + 6 }, (c) => { if (pinOwner[c] === -1) blocked[c] = 1; });
    }
  }
  for (const [ac, ni] of approachWanted) {
    if (ac >= 0 && approach[ac] === -1 && pinOwner[ac] === -1 && !blocked[ac]) approach[ac] = ni;
  }

  // ---- per-net state
  const bits = routed.map(() => new Map()); // cell -> connectivity bits (leads + wires)
  const wireBits = routed.map(() => new Map()); // cell -> bits from wires only
  const pinsAt = routed.map(() => new Map()); // cell -> number of pins
  const addBit = (ni, c, b) => bits[ni].set(c, (bits[ni].get(c) || 0) | b);
  routed.forEach((net, ni) => {
    for (const p of net.pins) {
      if (p.cell < 0) continue;
      pinsAt[ni].set(p.cell, (pinsAt[ni].get(p.cell) || 0) + 1);
      if (p.exits.length === 1) addBit(ni, p.cell, BIT[DIR_INDEX[OPPOSITE[p.dir]]]);
    }
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

  function search(ni, start, startDirs, tree, relaxed) {
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
    for (const sd of startDirs) {
      const s0 = start * 4 + sd;
      g[s0] = 0; stamp[s0] = gen; prev[s0] = -1;
      push(h(start), s0);
    }
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
        if (approach[n] !== -1 && approach[n] !== ni) { if (!relaxed) continue; cost += VIOLATION; }
        const owner = pinOwner[n];
        if (owner !== -1) {
          if (owner !== ni || !(pinEntry[n] & (1 << nd))) { if (!relaxed || owner === ni) continue; cost += VIOLATION * 2; }
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
      wireBits[ni].set(a, (wireBits[ni].get(a) || 0) | BIT[d]);
      wireBits[ni].set(b, (wireBits[ni].get(b) || 0) | BIT[(d + 2) & 3]);
    }
  };

  const failures = [];
  const paths = routed.map(() => []);
  const trace = (end) => {
    const cells = [];
    for (let s = end; s >= 0; s = prev[s]) cells.push(s >> 2);
    return cells.reverse();
  };
  // Manual wire hints from the JSON: fixed routes and waypoints.
  const hintsByNet = new Map();
  for (const hint of nl.hints || []) {
    if (!netIndex.has(hint.net)) continue;
    if (!hintsByNet.has(hint.net)) hintsByNet.set(hint.net, []);
    hintsByNet.get(hint.net).push(hint);
  }
  const pinCell = (ni, e) => routed[ni].pins.find((p) => p.comp === e.comp && p.pin === e.pin);

  const order = routed.map((_, i) => i).sort((a, b) => span(routed[a].pins) - span(routed[b].pins));
  for (const ni of order) {
    const net = routed[ni];
    const pins = net.pins.filter((p) => p.cell >= 0);
    const tree = new Set();

    // (a) manual routes / waypoints first: they define part of the net's tree.
    for (const hint of hintsByNet.get(net.id) || []) {
      const ends = hint.ends.map((e) => pinCell(ni, e)).filter((p) => p && p.cell >= 0);
      if (ends.length < 2) continue;
      const a = ends[0], b = ends[ends.length - 1];
      let cells = null;
      if (hint.route) {
        const rc = hint.route.map((p) => cellOf(p.x, p.y)).filter((c) => c >= 0);
        if (rc.length) {
          const full = [a.cell, ...rc, b.cell].filter((c, i, arr) => i === 0 || c !== arr[i - 1]);
          cells = expandCells(full, W);
        }
      } else if (hint.waypoints) {
        const stops = [a.cell, ...hint.waypoints.map((p) => cellOf(p.x, p.y)).filter((c) => c >= 0), b.cell];
        cells = [];
        let okAll = true;
        for (let i = 0; i + 1 < stops.length; i++) {
          const from = stops[i], to = stops[i + 1];
          if (from === to) continue;
          const startDirs = i === 0 ? a.exits.map((e) => DIR_INDEX[e]) : [0, 1, 2, 3];
          const target = new Set([to]);
          let end = search(ni, from, startDirs, target, false);
          if (end < 0) end = search(ni, from, startDirs, target, true);
          if (end < 0) { okAll = false; break; }
          const leg = trace(end);
          cells.push(...(cells.length ? leg.slice(1) : leg));
        }
        if (!okAll || cells.length < 2) {
          cells = null;
          failures.push({ net: net.id, comp: a.comp, pin: a.pin, reason: 'waypoints' });
        }
      }
      if (cells && cells.length > 1) {
        commitPath(ni, cells);
        for (const c of cells) tree.add(c);
        paths[ni].push(cells.map((c) => ({ x: cx(c), y: cy(c) })));
      }
    }

    if (!tree.size) {
      const first = pins.reduce((m, p) => (p.x < m.x || (p.x === m.x && p.y < m.y) ? p : m), pins[0]);
      tree.add(first.cell);
    }
    const todo = pins.filter((p) => !tree.has(p.cell));
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
      const sd = p.exits.map((e) => DIR_INDEX[e]);
      let end = search(ni, p.cell, sd, tree, false);
      if (end < 0) end = search(ni, p.cell, sd, tree, true);
      let cells;
      if (end >= 0) {
        cells = trace(end);
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
  // A junction is any point where three or more things of one net meet: wire
  // directions plus pins (two parts touching at a corner count as two).
  const junctions = [];
  routed.forEach((net, ni) => {
    const cells = new Set([...wireBits[ni].keys(), ...pinsAt[ni].keys()]);
    for (const c of cells) {
      if (popcount(wireBits[ni].get(c) || 0) + (pinsAt[ni].get(c) || 0) >= 3) junctions.push({ x: cx(c), y: cy(c), net: net.id });
    }
  });
  const crossings = [];
  for (let c = 0; c < N; c++) {
    if (occH[c] && occV[c] && occH[c] !== occV[c]) {
      crossings.push({ x: cx(c), y: cy(c), h: routed[occH[c] - 1].id, v: routed[occV[c] - 1].id });
    }
  }
  // A relaxed route may have cut through a body or another net: report it.
  // ponytail: O(segments x parts) scan; fine at schematic scale.
  const violations = [];
  const shrunk = insts.map((I) => [I, bodyPoly(I, -1.5)]);
  for (const [id, net] of nets) {
    for (const seg of net.segments) {
      for (const [I, poly] of shrunk) {
        if (segHitsPoly(seg, poly)) {
          violations.push({ code: 'WIRE_THROUGH_COMPONENT', net: id, comp: I.id, x: I.body.x + I.body.w / 2, y: I.body.y + I.body.h / 2 });
          break;
        }
      }
    }
  }
  const all = [...nets.values()].flatMap((nn) => nn.segments.map((sg) => ({ ...sg, net: nn.id })));
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
    const a = all[i], b = all[j];
    if (a.net === b.net) continue;
    const overlap = (a.y1 === a.y2 && b.y1 === b.y2 && a.y1 === b.y1 &&
        Math.min(Math.max(a.x1, a.x2), Math.max(b.x1, b.x2)) > Math.max(Math.min(a.x1, a.x2), Math.min(b.x1, b.x2)))
      || (a.x1 === a.x2 && b.x1 === b.x2 && a.x1 === b.x1 &&
        Math.min(Math.max(a.y1, a.y2), Math.max(b.y1, b.y2)) > Math.max(Math.min(a.y1, a.y2), Math.min(b.y1, b.y2)));
    if (overlap) violations.push({ code: 'WIRE_OVERLAP', net: a.net, other: b.net, x: (Math.max(Math.min(a.x1, a.x2), Math.min(b.x1, b.x2)) + Math.min(Math.max(a.x1, a.x2), Math.max(b.x1, b.x2))) / 2, y: (a.y1 + b.y2) / 2 });
  }
  return { nets, junctions, crossings, failures, violations };
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
