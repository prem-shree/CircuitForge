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
    I.labelsFinal = I.labels;
    if (I.labelAlt?.length) {
      const a = score(I, I.labels), b = score(I, I.labelAlt);
      if (b < a) I.labelsFinal = I.labelAlt;
    }
    for (const l of I.labelsFinal) taken.push(l.box);
  }
}
