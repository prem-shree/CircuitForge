// After routing: choose, per component, the label set (primary or alternate
// side) that collides least with wires, bodies, markers and other labels.
import { overlaps, segHitsRect, inflate } from '../utils/geometry.js';

export function placeLabels(instances, routing) {
  const segs = [];
  for (const n of routing.nets.values()) segs.push(...n.segments);
  const insts = [...instances.values()];
  const taken = [];
  const score = (I, labels) => {
    let s = 0;
    for (const l of labels) {
      const b = inflate(l.box, 1);
      for (const seg of segs) if (segHitsRect(seg, b)) s += 3;
      for (const J of insts) {
        if (overlaps(b, J.body)) s += J === I ? 5 : 4;
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
