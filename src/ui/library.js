// The Components dialog: every part type with a preview, searchable by name,
// type or alias. Clicking one drops it in the middle of the view.
import { listTypes } from '../engine.js';
import { resolveSymbol } from '../symbol-loader/index.js';
import { $, $$ } from './state.js';

const CATEGORIES = {
  passive: 'Passive', semiconductor: 'Semiconductor', analog: 'Analog', digital: 'Digital', ic: 'ICs and modules',
  board: 'Boards', sensor: 'Sensors', output_device: 'Output devices', display: 'Displays', electromechanical: 'Electromechanical',
  connector: 'Connectors', measurement: 'Measurement', power: 'Power and connections',
};

export function initLibrary(app, commands) {
  let built = false;

  function build() {
    if (built) return;
    built = true;
    const body = $('#library-body');
    const byCat = {};
    for (const t of listTypes()) (byCat[t.category] ||= []).push(t);
    // known categories first, in a sensible order; anything new is still listed
    const order = [...Object.keys(CATEGORIES), ...Object.keys(byCat).filter((c) => !CATEGORIES[c])];
    for (const cat of order) {
      if (!byCat[cat]) continue;
      const sec = document.createElement('section');
      sec.className = 'lib-cat';
      sec.innerHTML = '<h3></h3><div class="lib-grid"></div>';
      sec.querySelector('h3').textContent = CATEGORIES[cat] || cat;
      for (const t of byCat[cat].sort((a, b) => a.name.localeCompare(b.name))) {
        const sym = resolveSymbol({ type: t.type });
        const b = document.createElement('button');
        b.className = 'lib-item';
        b.dataset.search = [t.type, t.name, ...t.aliases].join(' ').toLowerCase();
        b.dataset.type = t.type;
        b.title = `Pins: ${sym.pinOrder.join(', ')}`;
        const preview = sym.svgBody
          ? `<svg viewBox="-4 -4 ${sym.width + 8} ${sym.height + 8}" width="${Math.min(120, sym.width + 8)}" height="52">${sym.svgBody}</svg>`
          : `<svg viewBox="0 0 60 20" width="60" height="52"><text x="30" y="14" text-anchor="middle" font-size="10" fill="currentColor">${t.type === 'junction' ? '●' : 'NET'}</text></svg>`;
        b.innerHTML = `${preview}<span class="n"></span><span class="t"></span>`;
        b.querySelector('.n').textContent = t.name;
        b.querySelector('.t').textContent = t.type;
        b.addEventListener('click', () => add(t.type));
        sec.lastChild.append(b);
      }
      body.append(sec);
    }
  }

  function add(type) {
    const sym = resolveSymbol({ type });
    // close first: a modal dialog sits above the toast that explains a refusal
    $('#library-dialog').close();
    if (!app.sync()) return;
    const id = commands.addPart(type);
    if (id) app.toast(`Added ${id}. Connect it with the wire tool (W) or in "connections" (pins: ${sym.pinOrder.slice(0, 8).join(', ')}${sym.pinOrder.length > 8 ? ', …' : ''})`);
  }

  function filter(q) {
    q = q.trim().toLowerCase();
    $$('.lib-item').forEach((b) => (b.hidden = !!q && !b.dataset.search.includes(q)));
    $$('.lib-cat').forEach((s) => (s.hidden = !$$('.lib-item', s).some((b) => !b.hidden)));
  }

  const search = $('#library-search');
  search.addEventListener('input', (e) => filter(e.target.value));
  // Enter adds the first match, so a part can be found and placed from the keyboard
  search.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    // closing the dialog hands focus back to the "Components" button: without this the
    // same Enter would then press it and open the dialog again
    e.preventDefault();
    const first = $$('.lib-item').find((b) => !b.hidden);
    if (first) add(first.dataset.type);
  });

  return {
    open() { build(); search.value = ''; filter(''); $('#library-dialog').showModal(); search.focus(); },
  };
}
