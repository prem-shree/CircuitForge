// Interactive canvas: shows the rendered SVG and handles zoom, pan, selection,
// dragging and picking. It never edits the circuit itself: it reports intents
// (onSelect, onDragStart/Move/End, onMarquee, onNetSelect, onPinClick) to the app.
//
// Pointer model
//   drag empty space ........ pan (a plain click clears the selection)
//   shift + drag empty ...... rubber-band selection (adds to the selection)
//   click a part ............ select it; shift/ctrl/cmd-click toggles
//   drag a selected part .... move the whole selection
//   click a wire ............ highlight its net
//   connect mode: click a pin, then another pin
//   wheel / pinch ........... zoom; middle button or space+drag pans
const MIN_ZOOM = 0.1, MAX_ZOOM = 8;
const DRAG_THRESHOLD = 3; // screen pixels before a press becomes a drag
const SVG_NS = 'http://www.w3.org/2000/svg';

export class Canvas {
  constructor(el, viewport, callbacks = {}) {
    this.el = el;
    this.vp = viewport;
    this.cb = callbacks;
    this.scale = 1; this.tx = 0; this.ty = 0;
    this.vb = null; // viewBox of the current svg {x,y,w,h}
    this.selected = new Set();
    this.mode = 'select'; // or 'connect'
    this.netFocus = null;
    this.spaceDown = false;
    this.autoFit = true; // refit on resize until the user zooms or pans
    this.pointers = new Map();
    this.gesture = null;
    this.wireFrom = null;
    this.marqueeEl = document.createElement('div');
    this.marqueeEl.className = 'marquee';
    this.marqueeEl.hidden = true;
    el.append(this.marqueeEl);
    this.bind();
    new ResizeObserver(() => { if (this.autoFit) this.fit(); }).observe(el);
  }

  // ---- content
  setSVG(svg, viewBox, { keepView = true } = {}) {
    if (this.vb && keepView) {
      // keep world coordinates fixed on screen when the drawing's bounds change
      this.tx += (viewBox.x - this.vb.x) * this.scale;
      this.ty += (viewBox.y - this.vb.y) * this.scale;
    }
    this.vb = viewBox;
    this.vp.innerHTML = svg;
    this.svg = this.vp.querySelector('svg');
    this.ghost = null;
    this.applySelection();
    this.applyNetFocus();
    this.applyWirePreview();
    this.apply();
  }

  setStale(stale) { this.vp.classList.toggle('stale', stale); }

  setMode(mode) {
    this.mode = mode;
    this.el.classList.toggle('connect-mode', mode === 'connect');
    if (mode !== 'connect') this.setWireFrom(null);
  }

  // ---- view transform
  apply() {
    this.vp.style.transform = `translate(${this.tx}px, ${this.ty}px) scale(${this.scale})`;
    const gs = 20 * this.scale;
    const ox = this.tx - (this.vb ? this.vb.x : 0) * this.scale;
    const oy = this.ty - (this.vb ? this.vb.y : 0) * this.scale;
    this.el.style.setProperty('--gs', `${gs}px`);
    this.el.style.setProperty('--gx', `${((ox % gs) + gs) % gs}px`);
    this.el.style.setProperty('--gy', `${((oy % gs) + gs) % gs}px`);
    this.cb.onViewChange?.(this.scale);
  }

  fit() {
    if (!this.vb) return;
    this.zoomToRect({ x: this.vb.x, y: this.vb.y, w: this.vb.w, h: this.vb.h }, { max: 2.5 });
    this.autoFit = true;
  }

  // Scale and centre so a world rectangle fills the view.
  zoomToRect(rect, { max = 4, padding = 64 } = {}) {
    const r = this.el.getBoundingClientRect();
    const availW = Math.max(100, r.width - padding), availH = Math.max(100, r.height - padding - 56);
    this.scale = Math.max(MIN_ZOOM, Math.min(availW / Math.max(1, rect.w), availH / Math.max(1, rect.h), max));
    const vbx = this.vb ? this.vb.x : 0, vby = this.vb ? this.vb.y : 0;
    this.tx = (r.width - rect.w * this.scale) / 2 - (rect.x - vbx) * this.scale;
    this.ty = (r.height - 56 - rect.h * this.scale) / 2 - (rect.y - vby) * this.scale;
    this.autoFit = false;
    this.apply();
  }

  // Scroll just enough to bring a world rectangle into view (nothing if it already is).
  panIntoView(rect, margin = 40) {
    const r = this.el.getBoundingClientRect();
    const vbx = this.vb ? this.vb.x : 0, vby = this.vb ? this.vb.y : 0;
    const left = (rect.x - vbx) * this.scale + this.tx, right = left + rect.w * this.scale;
    const top = (rect.y - vby) * this.scale + this.ty, bottom = top + rect.h * this.scale;
    let dx = 0, dy = 0;
    if (left < margin) dx = margin - left; else if (right > r.width - margin) dx = r.width - margin - right;
    if (top < margin) dy = margin - top; else if (bottom > r.height - margin) dy = r.height - margin - bottom;
    if (!dx && !dy) return;
    this.autoFit = false;
    this.tx += dx; this.ty += dy;
    this.apply();
  }

  zoomAt(factor, px, py) {
    const r = this.el.getBoundingClientRect();
    if (px === undefined) { px = r.width / 2; py = r.height / 2; }
    this.autoFit = false;
    const s = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, this.scale * factor));
    this.tx = px - (px - this.tx) * (s / this.scale);
    this.ty = py - (py - this.ty) * (s / this.scale);
    this.scale = s;
    this.apply();
  }

  zoomTo(s) { this.zoomAt(s / this.scale); }

  toWorld(clientX, clientY) {
    const r = this.el.getBoundingClientRect();
    return {
      x: (clientX - r.left - this.tx) / this.scale + (this.vb ? this.vb.x : 0),
      y: (clientY - r.top - this.ty) / this.scale + (this.vb ? this.vb.y : 0),
    };
  }

  centerWorld() {
    const r = this.el.getBoundingClientRect();
    return this.toWorld(r.left + r.width / 2, r.top + r.height / 2);
  }

  // ---- selection
  setSelection(ids) {
    this.selected = new Set(ids);
    this.applySelection();
  }

  // World rectangle of a part as drawn (from its DOM node, so rotation is included).
  partBox(id) {
    const part = this.svg?.querySelector(`.cf-part[data-id="${CSS.escape(id)}"]`);
    if (!part) return null;
    const b = part.getBBox();
    const m = part.transform.baseVal.consolidate()?.matrix;
    if (!m) return null;
    const pts = [[b.x, b.y], [b.x + b.width, b.y], [b.x, b.y + b.height], [b.x + b.width, b.y + b.height]]
      .map(([x, y]) => [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f]);
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
  }

  applySelection() {
    if (!this.svg) return;
    this.svg.querySelectorAll('.selected').forEach((n) => n.classList.remove('selected'));
    this.svg.querySelectorAll('.sel-box, .sel-group').forEach((n) => n.remove());
    if (!this.selected.size) return;
    const boxes = [];
    for (const id of this.selected) {
      const esc = CSS.escape(id);
      const part = this.svg.querySelector(`.cf-part[data-id="${esc}"]`);
      if (!part) continue;
      part.classList.add('selected');
      this.svg.querySelector(`.cf-labels[data-for="${esc}"]`)?.classList.add('selected');
      const box = this.partBox(id);
      if (box) boxes.push(box);
    }
    const before = this.svg.querySelector('#components');
    const rect = (b, cls, pad) => {
      const r = document.createElementNS(SVG_NS, 'rect');
      r.setAttribute('class', cls);
      r.setAttribute('x', b.x - pad); r.setAttribute('y', b.y - pad);
      r.setAttribute('width', b.w + 2 * pad); r.setAttribute('height', b.h + 2 * pad);
      r.setAttribute('rx', 3);
      this.svg.insertBefore(r, before);
    };
    for (const b of boxes) rect(b, 'sel-box', 5);
    if (boxes.length > 1) {
      const x1 = Math.min(...boxes.map((b) => b.x)), y1 = Math.min(...boxes.map((b) => b.y));
      const x2 = Math.max(...boxes.map((b) => b.x + b.w)), y2 = Math.max(...boxes.map((b) => b.y + b.h));
      rect({ x: x1, y: y1, w: x2 - x1, h: y2 - y1 }, 'sel-group', 10);
    }
  }

  // ---- nets
  setNetFocus(net) {
    this.netFocus = net || null;
    this.applyNetFocus();
  }

  applyNetFocus() {
    if (!this.svg) return;
    this.svg.classList.toggle('net-focus', !!this.netFocus);
    this.svg.querySelectorAll('.net-hl').forEach((n) => n.classList.remove('net-hl'));
    if (!this.netFocus) return;
    const net = CSS.escape(this.netFocus);
    this.svg.querySelectorAll(`#wires path[data-net="${net}"], #junctions circle[data-net="${net}"], .cf-pin[data-net="${net}"]`).forEach((n) => n.classList.add('net-hl'));
  }

  // ---- wiring tool: a dashed line from the first chosen pin to the pointer
  setWireFrom(pin) {
    this.wireFrom = pin; // { ref, x, y } in world coordinates, or null
    this.applyWirePreview();
  }

  applyWirePreview() {
    this.svg?.querySelectorAll('.cf-wire-preview').forEach((n) => n.remove());
    if (!this.wireFrom || !this.svg) return;
    const l = document.createElementNS(SVG_NS, 'line');
    l.setAttribute('class', 'cf-wire-preview');
    l.setAttribute('x1', this.wireFrom.x); l.setAttribute('y1', this.wireFrom.y);
    l.setAttribute('x2', this.wireFrom.x); l.setAttribute('y2', this.wireFrom.y);
    this.svg.append(l);
    this.previewLine = l;
    this.svg.querySelectorAll('.cf-pin.pending').forEach((n) => n.classList.remove('pending'));
    this.svg.querySelector(`.cf-pin[data-ref="${CSS.escape(this.wireFrom.ref)}"]`)?.classList.add('pending');
  }

  // ---- drag ghost: move the dragged parts by transform instead of re-routing on
  // every frame. `ropes` are the wires that follow: [{ x1, y1, x2, y2 }] with the
  // (x2, y2) end attached to a moving pin.
  startGhost(ids, ropes = []) {
    if (!this.svg) return;
    const layer = document.createElementNS(SVG_NS, 'g');
    layer.setAttribute('class', 'cf-ghost');
    for (const id of ids) {
      const esc = CSS.escape(id);
      this.svg.querySelectorAll(`.cf-part[data-id="${esc}"], .cf-labels[data-for="${esc}"], .cf-marker[data-for="${esc}"], .sel-box, .sel-group`).forEach((n) => layer.append(n));
    }
    const lines = ropes.map((r) => {
      const l = document.createElementNS(SVG_NS, 'line');
      l.setAttribute('class', 'cf-rope');
      l.setAttribute('x1', r.x1); l.setAttribute('y1', r.y1); l.setAttribute('x2', r.x2); l.setAttribute('y2', r.y2);
      this.svg.append(l);
      return l;
    });
    this.svg.append(layer);
    this.svg.classList.add('ghosting');
    this.ghost = { layer, lines, ropes };
  }

  moveGhost(dx, dy) {
    const g = this.ghost;
    if (!g) return;
    g.layer.setAttribute('transform', `translate(${dx} ${dy})`);
    g.lines.forEach((l, i) => {
      l.setAttribute('x2', g.ropes[i].x2 + dx);
      l.setAttribute('y2', g.ropes[i].y2 + dy);
    });
  }

  endGhost() {
    this.svg?.classList.remove('ghosting');
    this.ghost = null;
  }

  // Abandon whatever pointer gesture is running (Escape).
  cancelGesture() {
    const g = this.gesture;
    if (!g) return false;
    this.finishGesture(g, true);
    this.gesture = null;
    return true;
  }

  // ---- input
  bind() {
    const el = this.el;
    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      if (!e.ctrlKey && !e.metaKey && Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        this.autoFit = false; // trackpad sideways scroll pans
        this.tx -= e.deltaX;
        this.apply();
      } else if (e.ctrlKey || e.metaKey || !e.shiftKey) {
        const f = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015));
        this.zoomAt(f, e.clientX - r.left, e.clientY - r.top);
      } else {
        this.autoFit = false;
        this.tx -= e.deltaX || e.deltaY;
        this.apply();
      }
    }, { passive: false });

    el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 && e.button !== 1) return;
      el.focus({ preventScroll: true });
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      try { el.setPointerCapture(e.pointerId); } catch { /* synthetic or already-released pointer */ }
      e.preventDefault();
      if (this.pointers.size === 2) return this.startPinch();
      if (this.pointers.size > 2) return;
      this.gesture = this.beginGesture(e);
    });

    el.addEventListener('pointermove', (e) => {
      if (this.pointers.has(e.pointerId)) this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pinch) return this.movePinch();
      if (this.wireFrom && this.previewLine) {
        const w = this.toWorld(e.clientX, e.clientY);
        this.previewLine.setAttribute('x2', w.x); this.previewLine.setAttribute('y2', w.y);
      }
      const g = this.gesture;
      if (g) this.moveGesture(g, e);
    });

    const end = (e) => {
      const had = this.pointers.delete(e.pointerId);
      if (this.pinch) { if (this.pointers.size < 2) this.pinch = null; return; }
      const g = this.gesture;
      if (!had || !g) return;
      this.gesture = null;
      this.finishGesture(g, e.type === 'pointercancel', e);
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  }

  // What does this press start?
  beginGesture(e) {
    const t = e.target;
    const additive = e.shiftKey || e.ctrlKey || e.metaKey;
    const base = { x0: e.clientX, y0: e.clientY, tx0: this.tx, ty0: this.ty, w0: this.toWorld(e.clientX, e.clientY), moved: false };
    if (e.button === 1 || this.spaceDown) { this.el.classList.add('panning'); return { ...base, type: 'pan' }; }
    if (this.mode === 'connect') {
      const pin = t.closest?.('.cf-pin');
      if (pin) return { ...base, type: 'pin', ref: pin.dataset.ref, cx: +pin.getAttribute('cx'), cy: +pin.getAttribute('cy') };
      this.el.classList.add('panning');
      return { ...base, type: 'pan', clear: false };
    }
    const part = t.closest?.('.cf-part');
    const labels = t.closest?.('.cf-labels');
    const id = part?.dataset.id || labels?.dataset.for;
    if (id) {
      let pendingSingle = false;
      if (additive) {
        const next = new Set(this.selected);
        if (next.has(id)) next.delete(id); else next.add(id);
        this.selected = next;
        this.applySelection();
        this.cb.onSelect?.([...next]);
      } else if (this.selected.has(id)) pendingSingle = true; // keep the group for a drag
      else {
        this.selected = new Set([id]);
        this.applySelection();
        this.cb.onSelect?.([id]);
      }
      return { ...base, type: 'part', id, pendingSingle, additive, started: false };
    }
    const wire = t.closest?.('.cf-wire-hit');
    if (wire) return { ...base, type: 'wire', net: wire.dataset.net };
    if (additive) return { ...base, type: 'marquee' };
    this.el.classList.add('panning');
    return { ...base, type: 'pan', clear: true };
  }

  moveGesture(g, e) {
    const dx = e.clientX - g.x0, dy = e.clientY - g.y0;
    if (!g.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    g.moved = true;
    if (g.type === 'pan') {
      this.autoFit = false;
      this.tx = g.tx0 + dx; this.ty = g.ty0 + dy;
      this.apply();
    } else if (g.type === 'part') {
      if (!g.started) {
        g.started = true;
        this.vp.classList.add('dragging');
        this.cb.onDragStart?.([...this.selected], g.id);
      }
      const w = this.toWorld(e.clientX, e.clientY);
      this.cb.onDragMove?.(w.x - g.w0.x, w.y - g.w0.y, e);
    } else if (g.type === 'marquee') {
      const r = this.el.getBoundingClientRect();
      const m = this.marqueeEl;
      m.hidden = false;
      m.style.left = `${Math.min(g.x0, e.clientX) - r.left}px`;
      m.style.top = `${Math.min(g.y0, e.clientY) - r.top}px`;
      m.style.width = `${Math.abs(dx)}px`;
      m.style.height = `${Math.abs(dy)}px`;
    }
  }

  finishGesture(g, cancelled, e) {
    this.el.classList.remove('panning');
    this.vp.classList.remove('dragging');
    this.marqueeEl.hidden = true;
    if (g.type === 'pan') {
      if (!g.moved && !cancelled && g.clear && this.selected.size) { this.selected = new Set(); this.applySelection(); this.cb.onSelect?.([]); }
      if (!g.moved && !cancelled && g.clear) this.cb.onNetSelect?.(null);
    } else if (g.type === 'part') {
      if (g.started) this.cb.onDragEnd?.(cancelled);
      else if (!cancelled && g.pendingSingle) {
        this.selected = new Set([g.id]);
        this.applySelection();
        this.cb.onSelect?.([g.id]);
      }
    } else if (g.type === 'wire' && !cancelled) {
      this.cb.onNetSelect?.(g.net);
    } else if (g.type === 'pin' && !cancelled && !g.moved) {
      this.cb.onPinClick?.(g.ref, { x: g.cx, y: g.cy });
    } else if (g.type === 'marquee' && !cancelled && g.moved && e) {
      const a = this.toWorld(g.x0, g.y0), b = this.toWorld(e.clientX, e.clientY);
      this.cb.onMarquee?.({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) }, true);
    }
  }

  // ---- two-finger zoom and pan
  startPinch() {
    const g = this.gesture;
    if (g) { this.finishGesture(g, true); this.gesture = null; }
    const [a, b] = [...this.pointers.values()];
    this.pinch = { d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, scale0: this.scale, tx0: this.tx, ty0: this.ty, mid0: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
  }

  movePinch() {
    const p = this.pinch;
    if (!p || this.pointers.size < 2) return;
    const [a, b] = [...this.pointers.values()];
    const r = this.el.getBoundingClientRect();
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const s = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, p.scale0 * (Math.hypot(a.x - b.x, a.y - b.y) / p.d0)));
    const px = p.mid0.x - r.left, py = p.mid0.y - r.top;
    // keep the world point that started under the fingers under them as they move
    this.tx = mid.x - r.left - (px - p.tx0) * (s / p.scale0);
    this.ty = mid.y - r.top - (py - p.ty0) * (s / p.scale0);
    this.scale = s;
    this.autoFit = false;
    this.apply();
  }
}
