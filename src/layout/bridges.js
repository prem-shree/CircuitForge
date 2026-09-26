// Bridge topologies — a full-wave rectifier, a Wheatstone bridge — are four
// two-terminal parts in a ring whose opposite corners are each bridged by
// something else (a source, a load, a meter). Textbooks draw them as a diamond
// with the parts at 45°, so the layout does the same.
import { normAngle, rotateVec } from '../utils/geometry.js';

const DIODES = new Set(['diode', 'led', 'zener', 'schottky', 'photodiode']);
const METERS = new Set(['voltmeter', 'ammeter']);

// Parts that may sit on a diamond edge: two pins on two different nets, a
// sensible length, and no position/rotation fixed by the user.
function eligible(p) {
  if (!p.sym.twoTerminal || p.sym.source || p.comp.position || p.comp.rotation !== undefined || p.comp.mirror) return false;
  const [a, b] = p.sym.pinOrder;
  if (!p.pinNets[a] || !p.pinNets[b] || p.pinNets[a] === p.pinNets[b]) return false;
  const la = p.sym.pins[a], lb = p.sym.pins[b];
  const len = Math.hypot(lb.x - la.x, lb.y - la.y);
  return len >= 30 && len <= 70;
}

export function detectBridges(parts, nets) {
  const cand = parts.filter(eligible);
  const isRail = (n) => !!nets?.get(n)?.rail;
  const onNet = new Map();
  for (const p of cand) {
    for (const pin of p.sym.pinOrder) {
      const n = p.pinNets[pin];
      if (!onNet.has(n)) onNet.set(n, []);
      onNet.get(n).push(p);
    }
  }
  const other = (p, net) => {
    const [a, b] = p.sym.pinOrder;
    return p.pinNets[a] === net ? p.pinNets[b] : p.pinNets[a];
  };
  // Two-terminal parts outside the ring that connect two opposite corners (a
  // source, a load, a meter). An IC touching both corners does not make a
  // bridge: that ring is incidental, e.g. a 555's timing network.
  const across = (x, y, ring) => parts.filter((p) => !ring.includes(p) && p.sym.pinOrder.length === 2
    && Object.values(p.pinNets).includes(x) && Object.values(p.pinNets).includes(y));

  const used = new Set();
  const found = [];
  for (const p0 of cand) {
    if (used.has(p0.id)) continue;
    const [a0, b0] = p0.sym.pinOrder;
    const n0 = p0.pinNets[a0], n1 = p0.pinNets[b0];
    search:
    for (const p1 of onNet.get(n1) || []) {
      if (p1 === p0 || used.has(p1.id)) continue;
      const n2 = other(p1, n1);
      if (n2 === n0) continue;
      for (const p2 of onNet.get(n2) || []) {
        if (p2 === p0 || p2 === p1 || used.has(p2.id)) continue;
        const n3 = other(p2, n2);
        if (n3 === n0 || n3 === n1) continue;
        for (const p3 of onNet.get(n3) || []) {
          if (p3 === p0 || p3 === p1 || p3 === p2 || used.has(p3.id) || other(p3, n3) !== n0) continue;
          const ring = [p0, p1, p2, p3];
          // one grounded corner is normal (a rectifier's DC−); a ring through
          // both supply rails is just parts in series between them
          if ([n0, n1, n2, n3].filter(isRail).length > 1) continue;
          const acrossA = across(n0, n2, ring), acrossB = across(n1, n3, ring);
          if (!acrossA.length || !acrossB.length) continue;
          found.push({ ring, nets: [n0, n1, n2, n3], across: [acrossA, acrossB] });
          for (const r of ring) used.add(r.id);
          break search;
        }
      }
    }
  }
  return found.map(geometry);
}

// Put pin `pa` on corner A and pin `pb` on corner B, centred on the edge, with
// equal lead extensions at both ends.
function edgePlacement(part, pa, pb, A, B) {
  const s = part.sym;
  const la = s.pins[pa], lb = s.pins[pb];
  const vL = { x: lb.x - la.x, y: lb.y - la.y };
  const vW = { x: B.x - A.x, y: B.y - A.y };
  const lenL = Math.hypot(vL.x, vL.y), lenW = Math.hypot(vW.x, vW.y);
  const rot = normAngle(((Math.atan2(vW.y, vW.x) - Math.atan2(vL.y, vL.x)) * 180) / Math.PI);
  const off = (lenW - lenL) / 2;
  const at = { x: A.x + (vW.x / lenW) * off, y: A.y + (vW.y / lenW) * off };
  const r = rotateVec(la.x - s.origin.x, la.y - s.origin.y, rot);
  const O = { x: at.x - r.x, y: at.y - r.y };
  return {
    part, x: O.x, y: O.y, rot,
    tips: { [pa]: { dx: A.x - O.x, dy: A.y - O.y }, [pb]: { dx: B.x - O.x, dy: B.y - O.y } },
    dirs: { [pa]: A.dir, [pb]: B.dir },
    center: { dx: -O.x, dy: -O.y }, // diamond centre, relative to the part origin
  };
}

function geometry(b) {
  const [n0, n1, n2, n3] = b.nets;
  const hasSource = (list) => list.some((p) => p.sym.source);
  // the pair fed by the source goes top/bottom, the output pair left/right
  let [vertical, horizontal, vAcross, hAcross] = [[n0, n2], [n1, n3], b.across[0], b.across[1]];
  if (!hasSource(vAcross) && hasSource(hAcross)) [vertical, horizontal, vAcross, hAcross] = [horizontal, vertical, hAcross, vAcross];
  let [top, bottom] = vertical;
  const src = vAcross.find((p) => p.sym.source);
  if (src && src.pinNets.positive === bottom) [top, bottom] = [bottom, top];
  // diode cathodes meet at DC+, drawn on the right
  let [left, right] = horizontal;
  const cathodes = (net) => b.ring.filter((p) => p.pinNets.cathode === net).length;
  if (cathodes(left) > cathodes(right)) [left, right] = [right, left];

  // A single detector across the side corners sits inside the diamond
  // (Wheatstone); a rectifier's load stays outside.
  const det = hAcross.length === 1 ? hAcross[0] : null;
  const inner = det && eligible(det) && Object.keys(det.pinNets).length === 2
    && (METERS.has(det.sym.type) || b.ring.every((p) => !DIODES.has(p.sym.type))) ? det : null;
  const h = inner ? 80 : 50;
  const corners = {
    [top]: { x: 0, y: -h, dir: 'up' },
    [right]: { x: h, y: 0, dir: inner ? 'left' : 'right' },
    [bottom]: { x: 0, y: h, dir: 'down' },
    [left]: { x: -h, y: 0, dir: inner ? 'right' : 'left' },
  };
  const members = b.ring.map((p) => {
    const [pa, pb] = p.sym.pinOrder;
    return edgePlacement(p, pa, pb, corners[p.pinNets[pa]], corners[p.pinNets[pb]]);
  });
  if (inner) {
    const pl = inner.sym.pinOrder.find((pin) => inner.pinNets[pin] === left);
    const pr = inner.sym.pinOrder.find((pin) => pin !== pl);
    const la = inner.sym.pins[pl], lb = inner.sym.pins[pr];
    const half = Math.ceil(Math.hypot(lb.x - la.x, lb.y - la.y) / 2 / 10) * 10;
    members.push(edgePlacement(inner, pl, pr, { x: -half, y: 0, dir: 'left' }, { x: half, y: 0, dir: 'right' }));
  }
  return { members, h, corners: { top, right, bottom, left } };
}
