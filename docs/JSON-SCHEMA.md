# CircuitForge JSON reference

A circuit file describes **electrical topology plus teaching material**. CircuitForge works
out the geometry: where parts go, how they are turned, where the wires run, where junction
dots belong. Anything you pin down by hand (`position`, `rotation`, `route`) is respected
exactly and everything else is computed around it.

The machine-readable schema is [`../schema/circuit.schema.json`](../schema/circuit.schema.json).
A file that uses every field is [`../examples/complete-circuit.json`](../examples/complete-circuit.json).

```jsonc
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

---

## Top level

| Field | Type | Purpose |
|---|---|---|
| `title` | string | Drawn above the schematic. |
| `description` | string | Prose about the circuit; not drawn. |
| `metadata` | object | `author`, `created`, `revision`, `course`, `difficulty`, `tags`, `license`. |
| `layout` | object | Spacing for the automatic layout (below). |
| `validation` | object | Rule severities and `supplyVoltage` (below). |
| `simulation` | object | Analyses, models and expected results for an external simulator. |
| `education` | object | Summary, theory, objectives, questions, experiments, troubleshooting. |
| `components` | array | **Required.** The parts. |
| `connections` | array | The nets. |
| `nets` | object | Alternative net form: `{ "VOUT": ["R1.2", "C1.1"] }`. |
| `measurements` | array | Probe markers drawn on the sheet. |
| `annotations` | array | Free text with a leader line. |
| `bom` | array | Bill of materials rows. |
| `junctions` | array | Informational only — dots are detected automatically. |

Unknown top-level fields produce an `UNKNOWN_FIELD` warning so typos surface instead of being ignored.

---

## Components

```jsonc
{
  "id": "Q1",                       // required, unique, no dots or spaces
  "type": "nmos",                   // required, type or alias
  "value": "IRLZ44N",               // drawn next to the part
  "label": "M1",                    // display name instead of the id
  "rotation": 90,                   // clockwise degrees, any angle ("angle" is an alias)
  "mirror": false,                  // mirrored before rotating
  "position": { "x": 320, "y": 180 },// world position of the part's first pin
  "section": "output",              // input | process | output | power
  "pinTypes": { "G": "in" },        // electrical type per pin
  "params": {
    "tolerance": "1%",
    "rating": { "power": "0.25W", "voltage": "55V", "current": "47A" },
    "footprint": "TO-220"
  },
  "bom": { "mpn": "IRLZ44NPBF", "manufacturer": "Infineon", "quantity": 1, "price": "1.20" },
  "education": { "purpose": "Low-side switch", "mistakes": ["Floating gate"] }
}
```

### Rotation

`rotation` turns the drawing **and** the pin coordinates together, so wires stay attached.
Any angle works, clockwise in degrees (`45`, `30`, `-90`…; `angle` is an alias). At a
non-right angle each pin connects at the nearest grid point just outside its lead, and the lead
is drawn out to it; wires leave along the pin's own direction. `mirror` flips horizontally first.
Leave `rotation` out and CircuitForge picks an orientation: sources stand up with + on top,
two-terminal parts that touch a rail hang towards it, and the rest lie flat along the signal flow.
Four two-terminal parts in a ring whose opposite corners are bridged — a bridge rectifier or a
Wheatstone bridge — are drawn as the textbook diamond at 45°, with the meter of a Wheatstone
bridge in the middle (turn this off with `"layout": { "bridges": false }`).

### Pins

Every symbol has named pins. Names are case-insensitive and have aliases:

| Part | Pins | Aliases |
|---|---|---|
| Resistor, capacitor, inductor… | `1`, `2` | — |
| Polarized capacitor | `positive`, `negative` | `+`, `-`, `1`, `2` |
| Diode, LED, zener | `anode`, `cathode` | `A`, `K`, `1`, `2` |
| Sources, battery | `positive`, `negative` | `+`, `-`, `1`, `2` |
| BJT | `B`, `C`, `E` | `base`, `collector`, `emitter` |
| MOSFET / JFET | `G`, `D`, `S` | `gate`, `drain`, `source` |
| Op-amp | `in+`, `in-`, `out`, `v+`, `v-` | `+`, `-`, `non_inverting`, `inverting`, `output` |
| 555 | `TRIG`, `THR`, `DIS`, `CV`, `RST`, `OUT`, `VCC`, `GND` | pin numbers `1`–`8` |
| Gates | `A`, `B`, `Y` | `1`, `2`, `3`, `in1`, `in2`, `out` |

The Components dialog in the app lists the pins of every type, and `CircuitForge.explain("npn")`
returns them with their electrical types.

**Box parts** (`generic_ic`, `microcontroller`, `memory`, `connector`, `arduino_uno`, `esp32`,
`stm32`, `rp2040`, `lcd`, …) let you define the pins yourself:

```jsonc
{ "id": "U1", "type": "generic_ic", "label": "74HC595",
  "pins": { "left": ["SER", "SRCLK", "RCLK", "~SRCLR", "~OE"],
            "right": ["QA", "QB", "QC", "QD"],
            "top": ["VCC"], "bottom": ["GND"] } }
```

A leading `~` draws an overline (active low). `"pins": 6` on a connector makes six pins;
an array splits evenly between left and right. Drawn symbols (resistor, transistor…) have
fixed pins and ignore this field.

### Electrical pin types

`pinTypes` (and the built-in defaults) drive the rule checks:

`in`, `out`, `passive`, `power_in`, `power_out`, `bidirectional`, `tristate`,
`open_collector`, `open_drain`, `unspecified`.

Two `out` pins on one net is an error; `tristate`, `open_drain` and `bidirectional` pins may
share a net, which is how buses work.

---

## Connections

A connection joins **two or more** pins into one net. Three equivalent forms:

```jsonc
["R1.2", "C1.1", "U1.in-"]                                  // multi-pin net
{ "from": "R1.2", "to": "C1.1" }                            // simple pair
{ "pins": ["R1.2", "C1.1"], "net": "VOUT", "class": "signal" }
```

| Field | Purpose |
|---|---|
| `net` | Name the net. Two entries with the same name are the same net. |
| `class` | `signal`, `power`, `ground`, `bus`, `analog`, `clock`, `differential`. |
| `waypoints` | Points the router must pass through: `[{ "x": 260, "y": 80 }]` or `[[260, 80]]`. |
| `route` | A complete manual orthogonal route, drawn exactly as given. |
| `locked` | Marks the route as manual so it survives moves. |

Junction dots are created wherever three or more wire ends meet — you never draw them.
Crossings between different nets get no dot; `bridges: true` in the render options draws a hop.

**Connectivity comes from this list only.** Two wires that happen to cross on the drawing are
not connected, and CircuitForge will never infer a connection from geometry.

### Rails and labels

`ground`, `agnd`, `dgnd`, `vcc`, `vdd`, `vss` and `net_label` are not placed as parts. They mark a
net, and the symbol is drawn at every pin on that net, the way hand-drawn schematics do it:

```jsonc
{ "id": "GND", "type": "ground" },
{ "id": "VCC", "type": "vcc", "value": "+5V" },
{ "id": "SIG", "type": "net_label", "value": "AUDIO_IN" }
```

Rails with the same name are one net, so a single `GND` component can appear in as many
connections as you like. `junction` is a virtual part that merges whatever connects to it.

---

## Layout

```jsonc
"layout": { "spacing": "comfortable" }
"layout": { "grid": 20, "componentGap": 60, "wireGap": 20, "labelGap": 15, "sectionGap": 100 }
```

| Field | Default | Meaning |
|---|---|---|
| `spacing` | `auto` | Preset for every gap: `compact`, `normal`, `comfortable`, `spacious`. `auto` uses comfortable up to 6 parts, normal up to 24 and a tighter set beyond. |
| `grid` | 10 | Placement grid, rounded to a multiple of the 10px routing grid. |
| `componentGap` | 40 | Gap between columns. Grows automatically where many nets cross. |
| `wireGap` | 16 | Clearance kept around each part; busier parts get a little more. |
| `labelGap` | 6 | Gap between a part and its text. |
| `sectionGap` | 60 | Gap between sub-circuits joined only through rails. |
| `bridges` | `true` | Draw bridge rectifiers and Wheatstone bridges as diamonds. |
| `optimize` | `true` | Let the spacing optimizer retry crowded layouts. |

Defaults shown are the `normal` preset. A number you set is always kept; the others follow the
preset. After routing, the layout is scored (routing fallbacks, wires through parts, labels on
wires, crossings, bends, wire length, area). If something collides, the optimizer widens only the
gap where the problem is — the column gap it sits in, or part clearance and label distance — and
tries again, up to four times, keeping the best sheet. The result is in `scene.layoutInfo`.

The default flow is inputs on the left, processing in the middle, outputs on the right, supply
symbols pointing up and grounds pointing down. `section` on a component overrides the band it
lands in; `position` overrides placement completely.

---

## Validation

```jsonc
"validation": {
  "supplyVoltage": 5,
  "rules": { "LED_NO_CURRENT_LIMIT": "error", "FLOATING_INPUT": "off" }
}
```

Levels are `off`, `info`, `warning`, `error`. Structural problems (bad JSON, unknown type,
missing pin) are always errors and stop the drawing; electrical findings never stop it.

| Area | Rules |
|---|---|
| Wiring | `DANGLING_NET`, `SHORTED_COMPONENT`, `SHORT_POWER_GROUND`, `WIRE_THROUGH_COMPONENT`, `WIRE_OVERLAP` |
| Analog | `LED_NO_CURRENT_LIMIT`, `DIODE_REVERSED`, `POLARIZED_CAP_REVERSED`, `MISSING_GROUND`, `RESISTOR_POWER`, `TRANSISTOR_SHORTED`, `TRANSISTOR_CONTROL_FLOATING`, `OPAMP_SUPPLY_REVERSED`, `OPAMP_SUPPLY_MISSING`, `SOURCE_SHORTED`, `REGULATOR_IO` |
| Digital | `OUTPUT_CONFLICT`, `OUTPUT_TIED_TO_RAIL`, `FLOATING_INPUT`, `IC_MISSING_POWER`, `CLOCK_TIED_TO_RAIL`, `COMBINATIONAL_LOOP` |

Each finding carries a message, a hint and often the formula to apply:

```json
{ "code": "LED_NO_CURRENT_LIMIT", "severity": "warning", "component": "D1",
  "message": "D1 has no series resistor: it will draw too much current and burn out.",
  "formula": "R = (Vsupply − Vf) / I",
  "hint": "With a 9V supply, a red LED (Vf ≈ 2 V) at 20 mA needs about 350Ω." }
```

---

## Measurements and annotations

```jsonc
"measurements": [
  { "type": "voltage", "at": "VOUT", "label": "V(out)", "expected": "3.33 V" },
  { "type": "current", "at": "R1.2", "label": "I(R1)" }
],
"annotations": [
  { "text": "Divider sets the threshold", "at": "R2", "dy": -40 },
  { "text": "Keep this loop short", "at": { "x": 300, "y": 120 }, "leader": false }
]
```

`at` accepts a net name, `"Component.pin"`, a component id, or explicit `{x, y}` coordinates.

---

## Education

```jsonc
"education": {
  "summary": "What this circuit does, in one or two sentences.",
  "theory": "The relationship the circuit demonstrates.",
  "objectives": ["Size an LED resistor", "Explain forward voltage"],
  "questions": ["What current flows with a 5 V supply?"],
  "experiments": ["Swap 220 Ω for 1 kΩ and compare brightness."],
  "troubleshooting": ["LED dark: check polarity first."]
}
```

The app shows this in **Learn**, together with the notes CircuitForge already knows for each
component type (purpose, formulas, common mistakes, truth tables for gates) and an explanation
of every rule that fired.

---

## Simulation metadata

```jsonc
"simulation": {
  "engine": "ngspice",
  "analyses": [{ "type": "transient", "stop": "50ms", "step": "10us" }],
  "models": { "Q1": "IRLZ44N" },
  "expected": { "frequency": "≈ 1.4 Hz", "ledCurrent": "≈ 9 mA" }
}
```

CircuitForge validates and preserves this block; it does not simulate. It is the place to keep
what a simulator (or a student with a meter) should find.
