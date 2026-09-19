// Interactive canvas: shows the rendered SVG, handles zoom/pan, selection and
// dragging. It never edits the circuit itself — it reports intents to the app.
const MIN_ZOOM = 0.1, MAX_ZOOM = 8;

export class Canvas {
  constructor(el, viewport, { onSelect, onDragMove, onDragEnd, onViewChange }) {
    this.el = el;
    this.vp = viewport;
    this.cb = { onSelect, onDragMove, onDragEnd, onViewChange };
    this.scale = 1; this.tx = 0; this.ty = 0;
    this.vb = null; // viewBox of the current svg {x,y,w,h}
    this.selected = null;
    this.spaceDown = false;
    this.autoFit = true; // refit on resize until the user zooms or pans
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
    this.applySelection();
    this.apply();
  }

  setStale(stale) { this.vp.classList.toggle('stale', stale); }

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
    const r = this.el.getBoundingClientRect();
    const availW = Math.max(100, r.width - 64), availH = Math.max(100, r.height - 120);
    this.scale = Math.min(availW / this.vb.w, availH / this.vb.h, 2.5);
    this.tx = (r.width - this.vb.w * this.scale) / 2;
    this.ty = (r.height - 56 - this.vb.h * this.scale) / 2;
    this.autoFit = true;
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

  // ---- selection
  select(id) {
    this.selected = id;
    this.applySelection();
  }

  applySelection() {
    if (!this.svg) return;
    this.svg.querySelectorAll('.selected').forEach((n) => n.classList.remove('selected'));
    this.svg.querySelector('.sel-box')?.remove();
    if (!this.selected) return;
    const esc = CSS.escape(this.selected);
    const part = this.svg.querySelector(`.cf-part[data-id="${esc}"]`);
    if (!part) return;
    part.classList.add('selected');
    this.svg.querySelector(`.cf-labels[data-for="${esc}"]`)?.classList.add('selected');
    const b = part.getBBox();
    const m = part.transform.baseVal.consolidate()?.matrix;
    if (!m) return;
    const pts = [[b.x, b.y], [b.x + b.width, b.y], [b.x, b.y + b.height], [b.x + b.width, b.y + b.height]]
      .map(([x, y]) => [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f]);
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('class', 'sel-box');
    rect.setAttribute('x', Math.min(...xs) - 5);
    rect.setAttribute('y', Math.min(...ys) - 5);
    rect.setAttribute('width', Math.max(...xs) - Math.min(...xs) + 10);
    rect.setAttribute('height', Math.max(...ys) - Math.min(...ys) + 10);
    rect.setAttribute('rx', 3);
    this.svg.insertBefore(rect, this.svg.querySelector('#components'));
  }

  // ---- input
  bind() {
    const el = this.el;
    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey || !e.shiftKey) {
        const f = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015));
        this.zoomAt(f, e.clientX - r.left, e.clientY - r.top);
      } else {
        this.autoFit = false;
        this.tx -= e.deltaX || e.deltaY;
        this.apply();
      }
    }, { passive: false });

    let drag = null;
    el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 && e.button !== 1) return;
      el.focus({ preventScroll: true });
      const part = e.target.closest?.('.cf-part');
      const labels = e.target.closest?.('.cf-labels');
      const id = part?.dataset.id || labels?.dataset.for;
      const pan = e.button === 1 || this.spaceDown || !id;
      drag = { pan, id, x0: e.clientX, y0: e.clientY, tx0: this.tx, ty0: this.ty, w0: this.toWorld(e.clientX, e.clientY), moved: false };
      el.setPointerCapture(e.pointerId);
      if (!pan) {
        this.cb.onSelect(id);
      }
      if (pan) el.classList.add('panning');
      e.preventDefault();
    });
    el.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
      if (!drag.moved && Math.hypot(dx, dy) < 3) return;
      drag.moved = true;
      if (drag.pan) {
        this.autoFit = false;
        this.tx = drag.tx0 + dx; this.ty = drag.ty0 + dy;
        this.apply();
      } else {
        const w = this.toWorld(e.clientX, e.clientY);
        this.vp.classList.add('dragging');
        this.cb.onDragMove(drag.id, w.x - drag.w0.x, w.y - drag.w0.y);
      }
    });
    const end = (e) => {
      if (!drag) return;
      el.classList.remove('panning');
      this.vp.classList.remove('dragging');
      if (drag.pan && !drag.moved && e.type === 'pointerup') this.cb.onSelect(null);
      if (!drag.pan && drag.moved) this.cb.onDragEnd(drag.id, e.type === 'pointercancel');
      drag = null;
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  }
}
