// Moving parts with the pointer.
//
// Small circuits are re-routed live on every frame. A large circuit would make
// that stutter, so the drag switches to a "ghost": the parts slide by transform
// with dashed wires following them, and the real routing runs once on release.
// The switch is automatic, from how long the last full render took.
import { render } from '../engine.js';
import { moveComponents } from '../editor/model.js';
import { describeIds } from '../editor/selection.js';
import { state } from './state.js';

const LIVE_MS = 45;     // start dragging in ghost mode when a render took longer than this
const SWITCH_MS = 70;   // …and switch to it mid-drag if a live frame does

export function initDrag(app) {
  const canvas = app.canvas;
  const step = () => (state.snap ? 20 : 10);

  // Wires that follow the dragged parts: each moving pin to the nearest pin of its net that stays put.
  function ropesFor(ids, scene) {
    const moving = new Set(ids);
    const ropes = [];
    for (const id of ids) {
      const I = scene.instances.get(id);
      if (!I) continue;
      for (const [pin, netId] of Object.entries(I.part.pinNets)) {
        const net = netId && scene.netlist.nets.get(netId);
        if (!net || net.rail) continue;
        const me = I.pins[pin];
        let best = null, bestD = Infinity;
        for (const e of net.pins) {
          if (moving.has(e.comp)) continue;
          const o = scene.instances.get(e.comp)?.pins[e.pin];
          if (!o) continue;
          const d = Math.abs(o.x - me.x) + Math.abs(o.y - me.y);
          if (d < bestD) { bestD = d; best = o; }
        }
        if (best) ropes.push({ x1: best.x, y1: best.y, x2: me.x, y2: me.y });
      }
    }
    return ropes;
  }

  function liveFrame(d) {
    const t0 = performance.now();
    const r = render(d.pending, { theme: app.theme(), background: null, interactive: true, bridges: state.bridges });
    const ms = performance.now() - t0;
    if (!r.svg || state.drag !== d) return;
    canvas.setSVG(r.svg, r.viewBox);
    d.shown = { ...d.last };
    if (ms > SWITCH_MS) {
      d.ghost = true;
      canvas.startGhost(d.ids, ropesFor(d.ids, r.scene));
    }
  }

  return {
    start(ids, primary) {
      const scene = app.scene();
      if (!scene || !state.circuit) return;
      const list = ids.filter((id) => scene.instances.has(id));
      if (!list.length) return;
      const I = scene.instances.get(primary) || scene.instances.get(list[0]);
      const d = state.drag = { ids: list, scene, circuit: state.circuit, start: { x: I.x, y: I.y }, last: null, shown: { x: 0, y: 0 }, ghost: state.lastMs > LIVE_MS, raf: 0, pending: null };
      if (d.ghost) canvas.startGhost(list, ropesFor(list, scene));
    },

    // dx, dy: how far the pointer has moved in drawing coordinates since the press.
    move(dx, dy) {
      const d = state.drag;
      if (!d) return;
      // snap the primary part, and move the others by the same amount so the group keeps its shape
      const s = step();
      const ax = Math.round((d.start.x + dx) / s) * s - d.start.x;
      const ay = Math.round((d.start.y + dy) / s) * s - d.start.y;
      if (d.last && d.last.x === ax && d.last.y === ay) return;
      d.last = { x: ax, y: ay };
      app.setHint(`Move ${describeIds(d.ids)}: ${ax >= 0 ? '+' : ''}${ax}, ${ay >= 0 ? '+' : ''}${ay}`);
      if (d.ghost) return canvas.moveGhost(ax - d.shown.x, ay - d.shown.y);
      d.pending = moveComponents(d.circuit, d.scene.instances, d.ids, ax, ay);
      if (!d.raf) d.raf = requestAnimationFrame(() => { d.raf = 0; liveFrame(d); });
    },

    end(cancelled) {
      const d = state.drag;
      state.drag = null;
      app.setHint('');
      if (!d) return;
      if (d.raf) cancelAnimationFrame(d.raf);
      canvas.endGhost();
      if (cancelled || !d.last || (d.last.x === 0 && d.last.y === 0)) return app.update(); // put the drawing back
      app.commit(moveComponents(d.circuit, d.scene.instances, d.ids, d.last.x, d.last.y), {
        label: `Move ${describeIds(d.ids)}`, key: `move:${d.ids.join(',')}`, select: d.ids,
      });
    },
  };
}
