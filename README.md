# CircuitForge

CircuitForge turns a JSON description of an electronic circuit into a clean, professional SVG
schematic — and tells you when the circuit is wrong. You describe the **topology** (parts and
which pins connect); CircuitForge works out placement, orientation, wire routing, junction dots
and labels, then checks the design the way a lab demonstrator would.

- Static site: runs on GitHub Pages or any static host, or straight from `dist/index.html`.
  The JSON → SVG path needs no backend.
- One engine (pure JS, no DOM) is shared by the web UI, the tests, the HTTP API and the AI endpoints.
- 93 component symbols, 27 worked examples, analog + digital design-rule checks with explanations.
- Exports SVG, PNG (2×, 4×, transparent), JPEG, PDF and JSON.

```
JSON ─► parser ─► validator ─► net graph ─► electrical rules ─► layout ─► router ─► SVG ─► exporters
```

## Quick start

```bash
npm install
npm run dev        # http://localhost:8080, rebuilds on change
npm test           # 75 tests: engine, rotation, wiring, layout, exports, API, AI pipeline
npm run build      # static site in dist/
npm run api        # reference HTTP + AI server on :8787
```

Node 20 or newer (CI uses 22). The only dependency is `esbuild`, used at build time.

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
| Editor | JSON on the left, re-rendered as you type. Problems link to the offending line. |
| Canvas | Wheel zooms, dragging empty space pans, **F** fits. |
| Editing | Click to select, drag to move (20 px snap), **R** rotates, **Del** deletes, the inspector edits id/type/value/rotation. **Ctrl+Z / Ctrl+Y** undo and redo. |
| Learn | Circuit objectives, formulas, truth tables, per-part notes and an explanation of every rule that fired. |
| Examples | 27 circuits, from an LED and a divider to I²C, SPI and a full reference sheet. |
| Export | SVG, PNG (2×/4×/transparent), JPEG, PDF, JSON; clipboard copy for PNG, SVG and JSON. |

Manual edits are written back into the JSON as `position`/`rotation`, so the file stays the
source of truth. The auto-layout button removes them again.

The engine is on the page as `window.CircuitForge`: `.render(json)`, `.validate(json)`,
`.types()`, `.explain("npn")`, `.explainCircuit(json)`.

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
| Passive | `resistor`, `variable_resistor`, `potentiometer`, `capacitor`, `capacitor_polarized`, `inductor`, `transformer`, `crystal`, `oscillator`, `fuse`, `switch`, `push_button` |
| Semiconductor | `diode`, `led`, `rgb_led`, `zener`, `schottky`, `photodiode`, `npn`, `pnp`, `nmos`, `pmos`, `jfet`, `jfet_p`, `optocoupler` |
| Analog | `opamp`, `comparator`, `dc_source`, `ac_source`, `current_source`, `voltage_regulator`, `ldo` |
| Digital | `and`, `or`, `not`, `nand`, `nor`, `xor`, `xnor`, `buffer`, `tristate_buffer`, `schmitt_trigger`, `d_flipflop`, `jk_flipflop`, `t_flipflop`, `sr_flipflop`, `mux`, `demux`, `encoder`, `decoder`, `counter`, `register`, `shift_register` |
| IC / MCU | `generic_ic`, `timer_555`, `microcontroller`, `memory`, `adc`, `dac` |
| Boards | `arduino_uno`, `esp32`, `stm32`, `rp2040` |
| Sensors | `sensor`, `temperature_sensor`, `ultrasonic_sensor`, `photoresistor`, `phototransistor` |
| Output devices | `motor`, `servo`, `motor_driver`, `relay`, `buzzer`, `speaker`, `lamp` |
| Displays | `seven_segment`, `lcd`, `oled` |
| Power & connection | `battery`, `ground`, `agnd`, `dgnd`, `vcc`, `vdd`, `vss`, `power_rail`, `input`, `output`, `connector`, `net_label`, `junction` |
| Measurement | `voltmeter`, `ammeter`, `test_point` |

Type and pin names accept aliases (`dc_supply` → `dc_source`, `D1.A` → `D1.anode`, `U1.8` → the
555's `VCC`). The **Components** dialog lists every type with its pins and inserts a new part
with a free designator.

### Checks

Structural problems are errors and stop the drawing: `INVALID_JSON` (with line and column),
`UNKNOWN_TYPE` (with a "did you mean"), `INVALID_PIN`, `DUPLICATE_ID`, `MISSING_COMPONENT`,
`INVALID_CONNECTION`, `INVALID_PROPERTY`, `UNSUPPORTED_COMPONENT`, `LAYOUT_FAILURE`, `ROUTING_FAILURE`.

Design findings never stop the drawing; they explain what is wrong and how to fix it:

- **Wiring:** dangling nets, shorted parts, supply shorted to ground, wires crossing parts, overlapping nets.
- **Analog:** LED without current limiting, reversed diode or electrolytic, missing ground,
  resistor over its power rating, shorted transistor, floating base/gate, reversed op-amp supply,
  shorted source, regulator wired wrong.
- **Digital:** two outputs on one net, output tied to a rail, floating input, IC without power,
  clock tied to a rail, combinational feedback loop.

Tune them per circuit with `"validation": { "rules": { "FLOATING_INPUT": "off" }, "supplyVoltage": 5 }`.

## Examples

`examples/` holds 27 circuits, all of them tested on every run:

LED + resistor · voltage divider · RC low-pass · RL · series RLC · rectifier · transistor switch ·
BJT amplifier · MOSFET switch · inverting op-amp · comparator · 555 astable · full adder ·
flip-flop counter · counter + decoder · shift register · debounced button · microcontroller ·
PWM motor drive · regulated supply · ADC front end · UART link · I²C bus · SPI bus · MCU LED and
button · RGB LED and seven-segment · and `complete-circuit.json`, which uses every field in the
format.

## How it works

- **Graph** ([`src/graph`](src/graph)): union-find over pins builds the nets. Rail parts merge nets
  by name. Without an explicit ground the first source's negative net becomes the return path.
- **Layout** ([`src/layout`](src/layout)): sources stand up, parts touching a rail hang towards it,
  columns come from a BFS over signal nets with digital out→in edges relaxed into longest-path
  layers. Each part is aligned so one pin sits on its net's line. Column gaps grow where many nets
  cross, and sub-circuits joined only through rails are packed into rows.
- **Router** ([`src/router`](src/router)): A* on a 10 px grid with (cell, heading) states so bends
  cost extra. Nets grow as Steiner-like trees; each pin's escape track is reserved for its own net;
  wires never pass through bodies or overlap another net and cross only at right angles.
  `waypoints` and `route` from the JSON are honoured.
- **Rules** ([`src/validator/electrical.js`](src/validator/electrical.js)): walks the net graph —
  never the drawing — to find the mistakes above.
- **Education** ([`src/education`](src/education)): purpose, formulas, truth tables, common mistakes
  per component type, and the explanation behind every rule.
- **Renderer** ([`src/renderer`](src/renderer)): standalone SVG with explicit colours and inline
  symbols, grouped into wires / components / markers / labels / junctions / notes.

## API

`src/api/handler.js` is transport-agnostic; `server/server.mjs` wires it to `node:http`.

```
POST /api/v1/render     { "circuit": {…}, "format": "svg" | "json" }
POST /api/v1/validate   { "circuit": {…} }
POST /api/ai/generate   { "prompt": "555 astable blinking an LED at 1 Hz" }
POST /api/ai/explain    { "circuit": {…}, "question": "why the 10 nF?" }
POST /api/ai/analyze    { "circuit": {…} }
POST /api/ai/fix        { "circuit": {…}, "issue": "the LED is too bright" }
Authorization: Bearer <key>          (enforced when CF_API_KEYS is set)
```

Server-side PNG/PDF return `501` for now (the browser produces both from the same SVG).

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
├── parser/         JSON + connection normalization, syntax error location
├── validator/      structural validation + electrical.js rule engine
├── graph/          nets, rails, return path, wire hints
├── layout/         placement, instances, label placement, spacing config
├── router/         A* orthogonal router, junctions, crossings
├── renderer/       SVG output, themes, bridges, annotations, measurements
├── education/      component notes, formulas, rule explanations
├── exporters/      PNG/JPEG/PDF/clipboard/download (browser)
├── editor/         JSON model mutations, formatting, undo history
├── api/            HTTP handler, AI providers, AI routes, validation pipeline
├── ui/             app shell, canvas interaction, styles, bundled examples
└── utils/          geometry, unit parsing
examples/           27 example circuits (all tested)
docs/               JSON reference
schema/             JSON Schema
server/             reference API + AI server
tests/              engine, rotation, wiring/layout, editor/export/API, AI pipeline
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
4. Run `npm run symbols` (build and test do this too) to regenerate the bundled library.

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
- Layout is heuristic. Dense digital sheets route correctly but use more room than a hand-drawn one.
- Gates have two inputs; chain them or use `generic_ic` for wider functions.
- `simulation` metadata is stored and validated, not executed.
