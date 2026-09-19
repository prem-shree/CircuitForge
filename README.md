# CircuitForge

CircuitForge turns a JSON description of an electronic circuit into a clean, professional
SVG schematic. You describe the **topology** (parts and which pins connect). CircuitForge
works out placement, orientation, wire routing, junction dots, crossings and labels.

- Static site: runs on GitHub Pages or any static host, or straight from `dist/index.html`.
  The core JSON → SVG path needs no backend.
- One engine (pure JS, no DOM) is shared by the web UI, the tests and the reference API server.
- Exports SVG, PNG (2×, 4×, transparent), JPEG, PDF and JSON, and copies PNG, SVG or JSON
  to the clipboard.

```
JSON ─► parser ─► validator ─► graph (nets, rails) ─► layout ─► router ─► renderer (SVG) ─► exporters
```

## Quick start

```bash
npm install
npm run dev        # http://localhost:8080, rebuilds on change
npm test           # engine, routing, export and API tests (node:test)
npm run build      # static site in dist/
```

You need Node 18 or newer (CI uses 22). The only dependency is `esbuild`, used at build time.

## Deploying

- **GitHub Pages:** push to `main`. [`.github/workflows/pages.yml`](.github/workflows/pages.yml)
  runs the tests, builds and publishes `dist/`. Under *Settings → Pages*, set the source to
  **GitHub Actions**.
- **Any static host:** upload the contents of `dist/`. All paths are relative, so sub-paths work.
- **Local file:** open `dist/index.html`. The bundle is a classic script with every symbol and
  sample inlined, so it works over `file://`.

## Using the app

| | |
|---|---|
| Editor | JSON on the left, re-rendered as you type. Problems below the editor link to the offending line. |
| Canvas | Wheel to zoom, drag empty space to pan (also middle mouse or space+drag), **F** fits the view. |
| Editing | Click to select. Drag to move (snaps to 20 px, or 10 px with snap off). **R** rotates, **Del** deletes, the inspector edits id/type/value/rotation. **Ctrl+Z / Ctrl+Y** undo and redo. |
| Auto layout | Manual edits are written back into the JSON as `position`/`rotation`. The auto-layout button removes them again. |
| Export | The Export menu. Every raster/PDF export is rendered from the SVG. |

The engine is also exposed on the page as `window.CircuitForge.render(json)`, `.validate(json)`
and `.types()`.

## JSON format

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

The full JSON Schema is [`schema/circuit.schema.json`](schema/circuit.schema.json).

**Components.** `id` (unique, no dots) and `type` are required. Optional fields:

- `value`: shown next to the part. For `ground`, `vcc` and `net_label` it names the rail.
- `label`: display text.
- `rotation`: 0, 90, 180 or 270.
- `mirror`
- `position`: `{x, y}` of the first pin.
- `pins`: for box parts, e.g. `{ "left": [...], "right": [...], "top": [...], "bottom": [...] }`, an array, or a count for `connector`.

**Connections.** Each entry puts two or more pins on one net. The accepted forms are
`["R1.2", "C1.1", "U1.in-"]`, `{ "from": "R1.2", "to": "C1.1" }` and
`{ "pins": [...], "net": "VOUT" }`. A top-level `"nets": { "VOUT": [...] }` also works.
Single-pin parts can be referenced without a pin (`"GND"`). Pin names are case-insensitive
and have aliases: `+`/`-`/`positive`, `A`/`K`/`anode`, `B`/`C`/`E`/`base`, `in+`/`non_inverting`,
and the numeric pins of the 555.

**Rails.** `ground`, `vcc`/`vdd`/`vss`/`power_rail` and `net_label` are not placed as parts.
They mark the net as a rail, and a rail symbol is drawn at every pin on it, the way hand-drawn
schematics do it. Rails with the same name (`value`) are the same net. `junction` just merges
connections.

### Component types

| Category | Types |
|---|---|
| Passive | `resistor`, `variable_resistor`, `potentiometer`, `capacitor`, `capacitor_polarized`, `inductor`, `transformer`, `crystal`, `fuse`, `switch`, `push_button` |
| Semiconductor | `diode`, `led`, `zener`, `photodiode`, `schottky`, `npn`, `pnp`, `nmos`, `pmos`, `jfet`, `jfet_p` |
| Analog | `opamp`, `comparator`, `dc_source` (`dc_supply`), `ac_source`, `current_source`, `voltage_regulator` |
| Digital | `and`, `or`, `not`, `nand`, `nor`, `xor`, `xnor`, `buffer`, `tristate_buffer`, `d_flipflop`, `jk_flipflop`, `t_flipflop`, `sr_flipflop`, `mux`, `demux`, `encoder`, `decoder`, `counter`, `register` |
| IC / MCU | `generic_ic`, `timer_555`, `microcontroller`, `memory`, `adc`, `dac` |
| Power / connection | `battery`, `ground`, `vcc`, `vdd`, `vss`, `power_rail`, `input`, `output`, `connector`, `test_point`, `net_label`, `junction` |

The **Components** dialog in the app lists every type with its pins and inserts a new part
with a free id. Arduino, ESP32 and Raspberry Pi board symbols are deliberately rejected with
`UNSUPPORTED_COMPONENT` for now. Use `microcontroller` with custom `pins`.

### Validation

`validate()` (and `render()`) return structured problems:

```json
{ "valid": false, "errors": [{ "code": "INVALID_PIN", "component": "R1", "pin": "99",
  "message": "Pin 99 does not exist on resistor R1. Available: 1, 2." }] }
```

- **Errors:** `INVALID_JSON` (with line and column), `INVALID_SCHEMA`, `MISSING_ID`,
  `INVALID_ID`, `DUPLICATE_ID`, `MISSING_TYPE`, `UNKNOWN_TYPE` (with a "did you mean"
  suggestion), `UNSUPPORTED_COMPONENT`, `INVALID_PROPERTY`, `INVALID_CONNECTION`,
  `MISSING_COMPONENT`, `INVALID_PIN`, `LAYOUT_FAILURE`, `ROUTING_FAILURE`.
- **Warnings** (the schematic still renders): `DUPLICATE_CONNECTION`, `MISSING_REQUIRED_PIN`,
  `UNCONNECTED_COMPONENT`, and `ROUTING_FAILURE` for a single wire that fell back to a
  direct line.

## How it works

- **Graph** ([`src/graph`](src/graph)): union-find over pins builds nets. Rail parts merge
  nets by name. Without an explicit ground, the first source's negative net is used as the
  return path.
- **Layout** ([`src/layout`](src/layout)):
  - *Orientation:* sources stand vertically. Two-terminal parts that touch a rail hang toward
    it (ground down, supply up). An op-amp with its + input grounded flips so the inverting
    input is on top.
  - *Columns:* a BFS over signal nets steps left or right depending on which side of a part a
    neighbour hangs off. Digital out→in edges are then relaxed into longest-path layers, so
    signals read left to right.
  - *Placement:* each part is aligned so one pin sits on its net's line, which keeps bends to a
    minimum. Collector/emitter resistors stack straight off their pins, and feedback elements
    sit over their op-amp.
  - *Collisions:* resolved on the grid, and labels count toward collisions.
- **Router** ([`src/router`](src/router)):
  - A* on a 10 px grid with (cell, heading) states, so bends cost extra.
  - Nets are grown as Steiner-like trees: each pin connects to the nearest point of its net.
  - Wires leave pins straight, never pass through bodies or leads, and never overlap another
    net. They cross other nets only at right angles on a straight run.
  - Junction dots mark wire ends where three or more meet. Crossings are reported, and can be
    drawn as bridges.
  - Moving a part re-runs placement and routing.
- **Renderer** ([`src/renderer`](src/renderer)): standalone SVG with explicit colors and
  inline symbols (no `<use>` and no CSS), grouped by wires/components/markers/labels/junctions.

## Adding a component

1. Create `src/symbols/<type>/metadata.json`, plus `symbol.svg` for drawn symbols:

   ```json
   {
     "type": "thermistor", "name": "Thermistor", "category": "passive",
     "svg": "symbol.svg", "width": 60, "height": 60,
     "pins": { "1": { "x": 0, "y": 30, "dir": "left" }, "2": { "x": 60, "y": 30, "dir": "right" } },
     "body": { "x": 12, "y": 18, "w": 36, "h": 24 },
     "prefix": "RT", "typeAliases": ["ntc"]
   }
   ```

   - Pins must be on a 10 px grid relative to each other.
   - `dir` is the direction the wire leaves the pin.
   - `body` is the keep-out box for layout and routing.
   - Draw with `stroke="currentColor"` so themes and highlighting work.
   - Optional fields: `aliases` (pin aliases), `required` (pins that must be connected),
     `labels` (`right`, `top`, `topright`, `none`), `defaultRotation`, `source`, `rail`.
2. Rectangular parts need no SVG. Use `"kind": "box"`, a `"label"`, and
   `"pins": { "left": [...], "right": [...], "top": [...], "bottom": [...] }`.
3. Run `npm run symbols` (the build and test scripts do this too) to regenerate
   `src/symbol-loader/library.generated.js`.

## Adding an external symbol library

[`scripts/import-symbols.mjs`](scripts/import-symbols.mjs) is the pattern to follow. It reads
a clone of the source library and, for each mapped symbol:

- Scales it onto the 10 px grid and normalizes stroke and colors.
- Writes pin anchors and a body box, reading pin positions from the source geometry.
- Records `origin` (library, file, license, modifications) in `metadata.json`.

```bash
git clone --depth 1 https://github.com/chris-pikul/electronic-symbols /tmp/es
npm run import-symbols -- /tmp/es
```

Check the license before importing anything. Record it in `origin` and in
[`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md), and ship its license text next to the
symbols. That file also covers which libraries were evaluated and why.

## API

`src/api/handler.js` is a transport-agnostic handler:

```
POST /api/v1/render     { "circuit": {…}, "format": "svg" | "json", "theme"?: "light"|"dark", "bridges"?: bool }
POST /api/v1/validate   { "circuit": {…} }
Authorization: Bearer <key>     (enforced when keys are configured)
```

Run the reference server (plain `node:http`, no dependencies) with:

```bash
CF_API_KEYS=secret1,secret2 PORT=8787 npm run api
```

- **Status codes:** `200` for SVG/JSON, `422` with the validation report, `401` for a bad key,
  `501` for `png`/`pdf`.
- **PNG/PDF:** server-side raster output is planned via `@resvg/resvg-js`. The browser already
  produces both from the same SVG.
- **Deploying:** the handler can be wrapped for serverless platforms such as Cloudflare
  Workers or Vercel. Map the platform's request to `{ method, path, headers, body }`.

The static GitHub Pages build never needs this server.

## Project layout

```
src/
├── symbols/        normalized symbol folders (metadata.json + symbol.svg)
├── symbol-loader/  symbol access, aliases, generated box ICs
├── parser/         JSON + connection-form normalization, syntax error location
├── validator/      structured errors and warnings
├── graph/          nets, rails, return path
├── layout/         placement, instances (pins/markers/labels), label side selection
├── router/         A* orthogonal router, junctions, crossings
├── renderer/       SVG output, themes, bridges
├── exporters/      PNG/JPEG/PDF/clipboard/download (browser)
├── editor/         JSON model mutations, formatting, undo history
├── api/            HTTP-agnostic API handler
├── ui/             app shell, canvas interaction, styles, bundled samples
└── utils/          geometry
samples/            15 example circuits (also tested)
server/             reference API server
schema/             JSON Schema for circuits
```

## Known limits

- PDF export embeds a lossless high-DPI rendering of the SVG, not vector paths. Swap in
  `svg2pdf.js` if you need vector PDF (it needs font embedding for Ω and µ).
- Layout is heuristic. Dense digital designs route correctly but may use more space than a
  hand-drawn sheet. Positions you set by dragging are kept exactly.
- Gates have two inputs. For wider functions, chain gates or use `generic_ic`.
