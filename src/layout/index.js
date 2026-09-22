// Automatic schematic placement.
//
// 1. Orientation: sources vertical (+ up); two-terminal parts touching a rail
//    hang vertically toward it (ground down, supply up); others lie horizontal.
// 2. Columns: BFS over signal nets, stepping left/right according to the pin
//    side a neighbour hangs off; digital out->in edges are then relaxed into a
//    longest-path layering so signal flow reads left to right.
// 3. Placement: wave by wave, each part is aligned so one of its pins sits on
//    the horizontal "line" of an already placed net (few bends). Special cases:
//    parts stacked straight off vertical pins (collector/emitter resistors) and
//    feedback elements placed over their op-amp. Collisions are resolved by
//    sliding away from the net's source (analog) or down (digital/terminals).
import { makeInstance } from './instance.js';
import { DIRS, OPPOSITE, GRID, snap, xformDir, overlaps, inflate } from '../utils/geometry.js';
import { normalizeLayout } from './config.js';

export function layoutCircuit(nl, circuit = {}) {
  const cfg = normalizeLayout(circuit);
  const COL_GAP = cfg.componentGap;
  const CLEAR = cfg.wireGap;
  const STEP = cfg.grid;
  const { parts, nets } = nl;
  const byId = new Map(parts.map((p) => [p.id, p]));
  const railKind = (n) => (n ? nets.get(n)?.rail?.kind : undefined);
  const pull = (n) => {
    if (!n) return null;
    const k = railKind(n);
    if (k === 'ground' || k === 'negative' || n === nl.returnNet) return 'down';
    if (k === 'power') return 'up';
    return null;
  };
  // Power and ground rails are drawn as markers and never constrain placement.
  // A named net label is a normal net that happens to be drawn as a flag, so it
  // still pulls its parts together and keeps the sheet in one piece.
  const isRailNet = (n) => ['power', 'ground', 'negative'].includes(railKind(n));
  const signal = (n) => n && !isRailNet(n) && n !== nl.returnNet;

  // ---- 1. orientation
  const orient = new Map();
  for (const p of parts) {
    const c = p.comp, s = p.sym;
    if (c.rotation !== undefined || c.mirror) {
      orient.set(p.id, { rot: c.rotation || 0, mirror: !!c.mirror, fixed: true });
      continue;
    }
    let rot = s.defaultRotation || 0, mirror = false, flex = false;
    const [a, b] = s.pinOrder;
    if (s.source) {
      const pp = pull(p.pinNets.positive), pn = pull(p.pinNets.negative);
      rot = (pp === 'down' && pn !== 'down') || (pn === 'up' && pp !== 'up') ? 180 : 0;
    } else if (s.twoTerminal) {
      const pa = pull(p.pinNets[a]), pb = pull(p.pinNets[b]);
      if (pa || pb) rot = pa === 'down' || (pb === 'up' && pa !== 'down') ? 270 : 90;
      else flex = true;
    } else if ((s.type === 'opamp' || s.type === 'comparator') && !p.pinNets['v+'] && !p.pinNets['v-']) {
      // Inverting stages read better with the inverting input on top.
      if (!signal(p.pinNets['in+']) && signal(p.pinNets['in-'])) { rot = 180; mirror = true; }
    }
    orient.set(p.id, { rot, mirror, flex });
  }
  const pinDir = (id, pin) => {
    const o = orient.get(id);
    return xformDir(byId.get(id).sym.pins[pin].dir, { rot: o.rot, mirror: o.mirror });
  };
  const shunt = (p) => p.sym.twoTerminal && !orient.get(p.id).flex;

  // ---- 2. columns
  const adj = new Map(parts.map((p) => [p.id, []]));
  for (const [nid, net] of nets) {
    if (!signal(nid)) continue;
    for (const e1 of net.pins) for (const e2 of net.pins) {
      if (e1.comp !== e2.comp) adj.get(e1.comp).push({ to: e2.comp, my: e1.pin, their: e2.pin });
    }
  }
  const rank = (p) => (p.sym.source ? 0 : p.sym.terminal === 'input' ? 1 : 2);
  const roots = [...parts].sort((a, b) => rank(a) - rank(b) || b.sym.pinOrder.length - a.sym.pinOrder.length);
  const layer = new Map(), wave = new Map(), flexIn = new Map();
  let island = 0;
  const islandOf = new Map();
  for (const r of roots) {
    if (layer.has(r.id)) continue;
    layer.set(r.id, 0); wave.set(r.id, 0); islandOf.set(r.id, island);
    flexIn.set(r.id, { pin: null, off: 1 });
    const q = [r.id];
    while (q.length) {
      const id = q.shift();
      for (const e of adj.get(id)) {
        if (layer.has(e.to)) continue;
        const me = byId.get(id), them = byId.get(e.to);
        let off;
        if (orient.get(id).flex) {
          const f = flexIn.get(id);
          off = e.my === f.pin ? -f.off : f.off;
        } else {
          const myDir = pinDir(id, e.my);
          const theirDir = orient.get(e.to).flex || shunt(them) ? null : pinDir(e.to, e.their);
          off = myDir === 'left' || theirDir === 'right' ? -1 : 1;
          if (me.sym.pinOrder.length === 1 && theirDir === 'left') off = 1;
        }
        layer.set(e.to, layer.get(id) + off);
        wave.set(e.to, wave.get(id) + 1);
        islandOf.set(e.to, island);
        flexIn.set(e.to, { pin: e.their, off });
        q.push(e.to);
      }
    }
    island++;
  }
  relaxDirected(parts, nets, signal, layer, roots);
  const minL = Math.min(0, ...layer.values());
  for (const [k, v] of layer) layer.set(k, v - minL);
  // Circuit inputs form the leftmost column, outputs the rightmost.
  const inner = parts.filter((p) => !p.sym.terminal).map((p) => layer.get(p.id));
  const lastL = inner.length ? Math.max(...inner) + 1 : 1;
  for (const p of parts) {
    if (p.sym.terminal === 'input') layer.set(p.id, 0);
    if (p.sym.terminal === 'output') layer.set(p.id, lastL);
  }
  if (parts.some((p) => p.sym.terminal === 'input')) {
    for (const p of parts) if (!p.sym.terminal) layer.set(p.id, layer.get(p.id) + 1);
    for (const p of parts) if (p.sym.terminal === 'output') layer.set(p.id, lastL + 1);
  }
  // Explicit "section": inputs left, outputs right, processing in between.
  if (parts.some((p) => p.comp.section)) {
    const maxL = Math.max(...parts.map((p) => layer.get(p.id)));
    for (const p of parts) {
      if (p.comp.section === 'input') layer.set(p.id, 0);
      else if (p.comp.section === 'output') layer.set(p.id, maxL + 1);
    }
  }

  // ---- 3. placement
  const placed = [];
  const inst = new Map();
  const lines = new Map(); // net -> { y, src:{x,y,dir}, order }
  let lineOrder = 0;
  const trial = (p, rot, mirror) => makeInstance(p, 0, 0, rot, mirror, nets, cfg);
  const coreLeft = (T) => Math.min(T.body.x, ...Object.values(T.pins).map((q) => q.x));

  const nLayers = Math.max(0, ...layer.values()) + 1;
  const colW = new Array(nLayers).fill(0);
  for (const p of parts) {
    const o = orient.get(p.id);
    colW[layer.get(p.id)] = Math.max(colW[layer.get(p.id)], trial(p, o.rot, o.mirror).extent.w);
  }
  // Wider gap where many nets have to cross between two columns, so the router
  // has a track per net instead of squeezing them into one corridor.
  const crossings = new Array(nLayers).fill(0);
  for (const [nid, net] of nets) {
    if (!signal(nid)) continue;
    const ls = net.pins.map((e) => layer.get(e.comp)).filter((x) => x !== undefined);
    if (ls.length < 2) continue;
    for (let b = Math.min(...ls) + 1; b <= Math.max(...ls); b++) crossings[b]++;
  }
  const gapAt = (b) => Math.min(COL_GAP * 4, COL_GAP + Math.max(0, (crossings[b] || 0) - 2) * 20);
  const colX = [0];
  for (let i = 1; i < nLayers; i++) colX[i] = colX[i - 1] + colW[i - 1] + gapAt(i);
  const cursor = new Array(nLayers).fill(0);
  // Columns start after everything already placed in earlier columns (parts may have slid).
  const colRight = new Array(nLayers).fill(-Infinity);
  const colStart = (L) => Math.max(colX[L], ...colRight.slice(0, L).map((r) => r + gapAt(L)));

  // Unconnected sub-circuits are stacked with sectionGap between them.
  const islandBottom = new Map();
  const islandTop = (isl) => {
    let top = 0;
    for (const [k, b] of islandBottom) if (k < isl) top = Math.max(top, b + cfg.sectionGap);
    return top;
  };
  const isFree = (I, ignore) => {
    const e = inflate(I.extent, CLEAR / 2);
    return placed.every((o) => o === ignore || !overlaps(e, inflate(o.extent, CLEAR / 2)));
  };
  const commit = (I) => {
    placed.push(I);
    inst.set(I.id, I);
    const L = layer.get(I.id);
    colRight[L] = Math.max(colRight[L], I.extent.x + I.extent.w);
    for (const [pin, net] of Object.entries(I.part.pinNets)) {
      if (isRailNet(net) || lines.has(net)) continue;
      const pp = I.pins[pin];
      const d = DIRS[pp.dir];
      lines.set(net, { y: pp.y + (d.y ? d.y * 20 : 0), src: pp, order: lineOrder++ });
    }
  };
  const at = (p, originX, originY, rot, mirror) => makeInstance(p, snap(originX, STEP), snap(originY, STEP), rot, mirror, nets, cfg);

  // Parts with explicit positions are placed first and act as anchors.
  for (const p of parts) {
    const pos = p.comp.position;
    if (!pos) continue;
    const o = orient.get(p.id);
    commit(at(p, pos.x, pos.y, o.rot, o.mirror));
  }

  const group = (p) => (shunt(p) ? 0 : p.sym.pinOrder.length >= 3 ? 1 : 2);
  const order = parts.filter((p) => !inst.has(p.id))
    .sort((a, b) => islandOf.get(a.id) - islandOf.get(b.id) || wave.get(a.id) - wave.get(b.id) || group(a) - group(b) || layer.get(a.id) - layer.get(b.id));

  for (const p of order) {
    const o = orient.get(p.id);
    const L = layer.get(p.id);
    const s = p.sym;

    // Pick the anchor: a pin whose net already has a line. Inputs (left-facing) first.
    const anchors = s.pinOrder
      .filter((pin) => p.pinNets[pin] && lines.has(p.pinNets[pin]))
      .sort((a, b) => (signal(p.pinNets[b]) - signal(p.pinNets[a])) || lines.get(p.pinNets[a]).order - lines.get(p.pinNets[b]).order);
    let rot = o.rot, mirror = o.mirror;
    const anchor = anchors[0];
    if (anchor && o.flex) {
      const line = lines.get(p.pinNets[anchor]);
      const fromRight = line.src.x > colStart(L) + 10;
      const aIsFirst = anchor === s.pinOrder[0];
      rot = aIsFirst !== fromRight ? 0 : 180;
    }
    const T = trial(p, rot, mirror);
    const cands = [];
    if (anchor) {
      const net = p.pinNets[anchor];
      const line = lines.get(net);
      const ap = T.pins[anchor];
      const src = line.src;
      // (a) feedback element over / under a multi-pin part that it bridges
      if (s.twoTerminal && o.flex) {
        const other = s.pinOrder.find((x) => x !== anchor);
        const sideOf = (I, n) => Object.entries(I.part.pinNets).filter(([, x]) => x === n).map(([pin]) => I.pins[pin].dir);
        const host = placed.find((I) => {
          if (I.part.sym.pinOrder.length < 3) return false;
          const a = sideOf(I, net), b = sideOf(I, p.pinNets[other]);
          return (a.includes('left') && b.includes('right')) || (a.includes('right') && b.includes('left'));
        });
        if (host) {
          const cx = host.body.x + host.body.w / 2;
          const midRel = (T.pins[s.pinOrder[0]].x + T.pins[s.pinOrder[1]].x) / 2;
          const ox = cx - midRel;
          const above = Math.floor((host.extent.y - CLEAR - (T.extent.y + T.extent.h)) / GRID) * GRID;
          const below = Math.ceil((host.extent.y + host.extent.h + CLEAR - T.extent.y) / GRID) * GRID;
          cands.push([ox, above], [ox, below]);
        }
      }
      // (b) stacked straight off a vertical pin
      if ((src.dir === 'up' || src.dir === 'down') && ap.dir === OPPOSITE[src.dir]) {
        const d = DIRS[src.dir];
        cands.push([src.x - ap.x, src.y + d.y * 30 - ap.y]);
      }
      // (c) column slot, pin on the net line
      const horiz = ap.dir === 'left' || ap.dir === 'right';
      const ty = horiz ? line.y : line.y - DIRS[ap.dir].y * 20;
      // keep the part on the far side of the net's source pin
      let ox = colStart(L) - coreLeft(T);
      if (src.dir === 'right') ox = Math.max(ox, src.x + 20 - ap.x);
      if (src.dir === 'left') ox = Math.min(ox, src.x - 20 - ap.x);
      cands.push([ox, ty - ap.y]);
    } else {
      const base = Math.max(cursor[L], islandTop(islandOf.get(p.id)));
      cands.push([colStart(L) - coreLeft(T), base - T.extent.y]);
    }

    let chosen = null;
    for (const [ox, oy] of cands) {
      const I = at(p, ox, oy, rot, mirror);
      if (isFree(I)) { chosen = I; break; }
    }
    if (!chosen) {
      const [bx, by] = cands[cands.length - 1];
      const down = s.category === 'digital' || s.terminal || !anchor;
      const src = anchor && lines.get(p.pinNets[anchor]).src;
      const sx = !src ? 1 : src.dir === 'left' ? -1 : src.dir === 'right' ? 1 : src.x > bx + T.pins[anchor].x ? -1 : 1;
      const steps = [];
      for (let k = 1; k <= 40; k++) steps.push(down ? [0, 20 * k] : [sx * 20 * k, 0]);
      for (let k = 1; k <= 40; k++) steps.push(down ? [sx * 20 * k, 0] : [0, 20 * k], [0, -20 * k]);
      for (let k = 1; k <= 30; k++) steps.push([sx * 20 * k, 20 * k]);
      for (const [dx, dy] of steps) {
        const I = at(p, bx + dx, by + dy, rot, mirror);
        if (isFree(I)) { chosen = I; break; }
      }
      if (!chosen) {
        const maxY = Math.max(0, ...placed.map((I) => I.extent.y + I.extent.h));
        chosen = at(p, bx, maxY + 60 - T.extent.y, rot, mirror);
      }
    }
    if (!anchor) cursor[L] = chosen.extent.y + chosen.extent.h + CLEAR + 20;
    commit(chosen);
    const isl = islandOf.get(p.id);
    islandBottom.set(isl, Math.max(islandBottom.get(isl) ?? -Infinity, chosen.extent.y + chosen.extent.h));
  }

  alignTerminals(parts, nets, inst, isFree, at, orient);
  packIslands(inst, islandOf, at, cfg);
  return { instances: inst, orient, layers: layer, islands: islandOf, config: cfg };
}

// Sub-circuits connected only through rails (a decoupling cap, a divider on the
// supply) are laid out on their own. Flow them into rows so the sheet stays
// compact instead of growing into one tall column. Parts the JSON positions
// explicitly are never moved, and their sections act as fixed blocks.
function packIslands(inst, islandOf, at, cfg) {
  const groups = new Map();
  for (const I of inst.values()) {
    const k = islandOf.get(I.id) ?? 0;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(I);
  }
  if (groups.size < 2) return;
  const bbox = (list) => list.reduce((b, I) => ({
    x: Math.min(b.x, I.extent.x), y: Math.min(b.y, I.extent.y),
    x2: Math.max(b.x2, I.extent.x + I.extent.w), y2: Math.max(b.y2, I.extent.y + I.extent.h),
  }), { x: Infinity, y: Infinity, x2: -Infinity, y2: -Infinity });

  const islands = [...groups.entries()].sort((a, b) => a[0] - b[0]).map(([key, list]) => ({
    key, list, box: bbox(list), pinned: list.some((I) => I.part.comp.position),
  }));
  const gap = cfg.sectionGap;
  const widest = Math.max(...islands.map((i) => i.box.x2 - i.box.x));
  const maxRow = Math.max(widest, 800);

  // start the flow below anything the user pinned
  let rowTop = Math.max(0, ...islands.filter((i) => i.pinned).map((i) => i.box.y2 + gap));
  let rowLeft = Math.min(0, ...islands.map((i) => i.box.x));
  let cursorX = rowLeft, rowHeight = 0;
  for (const isl of islands) {
    if (isl.pinned) continue;
    const w = isl.box.x2 - isl.box.x, h = isl.box.y2 - isl.box.y;
    if (cursorX > rowLeft && cursorX + w > rowLeft + maxRow) {
      rowTop += rowHeight + gap;
      cursorX = rowLeft;
      rowHeight = 0;
    }
    const dx = Math.round((cursorX - isl.box.x) / cfg.grid) * cfg.grid;
    const dy = Math.round((rowTop - isl.box.y) / cfg.grid) * cfg.grid;
    if (dx || dy) {
      // keep the orientation the placement actually chose (flex parts may have flipped)
      for (const I of isl.list) Object.assign(I, at(I.part, I.x + dx, I.y + dy, I.rot, I.mirror));
    }
    cursorX += w + gap;
    rowHeight = Math.max(rowHeight, h);
  }
}

// Longest-path layering along digital out -> in edges (back edges ignored).
function relaxDirected(parts, nets, signal, layer, roots) {
  const E = new Map(parts.map((p) => [p.id, new Set()]));
  let any = false;
  for (const [nid, net] of nets) {
    if (!signal(nid)) continue;
    const io = (e) => parts.find((p) => p.id === e.comp).sym.pins[e.pin].io;
    const drivers = net.pins.filter((e) => io(e) === 'out');
    const sinks = net.pins.filter((e) => io(e) === 'in');
    for (const d of drivers) for (const s of sinks) if (d.comp !== s.comp) { E.get(d.comp).add(s.comp); any = true; }
  }
  if (!any) return;
  const state = new Map(), topo = [], back = new Set();
  const dfs = (u) => {
    state.set(u, 1);
    for (const v of E.get(u)) {
      if (state.get(v) === 1) back.add(u + '>' + v);
      else if (!state.get(v)) dfs(v);
    }
    state.set(u, 2);
    topo.push(u);
  };
  for (const r of roots) if (!state.get(r.id)) dfs(r.id);
  topo.reverse();
  for (const u of topo) for (const v of E.get(u)) {
    if (!back.has(u + '>' + v) && layer.get(v) < layer.get(u) + 1) layer.set(v, layer.get(u) + 1);
  }
}

// Slide single-pin terminals vertically so their wire runs straight.
function alignTerminals(parts, nets, inst, isFree, at, orient) {
  for (const p of parts) {
    if (!p.sym.terminal || p.comp.position) continue;
    const I = inst.get(p.id);
    const pinName = p.sym.pinOrder[0];
    const net = p.pinNets[pinName];
    if (!net) continue;
    const my = I.pins[pinName];
    const want = OPPOSITE[my.dir];
    const targets = nets.get(net).pins
      .filter((e) => e.comp !== p.id && inst.get(e.comp)?.pins[e.pin].dir === want)
      .map((e) => inst.get(e.comp).pins[e.pin]);
    if (!targets.length) continue;
    targets.sort((a, b) => Math.abs(a.y - my.y) - Math.abs(b.y - my.y));
    const dy = targets[0].y - my.y;
    if (!dy) continue;
    const J = at(p, I.x, I.y + dy, I.rot, I.mirror);
    if (isFree(J, I)) Object.assign(I, J);
  }
}
