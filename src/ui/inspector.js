// The properties panel: edit the selected part (or act on several at once).
import { explainType, listTypes } from '../engine.js';
import { renameComponent, updateComponent, pinLayout, disconnectPin } from '../editor/model.js';
import { parseValue, formatValue } from '../utils/units.js';
import { VALUE_UNITS } from '../validator/electrical.js';
import { describeIds } from '../editor/selection.js';
import { state, $, esc } from './state.js';

export function initInspector(app) {
  const form = $('#inspector-form');
  const typeSelect = $('select[name=type]', form);
  {
    const byCat = {};
    for (const t of listTypes()) (byCat[t.category] ||= []).push(t);
    for (const [cat, types] of Object.entries(byCat)) {
      const g = document.createElement('optgroup');
      g.label = cat.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
      for (const t of types.sort((a, b) => a.name.localeCompare(b.name))) g.append(new Option(t.name, t.type));
      typeSelect.append(g);
    }
  }

  const msg = (id, text, level = '') => {
    const el = $(id);
    el.textContent = text || '';
    el.hidden = !text;
    el.dataset.level = level;
  };

  // "= 4.7 kΩ" under the value field, or a hint when it is not a number.
  function valueHint(type, raw) {
    const spec = VALUE_UNITS[type];
    if (!spec || !raw) return msg('#value-msg', '');
    const first = String(raw).trim().split(/[\s/;(]+/)[0];
    const v = parseValue(first);
    if (v !== null) return msg('#value-msg', `= ${formatValue(v, spec[0])}`, 'ok');
    if (/^[+-]?[\d.]/.test(first)) return msg('#value-msg', /^[+-]?\d+,\d/.test(first) ? 'Use a decimal point, not a comma.' : `Not a number the checks can read. Try ${spec[1]}.`, 'warn');
    msg('#value-msg', ''); // symbolic value such as "Rx": fine
  }

  function netLabel(I, pin) {
    const scene = app.scene();
    const id = I.part.pinNets[pin];
    if (!id) return { id: null, text: 'not connected', count: 0 };
    const net = scene.netlist.nets.get(id);
    return { id, text: net.name || (net.rail ? net.rail.name : id), count: net.pins.length };
  }

  function fill() {
    const scene = app.scene();
    const ids = state.selection;
    const panel = $('#inspector');
    panel.hidden = !ids.length || !scene;
    if (panel.hidden) return;
    const single = ids.length === 1;
    $('#inspector-title').textContent = single ? ids[0] : describeIds(ids);
    form.hidden = !single;
    $('#inspector-multi').hidden = single;
    if (!single) {
      $('#inspector-multi-info').textContent = `${ids.length} parts selected. Drag any of them to move the group; shift-click or drag a box (shift + drag) to change the selection.`;
      return;
    }
    const comp = state.circuit?.components?.find((c) => c && c.id === ids[0]);
    const I = scene.instances.get(ids[0]);
    if (!comp || !I) return;
    // never rewrite the field the user is typing in
    const active = document.activeElement;
    const editing = active && form.contains(active) ? active.name : null;
    const set = (name, v) => { if (editing !== name) form[name].value = v; };
    set('id', comp.id);
    set('type', I.part.sym.type);
    set('value', comp.value ?? '');
    set('label', comp.label ?? '');
    set('rotation', comp.rotation ?? comp.angle ?? '');
    form.mirror.checked = !!comp.mirror;
    set('x', comp.position ? comp.position.x : Math.round(I.x));
    set('y', comp.position ? comp.position.y : Math.round(I.y));
    form.x.placeholder = form.y.placeholder = 'auto';
    msg('#id-msg', '');
    valueHint(I.part.sym.type, comp.value);

    const sym = I.part.sym;
    const note = explainType(sym.type);
    const pinHelp = new Map((note?.pins || []).map((p) => [p.name, p]));
    const rows = sym.pinOrder.map((pin) => {
      const h = pinHelp.get(pin);
      const n = netLabel(I, pin);
      const title = esc(h?.note || h?.electrical || '');
      return `<div class="pin-row"><code title="${title}">${esc(pin)}</code>`
        + (n.id ? `<button type="button" class="net-btn" data-net="${esc(n.id)}" title="Highlight this net (${n.count} pin${n.count === 1 ? '' : 's'})">${esc(n.text)}</button>`
          + `<button type="button" class="pin-x" data-disconnect="${esc(`${I.id}.${pin}`)}" title="Disconnect ${esc(`${I.id}.${pin}`)}" aria-label="Disconnect ${esc(pin)}">×</button>`
          : `<span class="nc">not connected</span>`)
        + '</div>';
    }).join('');
    $('#inspector-pins').innerHTML = `<b>Pins</b>${rows}`;

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

  // Form edits become undoable steps; edits to the same field within a moment merge.
  form.addEventListener('change', (e) => {
    const id = state.selection[0];
    if (state.selection.length !== 1 || !state.circuit) return;
    const name = e.target.name;
    let c = state.circuit;
    let label, key = `field:${name}:${id}`;
    if (name === 'id') {
      const next = form.id.value.trim();
      if (!next || /[.\s]/.test(next)) return msg('#id-msg', 'IDs cannot be empty or contain dots or spaces.', 'error');
      if (next !== id && c.components.some((x) => x && x.id === next)) return msg('#id-msg', `"${next}" is already used.`, 'error');
      if (next === id) return;
      c = renameComponent(c, id, next);
      label = `Rename ${id} to ${next}`;
      key = null;
      app.commit(c, { label, key, select: [next] });
      return;
    }
    if (name === 'rotation') { c = updateComponent(c, id, { rotation: form.rotation.value === '' ? undefined : Number(form.rotation.value), angle: undefined }); label = `Rotate ${id}`; }
    else if (name === 'mirror') { c = updateComponent(c, id, { mirror: form.mirror.checked || undefined }); label = `Mirror ${id}`; key = null; }
    else if (name === 'x' || name === 'y') {
      const x = Number(form.x.value), y = Number(form.y.value);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      c = pinLayout(c, app.scene().instances, { [id]: { x: Math.round(x / 10) * 10, y: Math.round(y / 10) * 10 } });
      label = `Move ${id}`;
    } else if (name === 'type' || name === 'value' || name === 'label') { c = updateComponent(c, id, { [name]: form[name].value }); label = `Edit ${name} of ${id}`; }
    else return;
    app.commit(c, { label, key, select: [id] });
  });

  form.addEventListener('input', (e) => {
    if (e.target.name === 'value') valueHint(form.type.value, e.target.value);
    if (e.target.name === 'id') {
      const next = form.id.value.trim();
      const taken = next !== state.selection[0] && state.circuit?.components?.some((x) => x && x.id === next);
      msg('#id-msg', /[.\s]/.test(next) ? 'No dots or spaces.' : taken ? `"${next}" is already used.` : '', 'error');
    }
  });
  form.addEventListener('submit', (e) => e.preventDefault());

  // pin rows: highlight a net, or take one pin out of it
  $('#inspector-pins').addEventListener('click', (e) => {
    const net = e.target.closest('[data-net]');
    if (net) return app.setNet(net.dataset.net);
    const x = e.target.closest('[data-disconnect]');
    if (x) {
      const ref = x.dataset.disconnect;
      app.commit(disconnectPin(state.circuit, ref), { label: `Disconnect ${ref}`, key: null, select: state.selection });
      app.toast(`Disconnected ${ref}`);
    }
  });

  return { fill };
}
