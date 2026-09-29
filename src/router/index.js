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

// Routing keeps several arrays per grid cell (about 100 bytes with the search
// state), so a sheet stretched over a huge area, say by a part positioned far
// away, is drawn with direct wires instead of exhausting memory.
export const MAX_CELLS = 1500000;

// Most A* expansions one routing pass may spend. Nets are routed shortest first,
// so on an extremely dense sheet the last, longest ones get direct wires.
export const MAX_WORK = 1e7;

// `seed` reorders the nets a little (shortest first still, roughly). Which net
// claims a corridor first decides who has to cross whom, so a second order is
// worth trying when the first leaves crossings behind. Seed 0 is the default.
export function routeCircuit(nl, instances, { maxWork = MAX_WORK, seed = 0 } = {}) {
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
  if (N > MAX_CELLS) return routeDirect(nl, instances);
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
  const closed = new Uint32Array(S);
  const prev = new Int32Array(S);
  let gen = 0;
  // Binary min-heap on typed arrays (no per-entry allocation). Entries with equal
  // cost prefer the deeper state, so the search runs straight at the goal across
  // open grid instead of fanning out over every equally-cheap cell.
  let hk = new Float64Array(4096), hv = new Int32Array(4096), hn = 0;
  const push = (key, v) => {
    if (hn === hk.length) {
      const k2 = new Float64Array(hn * 2), v2 = new Int32Array(hn * 2);
      k2.set(hk); v2.set(hv); hk = k2; hv = v2;
    }
    let i = hn++;
    while (i > 0) {
      const pa = (i - 1) >> 1;
      if (hk[pa] <= key) break;
      hk[i] = hk[pa]; hv[i] = hv[pa]; i = pa;
    }
    hk[i] = key; hv[i] = v;
  };
  const pop = () => {
    const top = hv[0];
    const key = hk[--hn], v = hv[hn];
    let i = 0;
    for (;;) {
      const l = 2 * i + 1;
      if (l >= hn) break;
      const r = l + 1;
      const m = r < hn && hk[r] < hk[l] ? r : l;
      if (hk[m] >= key) break;
      hk[i] = hk[m]; hv[i] = hv[m]; i = m;
    }
    if (hn) { hk[i] = key; hv[i] = v; }
    return top;
  };
  const TIE = 1e-6; // g-weight in the heap key; far below the smallest real cost step

  const foreign = (occ, c, ni) => occ[c] !== 0 && occ[c] !== ni + 1;
  const foreignBits = (c, ni) => {
    const o = occH[c] && occH[c] !== ni + 1 ? occH[c] - 1 : occV[c] && occV[c] !== ni + 1 ? occV[c] - 1 : -1;
    return o < 0 ? 0 : bits[o].get(c) || 0;
  };

  // Membership test for the goal tree without hashing: every cell carries the id
  // of the search that last marked it.
  const treeMark = new Uint32Array(N);
  let treeGen = 0;
  let work = 0; // A* expansions so far: a machine-independent measure of routing effort

  function search(ni, start, startDirs, tree, relaxed) {
    gen++;
    hn = 0;
    treeGen++;
    let bx1 = Infinity, by1 = Infinity, bx2 = -Infinity, by2 = -Infinity;
    for (const c of tree) {
      treeMark[c] = treeGen;
      const x = c % W, y = (c / W) | 0;
      if (x < bx1) bx1 = x;
      if (x > bx2) bx2 = x;
      if (y < by1) by1 = y;
      if (y > by2) by2 = y;
    }
    // Manhattan distance to the tree's bounding box: never overestimates the cost
    const h = (x, y) => (x < bx1 ? bx1 - x : x > bx2 ? x - bx2 : 0) + (y < by1 ? by1 - y : y > by2 ? y - by2 : 0);
    const startX = start % W, startY = (start / W) | 0;
    for (const sd of startDirs) {
      const s0 = start * 4 + sd;
      g[s0] = 0; stamp[s0] = gen; prev[s0] = -1;
      push(h(startX, startY), s0);
    }
    let iter = 0;
    while (hn) {
      if (++iter > 400000) break;
      const s = pop();
      if (closed[s] === gen) continue; // an equal or cheaper visit already expanded it
      closed[s] = gen;
      const c = s >> 2, d = s & 3;
      if (c !== start && treeMark[c] === treeGen) { work += iter; return s; }
      const gc = g[s];
      const cxx = c % W, cyy = (c / W) | 0;
      for (let nd = 0; nd < 4; nd++) {
        if (nd === ((d + 2) & 3)) continue;
        const x = cxx + DX[nd], y = cyy + DY[nd];
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const n = y * W + x;
        let cost = 1 + soft[n];
        if (nd !== d) {
          if (c === start) continue; // leave pins straight
          cost += BEND;
          if (foreign(occH, c, ni) || foreign(occV, c, ni)) { if (!relaxed) continue; cost += VIOLATION; }
        }
        const ap = approach[n];
        if (ap !== -1 && ap !== ni) { if (!relaxed) continue; cost += VIOLATION; }
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
        if (owner === -1 && treeMark[n] === treeGen) {
          const nb = (bits[ni].get(n) || 0) | BIT[(nd + 2) & 3];
          if (popcount(nb) > 3) cost += BEND;
        }
        const ns = n * 4 + nd;
        const ng = gc + cost;
        if (stamp[ns] === gen && g[ns] <= ng) continue;
        stamp[ns] = gen; g[ns] = ng; prev[ns] = s;
        push(ng + h(x, y) - TIE * ng, ns);
      }
    }
    work += iter;
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

  let jitter = (seed * 2654435761) >>> 0;
  const noise = () => (jitter = (Math.imul(jitter, 1664525) + 1013904223) >>> 0) / 4294967296;
  const order = routed.map((_, i) => [span(routed[i].pins) * (seed ? 0.6 + 0.8 * noise() : 1), i])
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]).map((x) => x[1]);
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
      const overBudget = work >= maxWork;
      let end = -1;
      if (!overBudget) {
        end = search(ni, p.cell, sd, tree, false);
        if (end < 0) end = search(ni, p.cell, sd, tree, true);
      }
      let cells;
      if (end >= 0) {
        cells = trace(end);
      } else {
        failures.push({ net: net.id, comp: p.comp, pin: p.pin, ...(overBudget ? { reason: 'work-limit' } : {}) });
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
  const violations = [];
  const shrunk = insts.map((I) => { const poly = bodyPoly(I, -1.5); return { I, poly, box: boundsOf(poly) }; });
  for (const [id, net] of nets) {
    for (const seg of net.segments) {
      const sx1 = Math.min(seg.x1, seg.x2), sx2 = Math.max(seg.x1, seg.x2);
      const sy1 = Math.min(seg.y1, seg.y2), sy2 = Math.max(seg.y1, seg.y2);
      for (const { I, poly, box } of shrunk) {
        // cheap box rejection first: almost no wire is near most parts
        if (sx2 < box.x || sx1 > box.x + box.w || sy2 < box.y || sy1 > box.y + box.h) continue;
        if (segHitsPoly(seg, poly)) {
          violations.push({ code: 'WIRE_THROUGH_COMPONENT', net: id, comp: I.id, x: I.body.x + I.body.w / 2, y: I.body.y + I.body.h / 2 });
          break;
        }
      }
    }
  }
  // Two nets sharing a stretch of wire: group segments by the line they lie on,
  // then compare only within a line.
  const lines = new Map();
  for (const [nid, nn] of nets) {
    for (const sg of nn.segments) {
      const horiz = sg.y1 === sg.y2;
      if (!horiz && sg.x1 !== sg.x2) continue;
      const key = horiz ? `h${sg.y1}` : `v${sg.x1}`;
      const lo = horiz ? Math.min(sg.x1, sg.x2) : Math.min(sg.y1, sg.y2);
      const hi = horiz ? Math.max(sg.x1, sg.x2) : Math.max(sg.y1, sg.y2);
      if (!lines.has(key)) lines.set(key, []);
      lines.get(key).push({ net: nid, lo, hi });
    }
  }
  for (const [key, list] of lines) {
    if (list.length < 2) continue;
    list.sort((p, q) => p.lo - q.lo);
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length && list[j].lo < list[i].hi; j++) {
        if (list[i].net === list[j].net) continue;
        const from = list[j].lo, to = Math.min(list[i].hi, list[j].hi);
        if (to <= from) continue;
        const mid = (from + to) / 2, at = Number(key.slice(1));
        violations.push({ code: 'WIRE_OVERLAP', net: list[i].net, other: list[j].net, x: key[0] === 'h' ? mid : at, y: key[0] === 'h' ? at : mid });
      }
    }
  }
  return { nets, junctions, crossings, failures, violations, work };
}

// Fallback for sheets too large to grid: each net becomes L-shaped wires from its
// first pin to every other pin. Nothing is checked for collisions.
function routeDirect(nl, instances) {
  const nets = new Map();
  for (const [id, net] of nl.nets) {
    if (net.rail) continue;
    const pins = net.pins.filter((e) => instances.has(e.comp)).map((e) => instances.get(e.comp).pins[e.pin]);
    if (pins.length < 2) continue;
    const paths = pins.slice(1).map((p) => simplify([{ x: pins[0].x, y: pins[0].y }, { x: p.x, y: pins[0].y }, { x: p.x, y: p.y }]));
    nets.set(id, { id, paths, segments: toSegments(paths) });
  }
  const first = [...nl.nets.values()].find((n) => !n.rail && n.pins.length > 1)?.pins[0];
  return {
    nets, junctions: [], crossings: [], violations: [], work: 0,
    failures: first ? [{ net: null, comp: first.comp, pin: first.pin, reason: 'too-large' }] : [],
  };
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
