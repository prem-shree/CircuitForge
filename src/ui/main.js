import './styles.css';
import { render, validate, listTypes, explainType, explainCircuit } from '../engine.js';
import { parseJSON } from '../parser/index.js';
import { formatJSON, clearLayout, setSpacing, EMPTY_CIRCUIT } from '../editor/model.js';
import { pruneSelection, describeIds } from '../editor/selection.js';
import { hashText } from '../editor/cache.js';
import { download, toPNG, toJPEG, toPDF, copyText, copyPNG, slug } from '../exporters/index.js';
import { handleRequest } from '../api/handler.js';
import { Canvas } from './canvas.js';
import { EXAMPLES } from './examples.js';
import { state, history, renderCache, store, $, $$, esc } from './state.js';
import { initProblems } from './problems.js';
import { initInspector } from './inspector.js';
import { initCommands } from './commands.js';
import { initDrag } from './drag.js';
import { initLibrary } from './library.js';

// Public scripting API (see the API dialog).
window.CircuitForge = { render, validate, types: listTypes, explain: explainType, explainCircuit };

// ---------------------------------------------------------------- app
// One object the UI modules use to talk to each other.
const textarea = $('#json');
const canvasEl = $('#canvas');
const app = {
  canvas: null,
  scene: () => state.result?.scene || null,
  theme: () => (isDark() ? 'dark' : 'light'),
  toast, update, commit, select, setNet, setHint,
};
const canvas = app.canvas = new Canvas(canvasEl, $('#viewport'), {
  onSelect: (ids) => select(ids, { fromCanvas: true }),
  onDragStart: (ids, primary) => drag.start(ids, primary),
  onDragMove: (dx, dy) => drag.move(dx, dy),
  onDragEnd: (cancelled) => drag.end(cancelled),
  onMarquee: (rect, additive) => commands.marquee(rect, additive),
  onNetSelect: (net) => setNet(net),
  onPinClick: (ref, pos) => commands.pinClick(ref, pos),
  onViewChange: (s) => {
    const z = `${Math.round(s * 100)}%`;
    $('#zoom-label').textContent = z;
    $('#status-zoom').textContent = z;
  },
});
const problems = initProblems(app);
const inspector = initInspector(app);
const commands = initCommands(app);
const drag = initDrag(app);
const library = initLibrary(app, commands);

// ---------------------------------------------------------------- theme
const darkQuery = matchMedia('(prefers-color-scheme: dark)');
function isDark() { return (document.documentElement.dataset.theme || (darkQuery.matches ? 'dark' : 'light')) === 'dark'; }
darkQuery.addEventListener('change', () => update());

// ---------------------------------------------------------------- rendering
// The last few renders are kept, so undo, redo and switching theme do not lay
// out and route the circuit again.
function renderCached(value, text) {
  const key = `${isDark() ? 'd' : 'l'}${state.bridges ? 'b' : ''}|${hashText(text)}`;
  const hit = renderCache.get(key);
  if (hit) { state.lastMs = hit.ms ?? state.lastMs; return hit; }
  const r = render(value, { theme: isDark() ? 'dark' : 'light', background: null, interactive: true, bridges: state.bridges });
  if (r.svg) {
    state.lastMs = r.ms ?? 0;
    renderCache.set(key, r);
  }
  return r;
}

function update({ fit = false } = {}) {
  const parsed = parseJSON(state.text);
  let errors = [], warnings = [], findings = [];
  if (parsed.errors.length) {
    errors = parsed.errors;
    canvas.setStale(true);
  } else {
    state.circuit = parsed.value;
    const r = renderCached(parsed.value, state.text);
    errors = r.errors;
    warnings = r.warnings;
    findings = r.findings || [];
    // Design findings (a reversed diode, a short) never stop the drawing; only structural errors do.
    if (r.svg) {
      state.result = r;
      canvas.setSVG(r.svg, r.viewBox, { keepView: !fit });
      canvas.setStale(false);
      if (fit) canvas.fit();
      state.net = null;
      const kept = pruneSelection(state.selection, r.scene.instances);
      if (kept.length !== state.selection.length) select(kept);
      else inspector.fill();
    } else {
      canvas.setStale(true);
    }
  }
  const comps = Array.isArray(state.circuit?.components) ? state.circuit.components.length : 0;
  $('#empty-state').hidden = !(comps === 0 && !errors.length);
  state.findings = findings;
  problems.show(errors, warnings, findings);
  updateStatus(errors, warnings, findings);
  problems.gutterMarks();
  store.set('cf-last', state.text);
}

function updateStatus(errors, warnings, findings = []) {
  const st = $('#status');
  const designErrors = findings.filter((f) => f.severity === 'error');
  const issues = warnings.length + findings.filter((f) => f.severity !== 'info').length;
  st.classList.toggle('error', errors.length + designErrors.length > 0);
  st.classList.toggle('warning', !errors.length && !designErrors.length && issues > 0);
  $('#status-text').textContent = errors.length
    ? `${errors.length} error${errors.length > 1 ? 's' : ''}`
    : designErrors.length ? `${designErrors.length} design error${designErrors.length > 1 ? 's' : ''}`
      : issues ? `Rendered · ${issues} issue${issues > 1 ? 's' : ''}` : 'Rendered';
  const scene = state.result?.scene;
  if (scene) {
    const nets = scene.netlist.nets.size;
    $('#status-counts').textContent = `${scene.instances.size} parts · ${nets} nets · ${scene.routing.junctions.length} junctions · ${scene.routing.crossings.length} crossings`;
    $('#spacing').value = state.circuit?.layout?.spacing || '';
    $('#status-size').textContent = `${state.result.width} × ${state.result.height} px`;
    $('#editor-meta').textContent = `${state.circuit?.components?.length ?? 0} components`;
  }
  $('#status-grid').textContent = state.grid ? (state.snap ? '20 px snap' : '10 px') : 'off';
  updateSelectionInfo();
}

function updateSelectionInfo() {
  const scene = app.scene();
  const ids = state.selection;
  let text = '';
  if (state.net && scene?.netlist.nets.has(state.net)) {
    const net = scene.netlist.nets.get(state.net);
    text = `Net ${net.name || (net.rail ? net.rail.name : state.net)}: ${net.pins.slice(0, 6).map((p) => `${p.comp}.${p.pin}`).join(', ')}${net.pins.length > 6 ? ` … (${net.pins.length} pins)` : ''}`;
  } else if (ids.length === 1 && scene?.instances.has(ids[0])) {
    const I = scene.instances.get(ids[0]);
    text = `${I.id} · ${I.part.sym.name} · ${Math.round(I.x)}, ${Math.round(I.y)} · ${I.rot}°`;
  } else if (ids.length > 1) text = `${describeIds(ids)} selected`;
  $('#status-sel').textContent = text;
}

// ---------------------------------------------------------------- selection
function select(ids, { fromCanvas = false } = {}) {
  state.selection = [...ids];
  if (!fromCanvas) canvas.setSelection(state.selection);
  if (state.net) setNet(null);
  commands.cancelWire();
  inspector.fill();
  syncToolbar();
  updateSelectionInfo();
}

function setNet(net) {
  state.net = net || null;
  canvas.setNetFocus(state.net);
  updateSelectionInfo();
}

function setHint(text) { $('#status-hint').textContent = text || ''; }

// ---------------------------------------------------------------- text and history
let typingTimer = 0, historyTimer = 0;

// Typing is recorded a moment after the last key; anything not yet recorded is
// pushed now, so undo never skips over text that was just typed.
function flushTyping() {
  if (typingTimer) { clearTimeout(typingTimer); typingTimer = 0; update(); }
  if (historyTimer) {
    clearTimeout(historyTimer);
    historyTimer = 0;
    history.push(state.text, { label: 'Edit JSON', key: 'text', selection: state.selection });
  }
}

function setText(text, { record = true, fit = false, label = null, key = null } = {}) {
  clearTimeout(typingTimer); clearTimeout(historyTimer);
  typingTimer = historyTimer = 0;
  state.text = text;
  if (textarea.value !== text) textarea.value = text;
  if (record) history.push(text, { label, key, selection: state.selection });
  update({ fit });
  syncToolbar();
}

// Every edit from the canvas, inspector and commands comes through here: one
// call, one undo step (or one merged step for repeated edits with the same key).
function commit(circuit, { label = null, key = null, select: ids = null, fit = false } = {}) {
  flushTyping();
  if (ids) { state.selection = [...ids]; canvas.setSelection(state.selection); }
  setText(formatJSON(circuit) + '\n', { label, key, fit });
}

function restore(text, message) {
  state.selection = [...(history.entry?.selection || [])];
  canvas.setSelection(state.selection);
  setText(text, { record: false });
  toast(message);
}
function undo() {
  flushTyping();
  const label = history.undoLabel;
  const t = history.undo();
  if (t !== null) restore(t, `Undid ${label || 'change'}`);
}
function redo() {
  flushTyping();
  const label = history.redoLabel;
  const t = history.redo();
  if (t !== null) restore(t, `Redid ${label || 'change'}`);
}

textarea.addEventListener('input', () => {
  state.text = textarea.value;
  clearTimeout(typingTimer);
  clearTimeout(historyTimer);
  // wait longer before re-rendering when renders are slow
  typingTimer = setTimeout(() => { typingTimer = 0; update(); }, Math.min(700, Math.max(150, state.lastMs * 2)));
  historyTimer = setTimeout(() => { historyTimer = 0; history.push(state.text, { label: 'Edit JSON', key: 'text', selection: state.selection }); syncToolbar(); }, 600);
  problems.gutterMarks();
});
textarea.addEventListener('scroll', () => { $('#gutter').scrollTop = textarea.scrollTop; });
textarea.addEventListener('keydown', (e) => {
  if (e.key === 'Tab' && !e.ctrlKey && !e.metaKey) {
    e.preventDefault();
    document.execCommand('insertText', false, '  ');
  }
});

// ---------------------------------------------------------------- toolbar
function setTool(tool) {
  state.tool = tool;
  canvas.setMode(tool === 'wire' ? 'connect' : 'select');
  commands.cancelWire();
  setHint(tool === 'wire' ? 'Wire tool: click a pin, then another pin (Esc to leave)' : '');
  syncToolbar();
}

function toggle(key) {
  state[key] = !state[key];
  store.set(`cf-${key}`, state[key] ? '1' : '0');
  if (key === 'grid') canvasEl.classList.toggle('grid-on', state.grid);
  syncToolbar();
  update();
}

function syncToolbar() {
  const has = state.selection.length > 0;
  $$('[data-tool=undo]').forEach((b) => { b.disabled = !history.canUndo; b.title = history.canUndo ? `Undo ${history.undoLabel || ''} (Ctrl+Z)`.replace('  ', ' ') : 'Undo (Ctrl+Z)'; });
  $$('[data-tool=redo]').forEach((b) => { b.disabled = !history.canRedo; b.title = history.canRedo ? `Redo ${history.redoLabel || ''} (Ctrl+Y)`.replace('  ', ' ') : 'Redo (Ctrl+Y)'; });
  $$('[data-selection-tool]').forEach((b) => (b.disabled = !has));
  for (const k of ['grid', 'snap', 'bridges']) $(`[data-tool=${k}]`).setAttribute('aria-pressed', String(state[k]));
  $('[data-tool=select]').setAttribute('aria-pressed', String(state.tool === 'select'));
  $('[data-tool=wire]').setAttribute('aria-pressed', String(state.tool === 'wire'));
}

const tools = {
  undo, redo,
  select: () => setTool('select'),
  wire: () => setTool(state.tool === 'wire' ? 'select' : 'wire'),
  rotate: (e) => commands.rotate(e?.shiftKey ? 45 : 90),
  flip: () => commands.flip(),
  duplicate: () => commands.duplicate(),
  delete: () => commands.remove(),
  autolayout: () => {
    if (!state.circuit) return;
    commit(clearLayout(state.circuit), { label: 'Automatic layout', fit: true });
    toast('Automatic layout restored');
  },
  grid: () => toggle('grid'),
  snap: () => toggle('snap'),
  bridges: () => toggle('bridges'),
  'zoom-in': () => canvas.zoomAt(1.25),
  'zoom-out': () => canvas.zoomAt(0.8),
  'zoom-reset': () => canvas.zoomTo(1),
  'zoom-selection': () => commands.zoomToSelection(),
  fit: () => canvas.fit(),
};
$('#spacing').addEventListener('change', (e) => { if (state.circuit) commit(setSpacing(state.circuit, e.target.value), { label: 'Change spacing' }); });
document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-tool]');
  if (t && tools[t.dataset.tool]) tools[t.dataset.tool](e);
});

// ---------------------------------------------------------------- keyboard
const NUDGE = 10;
document.addEventListener('keydown', (e) => {
  const mod = e.ctrlKey || e.metaKey;
  const key = e.key;
  const inField = e.target.closest?.('input, textarea, select');
  const inDialog = !!document.querySelector('dialog[open]');
  if (inDialog && key !== 'Escape') return;
  if (mod && key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
  if (mod && key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
  if (key === 'Escape') {
    closeMenus();
    if (canvas.cancelGesture()) return;
    if (commands.cancelWire()) return;
    if (!inField) {
      if (state.tool === 'wire') setTool('select');
      else if (state.net) setNet(null);
      else select([]);
    }
    return;
  }
  if (inField || e.altKey) return;
  if (mod) {
    const k = key.toLowerCase();
    const handled = { a: () => commands.selectAll(), d: () => commands.duplicate(), c: () => commands.copy(), x: () => commands.cut(), v: () => commands.paste() }[k];
    if (handled) { e.preventDefault(); handled(); }
    return;
  }
  if (key === ' ') { canvas.spaceDown = true; return; } // (no preventDefault: Space must still press a focused button)
  if (key === 'Tab' && document.activeElement === canvasEl) { e.preventDefault(); commands.cycle(e.shiftKey ? -1 : 1); return; }
  // arrow keys belong to menus and buttons when one of them has focus
  if (key.startsWith('Arrow') && (document.activeElement === canvasEl || document.activeElement === document.body)) {
    e.preventDefault();
    const d = (e.shiftKey ? 4 : 1) * NUDGE;
    const dx = key === 'ArrowLeft' ? -d : key === 'ArrowRight' ? d : 0, dy = key === 'ArrowUp' ? -d : key === 'ArrowDown' ? d : 0;
    if (state.selection.length) commands.nudge(dx, dy);
    else { canvas.autoFit = false; canvas.tx -= dx * canvas.scale * 2; canvas.ty -= dy * canvas.scale * 2; canvas.apply(); }
    return;
  }
  if (key === '?') { $('#help-dialog').showModal(); return; }
  const map = {
    Delete: 'delete', Backspace: 'delete', r: 'rotate', R: 'rotate', m: 'flip', M: 'flip', w: 'wire', W: 'wire', v: 'select', V: 'select',
    f: 'fit', F: 'fit', z: 'zoom-selection', Z: 'zoom-selection', g: 'grid', G: 'grid', s: 'snap', S: 'snap', '+': 'zoom-in', '=': 'zoom-in', '-': 'zoom-out', '0': 'zoom-reset',
  };
  if (map[key]) { e.preventDefault(); tools[map[key]](e); }
});
document.addEventListener('keyup', (e) => { if (e.key === ' ') canvas.spaceDown = false; });

// ---------------------------------------------------------------- menus
function closeMenus() { $$('.menu').forEach((m) => (m.hidden = true)); }
$$('[data-menu]').forEach((btn) => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const menu = $(`#menu-${btn.dataset.menu}`);
    const open = menu.hidden;
    closeMenus();
    if (open) {
      const r = btn.getBoundingClientRect();
      menu.style.left = `${Math.min(r.left, innerWidth - 240)}px`;
      menu.style.top = `${r.bottom + 4}px`;
      menu.hidden = false;
      menu.querySelector('button')?.focus();
    }
  });
});
document.addEventListener('click', (e) => { if (!e.target.closest('.menu')) closeMenus(); });

const examplesMenu = $('#menu-examples');
EXAMPLES.forEach((s, i) => {
  const b = document.createElement('button');
  b.setAttribute('role', 'menuitem');
  b.innerHTML = `<span class="num">${i ? i : '★'}</span><span></span>`;
  b.lastChild.textContent = s.title;
  b.addEventListener('click', () => { closeMenus(); loadCircuit(s, `Load ${s.title}`); });
  examplesMenu.append(b);
});

function loadCircuit(c, label = 'New circuit') {
  select([]);
  commit(c, { label, fit: true });
}

// ---------------------------------------------------------------- actions
const fileInput = $('#file-input');
fileInput.addEventListener('change', async () => {
  const f = fileInput.files[0];
  if (f) openFile(f);
  fileInput.value = '';
});
async function openFile(f) {
  const text = await f.text();
  select([]);
  flushTyping();
  setText(text, { fit: true, label: `Open ${f.name}` });
  toast(`Opened ${f.name}`);
}
document.addEventListener('dragover', (e) => e.preventDefault());
document.addEventListener('drop', (e) => {
  e.preventDefault();
  const f = e.dataTransfer?.files?.[0];
  if (f) openFile(f);
});

const actions = {
  new: () => loadCircuit(EMPTY_CIRCUIT, 'New circuit'),
  open: () => fileInput.click(),
  format: () => {
    const p = parseJSON(state.text);
    if (p.errors.length) return toast('Fix the JSON syntax error first.', true);
    commit(p.value, { label: 'Format JSON' });
  },
  api: () => $('#api-dialog').showModal(),
  help: () => $('#help-dialog').showModal(),
  library: () => library.open(),
  theme: () => {
    const next = isDark() ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    store.set('cf-theme', next);
    update();
  },
  deselect: () => select([]),
  'load-first-sample': () => loadCircuit(EXAMPLES[1] || EXAMPLES[0], 'Load example'),
  learn: () => { showLearn(); $('#learn-dialog').showModal(); },
};
document.addEventListener('click', (e) => {
  const a = e.target.closest('[data-action]');
  if (a && actions[a.dataset.action]) actions[a.dataset.action]();
});
$$('dialog [data-close]').forEach((b) => b.addEventListener('click', () => b.closest('dialog').close()));
$$('dialog').forEach((d) => d.addEventListener('click', (e) => { if (e.target === d) d.close(); }));

// ---------------------------------------------------------------- export
function exportRender(extra = {}) {
  const p = parseJSON(state.text);
  if (p.errors.length) throw new Error('Fix the JSON errors before exporting.');
  const r = render(p.value, { theme: 'light', bridges: state.bridges, ...extra });
  if (!r.svg) throw new Error(`Fix the circuit errors before exporting${r.errors[0] ? `: ${r.errors[0].message}` : '.'}`);
  return r;
}
const baseName = () => slug(state.circuit?.title);
const exporters = {
  'copy-png': async () => { const r = exportRender(); await copyPNG(r.svg, r.width, r.height, { scale: 2 }); return 'PNG copied to clipboard'; },
  'copy-svg': async () => { await copyText(exportRender().svg); return 'SVG copied to clipboard'; },
  'copy-json': async () => { await copyText(state.text); return 'JSON copied to clipboard'; },
  svg: async () => { download(exportRender().svg, `${baseName()}.svg`, 'image/svg+xml'); },
  png: async () => { const r = exportRender(); download(await toPNG(r.svg, r.width, r.height, { scale: 2 }), `${baseName()}.png`); },
  'png-hires': async () => { const r = exportRender(); download(await toPNG(r.svg, r.width, r.height, { scale: 4 }), `${baseName()}@4x.png`); },
  'png-transparent': async () => { const r = exportRender({ background: null }); download(await toPNG(r.svg, r.width, r.height, { scale: 2, transparent: true }), `${baseName()}-transparent.png`); },
  jpeg: async () => { const r = exportRender(); download(await toJPEG(r.svg, r.width, r.height, { scale: 2 }), `${baseName()}.jpg`); },
  pdf: async () => { const r = exportRender(); download(await toPDF(r.svg, r.width, r.height, { scale: 4, title: state.circuit?.title }), `${baseName()}.pdf`); },
  json: async () => { download(state.text, `${baseName()}.json`, 'application/json'); },
};
$$('[data-export]').forEach((b) => b.addEventListener('click', async () => {
  closeMenus();
  try {
    const msg = await exporters[b.dataset.export]();
    toast(msg || 'Exported');
  } catch (err) {
    toast(err.message || String(err), true);
  }
}));

// ---------------------------------------------------------------- API explorer
$$('[data-api]').forEach((b) => b.addEventListener('click', () => {
  const p = parseJSON(state.text);
  const out = handleRequest({ method: 'POST', path: `/api/v1/${b.dataset.api}`, headers: {}, body: { circuit: p.value ?? state.text, format: 'json' } });
  let body = out.body;
  try {
    const o = JSON.parse(body);
    if (o.svg) o.svg = o.svg.slice(0, 160) + ` … (${o.svg.length} chars)`;
    body = JSON.stringify(o, null, 2);
  } catch { /* svg body */ }
  $('#api-out').textContent = `HTTP ${out.status}\n${body}`;
}));

// ---------------------------------------------------------------- learn dialog
function showLearn() {
  const info = explainCircuit(state.circuit || {}, state.findings || []);
  const list = (title, items) => (items && items.length ? `<h3>${title}</h3><ul>${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>` : '');
  const parts = info.components.map((c) => `<details><summary>${esc(c.name)} <span class="t">${esc(c.type)}</span></summary>`
    + (c.purpose ? `<p>${esc(c.purpose)}</p>` : '')
    + (c.explanation ? `<p>${esc(c.explanation)}</p>` : '')
    + (c.formulas.length ? `<p class="formula">${c.formulas.map(esc).join('<br>')}</p>` : '')
    + (c.truthTable ? `<table class="tt"><tr>${c.truthTable.inputs.map((i) => `<th>${esc(i)}</th>`).join('')}${(c.truthTable.outputs || ['Y']).map((o) => `<th>${esc(o)}</th>`).join('')}</tr>`
        + c.truthTable.rows.map((r) => `<tr>${r.map((v) => `<td>${esc(v)}</td>`).join('')}</tr>`).join('') + '</table>' : '')
    + list('Common mistakes', c.mistakes)
    + `<p class="pins">Pins: ${c.pins.map((p) => `<code>${esc(p.name)}</code> <span>${esc(p.electrical)}</span>`).join(' · ')}</p>`
    + '</details>').join('');
  const rules = info.rules.map((r) => `<details><summary>${esc(r.title)} <span class="t">${esc(r.code)}</span></summary><p>${esc(r.why)}</p><p class="watch">Fix: ${esc(r.fix)}</p></details>`).join('');
  $('#learn-body').innerHTML = (info.summary ? `<p class="lead">${esc(info.summary)}</p>` : '<p class="lead">This circuit carries no teaching notes of its own; the component notes below still apply.</p>')
    + (info.theory ? `<p>${esc(info.theory)}</p>` : '')
    + list('Learning objectives', info.objectives)
    + list('Questions to answer', info.questions)
    + list('Things to try', info.experiments)
    + list('Troubleshooting', info.troubleshooting)
    + (rules ? `<h3>What the checks found</h3>${rules}` : '')
    + `<h3>Components in this circuit</h3>${parts}`;
}

// ---------------------------------------------------------------- splitter
{
  const sp = $('#splitter');
  const ws = $('.workspace');
  const saved = store.get('cf-editor-w');
  if (saved) ws.style.setProperty('--editor-w', saved);
  sp.addEventListener('pointerdown', (e) => {
    if (innerWidth <= 820) return;
    sp.setPointerCapture(e.pointerId);
    sp.classList.add('dragging');
    const move = (ev) => {
      const w = Math.max(240, Math.min(innerWidth * 0.7, ev.clientX));
      ws.style.setProperty('--editor-w', `${w}px`);
    };
    const up = () => {
      sp.classList.remove('dragging');
      sp.removeEventListener('pointermove', move);
      store.set('cf-editor-w', ws.style.getPropertyValue('--editor-w'));
    };
    sp.addEventListener('pointermove', move);
    sp.addEventListener('pointerup', up, { once: true });
  });
  sp.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const cur = parseFloat(getComputedStyle(ws).gridTemplateColumns) || 400;
    ws.style.setProperty('--editor-w', `${Math.max(240, cur + (e.key === 'ArrowLeft' ? -20 : 20))}px`);
  });
}

// ---------------------------------------------------------------- toast
let toastTimer = 0;
function toast(msg, isError = false) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.toggle('error', isError);
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), isError ? 4500 : 2400);
}

// ---------------------------------------------------------------- boot
canvasEl.classList.toggle('grid-on', state.grid);
const initial = store.get('cf-last');
const first = initial && initial.trim() ? initial : formatJSON(EXAMPLES[1] || EXAMPLES[0]) + '\n';
history.reset(first, { label: 'Open', selection: [] });
setText(first, { record: false, fit: true });
syncToolbar();
