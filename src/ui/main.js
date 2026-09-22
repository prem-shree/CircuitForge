import './styles.css';
import { render, validate, listTypes, explainType, explainCircuit, RULE_HELP } from '../engine.js';
import { parseJSON } from '../parser/index.js';
import { resolveSymbol } from '../symbol-loader/index.js';
import { History } from '../editor/history.js';
import { formatJSON, deleteComponent, renameComponent, updateComponent, pinLayout, rotateComponent, clearLayout, addComponent, EMPTY_CIRCUIT } from '../editor/model.js';
import { download, toPNG, toJPEG, toPDF, copyText, copyPNG, slug } from '../exporters/index.js';
import { handleRequest } from '../api/handler.js';
import { Canvas } from './canvas.js';
import { EXAMPLES } from './examples.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

// Public scripting API (see the API dialog).
window.CircuitForge = { render, validate, types: listTypes, explain: explainType, explainCircuit };

const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } },
};

const state = {
  text: '',
  circuit: null,   // last successfully parsed circuit object
  result: null,    // last successful render (with scene)
  selected: null,
  snap: store.get('cf-snap') !== '0',
  grid: store.get('cf-grid') !== '0',
  bridges: store.get('cf-bridges') === '1',
  drag: null,
};
const history = new History();

// ---------------------------------------------------------------- elements
const textarea = $('#json');
const gutter = $('#gutter');
const canvasEl = $('#canvas');
const canvas = new Canvas(canvasEl, $('#viewport'), {
  onSelect: (id) => select(id),
  onDragMove,
  onDragEnd,
  onViewChange: (s) => {
    const z = `${Math.round(s * 100)}%`;
    $('#zoom-label').textContent = z;
    $('#status-zoom').textContent = z;
  },
});

// ---------------------------------------------------------------- theme
const darkQuery = matchMedia('(prefers-color-scheme: dark)');
const isDark = () => (document.documentElement.dataset.theme || (darkQuery.matches ? 'dark' : 'light')) === 'dark';
darkQuery.addEventListener('change', () => update());

// ---------------------------------------------------------------- rendering
function update({ fit = false } = {}) {
  const parsed = parseJSON(state.text);
  let errors = [], warnings = [], findings = [];
  if (parsed.errors.length) {
    errors = parsed.errors;
    canvas.setStale(true);
  } else {
    state.circuit = parsed.value;
    const r = render(parsed.value, { theme: isDark() ? 'dark' : 'light', background: null, interactive: true, bridges: state.bridges });
    errors = r.errors;
    warnings = r.warnings;
    findings = r.findings || [];
    if (r.valid) {
      state.result = r;
      canvas.setSVG(r.svg, r.viewBox, { keepView: !fit });
      canvas.setStale(false);
      if (fit) canvas.fit();
      if (state.selected && !r.scene.instances.has(state.selected)) select(null);
      else if (state.selected) fillInspector();
    } else {
      canvas.setStale(true);
    }
  }
  const comps = Array.isArray(state.circuit?.components) ? state.circuit.components.length : 0;
  $('#empty-state').hidden = !(comps === 0 && !errors.length);
  state.findings = findings;
  showProblems(errors, warnings, findings);
  updateStatus(errors, warnings, findings);
  updateGutter(errors);
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
    const nets = [...scene.netlist.nets.values()].length;
    $('#status-counts').textContent = `${scene.instances.size} parts · ${nets} nets · ${scene.routing.junctions.length} junctions`;
    $('#status-size').textContent = `${state.result.width} × ${state.result.height} px`;
    $('#editor-meta').textContent = `${state.circuit?.components?.length ?? 0} components`;
  }
  $('#status-grid').textContent = state.grid ? (state.snap ? '20 px snap' : '10 px') : 'off';
}

const escRe = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function lineMatching(re) {
  const i = state.text.split('\n').findIndex((l) => re.test(l));
  return i >= 0 ? i + 1 : null;
}
// Best-effort source line for a problem: explicit line, offending reference, or component entry.
function lineOf(p) {
  return p.line
    || (p.ref && lineMatching(new RegExp(escRe(JSON.stringify(p.ref)))))
    || (p.component && lineMatching(new RegExp(`"id"\\s*:\\s*${escRe(JSON.stringify(p.component))}`)))
    || null;
}

function showProblems(errors, warnings, findings = []) {
  const list = $('#problems-list');
  list.textContent = '';
  const all = [
    ...errors.map((e) => ({ ...e, level: 'error' })),
    ...findings.map((f) => ({ ...f, level: f.severity === 'error' ? 'error' : f.severity === 'info' ? 'info' : 'warning' })),
    ...warnings.map((w) => ({ ...w, level: 'warning' })),
  ];
  $('#problems-title').textContent = all.length ? `Problems (${all.length})` : 'Problems';
  if (!all.length) {
    const li = document.createElement('li');
    li.className = 'ok';
    li.textContent = 'No problems. The circuit is valid.';
    list.append(li);
    return;
  }
  for (const p of all) {
    const li = document.createElement('li');
    li.className = p.level;
    li.innerHTML = '<span class="ico"></span><span class="code"></span><span class="msg"></span>';
    li.querySelector('.code').textContent = p.code;
    li.querySelector('.msg').textContent = p.message + (p.line && !/line \d/.test(p.message) ? ` (line ${p.line})` : '');
    if (p.hint || p.formula) {
      const extra = document.createElement('span');
      extra.className = 'hint';
      extra.textContent = [p.formula, p.hint].filter(Boolean).join(' · ');
      li.append(extra);
    }
    const help = RULE_HELP[p.code];
    li.title = help ? `${help.title}\n\n${help.why}\n\nFix: ${help.fix}` : 'Show in editor';
    li.addEventListener('click', () => {
      const line = lineOf(p);
      if (p.component && state.result?.scene.instances.has(p.component)) select(p.component);
      if (line) gotoLine(line);
    });
    list.append(li);
  }
}

// ---------------------------------------------------------------- editor
function updateGutter(errors = []) {
  const n = state.text.split('\n').length;
  const bad = new Set(errors.filter((e) => e.line).map((e) => e.line));
  for (const e of errors) if (!e.line) { const l = lineOf(e); if (l) bad.add(l); }
  let html = '';
  for (let i = 1; i <= n; i++) html += bad.has(i) ? `<span class="err">${i}</span>\n` : `${i}\n`;
  gutter.innerHTML = html;
  gutter.scrollTop = textarea.scrollTop;
}

function gotoLine(line) {
  const lines = state.text.split('\n');
  const start = lines.slice(0, line - 1).reduce((a, l) => a + l.length + 1, 0);
  textarea.focus();
  textarea.setSelectionRange(start, start + (lines[line - 1] || '').length);
  textarea.scrollTop = Math.max(0, (line - 5) * 20);
}

function setText(text, { record = true, fit = false } = {}) {
  state.text = text;
  if (textarea.value !== text) textarea.value = text;
  if (record) history.push(text);
  update({ fit });
  syncToolbar();
}

function setCircuit(circuit, opts) {
  setText(formatJSON(circuit) + '\n', opts);
}

let typingTimer = 0, historyTimer = 0;
textarea.addEventListener('input', () => {
  state.text = textarea.value;
  clearTimeout(typingTimer);
  clearTimeout(historyTimer);
  typingTimer = setTimeout(() => update(), 180);
  historyTimer = setTimeout(() => { history.push(state.text); syncToolbar(); }, 600);
  updateGutter();
});
textarea.addEventListener('scroll', () => { gutter.scrollTop = textarea.scrollTop; });
textarea.addEventListener('keydown', (e) => {
  if (e.key === 'Tab' && !e.ctrlKey && !e.metaKey) {
    e.preventDefault();
    document.execCommand('insertText', false, '  ');
  }
});

// ---------------------------------------------------------------- selection / inspector
const typeSelect = $('#inspector-form select[name=type]');
{
  const byCat = {};
  for (const t of listTypes()) (byCat[t.category] ||= []).push(t);
  for (const [cat, types] of Object.entries(byCat)) {
    const g = document.createElement('optgroup');
    g.label = cat[0].toUpperCase() + cat.slice(1);
    for (const t of types.sort((a, b) => a.name.localeCompare(b.name))) g.append(new Option(`${t.name}`, t.type));
    typeSelect.append(g);
  }
}

function select(id) {
  state.selected = id;
  canvas.select(id);
  $('#inspector').hidden = !id;
  if (id) fillInspector();
  syncToolbar();
}

function fillInspector() {
  const comp = state.circuit?.components?.find((c) => c.id === state.selected);
  const I = state.result?.scene.instances.get(state.selected);
  if (!comp || !I) return;
  const f = $('#inspector-form');
  f.id.value = comp.id;
  f.type.value = I.part.sym.type;
  f.value.value = comp.value ?? '';
  f.label.value = comp.label ?? '';
  f.rotation.value = comp.rotation !== undefined ? String(comp.rotation) : '';
  f.mirror.checked = !!comp.mirror;
  const sym = I.part.sym;
  const note = explainType(sym.type);
  const pinHelp = new Map((note?.pins || []).map((p) => [p.name, p]));
  $('#inspector-pins').innerHTML = '<b>Pins</b><br>' + sym.pinOrder.map((p) => {
    const h = pinHelp.get(p);
    return `<code title="${esc(h?.note || h?.electrical || '')}">${esc(p)}</code>`;
  }).join('');
  const box = $('#inspector-edu');
  if (note && (note.purpose || note.formulas.length)) {
    box.hidden = false;
    box.innerHTML = `<b>${esc(note.name)}</b>`
      + (note.purpose ? `<p>${esc(note.purpose)}</p>` : '')
      + (note.formulas.length ? `<p class="formula">${note.formulas.map(esc).join('<br>')}</p>` : '')
      + (note.mistakes.length ? `<p class="watch">Watch out: ${esc(note.mistakes[0])}</p>` : '')
      + '<button type="button" class="btn btn-sm" data-action="learn">Learn more</button>';
  } else box.hidden = true;
}

$('#inspector-form').addEventListener('change', (e) => {
  const f = e.currentTarget;
  const id = state.selected;
  if (!id || !state.circuit) return;
  const name = e.target.name;
  let c = state.circuit;
  if (name === 'id') {
    const next = f.id.value.trim();
    if (!next || /[.\s]/.test(next)) return toast('IDs cannot be empty or contain dots/spaces.', true);
    if (next !== id && c.components.some((x) => x.id === next)) return toast(`ID "${next}" is already used.`, true);
    c = renameComponent(c, id, next);
    state.selected = next;
  } else if (name === 'rotation') {
    c = updateComponent(c, id, { rotation: f.rotation.value === '' ? undefined : Number(f.rotation.value) });
  } else if (name === 'mirror') {
    c = updateComponent(c, id, { mirror: f.mirror.checked || undefined });
  } else if (name === 'type' || name === 'value' || name === 'label') {
    c = updateComponent(c, id, { [name]: f[name].value });
  } else return;
  setCircuit(c);
  select(state.selected);
});
$('#inspector-form').addEventListener('submit', (e) => e.preventDefault());

// ---------------------------------------------------------------- drag
const snapStep = () => (state.snap ? 20 : 10);
function onDragMove(id, dx, dy) {
  const scene = state.result?.scene;
  if (!scene || !state.circuit) return;
  if (!state.drag || state.drag.id !== id) {
    state.drag = { id, base: scene.instances, circuit: state.circuit, start: { x: scene.instances.get(id).x, y: scene.instances.get(id).y }, last: null };
  }
  const d = state.drag;
  const step = snapStep();
  const x = Math.round((d.start.x + dx) / step) * step;
  const y = Math.round((d.start.y + dy) / step) * step;
  if (d.last && d.last.x === x && d.last.y === y) return;
  d.last = { x, y };
  d.pending = pinLayout(d.circuit, d.base, { [id]: { x, y } });
  if (!d.raf) d.raf = requestAnimationFrame(() => {
    d.raf = 0;
    const r = render(d.pending, { theme: isDark() ? 'dark' : 'light', background: null, interactive: true, bridges: state.bridges });
    if (r.valid) { canvas.setSVG(r.svg, r.viewBox); state.liveResult = r; }
  });
}
function onDragEnd(id, cancelled) {
  const d = state.drag;
  state.drag = null;
  if (!d) return;
  if (d.raf) cancelAnimationFrame(d.raf);
  if (cancelled || !d.pending || (d.last.x === d.start.x && d.last.y === d.start.y)) return update();
  setCircuit(d.pending);
}

// ---------------------------------------------------------------- commands
function rotateSelected() {
  if (!state.selected || !state.result) return;
  setCircuit(rotateComponent(state.circuit, state.result.scene.instances, state.selected));
}
function deleteSelected() {
  if (!state.selected || !state.circuit) return;
  const id = state.selected;
  select(null);
  setCircuit(deleteComponent(state.circuit, id));
  toast(`Deleted ${id}`);
}
function undo() { const t = history.undo(); if (t !== null) setText(t, { record: false }); }
function redo() { const t = history.redo(); if (t !== null) setText(t, { record: false }); }
function toggle(key) {
  state[key] = !state[key];
  store.set(`cf-${key}`, state[key] ? '1' : '0');
  if (key === 'grid') canvasEl.classList.toggle('grid-on', state.grid);
  syncToolbar();
  update();
}
function syncToolbar() {
  $$('[data-tool=undo]').forEach((b) => (b.disabled = !history.canUndo));
  $$('[data-tool=redo]').forEach((b) => (b.disabled = !history.canRedo));
  $$('.toolbar [data-tool=rotate], .toolbar [data-tool=delete]').forEach((b) => (b.disabled = !state.selected));
  for (const k of ['grid', 'snap', 'bridges']) $(`[data-tool=${k}]`).setAttribute('aria-pressed', String(state[k]));
}

const tools = {
  undo, redo,
  rotate: rotateSelected,
  delete: deleteSelected,
  autolayout: () => { if (state.circuit) { setCircuit(clearLayout(state.circuit), { fit: true }); toast('Automatic layout restored'); } },
  grid: () => toggle('grid'),
  snap: () => toggle('snap'),
  bridges: () => toggle('bridges'),
  'zoom-in': () => canvas.zoomAt(1.25),
  'zoom-out': () => canvas.zoomAt(0.8),
  'zoom-reset': () => canvas.zoomTo(1),
  fit: () => canvas.fit(),
};
document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-tool]');
  if (t && tools[t.dataset.tool]) tools[t.dataset.tool]();
});

document.addEventListener('keydown', (e) => {
  const mod = e.ctrlKey || e.metaKey;
  const inField = e.target.closest?.('input, textarea, select');
  if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
  if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
  if (e.key === 'Escape') { closeMenus(); if (!inField) select(null); return; }
  if (inField || mod || e.altKey) return;
  if (e.key === ' ') { canvas.spaceDown = true; }
  const map = { Delete: 'delete', Backspace: 'delete', r: 'rotate', R: 'rotate', f: 'fit', F: 'fit', g: 'grid', G: 'grid', s: 'snap', S: 'snap', '+': 'zoom-in', '=': 'zoom-in', '-': 'zoom-out', '0': 'zoom-reset' };
  if (map[e.key]) { e.preventDefault(); tools[map[e.key]](); }
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
  b.innerHTML = `<span class="num">${i ? i : '\u2605'}</span><span></span>`;
  b.lastChild.textContent = s.title;
  b.addEventListener('click', () => { closeMenus(); loadCircuit(s); });
  examplesMenu.append(b);
});

function loadCircuit(c) {
  select(null);
  setCircuit(c, { fit: true });
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
  select(null);
  setText(text, { fit: true });
  toast(`Opened ${f.name}`);
}
document.addEventListener('dragover', (e) => e.preventDefault());
document.addEventListener('drop', (e) => {
  e.preventDefault();
  const f = e.dataTransfer?.files?.[0];
  if (f) openFile(f);
});

const actions = {
  new: () => loadCircuit(EMPTY_CIRCUIT),
  open: () => fileInput.click(),
  format: () => {
    const p = parseJSON(state.text);
    if (p.errors.length) return toast('Fix the JSON syntax error first.', true);
    setCircuit(p.value);
  },
  api: () => $('#api-dialog').showModal(),
  library: () => { buildLibrary(); $('#library-dialog').showModal(); $('#library-search').focus(); },
  theme: () => {
    const next = isDark() ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    store.set('cf-theme', next);
    update();
  },
  deselect: () => select(null),
  'load-first-sample': () => loadCircuit(EXAMPLES[1] || EXAMPLES[0]),
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
  if (!r.valid) throw new Error('Fix the circuit errors before exporting.');
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

// ---------------------------------------------------------------- component library
let libraryBuilt = false;
function buildLibrary() {
  if (libraryBuilt) return;
  libraryBuilt = true;
  const body = $('#library-body');
  const cats = { passive: 'Passive', semiconductor: 'Semiconductor', analog: 'Analog', digital: 'Digital', ic: 'IC / MCU', power: 'Power & connection' };
  const byCat = {};
  for (const t of listTypes()) (byCat[t.category] ||= []).push(t);
  for (const [cat, label] of Object.entries(cats)) {
    if (!byCat[cat]) continue;
    const sec = document.createElement('section');
    sec.className = 'lib-cat';
    sec.innerHTML = `<h3>${label}</h3><div class="lib-grid"></div>`;
    for (const t of byCat[cat]) {
      const sym = resolveSymbol({ type: t.type });
      const b = document.createElement('button');
      b.className = 'lib-item';
      b.dataset.search = [t.type, t.name, ...t.aliases].join(' ').toLowerCase();
      b.title = `Pins: ${sym.pinOrder.join(', ')}`;
      const preview = sym.svgBody
        ? `<svg viewBox="-4 -4 ${sym.width + 8} ${sym.height + 8}" width="${Math.min(120, sym.width + 8)}" height="52">${sym.svgBody}</svg>`
        : `<svg viewBox="0 0 60 20" width="60" height="52"><text x="30" y="14" text-anchor="middle" font-size="10" fill="currentColor">${t.type === 'junction' ? '●' : 'NET'}</text></svg>`;
      b.innerHTML = `${preview}<span class="n"></span><span class="t"></span>`;
      b.querySelector('.n').textContent = t.name;
      b.querySelector('.t').textContent = t.type;
      b.addEventListener('click', () => {
        if (!state.circuit) return toast('Fix the JSON syntax error first.', true);
        const { circuit, id } = addComponent(state.circuit, t.type);
        $('#library-dialog').close();
        setCircuit(circuit);
        select(id);
        toast(`Added ${id}. Connect it in "connections" (pins: ${sym.pinOrder.join(', ')})`);
      });
      sec.lastChild.append(b);
    }
    body.append(sec);
  }
}
$('#library-search').addEventListener('input', (e) => {
  const q = e.target.value.trim().toLowerCase();
  $$('.lib-item').forEach((b) => (b.hidden = q && !b.dataset.search.includes(q)));
  $$('.lib-cat').forEach((s) => (s.hidden = !$$('.lib-item', s).some((b) => !b.hidden)));
});

// ---------------------------------------------------------------- learn dialog
function showLearn() {
  const info = explainCircuit(state.circuit || {}, state.findings || []);
  const list = (title, items) => (items && items.length ? `<h3>${title}</h3><ul>${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>` : '');
  const parts = info.components.map((c) => `<details><summary>${esc(c.name)} <span class="t">${esc(c.type)}</span></summary>`
    + (c.purpose ? `<p>${esc(c.purpose)}</p>` : '')
    + (c.explanation ? `<p>${esc(c.explanation)}</p>` : '')
    + (c.formulas.length ? `<p class="formula">${c.formulas.map(esc).join('<br>')}</p>` : '')
    + (c.truthTable ? `<table class="tt"><tr>${c.truthTable.inputs.map((i) => `<th>${esc(i)}</th>`).join('')}<th>Y</th></tr>`
        + c.truthTable.rows.map((r) => `<tr>${r.map((v) => `<td>${v}</td>`).join('')}</tr>`).join('') + '</table>' : '')
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
  toastTimer = setTimeout(() => (t.hidden = true), isError ? 4000 : 2200);
}

// ---------------------------------------------------------------- boot
canvasEl.classList.toggle('grid-on', state.grid);
const initial = store.get('cf-last');
if (initial && initial.trim()) setText(initial, { fit: true });
else setCircuit(EXAMPLES[1] || EXAMPLES[0], { fit: true });
syncToolbar();
