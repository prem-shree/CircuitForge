# Changelog

## 1.1.0 — robustness, a real editor, more parts

Everything that worked before still does. The JSON format is unchanged and only ever *added to*; the public entry
points (`render`, `validate`, `explain…`, the HTTP API) keep their shapes; all 29 original examples still render
without routing fallbacks or collisions. Three of them now draw *better* by the project's own score (microcontroller
183 → 161, MCU LED/button 91 → 84, I²C 134 → 111) and none draws worse; a per-example ceiling test keeps it that way.
(Strictly stricter validation is the one behaviour change: documents that were accepted with silently repaired or
ignored values, such as `pins: "abc"` or `mirror: "yes"`, are now reported.)

### Fixed: crashes and silent misbehaviour

Found by reading the code, probing it with hostile input and mutation-fuzzing the examples.

| Was | Now |
|---|---|
| `"type": "constructor"` (or `__proto__`) threw a `TypeError`; a pin named `constructor` was misreported as a layout failure | Names from the JSON are looked up as own properties only; reserved words are rejected as ids and pin names |
| A part positioned 20000 px away took ~29 s and could crash the tab (a routing grid of hundreds of millions of cells) | Coordinates are bounded; a sheet too large to grid is drawn with direct wires and one warning, in ~13 ms |
| A `null` in `annotations` threw inside the renderer; `explainCircuit` and the editor helpers threw on malformed documents | Every stage tolerates bad input; validation reports it |
| `value: {…}`, `label: […]`, `mirror: "yes"`, `route: "x"`, `pins: "abc"`, empty or duplicate box-pin names were accepted and silently "repaired" | Each is a located `INVALID_PROPERTY`/`INVALID_CONNECTION` error |
| 3000 unconnected components took ~6 s; nothing bounded the size of a document | Limits (1500 components, 6000 connections, 500 pins per connection); `LIMIT_EXCEEDED` returns immediately |
| A design error (reversed diode, shorted supply) left the canvas stale (dimmed, showing the previous drawing) although a fresh one existed | The drawing is always shown; only structural errors stop it |
| The API answered a design error with `422` and an *empty* `errors` list | It now includes the findings and a message, and `allowDesignErrors: true` returns the drawing; internal failures are `500` |
| Rail-marker text (`+3V3`) was drawn bold (it inherited the wire stroke) | Fixed |
| Two adjacent pins tied to the same rail each got their own overlapping supply symbol | They share one marker and a junction dot |
| Pressing Enter in the component search added the part and then reopened the dialog | Fixed |
| The first edit of a Wheatstone-bridge circuit made the diamond jump (freezing the layout lost the off-grid diamond geometry) | Freezing reproduces every example exactly (a test checks all of them); a pinned diamond is still recognised, a hand-laid ring is left alone |
| Deleting a part or disconnecting a pin left a one-pin entry in `nets`, turning a valid document invalid | Such entries are removed, like connection lists |
| Malformed text such as `[}` could hang the path locator (found in review, reproduced) | The scanner makes progress or stops; indexes are built only when something needs a line |
| Editing from the canvas while the JSON had a syntax error overwrote the text being typed | Edits are refused with a message until the text parses; pending typing is applied first |
| A pasted API envelope `{ "circuit": … }` broke quick fixes, line numbers and every edit | The circuit is unwrapped for editing and located one level down |
| Clearing the X or Y field moved the part to 0 and froze the layout | One empty field is ignored; both empty returns the part to automatic placement; values are clamped |
| Pressing on a wire and dragging neither panned nor did anything but highlight | It pans |
| Ctrl+C/X/V/A/D suppressed the browser's own shortcut even when there was nothing to act on | Only suppressed when the command acts; paste falls back to the system clipboard where the browser permits |
| A measurement at `R1.constructor` produced NaN coordinates; `U1.P0.1` was cut at the first dot; pin aliases were ignored | Own-property lookup, first-dot split, aliases resolved |
| A short id such as `R5` was "corrected" to an unrelated part (`R1`) with a one-click fix | Short ids only suggest case-slips |
| The validator's cost was not bounded by its limits (a 500-pin bus of 1500 parts took seconds, thousands of bad references more) | Total-pin limit, suggestion budget, linear duplicate detection, early exit at the error cap, warning cap |
| `12Vdc`, `5Vrms`, `1Meg` were reported as unreadable values | Everyday qualifiers and SPICE `meg` are understood (parsing is linear and length-bounded; a 40,000-fragment string used to take seconds) |
| A bridge ring with only some parts pinned could place a pinned part twice and move it | Free and frozen diamonds are separate modes; anything else is left exactly as placed |
| The `nets` form bypassed the connection and pin limits | Counted together with `connections` |
| Duplicate-connection detection skipped non-adjacent pairs in long buses and dropped overflow silently | Linear detection by shared connections, with a "N more not shown" note |
| After the error cap the validator reported parts as "not connected" from a partial picture | Those passes are skipped once it has stopped early |
| Starting over (New, an example) was blocked while the text had a syntax error | Replacing the whole document always works; edits are what is refused |
| Editing an API envelope dropped its sibling fields (`theme`, `allowDesignErrors`, …) | Written back inside the envelope |
| `null` or `42` as the document made Auto layout and the spacing menu throw | Refused with a reason |
| A "did you mean" fix could rewire to a different part (`R13` → `R1`) | Designators differing by a digit are never suggested; long names are not searched |
| Ctrl+Z within 600 ms of typing ignored or jumped past the new text (it was not yet in the history) | Pending typing is recorded before undoing |

`render()` and `validate()` never throw any more: an unexpected failure inside a stage comes back as an
`INTERNAL_ERROR` entry, so a bad document cannot take down the page or an API worker.

### Validation and error messages

- Every located problem has a JSON `path`; given text, also `line` and `column`. The editor selects the exact
  text and marks errors and warnings in the gutter (it used to guess with regular expressions).
- "Did you mean …?" for component types, pins, component ids (including wrong case), top-level fields, layout
  options, connection classes and rule codes.
- One-step **quick fixes** (`fix: { label, path, value }`) for the unambiguous cases, applied from the problems
  list; `applyFix` is a pure function with tests.
- New checks: `NET_NAME_CONFLICT`, `INVALID_VALUE` (`4,7k`, `1..5k`; symbolic values such as `Rx` are fine),
  `UNKNOWN_RULE`, `IGNORED_PROPERTY`, `LIMIT_EXCEEDED`, `TOO_MANY_ERRORS`. A mistyped connection no longer also
  reports its parts as "not connected".
- The JSON Schema carries the same limits and the list of component types (generated: `npm run schema`); a test
  checks every example against it and that the schema and the validator agree on a table of mistakes.

### Layout and routing

- **Speed.** Typed-array heap, a closed set, deeper-first tie-breaking, typed tree marks and linear post-route
  checks: identical routes, about **3× faster** on dense sheets (160 random gates: 3.6 s → 1.2 s per pass; the full
  render, with optimizer retries, 11.9 s → 4.4 s before the effort budget below).
- **Budgets, not clocks.** Routing effort is counted in A\* expansions. One pass is capped, and so are the optimizer's
  retries, so large circuits stay responsive *and* the same JSON always draws the same way on every machine.
- **Quality.** When a routed sheet has a few avoidable crossings, other net orders are tried on the same placement
  (I²C example: 2 → 0 crossings). A two-terminal part bridging two placed nets can stand up instead of lying flat; both
  layouts are scored and the better one kept, so it can only help (microcontroller example: score 183 → 161 with the
  crossing gone; LED/button example: 840 → 510 px of wire). The label scorer skips distant wires by bounding box.
- Adjacent side pins on one rail share a marker (see above).

### Components: 93 → 128 types

Drawn: thermistor, varistor, TVS diode, microphone, SPDT switch, IGBT, SCR, triac, bridge-rectifier package, antenna.
Box parts: 3- and 4-input AND/OR/NAND/NOR, D latch, half and full adder, BCD-to-7-segment decoder, adjustable regulator
(LM317-style), stepper motor, DIP switch, I²C EEPROM, RTC, SD card, USB connector, DC jack, keypad, humidity sensor,
IMU, PIR sensor, Bluetooth module. All have teaching notes (truth tables now support several outputs), the IGBT joins
the transistor checks and adjustable regulators the regulator checks. Three new examples: an adjustable bench supply,
a 2-bit ripple-carry adder and a BCD counter with a seven-segment display. The Components dialog now lists **every**
category (it used to hide boards, sensors, displays and connectors).

### Editor

- **Selection:** shift/ctrl-click, box-select (shift+drag), select all, Tab/Shift+Tab, click a wire to highlight
  its net (named in the status bar), zoom to selection.
- **Editing:** group move by drag or arrows, group rotate about the centroid (four quarter turns come back exactly),
  flip, duplicate with the wiring between the copies, copy/cut/paste (also into another circuit), delete.
- **Wire tool (W):** click two pins to connect them; extends an existing connection where there is one; understands
  pin aliases. *Properties* disconnects a single pin.
- **Properties:** live id validation, value hint (`= 4.7 kΩ`), X/Y, rotation at any angle, every pin with its net.
- **Undo/redo:** actions are named ("Undid Move R1"), repeated nudges and typing merge into one step, the selection
  is restored, and memory is bounded by size as well as step count.
- **Large circuits:** the last renders are cached (undo/redo/theme are instant); typing re-renders later when renders
  are slow; a drag switches from live re-routing to a ghost with dashed wires when rendering is slow, and routes once
  on release. Touch: two-finger pinch zoom.
- The 613-line `main.js` is split into `canvas`, `commands`, `drag`, `inspector`, `problems`, `library` and `state`;
  all edits are pure functions in `editor/model.js`.

### Tests and tooling

- 89 → 172 unit tests: robustness with mutation fuzzing (structural and semantic, 350 cases per run), validation and
  the path locator, the symbol library (geometry, alias collisions, every type at every rotation), the editor model,
  history, selection, schema conformance, and a performance/quality suite with deterministic ceilings.
- `npm run smoke`: 68 browser checks (optional; needs Playwright, which is not a dependency).
- A CI workflow runs the tests and the build on every pull request (Node 20 and 22).

### Known limitations

- Rendering is on the main thread. Very large or dense sheets (roughly 150+ densely wired parts) take over a second
  to route and beyond the effort cap fall back to direct wires with a warning. A Web Worker is the fix; not done.
- Crossings on dense logic are set by the placement, not the router. Placement is greedy and does not minimise
  crossings globally (no barycentre ordering or force-directed pass).
- The wire tool changes *connectivity* only. Wire shapes are decided by the router; `waypoints`/`route` remain
  JSON-only. Wires cannot be dragged.
- Annotations with a fixed offset are not moved out of the way of other text.
- PDF export embeds an image, not vector paths.
- The optional smoke test depends on a locally installed Playwright.
