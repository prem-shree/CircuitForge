// After routing: choose, per component, the label set that collides least
// with wires, part outlines (rotated parts use their real outline, not their
// bounding box), leads, rail markers and labels already placed.
import { overlaps, inflate, segHitsPoly, rectHitsPoly } from '../utils/geometry.js';

const rectPoly = (r) => [{ x: r.x, y: r.y }, { x: r.x + r.w, y: r.y }, { x: r.x + r.w, y: r.y + r.h }, { x: r.x, y: r.y + r.h }];

export function placeLabels(instances, routing) {
  const insts = [...instances.values()];
  const segs = [];
  for (const n of routing.nets.values()) segs.push(...n.segments);
  // leads of angled parts run diagonally outside their body outline
  for (const I of insts) {
    if (I.rot % 90 === 0) continue;
    for (const p of Object.values(I.pins)) {
      segs.push({ x1: p.x, y1: p.y, x2: p.inner.x, y2: p.inner.y });
    }
  }
  const hitsBody = (b, J) => (J.rot % 90 === 0 ? overlaps(b, J.body) : rectHitsPoly(b, J.poly));
  const taken = [];
  const score = (I, labels) => {
    let s = 0;
    for (const l of labels) {
      const b = inflate(l.box, 1);
      const bp = rectPoly(b);
      for (const seg of segs) if (segHitsPoly(seg, bp)) s += 3;
      for (const J of insts) {
        if (hitsBody(b, J)) s += J === I ? 5 : 4;
        for (const m of J.markers) if (overlaps(b, m.bbox)) s += 3;
      }
      for (const t of taken) if (overlaps(b, t)) s += 4;
    }
    return s;
  };
  for (const I of insts) {
    const candidates = I.labelSets?.length ? I.labelSets : [I.labels];
    let best = candidates[0], bestScore = Infinity;
    candidates.forEach((set, i) => {
      // prefer the conventional position: later candidates pay a small penalty
      const s = score(I, set) + i * 0.5;
      if (s < bestScore) { bestScore = s; best = set; }
    });
    I.labelsFinal = best;
    for (const l of best) taken.push(l.box);
  }
}

// Labels that still sit on a wire or another part after placement, with
// where they are (the spacing optimizer opens room at those spots).
export function labelConflicts(instances, routing) {
  const insts = [...instances.values()];
  const segs = [...routing.nets.values()].flatMap((n) => n.segments);
  const out = [];
  for (const I of insts) {
    for (const l of I.labelsFinal || I.labels) {
      const b = inflate(l.box, -1);
      const bp = rectPoly(b);
      if (segs.some((s) => segHitsPoly(s, bp)) || insts.some((J) => J !== I && (J.rot % 90 === 0 ? overlaps(b, J.body) : rectHitsPoly(b, J.poly)))) {
        out.push({ comp: I.id, text: l.text, x: l.box.x + l.box.w / 2, y: l.box.y + l.box.h / 2 });
      }
    }
  }
  return out;
}
