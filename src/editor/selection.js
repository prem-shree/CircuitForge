// Selection geometry, independent of the DOM. `instances` is the scene's
// Map(id -> placed part); a part's footprint for selecting and grouping is its
// body outline (rotated parts use the bounding box of the rotated body).
import { unionRect, overlaps, inflate } from '../utils/geometry.js';

// The set of selected ids that still exist in the scene, in a stable order.
export function pruneSelection(ids, instances) {
  return [...ids].filter((id) => instances.has(id));
}

// Bounding box of the selected parts, or null for an empty selection.
export function selectionBounds(instances, ids) {
  let box = null;
  for (const id of ids) {
    const I = instances.get(id);
    if (I) box = unionRect(box, I.body);
  }
  return box;
}

export const centerOf = (box) => ({ x: box.x + box.w / 2, y: box.y + box.h / 2 });

// Parts whose body touches `rect` (or, with `contain`, lies fully inside it).
export function partsInRect(instances, rect, { contain = false, pad = 2 } = {}) {
  const out = [];
  for (const [id, I] of instances) {
    const b = I.body;
    const hit = contain
      ? b.x >= rect.x && b.y >= rect.y && b.x + b.w <= rect.x + rect.w && b.y + b.h <= rect.y + rect.h
      : overlaps(inflate(b, pad), rect);
    if (hit) out.push(id);
  }
  return out;
}

// Rectangle spanned by two points, whichever way it was dragged.
export const rectFrom = (a, b) => ({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) });

// Add, remove or replace, following the usual modifier convention:
// plain click replaces, shift/ctrl/cmd click toggles.
export function applyClick(selection, id, { additive = false } = {}) {
  const next = new Set(additive ? selection : []);
  if (id == null) return additive ? next : new Set();
  if (additive && next.has(id)) next.delete(id); else next.add(id);
  return next;
}

// Tab / Shift+Tab through parts in reading order (top to bottom, left to right).
export function cycleSelection(instances, current, step = 1) {
  const order = [...instances.entries()]
    .sort(([, a], [, b]) => (Math.round(a.body.y / 20) - Math.round(b.body.y / 20)) || a.body.x - b.body.x)
    .map(([id]) => id);
  if (!order.length) return null;
  const at = current == null ? -1 : order.indexOf(current);
  if (at < 0) return step > 0 ? order[0] : order[order.length - 1];
  return order[(at + step + order.length) % order.length];
}

// "R1", "3 parts" — for undo labels and messages.
export function describeIds(ids) {
  const list = [...ids];
  if (list.length === 1) return list[0];
  return `${list.length} parts`;
}
