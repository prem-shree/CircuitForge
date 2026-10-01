// Drives the built app (dist/index.html, over file://) in headless Chromium and
// checks the interactions the unit tests cannot reach: selection, dragging, the
// wire tool, undo/redo, the inspector, quick fixes, the component library, export.
//
//   npm run smoke            (builds first)
//
// Playwright is deliberately not a dependency of this project. Install it where
// you want to run the checks:  npm i --no-save playwright && npx playwright install chromium
// Without it the script says so and exits 0.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { gateNetwork } from '../tests/helpers.js';

async function loadPlaywright() {
  try { return await import('playwright'); } catch { /* try the global install below */ }
  try {
    const root = (await import('node:child_process')).execSync('npm root -g', { encoding: 'utf8' }).trim();
    return createRequire(path.join(root, 'x.js'))('playwright');
  } catch { return null; }
}

const pw = await loadPlaywright();
if (!pw) {
  console.log('UI smoke test skipped: Playwright is not installed (npm i --no-save playwright && npx playwright install chromium).');
  process.exit(0);
}
const { chromium } = pw.chromium ? pw : pw.default;

const dist = path.resolve('dist/index.html');
if (!fs.existsSync(dist)) { console.error('dist/index.html is missing: run `npm run build` first.'); process.exit(1); }
const URL = pathToFileURL(dist).href;
const example = (name) => fs.readFileSync(path.resolve('examples', name), 'utf8');

const browser = await chromium.launch();
const problems = [];
let passed = 0, failed = 0;
const check = (name, ok, detail = '') => {
  if (ok) passed++; else { failed++; problems.push(`${name}${detail ? ` (${detail})` : ''}`); }
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !detail ? '' : `  -> ${detail}`}`);
};

// A fresh page with `json` already in local storage, so the app opens on it.
async function open(json, { svg = true } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 850 }, acceptDownloads: true, hasTouch: true });
  await ctx.addInitScript((j) => { try { localStorage.setItem('cf-last', j); localStorage.setItem('cf-theme', 'light'); } catch { /* no storage */ } }, json);
  const page = await ctx.newPage();
  // the page's own errors matter; a blocked web font in an offline sandbox does not
  page.on('pageerror', (e) => problems.push(`page error: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/ERR_CERT|Failed to load resource/.test(m.text())) problems.push(`console error: ${m.text()}`); });
  await page.goto(URL);
  await page.waitForSelector(svg ? '#viewport svg' : '#problems-list li');
  return { page, ctx };
}
const text = (page) => page.inputValue('#json');
const doc = async (page) => JSON.parse(await text(page));
const centre = async (page, sel) => { const b = await page.locator(sel).first().boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
const selected = (page) => page.locator('.cf-part.selected').count();

// ---------------------------------------------------------------- selection
{
  const { page } = await open(example('08-bjt-amplifier.json'));
  const parts = await page.locator('.cf-part').count();
  check('the example draws', parts >= 6);
  let c = await centre(page, '.cf-part[data-id="R1"]');
  await page.mouse.click(c.x, c.y);
  check('click selects a part and opens the inspector', (await selected(page)) === 1 && (await page.textContent('#inspector-title')) === 'R1');
  const c2 = await centre(page, '.cf-part[data-id="R2"]');
  await page.keyboard.down('Shift'); await page.mouse.click(c2.x, c2.y); await page.keyboard.up('Shift');
  check('shift-click adds to the selection', (await selected(page)) === 2 && await page.locator('#inspector-multi').isVisible());
  await page.keyboard.down('Shift'); await page.mouse.click(c2.x, c2.y); await page.keyboard.up('Shift');
  check('shift-click again removes it', (await selected(page)) === 1);
  await page.keyboard.press('Escape');
  check('Escape clears the selection', (await selected(page)) === 0);

  const box = await page.locator('#canvas').boundingBox();
  await page.keyboard.down('Shift');
  await page.mouse.move(box.x + 30, box.y + 30); await page.mouse.down();
  await page.mouse.move(box.x + box.width - 30, box.y + box.height - 100, { steps: 6 });
  check('the marquee shows while dragging', await page.locator('.marquee').isVisible());
  await page.mouse.up(); await page.keyboard.up('Shift');
  check('the marquee selects what it touches', (await selected(page)) === parts, `${await selected(page)} of ${parts}`);
  await page.keyboard.press('Escape');

  // ------------------------------------------------------------ move, undo, redo
  const before = await text(page);
  c = await centre(page, '.cf-part[data-id="R1"]');
  await page.mouse.move(c.x, c.y); await page.mouse.down(); await page.mouse.move(c.x + 60, c.y + 40, { steps: 8 }); await page.mouse.up();
  const moved = await text(page);
  check('dragging writes position into the JSON', /"position"/.test(moved) && !/"position"/.test(before));
  await page.keyboard.press('Control+z');
  check('undo restores the JSON exactly', (await text(page)) === before);
  check('the toast names the undone action', /Undid Move R1/.test(await page.textContent('#toast')));
  await page.keyboard.press('Control+y');
  check('redo replays it', (await text(page)) === moved);
  await page.keyboard.press('Control+z');

  // ------------------------------------------------------------ keyboard editing
  await page.keyboard.press('Escape');
  c = await centre(page, '.cf-part[data-id="Q1"]');
  await page.mouse.click(c.x, c.y);
  await page.keyboard.press('r');
  check('R rotates the selection', /"rotation": 90/.test(await text(page)));
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Control+z');
  check('repeated nudges are a single undo step', /"rotation": 90/.test(await text(page)));
  await page.keyboard.press('m');
  check('M flips the part', /"mirror": true/.test(await text(page)));
  const n = (await doc(page)).components.length;
  await page.keyboard.press('Control+d');
  check('Ctrl+D duplicates and selects the copy', (await doc(page)).components.length === n + 1 && (await selected(page)) === 1);
  await page.keyboard.press('Delete');
  check('Delete removes it', (await doc(page)).components.length === n);
  await page.keyboard.press('Control+a');
  check('Ctrl+A selects everything', (await selected(page)) === parts);
  await page.keyboard.press('Escape');

  // ------------------------------------------------------------ inspector
  c = await centre(page, '.cf-part[data-id="R1"]');
  await page.mouse.click(c.x, c.y);
  await page.fill('#inspector-form [name=value]', '4,7k');
  check('a comma decimal is flagged as you type', /decimal point/.test(await page.textContent('#value-msg')));
  await page.fill('#inspector-form [name=value]', '4.7k');
  check('a good value shows what it means', /4\.7\s?kΩ/.test(await page.textContent('#value-msg')));
  await page.press('#inspector-form [name=value]', 'Enter');
  await page.locator('#inspector-form [name=label]').focus();
  check('the value lands in the JSON', /"value": "4\.7k"/.test(await text(page)));
  await page.fill('#inspector-form [name=id]', 'R2');
  check('a duplicate id is flagged inline', /already used/.test(await page.textContent('#id-msg')));
  await page.fill('#inspector-form [name=id]', 'R9');
  await page.locator('#inspector-form [name=label]').focus();
  check('renaming rewrites the connections', /"R9\.1"/.test(await text(page)) && !/"R1\./.test(await text(page)));

  // ------------------------------------------------------------ nets
  await page.keyboard.press('Escape');
  const pt = await page.locator('.cf-wire-hit').first().evaluate((el) => {
    const p = el.getPointAtLength(el.getTotalLength() / 2); const m = el.getScreenCTM();
    return { x: m.a * p.x + m.c * p.y + m.e, y: m.b * p.x + m.d * p.y + m.f };
  });
  await page.mouse.click(pt.x, pt.y);
  check('clicking a wire highlights its net', (await page.locator('#wires path.net-hl').count()) >= 1 && /Net /.test(await page.textContent('#status-sel')));
  await page.keyboard.press('Escape');
  check('Escape clears the highlight', (await page.locator('#wires path.net-hl').count()) === 0);

  // ------------------------------------------------------------ typing, clipboard, navigation
  await page.evaluate(() => { const t = document.querySelector('#json'); t.value = t.value.replace('"Common-Emitter BJT Amplifier"', '"Edited"'); t.dispatchEvent(new Event('input')); });
  const edited = await text(page);
  await page.keyboard.press('Control+z');
  check('undo straight after typing undoes the typing', (await text(page)) !== edited && !/"Edited"/.test(await text(page)));
  await page.keyboard.press('Control+y');

  await page.locator('#canvas').focus();
  c = await centre(page, '.cf-part[data-id="RE"]');
  await page.mouse.click(c.x, c.y);
  await page.keyboard.press('Control+c');
  const n0 = (await doc(page)).components.length;
  await page.keyboard.press('Control+v');
  check('copy and paste add a part', (await doc(page)).components.length === n0 + 1 && (await selected(page)) === 1);
  await page.keyboard.press('Control+x');
  check('cut removes it again', (await doc(page)).components.length === n0);
  await page.keyboard.press('Escape');
  await page.locator('#canvas').focus();
  await page.keyboard.press('Tab');
  const first = await page.textContent('#inspector-title');
  await page.keyboard.press('Tab');
  check('Tab walks through the parts', first !== (await page.textContent('#inspector-title')));
  await page.keyboard.press('f');
  const fit = await page.textContent('#zoom-label');
  await page.keyboard.press('z');
  check('Z zooms to the selection, F fits again', (await page.textContent('#zoom-label')) !== fit);
  await page.keyboard.press('Escape');
  await page.keyboard.press('?');
  check('? opens the shortcut list', (await page.locator('#help-dialog[open]').count()) === 1);
  await page.keyboard.press('Escape');

  // ------------------------------------------------------------ export
  const [download] = await Promise.all([page.waitForEvent('download'), (async () => { await page.click('[data-menu=export]'); await page.click('[data-export=svg]'); })()]);
  const svg = fs.readFileSync(await download.path(), 'utf8');
  check('exported SVG has no editor hit-targets', svg.startsWith('<svg') && !/cf-wire-hit|cf-pin|sel-box|cf-ghost/.test(svg));
  await page.context().close();
}

// ---------------------------------------------------------------- wire tool
{
  const loose = JSON.stringify({ components: [{ id: 'V1', type: 'dc_source', value: '5V' }, { id: 'R1', type: 'resistor' }, { id: 'R2', type: 'resistor' }, { id: 'GND', type: 'ground' }], connections: [['V1.positive', 'R1.1'], ['V1.negative', 'GND']] });
  const { page } = await open(loose);
  const pin = async (ref) => centre(page, `.cf-pin[data-ref="${ref}"]`);
  await page.keyboard.press('w');
  check('W switches to the wire tool', (await page.getAttribute('[data-tool=wire]', 'aria-pressed')) === 'true');
  let a = await pin('R1.2'), b = await pin('R2.1');
  await page.mouse.click(a.x, a.y);
  check('the first click starts a wire', /R1\.2/.test(await page.textContent('#status-hint')) && (await page.locator('.cf-wire-preview').count()) === 1);
  await page.mouse.move(b.x, b.y, { steps: 4 });
  await page.mouse.click(b.x, b.y);
  check('the second click connects the pins', JSON.stringify((await doc(page)).connections).includes('["R1.2","R2.1"]'));
  a = await pin('R1.2'); b = await pin('R2.1');
  await page.mouse.click(a.x, a.y); await page.mouse.click(b.x, b.y);
  check('pins already on one net are refused', /already on the same net/.test(await page.textContent('#toast')));
  await page.keyboard.press('Escape');
  await page.keyboard.press('Control+z');
  check('wiring is undoable', !JSON.stringify((await doc(page)).connections).includes('R1.2'));

  const { page: p2 } = await open(JSON.stringify({ components: [{ id: 'R1', type: 'resistor' }, { id: 'R2', type: 'resistor' }, { id: 'R3', type: 'resistor' }], connections: [['R1.2', 'R2.1', 'R3.1']] }));
  const c = await centre(p2, '.cf-part[data-id="R2"]');
  await p2.mouse.click(c.x, c.y);
  await p2.click('#inspector-pins [data-disconnect="R2.1"]');
  check('the pin list disconnects one pin', JSON.stringify((await doc(p2)).connections) === '[["R1.2","R3.1"]]');
}

// ---------------------------------------------------------------- problems and quick fixes
{
  const { page } = await open(JSON.stringify({ components: [{ id: 'V1', type: 'dc_source', value: '5V' }, { id: 'R1', type: 'resistr', value: '1k' }], connections: [['V1.positve', 'R1.1'], ['R1.2', 'V1.negative']] }), { svg: false });
  check('errors come with quick-fix buttons', (await page.locator('#problems-list .fix').count()) === 2);
  check('the gutter marks the bad lines', (await page.locator('#gutter .err').count()) >= 1);
  await page.locator('#problems-list li', { hasText: 'Unknown component type' }).click();
  const sel = await page.evaluate(() => { const t = document.querySelector('#json'); return t.value.slice(t.selectionStart, t.selectionEnd); });
  check('clicking a problem selects its JSON', sel === '"resistr"', sel);
  await page.locator('#problems-list .fix', { hasText: 'resistor' }).click();
  await page.locator('#problems-list .fix', { hasText: 'positive' }).click();
  check('applying both fixes clears the problems and draws the circuit', /No problems/.test(await page.textContent('#problems-list')) && (await page.locator('.cf-part').count()) === 2);

  // a design error is reported but the drawing is not thrown away
  const { page: d } = await open(JSON.stringify({ components: [{ id: 'V1', type: 'dc_source', value: '5V' }, { id: 'D1', type: 'diode' }, { id: 'GND', type: 'ground' }, { id: 'VCC', type: 'vcc', value: '5V' }], connections: [['VCC', 'D1.cathode'], ['D1.anode', 'GND'], ['V1.positive', 'VCC'], ['V1.negative', 'GND']] }));
  check('a design error still draws the circuit', /design error/.test(await d.textContent('#status-text')) && (await d.locator('.viewport.stale').count()) === 0);
}

// ---------------------------------------------------------------- library, examples, groups, large circuits
{
  const { page } = await open(example('01-led-resistor.json'));
  await page.click('[data-action=library]');
  const cats = await page.locator('.lib-cat h3').allTextContents();
  check('the library lists every category', ['Boards', 'Sensors', 'Displays', 'Connectors'].every((x) => cats.includes(x)));
  await page.fill('#library-search', 'thermistor');
  await page.press('#library-search', 'Enter');
  check('Enter adds the first match, selected', (await doc(page)).components.some((x) => x.type === 'thermistor') && (await selected(page)) === 1);

  await page.click('[data-menu=examples]');
  const items = await page.locator('#menu-examples button').allTextContents();
  check('the examples menu lists the newest circuits', items.some((t) => /BCD/.test(t)));
  await page.locator('#menu-examples button', { hasText: 'Adjustable' }).click();
  check('an example loads and draws', (await page.locator('.cf-part').count()) >= 8);
  await page.keyboard.press('Control+z');
  check('loading an example is undoable', !/Adjustable/.test(await text(page)));

  const client = await page.context().newCDPSession(page);
  await page.keyboard.press('f');
  const z0 = parseInt(await page.textContent('#zoom-label'), 10);
  const cb = await page.locator('#canvas').boundingBox();
  const mid = { x: cb.x + cb.width / 2, y: cb.y + cb.height / 2 };
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: mid.x - 40, y: mid.y, id: 1 }, { x: mid.x + 40, y: mid.y, id: 2 }] });
  for (let i = 1; i <= 6; i++) await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: mid.x - 40 - i * 15, y: mid.y, id: 1 }, { x: mid.x + 40 + i * 15, y: mid.y, id: 2 }] });
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  check('a two-finger pinch zooms', parseInt(await page.textContent('#zoom-label'), 10) > z0 * 1.5);

  const { page: g } = await open(example('08-bjt-amplifier.json'));
  const r1 = await centre(g, '.cf-part[data-id="R1"]'), r2 = await centre(g, '.cf-part[data-id="R2"]');
  await g.mouse.click(r1.x, r1.y);
  await g.keyboard.down('Shift'); await g.mouse.click(r2.x, r2.y); await g.keyboard.up('Shift');
  await g.mouse.move(r1.x, r1.y); await g.mouse.down(); await g.mouse.move(r1.x - 80, r1.y + 40, { steps: 6 }); await g.mouse.up();
  const moved = await doc(g);
  check('dragging one of a group moves all of it', !!moved.components.find((x) => x.id === 'R1').position && !!moved.components.find((x) => x.id === 'R2').position);
  check('and the group stays selected', (await selected(g)) === 2);
  await g.keyboard.press('Control+z');
  check('one undo reverts the whole move', !(await doc(g)).components.find((x) => x.id === 'R1').position);
  const before = await text(g);
  await g.mouse.move(r1.x, r1.y); await g.mouse.down(); await g.mouse.move(r1.x + 120, r1.y, { steps: 4 });
  await g.keyboard.press('Escape'); await g.mouse.up();
  check('Escape cancels a drag in progress', (await text(g)) === before);

  const { page: big } = await open(JSON.stringify(gateNetwork(80, 5)));
  await big.waitForTimeout(300);
  const c = await centre(big, '.cf-part[data-id="G10"]');
  await big.mouse.move(c.x, c.y); await big.mouse.down(); await big.mouse.move(c.x + 40, c.y + 20, { steps: 3 });
  check('a large circuit drags as a ghost with wires following', (await big.locator('svg.ghosting').count()) === 1 && (await big.locator('.cf-rope').count()) > 0);
  const t0 = Date.now();
  await big.mouse.move(c.x + 100, c.y + 60, { steps: 10 });
  check('and the drag stays responsive', Date.now() - t0 < 1500, `${Date.now() - t0} ms`);
  await big.mouse.up();
  await big.waitForTimeout(100);
  check('the real routing runs on release', /"position"/.test(await text(big)) && (await big.locator('svg.ghosting').count()) === 0);
}

// ---------------------------------------------------------------- regressions found in review
{
  // editing while the text does not parse must not overwrite what is being typed
  const { page } = await open(example('08-bjt-amplifier.json'));
  const c = await centre(page, '.cf-part[data-id="R1"]');
  await page.mouse.click(c.x, c.y);
  await page.evaluate(() => { const t = document.querySelector('#json'); t.value = '// my unsaved notes {{{'; t.dispatchEvent(new Event('input')); });
  await page.locator('#canvas').focus();
  await page.keyboard.press('r');
  check('an edit is refused while the JSON is invalid', /Fix the JSON syntax error/.test(await page.textContent('#toast')));
  check('and the text being typed is left alone', (await text(page)) === '// my unsaved notes {{{');

  // a pasted API envelope { "circuit": … } is editable and located
  const wrapped = JSON.stringify({ circuit: { components: [{ id: 'V1', type: 'dc_source', value: '5V' }, { id: 'R1', type: 'resistr' }], connections: [['V1.positive', 'R1.1'], ['R1.2', 'V1.negative']] } }, null, 2);
  const { page: w } = await open(wrapped, { svg: false });
  check('an envelope gets its quick fix', (await w.locator('#problems-list .fix').count()) >= 1);
  await w.locator('#problems-list .fix', { hasText: 'resistor' }).click();
  check('applying it works on the unwrapped circuit', /"type": "resistor"/.test(await text(w)) && (await w.locator('.cf-part').count()) === 2);

  // starting over works even when the current text is broken (that is when it is needed)
  const { page: n } = await open(example('01-led-resistor.json'));
  await n.evaluate(() => { const t = document.querySelector('#json'); t.value = '{ "components": ['; t.dispatchEvent(new Event('input')); });
  await n.click('[data-action=new]');
  check('New replaces invalid text', JSON.parse(await text(n)).components.length === 0);
  await n.evaluate(() => { const t = document.querySelector('#json'); t.value = '{ nope'; t.dispatchEvent(new Event('input')); });
  await n.click('[data-menu=examples]');
  await n.locator('#menu-examples button', { hasText: 'Voltage' }).first().click();
  check('and so does loading an example', /Voltage/.test(await text(n)) && (await n.locator('.cf-part').count()) >= 3);

  // an envelope keeps its sibling fields when the circuit inside is edited
  const env = JSON.stringify({ theme: 'dark', allowDesignErrors: true, circuit: { components: [{ id: 'V1', type: 'dc_source', value: '5V' }, { id: 'R1', type: 'resistr' }], connections: [['V1.positive', 'R1.1'], ['R1.2', 'V1.negative']] } }, null, 2);
  const { page: e2 } = await open(env, { svg: false });
  await e2.locator('#problems-list .fix', { hasText: 'resistor' }).click();
  const kept = await doc(e2);
  check('an edited envelope keeps its other fields', kept.theme === 'dark' && kept.allowDesignErrors === true && kept.circuit.components[1].type === 'resistor');

  // valid JSON that is not a circuit cannot be edited, and says why
  const { page: z } = await open('null', { svg: false });
  await z.click('[data-action=library]');
  await z.fill('#library-search', 'resistor');
  await z.press('#library-search', 'Enter');
  check('a non-circuit document refuses edits with a reason', /not a circuit object/.test(await z.textContent('#toast')));
  check('the refusal is visible, because the dialog closed first', (await z.locator('#library-dialog[open]').count()) === 0 && await z.locator('#toast').isVisible());

  // clearing X and Y means "place automatically", never "move to 0"
  const { page: x } = await open(example('08-bjt-amplifier.json'));
  const r = await centre(x, '.cf-part[data-id="R1"]');
  await x.mouse.move(r.x, r.y); await x.mouse.down(); await x.mouse.move(r.x + 40, r.y + 40, { steps: 5 }); await x.mouse.up();
  await x.fill('#inspector-form [name=x]', '');
  await x.locator('#inspector-form [name=label]').focus();
  check('one cleared coordinate changes nothing', !/"x": 0,/.test(await text(x)));
  await x.fill('#inspector-form [name=y]', '');
  await x.locator('#inspector-form [name=label]').focus();
  const after = await doc(x);
  check('both cleared removes just that part\'s position', !after.components.find((q) => q.id === 'R1').position && !!after.components.find((q) => q.id === 'R2').position);

  // pressing on a wire and dragging pans the view instead of highlighting
  const { page: p } = await open(example('08-bjt-amplifier.json'));
  await p.keyboard.press('Escape');
  const pt = await p.locator('.cf-wire-hit').first().evaluate((el) => {
    const q = el.getPointAtLength(el.getTotalLength() / 2); const m = el.getScreenCTM();
    return { x: m.a * q.x + m.c * q.y + m.e, y: m.b * q.x + m.d * q.y + m.f };
  });
  const t0 = await p.locator('#viewport').evaluate((el) => el.style.transform);
  await p.mouse.move(pt.x, pt.y); await p.mouse.down(); await p.mouse.move(pt.x + 70, pt.y + 30, { steps: 5 }); await p.mouse.up();
  check('dragging from a wire pans', (await p.locator('#viewport').evaluate((el) => el.style.transform)) !== t0 && (await p.locator('#wires path.net-hl').count()) === 0);

  // the browser keeps its own Ctrl+C unless there is something to copy
  const pressed = (page) => page.evaluate(() => { const e = new KeyboardEvent('keydown', { key: 'c', ctrlKey: true, bubbles: true, cancelable: true }); document.body.dispatchEvent(e); return e.defaultPrevented; });
  check('Ctrl+C with nothing selected is left to the browser', (await pressed(p)) === false);
  const q = await centre(p, '.cf-part[data-id="R1"]');
  await p.mouse.click(q.x, q.y);
  check('Ctrl+C with a part selected is handled', (await pressed(p)) === true);

  // a paste that cannot be applied says so, and does not shift the next successful paste
  const { page: v, ctx: vctx } = await open(example('01-led-resistor.json'));
  await vctx.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
  const vp = await centre(v, '.cf-part');
  await v.mouse.click(vp.x, vp.y);
  await v.keyboard.press('Control+c');
  await v.evaluate(() => { document.querySelector('#json').value = '{ not json'; document.querySelector('#json').dispatchEvent(new Event('input', { bubbles: true })); });
  await v.keyboard.press('Control+v');
  check('pasting into invalid JSON is refused with a reason', /Fix the JSON syntax error/.test(await v.textContent('#toast')));
  check('and nothing is written', (await text(v)) === '{ not json');
}

await browser.close();
for (const p of problems.filter((x) => /error/.test(x))) console.log(`  ${p}`);
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed || problems.some((x) => /error/.test(x)) ? 1 : 0);
