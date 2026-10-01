// Editing commands that act on the selection. Each builds a new circuit with the
// pure functions in editor/model.js and hands it to app.commit(), which records
// one undo step.
import {
  rotateComponents, mirrorComponents, deleteComponents, duplicateComponents, extractSubcircuit, pasteSubcircuit,
  moveComponents, connectPins, addComponent,
} from '../editor/model.js';
import { selectionBounds, cycleSelection, describeIds, partsInRect } from '../editor/selection.js';
import { state } from './state.js';

export function initCommands(app) {
  // Something selected, and the document in a state where editing is safe.
  const ready = () => state.selection.length > 0 && app.sync() && !!app.scene() && !!state.circuit;
  const ids = () => [...state.selection];
  let pasteCount = 0;

  // Paste a snippet into the current circuit. Always re-checks the document first: this
  // may run after an async clipboard read, when typing could have changed it.
  function pasteSnippet(snippet) {
    if (!app.sync() || !state.circuit) return false;
    // parts that have positions land beside the copy (further each time); auto-laid-out circuits place them themselves
    const step = 40 * (pasteCount + 1);
    const { circuit, ids: added } = pasteSubcircuit(state.circuit, snippet, { x: step, y: step });
    if (!added.length) { app.toast('Nothing to paste: the clipboard holds no parts.', true); return false; }
    if (!app.commit(circuit, { label: `Paste ${describeIds(added)}`, key: null, select: added })) return false;
    pasteCount++;
    app.toast(`Pasted ${describeIds(added)}`);
    return true;
  }

  const cmd = {
    rotate(step = 90) {
      if (!ready()) return false;
      const list = ids();
      app.commit(rotateComponents(state.circuit, app.scene().instances, list, step), { label: `Rotate ${describeIds(list)}`, key: `rotate:${list.join(',')}`, select: list });
    },

    flip() {
      if (!ready()) return false;
      const list = ids();
      app.commit(mirrorComponents(state.circuit, app.scene().instances, list), { label: `Flip ${describeIds(list)}`, key: null, select: list });
    },

    remove() {
      if (!ready()) return false;
      const list = ids();
      app.commit(deleteComponents(state.circuit, list), { label: `Delete ${describeIds(list)}`, key: null, select: [] });
      app.toast(`Deleted ${describeIds(list)}`);
      return true;
    },

    duplicate() {
      if (!ready()) return false;
      const { circuit, ids: copies } = duplicateComponents(state.circuit, app.scene().instances, ids());
      app.commit(circuit, { label: `Duplicate ${describeIds(ids())}`, key: null, select: copies });
      app.toast(`Duplicated as ${describeIds(copies)}`);
      return true;
    },

    copy() {
      if (!ready()) return false;
      state.clipboard = extractSubcircuit(state.circuit, app.scene().instances, ids());
      pasteCount = 0;
      // also put it on the system clipboard, so it can be pasted into a text file or another tab
      // (writeText returns a promise that rejects when the browser refuses access)
      try { Promise.resolve(navigator.clipboard?.writeText(JSON.stringify(state.clipboard, null, 2))).catch(() => {}); } catch { /* clipboard unavailable */ }
      app.toast(`Copied ${describeIds(ids())}`);
      return true;
    },

    cut() { return cmd.copy() ? cmd.remove() : false; },

    // Paste what was copied here; failing that, a selection copied in another tab or
    // window (only where the browser lets a page read the clipboard). Returns false
    // when there is nothing to paste, so the key press keeps its normal meaning.
    paste() {
      if (!app.sync() || !state.circuit) return false;
      if (state.clipboard) return pasteSnippet(state.clipboard);
      if (!navigator.clipboard?.readText) return false;
      navigator.clipboard.readText().then(
        (text) => {
          let snippet = null;
          try { snippet = JSON.parse(text); } catch { /* not JSON */ }
          if (snippet?.format !== 'circuitforge-selection') return app.toast('Nothing to paste. Select parts and press Ctrl+C first.', true);
          try { pasteSnippet(snippet); } catch (err) { app.toast(`Could not paste: ${err.message}`, true); }
        },
        // only a refused clipboard read is reported as one
        () => app.toast('Nothing to paste: copy some parts first (the browser did not allow reading the clipboard).', true),
      );
      return true;
    },

    selectAll() {
      const scene = app.scene();
      if (!scene) return false;
      app.select([...scene.instances.keys()]);
      return true;
    },

    // Arrow keys: one grid step (10 px); with shift, four.
    nudge(dx, dy) {
      if (!ready()) return false;
      const list = ids();
      app.commit(moveComponents(state.circuit, app.scene().instances, list, dx, dy), { label: `Move ${describeIds(list)}`, key: `nudge:${list.join(',')}`, select: list });
    },

    zoomToSelection() {
      const scene = app.scene();
      if (!scene) return;
      const box = state.selection.length ? selectionBounds(scene.instances, state.selection) : null;
      if (!box) return app.canvas.fit();
      app.canvas.zoomToRect({ x: box.x - 30, y: box.y - 30, w: box.w + 60, h: box.h + 60 }, { max: 3 });
    },

    cycle(step) {
      const scene = app.scene();
      if (!scene) return;
      const next = cycleSelection(scene.instances, state.selection[state.selection.length - 1] ?? null, step);
      if (next) { app.select([next]); const b = scene.instances.get(next)?.body; if (b) app.canvas.panIntoView?.(b); }
    },

    // Marquee: everything the rectangle touches, added to what is selected.
    marquee(rect, additive) {
      const scene = app.scene();
      if (!scene) return;
      const hit = partsInRect(scene.instances, rect);
      app.select(additive ? [...new Set([...state.selection, ...hit])] : hit);
    },

    // Wiring tool: first click picks a pin, the second joins the two.
    pinClick(ref, pos) {
      if (!app.sync()) return;
      const scene = app.scene();
      if (!scene || !state.circuit) return;
      const pending = state.pending;
      const netOf = (r) => { const i = r.indexOf('.'); return scene.instances.get(r.slice(0, i))?.part.pinNets[r.slice(i + 1)] || null; };
      if (!pending) {
        state.pending = { ref, ...pos };
        app.canvas.setWireFrom(state.pending);
        return app.setHint(`Connecting from ${ref}: click another pin (Esc cancels)`);
      }
      state.pending = null;
      app.canvas.setWireFrom(null);
      app.setHint('');
      if (pending.ref === ref) return;
      const a = netOf(pending.ref), b = netOf(ref);
      if (a && a === b) return app.toast(`${pending.ref} and ${ref} are already on the same net.`, true);
      app.commit(connectPins(state.circuit, pending.ref, ref), { label: `Connect ${pending.ref} to ${ref}`, key: null, select: [] });
      app.toast(`Connected ${pending.ref} to ${ref}`);
    },

    cancelWire() {
      if (!state.pending) return false;
      state.pending = null;
      app.canvas.setWireFrom(null);
      app.setHint('');
      return true;
    },

    // Components dialog: drop a new part in the middle of the view.
    addPart(type) {
      if (!app.sync() || !state.circuit) return null;
      const scene = app.scene();
      const at = scene ? app.canvas.centerWorld() : null;
      const { circuit, id } = addComponent(state.circuit, type, { at, instances: scene?.instances });
      app.commit(circuit, { label: `Add ${id}`, key: null, select: [id] });
      return id;
    },
  };
  return cmd;
}
