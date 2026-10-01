# CircuitForge

CircuitForge turns a JSON description of an electronic circuit into a clean, professional SVG
schematic — and tells you when the circuit is wrong. You describe the **topology** (parts and
which pins connect); CircuitForge works out placement, orientation, wire routing, junction dots
and labels, then checks the design the way a lab demonstrator would.

- Static site: runs on GitHub Pages or any static host, or straight from `dist/index.html`.
  The JSON → SVG path needs no backend.
- One engine (pure JS, no DOM) is shared by the web UI, the tests, the HTTP API and the AI endpoints.
- 128 component symbols, 31 worked examples plus a full reference sheet, analog + digital design-rule checks with explanations.
- A real editor, not just a viewer: multi-select, group move/rotate, wiring by clicking pins, properties panel,
  labelled undo/redo, one-click fixes for typos, and it stays responsive on large sheets.
- Exports SVG, PNG (2×, 4×, transparent), JPEG, PDF and JSON.

```
JSON ─► parser ─► validator ─► net graph ─► electrical rules ─► layout ─► router ─► SVG ─► exporters
```

## Quick start

```bash
npm install
npm run dev        # http://localhost:8080, rebuilds on change
npm test           # engine, layout, router, editor model, schema, fuzz, performance, exports, API, AI pipeline
npm run build      # static site in dist/
npm run smoke      # optional: drive the built app in headless Chromium (needs Playwright, see below)
npm run schema     # refresh the component list in schema/circuit.schema.json after adding a symbol
npm run api        # reference HTTP + AI server on :8787
```

Node 20 or newer (CI uses 22). The only dependency is `esbuild`, used at build time.

**Browser smoke test (optional).** `npm run smoke` builds the site and drives it in headless Chromium: selecting,
dragging, wiring, undo/redo, the inspector, quick fixes, the component library, a large-circuit drag and export
(64 checks). Playwright is deliberately not a dependency; install it where you want to run the checks with
`npm i --no-save playwright && npx playwright install chromium`. Without it the script prints that and exits 0.

## Deploying

- **GitHub Pages:** push to `main` (or `master`). [`.github/workflows/pages.yml`](.github/workflows/pages.yml)
  runs the tests, builds and publishes `dist/`. Under *Settings → Pages*, set the source to
  **GitHub Actions**.
- **Any static host:** upload the contents of `dist/`. All paths are relative.
- **Local file:** open `dist/index.html`. The bundle is a classic script with every symbol and
  example inlined, so it works over `file://`.
- **API/AI server:** `server/server.mjs` is a dependency-free Node server. Keys come from the
  environment (see [`.env.example`](.env.example)) and never reach the browser bundle.

## Using the app

| | |
|---|---|
| Editor | JSON on the left, re-rendered as you type. Every problem links to its exact line, is marked in the gutter, and many carry a **one-click fix** ("Change type to resistor"). |
| Canvas | Wheel or pinch zooms, dragging empty space pans (or middle button / **Space**+drag), **F** fits, **Z** zooms to the selection. |
| Selecting | Click a part; **Shift/Ctrl+click** adds or removes; **Shift+drag** box-selects; **Ctrl+A** selects all; **Tab** walks through the parts; click a wire to highlight its whole net. |
| Editing | Drag to move (the whole selection, 20 px snap), **arrows** nudge 10 px (**Shift**: 40), **R** rotates 90° (**Shift+R** 45°; a group turns about its centre), **M** flips, **Ctrl+D** duplicates with the wiring between the copies, **Ctrl+C/X/V** copy, cut and paste (also between circuits), **Del** deletes. |
| Wiring | **W** switches to the wire tool: click a pin, then another, and the connection is written into the JSON. The pin list in *Properties* disconnects a single pin. |
| Properties | Id (with live duplicate check), type, value (shows what `4.7k` means, warns about `4,7k`), label, rotation at any angle, mirror, X/Y, and every pin with the net it is on. |
| History | **Ctrl+Z / Ctrl+Y** undo and redo, one step per action and named in the toast ("Undid Move R1"); repeated nudges and typing merge into one step; selection is restored. |
| Spacing | Toolbar preset: auto, compact, normal, comfortable, spacious. The status bar counts junctions and crossings. |
| Learn | Circuit objectives, formulas, truth tables (multi-output for adders and decoders), per-part notes and an explanation of every rule that fired. |
| Examples | 32 circuits, from an LED and a divider to bridge rectifiers, an adjustable supply, adders, I²C and SPI. |
| Export | SVG, PNG (2×/4×/transparent), JPEG, PDF, JSON; clipboard copy for PNG, SVG and JSON. Exports are clean: no editor hooks. |
| Help | **?** lists every shortcut. |

Large circuits stay usable: the last few renders are cached (undo/redo and theme changes do not
re-route), typing re-renders later when renders are slow, and dragging a big sheet moves the parts as a
"ghost" with dashed wires following, routing once on release. Small circuits are re-routed live.

Manual edits are written back into the JSON as `position`/`rotation`, so the file stays the
source of truth. The auto-layout button removes them again.

The engine is on the page as `window.CircuitForge`: `.render(json)`, `.validate(json)`,
`.types()`, `.explain("npn")`, `.explainCircuit(json)`. None of them throw: an unexpected failure comes back as
an `INTERNAL_ERROR` entry in `errors`.

## JSON format

Full reference: [`docs/JSON-SCHEMA.md`](docs/JSON-SCHEMA.md) ·
machine-readable: [`schema/circuit.schema.json`](schema/circuit.schema.json) ·
everything at once: [`examples/complete-circuit.json`](examples/complete-circuit.json).

```json
{
  "title": "Voltage Divider",
  "components": [
    { "id": "V1", "type": "dc_source", "value": "10V" },
    { "id": "R1", "type": "resistor", "value": "1kΩ" },
    { "id": "R2", "type": "resistor", "value": "2kΩ" }
  ],
  "connections": [
    ["V1.positive", "R1.1"],
    ["R1.2", "R2.1"],
    ["R2.2", "V1.negative"]
  ]
}
```

A circuit file can also carry `metadata`, `layout`, `validation`, `simulation`, `education`,
`measurements`, `annotations` and `bom`, and each component can carry `params` (tolerance,
ratings, footprint), `bom`, `education`, `pinTypes` and `section`. Connections accept a `net`
name, a `class`, `waypoints` and a fully manual `route`.

**Connectivity comes from the JSON, never from the picture.** Two wires crossing on the drawing
are not connected; a junction dot is drawn only where the net graph says three or more ends meet.

### Component library

| Category | Types |
|---|---|
| Passive | `resistor`, `variable_resistor`, `potentiometer`, `thermistor`, `varistor`, `capacitor`, `capacitor_polarized`, `inductor`, `transformer`, `crystal`, `oscillator`, `fuse`, `switch`, `spdt_switch`, `dip_switch`, `push_button`, `antenna` |
| Semiconductor | `diode`, `led`, `rgb_led`, `zener`, `schottky`, `tvs_diode`, `photodiode`, `npn`, `pnp`, `nmos`, `pmos`, `jfet`, `jfet_p`, `igbt`, `scr`, `triac`, `bridge_rectifier`, `optocoupler` |
| Analog | `opamp`, `comparator`, `dc_source`, `ac_source`, `current_source`, `voltage_regulator`, `adjustable_regulator`, `ldo` |
| Digital | `and`, `or`, `not`, `nand`, `nor`, `xor`, `xnor`, `and3`, `and4`, `or3`, `or4`, `nand3`, `nand4`, `nor3`, `nor4`, `buffer`, `tristate_buffer`, `schmitt_trigger`, `d_latch`, `d_flipflop`, `jk_flipflop`, `t_flipflop`, `sr_flipflop`, `half_adder`, `full_adder`, `mux`, `demux`, `encoder`, `decoder`, `bcd_7seg_decoder`, `counter`, `register`, `shift_register` |
| IC / MCU | `generic_ic`, `timer_555`, `microcontroller`, `memory`, `i2c_eeprom`, `rtc`, `sd_card`, `bluetooth_module`, `adc`, `dac` |
| Boards | `arduino_uno`, `esp32`, `stm32`, `rp2040` |
| Sensors | `sensor`, `temperature_sensor`, `humidity_sensor`, `imu`, `pir_sensor`, `ultrasonic_sensor`, `microphone`, `photoresistor`, `phototransistor` |
| Output devices | `motor`, `servo`, `stepper_motor`, `motor_driver`, `relay`, `buzzer`, `speaker`, `lamp` |
| Displays | `seven_segment`, `lcd`, `oled` |
| Power & connection | `battery`, `ground`, `agnd`, `dgnd`, `vcc`, `vdd`, `vss`, `power_rail`, `input`, `output`, `connector`, `usb_connector`, `power_jack`, `keypad`, `net_label`, `junction` |
| Measurement | `voltmeter`, `ammeter`, `test_point` |

Type and pin names accept aliases (`dc_supply` → `dc_source`, `D1.A` → `D1.anode`, `U1.8` → the
555's `VCC`). The **Components** dialog lists every type with its pins and inserts a new part
with a free designator.

### Checks

Structural problems are errors and stop the drawing: `INVALID_JSON` (with line and column),
`UNKNOWN_TYPE` (with a "did you mean"), `INVALID_PIN`, `DUPLICATE_ID`, `INVALID_ID`, `MISSING_COMPONENT`,
`INVALID_CONNECTION`, `INVALID_PROPERTY`, `INVALID_SCHEMA`, `LIMIT_EXCEEDED`, `UNSUPPORTED_COMPONENT`,
`LAYOUT_FAILURE`, `INTERNAL_ERROR`.

Every problem says *where* it is (`path` such as `components[3].type`, plus `line`/`column` for text input),
suggests the closest valid name for a typo (types, pins, component ids, options, rule codes) and, when the
correction is unambiguous, carries a `fix` the editor applies in one click:

```json
{ "code": "INVALID_PIN", "path": "connections[0][0]", "line": 12,
  "message": "Pin positve does not exist on dc voltage source V1. Available: positive, negative. Did you mean \"positive\"?",
  "fix": { "label": "Use pin \"positive\"", "path": "connections[0][0]", "value": "V1.positive" } }
```

Wrong shapes are caught rather than repaired silently: `value`/`label` that are not text or numbers,
`mirror` that is not a boolean, box-part `pins` that are empty, duplicated or reserved, `route` that is not a
list, coordinates outside the sheet, annotations that are not objects. Names such as `constructor` and
`__proto__` can never resolve to something inherited by accident.

Design findings never stop the drawing; they explain what is wrong and how to fix it:

- **Wiring:** dangling nets, shorted parts, supply shorted to ground, wires crossing parts, overlapping nets,
  one net given several names (`NET_NAME_CONFLICT`).
- **Values:** `INVALID_VALUE` when a value starts like a number but cannot be read (`4,7k`, `1..5k`);
  symbolic values such as `Rx` are left alone.
- **Analog:** LED without current limiting, reversed diode or electrolytic, missing ground,
  resistor over its power rating, shorted transistor or IGBT, floating base/gate, reversed op-amp supply,
  shorted source, regulator wired wrong (an adjustable regulator needs its ADJ pin fed).
- **Digital:** two outputs on one net, output tied to a rail, floating input, IC without power,
  clock tied to a rail, combinational feedback loop.

Tune them per circuit with `"validation": { "rules": { "FLOATING_INPUT": "off" }, "supplyVoltage": 5 }`.

**Limits** keep a hostile or accidental document from exhausting a tab or an API worker: 1500 components,
6000 connections, 500 pins per connection, coordinates within ±20000, at most 100 problems reported. They are
exported as `LIMITS` and can be raised per call: `validate(circuit, { limits: { components: 5000 } })`.

## Examples

`examples/` holds 31 circuits and a reference sheet, all of them tested on every run (each must route
without fallbacks and stay under a recorded crossing/bend/score ceiling):

LED + resistor · voltage divider · RC low-pass · RL · series RLC · rectifier · transistor switch ·
BJT amplifier · MOSFET switch · inverting op-amp · comparator · 555 astable · full adder ·
flip-flop counter · counter + decoder · shift register · debounced button · microcontroller ·
PWM motor drive · regulated supply · ADC front end · UART link · I²C bus · SPI bus · MCU LED and
button · RGB LED and seven-segment · bridge rectifier · Wheatstone bridge · adjustable bench supply ·
2-bit ripple adder · BCD counter display · and
`complete-circuit.json`, which uses every field in the format.

## How it works

- **Graph** ([`src/graph`](src/graph)): union-find over pins builds the nets. Rail parts merge nets
  by name. Without an explicit ground the first source's negative net becomes the return path.
- **Layout** ([`src/layout`](src/layout)): sources stand up, parts touching a rail hang towards it,
  columns come from a BFS over signal nets with digital out→in edges relaxed into longest-path
  layers. Each part is aligned so one pin sits on its net's line. Column gaps grow where many nets
  cross, and sub-circuits joined only through rails are packed into rows. Bridge rectifiers and
  Wheatstone bridges become 45° diamonds. Parts can sit at any angle; their pins snap to the grid.
  A two-terminal part that bridges two already-placed nets (a feedback or sense resistor) may stand up
  instead of lying flat; both sheets are laid out and the better-scoring one is kept. Adjacent pins tied
  to the same rail share one supply symbol.
- **Spacing** ([`src/layout/optimize.js`](src/layout/optimize.js)): each routed layout is scored;
  where wires or labels collide the gap at that spot is widened and the layout retried, keeping
  the best of up to four attempts. When a sheet still has a few avoidable crossings, other net orders
  are tried on the same placement. Effort is capped in A\* expansions, not seconds, so the same JSON
  always draws the same way on every machine.
- **Router** ([`src/router`](src/router)): A* on a 10 px grid with (cell, heading) states so bends
  cost extra. Nets grow as Steiner-like trees; each pin's escape track is reserved for its own net;
  wires never pass through bodies or overlap another net and cross only at right angles.
  `waypoints` and `route` from the JSON are honoured. The heap is typed-array based, ties prefer
  the deeper state, and the post-route checks are linear, which makes dense sheets about three times
  faster than before. A pass has an effort cap; beyond it the remaining (longest) nets get direct wires
  and one summarising warning. A sheet too large to grid (a part positioned 20000 px away) is drawn
  with direct wires instead of exhausting memory.
- **Rules** ([`src/validator/electrical.js`](src/validator/electrical.js)): walks the net graph —
  never the drawing — to find the mistakes above.
- **Education** ([`src/education`](src/education)): purpose, formulas, truth tables, common mistakes
  per component type, and the explanation behind every rule.
- **Renderer** ([`src/renderer`](src/renderer)): standalone SVG with explicit colours and inline
  symbols, grouped into wires / components / markers / labels / junctions / notes. `interactive: true`
  (used by the editor only) adds wide invisible wire targets and pin hotspots.
- **Editor** ([`src/editor`](src/editor), [`src/ui`](src/ui)): everything that changes the circuit is a pure
  function in `editor/model.js` (move, rotate, mirror, delete, duplicate, paste, connect, apply-fix) with
  its own tests; `history.js` (labelled, merging, size-bounded), `selection.js` (marquee, cycling) and
  `cache.js` are DOM-free too. The UI modules (`canvas`, `commands`, `drag`, `inspector`, `problems`,
  `library`) only translate pointer and keyboard input into those calls.

## API

`src/api/handler.js` is transport-agnostic; `server/server.mjs` wires it to `node:http`.

```
POST /api/v1/render     { "circuit": {…}, "format": "svg" | "json", "allowDesignErrors"?: true }
POST /api/v1/validate   { "circuit": {…} }
POST /api/ai/generate   { "prompt": "555 astable blinking an LED at 1 Hz" }
POST /api/ai/explain    { "circuit": {…}, "question": "why the 10 nF?" }
POST /api/ai/analyze    { "circuit": {…} }
POST /api/ai/fix        { "circuit": {…}, "issue": "the LED is too bright" }
Authorization: Bearer <key>          (enforced when CF_API_KEYS is set)
```

Server-side PNG/PDF return `501` for now (the browser produces both from the same SVG). Structural errors
return `422` with the located problems (and `fix` suggestions); a circuit that draws but has a design error
(a shorted supply) also returns `422`, with the findings and a message, unless `allowDesignErrors` is set;
an internal failure returns `500`.

### AI

Keys live in the server environment only — copy [`.env.example`](.env.example) to `.env`:

```
ANTHROPIC_API_KEY=…      # or OPENAI_API_KEY / GOOGLE_AI_API_KEY
CF_AI_PROVIDER=anthropic # optional; defaults to the first configured provider
```

[`src/api/ai.js`](src/api/ai.js) holds one entry per provider (Anthropic, OpenAI, Google); adding
another means adding one object. `explain` and `analyze` work with no key at all — the
deterministic report is always produced and the model only adds prose.

**Nothing a model returns is trusted.** Every AI response goes through
[`src/api/pipeline.js`](src/api/pipeline.js):

```
model → JSON parse → schema → components → pins → connections → electrical rules → layout → routing → SVG
```

The first failing stage stops it. `generate` feeds the errors back to the model once, and if the
second attempt still fails it returns `422` with the errors instead of a broken circuit.

## Project layout

```
src/
├── symbols/        normalized symbol folders (metadata.json + symbol.svg)
├── symbol-loader/  symbol access, aliases, generated box ICs
├── parser/         JSON + connection normalization, syntax error location, path→line index (locate.js)
├── validator/      structural validation (limits, suggestions, fixes) + electrical.js rule engine
├── graph/          nets, rails, return path, wire hints
├── layout/         placement, instances, label placement, spacing config
├── router/         A* orthogonal router, junctions, crossings
├── renderer/       SVG output, themes, bridges, annotations, measurements
├── education/      component notes, formulas, rule explanations
├── exporters/      PNG/JPEG/PDF/clipboard/download (browser)
├── editor/         circuit edits (pure), labelled undo history, selection geometry, render cache
├── api/            HTTP handler, AI providers, AI routes, validation pipeline
├── ui/             app shell, canvas interaction, styles, bundled examples
└── utils/          geometry, unit parsing, JSON paths, safe lookups
examples/           31 example circuits and a reference sheet (all tested)
docs/               JSON reference
schema/             JSON Schema
server/             reference API + AI server
tests/              engine, rotation, angles/spacing, wiring/layout, library, validation, robustness (fuzz),
                    editor model, schema, performance, editor/export/API, AI pipeline
scripts/            build, symbol generation, schema refresh, optional browser smoke test
```

## Adding a component

1. Create `src/symbols/<type>/metadata.json`, plus `symbol.svg` for drawn symbols:

   ```json
   {
     "type": "thermistor", "name": "Thermistor", "category": "sensor",
     "svg": "symbol.svg", "width": 60, "height": 60,
     "pins": { "1": { "x": 0, "y": 30, "dir": "left" }, "2": { "x": 60, "y": 30, "dir": "right" } },
     "body": { "x": 12, "y": 18, "w": 36, "h": 24 },
     "prefix": "RT", "typeAliases": ["ntc"]
   }
   ```

   - Pins must be on a 10 px grid relative to each other; `dir` is the direction the wire leaves.
   - `body` is the keep-out box for layout and routing.
   - Draw with `stroke="currentColor"` so themes and highlighting work.
   - Optional: `aliases` (pin aliases), `io` per pin, `required`, `labels`, `defaultRotation`, `rail`, `text`.
2. Rectangular parts need no SVG: use `"kind": "box"`, a `"label"` and
   `"pins": { "left": […], "right": […], "top": […], "bottom": […] }`, plus `pinIO` for electrical types.
   [`scripts/make-symbols.mjs`](scripts/make-symbols.mjs) generates all of CircuitForge's own symbols.
3. Teaching notes go in [`src/education/index.js`](src/education/index.js) under the type name.
4. Run `npm run symbols && npm run schema` to regenerate the bundled library and the schema's type list
   (`npm test` fails, naming the command, if the schema is behind). The library test checks every symbol:
   pins on the 10 px grid, alias collisions, drawing at every rotation, and that new parts have notes.

## Adding an external symbol library

[`scripts/import-symbols.mjs`](scripts/import-symbols.mjs) is the pattern: it reads a clone of the
source library and, per symbol, scales it onto the grid, normalizes stroke and colour, writes pin
anchors and a body box, and records `origin` (library, file, licence, modifications).

```bash
git clone --depth 1 https://github.com/chris-pikul/electronic-symbols /tmp/es
npm run import-symbols -- /tmp/es
```

Check the licence before importing anything, record it in `origin` and in
[`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md), and ship the licence text with the symbols.

## Known limits

- PDF export embeds a high-resolution image of the SVG, not vector paths (font embedding for Ω/µ
  is the blocker).
- Layout is heuristic. Dense digital sheets route correctly but use more room than a hand-drawn one, and
  crossings on them follow from the placement rather than the router (random logic with 80 gates has
  hundreds). Above roughly 150 densely wired parts routing takes over a second and, past its effort cap,
  falls back to direct wires with a warning; up to 1500 parts are accepted.
- Rendering runs on the page's main thread, so a very large sheet blocks the UI while it routes (dragging
  switches to a ghost to avoid this, editing text does not). A Web Worker would fix it; it is not done.
- The wire tool edits connectivity, not wire shapes: the router still decides where wires run, and
  `waypoints`/`route` are edited in the JSON.
- Group rotation is rigid about the centroid of the parts' first pins; a group of angled parts is rotated
  exactly, but off-grid results are snapped to the 10 px grid.
- The browser smoke test needs Playwright, which is intentionally not a dependency.
- Gates in the original set have two inputs; use `and3`/`and4`/`or3`/`or4`/`nand3`/`nand4`/`nor3`/`nor4`,
  chain them, or use `generic_ic` for other widths. The wide gates are drawn as IEC rectangles.
- `simulation` metadata is stored and validated, not executed.
