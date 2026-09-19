/*! CircuitForge. Includes schematic symbols from chris-pikul/electronic-symbols, MIT License, (c) 2022 Chris Pikul. See LICENSE-electronic-symbols.txt */
(() => {
  // src/parser/index.js
  function parseJSON(text) {
    try {
      return { value: JSON.parse(text), errors: [] };
    } catch (e) {
      const found = findSyntaxError(String(text));
      const pos = found ? found.pos : 0;
      const before = String(text).slice(0, pos).split("\n");
      const line = before.length, column = before[before.length - 1].length + 1;
      const message = found ? `Invalid JSON at line ${line}, column ${column}: ${found.message}` : `Invalid JSON: ${e.message}`;
      return { value: null, errors: [{ code: "INVALID_JSON", message, line, column }] };
    }
  }
  function findSyntaxError(s) {
    let i = 0;
    const fail = (message) => {
      throw { pos: i, message };
    };
    const ws = () => {
      while (i < s.length && " 	\n\r".includes(s[i])) i++;
    };
    const describe = () => i >= s.length ? "unexpected end of input" : `unexpected ${JSON.stringify(s[i])}`;
    const value = () => {
      ws();
      const c = s[i];
      if (c === "{") {
        i++;
        ws();
        if (s[i] === "}") {
          i++;
          return;
        }
        for (; ; ) {
          ws();
          if (s[i] !== '"') fail(`${describe()}, expected a "quoted" property name`);
          string();
          ws();
          if (s[i] !== ":") fail(`${describe()}, expected ':'`);
          i++;
          value();
          ws();
          if (s[i] === ",") {
            i++;
            ws();
            if (s[i] === "}") fail("trailing comma before }");
            continue;
          }
          if (s[i] === "}") {
            i++;
            return;
          }
          fail(`${describe()}, expected ',' or '}'`);
        }
      }
      if (c === "[") {
        i++;
        ws();
        if (s[i] === "]") {
          i++;
          return;
        }
        for (; ; ) {
          ws();
          if (s[i] === "," || s[i] === "]") fail(s[i] === "]" ? "trailing comma before ]" : `${describe()}, expected a value`);
          value();
          ws();
          if (s[i] === ",") {
            i++;
            continue;
          }
          if (s[i] === "]") {
            i++;
            return;
          }
          fail(`${describe()}, expected ',' or ']'`);
        }
      }
      if (c === '"') return string();
      const m = /^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?|^(true|false|null)/.exec(s.slice(i, i + 400));
      if (m) {
        i += m[0].length;
        return;
      }
      fail(`${describe()}, expected a value`);
    };
    const string = () => {
      i++;
      while (i < s.length && s[i] !== '"') {
        if (s[i] === "\n") fail("unterminated string");
        if (s[i] === "\\") i++;
        i++;
      }
      if (i >= s.length) fail("unterminated string");
      i++;
    };
    try {
      value();
      ws();
      if (i < s.length) fail(`${describe()} after the end of the document`);
      return null;
    } catch (e) {
      return e && typeof e.pos === "number" ? e : null;
    }
  }
  function parseRef(ref) {
    if (typeof ref !== "string" || !ref.trim()) return null;
    const s = ref.trim();
    const i = s.indexOf(".");
    if (i === 0 || i === s.length - 1) return null;
    return i < 0 ? { comp: s, pin: null, raw: s } : { comp: s.slice(0, i), pin: s.slice(i + 1), raw: s };
  }
  function normalizeConnections(circuit) {
    const list = [];
    const push = (refs, name, path) => list.push({ refs, name: name || null, path });
    const conns = Array.isArray(circuit.connections) ? circuit.connections : [];
    conns.forEach((c, i) => {
      const path = `connections[${i}]`;
      if (Array.isArray(c)) push(c, null, path);
      else if (c && typeof c === "object") {
        if (Array.isArray(c.pins)) push(c.pins, c.net || c.name, path);
        else push([c.from, c.to], c.net || c.name, path);
      } else push(null, null, path);
    });
    if (circuit.nets && typeof circuit.nets === "object" && !Array.isArray(circuit.nets)) {
      for (const [name, refs] of Object.entries(circuit.nets)) push(Array.isArray(refs) ? refs : null, name, `nets.${name}`);
    }
    return list;
  }
  function parseCircuit(input) {
    if (typeof input === "string") {
      const r = parseJSON(input);
      if (r.errors.length) return { circuit: null, errors: r.errors };
      input = r.value;
    }
    if (input && typeof input === "object" && input.circuit && !input.components) input = input.circuit;
    return { circuit: input, errors: [] };
  }

  // src/symbol-loader/library.generated.js
  var library_generated_default = { "ac_source": { "type": "ac_source", "name": "AC voltage source", "category": "analog", "svg": "symbol.svg", "width": 60, "height": 60, "pins": { "positive": { "x": 30, "y": 0, "dir": "up" }, "negative": { "x": 30, "y": 60, "dir": "down" } }, "aliases": { "1": "positive", "2": "negative", "+": "positive", "-": "negative", "p": "positive", "n": "negative", "vcc": "positive", "gnd": "negative", "l": "positive" }, "body": { "x": 10, "y": 10, "w": 40, "h": 40 }, "prefix": "V", "required": ["positive", "negative"], "source": true, "typeAliases": ["ac", "sine_source"], "origin": { "library": "chris-pikul/electronic-symbols", "url": "https://github.com/chris-pikul/electronic-symbols", "license": "MIT", "copyright": "Copyright (c) 2022 Chris Pikul", "file": "SVG/Source-COM-AC.svg", "modified": "redrawn vertically (positive up) from the upstream geometry", "modified_note": "scaled 0.4, stroke normalized to currentColor" }, "svgBody": '<g transform="scale(0.4) translate(0 0)"><g fill="none" stroke="currentColor" stroke-miterlimit="10" stroke-width="4"><circle cx="75" cy="75" r="50"/><path d="M75 25V0m0 125v25M37 75.38s6.38-15.63 22.13-15.63 9.5 30.75 31.5 30.75S112 75.38 112 75.38"/></g></g>' }, "adc": { "type": "adc", "name": "ADC", "category": "ic", "svg": "symbol.svg", "width": 60, "height": 60, "pins": { "IN": { "x": 0, "y": 30, "dir": "left", "io": "in" }, "OUT": { "x": 60, "y": 30, "dir": "right", "io": "out" } }, "aliases": { "1": "IN", "2": "OUT", "ain": "IN", "dout": "OUT" }, "body": { "x": 10, "y": 15, "w": 40, "h": 30 }, "prefix": "U", "labels": "top", "typeAliases": ["analog_to_digital"], "origin": { "library": "chris-pikul/electronic-symbols", "url": "https://github.com/chris-pikul/electronic-symbols", "license": "MIT", "copyright": "Copyright (c) 2022 Chris Pikul", "file": "SVG/Miscellaneous-COM-ADC.svg", "modified_note": "scaled 0.4, stroke normalized to currentColor" }, "svgBody": '<g transform="scale(0.4) translate(0 0)"><path fill="none" stroke="currentColor" stroke-miterlimit="10" stroke-width="4" d="m25 75.06 37.5-37.5H125v75H62.5L25 75.06zm-25-.37h25m100 .37h25"/></g>' }, "and": { "type": "and", "name": "AND gate", "category": "digital", "svg": "symbol.svg", "width": 60, "height": 60, "pins": { "A": { "x": 0, "y": 20, "dir": "left", "io": "in" }, "B": { "x": 0, "y": 40, "dir": "left", "io": "in" }, "Y": { "x": 60, "y": 30, "dir": "right", "io": "out" } }, "aliases": { "1": "A", "2": "B", "3": "Y", "in1": "A", "in2": "B", "out": "Y", "q": "Y", "o": "Y", "output": "Y" }, "body": { "x": 12.4, "y": 15, "w": 32.6, "h": 30 }, "prefix": "U", "labels": "top", "typeAliases": ["and_gate"], "origin": { "library": "chris-pikul/electronic-symbols", "url": "https://github.com/chris-pikul/electronic-symbols", "license": "MIT", "copyright": "Copyright (c) 2022 Chris Pikul", "file": "SVG/IC-COM-Logic-AND.svg", "modified_note": "scaled 0.4, stroke normalized to currentColor" }, "svgBody": '<g transform="scale(0.4) translate(0 0)"><path fill="none" stroke="currentColor" stroke-miterlimit="10" stroke-width="4" d="M31.25 37.5h25c18.75 0 56.25 0 56.25 37.5S75 112.5 56.25 112.5h-25ZM0 49.81h31.25M0 100.06h31.25M112.5 75H150"/></g>' }, "battery": { "type": "battery", "name": "Battery", "category": "power", "svg": "symbol.svg", "width": 60, "height": 60, "pins": { "positive": { "x": 30, "y": 0, "dir": "up" }, "negative": { "x": 30, "y": 60, "dir": "down" } }, "aliases": { "1": "positive", "2": "negative", "+": "positive", "-": "negative", "p": "positive", "n": "negative", "vcc": "positive", "gnd": "negative" }, "body": { "x": 18, "y": 10, "w": 28, "h": 38 }, "prefix": "BT", "required": ["positive", "negative"], "source": true, "typeAliases": ["cell"], "origin": { "library": "chris-pikul/electronic-symbols", "url": "https://github.com/chris-pikul/electronic-symbols", "license": "MIT", "copyright": "Copyright (c) 2022 Chris Pikul", "file": "SVG/Source-COM-Battery-Single.svg", "modified": "redrawn vertically (positive up) from the upstream geometry", "modified_note": "scaled 0.4, stroke normalized to currentColor" }, "svgBody": '<g transform="scale(0.4) translate(0 0)"><g fill="none" stroke="currentColor" stroke-miterlimit="10" stroke-width="4"><path d="M50 65.75h50M62.5 84.25h25M75 65.75V0m0 84.25V150M87.5 37.5h25M100 25v25M87.5 112.5h25"/></g></g>' }, "buffer": { "type": "buffer", "name": "Buffer", "category": "digital", "svg": "symbol.svg", "width": 60, "height": 60, "pins": { "A": { "x": 0, "y": 30, "dir": "left", "io": "in" }, "Y": { "x": 60, "y": 30, "dir": "right", "io": "out" } }, "aliases": { "1": "A", "2": "Y", "in": "A", "out": "Y", "input": "A", "output": "Y" }, "body": { "x": 10, "y": 15, "w": 35, "h": 30 }, "prefix": "U", "labels": "top", "origin": { "library": "chris-pikul/electronic-symbols", "url": "https://github.com/chris-pikul/electronic-symbols", "license": "MIT", "copyright": "Copyright (c) 2022 Chris Pikul", "file": "SVG/IC-COM-Logic-Buffer.svg", "modified_note": "scaled 0.4, stroke normalized to currentColor" }, "svgBody": '<g transform="scale(0.4) translate(0 0)"><path fill="none" stroke="currentColor" stroke-miterlimit="10" stroke-width="4" d="M25 37.5v75L112.5 75 25 37.5zM25 75H0m112.5 0H150"/></g>' }, "capacitor": { "type": "capacitor", "name": "Capacitor", "category": "passive", "svg": "symbol.svg", "width": 60, "height": 60, "pins": { "1": { "x": 0, "y": 30, "dir": "left" }, "2": { "x": 60, "y": 30, "dir": "right" } }, "body": { "x": 20, "y": 17.6, "w": 15.2, "h": 24.8 }, "prefix": "C", "typeAliases": ["cap", "c"], "origin": { "library": "chris-pikul/electronic-symbols", "url": "https://github.com/chris-pikul/electronic-symbols", "license": "MIT", "copyright": "Copyright (c) 2022 Chris Pikul", "file": "SVG/Capacitor-IEEE-NonPolarized.svg", "modified_note": "scaled 0.4, stroke normalized to currentColor" }, "svgBody": '<g transform="scale(0.4) translate(0 0)"><path fill="none" stroke="currentColor" stroke-miterlimit="10" stroke-width="4" d="M150 74.97H84.5M0 75.25h66.5M54 44s12.5 12.25 12.5 31S54 106 54 106m30.5-62v62"/></g>' }, "capacitor_polarized": { "type": "capacitor_polarized", "name": "Polarized capacitor", "category": "passive", "svg": "symbol.svg", "width": 60, "height": 60, "pins": { "negative": { "x": 0, "y": 30, "dir": "left" }, "positive": { "x": 60, "y": 30, "dir": "right" } }, "aliases": { "1": "positive", "2": "negative", "+": "positive", "-": "negative" }, "body": { "x": 20, "y": 12, "w": 33.6, "h": 30.4 }, "prefix": "C", "typeAliases": ["electrolytic", "polarized_capacitor"], "origin": { "library": "chris-pikul/electronic-symbols", "url": "https://github.com/chris-pikul/electronic-symbols", "license": "MIT", "copyright": "Copyright (c) 2022 Chris Pikul", "file": "SVG/Capacitor-IEEE-Polarized.svg", "modified_note": "scaled 0.4, stroke normalized to currentColor" }, "svgBody": '<g transform="scale(0.4) translate(0 0)"><path fill="none" stroke="currentColor" stroke-miterlimit="10" stroke-width="4" d="M150 74.97H84.5M0 75.25h66.5M54 44s12.5 12.25 12.5 31S54 106 54 106m30.5-62v62m46.75-56h-25m12.5-12.5v25"/></g>' }, "comparator": { "type": "comparator", "name": "Comparator", "category": "analog", "svg": "symbol.svg", "width": 60, "height": 60, "pins": { "in+": { "x": 0, "y": 20, "dir": "left", "io": "in" }, "in-": { "x": 0, "y": 40, "dir": "left", "io": "in" }, "out": { "x": 60, "y": 30, "dir": "right", "io": "out" } }, "aliases": { "+": "in+", "-": "in-", "inp": "in+", "inn": "in-", "output": "out" }, "body": { "x": 10, "y": 10, "w": 40, "h": 40 }, "prefix": "U", "labels": "topright", "required": ["in+", "in-", "out"], "origin": { "library": "chris-pikul/electronic-symbols", "url": "https://github.com/chris-pikul/electronic-symbols", "license": "MIT", "copyright": "Copyright (c) 2022 Chris Pikul", "file": "SVG/IC-COM-Comparator.svg", "modified_note": "scaled 0.4, stroke normalized to currentColor" }, "svgBody": '<g transform="scale(0.4) translate(0 0)"><path fill="none" stroke="currentColor" stroke-miterlimit="10" stroke-width="4" d="M25 25v100l100-50L25 25zm0 25H0m125 25h25M0 100h25m9.5-47H53m-9.25-9.25v18.5M34.5 97H53"/></g>' }, "connector": { "type": "connector", "name": "Connector", "category": "power", "kind": "box", "label": "", "pins": { "right": ["1", "2", "3", "4"] }, "prefix": "J", "io": "passive", "typeAliases": ["header", "conn"], "origin": { "library": "CircuitForge", "license": "same as the CircuitForge project", "note": "original CircuitForge symbol" } }, "counter": { "type": "counter", "name": "Counter", "category": "digital", "kind": "box", "label": "CTR", "pins": { "left": ["CLK", "~CLR", "EN"], "right": ["Q0", "Q1", "Q2", "Q3"] }, "prefix": "U", "typeAliases": ["binary_counter"], "origin": { "library": "CircuitForge", "license": "same as the CircuitForge project", "note": "original CircuitForge symbol" } }, "crystal": { "type": "crystal", "name": "Crystal", "category": "passive", "svg": "symbol.svg", "width": 60, "height": 60, "pins": { "1": { "x": 0, "y": 30, "dir": "left" }, "2": { "x": 60, "y": 30, "dir": "right" } }, "body": { "x": 14, "y": 10, "w": 32, "h": 40 }, "prefix": "Y", "typeAliases": ["xtal"], "origin": { "library": "chris-pikul/electronic-symbols", "url": "https://github.com/chris-pikul/electronic-symbols", "license": "MIT", "copyright": "Copyright (c) 2022 Chris Pikul", "file": "SVG/Miscellaneous-COM-Crystal_Oscillator.svg", "modified_note": "scaled 0.4, stroke normalized to currentColor" }, "svgBody": '<g transform="scale(0.4) translate(0 0)"><path fill="none" stroke="currentColor" stroke-miterlimit="10" stroke-width="4" d="M50 25h50v100H50zM37.5 43.75v62.5m75-62.5v62.5M0 74.63h37.5m75 .37H150"/></g>' }, "current_source": { "type": "current_source", "name": "Current source", "category": "analog", "svg": "symbol.svg", "width": 60, "height": 60, "pins": { "positive": { "x": 30, "y": 0, "dir": "up" }, "negative": { "x": 30, "y": 60, "dir": "down" } }, "aliases": { "1": "positive", "2": "negative", "+": "positive", "-": "negative", "p": "positive", "n": "negative", "vcc": "positive", "gnd": "negative" }, "body": { "x": 10, "y": 10, "w": 40, "h": 40 }, "prefix": "I", "required": ["positive", "negative"], "source": true, "typeAliases": ["isource"], "origin": { "library": "chris-pikul/electronic-symbols", "url": "https://github.com/chris-pikul/electronic-symbols", "license": "MIT", "copyright": "Copyright (c) 2022 Chris Pikul", "file": "SVG/Source-COM-Current.svg", "modified": "redrawn vertically (positive up) from the upstream geometry", "modified_note": "scaled 0.4, stroke normalized to currentColor" }, "svgBody": '<g transform="scale(0.4) translate(0 0)"><g fill="none" stroke="currentColor" stroke-miterlimit="10" stroke-width="4"><circle cx="75" cy="75" r="50"/><path d="M75 25V0m0 125v25M75 112.5V59"/></g><path fill="currentColor" d="M60.04 63.41 75 37.5l14.96 25.91z"/></g>' }, "d_flipflop": { "type": "d_flipflop", "name": "D flip-flop", "category": "digital", "svg": "symbol.svg", "width": 60, "height": 60, "pins": { "D": { "x": 0, "y": 20, "dir": "left", "io": "in" }, "CLK": { "x": 0, "y": 40, "dir": "left", "io": "in" }, "Q": { "x": 60, "y": 20, "dir": "right", "io": "out" }, "QN": { "x": 60, "y": 40, "dir": "right", "io": "out" }, "S": { "x": 30, "y": 0, "dir": "up", "io": "in" }, "R": { "x": 30, "y": 60, "dir": "down", "io": "in" } }, "aliases": { "q\u0304": "QN", "q_bar": "QN", "qbar": "QN", "nq": "QN", "~q": "QN", "clock": "CLK", "clk": "CLK", "set": "S", "pre": "S", "preset": "S", "reset": "R", "clr": "R", "clear": "R" }, "body": { "x": 10, "y": 5, "w": 40, "h": 50 }, "prefix": "U", "labels": "top", "required": ["D", "CLK"], "typeAliases": ["dff", "flipflop_d"], "origin": { "library": "chris-pikul/electronic-symbols", "url": "https://github.com/chris-pikul/electronic-symbols", "license": "MIT", "copyright": "Copyright (c) 2022 Chris Pikul", "file": "SVG/IC-COM-FlipFlop-ClockedD.svg", "modified_note": "scaled 0.4, stroke normalized to currentColor" }, "svgBody": '<g transform="scale(0.4) translate(0 0)"><path fill="none" stroke="currentColor" stroke-miterlimit="10" stroke-width="4" d="M25 12.5h100v125H25zM25 50H0m25 50H0m125-50h25m-25 50h25"/>\r<path fill="currentColor" d="m111.57 53.9 2 1.29-1.36 3.16-2-1.44a4.78 4.78 0 0 1-4 2.34 5.08 5.08 0 0 1-4.48-2.46 12.52 12.52 0 0 1-1.73-6.91 12.5 12.5 0 0 1 1.62-6.88 5.15 5.15 0 0 1 8.79 0 12.5 12.5 0 0 1 1.59 6.88c0 3.18-.43 4.02-.43 4.02Zm-2.37-1.33a13.51 13.51 0 0 0 .24-2.69 9.25 9.25 0 0 0-.94-4.7 2.76 2.76 0 0 0-5 0 9.22 9.22 0 0 0-1 4.69 9.44 9.44 0 0 0 1 4.75 2.84 2.84 0 0 0 2.41 1.58 2.41 2.41 0 0 0 1.9-.85l-2-1.44 1.52-2.66m4.24 52.65 2 1.29-1.36 3.16-2-1.44a4.78 4.78 0 0 1-4 2.34 5.08 5.08 0 0 1-4.48-2.46 12.52 12.52 0 0 1-1.73-6.91 12.5 12.5 0 0 1 1.62-6.88 5.15 5.15 0 0 1 8.79 0 12.5 12.5 0 0 1 1.59 6.88c0 3.18-.43 4.02-.43 4.02Zm-2.37-1.33a13.51 13.51 0 0 0 .24-2.69 9.25 9.25 0 0 0-.94-4.7 2.76 2.76 0 0 0-5 0 9.22 9.22 0 0 0-1 4.69 9.44 9.44 0 0 0 1 4.75 2.84 2.84 0 0 0 2.41 1.58 2.41 2.41 0 0 0 1.9-.85l-2-1.44 1.52-2.66"/>\r<path fill="none" stroke="currentColor" stroke-miterlimit="10" stroke-width="4" d="M97 84.25h18.75"/>\r<path fill="currentColor" d="M37.5 40.79H43a8.67 8.67 0 0 1 2.84.35 5 5 0 0 1 2.25 1.7 8.56 8.56 0 0 1 1.42 3 16.43 16.43 0 0 1 .49 4.35 14.62 14.62 0 0 1-.46 3.93A8.69 8.69 0 0 1 48 57.39a5.17 5.17 0 0 1-2.12 1.47 7.44 7.44 0 0 1-2.66.39H37.5Zm3 3.12v12.23h2.25a6.53 6.53 0 0 0 1.83-.14 2.53 2.53 0 0 0 1.21-.77 4.06 4.06 0 0 0 .79-1.78 14.31 14.31 0 0 0 .31-3.45 13.2 13.2 0 0 0-.31-3.29 4.48 4.48 0 0 0-.85-1.71 2.7 2.7 0 0 0-1.4-.87 10.82 10.82 0 0 0-2.47-.18Zm27.75-6.38 3.14-.34a4.57 4.57 0 0 0 1.15 2.63 3.23 3.23 0 0 0 2.34.84 3.3 3.3 0 0 0 2.35-.75 2.32 2.32 0 0 0 .77-1.75 1.79 1.79 0 0 0-.33-1.09 2.7 2.7 0 0 0-1.16-.79c-.38-.14-1.24-.41-2.59-.79a8.24 8.24 0 0 1-3.62-1.79 5 5 0 0 1-1.47-3.64 5.1 5.1 0 0 1 .69-2.59 4.49 4.49 0 0 1 2-1.84 7.19 7.19 0 0 1 3.14-.63 6.19 6.19 0 0 1 4.53 1.5 5.55 5.55 0 0 1 1.6 4l-3.23.16a3.2 3.2 0 0 0-.89-2 2.94 2.94 0 0 0-2-.61 3.39 3.39 0 0 0-2.2.65 1.37 1.37 0 0 0-.52 1.13 1.47 1.47 0 0 0 .48 1.1 7.91 7.91 0 0 0 3 1.21 14.32 14.32 0 0 1 3.48 1.3 4.74 4.74 0 0 1 1.77 1.84 5.94 5.94 0 0 1 .64 2.89 5.86 5.86 0 0 1-.76 2.92 4.8 4.8 0 0 1-2.16 2 8.12 8.12 0 0 1-3.48.66 6.39 6.39 0 0 1-4.66-1.59 7.31 7.31 0 0 1-2.01-4.63Zm.5 87.47v-18.46h5.91a7.88 7.88 0 0 1 3.24.49 3.65 3.65 0 0 1 1.61 1.77 6.62 6.62 0 0 1 .61 2.91 6 6 0 0 1-.92 3.43 4 4 0 0 1-2.75 1.71A7.06 7.06 0 0 1 78 118.4a21.07 21.07 0 0 1 1.6 3l1.7 3.6h-3.41l-2-4a25.94 25.94 0 0 0-1.48-2.71 2.14 2.14 0 0 0-.84-.77 3.53 3.53 0 0 0-1.41-.21h-.57V125Zm2.81-10.66h2.07a8.35 8.35 0 0 0 2.53-.22 1.64 1.64 0 0 0 .78-.78 3 3 0 0 0 .29-1.39 2.69 2.69 0 0 0-.38-1.5 1.61 1.61 0 0 0-1-.73 18.74 18.74 0 0 0-2-.06h-2.29Z"/>\r<path fill="none" stroke="currentColor" stroke-width="4" d="M75.28 0v12.5M74.72 150v-12.5"/>\r<path fill="none" stroke="currentColor" stroke-miterlimit="10" stroke-width="4" d="M25 87.5 50 100l-25 12.5v-25z"/></g>' }, "dac": { "type": "dac", "name": "DAC", "category": "ic", "svg": "symbol.svg", "width": 60, "height": 60, "pins": { "IN": { "x": 0, "y": 30, "dir": "left", "io": "in" }, "OUT": { "x": 60, "y": 30, "dir": "right", "io": "out" } }, "aliases": { "1": "IN", "2": "OUT", "din": "IN", "aout": "OUT" }, "body": { "x": 10, "y": 15, "w": 40, "h": 30 }, "prefix": "U", "labels": "top", "typeAliases": ["digital_to_analog"], "origin": { "library": "chris-pikul/electronic-symbols", "url": "https://github.com/chris-pikul/electronic-symbols", "license": "MIT", "copyright": "Copyright (c) 2022 Chris Pikul", "file": "SVG/Miscellaneous-COM-DAC.svg", "modified_note": "scaled 0.4, stroke normalized to currentColor" }, "svgBody": '<g transform="scale(0.4) translate(0 0)"><path fill="none" stroke="currentColor" stroke-miterlimit="10" stroke-width="4" d="m125 75.06-37.5-37.5H25v75h62.5l37.5-37.5zM0 74.69h25m100 .37h25"/></g>' }, "dc_source": { "type": "dc_source", "name": "DC voltage source", "category": "analog", "svg": "symbol.svg", "width": 60, "height": 60, "pins": { "positive": { "x": 30, "y": 0, "dir": "up" }, "negative": { "x": 30, "y": 60, "dir": "down" } }, "aliases": { "1": "positive", "2": "negative", "+": "positive", "-": "negative", "p": "positive", "n": "negative", "vcc": "positive", "gnd": "negative" }, "body": { "x": 10, "y": 10, "w": 40, "h": 40 }, "prefix": "V", "required": ["positive", "negative"], "source": true, "typeAliases": ["dc_supply", "voltage_source", "vsource", "dc"], "origin": { "library": "chris-pikul/electronic-symbols", "url": "https://github.com/chris-pikul/electronic-symbols", "license": "MIT", "copyright": "Copyright (c) 2022 Chris Pikul", "file": "SVG/Source-COM-DC.svg", "modified": "redrawn vertically (positive up) from the upstream geometry", "modified_note": "scaled 0.4, stroke normalized to currentColor" }, "svgBody": '<g transform="scale(0.4) translate(0 0)"><g fill="none" stroke="currentColor" stroke-miterlimit="10" stroke-width="4"><circle cx="75" cy="75" r="50"/><path d="M75 25V0m0 125v25M62.5 50h25M75 37.5v25M62.5 100h25"/></g></g>' }, "decoder": { "type": "decoder", "name": "Decoder", "category": "digital", "kind": "box", "label": "DEC", "pins": { "left": ["A0", "A1", "EN"], "right": ["Y0", "Y1", "Y2", "Y3"] }, "prefix": "U", "origin": { "library": "CircuitForge", "license": "same as the CircuitForge project", "note": "original CircuitForge symbol" } }, "demux": { "type": "demux", "name": "Demultiplexer", "category": "digital", "kind": "box", "label": "DEMUX", "pins": { "left": ["D"], "right": ["Y0", "Y1", "Y2", "Y3"], "bottom": ["S0", "S1"] }, "prefix": "U", "typeAliases": ["demultiplexer"], "origin": { "library": "CircuitForge", "license": "same as the CircuitForge project", "note": "original CircuitForge symbol" } }, "diode": { "type": "diode", "name": "Diode", "category": "semiconductor", "svg": "symbol.svg", "width": 60, "height": 60, "pins": { "anode": { "x": 0, "y": 30, "dir": "left", "io": "in" }, "cathode": { "x": 60, "y": 30, "dir": "right", "io": "out" } }, "aliases": { "1": "anode", "2": "cathode", "a": "anode", "k": "cathode", "+": "anode", "-": "cathode" }, "body": { "x": 20, "y": 16, "w": 20, "h": 28 }, "prefix": "D", "typeAliases": ["d"], "origin": { "library": "chris-pikul/electronic-symbols", "url": "https://github.com/chris-pikul/electronic-symbols", "license": "MIT", "copyright": "Copyright (c) 2022 Chris Pikul", "file": "SVG/Diode-COM-Standard.svg", "modified_note": "scaled 0.4, stroke normalized to currentColor" }, "svgBody": '<g transform="scale(0.4) translate(0 0)"><path fill="none" stroke="currentColor" stroke-miterlimit="10" stroke-width="4" d="m100 75-50 31.25v-62.5L100 75zm0-34.25v68.5M50 75H0m100 0h50"/></g>' }, "encoder": { "type": "encoder", "name": "Encoder", "category": "digital", "kind": "box", "label": "ENC", "pins": { "left": ["I0", "I1", "I2", "I3"], "right": ["Y0", "Y1"] }, "prefix": "U", "typeAliases": ["priority_encoder"], "origin": { "library": "CircuitForge", "license": "same as the CircuitForge project", "note": "original CircuitForge symbol" } }, "fuse": { "type": "fuse", "name": "Fuse", "category": "passive", "svg": "symbol.svg", "width": 60, "height": 60, "pins": { "1": { "x": 0, "y": 30, "dir": "left" }, "2": { "x": 60, "y": 30, "dir": "right" } }, "body": { "x": 10, "y": 20, "w": 40, "h": 20 }, "prefix": "F", "origin": { "library": "chris-pikul/electronic-symbols", "url": "https://github.com/chris-pikul/electronic-symbols", "license": "MIT", "copyright": "Copyright (c) 2022 Chris Pikul", "file": "SVG/Fuse-IEEE.svg", "modified_note": "scaled 0.4, stroke normalized to currentColor" }, "svgBody": '<g transform="scale(0.4) translate(0 0)"><path fill="none" stroke="currentColor" stroke-miterlimit="10" stroke-width="4" d="M0 74.88h150M25 50h100v50H25z"/></g>' }, "generic_ic": { "type": "generic_ic", "name": "Generic IC", "category": "ic", "kind": "box", "label": "IC", "pins": { "left": ["1", "2", "3", "4"], "right": ["8", "7", "6", "5"] }, "prefix": "U", "typeAliases": ["ic", "chip"], "origin": { "library": "CircuitForge", "license": "same as the CircuitForge project", "note": "original CircuitForge symbol" } }, "ground": { "type": "ground", "name": "Ground", "category": "power", "svg": "symbol.svg", "width": 60, "height": 60, "pins": { "1": { "x": 30, "y": 0, "dir": "up" } }, "aliases": { "gnd": "1" }, "body": { "x": 10, "y": 28, "w": 40, "h": 23.2 }, "rail": "ground", "typeAliases": ["gnd", "earth"], "origin": { "library": "chris-pikul/electronic-symbols", "url": "https://github.com/chris-pikul/electronic-symbols", "license": "MIT", "copyright": "Copyright (c) 2022 Chris Pikul", "file": "SVG/Ground-COM-General.svg", "modified_note": "scaled 0.4, stroke normalized to currentColor" }, "svgBody": '<g transform="scale(0.4) translate(0 0)"><path fill="none" stroke="currentColor" stroke-miterlimit="10" stroke-width="4" d="M75 0v75m-50 0h100m-56.25 50h12.5M50 100h50"/></g>' }, "inductor": { "type": "inductor", "name": "Inductor", "category": "passive", "svg": "symbol.svg", "width": 60, "height": 60, "pins": { "1": { "x": 0, "y": 30, "dir": "left" }, "2": { "x": 60, "y": 30, "dir": "right" } }, "body": { "x": 4.8, "y": 21.6, "w": 50.4, "h": 9.6 }, "prefix": "L", "typeAliases": ["coil", "l"], "origin": { "library": "chris-pikul/electronic-symbols", "url": "https://github.com/chris-pikul/electronic-symbols", "license": "MIT", "copyright": "Copyright (c) 2022 Chris Pikul", "file": "SVG/Inductor-COM-Air.svg", "modified_note": "scaled 0.4, stroke normalized to currentColor" }, "svgBody": '<g transform="scale(0.4) translate(0 0)"><path fill="none" stroke="currentColor" stroke-linejoin="round" stroke-width="4" d="M0 75.13h12.5s0-18.82 15.63-18.82S43.75 75 43.75 75s0-18.75 15.63-18.75S75 75 75 75s0-18.75 15.63-18.75S106.25 75 106.25 75s0-18.75 15.63-18.75S137.5 75 137.5 75H150"/></g>' }, "input": { "type": "input", "name": "Input terminal", "category": "power", "width": 40, "height": 20, "pins": { "1": { "x": 40, "y": 10, "dir": "right", "io": "out" } }, "body": { "x": 0, "y": 4, "w": 12, "h": 12 }, "terminal": "input", "labels": "none", "text": { "x": -4, "y": 14, "anchor": "end", "default": "$id" }, "prefix": "IN", "typeAliases": ["input_terminal", "in", "port_in"], "svg": "symbol.svg", "origin": { "library": "CircuitForge", "license": "same as the CircuitForge project", "note": "original CircuitForge symbol" }, "svgBody": '<g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="6" cy="10" r="4"/><path d="M10 10h30"/></g>' }, "jfet": { "type": "jfet", "name": "N-channel JFET", "category": "semiconductor", "svg": "symbol.svg", "width": 60, "height": 60, "pins": { "G": { "x": 0, "y": 30, "dir": "left", "io": "in" }, "D": { "x": 40, "y": 0, "dir": "up" }, "S": { "x": 40, "y": 60, "dir": "down" } }, "aliases": { "gate": "G", "drain": "D", "source": "S" }, "body": { "x": 10, "y": 10, "w": 40, "h": 40 }, "prefix": "Q", "labels": "right", "required": ["G", "D", "S"], "typeAliases": ["jfet_n", "njfet"], "origin": { "library": "chris-pikul/electronic-symbols", "url": "https://github.com/chris-pikul/electronic-symbols", "license": "MIT", "copyright": "Copyright (c) 2022 Chris Pikul", "file": "SVG/Transistor-COM-JFET-N.svg", "modified_note": "scaled 0.4, stroke normalized to currentColor" }, "svgBody": '<g transform="scale(0.4) translate(0 0)"><circle cx="75" cy="75" r="50" fill="none" stroke="currentColor" stroke-miterlimit="10" stroke-width="4"/>\r<path fill="none" stroke="currentColor" stroke-miterlimit="10" stroke-width="4" d="M0 75h56.25m0-31.25v62.5"/>\r<path fill="currentColor" d="M56.25 75 37.5 87.5v-25L56.25 75z"/>\r<path fill="none" stroke="currentColor" stroke-miterlimit="10" stroke-width="4" d="M99.66 0v56.25H56.25M99.66 150V93.75H56.25"/></g>' }, "jfet_p": { "type": "jfet_p", "name": "P-channel JFET", "category": "semiconductor", "svg": "symbol.svg", "width": 60, "height": 60, "pins": { "G": { "x": 0, "y": 30, "dir": "left", "io": "in" }, "S": { "x": 40, "y": 0, "dir": "up" }, "D": { "x": 40, "y": 60, "dir": "down" } }, "aliases": { "gate": "G", "drain": "D", "source": "S" }, "body": { "x": 10, "y": 10, "w": 40, "h": 40 }, "prefix": "Q", "labels": "right", "required": ["G", "D", "S"], "typeAliases": ["pjfet"], "origin": { "library": "chris-pikul/electronic-symbols", "url": "https://github.com/chris-pikul/electronic-symbols", "license": "MIT", "copyright": "Copyright (c) 2022 Chris Pikul", "file": "SVG/Transistor-COM-JFET-P.svg", "modified_note": "scaled 0.4, stroke normalized to currentColor" }, "svgBody": '<g transform="scale(0.4) translate(0 0)"><circle cx="75" cy="75" r="50" fill="none" stroke="currentColor" stroke-miterlimit="10" stroke-width="4"/>\r<path fill="none" stroke="currentColor" stroke-miterlimit="10" stroke-width="4" d="M0 75h56.25m0-31.25v62.5"/>\r<path fill="currentColor" d="M31.25 75 50 62.5v25L31.25 75z"/>\r<path fill="none" stroke="currentColor" stroke-miterlimit="10" stroke-width="4" d="M99.66 0v56.25H56.25M99.66 150V93.75H56.25"/></g>' }, "jk_flipflop": { "type": "jk_flipflop", "name": "JK flip-flop", "category": "digital", "svg": "symbol.svg", "width": 60, "height": 60, "pins": { "J": { "x": 0, "y": 20, "dir": "left", "io": "in" }, "CLK": { "x": 0, "y": 30, "dir": "left", "io": "in" }, "K": { "x": 0, "y": 40, "dir": "left", "io": "in" }, "Q": { "x": 60, "y": 20, "dir": "right", "io": "out" }, "QN": { "x": 60, "y": 40, "dir": "right", "io": "out" } }, "aliases": { "q\u0304": "QN", "q_bar": "QN", "qbar": "QN", "nq": "QN", "~q": "QN", "clock": "CLK", "clk": "CLK" }, "body": { "x": 10, "y": 5, "w": 40, "h": 50 }, "prefix": "U", "labels": "top", "required": ["J", "K", "CLK"], "typeAliases": ["jkff", "flipflop_jk"], "origin": { "library": "chris-pikul/electronic-symbols", "url": "https://github.com/chris-pikul/electronic-symbols", "license": "MIT", "copyright": "Copyright (c) 2022 Chris Pikul", "file": "SVG/IC-COM-FlipFlop-ClockedJK.svg", "modified_note": "scaled 0.4, stroke normalized to currentColor" }, "svgBody": '<g transform="scale(0.4) translate(0 0)"><path fill="none" stroke="currentColor" stroke-miterlimit="10" stroke-width="4" d="M25 12.5h100v125H25zM25 50H0m25 50H0m125-50h25m-25 50h25"/>\r<path fill="currentColor" d="m111.57 53.9 2 1.29-1.36 3.16-2-1.44a4.78 4.78 0 0 1-4 2.34 5.08 5.08 0 0 1-4.48-2.46 12.52 12.52 0 0 1-1.73-6.91 12.5 12.5 0 0 1 1.62-6.88 5.15 5.15 0 0 1 8.79 0 12.5 12.5 0 0 1 1.59 6.88c0 3.18-.43 4.02-.43 4.02Zm-2.37-1.33a13.51 13.51 0 0 0 .24-2.69 9.25 9.25 0 0 0-.94-4.7 2.76 2.76 0 0 0-5 0 9.22 9.22 0 0 0-1 4.69 9.44 9.44 0 0 0 1 4.75 2.84 2.84 0 0 0 2.41 1.58 2.41 2.41 0 0 0 1.9-.85l-2-1.44 1.52-2.66m4.24 52.65 2 1.29-1.36 3.16-2-1.44a4.78 4.78 0 0 1-4 2.34 5.08 5.08 0 0 1-4.48-2.46 12.52 12.52 0 0 1-1.73-6.91 12.5 12.5 0 0 1 1.62-6.88 5.15 5.15 0 0 1 8.79 0 12.5 12.5 0 0 1 1.59 6.88c0 3.18-.43 4.02-.43 4.02Zm-2.37-1.33a13.51 13.51 0 0 0 .24-2.69 9.25 9.25 0 0 0-.94-4.7 2.76 2.76 0 0 0-5 0 9.22 9.22 0 0 0-1 4.69 9.44 9.44 0 0 0 1 4.75 2.84 2.84 0 0 0 2.41 1.58 2.41 2.41 0 0 0 1.9-.85l-2-1.44 1.52-2.66"/>\r<path fill="none" stroke="currentColor" stroke-miterlimit="10" stroke-width="4" d="M97 84.25h18.75M25 62.5 50 75 25 87.5v-25zM0 74.53h25.06"/>\r<path fill="currentColor" d="M46.13 40.5h3.93v11.67a11.4 11.4 0 0 1-.42 3.52 5.12 5.12 0 0 1-2.08 2.59 7.23 7.23 0 0 1-4 1 6.11 6.11 0 0 1-4.46-1.53c-1-1-1.56-3.75-1.57-5.72h3.72a9.46 9.46 0 0 0 .49 3.07 2.16 2.16 0 0 0 1.95 1 2.21 2.21 0 0 0 1.86-.71 5.29 5.29 0 0 0 .55-3ZM37.56 109V90.5h2.8v8.2L46 90.5h3.76l-5.22 7.19L50.06 109h-3.62l-3.81-8.66-2.27 3.08V109Z"/></g>' }, "junction": { "type": "junction", "name": "Junction", "category": "power", "kind": "virtual", "pins": { "1": { "x": 0, "y": 0, "dir": "left" } }, "typeAliases": ["node", "dot"], "origin": { "library": "CircuitForge", "license": "same as the CircuitForge project", "note": "original CircuitForge symbol" } }, "led": { "type": "led", "name": "LED", "category": "semiconductor", "svg": "symbol.svg", "width": 60, "height": 60, "pins": { "anode": { "x": 0, "y": 30, "dir": "left", "io": "in" }, "cathode": { "x": 60, "y": 30, "dir": "right", "io": "out" } }, "aliases": { "1": "anode", "2": "cathode", "a": "anode", "k": "cathode", "+": "anode", "-": "cathode" }, "body": { "x": 20, "y": 1.6, "w": 38.4, "h": 42.4 }, "prefix": "D", "origin": { "library": "chris-pikul/electronic-symbols", "url": "https://github.com/chris-pikul/electronic-symbols", "license": "MIT", "copyright": "Copyright (c) 2022 Chris Pikul", "file": "SVG/Diode-COM-LED.svg", "modified_note": "scaled 0.4, stroke normalized to currentColor" }, "svgBody": '<g transform="scale(0.4) translate(0 0)"><path fill="none" stroke="currentColor" stroke-miterlimit="10" stroke-width="4" d="m100 75-50 31.25v-62.5L100 75zm0-34.25v68.5M50 75H0m100 0h50m-50-43.75 18.75-18.75"/>\r<path fill="currentColor" d="m122.49 19.34 3.87-14.45-14.45 3.87 10.58 10.58z"/>\r<path fill="none" stroke="currentColor" stroke-miterlimit="10" stroke-width="4" d="m118.75 50 18.75-18.75"/>\r<path fill="currentColor" d="m141.24 38.09 3.87-14.45-14.45 3.87 10.58 10.58z"/></g>' }, "memory": { "type": "memory", "name": "Generic memory", "category": "ic", "kind": "box", "label": "MEM", "pins": { "left": ["A0", "A1", "A2", "A3", "A4", "A5", "A6", "A7", "~CS", "~OE", "~WE"], "right": ["D0", "D1", "D2", "D3", "D4", "D5", "D6", "D7"], "top": ["VCC"], "bottom": ["GND"] }, "prefix": "U", "typeAliases": ["ram", "rom", "eeprom", "sram"], "origin": { "library": "CircuitForge", "license": "same as the CircuitForge project", "note": "original CircuitForge symbol" } }, "microcontroller": { "type": "microcontroller", "name": "Generic microcontroller", "category": "ic", "kind": "box", "label": "MCU", "pins": { "left": ["RST", "XTAL1", "XTAL2", "PA0", "PA1", "PA2", "PA3", "PA4"], "right": ["PB0", "PB1", "PB2", "PB3", "PB4", "PB5", "PB6", "PB7"], "top": ["VCC"], "bottom": ["GND"] }, "prefix": "U", "aliases": { "reset": "RST", "vdd": "VCC", "vss": "GND" }, "typeAliases": ["mcu", "micro"], "origin": { "library": "CircuitForge", "license": "same as the CircuitForge project", "note": "original CircuitForge symbol" } }, "mux": { "type": "mux", "name": "Multiplexer", "category": "digital", "kind": "box", "label": "MUX", "pins": { "left": ["D0", "D1", "D2", "D3"], "right": ["Y"], "bottom": ["S0", "S1"] }, "prefix": "U", "typeAliases": ["multiplexer"], "origin": { "library": "CircuitForge", "license": "same as the CircuitForge project", "note": "original CircuitForge symbol" } }, "nand": { "type": "nand", "name": "NAND gate", "category": "digital", "svg": "symbol.svg", "width": 60, "height": 60, "pins": { "A": { "x": 0, "y": 20, "dir": "left", "io": "in" }, "B": { "x": 0, "y": 40, "dir": "left", "io": "in" }, "Y": { "x": 60, "y": 30, "dir": "right", "io": "out" } }, "aliases": { "1": "A", "2": "B", "3": "Y", "in1": "A", "in2": "B", "out": "Y", "q": "Y", "o": "Y", "output": "Y" }, "body": { "x": 12.4, "y": 15, "w": 41.6, "h": 30 }, "prefix": "U", "labels": "top", "typeAliases": ["nand_gate"], "origin": { "library": "chris-pikul/electronic-symbols", "url": "https://github.com/chris-pikul/electronic-symbols", "license": "MIT", "copyright": "Copyright (c) 2022 Chris Pikul", "file": "SVG/IC-COM-Logic-NAND.svg", "modified_note": "scaled 0.4, stroke normalized to currentColor" }, "svgBody": '<g transform="scale(0.4) translate(0 0)"><g fill="none" stroke="currentColor" stroke-miterlimit="10" stroke-width="4">\r<path d="M31.25 37.5h25c18.75 0 56.25 0 56.25 37.5S75 112.5 56.25 112.5h-25ZM0 49.81h31.25M0 100.06h31.25M134.5 75H150"/>\r<circle cx="124.88" cy="74.88" r="9.38"/>\r</g></g>' }, "net_label": { "type": "net_label", "name": "Net label", "category": "power", "kind": "label", "rail": "label", "pins": { "1": { "x": 0, "y": 0, "dir": "left" } }, "typeAliases": ["label", "net", "netlabel"], "origin": { "library": "CircuitForge", "license": "same as the CircuitForge project", "note": "original CircuitForge symbol" } }, "nmos": { "type": "nmos", "name": "N-channel MOSFET", "category": "semiconductor", "svg": "symbol.svg", "width": 60, "height": 60, "pins": { "G": { "x": 0, "y": 30, "dir": "left", "io": "in" }, "D": { "x": 40, "y": 0, "dir": "up" }, "S": { "x": 40, "y": 60, "dir": "down" } }, "aliases": { "gate": "G", "drain": "D", "source": "S" }, "body": { "x": 10, "y": 10, "w": 40, "h": 40 }, "prefix": "Q", "labels": "right", "required": ["G", "D", "S"], "typeAliases": ["nmosfet", "mosfet_n"], "origin": { "library": "chris-pikul/electronic-symbols", "url": "https://github.com/chris-pikul/electronic-symbols", "license": "MIT", "copyright": "Copyright (c) 2022 Chris Pikul", "file": "SVG/Transistor-COM-MOSFET-N-Enhancement.svg", "modified_note": "scaled 0.4, stroke normalized to currentColor" }, "svgBody": '<g transform="scale(0.4) translate(0 0)"><circle cx="75" cy="75" r="50" fill="none" stroke="currentColor" stroke-miterlimit="10" stroke-width="4"/>\r<path fill="none" stroke="currentColor" stroke-miterlimit="10" stroke-width="4" d="M0 75h50m0-25v50m12.5-59.25v18.5m0 50v-18.5m0-25v18.5M100 0v50H62.5M100 150V75H62.5m37.5 25H62.5"/>\r<path fill="currentColor" d="M68.75 75 87.5 62.5v25L68.75 75z"/></g>' }, "nor": { "type": "nor", "name": "NOR gate", "category": "digital", "svg": "symbol.svg", "width": 60, "height": 60, "pins": { "A": { "x": 0, "y": 20, "dir": "left", "io": "in" }, "B": { "x": 0, "y": 40, "dir": "left", "io": "in" }, "Y": { "x": 60, "y": 30, "dir": "right", "io": "out" } }, "aliases": { "1": "A", "2": "B", "3": "Y", "in1": "A", "in2": "B", "out": "Y", "q": "Y", "o": "Y", "output": "Y" }, "body": { "x": 12.4, "y": 15, "w": 41.6, "h": 30 }, "prefix": "U", "labels": "top", "typeAliases": ["nor_gate"], "origin": { "library": "chris-pikul/electronic-symbols", "url": "https://github.com/chris-pikul/electronic-symbols", "license": "MIT", "copyright": "Copyright (c) 2022 Chris Pikul", "file": "SVG/IC-COM-Logic-NOR.svg", "modified_note": "scaled 0.4, stroke normalized to currentColor" }, "svgBody": '<g transform="scale(0.4) translate(0 0)"><g fill="none" stroke="currentColor" stroke-miterlimit="10" stroke-width="4">\r<path d="M31.25 37.5h25c37.5 0 56.25 37.5 56.25 37.5s-18.75 37.5-56.25 37.5h-25s12.5-18.75 12.5-37.5-12.5-37.5-12.5-37.5ZM0 49.81h37.5M0 100.06h37.5m97-24.93H150"/>\r<circle cx="124.88" cy="75" r="9.38"/>\r</g></g>' }, "not": { "type": "not", "name": "NOT gate (inverter)", "category": "digital", "svg": "symbol.svg", "width": 60, "height": 60, "pins": { "A": { "x": 0, "y": 30, "dir": "left", "io": "in" }, "Y": { "x": 60, "y": 30, "dir": "right", "io": "out" } }, "aliases": { "1": "A", "2": "Y", "in": "A", "out": "Y", "input": "A", "output": "Y" }, "body": { "x": 8.8, "y": 15, "w": 46.4, "h": 30 }, "prefix": "U", "labels": "top", "typeAliases": ["inverter", "not_gate"], "origin": { "library": "chris-pikul/electronic-symbols", "url": "https://github.com/chris-pikul/electronic-symbols", "license": "MIT", "copyright": "Copyright (c) 2022 Chris Pikul", "file": "SVG/IC-COM-Logic-Inverter.svg", "modified_note": "scaled 0.4, stroke normalized to currentColor" }, "svgBody": '<g transform="scale(0.4) translate(0 0)"><g fill="none" stroke="currentColor" stroke-miterlimit="10" stroke-width="4">\r<path d="M22 37.5v75L112.5 75 22 37.5zM22 75H0m137.75 0H150"/>\r<circle cx="128.13" cy="74.88" r="9.38"/>\r</g></g>' }, "npn": { "type": "npn", "name": "NPN transistor", "category": "semiconductor", "svg": "symbol.svg", "width": 60, "height": 60, "pins": { "B": { "x": 0, "y": 30, "dir": "left", "io": "in" }, "C": { "x": 40, "y": 0, "dir": "up" }, "E": { "x": 40, "y": 60, "dir": "down" } }, "aliases": { "base": "B", "collector": "C", "emitter": "E" }, "body": { "x": 10, "y": 10, "w": 40, "h": 40 }, "prefix": "Q", "labels": "right", "required": ["B", "C", "E"], "typeAliases": ["bjt_npn", "npn_transistor"], "origin": { "library": "chris-pikul/electronic-symbols", "url": "https://github.com/chris-pikul/electronic-symbols", "license": "MIT", "copyright": "Copyright (c) 2022 Chris Pikul", "file": "SVG/Transistor-COM-BJT-NPN.svg", "modified_note": "scaled 0.4, stroke normalized to currentColor" }, "svgBody": '<g transform="scale(0.4) translate(0 0)"><circle cx="75" cy="75" r="50" fill="none" stroke="currentColor" stroke-miterlimit="10" stroke-width="4"/>\r<path fill="none" stroke="currentColor" stroke-miterlimit="10" stroke-width="4" d="M100 150v-31.25M0 75h50m0-31.25v62.5M100 0v40.5l-50 22m0 25 37.52 22.47"/>\r<path fill="currentColor" d="m81.8 115.26 14.95.24-7.27-13.07-7.68 12.83z"/></g>' }, "opamp": { "type": "opamp", "name": "Op-amp", "category": "analog", "svg": "symbol.svg", "width": 60, "height": 60, "pins": { "in+": { "x": 0, "y": 20, "dir": "left", "io": "in" }, "in-": { "x": 0, "y": 40, "dir": "left", "io": "in" }, "out": { "x": 60, "y": 30, "dir": "right", "io": "out" }, "v+": { "x": 30, "y": 0, "dir": "up", "io": "power" }, "v-": { "x": 30, "y": 60, "dir": "down", "io": "power" } }, "aliases": { "+": "in+", "-": "in-", "non_inverting": "in+", "inverting": "in-", "inp": "in+", "inn": "in-", "output": "out", "o": "out", "vcc": "v+", "vee": "v-", "vs+": "v+", "vs-": "v-" }, "body": { "x": 10, "y": 10, "w": 40, "h": 40 }, "prefix": "U", "labels": "topright", "required": ["in+", "in-", "out"], "typeAliases": ["op_amp", "operational_amplifier"], "origin": { "library": "chris-pikul/electronic-symbols", "url": "https://github.com/chris-pikul/electronic-symbols", "license": "MIT", "copyright": "Copyright (c) 2022 Chris Pikul", "file": "SVG/IC-COM-OpAmp.svg", "modified_note": "scaled 0.4, stroke normalized to currentColor" }, "svgBody": '<g transform="scale(0.4) translate(0 0)"><path fill="none" stroke="currentColor" stroke-miterlimit="10" stroke-width="4" d="M25 25v100l100-50L25 25zm0 25H0m125 25h25M0 100h25m9.5-47H53m-9.25-9.25v18.5M34.5 97H53M74.69 0v50m.37 100v-50"/></g>' }, "or": { "type": "or", "name": "OR gate", "category": "digital", "svg": "symbol.svg", "width": 60, "height": 60, "pins": { "A": { "x": 0, "y": 20, "dir": "left", "io": "in" }, "B": { "x": 0, "y": 40, "dir": "left", "io": "in" }, "Y": { "x": 60, "y": 30, "dir": "right", "io": "out" } }, "aliases": { "1": "A", "2": "B", "3": "Y", "in1": "A", "in2": "B", "out": "Y", "q": "Y", "o": "Y", "output": "Y" }, "body": { "x": 12.4, "y": 15, "w": 32.6, "h": 30 }, "prefix": "U", "labels": "top", "typeAliases": ["or_gate"], "origin": { "library": "chris-pikul/electronic-symbols", "url": "https://github.com/chris-pikul/electronic-symbols", "license": "MIT", "copyright": "Copyright (c) 2022 Chris Pikul", "file": "SVG/IC-COM-Logic-OR.svg", "modified_note": "scaled 0.4, stroke normalized to currentColor" }, "svgBody": '<g transform="scale(0.4) translate(0 0)"><path fill="none" stroke="currentColor" stroke-miterlimit="10" stroke-width="4" d="M31.25 37.5h25c37.5 0 56.25 37.5 56.25 37.5s-18.75 37.5-56.25 37.5h-25s12.5-18.75 12.5-37.5-12.5-37.5-12.5-37.5ZM0 49.81h37.5M0 100.06h37.5m75-25.06H150"/></g>' }, "output": { "type": "output", "name": "Output terminal", "category": "power", "width": 40, "height": 20, "pins": { "1": { "x": 0, "y": 10, "dir": "left", "io": "in" } }, "body": { "x": 28, "y": 4, "w": 12, "h": 12 }, "terminal": "output", "labels": "none", "text": { "x": 44, "y": 14, "anchor": "start", "default": "$id" }, "prefix": "OUT", "typeAliases": ["output_terminal", "out", "port_out"], "svg": "symbol.svg", "origin": { "library": "CircuitForge", "license": "same as the CircuitForge project", "note": "original CircuitForge symbol" }, "svgBody": '<g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M0 10h30"/><circle cx="34" cy="10" r="4"/></g>' }, "photodiode": { "type": "photodiode", "name": "Photodiode", "category": "semiconductor", "svg": "symbol.svg", "width": 60, "height": 60, "pins": { "anode": { "x": 0, "y": 30, "dir": "left", "io": "in" }, "cathode": { "x": 60, "y": 30, "dir": "right", "io": "out" } }, "aliases": { "1": "anode", "2": "cathode", "a": "anode", "k": "cathode", "+": "anode", "-": "cathode" }, "body": { "x": 20, "y": 4, "w": 30, "h": 40 }, "prefix": "D", "origin": { "library": "chris-pikul/electronic-symbols", "url": "https://github.com/chris-pikul/electronic-symbols", "license": "MIT", "copyright": "Copyright (c) 2022 Chris Pikul", "file": "SVG/Diode-COM-Photodiode.svg", "modified_note": "scaled 0.4, stroke normalized to currentColor" }, "svgBody": '<g transform="scale(0.4) translate(0 0)"><path fill="none" stroke="currentColor" stroke-miterlimit="10" stroke-width="4" d="m100 75-50 31.25v-62.5L100 75zm0-34.25v68.5M50 75H0m100 0h50m-12.5-43.75L118.75 50"/>\r<path fill="currentColor" d="m115.01 43.16-3.87 14.45 14.45-3.87-10.58-10.58z"/>\r<path fill="none" stroke="currentColor" stroke-miterlimit="10" stroke-width="4" d="M118.75 12.5 100 31.25"/>\r<path fill="currentColor" d="m96.26 24.41-3.87 14.45 14.45-3.87-10.58-10.58z"/></g>' }, "pmos": { "type": "pmos", "name": "P-channel MOSFET", "category": "semiconductor", "svg": "symbol.svg", "width": 60, "height": 60, "pins": { "G": { "x": 0, "y": 30, "dir": "left", "io": "in" }, "S": { "x": 40, "y": 0, "dir": "up" }, "D": { "x": 40, "y": 60, "dir": "down" } }, "aliases": { "gate": "G", "drain": "D", "source": "S" }, "body": { "x": 10, "y": 10, "w": 40, "h": 40 }, "prefix": "Q", "labels": "right", "required": ["G", "D", "S"], "typeAliases": ["pmosfet", "mosfet_p"], "origin": { "library": "chris-pikul/electronic-symbols", "url": "https://github.com/chris-pikul/electronic-symbols", "license": "MIT", "copyright": "Copyright (c) 2022 Chris Pikul", "file": "SVG/Transistor-COM-MOSFET-P-Enhancement.svg", "modified_note": "scaled 0.4, stroke normalized to currentColor" }, "svgBody": '<g transform="scale(0.4) translate(0 0)"><circle cx="75" cy="75" r="50" fill="none" stroke="currentColor" stroke-miterlimit="10" stroke-width="4"/>\r<path fill="none" stroke="currentColor" stroke-miterlimit="10" stroke-width="4" d="M0 75h50m0-25v50m12.5-59.25v18.5m0 50v-18.5m0-25v18.5M100 0v75H62.5m37.5 75v-50H62.5"/>\r<path fill="currentColor" d="M93.75 75 75 87.5v-25L93.75 75z"/>\r<path fill="none" stroke="currentColor" stroke-miterlimit="10" stroke-width="4" d="M100 50H62.5"/></g>' }, "pnp": { "type": "pnp", "name": "PNP transistor", "category": "semiconductor", "svg": "symbol.svg", "width": 60, "height": 60, "pins": { "B": { "x": 0, "y": 30, "dir": "left", "io": "in" }, "E": { "x": 40, "y": 0, "dir": "up" }, "C": { "x": 40, "y": 60, "dir": "down" } }, "aliases": { "base": "B", "collector": "C", "emitter": "E" }, "body": { "x": 10, "y": 10, "w": 40, "h": 40 }, "prefix": "Q", "labels": "right", "required": ["B", "C", "E"], "typeAliases": ["bjt_pnp", "pnp_transistor"], "origin": { "library": "chris-pikul/electronic-symbols", "url": "https://github.com/chris-pikul/electronic-symbols", "license": "MIT", "copyright": "Copyright (c) 2022 Chris Pikul", "file": "SVG/Transistor-COM-BJT-PNP.svg", "modified_note": "scaled 0.4, stroke normalized to currentColor" }, "svgBody": '<g transform="scale(0.4) translate(0 0)"><circle cx="75" cy="75" r="50" fill="none" stroke="currentColor" stroke-miterlimit="10" stroke-width="4"/>\r<path fill="none" stroke="currentColor" stroke-miterlimit="10" stroke-width="4" d="M0 75h50m0 31.25v-62.5M100 150v-40.5l-50-22M99.84 0v31.25L62.22 53.94"/>\r<path fill="currentColor" d="M60.23 46.41 53 59.5l14.95-.28-7.72-12.81z"/></g>' }, "potentiometer": { "type": "potentiometer", "name": "Potentiometer", "category": "passive", "svg": "symbol.svg", "width": 60, "height": 60, "pins": { "1": { "x": 0, "y": 30, "dir": "left" }, "2": { "x": 60, "y": 30, "dir": "right" }, "wiper": { "x": 30, "y": 60, "dir": "down" } }, "aliases": { "3": "wiper", "w": "wiper" }, "body": { "x": 12.4, "y": 20, "w": 35.2, "h": 30 }, "prefix": "RV", "typeAliases": ["pot"], "origin": { "library": "chris-pikul/electronic-symbols", "url": "https://github.com/chris-pikul/electronic-symbols", "license": "MIT", "copyright": "Copyright (c) 2022 Chris Pikul", "file": "SVG/Resistor-IEEE-Potentiometer.svg", "modified_note": "scaled 0.4, stroke normalized to currentColor" }, "svgBody": '<g transform="scale(0.4) translate(0 0)"><path fill="none" stroke="currentColor" stroke-linejoin="bevel" stroke-width="4" d="M0 74.94h31.25l10.29-24.97L54.92 100l13.39-50 13.38 50 13.39-49.62L108.46 100l10.29-25H150"/>\r<path fill="none" stroke="currentColor" stroke-miterlimit="10" stroke-width="4" d="M75 150v-32.4"/>\r<path fill="currentColor" d="M84.97 120.52 75 103.25l-9.97 17.27h19.94z"/></g>' }, "push_button": { "type": "push_button", "name": "Push button", "category": "passive", "svg": "symbol.svg", "width": 60, "height": 60, "pins": { "1": { "x": 0, "y": 30, "dir": "left" }, "2": { "x": 60, "y": 30, "dir": "right" } }, "body": { "x": 14.8, "y": 11.2, "w": 30.4, "h": 21.6 }, "prefix": "SW", "typeAliases": ["button", "pushbutton"], "origin": { "library": "chris-pikul/electronic-symbols", "url": "https://github.com/chris-pikul/electronic-symbols", "license": "MIT", "copyright": "Copyright (c) 2022 Chris Pikul", "file": "SVG/Switch-COM-Pushbutton-NO.svg", "modified_note": "scaled 0.4, stroke normalized to currentColor" }, "svgBody": '<g transform="scale(0.4) translate(0 0)"><g fill="none" stroke="currentColor" stroke-miterlimit="10" stroke-width="4">\r<circle cx="50" cy="75" r="6.25"/>\r<path d="M0 74.94h43.75"/>\r<circle cx="100" cy="75" r="6.25"/>\r<path d="M150 75.06h-43.75M37.5 50h75M75 31.25V50M62.5 31.25h25"/>\r</g></g>' }, "register": { "type": "register", "name": "Register", "category": "digital", "kind": "box", "label": "REG", "pins": { "left": ["D0", "D1", "D2", "D3", "CLK", "~CLR"], "right": ["Q0", "Q1", "Q2", "Q3"] }, "prefix": "U", "typeAliases": ["shift_register", "latch_register"], "origin": { "library": "CircuitForge", "license": "same as the CircuitForge project", "note": "original CircuitForge symbol" } }, "resistor": { "type": "resistor", "name": "Resistor", "category": "passive", "svg": "symbol.svg", "width": 60, "height": 60, "pins": { "1": { "x": 0, "y": 30, "dir": "left" }, "2": { "x": 60, "y": 30, "dir": "right" } }, "body": { "x": 12.4, "y": 20, "w": 35.2, "h": 20 }, "prefix": "R", "typeAliases": ["res", "r"], "origin": { "library": "chris-pikul/electronic-symbols", "url": "https://github.com/chris-pikul/electronic-symbols", "license": "MIT", "copyright": "Copyright (c) 2022 Chris Pikul", "file": "SVG/Resistor-IEEE-Standard.svg", "modified_note": "scaled 0.4, stroke normalized to currentColor" }, "svgBody": '<g transform="scale(0.4) translate(0 0)"><path fill="none" stroke="currentColor" stroke-linejoin="bevel" stroke-width="4" d="M0 74.94h31.25l10.29-24.97L54.92 100l13.39-50 13.38 50 13.39-49.62L108.46 100l10.29-25H150"/></g>' }, "schottky": { "type": "schottky", "name": "Schottky diode", "category": "semiconductor", "svg": "symbol.svg", "width": 60, "height": 60, "pins": { "anode": { "x": 0, "y": 30, "dir": "left", "io": "in" }, "cathode": { "x": 60, "y": 30, "dir": "right", "io": "out" } }, "aliases": { "1": "anode", "2": "cathode", "a": "anode", "k": "cathode", "+": "anode", "-": "cathode" }, "body": { "x": 20, "y": 15.2, "w": 26, "h": 29.6 }, "prefix": "D", "typeAliases": ["schottky_diode"], "origin": { "library": "chris-pikul/electronic-symbols", "url": "https://github.com/chris-pikul/electronic-symbols", "license": "MIT", "copyright": "Copyright (c) 2022 Chris Pikul", "file": "SVG/Diode-COM-Shottky.svg", "modified_note": "scaled 0.4, stroke normalized to currentColor" }, "svgBody": '<g transform="scale(0.4) translate(0 0)"><g fill="none" stroke="currentColor" stroke-miterlimit="10" stroke-width="4">\r<path d="m100 75-50 31.25v-62.5L100 75zm-50 0H0m100 0h50"/>\r<path d="M87.5 97v12.5H100v-69h12.5V53"/>\r</g></g>' }, "sr_flipflop": { "type": "sr_flipflop", "name": "SR flip-flop (gated)", "category": "digital", "svg": "symbol.svg", "width": 60, "height": 60, "pins": { "S": { "x": 0, "y": 20, "dir": "left", "io": "in" }, "E": { "x": 0, "y": 30, "dir": "left", "io": "in" }, "R": { "x": 0, "y": 40, "dir": "left", "io": "in" }, "Q": { "x": 60, "y": 20, "dir": "right", "io": "out" }, "QN": { "x": 60, "y": 40, "dir": "right", "io": "out" } }, "aliases": { "q\u0304": "QN", "q_bar": "QN", "qbar": "QN", "nq": "QN", "~q": "QN", "clock": "CLK", "clk": "CLK", "en": "E", "enable": "E", "CLK": "E" }, "body": { "x": 10, "y": 5, "w": 40, "h": 50 }, "prefix": "U", "labels": "top", "required": ["S", "R"], "typeAliases": ["srff", "sr_latch", "flipflop_sr"], "origin": { "library": "chris-pikul/electronic-symbols", "url": "https://github.com/chris-pikul/electronic-symbols", "license": "MIT", "copyright": "Copyright (c) 2022 Chris Pikul", "file": "SVG/IC-COM-FlipFlop-GatedSR.svg", "modified_note": "scaled 0.4, stroke normalized to currentColor" }, "svgBody": '<g transform="scale(0.4) translate(0 0)"><path fill="none" stroke="currentColor" stroke-miterlimit="10" stroke-width="4" d="M25 12.5h100v125H25zM25 50H0m25 50H0m125-50h25m-25 50h25"/>\r<path fill="currentColor" d="m111.57 53.9 2 1.29-1.36 3.16-2-1.44a4.78 4.78 0 0 1-4 2.34 5.08 5.08 0 0 1-4.48-2.46 12.52 12.52 0 0 1-1.73-6.91 12.5 12.5 0 0 1 1.62-6.88 5.15 5.15 0 0 1 8.79 0 12.5 12.5 0 0 1 1.59 6.88c0 3.18-.43 4.02-.43 4.02Zm-2.37-1.33a13.51 13.51 0 0 0 .24-2.69 9.25 9.25 0 0 0-.94-4.7 2.76 2.76 0 0 0-5 0 9.22 9.22 0 0 0-1 4.69 9.44 9.44 0 0 0 1 4.75 2.84 2.84 0 0 0 2.41 1.58 2.41 2.41 0 0 0 1.9-.85l-2-1.44 1.52-2.66M37 53.05l3.14-.35a4.54 4.54 0 0 0 1.15 2.63 3.23 3.23 0 0 0 2.34.84 3.3 3.3 0 0 0 2.37-.75 2.32 2.32 0 0 0 .79-1.74 1.79 1.79 0 0 0-.33-1.09 2.7 2.7 0 0 0-1.16-.79c-.38-.14-1.24-.41-2.59-.79a8.35 8.35 0 0 1-3.64-1.78 5 5 0 0 1-1.47-3.64 5.09 5.09 0 0 1 .67-2.59 4.47 4.47 0 0 1 2-1.83 7.19 7.19 0 0 1 3.15-.63A6.19 6.19 0 0 1 47.94 42a5.54 5.54 0 0 1 1.6 4l-3.23.16a3.15 3.15 0 0 0-.89-2 2.94 2.94 0 0 0-2-.61 3.39 3.39 0 0 0-2.2.65 1.35 1.35 0 0 0-.52 1.12 1.46 1.46 0 0 0 .48 1.1 7.91 7.91 0 0 0 3 1.21A14.32 14.32 0 0 1 47.59 49a4.67 4.67 0 0 1 1.77 1.84 6.32 6.32 0 0 1-.12 5.78 4.74 4.74 0 0 1-2.16 2 8.12 8.12 0 0 1-3.48.66 6.43 6.43 0 0 1-4.66-1.58A7.3 7.3 0 0 1 37 53.05Zm.5 56.2V90.79h5.91a7.88 7.88 0 0 1 3.24.49 3.65 3.65 0 0 1 1.61 1.77 6.62 6.62 0 0 1 .61 2.95 6 6 0 0 1-.87 3.39 4 4 0 0 1-2.75 1.71 7.06 7.06 0 0 1 1.5 1.55 21.07 21.07 0 0 1 1.6 3l1.7 3.6h-3.41l-2-4a25.94 25.94 0 0 0-1.48-2.71 2.14 2.14 0 0 0-.84-.77 3.53 3.53 0 0 0-1.41-.21h-.57v7.71Zm2.81-10.66h2.07a8.35 8.35 0 0 0 2.53-.22 1.64 1.64 0 0 0 .78-.78A3 3 0 0 0 46 96.2a2.69 2.69 0 0 0-.38-1.5 1.61 1.61 0 0 0-1.07-.7 18.74 18.74 0 0 0-2-.06h-2.24Zm71.26 5.31 2 1.29-1.36 3.16-2-1.44a4.78 4.78 0 0 1-4 2.34 5.08 5.08 0 0 1-4.48-2.46 12.52 12.52 0 0 1-1.73-6.91 12.5 12.5 0 0 1 1.62-6.88 5.15 5.15 0 0 1 8.79 0 12.5 12.5 0 0 1 1.59 6.88c0 3.18-.43 4.02-.43 4.02Zm-2.37-1.33a13.51 13.51 0 0 0 .24-2.69 9.25 9.25 0 0 0-.94-4.7 2.76 2.76 0 0 0-5 0 9.22 9.22 0 0 0-1 4.69 9.44 9.44 0 0 0 1 4.75 2.84 2.84 0 0 0 2.41 1.58 2.41 2.41 0 0 0 1.9-.85l-2-1.44 1.52-2.66"/>\r<path fill="none" stroke="currentColor" stroke-miterlimit="10" stroke-width="4" d="M97 84.25h18.75M25 75H0"/>\r<path fill="currentColor" d="M37.48 84.31V65.85h12.19V69H40.8v4.09h8.25v3.11H40.8v5H50v3.11Z"/></g>' }, "switch": { "type": "switch", "name": "Switch (SPST)", "category": "passive", "svg": "symbol.svg", "width": 60, "height": 60, "pins": { "1": { "x": 0, "y": 30, "dir": "left" }, "2": { "x": 60, "y": 30, "dir": "right" } }, "body": { "x": 12, "y": 13.6, "w": 36, "h": 19.2 }, "prefix": "SW", "typeAliases": ["spst"], "origin": { "library": "chris-pikul/electronic-symbols", "url": "https://github.com/chris-pikul/electronic-symbols", "license": "MIT", "copyright": "Copyright (c) 2022 Chris Pikul", "file": "SVG/Switch-COM-SPST.svg", "modified_note": "scaled 0.4, stroke normalized to currentColor" }, "svgBody": '<g transform="scale(0.4) translate(0 0)"><g fill="none" stroke="currentColor" stroke-miterlimit="10" stroke-width="4">\r<circle cx="37.5" cy="75" r="6.25"/>\r<path d="M0 74.94h31.25"/>\r<circle cx="112.5" cy="75" r="6.25"/>\r<path d="M150 75.06h-31.25m-75-3.31L102 36.5"/>\r</g></g>' }, "t_flipflop": { "type": "t_flipflop", "name": "T flip-flop", "category": "digital", "svg": "symbol.svg", "width": 60, "height": 60, "pins": { "T": { "x": 0, "y": 20, "dir": "left", "io": "in" }, "CLK": { "x": 0, "y": 40, "dir": "left", "io": "in" }, "Q": { "x": 60, "y": 20, "dir": "right", "io": "out" }, "QN": { "x": 60, "y": 40, "dir": "right", "io": "out" } }, "aliases": { "q\u0304": "QN", "q_bar": "QN", "qbar": "QN", "nq": "QN", "~q": "QN", "clock": "CLK", "clk": "CLK" }, "body": { "x": 10, "y": 5, "w": 40, "h": 50 }, "prefix": "U", "labels": "top", "required": ["T", "CLK"], "typeAliases": ["tff", "flipflop_t"], "origin": { "library": "chris-pikul/electronic-symbols", "url": "https://github.com/chris-pikul/electronic-symbols", "license": "MIT", "copyright": "Copyright (c) 2022 Chris Pikul", "file": "SVG/IC-COM-FlipFlop-ClockedT.svg", "modified_note": "scaled 0.4, stroke normalized to currentColor" }, "svgBody": '<g transform="scale(0.4) translate(0 0)"><path fill="none" stroke="currentColor" stroke-miterlimit="10" stroke-width="4" d="M25 12.5h100v125H25zM25 50H0m25 50H0m125-50h25m-25 50h25"/>\r<path fill="currentColor" d="m111.57 53.9 2 1.29-1.36 3.16-2-1.44a4.78 4.78 0 0 1-4 2.34 5.08 5.08 0 0 1-4.48-2.46 12.52 12.52 0 0 1-1.73-6.91 12.5 12.5 0 0 1 1.62-6.88 5.15 5.15 0 0 1 8.79 0 12.5 12.5 0 0 1 1.59 6.88c0 3.18-.43 4.02-.43 4.02Zm-2.37-1.33a13.51 13.51 0 0 0 .24-2.69 9.25 9.25 0 0 0-.94-4.7 2.76 2.76 0 0 0-5 0 9.22 9.22 0 0 0-1 4.69 9.44 9.44 0 0 0 1 4.75 2.84 2.84 0 0 0 2.41 1.58 2.41 2.41 0 0 0 1.9-.85l-2-1.44 1.52-2.66m4.24 52.65 2 1.29-1.36 3.16-2-1.44a4.78 4.78 0 0 1-4 2.34 5.08 5.08 0 0 1-4.48-2.46 12.52 12.52 0 0 1-1.73-6.91 12.5 12.5 0 0 1 1.62-6.88 5.15 5.15 0 0 1 8.79 0 12.5 12.5 0 0 1 1.59 6.88c0 3.18-.43 4.02-.43 4.02Zm-2.37-1.33a13.51 13.51 0 0 0 .24-2.69 9.25 9.25 0 0 0-.94-4.7 2.76 2.76 0 0 0-5 0 9.22 9.22 0 0 0-1 4.69 9.44 9.44 0 0 0 1 4.75 2.84 2.84 0 0 0 2.41 1.58 2.41 2.41 0 0 0 1.9-.85l-2-1.44 1.52-2.66"/>\r<path fill="none" stroke="currentColor" stroke-miterlimit="10" stroke-width="4" d="M97 84.25h18.75M25 87.5 50 100l-25 12.5v-25z"/>\r<path fill="currentColor" d="M42.17 59.25V43.67H37.5V40.5H50v3.17h-4.66v15.58Z"/></g>' }, "test_point": { "type": "test_point", "name": "Test point", "category": "power", "width": 20, "height": 30, "pins": { "1": { "x": 10, "y": 30, "dir": "down" } }, "body": { "x": 4, "y": 2, "w": 12, "h": 12 }, "labels": "none", "text": { "x": 18, "y": 8, "anchor": "start", "default": "$id" }, "prefix": "TP", "typeAliases": ["testpoint", "tp", "probe"], "svg": "symbol.svg", "origin": { "library": "CircuitForge", "license": "same as the CircuitForge project", "note": "original CircuitForge symbol" }, "svgBody": '<g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="10" cy="8" r="5"/><path d="M10 13v17"/></g>' }, "timer_555": { "type": "timer_555", "name": "555 timer", "category": "ic", "kind": "box", "label": "555", "pins": { "left": ["DIS", "THR", "TRIG"], "right": ["OUT", "CV"], "top": ["VCC", "RST"], "bottom": ["GND"] }, "prefix": "U", "aliases": { "1": "GND", "2": "TRIG", "3": "OUT", "4": "RST", "5": "CV", "6": "THR", "7": "DIS", "8": "VCC", "trigger": "TRIG", "threshold": "THR", "control": "CV", "ctrl": "CV", "reset": "RST", "discharge": "DIS", "output": "OUT", "vdd": "VCC" }, "required": ["VCC", "GND", "OUT"], "typeAliases": ["555", "ne555", "timer"], "origin": { "library": "CircuitForge", "license": "same as the CircuitForge project", "note": "original CircuitForge symbol" } }, "transformer": { "type": "transformer", "name": "Transformer", "category": "passive", "svg": "symbol.svg", "width": 60, "height": 70, "pins": { "p1": { "x": 0, "y": 10, "dir": "left" }, "p2": { "x": 0, "y": 60, "dir": "left" }, "s1": { "x": 60, "y": 10, "dir": "right" }, "s2": { "x": 60, "y": 60, "dir": "right" } }, "aliases": { "1": "p1", "2": "p2", "3": "s1", "4": "s2", "pri1": "p1", "pri2": "p2", "sec1": "s1", "sec2": "s2" }, "body": { "x": 8, "y": 6.6, "w": 44, "h": 56.8 }, "prefix": "T", "origin": { "library": "chris-pikul/electronic-symbols", "url": "https://github.com/chris-pikul/electronic-symbols", "license": "MIT", "copyright": "Copyright (c) 2022 Chris Pikul", "file": "SVG/Transformer-COM-Standard.svg", "modified_note": "scaled 0.4, stroke normalized to currentColor" }, "svgBody": '<g transform="scale(0.4) translate(0 12.5)"><g fill="none" stroke="currentColor" stroke-linejoin="round" stroke-width="4">\r<path d="M0 12.5h37.5s18.81 0 18.81 15.63-18.68 15.62-18.68 15.62 18.75 0 18.75 15.63S37.63 75 37.63 75s18.75 0 18.75 15.63-18.75 15.62-18.75 15.62 18.75 0 18.75 15.63-18.75 15.62-18.75 15.62H0M68.75 6.25v137.5m12.5 0V6.25"/>\r<path d="M150.13 137.5h-37.5s-18.82 0-18.82-15.62 18.69-15.63 18.69-15.63-18.75 0-18.75-15.62S112.5 75 112.5 75s-18.75 0-18.75-15.62 18.75-15.63 18.75-15.63-18.75 0-18.75-15.62S112.5 12.5 112.5 12.5h37.63" data-name="Inductor"/>\r</g></g>' }, "tristate_buffer": { "type": "tristate_buffer", "name": "Tri-state buffer", "category": "digital", "svg": "symbol.svg", "width": 60, "height": 60, "pins": { "A": { "x": 0, "y": 30, "dir": "left", "io": "in" }, "Y": { "x": 60, "y": 30, "dir": "right", "io": "out" }, "EN": { "x": 30, "y": 0, "dir": "up", "io": "in" } }, "aliases": { "1": "A", "2": "Y", "3": "EN", "in": "A", "out": "Y", "input": "A", "output": "Y", "oe": "EN", "en": "EN", "enable": "EN" }, "body": { "x": 10, "y": 15, "w": 35, "h": 30 }, "prefix": "U", "labels": "right", "typeAliases": ["tristate", "tri_state_buffer"], "origin": { "library": "chris-pikul/electronic-symbols", "url": "https://github.com/chris-pikul/electronic-symbols", "license": "MIT", "copyright": "Copyright (c) 2022 Chris Pikul", "file": "SVG/IC-COM-Logic-Buffer.svg", "modified": "enable pin added by CircuitForge", "modified_note": "scaled 0.4, stroke normalized to currentColor" }, "svgBody": '<g transform="scale(0.4) translate(0 0)"><path fill="none" stroke="currentColor" stroke-miterlimit="10" stroke-width="4" d="M25 37.5v75L112.5 75 25 37.5zM25 75H0m112.5 0H150"/><path fill="none" stroke="currentColor" stroke-width="4" d="M75 0v58.9"/></g>' }, "variable_resistor": { "type": "variable_resistor", "name": "Variable resistor", "category": "passive", "svg": "symbol.svg", "width": 60, "height": 60, "pins": { "1": { "x": 0, "y": 30, "dir": "left" }, "2": { "x": 60, "y": 30, "dir": "right" } }, "body": { "x": 10, "y": 10, "w": 40, "h": 40 }, "prefix": "R", "typeAliases": ["rheostat"], "origin": { "library": "chris-pikul/electronic-symbols", "url": "https://github.com/chris-pikul/electronic-symbols", "license": "MIT", "copyright": "Copyright (c) 2022 Chris Pikul", "file": "SVG/Resistor-IEEE-Rheostat.svg", "modified_note": "scaled 0.4, stroke normalized to currentColor" }, "svgBody": '<g transform="scale(0.4) translate(0 0)"><path fill="none" stroke="currentColor" stroke-linejoin="bevel" stroke-width="4" d="M0 74.94h31.25l10.29-24.97L54.92 100l13.39-50 13.38 50 13.39-49.62L108.46 100l10.29-25H150"/>\r<path fill="none" stroke="currentColor" stroke-miterlimit="10" stroke-width="4" d="m25 125 87.31-87.31"/>\r<path fill="currentColor" d="M118.55 49.08 125 25l-24.08 6.45 17.63 17.63z"/></g>' }, "vcc": { "type": "vcc", "name": "VCC rail", "category": "power", "width": 40, "height": 40, "pins": { "1": { "x": 20, "y": 40, "dir": "down" } }, "body": { "x": 8, "y": 14, "w": 24, "h": 26 }, "rail": "power", "text": { "x": 20, "y": 9, "anchor": "middle", "default": "VCC" }, "typeAliases": ["power_rail", "rail", "vplus", "v+", "supply"], "svg": "symbol.svg", "origin": { "library": "CircuitForge", "license": "same as the CircuitForge project", "note": "original CircuitForge symbol" }, "svgBody": '<g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M20 40V16M8 16h24"/></g>' }, "vdd": { "type": "vdd", "name": "VDD rail", "category": "power", "width": 40, "height": 40, "pins": { "1": { "x": 20, "y": 40, "dir": "down" } }, "body": { "x": 8, "y": 14, "w": 24, "h": 26 }, "rail": "power", "text": { "x": 20, "y": 9, "anchor": "middle", "default": "VDD" }, "typeAliases": [], "svg": "symbol.svg", "origin": { "library": "CircuitForge", "license": "same as the CircuitForge project", "note": "original CircuitForge symbol" }, "svgBody": '<g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M20 40V16M8 16h24"/></g>' }, "voltage_regulator": { "type": "voltage_regulator", "name": "Voltage regulator", "category": "analog", "kind": "box", "label": "REG", "pins": { "left": ["IN"], "right": ["OUT"], "bottom": ["GND"] }, "prefix": "U", "aliases": { "1": "IN", "2": "GND", "3": "OUT", "vin": "IN", "vout": "OUT", "input": "IN", "output": "OUT", "adj": "GND" }, "required": ["IN", "OUT", "GND"], "typeAliases": ["regulator", "ldo", "7805", "lm7805"], "origin": { "library": "CircuitForge", "license": "same as the CircuitForge project", "note": "original CircuitForge symbol" } }, "vss": { "type": "vss", "name": "VSS rail", "category": "power", "width": 40, "height": 40, "pins": { "1": { "x": 20, "y": 0, "dir": "up" } }, "body": { "x": 8, "y": 0, "w": 24, "h": 26 }, "rail": "negative", "text": { "x": 20, "y": 38, "anchor": "middle", "default": "VSS" }, "typeAliases": ["vee", "v-", "negative_rail"], "svg": "symbol.svg", "origin": { "library": "CircuitForge", "license": "same as the CircuitForge project", "note": "original CircuitForge symbol" }, "svgBody": '<g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M20 0v24M8 24h24"/></g>' }, "xnor": { "type": "xnor", "name": "XNOR gate", "category": "digital", "svg": "symbol.svg", "width": 60, "height": 60, "pins": { "A": { "x": 0, "y": 20, "dir": "left", "io": "in" }, "B": { "x": 0, "y": 40, "dir": "left", "io": "in" }, "Y": { "x": 60, "y": 30, "dir": "right", "io": "out" } }, "aliases": { "1": "A", "2": "B", "3": "Y", "in1": "A", "in2": "B", "out": "Y", "q": "Y", "o": "Y", "output": "Y" }, "body": { "x": 7.2, "y": 15, "w": 46.8, "h": 30 }, "prefix": "U", "labels": "top", "typeAliases": ["xnor_gate"], "origin": { "library": "chris-pikul/electronic-symbols", "url": "https://github.com/chris-pikul/electronic-symbols", "license": "MIT", "copyright": "Copyright (c) 2022 Chris Pikul", "file": "SVG/IC-COM-Logic-XNOR.svg", "modified_note": "scaled 0.4, stroke normalized to currentColor" }, "svgBody": '<g transform="scale(0.4) translate(0 0)"><g fill="none" stroke="currentColor" stroke-miterlimit="10" stroke-width="4">\r<path d="M31.25 37.5h25c37.5 0 56.25 37.5 56.25 37.5s-18.75 37.5-56.25 37.5h-25s12.5-18.75 12.5-37.5-12.5-37.5-12.5-37.5ZM0 49.81h37.5M0 100.06h37.5m97-24.93H150"/>\r<circle cx="124.88" cy="75" r="9.38"/>\r<path d="M18.75 112.5s12.5-18.75 12.5-37.5-12.5-37.95-12.5-37.95"/>\r</g></g>' }, "xor": { "type": "xor", "name": "XOR gate", "category": "digital", "svg": "symbol.svg", "width": 60, "height": 60, "pins": { "A": { "x": 0, "y": 20, "dir": "left", "io": "in" }, "B": { "x": 0, "y": 40, "dir": "left", "io": "in" }, "Y": { "x": 60, "y": 30, "dir": "right", "io": "out" } }, "aliases": { "1": "A", "2": "B", "3": "Y", "in1": "A", "in2": "B", "out": "Y", "q": "Y", "o": "Y", "output": "Y" }, "body": { "x": 7.2, "y": 15, "w": 37.8, "h": 30 }, "prefix": "U", "labels": "top", "typeAliases": ["xor_gate"], "origin": { "library": "chris-pikul/electronic-symbols", "url": "https://github.com/chris-pikul/electronic-symbols", "license": "MIT", "copyright": "Copyright (c) 2022 Chris Pikul", "file": "SVG/IC-COM-Logic-XOR.svg", "modified_note": "scaled 0.4, stroke normalized to currentColor" }, "svgBody": '<g transform="scale(0.4) translate(0 0)"><g fill="none" stroke="currentColor" stroke-miterlimit="10" stroke-width="4">\r<path d="M31.25 37.5h25c37.5 0 56.25 37.5 56.25 37.5s-18.75 37.5-56.25 37.5h-25s12.5-18.75 12.5-37.5-12.5-37.5-12.5-37.5ZM0 49.81h37.5M0 100.06h37.5m75-25.06H150"/>\r<path d="M18.75 113s12.5-18.75 12.5-37.5-12.5-38-12.5-38"/>\r</g></g>' }, "zener": { "type": "zener", "name": "Zener diode", "category": "semiconductor", "svg": "symbol.svg", "width": 60, "height": 60, "pins": { "anode": { "x": 0, "y": 30, "dir": "left", "io": "in" }, "cathode": { "x": 60, "y": 30, "dir": "right", "io": "out" } }, "aliases": { "1": "anode", "2": "cathode", "a": "anode", "k": "cathode", "+": "anode", "-": "cathode" }, "body": { "x": 20, "y": 15.2, "w": 26, "h": 29.6 }, "prefix": "D", "typeAliases": ["zener_diode"], "origin": { "library": "chris-pikul/electronic-symbols", "url": "https://github.com/chris-pikul/electronic-symbols", "license": "MIT", "copyright": "Copyright (c) 2022 Chris Pikul", "file": "SVG/Diode-COM-Zener.svg", "modified_note": "scaled 0.4, stroke normalized to currentColor" }, "svgBody": '<g transform="scale(0.4) translate(0 0)"><g fill="none" stroke="currentColor" stroke-miterlimit="10" stroke-width="4">\r<path d="m100 75-50 31.25v-62.5L100 75zm-50 0H0m100 0h50"/>\r<path d="M112.5 109.5 100 100V50l-12.5-9.5"/>\r</g></g>' } };

  // src/utils/geometry.js
  var GRID = 10;
  var DIRS = {
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 }
  };
  var OPPOSITE = { left: "right", right: "left", up: "down", down: "up" };
  var snap = (v, g = GRID) => Math.round(v / g) * g;
  function vecToDir(v) {
    if (Math.abs(v.x) >= Math.abs(v.y)) return v.x < 0 ? "left" : "right";
    return v.y < 0 ? "up" : "down";
  }
  function rotateVec(x, y, rot) {
    switch ((rot % 360 + 360) % 360) {
      case 90:
        return { x: -y, y: x };
      case 180:
        return { x: -x, y: -y };
      case 270:
        return { x: y, y: -x };
      default:
        return { x, y };
    }
  }
  function xform(p, t) {
    let x = p.x - t.ox;
    const y = p.y - t.oy;
    if (t.mirror) x = -x;
    const r = rotateVec(x, y, t.rot);
    return { x: r.x + t.x, y: r.y + t.y };
  }
  function xformDir(dir, t) {
    const d = DIRS[dir];
    const r = rotateVec(t.mirror ? -d.x : d.x, d.y, t.rot);
    return vecToDir(r);
  }
  function xformRect(r, t) {
    const pts = [
      xform({ x: r.x, y: r.y }, t),
      xform({ x: r.x + r.w, y: r.y }, t),
      xform({ x: r.x, y: r.y + r.h }, t),
      xform({ x: r.x + r.w, y: r.y + r.h }, t)
    ];
    return boundsOf(pts);
  }
  function boundsOf(pts) {
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    for (const p of pts) {
      x1 = Math.min(x1, p.x);
      y1 = Math.min(y1, p.y);
      x2 = Math.max(x2, p.x);
      y2 = Math.max(y2, p.y);
    }
    return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
  }
  function unionRect(a, b) {
    if (!a) return b;
    if (!b) return a;
    const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
    return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
  }
  var inflate = (r, d) => ({ x: r.x - d, y: r.y - d, w: r.w + 2 * d, h: r.h + 2 * d });
  var overlaps = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  function segHitsRect(s, r) {
    const x1 = Math.min(s.x1, s.x2), x2 = Math.max(s.x1, s.x2);
    const y1 = Math.min(s.y1, s.y2), y2 = Math.max(s.y1, s.y2);
    return x1 <= r.x + r.w && x2 >= r.x && y1 <= r.y + r.h && y2 >= r.y;
  }
  function textWidth(s, size = 11) {
    let w = 0;
    for (const ch of String(s)) {
      if ("il.,:;|!'1".includes(ch)) w += 0.3;
      else if ("MWmw@%".includes(ch)) w += 0.85;
      else if (ch >= "A" && ch <= "Z") w += 0.68;
      else w += 0.56;
    }
    return w * size;
  }

  // src/symbol-loader/index.js
  var norm = (s) => String(s).trim().toLowerCase().replace(/[\s-]+/g, "_");
  var TYPE_ALIAS = {};
  for (const [type, def] of Object.entries(library_generated_default)) {
    for (const a of def.typeAliases || []) TYPE_ALIAS[norm(a)] = type;
  }
  var UNSUPPORTED_TYPES = ["arduino", "arduino_uno", "arduino_nano", "arduino_mega", "esp32", "esp8266", "nodemcu", "raspberry_pi", "rpi", "raspberry_pi_pico", "rpi_pico"];
  function canonicalType(type) {
    if (type == null) return null;
    const t = norm(type);
    return library_generated_default[t] ? t : TYPE_ALIAS[t] || null;
  }
  function listTypes() {
    return Object.values(library_generated_default).map((d) => ({ type: d.type, name: d.name, category: d.category, aliases: d.typeAliases || [] }));
  }
  var cache = /* @__PURE__ */ new Map();
  function resolveSymbol(component) {
    const type = canonicalType(component.type);
    const def = library_generated_default[type];
    if (!def) return null;
    if (def.kind === "box") {
      const key = type + "|" + JSON.stringify(component.pins ?? null) + "|" + (component.label ?? "") + "|" + (component.value ?? "");
      if (!cache.has(key)) cache.set(key, buildBox(def, component));
      return cache.get(key);
    }
    if (!cache.has(type)) cache.set(type, finish(def, { ...def }));
    return cache.get(type);
  }
  function finish(def, sym) {
    sym.pinOrder = Object.keys(sym.pins);
    const first = sym.pins[sym.pinOrder[0]];
    sym.origin = { x: first.x, y: first.y };
    const aliases = {};
    for (const n2 of sym.pinOrder) {
      aliases[n2.toLowerCase()] = n2;
      if (n2.startsWith("~")) aliases[n2.slice(1).toLowerCase()] = n2;
    }
    for (const [a, n2] of Object.entries(def.aliases || {})) {
      const target = sym.pinOrder.find((p) => p.toLowerCase() === n2.toLowerCase());
      if (target && !(a.toLowerCase() in aliases)) aliases[a.toLowerCase()] = target;
    }
    sym.aliases = aliases;
    sym.twoTerminal = sym.pinOrder.length === 2 && !sym.kind && !sym.terminal;
    return sym;
  }
  function resolvePin(sym, name) {
    if (!sym || name == null) return null;
    return sym.aliases[String(name).trim().toLowerCase()] || null;
  }
  var esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  function boxSpec(def, component) {
    const p = component.pins;
    if (p == null) return def.pins;
    const side = Object.keys(def.pins)[0] || "right";
    if (typeof p === "number") return { [side]: Array.from({ length: Math.max(1, Math.min(64, p | 0)) }, (_, i) => String(i + 1)) };
    if (Array.isArray(p)) {
      const names = p.map(String);
      if (def.type === "connector") return { [side]: names };
      const half = Math.ceil(names.length / 2);
      return { left: names.slice(0, half), right: names.slice(half) };
    }
    if (typeof p === "object") {
      const out = {};
      for (const s of ["left", "right", "top", "bottom"]) if (Array.isArray(p[s])) out[s] = p[s].map(String);
      return out;
    }
    return def.pins;
  }
  function buildBox(def, component) {
    const spec = boxSpec(def, component);
    const L = spec.left || [], R2 = spec.right || [], T = spec.top || [], B = spec.bottom || [];
    const FS = 9;
    const tw = (s) => textWidth(s.replace(/^~/, ""), FS);
    const title = component.label ?? def.label ?? "";
    const maxL = Math.max(0, ...L.map(tw)), maxR = Math.max(0, ...R2.map(tw));
    const value = component.value != null && component.value !== "" ? String(component.value) : "";
    const titleW = Math.max(title ? textWidth(title, 11) : 0, value ? textWidth(value, 10) : 0) + (title || value ? 16 : 0);
    const sideW = Math.max(maxL, maxR);
    let W = Math.max(60, maxL + maxR + titleW + 20, titleW + 2 * sideW + 20, (Math.max(T.length, B.length) + 1) * 20);
    W = Math.ceil(W / 20) * 20;
    const rows = Math.max(L.length, R2.length, 1);
    const top = 20;
    const firstY = top + (T.length ? 40 : 20);
    let bottom = firstY + (rows - 1) * 20 + (B.length ? 40 : 20);
    if (title && value && bottom - top < 60) bottom = top + 60;
    const pins = {};
    const parts = [`<rect x="20" y="${top}" width="${W}" height="${bottom - top}" fill="none" stroke="currentColor" stroke-width="1.6"/>`];
    const text = [];
    const label2 = (x, y, name, anchor) => {
      const over = name.startsWith("~");
      const shown = over ? name.slice(1) : name;
      text.push(`<text x="${x}" y="${y}" font-size="${FS}" text-anchor="${anchor}"${over ? ' text-decoration="overline"' : ""}>${esc(shown)}</text>`);
    };
    const io = (side) => def.io || (side === "left" ? "in" : side === "right" ? "out" : "power");
    const isClock = (n2) => /^~?(clk|cp|clock)$/i.test(n2);
    const lines = [];
    L.forEach((n2, i) => {
      const y = firstY + i * 20;
      pins[n2] = { x: 0, y, dir: "left", io: io("left") };
      lines.push(`M0 ${y}H20`);
      if (isClock(n2)) {
        lines.push(`M20 ${y - 5}L27 ${y}L20 ${y + 5}`);
        label2(30, y + 3, n2, "start");
      } else label2(24, y + 3, n2, "start");
    });
    R2.forEach((n2, i) => {
      const y = firstY + i * 20;
      pins[n2] = { x: W + 40, y, dir: "right", io: io("right") };
      lines.push(`M${W + 20} ${y}H${W + 40}`);
      label2(W + 16, y + 3, n2, "end");
    });
    const across = (list, y, dir, ty) => {
      const x0 = 20 + snap((W - (list.length - 1) * 20) / 2);
      list.forEach((n2, i) => {
        const x = x0 + i * 20;
        pins[n2] = { x, y, dir, io: io(dir === "up" ? "top" : "bottom") };
        lines.push(dir === "up" ? `M${x} 0V${top}` : `M${x} ${bottom}V${bottom + 20}`);
        label2(x, ty, n2, "middle");
      });
    };
    across(T, 0, "up", top + 11);
    across(B, bottom + 20, "down", bottom - 5);
    if (lines.length) parts.push(`<path d="${lines.join("")}" fill="none" stroke="currentColor" stroke-width="1.6"/>`);
    const mid = (top + bottom) / 2;
    if (title) text.push(`<text x="${20 + W / 2}" y="${value ? mid - 2 : mid + 4}" font-size="11" font-weight="600" text-anchor="middle">${esc(title)}</text>`);
    if (value) text.push(`<text x="${20 + W / 2}" y="${title ? mid + 11 : mid + 4}" font-size="10" text-anchor="middle" fill-opacity="0.75">${esc(value)}</text>`);
    parts.push(`<g fill="currentColor" stroke="none">${text.join("")}</g>`);
    if (!Object.keys(pins).length) pins["1"] = { x: 0, y: firstY, dir: "left", io: "passive" };
    return finish(def, {
      ...def,
      pins,
      width: W + 40,
      height: bottom + 20,
      body: { x: 20, y: top, w: W, h: bottom - top },
      svgBody: parts.join(""),
      labels: "box",
      boxSpec: spec
    });
  }

  // src/validator/index.js
  function levenshtein(a, b) {
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++)
      for (let j = 1; j <= b.length; j++)
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[a.length][b.length];
  }
  function suggestType(t) {
    const s = String(t).toLowerCase();
    let best = null, bestD = 3;
    for (const { type, aliases } of listTypes()) {
      for (const cand of [type, ...aliases]) {
        const d = levenshtein(s, cand);
        if (d < bestD) {
          bestD = d;
          best = type;
        }
      }
    }
    return best;
  }
  function validateCircuit(input) {
    const errors = [], warnings = [];
    const { circuit, errors: parseErrors } = parseCircuit(input);
    if (parseErrors.length) return { valid: false, errors: parseErrors, warnings, circuit: null };
    if (!circuit || typeof circuit !== "object" || Array.isArray(circuit)) {
      errors.push({ code: "INVALID_SCHEMA", message: 'The circuit must be a JSON object with "components" and "connections".' });
      return { valid: false, errors, warnings, circuit };
    }
    if (!Array.isArray(circuit.components)) {
      errors.push({ code: "INVALID_SCHEMA", path: "components", message: '"components" must be an array.' });
      return { valid: false, errors, warnings, circuit };
    }
    if (circuit.connections !== void 0 && !Array.isArray(circuit.connections)) {
      errors.push({ code: "INVALID_SCHEMA", path: "connections", message: '"connections" must be an array.' });
    }
    const comps = /* @__PURE__ */ new Map();
    circuit.components.forEach((c, i) => {
      const path = `components[${i}]`;
      if (!c || typeof c !== "object" || Array.isArray(c)) {
        errors.push({ code: "INVALID_SCHEMA", path, message: `Component #${i + 1} must be an object.` });
        return;
      }
      if (typeof c.id !== "string" || !c.id.trim()) {
        errors.push({ code: "MISSING_ID", path, message: `Component #${i + 1} has no "id".` });
        return;
      }
      const id = c.id;
      if (/[.\s]/.test(id)) {
        errors.push({ code: "INVALID_ID", component: id, path, message: `Component id "${id}" must not contain dots or spaces.` });
        return;
      }
      if (comps.has(id)) {
        errors.push({ code: "DUPLICATE_ID", component: id, path, message: `Duplicate component id "${id}".` });
        return;
      }
      if (c.type == null || c.type === "") {
        errors.push({ code: "MISSING_TYPE", component: id, path, message: `Component ${id} has no "type".` });
        comps.set(id, null);
        return;
      }
      const t = String(c.type).toLowerCase().replace(/[\s-]+/g, "_");
      if (UNSUPPORTED_TYPES.includes(t)) {
        errors.push({ code: "UNSUPPORTED_COMPONENT", component: id, type: c.type, path, message: `Component type "${c.type}" (${id}) is not supported yet. Use "microcontroller" with custom pins instead.` });
        comps.set(id, null);
        return;
      }
      if (!canonicalType(c.type)) {
        const s = suggestType(c.type);
        errors.push({ code: "UNKNOWN_TYPE", component: id, type: c.type, path, message: `Unknown component type "${c.type}" on ${id}.${s ? ` Did you mean "${s}"?` : ""}` });
        comps.set(id, null);
        return;
      }
      if (c.rotation !== void 0 && ![0, 90, 180, 270].includes(c.rotation)) {
        errors.push({ code: "INVALID_PROPERTY", component: id, path: `${path}.rotation`, message: `Rotation of ${id} must be 0, 90, 180 or 270.` });
      }
      if (c.position !== void 0 && !(c.position && Number.isFinite(c.position.x) && Number.isFinite(c.position.y))) {
        errors.push({ code: "INVALID_PROPERTY", component: id, path: `${path}.position`, message: `Position of ${id} must be {"x": number, "y": number}.` });
      }
      comps.set(id, { comp: c, sym: resolveSymbol(c) });
    });
    const connections = [];
    const seenPairs = /* @__PURE__ */ new Set();
    const connectedPins = /* @__PURE__ */ new Map();
    const mentioned = /* @__PURE__ */ new Set();
    for (const conn of normalizeConnections(circuit)) {
      const { path } = conn;
      if (!Array.isArray(conn.refs)) {
        errors.push({ code: "INVALID_CONNECTION", path, message: `${path} must be an array of pin references like ["R1.1", "C1.2"].` });
        continue;
      }
      if (conn.refs.length < 2) {
        errors.push({ code: "INVALID_CONNECTION", path, message: `${path} needs at least two endpoints.` });
        continue;
      }
      const ends = [];
      let bad = false;
      for (const raw of conn.refs) {
        const ref = parseRef(raw);
        if (!ref) {
          errors.push({ code: "INVALID_CONNECTION", path, message: `Invalid pin reference ${JSON.stringify(raw)} in ${path}. Use "ComponentId.pin".` });
          bad = true;
          continue;
        }
        mentioned.add(ref.comp);
        if (!comps.has(ref.comp)) {
          errors.push({ code: "MISSING_COMPONENT", component: ref.comp, ref: raw, path, message: `Connection references missing component "${ref.comp}" (${raw}).` });
          bad = true;
          continue;
        }
        const entry = comps.get(ref.comp);
        if (!entry) {
          bad = true;
          continue;
        }
        const { sym, comp } = entry;
        let pin;
        if (ref.pin == null) {
          if (sym.pinOrder.length === 1) pin = sym.pinOrder[0];
          else {
            errors.push({ code: "INVALID_PIN", component: ref.comp, pin: null, ref: raw, path, message: `Connection to ${ref.comp} must name a pin (${sym.pinOrder.join(", ")}).` });
            bad = true;
            continue;
          }
        } else {
          pin = resolvePin(sym, ref.pin);
          if (!pin) {
            errors.push({ code: "INVALID_PIN", component: ref.comp, pin: ref.pin, ref: raw, path, message: `Pin ${ref.pin} does not exist on ${sym.name.toLowerCase()} ${ref.comp}. Available: ${sym.pinOrder.join(", ")}.` });
            bad = true;
            continue;
          }
        }
        ends.push({ comp: comp.id, pin });
      }
      if (bad) continue;
      const keys = ends.map((e) => `${e.comp}.${e.pin}`);
      if (new Set(keys).size !== keys.length) {
        errors.push({ code: "INVALID_CONNECTION", path, message: `${path} connects a pin to itself (${keys.join(", ")}).` });
        continue;
      }
      for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++) {
        const pair = [keys[i], keys[j]].sort().join("|");
        if (seenPairs.has(pair)) warnings.push({ code: "DUPLICATE_CONNECTION", path, message: `Duplicate connection between ${keys[i]} and ${keys[j]}.` });
        seenPairs.add(pair);
      }
      for (const e of ends) {
        if (!connectedPins.has(e.comp)) connectedPins.set(e.comp, /* @__PURE__ */ new Set());
        connectedPins.get(e.comp).add(e.pin);
      }
      connections.push({ ends, name: conn.name, path });
    }
    for (const [id, entry] of comps) {
      if (!entry) continue;
      const used = connectedPins.get(id);
      if (!used) {
        if (!mentioned.has(id)) warnings.push({ code: "UNCONNECTED_COMPONENT", component: id, message: `${id} is not connected to anything.` });
        continue;
      }
      for (const req of entry.sym.required || []) {
        const pin = resolvePin(entry.sym, req);
        if (pin && !used.has(pin)) warnings.push({ code: "MISSING_REQUIRED_PIN", component: id, pin, message: `Required pin ${pin} of ${id} is not connected.` });
      }
    }
    return { valid: errors.length === 0, errors, warnings, circuit, resolved: { comps, connections } };
  }

  // src/graph/index.js
  var RAIL_PRIORITY = { ground: 4, negative: 3, power: 2, label: 1 };
  function buildNetlist(validation) {
    const { comps, connections } = validation.resolved;
    const parent = /* @__PURE__ */ new Map();
    const find = (k) => {
      if (!parent.has(k)) parent.set(k, k);
      let r = k;
      while (parent.get(r) !== r) r = parent.get(r);
      while (parent.get(k) !== r) {
        const n3 = parent.get(k);
        parent.set(k, r);
        k = n3;
      }
      return r;
    };
    const union = (a, b) => parent.set(find(a), find(b));
    const parts = [];
    const railOf = /* @__PURE__ */ new Map();
    for (const [id, entry] of comps) {
      if (!entry) continue;
      const { comp, sym } = entry;
      if (sym.rail) {
        const name = String(comp.value ?? comp.label ?? (sym.rail === "label" ? id : sym.text?.default ?? "GND"));
        const key = `rail:${sym.rail === "ground" ? "ground:" : ""}${name}`;
        union(`${id}.${sym.pinOrder[0]}`, key);
        const prev = railOf.get(key);
        if (!prev || RAIL_PRIORITY[sym.rail] > RAIL_PRIORITY[prev.kind]) railOf.set(key, { kind: sym.rail, name, type: sym.type });
      } else if (sym.kind === "virtual") {
        find(`${id}.${sym.pinOrder[0]}`);
      } else {
        parts.push({ id, comp, sym, pinNets: {} });
      }
    }
    for (const c of connections) {
      const keys = c.ends.map((e) => `${e.comp}.${e.pin}`);
      for (let i = 1; i < keys.length; i++) union(keys[0], keys[i]);
      if (c.name) union(keys[0], `named:${c.name}`);
    }
    const groups = /* @__PURE__ */ new Map();
    for (const k of parent.keys()) {
      const r = find(k);
      if (!groups.has(r)) groups.set(r, []);
      groups.get(r).push(k);
    }
    const partIds = new Set(parts.map((p) => p.id));
    const nets = /* @__PURE__ */ new Map();
    const keyToNet = /* @__PURE__ */ new Map();
    let n2 = 0;
    for (const keys of groups.values()) {
      const pins = [];
      let rail = null, name = null;
      for (const k of keys) {
        if (k.startsWith("rail:")) {
          const r = railOf.get(k);
          if (!rail || RAIL_PRIORITY[r.kind] > RAIL_PRIORITY[rail.kind]) rail = r;
        } else if (k.startsWith("named:")) name = name || k.slice(6);
        else {
          const i = k.indexOf(".");
          const comp = k.slice(0, i), pin = k.slice(i + 1);
          if (partIds.has(comp)) pins.push({ comp, pin });
        }
      }
      if (!pins.length) continue;
      const id = `N${++n2}`;
      if (rail) rail = { ...rail, sym: resolveSymbol({ type: rail.type }) };
      nets.set(id, { id, name: rail ? rail.name : name, pins, rail });
      for (const k of keys) keyToNet.set(k, id);
    }
    for (const p of parts) {
      for (const pin of p.sym.pinOrder) {
        const net = keyToNet.get(`${p.id}.${pin}`);
        if (net) p.pinNets[pin] = net;
      }
    }
    let returnNet = null;
    const hasGround = [...nets.values()].some((x) => x.rail && (x.rail.kind === "ground" || x.rail.kind === "negative"));
    if (!hasGround) {
      const src = parts.find((p) => p.sym.source && p.pinNets.negative && !nets.get(p.pinNets.negative).rail);
      if (src) returnNet = src.pinNets.negative;
    }
    return { parts, nets, returnNet };
  }

  // src/layout/instance.js
  var REF_SIZE = 11;
  var VALUE_SIZE = 10.5;
  function textBox(text, x, y, anchor, size) {
    const w = textWidth(text, size);
    const x0 = anchor === "start" ? x : anchor === "end" ? x - w : x - w / 2;
    return { x: x0, y: y - size * 0.82, w, h: size * 1.05 };
  }
  function label(text, x, y, anchor, cls, size) {
    return { text: String(text), x, y, anchor, cls, size, box: textBox(text, x, y, anchor, size) };
  }
  function makeInstance(part, x, y, rot, mirror, nets) {
    const s = part.sym;
    const t = { x, y, rot, mirror, ox: s.origin.x, oy: s.origin.y };
    const pins = {};
    for (const n2 of s.pinOrder) {
      const w = xform(s.pins[n2], t);
      pins[n2] = { x: w.x, y: w.y, dir: xformDir(s.pins[n2].dir, t) };
    }
    const inst = { id: part.id, part, t, x, y, rot, mirror, pins, body: xformRect(s.body, t) };
    inst.markers = buildMarkers(inst, nets);
    const { primary, alt } = buildLabels(inst);
    inst.labels = primary;
    inst.labelAlt = alt;
    computeExtent(inst);
    return inst;
  }
  function computeExtent(inst) {
    let e = unionRect(inst.body, boundsOf(Object.values(inst.pins)));
    for (const m of inst.markers) e = unionRect(e, m.bbox);
    for (const l of inst.labels) e = unionRect(e, l.box);
    inst.extent = e;
  }
  function rotFor(localDir, worldDir) {
    for (const r of [0, 90, 180, 270]) {
      const d = DIRS[localDir];
      if (vecToDir(rotateVec(d.x, d.y, r)) === worldDir) return r;
    }
    return 0;
  }
  var railFace = (rail, pinDir) => rail.kind === "ground" || rail.kind === "negative" ? "down" : rail.kind === "power" ? "up" : pinDir;
  function buildMarkers(inst, nets) {
    const out = [];
    if (!nets) return out;
    const groups = /* @__PURE__ */ new Map();
    for (const [pinName, net] of Object.entries(inst.part.pinNets)) {
      const info = nets.get(net);
      if (!info?.rail) continue;
      const pin = inst.pins[pinName];
      const key = railFace(info.rail, pin.dir) === pin.dir && info.rail.kind !== "label" ? net + "|" + pin.dir : pinName;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(pinName);
    }
    for (const pinNames of groups.values()) {
      const net = inst.part.pinNets[pinNames[0]];
      const rail = nets.get(net).rail;
      let pin = inst.pins[pinNames[0]];
      let face = railFace(rail, pin.dir);
      let stub = 0;
      const stubs = [];
      let bus = null;
      if (pinNames.length > 1) {
        const d2 = DIRS[pin.dir];
        const ends = pinNames.map((n2) => {
          const p = inst.pins[n2];
          stubs.push({ x1: p.x, y1: p.y, x2: p.x + d2.x * 10, y2: p.y + d2.y * 10 });
          return { x: p.x + d2.x * 10, y: p.y + d2.y * 10 };
        });
        const b = boundsOf(ends);
        bus = { x1: b.x, y1: b.y, x2: b.x + b.w, y2: b.y + b.h };
        stubs.push(bus);
        const mid = { x: Math.round((b.x + b.w / 2) / 10) * 10, y: Math.round((b.y + b.h / 2) / 10) * 10 };
        pin = { ...mid, dir: pin.dir };
      }
      if (face === OPPOSITE[pin.dir]) face = pin.dir;
      else if (face !== pin.dir) stub = rail.kind === "label" ? 10 : 30;
      const d = DIRS[pin.dir];
      const at = { x: pin.x + d.x * stub, y: pin.y + d.y * stub };
      if (stub) stubs.push({ x1: pin.x, y1: pin.y, x2: at.x, y2: at.y });
      const m = { net, pin: pinNames[0], pins: pinNames, rail, face, stubs, dot: bus ? { x: pin.x, y: pin.y } : null };
      if (rail.kind === "label") {
        buildLabelFlag(m, at, face);
      } else {
        const ms = rail.sym;
        const mt = { x: at.x, y: at.y, rot: rotFor(ms.pins[ms.pinOrder[0]].dir, OPPOSITE[face]), mirror: false, ox: ms.origin.x, oy: ms.origin.y };
        m.t = mt;
        m.sym = ms;
        m.bbox = xformRect(ms.body, mt);
        if (ms.text) {
          const p = xform(ms.text, mt);
          const y = face === "down" ? m.bbox.y + m.bbox.h + 11 : face === "up" ? m.bbox.y - 5 : p.y + 4;
          const x = face === "left" ? m.bbox.x - 3 : face === "right" ? m.bbox.x + m.bbox.w + 3 : p.x;
          const anchor = face === "left" ? "end" : face === "right" ? "start" : "middle";
          m.text = label(rail.name, x, y, anchor, "rail", 10);
          m.bbox = unionRect(m.bbox, m.text.box);
        }
      }
      for (const st of stubs) m.bbox = unionRect(m.bbox, boundsOf([{ x: st.x1, y: st.y1 }, { x: st.x2, y: st.y2 }]));
      out.push(m);
    }
    return out;
  }
  function buildLabelFlag(m, at, face) {
    const name = m.rail.name;
    const w = textWidth(name, 10) + 14, h = 14;
    const { x, y } = at;
    let pts, tx, ty, anchor;
    if (face === "right" || face === "left") {
      const s = face === "right" ? 1 : -1;
      pts = [[x, y], [x + s * 7, y - h / 2], [x + s * w, y - h / 2], [x + s * w, y + h / 2], [x + s * 7, y + h / 2]];
      tx = x + s * 9;
      ty = y + 3.5;
      anchor = face === "right" ? "start" : "end";
    } else {
      const s = face === "down" ? 1 : -1;
      const top = face === "down" ? y + 7 : y - 7 - h;
      pts = [[x, y], [x, y + s * 7]];
      m.box = { x: x - w / 2, y: top, w, h };
      tx = x;
      ty = top + h / 2 + 3.5;
      anchor = "middle";
    }
    m.flag = pts;
    m.text = label(name, tx, ty, anchor, "netlabel", 10);
    m.bbox = boundsOf([...pts.map(([px, py]) => ({ x: px, y: py })), ...m.box ? [{ x: m.box.x, y: m.box.y }, { x: m.box.x + m.box.w, y: m.box.y + m.box.h }] : []]);
  }
  function buildLabels(inst) {
    const s = inst.part.sym, c = inst.part.comp;
    const b = inst.body;
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    const ref = c.label ?? c.id;
    const value = c.value != null && c.value !== "" ? String(c.value) : null;
    const primary = [], alt = [];
    if (s.text) {
      const p = xform(s.text, inst.t);
      const txt = s.text.default === "$id" ? c.label ?? c.value ?? c.id : c.value ?? s.text.default;
      const pinDir = inst.pins[s.pinOrder[0]].dir;
      let anchor = s.text.anchor;
      if (s.terminal) {
        anchor = pinDir === "right" ? "end" : pinDir === "left" ? "start" : "middle";
        const q = anchor === "end" ? { x: b.x - 4, y: cy + 4 } : anchor === "start" ? { x: b.x + b.w + 4, y: cy + 4 } : { x: cx, y: pinDir === "down" ? b.y - 4 : b.y + b.h + 12 };
        primary.push(label(txt, q.x, q.y, anchor, "text", REF_SIZE));
      } else primary.push(label(txt, p.x, p.y + 4, anchor, "text", REF_SIZE));
      return { primary, alt };
    }
    if (s.labels === "none") return { primary, alt };
    const side = (right) => {
      const x = right ? b.x + b.w + 6 : b.x - 6;
      const a = right ? "start" : "end";
      const out = [];
      if (value) {
        out.push(label(ref, x, cy - 1, a, "ref", REF_SIZE));
        out.push(label(value, x, cy + 11, a, "value", VALUE_SIZE));
      } else out.push(label(ref, x, cy + 4, a, "ref", REF_SIZE));
      return out;
    };
    const horizontalPins = s.twoTerminal && ["left", "right"].includes(inst.pins[s.pinOrder[0]].dir);
    if (s.twoTerminal && horizontalPins) {
      primary.push(label(ref, cx, b.y - 5, "middle", "ref", REF_SIZE));
      if (value) primary.push(label(value, cx, b.y + b.h + 12, "middle", "value", VALUE_SIZE));
      alt.push(label(ref, cx, b.y - (value ? 17 : 5), "middle", "ref", REF_SIZE));
      if (value) alt.push(label(value, cx, b.y - 5, "middle", "value", VALUE_SIZE));
    } else if (s.twoTerminal || s.labels === "right") {
      primary.push(...side(true));
      alt.push(...side(false));
    } else if (s.labels === "topright") {
      const x = cx + 16;
      primary.push(label(ref, x, b.y + 3, "start", "ref", REF_SIZE));
      if (value) primary.push(label(value, x, b.y + 15, "start", "value", VALUE_SIZE));
    } else if (s.labels === "box") {
      primary.push(label(ref, b.x + b.w, b.y - 5, "end", "ref", REF_SIZE));
    } else {
      primary.push(label(ref, cx, b.y - 5, "middle", "ref", REF_SIZE));
      if (value) primary.push(label(value, cx, b.y + b.h + 12, "middle", "value", VALUE_SIZE));
    }
    return { primary, alt };
  }

  // src/layout/index.js
  var COL_GAP = 40;
  var CLEAR = 16;
  function layoutCircuit(nl) {
    const { parts, nets } = nl;
    const byId = new Map(parts.map((p) => [p.id, p]));
    const railKind = (n2) => n2 ? nets.get(n2)?.rail?.kind : void 0;
    const pull = (n2) => {
      if (!n2) return null;
      const k = railKind(n2);
      if (k === "ground" || k === "negative" || n2 === nl.returnNet) return "down";
      if (k === "power") return "up";
      return null;
    };
    const signal = (n2) => n2 && !railKind(n2) && n2 !== nl.returnNet;
    const orient = /* @__PURE__ */ new Map();
    for (const p of parts) {
      const c = p.comp, s = p.sym;
      if (c.rotation !== void 0 || c.mirror) {
        orient.set(p.id, { rot: c.rotation || 0, mirror: !!c.mirror, fixed: true });
        continue;
      }
      let rot = s.defaultRotation || 0, mirror = false, flex = false;
      const [a, b] = s.pinOrder;
      if (s.source) {
        const pp = pull(p.pinNets.positive), pn = pull(p.pinNets.negative);
        rot = pp === "down" && pn !== "down" || pn === "up" && pp !== "up" ? 180 : 0;
      } else if (s.twoTerminal) {
        const pa = pull(p.pinNets[a]), pb = pull(p.pinNets[b]);
        if (pa || pb) rot = pa === "down" || pb === "up" && pa !== "down" ? 270 : 90;
        else flex = true;
      } else if ((s.type === "opamp" || s.type === "comparator") && !p.pinNets["v+"] && !p.pinNets["v-"]) {
        if (!signal(p.pinNets["in+"]) && signal(p.pinNets["in-"])) {
          rot = 180;
          mirror = true;
        }
      }
      orient.set(p.id, { rot, mirror, flex });
    }
    const pinDir = (id, pin) => {
      const o = orient.get(id);
      return xformDir(byId.get(id).sym.pins[pin].dir, { rot: o.rot, mirror: o.mirror });
    };
    const shunt = (p) => p.sym.twoTerminal && !orient.get(p.id).flex;
    const adj = new Map(parts.map((p) => [p.id, []]));
    for (const [nid, net] of nets) {
      if (!signal(nid)) continue;
      for (const e1 of net.pins) for (const e2 of net.pins) {
        if (e1.comp !== e2.comp) adj.get(e1.comp).push({ to: e2.comp, my: e1.pin, their: e2.pin });
      }
    }
    const rank = (p) => p.sym.source ? 0 : p.sym.terminal === "input" ? 1 : 2;
    const roots = [...parts].sort((a, b) => rank(a) - rank(b) || b.sym.pinOrder.length - a.sym.pinOrder.length);
    const layer = /* @__PURE__ */ new Map(), wave = /* @__PURE__ */ new Map(), flexIn = /* @__PURE__ */ new Map();
    let island = 0;
    const islandOf = /* @__PURE__ */ new Map();
    for (const r of roots) {
      if (layer.has(r.id)) continue;
      layer.set(r.id, 0);
      wave.set(r.id, 0);
      islandOf.set(r.id, island);
      flexIn.set(r.id, { pin: null, off: 1 });
      const q = [r.id];
      while (q.length) {
        const id = q.shift();
        for (const e of adj.get(id)) {
          if (layer.has(e.to)) continue;
          const me = byId.get(id), them = byId.get(e.to);
          let off;
          if (orient.get(id).flex) {
            const f = flexIn.get(id);
            off = e.my === f.pin ? -f.off : f.off;
          } else {
            const myDir = pinDir(id, e.my);
            const theirDir = orient.get(e.to).flex || shunt(them) ? null : pinDir(e.to, e.their);
            off = myDir === "left" || theirDir === "right" ? -1 : 1;
            if (me.sym.pinOrder.length === 1 && theirDir === "left") off = 1;
          }
          layer.set(e.to, layer.get(id) + off);
          wave.set(e.to, wave.get(id) + 1);
          islandOf.set(e.to, island);
          flexIn.set(e.to, { pin: e.their, off });
          q.push(e.to);
        }
      }
      island++;
    }
    relaxDirected(parts, nets, signal, layer, roots);
    const minL = Math.min(0, ...layer.values());
    for (const [k, v] of layer) layer.set(k, v - minL);
    const inner = parts.filter((p) => !p.sym.terminal).map((p) => layer.get(p.id));
    const lastL = inner.length ? Math.max(...inner) + 1 : 1;
    for (const p of parts) {
      if (p.sym.terminal === "input") layer.set(p.id, 0);
      if (p.sym.terminal === "output") layer.set(p.id, lastL);
    }
    if (parts.some((p) => p.sym.terminal === "input")) {
      for (const p of parts) if (!p.sym.terminal) layer.set(p.id, layer.get(p.id) + 1);
      for (const p of parts) if (p.sym.terminal === "output") layer.set(p.id, lastL + 1);
    }
    const placed = [];
    const inst = /* @__PURE__ */ new Map();
    const lines = /* @__PURE__ */ new Map();
    let lineOrder = 0;
    const trial = (p, rot, mirror) => makeInstance(p, 0, 0, rot, mirror, nets);
    const coreLeft = (T) => Math.min(T.body.x, ...Object.values(T.pins).map((q) => q.x));
    const nLayers = Math.max(0, ...layer.values()) + 1;
    const colW = new Array(nLayers).fill(0);
    for (const p of parts) {
      const o = orient.get(p.id);
      colW[layer.get(p.id)] = Math.max(colW[layer.get(p.id)], trial(p, o.rot, o.mirror).extent.w);
    }
    const colX = [0];
    for (let i = 1; i < nLayers; i++) colX[i] = colX[i - 1] + colW[i - 1] + COL_GAP;
    const cursor = new Array(nLayers).fill(0);
    const colRight = new Array(nLayers).fill(-Infinity);
    const colStart = (L) => Math.max(colX[L], ...colRight.slice(0, L).map((r) => r + COL_GAP));
    const isFree = (I, ignore) => {
      const e = inflate(I.extent, CLEAR / 2);
      return placed.every((o) => o === ignore || !overlaps(e, inflate(o.extent, CLEAR / 2)));
    };
    const commit = (I) => {
      placed.push(I);
      inst.set(I.id, I);
      const L = layer.get(I.id);
      colRight[L] = Math.max(colRight[L], I.extent.x + I.extent.w);
      for (const [pin, net] of Object.entries(I.part.pinNets)) {
        if (railKind(net) || lines.has(net)) continue;
        const pp = I.pins[pin];
        const d = DIRS[pp.dir];
        lines.set(net, { y: pp.y + (d.y ? d.y * 20 : 0), src: pp, order: lineOrder++ });
      }
    };
    const at = (p, originX, originY, rot, mirror) => makeInstance(p, snap(originX), snap(originY), rot, mirror, nets);
    for (const p of parts) {
      const pos = p.comp.position;
      if (!pos) continue;
      const o = orient.get(p.id);
      commit(at(p, pos.x, pos.y, o.rot, o.mirror));
    }
    const group = (p) => shunt(p) ? 0 : p.sym.pinOrder.length >= 3 ? 1 : 2;
    const order = parts.filter((p) => !inst.has(p.id)).sort((a, b) => islandOf.get(a.id) - islandOf.get(b.id) || wave.get(a.id) - wave.get(b.id) || group(a) - group(b) || layer.get(a.id) - layer.get(b.id));
    for (const p of order) {
      const o = orient.get(p.id);
      const L = layer.get(p.id);
      const s = p.sym;
      const anchors = s.pinOrder.filter((pin) => p.pinNets[pin] && lines.has(p.pinNets[pin])).sort((a, b) => signal(p.pinNets[b]) - signal(p.pinNets[a]) || lines.get(p.pinNets[a]).order - lines.get(p.pinNets[b]).order);
      let rot = o.rot, mirror = o.mirror;
      const anchor = anchors[0];
      if (anchor && o.flex) {
        const line = lines.get(p.pinNets[anchor]);
        const fromRight = line.src.x > colStart(L) + 10;
        const aIsFirst = anchor === s.pinOrder[0];
        rot = aIsFirst !== fromRight ? 0 : 180;
      }
      const T = trial(p, rot, mirror);
      const cands = [];
      if (anchor) {
        const net = p.pinNets[anchor];
        const line = lines.get(net);
        const ap = T.pins[anchor];
        const src = line.src;
        if (s.twoTerminal && o.flex) {
          const other = s.pinOrder.find((x) => x !== anchor);
          const sideOf = (I, n2) => Object.entries(I.part.pinNets).filter(([, x]) => x === n2).map(([pin]) => I.pins[pin].dir);
          const host = placed.find((I) => {
            if (I.part.sym.pinOrder.length < 3) return false;
            const a = sideOf(I, net), b = sideOf(I, p.pinNets[other]);
            return a.includes("left") && b.includes("right") || a.includes("right") && b.includes("left");
          });
          if (host) {
            const cx = host.body.x + host.body.w / 2;
            const midRel = (T.pins[s.pinOrder[0]].x + T.pins[s.pinOrder[1]].x) / 2;
            const ox2 = cx - midRel;
            const above = Math.floor((host.extent.y - CLEAR - (T.extent.y + T.extent.h)) / GRID) * GRID;
            const below = Math.ceil((host.extent.y + host.extent.h + CLEAR - T.extent.y) / GRID) * GRID;
            cands.push([ox2, above], [ox2, below]);
          }
        }
        if ((src.dir === "up" || src.dir === "down") && ap.dir === OPPOSITE[src.dir]) {
          const d = DIRS[src.dir];
          cands.push([src.x - ap.x, src.y + d.y * 30 - ap.y]);
        }
        const horiz = ap.dir === "left" || ap.dir === "right";
        const ty = horiz ? line.y : line.y - DIRS[ap.dir].y * 20;
        let ox = colStart(L) - coreLeft(T);
        if (src.dir === "right") ox = Math.max(ox, src.x + 20 - ap.x);
        if (src.dir === "left") ox = Math.min(ox, src.x - 20 - ap.x);
        cands.push([ox, ty - ap.y]);
      } else {
        cands.push([colStart(L) - coreLeft(T), cursor[L] - T.extent.y]);
      }
      let chosen = null;
      for (const [ox, oy] of cands) {
        const I = at(p, ox, oy, rot, mirror);
        if (isFree(I)) {
          chosen = I;
          break;
        }
      }
      if (!chosen) {
        const [bx, by] = cands[cands.length - 1];
        const down = s.category === "digital" || s.terminal || !anchor;
        const src = anchor && lines.get(p.pinNets[anchor]).src;
        const sx = !src ? 1 : src.dir === "left" ? -1 : src.dir === "right" ? 1 : src.x > bx + T.pins[anchor].x ? -1 : 1;
        const steps = [];
        for (let k = 1; k <= 40; k++) steps.push(down ? [0, 20 * k] : [sx * 20 * k, 0]);
        for (let k = 1; k <= 40; k++) steps.push(down ? [sx * 20 * k, 0] : [0, 20 * k], [0, -20 * k]);
        for (let k = 1; k <= 30; k++) steps.push([sx * 20 * k, 20 * k]);
        for (const [dx, dy] of steps) {
          const I = at(p, bx + dx, by + dy, rot, mirror);
          if (isFree(I)) {
            chosen = I;
            break;
          }
        }
        if (!chosen) {
          const maxY = Math.max(0, ...placed.map((I) => I.extent.y + I.extent.h));
          chosen = at(p, bx, maxY + 60 - T.extent.y, rot, mirror);
        }
      }
      if (!anchor) cursor[L] = chosen.extent.y + chosen.extent.h + CLEAR + 20;
      commit(chosen);
    }
    alignTerminals(parts, nets, inst, isFree, at, orient);
    return { instances: inst, orient, layers: layer };
  }
  function relaxDirected(parts, nets, signal, layer, roots) {
    const E = new Map(parts.map((p) => [p.id, /* @__PURE__ */ new Set()]));
    let any = false;
    for (const [nid, net] of nets) {
      if (!signal(nid)) continue;
      const io = (e) => parts.find((p) => p.id === e.comp).sym.pins[e.pin].io;
      const drivers = net.pins.filter((e) => io(e) === "out");
      const sinks = net.pins.filter((e) => io(e) === "in");
      for (const d of drivers) for (const s of sinks) if (d.comp !== s.comp) {
        E.get(d.comp).add(s.comp);
        any = true;
      }
    }
    if (!any) return;
    const state2 = /* @__PURE__ */ new Map(), topo = [], back = /* @__PURE__ */ new Set();
    const dfs = (u) => {
      state2.set(u, 1);
      for (const v of E.get(u)) {
        if (state2.get(v) === 1) back.add(u + ">" + v);
        else if (!state2.get(v)) dfs(v);
      }
      state2.set(u, 2);
      topo.push(u);
    };
    for (const r of roots) if (!state2.get(r.id)) dfs(r.id);
    topo.reverse();
    for (const u of topo) for (const v of E.get(u)) {
      if (!back.has(u + ">" + v) && layer.get(v) < layer.get(u) + 1) layer.set(v, layer.get(u) + 1);
    }
  }
  function alignTerminals(parts, nets, inst, isFree, at, orient) {
    for (const p of parts) {
      if (!p.sym.terminal || p.comp.position) continue;
      const I = inst.get(p.id);
      const pinName = p.sym.pinOrder[0];
      const net = p.pinNets[pinName];
      if (!net) continue;
      const my = I.pins[pinName];
      const want = OPPOSITE[my.dir];
      const targets = nets.get(net).pins.filter((e) => e.comp !== p.id && inst.get(e.comp)?.pins[e.pin].dir === want).map((e) => inst.get(e.comp).pins[e.pin]);
      if (!targets.length) continue;
      targets.sort((a, b) => Math.abs(a.y - my.y) - Math.abs(b.y - my.y));
      const dy = targets[0].y - my.y;
      if (!dy) continue;
      const o = orient.get(p.id);
      const J = at(p, I.x, I.y + dy, o.rot, o.mirror);
      if (isFree(J, I)) Object.assign(I, J);
    }
  }

  // src/router/index.js
  var DX = [1, 0, -1, 0];
  var DY = [0, 1, 0, -1];
  var DIR_INDEX = { right: 0, down: 1, left: 2, up: 3 };
  var BIT = [1, 2, 4, 8];
  var BEND = 5;
  var CROSS = 8;
  var VIOLATION = 400;
  var popcount = (b) => (b & 1) + (b >> 1 & 1) + (b >> 2 & 1) + (b >> 3 & 1);
  function routeCircuit(nl, instances) {
    const insts = [...instances.values()];
    let bounds = null;
    for (const I of insts) bounds = unionRect(bounds, I.extent);
    bounds = bounds || { x: 0, y: 0, w: 0, h: 0 };
    const PAD = 80;
    const x0 = Math.floor((bounds.x - PAD) / GRID) * GRID;
    const y0 = Math.floor((bounds.y - PAD) / GRID) * GRID;
    const W = Math.ceil((bounds.x + bounds.w + PAD - x0) / GRID) + 1;
    const H = Math.ceil((bounds.y + bounds.h + PAD - y0) / GRID) + 1;
    const N = W * H;
    const cellOf = (x, y) => {
      const cx2 = Math.round((x - x0) / GRID), cy2 = Math.round((y - y0) / GRID);
      return cx2 < 0 || cy2 < 0 || cx2 >= W || cy2 >= H ? -1 : cy2 * W + cx2;
    };
    const cx = (c) => x0 + c % W * GRID, cy = (c) => y0 + Math.floor(c / W) * GRID;
    const blocked = new Uint8Array(N);
    const soft = new Float32Array(N);
    const pinOwner = new Int32Array(N).fill(-1);
    const pinEntry = new Int8Array(N).fill(-1);
    const occH = new Int32Array(N), occV = new Int32Array(N);
    const fillRect = (r, fn) => {
      const ax = Math.ceil((r.x - x0) / GRID), bx = Math.floor((r.x + r.w - x0) / GRID);
      const ay = Math.ceil((r.y - y0) / GRID), by = Math.floor((r.y + r.h - y0) / GRID);
      for (let j = Math.max(0, ay); j <= Math.min(H - 1, by); j++)
        for (let i = Math.max(0, ax); i <= Math.min(W - 1, bx); i++) fn(j * W + i);
    };
    const routed = [];
    const netIndex = /* @__PURE__ */ new Map();
    for (const [id, net] of nl.nets) {
      if (net.rail) continue;
      const pins = net.pins.filter((e) => instances.has(e.comp)).map((e) => {
        const p = instances.get(e.comp).pins[e.pin];
        return { ...e, x: p.x, y: p.y, dir: p.dir, cell: cellOf(p.x, p.y) };
      });
      if (pins.length < 2) continue;
      netIndex.set(id, routed.length);
      routed.push({ id, pins });
    }
    for (const I of insts) {
      const body = inflate(I.body, 3);
      fillRect(body, (c) => {
        blocked[c] = 1;
      });
      fillRect(inflate(I.body, 11), (c) => {
        soft[c] += 0.6;
      });
      for (const l of I.labels) fillRect(inflate(l.box, 2), (c) => {
        soft[c] += 6;
      });
      for (const [name, p] of Object.entries(I.pins)) {
        const c = cellOf(p.x, p.y);
        if (c < 0) continue;
        const net = I.part.pinNets[name];
        const ni = netIndex.has(net) ? netIndex.get(net) : -2;
        const d = DIRS[p.dir];
        for (let k = 1; k <= 6; k++) {
          const lx = p.x - d.x * GRID * k, ly = p.y - d.y * GRID * k;
          const lc = cellOf(lx, ly);
          if (lc < 0) break;
          blocked[lc] = 1;
          if (lx >= body.x && lx <= body.x + body.w && ly >= body.y && ly <= body.y + body.h) break;
        }
        blocked[c] = 1;
        pinOwner[c] = ni;
        pinEntry[c] = DIR_INDEX[OPPOSITE[p.dir]];
      }
      for (const m of I.markers) {
        fillRect(inflate(m.bbox, 3), (c) => {
          if (pinOwner[c] === -1) blocked[c] = 1;
        });
      }
    }
    const bits = routed.map(() => /* @__PURE__ */ new Map());
    const addBit = (ni, c, b) => bits[ni].set(c, (bits[ni].get(c) || 0) | b);
    routed.forEach((net, ni) => {
      for (const p of net.pins) if (p.cell >= 0) addBit(ni, p.cell, BIT[DIR_INDEX[OPPOSITE[p.dir]]]);
    });
    const S = N * 4;
    const g = new Float64Array(S);
    const stamp = new Uint32Array(S);
    const prev = new Int32Array(S);
    let gen = 0;
    const heap = [];
    const push = (f, s) => {
      heap.push([f, s]);
      let i = heap.length - 1;
      while (i > 0) {
        const pa = i - 1 >> 1;
        if (heap[pa][0] <= heap[i][0]) break;
        [heap[pa], heap[i]] = [heap[i], heap[pa]];
        i = pa;
      }
    };
    const pop = () => {
      const top = heap[0], last = heap.pop();
      if (heap.length) {
        heap[0] = last;
        let i = 0;
        for (; ; ) {
          const l = 2 * i + 1, r = l + 1;
          let m = i;
          if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
          if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
          if (m === i) break;
          [heap[m], heap[i]] = [heap[i], heap[m]];
          i = m;
        }
      }
      return top;
    };
    const foreign = (occ, c, ni) => occ[c] !== 0 && occ[c] !== ni + 1;
    const foreignBits = (c, ni) => {
      const o = occH[c] && occH[c] !== ni + 1 ? occH[c] - 1 : occV[c] && occV[c] !== ni + 1 ? occV[c] - 1 : -1;
      return o < 0 ? 0 : bits[o].get(c) || 0;
    };
    function search(ni, start, startDir, tree, relaxed) {
      gen++;
      heap.length = 0;
      let bx1 = Infinity, by1 = Infinity, bx2 = -Infinity, by2 = -Infinity;
      for (const c of tree) {
        const x = c % W, y = c / W | 0;
        bx1 = Math.min(bx1, x);
        bx2 = Math.max(bx2, x);
        by1 = Math.min(by1, y);
        by2 = Math.max(by2, y);
      }
      const h = (c) => {
        const x = c % W, y = c / W | 0;
        return Math.max(0, bx1 - x, x - bx2) + Math.max(0, by1 - y, y - by2);
      };
      const s0 = start * 4 + startDir;
      g[s0] = 0;
      stamp[s0] = gen;
      prev[s0] = -1;
      push(h(start), s0);
      let iter = 0;
      while (heap.length) {
        if (++iter > 4e5) break;
        const [f, s] = pop();
        const c = s >> 2, d = s & 3;
        const gc = g[s];
        if (f - h(c) > gc + 1e-9) continue;
        if (c !== start && tree.has(c)) return s;
        for (let nd = 0; nd < 4; nd++) {
          if (nd === (d + 2 & 3)) continue;
          const x = c % W + DX[nd], y = (c / W | 0) + DY[nd];
          if (x < 0 || y < 0 || x >= W || y >= H) continue;
          const n2 = y * W + x;
          let cost = 1 + soft[n2];
          if (nd !== d) {
            if (c === start) continue;
            cost += BEND;
            if (foreign(occH, c, ni) || foreign(occV, c, ni)) {
              if (!relaxed) continue;
              cost += VIOLATION;
            }
          }
          const owner = pinOwner[n2];
          if (owner !== -1) {
            if (owner !== ni || nd !== pinEntry[n2]) {
              if (!relaxed || owner === ni) continue;
              cost += VIOLATION * 2;
            }
          } else if (blocked[n2]) {
            if (!relaxed) continue;
            cost += VIOLATION * 2;
          }
          const horiz = nd === 0 || nd === 2;
          if (foreign(horiz ? occH : occV, n2, ni)) {
            if (!relaxed) continue;
            cost += VIOLATION;
          }
          if (foreign(horiz ? occV : occH, n2, ni)) {
            const fb = foreignBits(n2, ni);
            const straight = horiz ? fb === (BIT[1] | BIT[3]) : fb === (BIT[0] | BIT[2]);
            if (!straight) {
              if (!relaxed) continue;
              cost += VIOLATION;
            }
            cost += CROSS;
          }
          if (tree.has(n2) && owner === -1) {
            const nb = (bits[ni].get(n2) || 0) | BIT[nd + 2 & 3];
            if (popcount(nb) > 3) cost += BEND;
          }
          const ns = n2 * 4 + nd;
          const ng = gc + cost;
          if (stamp[ns] === gen && g[ns] <= ng) continue;
          stamp[ns] = gen;
          g[ns] = ng;
          prev[ns] = s;
          push(ng + h(n2), ns);
        }
      }
      return -1;
    }
    const commitPath = (ni, cells) => {
      for (let i = 0; i + 1 < cells.length; i++) {
        const a = cells[i], b = cells[i + 1];
        const horiz = Math.abs(a - b) === 1;
        const occ = horiz ? occH : occV;
        if (!occ[a]) occ[a] = ni + 1;
        if (!occ[b]) occ[b] = ni + 1;
        const d = horiz ? b > a ? 0 : 2 : b > a ? 1 : 3;
        addBit(ni, a, BIT[d]);
        addBit(ni, b, BIT[d + 2 & 3]);
      }
    };
    const failures = [];
    const paths = routed.map(() => []);
    const order = routed.map((_, i) => i).sort((a, b) => span(routed[a].pins) - span(routed[b].pins));
    for (const ni of order) {
      const net = routed[ni];
      const pins = net.pins.filter((p) => p.cell >= 0);
      const first = pins.reduce((m, p) => p.x < m.x || p.x === m.x && p.y < m.y ? p : m, pins[0]);
      const tree = /* @__PURE__ */ new Set([first.cell]);
      const todo = pins.filter((p) => p !== first);
      while (todo.length) {
        let bi = 0, bd = Infinity;
        todo.forEach((p2, i) => {
          for (const c of tree) {
            const dd = Math.abs(cx(c) - p2.x) + Math.abs(cy(c) - p2.y);
            if (dd < bd) {
              bd = dd;
              bi = i;
            }
          }
        });
        const p = todo.splice(bi, 1)[0];
        if (tree.has(p.cell)) continue;
        const sd = DIR_INDEX[p.dir];
        let end = search(ni, p.cell, sd, tree, false);
        if (end < 0) end = search(ni, p.cell, sd, tree, true);
        let cells;
        if (end >= 0) {
          cells = [];
          for (let s = end; s >= 0; s = prev[s]) cells.push(s >> 2);
          cells.reverse();
        } else {
          failures.push({ net: net.id, comp: p.comp, pin: p.pin });
          const t = [...tree][0];
          const mid = cellOf(cx(t), p.y);
          cells = [p.cell, mid, t].filter((c, i, a) => c >= 0 && c !== a[i - 1]);
          cells = expandCells(cells, W);
        }
        commitPath(ni, cells);
        for (const c of cells) tree.add(c);
        paths[ni].push(cells.map((c) => ({ x: cx(c), y: cy(c) })));
      }
    }
    const nets = /* @__PURE__ */ new Map();
    routed.forEach((net, ni) => nets.set(net.id, { id: net.id, paths: paths[ni].map(simplify), segments: toSegments(paths[ni]) }));
    const junctions = [];
    routed.forEach((net, ni) => {
      for (const [c, b] of bits[ni]) if (popcount(b) >= 3) junctions.push({ x: cx(c), y: cy(c), net: net.id });
    });
    const crossings = [];
    for (let c = 0; c < N; c++) {
      if (occH[c] && occV[c] && occH[c] !== occV[c]) {
        crossings.push({ x: cx(c), y: cy(c), h: routed[occH[c] - 1].id, v: routed[occV[c] - 1].id });
      }
    }
    return { nets, junctions, crossings, failures };
  }
  function span(pins) {
    const xs = pins.map((p) => p.x), ys = pins.map((p) => p.y);
    return Math.max(...xs) - Math.min(...xs) + Math.max(...ys) - Math.min(...ys);
  }
  function expandCells(cells, W) {
    const out = [cells[0]];
    for (let i = 1; i < cells.length; i++) {
      let a = out[out.length - 1];
      const b = cells[i];
      const bx = b % W, by = b / W | 0;
      while (a % W !== bx) {
        a += bx > a % W ? 1 : -1;
        out.push(a);
      }
      while ((a / W | 0) !== by) {
        a += by > (a / W | 0) ? W : -W;
        out.push(a);
      }
    }
    return out;
  }
  function simplify(pts) {
    const out = [];
    for (const p of pts) {
      if (out.length >= 2) {
        const a = out[out.length - 2], b = out[out.length - 1];
        if (a.x === b.x && b.x === p.x || a.y === b.y && b.y === p.y) {
          out[out.length - 1] = p;
          continue;
        }
      }
      if (!out.length || out[out.length - 1].x !== p.x || out[out.length - 1].y !== p.y) out.push(p);
    }
    return out;
  }
  function toSegments(paths) {
    const segs = [];
    for (const path of paths) {
      const s = simplify(path);
      for (let i = 0; i + 1 < s.length; i++) segs.push({ x1: s[i].x, y1: s[i].y, x2: s[i + 1].x, y2: s[i + 1].y });
    }
    return segs;
  }

  // src/layout/labels.js
  function placeLabels(instances, routing) {
    const segs = [];
    for (const n2 of routing.nets.values()) segs.push(...n2.segments);
    const insts = [...instances.values()];
    const taken = [];
    const score = (I, labels) => {
      let s = 0;
      for (const l of labels) {
        const b = inflate(l.box, 1);
        for (const seg of segs) if (segHitsRect(seg, b)) s += 3;
        for (const J of insts) {
          if (overlaps(b, J.body)) s += J === I ? 5 : 4;
          for (const m of J.markers) if (overlaps(b, m.bbox)) s += 3;
        }
        for (const t of taken) if (overlaps(b, t)) s += 4;
      }
      return s;
    };
    for (const I of insts) {
      I.labelsFinal = I.labels;
      if (I.labelAlt?.length) {
        const a = score(I, I.labels), b = score(I, I.labelAlt);
        if (b < a) I.labelsFinal = I.labelAlt;
      }
      for (const l of I.labelsFinal) taken.push(l.box);
    }
  }

  // src/renderer/index.js
  var THEMES = {
    light: { ink: "#1b1b1f", wire: "#1b1b1f", muted: "#55565c", junction: "#1b1b1f", background: "#ffffff" },
    dark: { ink: "#e7e7ea", wire: "#e7e7ea", muted: "#a1a1aa", junction: "#e7e7ea", background: "#18181b" }
  };
  var FONT = "Helvetica, Arial, sans-serif";
  var esc2 = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  var n = (v) => +(+v).toFixed(2);
  function sceneBounds(scene) {
    let b = null;
    for (const I of scene.instances.values()) {
      b = unionRect(b, I.body);
      b = unionRect(b, boundsOf(Object.values(I.pins)));
      for (const m of I.markers) b = unionRect(b, m.bbox);
      for (const l of I.labelsFinal || I.labels) b = unionRect(b, l.box);
    }
    for (const net of scene.routing.nets.values())
      for (const s of net.segments) b = unionRect(b, boundsOf([{ x: s.x1, y: s.y1 }, { x: s.x2, y: s.y2 }]));
    return b || { x: 0, y: 0, w: 200, h: 100 };
  }
  function renderSVG(scene, opts = {}) {
    const th = THEMES[opts.theme] || THEMES.light;
    const pad = opts.padding ?? 30;
    const title = opts.showTitle !== false && scene.title ? String(scene.title) : "";
    const b = sceneBounds(scene);
    const titleH = title ? 30 : 0;
    const vx = Math.floor(b.x - pad), vy = Math.floor(b.y - pad - titleH);
    const vw = Math.ceil(b.w + 2 * pad), vh = Math.ceil(b.h + 2 * pad + titleH);
    const bg = opts.background === void 0 ? th.background : opts.background;
    const out = [];
    out.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${vw}" height="${vh}" viewBox="${vx} ${vy} ${vw} ${vh}" font-family="${FONT}" data-generator="CircuitForge">`);
    out.push(`<title>${esc2(title || "Circuit schematic")}</title><desc>Generated by CircuitForge</desc>`);
    if (bg) out.push(`<rect x="${vx}" y="${vy}" width="${vw}" height="${vh}" fill="${bg}"/>`);
    if (title) out.push(`<text x="${n(b.x)}" y="${n(vy + pad + 12)}" font-size="14" font-weight="600" fill="${th.ink}">${esc2(title)}</text>`);
    out.push(`<g id="wires" fill="none" stroke="${th.wire}" stroke-width="1.6" stroke-linecap="square" stroke-linejoin="miter">`);
    const bridgeAt = /* @__PURE__ */ new Map();
    if (opts.bridges) for (const c of scene.routing.crossings) {
      if (!bridgeAt.has(c.h)) bridgeAt.set(c.h, []);
      bridgeAt.get(c.h).push(c);
    }
    for (const net of scene.routing.nets.values()) {
      const hops = bridgeAt.get(net.id) || [];
      const d = net.paths.map((p) => pathD(p, hops)).join("");
      if (d) out.push(`<path data-net="${esc2(net.id)}" d="${d}"/>`);
    }
    out.push("</g>");
    out.push(`<g id="components" color="${th.ink}">`);
    for (const I of scene.instances.values()) {
      const s = I.part.sym;
      const tf = `translate(${n(I.x)} ${n(I.y)})${I.rot ? ` rotate(${I.rot})` : ""}${I.mirror ? " scale(-1 1)" : ""} translate(${n(-s.origin.x)} ${n(-s.origin.y)})`;
      const hit = opts.interactive ? `<rect class="cf-hit" x="${n(s.body.x - 4)}" y="${n(s.body.y - 4)}" width="${n(s.body.w + 8)}" height="${n(s.body.h + 8)}" fill="transparent" stroke="none"/>` : "";
      out.push(`<g id="${esc2("part-" + I.id)}" class="cf-part" data-id="${esc2(I.id)}" data-type="${esc2(s.type)}" transform="${tf}">${hit}${s.svgBody}</g>`);
    }
    out.push("</g>");
    out.push(`<g id="markers" color="${th.ink}" fill="none" stroke="${th.wire}" stroke-width="1.6">`);
    for (const I of scene.instances.values()) {
      for (const m of I.markers) {
        const parts = [];
        if (m.stubs.length) parts.push(`<path d="${m.stubs.map((st) => `M${n(st.x1)} ${n(st.y1)}L${n(st.x2)} ${n(st.y2)}`).join("")}" stroke-linecap="square"/>`);
        if (m.dot) parts.push(`<circle cx="${n(m.dot.x)}" cy="${n(m.dot.y)}" r="3.2" fill="${th.junction}" stroke="none"/>`);
        if (m.sym) {
          const t = m.t;
          parts.push(`<g transform="translate(${n(t.x)} ${n(t.y)})${t.rot ? ` rotate(${t.rot})` : ""} translate(${n(-t.ox)} ${n(-t.oy)})">${m.sym.svgBody}</g>`);
        }
        if (m.flag) {
          const pts = m.flag.map(([x, y]) => `${n(x)},${n(y)}`).join(" ");
          parts.push(m.box ? `<polyline points="${pts}"/><rect x="${n(m.box.x)}" y="${n(m.box.y)}" width="${n(m.box.w)}" height="${n(m.box.h)}" rx="2"/>` : `<polygon points="${pts}" stroke-linejoin="round"/>`);
        }
        if (m.text) parts.push(textEl(m.text, th.ink, "normal"));
        out.push(`<g class="cf-marker" data-for="${esc2(I.id)}" data-net="${esc2(m.net)}">${parts.join("")}</g>`);
      }
    }
    out.push("</g>");
    out.push(`<g id="labels" stroke="none">`);
    for (const I of scene.instances.values()) {
      const ls = I.labelsFinal || I.labels;
      if (!ls.length) continue;
      out.push(`<g class="cf-labels" data-for="${esc2(I.id)}">${ls.map((l) => textEl(l, l.cls === "value" ? th.muted : th.ink, l.cls === "ref" ? "600" : "normal")).join("")}</g>`);
    }
    out.push("</g>");
    out.push(`<g id="junctions" fill="${th.junction}" stroke="none">`);
    for (const j of scene.routing.junctions) out.push(`<circle cx="${n(j.x)}" cy="${n(j.y)}" r="3.2"/>`);
    out.push("</g>");
    out.push("</svg>");
    return { svg: out.join("\n"), width: vw, height: vh, viewBox: { x: vx, y: vy, w: vw, h: vh } };
  }
  function textEl(l, fill, weight) {
    return `<text x="${n(l.x)}" y="${n(l.y)}" font-size="${l.size}" text-anchor="${l.anchor}" fill="${fill}"${weight !== "normal" ? ` font-weight="${weight}"` : ""}>${esc2(l.text)}</text>`;
  }
  var R = 4.5;
  function pathD(pts, hops) {
    if (pts.length < 2) return "";
    let d = `M${n(pts[0].x)} ${n(pts[0].y)}`;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      if (a.y === b.y && hops.length) {
        const dir = b.x > a.x ? 1 : -1;
        const xs = hops.filter((h) => h.y === a.y && (h.x - a.x) * dir > R && (b.x - h.x) * dir > R).map((h) => h.x).sort((p, q) => (p - q) * dir);
        for (const x of xs) {
          d += `H${n(x - dir * R)}a${R} ${R} 0 0 ${dir > 0 ? 1 : 0} ${n(dir * 2 * R)} 0`;
        }
      }
      d += a.x === b.x ? `V${n(b.y)}` : a.y === b.y ? `H${n(b.x)}` : `L${n(b.x)} ${n(b.y)}`;
    }
    return d;
  }

  // src/engine.js
  function validate(input) {
    const v = validateCircuit(input);
    return { valid: v.valid, errors: v.errors, warnings: v.warnings };
  }
  function buildScene(input, v = validateCircuit(input)) {
    if (!v.valid) return { v, scene: null };
    const warnings = v.warnings;
    const nl = buildNetlist(v);
    let placement;
    try {
      placement = layoutCircuit(nl);
    } catch (e) {
      v.errors.push({ code: "LAYOUT_FAILURE", message: `Layout failed: ${e.message}` });
      v.valid = false;
      return { v, scene: null };
    }
    let routing;
    try {
      routing = routeCircuit(nl, placement.instances);
    } catch (e) {
      v.errors.push({ code: "ROUTING_FAILURE", message: `Routing failed: ${e.message}` });
      v.valid = false;
      return { v, scene: null };
    }
    for (const f of routing.failures) {
      warnings.push({ code: "ROUTING_FAILURE", component: f.comp, pin: f.pin, message: `Could not find a clean route to ${f.comp}.${f.pin}; drew a direct wire instead.` });
    }
    placeLabels(placement.instances, routing);
    return { v, scene: { title: v.circuit.title, netlist: nl, instances: placement.instances, routing } };
  }
  function render(input, options = {}) {
    const v = validateCircuit(input);
    const { scene } = buildScene(input, v);
    if (!scene) return { valid: false, errors: v.errors, warnings: v.warnings, svg: null };
    const out = renderSVG(scene, options);
    return { valid: true, errors: [], warnings: v.warnings, svg: out.svg, width: out.width, height: out.height, viewBox: out.viewBox, scene };
  }

  // src/editor/history.js
  var History = class {
    constructor(limit = 200) {
      this.stack = [];
      this.index = -1;
      this.limit = limit;
    }
    push(text) {
      if (this.stack[this.index] === text) return;
      this.stack.length = this.index + 1;
      this.stack.push(text);
      if (this.stack.length > this.limit) this.stack.shift();
      this.index = this.stack.length - 1;
    }
    get canUndo() {
      return this.index > 0;
    }
    get canRedo() {
      return this.index < this.stack.length - 1;
    }
    undo() {
      return this.canUndo ? this.stack[--this.index] : null;
    }
    redo() {
      return this.canRedo ? this.stack[++this.index] : null;
    }
  };

  // src/editor/model.js
  var clone = (o) => JSON.parse(JSON.stringify(o));
  function formatJSON(value, indent = "") {
    const flat = JSON.stringify(value);
    if (flat === void 0) return "null";
    const simple = (v) => v === null || typeof v !== "object" || (Array.isArray(v) ? v.every((x) => x === null || typeof x !== "object") : Object.values(v).every((x) => x === null || typeof x !== "object"));
    if (value === null || typeof value !== "object") return flat;
    const primitive = (x) => x === null || typeof x !== "object";
    const inline = (Array.isArray(value) ? value.every(primitive) : Object.values(value).every(simple)) && flat.length + indent.length <= 100;
    if (inline) return Array.isArray(value) ? flat.replace(/","/g, '", "') : prettyInline(value);
    const next = indent + "  ";
    if (Array.isArray(value)) {
      if (!value.length) return "[]";
      return "[\n" + value.map((v) => next + formatJSON(v, next)).join(",\n") + "\n" + indent + "]";
    }
    const keys = Object.keys(value);
    if (!keys.length) return "{}";
    return "{\n" + keys.map((k) => `${next}${JSON.stringify(k)}: ${formatJSON(value[k], next)}`).join(",\n") + "\n" + indent + "}";
  }
  function prettyInline(o) {
    const parts = Object.entries(o).map(([k, v]) => `${JSON.stringify(k)}: ${Array.isArray(v) ? JSON.stringify(v).replace(/","/g, '", "') : v && typeof v === "object" ? prettyInline(v) : JSON.stringify(v)}`);
    return parts.length ? `{ ${parts.join(", ")} }` : "{}";
  }
  var refsOf = (circuit) => {
    const lists = [];
    (circuit.connections || []).forEach((c, i) => {
      if (Array.isArray(c)) lists.push({ get: () => c, set: (v) => circuit.connections[i] = v, kind: "array" });
      else if (c && Array.isArray(c.pins)) lists.push({ get: () => c.pins, set: (v) => c.pins = v, kind: "pins" });
      else if (c && typeof c === "object") lists.push({ get: () => [c.from, c.to], set: (v) => {
        c.from = v[0];
        c.to = v[1];
      }, kind: "pair" });
    });
    if (circuit.nets && typeof circuit.nets === "object") {
      for (const k of Object.keys(circuit.nets)) if (Array.isArray(circuit.nets[k])) lists.push({ get: () => circuit.nets[k], set: (v) => circuit.nets[k] = v, kind: "net" });
    }
    return lists;
  };
  function deleteComponent(circuit, id) {
    const c = clone(circuit);
    c.components = (c.components || []).filter((x) => x.id !== id);
    const keep = (r) => parseRef(r)?.comp !== id;
    if (Array.isArray(c.connections)) {
      c.connections = c.connections.map((x) => {
        if (Array.isArray(x)) {
          const r = x.filter(keep);
          return r.length >= 2 ? r : null;
        }
        if (x && Array.isArray(x.pins)) {
          const r = x.pins.filter(keep);
          return r.length >= 2 ? { ...x, pins: r } : null;
        }
        if (x && typeof x === "object") return keep(x.from) && keep(x.to) ? x : null;
        return x;
      }).filter((x) => x !== null);
    }
    if (c.nets && typeof c.nets === "object") {
      for (const k of Object.keys(c.nets)) if (Array.isArray(c.nets[k])) c.nets[k] = c.nets[k].filter(keep);
    }
    return c;
  }
  function renameComponent(circuit, oldId, newId) {
    const c = clone(circuit);
    const comp = c.components.find((x) => x.id === oldId);
    if (!comp) return c;
    comp.id = newId;
    for (const l of refsOf(c)) {
      l.set(l.get().map((r) => {
        const p = parseRef(r);
        return p && p.comp === oldId ? p.pin == null ? newId : `${newId}.${p.pin}` : r;
      }));
    }
    return c;
  }
  function updateComponent(circuit, id, patch) {
    const c = clone(circuit);
    const comp = c.components.find((x) => x.id === id);
    if (!comp) return c;
    for (const [k, v] of Object.entries(patch)) {
      if (v === void 0 || v === "" || v === null) delete comp[k];
      else comp[k] = v;
    }
    return c;
  }
  function pinLayout(circuit, instances, moves = {}) {
    const c = clone(circuit);
    for (const comp of c.components || []) {
      const I = instances.get(comp.id);
      if (!I) continue;
      const m = moves[comp.id];
      comp.position = { x: m ? m.x : I.x, y: m ? m.y : I.y };
      comp.rotation = I.rot;
      if (I.mirror) comp.mirror = true;
      else delete comp.mirror;
    }
    return c;
  }
  function rotateComponent(circuit, instances, id) {
    const I = instances.get(id);
    const c = pinLayout(circuit, instances);
    const comp = c.components.find((x) => x.id === id);
    if (comp && I) comp.rotation = (I.rot + 90) % 360;
    return c;
  }
  function clearLayout(circuit) {
    const c = clone(circuit);
    for (const comp of c.components || []) {
      delete comp.position;
      delete comp.rotation;
      delete comp.mirror;
    }
    return c;
  }
  function addComponent(circuit, type) {
    const c = clone(circuit);
    c.components = c.components || [];
    const sym = resolveSymbol({ type });
    const prefix = sym?.prefix || (sym?.rail ? type.toUpperCase() : "X");
    let n2 = 1;
    const ids = new Set(c.components.map((x) => x.id));
    while (ids.has(prefix + n2)) n2++;
    const id = sym?.rail && !ids.has(prefix) ? prefix : prefix + n2;
    c.components.push({ id, type });
    return { circuit: c, id };
  }
  var EMPTY_CIRCUIT = { title: "Untitled circuit", components: [], connections: [] };

  // src/exporters/pdf.js
  async function deflate(bytes) {
    const cs = new CompressionStream("deflate");
    const stream = new Blob([bytes]).stream().pipeThrough(cs);
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }
  var enc = new TextEncoder();
  async function buildPDF({ width, height, pw, ph, rgb, title = "CircuitForge schematic" }) {
    const img = await deflate(rgb);
    const chunks = [];
    const offsets = [];
    let pos = 0;
    const put = (x) => {
      const b = typeof x === "string" ? enc.encode(x) : x;
      chunks.push(b);
      pos += b.length;
    };
    const obj = (n2, body) => {
      offsets[n2] = pos;
      put(`${n2} 0 obj
`);
      body();
      put("\nendobj\n");
    };
    const esc3 = (s) => String(s).replace(/[\\()]/g, (c) => "\\" + c).replace(/[^\x20-\x7e]/g, "?");
    const W = +width.toFixed(2), H = +height.toFixed(2);
    put("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
    obj(1, () => put("<< /Type /Catalog /Pages 2 0 R >>"));
    obj(2, () => put("<< /Type /Pages /Kids [3 0 R] /Count 1 >>"));
    obj(3, () => put(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`));
    obj(4, () => {
      put(`<< /Type /XObject /Subtype /Image /Width ${pw} /Height ${ph} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length ${img.length} >>
stream
`);
      put(img);
      put("\nendstream");
    });
    const content = `q ${W} 0 0 ${H} 0 0 cm /Im0 Do Q`;
    obj(5, () => put(`<< /Length ${content.length} >>
stream
${content}
endstream`));
    obj(6, () => put(`<< /Title (${esc3(title)}) /Producer (CircuitForge) >>`));
    const xref = pos;
    put(`xref
0 7
0000000000 65535 f 
`);
    for (let i = 1; i <= 6; i++) put(String(offsets[i]).padStart(10, "0") + " 00000 n \n");
    put(`trailer
<< /Size 7 /Root 1 0 R /Info 6 0 R >>
startxref
${xref}
%%EOF
`);
    const out = new Uint8Array(pos);
    let o = 0;
    for (const c of chunks) {
      out.set(c, o);
      o += c.length;
    }
    return out;
  }

  // src/exporters/index.js
  var MAX_PIXELS = 12e3 * 12e3;
  function slug(s) {
    return String(s || "circuit").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "circuit";
  }
  function download(data, filename, type) {
    const blob = data instanceof Blob ? data : new Blob([data], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1e3);
  }
  async function svgToCanvas(svg, width, height, scale = 2, background = "#ffffff") {
    const s = Math.min(scale, Math.sqrt(MAX_PIXELS / (width * height)));
    const canvas2 = document.createElement("canvas");
    canvas2.width = Math.max(1, Math.round(width * s));
    canvas2.height = Math.max(1, Math.round(height * s));
    const ctx = canvas2.getContext("2d");
    if (background) {
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, canvas2.width, canvas2.height);
    }
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
    try {
      const img = new Image();
      img.decoding = "sync";
      await new Promise((res, rej) => {
        img.onload = res;
        img.onerror = () => rej(new Error("Could not rasterize SVG"));
        img.src = url;
      });
      ctx.drawImage(img, 0, 0, canvas2.width, canvas2.height);
    } finally {
      URL.revokeObjectURL(url);
    }
    return canvas2;
  }
  var canvasBlob = (canvas2, type, quality) => new Promise((res, rej) => canvas2.toBlob((b) => b ? res(b) : rej(new Error("Export failed")), type, quality));
  async function toPNG(svg, w, h, { scale = 2, transparent = false } = {}) {
    return canvasBlob(await svgToCanvas(svg, w, h, scale, transparent ? null : "#ffffff"), "image/png");
  }
  async function toJPEG(svg, w, h, { scale = 2, quality = 0.95 } = {}) {
    return canvasBlob(await svgToCanvas(svg, w, h, scale, "#ffffff"), "image/jpeg", quality);
  }
  async function toPDF(svg, w, h, { scale = 4, title } = {}) {
    const canvas2 = await svgToCanvas(svg, w, h, scale, "#ffffff");
    const { data } = canvas2.getContext("2d").getImageData(0, 0, canvas2.width, canvas2.height);
    const rgb = new Uint8Array(canvas2.width * canvas2.height * 3);
    for (let i = 0, j = 0; i < data.length; i += 4, j += 3) {
      rgb[j] = data[i];
      rgb[j + 1] = data[i + 1];
      rgb[j + 2] = data[i + 2];
    }
    const bytes = await buildPDF({ width: w * 0.75, height: h * 0.75, pw: canvas2.width, ph: canvas2.height, rgb, title });
    return new Blob([bytes], { type: "application/pdf" });
  }
  async function copyText(text) {
    await navigator.clipboard.writeText(text);
  }
  async function copyPNG(svg, w, h, opts) {
    if (!window.ClipboardItem) throw new Error("This browser cannot copy images to the clipboard.");
    await navigator.clipboard.write([new ClipboardItem({ "image/png": toPNG(svg, w, h, opts) })]);
  }

  // src/api/handler.js
  var json = (status, obj) => ({ status, headers: { "content-type": "application/json; charset=utf-8" }, body: JSON.stringify(obj, null, 2) });
  function handleRequest(req, { apiKeys = null } = {}) {
    const path = (req.path || "").replace(/\/+$/, "");
    if (!["/api/v1/render", "/api/v1/validate"].includes(path)) return json(404, { error: "NOT_FOUND", message: `No route for ${req.path}` });
    if (req.method !== "POST") return json(405, { error: "METHOD_NOT_ALLOWED", message: "Use POST." });
    if (apiKeys && apiKeys.length) {
      const auth = req.headers?.authorization || req.headers?.Authorization || "";
      const key = auth.replace(/^Bearer\s+/i, "") || req.headers?.["x-api-key"];
      if (!apiKeys.includes(key)) return json(401, { error: "UNAUTHORIZED", message: "Missing or invalid API key." });
    }
    let body = req.body;
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch (e) {
        return json(400, { valid: false, errors: [{ code: "INVALID_JSON", message: `Invalid JSON body: ${e.message}` }] });
      }
    }
    if (!body || typeof body !== "object" || !body.circuit) return json(400, { valid: false, errors: [{ code: "INVALID_REQUEST", message: 'Body must be { "circuit": { \u2026 }, "format"?: "svg" }.' }] });
    if (path === "/api/v1/validate") {
      const v = validate(body.circuit);
      return json(v.valid ? 200 : 422, v);
    }
    const format = String(body.format || "svg").toLowerCase();
    if (format === "png" || format === "pdf" || format === "jpeg") {
      return json(501, { error: "NOT_IMPLEMENTED", message: `Server-side ${format.toUpperCase()} rendering is planned (resvg-based). Render SVG and rasterize client-side for now.` });
    }
    if (format !== "svg" && format !== "json") return json(400, { error: "INVALID_FORMAT", message: 'format must be "svg" or "json".' });
    const r = render(body.circuit, { theme: body.theme === "dark" ? "dark" : "light", bridges: !!body.bridges, background: body.transparent ? null : void 0 });
    if (!r.valid) return json(422, { valid: false, errors: r.errors, warnings: r.warnings });
    if (format === "svg") return { status: 200, headers: { "content-type": "image/svg+xml; charset=utf-8" }, body: r.svg };
    return json(200, { valid: true, warnings: r.warnings, width: r.width, height: r.height, svg: r.svg });
  }

  // src/ui/canvas.js
  var MIN_ZOOM = 0.1;
  var MAX_ZOOM = 8;
  var Canvas = class {
    constructor(el, viewport, { onSelect, onDragMove: onDragMove2, onDragEnd: onDragEnd2, onViewChange }) {
      this.el = el;
      this.vp = viewport;
      this.cb = { onSelect, onDragMove: onDragMove2, onDragEnd: onDragEnd2, onViewChange };
      this.scale = 1;
      this.tx = 0;
      this.ty = 0;
      this.vb = null;
      this.selected = null;
      this.spaceDown = false;
      this.autoFit = true;
      this.bind();
      new ResizeObserver(() => {
        if (this.autoFit) this.fit();
      }).observe(el);
    }
    // ---- content
    setSVG(svg, viewBox, { keepView = true } = {}) {
      if (this.vb && keepView) {
        this.tx += (viewBox.x - this.vb.x) * this.scale;
        this.ty += (viewBox.y - this.vb.y) * this.scale;
      }
      this.vb = viewBox;
      this.vp.innerHTML = svg;
      this.svg = this.vp.querySelector("svg");
      this.applySelection();
      this.apply();
    }
    setStale(stale) {
      this.vp.classList.toggle("stale", stale);
    }
    // ---- view transform
    apply() {
      this.vp.style.transform = `translate(${this.tx}px, ${this.ty}px) scale(${this.scale})`;
      const gs = 20 * this.scale;
      const ox = this.tx - (this.vb ? this.vb.x : 0) * this.scale;
      const oy = this.ty - (this.vb ? this.vb.y : 0) * this.scale;
      this.el.style.setProperty("--gs", `${gs}px`);
      this.el.style.setProperty("--gx", `${(ox % gs + gs) % gs}px`);
      this.el.style.setProperty("--gy", `${(oy % gs + gs) % gs}px`);
      this.cb.onViewChange?.(this.scale);
    }
    fit() {
      if (!this.vb) return;
      const r = this.el.getBoundingClientRect();
      const availW = Math.max(100, r.width - 64), availH = Math.max(100, r.height - 120);
      this.scale = Math.min(availW / this.vb.w, availH / this.vb.h, 2.5);
      this.tx = (r.width - this.vb.w * this.scale) / 2;
      this.ty = (r.height - 56 - this.vb.h * this.scale) / 2;
      this.autoFit = true;
      this.apply();
    }
    zoomAt(factor, px, py) {
      const r = this.el.getBoundingClientRect();
      if (px === void 0) {
        px = r.width / 2;
        py = r.height / 2;
      }
      this.autoFit = false;
      const s = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, this.scale * factor));
      this.tx = px - (px - this.tx) * (s / this.scale);
      this.ty = py - (py - this.ty) * (s / this.scale);
      this.scale = s;
      this.apply();
    }
    zoomTo(s) {
      this.zoomAt(s / this.scale);
    }
    toWorld(clientX, clientY) {
      const r = this.el.getBoundingClientRect();
      return {
        x: (clientX - r.left - this.tx) / this.scale + (this.vb ? this.vb.x : 0),
        y: (clientY - r.top - this.ty) / this.scale + (this.vb ? this.vb.y : 0)
      };
    }
    // ---- selection
    select(id) {
      this.selected = id;
      this.applySelection();
    }
    applySelection() {
      if (!this.svg) return;
      this.svg.querySelectorAll(".selected").forEach((n2) => n2.classList.remove("selected"));
      this.svg.querySelector(".sel-box")?.remove();
      if (!this.selected) return;
      const esc3 = CSS.escape(this.selected);
      const part = this.svg.querySelector(`.cf-part[data-id="${esc3}"]`);
      if (!part) return;
      part.classList.add("selected");
      this.svg.querySelector(`.cf-labels[data-for="${esc3}"]`)?.classList.add("selected");
      const b = part.getBBox();
      const m = part.transform.baseVal.consolidate()?.matrix;
      if (!m) return;
      const pts = [[b.x, b.y], [b.x + b.width, b.y], [b.x, b.y + b.height], [b.x + b.width, b.y + b.height]].map(([x, y]) => [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f]);
      const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
      const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      rect.setAttribute("class", "sel-box");
      rect.setAttribute("x", Math.min(...xs) - 5);
      rect.setAttribute("y", Math.min(...ys) - 5);
      rect.setAttribute("width", Math.max(...xs) - Math.min(...xs) + 10);
      rect.setAttribute("height", Math.max(...ys) - Math.min(...ys) + 10);
      rect.setAttribute("rx", 3);
      this.svg.insertBefore(rect, this.svg.querySelector("#components"));
    }
    // ---- input
    bind() {
      const el = this.el;
      el.addEventListener("wheel", (e) => {
        e.preventDefault();
        const r = el.getBoundingClientRect();
        if (e.ctrlKey || e.metaKey || !e.shiftKey) {
          const f = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 15e-4));
          this.zoomAt(f, e.clientX - r.left, e.clientY - r.top);
        } else {
          this.autoFit = false;
          this.tx -= e.deltaX || e.deltaY;
          this.apply();
        }
      }, { passive: false });
      let drag = null;
      el.addEventListener("pointerdown", (e) => {
        if (e.button !== 0 && e.button !== 1) return;
        el.focus({ preventScroll: true });
        const part = e.target.closest?.(".cf-part");
        const labels = e.target.closest?.(".cf-labels");
        const id = part?.dataset.id || labels?.dataset.for;
        const pan = e.button === 1 || this.spaceDown || !id;
        drag = { pan, id, x0: e.clientX, y0: e.clientY, tx0: this.tx, ty0: this.ty, w0: this.toWorld(e.clientX, e.clientY), moved: false };
        el.setPointerCapture(e.pointerId);
        if (!pan) {
          this.cb.onSelect(id);
        }
        if (pan) el.classList.add("panning");
        e.preventDefault();
      });
      el.addEventListener("pointermove", (e) => {
        if (!drag) return;
        const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
        if (!drag.moved && Math.hypot(dx, dy) < 3) return;
        drag.moved = true;
        if (drag.pan) {
          this.autoFit = false;
          this.tx = drag.tx0 + dx;
          this.ty = drag.ty0 + dy;
          this.apply();
        } else {
          const w = this.toWorld(e.clientX, e.clientY);
          this.vp.classList.add("dragging");
          this.cb.onDragMove(drag.id, w.x - drag.w0.x, w.y - drag.w0.y);
        }
      });
      const end = (e) => {
        if (!drag) return;
        el.classList.remove("panning");
        this.vp.classList.remove("dragging");
        if (drag.pan && !drag.moved && e.type === "pointerup") this.cb.onSelect(null);
        if (!drag.pan && drag.moved) this.cb.onDragEnd(drag.id, e.type === "pointercancel");
        drag = null;
      };
      el.addEventListener("pointerup", end);
      el.addEventListener("pointercancel", end);
    }
  };

  // samples/01-voltage-divider.json
  var voltage_divider_default = {
    title: "Voltage Divider",
    components: [
      {
        id: "V1",
        type: "dc_source",
        value: "10V"
      },
      {
        id: "R1",
        type: "resistor",
        value: "1k\u03A9"
      },
      {
        id: "R2",
        type: "resistor",
        value: "2k\u03A9"
      }
    ],
    connections: [
      [
        "V1.positive",
        "R1.1"
      ],
      [
        "R1.2",
        "R2.1"
      ],
      [
        "R2.2",
        "V1.negative"
      ]
    ]
  };

  // samples/02-led-resistor.json
  var led_resistor_default = {
    title: "LED with Current-Limiting Resistor",
    components: [
      {
        id: "V1",
        type: "dc_source",
        value: "5V"
      },
      {
        id: "R1",
        type: "resistor",
        value: "330\u03A9"
      },
      {
        id: "D1",
        type: "led",
        value: "Red"
      },
      {
        id: "GND",
        type: "ground"
      }
    ],
    connections: [
      [
        "V1.positive",
        "R1.1"
      ],
      [
        "R1.2",
        "D1.anode"
      ],
      [
        "D1.cathode",
        "GND"
      ],
      [
        "V1.negative",
        "GND"
      ]
    ]
  };

  // samples/03-rc-lowpass.json
  var rc_lowpass_default = {
    title: "RC Low-Pass Filter",
    components: [
      {
        id: "V1",
        type: "ac_source",
        value: "1V 1kHz"
      },
      {
        id: "R1",
        type: "resistor",
        value: "1k\u03A9"
      },
      {
        id: "C1",
        type: "capacitor",
        value: "100nF"
      },
      {
        id: "VOUT",
        type: "output"
      },
      {
        id: "GND",
        type: "ground"
      }
    ],
    connections: [
      [
        "V1.positive",
        "R1.1"
      ],
      [
        "R1.2",
        "C1.1",
        "VOUT"
      ],
      [
        "C1.2",
        "GND"
      ],
      [
        "V1.negative",
        "GND"
      ]
    ]
  };

  // samples/04-rl-circuit.json
  var rl_circuit_default = {
    title: "RL Circuit",
    components: [
      {
        id: "V1",
        type: "dc_source",
        value: "12V"
      },
      {
        id: "SW1",
        type: "switch"
      },
      {
        id: "R1",
        type: "resistor",
        value: "100\u03A9"
      },
      {
        id: "L1",
        type: "inductor",
        value: "10mH"
      },
      {
        id: "GND",
        type: "ground"
      }
    ],
    connections: [
      [
        "V1.positive",
        "SW1.1"
      ],
      [
        "SW1.2",
        "R1.1"
      ],
      [
        "R1.2",
        "L1.1"
      ],
      [
        "L1.2",
        "GND"
      ],
      [
        "V1.negative",
        "GND"
      ]
    ]
  };

  // samples/05-rlc-series.json
  var rlc_series_default = {
    title: "Series RLC Circuit",
    components: [
      {
        id: "V1",
        type: "ac_source",
        value: "5V 10kHz"
      },
      {
        id: "R1",
        type: "resistor",
        value: "50\u03A9"
      },
      {
        id: "L1",
        type: "inductor",
        value: "1mH"
      },
      {
        id: "C1",
        type: "capacitor",
        value: "220nF"
      }
    ],
    connections: [
      [
        "V1.positive",
        "R1.1"
      ],
      [
        "R1.2",
        "L1.1"
      ],
      [
        "L1.2",
        "C1.1"
      ],
      [
        "C1.2",
        "V1.negative"
      ]
    ]
  };

  // samples/06-diode-rectifier.json
  var diode_rectifier_default = {
    title: "Half-Wave Rectifier with Filter",
    components: [
      {
        id: "V1",
        type: "ac_source",
        value: "12V 50Hz"
      },
      {
        id: "D1",
        type: "diode",
        value: "1N4007"
      },
      {
        id: "C1",
        type: "capacitor_polarized",
        value: "470\xB5F"
      },
      {
        id: "RL",
        type: "resistor",
        value: "1k\u03A9"
      },
      {
        id: "VOUT",
        type: "output"
      },
      {
        id: "GND",
        type: "ground"
      }
    ],
    connections: [
      [
        "V1.positive",
        "D1.anode"
      ],
      [
        "D1.cathode",
        "C1.positive",
        "RL.1",
        "VOUT"
      ],
      [
        "C1.negative",
        "GND"
      ],
      [
        "RL.2",
        "GND"
      ],
      [
        "V1.negative",
        "GND"
      ]
    ]
  };

  // samples/07-bjt-amplifier.json
  var bjt_amplifier_default = {
    title: "Common-Emitter BJT Amplifier",
    components: [
      {
        id: "VIN",
        type: "ac_source",
        value: "10mV"
      },
      {
        id: "C1",
        type: "capacitor",
        value: "10\xB5F"
      },
      {
        id: "R1",
        type: "resistor",
        value: "47k\u03A9"
      },
      {
        id: "R2",
        type: "resistor",
        value: "10k\u03A9"
      },
      {
        id: "Q1",
        type: "npn",
        value: "2N3904"
      },
      {
        id: "RC",
        type: "resistor",
        value: "4.7k\u03A9"
      },
      {
        id: "RE",
        type: "resistor",
        value: "1k\u03A9"
      },
      {
        id: "C2",
        type: "capacitor",
        value: "10\xB5F"
      },
      {
        id: "RL",
        type: "resistor",
        value: "10k\u03A9"
      },
      {
        id: "VCC",
        type: "vcc",
        value: "+12V"
      },
      {
        id: "GND",
        type: "ground"
      }
    ],
    connections: [
      [
        "VIN.positive",
        "C1.1"
      ],
      [
        "C1.2",
        "R1.2",
        "R2.1",
        "Q1.B"
      ],
      [
        "R1.1",
        "VCC"
      ],
      [
        "R2.2",
        "GND"
      ],
      [
        "Q1.C",
        "RC.2",
        "C2.1"
      ],
      [
        "RC.1",
        "VCC"
      ],
      [
        "Q1.E",
        "RE.1"
      ],
      [
        "RE.2",
        "GND"
      ],
      [
        "C2.2",
        "RL.1"
      ],
      [
        "RL.2",
        "GND"
      ],
      [
        "VIN.negative",
        "GND"
      ]
    ]
  };

  // samples/08-mosfet-switch.json
  var mosfet_switch_default = {
    title: "N-MOSFET Low-Side LED Driver",
    components: [
      {
        id: "PWM",
        type: "input"
      },
      {
        id: "RG",
        type: "resistor",
        value: "100\u03A9"
      },
      {
        id: "RPD",
        type: "resistor",
        value: "10k\u03A9"
      },
      {
        id: "Q1",
        type: "nmos",
        value: "IRLZ44N"
      },
      {
        id: "RL",
        type: "resistor",
        value: "220\u03A9"
      },
      {
        id: "D1",
        type: "led",
        value: "Load"
      },
      {
        id: "VCC",
        type: "vcc",
        value: "+12V"
      },
      {
        id: "GND",
        type: "ground"
      }
    ],
    connections: [
      [
        "PWM",
        "RG.1"
      ],
      [
        "RG.2",
        "Q1.G",
        "RPD.1"
      ],
      [
        "RPD.2",
        "GND"
      ],
      [
        "Q1.S",
        "GND"
      ],
      [
        "Q1.D",
        "D1.cathode"
      ],
      [
        "D1.anode",
        "RL.2"
      ],
      [
        "RL.1",
        "VCC"
      ]
    ]
  };

  // samples/09-opamp-inverting.json
  var opamp_inverting_default = {
    title: "Inverting Op-Amp Amplifier (Gain \u221210)",
    components: [
      {
        id: "VIN",
        type: "ac_source",
        value: "100mV"
      },
      {
        id: "RIN",
        type: "resistor",
        value: "10k\u03A9"
      },
      {
        id: "RF",
        type: "resistor",
        value: "100k\u03A9"
      },
      {
        id: "U1",
        type: "opamp",
        value: "TL071"
      },
      {
        id: "VOUT",
        type: "output"
      },
      {
        id: "GND",
        type: "ground"
      }
    ],
    connections: [
      [
        "VIN.positive",
        "RIN.1"
      ],
      [
        "RIN.2",
        "U1.in-",
        "RF.1"
      ],
      [
        "RF.2",
        "U1.out",
        "VOUT"
      ],
      [
        "U1.in+",
        "GND"
      ],
      [
        "VIN.negative",
        "GND"
      ]
    ]
  };

  // samples/10-logic-full-adder.json
  var logic_full_adder_default = {
    title: "1-Bit Full Adder",
    components: [
      {
        id: "A",
        type: "input"
      },
      {
        id: "B",
        type: "input"
      },
      {
        id: "CIN",
        type: "input"
      },
      {
        id: "U1",
        type: "xor"
      },
      {
        id: "U2",
        type: "xor"
      },
      {
        id: "U3",
        type: "and"
      },
      {
        id: "U4",
        type: "and"
      },
      {
        id: "U5",
        type: "or"
      },
      {
        id: "SUM",
        type: "output"
      },
      {
        id: "COUT",
        type: "output"
      }
    ],
    connections: [
      [
        "A",
        "U1.A",
        "U3.A"
      ],
      [
        "B",
        "U1.B",
        "U3.B"
      ],
      [
        "U1.Y",
        "U2.A",
        "U4.A"
      ],
      [
        "CIN",
        "U2.B",
        "U4.B"
      ],
      [
        "U2.Y",
        "SUM"
      ],
      [
        "U3.Y",
        "U5.B"
      ],
      [
        "U4.Y",
        "U5.A"
      ],
      [
        "U5.Y",
        "COUT"
      ]
    ]
  };

  // samples/11-flipflop-counter.json
  var flipflop_counter_default = {
    title: "2-Bit Ripple Counter (D Flip-Flops)",
    components: [
      {
        id: "CLK",
        type: "input"
      },
      {
        id: "U1",
        type: "d_flipflop"
      },
      {
        id: "U2",
        type: "d_flipflop"
      },
      {
        id: "Q0",
        type: "output"
      },
      {
        id: "Q1",
        type: "output"
      }
    ],
    connections: [
      [
        "CLK",
        "U1.CLK"
      ],
      [
        "U1.QN",
        "U1.D",
        "U2.CLK"
      ],
      [
        "U2.QN",
        "U2.D"
      ],
      [
        "U1.Q",
        "Q0"
      ],
      [
        "U2.Q",
        "Q1"
      ]
    ]
  };

  // samples/12-555-astable.json
  var astable_default = {
    title: "555 Astable Oscillator",
    components: [
      {
        id: "U1",
        type: "timer_555",
        value: "NE555"
      },
      {
        id: "R1",
        type: "resistor",
        value: "1k\u03A9"
      },
      {
        id: "R2",
        type: "resistor",
        value: "10k\u03A9"
      },
      {
        id: "C1",
        type: "capacitor",
        value: "10\xB5F"
      },
      {
        id: "C2",
        type: "capacitor",
        value: "10nF"
      },
      {
        id: "R3",
        type: "resistor",
        value: "330\u03A9"
      },
      {
        id: "D1",
        type: "led"
      },
      {
        id: "VCC",
        type: "vcc",
        value: "+9V"
      },
      {
        id: "GND",
        type: "ground"
      }
    ],
    connections: [
      [
        "U1.VCC",
        "U1.RST",
        "R1.1",
        "VCC"
      ],
      [
        "R1.2",
        "R2.1",
        "U1.DIS"
      ],
      [
        "R2.2",
        "U1.THR",
        "U1.TRIG",
        "C1.1"
      ],
      [
        "C1.2",
        "GND"
      ],
      [
        "U1.CV",
        "C2.1"
      ],
      [
        "C2.2",
        "GND"
      ],
      [
        "U1.GND",
        "GND"
      ],
      [
        "U1.OUT",
        "R3.1"
      ],
      [
        "R3.2",
        "D1.anode"
      ],
      [
        "D1.cathode",
        "GND"
      ]
    ]
  };

  // samples/13-generic-ic.json
  var generic_ic_default = {
    title: "74HC595 Shift Register Driving LEDs",
    components: [
      {
        id: "U1",
        type: "generic_ic",
        label: "74HC595",
        pins: {
          left: [
            "SER",
            "SRCLK",
            "RCLK",
            "~SRCLR",
            "~OE"
          ],
          right: [
            "QA",
            "QB",
            "QC",
            "QD"
          ],
          top: [
            "VCC"
          ],
          bottom: [
            "GND"
          ]
        }
      },
      {
        id: "DATA",
        type: "input"
      },
      {
        id: "SCK",
        type: "input"
      },
      {
        id: "LATCH",
        type: "input"
      },
      {
        id: "R1",
        type: "resistor",
        value: "330\u03A9"
      },
      {
        id: "R2",
        type: "resistor",
        value: "330\u03A9"
      },
      {
        id: "D1",
        type: "led"
      },
      {
        id: "D2",
        type: "led"
      },
      {
        id: "VCC",
        type: "vcc",
        value: "+5V"
      },
      {
        id: "GND",
        type: "ground"
      }
    ],
    connections: [
      [
        "DATA",
        "U1.SER"
      ],
      [
        "SCK",
        "U1.SRCLK"
      ],
      [
        "LATCH",
        "U1.RCLK"
      ],
      [
        "U1.SRCLR",
        "VCC"
      ],
      [
        "U1.OE",
        "GND"
      ],
      [
        "U1.VCC",
        "VCC"
      ],
      [
        "U1.GND",
        "GND"
      ],
      [
        "U1.QA",
        "R1.1"
      ],
      [
        "R1.2",
        "D1.anode"
      ],
      [
        "D1.cathode",
        "GND"
      ],
      [
        "U1.QB",
        "R2.1"
      ],
      [
        "R2.2",
        "D2.anode"
      ],
      [
        "D2.cathode",
        "GND"
      ]
    ]
  };

  // samples/14-microcontroller.json
  var microcontroller_default = {
    title: "Minimal Microcontroller System",
    components: [
      {
        id: "U1",
        type: "microcontroller",
        value: "ATmega328P"
      },
      {
        id: "Y1",
        type: "crystal",
        value: "16MHz"
      },
      {
        id: "C1",
        type: "capacitor",
        value: "22pF"
      },
      {
        id: "C2",
        type: "capacitor",
        value: "22pF"
      },
      {
        id: "R1",
        type: "resistor",
        value: "10k\u03A9"
      },
      {
        id: "SW1",
        type: "push_button",
        value: "RESET"
      },
      {
        id: "R2",
        type: "resistor",
        value: "330\u03A9"
      },
      {
        id: "D1",
        type: "led"
      },
      {
        id: "C3",
        type: "capacitor",
        value: "100nF"
      },
      {
        id: "VCC",
        type: "vcc",
        value: "+5V"
      },
      {
        id: "GND",
        type: "ground"
      }
    ],
    connections: [
      [
        "U1.VCC",
        "VCC"
      ],
      [
        "U1.GND",
        "GND"
      ],
      [
        "C3.1",
        "VCC"
      ],
      [
        "C3.2",
        "GND"
      ],
      [
        "U1.RST",
        "R1.2",
        "SW1.1"
      ],
      [
        "R1.1",
        "VCC"
      ],
      [
        "SW1.2",
        "GND"
      ],
      [
        "U1.XTAL1",
        "Y1.1",
        "C1.1"
      ],
      [
        "U1.XTAL2",
        "Y1.2",
        "C2.1"
      ],
      [
        "C1.2",
        "GND"
      ],
      [
        "C2.2",
        "GND"
      ],
      [
        "U1.PB0",
        "R2.1"
      ],
      [
        "R2.2",
        "D1.anode"
      ],
      [
        "D1.cathode",
        "GND"
      ]
    ]
  };

  // samples/15-voltage-regulator.json
  var voltage_regulator_default = {
    title: "5V Linear Regulator",
    components: [
      {
        id: "BT1",
        type: "battery",
        value: "9V"
      },
      {
        id: "U1",
        type: "voltage_regulator",
        value: "LM7805"
      },
      {
        id: "C1",
        type: "capacitor",
        value: "330nF"
      },
      {
        id: "C2",
        type: "capacitor",
        value: "100nF"
      },
      {
        id: "VOUT",
        type: "output",
        label: "+5V"
      },
      {
        id: "GND",
        type: "ground"
      }
    ],
    connections: [
      [
        "BT1.positive",
        "U1.IN",
        "C1.1"
      ],
      [
        "U1.OUT",
        "C2.1",
        "VOUT"
      ],
      [
        "U1.GND",
        "GND"
      ],
      [
        "C1.2",
        "GND"
      ],
      [
        "C2.2",
        "GND"
      ],
      [
        "BT1.negative",
        "GND"
      ]
    ]
  };

  // src/ui/samples.js
  var SAMPLES = [voltage_divider_default, led_resistor_default, rc_lowpass_default, rl_circuit_default, rlc_series_default, diode_rectifier_default, bjt_amplifier_default, mosfet_switch_default, opamp_inverting_default, logic_full_adder_default, flipflop_counter_default, astable_default, generic_ic_default, microcontroller_default, voltage_regulator_default];

  // src/ui/main.js
  var $ = (s, r = document) => r.querySelector(s);
  var $$ = (s, r = document) => [...r.querySelectorAll(s)];
  window.CircuitForge = { render, validate, types: listTypes };
  var store = {
    get(k) {
      try {
        return localStorage.getItem(k);
      } catch {
        return null;
      }
    },
    set(k, v) {
      try {
        localStorage.setItem(k, v);
      } catch {
      }
    }
  };
  var state = {
    text: "",
    circuit: null,
    // last successfully parsed circuit object
    result: null,
    // last successful render (with scene)
    selected: null,
    snap: store.get("cf-snap") !== "0",
    grid: store.get("cf-grid") !== "0",
    bridges: store.get("cf-bridges") === "1",
    drag: null
  };
  var history = new History();
  var textarea = $("#json");
  var gutter = $("#gutter");
  var canvasEl = $("#canvas");
  var canvas = new Canvas(canvasEl, $("#viewport"), {
    onSelect: (id) => select(id),
    onDragMove,
    onDragEnd,
    onViewChange: (s) => {
      const z = `${Math.round(s * 100)}%`;
      $("#zoom-label").textContent = z;
      $("#status-zoom").textContent = z;
    }
  });
  var darkQuery = matchMedia("(prefers-color-scheme: dark)");
  var isDark = () => (document.documentElement.dataset.theme || (darkQuery.matches ? "dark" : "light")) === "dark";
  darkQuery.addEventListener("change", () => update());
  function update({ fit = false } = {}) {
    const parsed = parseJSON(state.text);
    let errors = [], warnings = [];
    if (parsed.errors.length) {
      errors = parsed.errors;
      canvas.setStale(true);
    } else {
      state.circuit = parsed.value;
      const r = render(parsed.value, { theme: isDark() ? "dark" : "light", background: null, interactive: true, bridges: state.bridges });
      errors = r.errors;
      warnings = r.warnings;
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
    $("#empty-state").hidden = !(comps === 0 && !errors.length);
    showProblems(errors, warnings);
    updateStatus(errors, warnings);
    updateGutter(errors);
    store.set("cf-last", state.text);
  }
  function updateStatus(errors, warnings) {
    const st = $("#status");
    st.classList.toggle("error", errors.length > 0);
    st.classList.toggle("warning", !errors.length && warnings.length > 0);
    $("#status-text").textContent = errors.length ? `${errors.length} error${errors.length > 1 ? "s" : ""}` : warnings.length ? `Rendered \xB7 ${warnings.length} warning${warnings.length > 1 ? "s" : ""}` : "Rendered";
    const scene = state.result?.scene;
    if (scene) {
      const nets = [...scene.netlist.nets.values()].length;
      $("#status-counts").textContent = `${scene.instances.size} parts \xB7 ${nets} nets \xB7 ${scene.routing.junctions.length} junctions`;
      $("#status-size").textContent = `${state.result.width} \xD7 ${state.result.height} px`;
      $("#editor-meta").textContent = `${state.circuit?.components?.length ?? 0} components`;
    }
    $("#status-grid").textContent = state.grid ? state.snap ? "20 px snap" : "10 px" : "off";
  }
  var escRe = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  function lineMatching(re) {
    const i = state.text.split("\n").findIndex((l) => re.test(l));
    return i >= 0 ? i + 1 : null;
  }
  function lineOf(p) {
    return p.line || p.ref && lineMatching(new RegExp(escRe(JSON.stringify(p.ref)))) || p.component && lineMatching(new RegExp(`"id"\\s*:\\s*${escRe(JSON.stringify(p.component))}`)) || null;
  }
  function showProblems(errors, warnings) {
    const list = $("#problems-list");
    list.textContent = "";
    const all = [...errors.map((e) => ({ ...e, level: "error" })), ...warnings.map((w) => ({ ...w, level: "warning" }))];
    $("#problems-title").textContent = all.length ? `Problems (${all.length})` : "Problems";
    if (!all.length) {
      const li = document.createElement("li");
      li.className = "ok";
      li.textContent = "No problems. The circuit is valid.";
      list.append(li);
      return;
    }
    for (const p of all) {
      const li = document.createElement("li");
      li.className = p.level;
      li.innerHTML = '<span class="ico"></span><span class="code"></span><span class="msg"></span>';
      li.querySelector(".code").textContent = p.code;
      li.querySelector(".msg").textContent = p.message + (p.line && !/line \d/.test(p.message) ? ` (line ${p.line})` : "");
      li.title = "Show in editor";
      li.addEventListener("click", () => {
        const line = lineOf(p);
        if (p.component && state.result?.scene.instances.has(p.component)) select(p.component);
        if (line) gotoLine(line);
      });
      list.append(li);
    }
  }
  function updateGutter(errors = []) {
    const n2 = state.text.split("\n").length;
    const bad = new Set(errors.filter((e) => e.line).map((e) => e.line));
    for (const e of errors) if (!e.line) {
      const l = lineOf(e);
      if (l) bad.add(l);
    }
    let html = "";
    for (let i = 1; i <= n2; i++) html += bad.has(i) ? `<span class="err">${i}</span>
` : `${i}
`;
    gutter.innerHTML = html;
    gutter.scrollTop = textarea.scrollTop;
  }
  function gotoLine(line) {
    const lines = state.text.split("\n");
    const start = lines.slice(0, line - 1).reduce((a, l) => a + l.length + 1, 0);
    textarea.focus();
    textarea.setSelectionRange(start, start + (lines[line - 1] || "").length);
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
    setText(formatJSON(circuit) + "\n", opts);
  }
  var typingTimer = 0;
  var historyTimer = 0;
  textarea.addEventListener("input", () => {
    state.text = textarea.value;
    clearTimeout(typingTimer);
    clearTimeout(historyTimer);
    typingTimer = setTimeout(() => update(), 180);
    historyTimer = setTimeout(() => {
      history.push(state.text);
      syncToolbar();
    }, 600);
    updateGutter();
  });
  textarea.addEventListener("scroll", () => {
    gutter.scrollTop = textarea.scrollTop;
  });
  textarea.addEventListener("keydown", (e) => {
    if (e.key === "Tab" && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      document.execCommand("insertText", false, "  ");
    }
  });
  var typeSelect = $("#inspector-form select[name=type]");
  var _a;
  {
    const byCat = {};
    for (const t of listTypes()) (byCat[_a = t.category] || (byCat[_a] = [])).push(t);
    for (const [cat, types] of Object.entries(byCat)) {
      const g = document.createElement("optgroup");
      g.label = cat[0].toUpperCase() + cat.slice(1);
      for (const t of types.sort((a, b) => a.name.localeCompare(b.name))) g.append(new Option(`${t.name}`, t.type));
      typeSelect.append(g);
    }
  }
  function select(id) {
    state.selected = id;
    canvas.select(id);
    $("#inspector").hidden = !id;
    if (id) fillInspector();
    syncToolbar();
  }
  function fillInspector() {
    const comp = state.circuit?.components?.find((c) => c.id === state.selected);
    const I = state.result?.scene.instances.get(state.selected);
    if (!comp || !I) return;
    const f = $("#inspector-form");
    f.id.value = comp.id;
    f.type.value = I.part.sym.type;
    f.value.value = comp.value ?? "";
    f.label.value = comp.label ?? "";
    f.rotation.value = comp.rotation !== void 0 ? String(comp.rotation) : "";
    f.mirror.checked = !!comp.mirror;
    const pins = I.part.sym.pinOrder;
    $("#inspector-pins").innerHTML = `<b>Pins</b><br>${pins.map((p) => `<code>${p.replace(/[&<>]/g, "")}</code>`).join("")}`;
  }
  $("#inspector-form").addEventListener("change", (e) => {
    const f = e.currentTarget;
    const id = state.selected;
    if (!id || !state.circuit) return;
    const name = e.target.name;
    let c = state.circuit;
    if (name === "id") {
      const next = f.id.value.trim();
      if (!next || /[.\s]/.test(next)) return toast("IDs cannot be empty or contain dots/spaces.", true);
      if (next !== id && c.components.some((x) => x.id === next)) return toast(`ID "${next}" is already used.`, true);
      c = renameComponent(c, id, next);
      state.selected = next;
    } else if (name === "rotation") {
      c = updateComponent(c, id, { rotation: f.rotation.value === "" ? void 0 : Number(f.rotation.value) });
    } else if (name === "mirror") {
      c = updateComponent(c, id, { mirror: f.mirror.checked || void 0 });
    } else if (name === "type" || name === "value" || name === "label") {
      c = updateComponent(c, id, { [name]: f[name].value });
    } else return;
    setCircuit(c);
    select(state.selected);
  });
  $("#inspector-form").addEventListener("submit", (e) => e.preventDefault());
  var snapStep = () => state.snap ? 20 : 10;
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
      const r = render(d.pending, { theme: isDark() ? "dark" : "light", background: null, interactive: true, bridges: state.bridges });
      if (r.valid) {
        canvas.setSVG(r.svg, r.viewBox);
        state.liveResult = r;
      }
    });
  }
  function onDragEnd(id, cancelled) {
    const d = state.drag;
    state.drag = null;
    if (!d) return;
    if (d.raf) cancelAnimationFrame(d.raf);
    if (cancelled || !d.pending || d.last.x === d.start.x && d.last.y === d.start.y) return update();
    setCircuit(d.pending);
  }
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
  function undo() {
    const t = history.undo();
    if (t !== null) setText(t, { record: false });
  }
  function redo() {
    const t = history.redo();
    if (t !== null) setText(t, { record: false });
  }
  function toggle(key) {
    state[key] = !state[key];
    store.set(`cf-${key}`, state[key] ? "1" : "0");
    if (key === "grid") canvasEl.classList.toggle("grid-on", state.grid);
    syncToolbar();
    update();
  }
  function syncToolbar() {
    $$("[data-tool=undo]").forEach((b) => b.disabled = !history.canUndo);
    $$("[data-tool=redo]").forEach((b) => b.disabled = !history.canRedo);
    $$(".toolbar [data-tool=rotate], .toolbar [data-tool=delete]").forEach((b) => b.disabled = !state.selected);
    for (const k of ["grid", "snap", "bridges"]) $(`[data-tool=${k}]`).setAttribute("aria-pressed", String(state[k]));
  }
  var tools = {
    undo,
    redo,
    rotate: rotateSelected,
    delete: deleteSelected,
    autolayout: () => {
      if (state.circuit) {
        setCircuit(clearLayout(state.circuit), { fit: true });
        toast("Automatic layout restored");
      }
    },
    grid: () => toggle("grid"),
    snap: () => toggle("snap"),
    bridges: () => toggle("bridges"),
    "zoom-in": () => canvas.zoomAt(1.25),
    "zoom-out": () => canvas.zoomAt(0.8),
    "zoom-reset": () => canvas.zoomTo(1),
    fit: () => canvas.fit()
  };
  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-tool]");
    if (t && tools[t.dataset.tool]) tools[t.dataset.tool]();
  });
  document.addEventListener("keydown", (e) => {
    const mod = e.ctrlKey || e.metaKey;
    const inField = e.target.closest?.("input, textarea, select");
    if (mod && e.key.toLowerCase() === "z") {
      e.preventDefault();
      e.shiftKey ? redo() : undo();
      return;
    }
    if (mod && e.key.toLowerCase() === "y") {
      e.preventDefault();
      redo();
      return;
    }
    if (e.key === "Escape") {
      closeMenus();
      if (!inField) select(null);
      return;
    }
    if (inField || mod || e.altKey) return;
    if (e.key === " ") {
      canvas.spaceDown = true;
    }
    const map = { Delete: "delete", Backspace: "delete", r: "rotate", R: "rotate", f: "fit", F: "fit", g: "grid", G: "grid", s: "snap", S: "snap", "+": "zoom-in", "=": "zoom-in", "-": "zoom-out", "0": "zoom-reset" };
    if (map[e.key]) {
      e.preventDefault();
      tools[map[e.key]]();
    }
  });
  document.addEventListener("keyup", (e) => {
    if (e.key === " ") canvas.spaceDown = false;
  });
  function closeMenus() {
    $$(".menu").forEach((m) => m.hidden = true);
  }
  $$("[data-menu]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const menu = $(`#menu-${btn.dataset.menu}`);
      const open = menu.hidden;
      closeMenus();
      if (open) {
        const r = btn.getBoundingClientRect();
        menu.style.left = `${Math.min(r.left, innerWidth - 240)}px`;
        menu.style.top = `${r.bottom + 4}px`;
        menu.hidden = false;
        menu.querySelector("button")?.focus();
      }
    });
  });
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".menu")) closeMenus();
  });
  var samplesMenu = $("#menu-samples");
  SAMPLES.forEach((s, i) => {
    const b = document.createElement("button");
    b.setAttribute("role", "menuitem");
    b.innerHTML = `<span class="num">${i + 1}</span><span></span>`;
    b.lastChild.textContent = s.title;
    b.addEventListener("click", () => {
      closeMenus();
      loadCircuit(s);
    });
    samplesMenu.append(b);
  });
  function loadCircuit(c) {
    select(null);
    setCircuit(c, { fit: true });
  }
  var fileInput = $("#file-input");
  fileInput.addEventListener("change", async () => {
    const f = fileInput.files[0];
    if (f) openFile(f);
    fileInput.value = "";
  });
  async function openFile(f) {
    const text = await f.text();
    select(null);
    setText(text, { fit: true });
    toast(`Opened ${f.name}`);
  }
  document.addEventListener("dragover", (e) => e.preventDefault());
  document.addEventListener("drop", (e) => {
    e.preventDefault();
    const f = e.dataTransfer?.files?.[0];
    if (f) openFile(f);
  });
  var actions = {
    new: () => loadCircuit(EMPTY_CIRCUIT),
    open: () => fileInput.click(),
    format: () => {
      const p = parseJSON(state.text);
      if (p.errors.length) return toast("Fix the JSON syntax error first.", true);
      setCircuit(p.value);
    },
    api: () => $("#api-dialog").showModal(),
    library: () => {
      buildLibrary();
      $("#library-dialog").showModal();
      $("#library-search").focus();
    },
    theme: () => {
      const next = isDark() ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      store.set("cf-theme", next);
      update();
    },
    deselect: () => select(null),
    "load-first-sample": () => loadCircuit(SAMPLES[0])
  };
  document.addEventListener("click", (e) => {
    const a = e.target.closest("[data-action]");
    if (a && actions[a.dataset.action]) actions[a.dataset.action]();
  });
  $$("dialog [data-close]").forEach((b) => b.addEventListener("click", () => b.closest("dialog").close()));
  $$("dialog").forEach((d) => d.addEventListener("click", (e) => {
    if (e.target === d) d.close();
  }));
  function exportRender(extra = {}) {
    const p = parseJSON(state.text);
    if (p.errors.length) throw new Error("Fix the JSON errors before exporting.");
    const r = render(p.value, { theme: "light", bridges: state.bridges, ...extra });
    if (!r.valid) throw new Error("Fix the circuit errors before exporting.");
    return r;
  }
  var baseName = () => slug(state.circuit?.title);
  var exporters = {
    "copy-png": async () => {
      const r = exportRender();
      await copyPNG(r.svg, r.width, r.height, { scale: 2 });
      return "PNG copied to clipboard";
    },
    "copy-svg": async () => {
      await copyText(exportRender().svg);
      return "SVG copied to clipboard";
    },
    "copy-json": async () => {
      await copyText(state.text);
      return "JSON copied to clipboard";
    },
    svg: async () => {
      download(exportRender().svg, `${baseName()}.svg`, "image/svg+xml");
    },
    png: async () => {
      const r = exportRender();
      download(await toPNG(r.svg, r.width, r.height, { scale: 2 }), `${baseName()}.png`);
    },
    "png-hires": async () => {
      const r = exportRender();
      download(await toPNG(r.svg, r.width, r.height, { scale: 4 }), `${baseName()}@4x.png`);
    },
    "png-transparent": async () => {
      const r = exportRender({ background: null });
      download(await toPNG(r.svg, r.width, r.height, { scale: 2, transparent: true }), `${baseName()}-transparent.png`);
    },
    jpeg: async () => {
      const r = exportRender();
      download(await toJPEG(r.svg, r.width, r.height, { scale: 2 }), `${baseName()}.jpg`);
    },
    pdf: async () => {
      const r = exportRender();
      download(await toPDF(r.svg, r.width, r.height, { scale: 4, title: state.circuit?.title }), `${baseName()}.pdf`);
    },
    json: async () => {
      download(state.text, `${baseName()}.json`, "application/json");
    }
  };
  $$("[data-export]").forEach((b) => b.addEventListener("click", async () => {
    closeMenus();
    try {
      const msg = await exporters[b.dataset.export]();
      toast(msg || "Exported");
    } catch (err) {
      toast(err.message || String(err), true);
    }
  }));
  $$("[data-api]").forEach((b) => b.addEventListener("click", () => {
    const p = parseJSON(state.text);
    const out = handleRequest({ method: "POST", path: `/api/v1/${b.dataset.api}`, headers: {}, body: { circuit: p.value ?? state.text, format: "json" } });
    let body = out.body;
    try {
      const o = JSON.parse(body);
      if (o.svg) o.svg = o.svg.slice(0, 160) + ` \u2026 (${o.svg.length} chars)`;
      body = JSON.stringify(o, null, 2);
    } catch {
    }
    $("#api-out").textContent = `HTTP ${out.status}
${body}`;
  }));
  var libraryBuilt = false;
  function buildLibrary() {
    var _a2;
    if (libraryBuilt) return;
    libraryBuilt = true;
    const body = $("#library-body");
    const cats = { passive: "Passive", semiconductor: "Semiconductor", analog: "Analog", digital: "Digital", ic: "IC / MCU", power: "Power & connection" };
    const byCat = {};
    for (const t of listTypes()) (byCat[_a2 = t.category] || (byCat[_a2] = [])).push(t);
    for (const [cat, label2] of Object.entries(cats)) {
      if (!byCat[cat]) continue;
      const sec = document.createElement("section");
      sec.className = "lib-cat";
      sec.innerHTML = `<h3>${label2}</h3><div class="lib-grid"></div>`;
      for (const t of byCat[cat]) {
        const sym = resolveSymbol({ type: t.type });
        const b = document.createElement("button");
        b.className = "lib-item";
        b.dataset.search = [t.type, t.name, ...t.aliases].join(" ").toLowerCase();
        b.title = `Pins: ${sym.pinOrder.join(", ")}`;
        const preview = sym.svgBody ? `<svg viewBox="-4 -4 ${sym.width + 8} ${sym.height + 8}" width="${Math.min(120, sym.width + 8)}" height="52">${sym.svgBody}</svg>` : `<svg viewBox="0 0 60 20" width="60" height="52"><text x="30" y="14" text-anchor="middle" font-size="10" fill="currentColor">${t.type === "junction" ? "\u25CF" : "NET"}</text></svg>`;
        b.innerHTML = `${preview}<span class="n"></span><span class="t"></span>`;
        b.querySelector(".n").textContent = t.name;
        b.querySelector(".t").textContent = t.type;
        b.addEventListener("click", () => {
          if (!state.circuit) return toast("Fix the JSON syntax error first.", true);
          const { circuit, id } = addComponent(state.circuit, t.type);
          $("#library-dialog").close();
          setCircuit(circuit);
          select(id);
          toast(`Added ${id}. Connect it in "connections" (pins: ${sym.pinOrder.join(", ")})`);
        });
        sec.lastChild.append(b);
      }
      body.append(sec);
    }
  }
  $("#library-search").addEventListener("input", (e) => {
    const q = e.target.value.trim().toLowerCase();
    $$(".lib-item").forEach((b) => b.hidden = q && !b.dataset.search.includes(q));
    $$(".lib-cat").forEach((s) => s.hidden = !$$(".lib-item", s).some((b) => !b.hidden));
  });
  {
    const sp = $("#splitter");
    const ws = $(".workspace");
    const saved = store.get("cf-editor-w");
    if (saved) ws.style.setProperty("--editor-w", saved);
    sp.addEventListener("pointerdown", (e) => {
      if (innerWidth <= 820) return;
      sp.setPointerCapture(e.pointerId);
      sp.classList.add("dragging");
      const move = (ev) => {
        const w = Math.max(240, Math.min(innerWidth * 0.7, ev.clientX));
        ws.style.setProperty("--editor-w", `${w}px`);
      };
      const up = () => {
        sp.classList.remove("dragging");
        sp.removeEventListener("pointermove", move);
        store.set("cf-editor-w", ws.style.getPropertyValue("--editor-w"));
      };
      sp.addEventListener("pointermove", move);
      sp.addEventListener("pointerup", up, { once: true });
    });
    sp.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const cur = parseFloat(getComputedStyle(ws).gridTemplateColumns) || 400;
      ws.style.setProperty("--editor-w", `${Math.max(240, cur + (e.key === "ArrowLeft" ? -20 : 20))}px`);
    });
  }
  var toastTimer = 0;
  function toast(msg, isError = false) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.toggle("error", isError);
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.hidden = true, isError ? 4e3 : 2200);
  }
  canvasEl.classList.toggle("grid-on", state.grid);
  var initial = store.get("cf-last");
  if (initial && initial.trim()) setText(initial, { fit: true });
  else setCircuit(SAMPLES[0], { fit: true });
  syncToolbar();
})();
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vc3JjL3BhcnNlci9pbmRleC5qcyIsICIuLi9zcmMvc3ltYm9sLWxvYWRlci9saWJyYXJ5LmdlbmVyYXRlZC5qcyIsICIuLi9zcmMvdXRpbHMvZ2VvbWV0cnkuanMiLCAiLi4vc3JjL3N5bWJvbC1sb2FkZXIvaW5kZXguanMiLCAiLi4vc3JjL3ZhbGlkYXRvci9pbmRleC5qcyIsICIuLi9zcmMvZ3JhcGgvaW5kZXguanMiLCAiLi4vc3JjL2xheW91dC9pbnN0YW5jZS5qcyIsICIuLi9zcmMvbGF5b3V0L2luZGV4LmpzIiwgIi4uL3NyYy9yb3V0ZXIvaW5kZXguanMiLCAiLi4vc3JjL2xheW91dC9sYWJlbHMuanMiLCAiLi4vc3JjL3JlbmRlcmVyL2luZGV4LmpzIiwgIi4uL3NyYy9lbmdpbmUuanMiLCAiLi4vc3JjL2VkaXRvci9oaXN0b3J5LmpzIiwgIi4uL3NyYy9lZGl0b3IvbW9kZWwuanMiLCAiLi4vc3JjL2V4cG9ydGVycy9wZGYuanMiLCAiLi4vc3JjL2V4cG9ydGVycy9pbmRleC5qcyIsICIuLi9zcmMvYXBpL2hhbmRsZXIuanMiLCAiLi4vc3JjL3VpL2NhbnZhcy5qcyIsICIuLi9zYW1wbGVzLzAxLXZvbHRhZ2UtZGl2aWRlci5qc29uIiwgIi4uL3NhbXBsZXMvMDItbGVkLXJlc2lzdG9yLmpzb24iLCAiLi4vc2FtcGxlcy8wMy1yYy1sb3dwYXNzLmpzb24iLCAiLi4vc2FtcGxlcy8wNC1ybC1jaXJjdWl0Lmpzb24iLCAiLi4vc2FtcGxlcy8wNS1ybGMtc2VyaWVzLmpzb24iLCAiLi4vc2FtcGxlcy8wNi1kaW9kZS1yZWN0aWZpZXIuanNvbiIsICIuLi9zYW1wbGVzLzA3LWJqdC1hbXBsaWZpZXIuanNvbiIsICIuLi9zYW1wbGVzLzA4LW1vc2ZldC1zd2l0Y2guanNvbiIsICIuLi9zYW1wbGVzLzA5LW9wYW1wLWludmVydGluZy5qc29uIiwgIi4uL3NhbXBsZXMvMTAtbG9naWMtZnVsbC1hZGRlci5qc29uIiwgIi4uL3NhbXBsZXMvMTEtZmxpcGZsb3AtY291bnRlci5qc29uIiwgIi4uL3NhbXBsZXMvMTItNTU1LWFzdGFibGUuanNvbiIsICIuLi9zYW1wbGVzLzEzLWdlbmVyaWMtaWMuanNvbiIsICIuLi9zYW1wbGVzLzE0LW1pY3JvY29udHJvbGxlci5qc29uIiwgIi4uL3NhbXBsZXMvMTUtdm9sdGFnZS1yZWd1bGF0b3IuanNvbiIsICIuLi9zcmMvdWkvc2FtcGxlcy5qcyIsICIuLi9zcmMvdWkvbWFpbi5qcyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLy8gSlNPTiB0ZXh0L29iamVjdCAtPiBjaXJjdWl0IG9iamVjdCArIG5vcm1hbGl6ZWQgY29ubmVjdGlvbiBsaXN0LlxuXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VKU09OKHRleHQpIHtcbiAgdHJ5IHtcbiAgICByZXR1cm4geyB2YWx1ZTogSlNPTi5wYXJzZSh0ZXh0KSwgZXJyb3JzOiBbXSB9O1xuICB9IGNhdGNoIChlKSB7XG4gICAgLy8gRW5naW5lcyB3b3JkIChhbmQgbG9jYXRlKSBzeW50YXggZXJyb3JzIGRpZmZlcmVudGx5OyBmaW5kIGl0IG91cnNlbHZlcy5cbiAgICBjb25zdCBmb3VuZCA9IGZpbmRTeW50YXhFcnJvcihTdHJpbmcodGV4dCkpO1xuICAgIGNvbnN0IHBvcyA9IGZvdW5kID8gZm91bmQucG9zIDogMDtcbiAgICBjb25zdCBiZWZvcmUgPSBTdHJpbmcodGV4dCkuc2xpY2UoMCwgcG9zKS5zcGxpdCgnXFxuJyk7XG4gICAgY29uc3QgbGluZSA9IGJlZm9yZS5sZW5ndGgsIGNvbHVtbiA9IGJlZm9yZVtiZWZvcmUubGVuZ3RoIC0gMV0ubGVuZ3RoICsgMTtcbiAgICBjb25zdCBtZXNzYWdlID0gZm91bmQgPyBgSW52YWxpZCBKU09OIGF0IGxpbmUgJHtsaW5lfSwgY29sdW1uICR7Y29sdW1ufTogJHtmb3VuZC5tZXNzYWdlfWAgOiBgSW52YWxpZCBKU09OOiAke2UubWVzc2FnZX1gO1xuICAgIHJldHVybiB7IHZhbHVlOiBudWxsLCBlcnJvcnM6IFt7IGNvZGU6ICdJTlZBTElEX0pTT04nLCBtZXNzYWdlLCBsaW5lLCBjb2x1bW4gfV0gfTtcbiAgfVxufVxuXG4vLyBNaW5pbWFsIEpTT04gc2Nhbm5lciB0aGF0IHJldHVybnMgdGhlIG9mZnNldCBhbmQgY2F1c2Ugb2YgdGhlIGZpcnN0IGVycm9yLlxuZnVuY3Rpb24gZmluZFN5bnRheEVycm9yKHMpIHtcbiAgbGV0IGkgPSAwO1xuICBjb25zdCBmYWlsID0gKG1lc3NhZ2UpID0+IHsgdGhyb3cgeyBwb3M6IGksIG1lc3NhZ2UgfTsgfTtcbiAgY29uc3Qgd3MgPSAoKSA9PiB7IHdoaWxlIChpIDwgcy5sZW5ndGggJiYgJyBcXHRcXG5cXHInLmluY2x1ZGVzKHNbaV0pKSBpKys7IH07XG4gIGNvbnN0IGRlc2NyaWJlID0gKCkgPT4gKGkgPj0gcy5sZW5ndGggPyAndW5leHBlY3RlZCBlbmQgb2YgaW5wdXQnIDogYHVuZXhwZWN0ZWQgJHtKU09OLnN0cmluZ2lmeShzW2ldKX1gKTtcbiAgY29uc3QgdmFsdWUgPSAoKSA9PiB7XG4gICAgd3MoKTtcbiAgICBjb25zdCBjID0gc1tpXTtcbiAgICBpZiAoYyA9PT0gJ3snKSB7XG4gICAgICBpKys7IHdzKCk7XG4gICAgICBpZiAoc1tpXSA9PT0gJ30nKSB7IGkrKzsgcmV0dXJuOyB9XG4gICAgICBmb3IgKDs7KSB7XG4gICAgICAgIHdzKCk7XG4gICAgICAgIGlmIChzW2ldICE9PSAnXCInKSBmYWlsKGAke2Rlc2NyaWJlKCl9LCBleHBlY3RlZCBhIFwicXVvdGVkXCIgcHJvcGVydHkgbmFtZWApO1xuICAgICAgICBzdHJpbmcoKTsgd3MoKTtcbiAgICAgICAgaWYgKHNbaV0gIT09ICc6JykgZmFpbChgJHtkZXNjcmliZSgpfSwgZXhwZWN0ZWQgJzonYCk7XG4gICAgICAgIGkrKzsgdmFsdWUoKTsgd3MoKTtcbiAgICAgICAgaWYgKHNbaV0gPT09ICcsJykgeyBpKys7IHdzKCk7IGlmIChzW2ldID09PSAnfScpIGZhaWwoJ3RyYWlsaW5nIGNvbW1hIGJlZm9yZSB9Jyk7IGNvbnRpbnVlOyB9XG4gICAgICAgIGlmIChzW2ldID09PSAnfScpIHsgaSsrOyByZXR1cm47IH1cbiAgICAgICAgZmFpbChgJHtkZXNjcmliZSgpfSwgZXhwZWN0ZWQgJywnIG9yICd9J2ApO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAoYyA9PT0gJ1snKSB7XG4gICAgICBpKys7IHdzKCk7XG4gICAgICBpZiAoc1tpXSA9PT0gJ10nKSB7IGkrKzsgcmV0dXJuOyB9XG4gICAgICBmb3IgKDs7KSB7XG4gICAgICAgIHdzKCk7XG4gICAgICAgIGlmIChzW2ldID09PSAnLCcgfHwgc1tpXSA9PT0gJ10nKSBmYWlsKHNbaV0gPT09ICddJyA/ICd0cmFpbGluZyBjb21tYSBiZWZvcmUgXScgOiBgJHtkZXNjcmliZSgpfSwgZXhwZWN0ZWQgYSB2YWx1ZWApO1xuICAgICAgICB2YWx1ZSgpOyB3cygpO1xuICAgICAgICBpZiAoc1tpXSA9PT0gJywnKSB7IGkrKzsgY29udGludWU7IH1cbiAgICAgICAgaWYgKHNbaV0gPT09ICddJykgeyBpKys7IHJldHVybjsgfVxuICAgICAgICBmYWlsKGAke2Rlc2NyaWJlKCl9LCBleHBlY3RlZCAnLCcgb3IgJ10nYCk7XG4gICAgICB9XG4gICAgfVxuICAgIGlmIChjID09PSAnXCInKSByZXR1cm4gc3RyaW5nKCk7XG4gICAgY29uc3QgbSA9IC9eLT8oMHxbMS05XVxcZCopKFxcLlxcZCspPyhbZUVdWystXT9cXGQrKT98Xih0cnVlfGZhbHNlfG51bGwpLy5leGVjKHMuc2xpY2UoaSwgaSArIDQwMCkpO1xuICAgIGlmIChtKSB7IGkgKz0gbVswXS5sZW5ndGg7IHJldHVybjsgfVxuICAgIGZhaWwoYCR7ZGVzY3JpYmUoKX0sIGV4cGVjdGVkIGEgdmFsdWVgKTtcbiAgfTtcbiAgY29uc3Qgc3RyaW5nID0gKCkgPT4ge1xuICAgIGkrKztcbiAgICB3aGlsZSAoaSA8IHMubGVuZ3RoICYmIHNbaV0gIT09ICdcIicpIHtcbiAgICAgIGlmIChzW2ldID09PSAnXFxuJykgZmFpbCgndW50ZXJtaW5hdGVkIHN0cmluZycpO1xuICAgICAgaWYgKHNbaV0gPT09ICdcXFxcJykgaSsrO1xuICAgICAgaSsrO1xuICAgIH1cbiAgICBpZiAoaSA+PSBzLmxlbmd0aCkgZmFpbCgndW50ZXJtaW5hdGVkIHN0cmluZycpO1xuICAgIGkrKztcbiAgfTtcbiAgdHJ5IHtcbiAgICB2YWx1ZSgpOyB3cygpO1xuICAgIGlmIChpIDwgcy5sZW5ndGgpIGZhaWwoYCR7ZGVzY3JpYmUoKX0gYWZ0ZXIgdGhlIGVuZCBvZiB0aGUgZG9jdW1lbnRgKTtcbiAgICByZXR1cm4gbnVsbDtcbiAgfSBjYXRjaCAoZSkge1xuICAgIHJldHVybiBlICYmIHR5cGVvZiBlLnBvcyA9PT0gJ251bWJlcicgPyBlIDogbnVsbDtcbiAgfVxufVxuXG4vLyBcIlIxLjJcIiAtPiB7IGNvbXA6IFwiUjFcIiwgcGluOiBcIjJcIiB9OyAgXCJHTkRcIiAtPiB7IGNvbXA6IFwiR05EXCIsIHBpbjogbnVsbCB9XG5leHBvcnQgZnVuY3Rpb24gcGFyc2VSZWYocmVmKSB7XG4gIGlmICh0eXBlb2YgcmVmICE9PSAnc3RyaW5nJyB8fCAhcmVmLnRyaW0oKSkgcmV0dXJuIG51bGw7XG4gIGNvbnN0IHMgPSByZWYudHJpbSgpO1xuICBjb25zdCBpID0gcy5pbmRleE9mKCcuJyk7XG4gIGlmIChpID09PSAwIHx8IGkgPT09IHMubGVuZ3RoIC0gMSkgcmV0dXJuIG51bGw7XG4gIHJldHVybiBpIDwgMCA/IHsgY29tcDogcywgcGluOiBudWxsLCByYXc6IHMgfSA6IHsgY29tcDogcy5zbGljZSgwLCBpKSwgcGluOiBzLnNsaWNlKGkgKyAxKSwgcmF3OiBzIH07XG59XG5cbi8vIEFjY2VwdGVkIGNvbm5lY3Rpb24gZm9ybXM6XG4vLyAgIFtcIkEuMVwiLCBcIkIuMlwiLCAuLi5dICAgICAgICAgICAgKDIrIGVuZHBvaW50cyBvbiBvbmUgbmV0KVxuLy8gICB7IFwiZnJvbVwiOiBcIkEuMVwiLCBcInRvXCI6IFwiQi4yXCIgfVxuLy8gICB7IFwicGluc1wiOiBbXCJBLjFcIiwgXCJCLjJcIl0sIFwibmV0XCI6IFwiVk9VVFwiIH1cbi8vIHBsdXMgYW4gb3B0aW9uYWwgdG9wLWxldmVsIFwibmV0c1wiOiB7IFwiVk9VVFwiOiBbXCJBLjFcIiwgXCJCLjJcIl0gfS5cbmV4cG9ydCBmdW5jdGlvbiBub3JtYWxpemVDb25uZWN0aW9ucyhjaXJjdWl0KSB7XG4gIGNvbnN0IGxpc3QgPSBbXTtcbiAgY29uc3QgcHVzaCA9IChyZWZzLCBuYW1lLCBwYXRoKSA9PiBsaXN0LnB1c2goeyByZWZzLCBuYW1lOiBuYW1lIHx8IG51bGwsIHBhdGggfSk7XG4gIGNvbnN0IGNvbm5zID0gQXJyYXkuaXNBcnJheShjaXJjdWl0LmNvbm5lY3Rpb25zKSA/IGNpcmN1aXQuY29ubmVjdGlvbnMgOiBbXTtcbiAgY29ubnMuZm9yRWFjaCgoYywgaSkgPT4ge1xuICAgIGNvbnN0IHBhdGggPSBgY29ubmVjdGlvbnNbJHtpfV1gO1xuICAgIGlmIChBcnJheS5pc0FycmF5KGMpKSBwdXNoKGMsIG51bGwsIHBhdGgpO1xuICAgIGVsc2UgaWYgKGMgJiYgdHlwZW9mIGMgPT09ICdvYmplY3QnKSB7XG4gICAgICBpZiAoQXJyYXkuaXNBcnJheShjLnBpbnMpKSBwdXNoKGMucGlucywgYy5uZXQgfHwgYy5uYW1lLCBwYXRoKTtcbiAgICAgIGVsc2UgcHVzaChbYy5mcm9tLCBjLnRvXSwgYy5uZXQgfHwgYy5uYW1lLCBwYXRoKTtcbiAgICB9IGVsc2UgcHVzaChudWxsLCBudWxsLCBwYXRoKTtcbiAgfSk7XG4gIGlmIChjaXJjdWl0Lm5ldHMgJiYgdHlwZW9mIGNpcmN1aXQubmV0cyA9PT0gJ29iamVjdCcgJiYgIUFycmF5LmlzQXJyYXkoY2lyY3VpdC5uZXRzKSkge1xuICAgIGZvciAoY29uc3QgW25hbWUsIHJlZnNdIG9mIE9iamVjdC5lbnRyaWVzKGNpcmN1aXQubmV0cykpIHB1c2goQXJyYXkuaXNBcnJheShyZWZzKSA/IHJlZnMgOiBudWxsLCBuYW1lLCBgbmV0cy4ke25hbWV9YCk7XG4gIH1cbiAgcmV0dXJuIGxpc3Q7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZUNpcmN1aXQoaW5wdXQpIHtcbiAgaWYgKHR5cGVvZiBpbnB1dCA9PT0gJ3N0cmluZycpIHtcbiAgICBjb25zdCByID0gcGFyc2VKU09OKGlucHV0KTtcbiAgICBpZiAoci5lcnJvcnMubGVuZ3RoKSByZXR1cm4geyBjaXJjdWl0OiBudWxsLCBlcnJvcnM6IHIuZXJyb3JzIH07XG4gICAgaW5wdXQgPSByLnZhbHVlO1xuICB9XG4gIC8vIEFjY2VwdCBBUEktc3R5bGUgZW52ZWxvcGVzOiB7IGNpcmN1aXQ6IHsuLi59IH1cbiAgaWYgKGlucHV0ICYmIHR5cGVvZiBpbnB1dCA9PT0gJ29iamVjdCcgJiYgaW5wdXQuY2lyY3VpdCAmJiAhaW5wdXQuY29tcG9uZW50cykgaW5wdXQgPSBpbnB1dC5jaXJjdWl0O1xuICByZXR1cm4geyBjaXJjdWl0OiBpbnB1dCwgZXJyb3JzOiBbXSB9O1xufVxuIiwgIi8vIEdlbmVyYXRlZCBieSBzY3JpcHRzL2J1aWxkLXN5bWJvbHMubWpzIFx1MjAxNCBkbyBub3QgZWRpdC5cbmV4cG9ydCBkZWZhdWx0IHtcImFjX3NvdXJjZVwiOntcInR5cGVcIjpcImFjX3NvdXJjZVwiLFwibmFtZVwiOlwiQUMgdm9sdGFnZSBzb3VyY2VcIixcImNhdGVnb3J5XCI6XCJhbmFsb2dcIixcInN2Z1wiOlwic3ltYm9sLnN2Z1wiLFwid2lkdGhcIjo2MCxcImhlaWdodFwiOjYwLFwicGluc1wiOntcInBvc2l0aXZlXCI6e1wieFwiOjMwLFwieVwiOjAsXCJkaXJcIjpcInVwXCJ9LFwibmVnYXRpdmVcIjp7XCJ4XCI6MzAsXCJ5XCI6NjAsXCJkaXJcIjpcImRvd25cIn19LFwiYWxpYXNlc1wiOntcIjFcIjpcInBvc2l0aXZlXCIsXCIyXCI6XCJuZWdhdGl2ZVwiLFwiK1wiOlwicG9zaXRpdmVcIixcIi1cIjpcIm5lZ2F0aXZlXCIsXCJwXCI6XCJwb3NpdGl2ZVwiLFwiblwiOlwibmVnYXRpdmVcIixcInZjY1wiOlwicG9zaXRpdmVcIixcImduZFwiOlwibmVnYXRpdmVcIixcImxcIjpcInBvc2l0aXZlXCJ9LFwiYm9keVwiOntcInhcIjoxMCxcInlcIjoxMCxcIndcIjo0MCxcImhcIjo0MH0sXCJwcmVmaXhcIjpcIlZcIixcInJlcXVpcmVkXCI6W1wicG9zaXRpdmVcIixcIm5lZ2F0aXZlXCJdLFwic291cmNlXCI6dHJ1ZSxcInR5cGVBbGlhc2VzXCI6W1wiYWNcIixcInNpbmVfc291cmNlXCJdLFwib3JpZ2luXCI6e1wibGlicmFyeVwiOlwiY2hyaXMtcGlrdWwvZWxlY3Ryb25pYy1zeW1ib2xzXCIsXCJ1cmxcIjpcImh0dHBzOi8vZ2l0aHViLmNvbS9jaHJpcy1waWt1bC9lbGVjdHJvbmljLXN5bWJvbHNcIixcImxpY2Vuc2VcIjpcIk1JVFwiLFwiY29weXJpZ2h0XCI6XCJDb3B5cmlnaHQgKGMpIDIwMjIgQ2hyaXMgUGlrdWxcIixcImZpbGVcIjpcIlNWRy9Tb3VyY2UtQ09NLUFDLnN2Z1wiLFwibW9kaWZpZWRcIjpcInJlZHJhd24gdmVydGljYWxseSAocG9zaXRpdmUgdXApIGZyb20gdGhlIHVwc3RyZWFtIGdlb21ldHJ5XCIsXCJtb2RpZmllZF9ub3RlXCI6XCJzY2FsZWQgMC40LCBzdHJva2Ugbm9ybWFsaXplZCB0byBjdXJyZW50Q29sb3JcIn0sXCJzdmdCb2R5XCI6XCI8ZyB0cmFuc2Zvcm09XFxcInNjYWxlKDAuNCkgdHJhbnNsYXRlKDAgMClcXFwiPjxnIGZpbGw9XFxcIm5vbmVcXFwiIHN0cm9rZT1cXFwiY3VycmVudENvbG9yXFxcIiBzdHJva2UtbWl0ZXJsaW1pdD1cXFwiMTBcXFwiIHN0cm9rZS13aWR0aD1cXFwiNFxcXCI+PGNpcmNsZSBjeD1cXFwiNzVcXFwiIGN5PVxcXCI3NVxcXCIgcj1cXFwiNTBcXFwiLz48cGF0aCBkPVxcXCJNNzUgMjVWMG0wIDEyNXYyNU0zNyA3NS4zOHM2LjM4LTE1LjYzIDIyLjEzLTE1LjYzIDkuNSAzMC43NSAzMS41IDMwLjc1UzExMiA3NS4zOCAxMTIgNzUuMzhcXFwiLz48L2c+PC9nPlwifSxcImFkY1wiOntcInR5cGVcIjpcImFkY1wiLFwibmFtZVwiOlwiQURDXCIsXCJjYXRlZ29yeVwiOlwiaWNcIixcInN2Z1wiOlwic3ltYm9sLnN2Z1wiLFwid2lkdGhcIjo2MCxcImhlaWdodFwiOjYwLFwicGluc1wiOntcIklOXCI6e1wieFwiOjAsXCJ5XCI6MzAsXCJkaXJcIjpcImxlZnRcIixcImlvXCI6XCJpblwifSxcIk9VVFwiOntcInhcIjo2MCxcInlcIjozMCxcImRpclwiOlwicmlnaHRcIixcImlvXCI6XCJvdXRcIn19LFwiYWxpYXNlc1wiOntcIjFcIjpcIklOXCIsXCIyXCI6XCJPVVRcIixcImFpblwiOlwiSU5cIixcImRvdXRcIjpcIk9VVFwifSxcImJvZHlcIjp7XCJ4XCI6MTAsXCJ5XCI6MTUsXCJ3XCI6NDAsXCJoXCI6MzB9LFwicHJlZml4XCI6XCJVXCIsXCJsYWJlbHNcIjpcInRvcFwiLFwidHlwZUFsaWFzZXNcIjpbXCJhbmFsb2dfdG9fZGlnaXRhbFwiXSxcIm9yaWdpblwiOntcImxpYnJhcnlcIjpcImNocmlzLXBpa3VsL2VsZWN0cm9uaWMtc3ltYm9sc1wiLFwidXJsXCI6XCJodHRwczovL2dpdGh1Yi5jb20vY2hyaXMtcGlrdWwvZWxlY3Ryb25pYy1zeW1ib2xzXCIsXCJsaWNlbnNlXCI6XCJNSVRcIixcImNvcHlyaWdodFwiOlwiQ29weXJpZ2h0IChjKSAyMDIyIENocmlzIFBpa3VsXCIsXCJmaWxlXCI6XCJTVkcvTWlzY2VsbGFuZW91cy1DT00tQURDLnN2Z1wiLFwibW9kaWZpZWRfbm90ZVwiOlwic2NhbGVkIDAuNCwgc3Ryb2tlIG5vcm1hbGl6ZWQgdG8gY3VycmVudENvbG9yXCJ9LFwic3ZnQm9keVwiOlwiPGcgdHJhbnNmb3JtPVxcXCJzY2FsZSgwLjQpIHRyYW5zbGF0ZSgwIDApXFxcIj48cGF0aCBmaWxsPVxcXCJub25lXFxcIiBzdHJva2U9XFxcImN1cnJlbnRDb2xvclxcXCIgc3Ryb2tlLW1pdGVybGltaXQ9XFxcIjEwXFxcIiBzdHJva2Utd2lkdGg9XFxcIjRcXFwiIGQ9XFxcIm0yNSA3NS4wNiAzNy41LTM3LjVIMTI1djc1SDYyLjVMMjUgNzUuMDZ6bS0yNS0uMzdoMjVtMTAwIC4zN2gyNVxcXCIvPjwvZz5cIn0sXCJhbmRcIjp7XCJ0eXBlXCI6XCJhbmRcIixcIm5hbWVcIjpcIkFORCBnYXRlXCIsXCJjYXRlZ29yeVwiOlwiZGlnaXRhbFwiLFwic3ZnXCI6XCJzeW1ib2wuc3ZnXCIsXCJ3aWR0aFwiOjYwLFwiaGVpZ2h0XCI6NjAsXCJwaW5zXCI6e1wiQVwiOntcInhcIjowLFwieVwiOjIwLFwiZGlyXCI6XCJsZWZ0XCIsXCJpb1wiOlwiaW5cIn0sXCJCXCI6e1wieFwiOjAsXCJ5XCI6NDAsXCJkaXJcIjpcImxlZnRcIixcImlvXCI6XCJpblwifSxcIllcIjp7XCJ4XCI6NjAsXCJ5XCI6MzAsXCJkaXJcIjpcInJpZ2h0XCIsXCJpb1wiOlwib3V0XCJ9fSxcImFsaWFzZXNcIjp7XCIxXCI6XCJBXCIsXCIyXCI6XCJCXCIsXCIzXCI6XCJZXCIsXCJpbjFcIjpcIkFcIixcImluMlwiOlwiQlwiLFwib3V0XCI6XCJZXCIsXCJxXCI6XCJZXCIsXCJvXCI6XCJZXCIsXCJvdXRwdXRcIjpcIllcIn0sXCJib2R5XCI6e1wieFwiOjEyLjQsXCJ5XCI6MTUsXCJ3XCI6MzIuNixcImhcIjozMH0sXCJwcmVmaXhcIjpcIlVcIixcImxhYmVsc1wiOlwidG9wXCIsXCJ0eXBlQWxpYXNlc1wiOltcImFuZF9nYXRlXCJdLFwib3JpZ2luXCI6e1wibGlicmFyeVwiOlwiY2hyaXMtcGlrdWwvZWxlY3Ryb25pYy1zeW1ib2xzXCIsXCJ1cmxcIjpcImh0dHBzOi8vZ2l0aHViLmNvbS9jaHJpcy1waWt1bC9lbGVjdHJvbmljLXN5bWJvbHNcIixcImxpY2Vuc2VcIjpcIk1JVFwiLFwiY29weXJpZ2h0XCI6XCJDb3B5cmlnaHQgKGMpIDIwMjIgQ2hyaXMgUGlrdWxcIixcImZpbGVcIjpcIlNWRy9JQy1DT00tTG9naWMtQU5ELnN2Z1wiLFwibW9kaWZpZWRfbm90ZVwiOlwic2NhbGVkIDAuNCwgc3Ryb2tlIG5vcm1hbGl6ZWQgdG8gY3VycmVudENvbG9yXCJ9LFwic3ZnQm9keVwiOlwiPGcgdHJhbnNmb3JtPVxcXCJzY2FsZSgwLjQpIHRyYW5zbGF0ZSgwIDApXFxcIj48cGF0aCBmaWxsPVxcXCJub25lXFxcIiBzdHJva2U9XFxcImN1cnJlbnRDb2xvclxcXCIgc3Ryb2tlLW1pdGVybGltaXQ9XFxcIjEwXFxcIiBzdHJva2Utd2lkdGg9XFxcIjRcXFwiIGQ9XFxcIk0zMS4yNSAzNy41aDI1YzE4Ljc1IDAgNTYuMjUgMCA1Ni4yNSAzNy41Uzc1IDExMi41IDU2LjI1IDExMi41aC0yNVpNMCA0OS44MWgzMS4yNU0wIDEwMC4wNmgzMS4yNU0xMTIuNSA3NUgxNTBcXFwiLz48L2c+XCJ9LFwiYmF0dGVyeVwiOntcInR5cGVcIjpcImJhdHRlcnlcIixcIm5hbWVcIjpcIkJhdHRlcnlcIixcImNhdGVnb3J5XCI6XCJwb3dlclwiLFwic3ZnXCI6XCJzeW1ib2wuc3ZnXCIsXCJ3aWR0aFwiOjYwLFwiaGVpZ2h0XCI6NjAsXCJwaW5zXCI6e1wicG9zaXRpdmVcIjp7XCJ4XCI6MzAsXCJ5XCI6MCxcImRpclwiOlwidXBcIn0sXCJuZWdhdGl2ZVwiOntcInhcIjozMCxcInlcIjo2MCxcImRpclwiOlwiZG93blwifX0sXCJhbGlhc2VzXCI6e1wiMVwiOlwicG9zaXRpdmVcIixcIjJcIjpcIm5lZ2F0aXZlXCIsXCIrXCI6XCJwb3NpdGl2ZVwiLFwiLVwiOlwibmVnYXRpdmVcIixcInBcIjpcInBvc2l0aXZlXCIsXCJuXCI6XCJuZWdhdGl2ZVwiLFwidmNjXCI6XCJwb3NpdGl2ZVwiLFwiZ25kXCI6XCJuZWdhdGl2ZVwifSxcImJvZHlcIjp7XCJ4XCI6MTgsXCJ5XCI6MTAsXCJ3XCI6MjgsXCJoXCI6Mzh9LFwicHJlZml4XCI6XCJCVFwiLFwicmVxdWlyZWRcIjpbXCJwb3NpdGl2ZVwiLFwibmVnYXRpdmVcIl0sXCJzb3VyY2VcIjp0cnVlLFwidHlwZUFsaWFzZXNcIjpbXCJjZWxsXCJdLFwib3JpZ2luXCI6e1wibGlicmFyeVwiOlwiY2hyaXMtcGlrdWwvZWxlY3Ryb25pYy1zeW1ib2xzXCIsXCJ1cmxcIjpcImh0dHBzOi8vZ2l0aHViLmNvbS9jaHJpcy1waWt1bC9lbGVjdHJvbmljLXN5bWJvbHNcIixcImxpY2Vuc2VcIjpcIk1JVFwiLFwiY29weXJpZ2h0XCI6XCJDb3B5cmlnaHQgKGMpIDIwMjIgQ2hyaXMgUGlrdWxcIixcImZpbGVcIjpcIlNWRy9Tb3VyY2UtQ09NLUJhdHRlcnktU2luZ2xlLnN2Z1wiLFwibW9kaWZpZWRcIjpcInJlZHJhd24gdmVydGljYWxseSAocG9zaXRpdmUgdXApIGZyb20gdGhlIHVwc3RyZWFtIGdlb21ldHJ5XCIsXCJtb2RpZmllZF9ub3RlXCI6XCJzY2FsZWQgMC40LCBzdHJva2Ugbm9ybWFsaXplZCB0byBjdXJyZW50Q29sb3JcIn0sXCJzdmdCb2R5XCI6XCI8ZyB0cmFuc2Zvcm09XFxcInNjYWxlKDAuNCkgdHJhbnNsYXRlKDAgMClcXFwiPjxnIGZpbGw9XFxcIm5vbmVcXFwiIHN0cm9rZT1cXFwiY3VycmVudENvbG9yXFxcIiBzdHJva2UtbWl0ZXJsaW1pdD1cXFwiMTBcXFwiIHN0cm9rZS13aWR0aD1cXFwiNFxcXCI+PHBhdGggZD1cXFwiTTUwIDY1Ljc1aDUwTTYyLjUgODQuMjVoMjVNNzUgNjUuNzVWMG0wIDg0LjI1VjE1ME04Ny41IDM3LjVoMjVNMTAwIDI1djI1TTg3LjUgMTEyLjVoMjVcXFwiLz48L2c+PC9nPlwifSxcImJ1ZmZlclwiOntcInR5cGVcIjpcImJ1ZmZlclwiLFwibmFtZVwiOlwiQnVmZmVyXCIsXCJjYXRlZ29yeVwiOlwiZGlnaXRhbFwiLFwic3ZnXCI6XCJzeW1ib2wuc3ZnXCIsXCJ3aWR0aFwiOjYwLFwiaGVpZ2h0XCI6NjAsXCJwaW5zXCI6e1wiQVwiOntcInhcIjowLFwieVwiOjMwLFwiZGlyXCI6XCJsZWZ0XCIsXCJpb1wiOlwiaW5cIn0sXCJZXCI6e1wieFwiOjYwLFwieVwiOjMwLFwiZGlyXCI6XCJyaWdodFwiLFwiaW9cIjpcIm91dFwifX0sXCJhbGlhc2VzXCI6e1wiMVwiOlwiQVwiLFwiMlwiOlwiWVwiLFwiaW5cIjpcIkFcIixcIm91dFwiOlwiWVwiLFwiaW5wdXRcIjpcIkFcIixcIm91dHB1dFwiOlwiWVwifSxcImJvZHlcIjp7XCJ4XCI6MTAsXCJ5XCI6MTUsXCJ3XCI6MzUsXCJoXCI6MzB9LFwicHJlZml4XCI6XCJVXCIsXCJsYWJlbHNcIjpcInRvcFwiLFwib3JpZ2luXCI6e1wibGlicmFyeVwiOlwiY2hyaXMtcGlrdWwvZWxlY3Ryb25pYy1zeW1ib2xzXCIsXCJ1cmxcIjpcImh0dHBzOi8vZ2l0aHViLmNvbS9jaHJpcy1waWt1bC9lbGVjdHJvbmljLXN5bWJvbHNcIixcImxpY2Vuc2VcIjpcIk1JVFwiLFwiY29weXJpZ2h0XCI6XCJDb3B5cmlnaHQgKGMpIDIwMjIgQ2hyaXMgUGlrdWxcIixcImZpbGVcIjpcIlNWRy9JQy1DT00tTG9naWMtQnVmZmVyLnN2Z1wiLFwibW9kaWZpZWRfbm90ZVwiOlwic2NhbGVkIDAuNCwgc3Ryb2tlIG5vcm1hbGl6ZWQgdG8gY3VycmVudENvbG9yXCJ9LFwic3ZnQm9keVwiOlwiPGcgdHJhbnNmb3JtPVxcXCJzY2FsZSgwLjQpIHRyYW5zbGF0ZSgwIDApXFxcIj48cGF0aCBmaWxsPVxcXCJub25lXFxcIiBzdHJva2U9XFxcImN1cnJlbnRDb2xvclxcXCIgc3Ryb2tlLW1pdGVybGltaXQ9XFxcIjEwXFxcIiBzdHJva2Utd2lkdGg9XFxcIjRcXFwiIGQ9XFxcIk0yNSAzNy41djc1TDExMi41IDc1IDI1IDM3LjV6TTI1IDc1SDBtMTEyLjUgMEgxNTBcXFwiLz48L2c+XCJ9LFwiY2FwYWNpdG9yXCI6e1widHlwZVwiOlwiY2FwYWNpdG9yXCIsXCJuYW1lXCI6XCJDYXBhY2l0b3JcIixcImNhdGVnb3J5XCI6XCJwYXNzaXZlXCIsXCJzdmdcIjpcInN5bWJvbC5zdmdcIixcIndpZHRoXCI6NjAsXCJoZWlnaHRcIjo2MCxcInBpbnNcIjp7XCIxXCI6e1wieFwiOjAsXCJ5XCI6MzAsXCJkaXJcIjpcImxlZnRcIn0sXCIyXCI6e1wieFwiOjYwLFwieVwiOjMwLFwiZGlyXCI6XCJyaWdodFwifX0sXCJib2R5XCI6e1wieFwiOjIwLFwieVwiOjE3LjYsXCJ3XCI6MTUuMixcImhcIjoyNC44fSxcInByZWZpeFwiOlwiQ1wiLFwidHlwZUFsaWFzZXNcIjpbXCJjYXBcIixcImNcIl0sXCJvcmlnaW5cIjp7XCJsaWJyYXJ5XCI6XCJjaHJpcy1waWt1bC9lbGVjdHJvbmljLXN5bWJvbHNcIixcInVybFwiOlwiaHR0cHM6Ly9naXRodWIuY29tL2NocmlzLXBpa3VsL2VsZWN0cm9uaWMtc3ltYm9sc1wiLFwibGljZW5zZVwiOlwiTUlUXCIsXCJjb3B5cmlnaHRcIjpcIkNvcHlyaWdodCAoYykgMjAyMiBDaHJpcyBQaWt1bFwiLFwiZmlsZVwiOlwiU1ZHL0NhcGFjaXRvci1JRUVFLU5vblBvbGFyaXplZC5zdmdcIixcIm1vZGlmaWVkX25vdGVcIjpcInNjYWxlZCAwLjQsIHN0cm9rZSBub3JtYWxpemVkIHRvIGN1cnJlbnRDb2xvclwifSxcInN2Z0JvZHlcIjpcIjxnIHRyYW5zZm9ybT1cXFwic2NhbGUoMC40KSB0cmFuc2xhdGUoMCAwKVxcXCI+PHBhdGggZmlsbD1cXFwibm9uZVxcXCIgc3Ryb2tlPVxcXCJjdXJyZW50Q29sb3JcXFwiIHN0cm9rZS1taXRlcmxpbWl0PVxcXCIxMFxcXCIgc3Ryb2tlLXdpZHRoPVxcXCI0XFxcIiBkPVxcXCJNMTUwIDc0Ljk3SDg0LjVNMCA3NS4yNWg2Ni41TTU0IDQ0czEyLjUgMTIuMjUgMTIuNSAzMVM1NCAxMDYgNTQgMTA2bTMwLjUtNjJ2NjJcXFwiLz48L2c+XCJ9LFwiY2FwYWNpdG9yX3BvbGFyaXplZFwiOntcInR5cGVcIjpcImNhcGFjaXRvcl9wb2xhcml6ZWRcIixcIm5hbWVcIjpcIlBvbGFyaXplZCBjYXBhY2l0b3JcIixcImNhdGVnb3J5XCI6XCJwYXNzaXZlXCIsXCJzdmdcIjpcInN5bWJvbC5zdmdcIixcIndpZHRoXCI6NjAsXCJoZWlnaHRcIjo2MCxcInBpbnNcIjp7XCJuZWdhdGl2ZVwiOntcInhcIjowLFwieVwiOjMwLFwiZGlyXCI6XCJsZWZ0XCJ9LFwicG9zaXRpdmVcIjp7XCJ4XCI6NjAsXCJ5XCI6MzAsXCJkaXJcIjpcInJpZ2h0XCJ9fSxcImFsaWFzZXNcIjp7XCIxXCI6XCJwb3NpdGl2ZVwiLFwiMlwiOlwibmVnYXRpdmVcIixcIitcIjpcInBvc2l0aXZlXCIsXCItXCI6XCJuZWdhdGl2ZVwifSxcImJvZHlcIjp7XCJ4XCI6MjAsXCJ5XCI6MTIsXCJ3XCI6MzMuNixcImhcIjozMC40fSxcInByZWZpeFwiOlwiQ1wiLFwidHlwZUFsaWFzZXNcIjpbXCJlbGVjdHJvbHl0aWNcIixcInBvbGFyaXplZF9jYXBhY2l0b3JcIl0sXCJvcmlnaW5cIjp7XCJsaWJyYXJ5XCI6XCJjaHJpcy1waWt1bC9lbGVjdHJvbmljLXN5bWJvbHNcIixcInVybFwiOlwiaHR0cHM6Ly9naXRodWIuY29tL2NocmlzLXBpa3VsL2VsZWN0cm9uaWMtc3ltYm9sc1wiLFwibGljZW5zZVwiOlwiTUlUXCIsXCJjb3B5cmlnaHRcIjpcIkNvcHlyaWdodCAoYykgMjAyMiBDaHJpcyBQaWt1bFwiLFwiZmlsZVwiOlwiU1ZHL0NhcGFjaXRvci1JRUVFLVBvbGFyaXplZC5zdmdcIixcIm1vZGlmaWVkX25vdGVcIjpcInNjYWxlZCAwLjQsIHN0cm9rZSBub3JtYWxpemVkIHRvIGN1cnJlbnRDb2xvclwifSxcInN2Z0JvZHlcIjpcIjxnIHRyYW5zZm9ybT1cXFwic2NhbGUoMC40KSB0cmFuc2xhdGUoMCAwKVxcXCI+PHBhdGggZmlsbD1cXFwibm9uZVxcXCIgc3Ryb2tlPVxcXCJjdXJyZW50Q29sb3JcXFwiIHN0cm9rZS1taXRlcmxpbWl0PVxcXCIxMFxcXCIgc3Ryb2tlLXdpZHRoPVxcXCI0XFxcIiBkPVxcXCJNMTUwIDc0Ljk3SDg0LjVNMCA3NS4yNWg2Ni41TTU0IDQ0czEyLjUgMTIuMjUgMTIuNSAzMVM1NCAxMDYgNTQgMTA2bTMwLjUtNjJ2NjJtNDYuNzUtNTZoLTI1bTEyLjUtMTIuNXYyNVxcXCIvPjwvZz5cIn0sXCJjb21wYXJhdG9yXCI6e1widHlwZVwiOlwiY29tcGFyYXRvclwiLFwibmFtZVwiOlwiQ29tcGFyYXRvclwiLFwiY2F0ZWdvcnlcIjpcImFuYWxvZ1wiLFwic3ZnXCI6XCJzeW1ib2wuc3ZnXCIsXCJ3aWR0aFwiOjYwLFwiaGVpZ2h0XCI6NjAsXCJwaW5zXCI6e1wiaW4rXCI6e1wieFwiOjAsXCJ5XCI6MjAsXCJkaXJcIjpcImxlZnRcIixcImlvXCI6XCJpblwifSxcImluLVwiOntcInhcIjowLFwieVwiOjQwLFwiZGlyXCI6XCJsZWZ0XCIsXCJpb1wiOlwiaW5cIn0sXCJvdXRcIjp7XCJ4XCI6NjAsXCJ5XCI6MzAsXCJkaXJcIjpcInJpZ2h0XCIsXCJpb1wiOlwib3V0XCJ9fSxcImFsaWFzZXNcIjp7XCIrXCI6XCJpbitcIixcIi1cIjpcImluLVwiLFwiaW5wXCI6XCJpbitcIixcImlublwiOlwiaW4tXCIsXCJvdXRwdXRcIjpcIm91dFwifSxcImJvZHlcIjp7XCJ4XCI6MTAsXCJ5XCI6MTAsXCJ3XCI6NDAsXCJoXCI6NDB9LFwicHJlZml4XCI6XCJVXCIsXCJsYWJlbHNcIjpcInRvcHJpZ2h0XCIsXCJyZXF1aXJlZFwiOltcImluK1wiLFwiaW4tXCIsXCJvdXRcIl0sXCJvcmlnaW5cIjp7XCJsaWJyYXJ5XCI6XCJjaHJpcy1waWt1bC9lbGVjdHJvbmljLXN5bWJvbHNcIixcInVybFwiOlwiaHR0cHM6Ly9naXRodWIuY29tL2NocmlzLXBpa3VsL2VsZWN0cm9uaWMtc3ltYm9sc1wiLFwibGljZW5zZVwiOlwiTUlUXCIsXCJjb3B5cmlnaHRcIjpcIkNvcHlyaWdodCAoYykgMjAyMiBDaHJpcyBQaWt1bFwiLFwiZmlsZVwiOlwiU1ZHL0lDLUNPTS1Db21wYXJhdG9yLnN2Z1wiLFwibW9kaWZpZWRfbm90ZVwiOlwic2NhbGVkIDAuNCwgc3Ryb2tlIG5vcm1hbGl6ZWQgdG8gY3VycmVudENvbG9yXCJ9LFwic3ZnQm9keVwiOlwiPGcgdHJhbnNmb3JtPVxcXCJzY2FsZSgwLjQpIHRyYW5zbGF0ZSgwIDApXFxcIj48cGF0aCBmaWxsPVxcXCJub25lXFxcIiBzdHJva2U9XFxcImN1cnJlbnRDb2xvclxcXCIgc3Ryb2tlLW1pdGVybGltaXQ9XFxcIjEwXFxcIiBzdHJva2Utd2lkdGg9XFxcIjRcXFwiIGQ9XFxcIk0yNSAyNXYxMDBsMTAwLTUwTDI1IDI1em0wIDI1SDBtMTI1IDI1aDI1TTAgMTAwaDI1bTkuNS00N0g1M20tOS4yNS05LjI1djE4LjVNMzQuNSA5N0g1M1xcXCIvPjwvZz5cIn0sXCJjb25uZWN0b3JcIjp7XCJ0eXBlXCI6XCJjb25uZWN0b3JcIixcIm5hbWVcIjpcIkNvbm5lY3RvclwiLFwiY2F0ZWdvcnlcIjpcInBvd2VyXCIsXCJraW5kXCI6XCJib3hcIixcImxhYmVsXCI6XCJcIixcInBpbnNcIjp7XCJyaWdodFwiOltcIjFcIixcIjJcIixcIjNcIixcIjRcIl19LFwicHJlZml4XCI6XCJKXCIsXCJpb1wiOlwicGFzc2l2ZVwiLFwidHlwZUFsaWFzZXNcIjpbXCJoZWFkZXJcIixcImNvbm5cIl0sXCJvcmlnaW5cIjp7XCJsaWJyYXJ5XCI6XCJDaXJjdWl0Rm9yZ2VcIixcImxpY2Vuc2VcIjpcInNhbWUgYXMgdGhlIENpcmN1aXRGb3JnZSBwcm9qZWN0XCIsXCJub3RlXCI6XCJvcmlnaW5hbCBDaXJjdWl0Rm9yZ2Ugc3ltYm9sXCJ9fSxcImNvdW50ZXJcIjp7XCJ0eXBlXCI6XCJjb3VudGVyXCIsXCJuYW1lXCI6XCJDb3VudGVyXCIsXCJjYXRlZ29yeVwiOlwiZGlnaXRhbFwiLFwia2luZFwiOlwiYm94XCIsXCJsYWJlbFwiOlwiQ1RSXCIsXCJwaW5zXCI6e1wibGVmdFwiOltcIkNMS1wiLFwifkNMUlwiLFwiRU5cIl0sXCJyaWdodFwiOltcIlEwXCIsXCJRMVwiLFwiUTJcIixcIlEzXCJdfSxcInByZWZpeFwiOlwiVVwiLFwidHlwZUFsaWFzZXNcIjpbXCJiaW5hcnlfY291bnRlclwiXSxcIm9yaWdpblwiOntcImxpYnJhcnlcIjpcIkNpcmN1aXRGb3JnZVwiLFwibGljZW5zZVwiOlwic2FtZSBhcyB0aGUgQ2lyY3VpdEZvcmdlIHByb2plY3RcIixcIm5vdGVcIjpcIm9yaWdpbmFsIENpcmN1aXRGb3JnZSBzeW1ib2xcIn19LFwiY3J5c3RhbFwiOntcInR5cGVcIjpcImNyeXN0YWxcIixcIm5hbWVcIjpcIkNyeXN0YWxcIixcImNhdGVnb3J5XCI6XCJwYXNzaXZlXCIsXCJzdmdcIjpcInN5bWJvbC5zdmdcIixcIndpZHRoXCI6NjAsXCJoZWlnaHRcIjo2MCxcInBpbnNcIjp7XCIxXCI6e1wieFwiOjAsXCJ5XCI6MzAsXCJkaXJcIjpcImxlZnRcIn0sXCIyXCI6e1wieFwiOjYwLFwieVwiOjMwLFwiZGlyXCI6XCJyaWdodFwifX0sXCJib2R5XCI6e1wieFwiOjE0LFwieVwiOjEwLFwid1wiOjMyLFwiaFwiOjQwfSxcInByZWZpeFwiOlwiWVwiLFwidHlwZUFsaWFzZXNcIjpbXCJ4dGFsXCJdLFwib3JpZ2luXCI6e1wibGlicmFyeVwiOlwiY2hyaXMtcGlrdWwvZWxlY3Ryb25pYy1zeW1ib2xzXCIsXCJ1cmxcIjpcImh0dHBzOi8vZ2l0aHViLmNvbS9jaHJpcy1waWt1bC9lbGVjdHJvbmljLXN5bWJvbHNcIixcImxpY2Vuc2VcIjpcIk1JVFwiLFwiY29weXJpZ2h0XCI6XCJDb3B5cmlnaHQgKGMpIDIwMjIgQ2hyaXMgUGlrdWxcIixcImZpbGVcIjpcIlNWRy9NaXNjZWxsYW5lb3VzLUNPTS1DcnlzdGFsX09zY2lsbGF0b3Iuc3ZnXCIsXCJtb2RpZmllZF9ub3RlXCI6XCJzY2FsZWQgMC40LCBzdHJva2Ugbm9ybWFsaXplZCB0byBjdXJyZW50Q29sb3JcIn0sXCJzdmdCb2R5XCI6XCI8ZyB0cmFuc2Zvcm09XFxcInNjYWxlKDAuNCkgdHJhbnNsYXRlKDAgMClcXFwiPjxwYXRoIGZpbGw9XFxcIm5vbmVcXFwiIHN0cm9rZT1cXFwiY3VycmVudENvbG9yXFxcIiBzdHJva2UtbWl0ZXJsaW1pdD1cXFwiMTBcXFwiIHN0cm9rZS13aWR0aD1cXFwiNFxcXCIgZD1cXFwiTTUwIDI1aDUwdjEwMEg1MHpNMzcuNSA0My43NXY2Mi41bTc1LTYyLjV2NjIuNU0wIDc0LjYzaDM3LjVtNzUgLjM3SDE1MFxcXCIvPjwvZz5cIn0sXCJjdXJyZW50X3NvdXJjZVwiOntcInR5cGVcIjpcImN1cnJlbnRfc291cmNlXCIsXCJuYW1lXCI6XCJDdXJyZW50IHNvdXJjZVwiLFwiY2F0ZWdvcnlcIjpcImFuYWxvZ1wiLFwic3ZnXCI6XCJzeW1ib2wuc3ZnXCIsXCJ3aWR0aFwiOjYwLFwiaGVpZ2h0XCI6NjAsXCJwaW5zXCI6e1wicG9zaXRpdmVcIjp7XCJ4XCI6MzAsXCJ5XCI6MCxcImRpclwiOlwidXBcIn0sXCJuZWdhdGl2ZVwiOntcInhcIjozMCxcInlcIjo2MCxcImRpclwiOlwiZG93blwifX0sXCJhbGlhc2VzXCI6e1wiMVwiOlwicG9zaXRpdmVcIixcIjJcIjpcIm5lZ2F0aXZlXCIsXCIrXCI6XCJwb3NpdGl2ZVwiLFwiLVwiOlwibmVnYXRpdmVcIixcInBcIjpcInBvc2l0aXZlXCIsXCJuXCI6XCJuZWdhdGl2ZVwiLFwidmNjXCI6XCJwb3NpdGl2ZVwiLFwiZ25kXCI6XCJuZWdhdGl2ZVwifSxcImJvZHlcIjp7XCJ4XCI6MTAsXCJ5XCI6MTAsXCJ3XCI6NDAsXCJoXCI6NDB9LFwicHJlZml4XCI6XCJJXCIsXCJyZXF1aXJlZFwiOltcInBvc2l0aXZlXCIsXCJuZWdhdGl2ZVwiXSxcInNvdXJjZVwiOnRydWUsXCJ0eXBlQWxpYXNlc1wiOltcImlzb3VyY2VcIl0sXCJvcmlnaW5cIjp7XCJsaWJyYXJ5XCI6XCJjaHJpcy1waWt1bC9lbGVjdHJvbmljLXN5bWJvbHNcIixcInVybFwiOlwiaHR0cHM6Ly9naXRodWIuY29tL2NocmlzLXBpa3VsL2VsZWN0cm9uaWMtc3ltYm9sc1wiLFwibGljZW5zZVwiOlwiTUlUXCIsXCJjb3B5cmlnaHRcIjpcIkNvcHlyaWdodCAoYykgMjAyMiBDaHJpcyBQaWt1bFwiLFwiZmlsZVwiOlwiU1ZHL1NvdXJjZS1DT00tQ3VycmVudC5zdmdcIixcIm1vZGlmaWVkXCI6XCJyZWRyYXduIHZlcnRpY2FsbHkgKHBvc2l0aXZlIHVwKSBmcm9tIHRoZSB1cHN0cmVhbSBnZW9tZXRyeVwiLFwibW9kaWZpZWRfbm90ZVwiOlwic2NhbGVkIDAuNCwgc3Ryb2tlIG5vcm1hbGl6ZWQgdG8gY3VycmVudENvbG9yXCJ9LFwic3ZnQm9keVwiOlwiPGcgdHJhbnNmb3JtPVxcXCJzY2FsZSgwLjQpIHRyYW5zbGF0ZSgwIDApXFxcIj48ZyBmaWxsPVxcXCJub25lXFxcIiBzdHJva2U9XFxcImN1cnJlbnRDb2xvclxcXCIgc3Ryb2tlLW1pdGVybGltaXQ9XFxcIjEwXFxcIiBzdHJva2Utd2lkdGg9XFxcIjRcXFwiPjxjaXJjbGUgY3g9XFxcIjc1XFxcIiBjeT1cXFwiNzVcXFwiIHI9XFxcIjUwXFxcIi8+PHBhdGggZD1cXFwiTTc1IDI1VjBtMCAxMjV2MjVNNzUgMTEyLjVWNTlcXFwiLz48L2c+PHBhdGggZmlsbD1cXFwiY3VycmVudENvbG9yXFxcIiBkPVxcXCJNNjAuMDQgNjMuNDEgNzUgMzcuNWwxNC45NiAyNS45MXpcXFwiLz48L2c+XCJ9LFwiZF9mbGlwZmxvcFwiOntcInR5cGVcIjpcImRfZmxpcGZsb3BcIixcIm5hbWVcIjpcIkQgZmxpcC1mbG9wXCIsXCJjYXRlZ29yeVwiOlwiZGlnaXRhbFwiLFwic3ZnXCI6XCJzeW1ib2wuc3ZnXCIsXCJ3aWR0aFwiOjYwLFwiaGVpZ2h0XCI6NjAsXCJwaW5zXCI6e1wiRFwiOntcInhcIjowLFwieVwiOjIwLFwiZGlyXCI6XCJsZWZ0XCIsXCJpb1wiOlwiaW5cIn0sXCJDTEtcIjp7XCJ4XCI6MCxcInlcIjo0MCxcImRpclwiOlwibGVmdFwiLFwiaW9cIjpcImluXCJ9LFwiUVwiOntcInhcIjo2MCxcInlcIjoyMCxcImRpclwiOlwicmlnaHRcIixcImlvXCI6XCJvdXRcIn0sXCJRTlwiOntcInhcIjo2MCxcInlcIjo0MCxcImRpclwiOlwicmlnaHRcIixcImlvXCI6XCJvdXRcIn0sXCJTXCI6e1wieFwiOjMwLFwieVwiOjAsXCJkaXJcIjpcInVwXCIsXCJpb1wiOlwiaW5cIn0sXCJSXCI6e1wieFwiOjMwLFwieVwiOjYwLFwiZGlyXCI6XCJkb3duXCIsXCJpb1wiOlwiaW5cIn19LFwiYWxpYXNlc1wiOntcInFcdTAzMDRcIjpcIlFOXCIsXCJxX2JhclwiOlwiUU5cIixcInFiYXJcIjpcIlFOXCIsXCJucVwiOlwiUU5cIixcIn5xXCI6XCJRTlwiLFwiY2xvY2tcIjpcIkNMS1wiLFwiY2xrXCI6XCJDTEtcIixcInNldFwiOlwiU1wiLFwicHJlXCI6XCJTXCIsXCJwcmVzZXRcIjpcIlNcIixcInJlc2V0XCI6XCJSXCIsXCJjbHJcIjpcIlJcIixcImNsZWFyXCI6XCJSXCJ9LFwiYm9keVwiOntcInhcIjoxMCxcInlcIjo1LFwid1wiOjQwLFwiaFwiOjUwfSxcInByZWZpeFwiOlwiVVwiLFwibGFiZWxzXCI6XCJ0b3BcIixcInJlcXVpcmVkXCI6W1wiRFwiLFwiQ0xLXCJdLFwidHlwZUFsaWFzZXNcIjpbXCJkZmZcIixcImZsaXBmbG9wX2RcIl0sXCJvcmlnaW5cIjp7XCJsaWJyYXJ5XCI6XCJjaHJpcy1waWt1bC9lbGVjdHJvbmljLXN5bWJvbHNcIixcInVybFwiOlwiaHR0cHM6Ly9naXRodWIuY29tL2NocmlzLXBpa3VsL2VsZWN0cm9uaWMtc3ltYm9sc1wiLFwibGljZW5zZVwiOlwiTUlUXCIsXCJjb3B5cmlnaHRcIjpcIkNvcHlyaWdodCAoYykgMjAyMiBDaHJpcyBQaWt1bFwiLFwiZmlsZVwiOlwiU1ZHL0lDLUNPTS1GbGlwRmxvcC1DbG9ja2VkRC5zdmdcIixcIm1vZGlmaWVkX25vdGVcIjpcInNjYWxlZCAwLjQsIHN0cm9rZSBub3JtYWxpemVkIHRvIGN1cnJlbnRDb2xvclwifSxcInN2Z0JvZHlcIjpcIjxnIHRyYW5zZm9ybT1cXFwic2NhbGUoMC40KSB0cmFuc2xhdGUoMCAwKVxcXCI+PHBhdGggZmlsbD1cXFwibm9uZVxcXCIgc3Ryb2tlPVxcXCJjdXJyZW50Q29sb3JcXFwiIHN0cm9rZS1taXRlcmxpbWl0PVxcXCIxMFxcXCIgc3Ryb2tlLXdpZHRoPVxcXCI0XFxcIiBkPVxcXCJNMjUgMTIuNWgxMDB2MTI1SDI1ek0yNSA1MEgwbTI1IDUwSDBtMTI1LTUwaDI1bS0yNSA1MGgyNVxcXCIvPlxccjxwYXRoIGZpbGw9XFxcImN1cnJlbnRDb2xvclxcXCIgZD1cXFwibTExMS41NyA1My45IDIgMS4yOS0xLjM2IDMuMTYtMi0xLjQ0YTQuNzggNC43OCAwIDAgMS00IDIuMzQgNS4wOCA1LjA4IDAgMCAxLTQuNDgtMi40NiAxMi41MiAxMi41MiAwIDAgMS0xLjczLTYuOTEgMTIuNSAxMi41IDAgMCAxIDEuNjItNi44OCA1LjE1IDUuMTUgMCAwIDEgOC43OSAwIDEyLjUgMTIuNSAwIDAgMSAxLjU5IDYuODhjMCAzLjE4LS40MyA0LjAyLS40MyA0LjAyWm0tMi4zNy0xLjMzYTEzLjUxIDEzLjUxIDAgMCAwIC4yNC0yLjY5IDkuMjUgOS4yNSAwIDAgMC0uOTQtNC43IDIuNzYgMi43NiAwIDAgMC01IDAgOS4yMiA5LjIyIDAgMCAwLTEgNC42OSA5LjQ0IDkuNDQgMCAwIDAgMSA0Ljc1IDIuODQgMi44NCAwIDAgMCAyLjQxIDEuNTggMi40MSAyLjQxIDAgMCAwIDEuOS0uODVsLTItMS40NCAxLjUyLTIuNjZtNC4yNCA1Mi42NSAyIDEuMjktMS4zNiAzLjE2LTItMS40NGE0Ljc4IDQuNzggMCAwIDEtNCAyLjM0IDUuMDggNS4wOCAwIDAgMS00LjQ4LTIuNDYgMTIuNTIgMTIuNTIgMCAwIDEtMS43My02LjkxIDEyLjUgMTIuNSAwIDAgMSAxLjYyLTYuODggNS4xNSA1LjE1IDAgMCAxIDguNzkgMCAxMi41IDEyLjUgMCAwIDEgMS41OSA2Ljg4YzAgMy4xOC0uNDMgNC4wMi0uNDMgNC4wMlptLTIuMzctMS4zM2ExMy41MSAxMy41MSAwIDAgMCAuMjQtMi42OSA5LjI1IDkuMjUgMCAwIDAtLjk0LTQuNyAyLjc2IDIuNzYgMCAwIDAtNSAwIDkuMjIgOS4yMiAwIDAgMC0xIDQuNjkgOS40NCA5LjQ0IDAgMCAwIDEgNC43NSAyLjg0IDIuODQgMCAwIDAgMi40MSAxLjU4IDIuNDEgMi40MSAwIDAgMCAxLjktLjg1bC0yLTEuNDQgMS41Mi0yLjY2XFxcIi8+XFxyPHBhdGggZmlsbD1cXFwibm9uZVxcXCIgc3Ryb2tlPVxcXCJjdXJyZW50Q29sb3JcXFwiIHN0cm9rZS1taXRlcmxpbWl0PVxcXCIxMFxcXCIgc3Ryb2tlLXdpZHRoPVxcXCI0XFxcIiBkPVxcXCJNOTcgODQuMjVoMTguNzVcXFwiLz5cXHI8cGF0aCBmaWxsPVxcXCJjdXJyZW50Q29sb3JcXFwiIGQ9XFxcIk0zNy41IDQwLjc5SDQzYTguNjcgOC42NyAwIDAgMSAyLjg0LjM1IDUgNSAwIDAgMSAyLjI1IDEuNyA4LjU2IDguNTYgMCAwIDEgMS40MiAzIDE2LjQzIDE2LjQzIDAgMCAxIC40OSA0LjM1IDE0LjYyIDE0LjYyIDAgMCAxLS40NiAzLjkzQTguNjkgOC42OSAwIDAgMSA0OCA1Ny4zOWE1LjE3IDUuMTcgMCAwIDEtMi4xMiAxLjQ3IDcuNDQgNy40NCAwIDAgMS0yLjY2LjM5SDM3LjVabTMgMy4xMnYxMi4yM2gyLjI1YTYuNTMgNi41MyAwIDAgMCAxLjgzLS4xNCAyLjUzIDIuNTMgMCAwIDAgMS4yMS0uNzcgNC4wNiA0LjA2IDAgMCAwIC43OS0xLjc4IDE0LjMxIDE0LjMxIDAgMCAwIC4zMS0zLjQ1IDEzLjIgMTMuMiAwIDAgMC0uMzEtMy4yOSA0LjQ4IDQuNDggMCAwIDAtLjg1LTEuNzEgMi43IDIuNyAwIDAgMC0xLjQtLjg3IDEwLjgyIDEwLjgyIDAgMCAwLTIuNDctLjE4Wm0yNy43NS02LjM4IDMuMTQtLjM0YTQuNTcgNC41NyAwIDAgMCAxLjE1IDIuNjMgMy4yMyAzLjIzIDAgMCAwIDIuMzQuODQgMy4zIDMuMyAwIDAgMCAyLjM1LS43NSAyLjMyIDIuMzIgMCAwIDAgLjc3LTEuNzUgMS43OSAxLjc5IDAgMCAwLS4zMy0xLjA5IDIuNyAyLjcgMCAwIDAtMS4xNi0uNzljLS4zOC0uMTQtMS4yNC0uNDEtMi41OS0uNzlhOC4yNCA4LjI0IDAgMCAxLTMuNjItMS43OSA1IDUgMCAwIDEtMS40Ny0zLjY0IDUuMSA1LjEgMCAwIDEgLjY5LTIuNTkgNC40OSA0LjQ5IDAgMCAxIDItMS44NCA3LjE5IDcuMTkgMCAwIDEgMy4xNC0uNjMgNi4xOSA2LjE5IDAgMCAxIDQuNTMgMS41IDUuNTUgNS41NSAwIDAgMSAxLjYgNGwtMy4yMy4xNmEzLjIgMy4yIDAgMCAwLS44OS0yIDIuOTQgMi45NCAwIDAgMC0yLS42MSAzLjM5IDMuMzkgMCAwIDAtMi4yLjY1IDEuMzcgMS4zNyAwIDAgMC0uNTIgMS4xMyAxLjQ3IDEuNDcgMCAwIDAgLjQ4IDEuMSA3LjkxIDcuOTEgMCAwIDAgMyAxLjIxIDE0LjMyIDE0LjMyIDAgMCAxIDMuNDggMS4zIDQuNzQgNC43NCAwIDAgMSAxLjc3IDEuODQgNS45NCA1Ljk0IDAgMCAxIC42NCAyLjg5IDUuODYgNS44NiAwIDAgMS0uNzYgMi45MiA0LjggNC44IDAgMCAxLTIuMTYgMiA4LjEyIDguMTIgMCAwIDEtMy40OC42NiA2LjM5IDYuMzkgMCAwIDEtNC42Ni0xLjU5IDcuMzEgNy4zMSAwIDAgMS0yLjAxLTQuNjNabS41IDg3LjQ3di0xOC40Nmg1LjkxYTcuODggNy44OCAwIDAgMSAzLjI0LjQ5IDMuNjUgMy42NSAwIDAgMSAxLjYxIDEuNzcgNi42MiA2LjYyIDAgMCAxIC42MSAyLjkxIDYgNiAwIDAgMS0uOTIgMy40MyA0IDQgMCAwIDEtMi43NSAxLjcxQTcuMDYgNy4wNiAwIDAgMSA3OCAxMTguNGEyMS4wNyAyMS4wNyAwIDAgMSAxLjYgM2wxLjcgMy42aC0zLjQxbC0yLTRhMjUuOTQgMjUuOTQgMCAwIDAtMS40OC0yLjcxIDIuMTQgMi4xNCAwIDAgMC0uODQtLjc3IDMuNTMgMy41MyAwIDAgMC0xLjQxLS4yMWgtLjU3VjEyNVptMi44MS0xMC42NmgyLjA3YTguMzUgOC4zNSAwIDAgMCAyLjUzLS4yMiAxLjY0IDEuNjQgMCAwIDAgLjc4LS43OCAzIDMgMCAwIDAgLjI5LTEuMzkgMi42OSAyLjY5IDAgMCAwLS4zOC0xLjUgMS42MSAxLjYxIDAgMCAwLTEtLjczIDE4Ljc0IDE4Ljc0IDAgMCAwLTItLjA2aC0yLjI5WlxcXCIvPlxccjxwYXRoIGZpbGw9XFxcIm5vbmVcXFwiIHN0cm9rZT1cXFwiY3VycmVudENvbG9yXFxcIiBzdHJva2Utd2lkdGg9XFxcIjRcXFwiIGQ9XFxcIk03NS4yOCAwdjEyLjVNNzQuNzIgMTUwdi0xMi41XFxcIi8+XFxyPHBhdGggZmlsbD1cXFwibm9uZVxcXCIgc3Ryb2tlPVxcXCJjdXJyZW50Q29sb3JcXFwiIHN0cm9rZS1taXRlcmxpbWl0PVxcXCIxMFxcXCIgc3Ryb2tlLXdpZHRoPVxcXCI0XFxcIiBkPVxcXCJNMjUgODcuNSA1MCAxMDBsLTI1IDEyLjV2LTI1elxcXCIvPjwvZz5cIn0sXCJkYWNcIjp7XCJ0eXBlXCI6XCJkYWNcIixcIm5hbWVcIjpcIkRBQ1wiLFwiY2F0ZWdvcnlcIjpcImljXCIsXCJzdmdcIjpcInN5bWJvbC5zdmdcIixcIndpZHRoXCI6NjAsXCJoZWlnaHRcIjo2MCxcInBpbnNcIjp7XCJJTlwiOntcInhcIjowLFwieVwiOjMwLFwiZGlyXCI6XCJsZWZ0XCIsXCJpb1wiOlwiaW5cIn0sXCJPVVRcIjp7XCJ4XCI6NjAsXCJ5XCI6MzAsXCJkaXJcIjpcInJpZ2h0XCIsXCJpb1wiOlwib3V0XCJ9fSxcImFsaWFzZXNcIjp7XCIxXCI6XCJJTlwiLFwiMlwiOlwiT1VUXCIsXCJkaW5cIjpcIklOXCIsXCJhb3V0XCI6XCJPVVRcIn0sXCJib2R5XCI6e1wieFwiOjEwLFwieVwiOjE1LFwid1wiOjQwLFwiaFwiOjMwfSxcInByZWZpeFwiOlwiVVwiLFwibGFiZWxzXCI6XCJ0b3BcIixcInR5cGVBbGlhc2VzXCI6W1wiZGlnaXRhbF90b19hbmFsb2dcIl0sXCJvcmlnaW5cIjp7XCJsaWJyYXJ5XCI6XCJjaHJpcy1waWt1bC9lbGVjdHJvbmljLXN5bWJvbHNcIixcInVybFwiOlwiaHR0cHM6Ly9naXRodWIuY29tL2NocmlzLXBpa3VsL2VsZWN0cm9uaWMtc3ltYm9sc1wiLFwibGljZW5zZVwiOlwiTUlUXCIsXCJjb3B5cmlnaHRcIjpcIkNvcHlyaWdodCAoYykgMjAyMiBDaHJpcyBQaWt1bFwiLFwiZmlsZVwiOlwiU1ZHL01pc2NlbGxhbmVvdXMtQ09NLURBQy5zdmdcIixcIm1vZGlmaWVkX25vdGVcIjpcInNjYWxlZCAwLjQsIHN0cm9rZSBub3JtYWxpemVkIHRvIGN1cnJlbnRDb2xvclwifSxcInN2Z0JvZHlcIjpcIjxnIHRyYW5zZm9ybT1cXFwic2NhbGUoMC40KSB0cmFuc2xhdGUoMCAwKVxcXCI+PHBhdGggZmlsbD1cXFwibm9uZVxcXCIgc3Ryb2tlPVxcXCJjdXJyZW50Q29sb3JcXFwiIHN0cm9rZS1taXRlcmxpbWl0PVxcXCIxMFxcXCIgc3Ryb2tlLXdpZHRoPVxcXCI0XFxcIiBkPVxcXCJtMTI1IDc1LjA2LTM3LjUtMzcuNUgyNXY3NWg2Mi41bDM3LjUtMzcuNXpNMCA3NC42OWgyNW0xMDAgLjM3aDI1XFxcIi8+PC9nPlwifSxcImRjX3NvdXJjZVwiOntcInR5cGVcIjpcImRjX3NvdXJjZVwiLFwibmFtZVwiOlwiREMgdm9sdGFnZSBzb3VyY2VcIixcImNhdGVnb3J5XCI6XCJhbmFsb2dcIixcInN2Z1wiOlwic3ltYm9sLnN2Z1wiLFwid2lkdGhcIjo2MCxcImhlaWdodFwiOjYwLFwicGluc1wiOntcInBvc2l0aXZlXCI6e1wieFwiOjMwLFwieVwiOjAsXCJkaXJcIjpcInVwXCJ9LFwibmVnYXRpdmVcIjp7XCJ4XCI6MzAsXCJ5XCI6NjAsXCJkaXJcIjpcImRvd25cIn19LFwiYWxpYXNlc1wiOntcIjFcIjpcInBvc2l0aXZlXCIsXCIyXCI6XCJuZWdhdGl2ZVwiLFwiK1wiOlwicG9zaXRpdmVcIixcIi1cIjpcIm5lZ2F0aXZlXCIsXCJwXCI6XCJwb3NpdGl2ZVwiLFwiblwiOlwibmVnYXRpdmVcIixcInZjY1wiOlwicG9zaXRpdmVcIixcImduZFwiOlwibmVnYXRpdmVcIn0sXCJib2R5XCI6e1wieFwiOjEwLFwieVwiOjEwLFwid1wiOjQwLFwiaFwiOjQwfSxcInByZWZpeFwiOlwiVlwiLFwicmVxdWlyZWRcIjpbXCJwb3NpdGl2ZVwiLFwibmVnYXRpdmVcIl0sXCJzb3VyY2VcIjp0cnVlLFwidHlwZUFsaWFzZXNcIjpbXCJkY19zdXBwbHlcIixcInZvbHRhZ2Vfc291cmNlXCIsXCJ2c291cmNlXCIsXCJkY1wiXSxcIm9yaWdpblwiOntcImxpYnJhcnlcIjpcImNocmlzLXBpa3VsL2VsZWN0cm9uaWMtc3ltYm9sc1wiLFwidXJsXCI6XCJodHRwczovL2dpdGh1Yi5jb20vY2hyaXMtcGlrdWwvZWxlY3Ryb25pYy1zeW1ib2xzXCIsXCJsaWNlbnNlXCI6XCJNSVRcIixcImNvcHlyaWdodFwiOlwiQ29weXJpZ2h0IChjKSAyMDIyIENocmlzIFBpa3VsXCIsXCJmaWxlXCI6XCJTVkcvU291cmNlLUNPTS1EQy5zdmdcIixcIm1vZGlmaWVkXCI6XCJyZWRyYXduIHZlcnRpY2FsbHkgKHBvc2l0aXZlIHVwKSBmcm9tIHRoZSB1cHN0cmVhbSBnZW9tZXRyeVwiLFwibW9kaWZpZWRfbm90ZVwiOlwic2NhbGVkIDAuNCwgc3Ryb2tlIG5vcm1hbGl6ZWQgdG8gY3VycmVudENvbG9yXCJ9LFwic3ZnQm9keVwiOlwiPGcgdHJhbnNmb3JtPVxcXCJzY2FsZSgwLjQpIHRyYW5zbGF0ZSgwIDApXFxcIj48ZyBmaWxsPVxcXCJub25lXFxcIiBzdHJva2U9XFxcImN1cnJlbnRDb2xvclxcXCIgc3Ryb2tlLW1pdGVybGltaXQ9XFxcIjEwXFxcIiBzdHJva2Utd2lkdGg9XFxcIjRcXFwiPjxjaXJjbGUgY3g9XFxcIjc1XFxcIiBjeT1cXFwiNzVcXFwiIHI9XFxcIjUwXFxcIi8+PHBhdGggZD1cXFwiTTc1IDI1VjBtMCAxMjV2MjVNNjIuNSA1MGgyNU03NSAzNy41djI1TTYyLjUgMTAwaDI1XFxcIi8+PC9nPjwvZz5cIn0sXCJkZWNvZGVyXCI6e1widHlwZVwiOlwiZGVjb2RlclwiLFwibmFtZVwiOlwiRGVjb2RlclwiLFwiY2F0ZWdvcnlcIjpcImRpZ2l0YWxcIixcImtpbmRcIjpcImJveFwiLFwibGFiZWxcIjpcIkRFQ1wiLFwicGluc1wiOntcImxlZnRcIjpbXCJBMFwiLFwiQTFcIixcIkVOXCJdLFwicmlnaHRcIjpbXCJZMFwiLFwiWTFcIixcIlkyXCIsXCJZM1wiXX0sXCJwcmVmaXhcIjpcIlVcIixcIm9yaWdpblwiOntcImxpYnJhcnlcIjpcIkNpcmN1aXRGb3JnZVwiLFwibGljZW5zZVwiOlwic2FtZSBhcyB0aGUgQ2lyY3VpdEZvcmdlIHByb2plY3RcIixcIm5vdGVcIjpcIm9yaWdpbmFsIENpcmN1aXRGb3JnZSBzeW1ib2xcIn19LFwiZGVtdXhcIjp7XCJ0eXBlXCI6XCJkZW11eFwiLFwibmFtZVwiOlwiRGVtdWx0aXBsZXhlclwiLFwiY2F0ZWdvcnlcIjpcImRpZ2l0YWxcIixcImtpbmRcIjpcImJveFwiLFwibGFiZWxcIjpcIkRFTVVYXCIsXCJwaW5zXCI6e1wibGVmdFwiOltcIkRcIl0sXCJyaWdodFwiOltcIlkwXCIsXCJZMVwiLFwiWTJcIixcIlkzXCJdLFwiYm90dG9tXCI6W1wiUzBcIixcIlMxXCJdfSxcInByZWZpeFwiOlwiVVwiLFwidHlwZUFsaWFzZXNcIjpbXCJkZW11bHRpcGxleGVyXCJdLFwib3JpZ2luXCI6e1wibGlicmFyeVwiOlwiQ2lyY3VpdEZvcmdlXCIsXCJsaWNlbnNlXCI6XCJzYW1lIGFzIHRoZSBDaXJjdWl0Rm9yZ2UgcHJvamVjdFwiLFwibm90ZVwiOlwib3JpZ2luYWwgQ2lyY3VpdEZvcmdlIHN5bWJvbFwifX0sXCJkaW9kZVwiOntcInR5cGVcIjpcImRpb2RlXCIsXCJuYW1lXCI6XCJEaW9kZVwiLFwiY2F0ZWdvcnlcIjpcInNlbWljb25kdWN0b3JcIixcInN2Z1wiOlwic3ltYm9sLnN2Z1wiLFwid2lkdGhcIjo2MCxcImhlaWdodFwiOjYwLFwicGluc1wiOntcImFub2RlXCI6e1wieFwiOjAsXCJ5XCI6MzAsXCJkaXJcIjpcImxlZnRcIixcImlvXCI6XCJpblwifSxcImNhdGhvZGVcIjp7XCJ4XCI6NjAsXCJ5XCI6MzAsXCJkaXJcIjpcInJpZ2h0XCIsXCJpb1wiOlwib3V0XCJ9fSxcImFsaWFzZXNcIjp7XCIxXCI6XCJhbm9kZVwiLFwiMlwiOlwiY2F0aG9kZVwiLFwiYVwiOlwiYW5vZGVcIixcImtcIjpcImNhdGhvZGVcIixcIitcIjpcImFub2RlXCIsXCItXCI6XCJjYXRob2RlXCJ9LFwiYm9keVwiOntcInhcIjoyMCxcInlcIjoxNixcIndcIjoyMCxcImhcIjoyOH0sXCJwcmVmaXhcIjpcIkRcIixcInR5cGVBbGlhc2VzXCI6W1wiZFwiXSxcIm9yaWdpblwiOntcImxpYnJhcnlcIjpcImNocmlzLXBpa3VsL2VsZWN0cm9uaWMtc3ltYm9sc1wiLFwidXJsXCI6XCJodHRwczovL2dpdGh1Yi5jb20vY2hyaXMtcGlrdWwvZWxlY3Ryb25pYy1zeW1ib2xzXCIsXCJsaWNlbnNlXCI6XCJNSVRcIixcImNvcHlyaWdodFwiOlwiQ29weXJpZ2h0IChjKSAyMDIyIENocmlzIFBpa3VsXCIsXCJmaWxlXCI6XCJTVkcvRGlvZGUtQ09NLVN0YW5kYXJkLnN2Z1wiLFwibW9kaWZpZWRfbm90ZVwiOlwic2NhbGVkIDAuNCwgc3Ryb2tlIG5vcm1hbGl6ZWQgdG8gY3VycmVudENvbG9yXCJ9LFwic3ZnQm9keVwiOlwiPGcgdHJhbnNmb3JtPVxcXCJzY2FsZSgwLjQpIHRyYW5zbGF0ZSgwIDApXFxcIj48cGF0aCBmaWxsPVxcXCJub25lXFxcIiBzdHJva2U9XFxcImN1cnJlbnRDb2xvclxcXCIgc3Ryb2tlLW1pdGVybGltaXQ9XFxcIjEwXFxcIiBzdHJva2Utd2lkdGg9XFxcIjRcXFwiIGQ9XFxcIm0xMDAgNzUtNTAgMzEuMjV2LTYyLjVMMTAwIDc1em0wLTM0LjI1djY4LjVNNTAgNzVIMG0xMDAgMGg1MFxcXCIvPjwvZz5cIn0sXCJlbmNvZGVyXCI6e1widHlwZVwiOlwiZW5jb2RlclwiLFwibmFtZVwiOlwiRW5jb2RlclwiLFwiY2F0ZWdvcnlcIjpcImRpZ2l0YWxcIixcImtpbmRcIjpcImJveFwiLFwibGFiZWxcIjpcIkVOQ1wiLFwicGluc1wiOntcImxlZnRcIjpbXCJJMFwiLFwiSTFcIixcIkkyXCIsXCJJM1wiXSxcInJpZ2h0XCI6W1wiWTBcIixcIlkxXCJdfSxcInByZWZpeFwiOlwiVVwiLFwidHlwZUFsaWFzZXNcIjpbXCJwcmlvcml0eV9lbmNvZGVyXCJdLFwib3JpZ2luXCI6e1wibGlicmFyeVwiOlwiQ2lyY3VpdEZvcmdlXCIsXCJsaWNlbnNlXCI6XCJzYW1lIGFzIHRoZSBDaXJjdWl0Rm9yZ2UgcHJvamVjdFwiLFwibm90ZVwiOlwib3JpZ2luYWwgQ2lyY3VpdEZvcmdlIHN5bWJvbFwifX0sXCJmdXNlXCI6e1widHlwZVwiOlwiZnVzZVwiLFwibmFtZVwiOlwiRnVzZVwiLFwiY2F0ZWdvcnlcIjpcInBhc3NpdmVcIixcInN2Z1wiOlwic3ltYm9sLnN2Z1wiLFwid2lkdGhcIjo2MCxcImhlaWdodFwiOjYwLFwicGluc1wiOntcIjFcIjp7XCJ4XCI6MCxcInlcIjozMCxcImRpclwiOlwibGVmdFwifSxcIjJcIjp7XCJ4XCI6NjAsXCJ5XCI6MzAsXCJkaXJcIjpcInJpZ2h0XCJ9fSxcImJvZHlcIjp7XCJ4XCI6MTAsXCJ5XCI6MjAsXCJ3XCI6NDAsXCJoXCI6MjB9LFwicHJlZml4XCI6XCJGXCIsXCJvcmlnaW5cIjp7XCJsaWJyYXJ5XCI6XCJjaHJpcy1waWt1bC9lbGVjdHJvbmljLXN5bWJvbHNcIixcInVybFwiOlwiaHR0cHM6Ly9naXRodWIuY29tL2NocmlzLXBpa3VsL2VsZWN0cm9uaWMtc3ltYm9sc1wiLFwibGljZW5zZVwiOlwiTUlUXCIsXCJjb3B5cmlnaHRcIjpcIkNvcHlyaWdodCAoYykgMjAyMiBDaHJpcyBQaWt1bFwiLFwiZmlsZVwiOlwiU1ZHL0Z1c2UtSUVFRS5zdmdcIixcIm1vZGlmaWVkX25vdGVcIjpcInNjYWxlZCAwLjQsIHN0cm9rZSBub3JtYWxpemVkIHRvIGN1cnJlbnRDb2xvclwifSxcInN2Z0JvZHlcIjpcIjxnIHRyYW5zZm9ybT1cXFwic2NhbGUoMC40KSB0cmFuc2xhdGUoMCAwKVxcXCI+PHBhdGggZmlsbD1cXFwibm9uZVxcXCIgc3Ryb2tlPVxcXCJjdXJyZW50Q29sb3JcXFwiIHN0cm9rZS1taXRlcmxpbWl0PVxcXCIxMFxcXCIgc3Ryb2tlLXdpZHRoPVxcXCI0XFxcIiBkPVxcXCJNMCA3NC44OGgxNTBNMjUgNTBoMTAwdjUwSDI1elxcXCIvPjwvZz5cIn0sXCJnZW5lcmljX2ljXCI6e1widHlwZVwiOlwiZ2VuZXJpY19pY1wiLFwibmFtZVwiOlwiR2VuZXJpYyBJQ1wiLFwiY2F0ZWdvcnlcIjpcImljXCIsXCJraW5kXCI6XCJib3hcIixcImxhYmVsXCI6XCJJQ1wiLFwicGluc1wiOntcImxlZnRcIjpbXCIxXCIsXCIyXCIsXCIzXCIsXCI0XCJdLFwicmlnaHRcIjpbXCI4XCIsXCI3XCIsXCI2XCIsXCI1XCJdfSxcInByZWZpeFwiOlwiVVwiLFwidHlwZUFsaWFzZXNcIjpbXCJpY1wiLFwiY2hpcFwiXSxcIm9yaWdpblwiOntcImxpYnJhcnlcIjpcIkNpcmN1aXRGb3JnZVwiLFwibGljZW5zZVwiOlwic2FtZSBhcyB0aGUgQ2lyY3VpdEZvcmdlIHByb2plY3RcIixcIm5vdGVcIjpcIm9yaWdpbmFsIENpcmN1aXRGb3JnZSBzeW1ib2xcIn19LFwiZ3JvdW5kXCI6e1widHlwZVwiOlwiZ3JvdW5kXCIsXCJuYW1lXCI6XCJHcm91bmRcIixcImNhdGVnb3J5XCI6XCJwb3dlclwiLFwic3ZnXCI6XCJzeW1ib2wuc3ZnXCIsXCJ3aWR0aFwiOjYwLFwiaGVpZ2h0XCI6NjAsXCJwaW5zXCI6e1wiMVwiOntcInhcIjozMCxcInlcIjowLFwiZGlyXCI6XCJ1cFwifX0sXCJhbGlhc2VzXCI6e1wiZ25kXCI6XCIxXCJ9LFwiYm9keVwiOntcInhcIjoxMCxcInlcIjoyOCxcIndcIjo0MCxcImhcIjoyMy4yfSxcInJhaWxcIjpcImdyb3VuZFwiLFwidHlwZUFsaWFzZXNcIjpbXCJnbmRcIixcImVhcnRoXCJdLFwib3JpZ2luXCI6e1wibGlicmFyeVwiOlwiY2hyaXMtcGlrdWwvZWxlY3Ryb25pYy1zeW1ib2xzXCIsXCJ1cmxcIjpcImh0dHBzOi8vZ2l0aHViLmNvbS9jaHJpcy1waWt1bC9lbGVjdHJvbmljLXN5bWJvbHNcIixcImxpY2Vuc2VcIjpcIk1JVFwiLFwiY29weXJpZ2h0XCI6XCJDb3B5cmlnaHQgKGMpIDIwMjIgQ2hyaXMgUGlrdWxcIixcImZpbGVcIjpcIlNWRy9Hcm91bmQtQ09NLUdlbmVyYWwuc3ZnXCIsXCJtb2RpZmllZF9ub3RlXCI6XCJzY2FsZWQgMC40LCBzdHJva2Ugbm9ybWFsaXplZCB0byBjdXJyZW50Q29sb3JcIn0sXCJzdmdCb2R5XCI6XCI8ZyB0cmFuc2Zvcm09XFxcInNjYWxlKDAuNCkgdHJhbnNsYXRlKDAgMClcXFwiPjxwYXRoIGZpbGw9XFxcIm5vbmVcXFwiIHN0cm9rZT1cXFwiY3VycmVudENvbG9yXFxcIiBzdHJva2UtbWl0ZXJsaW1pdD1cXFwiMTBcXFwiIHN0cm9rZS13aWR0aD1cXFwiNFxcXCIgZD1cXFwiTTc1IDB2NzVtLTUwIDBoMTAwbS01Ni4yNSA1MGgxMi41TTUwIDEwMGg1MFxcXCIvPjwvZz5cIn0sXCJpbmR1Y3RvclwiOntcInR5cGVcIjpcImluZHVjdG9yXCIsXCJuYW1lXCI6XCJJbmR1Y3RvclwiLFwiY2F0ZWdvcnlcIjpcInBhc3NpdmVcIixcInN2Z1wiOlwic3ltYm9sLnN2Z1wiLFwid2lkdGhcIjo2MCxcImhlaWdodFwiOjYwLFwicGluc1wiOntcIjFcIjp7XCJ4XCI6MCxcInlcIjozMCxcImRpclwiOlwibGVmdFwifSxcIjJcIjp7XCJ4XCI6NjAsXCJ5XCI6MzAsXCJkaXJcIjpcInJpZ2h0XCJ9fSxcImJvZHlcIjp7XCJ4XCI6NC44LFwieVwiOjIxLjYsXCJ3XCI6NTAuNCxcImhcIjo5LjZ9LFwicHJlZml4XCI6XCJMXCIsXCJ0eXBlQWxpYXNlc1wiOltcImNvaWxcIixcImxcIl0sXCJvcmlnaW5cIjp7XCJsaWJyYXJ5XCI6XCJjaHJpcy1waWt1bC9lbGVjdHJvbmljLXN5bWJvbHNcIixcInVybFwiOlwiaHR0cHM6Ly9naXRodWIuY29tL2NocmlzLXBpa3VsL2VsZWN0cm9uaWMtc3ltYm9sc1wiLFwibGljZW5zZVwiOlwiTUlUXCIsXCJjb3B5cmlnaHRcIjpcIkNvcHlyaWdodCAoYykgMjAyMiBDaHJpcyBQaWt1bFwiLFwiZmlsZVwiOlwiU1ZHL0luZHVjdG9yLUNPTS1BaXIuc3ZnXCIsXCJtb2RpZmllZF9ub3RlXCI6XCJzY2FsZWQgMC40LCBzdHJva2Ugbm9ybWFsaXplZCB0byBjdXJyZW50Q29sb3JcIn0sXCJzdmdCb2R5XCI6XCI8ZyB0cmFuc2Zvcm09XFxcInNjYWxlKDAuNCkgdHJhbnNsYXRlKDAgMClcXFwiPjxwYXRoIGZpbGw9XFxcIm5vbmVcXFwiIHN0cm9rZT1cXFwiY3VycmVudENvbG9yXFxcIiBzdHJva2UtbGluZWpvaW49XFxcInJvdW5kXFxcIiBzdHJva2Utd2lkdGg9XFxcIjRcXFwiIGQ9XFxcIk0wIDc1LjEzaDEyLjVzMC0xOC44MiAxNS42My0xOC44MlM0My43NSA3NSA0My43NSA3NXMwLTE4Ljc1IDE1LjYzLTE4Ljc1Uzc1IDc1IDc1IDc1czAtMTguNzUgMTUuNjMtMTguNzVTMTA2LjI1IDc1IDEwNi4yNSA3NXMwLTE4Ljc1IDE1LjYzLTE4Ljc1UzEzNy41IDc1IDEzNy41IDc1SDE1MFxcXCIvPjwvZz5cIn0sXCJpbnB1dFwiOntcInR5cGVcIjpcImlucHV0XCIsXCJuYW1lXCI6XCJJbnB1dCB0ZXJtaW5hbFwiLFwiY2F0ZWdvcnlcIjpcInBvd2VyXCIsXCJ3aWR0aFwiOjQwLFwiaGVpZ2h0XCI6MjAsXCJwaW5zXCI6e1wiMVwiOntcInhcIjo0MCxcInlcIjoxMCxcImRpclwiOlwicmlnaHRcIixcImlvXCI6XCJvdXRcIn19LFwiYm9keVwiOntcInhcIjowLFwieVwiOjQsXCJ3XCI6MTIsXCJoXCI6MTJ9LFwidGVybWluYWxcIjpcImlucHV0XCIsXCJsYWJlbHNcIjpcIm5vbmVcIixcInRleHRcIjp7XCJ4XCI6LTQsXCJ5XCI6MTQsXCJhbmNob3JcIjpcImVuZFwiLFwiZGVmYXVsdFwiOlwiJGlkXCJ9LFwicHJlZml4XCI6XCJJTlwiLFwidHlwZUFsaWFzZXNcIjpbXCJpbnB1dF90ZXJtaW5hbFwiLFwiaW5cIixcInBvcnRfaW5cIl0sXCJzdmdcIjpcInN5bWJvbC5zdmdcIixcIm9yaWdpblwiOntcImxpYnJhcnlcIjpcIkNpcmN1aXRGb3JnZVwiLFwibGljZW5zZVwiOlwic2FtZSBhcyB0aGUgQ2lyY3VpdEZvcmdlIHByb2plY3RcIixcIm5vdGVcIjpcIm9yaWdpbmFsIENpcmN1aXRGb3JnZSBzeW1ib2xcIn0sXCJzdmdCb2R5XCI6XCI8ZyBmaWxsPVxcXCJub25lXFxcIiBzdHJva2U9XFxcImN1cnJlbnRDb2xvclxcXCIgc3Ryb2tlLXdpZHRoPVxcXCIxLjZcXFwiIHN0cm9rZS1saW5lY2FwPVxcXCJyb3VuZFxcXCI+PGNpcmNsZSBjeD1cXFwiNlxcXCIgY3k9XFxcIjEwXFxcIiByPVxcXCI0XFxcIi8+PHBhdGggZD1cXFwiTTEwIDEwaDMwXFxcIi8+PC9nPlwifSxcImpmZXRcIjp7XCJ0eXBlXCI6XCJqZmV0XCIsXCJuYW1lXCI6XCJOLWNoYW5uZWwgSkZFVFwiLFwiY2F0ZWdvcnlcIjpcInNlbWljb25kdWN0b3JcIixcInN2Z1wiOlwic3ltYm9sLnN2Z1wiLFwid2lkdGhcIjo2MCxcImhlaWdodFwiOjYwLFwicGluc1wiOntcIkdcIjp7XCJ4XCI6MCxcInlcIjozMCxcImRpclwiOlwibGVmdFwiLFwiaW9cIjpcImluXCJ9LFwiRFwiOntcInhcIjo0MCxcInlcIjowLFwiZGlyXCI6XCJ1cFwifSxcIlNcIjp7XCJ4XCI6NDAsXCJ5XCI6NjAsXCJkaXJcIjpcImRvd25cIn19LFwiYWxpYXNlc1wiOntcImdhdGVcIjpcIkdcIixcImRyYWluXCI6XCJEXCIsXCJzb3VyY2VcIjpcIlNcIn0sXCJib2R5XCI6e1wieFwiOjEwLFwieVwiOjEwLFwid1wiOjQwLFwiaFwiOjQwfSxcInByZWZpeFwiOlwiUVwiLFwibGFiZWxzXCI6XCJyaWdodFwiLFwicmVxdWlyZWRcIjpbXCJHXCIsXCJEXCIsXCJTXCJdLFwidHlwZUFsaWFzZXNcIjpbXCJqZmV0X25cIixcIm5qZmV0XCJdLFwib3JpZ2luXCI6e1wibGlicmFyeVwiOlwiY2hyaXMtcGlrdWwvZWxlY3Ryb25pYy1zeW1ib2xzXCIsXCJ1cmxcIjpcImh0dHBzOi8vZ2l0aHViLmNvbS9jaHJpcy1waWt1bC9lbGVjdHJvbmljLXN5bWJvbHNcIixcImxpY2Vuc2VcIjpcIk1JVFwiLFwiY29weXJpZ2h0XCI6XCJDb3B5cmlnaHQgKGMpIDIwMjIgQ2hyaXMgUGlrdWxcIixcImZpbGVcIjpcIlNWRy9UcmFuc2lzdG9yLUNPTS1KRkVULU4uc3ZnXCIsXCJtb2RpZmllZF9ub3RlXCI6XCJzY2FsZWQgMC40LCBzdHJva2Ugbm9ybWFsaXplZCB0byBjdXJyZW50Q29sb3JcIn0sXCJzdmdCb2R5XCI6XCI8ZyB0cmFuc2Zvcm09XFxcInNjYWxlKDAuNCkgdHJhbnNsYXRlKDAgMClcXFwiPjxjaXJjbGUgY3g9XFxcIjc1XFxcIiBjeT1cXFwiNzVcXFwiIHI9XFxcIjUwXFxcIiBmaWxsPVxcXCJub25lXFxcIiBzdHJva2U9XFxcImN1cnJlbnRDb2xvclxcXCIgc3Ryb2tlLW1pdGVybGltaXQ9XFxcIjEwXFxcIiBzdHJva2Utd2lkdGg9XFxcIjRcXFwiLz5cXHI8cGF0aCBmaWxsPVxcXCJub25lXFxcIiBzdHJva2U9XFxcImN1cnJlbnRDb2xvclxcXCIgc3Ryb2tlLW1pdGVybGltaXQ9XFxcIjEwXFxcIiBzdHJva2Utd2lkdGg9XFxcIjRcXFwiIGQ9XFxcIk0wIDc1aDU2LjI1bTAtMzEuMjV2NjIuNVxcXCIvPlxccjxwYXRoIGZpbGw9XFxcImN1cnJlbnRDb2xvclxcXCIgZD1cXFwiTTU2LjI1IDc1IDM3LjUgODcuNXYtMjVMNTYuMjUgNzV6XFxcIi8+XFxyPHBhdGggZmlsbD1cXFwibm9uZVxcXCIgc3Ryb2tlPVxcXCJjdXJyZW50Q29sb3JcXFwiIHN0cm9rZS1taXRlcmxpbWl0PVxcXCIxMFxcXCIgc3Ryb2tlLXdpZHRoPVxcXCI0XFxcIiBkPVxcXCJNOTkuNjYgMHY1Ni4yNUg1Ni4yNU05OS42NiAxNTBWOTMuNzVINTYuMjVcXFwiLz48L2c+XCJ9LFwiamZldF9wXCI6e1widHlwZVwiOlwiamZldF9wXCIsXCJuYW1lXCI6XCJQLWNoYW5uZWwgSkZFVFwiLFwiY2F0ZWdvcnlcIjpcInNlbWljb25kdWN0b3JcIixcInN2Z1wiOlwic3ltYm9sLnN2Z1wiLFwid2lkdGhcIjo2MCxcImhlaWdodFwiOjYwLFwicGluc1wiOntcIkdcIjp7XCJ4XCI6MCxcInlcIjozMCxcImRpclwiOlwibGVmdFwiLFwiaW9cIjpcImluXCJ9LFwiU1wiOntcInhcIjo0MCxcInlcIjowLFwiZGlyXCI6XCJ1cFwifSxcIkRcIjp7XCJ4XCI6NDAsXCJ5XCI6NjAsXCJkaXJcIjpcImRvd25cIn19LFwiYWxpYXNlc1wiOntcImdhdGVcIjpcIkdcIixcImRyYWluXCI6XCJEXCIsXCJzb3VyY2VcIjpcIlNcIn0sXCJib2R5XCI6e1wieFwiOjEwLFwieVwiOjEwLFwid1wiOjQwLFwiaFwiOjQwfSxcInByZWZpeFwiOlwiUVwiLFwibGFiZWxzXCI6XCJyaWdodFwiLFwicmVxdWlyZWRcIjpbXCJHXCIsXCJEXCIsXCJTXCJdLFwidHlwZUFsaWFzZXNcIjpbXCJwamZldFwiXSxcIm9yaWdpblwiOntcImxpYnJhcnlcIjpcImNocmlzLXBpa3VsL2VsZWN0cm9uaWMtc3ltYm9sc1wiLFwidXJsXCI6XCJodHRwczovL2dpdGh1Yi5jb20vY2hyaXMtcGlrdWwvZWxlY3Ryb25pYy1zeW1ib2xzXCIsXCJsaWNlbnNlXCI6XCJNSVRcIixcImNvcHlyaWdodFwiOlwiQ29weXJpZ2h0IChjKSAyMDIyIENocmlzIFBpa3VsXCIsXCJmaWxlXCI6XCJTVkcvVHJhbnNpc3Rvci1DT00tSkZFVC1QLnN2Z1wiLFwibW9kaWZpZWRfbm90ZVwiOlwic2NhbGVkIDAuNCwgc3Ryb2tlIG5vcm1hbGl6ZWQgdG8gY3VycmVudENvbG9yXCJ9LFwic3ZnQm9keVwiOlwiPGcgdHJhbnNmb3JtPVxcXCJzY2FsZSgwLjQpIHRyYW5zbGF0ZSgwIDApXFxcIj48Y2lyY2xlIGN4PVxcXCI3NVxcXCIgY3k9XFxcIjc1XFxcIiByPVxcXCI1MFxcXCIgZmlsbD1cXFwibm9uZVxcXCIgc3Ryb2tlPVxcXCJjdXJyZW50Q29sb3JcXFwiIHN0cm9rZS1taXRlcmxpbWl0PVxcXCIxMFxcXCIgc3Ryb2tlLXdpZHRoPVxcXCI0XFxcIi8+XFxyPHBhdGggZmlsbD1cXFwibm9uZVxcXCIgc3Ryb2tlPVxcXCJjdXJyZW50Q29sb3JcXFwiIHN0cm9rZS1taXRlcmxpbWl0PVxcXCIxMFxcXCIgc3Ryb2tlLXdpZHRoPVxcXCI0XFxcIiBkPVxcXCJNMCA3NWg1Ni4yNW0wLTMxLjI1djYyLjVcXFwiLz5cXHI8cGF0aCBmaWxsPVxcXCJjdXJyZW50Q29sb3JcXFwiIGQ9XFxcIk0zMS4yNSA3NSA1MCA2Mi41djI1TDMxLjI1IDc1elxcXCIvPlxccjxwYXRoIGZpbGw9XFxcIm5vbmVcXFwiIHN0cm9rZT1cXFwiY3VycmVudENvbG9yXFxcIiBzdHJva2UtbWl0ZXJsaW1pdD1cXFwiMTBcXFwiIHN0cm9rZS13aWR0aD1cXFwiNFxcXCIgZD1cXFwiTTk5LjY2IDB2NTYuMjVINTYuMjVNOTkuNjYgMTUwVjkzLjc1SDU2LjI1XFxcIi8+PC9nPlwifSxcImprX2ZsaXBmbG9wXCI6e1widHlwZVwiOlwiamtfZmxpcGZsb3BcIixcIm5hbWVcIjpcIkpLIGZsaXAtZmxvcFwiLFwiY2F0ZWdvcnlcIjpcImRpZ2l0YWxcIixcInN2Z1wiOlwic3ltYm9sLnN2Z1wiLFwid2lkdGhcIjo2MCxcImhlaWdodFwiOjYwLFwicGluc1wiOntcIkpcIjp7XCJ4XCI6MCxcInlcIjoyMCxcImRpclwiOlwibGVmdFwiLFwiaW9cIjpcImluXCJ9LFwiQ0xLXCI6e1wieFwiOjAsXCJ5XCI6MzAsXCJkaXJcIjpcImxlZnRcIixcImlvXCI6XCJpblwifSxcIktcIjp7XCJ4XCI6MCxcInlcIjo0MCxcImRpclwiOlwibGVmdFwiLFwiaW9cIjpcImluXCJ9LFwiUVwiOntcInhcIjo2MCxcInlcIjoyMCxcImRpclwiOlwicmlnaHRcIixcImlvXCI6XCJvdXRcIn0sXCJRTlwiOntcInhcIjo2MCxcInlcIjo0MCxcImRpclwiOlwicmlnaHRcIixcImlvXCI6XCJvdXRcIn19LFwiYWxpYXNlc1wiOntcInFcdTAzMDRcIjpcIlFOXCIsXCJxX2JhclwiOlwiUU5cIixcInFiYXJcIjpcIlFOXCIsXCJucVwiOlwiUU5cIixcIn5xXCI6XCJRTlwiLFwiY2xvY2tcIjpcIkNMS1wiLFwiY2xrXCI6XCJDTEtcIn0sXCJib2R5XCI6e1wieFwiOjEwLFwieVwiOjUsXCJ3XCI6NDAsXCJoXCI6NTB9LFwicHJlZml4XCI6XCJVXCIsXCJsYWJlbHNcIjpcInRvcFwiLFwicmVxdWlyZWRcIjpbXCJKXCIsXCJLXCIsXCJDTEtcIl0sXCJ0eXBlQWxpYXNlc1wiOltcImprZmZcIixcImZsaXBmbG9wX2prXCJdLFwib3JpZ2luXCI6e1wibGlicmFyeVwiOlwiY2hyaXMtcGlrdWwvZWxlY3Ryb25pYy1zeW1ib2xzXCIsXCJ1cmxcIjpcImh0dHBzOi8vZ2l0aHViLmNvbS9jaHJpcy1waWt1bC9lbGVjdHJvbmljLXN5bWJvbHNcIixcImxpY2Vuc2VcIjpcIk1JVFwiLFwiY29weXJpZ2h0XCI6XCJDb3B5cmlnaHQgKGMpIDIwMjIgQ2hyaXMgUGlrdWxcIixcImZpbGVcIjpcIlNWRy9JQy1DT00tRmxpcEZsb3AtQ2xvY2tlZEpLLnN2Z1wiLFwibW9kaWZpZWRfbm90ZVwiOlwic2NhbGVkIDAuNCwgc3Ryb2tlIG5vcm1hbGl6ZWQgdG8gY3VycmVudENvbG9yXCJ9LFwic3ZnQm9keVwiOlwiPGcgdHJhbnNmb3JtPVxcXCJzY2FsZSgwLjQpIHRyYW5zbGF0ZSgwIDApXFxcIj48cGF0aCBmaWxsPVxcXCJub25lXFxcIiBzdHJva2U9XFxcImN1cnJlbnRDb2xvclxcXCIgc3Ryb2tlLW1pdGVybGltaXQ9XFxcIjEwXFxcIiBzdHJva2Utd2lkdGg9XFxcIjRcXFwiIGQ9XFxcIk0yNSAxMi41aDEwMHYxMjVIMjV6TTI1IDUwSDBtMjUgNTBIMG0xMjUtNTBoMjVtLTI1IDUwaDI1XFxcIi8+XFxyPHBhdGggZmlsbD1cXFwiY3VycmVudENvbG9yXFxcIiBkPVxcXCJtMTExLjU3IDUzLjkgMiAxLjI5LTEuMzYgMy4xNi0yLTEuNDRhNC43OCA0Ljc4IDAgMCAxLTQgMi4zNCA1LjA4IDUuMDggMCAwIDEtNC40OC0yLjQ2IDEyLjUyIDEyLjUyIDAgMCAxLTEuNzMtNi45MSAxMi41IDEyLjUgMCAwIDEgMS42Mi02Ljg4IDUuMTUgNS4xNSAwIDAgMSA4Ljc5IDAgMTIuNSAxMi41IDAgMCAxIDEuNTkgNi44OGMwIDMuMTgtLjQzIDQuMDItLjQzIDQuMDJabS0yLjM3LTEuMzNhMTMuNTEgMTMuNTEgMCAwIDAgLjI0LTIuNjkgOS4yNSA5LjI1IDAgMCAwLS45NC00LjcgMi43NiAyLjc2IDAgMCAwLTUgMCA5LjIyIDkuMjIgMCAwIDAtMSA0LjY5IDkuNDQgOS40NCAwIDAgMCAxIDQuNzUgMi44NCAyLjg0IDAgMCAwIDIuNDEgMS41OCAyLjQxIDIuNDEgMCAwIDAgMS45LS44NWwtMi0xLjQ0IDEuNTItMi42Nm00LjI0IDUyLjY1IDIgMS4yOS0xLjM2IDMuMTYtMi0xLjQ0YTQuNzggNC43OCAwIDAgMS00IDIuMzQgNS4wOCA1LjA4IDAgMCAxLTQuNDgtMi40NiAxMi41MiAxMi41MiAwIDAgMS0xLjczLTYuOTEgMTIuNSAxMi41IDAgMCAxIDEuNjItNi44OCA1LjE1IDUuMTUgMCAwIDEgOC43OSAwIDEyLjUgMTIuNSAwIDAgMSAxLjU5IDYuODhjMCAzLjE4LS40MyA0LjAyLS40MyA0LjAyWm0tMi4zNy0xLjMzYTEzLjUxIDEzLjUxIDAgMCAwIC4yNC0yLjY5IDkuMjUgOS4yNSAwIDAgMC0uOTQtNC43IDIuNzYgMi43NiAwIDAgMC01IDAgOS4yMiA5LjIyIDAgMCAwLTEgNC42OSA5LjQ0IDkuNDQgMCAwIDAgMSA0Ljc1IDIuODQgMi44NCAwIDAgMCAyLjQxIDEuNTggMi40MSAyLjQxIDAgMCAwIDEuOS0uODVsLTItMS40NCAxLjUyLTIuNjZcXFwiLz5cXHI8cGF0aCBmaWxsPVxcXCJub25lXFxcIiBzdHJva2U9XFxcImN1cnJlbnRDb2xvclxcXCIgc3Ryb2tlLW1pdGVybGltaXQ9XFxcIjEwXFxcIiBzdHJva2Utd2lkdGg9XFxcIjRcXFwiIGQ9XFxcIk05NyA4NC4yNWgxOC43NU0yNSA2Mi41IDUwIDc1IDI1IDg3LjV2LTI1ek0wIDc0LjUzaDI1LjA2XFxcIi8+XFxyPHBhdGggZmlsbD1cXFwiY3VycmVudENvbG9yXFxcIiBkPVxcXCJNNDYuMTMgNDAuNWgzLjkzdjExLjY3YTExLjQgMTEuNCAwIDAgMS0uNDIgMy41MiA1LjEyIDUuMTIgMCAwIDEtMi4wOCAyLjU5IDcuMjMgNy4yMyAwIDAgMS00IDEgNi4xMSA2LjExIDAgMCAxLTQuNDYtMS41M2MtMS0xLTEuNTYtMy43NS0xLjU3LTUuNzJoMy43MmE5LjQ2IDkuNDYgMCAwIDAgLjQ5IDMuMDcgMi4xNiAyLjE2IDAgMCAwIDEuOTUgMSAyLjIxIDIuMjEgMCAwIDAgMS44Ni0uNzEgNS4yOSA1LjI5IDAgMCAwIC41NS0zWk0zNy41NiAxMDlWOTAuNWgyLjh2OC4yTDQ2IDkwLjVoMy43NmwtNS4yMiA3LjE5TDUwLjA2IDEwOWgtMy42MmwtMy44MS04LjY2LTIuMjcgMy4wOFYxMDlaXFxcIi8+PC9nPlwifSxcImp1bmN0aW9uXCI6e1widHlwZVwiOlwianVuY3Rpb25cIixcIm5hbWVcIjpcIkp1bmN0aW9uXCIsXCJjYXRlZ29yeVwiOlwicG93ZXJcIixcImtpbmRcIjpcInZpcnR1YWxcIixcInBpbnNcIjp7XCIxXCI6e1wieFwiOjAsXCJ5XCI6MCxcImRpclwiOlwibGVmdFwifX0sXCJ0eXBlQWxpYXNlc1wiOltcIm5vZGVcIixcImRvdFwiXSxcIm9yaWdpblwiOntcImxpYnJhcnlcIjpcIkNpcmN1aXRGb3JnZVwiLFwibGljZW5zZVwiOlwic2FtZSBhcyB0aGUgQ2lyY3VpdEZvcmdlIHByb2plY3RcIixcIm5vdGVcIjpcIm9yaWdpbmFsIENpcmN1aXRGb3JnZSBzeW1ib2xcIn19LFwibGVkXCI6e1widHlwZVwiOlwibGVkXCIsXCJuYW1lXCI6XCJMRURcIixcImNhdGVnb3J5XCI6XCJzZW1pY29uZHVjdG9yXCIsXCJzdmdcIjpcInN5bWJvbC5zdmdcIixcIndpZHRoXCI6NjAsXCJoZWlnaHRcIjo2MCxcInBpbnNcIjp7XCJhbm9kZVwiOntcInhcIjowLFwieVwiOjMwLFwiZGlyXCI6XCJsZWZ0XCIsXCJpb1wiOlwiaW5cIn0sXCJjYXRob2RlXCI6e1wieFwiOjYwLFwieVwiOjMwLFwiZGlyXCI6XCJyaWdodFwiLFwiaW9cIjpcIm91dFwifX0sXCJhbGlhc2VzXCI6e1wiMVwiOlwiYW5vZGVcIixcIjJcIjpcImNhdGhvZGVcIixcImFcIjpcImFub2RlXCIsXCJrXCI6XCJjYXRob2RlXCIsXCIrXCI6XCJhbm9kZVwiLFwiLVwiOlwiY2F0aG9kZVwifSxcImJvZHlcIjp7XCJ4XCI6MjAsXCJ5XCI6MS42LFwid1wiOjM4LjQsXCJoXCI6NDIuNH0sXCJwcmVmaXhcIjpcIkRcIixcIm9yaWdpblwiOntcImxpYnJhcnlcIjpcImNocmlzLXBpa3VsL2VsZWN0cm9uaWMtc3ltYm9sc1wiLFwidXJsXCI6XCJodHRwczovL2dpdGh1Yi5jb20vY2hyaXMtcGlrdWwvZWxlY3Ryb25pYy1zeW1ib2xzXCIsXCJsaWNlbnNlXCI6XCJNSVRcIixcImNvcHlyaWdodFwiOlwiQ29weXJpZ2h0IChjKSAyMDIyIENocmlzIFBpa3VsXCIsXCJmaWxlXCI6XCJTVkcvRGlvZGUtQ09NLUxFRC5zdmdcIixcIm1vZGlmaWVkX25vdGVcIjpcInNjYWxlZCAwLjQsIHN0cm9rZSBub3JtYWxpemVkIHRvIGN1cnJlbnRDb2xvclwifSxcInN2Z0JvZHlcIjpcIjxnIHRyYW5zZm9ybT1cXFwic2NhbGUoMC40KSB0cmFuc2xhdGUoMCAwKVxcXCI+PHBhdGggZmlsbD1cXFwibm9uZVxcXCIgc3Ryb2tlPVxcXCJjdXJyZW50Q29sb3JcXFwiIHN0cm9rZS1taXRlcmxpbWl0PVxcXCIxMFxcXCIgc3Ryb2tlLXdpZHRoPVxcXCI0XFxcIiBkPVxcXCJtMTAwIDc1LTUwIDMxLjI1di02Mi41TDEwMCA3NXptMC0zNC4yNXY2OC41TTUwIDc1SDBtMTAwIDBoNTBtLTUwLTQzLjc1IDE4Ljc1LTE4Ljc1XFxcIi8+XFxyPHBhdGggZmlsbD1cXFwiY3VycmVudENvbG9yXFxcIiBkPVxcXCJtMTIyLjQ5IDE5LjM0IDMuODctMTQuNDUtMTQuNDUgMy44NyAxMC41OCAxMC41OHpcXFwiLz5cXHI8cGF0aCBmaWxsPVxcXCJub25lXFxcIiBzdHJva2U9XFxcImN1cnJlbnRDb2xvclxcXCIgc3Ryb2tlLW1pdGVybGltaXQ9XFxcIjEwXFxcIiBzdHJva2Utd2lkdGg9XFxcIjRcXFwiIGQ9XFxcIm0xMTguNzUgNTAgMTguNzUtMTguNzVcXFwiLz5cXHI8cGF0aCBmaWxsPVxcXCJjdXJyZW50Q29sb3JcXFwiIGQ9XFxcIm0xNDEuMjQgMzguMDkgMy44Ny0xNC40NS0xNC40NSAzLjg3IDEwLjU4IDEwLjU4elxcXCIvPjwvZz5cIn0sXCJtZW1vcnlcIjp7XCJ0eXBlXCI6XCJtZW1vcnlcIixcIm5hbWVcIjpcIkdlbmVyaWMgbWVtb3J5XCIsXCJjYXRlZ29yeVwiOlwiaWNcIixcImtpbmRcIjpcImJveFwiLFwibGFiZWxcIjpcIk1FTVwiLFwicGluc1wiOntcImxlZnRcIjpbXCJBMFwiLFwiQTFcIixcIkEyXCIsXCJBM1wiLFwiQTRcIixcIkE1XCIsXCJBNlwiLFwiQTdcIixcIn5DU1wiLFwifk9FXCIsXCJ+V0VcIl0sXCJyaWdodFwiOltcIkQwXCIsXCJEMVwiLFwiRDJcIixcIkQzXCIsXCJENFwiLFwiRDVcIixcIkQ2XCIsXCJEN1wiXSxcInRvcFwiOltcIlZDQ1wiXSxcImJvdHRvbVwiOltcIkdORFwiXX0sXCJwcmVmaXhcIjpcIlVcIixcInR5cGVBbGlhc2VzXCI6W1wicmFtXCIsXCJyb21cIixcImVlcHJvbVwiLFwic3JhbVwiXSxcIm9yaWdpblwiOntcImxpYnJhcnlcIjpcIkNpcmN1aXRGb3JnZVwiLFwibGljZW5zZVwiOlwic2FtZSBhcyB0aGUgQ2lyY3VpdEZvcmdlIHByb2plY3RcIixcIm5vdGVcIjpcIm9yaWdpbmFsIENpcmN1aXRGb3JnZSBzeW1ib2xcIn19LFwibWljcm9jb250cm9sbGVyXCI6e1widHlwZVwiOlwibWljcm9jb250cm9sbGVyXCIsXCJuYW1lXCI6XCJHZW5lcmljIG1pY3JvY29udHJvbGxlclwiLFwiY2F0ZWdvcnlcIjpcImljXCIsXCJraW5kXCI6XCJib3hcIixcImxhYmVsXCI6XCJNQ1VcIixcInBpbnNcIjp7XCJsZWZ0XCI6W1wiUlNUXCIsXCJYVEFMMVwiLFwiWFRBTDJcIixcIlBBMFwiLFwiUEExXCIsXCJQQTJcIixcIlBBM1wiLFwiUEE0XCJdLFwicmlnaHRcIjpbXCJQQjBcIixcIlBCMVwiLFwiUEIyXCIsXCJQQjNcIixcIlBCNFwiLFwiUEI1XCIsXCJQQjZcIixcIlBCN1wiXSxcInRvcFwiOltcIlZDQ1wiXSxcImJvdHRvbVwiOltcIkdORFwiXX0sXCJwcmVmaXhcIjpcIlVcIixcImFsaWFzZXNcIjp7XCJyZXNldFwiOlwiUlNUXCIsXCJ2ZGRcIjpcIlZDQ1wiLFwidnNzXCI6XCJHTkRcIn0sXCJ0eXBlQWxpYXNlc1wiOltcIm1jdVwiLFwibWljcm9cIl0sXCJvcmlnaW5cIjp7XCJsaWJyYXJ5XCI6XCJDaXJjdWl0Rm9yZ2VcIixcImxpY2Vuc2VcIjpcInNhbWUgYXMgdGhlIENpcmN1aXRGb3JnZSBwcm9qZWN0XCIsXCJub3RlXCI6XCJvcmlnaW5hbCBDaXJjdWl0Rm9yZ2Ugc3ltYm9sXCJ9fSxcIm11eFwiOntcInR5cGVcIjpcIm11eFwiLFwibmFtZVwiOlwiTXVsdGlwbGV4ZXJcIixcImNhdGVnb3J5XCI6XCJkaWdpdGFsXCIsXCJraW5kXCI6XCJib3hcIixcImxhYmVsXCI6XCJNVVhcIixcInBpbnNcIjp7XCJsZWZ0XCI6W1wiRDBcIixcIkQxXCIsXCJEMlwiLFwiRDNcIl0sXCJyaWdodFwiOltcIllcIl0sXCJib3R0b21cIjpbXCJTMFwiLFwiUzFcIl19LFwicHJlZml4XCI6XCJVXCIsXCJ0eXBlQWxpYXNlc1wiOltcIm11bHRpcGxleGVyXCJdLFwib3JpZ2luXCI6e1wibGlicmFyeVwiOlwiQ2lyY3VpdEZvcmdlXCIsXCJsaWNlbnNlXCI6XCJzYW1lIGFzIHRoZSBDaXJjdWl0Rm9yZ2UgcHJvamVjdFwiLFwibm90ZVwiOlwib3JpZ2luYWwgQ2lyY3VpdEZvcmdlIHN5bWJvbFwifX0sXCJuYW5kXCI6e1widHlwZVwiOlwibmFuZFwiLFwibmFtZVwiOlwiTkFORCBnYXRlXCIsXCJjYXRlZ29yeVwiOlwiZGlnaXRhbFwiLFwic3ZnXCI6XCJzeW1ib2wuc3ZnXCIsXCJ3aWR0aFwiOjYwLFwiaGVpZ2h0XCI6NjAsXCJwaW5zXCI6e1wiQVwiOntcInhcIjowLFwieVwiOjIwLFwiZGlyXCI6XCJsZWZ0XCIsXCJpb1wiOlwiaW5cIn0sXCJCXCI6e1wieFwiOjAsXCJ5XCI6NDAsXCJkaXJcIjpcImxlZnRcIixcImlvXCI6XCJpblwifSxcIllcIjp7XCJ4XCI6NjAsXCJ5XCI6MzAsXCJkaXJcIjpcInJpZ2h0XCIsXCJpb1wiOlwib3V0XCJ9fSxcImFsaWFzZXNcIjp7XCIxXCI6XCJBXCIsXCIyXCI6XCJCXCIsXCIzXCI6XCJZXCIsXCJpbjFcIjpcIkFcIixcImluMlwiOlwiQlwiLFwib3V0XCI6XCJZXCIsXCJxXCI6XCJZXCIsXCJvXCI6XCJZXCIsXCJvdXRwdXRcIjpcIllcIn0sXCJib2R5XCI6e1wieFwiOjEyLjQsXCJ5XCI6MTUsXCJ3XCI6NDEuNixcImhcIjozMH0sXCJwcmVmaXhcIjpcIlVcIixcImxhYmVsc1wiOlwidG9wXCIsXCJ0eXBlQWxpYXNlc1wiOltcIm5hbmRfZ2F0ZVwiXSxcIm9yaWdpblwiOntcImxpYnJhcnlcIjpcImNocmlzLXBpa3VsL2VsZWN0cm9uaWMtc3ltYm9sc1wiLFwidXJsXCI6XCJodHRwczovL2dpdGh1Yi5jb20vY2hyaXMtcGlrdWwvZWxlY3Ryb25pYy1zeW1ib2xzXCIsXCJsaWNlbnNlXCI6XCJNSVRcIixcImNvcHlyaWdodFwiOlwiQ29weXJpZ2h0IChjKSAyMDIyIENocmlzIFBpa3VsXCIsXCJmaWxlXCI6XCJTVkcvSUMtQ09NLUxvZ2ljLU5BTkQuc3ZnXCIsXCJtb2RpZmllZF9ub3RlXCI6XCJzY2FsZWQgMC40LCBzdHJva2Ugbm9ybWFsaXplZCB0byBjdXJyZW50Q29sb3JcIn0sXCJzdmdCb2R5XCI6XCI8ZyB0cmFuc2Zvcm09XFxcInNjYWxlKDAuNCkgdHJhbnNsYXRlKDAgMClcXFwiPjxnIGZpbGw9XFxcIm5vbmVcXFwiIHN0cm9rZT1cXFwiY3VycmVudENvbG9yXFxcIiBzdHJva2UtbWl0ZXJsaW1pdD1cXFwiMTBcXFwiIHN0cm9rZS13aWR0aD1cXFwiNFxcXCI+XFxyPHBhdGggZD1cXFwiTTMxLjI1IDM3LjVoMjVjMTguNzUgMCA1Ni4yNSAwIDU2LjI1IDM3LjVTNzUgMTEyLjUgNTYuMjUgMTEyLjVoLTI1Wk0wIDQ5LjgxaDMxLjI1TTAgMTAwLjA2aDMxLjI1TTEzNC41IDc1SDE1MFxcXCIvPlxccjxjaXJjbGUgY3g9XFxcIjEyNC44OFxcXCIgY3k9XFxcIjc0Ljg4XFxcIiByPVxcXCI5LjM4XFxcIi8+XFxyPC9nPjwvZz5cIn0sXCJuZXRfbGFiZWxcIjp7XCJ0eXBlXCI6XCJuZXRfbGFiZWxcIixcIm5hbWVcIjpcIk5ldCBsYWJlbFwiLFwiY2F0ZWdvcnlcIjpcInBvd2VyXCIsXCJraW5kXCI6XCJsYWJlbFwiLFwicmFpbFwiOlwibGFiZWxcIixcInBpbnNcIjp7XCIxXCI6e1wieFwiOjAsXCJ5XCI6MCxcImRpclwiOlwibGVmdFwifX0sXCJ0eXBlQWxpYXNlc1wiOltcImxhYmVsXCIsXCJuZXRcIixcIm5ldGxhYmVsXCJdLFwib3JpZ2luXCI6e1wibGlicmFyeVwiOlwiQ2lyY3VpdEZvcmdlXCIsXCJsaWNlbnNlXCI6XCJzYW1lIGFzIHRoZSBDaXJjdWl0Rm9yZ2UgcHJvamVjdFwiLFwibm90ZVwiOlwib3JpZ2luYWwgQ2lyY3VpdEZvcmdlIHN5bWJvbFwifX0sXCJubW9zXCI6e1widHlwZVwiOlwibm1vc1wiLFwibmFtZVwiOlwiTi1jaGFubmVsIE1PU0ZFVFwiLFwiY2F0ZWdvcnlcIjpcInNlbWljb25kdWN0b3JcIixcInN2Z1wiOlwic3ltYm9sLnN2Z1wiLFwid2lkdGhcIjo2MCxcImhlaWdodFwiOjYwLFwicGluc1wiOntcIkdcIjp7XCJ4XCI6MCxcInlcIjozMCxcImRpclwiOlwibGVmdFwiLFwiaW9cIjpcImluXCJ9LFwiRFwiOntcInhcIjo0MCxcInlcIjowLFwiZGlyXCI6XCJ1cFwifSxcIlNcIjp7XCJ4XCI6NDAsXCJ5XCI6NjAsXCJkaXJcIjpcImRvd25cIn19LFwiYWxpYXNlc1wiOntcImdhdGVcIjpcIkdcIixcImRyYWluXCI6XCJEXCIsXCJzb3VyY2VcIjpcIlNcIn0sXCJib2R5XCI6e1wieFwiOjEwLFwieVwiOjEwLFwid1wiOjQwLFwiaFwiOjQwfSxcInByZWZpeFwiOlwiUVwiLFwibGFiZWxzXCI6XCJyaWdodFwiLFwicmVxdWlyZWRcIjpbXCJHXCIsXCJEXCIsXCJTXCJdLFwidHlwZUFsaWFzZXNcIjpbXCJubW9zZmV0XCIsXCJtb3NmZXRfblwiXSxcIm9yaWdpblwiOntcImxpYnJhcnlcIjpcImNocmlzLXBpa3VsL2VsZWN0cm9uaWMtc3ltYm9sc1wiLFwidXJsXCI6XCJodHRwczovL2dpdGh1Yi5jb20vY2hyaXMtcGlrdWwvZWxlY3Ryb25pYy1zeW1ib2xzXCIsXCJsaWNlbnNlXCI6XCJNSVRcIixcImNvcHlyaWdodFwiOlwiQ29weXJpZ2h0IChjKSAyMDIyIENocmlzIFBpa3VsXCIsXCJmaWxlXCI6XCJTVkcvVHJhbnNpc3Rvci1DT00tTU9TRkVULU4tRW5oYW5jZW1lbnQuc3ZnXCIsXCJtb2RpZmllZF9ub3RlXCI6XCJzY2FsZWQgMC40LCBzdHJva2Ugbm9ybWFsaXplZCB0byBjdXJyZW50Q29sb3JcIn0sXCJzdmdCb2R5XCI6XCI8ZyB0cmFuc2Zvcm09XFxcInNjYWxlKDAuNCkgdHJhbnNsYXRlKDAgMClcXFwiPjxjaXJjbGUgY3g9XFxcIjc1XFxcIiBjeT1cXFwiNzVcXFwiIHI9XFxcIjUwXFxcIiBmaWxsPVxcXCJub25lXFxcIiBzdHJva2U9XFxcImN1cnJlbnRDb2xvclxcXCIgc3Ryb2tlLW1pdGVybGltaXQ9XFxcIjEwXFxcIiBzdHJva2Utd2lkdGg9XFxcIjRcXFwiLz5cXHI8cGF0aCBmaWxsPVxcXCJub25lXFxcIiBzdHJva2U9XFxcImN1cnJlbnRDb2xvclxcXCIgc3Ryb2tlLW1pdGVybGltaXQ9XFxcIjEwXFxcIiBzdHJva2Utd2lkdGg9XFxcIjRcXFwiIGQ9XFxcIk0wIDc1aDUwbTAtMjV2NTBtMTIuNS01OS4yNXYxOC41bTAgNTB2LTE4LjVtMC0yNXYxOC41TTEwMCAwdjUwSDYyLjVNMTAwIDE1MFY3NUg2Mi41bTM3LjUgMjVINjIuNVxcXCIvPlxccjxwYXRoIGZpbGw9XFxcImN1cnJlbnRDb2xvclxcXCIgZD1cXFwiTTY4Ljc1IDc1IDg3LjUgNjIuNXYyNUw2OC43NSA3NXpcXFwiLz48L2c+XCJ9LFwibm9yXCI6e1widHlwZVwiOlwibm9yXCIsXCJuYW1lXCI6XCJOT1IgZ2F0ZVwiLFwiY2F0ZWdvcnlcIjpcImRpZ2l0YWxcIixcInN2Z1wiOlwic3ltYm9sLnN2Z1wiLFwid2lkdGhcIjo2MCxcImhlaWdodFwiOjYwLFwicGluc1wiOntcIkFcIjp7XCJ4XCI6MCxcInlcIjoyMCxcImRpclwiOlwibGVmdFwiLFwiaW9cIjpcImluXCJ9LFwiQlwiOntcInhcIjowLFwieVwiOjQwLFwiZGlyXCI6XCJsZWZ0XCIsXCJpb1wiOlwiaW5cIn0sXCJZXCI6e1wieFwiOjYwLFwieVwiOjMwLFwiZGlyXCI6XCJyaWdodFwiLFwiaW9cIjpcIm91dFwifX0sXCJhbGlhc2VzXCI6e1wiMVwiOlwiQVwiLFwiMlwiOlwiQlwiLFwiM1wiOlwiWVwiLFwiaW4xXCI6XCJBXCIsXCJpbjJcIjpcIkJcIixcIm91dFwiOlwiWVwiLFwicVwiOlwiWVwiLFwib1wiOlwiWVwiLFwib3V0cHV0XCI6XCJZXCJ9LFwiYm9keVwiOntcInhcIjoxMi40LFwieVwiOjE1LFwid1wiOjQxLjYsXCJoXCI6MzB9LFwicHJlZml4XCI6XCJVXCIsXCJsYWJlbHNcIjpcInRvcFwiLFwidHlwZUFsaWFzZXNcIjpbXCJub3JfZ2F0ZVwiXSxcIm9yaWdpblwiOntcImxpYnJhcnlcIjpcImNocmlzLXBpa3VsL2VsZWN0cm9uaWMtc3ltYm9sc1wiLFwidXJsXCI6XCJodHRwczovL2dpdGh1Yi5jb20vY2hyaXMtcGlrdWwvZWxlY3Ryb25pYy1zeW1ib2xzXCIsXCJsaWNlbnNlXCI6XCJNSVRcIixcImNvcHlyaWdodFwiOlwiQ29weXJpZ2h0IChjKSAyMDIyIENocmlzIFBpa3VsXCIsXCJmaWxlXCI6XCJTVkcvSUMtQ09NLUxvZ2ljLU5PUi5zdmdcIixcIm1vZGlmaWVkX25vdGVcIjpcInNjYWxlZCAwLjQsIHN0cm9rZSBub3JtYWxpemVkIHRvIGN1cnJlbnRDb2xvclwifSxcInN2Z0JvZHlcIjpcIjxnIHRyYW5zZm9ybT1cXFwic2NhbGUoMC40KSB0cmFuc2xhdGUoMCAwKVxcXCI+PGcgZmlsbD1cXFwibm9uZVxcXCIgc3Ryb2tlPVxcXCJjdXJyZW50Q29sb3JcXFwiIHN0cm9rZS1taXRlcmxpbWl0PVxcXCIxMFxcXCIgc3Ryb2tlLXdpZHRoPVxcXCI0XFxcIj5cXHI8cGF0aCBkPVxcXCJNMzEuMjUgMzcuNWgyNWMzNy41IDAgNTYuMjUgMzcuNSA1Ni4yNSAzNy41cy0xOC43NSAzNy41LTU2LjI1IDM3LjVoLTI1czEyLjUtMTguNzUgMTIuNS0zNy41LTEyLjUtMzcuNS0xMi41LTM3LjVaTTAgNDkuODFoMzcuNU0wIDEwMC4wNmgzNy41bTk3LTI0LjkzSDE1MFxcXCIvPlxccjxjaXJjbGUgY3g9XFxcIjEyNC44OFxcXCIgY3k9XFxcIjc1XFxcIiByPVxcXCI5LjM4XFxcIi8+XFxyPC9nPjwvZz5cIn0sXCJub3RcIjp7XCJ0eXBlXCI6XCJub3RcIixcIm5hbWVcIjpcIk5PVCBnYXRlIChpbnZlcnRlcilcIixcImNhdGVnb3J5XCI6XCJkaWdpdGFsXCIsXCJzdmdcIjpcInN5bWJvbC5zdmdcIixcIndpZHRoXCI6NjAsXCJoZWlnaHRcIjo2MCxcInBpbnNcIjp7XCJBXCI6e1wieFwiOjAsXCJ5XCI6MzAsXCJkaXJcIjpcImxlZnRcIixcImlvXCI6XCJpblwifSxcIllcIjp7XCJ4XCI6NjAsXCJ5XCI6MzAsXCJkaXJcIjpcInJpZ2h0XCIsXCJpb1wiOlwib3V0XCJ9fSxcImFsaWFzZXNcIjp7XCIxXCI6XCJBXCIsXCIyXCI6XCJZXCIsXCJpblwiOlwiQVwiLFwib3V0XCI6XCJZXCIsXCJpbnB1dFwiOlwiQVwiLFwib3V0cHV0XCI6XCJZXCJ9LFwiYm9keVwiOntcInhcIjo4LjgsXCJ5XCI6MTUsXCJ3XCI6NDYuNCxcImhcIjozMH0sXCJwcmVmaXhcIjpcIlVcIixcImxhYmVsc1wiOlwidG9wXCIsXCJ0eXBlQWxpYXNlc1wiOltcImludmVydGVyXCIsXCJub3RfZ2F0ZVwiXSxcIm9yaWdpblwiOntcImxpYnJhcnlcIjpcImNocmlzLXBpa3VsL2VsZWN0cm9uaWMtc3ltYm9sc1wiLFwidXJsXCI6XCJodHRwczovL2dpdGh1Yi5jb20vY2hyaXMtcGlrdWwvZWxlY3Ryb25pYy1zeW1ib2xzXCIsXCJsaWNlbnNlXCI6XCJNSVRcIixcImNvcHlyaWdodFwiOlwiQ29weXJpZ2h0IChjKSAyMDIyIENocmlzIFBpa3VsXCIsXCJmaWxlXCI6XCJTVkcvSUMtQ09NLUxvZ2ljLUludmVydGVyLnN2Z1wiLFwibW9kaWZpZWRfbm90ZVwiOlwic2NhbGVkIDAuNCwgc3Ryb2tlIG5vcm1hbGl6ZWQgdG8gY3VycmVudENvbG9yXCJ9LFwic3ZnQm9keVwiOlwiPGcgdHJhbnNmb3JtPVxcXCJzY2FsZSgwLjQpIHRyYW5zbGF0ZSgwIDApXFxcIj48ZyBmaWxsPVxcXCJub25lXFxcIiBzdHJva2U9XFxcImN1cnJlbnRDb2xvclxcXCIgc3Ryb2tlLW1pdGVybGltaXQ9XFxcIjEwXFxcIiBzdHJva2Utd2lkdGg9XFxcIjRcXFwiPlxccjxwYXRoIGQ9XFxcIk0yMiAzNy41djc1TDExMi41IDc1IDIyIDM3LjV6TTIyIDc1SDBtMTM3Ljc1IDBIMTUwXFxcIi8+XFxyPGNpcmNsZSBjeD1cXFwiMTI4LjEzXFxcIiBjeT1cXFwiNzQuODhcXFwiIHI9XFxcIjkuMzhcXFwiLz5cXHI8L2c+PC9nPlwifSxcIm5wblwiOntcInR5cGVcIjpcIm5wblwiLFwibmFtZVwiOlwiTlBOIHRyYW5zaXN0b3JcIixcImNhdGVnb3J5XCI6XCJzZW1pY29uZHVjdG9yXCIsXCJzdmdcIjpcInN5bWJvbC5zdmdcIixcIndpZHRoXCI6NjAsXCJoZWlnaHRcIjo2MCxcInBpbnNcIjp7XCJCXCI6e1wieFwiOjAsXCJ5XCI6MzAsXCJkaXJcIjpcImxlZnRcIixcImlvXCI6XCJpblwifSxcIkNcIjp7XCJ4XCI6NDAsXCJ5XCI6MCxcImRpclwiOlwidXBcIn0sXCJFXCI6e1wieFwiOjQwLFwieVwiOjYwLFwiZGlyXCI6XCJkb3duXCJ9fSxcImFsaWFzZXNcIjp7XCJiYXNlXCI6XCJCXCIsXCJjb2xsZWN0b3JcIjpcIkNcIixcImVtaXR0ZXJcIjpcIkVcIn0sXCJib2R5XCI6e1wieFwiOjEwLFwieVwiOjEwLFwid1wiOjQwLFwiaFwiOjQwfSxcInByZWZpeFwiOlwiUVwiLFwibGFiZWxzXCI6XCJyaWdodFwiLFwicmVxdWlyZWRcIjpbXCJCXCIsXCJDXCIsXCJFXCJdLFwidHlwZUFsaWFzZXNcIjpbXCJianRfbnBuXCIsXCJucG5fdHJhbnNpc3RvclwiXSxcIm9yaWdpblwiOntcImxpYnJhcnlcIjpcImNocmlzLXBpa3VsL2VsZWN0cm9uaWMtc3ltYm9sc1wiLFwidXJsXCI6XCJodHRwczovL2dpdGh1Yi5jb20vY2hyaXMtcGlrdWwvZWxlY3Ryb25pYy1zeW1ib2xzXCIsXCJsaWNlbnNlXCI6XCJNSVRcIixcImNvcHlyaWdodFwiOlwiQ29weXJpZ2h0IChjKSAyMDIyIENocmlzIFBpa3VsXCIsXCJmaWxlXCI6XCJTVkcvVHJhbnNpc3Rvci1DT00tQkpULU5QTi5zdmdcIixcIm1vZGlmaWVkX25vdGVcIjpcInNjYWxlZCAwLjQsIHN0cm9rZSBub3JtYWxpemVkIHRvIGN1cnJlbnRDb2xvclwifSxcInN2Z0JvZHlcIjpcIjxnIHRyYW5zZm9ybT1cXFwic2NhbGUoMC40KSB0cmFuc2xhdGUoMCAwKVxcXCI+PGNpcmNsZSBjeD1cXFwiNzVcXFwiIGN5PVxcXCI3NVxcXCIgcj1cXFwiNTBcXFwiIGZpbGw9XFxcIm5vbmVcXFwiIHN0cm9rZT1cXFwiY3VycmVudENvbG9yXFxcIiBzdHJva2UtbWl0ZXJsaW1pdD1cXFwiMTBcXFwiIHN0cm9rZS13aWR0aD1cXFwiNFxcXCIvPlxccjxwYXRoIGZpbGw9XFxcIm5vbmVcXFwiIHN0cm9rZT1cXFwiY3VycmVudENvbG9yXFxcIiBzdHJva2UtbWl0ZXJsaW1pdD1cXFwiMTBcXFwiIHN0cm9rZS13aWR0aD1cXFwiNFxcXCIgZD1cXFwiTTEwMCAxNTB2LTMxLjI1TTAgNzVoNTBtMC0zMS4yNXY2Mi41TTEwMCAwdjQwLjVsLTUwIDIybTAgMjUgMzcuNTIgMjIuNDdcXFwiLz5cXHI8cGF0aCBmaWxsPVxcXCJjdXJyZW50Q29sb3JcXFwiIGQ9XFxcIm04MS44IDExNS4yNiAxNC45NS4yNC03LjI3LTEzLjA3LTcuNjggMTIuODN6XFxcIi8+PC9nPlwifSxcIm9wYW1wXCI6e1widHlwZVwiOlwib3BhbXBcIixcIm5hbWVcIjpcIk9wLWFtcFwiLFwiY2F0ZWdvcnlcIjpcImFuYWxvZ1wiLFwic3ZnXCI6XCJzeW1ib2wuc3ZnXCIsXCJ3aWR0aFwiOjYwLFwiaGVpZ2h0XCI6NjAsXCJwaW5zXCI6e1wiaW4rXCI6e1wieFwiOjAsXCJ5XCI6MjAsXCJkaXJcIjpcImxlZnRcIixcImlvXCI6XCJpblwifSxcImluLVwiOntcInhcIjowLFwieVwiOjQwLFwiZGlyXCI6XCJsZWZ0XCIsXCJpb1wiOlwiaW5cIn0sXCJvdXRcIjp7XCJ4XCI6NjAsXCJ5XCI6MzAsXCJkaXJcIjpcInJpZ2h0XCIsXCJpb1wiOlwib3V0XCJ9LFwiditcIjp7XCJ4XCI6MzAsXCJ5XCI6MCxcImRpclwiOlwidXBcIixcImlvXCI6XCJwb3dlclwifSxcInYtXCI6e1wieFwiOjMwLFwieVwiOjYwLFwiZGlyXCI6XCJkb3duXCIsXCJpb1wiOlwicG93ZXJcIn19LFwiYWxpYXNlc1wiOntcIitcIjpcImluK1wiLFwiLVwiOlwiaW4tXCIsXCJub25faW52ZXJ0aW5nXCI6XCJpbitcIixcImludmVydGluZ1wiOlwiaW4tXCIsXCJpbnBcIjpcImluK1wiLFwiaW5uXCI6XCJpbi1cIixcIm91dHB1dFwiOlwib3V0XCIsXCJvXCI6XCJvdXRcIixcInZjY1wiOlwiditcIixcInZlZVwiOlwidi1cIixcInZzK1wiOlwiditcIixcInZzLVwiOlwidi1cIn0sXCJib2R5XCI6e1wieFwiOjEwLFwieVwiOjEwLFwid1wiOjQwLFwiaFwiOjQwfSxcInByZWZpeFwiOlwiVVwiLFwibGFiZWxzXCI6XCJ0b3ByaWdodFwiLFwicmVxdWlyZWRcIjpbXCJpbitcIixcImluLVwiLFwib3V0XCJdLFwidHlwZUFsaWFzZXNcIjpbXCJvcF9hbXBcIixcIm9wZXJhdGlvbmFsX2FtcGxpZmllclwiXSxcIm9yaWdpblwiOntcImxpYnJhcnlcIjpcImNocmlzLXBpa3VsL2VsZWN0cm9uaWMtc3ltYm9sc1wiLFwidXJsXCI6XCJodHRwczovL2dpdGh1Yi5jb20vY2hyaXMtcGlrdWwvZWxlY3Ryb25pYy1zeW1ib2xzXCIsXCJsaWNlbnNlXCI6XCJNSVRcIixcImNvcHlyaWdodFwiOlwiQ29weXJpZ2h0IChjKSAyMDIyIENocmlzIFBpa3VsXCIsXCJmaWxlXCI6XCJTVkcvSUMtQ09NLU9wQW1wLnN2Z1wiLFwibW9kaWZpZWRfbm90ZVwiOlwic2NhbGVkIDAuNCwgc3Ryb2tlIG5vcm1hbGl6ZWQgdG8gY3VycmVudENvbG9yXCJ9LFwic3ZnQm9keVwiOlwiPGcgdHJhbnNmb3JtPVxcXCJzY2FsZSgwLjQpIHRyYW5zbGF0ZSgwIDApXFxcIj48cGF0aCBmaWxsPVxcXCJub25lXFxcIiBzdHJva2U9XFxcImN1cnJlbnRDb2xvclxcXCIgc3Ryb2tlLW1pdGVybGltaXQ9XFxcIjEwXFxcIiBzdHJva2Utd2lkdGg9XFxcIjRcXFwiIGQ9XFxcIk0yNSAyNXYxMDBsMTAwLTUwTDI1IDI1em0wIDI1SDBtMTI1IDI1aDI1TTAgMTAwaDI1bTkuNS00N0g1M20tOS4yNS05LjI1djE4LjVNMzQuNSA5N0g1M003NC42OSAwdjUwbS4zNyAxMDB2LTUwXFxcIi8+PC9nPlwifSxcIm9yXCI6e1widHlwZVwiOlwib3JcIixcIm5hbWVcIjpcIk9SIGdhdGVcIixcImNhdGVnb3J5XCI6XCJkaWdpdGFsXCIsXCJzdmdcIjpcInN5bWJvbC5zdmdcIixcIndpZHRoXCI6NjAsXCJoZWlnaHRcIjo2MCxcInBpbnNcIjp7XCJBXCI6e1wieFwiOjAsXCJ5XCI6MjAsXCJkaXJcIjpcImxlZnRcIixcImlvXCI6XCJpblwifSxcIkJcIjp7XCJ4XCI6MCxcInlcIjo0MCxcImRpclwiOlwibGVmdFwiLFwiaW9cIjpcImluXCJ9LFwiWVwiOntcInhcIjo2MCxcInlcIjozMCxcImRpclwiOlwicmlnaHRcIixcImlvXCI6XCJvdXRcIn19LFwiYWxpYXNlc1wiOntcIjFcIjpcIkFcIixcIjJcIjpcIkJcIixcIjNcIjpcIllcIixcImluMVwiOlwiQVwiLFwiaW4yXCI6XCJCXCIsXCJvdXRcIjpcIllcIixcInFcIjpcIllcIixcIm9cIjpcIllcIixcIm91dHB1dFwiOlwiWVwifSxcImJvZHlcIjp7XCJ4XCI6MTIuNCxcInlcIjoxNSxcIndcIjozMi42LFwiaFwiOjMwfSxcInByZWZpeFwiOlwiVVwiLFwibGFiZWxzXCI6XCJ0b3BcIixcInR5cGVBbGlhc2VzXCI6W1wib3JfZ2F0ZVwiXSxcIm9yaWdpblwiOntcImxpYnJhcnlcIjpcImNocmlzLXBpa3VsL2VsZWN0cm9uaWMtc3ltYm9sc1wiLFwidXJsXCI6XCJodHRwczovL2dpdGh1Yi5jb20vY2hyaXMtcGlrdWwvZWxlY3Ryb25pYy1zeW1ib2xzXCIsXCJsaWNlbnNlXCI6XCJNSVRcIixcImNvcHlyaWdodFwiOlwiQ29weXJpZ2h0IChjKSAyMDIyIENocmlzIFBpa3VsXCIsXCJmaWxlXCI6XCJTVkcvSUMtQ09NLUxvZ2ljLU9SLnN2Z1wiLFwibW9kaWZpZWRfbm90ZVwiOlwic2NhbGVkIDAuNCwgc3Ryb2tlIG5vcm1hbGl6ZWQgdG8gY3VycmVudENvbG9yXCJ9LFwic3ZnQm9keVwiOlwiPGcgdHJhbnNmb3JtPVxcXCJzY2FsZSgwLjQpIHRyYW5zbGF0ZSgwIDApXFxcIj48cGF0aCBmaWxsPVxcXCJub25lXFxcIiBzdHJva2U9XFxcImN1cnJlbnRDb2xvclxcXCIgc3Ryb2tlLW1pdGVybGltaXQ9XFxcIjEwXFxcIiBzdHJva2Utd2lkdGg9XFxcIjRcXFwiIGQ9XFxcIk0zMS4yNSAzNy41aDI1YzM3LjUgMCA1Ni4yNSAzNy41IDU2LjI1IDM3LjVzLTE4Ljc1IDM3LjUtNTYuMjUgMzcuNWgtMjVzMTIuNS0xOC43NSAxMi41LTM3LjUtMTIuNS0zNy41LTEyLjUtMzcuNVpNMCA0OS44MWgzNy41TTAgMTAwLjA2aDM3LjVtNzUtMjUuMDZIMTUwXFxcIi8+PC9nPlwifSxcIm91dHB1dFwiOntcInR5cGVcIjpcIm91dHB1dFwiLFwibmFtZVwiOlwiT3V0cHV0IHRlcm1pbmFsXCIsXCJjYXRlZ29yeVwiOlwicG93ZXJcIixcIndpZHRoXCI6NDAsXCJoZWlnaHRcIjoyMCxcInBpbnNcIjp7XCIxXCI6e1wieFwiOjAsXCJ5XCI6MTAsXCJkaXJcIjpcImxlZnRcIixcImlvXCI6XCJpblwifX0sXCJib2R5XCI6e1wieFwiOjI4LFwieVwiOjQsXCJ3XCI6MTIsXCJoXCI6MTJ9LFwidGVybWluYWxcIjpcIm91dHB1dFwiLFwibGFiZWxzXCI6XCJub25lXCIsXCJ0ZXh0XCI6e1wieFwiOjQ0LFwieVwiOjE0LFwiYW5jaG9yXCI6XCJzdGFydFwiLFwiZGVmYXVsdFwiOlwiJGlkXCJ9LFwicHJlZml4XCI6XCJPVVRcIixcInR5cGVBbGlhc2VzXCI6W1wib3V0cHV0X3Rlcm1pbmFsXCIsXCJvdXRcIixcInBvcnRfb3V0XCJdLFwic3ZnXCI6XCJzeW1ib2wuc3ZnXCIsXCJvcmlnaW5cIjp7XCJsaWJyYXJ5XCI6XCJDaXJjdWl0Rm9yZ2VcIixcImxpY2Vuc2VcIjpcInNhbWUgYXMgdGhlIENpcmN1aXRGb3JnZSBwcm9qZWN0XCIsXCJub3RlXCI6XCJvcmlnaW5hbCBDaXJjdWl0Rm9yZ2Ugc3ltYm9sXCJ9LFwic3ZnQm9keVwiOlwiPGcgZmlsbD1cXFwibm9uZVxcXCIgc3Ryb2tlPVxcXCJjdXJyZW50Q29sb3JcXFwiIHN0cm9rZS13aWR0aD1cXFwiMS42XFxcIiBzdHJva2UtbGluZWNhcD1cXFwicm91bmRcXFwiPjxwYXRoIGQ9XFxcIk0wIDEwaDMwXFxcIi8+PGNpcmNsZSBjeD1cXFwiMzRcXFwiIGN5PVxcXCIxMFxcXCIgcj1cXFwiNFxcXCIvPjwvZz5cIn0sXCJwaG90b2Rpb2RlXCI6e1widHlwZVwiOlwicGhvdG9kaW9kZVwiLFwibmFtZVwiOlwiUGhvdG9kaW9kZVwiLFwiY2F0ZWdvcnlcIjpcInNlbWljb25kdWN0b3JcIixcInN2Z1wiOlwic3ltYm9sLnN2Z1wiLFwid2lkdGhcIjo2MCxcImhlaWdodFwiOjYwLFwicGluc1wiOntcImFub2RlXCI6e1wieFwiOjAsXCJ5XCI6MzAsXCJkaXJcIjpcImxlZnRcIixcImlvXCI6XCJpblwifSxcImNhdGhvZGVcIjp7XCJ4XCI6NjAsXCJ5XCI6MzAsXCJkaXJcIjpcInJpZ2h0XCIsXCJpb1wiOlwib3V0XCJ9fSxcImFsaWFzZXNcIjp7XCIxXCI6XCJhbm9kZVwiLFwiMlwiOlwiY2F0aG9kZVwiLFwiYVwiOlwiYW5vZGVcIixcImtcIjpcImNhdGhvZGVcIixcIitcIjpcImFub2RlXCIsXCItXCI6XCJjYXRob2RlXCJ9LFwiYm9keVwiOntcInhcIjoyMCxcInlcIjo0LFwid1wiOjMwLFwiaFwiOjQwfSxcInByZWZpeFwiOlwiRFwiLFwib3JpZ2luXCI6e1wibGlicmFyeVwiOlwiY2hyaXMtcGlrdWwvZWxlY3Ryb25pYy1zeW1ib2xzXCIsXCJ1cmxcIjpcImh0dHBzOi8vZ2l0aHViLmNvbS9jaHJpcy1waWt1bC9lbGVjdHJvbmljLXN5bWJvbHNcIixcImxpY2Vuc2VcIjpcIk1JVFwiLFwiY29weXJpZ2h0XCI6XCJDb3B5cmlnaHQgKGMpIDIwMjIgQ2hyaXMgUGlrdWxcIixcImZpbGVcIjpcIlNWRy9EaW9kZS1DT00tUGhvdG9kaW9kZS5zdmdcIixcIm1vZGlmaWVkX25vdGVcIjpcInNjYWxlZCAwLjQsIHN0cm9rZSBub3JtYWxpemVkIHRvIGN1cnJlbnRDb2xvclwifSxcInN2Z0JvZHlcIjpcIjxnIHRyYW5zZm9ybT1cXFwic2NhbGUoMC40KSB0cmFuc2xhdGUoMCAwKVxcXCI+PHBhdGggZmlsbD1cXFwibm9uZVxcXCIgc3Ryb2tlPVxcXCJjdXJyZW50Q29sb3JcXFwiIHN0cm9rZS1taXRlcmxpbWl0PVxcXCIxMFxcXCIgc3Ryb2tlLXdpZHRoPVxcXCI0XFxcIiBkPVxcXCJtMTAwIDc1LTUwIDMxLjI1di02Mi41TDEwMCA3NXptMC0zNC4yNXY2OC41TTUwIDc1SDBtMTAwIDBoNTBtLTEyLjUtNDMuNzVMMTE4Ljc1IDUwXFxcIi8+XFxyPHBhdGggZmlsbD1cXFwiY3VycmVudENvbG9yXFxcIiBkPVxcXCJtMTE1LjAxIDQzLjE2LTMuODcgMTQuNDUgMTQuNDUtMy44Ny0xMC41OC0xMC41OHpcXFwiLz5cXHI8cGF0aCBmaWxsPVxcXCJub25lXFxcIiBzdHJva2U9XFxcImN1cnJlbnRDb2xvclxcXCIgc3Ryb2tlLW1pdGVybGltaXQ9XFxcIjEwXFxcIiBzdHJva2Utd2lkdGg9XFxcIjRcXFwiIGQ9XFxcIk0xMTguNzUgMTIuNSAxMDAgMzEuMjVcXFwiLz5cXHI8cGF0aCBmaWxsPVxcXCJjdXJyZW50Q29sb3JcXFwiIGQ9XFxcIm05Ni4yNiAyNC40MS0zLjg3IDE0LjQ1IDE0LjQ1LTMuODctMTAuNTgtMTAuNTh6XFxcIi8+PC9nPlwifSxcInBtb3NcIjp7XCJ0eXBlXCI6XCJwbW9zXCIsXCJuYW1lXCI6XCJQLWNoYW5uZWwgTU9TRkVUXCIsXCJjYXRlZ29yeVwiOlwic2VtaWNvbmR1Y3RvclwiLFwic3ZnXCI6XCJzeW1ib2wuc3ZnXCIsXCJ3aWR0aFwiOjYwLFwiaGVpZ2h0XCI6NjAsXCJwaW5zXCI6e1wiR1wiOntcInhcIjowLFwieVwiOjMwLFwiZGlyXCI6XCJsZWZ0XCIsXCJpb1wiOlwiaW5cIn0sXCJTXCI6e1wieFwiOjQwLFwieVwiOjAsXCJkaXJcIjpcInVwXCJ9LFwiRFwiOntcInhcIjo0MCxcInlcIjo2MCxcImRpclwiOlwiZG93blwifX0sXCJhbGlhc2VzXCI6e1wiZ2F0ZVwiOlwiR1wiLFwiZHJhaW5cIjpcIkRcIixcInNvdXJjZVwiOlwiU1wifSxcImJvZHlcIjp7XCJ4XCI6MTAsXCJ5XCI6MTAsXCJ3XCI6NDAsXCJoXCI6NDB9LFwicHJlZml4XCI6XCJRXCIsXCJsYWJlbHNcIjpcInJpZ2h0XCIsXCJyZXF1aXJlZFwiOltcIkdcIixcIkRcIixcIlNcIl0sXCJ0eXBlQWxpYXNlc1wiOltcInBtb3NmZXRcIixcIm1vc2ZldF9wXCJdLFwib3JpZ2luXCI6e1wibGlicmFyeVwiOlwiY2hyaXMtcGlrdWwvZWxlY3Ryb25pYy1zeW1ib2xzXCIsXCJ1cmxcIjpcImh0dHBzOi8vZ2l0aHViLmNvbS9jaHJpcy1waWt1bC9lbGVjdHJvbmljLXN5bWJvbHNcIixcImxpY2Vuc2VcIjpcIk1JVFwiLFwiY29weXJpZ2h0XCI6XCJDb3B5cmlnaHQgKGMpIDIwMjIgQ2hyaXMgUGlrdWxcIixcImZpbGVcIjpcIlNWRy9UcmFuc2lzdG9yLUNPTS1NT1NGRVQtUC1FbmhhbmNlbWVudC5zdmdcIixcIm1vZGlmaWVkX25vdGVcIjpcInNjYWxlZCAwLjQsIHN0cm9rZSBub3JtYWxpemVkIHRvIGN1cnJlbnRDb2xvclwifSxcInN2Z0JvZHlcIjpcIjxnIHRyYW5zZm9ybT1cXFwic2NhbGUoMC40KSB0cmFuc2xhdGUoMCAwKVxcXCI+PGNpcmNsZSBjeD1cXFwiNzVcXFwiIGN5PVxcXCI3NVxcXCIgcj1cXFwiNTBcXFwiIGZpbGw9XFxcIm5vbmVcXFwiIHN0cm9rZT1cXFwiY3VycmVudENvbG9yXFxcIiBzdHJva2UtbWl0ZXJsaW1pdD1cXFwiMTBcXFwiIHN0cm9rZS13aWR0aD1cXFwiNFxcXCIvPlxccjxwYXRoIGZpbGw9XFxcIm5vbmVcXFwiIHN0cm9rZT1cXFwiY3VycmVudENvbG9yXFxcIiBzdHJva2UtbWl0ZXJsaW1pdD1cXFwiMTBcXFwiIHN0cm9rZS13aWR0aD1cXFwiNFxcXCIgZD1cXFwiTTAgNzVoNTBtMC0yNXY1MG0xMi41LTU5LjI1djE4LjVtMCA1MHYtMTguNW0wLTI1djE4LjVNMTAwIDB2NzVINjIuNW0zNy41IDc1di01MEg2Mi41XFxcIi8+XFxyPHBhdGggZmlsbD1cXFwiY3VycmVudENvbG9yXFxcIiBkPVxcXCJNOTMuNzUgNzUgNzUgODcuNXYtMjVMOTMuNzUgNzV6XFxcIi8+XFxyPHBhdGggZmlsbD1cXFwibm9uZVxcXCIgc3Ryb2tlPVxcXCJjdXJyZW50Q29sb3JcXFwiIHN0cm9rZS1taXRlcmxpbWl0PVxcXCIxMFxcXCIgc3Ryb2tlLXdpZHRoPVxcXCI0XFxcIiBkPVxcXCJNMTAwIDUwSDYyLjVcXFwiLz48L2c+XCJ9LFwicG5wXCI6e1widHlwZVwiOlwicG5wXCIsXCJuYW1lXCI6XCJQTlAgdHJhbnNpc3RvclwiLFwiY2F0ZWdvcnlcIjpcInNlbWljb25kdWN0b3JcIixcInN2Z1wiOlwic3ltYm9sLnN2Z1wiLFwid2lkdGhcIjo2MCxcImhlaWdodFwiOjYwLFwicGluc1wiOntcIkJcIjp7XCJ4XCI6MCxcInlcIjozMCxcImRpclwiOlwibGVmdFwiLFwiaW9cIjpcImluXCJ9LFwiRVwiOntcInhcIjo0MCxcInlcIjowLFwiZGlyXCI6XCJ1cFwifSxcIkNcIjp7XCJ4XCI6NDAsXCJ5XCI6NjAsXCJkaXJcIjpcImRvd25cIn19LFwiYWxpYXNlc1wiOntcImJhc2VcIjpcIkJcIixcImNvbGxlY3RvclwiOlwiQ1wiLFwiZW1pdHRlclwiOlwiRVwifSxcImJvZHlcIjp7XCJ4XCI6MTAsXCJ5XCI6MTAsXCJ3XCI6NDAsXCJoXCI6NDB9LFwicHJlZml4XCI6XCJRXCIsXCJsYWJlbHNcIjpcInJpZ2h0XCIsXCJyZXF1aXJlZFwiOltcIkJcIixcIkNcIixcIkVcIl0sXCJ0eXBlQWxpYXNlc1wiOltcImJqdF9wbnBcIixcInBucF90cmFuc2lzdG9yXCJdLFwib3JpZ2luXCI6e1wibGlicmFyeVwiOlwiY2hyaXMtcGlrdWwvZWxlY3Ryb25pYy1zeW1ib2xzXCIsXCJ1cmxcIjpcImh0dHBzOi8vZ2l0aHViLmNvbS9jaHJpcy1waWt1bC9lbGVjdHJvbmljLXN5bWJvbHNcIixcImxpY2Vuc2VcIjpcIk1JVFwiLFwiY29weXJpZ2h0XCI6XCJDb3B5cmlnaHQgKGMpIDIwMjIgQ2hyaXMgUGlrdWxcIixcImZpbGVcIjpcIlNWRy9UcmFuc2lzdG9yLUNPTS1CSlQtUE5QLnN2Z1wiLFwibW9kaWZpZWRfbm90ZVwiOlwic2NhbGVkIDAuNCwgc3Ryb2tlIG5vcm1hbGl6ZWQgdG8gY3VycmVudENvbG9yXCJ9LFwic3ZnQm9keVwiOlwiPGcgdHJhbnNmb3JtPVxcXCJzY2FsZSgwLjQpIHRyYW5zbGF0ZSgwIDApXFxcIj48Y2lyY2xlIGN4PVxcXCI3NVxcXCIgY3k9XFxcIjc1XFxcIiByPVxcXCI1MFxcXCIgZmlsbD1cXFwibm9uZVxcXCIgc3Ryb2tlPVxcXCJjdXJyZW50Q29sb3JcXFwiIHN0cm9rZS1taXRlcmxpbWl0PVxcXCIxMFxcXCIgc3Ryb2tlLXdpZHRoPVxcXCI0XFxcIi8+XFxyPHBhdGggZmlsbD1cXFwibm9uZVxcXCIgc3Ryb2tlPVxcXCJjdXJyZW50Q29sb3JcXFwiIHN0cm9rZS1taXRlcmxpbWl0PVxcXCIxMFxcXCIgc3Ryb2tlLXdpZHRoPVxcXCI0XFxcIiBkPVxcXCJNMCA3NWg1MG0wIDMxLjI1di02Mi41TTEwMCAxNTB2LTQwLjVsLTUwLTIyTTk5Ljg0IDB2MzEuMjVMNjIuMjIgNTMuOTRcXFwiLz5cXHI8cGF0aCBmaWxsPVxcXCJjdXJyZW50Q29sb3JcXFwiIGQ9XFxcIk02MC4yMyA0Ni40MSA1MyA1OS41bDE0Ljk1LS4yOC03LjcyLTEyLjgxelxcXCIvPjwvZz5cIn0sXCJwb3RlbnRpb21ldGVyXCI6e1widHlwZVwiOlwicG90ZW50aW9tZXRlclwiLFwibmFtZVwiOlwiUG90ZW50aW9tZXRlclwiLFwiY2F0ZWdvcnlcIjpcInBhc3NpdmVcIixcInN2Z1wiOlwic3ltYm9sLnN2Z1wiLFwid2lkdGhcIjo2MCxcImhlaWdodFwiOjYwLFwicGluc1wiOntcIjFcIjp7XCJ4XCI6MCxcInlcIjozMCxcImRpclwiOlwibGVmdFwifSxcIjJcIjp7XCJ4XCI6NjAsXCJ5XCI6MzAsXCJkaXJcIjpcInJpZ2h0XCJ9LFwid2lwZXJcIjp7XCJ4XCI6MzAsXCJ5XCI6NjAsXCJkaXJcIjpcImRvd25cIn19LFwiYWxpYXNlc1wiOntcIjNcIjpcIndpcGVyXCIsXCJ3XCI6XCJ3aXBlclwifSxcImJvZHlcIjp7XCJ4XCI6MTIuNCxcInlcIjoyMCxcIndcIjozNS4yLFwiaFwiOjMwfSxcInByZWZpeFwiOlwiUlZcIixcInR5cGVBbGlhc2VzXCI6W1wicG90XCJdLFwib3JpZ2luXCI6e1wibGlicmFyeVwiOlwiY2hyaXMtcGlrdWwvZWxlY3Ryb25pYy1zeW1ib2xzXCIsXCJ1cmxcIjpcImh0dHBzOi8vZ2l0aHViLmNvbS9jaHJpcy1waWt1bC9lbGVjdHJvbmljLXN5bWJvbHNcIixcImxpY2Vuc2VcIjpcIk1JVFwiLFwiY29weXJpZ2h0XCI6XCJDb3B5cmlnaHQgKGMpIDIwMjIgQ2hyaXMgUGlrdWxcIixcImZpbGVcIjpcIlNWRy9SZXNpc3Rvci1JRUVFLVBvdGVudGlvbWV0ZXIuc3ZnXCIsXCJtb2RpZmllZF9ub3RlXCI6XCJzY2FsZWQgMC40LCBzdHJva2Ugbm9ybWFsaXplZCB0byBjdXJyZW50Q29sb3JcIn0sXCJzdmdCb2R5XCI6XCI8ZyB0cmFuc2Zvcm09XFxcInNjYWxlKDAuNCkgdHJhbnNsYXRlKDAgMClcXFwiPjxwYXRoIGZpbGw9XFxcIm5vbmVcXFwiIHN0cm9rZT1cXFwiY3VycmVudENvbG9yXFxcIiBzdHJva2UtbGluZWpvaW49XFxcImJldmVsXFxcIiBzdHJva2Utd2lkdGg9XFxcIjRcXFwiIGQ9XFxcIk0wIDc0Ljk0aDMxLjI1bDEwLjI5LTI0Ljk3TDU0LjkyIDEwMGwxMy4zOS01MCAxMy4zOCA1MCAxMy4zOS00OS42MkwxMDguNDYgMTAwbDEwLjI5LTI1SDE1MFxcXCIvPlxccjxwYXRoIGZpbGw9XFxcIm5vbmVcXFwiIHN0cm9rZT1cXFwiY3VycmVudENvbG9yXFxcIiBzdHJva2UtbWl0ZXJsaW1pdD1cXFwiMTBcXFwiIHN0cm9rZS13aWR0aD1cXFwiNFxcXCIgZD1cXFwiTTc1IDE1MHYtMzIuNFxcXCIvPlxccjxwYXRoIGZpbGw9XFxcImN1cnJlbnRDb2xvclxcXCIgZD1cXFwiTTg0Ljk3IDEyMC41MiA3NSAxMDMuMjVsLTkuOTcgMTcuMjdoMTkuOTR6XFxcIi8+PC9nPlwifSxcInB1c2hfYnV0dG9uXCI6e1widHlwZVwiOlwicHVzaF9idXR0b25cIixcIm5hbWVcIjpcIlB1c2ggYnV0dG9uXCIsXCJjYXRlZ29yeVwiOlwicGFzc2l2ZVwiLFwic3ZnXCI6XCJzeW1ib2wuc3ZnXCIsXCJ3aWR0aFwiOjYwLFwiaGVpZ2h0XCI6NjAsXCJwaW5zXCI6e1wiMVwiOntcInhcIjowLFwieVwiOjMwLFwiZGlyXCI6XCJsZWZ0XCJ9LFwiMlwiOntcInhcIjo2MCxcInlcIjozMCxcImRpclwiOlwicmlnaHRcIn19LFwiYm9keVwiOntcInhcIjoxNC44LFwieVwiOjExLjIsXCJ3XCI6MzAuNCxcImhcIjoyMS42fSxcInByZWZpeFwiOlwiU1dcIixcInR5cGVBbGlhc2VzXCI6W1wiYnV0dG9uXCIsXCJwdXNoYnV0dG9uXCJdLFwib3JpZ2luXCI6e1wibGlicmFyeVwiOlwiY2hyaXMtcGlrdWwvZWxlY3Ryb25pYy1zeW1ib2xzXCIsXCJ1cmxcIjpcImh0dHBzOi8vZ2l0aHViLmNvbS9jaHJpcy1waWt1bC9lbGVjdHJvbmljLXN5bWJvbHNcIixcImxpY2Vuc2VcIjpcIk1JVFwiLFwiY29weXJpZ2h0XCI6XCJDb3B5cmlnaHQgKGMpIDIwMjIgQ2hyaXMgUGlrdWxcIixcImZpbGVcIjpcIlNWRy9Td2l0Y2gtQ09NLVB1c2hidXR0b24tTk8uc3ZnXCIsXCJtb2RpZmllZF9ub3RlXCI6XCJzY2FsZWQgMC40LCBzdHJva2Ugbm9ybWFsaXplZCB0byBjdXJyZW50Q29sb3JcIn0sXCJzdmdCb2R5XCI6XCI8ZyB0cmFuc2Zvcm09XFxcInNjYWxlKDAuNCkgdHJhbnNsYXRlKDAgMClcXFwiPjxnIGZpbGw9XFxcIm5vbmVcXFwiIHN0cm9rZT1cXFwiY3VycmVudENvbG9yXFxcIiBzdHJva2UtbWl0ZXJsaW1pdD1cXFwiMTBcXFwiIHN0cm9rZS13aWR0aD1cXFwiNFxcXCI+XFxyPGNpcmNsZSBjeD1cXFwiNTBcXFwiIGN5PVxcXCI3NVxcXCIgcj1cXFwiNi4yNVxcXCIvPlxccjxwYXRoIGQ9XFxcIk0wIDc0Ljk0aDQzLjc1XFxcIi8+XFxyPGNpcmNsZSBjeD1cXFwiMTAwXFxcIiBjeT1cXFwiNzVcXFwiIHI9XFxcIjYuMjVcXFwiLz5cXHI8cGF0aCBkPVxcXCJNMTUwIDc1LjA2aC00My43NU0zNy41IDUwaDc1TTc1IDMxLjI1VjUwTTYyLjUgMzEuMjVoMjVcXFwiLz5cXHI8L2c+PC9nPlwifSxcInJlZ2lzdGVyXCI6e1widHlwZVwiOlwicmVnaXN0ZXJcIixcIm5hbWVcIjpcIlJlZ2lzdGVyXCIsXCJjYXRlZ29yeVwiOlwiZGlnaXRhbFwiLFwia2luZFwiOlwiYm94XCIsXCJsYWJlbFwiOlwiUkVHXCIsXCJwaW5zXCI6e1wibGVmdFwiOltcIkQwXCIsXCJEMVwiLFwiRDJcIixcIkQzXCIsXCJDTEtcIixcIn5DTFJcIl0sXCJyaWdodFwiOltcIlEwXCIsXCJRMVwiLFwiUTJcIixcIlEzXCJdfSxcInByZWZpeFwiOlwiVVwiLFwidHlwZUFsaWFzZXNcIjpbXCJzaGlmdF9yZWdpc3RlclwiLFwibGF0Y2hfcmVnaXN0ZXJcIl0sXCJvcmlnaW5cIjp7XCJsaWJyYXJ5XCI6XCJDaXJjdWl0Rm9yZ2VcIixcImxpY2Vuc2VcIjpcInNhbWUgYXMgdGhlIENpcmN1aXRGb3JnZSBwcm9qZWN0XCIsXCJub3RlXCI6XCJvcmlnaW5hbCBDaXJjdWl0Rm9yZ2Ugc3ltYm9sXCJ9fSxcInJlc2lzdG9yXCI6e1widHlwZVwiOlwicmVzaXN0b3JcIixcIm5hbWVcIjpcIlJlc2lzdG9yXCIsXCJjYXRlZ29yeVwiOlwicGFzc2l2ZVwiLFwic3ZnXCI6XCJzeW1ib2wuc3ZnXCIsXCJ3aWR0aFwiOjYwLFwiaGVpZ2h0XCI6NjAsXCJwaW5zXCI6e1wiMVwiOntcInhcIjowLFwieVwiOjMwLFwiZGlyXCI6XCJsZWZ0XCJ9LFwiMlwiOntcInhcIjo2MCxcInlcIjozMCxcImRpclwiOlwicmlnaHRcIn19LFwiYm9keVwiOntcInhcIjoxMi40LFwieVwiOjIwLFwid1wiOjM1LjIsXCJoXCI6MjB9LFwicHJlZml4XCI6XCJSXCIsXCJ0eXBlQWxpYXNlc1wiOltcInJlc1wiLFwiclwiXSxcIm9yaWdpblwiOntcImxpYnJhcnlcIjpcImNocmlzLXBpa3VsL2VsZWN0cm9uaWMtc3ltYm9sc1wiLFwidXJsXCI6XCJodHRwczovL2dpdGh1Yi5jb20vY2hyaXMtcGlrdWwvZWxlY3Ryb25pYy1zeW1ib2xzXCIsXCJsaWNlbnNlXCI6XCJNSVRcIixcImNvcHlyaWdodFwiOlwiQ29weXJpZ2h0IChjKSAyMDIyIENocmlzIFBpa3VsXCIsXCJmaWxlXCI6XCJTVkcvUmVzaXN0b3ItSUVFRS1TdGFuZGFyZC5zdmdcIixcIm1vZGlmaWVkX25vdGVcIjpcInNjYWxlZCAwLjQsIHN0cm9rZSBub3JtYWxpemVkIHRvIGN1cnJlbnRDb2xvclwifSxcInN2Z0JvZHlcIjpcIjxnIHRyYW5zZm9ybT1cXFwic2NhbGUoMC40KSB0cmFuc2xhdGUoMCAwKVxcXCI+PHBhdGggZmlsbD1cXFwibm9uZVxcXCIgc3Ryb2tlPVxcXCJjdXJyZW50Q29sb3JcXFwiIHN0cm9rZS1saW5lam9pbj1cXFwiYmV2ZWxcXFwiIHN0cm9rZS13aWR0aD1cXFwiNFxcXCIgZD1cXFwiTTAgNzQuOTRoMzEuMjVsMTAuMjktMjQuOTdMNTQuOTIgMTAwbDEzLjM5LTUwIDEzLjM4IDUwIDEzLjM5LTQ5LjYyTDEwOC40NiAxMDBsMTAuMjktMjVIMTUwXFxcIi8+PC9nPlwifSxcInNjaG90dGt5XCI6e1widHlwZVwiOlwic2Nob3R0a3lcIixcIm5hbWVcIjpcIlNjaG90dGt5IGRpb2RlXCIsXCJjYXRlZ29yeVwiOlwic2VtaWNvbmR1Y3RvclwiLFwic3ZnXCI6XCJzeW1ib2wuc3ZnXCIsXCJ3aWR0aFwiOjYwLFwiaGVpZ2h0XCI6NjAsXCJwaW5zXCI6e1wiYW5vZGVcIjp7XCJ4XCI6MCxcInlcIjozMCxcImRpclwiOlwibGVmdFwiLFwiaW9cIjpcImluXCJ9LFwiY2F0aG9kZVwiOntcInhcIjo2MCxcInlcIjozMCxcImRpclwiOlwicmlnaHRcIixcImlvXCI6XCJvdXRcIn19LFwiYWxpYXNlc1wiOntcIjFcIjpcImFub2RlXCIsXCIyXCI6XCJjYXRob2RlXCIsXCJhXCI6XCJhbm9kZVwiLFwia1wiOlwiY2F0aG9kZVwiLFwiK1wiOlwiYW5vZGVcIixcIi1cIjpcImNhdGhvZGVcIn0sXCJib2R5XCI6e1wieFwiOjIwLFwieVwiOjE1LjIsXCJ3XCI6MjYsXCJoXCI6MjkuNn0sXCJwcmVmaXhcIjpcIkRcIixcInR5cGVBbGlhc2VzXCI6W1wic2Nob3R0a3lfZGlvZGVcIl0sXCJvcmlnaW5cIjp7XCJsaWJyYXJ5XCI6XCJjaHJpcy1waWt1bC9lbGVjdHJvbmljLXN5bWJvbHNcIixcInVybFwiOlwiaHR0cHM6Ly9naXRodWIuY29tL2NocmlzLXBpa3VsL2VsZWN0cm9uaWMtc3ltYm9sc1wiLFwibGljZW5zZVwiOlwiTUlUXCIsXCJjb3B5cmlnaHRcIjpcIkNvcHlyaWdodCAoYykgMjAyMiBDaHJpcyBQaWt1bFwiLFwiZmlsZVwiOlwiU1ZHL0Rpb2RlLUNPTS1TaG90dGt5LnN2Z1wiLFwibW9kaWZpZWRfbm90ZVwiOlwic2NhbGVkIDAuNCwgc3Ryb2tlIG5vcm1hbGl6ZWQgdG8gY3VycmVudENvbG9yXCJ9LFwic3ZnQm9keVwiOlwiPGcgdHJhbnNmb3JtPVxcXCJzY2FsZSgwLjQpIHRyYW5zbGF0ZSgwIDApXFxcIj48ZyBmaWxsPVxcXCJub25lXFxcIiBzdHJva2U9XFxcImN1cnJlbnRDb2xvclxcXCIgc3Ryb2tlLW1pdGVybGltaXQ9XFxcIjEwXFxcIiBzdHJva2Utd2lkdGg9XFxcIjRcXFwiPlxccjxwYXRoIGQ9XFxcIm0xMDAgNzUtNTAgMzEuMjV2LTYyLjVMMTAwIDc1em0tNTAgMEgwbTEwMCAwaDUwXFxcIi8+XFxyPHBhdGggZD1cXFwiTTg3LjUgOTd2MTIuNUgxMDB2LTY5aDEyLjVWNTNcXFwiLz5cXHI8L2c+PC9nPlwifSxcInNyX2ZsaXBmbG9wXCI6e1widHlwZVwiOlwic3JfZmxpcGZsb3BcIixcIm5hbWVcIjpcIlNSIGZsaXAtZmxvcCAoZ2F0ZWQpXCIsXCJjYXRlZ29yeVwiOlwiZGlnaXRhbFwiLFwic3ZnXCI6XCJzeW1ib2wuc3ZnXCIsXCJ3aWR0aFwiOjYwLFwiaGVpZ2h0XCI6NjAsXCJwaW5zXCI6e1wiU1wiOntcInhcIjowLFwieVwiOjIwLFwiZGlyXCI6XCJsZWZ0XCIsXCJpb1wiOlwiaW5cIn0sXCJFXCI6e1wieFwiOjAsXCJ5XCI6MzAsXCJkaXJcIjpcImxlZnRcIixcImlvXCI6XCJpblwifSxcIlJcIjp7XCJ4XCI6MCxcInlcIjo0MCxcImRpclwiOlwibGVmdFwiLFwiaW9cIjpcImluXCJ9LFwiUVwiOntcInhcIjo2MCxcInlcIjoyMCxcImRpclwiOlwicmlnaHRcIixcImlvXCI6XCJvdXRcIn0sXCJRTlwiOntcInhcIjo2MCxcInlcIjo0MCxcImRpclwiOlwicmlnaHRcIixcImlvXCI6XCJvdXRcIn19LFwiYWxpYXNlc1wiOntcInFcdTAzMDRcIjpcIlFOXCIsXCJxX2JhclwiOlwiUU5cIixcInFiYXJcIjpcIlFOXCIsXCJucVwiOlwiUU5cIixcIn5xXCI6XCJRTlwiLFwiY2xvY2tcIjpcIkNMS1wiLFwiY2xrXCI6XCJDTEtcIixcImVuXCI6XCJFXCIsXCJlbmFibGVcIjpcIkVcIixcIkNMS1wiOlwiRVwifSxcImJvZHlcIjp7XCJ4XCI6MTAsXCJ5XCI6NSxcIndcIjo0MCxcImhcIjo1MH0sXCJwcmVmaXhcIjpcIlVcIixcImxhYmVsc1wiOlwidG9wXCIsXCJyZXF1aXJlZFwiOltcIlNcIixcIlJcIl0sXCJ0eXBlQWxpYXNlc1wiOltcInNyZmZcIixcInNyX2xhdGNoXCIsXCJmbGlwZmxvcF9zclwiXSxcIm9yaWdpblwiOntcImxpYnJhcnlcIjpcImNocmlzLXBpa3VsL2VsZWN0cm9uaWMtc3ltYm9sc1wiLFwidXJsXCI6XCJodHRwczovL2dpdGh1Yi5jb20vY2hyaXMtcGlrdWwvZWxlY3Ryb25pYy1zeW1ib2xzXCIsXCJsaWNlbnNlXCI6XCJNSVRcIixcImNvcHlyaWdodFwiOlwiQ29weXJpZ2h0IChjKSAyMDIyIENocmlzIFBpa3VsXCIsXCJmaWxlXCI6XCJTVkcvSUMtQ09NLUZsaXBGbG9wLUdhdGVkU1Iuc3ZnXCIsXCJtb2RpZmllZF9ub3RlXCI6XCJzY2FsZWQgMC40LCBzdHJva2Ugbm9ybWFsaXplZCB0byBjdXJyZW50Q29sb3JcIn0sXCJzdmdCb2R5XCI6XCI8ZyB0cmFuc2Zvcm09XFxcInNjYWxlKDAuNCkgdHJhbnNsYXRlKDAgMClcXFwiPjxwYXRoIGZpbGw9XFxcIm5vbmVcXFwiIHN0cm9rZT1cXFwiY3VycmVudENvbG9yXFxcIiBzdHJva2UtbWl0ZXJsaW1pdD1cXFwiMTBcXFwiIHN0cm9rZS13aWR0aD1cXFwiNFxcXCIgZD1cXFwiTTI1IDEyLjVoMTAwdjEyNUgyNXpNMjUgNTBIMG0yNSA1MEgwbTEyNS01MGgyNW0tMjUgNTBoMjVcXFwiLz5cXHI8cGF0aCBmaWxsPVxcXCJjdXJyZW50Q29sb3JcXFwiIGQ9XFxcIm0xMTEuNTcgNTMuOSAyIDEuMjktMS4zNiAzLjE2LTItMS40NGE0Ljc4IDQuNzggMCAwIDEtNCAyLjM0IDUuMDggNS4wOCAwIDAgMS00LjQ4LTIuNDYgMTIuNTIgMTIuNTIgMCAwIDEtMS43My02LjkxIDEyLjUgMTIuNSAwIDAgMSAxLjYyLTYuODggNS4xNSA1LjE1IDAgMCAxIDguNzkgMCAxMi41IDEyLjUgMCAwIDEgMS41OSA2Ljg4YzAgMy4xOC0uNDMgNC4wMi0uNDMgNC4wMlptLTIuMzctMS4zM2ExMy41MSAxMy41MSAwIDAgMCAuMjQtMi42OSA5LjI1IDkuMjUgMCAwIDAtLjk0LTQuNyAyLjc2IDIuNzYgMCAwIDAtNSAwIDkuMjIgOS4yMiAwIDAgMC0xIDQuNjkgOS40NCA5LjQ0IDAgMCAwIDEgNC43NSAyLjg0IDIuODQgMCAwIDAgMi40MSAxLjU4IDIuNDEgMi40MSAwIDAgMCAxLjktLjg1bC0yLTEuNDQgMS41Mi0yLjY2TTM3IDUzLjA1bDMuMTQtLjM1YTQuNTQgNC41NCAwIDAgMCAxLjE1IDIuNjMgMy4yMyAzLjIzIDAgMCAwIDIuMzQuODQgMy4zIDMuMyAwIDAgMCAyLjM3LS43NSAyLjMyIDIuMzIgMCAwIDAgLjc5LTEuNzQgMS43OSAxLjc5IDAgMCAwLS4zMy0xLjA5IDIuNyAyLjcgMCAwIDAtMS4xNi0uNzljLS4zOC0uMTQtMS4yNC0uNDEtMi41OS0uNzlhOC4zNSA4LjM1IDAgMCAxLTMuNjQtMS43OCA1IDUgMCAwIDEtMS40Ny0zLjY0IDUuMDkgNS4wOSAwIDAgMSAuNjctMi41OSA0LjQ3IDQuNDcgMCAwIDEgMi0xLjgzIDcuMTkgNy4xOSAwIDAgMSAzLjE1LS42M0E2LjE5IDYuMTkgMCAwIDEgNDcuOTQgNDJhNS41NCA1LjU0IDAgMCAxIDEuNiA0bC0zLjIzLjE2YTMuMTUgMy4xNSAwIDAgMC0uODktMiAyLjk0IDIuOTQgMCAwIDAtMi0uNjEgMy4zOSAzLjM5IDAgMCAwLTIuMi42NSAxLjM1IDEuMzUgMCAwIDAtLjUyIDEuMTIgMS40NiAxLjQ2IDAgMCAwIC40OCAxLjEgNy45MSA3LjkxIDAgMCAwIDMgMS4yMUExNC4zMiAxNC4zMiAwIDAgMSA0Ny41OSA0OWE0LjY3IDQuNjcgMCAwIDEgMS43NyAxLjg0IDYuMzIgNi4zMiAwIDAgMS0uMTIgNS43OCA0Ljc0IDQuNzQgMCAwIDEtMi4xNiAyIDguMTIgOC4xMiAwIDAgMS0zLjQ4LjY2IDYuNDMgNi40MyAwIDAgMS00LjY2LTEuNThBNy4zIDcuMyAwIDAgMSAzNyA1My4wNVptLjUgNTYuMlY5MC43OWg1LjkxYTcuODggNy44OCAwIDAgMSAzLjI0LjQ5IDMuNjUgMy42NSAwIDAgMSAxLjYxIDEuNzcgNi42MiA2LjYyIDAgMCAxIC42MSAyLjk1IDYgNiAwIDAgMS0uODcgMy4zOSA0IDQgMCAwIDEtMi43NSAxLjcxIDcuMDYgNy4wNiAwIDAgMSAxLjUgMS41NSAyMS4wNyAyMS4wNyAwIDAgMSAxLjYgM2wxLjcgMy42aC0zLjQxbC0yLTRhMjUuOTQgMjUuOTQgMCAwIDAtMS40OC0yLjcxIDIuMTQgMi4xNCAwIDAgMC0uODQtLjc3IDMuNTMgMy41MyAwIDAgMC0xLjQxLS4yMWgtLjU3djcuNzFabTIuODEtMTAuNjZoMi4wN2E4LjM1IDguMzUgMCAwIDAgMi41My0uMjIgMS42NCAxLjY0IDAgMCAwIC43OC0uNzhBMyAzIDAgMCAwIDQ2IDk2LjJhMi42OSAyLjY5IDAgMCAwLS4zOC0xLjUgMS42MSAxLjYxIDAgMCAwLTEuMDctLjcgMTguNzQgMTguNzQgMCAwIDAtMi0uMDZoLTIuMjRabTcxLjI2IDUuMzEgMiAxLjI5LTEuMzYgMy4xNi0yLTEuNDRhNC43OCA0Ljc4IDAgMCAxLTQgMi4zNCA1LjA4IDUuMDggMCAwIDEtNC40OC0yLjQ2IDEyLjUyIDEyLjUyIDAgMCAxLTEuNzMtNi45MSAxMi41IDEyLjUgMCAwIDEgMS42Mi02Ljg4IDUuMTUgNS4xNSAwIDAgMSA4Ljc5IDAgMTIuNSAxMi41IDAgMCAxIDEuNTkgNi44OGMwIDMuMTgtLjQzIDQuMDItLjQzIDQuMDJabS0yLjM3LTEuMzNhMTMuNTEgMTMuNTEgMCAwIDAgLjI0LTIuNjkgOS4yNSA5LjI1IDAgMCAwLS45NC00LjcgMi43NiAyLjc2IDAgMCAwLTUgMCA5LjIyIDkuMjIgMCAwIDAtMSA0LjY5IDkuNDQgOS40NCAwIDAgMCAxIDQuNzUgMi44NCAyLjg0IDAgMCAwIDIuNDEgMS41OCAyLjQxIDIuNDEgMCAwIDAgMS45LS44NWwtMi0xLjQ0IDEuNTItMi42NlxcXCIvPlxccjxwYXRoIGZpbGw9XFxcIm5vbmVcXFwiIHN0cm9rZT1cXFwiY3VycmVudENvbG9yXFxcIiBzdHJva2UtbWl0ZXJsaW1pdD1cXFwiMTBcXFwiIHN0cm9rZS13aWR0aD1cXFwiNFxcXCIgZD1cXFwiTTk3IDg0LjI1aDE4Ljc1TTI1IDc1SDBcXFwiLz5cXHI8cGF0aCBmaWxsPVxcXCJjdXJyZW50Q29sb3JcXFwiIGQ9XFxcIk0zNy40OCA4NC4zMVY2NS44NWgxMi4xOVY2OUg0MC44djQuMDloOC4yNXYzLjExSDQwLjh2NUg1MHYzLjExWlxcXCIvPjwvZz5cIn0sXCJzd2l0Y2hcIjp7XCJ0eXBlXCI6XCJzd2l0Y2hcIixcIm5hbWVcIjpcIlN3aXRjaCAoU1BTVClcIixcImNhdGVnb3J5XCI6XCJwYXNzaXZlXCIsXCJzdmdcIjpcInN5bWJvbC5zdmdcIixcIndpZHRoXCI6NjAsXCJoZWlnaHRcIjo2MCxcInBpbnNcIjp7XCIxXCI6e1wieFwiOjAsXCJ5XCI6MzAsXCJkaXJcIjpcImxlZnRcIn0sXCIyXCI6e1wieFwiOjYwLFwieVwiOjMwLFwiZGlyXCI6XCJyaWdodFwifX0sXCJib2R5XCI6e1wieFwiOjEyLFwieVwiOjEzLjYsXCJ3XCI6MzYsXCJoXCI6MTkuMn0sXCJwcmVmaXhcIjpcIlNXXCIsXCJ0eXBlQWxpYXNlc1wiOltcInNwc3RcIl0sXCJvcmlnaW5cIjp7XCJsaWJyYXJ5XCI6XCJjaHJpcy1waWt1bC9lbGVjdHJvbmljLXN5bWJvbHNcIixcInVybFwiOlwiaHR0cHM6Ly9naXRodWIuY29tL2NocmlzLXBpa3VsL2VsZWN0cm9uaWMtc3ltYm9sc1wiLFwibGljZW5zZVwiOlwiTUlUXCIsXCJjb3B5cmlnaHRcIjpcIkNvcHlyaWdodCAoYykgMjAyMiBDaHJpcyBQaWt1bFwiLFwiZmlsZVwiOlwiU1ZHL1N3aXRjaC1DT00tU1BTVC5zdmdcIixcIm1vZGlmaWVkX25vdGVcIjpcInNjYWxlZCAwLjQsIHN0cm9rZSBub3JtYWxpemVkIHRvIGN1cnJlbnRDb2xvclwifSxcInN2Z0JvZHlcIjpcIjxnIHRyYW5zZm9ybT1cXFwic2NhbGUoMC40KSB0cmFuc2xhdGUoMCAwKVxcXCI+PGcgZmlsbD1cXFwibm9uZVxcXCIgc3Ryb2tlPVxcXCJjdXJyZW50Q29sb3JcXFwiIHN0cm9rZS1taXRlcmxpbWl0PVxcXCIxMFxcXCIgc3Ryb2tlLXdpZHRoPVxcXCI0XFxcIj5cXHI8Y2lyY2xlIGN4PVxcXCIzNy41XFxcIiBjeT1cXFwiNzVcXFwiIHI9XFxcIjYuMjVcXFwiLz5cXHI8cGF0aCBkPVxcXCJNMCA3NC45NGgzMS4yNVxcXCIvPlxccjxjaXJjbGUgY3g9XFxcIjExMi41XFxcIiBjeT1cXFwiNzVcXFwiIHI9XFxcIjYuMjVcXFwiLz5cXHI8cGF0aCBkPVxcXCJNMTUwIDc1LjA2aC0zMS4yNW0tNzUtMy4zMUwxMDIgMzYuNVxcXCIvPlxccjwvZz48L2c+XCJ9LFwidF9mbGlwZmxvcFwiOntcInR5cGVcIjpcInRfZmxpcGZsb3BcIixcIm5hbWVcIjpcIlQgZmxpcC1mbG9wXCIsXCJjYXRlZ29yeVwiOlwiZGlnaXRhbFwiLFwic3ZnXCI6XCJzeW1ib2wuc3ZnXCIsXCJ3aWR0aFwiOjYwLFwiaGVpZ2h0XCI6NjAsXCJwaW5zXCI6e1wiVFwiOntcInhcIjowLFwieVwiOjIwLFwiZGlyXCI6XCJsZWZ0XCIsXCJpb1wiOlwiaW5cIn0sXCJDTEtcIjp7XCJ4XCI6MCxcInlcIjo0MCxcImRpclwiOlwibGVmdFwiLFwiaW9cIjpcImluXCJ9LFwiUVwiOntcInhcIjo2MCxcInlcIjoyMCxcImRpclwiOlwicmlnaHRcIixcImlvXCI6XCJvdXRcIn0sXCJRTlwiOntcInhcIjo2MCxcInlcIjo0MCxcImRpclwiOlwicmlnaHRcIixcImlvXCI6XCJvdXRcIn19LFwiYWxpYXNlc1wiOntcInFcdTAzMDRcIjpcIlFOXCIsXCJxX2JhclwiOlwiUU5cIixcInFiYXJcIjpcIlFOXCIsXCJucVwiOlwiUU5cIixcIn5xXCI6XCJRTlwiLFwiY2xvY2tcIjpcIkNMS1wiLFwiY2xrXCI6XCJDTEtcIn0sXCJib2R5XCI6e1wieFwiOjEwLFwieVwiOjUsXCJ3XCI6NDAsXCJoXCI6NTB9LFwicHJlZml4XCI6XCJVXCIsXCJsYWJlbHNcIjpcInRvcFwiLFwicmVxdWlyZWRcIjpbXCJUXCIsXCJDTEtcIl0sXCJ0eXBlQWxpYXNlc1wiOltcInRmZlwiLFwiZmxpcGZsb3BfdFwiXSxcIm9yaWdpblwiOntcImxpYnJhcnlcIjpcImNocmlzLXBpa3VsL2VsZWN0cm9uaWMtc3ltYm9sc1wiLFwidXJsXCI6XCJodHRwczovL2dpdGh1Yi5jb20vY2hyaXMtcGlrdWwvZWxlY3Ryb25pYy1zeW1ib2xzXCIsXCJsaWNlbnNlXCI6XCJNSVRcIixcImNvcHlyaWdodFwiOlwiQ29weXJpZ2h0IChjKSAyMDIyIENocmlzIFBpa3VsXCIsXCJmaWxlXCI6XCJTVkcvSUMtQ09NLUZsaXBGbG9wLUNsb2NrZWRULnN2Z1wiLFwibW9kaWZpZWRfbm90ZVwiOlwic2NhbGVkIDAuNCwgc3Ryb2tlIG5vcm1hbGl6ZWQgdG8gY3VycmVudENvbG9yXCJ9LFwic3ZnQm9keVwiOlwiPGcgdHJhbnNmb3JtPVxcXCJzY2FsZSgwLjQpIHRyYW5zbGF0ZSgwIDApXFxcIj48cGF0aCBmaWxsPVxcXCJub25lXFxcIiBzdHJva2U9XFxcImN1cnJlbnRDb2xvclxcXCIgc3Ryb2tlLW1pdGVybGltaXQ9XFxcIjEwXFxcIiBzdHJva2Utd2lkdGg9XFxcIjRcXFwiIGQ9XFxcIk0yNSAxMi41aDEwMHYxMjVIMjV6TTI1IDUwSDBtMjUgNTBIMG0xMjUtNTBoMjVtLTI1IDUwaDI1XFxcIi8+XFxyPHBhdGggZmlsbD1cXFwiY3VycmVudENvbG9yXFxcIiBkPVxcXCJtMTExLjU3IDUzLjkgMiAxLjI5LTEuMzYgMy4xNi0yLTEuNDRhNC43OCA0Ljc4IDAgMCAxLTQgMi4zNCA1LjA4IDUuMDggMCAwIDEtNC40OC0yLjQ2IDEyLjUyIDEyLjUyIDAgMCAxLTEuNzMtNi45MSAxMi41IDEyLjUgMCAwIDEgMS42Mi02Ljg4IDUuMTUgNS4xNSAwIDAgMSA4Ljc5IDAgMTIuNSAxMi41IDAgMCAxIDEuNTkgNi44OGMwIDMuMTgtLjQzIDQuMDItLjQzIDQuMDJabS0yLjM3LTEuMzNhMTMuNTEgMTMuNTEgMCAwIDAgLjI0LTIuNjkgOS4yNSA5LjI1IDAgMCAwLS45NC00LjcgMi43NiAyLjc2IDAgMCAwLTUgMCA5LjIyIDkuMjIgMCAwIDAtMSA0LjY5IDkuNDQgOS40NCAwIDAgMCAxIDQuNzUgMi44NCAyLjg0IDAgMCAwIDIuNDEgMS41OCAyLjQxIDIuNDEgMCAwIDAgMS45LS44NWwtMi0xLjQ0IDEuNTItMi42Nm00LjI0IDUyLjY1IDIgMS4yOS0xLjM2IDMuMTYtMi0xLjQ0YTQuNzggNC43OCAwIDAgMS00IDIuMzQgNS4wOCA1LjA4IDAgMCAxLTQuNDgtMi40NiAxMi41MiAxMi41MiAwIDAgMS0xLjczLTYuOTEgMTIuNSAxMi41IDAgMCAxIDEuNjItNi44OCA1LjE1IDUuMTUgMCAwIDEgOC43OSAwIDEyLjUgMTIuNSAwIDAgMSAxLjU5IDYuODhjMCAzLjE4LS40MyA0LjAyLS40MyA0LjAyWm0tMi4zNy0xLjMzYTEzLjUxIDEzLjUxIDAgMCAwIC4yNC0yLjY5IDkuMjUgOS4yNSAwIDAgMC0uOTQtNC43IDIuNzYgMi43NiAwIDAgMC01IDAgOS4yMiA5LjIyIDAgMCAwLTEgNC42OSA5LjQ0IDkuNDQgMCAwIDAgMSA0Ljc1IDIuODQgMi44NCAwIDAgMCAyLjQxIDEuNTggMi40MSAyLjQxIDAgMCAwIDEuOS0uODVsLTItMS40NCAxLjUyLTIuNjZcXFwiLz5cXHI8cGF0aCBmaWxsPVxcXCJub25lXFxcIiBzdHJva2U9XFxcImN1cnJlbnRDb2xvclxcXCIgc3Ryb2tlLW1pdGVybGltaXQ9XFxcIjEwXFxcIiBzdHJva2Utd2lkdGg9XFxcIjRcXFwiIGQ9XFxcIk05NyA4NC4yNWgxOC43NU0yNSA4Ny41IDUwIDEwMGwtMjUgMTIuNXYtMjV6XFxcIi8+XFxyPHBhdGggZmlsbD1cXFwiY3VycmVudENvbG9yXFxcIiBkPVxcXCJNNDIuMTcgNTkuMjVWNDMuNjdIMzcuNVY0MC41SDUwdjMuMTdoLTQuNjZ2MTUuNThaXFxcIi8+PC9nPlwifSxcInRlc3RfcG9pbnRcIjp7XCJ0eXBlXCI6XCJ0ZXN0X3BvaW50XCIsXCJuYW1lXCI6XCJUZXN0IHBvaW50XCIsXCJjYXRlZ29yeVwiOlwicG93ZXJcIixcIndpZHRoXCI6MjAsXCJoZWlnaHRcIjozMCxcInBpbnNcIjp7XCIxXCI6e1wieFwiOjEwLFwieVwiOjMwLFwiZGlyXCI6XCJkb3duXCJ9fSxcImJvZHlcIjp7XCJ4XCI6NCxcInlcIjoyLFwid1wiOjEyLFwiaFwiOjEyfSxcImxhYmVsc1wiOlwibm9uZVwiLFwidGV4dFwiOntcInhcIjoxOCxcInlcIjo4LFwiYW5jaG9yXCI6XCJzdGFydFwiLFwiZGVmYXVsdFwiOlwiJGlkXCJ9LFwicHJlZml4XCI6XCJUUFwiLFwidHlwZUFsaWFzZXNcIjpbXCJ0ZXN0cG9pbnRcIixcInRwXCIsXCJwcm9iZVwiXSxcInN2Z1wiOlwic3ltYm9sLnN2Z1wiLFwib3JpZ2luXCI6e1wibGlicmFyeVwiOlwiQ2lyY3VpdEZvcmdlXCIsXCJsaWNlbnNlXCI6XCJzYW1lIGFzIHRoZSBDaXJjdWl0Rm9yZ2UgcHJvamVjdFwiLFwibm90ZVwiOlwib3JpZ2luYWwgQ2lyY3VpdEZvcmdlIHN5bWJvbFwifSxcInN2Z0JvZHlcIjpcIjxnIGZpbGw9XFxcIm5vbmVcXFwiIHN0cm9rZT1cXFwiY3VycmVudENvbG9yXFxcIiBzdHJva2Utd2lkdGg9XFxcIjEuNlxcXCIgc3Ryb2tlLWxpbmVjYXA9XFxcInJvdW5kXFxcIj48Y2lyY2xlIGN4PVxcXCIxMFxcXCIgY3k9XFxcIjhcXFwiIHI9XFxcIjVcXFwiLz48cGF0aCBkPVxcXCJNMTAgMTN2MTdcXFwiLz48L2c+XCJ9LFwidGltZXJfNTU1XCI6e1widHlwZVwiOlwidGltZXJfNTU1XCIsXCJuYW1lXCI6XCI1NTUgdGltZXJcIixcImNhdGVnb3J5XCI6XCJpY1wiLFwia2luZFwiOlwiYm94XCIsXCJsYWJlbFwiOlwiNTU1XCIsXCJwaW5zXCI6e1wibGVmdFwiOltcIkRJU1wiLFwiVEhSXCIsXCJUUklHXCJdLFwicmlnaHRcIjpbXCJPVVRcIixcIkNWXCJdLFwidG9wXCI6W1wiVkNDXCIsXCJSU1RcIl0sXCJib3R0b21cIjpbXCJHTkRcIl19LFwicHJlZml4XCI6XCJVXCIsXCJhbGlhc2VzXCI6e1wiMVwiOlwiR05EXCIsXCIyXCI6XCJUUklHXCIsXCIzXCI6XCJPVVRcIixcIjRcIjpcIlJTVFwiLFwiNVwiOlwiQ1ZcIixcIjZcIjpcIlRIUlwiLFwiN1wiOlwiRElTXCIsXCI4XCI6XCJWQ0NcIixcInRyaWdnZXJcIjpcIlRSSUdcIixcInRocmVzaG9sZFwiOlwiVEhSXCIsXCJjb250cm9sXCI6XCJDVlwiLFwiY3RybFwiOlwiQ1ZcIixcInJlc2V0XCI6XCJSU1RcIixcImRpc2NoYXJnZVwiOlwiRElTXCIsXCJvdXRwdXRcIjpcIk9VVFwiLFwidmRkXCI6XCJWQ0NcIn0sXCJyZXF1aXJlZFwiOltcIlZDQ1wiLFwiR05EXCIsXCJPVVRcIl0sXCJ0eXBlQWxpYXNlc1wiOltcIjU1NVwiLFwibmU1NTVcIixcInRpbWVyXCJdLFwib3JpZ2luXCI6e1wibGlicmFyeVwiOlwiQ2lyY3VpdEZvcmdlXCIsXCJsaWNlbnNlXCI6XCJzYW1lIGFzIHRoZSBDaXJjdWl0Rm9yZ2UgcHJvamVjdFwiLFwibm90ZVwiOlwib3JpZ2luYWwgQ2lyY3VpdEZvcmdlIHN5bWJvbFwifX0sXCJ0cmFuc2Zvcm1lclwiOntcInR5cGVcIjpcInRyYW5zZm9ybWVyXCIsXCJuYW1lXCI6XCJUcmFuc2Zvcm1lclwiLFwiY2F0ZWdvcnlcIjpcInBhc3NpdmVcIixcInN2Z1wiOlwic3ltYm9sLnN2Z1wiLFwid2lkdGhcIjo2MCxcImhlaWdodFwiOjcwLFwicGluc1wiOntcInAxXCI6e1wieFwiOjAsXCJ5XCI6MTAsXCJkaXJcIjpcImxlZnRcIn0sXCJwMlwiOntcInhcIjowLFwieVwiOjYwLFwiZGlyXCI6XCJsZWZ0XCJ9LFwiczFcIjp7XCJ4XCI6NjAsXCJ5XCI6MTAsXCJkaXJcIjpcInJpZ2h0XCJ9LFwiczJcIjp7XCJ4XCI6NjAsXCJ5XCI6NjAsXCJkaXJcIjpcInJpZ2h0XCJ9fSxcImFsaWFzZXNcIjp7XCIxXCI6XCJwMVwiLFwiMlwiOlwicDJcIixcIjNcIjpcInMxXCIsXCI0XCI6XCJzMlwiLFwicHJpMVwiOlwicDFcIixcInByaTJcIjpcInAyXCIsXCJzZWMxXCI6XCJzMVwiLFwic2VjMlwiOlwiczJcIn0sXCJib2R5XCI6e1wieFwiOjgsXCJ5XCI6Ni42LFwid1wiOjQ0LFwiaFwiOjU2Ljh9LFwicHJlZml4XCI6XCJUXCIsXCJvcmlnaW5cIjp7XCJsaWJyYXJ5XCI6XCJjaHJpcy1waWt1bC9lbGVjdHJvbmljLXN5bWJvbHNcIixcInVybFwiOlwiaHR0cHM6Ly9naXRodWIuY29tL2NocmlzLXBpa3VsL2VsZWN0cm9uaWMtc3ltYm9sc1wiLFwibGljZW5zZVwiOlwiTUlUXCIsXCJjb3B5cmlnaHRcIjpcIkNvcHlyaWdodCAoYykgMjAyMiBDaHJpcyBQaWt1bFwiLFwiZmlsZVwiOlwiU1ZHL1RyYW5zZm9ybWVyLUNPTS1TdGFuZGFyZC5zdmdcIixcIm1vZGlmaWVkX25vdGVcIjpcInNjYWxlZCAwLjQsIHN0cm9rZSBub3JtYWxpemVkIHRvIGN1cnJlbnRDb2xvclwifSxcInN2Z0JvZHlcIjpcIjxnIHRyYW5zZm9ybT1cXFwic2NhbGUoMC40KSB0cmFuc2xhdGUoMCAxMi41KVxcXCI+PGcgZmlsbD1cXFwibm9uZVxcXCIgc3Ryb2tlPVxcXCJjdXJyZW50Q29sb3JcXFwiIHN0cm9rZS1saW5lam9pbj1cXFwicm91bmRcXFwiIHN0cm9rZS13aWR0aD1cXFwiNFxcXCI+XFxyPHBhdGggZD1cXFwiTTAgMTIuNWgzNy41czE4LjgxIDAgMTguODEgMTUuNjMtMTguNjggMTUuNjItMTguNjggMTUuNjIgMTguNzUgMCAxOC43NSAxNS42M1MzNy42MyA3NSAzNy42MyA3NXMxOC43NSAwIDE4Ljc1IDE1LjYzLTE4Ljc1IDE1LjYyLTE4Ljc1IDE1LjYyIDE4Ljc1IDAgMTguNzUgMTUuNjMtMTguNzUgMTUuNjItMTguNzUgMTUuNjJIME02OC43NSA2LjI1djEzNy41bTEyLjUgMFY2LjI1XFxcIi8+XFxyPHBhdGggZD1cXFwiTTE1MC4xMyAxMzcuNWgtMzcuNXMtMTguODIgMC0xOC44Mi0xNS42MiAxOC42OS0xNS42MyAxOC42OS0xNS42My0xOC43NSAwLTE4Ljc1LTE1LjYyUzExMi41IDc1IDExMi41IDc1cy0xOC43NSAwLTE4Ljc1LTE1LjYyIDE4Ljc1LTE1LjYzIDE4Ljc1LTE1LjYzLTE4Ljc1IDAtMTguNzUtMTUuNjJTMTEyLjUgMTIuNSAxMTIuNSAxMi41aDM3LjYzXFxcIiBkYXRhLW5hbWU9XFxcIkluZHVjdG9yXFxcIi8+XFxyPC9nPjwvZz5cIn0sXCJ0cmlzdGF0ZV9idWZmZXJcIjp7XCJ0eXBlXCI6XCJ0cmlzdGF0ZV9idWZmZXJcIixcIm5hbWVcIjpcIlRyaS1zdGF0ZSBidWZmZXJcIixcImNhdGVnb3J5XCI6XCJkaWdpdGFsXCIsXCJzdmdcIjpcInN5bWJvbC5zdmdcIixcIndpZHRoXCI6NjAsXCJoZWlnaHRcIjo2MCxcInBpbnNcIjp7XCJBXCI6e1wieFwiOjAsXCJ5XCI6MzAsXCJkaXJcIjpcImxlZnRcIixcImlvXCI6XCJpblwifSxcIllcIjp7XCJ4XCI6NjAsXCJ5XCI6MzAsXCJkaXJcIjpcInJpZ2h0XCIsXCJpb1wiOlwib3V0XCJ9LFwiRU5cIjp7XCJ4XCI6MzAsXCJ5XCI6MCxcImRpclwiOlwidXBcIixcImlvXCI6XCJpblwifX0sXCJhbGlhc2VzXCI6e1wiMVwiOlwiQVwiLFwiMlwiOlwiWVwiLFwiM1wiOlwiRU5cIixcImluXCI6XCJBXCIsXCJvdXRcIjpcIllcIixcImlucHV0XCI6XCJBXCIsXCJvdXRwdXRcIjpcIllcIixcIm9lXCI6XCJFTlwiLFwiZW5cIjpcIkVOXCIsXCJlbmFibGVcIjpcIkVOXCJ9LFwiYm9keVwiOntcInhcIjoxMCxcInlcIjoxNSxcIndcIjozNSxcImhcIjozMH0sXCJwcmVmaXhcIjpcIlVcIixcImxhYmVsc1wiOlwicmlnaHRcIixcInR5cGVBbGlhc2VzXCI6W1widHJpc3RhdGVcIixcInRyaV9zdGF0ZV9idWZmZXJcIl0sXCJvcmlnaW5cIjp7XCJsaWJyYXJ5XCI6XCJjaHJpcy1waWt1bC9lbGVjdHJvbmljLXN5bWJvbHNcIixcInVybFwiOlwiaHR0cHM6Ly9naXRodWIuY29tL2NocmlzLXBpa3VsL2VsZWN0cm9uaWMtc3ltYm9sc1wiLFwibGljZW5zZVwiOlwiTUlUXCIsXCJjb3B5cmlnaHRcIjpcIkNvcHlyaWdodCAoYykgMjAyMiBDaHJpcyBQaWt1bFwiLFwiZmlsZVwiOlwiU1ZHL0lDLUNPTS1Mb2dpYy1CdWZmZXIuc3ZnXCIsXCJtb2RpZmllZFwiOlwiZW5hYmxlIHBpbiBhZGRlZCBieSBDaXJjdWl0Rm9yZ2VcIixcIm1vZGlmaWVkX25vdGVcIjpcInNjYWxlZCAwLjQsIHN0cm9rZSBub3JtYWxpemVkIHRvIGN1cnJlbnRDb2xvclwifSxcInN2Z0JvZHlcIjpcIjxnIHRyYW5zZm9ybT1cXFwic2NhbGUoMC40KSB0cmFuc2xhdGUoMCAwKVxcXCI+PHBhdGggZmlsbD1cXFwibm9uZVxcXCIgc3Ryb2tlPVxcXCJjdXJyZW50Q29sb3JcXFwiIHN0cm9rZS1taXRlcmxpbWl0PVxcXCIxMFxcXCIgc3Ryb2tlLXdpZHRoPVxcXCI0XFxcIiBkPVxcXCJNMjUgMzcuNXY3NUwxMTIuNSA3NSAyNSAzNy41ek0yNSA3NUgwbTExMi41IDBIMTUwXFxcIi8+PHBhdGggZmlsbD1cXFwibm9uZVxcXCIgc3Ryb2tlPVxcXCJjdXJyZW50Q29sb3JcXFwiIHN0cm9rZS13aWR0aD1cXFwiNFxcXCIgZD1cXFwiTTc1IDB2NTguOVxcXCIvPjwvZz5cIn0sXCJ2YXJpYWJsZV9yZXNpc3RvclwiOntcInR5cGVcIjpcInZhcmlhYmxlX3Jlc2lzdG9yXCIsXCJuYW1lXCI6XCJWYXJpYWJsZSByZXNpc3RvclwiLFwiY2F0ZWdvcnlcIjpcInBhc3NpdmVcIixcInN2Z1wiOlwic3ltYm9sLnN2Z1wiLFwid2lkdGhcIjo2MCxcImhlaWdodFwiOjYwLFwicGluc1wiOntcIjFcIjp7XCJ4XCI6MCxcInlcIjozMCxcImRpclwiOlwibGVmdFwifSxcIjJcIjp7XCJ4XCI6NjAsXCJ5XCI6MzAsXCJkaXJcIjpcInJpZ2h0XCJ9fSxcImJvZHlcIjp7XCJ4XCI6MTAsXCJ5XCI6MTAsXCJ3XCI6NDAsXCJoXCI6NDB9LFwicHJlZml4XCI6XCJSXCIsXCJ0eXBlQWxpYXNlc1wiOltcInJoZW9zdGF0XCJdLFwib3JpZ2luXCI6e1wibGlicmFyeVwiOlwiY2hyaXMtcGlrdWwvZWxlY3Ryb25pYy1zeW1ib2xzXCIsXCJ1cmxcIjpcImh0dHBzOi8vZ2l0aHViLmNvbS9jaHJpcy1waWt1bC9lbGVjdHJvbmljLXN5bWJvbHNcIixcImxpY2Vuc2VcIjpcIk1JVFwiLFwiY29weXJpZ2h0XCI6XCJDb3B5cmlnaHQgKGMpIDIwMjIgQ2hyaXMgUGlrdWxcIixcImZpbGVcIjpcIlNWRy9SZXNpc3Rvci1JRUVFLVJoZW9zdGF0LnN2Z1wiLFwibW9kaWZpZWRfbm90ZVwiOlwic2NhbGVkIDAuNCwgc3Ryb2tlIG5vcm1hbGl6ZWQgdG8gY3VycmVudENvbG9yXCJ9LFwic3ZnQm9keVwiOlwiPGcgdHJhbnNmb3JtPVxcXCJzY2FsZSgwLjQpIHRyYW5zbGF0ZSgwIDApXFxcIj48cGF0aCBmaWxsPVxcXCJub25lXFxcIiBzdHJva2U9XFxcImN1cnJlbnRDb2xvclxcXCIgc3Ryb2tlLWxpbmVqb2luPVxcXCJiZXZlbFxcXCIgc3Ryb2tlLXdpZHRoPVxcXCI0XFxcIiBkPVxcXCJNMCA3NC45NGgzMS4yNWwxMC4yOS0yNC45N0w1NC45MiAxMDBsMTMuMzktNTAgMTMuMzggNTAgMTMuMzktNDkuNjJMMTA4LjQ2IDEwMGwxMC4yOS0yNUgxNTBcXFwiLz5cXHI8cGF0aCBmaWxsPVxcXCJub25lXFxcIiBzdHJva2U9XFxcImN1cnJlbnRDb2xvclxcXCIgc3Ryb2tlLW1pdGVybGltaXQ9XFxcIjEwXFxcIiBzdHJva2Utd2lkdGg9XFxcIjRcXFwiIGQ9XFxcIm0yNSAxMjUgODcuMzEtODcuMzFcXFwiLz5cXHI8cGF0aCBmaWxsPVxcXCJjdXJyZW50Q29sb3JcXFwiIGQ9XFxcIk0xMTguNTUgNDkuMDggMTI1IDI1bC0yNC4wOCA2LjQ1IDE3LjYzIDE3LjYzelxcXCIvPjwvZz5cIn0sXCJ2Y2NcIjp7XCJ0eXBlXCI6XCJ2Y2NcIixcIm5hbWVcIjpcIlZDQyByYWlsXCIsXCJjYXRlZ29yeVwiOlwicG93ZXJcIixcIndpZHRoXCI6NDAsXCJoZWlnaHRcIjo0MCxcInBpbnNcIjp7XCIxXCI6e1wieFwiOjIwLFwieVwiOjQwLFwiZGlyXCI6XCJkb3duXCJ9fSxcImJvZHlcIjp7XCJ4XCI6OCxcInlcIjoxNCxcIndcIjoyNCxcImhcIjoyNn0sXCJyYWlsXCI6XCJwb3dlclwiLFwidGV4dFwiOntcInhcIjoyMCxcInlcIjo5LFwiYW5jaG9yXCI6XCJtaWRkbGVcIixcImRlZmF1bHRcIjpcIlZDQ1wifSxcInR5cGVBbGlhc2VzXCI6W1wicG93ZXJfcmFpbFwiLFwicmFpbFwiLFwidnBsdXNcIixcInYrXCIsXCJzdXBwbHlcIl0sXCJzdmdcIjpcInN5bWJvbC5zdmdcIixcIm9yaWdpblwiOntcImxpYnJhcnlcIjpcIkNpcmN1aXRGb3JnZVwiLFwibGljZW5zZVwiOlwic2FtZSBhcyB0aGUgQ2lyY3VpdEZvcmdlIHByb2plY3RcIixcIm5vdGVcIjpcIm9yaWdpbmFsIENpcmN1aXRGb3JnZSBzeW1ib2xcIn0sXCJzdmdCb2R5XCI6XCI8ZyBmaWxsPVxcXCJub25lXFxcIiBzdHJva2U9XFxcImN1cnJlbnRDb2xvclxcXCIgc3Ryb2tlLXdpZHRoPVxcXCIxLjZcXFwiIHN0cm9rZS1saW5lY2FwPVxcXCJyb3VuZFxcXCI+PHBhdGggZD1cXFwiTTIwIDQwVjE2TTggMTZoMjRcXFwiLz48L2c+XCJ9LFwidmRkXCI6e1widHlwZVwiOlwidmRkXCIsXCJuYW1lXCI6XCJWREQgcmFpbFwiLFwiY2F0ZWdvcnlcIjpcInBvd2VyXCIsXCJ3aWR0aFwiOjQwLFwiaGVpZ2h0XCI6NDAsXCJwaW5zXCI6e1wiMVwiOntcInhcIjoyMCxcInlcIjo0MCxcImRpclwiOlwiZG93blwifX0sXCJib2R5XCI6e1wieFwiOjgsXCJ5XCI6MTQsXCJ3XCI6MjQsXCJoXCI6MjZ9LFwicmFpbFwiOlwicG93ZXJcIixcInRleHRcIjp7XCJ4XCI6MjAsXCJ5XCI6OSxcImFuY2hvclwiOlwibWlkZGxlXCIsXCJkZWZhdWx0XCI6XCJWRERcIn0sXCJ0eXBlQWxpYXNlc1wiOltdLFwic3ZnXCI6XCJzeW1ib2wuc3ZnXCIsXCJvcmlnaW5cIjp7XCJsaWJyYXJ5XCI6XCJDaXJjdWl0Rm9yZ2VcIixcImxpY2Vuc2VcIjpcInNhbWUgYXMgdGhlIENpcmN1aXRGb3JnZSBwcm9qZWN0XCIsXCJub3RlXCI6XCJvcmlnaW5hbCBDaXJjdWl0Rm9yZ2Ugc3ltYm9sXCJ9LFwic3ZnQm9keVwiOlwiPGcgZmlsbD1cXFwibm9uZVxcXCIgc3Ryb2tlPVxcXCJjdXJyZW50Q29sb3JcXFwiIHN0cm9rZS13aWR0aD1cXFwiMS42XFxcIiBzdHJva2UtbGluZWNhcD1cXFwicm91bmRcXFwiPjxwYXRoIGQ9XFxcIk0yMCA0MFYxNk04IDE2aDI0XFxcIi8+PC9nPlwifSxcInZvbHRhZ2VfcmVndWxhdG9yXCI6e1widHlwZVwiOlwidm9sdGFnZV9yZWd1bGF0b3JcIixcIm5hbWVcIjpcIlZvbHRhZ2UgcmVndWxhdG9yXCIsXCJjYXRlZ29yeVwiOlwiYW5hbG9nXCIsXCJraW5kXCI6XCJib3hcIixcImxhYmVsXCI6XCJSRUdcIixcInBpbnNcIjp7XCJsZWZ0XCI6W1wiSU5cIl0sXCJyaWdodFwiOltcIk9VVFwiXSxcImJvdHRvbVwiOltcIkdORFwiXX0sXCJwcmVmaXhcIjpcIlVcIixcImFsaWFzZXNcIjp7XCIxXCI6XCJJTlwiLFwiMlwiOlwiR05EXCIsXCIzXCI6XCJPVVRcIixcInZpblwiOlwiSU5cIixcInZvdXRcIjpcIk9VVFwiLFwiaW5wdXRcIjpcIklOXCIsXCJvdXRwdXRcIjpcIk9VVFwiLFwiYWRqXCI6XCJHTkRcIn0sXCJyZXF1aXJlZFwiOltcIklOXCIsXCJPVVRcIixcIkdORFwiXSxcInR5cGVBbGlhc2VzXCI6W1wicmVndWxhdG9yXCIsXCJsZG9cIixcIjc4MDVcIixcImxtNzgwNVwiXSxcIm9yaWdpblwiOntcImxpYnJhcnlcIjpcIkNpcmN1aXRGb3JnZVwiLFwibGljZW5zZVwiOlwic2FtZSBhcyB0aGUgQ2lyY3VpdEZvcmdlIHByb2plY3RcIixcIm5vdGVcIjpcIm9yaWdpbmFsIENpcmN1aXRGb3JnZSBzeW1ib2xcIn19LFwidnNzXCI6e1widHlwZVwiOlwidnNzXCIsXCJuYW1lXCI6XCJWU1MgcmFpbFwiLFwiY2F0ZWdvcnlcIjpcInBvd2VyXCIsXCJ3aWR0aFwiOjQwLFwiaGVpZ2h0XCI6NDAsXCJwaW5zXCI6e1wiMVwiOntcInhcIjoyMCxcInlcIjowLFwiZGlyXCI6XCJ1cFwifX0sXCJib2R5XCI6e1wieFwiOjgsXCJ5XCI6MCxcIndcIjoyNCxcImhcIjoyNn0sXCJyYWlsXCI6XCJuZWdhdGl2ZVwiLFwidGV4dFwiOntcInhcIjoyMCxcInlcIjozOCxcImFuY2hvclwiOlwibWlkZGxlXCIsXCJkZWZhdWx0XCI6XCJWU1NcIn0sXCJ0eXBlQWxpYXNlc1wiOltcInZlZVwiLFwidi1cIixcIm5lZ2F0aXZlX3JhaWxcIl0sXCJzdmdcIjpcInN5bWJvbC5zdmdcIixcIm9yaWdpblwiOntcImxpYnJhcnlcIjpcIkNpcmN1aXRGb3JnZVwiLFwibGljZW5zZVwiOlwic2FtZSBhcyB0aGUgQ2lyY3VpdEZvcmdlIHByb2plY3RcIixcIm5vdGVcIjpcIm9yaWdpbmFsIENpcmN1aXRGb3JnZSBzeW1ib2xcIn0sXCJzdmdCb2R5XCI6XCI8ZyBmaWxsPVxcXCJub25lXFxcIiBzdHJva2U9XFxcImN1cnJlbnRDb2xvclxcXCIgc3Ryb2tlLXdpZHRoPVxcXCIxLjZcXFwiIHN0cm9rZS1saW5lY2FwPVxcXCJyb3VuZFxcXCI+PHBhdGggZD1cXFwiTTIwIDB2MjRNOCAyNGgyNFxcXCIvPjwvZz5cIn0sXCJ4bm9yXCI6e1widHlwZVwiOlwieG5vclwiLFwibmFtZVwiOlwiWE5PUiBnYXRlXCIsXCJjYXRlZ29yeVwiOlwiZGlnaXRhbFwiLFwic3ZnXCI6XCJzeW1ib2wuc3ZnXCIsXCJ3aWR0aFwiOjYwLFwiaGVpZ2h0XCI6NjAsXCJwaW5zXCI6e1wiQVwiOntcInhcIjowLFwieVwiOjIwLFwiZGlyXCI6XCJsZWZ0XCIsXCJpb1wiOlwiaW5cIn0sXCJCXCI6e1wieFwiOjAsXCJ5XCI6NDAsXCJkaXJcIjpcImxlZnRcIixcImlvXCI6XCJpblwifSxcIllcIjp7XCJ4XCI6NjAsXCJ5XCI6MzAsXCJkaXJcIjpcInJpZ2h0XCIsXCJpb1wiOlwib3V0XCJ9fSxcImFsaWFzZXNcIjp7XCIxXCI6XCJBXCIsXCIyXCI6XCJCXCIsXCIzXCI6XCJZXCIsXCJpbjFcIjpcIkFcIixcImluMlwiOlwiQlwiLFwib3V0XCI6XCJZXCIsXCJxXCI6XCJZXCIsXCJvXCI6XCJZXCIsXCJvdXRwdXRcIjpcIllcIn0sXCJib2R5XCI6e1wieFwiOjcuMixcInlcIjoxNSxcIndcIjo0Ni44LFwiaFwiOjMwfSxcInByZWZpeFwiOlwiVVwiLFwibGFiZWxzXCI6XCJ0b3BcIixcInR5cGVBbGlhc2VzXCI6W1wieG5vcl9nYXRlXCJdLFwib3JpZ2luXCI6e1wibGlicmFyeVwiOlwiY2hyaXMtcGlrdWwvZWxlY3Ryb25pYy1zeW1ib2xzXCIsXCJ1cmxcIjpcImh0dHBzOi8vZ2l0aHViLmNvbS9jaHJpcy1waWt1bC9lbGVjdHJvbmljLXN5bWJvbHNcIixcImxpY2Vuc2VcIjpcIk1JVFwiLFwiY29weXJpZ2h0XCI6XCJDb3B5cmlnaHQgKGMpIDIwMjIgQ2hyaXMgUGlrdWxcIixcImZpbGVcIjpcIlNWRy9JQy1DT00tTG9naWMtWE5PUi5zdmdcIixcIm1vZGlmaWVkX25vdGVcIjpcInNjYWxlZCAwLjQsIHN0cm9rZSBub3JtYWxpemVkIHRvIGN1cnJlbnRDb2xvclwifSxcInN2Z0JvZHlcIjpcIjxnIHRyYW5zZm9ybT1cXFwic2NhbGUoMC40KSB0cmFuc2xhdGUoMCAwKVxcXCI+PGcgZmlsbD1cXFwibm9uZVxcXCIgc3Ryb2tlPVxcXCJjdXJyZW50Q29sb3JcXFwiIHN0cm9rZS1taXRlcmxpbWl0PVxcXCIxMFxcXCIgc3Ryb2tlLXdpZHRoPVxcXCI0XFxcIj5cXHI8cGF0aCBkPVxcXCJNMzEuMjUgMzcuNWgyNWMzNy41IDAgNTYuMjUgMzcuNSA1Ni4yNSAzNy41cy0xOC43NSAzNy41LTU2LjI1IDM3LjVoLTI1czEyLjUtMTguNzUgMTIuNS0zNy41LTEyLjUtMzcuNS0xMi41LTM3LjVaTTAgNDkuODFoMzcuNU0wIDEwMC4wNmgzNy41bTk3LTI0LjkzSDE1MFxcXCIvPlxccjxjaXJjbGUgY3g9XFxcIjEyNC44OFxcXCIgY3k9XFxcIjc1XFxcIiByPVxcXCI5LjM4XFxcIi8+XFxyPHBhdGggZD1cXFwiTTE4Ljc1IDExMi41czEyLjUtMTguNzUgMTIuNS0zNy41LTEyLjUtMzcuOTUtMTIuNS0zNy45NVxcXCIvPlxccjwvZz48L2c+XCJ9LFwieG9yXCI6e1widHlwZVwiOlwieG9yXCIsXCJuYW1lXCI6XCJYT1IgZ2F0ZVwiLFwiY2F0ZWdvcnlcIjpcImRpZ2l0YWxcIixcInN2Z1wiOlwic3ltYm9sLnN2Z1wiLFwid2lkdGhcIjo2MCxcImhlaWdodFwiOjYwLFwicGluc1wiOntcIkFcIjp7XCJ4XCI6MCxcInlcIjoyMCxcImRpclwiOlwibGVmdFwiLFwiaW9cIjpcImluXCJ9LFwiQlwiOntcInhcIjowLFwieVwiOjQwLFwiZGlyXCI6XCJsZWZ0XCIsXCJpb1wiOlwiaW5cIn0sXCJZXCI6e1wieFwiOjYwLFwieVwiOjMwLFwiZGlyXCI6XCJyaWdodFwiLFwiaW9cIjpcIm91dFwifX0sXCJhbGlhc2VzXCI6e1wiMVwiOlwiQVwiLFwiMlwiOlwiQlwiLFwiM1wiOlwiWVwiLFwiaW4xXCI6XCJBXCIsXCJpbjJcIjpcIkJcIixcIm91dFwiOlwiWVwiLFwicVwiOlwiWVwiLFwib1wiOlwiWVwiLFwib3V0cHV0XCI6XCJZXCJ9LFwiYm9keVwiOntcInhcIjo3LjIsXCJ5XCI6MTUsXCJ3XCI6MzcuOCxcImhcIjozMH0sXCJwcmVmaXhcIjpcIlVcIixcImxhYmVsc1wiOlwidG9wXCIsXCJ0eXBlQWxpYXNlc1wiOltcInhvcl9nYXRlXCJdLFwib3JpZ2luXCI6e1wibGlicmFyeVwiOlwiY2hyaXMtcGlrdWwvZWxlY3Ryb25pYy1zeW1ib2xzXCIsXCJ1cmxcIjpcImh0dHBzOi8vZ2l0aHViLmNvbS9jaHJpcy1waWt1bC9lbGVjdHJvbmljLXN5bWJvbHNcIixcImxpY2Vuc2VcIjpcIk1JVFwiLFwiY29weXJpZ2h0XCI6XCJDb3B5cmlnaHQgKGMpIDIwMjIgQ2hyaXMgUGlrdWxcIixcImZpbGVcIjpcIlNWRy9JQy1DT00tTG9naWMtWE9SLnN2Z1wiLFwibW9kaWZpZWRfbm90ZVwiOlwic2NhbGVkIDAuNCwgc3Ryb2tlIG5vcm1hbGl6ZWQgdG8gY3VycmVudENvbG9yXCJ9LFwic3ZnQm9keVwiOlwiPGcgdHJhbnNmb3JtPVxcXCJzY2FsZSgwLjQpIHRyYW5zbGF0ZSgwIDApXFxcIj48ZyBmaWxsPVxcXCJub25lXFxcIiBzdHJva2U9XFxcImN1cnJlbnRDb2xvclxcXCIgc3Ryb2tlLW1pdGVybGltaXQ9XFxcIjEwXFxcIiBzdHJva2Utd2lkdGg9XFxcIjRcXFwiPlxccjxwYXRoIGQ9XFxcIk0zMS4yNSAzNy41aDI1YzM3LjUgMCA1Ni4yNSAzNy41IDU2LjI1IDM3LjVzLTE4Ljc1IDM3LjUtNTYuMjUgMzcuNWgtMjVzMTIuNS0xOC43NSAxMi41LTM3LjUtMTIuNS0zNy41LTEyLjUtMzcuNVpNMCA0OS44MWgzNy41TTAgMTAwLjA2aDM3LjVtNzUtMjUuMDZIMTUwXFxcIi8+XFxyPHBhdGggZD1cXFwiTTE4Ljc1IDExM3MxMi41LTE4Ljc1IDEyLjUtMzcuNS0xMi41LTM4LTEyLjUtMzhcXFwiLz5cXHI8L2c+PC9nPlwifSxcInplbmVyXCI6e1widHlwZVwiOlwiemVuZXJcIixcIm5hbWVcIjpcIlplbmVyIGRpb2RlXCIsXCJjYXRlZ29yeVwiOlwic2VtaWNvbmR1Y3RvclwiLFwic3ZnXCI6XCJzeW1ib2wuc3ZnXCIsXCJ3aWR0aFwiOjYwLFwiaGVpZ2h0XCI6NjAsXCJwaW5zXCI6e1wiYW5vZGVcIjp7XCJ4XCI6MCxcInlcIjozMCxcImRpclwiOlwibGVmdFwiLFwiaW9cIjpcImluXCJ9LFwiY2F0aG9kZVwiOntcInhcIjo2MCxcInlcIjozMCxcImRpclwiOlwicmlnaHRcIixcImlvXCI6XCJvdXRcIn19LFwiYWxpYXNlc1wiOntcIjFcIjpcImFub2RlXCIsXCIyXCI6XCJjYXRob2RlXCIsXCJhXCI6XCJhbm9kZVwiLFwia1wiOlwiY2F0aG9kZVwiLFwiK1wiOlwiYW5vZGVcIixcIi1cIjpcImNhdGhvZGVcIn0sXCJib2R5XCI6e1wieFwiOjIwLFwieVwiOjE1LjIsXCJ3XCI6MjYsXCJoXCI6MjkuNn0sXCJwcmVmaXhcIjpcIkRcIixcInR5cGVBbGlhc2VzXCI6W1wiemVuZXJfZGlvZGVcIl0sXCJvcmlnaW5cIjp7XCJsaWJyYXJ5XCI6XCJjaHJpcy1waWt1bC9lbGVjdHJvbmljLXN5bWJvbHNcIixcInVybFwiOlwiaHR0cHM6Ly9naXRodWIuY29tL2NocmlzLXBpa3VsL2VsZWN0cm9uaWMtc3ltYm9sc1wiLFwibGljZW5zZVwiOlwiTUlUXCIsXCJjb3B5cmlnaHRcIjpcIkNvcHlyaWdodCAoYykgMjAyMiBDaHJpcyBQaWt1bFwiLFwiZmlsZVwiOlwiU1ZHL0Rpb2RlLUNPTS1aZW5lci5zdmdcIixcIm1vZGlmaWVkX25vdGVcIjpcInNjYWxlZCAwLjQsIHN0cm9rZSBub3JtYWxpemVkIHRvIGN1cnJlbnRDb2xvclwifSxcInN2Z0JvZHlcIjpcIjxnIHRyYW5zZm9ybT1cXFwic2NhbGUoMC40KSB0cmFuc2xhdGUoMCAwKVxcXCI+PGcgZmlsbD1cXFwibm9uZVxcXCIgc3Ryb2tlPVxcXCJjdXJyZW50Q29sb3JcXFwiIHN0cm9rZS1taXRlcmxpbWl0PVxcXCIxMFxcXCIgc3Ryb2tlLXdpZHRoPVxcXCI0XFxcIj5cXHI8cGF0aCBkPVxcXCJtMTAwIDc1LTUwIDMxLjI1di02Mi41TDEwMCA3NXptLTUwIDBIMG0xMDAgMGg1MFxcXCIvPlxccjxwYXRoIGQ9XFxcIk0xMTIuNSAxMDkuNSAxMDAgMTAwVjUwbC0xMi41LTkuNVxcXCIvPlxccjwvZz48L2c+XCJ9fTtcbiIsICJleHBvcnQgY29uc3QgR1JJRCA9IDEwO1xuXG5leHBvcnQgY29uc3QgRElSUyA9IHtcbiAgbGVmdDogeyB4OiAtMSwgeTogMCB9LFxuICByaWdodDogeyB4OiAxLCB5OiAwIH0sXG4gIHVwOiB7IHg6IDAsIHk6IC0xIH0sXG4gIGRvd246IHsgeDogMCwgeTogMSB9LFxufTtcbmV4cG9ydCBjb25zdCBPUFBPU0lURSA9IHsgbGVmdDogJ3JpZ2h0JywgcmlnaHQ6ICdsZWZ0JywgdXA6ICdkb3duJywgZG93bjogJ3VwJyB9O1xuXG5leHBvcnQgY29uc3Qgc25hcCA9ICh2LCBnID0gR1JJRCkgPT4gTWF0aC5yb3VuZCh2IC8gZykgKiBnO1xuXG5leHBvcnQgZnVuY3Rpb24gdmVjVG9EaXIodikge1xuICBpZiAoTWF0aC5hYnModi54KSA+PSBNYXRoLmFicyh2LnkpKSByZXR1cm4gdi54IDwgMCA/ICdsZWZ0JyA6ICdyaWdodCc7XG4gIHJldHVybiB2LnkgPCAwID8gJ3VwJyA6ICdkb3duJztcbn1cblxuLy8gUm90YXRlIGEgdmVjdG9yIGNsb2Nrd2lzZSAoc2NyZWVuIGNvb3JkaW5hdGVzLCB5IGRvd24pIGJ5IDAvOTAvMTgwLzI3MC5cbmV4cG9ydCBmdW5jdGlvbiByb3RhdGVWZWMoeCwgeSwgcm90KSB7XG4gIHN3aXRjaCAoKChyb3QgJSAzNjApICsgMzYwKSAlIDM2MCkge1xuICAgIGNhc2UgOTA6IHJldHVybiB7IHg6IC15LCB5OiB4IH07XG4gICAgY2FzZSAxODA6IHJldHVybiB7IHg6IC14LCB5OiAteSB9O1xuICAgIGNhc2UgMjcwOiByZXR1cm4geyB4OiB5LCB5OiAteCB9O1xuICAgIGRlZmF1bHQ6IHJldHVybiB7IHgsIHkgfTtcbiAgfVxufVxuXG4vLyBQbGFjZW1lbnQgdHJhbnNmb3JtOiBsb2NhbCBwb2ludCAtPiB3b3JsZC4gYHRgID0ge3gsIHksIHJvdCwgbWlycm9yLCBveCwgb3l9LFxuLy8gd2hlcmUgKG94LCBveSkgaXMgdGhlIHN5bWJvbCBvcmlnaW4gdGhhdCBsYW5kcyBvbiAoeCwgeSkuXG5leHBvcnQgZnVuY3Rpb24geGZvcm0ocCwgdCkge1xuICBsZXQgeCA9IHAueCAtIHQub3g7XG4gIGNvbnN0IHkgPSBwLnkgLSB0Lm95O1xuICBpZiAodC5taXJyb3IpIHggPSAteDtcbiAgY29uc3QgciA9IHJvdGF0ZVZlYyh4LCB5LCB0LnJvdCk7XG4gIHJldHVybiB7IHg6IHIueCArIHQueCwgeTogci55ICsgdC55IH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB4Zm9ybURpcihkaXIsIHQpIHtcbiAgY29uc3QgZCA9IERJUlNbZGlyXTtcbiAgY29uc3QgciA9IHJvdGF0ZVZlYyh0Lm1pcnJvciA/IC1kLnggOiBkLngsIGQueSwgdC5yb3QpO1xuICByZXR1cm4gdmVjVG9EaXIocik7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB4Zm9ybVJlY3QociwgdCkge1xuICBjb25zdCBwdHMgPSBbXG4gICAgeGZvcm0oeyB4OiByLngsIHk6IHIueSB9LCB0KSwgeGZvcm0oeyB4OiByLnggKyByLncsIHk6IHIueSB9LCB0KSxcbiAgICB4Zm9ybSh7IHg6IHIueCwgeTogci55ICsgci5oIH0sIHQpLCB4Zm9ybSh7IHg6IHIueCArIHIudywgeTogci55ICsgci5oIH0sIHQpLFxuICBdO1xuICByZXR1cm4gYm91bmRzT2YocHRzKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGJvdW5kc09mKHB0cykge1xuICBsZXQgeDEgPSBJbmZpbml0eSwgeTEgPSBJbmZpbml0eSwgeDIgPSAtSW5maW5pdHksIHkyID0gLUluZmluaXR5O1xuICBmb3IgKGNvbnN0IHAgb2YgcHRzKSB7XG4gICAgeDEgPSBNYXRoLm1pbih4MSwgcC54KTsgeTEgPSBNYXRoLm1pbih5MSwgcC55KTtcbiAgICB4MiA9IE1hdGgubWF4KHgyLCBwLngpOyB5MiA9IE1hdGgubWF4KHkyLCBwLnkpO1xuICB9XG4gIHJldHVybiB7IHg6IHgxLCB5OiB5MSwgdzogeDIgLSB4MSwgaDogeTIgLSB5MSB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdW5pb25SZWN0KGEsIGIpIHtcbiAgaWYgKCFhKSByZXR1cm4gYjtcbiAgaWYgKCFiKSByZXR1cm4gYTtcbiAgY29uc3QgeCA9IE1hdGgubWluKGEueCwgYi54KSwgeSA9IE1hdGgubWluKGEueSwgYi55KTtcbiAgcmV0dXJuIHsgeCwgeSwgdzogTWF0aC5tYXgoYS54ICsgYS53LCBiLnggKyBiLncpIC0geCwgaDogTWF0aC5tYXgoYS55ICsgYS5oLCBiLnkgKyBiLmgpIC0geSB9O1xufVxuXG5leHBvcnQgY29uc3QgaW5mbGF0ZSA9IChyLCBkKSA9PiAoeyB4OiByLnggLSBkLCB5OiByLnkgLSBkLCB3OiByLncgKyAyICogZCwgaDogci5oICsgMiAqIGQgfSk7XG5cbmV4cG9ydCBjb25zdCBvdmVybGFwcyA9IChhLCBiKSA9PlxuICBhLnggPCBiLnggKyBiLncgJiYgYi54IDwgYS54ICsgYS53ICYmIGEueSA8IGIueSArIGIuaCAmJiBiLnkgPCBhLnkgKyBhLmg7XG5cbmV4cG9ydCBjb25zdCB0cmFuc2xhdGVSZWN0ID0gKHIsIGR4LCBkeSkgPT4gKHsgeDogci54ICsgZHgsIHk6IHIueSArIGR5LCB3OiByLncsIGg6IHIuaCB9KTtcblxuLy8gU2VnbWVudCAoYXhpcy1hbGlnbmVkKSB2cyByZWN0IGludGVyc2VjdGlvbi5cbmV4cG9ydCBmdW5jdGlvbiBzZWdIaXRzUmVjdChzLCByKSB7XG4gIGNvbnN0IHgxID0gTWF0aC5taW4ocy54MSwgcy54MiksIHgyID0gTWF0aC5tYXgocy54MSwgcy54Mik7XG4gIGNvbnN0IHkxID0gTWF0aC5taW4ocy55MSwgcy55MiksIHkyID0gTWF0aC5tYXgocy55MSwgcy55Mik7XG4gIHJldHVybiB4MSA8PSByLnggKyByLncgJiYgeDIgPj0gci54ICYmIHkxIDw9IHIueSArIHIuaCAmJiB5MiA+PSByLnk7XG59XG5cbi8vIEFwcHJveGltYXRlIHRleHQgd2lkdGggZm9yIEhlbHZldGljYS9BcmlhbC1saWtlIGZvbnRzLlxuZXhwb3J0IGZ1bmN0aW9uIHRleHRXaWR0aChzLCBzaXplID0gMTEpIHtcbiAgbGV0IHcgPSAwO1xuICBmb3IgKGNvbnN0IGNoIG9mIFN0cmluZyhzKSkge1xuICAgIGlmICgnaWwuLDo7fCFcXCcxJy5pbmNsdWRlcyhjaCkpIHcgKz0gMC4zO1xuICAgIGVsc2UgaWYgKCdNV213QCUnLmluY2x1ZGVzKGNoKSkgdyArPSAwLjg1O1xuICAgIGVsc2UgaWYgKGNoID49ICdBJyAmJiBjaCA8PSAnWicpIHcgKz0gMC42ODtcbiAgICBlbHNlIHcgKz0gMC41NjtcbiAgfVxuICByZXR1cm4gdyAqIHNpemU7XG59XG4iLCAiLy8gTm9ybWFsaXplZCBzeW1ib2wgYWNjZXNzLiBFdmVyeSBzeW1ib2wsIHdoZXRoZXIgaW1wb3J0ZWQgZnJvbSBhbiBleHRlcm5hbFxuLy8gbGlicmFyeSBvciBnZW5lcmF0ZWQgKGJveCBJQ3MpLCBpcyBleHBvc2VkIGluIG9uZSBzaGFwZTpcbi8vIHsgdHlwZSwgbmFtZSwgY2F0ZWdvcnksIHdpZHRoLCBoZWlnaHQsIHBpbnM6e05BTUU6e3gseSxkaXIsaW99fSwgcGluT3JkZXIsXG4vLyAgIGJvZHk6e3gseSx3LGh9LCBzdmdCb2R5LCBvcmlnaW46e3gseX0sIGFsaWFzZXMsIHJhaWwsIGtpbmQsIHRleHQsIGxhYmVscywgLi4uIH1cbmltcG9ydCBMSUIgZnJvbSAnLi9saWJyYXJ5LmdlbmVyYXRlZC5qcyc7XG5pbXBvcnQgeyB0ZXh0V2lkdGgsIHNuYXAgfSBmcm9tICcuLi91dGlscy9nZW9tZXRyeS5qcyc7XG5cbmNvbnN0IG5vcm0gPSAocykgPT4gU3RyaW5nKHMpLnRyaW0oKS50b0xvd2VyQ2FzZSgpLnJlcGxhY2UoL1tcXHMtXSsvZywgJ18nKTtcblxuY29uc3QgVFlQRV9BTElBUyA9IHt9O1xuZm9yIChjb25zdCBbdHlwZSwgZGVmXSBvZiBPYmplY3QuZW50cmllcyhMSUIpKSB7XG4gIGZvciAoY29uc3QgYSBvZiBkZWYudHlwZUFsaWFzZXMgfHwgW10pIFRZUEVfQUxJQVNbbm9ybShhKV0gPSB0eXBlO1xufVxuXG4vLyBCb2FyZC1sZXZlbCBwYXJ0cyB3ZSBkZWxpYmVyYXRlbHkgZG8gbm90IHN1cHBvcnQgeWV0IChhcmNoaXRlY3R1cmUgYWxsb3dzIHRoZW0gbGF0ZXIpLlxuZXhwb3J0IGNvbnN0IFVOU1VQUE9SVEVEX1RZUEVTID0gWydhcmR1aW5vJywgJ2FyZHVpbm9fdW5vJywgJ2FyZHVpbm9fbmFubycsICdhcmR1aW5vX21lZ2EnLCAnZXNwMzInLCAnZXNwODI2NicsICdub2RlbWN1JywgJ3Jhc3BiZXJyeV9waScsICdycGknLCAncmFzcGJlcnJ5X3BpX3BpY28nLCAncnBpX3BpY28nXTtcblxuZXhwb3J0IGZ1bmN0aW9uIGNhbm9uaWNhbFR5cGUodHlwZSkge1xuICBpZiAodHlwZSA9PSBudWxsKSByZXR1cm4gbnVsbDtcbiAgY29uc3QgdCA9IG5vcm0odHlwZSk7XG4gIHJldHVybiBMSUJbdF0gPyB0IDogVFlQRV9BTElBU1t0XSB8fCBudWxsO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbGlzdFR5cGVzKCkge1xuICByZXR1cm4gT2JqZWN0LnZhbHVlcyhMSUIpLm1hcCgoZCkgPT4gKHsgdHlwZTogZC50eXBlLCBuYW1lOiBkLm5hbWUsIGNhdGVnb3J5OiBkLmNhdGVnb3J5LCBhbGlhc2VzOiBkLnR5cGVBbGlhc2VzIHx8IFtdIH0pKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldERlZih0eXBlKSB7XG4gIHJldHVybiBMSUJbY2Fub25pY2FsVHlwZSh0eXBlKV0gfHwgbnVsbDtcbn1cblxuY29uc3QgY2FjaGUgPSBuZXcgTWFwKCk7XG5cbmV4cG9ydCBmdW5jdGlvbiByZXNvbHZlU3ltYm9sKGNvbXBvbmVudCkge1xuICBjb25zdCB0eXBlID0gY2Fub25pY2FsVHlwZShjb21wb25lbnQudHlwZSk7XG4gIGNvbnN0IGRlZiA9IExJQlt0eXBlXTtcbiAgaWYgKCFkZWYpIHJldHVybiBudWxsO1xuICBpZiAoZGVmLmtpbmQgPT09ICdib3gnKSB7XG4gICAgY29uc3Qga2V5ID0gdHlwZSArICd8JyArIEpTT04uc3RyaW5naWZ5KGNvbXBvbmVudC5waW5zID8/IG51bGwpICsgJ3wnICsgKGNvbXBvbmVudC5sYWJlbCA/PyAnJykgKyAnfCcgKyAoY29tcG9uZW50LnZhbHVlID8/ICcnKTtcbiAgICBpZiAoIWNhY2hlLmhhcyhrZXkpKSBjYWNoZS5zZXQoa2V5LCBidWlsZEJveChkZWYsIGNvbXBvbmVudCkpO1xuICAgIHJldHVybiBjYWNoZS5nZXQoa2V5KTtcbiAgfVxuICBpZiAoIWNhY2hlLmhhcyh0eXBlKSkgY2FjaGUuc2V0KHR5cGUsIGZpbmlzaChkZWYsIHsgLi4uZGVmIH0pKTtcbiAgcmV0dXJuIGNhY2hlLmdldCh0eXBlKTtcbn1cblxuZnVuY3Rpb24gZmluaXNoKGRlZiwgc3ltKSB7XG4gIHN5bS5waW5PcmRlciA9IE9iamVjdC5rZXlzKHN5bS5waW5zKTtcbiAgY29uc3QgZmlyc3QgPSBzeW0ucGluc1tzeW0ucGluT3JkZXJbMF1dO1xuICBzeW0ub3JpZ2luID0geyB4OiBmaXJzdC54LCB5OiBmaXJzdC55IH07XG4gIGNvbnN0IGFsaWFzZXMgPSB7fTtcbiAgZm9yIChjb25zdCBuIG9mIHN5bS5waW5PcmRlcikge1xuICAgIGFsaWFzZXNbbi50b0xvd2VyQ2FzZSgpXSA9IG47XG4gICAgaWYgKG4uc3RhcnRzV2l0aCgnficpKSBhbGlhc2VzW24uc2xpY2UoMSkudG9Mb3dlckNhc2UoKV0gPSBuO1xuICB9XG4gIGZvciAoY29uc3QgW2EsIG5dIG9mIE9iamVjdC5lbnRyaWVzKGRlZi5hbGlhc2VzIHx8IHt9KSkge1xuICAgIGNvbnN0IHRhcmdldCA9IHN5bS5waW5PcmRlci5maW5kKChwKSA9PiBwLnRvTG93ZXJDYXNlKCkgPT09IG4udG9Mb3dlckNhc2UoKSk7XG4gICAgaWYgKHRhcmdldCAmJiAhKGEudG9Mb3dlckNhc2UoKSBpbiBhbGlhc2VzKSkgYWxpYXNlc1thLnRvTG93ZXJDYXNlKCldID0gdGFyZ2V0O1xuICB9XG4gIHN5bS5hbGlhc2VzID0gYWxpYXNlcztcbiAgc3ltLnR3b1Rlcm1pbmFsID0gc3ltLnBpbk9yZGVyLmxlbmd0aCA9PT0gMiAmJiAhc3ltLmtpbmQgJiYgIXN5bS50ZXJtaW5hbDtcbiAgcmV0dXJuIHN5bTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHJlc29sdmVQaW4oc3ltLCBuYW1lKSB7XG4gIGlmICghc3ltIHx8IG5hbWUgPT0gbnVsbCkgcmV0dXJuIG51bGw7XG4gIHJldHVybiBzeW0uYWxpYXNlc1tTdHJpbmcobmFtZSkudHJpbSgpLnRvTG93ZXJDYXNlKCldIHx8IG51bGw7XG59XG5cbi8vIC0tLS0gR2VuZXJhdGVkIHJlY3Rhbmd1bGFyIElDIHN5bWJvbHMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG5jb25zdCBlc2MgPSAocykgPT4gU3RyaW5nKHMpLnJlcGxhY2UoLyYvZywgJyZhbXA7JykucmVwbGFjZSgvPC9nLCAnJmx0OycpLnJlcGxhY2UoLz4vZywgJyZndDsnKS5yZXBsYWNlKC9cIi9nLCAnJnF1b3Q7Jyk7XG5cbmZ1bmN0aW9uIGJveFNwZWMoZGVmLCBjb21wb25lbnQpIHtcbiAgY29uc3QgcCA9IGNvbXBvbmVudC5waW5zO1xuICBpZiAocCA9PSBudWxsKSByZXR1cm4gZGVmLnBpbnM7XG4gIGNvbnN0IHNpZGUgPSBPYmplY3Qua2V5cyhkZWYucGlucylbMF0gfHwgJ3JpZ2h0JztcbiAgaWYgKHR5cGVvZiBwID09PSAnbnVtYmVyJykgcmV0dXJuIHsgW3NpZGVdOiBBcnJheS5mcm9tKHsgbGVuZ3RoOiBNYXRoLm1heCgxLCBNYXRoLm1pbig2NCwgcCB8IDApKSB9LCAoXywgaSkgPT4gU3RyaW5nKGkgKyAxKSkgfTtcbiAgaWYgKEFycmF5LmlzQXJyYXkocCkpIHtcbiAgICBjb25zdCBuYW1lcyA9IHAubWFwKFN0cmluZyk7XG4gICAgaWYgKGRlZi50eXBlID09PSAnY29ubmVjdG9yJykgcmV0dXJuIHsgW3NpZGVdOiBuYW1lcyB9O1xuICAgIGNvbnN0IGhhbGYgPSBNYXRoLmNlaWwobmFtZXMubGVuZ3RoIC8gMik7XG4gICAgcmV0dXJuIHsgbGVmdDogbmFtZXMuc2xpY2UoMCwgaGFsZiksIHJpZ2h0OiBuYW1lcy5zbGljZShoYWxmKSB9O1xuICB9XG4gIGlmICh0eXBlb2YgcCA9PT0gJ29iamVjdCcpIHtcbiAgICBjb25zdCBvdXQgPSB7fTtcbiAgICBmb3IgKGNvbnN0IHMgb2YgWydsZWZ0JywgJ3JpZ2h0JywgJ3RvcCcsICdib3R0b20nXSkgaWYgKEFycmF5LmlzQXJyYXkocFtzXSkpIG91dFtzXSA9IHBbc10ubWFwKFN0cmluZyk7XG4gICAgcmV0dXJuIG91dDtcbiAgfVxuICByZXR1cm4gZGVmLnBpbnM7XG59XG5cbmZ1bmN0aW9uIGJ1aWxkQm94KGRlZiwgY29tcG9uZW50KSB7XG4gIGNvbnN0IHNwZWMgPSBib3hTcGVjKGRlZiwgY29tcG9uZW50KTtcbiAgY29uc3QgTCA9IHNwZWMubGVmdCB8fCBbXSwgUiA9IHNwZWMucmlnaHQgfHwgW10sIFQgPSBzcGVjLnRvcCB8fCBbXSwgQiA9IHNwZWMuYm90dG9tIHx8IFtdO1xuICBjb25zdCBGUyA9IDk7XG4gIGNvbnN0IHR3ID0gKHMpID0+IHRleHRXaWR0aChzLnJlcGxhY2UoL15+LywgJycpLCBGUyk7XG4gIGNvbnN0IHRpdGxlID0gY29tcG9uZW50LmxhYmVsID8/IGRlZi5sYWJlbCA/PyAnJztcbiAgY29uc3QgbWF4TCA9IE1hdGgubWF4KDAsIC4uLkwubWFwKHR3KSksIG1heFIgPSBNYXRoLm1heCgwLCAuLi5SLm1hcCh0dykpO1xuICBjb25zdCB2YWx1ZSA9IGNvbXBvbmVudC52YWx1ZSAhPSBudWxsICYmIGNvbXBvbmVudC52YWx1ZSAhPT0gJycgPyBTdHJpbmcoY29tcG9uZW50LnZhbHVlKSA6ICcnO1xuICBjb25zdCB0aXRsZVcgPSBNYXRoLm1heCh0aXRsZSA/IHRleHRXaWR0aCh0aXRsZSwgMTEpIDogMCwgdmFsdWUgPyB0ZXh0V2lkdGgodmFsdWUsIDEwKSA6IDApICsgKHRpdGxlIHx8IHZhbHVlID8gMTYgOiAwKTtcbiAgY29uc3Qgc2lkZVcgPSBNYXRoLm1heChtYXhMLCBtYXhSKTtcbiAgbGV0IFcgPSBNYXRoLm1heCg2MCwgbWF4TCArIG1heFIgKyB0aXRsZVcgKyAyMCwgdGl0bGVXICsgMiAqIHNpZGVXICsgMjAsIChNYXRoLm1heChULmxlbmd0aCwgQi5sZW5ndGgpICsgMSkgKiAyMCk7XG4gIFcgPSBNYXRoLmNlaWwoVyAvIDIwKSAqIDIwO1xuICBjb25zdCByb3dzID0gTWF0aC5tYXgoTC5sZW5ndGgsIFIubGVuZ3RoLCAxKTtcbiAgY29uc3QgdG9wID0gMjA7XG4gIGNvbnN0IGZpcnN0WSA9IHRvcCArIChULmxlbmd0aCA/IDQwIDogMjApO1xuICBsZXQgYm90dG9tID0gZmlyc3RZICsgKHJvd3MgLSAxKSAqIDIwICsgKEIubGVuZ3RoID8gNDAgOiAyMCk7XG4gIGlmICh0aXRsZSAmJiB2YWx1ZSAmJiBib3R0b20gLSB0b3AgPCA2MCkgYm90dG9tID0gdG9wICsgNjA7XG4gIGNvbnN0IHBpbnMgPSB7fTtcbiAgY29uc3QgcGFydHMgPSBbYDxyZWN0IHg9XCIyMFwiIHk9XCIke3RvcH1cIiB3aWR0aD1cIiR7V31cIiBoZWlnaHQ9XCIke2JvdHRvbSAtIHRvcH1cIiBmaWxsPVwibm9uZVwiIHN0cm9rZT1cImN1cnJlbnRDb2xvclwiIHN0cm9rZS13aWR0aD1cIjEuNlwiLz5gXTtcbiAgY29uc3QgdGV4dCA9IFtdO1xuICBjb25zdCBsYWJlbCA9ICh4LCB5LCBuYW1lLCBhbmNob3IpID0+IHtcbiAgICBjb25zdCBvdmVyID0gbmFtZS5zdGFydHNXaXRoKCd+Jyk7XG4gICAgY29uc3Qgc2hvd24gPSBvdmVyID8gbmFtZS5zbGljZSgxKSA6IG5hbWU7XG4gICAgdGV4dC5wdXNoKGA8dGV4dCB4PVwiJHt4fVwiIHk9XCIke3l9XCIgZm9udC1zaXplPVwiJHtGU31cIiB0ZXh0LWFuY2hvcj1cIiR7YW5jaG9yfVwiJHtvdmVyID8gJyB0ZXh0LWRlY29yYXRpb249XCJvdmVybGluZVwiJyA6ICcnfT4ke2VzYyhzaG93bil9PC90ZXh0PmApO1xuICB9O1xuICBjb25zdCBpbyA9IChzaWRlKSA9PiBkZWYuaW8gfHwgKHNpZGUgPT09ICdsZWZ0JyA/ICdpbicgOiBzaWRlID09PSAncmlnaHQnID8gJ291dCcgOiAncG93ZXInKTtcbiAgY29uc3QgaXNDbG9jayA9IChuKSA9PiAvXn4/KGNsa3xjcHxjbG9jaykkL2kudGVzdChuKTtcbiAgY29uc3QgbGluZXMgPSBbXTtcbiAgTC5mb3JFYWNoKChuLCBpKSA9PiB7XG4gICAgY29uc3QgeSA9IGZpcnN0WSArIGkgKiAyMDtcbiAgICBwaW5zW25dID0geyB4OiAwLCB5LCBkaXI6ICdsZWZ0JywgaW86IGlvKCdsZWZ0JykgfTtcbiAgICBsaW5lcy5wdXNoKGBNMCAke3l9SDIwYCk7XG4gICAgaWYgKGlzQ2xvY2sobikpIHsgbGluZXMucHVzaChgTTIwICR7eSAtIDV9TDI3ICR7eX1MMjAgJHt5ICsgNX1gKTsgbGFiZWwoMzAsIHkgKyAzLCBuLCAnc3RhcnQnKTsgfVxuICAgIGVsc2UgbGFiZWwoMjQsIHkgKyAzLCBuLCAnc3RhcnQnKTtcbiAgfSk7XG4gIFIuZm9yRWFjaCgobiwgaSkgPT4ge1xuICAgIGNvbnN0IHkgPSBmaXJzdFkgKyBpICogMjA7XG4gICAgcGluc1tuXSA9IHsgeDogVyArIDQwLCB5LCBkaXI6ICdyaWdodCcsIGlvOiBpbygncmlnaHQnKSB9O1xuICAgIGxpbmVzLnB1c2goYE0ke1cgKyAyMH0gJHt5fUgke1cgKyA0MH1gKTtcbiAgICBsYWJlbChXICsgMTYsIHkgKyAzLCBuLCAnZW5kJyk7XG4gIH0pO1xuICBjb25zdCBhY3Jvc3MgPSAobGlzdCwgeSwgZGlyLCB0eSkgPT4ge1xuICAgIGNvbnN0IHgwID0gMjAgKyBzbmFwKChXIC0gKGxpc3QubGVuZ3RoIC0gMSkgKiAyMCkgLyAyKTtcbiAgICBsaXN0LmZvckVhY2goKG4sIGkpID0+IHtcbiAgICAgIGNvbnN0IHggPSB4MCArIGkgKiAyMDtcbiAgICAgIHBpbnNbbl0gPSB7IHgsIHksIGRpciwgaW86IGlvKGRpciA9PT0gJ3VwJyA/ICd0b3AnIDogJ2JvdHRvbScpIH07XG4gICAgICBsaW5lcy5wdXNoKGRpciA9PT0gJ3VwJyA/IGBNJHt4fSAwViR7dG9wfWAgOiBgTSR7eH0gJHtib3R0b219ViR7Ym90dG9tICsgMjB9YCk7XG4gICAgICBsYWJlbCh4LCB0eSwgbiwgJ21pZGRsZScpO1xuICAgIH0pO1xuICB9O1xuICBhY3Jvc3MoVCwgMCwgJ3VwJywgdG9wICsgMTEpO1xuICBhY3Jvc3MoQiwgYm90dG9tICsgMjAsICdkb3duJywgYm90dG9tIC0gNSk7XG4gIGlmIChsaW5lcy5sZW5ndGgpIHBhcnRzLnB1c2goYDxwYXRoIGQ9XCIke2xpbmVzLmpvaW4oJycpfVwiIGZpbGw9XCJub25lXCIgc3Ryb2tlPVwiY3VycmVudENvbG9yXCIgc3Ryb2tlLXdpZHRoPVwiMS42XCIvPmApO1xuICBjb25zdCBtaWQgPSAodG9wICsgYm90dG9tKSAvIDI7XG4gIGlmICh0aXRsZSkgdGV4dC5wdXNoKGA8dGV4dCB4PVwiJHsyMCArIFcgLyAyfVwiIHk9XCIke3ZhbHVlID8gbWlkIC0gMiA6IG1pZCArIDR9XCIgZm9udC1zaXplPVwiMTFcIiBmb250LXdlaWdodD1cIjYwMFwiIHRleHQtYW5jaG9yPVwibWlkZGxlXCI+JHtlc2ModGl0bGUpfTwvdGV4dD5gKTtcbiAgaWYgKHZhbHVlKSB0ZXh0LnB1c2goYDx0ZXh0IHg9XCIkezIwICsgVyAvIDJ9XCIgeT1cIiR7dGl0bGUgPyBtaWQgKyAxMSA6IG1pZCArIDR9XCIgZm9udC1zaXplPVwiMTBcIiB0ZXh0LWFuY2hvcj1cIm1pZGRsZVwiIGZpbGwtb3BhY2l0eT1cIjAuNzVcIj4ke2VzYyh2YWx1ZSl9PC90ZXh0PmApO1xuICBwYXJ0cy5wdXNoKGA8ZyBmaWxsPVwiY3VycmVudENvbG9yXCIgc3Ryb2tlPVwibm9uZVwiPiR7dGV4dC5qb2luKCcnKX08L2c+YCk7XG4gIGlmICghT2JqZWN0LmtleXMocGlucykubGVuZ3RoKSBwaW5zWycxJ10gPSB7IHg6IDAsIHk6IGZpcnN0WSwgZGlyOiAnbGVmdCcsIGlvOiAncGFzc2l2ZScgfTtcbiAgcmV0dXJuIGZpbmlzaChkZWYsIHtcbiAgICAuLi5kZWYsXG4gICAgcGlucyxcbiAgICB3aWR0aDogVyArIDQwLFxuICAgIGhlaWdodDogYm90dG9tICsgMjAsXG4gICAgYm9keTogeyB4OiAyMCwgeTogdG9wLCB3OiBXLCBoOiBib3R0b20gLSB0b3AgfSxcbiAgICBzdmdCb2R5OiBwYXJ0cy5qb2luKCcnKSxcbiAgICBsYWJlbHM6ICdib3gnLFxuICAgIGJveFNwZWM6IHNwZWMsXG4gIH0pO1xufVxuIiwgImltcG9ydCB7IHBhcnNlQ2lyY3VpdCwgbm9ybWFsaXplQ29ubmVjdGlvbnMsIHBhcnNlUmVmIH0gZnJvbSAnLi4vcGFyc2VyL2luZGV4LmpzJztcbmltcG9ydCB7IGNhbm9uaWNhbFR5cGUsIHJlc29sdmVTeW1ib2wsIHJlc29sdmVQaW4sIGxpc3RUeXBlcywgVU5TVVBQT1JURURfVFlQRVMgfSBmcm9tICcuLi9zeW1ib2wtbG9hZGVyL2luZGV4LmpzJztcblxuZnVuY3Rpb24gbGV2ZW5zaHRlaW4oYSwgYikge1xuICBjb25zdCBkID0gQXJyYXkuZnJvbSh7IGxlbmd0aDogYS5sZW5ndGggKyAxIH0sIChfLCBpKSA9PiBbaV0pO1xuICBmb3IgKGxldCBqID0gMTsgaiA8PSBiLmxlbmd0aDsgaisrKSBkWzBdW2pdID0gajtcbiAgZm9yIChsZXQgaSA9IDE7IGkgPD0gYS5sZW5ndGg7IGkrKylcbiAgICBmb3IgKGxldCBqID0gMTsgaiA8PSBiLmxlbmd0aDsgaisrKVxuICAgICAgZFtpXVtqXSA9IE1hdGgubWluKGRbaSAtIDFdW2pdICsgMSwgZFtpXVtqIC0gMV0gKyAxLCBkW2kgLSAxXVtqIC0gMV0gKyAoYVtpIC0gMV0gPT09IGJbaiAtIDFdID8gMCA6IDEpKTtcbiAgcmV0dXJuIGRbYS5sZW5ndGhdW2IubGVuZ3RoXTtcbn1cblxuZnVuY3Rpb24gc3VnZ2VzdFR5cGUodCkge1xuICBjb25zdCBzID0gU3RyaW5nKHQpLnRvTG93ZXJDYXNlKCk7XG4gIGxldCBiZXN0ID0gbnVsbCwgYmVzdEQgPSAzO1xuICBmb3IgKGNvbnN0IHsgdHlwZSwgYWxpYXNlcyB9IG9mIGxpc3RUeXBlcygpKSB7XG4gICAgZm9yIChjb25zdCBjYW5kIG9mIFt0eXBlLCAuLi5hbGlhc2VzXSkge1xuICAgICAgY29uc3QgZCA9IGxldmVuc2h0ZWluKHMsIGNhbmQpO1xuICAgICAgaWYgKGQgPCBiZXN0RCkgeyBiZXN0RCA9IGQ7IGJlc3QgPSB0eXBlOyB9XG4gICAgfVxuICB9XG4gIHJldHVybiBiZXN0O1xufVxuXG4vLyBSZXR1cm5zIHsgdmFsaWQsIGVycm9ycywgd2FybmluZ3MsIGNpcmN1aXQsIHJlc29sdmVkIH0gd2hlcmUgYHJlc29sdmVkYCBob2xkc1xuLy8gdGhlIHBlci1jb21wb25lbnQgc3ltYm9scyBhbmQgcGVyLWNvbm5lY3Rpb24gcmVzb2x2ZWQgZW5kcG9pbnRzIGZvciB0aGUgZW5naW5lLlxuZXhwb3J0IGZ1bmN0aW9uIHZhbGlkYXRlQ2lyY3VpdChpbnB1dCkge1xuICBjb25zdCBlcnJvcnMgPSBbXSwgd2FybmluZ3MgPSBbXTtcbiAgY29uc3QgeyBjaXJjdWl0LCBlcnJvcnM6IHBhcnNlRXJyb3JzIH0gPSBwYXJzZUNpcmN1aXQoaW5wdXQpO1xuICBpZiAocGFyc2VFcnJvcnMubGVuZ3RoKSByZXR1cm4geyB2YWxpZDogZmFsc2UsIGVycm9yczogcGFyc2VFcnJvcnMsIHdhcm5pbmdzLCBjaXJjdWl0OiBudWxsIH07XG5cbiAgaWYgKCFjaXJjdWl0IHx8IHR5cGVvZiBjaXJjdWl0ICE9PSAnb2JqZWN0JyB8fCBBcnJheS5pc0FycmF5KGNpcmN1aXQpKSB7XG4gICAgZXJyb3JzLnB1c2goeyBjb2RlOiAnSU5WQUxJRF9TQ0hFTUEnLCBtZXNzYWdlOiAnVGhlIGNpcmN1aXQgbXVzdCBiZSBhIEpTT04gb2JqZWN0IHdpdGggXCJjb21wb25lbnRzXCIgYW5kIFwiY29ubmVjdGlvbnNcIi4nIH0pO1xuICAgIHJldHVybiB7IHZhbGlkOiBmYWxzZSwgZXJyb3JzLCB3YXJuaW5ncywgY2lyY3VpdCB9O1xuICB9XG4gIGlmICghQXJyYXkuaXNBcnJheShjaXJjdWl0LmNvbXBvbmVudHMpKSB7XG4gICAgZXJyb3JzLnB1c2goeyBjb2RlOiAnSU5WQUxJRF9TQ0hFTUEnLCBwYXRoOiAnY29tcG9uZW50cycsIG1lc3NhZ2U6ICdcImNvbXBvbmVudHNcIiBtdXN0IGJlIGFuIGFycmF5LicgfSk7XG4gICAgcmV0dXJuIHsgdmFsaWQ6IGZhbHNlLCBlcnJvcnMsIHdhcm5pbmdzLCBjaXJjdWl0IH07XG4gIH1cbiAgaWYgKGNpcmN1aXQuY29ubmVjdGlvbnMgIT09IHVuZGVmaW5lZCAmJiAhQXJyYXkuaXNBcnJheShjaXJjdWl0LmNvbm5lY3Rpb25zKSkge1xuICAgIGVycm9ycy5wdXNoKHsgY29kZTogJ0lOVkFMSURfU0NIRU1BJywgcGF0aDogJ2Nvbm5lY3Rpb25zJywgbWVzc2FnZTogJ1wiY29ubmVjdGlvbnNcIiBtdXN0IGJlIGFuIGFycmF5LicgfSk7XG4gIH1cblxuICBjb25zdCBjb21wcyA9IG5ldyBNYXAoKTtcbiAgY2lyY3VpdC5jb21wb25lbnRzLmZvckVhY2goKGMsIGkpID0+IHtcbiAgICBjb25zdCBwYXRoID0gYGNvbXBvbmVudHNbJHtpfV1gO1xuICAgIGlmICghYyB8fCB0eXBlb2YgYyAhPT0gJ29iamVjdCcgfHwgQXJyYXkuaXNBcnJheShjKSkge1xuICAgICAgZXJyb3JzLnB1c2goeyBjb2RlOiAnSU5WQUxJRF9TQ0hFTUEnLCBwYXRoLCBtZXNzYWdlOiBgQ29tcG9uZW50ICMke2kgKyAxfSBtdXN0IGJlIGFuIG9iamVjdC5gIH0pO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBpZiAodHlwZW9mIGMuaWQgIT09ICdzdHJpbmcnIHx8ICFjLmlkLnRyaW0oKSkge1xuICAgICAgZXJyb3JzLnB1c2goeyBjb2RlOiAnTUlTU0lOR19JRCcsIHBhdGgsIG1lc3NhZ2U6IGBDb21wb25lbnQgIyR7aSArIDF9IGhhcyBubyBcImlkXCIuYCB9KTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgY29uc3QgaWQgPSBjLmlkO1xuICAgIGlmICgvWy5cXHNdLy50ZXN0KGlkKSkge1xuICAgICAgZXJyb3JzLnB1c2goeyBjb2RlOiAnSU5WQUxJRF9JRCcsIGNvbXBvbmVudDogaWQsIHBhdGgsIG1lc3NhZ2U6IGBDb21wb25lbnQgaWQgXCIke2lkfVwiIG11c3Qgbm90IGNvbnRhaW4gZG90cyBvciBzcGFjZXMuYCB9KTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgaWYgKGNvbXBzLmhhcyhpZCkpIHtcbiAgICAgIGVycm9ycy5wdXNoKHsgY29kZTogJ0RVUExJQ0FURV9JRCcsIGNvbXBvbmVudDogaWQsIHBhdGgsIG1lc3NhZ2U6IGBEdXBsaWNhdGUgY29tcG9uZW50IGlkIFwiJHtpZH1cIi5gIH0pO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBpZiAoYy50eXBlID09IG51bGwgfHwgYy50eXBlID09PSAnJykge1xuICAgICAgZXJyb3JzLnB1c2goeyBjb2RlOiAnTUlTU0lOR19UWVBFJywgY29tcG9uZW50OiBpZCwgcGF0aCwgbWVzc2FnZTogYENvbXBvbmVudCAke2lkfSBoYXMgbm8gXCJ0eXBlXCIuYCB9KTtcbiAgICAgIGNvbXBzLnNldChpZCwgbnVsbCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGNvbnN0IHQgPSBTdHJpbmcoYy50eXBlKS50b0xvd2VyQ2FzZSgpLnJlcGxhY2UoL1tcXHMtXSsvZywgJ18nKTtcbiAgICBpZiAoVU5TVVBQT1JURURfVFlQRVMuaW5jbHVkZXModCkpIHtcbiAgICAgIGVycm9ycy5wdXNoKHsgY29kZTogJ1VOU1VQUE9SVEVEX0NPTVBPTkVOVCcsIGNvbXBvbmVudDogaWQsIHR5cGU6IGMudHlwZSwgcGF0aCwgbWVzc2FnZTogYENvbXBvbmVudCB0eXBlIFwiJHtjLnR5cGV9XCIgKCR7aWR9KSBpcyBub3Qgc3VwcG9ydGVkIHlldC4gVXNlIFwibWljcm9jb250cm9sbGVyXCIgd2l0aCBjdXN0b20gcGlucyBpbnN0ZWFkLmAgfSk7XG4gICAgICBjb21wcy5zZXQoaWQsIG51bGwpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBpZiAoIWNhbm9uaWNhbFR5cGUoYy50eXBlKSkge1xuICAgICAgY29uc3QgcyA9IHN1Z2dlc3RUeXBlKGMudHlwZSk7XG4gICAgICBlcnJvcnMucHVzaCh7IGNvZGU6ICdVTktOT1dOX1RZUEUnLCBjb21wb25lbnQ6IGlkLCB0eXBlOiBjLnR5cGUsIHBhdGgsIG1lc3NhZ2U6IGBVbmtub3duIGNvbXBvbmVudCB0eXBlIFwiJHtjLnR5cGV9XCIgb24gJHtpZH0uJHtzID8gYCBEaWQgeW91IG1lYW4gXCIke3N9XCI/YCA6ICcnfWAgfSk7XG4gICAgICBjb21wcy5zZXQoaWQsIG51bGwpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBpZiAoYy5yb3RhdGlvbiAhPT0gdW5kZWZpbmVkICYmICFbMCwgOTAsIDE4MCwgMjcwXS5pbmNsdWRlcyhjLnJvdGF0aW9uKSkge1xuICAgICAgZXJyb3JzLnB1c2goeyBjb2RlOiAnSU5WQUxJRF9QUk9QRVJUWScsIGNvbXBvbmVudDogaWQsIHBhdGg6IGAke3BhdGh9LnJvdGF0aW9uYCwgbWVzc2FnZTogYFJvdGF0aW9uIG9mICR7aWR9IG11c3QgYmUgMCwgOTAsIDE4MCBvciAyNzAuYCB9KTtcbiAgICB9XG4gICAgaWYgKGMucG9zaXRpb24gIT09IHVuZGVmaW5lZCAmJiAhKGMucG9zaXRpb24gJiYgTnVtYmVyLmlzRmluaXRlKGMucG9zaXRpb24ueCkgJiYgTnVtYmVyLmlzRmluaXRlKGMucG9zaXRpb24ueSkpKSB7XG4gICAgICBlcnJvcnMucHVzaCh7IGNvZGU6ICdJTlZBTElEX1BST1BFUlRZJywgY29tcG9uZW50OiBpZCwgcGF0aDogYCR7cGF0aH0ucG9zaXRpb25gLCBtZXNzYWdlOiBgUG9zaXRpb24gb2YgJHtpZH0gbXVzdCBiZSB7XCJ4XCI6IG51bWJlciwgXCJ5XCI6IG51bWJlcn0uYCB9KTtcbiAgICB9XG4gICAgY29tcHMuc2V0KGlkLCB7IGNvbXA6IGMsIHN5bTogcmVzb2x2ZVN5bWJvbChjKSB9KTtcbiAgfSk7XG5cbiAgY29uc3QgY29ubmVjdGlvbnMgPSBbXTtcbiAgY29uc3Qgc2VlblBhaXJzID0gbmV3IFNldCgpO1xuICBjb25zdCBjb25uZWN0ZWRQaW5zID0gbmV3IE1hcCgpOyAvLyBpZCAtPiBTZXQocGluKVxuICBjb25zdCBtZW50aW9uZWQgPSBuZXcgU2V0KCk7IC8vIGlkcyByZWZlcmVuY2VkIGJ5IGFueSBjb25uZWN0aW9uLCB2YWxpZCBvciBub3RcbiAgZm9yIChjb25zdCBjb25uIG9mIG5vcm1hbGl6ZUNvbm5lY3Rpb25zKGNpcmN1aXQpKSB7XG4gICAgY29uc3QgeyBwYXRoIH0gPSBjb25uO1xuICAgIGlmICghQXJyYXkuaXNBcnJheShjb25uLnJlZnMpKSB7XG4gICAgICBlcnJvcnMucHVzaCh7IGNvZGU6ICdJTlZBTElEX0NPTk5FQ1RJT04nLCBwYXRoLCBtZXNzYWdlOiBgJHtwYXRofSBtdXN0IGJlIGFuIGFycmF5IG9mIHBpbiByZWZlcmVuY2VzIGxpa2UgW1wiUjEuMVwiLCBcIkMxLjJcIl0uYCB9KTtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cbiAgICBpZiAoY29ubi5yZWZzLmxlbmd0aCA8IDIpIHtcbiAgICAgIGVycm9ycy5wdXNoKHsgY29kZTogJ0lOVkFMSURfQ09OTkVDVElPTicsIHBhdGgsIG1lc3NhZ2U6IGAke3BhdGh9IG5lZWRzIGF0IGxlYXN0IHR3byBlbmRwb2ludHMuYCB9KTtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cbiAgICBjb25zdCBlbmRzID0gW107XG4gICAgbGV0IGJhZCA9IGZhbHNlO1xuICAgIGZvciAoY29uc3QgcmF3IG9mIGNvbm4ucmVmcykge1xuICAgICAgY29uc3QgcmVmID0gcGFyc2VSZWYocmF3KTtcbiAgICAgIGlmICghcmVmKSB7XG4gICAgICAgIGVycm9ycy5wdXNoKHsgY29kZTogJ0lOVkFMSURfQ09OTkVDVElPTicsIHBhdGgsIG1lc3NhZ2U6IGBJbnZhbGlkIHBpbiByZWZlcmVuY2UgJHtKU09OLnN0cmluZ2lmeShyYXcpfSBpbiAke3BhdGh9LiBVc2UgXCJDb21wb25lbnRJZC5waW5cIi5gIH0pO1xuICAgICAgICBiYWQgPSB0cnVlOyBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIG1lbnRpb25lZC5hZGQocmVmLmNvbXApO1xuICAgICAgaWYgKCFjb21wcy5oYXMocmVmLmNvbXApKSB7XG4gICAgICAgIGVycm9ycy5wdXNoKHsgY29kZTogJ01JU1NJTkdfQ09NUE9ORU5UJywgY29tcG9uZW50OiByZWYuY29tcCwgcmVmOiByYXcsIHBhdGgsIG1lc3NhZ2U6IGBDb25uZWN0aW9uIHJlZmVyZW5jZXMgbWlzc2luZyBjb21wb25lbnQgXCIke3JlZi5jb21wfVwiICgke3Jhd30pLmAgfSk7XG4gICAgICAgIGJhZCA9IHRydWU7IGNvbnRpbnVlO1xuICAgICAgfVxuICAgICAgY29uc3QgZW50cnkgPSBjb21wcy5nZXQocmVmLmNvbXApO1xuICAgICAgaWYgKCFlbnRyeSkgeyBiYWQgPSB0cnVlOyBjb250aW51ZTsgfSAvLyBjb21wb25lbnQgYWxyZWFkeSByZXBvcnRlZFxuICAgICAgY29uc3QgeyBzeW0sIGNvbXAgfSA9IGVudHJ5O1xuICAgICAgbGV0IHBpbjtcbiAgICAgIGlmIChyZWYucGluID09IG51bGwpIHtcbiAgICAgICAgaWYgKHN5bS5waW5PcmRlci5sZW5ndGggPT09IDEpIHBpbiA9IHN5bS5waW5PcmRlclswXTtcbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgZXJyb3JzLnB1c2goeyBjb2RlOiAnSU5WQUxJRF9QSU4nLCBjb21wb25lbnQ6IHJlZi5jb21wLCBwaW46IG51bGwsIHJlZjogcmF3LCBwYXRoLCBtZXNzYWdlOiBgQ29ubmVjdGlvbiB0byAke3JlZi5jb21wfSBtdXN0IG5hbWUgYSBwaW4gKCR7c3ltLnBpbk9yZGVyLmpvaW4oJywgJyl9KS5gIH0pO1xuICAgICAgICAgIGJhZCA9IHRydWU7IGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBwaW4gPSByZXNvbHZlUGluKHN5bSwgcmVmLnBpbik7XG4gICAgICAgIGlmICghcGluKSB7XG4gICAgICAgICAgZXJyb3JzLnB1c2goeyBjb2RlOiAnSU5WQUxJRF9QSU4nLCBjb21wb25lbnQ6IHJlZi5jb21wLCBwaW46IHJlZi5waW4sIHJlZjogcmF3LCBwYXRoLCBtZXNzYWdlOiBgUGluICR7cmVmLnBpbn0gZG9lcyBub3QgZXhpc3Qgb24gJHtzeW0ubmFtZS50b0xvd2VyQ2FzZSgpfSAke3JlZi5jb21wfS4gQXZhaWxhYmxlOiAke3N5bS5waW5PcmRlci5qb2luKCcsICcpfS5gIH0pO1xuICAgICAgICAgIGJhZCA9IHRydWU7IGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBlbmRzLnB1c2goeyBjb21wOiBjb21wLmlkLCBwaW4gfSk7XG4gICAgfVxuICAgIGlmIChiYWQpIGNvbnRpbnVlO1xuICAgIGNvbnN0IGtleXMgPSBlbmRzLm1hcCgoZSkgPT4gYCR7ZS5jb21wfS4ke2UucGlufWApO1xuICAgIGlmIChuZXcgU2V0KGtleXMpLnNpemUgIT09IGtleXMubGVuZ3RoKSB7XG4gICAgICBlcnJvcnMucHVzaCh7IGNvZGU6ICdJTlZBTElEX0NPTk5FQ1RJT04nLCBwYXRoLCBtZXNzYWdlOiBgJHtwYXRofSBjb25uZWN0cyBhIHBpbiB0byBpdHNlbGYgKCR7a2V5cy5qb2luKCcsICcpfSkuYCB9KTtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGtleXMubGVuZ3RoOyBpKyspIGZvciAobGV0IGogPSBpICsgMTsgaiA8IGtleXMubGVuZ3RoOyBqKyspIHtcbiAgICAgIGNvbnN0IHBhaXIgPSBba2V5c1tpXSwga2V5c1tqXV0uc29ydCgpLmpvaW4oJ3wnKTtcbiAgICAgIGlmIChzZWVuUGFpcnMuaGFzKHBhaXIpKSB3YXJuaW5ncy5wdXNoKHsgY29kZTogJ0RVUExJQ0FURV9DT05ORUNUSU9OJywgcGF0aCwgbWVzc2FnZTogYER1cGxpY2F0ZSBjb25uZWN0aW9uIGJldHdlZW4gJHtrZXlzW2ldfSBhbmQgJHtrZXlzW2pdfS5gIH0pO1xuICAgICAgc2VlblBhaXJzLmFkZChwYWlyKTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBlIG9mIGVuZHMpIHtcbiAgICAgIGlmICghY29ubmVjdGVkUGlucy5oYXMoZS5jb21wKSkgY29ubmVjdGVkUGlucy5zZXQoZS5jb21wLCBuZXcgU2V0KCkpO1xuICAgICAgY29ubmVjdGVkUGlucy5nZXQoZS5jb21wKS5hZGQoZS5waW4pO1xuICAgIH1cbiAgICBjb25uZWN0aW9ucy5wdXNoKHsgZW5kcywgbmFtZTogY29ubi5uYW1lLCBwYXRoIH0pO1xuICB9XG5cbiAgZm9yIChjb25zdCBbaWQsIGVudHJ5XSBvZiBjb21wcykge1xuICAgIGlmICghZW50cnkpIGNvbnRpbnVlO1xuICAgIGNvbnN0IHVzZWQgPSBjb25uZWN0ZWRQaW5zLmdldChpZCk7XG4gICAgaWYgKCF1c2VkKSB7XG4gICAgICBpZiAoIW1lbnRpb25lZC5oYXMoaWQpKSB3YXJuaW5ncy5wdXNoKHsgY29kZTogJ1VOQ09OTkVDVEVEX0NPTVBPTkVOVCcsIGNvbXBvbmVudDogaWQsIG1lc3NhZ2U6IGAke2lkfSBpcyBub3QgY29ubmVjdGVkIHRvIGFueXRoaW5nLmAgfSk7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gICAgZm9yIChjb25zdCByZXEgb2YgZW50cnkuc3ltLnJlcXVpcmVkIHx8IFtdKSB7XG4gICAgICBjb25zdCBwaW4gPSByZXNvbHZlUGluKGVudHJ5LnN5bSwgcmVxKTtcbiAgICAgIGlmIChwaW4gJiYgIXVzZWQuaGFzKHBpbikpIHdhcm5pbmdzLnB1c2goeyBjb2RlOiAnTUlTU0lOR19SRVFVSVJFRF9QSU4nLCBjb21wb25lbnQ6IGlkLCBwaW4sIG1lc3NhZ2U6IGBSZXF1aXJlZCBwaW4gJHtwaW59IG9mICR7aWR9IGlzIG5vdCBjb25uZWN0ZWQuYCB9KTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4geyB2YWxpZDogZXJyb3JzLmxlbmd0aCA9PT0gMCwgZXJyb3JzLCB3YXJuaW5ncywgY2lyY3VpdCwgcmVzb2x2ZWQ6IHsgY29tcHMsIGNvbm5lY3Rpb25zIH0gfTtcbn1cbiIsICIvLyBWYWxpZGF0ZWQgY2lyY3VpdCAtPiBlbGVjdHJpY2FsIG5ldGxpc3QuXG4vLyBSYWlsIGNvbXBvbmVudHMgKGdyb3VuZCwgVkNDLCBuZXQgbGFiZWxzXHUyMDI2KSBhbmQganVuY3Rpb25zIGFyZSBub3QgcGxhY2VkOyB0aGV5XG4vLyBtZXJnZSBuZXRzIGFuZCBtYXJrIHRoZW0gYXMgcmFpbHMuIFJhaWxzIGFyZSBkcmF3biBhcyBhIG1hcmtlciBhdCBldmVyeSBwaW4uXG5pbXBvcnQgeyByZXNvbHZlU3ltYm9sIH0gZnJvbSAnLi4vc3ltYm9sLWxvYWRlci9pbmRleC5qcyc7XG5cbmNvbnN0IFJBSUxfUFJJT1JJVFkgPSB7IGdyb3VuZDogNCwgbmVnYXRpdmU6IDMsIHBvd2VyOiAyLCBsYWJlbDogMSB9O1xuXG5leHBvcnQgZnVuY3Rpb24gYnVpbGROZXRsaXN0KHZhbGlkYXRpb24pIHtcbiAgY29uc3QgeyBjb21wcywgY29ubmVjdGlvbnMgfSA9IHZhbGlkYXRpb24ucmVzb2x2ZWQ7XG4gIGNvbnN0IHBhcmVudCA9IG5ldyBNYXAoKTtcbiAgY29uc3QgZmluZCA9IChrKSA9PiB7XG4gICAgaWYgKCFwYXJlbnQuaGFzKGspKSBwYXJlbnQuc2V0KGssIGspO1xuICAgIGxldCByID0gaztcbiAgICB3aGlsZSAocGFyZW50LmdldChyKSAhPT0gcikgciA9IHBhcmVudC5nZXQocik7XG4gICAgd2hpbGUgKHBhcmVudC5nZXQoaykgIT09IHIpIHsgY29uc3QgbiA9IHBhcmVudC5nZXQoayk7IHBhcmVudC5zZXQoaywgcik7IGsgPSBuOyB9XG4gICAgcmV0dXJuIHI7XG4gIH07XG4gIGNvbnN0IHVuaW9uID0gKGEsIGIpID0+IHBhcmVudC5zZXQoZmluZChhKSwgZmluZChiKSk7XG5cbiAgY29uc3QgcGFydHMgPSBbXTtcbiAgY29uc3QgcmFpbE9mID0gbmV3IE1hcCgpOyAvLyByYWlsIGtleSAtPiB7a2luZCwgbmFtZSwgdHlwZX1cbiAgZm9yIChjb25zdCBbaWQsIGVudHJ5XSBvZiBjb21wcykge1xuICAgIGlmICghZW50cnkpIGNvbnRpbnVlO1xuICAgIGNvbnN0IHsgY29tcCwgc3ltIH0gPSBlbnRyeTtcbiAgICBpZiAoc3ltLnJhaWwpIHtcbiAgICAgIGNvbnN0IG5hbWUgPSBTdHJpbmcoY29tcC52YWx1ZSA/PyBjb21wLmxhYmVsID8/IChzeW0ucmFpbCA9PT0gJ2xhYmVsJyA/IGlkIDogc3ltLnRleHQ/LmRlZmF1bHQgPz8gJ0dORCcpKTtcbiAgICAgIGNvbnN0IGtleSA9IGByYWlsOiR7c3ltLnJhaWwgPT09ICdncm91bmQnID8gJ2dyb3VuZDonIDogJyd9JHtuYW1lfWA7XG4gICAgICB1bmlvbihgJHtpZH0uJHtzeW0ucGluT3JkZXJbMF19YCwga2V5KTtcbiAgICAgIGNvbnN0IHByZXYgPSByYWlsT2YuZ2V0KGtleSk7XG4gICAgICBpZiAoIXByZXYgfHwgUkFJTF9QUklPUklUWVtzeW0ucmFpbF0gPiBSQUlMX1BSSU9SSVRZW3ByZXYua2luZF0pIHJhaWxPZi5zZXQoa2V5LCB7IGtpbmQ6IHN5bS5yYWlsLCBuYW1lLCB0eXBlOiBzeW0udHlwZSB9KTtcbiAgICB9IGVsc2UgaWYgKHN5bS5raW5kID09PSAndmlydHVhbCcpIHtcbiAgICAgIGZpbmQoYCR7aWR9LiR7c3ltLnBpbk9yZGVyWzBdfWApO1xuICAgIH0gZWxzZSB7XG4gICAgICBwYXJ0cy5wdXNoKHsgaWQsIGNvbXAsIHN5bSwgcGluTmV0czoge30gfSk7XG4gICAgfVxuICB9XG4gIGZvciAoY29uc3QgYyBvZiBjb25uZWN0aW9ucykge1xuICAgIGNvbnN0IGtleXMgPSBjLmVuZHMubWFwKChlKSA9PiBgJHtlLmNvbXB9LiR7ZS5waW59YCk7XG4gICAgZm9yIChsZXQgaSA9IDE7IGkgPCBrZXlzLmxlbmd0aDsgaSsrKSB1bmlvbihrZXlzWzBdLCBrZXlzW2ldKTtcbiAgICBpZiAoYy5uYW1lKSB1bmlvbihrZXlzWzBdLCBgbmFtZWQ6JHtjLm5hbWV9YCk7XG4gIH1cblxuICAvLyBHcm91cCBrZXlzIGJ5IHJvb3QuXG4gIGNvbnN0IGdyb3VwcyA9IG5ldyBNYXAoKTtcbiAgZm9yIChjb25zdCBrIG9mIHBhcmVudC5rZXlzKCkpIHtcbiAgICBjb25zdCByID0gZmluZChrKTtcbiAgICBpZiAoIWdyb3Vwcy5oYXMocikpIGdyb3Vwcy5zZXQociwgW10pO1xuICAgIGdyb3Vwcy5nZXQocikucHVzaChrKTtcbiAgfVxuICBjb25zdCBwYXJ0SWRzID0gbmV3IFNldChwYXJ0cy5tYXAoKHApID0+IHAuaWQpKTtcbiAgY29uc3QgbmV0cyA9IG5ldyBNYXAoKTtcbiAgY29uc3Qga2V5VG9OZXQgPSBuZXcgTWFwKCk7XG4gIGxldCBuID0gMDtcbiAgZm9yIChjb25zdCBrZXlzIG9mIGdyb3Vwcy52YWx1ZXMoKSkge1xuICAgIGNvbnN0IHBpbnMgPSBbXTtcbiAgICBsZXQgcmFpbCA9IG51bGwsIG5hbWUgPSBudWxsO1xuICAgIGZvciAoY29uc3QgayBvZiBrZXlzKSB7XG4gICAgICBpZiAoay5zdGFydHNXaXRoKCdyYWlsOicpKSB7XG4gICAgICAgIGNvbnN0IHIgPSByYWlsT2YuZ2V0KGspO1xuICAgICAgICBpZiAoIXJhaWwgfHwgUkFJTF9QUklPUklUWVtyLmtpbmRdID4gUkFJTF9QUklPUklUWVtyYWlsLmtpbmRdKSByYWlsID0gcjtcbiAgICAgIH0gZWxzZSBpZiAoay5zdGFydHNXaXRoKCduYW1lZDonKSkgbmFtZSA9IG5hbWUgfHwgay5zbGljZSg2KTtcbiAgICAgIGVsc2Uge1xuICAgICAgICBjb25zdCBpID0gay5pbmRleE9mKCcuJyk7XG4gICAgICAgIGNvbnN0IGNvbXAgPSBrLnNsaWNlKDAsIGkpLCBwaW4gPSBrLnNsaWNlKGkgKyAxKTtcbiAgICAgICAgaWYgKHBhcnRJZHMuaGFzKGNvbXApKSBwaW5zLnB1c2goeyBjb21wLCBwaW4gfSk7XG4gICAgICB9XG4gICAgfVxuICAgIGlmICghcGlucy5sZW5ndGgpIGNvbnRpbnVlO1xuICAgIGNvbnN0IGlkID0gYE4keysrbn1gO1xuICAgIGlmIChyYWlsKSByYWlsID0geyAuLi5yYWlsLCBzeW06IHJlc29sdmVTeW1ib2woeyB0eXBlOiByYWlsLnR5cGUgfSkgfTtcbiAgICBuZXRzLnNldChpZCwgeyBpZCwgbmFtZTogcmFpbCA/IHJhaWwubmFtZSA6IG5hbWUsIHBpbnMsIHJhaWwgfSk7XG4gICAgZm9yIChjb25zdCBrIG9mIGtleXMpIGtleVRvTmV0LnNldChrLCBpZCk7XG4gIH1cbiAgZm9yIChjb25zdCBwIG9mIHBhcnRzKSB7XG4gICAgZm9yIChjb25zdCBwaW4gb2YgcC5zeW0ucGluT3JkZXIpIHtcbiAgICAgIGNvbnN0IG5ldCA9IGtleVRvTmV0LmdldChgJHtwLmlkfS4ke3Bpbn1gKTtcbiAgICAgIGlmIChuZXQpIHAucGluTmV0c1twaW5dID0gbmV0O1xuICAgIH1cbiAgfVxuXG4gIC8vIFdpdGhvdXQgYW4gZXhwbGljaXQgZ3JvdW5kLCB0aGUgZmlyc3Qgc291cmNlJ3MgbmVnYXRpdmUgbmV0IGFjdHMgYXMgdGhlXG4gIC8vIHJldHVybiBwYXRoOiBpdCBpcyBsYWlkIG91dCBsaWtlIGdyb3VuZCBidXQgZHJhd24gd2l0aCByZWFsIHdpcmVzLlxuICBsZXQgcmV0dXJuTmV0ID0gbnVsbDtcbiAgY29uc3QgaGFzR3JvdW5kID0gWy4uLm5ldHMudmFsdWVzKCldLnNvbWUoKHgpID0+IHgucmFpbCAmJiAoeC5yYWlsLmtpbmQgPT09ICdncm91bmQnIHx8IHgucmFpbC5raW5kID09PSAnbmVnYXRpdmUnKSk7XG4gIGlmICghaGFzR3JvdW5kKSB7XG4gICAgY29uc3Qgc3JjID0gcGFydHMuZmluZCgocCkgPT4gcC5zeW0uc291cmNlICYmIHAucGluTmV0cy5uZWdhdGl2ZSAmJiAhbmV0cy5nZXQocC5waW5OZXRzLm5lZ2F0aXZlKS5yYWlsKTtcbiAgICBpZiAoc3JjKSByZXR1cm5OZXQgPSBzcmMucGluTmV0cy5uZWdhdGl2ZTtcbiAgfVxuICByZXR1cm4geyBwYXJ0cywgbmV0cywgcmV0dXJuTmV0IH07XG59XG4iLCAiLy8gQSBwbGFjZWQgY29tcG9uZW50OiB3b3JsZCBwaW5zLCBib2R5LCByYWlsIG1hcmtlcnMsIGxhYmVscyBhbmQgdG90YWwgZXh0ZW50LlxuaW1wb3J0IHsgRElSUywgT1BQT1NJVEUsIHhmb3JtLCB4Zm9ybURpciwgeGZvcm1SZWN0LCByb3RhdGVWZWMsIHZlY1RvRGlyLCB1bmlvblJlY3QsIGJvdW5kc09mLCB0ZXh0V2lkdGggfSBmcm9tICcuLi91dGlscy9nZW9tZXRyeS5qcyc7XG5cbmV4cG9ydCBjb25zdCBSRUZfU0laRSA9IDExO1xuZXhwb3J0IGNvbnN0IFZBTFVFX1NJWkUgPSAxMC41O1xuXG5mdW5jdGlvbiB0ZXh0Qm94KHRleHQsIHgsIHksIGFuY2hvciwgc2l6ZSkge1xuICBjb25zdCB3ID0gdGV4dFdpZHRoKHRleHQsIHNpemUpO1xuICBjb25zdCB4MCA9IGFuY2hvciA9PT0gJ3N0YXJ0JyA/IHggOiBhbmNob3IgPT09ICdlbmQnID8geCAtIHcgOiB4IC0gdyAvIDI7XG4gIHJldHVybiB7IHg6IHgwLCB5OiB5IC0gc2l6ZSAqIDAuODIsIHcsIGg6IHNpemUgKiAxLjA1IH07XG59XG5cbmZ1bmN0aW9uIGxhYmVsKHRleHQsIHgsIHksIGFuY2hvciwgY2xzLCBzaXplKSB7XG4gIHJldHVybiB7IHRleHQ6IFN0cmluZyh0ZXh0KSwgeCwgeSwgYW5jaG9yLCBjbHMsIHNpemUsIGJveDogdGV4dEJveCh0ZXh0LCB4LCB5LCBhbmNob3IsIHNpemUpIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBtYWtlSW5zdGFuY2UocGFydCwgeCwgeSwgcm90LCBtaXJyb3IsIG5ldHMpIHtcbiAgY29uc3QgcyA9IHBhcnQuc3ltO1xuICBjb25zdCB0ID0geyB4LCB5LCByb3QsIG1pcnJvciwgb3g6IHMub3JpZ2luLngsIG95OiBzLm9yaWdpbi55IH07XG4gIGNvbnN0IHBpbnMgPSB7fTtcbiAgZm9yIChjb25zdCBuIG9mIHMucGluT3JkZXIpIHtcbiAgICBjb25zdCB3ID0geGZvcm0ocy5waW5zW25dLCB0KTtcbiAgICBwaW5zW25dID0geyB4OiB3LngsIHk6IHcueSwgZGlyOiB4Zm9ybURpcihzLnBpbnNbbl0uZGlyLCB0KSB9O1xuICB9XG4gIGNvbnN0IGluc3QgPSB7IGlkOiBwYXJ0LmlkLCBwYXJ0LCB0LCB4LCB5LCByb3QsIG1pcnJvciwgcGlucywgYm9keTogeGZvcm1SZWN0KHMuYm9keSwgdCkgfTtcbiAgaW5zdC5tYXJrZXJzID0gYnVpbGRNYXJrZXJzKGluc3QsIG5ldHMpO1xuICBjb25zdCB7IHByaW1hcnksIGFsdCB9ID0gYnVpbGRMYWJlbHMoaW5zdCk7XG4gIGluc3QubGFiZWxzID0gcHJpbWFyeTtcbiAgaW5zdC5sYWJlbEFsdCA9IGFsdDtcbiAgY29tcHV0ZUV4dGVudChpbnN0KTtcbiAgcmV0dXJuIGluc3Q7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjb21wdXRlRXh0ZW50KGluc3QpIHtcbiAgbGV0IGUgPSB1bmlvblJlY3QoaW5zdC5ib2R5LCBib3VuZHNPZihPYmplY3QudmFsdWVzKGluc3QucGlucykpKTtcbiAgZm9yIChjb25zdCBtIG9mIGluc3QubWFya2VycykgZSA9IHVuaW9uUmVjdChlLCBtLmJib3gpO1xuICBmb3IgKGNvbnN0IGwgb2YgaW5zdC5sYWJlbHMpIGUgPSB1bmlvblJlY3QoZSwgbC5ib3gpO1xuICBpbnN0LmV4dGVudCA9IGU7XG59XG5cbmZ1bmN0aW9uIHJvdEZvcihsb2NhbERpciwgd29ybGREaXIpIHtcbiAgZm9yIChjb25zdCByIG9mIFswLCA5MCwgMTgwLCAyNzBdKSB7XG4gICAgY29uc3QgZCA9IERJUlNbbG9jYWxEaXJdO1xuICAgIGlmICh2ZWNUb0Rpcihyb3RhdGVWZWMoZC54LCBkLnksIHIpKSA9PT0gd29ybGREaXIpIHJldHVybiByO1xuICB9XG4gIHJldHVybiAwO1xufVxuXG5jb25zdCByYWlsRmFjZSA9IChyYWlsLCBwaW5EaXIpID0+IChyYWlsLmtpbmQgPT09ICdncm91bmQnIHx8IHJhaWwua2luZCA9PT0gJ25lZ2F0aXZlJyA/ICdkb3duJyA6IHJhaWwua2luZCA9PT0gJ3Bvd2VyJyA/ICd1cCcgOiBwaW5EaXIpO1xuXG5mdW5jdGlvbiBidWlsZE1hcmtlcnMoaW5zdCwgbmV0cykge1xuICBjb25zdCBvdXQgPSBbXTtcbiAgaWYgKCFuZXRzKSByZXR1cm4gb3V0O1xuICAvLyBBZGphY2VudCBwaW5zIG9uIHRoZSBzYW1lIHNpZGUgZ29pbmcgdG8gdGhlIHNhbWUgcmFpbCBzaGFyZSBvbmUgbWFya2VyXG4gIC8vIChlLmcuIGEgNTU1J3MgVkNDIGFuZCBSRVNFVCk6IHNob3J0IHN0dWJzIGpvaW5lZCBieSBhIGJ1cy5cbiAgY29uc3QgZ3JvdXBzID0gbmV3IE1hcCgpO1xuICBmb3IgKGNvbnN0IFtwaW5OYW1lLCBuZXRdIG9mIE9iamVjdC5lbnRyaWVzKGluc3QucGFydC5waW5OZXRzKSkge1xuICAgIGNvbnN0IGluZm8gPSBuZXRzLmdldChuZXQpO1xuICAgIGlmICghaW5mbz8ucmFpbCkgY29udGludWU7XG4gICAgY29uc3QgcGluID0gaW5zdC5waW5zW3Bpbk5hbWVdO1xuICAgIGNvbnN0IGtleSA9IHJhaWxGYWNlKGluZm8ucmFpbCwgcGluLmRpcikgPT09IHBpbi5kaXIgJiYgaW5mby5yYWlsLmtpbmQgIT09ICdsYWJlbCcgPyBuZXQgKyAnfCcgKyBwaW4uZGlyIDogcGluTmFtZTtcbiAgICBpZiAoIWdyb3Vwcy5oYXMoa2V5KSkgZ3JvdXBzLnNldChrZXksIFtdKTtcbiAgICBncm91cHMuZ2V0KGtleSkucHVzaChwaW5OYW1lKTtcbiAgfVxuICBmb3IgKGNvbnN0IHBpbk5hbWVzIG9mIGdyb3Vwcy52YWx1ZXMoKSkge1xuICAgIGNvbnN0IG5ldCA9IGluc3QucGFydC5waW5OZXRzW3Bpbk5hbWVzWzBdXTtcbiAgICBjb25zdCByYWlsID0gbmV0cy5nZXQobmV0KS5yYWlsO1xuICAgIGxldCBwaW4gPSBpbnN0LnBpbnNbcGluTmFtZXNbMF1dO1xuICAgIGxldCBmYWNlID0gcmFpbEZhY2UocmFpbCwgcGluLmRpcik7XG4gICAgbGV0IHN0dWIgPSAwO1xuICAgIGNvbnN0IHN0dWJzID0gW107XG4gICAgbGV0IGJ1cyA9IG51bGw7XG4gICAgaWYgKHBpbk5hbWVzLmxlbmd0aCA+IDEpIHtcbiAgICAgIGNvbnN0IGQgPSBESVJTW3Bpbi5kaXJdO1xuICAgICAgY29uc3QgZW5kcyA9IHBpbk5hbWVzLm1hcCgobikgPT4ge1xuICAgICAgICBjb25zdCBwID0gaW5zdC5waW5zW25dO1xuICAgICAgICBzdHVicy5wdXNoKHsgeDE6IHAueCwgeTE6IHAueSwgeDI6IHAueCArIGQueCAqIDEwLCB5MjogcC55ICsgZC55ICogMTAgfSk7XG4gICAgICAgIHJldHVybiB7IHg6IHAueCArIGQueCAqIDEwLCB5OiBwLnkgKyBkLnkgKiAxMCB9O1xuICAgICAgfSk7XG4gICAgICBjb25zdCBiID0gYm91bmRzT2YoZW5kcyk7XG4gICAgICBidXMgPSB7IHgxOiBiLngsIHkxOiBiLnksIHgyOiBiLnggKyBiLncsIHkyOiBiLnkgKyBiLmggfTtcbiAgICAgIHN0dWJzLnB1c2goYnVzKTtcbiAgICAgIGNvbnN0IG1pZCA9IHsgeDogTWF0aC5yb3VuZCgoYi54ICsgYi53IC8gMikgLyAxMCkgKiAxMCwgeTogTWF0aC5yb3VuZCgoYi55ICsgYi5oIC8gMikgLyAxMCkgKiAxMCB9O1xuICAgICAgcGluID0geyAuLi5taWQsIGRpcjogcGluLmRpciB9O1xuICAgIH1cbiAgICBpZiAoZmFjZSA9PT0gT1BQT1NJVEVbcGluLmRpcl0pIGZhY2UgPSBwaW4uZGlyO1xuICAgIGVsc2UgaWYgKGZhY2UgIT09IHBpbi5kaXIpIHN0dWIgPSByYWlsLmtpbmQgPT09ICdsYWJlbCcgPyAxMCA6IDMwO1xuICAgIGNvbnN0IGQgPSBESVJTW3Bpbi5kaXJdO1xuICAgIGNvbnN0IGF0ID0geyB4OiBwaW4ueCArIGQueCAqIHN0dWIsIHk6IHBpbi55ICsgZC55ICogc3R1YiB9O1xuICAgIGlmIChzdHViKSBzdHVicy5wdXNoKHsgeDE6IHBpbi54LCB5MTogcGluLnksIHgyOiBhdC54LCB5MjogYXQueSB9KTtcbiAgICBjb25zdCBtID0geyBuZXQsIHBpbjogcGluTmFtZXNbMF0sIHBpbnM6IHBpbk5hbWVzLCByYWlsLCBmYWNlLCBzdHVicywgZG90OiBidXMgPyB7IHg6IHBpbi54LCB5OiBwaW4ueSB9IDogbnVsbCB9O1xuICAgIGlmIChyYWlsLmtpbmQgPT09ICdsYWJlbCcpIHtcbiAgICAgIGJ1aWxkTGFiZWxGbGFnKG0sIGF0LCBmYWNlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgbXMgPSByYWlsLnN5bTtcbiAgICAgIGNvbnN0IG10ID0geyB4OiBhdC54LCB5OiBhdC55LCByb3Q6IHJvdEZvcihtcy5waW5zW21zLnBpbk9yZGVyWzBdXS5kaXIsIE9QUE9TSVRFW2ZhY2VdKSwgbWlycm9yOiBmYWxzZSwgb3g6IG1zLm9yaWdpbi54LCBveTogbXMub3JpZ2luLnkgfTtcbiAgICAgIG0udCA9IG10O1xuICAgICAgbS5zeW0gPSBtcztcbiAgICAgIG0uYmJveCA9IHhmb3JtUmVjdChtcy5ib2R5LCBtdCk7XG4gICAgICBpZiAobXMudGV4dCkge1xuICAgICAgICBjb25zdCBwID0geGZvcm0obXMudGV4dCwgbXQpO1xuICAgICAgICAvLyBLZWVwIHJhaWwgdGV4dCB1cHJpZ2h0IGFuZCBvbiB0aGUgZmFyIHNpZGUgb2YgdGhlIG1hcmtlci5cbiAgICAgICAgY29uc3QgeSA9IGZhY2UgPT09ICdkb3duJyA/IG0uYmJveC55ICsgbS5iYm94LmggKyAxMSA6IGZhY2UgPT09ICd1cCcgPyBtLmJib3gueSAtIDUgOiBwLnkgKyA0O1xuICAgICAgICBjb25zdCB4ID0gZmFjZSA9PT0gJ2xlZnQnID8gbS5iYm94LnggLSAzIDogZmFjZSA9PT0gJ3JpZ2h0JyA/IG0uYmJveC54ICsgbS5iYm94LncgKyAzIDogcC54O1xuICAgICAgICBjb25zdCBhbmNob3IgPSBmYWNlID09PSAnbGVmdCcgPyAnZW5kJyA6IGZhY2UgPT09ICdyaWdodCcgPyAnc3RhcnQnIDogJ21pZGRsZSc7XG4gICAgICAgIG0udGV4dCA9IGxhYmVsKHJhaWwubmFtZSwgeCwgeSwgYW5jaG9yLCAncmFpbCcsIDEwKTtcbiAgICAgICAgbS5iYm94ID0gdW5pb25SZWN0KG0uYmJveCwgbS50ZXh0LmJveCk7XG4gICAgICB9XG4gICAgfVxuICAgIGZvciAoY29uc3Qgc3Qgb2Ygc3R1YnMpIG0uYmJveCA9IHVuaW9uUmVjdChtLmJib3gsIGJvdW5kc09mKFt7IHg6IHN0LngxLCB5OiBzdC55MSB9LCB7IHg6IHN0LngyLCB5OiBzdC55MiB9XSkpO1xuICAgIG91dC5wdXNoKG0pO1xuICB9XG4gIHJldHVybiBvdXQ7XG59XG5cbmZ1bmN0aW9uIGJ1aWxkTGFiZWxGbGFnKG0sIGF0LCBmYWNlKSB7XG4gIGNvbnN0IG5hbWUgPSBtLnJhaWwubmFtZTtcbiAgY29uc3QgdyA9IHRleHRXaWR0aChuYW1lLCAxMCkgKyAxNCwgaCA9IDE0O1xuICBjb25zdCB7IHgsIHkgfSA9IGF0O1xuICBsZXQgcHRzLCB0eCwgdHksIGFuY2hvcjtcbiAgaWYgKGZhY2UgPT09ICdyaWdodCcgfHwgZmFjZSA9PT0gJ2xlZnQnKSB7XG4gICAgY29uc3QgcyA9IGZhY2UgPT09ICdyaWdodCcgPyAxIDogLTE7XG4gICAgcHRzID0gW1t4LCB5XSwgW3ggKyBzICogNywgeSAtIGggLyAyXSwgW3ggKyBzICogdywgeSAtIGggLyAyXSwgW3ggKyBzICogdywgeSArIGggLyAyXSwgW3ggKyBzICogNywgeSArIGggLyAyXV07XG4gICAgdHggPSB4ICsgcyAqIDk7IHR5ID0geSArIDMuNTsgYW5jaG9yID0gZmFjZSA9PT0gJ3JpZ2h0JyA/ICdzdGFydCcgOiAnZW5kJztcbiAgfSBlbHNlIHtcbiAgICBjb25zdCBzID0gZmFjZSA9PT0gJ2Rvd24nID8gMSA6IC0xO1xuICAgIGNvbnN0IHRvcCA9IGZhY2UgPT09ICdkb3duJyA/IHkgKyA3IDogeSAtIDcgLSBoO1xuICAgIHB0cyA9IFtbeCwgeV0sIFt4LCB5ICsgcyAqIDddXTsgLy8gc2hvcnQgc3RlbSBpbnRvIGEgYm94ZWQgbGFiZWxcbiAgICBtLmJveCA9IHsgeDogeCAtIHcgLyAyLCB5OiB0b3AsIHcsIGggfTtcbiAgICB0eCA9IHg7IHR5ID0gdG9wICsgaCAvIDIgKyAzLjU7IGFuY2hvciA9ICdtaWRkbGUnO1xuICB9XG4gIG0uZmxhZyA9IHB0cztcbiAgbS50ZXh0ID0gbGFiZWwobmFtZSwgdHgsIHR5LCBhbmNob3IsICduZXRsYWJlbCcsIDEwKTtcbiAgbS5iYm94ID0gYm91bmRzT2YoWy4uLnB0cy5tYXAoKFtweCwgcHldKSA9PiAoeyB4OiBweCwgeTogcHkgfSkpLCAuLi4obS5ib3ggPyBbeyB4OiBtLmJveC54LCB5OiBtLmJveC55IH0sIHsgeDogbS5ib3gueCArIG0uYm94LncsIHk6IG0uYm94LnkgKyBtLmJveC5oIH1dIDogW10pXSk7XG59XG5cbmZ1bmN0aW9uIGJ1aWxkTGFiZWxzKGluc3QpIHtcbiAgY29uc3QgcyA9IGluc3QucGFydC5zeW0sIGMgPSBpbnN0LnBhcnQuY29tcDtcbiAgY29uc3QgYiA9IGluc3QuYm9keTtcbiAgY29uc3QgY3ggPSBiLnggKyBiLncgLyAyLCBjeSA9IGIueSArIGIuaCAvIDI7XG4gIGNvbnN0IHJlZiA9IGMubGFiZWwgPz8gYy5pZDtcbiAgY29uc3QgdmFsdWUgPSBjLnZhbHVlICE9IG51bGwgJiYgYy52YWx1ZSAhPT0gJycgPyBTdHJpbmcoYy52YWx1ZSkgOiBudWxsO1xuICBjb25zdCBwcmltYXJ5ID0gW10sIGFsdCA9IFtdO1xuXG4gIGlmIChzLnRleHQpIHtcbiAgICBjb25zdCBwID0geGZvcm0ocy50ZXh0LCBpbnN0LnQpO1xuICAgIGNvbnN0IHR4dCA9IHMudGV4dC5kZWZhdWx0ID09PSAnJGlkJyA/IChjLmxhYmVsID8/IGMudmFsdWUgPz8gYy5pZCkgOiAoYy52YWx1ZSA/PyBzLnRleHQuZGVmYXVsdCk7XG4gICAgLy8gVGVybWluYWwgdGV4dCBhbHdheXMgcmVhZHMgb3V0d2FyZCBmcm9tIHRoZSBwaW4uXG4gICAgY29uc3QgcGluRGlyID0gaW5zdC5waW5zW3MucGluT3JkZXJbMF1dLmRpcjtcbiAgICBsZXQgYW5jaG9yID0gcy50ZXh0LmFuY2hvcjtcbiAgICBpZiAocy50ZXJtaW5hbCkge1xuICAgICAgYW5jaG9yID0gcGluRGlyID09PSAncmlnaHQnID8gJ2VuZCcgOiBwaW5EaXIgPT09ICdsZWZ0JyA/ICdzdGFydCcgOiAnbWlkZGxlJztcbiAgICAgIGNvbnN0IHEgPSBhbmNob3IgPT09ICdlbmQnID8geyB4OiBiLnggLSA0LCB5OiBjeSArIDQgfSA6IGFuY2hvciA9PT0gJ3N0YXJ0JyA/IHsgeDogYi54ICsgYi53ICsgNCwgeTogY3kgKyA0IH0gOiB7IHg6IGN4LCB5OiBwaW5EaXIgPT09ICdkb3duJyA/IGIueSAtIDQgOiBiLnkgKyBiLmggKyAxMiB9O1xuICAgICAgcHJpbWFyeS5wdXNoKGxhYmVsKHR4dCwgcS54LCBxLnksIGFuY2hvciwgJ3RleHQnLCBSRUZfU0laRSkpO1xuICAgIH0gZWxzZSBwcmltYXJ5LnB1c2gobGFiZWwodHh0LCBwLngsIHAueSArIDQsIGFuY2hvciwgJ3RleHQnLCBSRUZfU0laRSkpO1xuICAgIHJldHVybiB7IHByaW1hcnksIGFsdCB9O1xuICB9XG4gIGlmIChzLmxhYmVscyA9PT0gJ25vbmUnKSByZXR1cm4geyBwcmltYXJ5LCBhbHQgfTtcblxuICBjb25zdCBzaWRlID0gKHJpZ2h0KSA9PiB7XG4gICAgY29uc3QgeCA9IHJpZ2h0ID8gYi54ICsgYi53ICsgNiA6IGIueCAtIDY7XG4gICAgY29uc3QgYSA9IHJpZ2h0ID8gJ3N0YXJ0JyA6ICdlbmQnO1xuICAgIGNvbnN0IG91dCA9IFtdO1xuICAgIGlmICh2YWx1ZSkge1xuICAgICAgb3V0LnB1c2gobGFiZWwocmVmLCB4LCBjeSAtIDEsIGEsICdyZWYnLCBSRUZfU0laRSkpO1xuICAgICAgb3V0LnB1c2gobGFiZWwodmFsdWUsIHgsIGN5ICsgMTEsIGEsICd2YWx1ZScsIFZBTFVFX1NJWkUpKTtcbiAgICB9IGVsc2Ugb3V0LnB1c2gobGFiZWwocmVmLCB4LCBjeSArIDQsIGEsICdyZWYnLCBSRUZfU0laRSkpO1xuICAgIHJldHVybiBvdXQ7XG4gIH07XG4gIGNvbnN0IGhvcml6b250YWxQaW5zID0gcy50d29UZXJtaW5hbCAmJiBbJ2xlZnQnLCAncmlnaHQnXS5pbmNsdWRlcyhpbnN0LnBpbnNbcy5waW5PcmRlclswXV0uZGlyKTtcblxuICBpZiAocy50d29UZXJtaW5hbCAmJiBob3Jpem9udGFsUGlucykge1xuICAgIHByaW1hcnkucHVzaChsYWJlbChyZWYsIGN4LCBiLnkgLSA1LCAnbWlkZGxlJywgJ3JlZicsIFJFRl9TSVpFKSk7XG4gICAgaWYgKHZhbHVlKSBwcmltYXJ5LnB1c2gobGFiZWwodmFsdWUsIGN4LCBiLnkgKyBiLmggKyAxMiwgJ21pZGRsZScsICd2YWx1ZScsIFZBTFVFX1NJWkUpKTtcbiAgICBhbHQucHVzaChsYWJlbChyZWYsIGN4LCBiLnkgLSAodmFsdWUgPyAxNyA6IDUpLCAnbWlkZGxlJywgJ3JlZicsIFJFRl9TSVpFKSk7XG4gICAgaWYgKHZhbHVlKSBhbHQucHVzaChsYWJlbCh2YWx1ZSwgY3gsIGIueSAtIDUsICdtaWRkbGUnLCAndmFsdWUnLCBWQUxVRV9TSVpFKSk7XG4gIH0gZWxzZSBpZiAocy50d29UZXJtaW5hbCB8fCBzLmxhYmVscyA9PT0gJ3JpZ2h0Jykge1xuICAgIHByaW1hcnkucHVzaCguLi5zaWRlKHRydWUpKTtcbiAgICBhbHQucHVzaCguLi5zaWRlKGZhbHNlKSk7XG4gIH0gZWxzZSBpZiAocy5sYWJlbHMgPT09ICd0b3ByaWdodCcpIHtcbiAgICBjb25zdCB4ID0gY3ggKyAxNjtcbiAgICBwcmltYXJ5LnB1c2gobGFiZWwocmVmLCB4LCBiLnkgKyAzLCAnc3RhcnQnLCAncmVmJywgUkVGX1NJWkUpKTtcbiAgICBpZiAodmFsdWUpIHByaW1hcnkucHVzaChsYWJlbCh2YWx1ZSwgeCwgYi55ICsgMTUsICdzdGFydCcsICd2YWx1ZScsIFZBTFVFX1NJWkUpKTtcbiAgfSBlbHNlIGlmIChzLmxhYmVscyA9PT0gJ2JveCcpIHtcbiAgICBwcmltYXJ5LnB1c2gobGFiZWwocmVmLCBiLnggKyBiLncsIGIueSAtIDUsICdlbmQnLCAncmVmJywgUkVGX1NJWkUpKTtcbiAgICAvLyB2YWx1ZSBpcyBkcmF3biBpbnNpZGUgdGhlIGJveCBieSB0aGUgc3ltYm9sIGdlbmVyYXRvclxuICB9IGVsc2Uge1xuICAgIHByaW1hcnkucHVzaChsYWJlbChyZWYsIGN4LCBiLnkgLSA1LCAnbWlkZGxlJywgJ3JlZicsIFJFRl9TSVpFKSk7XG4gICAgaWYgKHZhbHVlKSBwcmltYXJ5LnB1c2gobGFiZWwodmFsdWUsIGN4LCBiLnkgKyBiLmggKyAxMiwgJ21pZGRsZScsICd2YWx1ZScsIFZBTFVFX1NJWkUpKTtcbiAgfVxuICByZXR1cm4geyBwcmltYXJ5LCBhbHQgfTtcbn1cbiIsICIvLyBBdXRvbWF0aWMgc2NoZW1hdGljIHBsYWNlbWVudC5cbi8vXG4vLyAxLiBPcmllbnRhdGlvbjogc291cmNlcyB2ZXJ0aWNhbCAoKyB1cCk7IHR3by10ZXJtaW5hbCBwYXJ0cyB0b3VjaGluZyBhIHJhaWxcbi8vICAgIGhhbmcgdmVydGljYWxseSB0b3dhcmQgaXQgKGdyb3VuZCBkb3duLCBzdXBwbHkgdXApOyBvdGhlcnMgbGllIGhvcml6b250YWwuXG4vLyAyLiBDb2x1bW5zOiBCRlMgb3ZlciBzaWduYWwgbmV0cywgc3RlcHBpbmcgbGVmdC9yaWdodCBhY2NvcmRpbmcgdG8gdGhlIHBpblxuLy8gICAgc2lkZSBhIG5laWdoYm91ciBoYW5ncyBvZmY7IGRpZ2l0YWwgb3V0LT5pbiBlZGdlcyBhcmUgdGhlbiByZWxheGVkIGludG8gYVxuLy8gICAgbG9uZ2VzdC1wYXRoIGxheWVyaW5nIHNvIHNpZ25hbCBmbG93IHJlYWRzIGxlZnQgdG8gcmlnaHQuXG4vLyAzLiBQbGFjZW1lbnQ6IHdhdmUgYnkgd2F2ZSwgZWFjaCBwYXJ0IGlzIGFsaWduZWQgc28gb25lIG9mIGl0cyBwaW5zIHNpdHMgb25cbi8vICAgIHRoZSBob3Jpem9udGFsIFwibGluZVwiIG9mIGFuIGFscmVhZHkgcGxhY2VkIG5ldCAoZmV3IGJlbmRzKS4gU3BlY2lhbCBjYXNlczpcbi8vICAgIHBhcnRzIHN0YWNrZWQgc3RyYWlnaHQgb2ZmIHZlcnRpY2FsIHBpbnMgKGNvbGxlY3Rvci9lbWl0dGVyIHJlc2lzdG9ycykgYW5kXG4vLyAgICBmZWVkYmFjayBlbGVtZW50cyBwbGFjZWQgb3ZlciB0aGVpciBvcC1hbXAuIENvbGxpc2lvbnMgYXJlIHJlc29sdmVkIGJ5XG4vLyAgICBzbGlkaW5nIGF3YXkgZnJvbSB0aGUgbmV0J3Mgc291cmNlIChhbmFsb2cpIG9yIGRvd24gKGRpZ2l0YWwvdGVybWluYWxzKS5cbmltcG9ydCB7IG1ha2VJbnN0YW5jZSB9IGZyb20gJy4vaW5zdGFuY2UuanMnO1xuaW1wb3J0IHsgRElSUywgT1BQT1NJVEUsIEdSSUQsIHNuYXAsIHhmb3JtRGlyLCBvdmVybGFwcywgaW5mbGF0ZSB9IGZyb20gJy4uL3V0aWxzL2dlb21ldHJ5LmpzJztcblxuY29uc3QgQ09MX0dBUCA9IDQwO1xuY29uc3QgQ0xFQVIgPSAxNjtcblxuZXhwb3J0IGZ1bmN0aW9uIGxheW91dENpcmN1aXQobmwpIHtcbiAgY29uc3QgeyBwYXJ0cywgbmV0cyB9ID0gbmw7XG4gIGNvbnN0IGJ5SWQgPSBuZXcgTWFwKHBhcnRzLm1hcCgocCkgPT4gW3AuaWQsIHBdKSk7XG4gIGNvbnN0IHJhaWxLaW5kID0gKG4pID0+IChuID8gbmV0cy5nZXQobik/LnJhaWw/LmtpbmQgOiB1bmRlZmluZWQpO1xuICBjb25zdCBwdWxsID0gKG4pID0+IHtcbiAgICBpZiAoIW4pIHJldHVybiBudWxsO1xuICAgIGNvbnN0IGsgPSByYWlsS2luZChuKTtcbiAgICBpZiAoayA9PT0gJ2dyb3VuZCcgfHwgayA9PT0gJ25lZ2F0aXZlJyB8fCBuID09PSBubC5yZXR1cm5OZXQpIHJldHVybiAnZG93bic7XG4gICAgaWYgKGsgPT09ICdwb3dlcicpIHJldHVybiAndXAnO1xuICAgIHJldHVybiBudWxsO1xuICB9O1xuICBjb25zdCBzaWduYWwgPSAobikgPT4gbiAmJiAhcmFpbEtpbmQobikgJiYgbiAhPT0gbmwucmV0dXJuTmV0O1xuXG4gIC8vIC0tLS0gMS4gb3JpZW50YXRpb25cbiAgY29uc3Qgb3JpZW50ID0gbmV3IE1hcCgpO1xuICBmb3IgKGNvbnN0IHAgb2YgcGFydHMpIHtcbiAgICBjb25zdCBjID0gcC5jb21wLCBzID0gcC5zeW07XG4gICAgaWYgKGMucm90YXRpb24gIT09IHVuZGVmaW5lZCB8fCBjLm1pcnJvcikge1xuICAgICAgb3JpZW50LnNldChwLmlkLCB7IHJvdDogYy5yb3RhdGlvbiB8fCAwLCBtaXJyb3I6ICEhYy5taXJyb3IsIGZpeGVkOiB0cnVlIH0pO1xuICAgICAgY29udGludWU7XG4gICAgfVxuICAgIGxldCByb3QgPSBzLmRlZmF1bHRSb3RhdGlvbiB8fCAwLCBtaXJyb3IgPSBmYWxzZSwgZmxleCA9IGZhbHNlO1xuICAgIGNvbnN0IFthLCBiXSA9IHMucGluT3JkZXI7XG4gICAgaWYgKHMuc291cmNlKSB7XG4gICAgICBjb25zdCBwcCA9IHB1bGwocC5waW5OZXRzLnBvc2l0aXZlKSwgcG4gPSBwdWxsKHAucGluTmV0cy5uZWdhdGl2ZSk7XG4gICAgICByb3QgPSAocHAgPT09ICdkb3duJyAmJiBwbiAhPT0gJ2Rvd24nKSB8fCAocG4gPT09ICd1cCcgJiYgcHAgIT09ICd1cCcpID8gMTgwIDogMDtcbiAgICB9IGVsc2UgaWYgKHMudHdvVGVybWluYWwpIHtcbiAgICAgIGNvbnN0IHBhID0gcHVsbChwLnBpbk5ldHNbYV0pLCBwYiA9IHB1bGwocC5waW5OZXRzW2JdKTtcbiAgICAgIGlmIChwYSB8fCBwYikgcm90ID0gcGEgPT09ICdkb3duJyB8fCAocGIgPT09ICd1cCcgJiYgcGEgIT09ICdkb3duJykgPyAyNzAgOiA5MDtcbiAgICAgIGVsc2UgZmxleCA9IHRydWU7XG4gICAgfSBlbHNlIGlmICgocy50eXBlID09PSAnb3BhbXAnIHx8IHMudHlwZSA9PT0gJ2NvbXBhcmF0b3InKSAmJiAhcC5waW5OZXRzWyd2KyddICYmICFwLnBpbk5ldHNbJ3YtJ10pIHtcbiAgICAgIC8vIEludmVydGluZyBzdGFnZXMgcmVhZCBiZXR0ZXIgd2l0aCB0aGUgaW52ZXJ0aW5nIGlucHV0IG9uIHRvcC5cbiAgICAgIGlmICghc2lnbmFsKHAucGluTmV0c1snaW4rJ10pICYmIHNpZ25hbChwLnBpbk5ldHNbJ2luLSddKSkgeyByb3QgPSAxODA7IG1pcnJvciA9IHRydWU7IH1cbiAgICB9XG4gICAgb3JpZW50LnNldChwLmlkLCB7IHJvdCwgbWlycm9yLCBmbGV4IH0pO1xuICB9XG4gIGNvbnN0IHBpbkRpciA9IChpZCwgcGluKSA9PiB7XG4gICAgY29uc3QgbyA9IG9yaWVudC5nZXQoaWQpO1xuICAgIHJldHVybiB4Zm9ybURpcihieUlkLmdldChpZCkuc3ltLnBpbnNbcGluXS5kaXIsIHsgcm90OiBvLnJvdCwgbWlycm9yOiBvLm1pcnJvciB9KTtcbiAgfTtcbiAgY29uc3Qgc2h1bnQgPSAocCkgPT4gcC5zeW0udHdvVGVybWluYWwgJiYgIW9yaWVudC5nZXQocC5pZCkuZmxleDtcblxuICAvLyAtLS0tIDIuIGNvbHVtbnNcbiAgY29uc3QgYWRqID0gbmV3IE1hcChwYXJ0cy5tYXAoKHApID0+IFtwLmlkLCBbXV0pKTtcbiAgZm9yIChjb25zdCBbbmlkLCBuZXRdIG9mIG5ldHMpIHtcbiAgICBpZiAoIXNpZ25hbChuaWQpKSBjb250aW51ZTtcbiAgICBmb3IgKGNvbnN0IGUxIG9mIG5ldC5waW5zKSBmb3IgKGNvbnN0IGUyIG9mIG5ldC5waW5zKSB7XG4gICAgICBpZiAoZTEuY29tcCAhPT0gZTIuY29tcCkgYWRqLmdldChlMS5jb21wKS5wdXNoKHsgdG86IGUyLmNvbXAsIG15OiBlMS5waW4sIHRoZWlyOiBlMi5waW4gfSk7XG4gICAgfVxuICB9XG4gIGNvbnN0IHJhbmsgPSAocCkgPT4gKHAuc3ltLnNvdXJjZSA/IDAgOiBwLnN5bS50ZXJtaW5hbCA9PT0gJ2lucHV0JyA/IDEgOiAyKTtcbiAgY29uc3Qgcm9vdHMgPSBbLi4ucGFydHNdLnNvcnQoKGEsIGIpID0+IHJhbmsoYSkgLSByYW5rKGIpIHx8IGIuc3ltLnBpbk9yZGVyLmxlbmd0aCAtIGEuc3ltLnBpbk9yZGVyLmxlbmd0aCk7XG4gIGNvbnN0IGxheWVyID0gbmV3IE1hcCgpLCB3YXZlID0gbmV3IE1hcCgpLCBmbGV4SW4gPSBuZXcgTWFwKCk7XG4gIGxldCBpc2xhbmQgPSAwO1xuICBjb25zdCBpc2xhbmRPZiA9IG5ldyBNYXAoKTtcbiAgZm9yIChjb25zdCByIG9mIHJvb3RzKSB7XG4gICAgaWYgKGxheWVyLmhhcyhyLmlkKSkgY29udGludWU7XG4gICAgbGF5ZXIuc2V0KHIuaWQsIDApOyB3YXZlLnNldChyLmlkLCAwKTsgaXNsYW5kT2Yuc2V0KHIuaWQsIGlzbGFuZCk7XG4gICAgZmxleEluLnNldChyLmlkLCB7IHBpbjogbnVsbCwgb2ZmOiAxIH0pO1xuICAgIGNvbnN0IHEgPSBbci5pZF07XG4gICAgd2hpbGUgKHEubGVuZ3RoKSB7XG4gICAgICBjb25zdCBpZCA9IHEuc2hpZnQoKTtcbiAgICAgIGZvciAoY29uc3QgZSBvZiBhZGouZ2V0KGlkKSkge1xuICAgICAgICBpZiAobGF5ZXIuaGFzKGUudG8pKSBjb250aW51ZTtcbiAgICAgICAgY29uc3QgbWUgPSBieUlkLmdldChpZCksIHRoZW0gPSBieUlkLmdldChlLnRvKTtcbiAgICAgICAgbGV0IG9mZjtcbiAgICAgICAgaWYgKG9yaWVudC5nZXQoaWQpLmZsZXgpIHtcbiAgICAgICAgICBjb25zdCBmID0gZmxleEluLmdldChpZCk7XG4gICAgICAgICAgb2ZmID0gZS5teSA9PT0gZi5waW4gPyAtZi5vZmYgOiBmLm9mZjtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjb25zdCBteURpciA9IHBpbkRpcihpZCwgZS5teSk7XG4gICAgICAgICAgY29uc3QgdGhlaXJEaXIgPSBvcmllbnQuZ2V0KGUudG8pLmZsZXggfHwgc2h1bnQodGhlbSkgPyBudWxsIDogcGluRGlyKGUudG8sIGUudGhlaXIpO1xuICAgICAgICAgIG9mZiA9IG15RGlyID09PSAnbGVmdCcgfHwgdGhlaXJEaXIgPT09ICdyaWdodCcgPyAtMSA6IDE7XG4gICAgICAgICAgaWYgKG1lLnN5bS5waW5PcmRlci5sZW5ndGggPT09IDEgJiYgdGhlaXJEaXIgPT09ICdsZWZ0Jykgb2ZmID0gMTtcbiAgICAgICAgfVxuICAgICAgICBsYXllci5zZXQoZS50bywgbGF5ZXIuZ2V0KGlkKSArIG9mZik7XG4gICAgICAgIHdhdmUuc2V0KGUudG8sIHdhdmUuZ2V0KGlkKSArIDEpO1xuICAgICAgICBpc2xhbmRPZi5zZXQoZS50bywgaXNsYW5kKTtcbiAgICAgICAgZmxleEluLnNldChlLnRvLCB7IHBpbjogZS50aGVpciwgb2ZmIH0pO1xuICAgICAgICBxLnB1c2goZS50byk7XG4gICAgICB9XG4gICAgfVxuICAgIGlzbGFuZCsrO1xuICB9XG4gIHJlbGF4RGlyZWN0ZWQocGFydHMsIG5ldHMsIHNpZ25hbCwgbGF5ZXIsIHJvb3RzKTtcbiAgY29uc3QgbWluTCA9IE1hdGgubWluKDAsIC4uLmxheWVyLnZhbHVlcygpKTtcbiAgZm9yIChjb25zdCBbaywgdl0gb2YgbGF5ZXIpIGxheWVyLnNldChrLCB2IC0gbWluTCk7XG4gIC8vIENpcmN1aXQgaW5wdXRzIGZvcm0gdGhlIGxlZnRtb3N0IGNvbHVtbiwgb3V0cHV0cyB0aGUgcmlnaHRtb3N0LlxuICBjb25zdCBpbm5lciA9IHBhcnRzLmZpbHRlcigocCkgPT4gIXAuc3ltLnRlcm1pbmFsKS5tYXAoKHApID0+IGxheWVyLmdldChwLmlkKSk7XG4gIGNvbnN0IGxhc3RMID0gaW5uZXIubGVuZ3RoID8gTWF0aC5tYXgoLi4uaW5uZXIpICsgMSA6IDE7XG4gIGZvciAoY29uc3QgcCBvZiBwYXJ0cykge1xuICAgIGlmIChwLnN5bS50ZXJtaW5hbCA9PT0gJ2lucHV0JykgbGF5ZXIuc2V0KHAuaWQsIDApO1xuICAgIGlmIChwLnN5bS50ZXJtaW5hbCA9PT0gJ291dHB1dCcpIGxheWVyLnNldChwLmlkLCBsYXN0TCk7XG4gIH1cbiAgaWYgKHBhcnRzLnNvbWUoKHApID0+IHAuc3ltLnRlcm1pbmFsID09PSAnaW5wdXQnKSkge1xuICAgIGZvciAoY29uc3QgcCBvZiBwYXJ0cykgaWYgKCFwLnN5bS50ZXJtaW5hbCkgbGF5ZXIuc2V0KHAuaWQsIGxheWVyLmdldChwLmlkKSArIDEpO1xuICAgIGZvciAoY29uc3QgcCBvZiBwYXJ0cykgaWYgKHAuc3ltLnRlcm1pbmFsID09PSAnb3V0cHV0JykgbGF5ZXIuc2V0KHAuaWQsIGxhc3RMICsgMSk7XG4gIH1cblxuICAvLyAtLS0tIDMuIHBsYWNlbWVudFxuICBjb25zdCBwbGFjZWQgPSBbXTtcbiAgY29uc3QgaW5zdCA9IG5ldyBNYXAoKTtcbiAgY29uc3QgbGluZXMgPSBuZXcgTWFwKCk7IC8vIG5ldCAtPiB7IHksIHNyYzp7eCx5LGRpcn0sIG9yZGVyIH1cbiAgbGV0IGxpbmVPcmRlciA9IDA7XG4gIGNvbnN0IHRyaWFsID0gKHAsIHJvdCwgbWlycm9yKSA9PiBtYWtlSW5zdGFuY2UocCwgMCwgMCwgcm90LCBtaXJyb3IsIG5ldHMpO1xuICBjb25zdCBjb3JlTGVmdCA9IChUKSA9PiBNYXRoLm1pbihULmJvZHkueCwgLi4uT2JqZWN0LnZhbHVlcyhULnBpbnMpLm1hcCgocSkgPT4gcS54KSk7XG5cbiAgY29uc3QgbkxheWVycyA9IE1hdGgubWF4KDAsIC4uLmxheWVyLnZhbHVlcygpKSArIDE7XG4gIGNvbnN0IGNvbFcgPSBuZXcgQXJyYXkobkxheWVycykuZmlsbCgwKTtcbiAgZm9yIChjb25zdCBwIG9mIHBhcnRzKSB7XG4gICAgY29uc3QgbyA9IG9yaWVudC5nZXQocC5pZCk7XG4gICAgY29sV1tsYXllci5nZXQocC5pZCldID0gTWF0aC5tYXgoY29sV1tsYXllci5nZXQocC5pZCldLCB0cmlhbChwLCBvLnJvdCwgby5taXJyb3IpLmV4dGVudC53KTtcbiAgfVxuICBjb25zdCBjb2xYID0gWzBdO1xuICBmb3IgKGxldCBpID0gMTsgaSA8IG5MYXllcnM7IGkrKykgY29sWFtpXSA9IGNvbFhbaSAtIDFdICsgY29sV1tpIC0gMV0gKyBDT0xfR0FQO1xuICBjb25zdCBjdXJzb3IgPSBuZXcgQXJyYXkobkxheWVycykuZmlsbCgwKTtcbiAgLy8gQ29sdW1ucyBzdGFydCBhZnRlciBldmVyeXRoaW5nIGFscmVhZHkgcGxhY2VkIGluIGVhcmxpZXIgY29sdW1ucyAocGFydHMgbWF5IGhhdmUgc2xpZCkuXG4gIGNvbnN0IGNvbFJpZ2h0ID0gbmV3IEFycmF5KG5MYXllcnMpLmZpbGwoLUluZmluaXR5KTtcbiAgY29uc3QgY29sU3RhcnQgPSAoTCkgPT4gTWF0aC5tYXgoY29sWFtMXSwgLi4uY29sUmlnaHQuc2xpY2UoMCwgTCkubWFwKChyKSA9PiByICsgQ09MX0dBUCkpO1xuXG4gIGNvbnN0IGlzRnJlZSA9IChJLCBpZ25vcmUpID0+IHtcbiAgICBjb25zdCBlID0gaW5mbGF0ZShJLmV4dGVudCwgQ0xFQVIgLyAyKTtcbiAgICByZXR1cm4gcGxhY2VkLmV2ZXJ5KChvKSA9PiBvID09PSBpZ25vcmUgfHwgIW92ZXJsYXBzKGUsIGluZmxhdGUoby5leHRlbnQsIENMRUFSIC8gMikpKTtcbiAgfTtcbiAgY29uc3QgY29tbWl0ID0gKEkpID0+IHtcbiAgICBwbGFjZWQucHVzaChJKTtcbiAgICBpbnN0LnNldChJLmlkLCBJKTtcbiAgICBjb25zdCBMID0gbGF5ZXIuZ2V0KEkuaWQpO1xuICAgIGNvbFJpZ2h0W0xdID0gTWF0aC5tYXgoY29sUmlnaHRbTF0sIEkuZXh0ZW50LnggKyBJLmV4dGVudC53KTtcbiAgICBmb3IgKGNvbnN0IFtwaW4sIG5ldF0gb2YgT2JqZWN0LmVudHJpZXMoSS5wYXJ0LnBpbk5ldHMpKSB7XG4gICAgICBpZiAocmFpbEtpbmQobmV0KSB8fCBsaW5lcy5oYXMobmV0KSkgY29udGludWU7XG4gICAgICBjb25zdCBwcCA9IEkucGluc1twaW5dO1xuICAgICAgY29uc3QgZCA9IERJUlNbcHAuZGlyXTtcbiAgICAgIGxpbmVzLnNldChuZXQsIHsgeTogcHAueSArIChkLnkgPyBkLnkgKiAyMCA6IDApLCBzcmM6IHBwLCBvcmRlcjogbGluZU9yZGVyKysgfSk7XG4gICAgfVxuICB9O1xuICBjb25zdCBhdCA9IChwLCBvcmlnaW5YLCBvcmlnaW5ZLCByb3QsIG1pcnJvcikgPT4gbWFrZUluc3RhbmNlKHAsIHNuYXAob3JpZ2luWCksIHNuYXAob3JpZ2luWSksIHJvdCwgbWlycm9yLCBuZXRzKTtcblxuICAvLyBQYXJ0cyB3aXRoIGV4cGxpY2l0IHBvc2l0aW9ucyBhcmUgcGxhY2VkIGZpcnN0IGFuZCBhY3QgYXMgYW5jaG9ycy5cbiAgZm9yIChjb25zdCBwIG9mIHBhcnRzKSB7XG4gICAgY29uc3QgcG9zID0gcC5jb21wLnBvc2l0aW9uO1xuICAgIGlmICghcG9zKSBjb250aW51ZTtcbiAgICBjb25zdCBvID0gb3JpZW50LmdldChwLmlkKTtcbiAgICBjb21taXQoYXQocCwgcG9zLngsIHBvcy55LCBvLnJvdCwgby5taXJyb3IpKTtcbiAgfVxuXG4gIGNvbnN0IGdyb3VwID0gKHApID0+IChzaHVudChwKSA/IDAgOiBwLnN5bS5waW5PcmRlci5sZW5ndGggPj0gMyA/IDEgOiAyKTtcbiAgY29uc3Qgb3JkZXIgPSBwYXJ0cy5maWx0ZXIoKHApID0+ICFpbnN0LmhhcyhwLmlkKSlcbiAgICAuc29ydCgoYSwgYikgPT4gaXNsYW5kT2YuZ2V0KGEuaWQpIC0gaXNsYW5kT2YuZ2V0KGIuaWQpIHx8IHdhdmUuZ2V0KGEuaWQpIC0gd2F2ZS5nZXQoYi5pZCkgfHwgZ3JvdXAoYSkgLSBncm91cChiKSB8fCBsYXllci5nZXQoYS5pZCkgLSBsYXllci5nZXQoYi5pZCkpO1xuXG4gIGZvciAoY29uc3QgcCBvZiBvcmRlcikge1xuICAgIGNvbnN0IG8gPSBvcmllbnQuZ2V0KHAuaWQpO1xuICAgIGNvbnN0IEwgPSBsYXllci5nZXQocC5pZCk7XG4gICAgY29uc3QgcyA9IHAuc3ltO1xuXG4gICAgLy8gUGljayB0aGUgYW5jaG9yOiBhIHBpbiB3aG9zZSBuZXQgYWxyZWFkeSBoYXMgYSBsaW5lLiBJbnB1dHMgKGxlZnQtZmFjaW5nKSBmaXJzdC5cbiAgICBjb25zdCBhbmNob3JzID0gcy5waW5PcmRlclxuICAgICAgLmZpbHRlcigocGluKSA9PiBwLnBpbk5ldHNbcGluXSAmJiBsaW5lcy5oYXMocC5waW5OZXRzW3Bpbl0pKVxuICAgICAgLnNvcnQoKGEsIGIpID0+IChzaWduYWwocC5waW5OZXRzW2JdKSAtIHNpZ25hbChwLnBpbk5ldHNbYV0pKSB8fCBsaW5lcy5nZXQocC5waW5OZXRzW2FdKS5vcmRlciAtIGxpbmVzLmdldChwLnBpbk5ldHNbYl0pLm9yZGVyKTtcbiAgICBsZXQgcm90ID0gby5yb3QsIG1pcnJvciA9IG8ubWlycm9yO1xuICAgIGNvbnN0IGFuY2hvciA9IGFuY2hvcnNbMF07XG4gICAgaWYgKGFuY2hvciAmJiBvLmZsZXgpIHtcbiAgICAgIGNvbnN0IGxpbmUgPSBsaW5lcy5nZXQocC5waW5OZXRzW2FuY2hvcl0pO1xuICAgICAgY29uc3QgZnJvbVJpZ2h0ID0gbGluZS5zcmMueCA+IGNvbFN0YXJ0KEwpICsgMTA7XG4gICAgICBjb25zdCBhSXNGaXJzdCA9IGFuY2hvciA9PT0gcy5waW5PcmRlclswXTtcbiAgICAgIHJvdCA9IGFJc0ZpcnN0ICE9PSBmcm9tUmlnaHQgPyAwIDogMTgwO1xuICAgIH1cbiAgICBjb25zdCBUID0gdHJpYWwocCwgcm90LCBtaXJyb3IpO1xuICAgIGNvbnN0IGNhbmRzID0gW107XG4gICAgaWYgKGFuY2hvcikge1xuICAgICAgY29uc3QgbmV0ID0gcC5waW5OZXRzW2FuY2hvcl07XG4gICAgICBjb25zdCBsaW5lID0gbGluZXMuZ2V0KG5ldCk7XG4gICAgICBjb25zdCBhcCA9IFQucGluc1thbmNob3JdO1xuICAgICAgY29uc3Qgc3JjID0gbGluZS5zcmM7XG4gICAgICAvLyAoYSkgZmVlZGJhY2sgZWxlbWVudCBvdmVyIC8gdW5kZXIgYSBtdWx0aS1waW4gcGFydCB0aGF0IGl0IGJyaWRnZXNcbiAgICAgIGlmIChzLnR3b1Rlcm1pbmFsICYmIG8uZmxleCkge1xuICAgICAgICBjb25zdCBvdGhlciA9IHMucGluT3JkZXIuZmluZCgoeCkgPT4geCAhPT0gYW5jaG9yKTtcbiAgICAgICAgY29uc3Qgc2lkZU9mID0gKEksIG4pID0+IE9iamVjdC5lbnRyaWVzKEkucGFydC5waW5OZXRzKS5maWx0ZXIoKFssIHhdKSA9PiB4ID09PSBuKS5tYXAoKFtwaW5dKSA9PiBJLnBpbnNbcGluXS5kaXIpO1xuICAgICAgICBjb25zdCBob3N0ID0gcGxhY2VkLmZpbmQoKEkpID0+IHtcbiAgICAgICAgICBpZiAoSS5wYXJ0LnN5bS5waW5PcmRlci5sZW5ndGggPCAzKSByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgY29uc3QgYSA9IHNpZGVPZihJLCBuZXQpLCBiID0gc2lkZU9mKEksIHAucGluTmV0c1tvdGhlcl0pO1xuICAgICAgICAgIHJldHVybiAoYS5pbmNsdWRlcygnbGVmdCcpICYmIGIuaW5jbHVkZXMoJ3JpZ2h0JykpIHx8IChhLmluY2x1ZGVzKCdyaWdodCcpICYmIGIuaW5jbHVkZXMoJ2xlZnQnKSk7XG4gICAgICAgIH0pO1xuICAgICAgICBpZiAoaG9zdCkge1xuICAgICAgICAgIGNvbnN0IGN4ID0gaG9zdC5ib2R5LnggKyBob3N0LmJvZHkudyAvIDI7XG4gICAgICAgICAgY29uc3QgbWlkUmVsID0gKFQucGluc1tzLnBpbk9yZGVyWzBdXS54ICsgVC5waW5zW3MucGluT3JkZXJbMV1dLngpIC8gMjtcbiAgICAgICAgICBjb25zdCBveCA9IGN4IC0gbWlkUmVsO1xuICAgICAgICAgIGNvbnN0IGFib3ZlID0gTWF0aC5mbG9vcigoaG9zdC5leHRlbnQueSAtIENMRUFSIC0gKFQuZXh0ZW50LnkgKyBULmV4dGVudC5oKSkgLyBHUklEKSAqIEdSSUQ7XG4gICAgICAgICAgY29uc3QgYmVsb3cgPSBNYXRoLmNlaWwoKGhvc3QuZXh0ZW50LnkgKyBob3N0LmV4dGVudC5oICsgQ0xFQVIgLSBULmV4dGVudC55KSAvIEdSSUQpICogR1JJRDtcbiAgICAgICAgICBjYW5kcy5wdXNoKFtveCwgYWJvdmVdLCBbb3gsIGJlbG93XSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIC8vIChiKSBzdGFja2VkIHN0cmFpZ2h0IG9mZiBhIHZlcnRpY2FsIHBpblxuICAgICAgaWYgKChzcmMuZGlyID09PSAndXAnIHx8IHNyYy5kaXIgPT09ICdkb3duJykgJiYgYXAuZGlyID09PSBPUFBPU0lURVtzcmMuZGlyXSkge1xuICAgICAgICBjb25zdCBkID0gRElSU1tzcmMuZGlyXTtcbiAgICAgICAgY2FuZHMucHVzaChbc3JjLnggLSBhcC54LCBzcmMueSArIGQueSAqIDMwIC0gYXAueV0pO1xuICAgICAgfVxuICAgICAgLy8gKGMpIGNvbHVtbiBzbG90LCBwaW4gb24gdGhlIG5ldCBsaW5lXG4gICAgICBjb25zdCBob3JpeiA9IGFwLmRpciA9PT0gJ2xlZnQnIHx8IGFwLmRpciA9PT0gJ3JpZ2h0JztcbiAgICAgIGNvbnN0IHR5ID0gaG9yaXogPyBsaW5lLnkgOiBsaW5lLnkgLSBESVJTW2FwLmRpcl0ueSAqIDIwO1xuICAgICAgLy8ga2VlcCB0aGUgcGFydCBvbiB0aGUgZmFyIHNpZGUgb2YgdGhlIG5ldCdzIHNvdXJjZSBwaW5cbiAgICAgIGxldCBveCA9IGNvbFN0YXJ0KEwpIC0gY29yZUxlZnQoVCk7XG4gICAgICBpZiAoc3JjLmRpciA9PT0gJ3JpZ2h0Jykgb3ggPSBNYXRoLm1heChveCwgc3JjLnggKyAyMCAtIGFwLngpO1xuICAgICAgaWYgKHNyYy5kaXIgPT09ICdsZWZ0Jykgb3ggPSBNYXRoLm1pbihveCwgc3JjLnggLSAyMCAtIGFwLngpO1xuICAgICAgY2FuZHMucHVzaChbb3gsIHR5IC0gYXAueV0pO1xuICAgIH0gZWxzZSB7XG4gICAgICBjYW5kcy5wdXNoKFtjb2xTdGFydChMKSAtIGNvcmVMZWZ0KFQpLCBjdXJzb3JbTF0gLSBULmV4dGVudC55XSk7XG4gICAgfVxuXG4gICAgbGV0IGNob3NlbiA9IG51bGw7XG4gICAgZm9yIChjb25zdCBbb3gsIG95XSBvZiBjYW5kcykge1xuICAgICAgY29uc3QgSSA9IGF0KHAsIG94LCBveSwgcm90LCBtaXJyb3IpO1xuICAgICAgaWYgKGlzRnJlZShJKSkgeyBjaG9zZW4gPSBJOyBicmVhazsgfVxuICAgIH1cbiAgICBpZiAoIWNob3Nlbikge1xuICAgICAgY29uc3QgW2J4LCBieV0gPSBjYW5kc1tjYW5kcy5sZW5ndGggLSAxXTtcbiAgICAgIGNvbnN0IGRvd24gPSBzLmNhdGVnb3J5ID09PSAnZGlnaXRhbCcgfHwgcy50ZXJtaW5hbCB8fCAhYW5jaG9yO1xuICAgICAgY29uc3Qgc3JjID0gYW5jaG9yICYmIGxpbmVzLmdldChwLnBpbk5ldHNbYW5jaG9yXSkuc3JjO1xuICAgICAgY29uc3Qgc3ggPSAhc3JjID8gMSA6IHNyYy5kaXIgPT09ICdsZWZ0JyA/IC0xIDogc3JjLmRpciA9PT0gJ3JpZ2h0JyA/IDEgOiBzcmMueCA+IGJ4ICsgVC5waW5zW2FuY2hvcl0ueCA/IC0xIDogMTtcbiAgICAgIGNvbnN0IHN0ZXBzID0gW107XG4gICAgICBmb3IgKGxldCBrID0gMTsgayA8PSA0MDsgaysrKSBzdGVwcy5wdXNoKGRvd24gPyBbMCwgMjAgKiBrXSA6IFtzeCAqIDIwICogaywgMF0pO1xuICAgICAgZm9yIChsZXQgayA9IDE7IGsgPD0gNDA7IGsrKykgc3RlcHMucHVzaChkb3duID8gW3N4ICogMjAgKiBrLCAwXSA6IFswLCAyMCAqIGtdLCBbMCwgLTIwICoga10pO1xuICAgICAgZm9yIChsZXQgayA9IDE7IGsgPD0gMzA7IGsrKykgc3RlcHMucHVzaChbc3ggKiAyMCAqIGssIDIwICoga10pO1xuICAgICAgZm9yIChjb25zdCBbZHgsIGR5XSBvZiBzdGVwcykge1xuICAgICAgICBjb25zdCBJID0gYXQocCwgYnggKyBkeCwgYnkgKyBkeSwgcm90LCBtaXJyb3IpO1xuICAgICAgICBpZiAoaXNGcmVlKEkpKSB7IGNob3NlbiA9IEk7IGJyZWFrOyB9XG4gICAgICB9XG4gICAgICBpZiAoIWNob3Nlbikge1xuICAgICAgICBjb25zdCBtYXhZID0gTWF0aC5tYXgoMCwgLi4ucGxhY2VkLm1hcCgoSSkgPT4gSS5leHRlbnQueSArIEkuZXh0ZW50LmgpKTtcbiAgICAgICAgY2hvc2VuID0gYXQocCwgYngsIG1heFkgKyA2MCAtIFQuZXh0ZW50LnksIHJvdCwgbWlycm9yKTtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKCFhbmNob3IpIGN1cnNvcltMXSA9IGNob3Nlbi5leHRlbnQueSArIGNob3Nlbi5leHRlbnQuaCArIENMRUFSICsgMjA7XG4gICAgY29tbWl0KGNob3Nlbik7XG4gIH1cblxuICBhbGlnblRlcm1pbmFscyhwYXJ0cywgbmV0cywgaW5zdCwgaXNGcmVlLCBhdCwgb3JpZW50KTtcbiAgcmV0dXJuIHsgaW5zdGFuY2VzOiBpbnN0LCBvcmllbnQsIGxheWVyczogbGF5ZXIgfTtcbn1cblxuLy8gTG9uZ2VzdC1wYXRoIGxheWVyaW5nIGFsb25nIGRpZ2l0YWwgb3V0IC0+IGluIGVkZ2VzIChiYWNrIGVkZ2VzIGlnbm9yZWQpLlxuZnVuY3Rpb24gcmVsYXhEaXJlY3RlZChwYXJ0cywgbmV0cywgc2lnbmFsLCBsYXllciwgcm9vdHMpIHtcbiAgY29uc3QgRSA9IG5ldyBNYXAocGFydHMubWFwKChwKSA9PiBbcC5pZCwgbmV3IFNldCgpXSkpO1xuICBsZXQgYW55ID0gZmFsc2U7XG4gIGZvciAoY29uc3QgW25pZCwgbmV0XSBvZiBuZXRzKSB7XG4gICAgaWYgKCFzaWduYWwobmlkKSkgY29udGludWU7XG4gICAgY29uc3QgaW8gPSAoZSkgPT4gcGFydHMuZmluZCgocCkgPT4gcC5pZCA9PT0gZS5jb21wKS5zeW0ucGluc1tlLnBpbl0uaW87XG4gICAgY29uc3QgZHJpdmVycyA9IG5ldC5waW5zLmZpbHRlcigoZSkgPT4gaW8oZSkgPT09ICdvdXQnKTtcbiAgICBjb25zdCBzaW5rcyA9IG5ldC5waW5zLmZpbHRlcigoZSkgPT4gaW8oZSkgPT09ICdpbicpO1xuICAgIGZvciAoY29uc3QgZCBvZiBkcml2ZXJzKSBmb3IgKGNvbnN0IHMgb2Ygc2lua3MpIGlmIChkLmNvbXAgIT09IHMuY29tcCkgeyBFLmdldChkLmNvbXApLmFkZChzLmNvbXApOyBhbnkgPSB0cnVlOyB9XG4gIH1cbiAgaWYgKCFhbnkpIHJldHVybjtcbiAgY29uc3Qgc3RhdGUgPSBuZXcgTWFwKCksIHRvcG8gPSBbXSwgYmFjayA9IG5ldyBTZXQoKTtcbiAgY29uc3QgZGZzID0gKHUpID0+IHtcbiAgICBzdGF0ZS5zZXQodSwgMSk7XG4gICAgZm9yIChjb25zdCB2IG9mIEUuZ2V0KHUpKSB7XG4gICAgICBpZiAoc3RhdGUuZ2V0KHYpID09PSAxKSBiYWNrLmFkZCh1ICsgJz4nICsgdik7XG4gICAgICBlbHNlIGlmICghc3RhdGUuZ2V0KHYpKSBkZnModik7XG4gICAgfVxuICAgIHN0YXRlLnNldCh1LCAyKTtcbiAgICB0b3BvLnB1c2godSk7XG4gIH07XG4gIGZvciAoY29uc3QgciBvZiByb290cykgaWYgKCFzdGF0ZS5nZXQoci5pZCkpIGRmcyhyLmlkKTtcbiAgdG9wby5yZXZlcnNlKCk7XG4gIGZvciAoY29uc3QgdSBvZiB0b3BvKSBmb3IgKGNvbnN0IHYgb2YgRS5nZXQodSkpIHtcbiAgICBpZiAoIWJhY2suaGFzKHUgKyAnPicgKyB2KSAmJiBsYXllci5nZXQodikgPCBsYXllci5nZXQodSkgKyAxKSBsYXllci5zZXQodiwgbGF5ZXIuZ2V0KHUpICsgMSk7XG4gIH1cbn1cblxuLy8gU2xpZGUgc2luZ2xlLXBpbiB0ZXJtaW5hbHMgdmVydGljYWxseSBzbyB0aGVpciB3aXJlIHJ1bnMgc3RyYWlnaHQuXG5mdW5jdGlvbiBhbGlnblRlcm1pbmFscyhwYXJ0cywgbmV0cywgaW5zdCwgaXNGcmVlLCBhdCwgb3JpZW50KSB7XG4gIGZvciAoY29uc3QgcCBvZiBwYXJ0cykge1xuICAgIGlmICghcC5zeW0udGVybWluYWwgfHwgcC5jb21wLnBvc2l0aW9uKSBjb250aW51ZTtcbiAgICBjb25zdCBJID0gaW5zdC5nZXQocC5pZCk7XG4gICAgY29uc3QgcGluTmFtZSA9IHAuc3ltLnBpbk9yZGVyWzBdO1xuICAgIGNvbnN0IG5ldCA9IHAucGluTmV0c1twaW5OYW1lXTtcbiAgICBpZiAoIW5ldCkgY29udGludWU7XG4gICAgY29uc3QgbXkgPSBJLnBpbnNbcGluTmFtZV07XG4gICAgY29uc3Qgd2FudCA9IE9QUE9TSVRFW215LmRpcl07XG4gICAgY29uc3QgdGFyZ2V0cyA9IG5ldHMuZ2V0KG5ldCkucGluc1xuICAgICAgLmZpbHRlcigoZSkgPT4gZS5jb21wICE9PSBwLmlkICYmIGluc3QuZ2V0KGUuY29tcCk/LnBpbnNbZS5waW5dLmRpciA9PT0gd2FudClcbiAgICAgIC5tYXAoKGUpID0+IGluc3QuZ2V0KGUuY29tcCkucGluc1tlLnBpbl0pO1xuICAgIGlmICghdGFyZ2V0cy5sZW5ndGgpIGNvbnRpbnVlO1xuICAgIHRhcmdldHMuc29ydCgoYSwgYikgPT4gTWF0aC5hYnMoYS55IC0gbXkueSkgLSBNYXRoLmFicyhiLnkgLSBteS55KSk7XG4gICAgY29uc3QgZHkgPSB0YXJnZXRzWzBdLnkgLSBteS55O1xuICAgIGlmICghZHkpIGNvbnRpbnVlO1xuICAgIGNvbnN0IG8gPSBvcmllbnQuZ2V0KHAuaWQpO1xuICAgIGNvbnN0IEogPSBhdChwLCBJLngsIEkueSArIGR5LCBvLnJvdCwgby5taXJyb3IpO1xuICAgIGlmIChpc0ZyZWUoSiwgSSkpIE9iamVjdC5hc3NpZ24oSSwgSik7XG4gIH1cbn1cbiIsICIvLyBPcnRob2dvbmFsIHdpcmUgcm91dGVyLlxuLy9cbi8vIEdyaWQgQSogKDEwcHggY2VsbHMpIHdpdGggc3RhdGUgPSAoY2VsbCwgaGVhZGluZyksIHNvIGJlbmRzIGFyZSBjb3N0ZWQuXG4vLyBFYWNoIG5ldCBpcyBncm93biBhcyBhIHRyZWU6IGZpcnN0IHBpbiBzZWVkcyBpdCwgZXZlcnkgZnVydGhlciBwaW4gaXMgcm91dGVkXG4vLyB0byB0aGUgbmVhcmVzdCBwb2ludCBvZiB0aGUgZXhpc3RpbmcgdHJlZSAoVC1qdW5jdGlvbnMgYXBwZWFyIG5hdHVyYWxseSkuXG4vLyBSdWxlczogd2lyZXMgbGVhdmUvZW50ZXIgcGlucyBzdHJhaWdodCBhbG9uZyB0aGUgcGluIGRpcmVjdGlvbiwgbmV2ZXIgcnVuXG4vLyB0aHJvdWdoIGJvZGllcyBvciBsZWFkcywgbmV2ZXIgb3ZlcmxhcCBhbm90aGVyIG5ldCwgb25seSBjcm9zcyBhbm90aGVyIG5ldFxuLy8gcGVycGVuZGljdWxhcmx5IG9uIGEgc3RyYWlnaHQgcnVuIChubyBjb3JuZXIvanVuY3Rpb24gc2hhcmluZyksIGFuZCBhdm9pZFxuLy8gNC13YXkganVuY3Rpb25zIChhbGxvd2VkIGF0IGEgY29zdCkuIElmIGEgbmV0IGNhbid0IGJlIHJvdXRlZCBzdHJpY3RseSwgYSByZWxheGVkIHBhc3MgYWxsb3dzXG4vLyB2aW9sYXRpb25zIGF0IGhpZ2ggY29zdDsgZmFpbGluZyB0aGF0LCBhbiBMLXNoYXBlZCBmYWxsYmFjayBpcyBkcmF3biBhbmQgYVxuLy8gUk9VVElOR19GQUlMVVJFIHdhcm5pbmcgaXMgcmFpc2VkLlxuaW1wb3J0IHsgR1JJRCwgRElSUywgT1BQT1NJVEUsIHVuaW9uUmVjdCwgaW5mbGF0ZSB9IGZyb20gJy4uL3V0aWxzL2dlb21ldHJ5LmpzJztcblxuY29uc3QgRFggPSBbMSwgMCwgLTEsIDBdLCBEWSA9IFswLCAxLCAwLCAtMV07XG5jb25zdCBESVJfSU5ERVggPSB7IHJpZ2h0OiAwLCBkb3duOiAxLCBsZWZ0OiAyLCB1cDogMyB9O1xuY29uc3QgQklUID0gWzEsIDIsIDQsIDhdOyAvLyBiaXQgZm9yIFwiY29ubmVjdGVkIHRvd2FyZHMgZGlyZWN0aW9uIGlcIlxuY29uc3QgQkVORCA9IDUsIENST1NTID0gOCwgVklPTEFUSU9OID0gNDAwO1xuXG5jb25zdCBwb3Bjb3VudCA9IChiKSA9PiAoYiAmIDEpICsgKChiID4+IDEpICYgMSkgKyAoKGIgPj4gMikgJiAxKSArICgoYiA+PiAzKSAmIDEpO1xuXG5leHBvcnQgZnVuY3Rpb24gcm91dGVDaXJjdWl0KG5sLCBpbnN0YW5jZXMpIHtcbiAgY29uc3QgaW5zdHMgPSBbLi4uaW5zdGFuY2VzLnZhbHVlcygpXTtcbiAgbGV0IGJvdW5kcyA9IG51bGw7XG4gIGZvciAoY29uc3QgSSBvZiBpbnN0cykgYm91bmRzID0gdW5pb25SZWN0KGJvdW5kcywgSS5leHRlbnQpO1xuICBib3VuZHMgPSBib3VuZHMgfHwgeyB4OiAwLCB5OiAwLCB3OiAwLCBoOiAwIH07XG4gIGNvbnN0IFBBRCA9IDgwO1xuICBjb25zdCB4MCA9IE1hdGguZmxvb3IoKGJvdW5kcy54IC0gUEFEKSAvIEdSSUQpICogR1JJRDtcbiAgY29uc3QgeTAgPSBNYXRoLmZsb29yKChib3VuZHMueSAtIFBBRCkgLyBHUklEKSAqIEdSSUQ7XG4gIGNvbnN0IFcgPSBNYXRoLmNlaWwoKGJvdW5kcy54ICsgYm91bmRzLncgKyBQQUQgLSB4MCkgLyBHUklEKSArIDE7XG4gIGNvbnN0IEggPSBNYXRoLmNlaWwoKGJvdW5kcy55ICsgYm91bmRzLmggKyBQQUQgLSB5MCkgLyBHUklEKSArIDE7XG4gIGNvbnN0IE4gPSBXICogSDtcbiAgY29uc3QgY2VsbE9mID0gKHgsIHkpID0+IHtcbiAgICBjb25zdCBjeCA9IE1hdGgucm91bmQoKHggLSB4MCkgLyBHUklEKSwgY3kgPSBNYXRoLnJvdW5kKCh5IC0geTApIC8gR1JJRCk7XG4gICAgcmV0dXJuIGN4IDwgMCB8fCBjeSA8IDAgfHwgY3ggPj0gVyB8fCBjeSA+PSBIID8gLTEgOiBjeSAqIFcgKyBjeDtcbiAgfTtcbiAgY29uc3QgY3ggPSAoYykgPT4geDAgKyAoYyAlIFcpICogR1JJRCwgY3kgPSAoYykgPT4geTAgKyBNYXRoLmZsb29yKGMgLyBXKSAqIEdSSUQ7XG5cbiAgY29uc3QgYmxvY2tlZCA9IG5ldyBVaW50OEFycmF5KE4pO1xuICBjb25zdCBzb2Z0ID0gbmV3IEZsb2F0MzJBcnJheShOKTtcbiAgY29uc3QgcGluT3duZXIgPSBuZXcgSW50MzJBcnJheShOKS5maWxsKC0xKTsgLy8gcm91dGVkIG5ldCBpbmRleCwgb3IgLTIgZm9yIFwibm8gb25lXCJcbiAgY29uc3QgcGluRW50cnkgPSBuZXcgSW50OEFycmF5KE4pLmZpbGwoLTEpO1xuICBjb25zdCBvY2NIID0gbmV3IEludDMyQXJyYXkoTiksIG9jY1YgPSBuZXcgSW50MzJBcnJheShOKTsgLy8gbmV0IGluZGV4ICsgMVxuXG4gIGNvbnN0IGZpbGxSZWN0ID0gKHIsIGZuKSA9PiB7XG4gICAgY29uc3QgYXggPSBNYXRoLmNlaWwoKHIueCAtIHgwKSAvIEdSSUQpLCBieCA9IE1hdGguZmxvb3IoKHIueCArIHIudyAtIHgwKSAvIEdSSUQpO1xuICAgIGNvbnN0IGF5ID0gTWF0aC5jZWlsKChyLnkgLSB5MCkgLyBHUklEKSwgYnkgPSBNYXRoLmZsb29yKChyLnkgKyByLmggLSB5MCkgLyBHUklEKTtcbiAgICBmb3IgKGxldCBqID0gTWF0aC5tYXgoMCwgYXkpOyBqIDw9IE1hdGgubWluKEggLSAxLCBieSk7IGorKylcbiAgICAgIGZvciAobGV0IGkgPSBNYXRoLm1heCgwLCBheCk7IGkgPD0gTWF0aC5taW4oVyAtIDEsIGJ4KTsgaSsrKSBmbihqICogVyArIGkpO1xuICB9O1xuXG4gIC8vIC0tLS0gcm91dGVkIG5ldHNcbiAgY29uc3Qgcm91dGVkID0gW107XG4gIGNvbnN0IG5ldEluZGV4ID0gbmV3IE1hcCgpO1xuICBmb3IgKGNvbnN0IFtpZCwgbmV0XSBvZiBubC5uZXRzKSB7XG4gICAgaWYgKG5ldC5yYWlsKSBjb250aW51ZTtcbiAgICBjb25zdCBwaW5zID0gbmV0LnBpbnMuZmlsdGVyKChlKSA9PiBpbnN0YW5jZXMuaGFzKGUuY29tcCkpLm1hcCgoZSkgPT4ge1xuICAgICAgY29uc3QgcCA9IGluc3RhbmNlcy5nZXQoZS5jb21wKS5waW5zW2UucGluXTtcbiAgICAgIHJldHVybiB7IC4uLmUsIHg6IHAueCwgeTogcC55LCBkaXI6IHAuZGlyLCBjZWxsOiBjZWxsT2YocC54LCBwLnkpIH07XG4gICAgfSk7XG4gICAgaWYgKHBpbnMubGVuZ3RoIDwgMikgY29udGludWU7XG4gICAgbmV0SW5kZXguc2V0KGlkLCByb3V0ZWQubGVuZ3RoKTtcbiAgICByb3V0ZWQucHVzaCh7IGlkLCBwaW5zIH0pO1xuICB9XG5cbiAgLy8gLS0tLSBvYnN0YWNsZXNcbiAgZm9yIChjb25zdCBJIG9mIGluc3RzKSB7XG4gICAgY29uc3QgYm9keSA9IGluZmxhdGUoSS5ib2R5LCAzKTtcbiAgICBmaWxsUmVjdChib2R5LCAoYykgPT4geyBibG9ja2VkW2NdID0gMTsgfSk7XG4gICAgZmlsbFJlY3QoaW5mbGF0ZShJLmJvZHksIDExKSwgKGMpID0+IHsgc29mdFtjXSArPSAwLjY7IH0pO1xuICAgIGZvciAoY29uc3QgbCBvZiBJLmxhYmVscykgZmlsbFJlY3QoaW5mbGF0ZShsLmJveCwgMiksIChjKSA9PiB7IHNvZnRbY10gKz0gNjsgfSk7XG4gICAgZm9yIChjb25zdCBbbmFtZSwgcF0gb2YgT2JqZWN0LmVudHJpZXMoSS5waW5zKSkge1xuICAgICAgY29uc3QgYyA9IGNlbGxPZihwLngsIHAueSk7XG4gICAgICBpZiAoYyA8IDApIGNvbnRpbnVlO1xuICAgICAgY29uc3QgbmV0ID0gSS5wYXJ0LnBpbk5ldHNbbmFtZV07XG4gICAgICBjb25zdCBuaSA9IG5ldEluZGV4LmhhcyhuZXQpID8gbmV0SW5kZXguZ2V0KG5ldCkgOiAtMjtcbiAgICAgIC8vIGxlYWQgY2VsbHMgYmV0d2VlbiB0aGUgcGluIHRpcCBhbmQgdGhlIGJvZHlcbiAgICAgIGNvbnN0IGQgPSBESVJTW3AuZGlyXTtcbiAgICAgIGZvciAobGV0IGsgPSAxOyBrIDw9IDY7IGsrKykge1xuICAgICAgICBjb25zdCBseCA9IHAueCAtIGQueCAqIEdSSUQgKiBrLCBseSA9IHAueSAtIGQueSAqIEdSSUQgKiBrO1xuICAgICAgICBjb25zdCBsYyA9IGNlbGxPZihseCwgbHkpO1xuICAgICAgICBpZiAobGMgPCAwKSBicmVhaztcbiAgICAgICAgYmxvY2tlZFtsY10gPSAxO1xuICAgICAgICBpZiAobHggPj0gYm9keS54ICYmIGx4IDw9IGJvZHkueCArIGJvZHkudyAmJiBseSA+PSBib2R5LnkgJiYgbHkgPD0gYm9keS55ICsgYm9keS5oKSBicmVhaztcbiAgICAgIH1cbiAgICAgIGJsb2NrZWRbY10gPSAxO1xuICAgICAgcGluT3duZXJbY10gPSBuaTtcbiAgICAgIHBpbkVudHJ5W2NdID0gRElSX0lOREVYW09QUE9TSVRFW3AuZGlyXV07XG4gICAgfVxuICAgIGZvciAoY29uc3QgbSBvZiBJLm1hcmtlcnMpIHtcbiAgICAgIGZpbGxSZWN0KGluZmxhdGUobS5iYm94LCAzKSwgKGMpID0+IHsgaWYgKHBpbk93bmVyW2NdID09PSAtMSkgYmxvY2tlZFtjXSA9IDE7IH0pO1xuICAgIH1cbiAgfVxuXG4gIC8vIC0tLS0gcGVyLW5ldCBzdGF0ZVxuICBjb25zdCBiaXRzID0gcm91dGVkLm1hcCgoKSA9PiBuZXcgTWFwKCkpOyAvLyBjZWxsIC0+IGNvbm5lY3Rpdml0eSBiaXRzXG4gIGNvbnN0IGFkZEJpdCA9IChuaSwgYywgYikgPT4gYml0c1tuaV0uc2V0KGMsIChiaXRzW25pXS5nZXQoYykgfHwgMCkgfCBiKTtcbiAgcm91dGVkLmZvckVhY2goKG5ldCwgbmkpID0+IHtcbiAgICBmb3IgKGNvbnN0IHAgb2YgbmV0LnBpbnMpIGlmIChwLmNlbGwgPj0gMCkgYWRkQml0KG5pLCBwLmNlbGwsIEJJVFtESVJfSU5ERVhbT1BQT1NJVEVbcC5kaXJdXV0pO1xuICB9KTtcblxuICAvLyAtLS0tIEEqXG4gIGNvbnN0IFMgPSBOICogNDtcbiAgY29uc3QgZyA9IG5ldyBGbG9hdDY0QXJyYXkoUyk7XG4gIGNvbnN0IHN0YW1wID0gbmV3IFVpbnQzMkFycmF5KFMpO1xuICBjb25zdCBwcmV2ID0gbmV3IEludDMyQXJyYXkoUyk7XG4gIGxldCBnZW4gPSAwO1xuICBjb25zdCBoZWFwID0gW107XG4gIGNvbnN0IHB1c2ggPSAoZiwgcykgPT4ge1xuICAgIGhlYXAucHVzaChbZiwgc10pO1xuICAgIGxldCBpID0gaGVhcC5sZW5ndGggLSAxO1xuICAgIHdoaWxlIChpID4gMCkgeyBjb25zdCBwYSA9IChpIC0gMSkgPj4gMTsgaWYgKGhlYXBbcGFdWzBdIDw9IGhlYXBbaV1bMF0pIGJyZWFrOyBbaGVhcFtwYV0sIGhlYXBbaV1dID0gW2hlYXBbaV0sIGhlYXBbcGFdXTsgaSA9IHBhOyB9XG4gIH07XG4gIGNvbnN0IHBvcCA9ICgpID0+IHtcbiAgICBjb25zdCB0b3AgPSBoZWFwWzBdLCBsYXN0ID0gaGVhcC5wb3AoKTtcbiAgICBpZiAoaGVhcC5sZW5ndGgpIHtcbiAgICAgIGhlYXBbMF0gPSBsYXN0O1xuICAgICAgbGV0IGkgPSAwO1xuICAgICAgZm9yICg7Oykge1xuICAgICAgICBjb25zdCBsID0gMiAqIGkgKyAxLCByID0gbCArIDE7XG4gICAgICAgIGxldCBtID0gaTtcbiAgICAgICAgaWYgKGwgPCBoZWFwLmxlbmd0aCAmJiBoZWFwW2xdWzBdIDwgaGVhcFttXVswXSkgbSA9IGw7XG4gICAgICAgIGlmIChyIDwgaGVhcC5sZW5ndGggJiYgaGVhcFtyXVswXSA8IGhlYXBbbV1bMF0pIG0gPSByO1xuICAgICAgICBpZiAobSA9PT0gaSkgYnJlYWs7XG4gICAgICAgIFtoZWFwW21dLCBoZWFwW2ldXSA9IFtoZWFwW2ldLCBoZWFwW21dXTsgaSA9IG07XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB0b3A7XG4gIH07XG5cbiAgY29uc3QgZm9yZWlnbiA9IChvY2MsIGMsIG5pKSA9PiBvY2NbY10gIT09IDAgJiYgb2NjW2NdICE9PSBuaSArIDE7XG4gIGNvbnN0IGZvcmVpZ25CaXRzID0gKGMsIG5pKSA9PiB7XG4gICAgY29uc3QgbyA9IG9jY0hbY10gJiYgb2NjSFtjXSAhPT0gbmkgKyAxID8gb2NjSFtjXSAtIDEgOiBvY2NWW2NdICYmIG9jY1ZbY10gIT09IG5pICsgMSA/IG9jY1ZbY10gLSAxIDogLTE7XG4gICAgcmV0dXJuIG8gPCAwID8gMCA6IGJpdHNbb10uZ2V0KGMpIHx8IDA7XG4gIH07XG5cbiAgZnVuY3Rpb24gc2VhcmNoKG5pLCBzdGFydCwgc3RhcnREaXIsIHRyZWUsIHJlbGF4ZWQpIHtcbiAgICBnZW4rKztcbiAgICBoZWFwLmxlbmd0aCA9IDA7XG4gICAgbGV0IGJ4MSA9IEluZmluaXR5LCBieTEgPSBJbmZpbml0eSwgYngyID0gLUluZmluaXR5LCBieTIgPSAtSW5maW5pdHk7XG4gICAgZm9yIChjb25zdCBjIG9mIHRyZWUpIHtcbiAgICAgIGNvbnN0IHggPSBjICUgVywgeSA9IChjIC8gVykgfCAwO1xuICAgICAgYngxID0gTWF0aC5taW4oYngxLCB4KTsgYngyID0gTWF0aC5tYXgoYngyLCB4KTsgYnkxID0gTWF0aC5taW4oYnkxLCB5KTsgYnkyID0gTWF0aC5tYXgoYnkyLCB5KTtcbiAgICB9XG4gICAgY29uc3QgaCA9IChjKSA9PiB7XG4gICAgICBjb25zdCB4ID0gYyAlIFcsIHkgPSAoYyAvIFcpIHwgMDtcbiAgICAgIHJldHVybiBNYXRoLm1heCgwLCBieDEgLSB4LCB4IC0gYngyKSArIE1hdGgubWF4KDAsIGJ5MSAtIHksIHkgLSBieTIpO1xuICAgIH07XG4gICAgY29uc3QgczAgPSBzdGFydCAqIDQgKyBzdGFydERpcjtcbiAgICBnW3MwXSA9IDA7IHN0YW1wW3MwXSA9IGdlbjsgcHJldltzMF0gPSAtMTtcbiAgICBwdXNoKGgoc3RhcnQpLCBzMCk7XG4gICAgbGV0IGl0ZXIgPSAwO1xuICAgIHdoaWxlIChoZWFwLmxlbmd0aCkge1xuICAgICAgaWYgKCsraXRlciA+IDQwMDAwMCkgYnJlYWs7XG4gICAgICBjb25zdCBbZiwgc10gPSBwb3AoKTtcbiAgICAgIGNvbnN0IGMgPSBzID4+IDIsIGQgPSBzICYgMztcbiAgICAgIGNvbnN0IGdjID0gZ1tzXTtcbiAgICAgIGlmIChmIC0gaChjKSA+IGdjICsgMWUtOSkgY29udGludWU7XG4gICAgICBpZiAoYyAhPT0gc3RhcnQgJiYgdHJlZS5oYXMoYykpIHJldHVybiBzO1xuICAgICAgZm9yIChsZXQgbmQgPSAwOyBuZCA8IDQ7IG5kKyspIHtcbiAgICAgICAgaWYgKG5kID09PSAoKGQgKyAyKSAmIDMpKSBjb250aW51ZTtcbiAgICAgICAgY29uc3QgeCA9IChjICUgVykgKyBEWFtuZF0sIHkgPSAoKGMgLyBXKSB8IDApICsgRFlbbmRdO1xuICAgICAgICBpZiAoeCA8IDAgfHwgeSA8IDAgfHwgeCA+PSBXIHx8IHkgPj0gSCkgY29udGludWU7XG4gICAgICAgIGNvbnN0IG4gPSB5ICogVyArIHg7XG4gICAgICAgIGxldCBjb3N0ID0gMSArIHNvZnRbbl07XG4gICAgICAgIGlmIChuZCAhPT0gZCkge1xuICAgICAgICAgIGlmIChjID09PSBzdGFydCkgY29udGludWU7IC8vIGxlYXZlIHBpbnMgc3RyYWlnaHRcbiAgICAgICAgICBjb3N0ICs9IEJFTkQ7XG4gICAgICAgICAgaWYgKGZvcmVpZ24ob2NjSCwgYywgbmkpIHx8IGZvcmVpZ24ob2NjViwgYywgbmkpKSB7IGlmICghcmVsYXhlZCkgY29udGludWU7IGNvc3QgKz0gVklPTEFUSU9OOyB9XG4gICAgICAgIH1cbiAgICAgICAgY29uc3Qgb3duZXIgPSBwaW5Pd25lcltuXTtcbiAgICAgICAgaWYgKG93bmVyICE9PSAtMSkge1xuICAgICAgICAgIGlmIChvd25lciAhPT0gbmkgfHwgbmQgIT09IHBpbkVudHJ5W25dKSB7IGlmICghcmVsYXhlZCB8fCBvd25lciA9PT0gbmkpIGNvbnRpbnVlOyBjb3N0ICs9IFZJT0xBVElPTiAqIDI7IH1cbiAgICAgICAgfSBlbHNlIGlmIChibG9ja2VkW25dKSB7XG4gICAgICAgICAgaWYgKCFyZWxheGVkKSBjb250aW51ZTtcbiAgICAgICAgICBjb3N0ICs9IFZJT0xBVElPTiAqIDI7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgaG9yaXogPSBuZCA9PT0gMCB8fCBuZCA9PT0gMjtcbiAgICAgICAgaWYgKGZvcmVpZ24oaG9yaXogPyBvY2NIIDogb2NjViwgbiwgbmkpKSB7IGlmICghcmVsYXhlZCkgY29udGludWU7IGNvc3QgKz0gVklPTEFUSU9OOyB9XG4gICAgICAgIGlmIChmb3JlaWduKGhvcml6ID8gb2NjViA6IG9jY0gsIG4sIG5pKSkge1xuICAgICAgICAgIGNvbnN0IGZiID0gZm9yZWlnbkJpdHMobiwgbmkpO1xuICAgICAgICAgIGNvbnN0IHN0cmFpZ2h0ID0gaG9yaXogPyBmYiA9PT0gKEJJVFsxXSB8IEJJVFszXSkgOiBmYiA9PT0gKEJJVFswXSB8IEJJVFsyXSk7XG4gICAgICAgICAgaWYgKCFzdHJhaWdodCkgeyBpZiAoIXJlbGF4ZWQpIGNvbnRpbnVlOyBjb3N0ICs9IFZJT0xBVElPTjsgfVxuICAgICAgICAgIGNvc3QgKz0gQ1JPU1M7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRyZWUuaGFzKG4pICYmIG93bmVyID09PSAtMSkge1xuICAgICAgICAgIGNvbnN0IG5iID0gKGJpdHNbbmldLmdldChuKSB8fCAwKSB8IEJJVFsobmQgKyAyKSAmIDNdO1xuICAgICAgICAgIGlmIChwb3Bjb3VudChuYikgPiAzKSBjb3N0ICs9IEJFTkQ7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgbnMgPSBuICogNCArIG5kO1xuICAgICAgICBjb25zdCBuZyA9IGdjICsgY29zdDtcbiAgICAgICAgaWYgKHN0YW1wW25zXSA9PT0gZ2VuICYmIGdbbnNdIDw9IG5nKSBjb250aW51ZTtcbiAgICAgICAgc3RhbXBbbnNdID0gZ2VuOyBnW25zXSA9IG5nOyBwcmV2W25zXSA9IHM7XG4gICAgICAgIHB1c2gobmcgKyBoKG4pLCBucyk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiAtMTtcbiAgfVxuXG4gIGNvbnN0IGNvbW1pdFBhdGggPSAobmksIGNlbGxzKSA9PiB7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgKyAxIDwgY2VsbHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGNvbnN0IGEgPSBjZWxsc1tpXSwgYiA9IGNlbGxzW2kgKyAxXTtcbiAgICAgIGNvbnN0IGhvcml6ID0gTWF0aC5hYnMoYSAtIGIpID09PSAxO1xuICAgICAgY29uc3Qgb2NjID0gaG9yaXogPyBvY2NIIDogb2NjVjtcbiAgICAgIGlmICghb2NjW2FdKSBvY2NbYV0gPSBuaSArIDE7XG4gICAgICBpZiAoIW9jY1tiXSkgb2NjW2JdID0gbmkgKyAxO1xuICAgICAgY29uc3QgZCA9IGhvcml6ID8gKGIgPiBhID8gMCA6IDIpIDogKGIgPiBhID8gMSA6IDMpO1xuICAgICAgYWRkQml0KG5pLCBhLCBCSVRbZF0pO1xuICAgICAgYWRkQml0KG5pLCBiLCBCSVRbKGQgKyAyKSAmIDNdKTtcbiAgICB9XG4gIH07XG5cbiAgY29uc3QgZmFpbHVyZXMgPSBbXTtcbiAgY29uc3QgcGF0aHMgPSByb3V0ZWQubWFwKCgpID0+IFtdKTtcbiAgY29uc3Qgb3JkZXIgPSByb3V0ZWQubWFwKChfLCBpKSA9PiBpKS5zb3J0KChhLCBiKSA9PiBzcGFuKHJvdXRlZFthXS5waW5zKSAtIHNwYW4ocm91dGVkW2JdLnBpbnMpKTtcbiAgZm9yIChjb25zdCBuaSBvZiBvcmRlcikge1xuICAgIGNvbnN0IG5ldCA9IHJvdXRlZFtuaV07XG4gICAgY29uc3QgcGlucyA9IG5ldC5waW5zLmZpbHRlcigocCkgPT4gcC5jZWxsID49IDApO1xuICAgIGNvbnN0IGZpcnN0ID0gcGlucy5yZWR1Y2UoKG0sIHApID0+IChwLnggPCBtLnggfHwgKHAueCA9PT0gbS54ICYmIHAueSA8IG0ueSkgPyBwIDogbSksIHBpbnNbMF0pO1xuICAgIGNvbnN0IHRyZWUgPSBuZXcgU2V0KFtmaXJzdC5jZWxsXSk7XG4gICAgY29uc3QgdG9kbyA9IHBpbnMuZmlsdGVyKChwKSA9PiBwICE9PSBmaXJzdCk7XG4gICAgd2hpbGUgKHRvZG8ubGVuZ3RoKSB7XG4gICAgICAvLyBuZWFyZXN0IHVuY29ubmVjdGVkIHBpbiB0byB0aGUgdHJlZVxuICAgICAgbGV0IGJpID0gMCwgYmQgPSBJbmZpbml0eTtcbiAgICAgIHRvZG8uZm9yRWFjaCgocCwgaSkgPT4ge1xuICAgICAgICBmb3IgKGNvbnN0IGMgb2YgdHJlZSkge1xuICAgICAgICAgIGNvbnN0IGRkID0gTWF0aC5hYnMoY3goYykgLSBwLngpICsgTWF0aC5hYnMoY3koYykgLSBwLnkpO1xuICAgICAgICAgIGlmIChkZCA8IGJkKSB7IGJkID0gZGQ7IGJpID0gaTsgfVxuICAgICAgICB9XG4gICAgICB9KTtcbiAgICAgIGNvbnN0IHAgPSB0b2RvLnNwbGljZShiaSwgMSlbMF07XG4gICAgICBpZiAodHJlZS5oYXMocC5jZWxsKSkgY29udGludWU7XG4gICAgICBjb25zdCBzZCA9IERJUl9JTkRFWFtwLmRpcl07XG4gICAgICBsZXQgZW5kID0gc2VhcmNoKG5pLCBwLmNlbGwsIHNkLCB0cmVlLCBmYWxzZSk7XG4gICAgICBpZiAoZW5kIDwgMCkgZW5kID0gc2VhcmNoKG5pLCBwLmNlbGwsIHNkLCB0cmVlLCB0cnVlKTtcbiAgICAgIGxldCBjZWxscztcbiAgICAgIGlmIChlbmQgPj0gMCkge1xuICAgICAgICBjZWxscyA9IFtdO1xuICAgICAgICBmb3IgKGxldCBzID0gZW5kOyBzID49IDA7IHMgPSBwcmV2W3NdKSBjZWxscy5wdXNoKHMgPj4gMik7XG4gICAgICAgIGNlbGxzLnJldmVyc2UoKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGZhaWx1cmVzLnB1c2goeyBuZXQ6IG5ldC5pZCwgY29tcDogcC5jb21wLCBwaW46IHAucGluIH0pO1xuICAgICAgICBjb25zdCB0ID0gWy4uLnRyZWVdWzBdO1xuICAgICAgICBjb25zdCBtaWQgPSBjZWxsT2YoY3godCksIHAueSk7XG4gICAgICAgIGNlbGxzID0gW3AuY2VsbCwgbWlkLCB0XS5maWx0ZXIoKGMsIGksIGEpID0+IGMgPj0gMCAmJiBjICE9PSBhW2kgLSAxXSk7XG4gICAgICAgIGNlbGxzID0gZXhwYW5kQ2VsbHMoY2VsbHMsIFcpO1xuICAgICAgfVxuICAgICAgY29tbWl0UGF0aChuaSwgY2VsbHMpO1xuICAgICAgZm9yIChjb25zdCBjIG9mIGNlbGxzKSB0cmVlLmFkZChjKTtcbiAgICAgIHBhdGhzW25pXS5wdXNoKGNlbGxzLm1hcCgoYykgPT4gKHsgeDogY3goYyksIHk6IGN5KGMpIH0pKSk7XG4gICAgfVxuICB9XG5cbiAgLy8gLS0tLSByZXN1bHRzXG4gIGNvbnN0IG5ldHMgPSBuZXcgTWFwKCk7XG4gIHJvdXRlZC5mb3JFYWNoKChuZXQsIG5pKSA9PiBuZXRzLnNldChuZXQuaWQsIHsgaWQ6IG5ldC5pZCwgcGF0aHM6IHBhdGhzW25pXS5tYXAoc2ltcGxpZnkpLCBzZWdtZW50czogdG9TZWdtZW50cyhwYXRoc1tuaV0pIH0pKTtcbiAgY29uc3QganVuY3Rpb25zID0gW107XG4gIHJvdXRlZC5mb3JFYWNoKChuZXQsIG5pKSA9PiB7XG4gICAgZm9yIChjb25zdCBbYywgYl0gb2YgYml0c1tuaV0pIGlmIChwb3Bjb3VudChiKSA+PSAzKSBqdW5jdGlvbnMucHVzaCh7IHg6IGN4KGMpLCB5OiBjeShjKSwgbmV0OiBuZXQuaWQgfSk7XG4gIH0pO1xuICBjb25zdCBjcm9zc2luZ3MgPSBbXTtcbiAgZm9yIChsZXQgYyA9IDA7IGMgPCBOOyBjKyspIHtcbiAgICBpZiAob2NjSFtjXSAmJiBvY2NWW2NdICYmIG9jY0hbY10gIT09IG9jY1ZbY10pIHtcbiAgICAgIGNyb3NzaW5ncy5wdXNoKHsgeDogY3goYyksIHk6IGN5KGMpLCBoOiByb3V0ZWRbb2NjSFtjXSAtIDFdLmlkLCB2OiByb3V0ZWRbb2NjVltjXSAtIDFdLmlkIH0pO1xuICAgIH1cbiAgfVxuICByZXR1cm4geyBuZXRzLCBqdW5jdGlvbnMsIGNyb3NzaW5ncywgZmFpbHVyZXMgfTtcbn1cblxuZnVuY3Rpb24gc3BhbihwaW5zKSB7XG4gIGNvbnN0IHhzID0gcGlucy5tYXAoKHApID0+IHAueCksIHlzID0gcGlucy5tYXAoKHApID0+IHAueSk7XG4gIHJldHVybiBNYXRoLm1heCguLi54cykgLSBNYXRoLm1pbiguLi54cykgKyBNYXRoLm1heCguLi55cykgLSBNYXRoLm1pbiguLi55cyk7XG59XG5cbi8vIEZpbGwgaW4gaW50ZXJtZWRpYXRlIGNlbGxzIG9mIGFuIGF4aXMtYWxpZ25lZCBjZWxsIHBvbHlsaW5lLlxuZnVuY3Rpb24gZXhwYW5kQ2VsbHMoY2VsbHMsIFcpIHtcbiAgY29uc3Qgb3V0ID0gW2NlbGxzWzBdXTtcbiAgZm9yIChsZXQgaSA9IDE7IGkgPCBjZWxscy5sZW5ndGg7IGkrKykge1xuICAgIGxldCBhID0gb3V0W291dC5sZW5ndGggLSAxXTtcbiAgICBjb25zdCBiID0gY2VsbHNbaV07XG4gICAgY29uc3QgYnggPSBiICUgVywgYnkgPSAoYiAvIFcpIHwgMDtcbiAgICAvLyBob3Jpem9udGFsIGZpcnN0IHRoZW4gdmVydGljYWxcbiAgICB3aGlsZSAoYSAlIFcgIT09IGJ4KSB7IGEgKz0gYnggPiBhICUgVyA/IDEgOiAtMTsgb3V0LnB1c2goYSk7IH1cbiAgICB3aGlsZSAoKChhIC8gVykgfCAwKSAhPT0gYnkpIHsgYSArPSBieSA+ICgoYSAvIFcpIHwgMCkgPyBXIDogLVc7IG91dC5wdXNoKGEpOyB9XG4gIH1cbiAgcmV0dXJuIG91dDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNpbXBsaWZ5KHB0cykge1xuICBjb25zdCBvdXQgPSBbXTtcbiAgZm9yIChjb25zdCBwIG9mIHB0cykge1xuICAgIGlmIChvdXQubGVuZ3RoID49IDIpIHtcbiAgICAgIGNvbnN0IGEgPSBvdXRbb3V0Lmxlbmd0aCAtIDJdLCBiID0gb3V0W291dC5sZW5ndGggLSAxXTtcbiAgICAgIGlmICgoYS54ID09PSBiLnggJiYgYi54ID09PSBwLngpIHx8IChhLnkgPT09IGIueSAmJiBiLnkgPT09IHAueSkpIHsgb3V0W291dC5sZW5ndGggLSAxXSA9IHA7IGNvbnRpbnVlOyB9XG4gICAgfVxuICAgIGlmICghb3V0Lmxlbmd0aCB8fCBvdXRbb3V0Lmxlbmd0aCAtIDFdLnggIT09IHAueCB8fCBvdXRbb3V0Lmxlbmd0aCAtIDFdLnkgIT09IHAueSkgb3V0LnB1c2gocCk7XG4gIH1cbiAgcmV0dXJuIG91dDtcbn1cblxuZnVuY3Rpb24gdG9TZWdtZW50cyhwYXRocykge1xuICBjb25zdCBzZWdzID0gW107XG4gIGZvciAoY29uc3QgcGF0aCBvZiBwYXRocykge1xuICAgIGNvbnN0IHMgPSBzaW1wbGlmeShwYXRoKTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSArIDEgPCBzLmxlbmd0aDsgaSsrKSBzZWdzLnB1c2goeyB4MTogc1tpXS54LCB5MTogc1tpXS55LCB4Mjogc1tpICsgMV0ueCwgeTI6IHNbaSArIDFdLnkgfSk7XG4gIH1cbiAgcmV0dXJuIHNlZ3M7XG59XG4iLCAiLy8gQWZ0ZXIgcm91dGluZzogY2hvb3NlLCBwZXIgY29tcG9uZW50LCB0aGUgbGFiZWwgc2V0IChwcmltYXJ5IG9yIGFsdGVybmF0ZVxuLy8gc2lkZSkgdGhhdCBjb2xsaWRlcyBsZWFzdCB3aXRoIHdpcmVzLCBib2RpZXMsIG1hcmtlcnMgYW5kIG90aGVyIGxhYmVscy5cbmltcG9ydCB7IG92ZXJsYXBzLCBzZWdIaXRzUmVjdCwgaW5mbGF0ZSB9IGZyb20gJy4uL3V0aWxzL2dlb21ldHJ5LmpzJztcblxuZXhwb3J0IGZ1bmN0aW9uIHBsYWNlTGFiZWxzKGluc3RhbmNlcywgcm91dGluZykge1xuICBjb25zdCBzZWdzID0gW107XG4gIGZvciAoY29uc3QgbiBvZiByb3V0aW5nLm5ldHMudmFsdWVzKCkpIHNlZ3MucHVzaCguLi5uLnNlZ21lbnRzKTtcbiAgY29uc3QgaW5zdHMgPSBbLi4uaW5zdGFuY2VzLnZhbHVlcygpXTtcbiAgY29uc3QgdGFrZW4gPSBbXTtcbiAgY29uc3Qgc2NvcmUgPSAoSSwgbGFiZWxzKSA9PiB7XG4gICAgbGV0IHMgPSAwO1xuICAgIGZvciAoY29uc3QgbCBvZiBsYWJlbHMpIHtcbiAgICAgIGNvbnN0IGIgPSBpbmZsYXRlKGwuYm94LCAxKTtcbiAgICAgIGZvciAoY29uc3Qgc2VnIG9mIHNlZ3MpIGlmIChzZWdIaXRzUmVjdChzZWcsIGIpKSBzICs9IDM7XG4gICAgICBmb3IgKGNvbnN0IEogb2YgaW5zdHMpIHtcbiAgICAgICAgaWYgKG92ZXJsYXBzKGIsIEouYm9keSkpIHMgKz0gSiA9PT0gSSA/IDUgOiA0O1xuICAgICAgICBmb3IgKGNvbnN0IG0gb2YgSi5tYXJrZXJzKSBpZiAob3ZlcmxhcHMoYiwgbS5iYm94KSkgcyArPSAzO1xuICAgICAgfVxuICAgICAgZm9yIChjb25zdCB0IG9mIHRha2VuKSBpZiAob3ZlcmxhcHMoYiwgdCkpIHMgKz0gNDtcbiAgICB9XG4gICAgcmV0dXJuIHM7XG4gIH07XG4gIGZvciAoY29uc3QgSSBvZiBpbnN0cykge1xuICAgIEkubGFiZWxzRmluYWwgPSBJLmxhYmVscztcbiAgICBpZiAoSS5sYWJlbEFsdD8ubGVuZ3RoKSB7XG4gICAgICBjb25zdCBhID0gc2NvcmUoSSwgSS5sYWJlbHMpLCBiID0gc2NvcmUoSSwgSS5sYWJlbEFsdCk7XG4gICAgICBpZiAoYiA8IGEpIEkubGFiZWxzRmluYWwgPSBJLmxhYmVsQWx0O1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IGwgb2YgSS5sYWJlbHNGaW5hbCkgdGFrZW4ucHVzaChsLmJveCk7XG4gIH1cbn1cbiIsICIvLyBTY2VuZSAtPiBzdGFuZGFsb25lLCBwb3J0YWJsZSBTVkcgc3RyaW5nIChubyBleHRlcm5hbCBDU1MsIG5vIDx1c2U+KS5cbmltcG9ydCB7IHVuaW9uUmVjdCwgYm91bmRzT2YgfSBmcm9tICcuLi91dGlscy9nZW9tZXRyeS5qcyc7XG5cbmV4cG9ydCBjb25zdCBUSEVNRVMgPSB7XG4gIGxpZ2h0OiB7IGluazogJyMxYjFiMWYnLCB3aXJlOiAnIzFiMWIxZicsIG11dGVkOiAnIzU1NTY1YycsIGp1bmN0aW9uOiAnIzFiMWIxZicsIGJhY2tncm91bmQ6ICcjZmZmZmZmJyB9LFxuICBkYXJrOiB7IGluazogJyNlN2U3ZWEnLCB3aXJlOiAnI2U3ZTdlYScsIG11dGVkOiAnI2ExYTFhYScsIGp1bmN0aW9uOiAnI2U3ZTdlYScsIGJhY2tncm91bmQ6ICcjMTgxODFiJyB9LFxufTtcbmNvbnN0IEZPTlQgPSAnSGVsdmV0aWNhLCBBcmlhbCwgc2Fucy1zZXJpZic7XG5cbmNvbnN0IGVzYyA9IChzKSA9PiBTdHJpbmcocykucmVwbGFjZSgvJi9nLCAnJmFtcDsnKS5yZXBsYWNlKC88L2csICcmbHQ7JykucmVwbGFjZSgvPi9nLCAnJmd0OycpLnJlcGxhY2UoL1wiL2csICcmcXVvdDsnKTtcbmNvbnN0IG4gPSAodikgPT4gKygrdikudG9GaXhlZCgyKTtcblxuZXhwb3J0IGZ1bmN0aW9uIHNjZW5lQm91bmRzKHNjZW5lKSB7XG4gIGxldCBiID0gbnVsbDtcbiAgZm9yIChjb25zdCBJIG9mIHNjZW5lLmluc3RhbmNlcy52YWx1ZXMoKSkge1xuICAgIGIgPSB1bmlvblJlY3QoYiwgSS5ib2R5KTtcbiAgICBiID0gdW5pb25SZWN0KGIsIGJvdW5kc09mKE9iamVjdC52YWx1ZXMoSS5waW5zKSkpO1xuICAgIGZvciAoY29uc3QgbSBvZiBJLm1hcmtlcnMpIGIgPSB1bmlvblJlY3QoYiwgbS5iYm94KTtcbiAgICBmb3IgKGNvbnN0IGwgb2YgSS5sYWJlbHNGaW5hbCB8fCBJLmxhYmVscykgYiA9IHVuaW9uUmVjdChiLCBsLmJveCk7XG4gIH1cbiAgZm9yIChjb25zdCBuZXQgb2Ygc2NlbmUucm91dGluZy5uZXRzLnZhbHVlcygpKVxuICAgIGZvciAoY29uc3QgcyBvZiBuZXQuc2VnbWVudHMpIGIgPSB1bmlvblJlY3QoYiwgYm91bmRzT2YoW3sgeDogcy54MSwgeTogcy55MSB9LCB7IHg6IHMueDIsIHk6IHMueTIgfV0pKTtcbiAgcmV0dXJuIGIgfHwgeyB4OiAwLCB5OiAwLCB3OiAyMDAsIGg6IDEwMCB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVuZGVyU1ZHKHNjZW5lLCBvcHRzID0ge30pIHtcbiAgY29uc3QgdGggPSBUSEVNRVNbb3B0cy50aGVtZV0gfHwgVEhFTUVTLmxpZ2h0O1xuICBjb25zdCBwYWQgPSBvcHRzLnBhZGRpbmcgPz8gMzA7XG4gIGNvbnN0IHRpdGxlID0gb3B0cy5zaG93VGl0bGUgIT09IGZhbHNlICYmIHNjZW5lLnRpdGxlID8gU3RyaW5nKHNjZW5lLnRpdGxlKSA6ICcnO1xuICBjb25zdCBiID0gc2NlbmVCb3VuZHMoc2NlbmUpO1xuICBjb25zdCB0aXRsZUggPSB0aXRsZSA/IDMwIDogMDtcbiAgY29uc3QgdnggPSBNYXRoLmZsb29yKGIueCAtIHBhZCksIHZ5ID0gTWF0aC5mbG9vcihiLnkgLSBwYWQgLSB0aXRsZUgpO1xuICBjb25zdCB2dyA9IE1hdGguY2VpbChiLncgKyAyICogcGFkKSwgdmggPSBNYXRoLmNlaWwoYi5oICsgMiAqIHBhZCArIHRpdGxlSCk7XG4gIGNvbnN0IGJnID0gb3B0cy5iYWNrZ3JvdW5kID09PSB1bmRlZmluZWQgPyB0aC5iYWNrZ3JvdW5kIDogb3B0cy5iYWNrZ3JvdW5kO1xuICBjb25zdCBvdXQgPSBbXTtcbiAgb3V0LnB1c2goYDxzdmcgeG1sbnM9XCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiIHdpZHRoPVwiJHt2d31cIiBoZWlnaHQ9XCIke3ZofVwiIHZpZXdCb3g9XCIke3Z4fSAke3Z5fSAke3Z3fSAke3ZofVwiIGZvbnQtZmFtaWx5PVwiJHtGT05UfVwiIGRhdGEtZ2VuZXJhdG9yPVwiQ2lyY3VpdEZvcmdlXCI+YCk7XG4gIG91dC5wdXNoKGA8dGl0bGU+JHtlc2ModGl0bGUgfHwgJ0NpcmN1aXQgc2NoZW1hdGljJyl9PC90aXRsZT48ZGVzYz5HZW5lcmF0ZWQgYnkgQ2lyY3VpdEZvcmdlPC9kZXNjPmApO1xuICBpZiAoYmcpIG91dC5wdXNoKGA8cmVjdCB4PVwiJHt2eH1cIiB5PVwiJHt2eX1cIiB3aWR0aD1cIiR7dnd9XCIgaGVpZ2h0PVwiJHt2aH1cIiBmaWxsPVwiJHtiZ31cIi8+YCk7XG4gIGlmICh0aXRsZSkgb3V0LnB1c2goYDx0ZXh0IHg9XCIke24oYi54KX1cIiB5PVwiJHtuKHZ5ICsgcGFkICsgMTIpfVwiIGZvbnQtc2l6ZT1cIjE0XCIgZm9udC13ZWlnaHQ9XCI2MDBcIiBmaWxsPVwiJHt0aC5pbmt9XCI+JHtlc2ModGl0bGUpfTwvdGV4dD5gKTtcblxuICAvLyB3aXJlc1xuICBvdXQucHVzaChgPGcgaWQ9XCJ3aXJlc1wiIGZpbGw9XCJub25lXCIgc3Ryb2tlPVwiJHt0aC53aXJlfVwiIHN0cm9rZS13aWR0aD1cIjEuNlwiIHN0cm9rZS1saW5lY2FwPVwic3F1YXJlXCIgc3Ryb2tlLWxpbmVqb2luPVwibWl0ZXJcIj5gKTtcbiAgY29uc3QgYnJpZGdlQXQgPSBuZXcgTWFwKCk7XG4gIGlmIChvcHRzLmJyaWRnZXMpIGZvciAoY29uc3QgYyBvZiBzY2VuZS5yb3V0aW5nLmNyb3NzaW5ncykge1xuICAgIGlmICghYnJpZGdlQXQuaGFzKGMuaCkpIGJyaWRnZUF0LnNldChjLmgsIFtdKTtcbiAgICBicmlkZ2VBdC5nZXQoYy5oKS5wdXNoKGMpO1xuICB9XG4gIGZvciAoY29uc3QgbmV0IG9mIHNjZW5lLnJvdXRpbmcubmV0cy52YWx1ZXMoKSkge1xuICAgIGNvbnN0IGhvcHMgPSBicmlkZ2VBdC5nZXQobmV0LmlkKSB8fCBbXTtcbiAgICBjb25zdCBkID0gbmV0LnBhdGhzLm1hcCgocCkgPT4gcGF0aEQocCwgaG9wcykpLmpvaW4oJycpO1xuICAgIGlmIChkKSBvdXQucHVzaChgPHBhdGggZGF0YS1uZXQ9XCIke2VzYyhuZXQuaWQpfVwiIGQ9XCIke2R9XCIvPmApO1xuICB9XG4gIG91dC5wdXNoKCc8L2c+Jyk7XG5cbiAgLy8gY29tcG9uZW50c1xuICBvdXQucHVzaChgPGcgaWQ9XCJjb21wb25lbnRzXCIgY29sb3I9XCIke3RoLmlua31cIj5gKTtcbiAgZm9yIChjb25zdCBJIG9mIHNjZW5lLmluc3RhbmNlcy52YWx1ZXMoKSkge1xuICAgIGNvbnN0IHMgPSBJLnBhcnQuc3ltO1xuICAgIGNvbnN0IHRmID0gYHRyYW5zbGF0ZSgke24oSS54KX0gJHtuKEkueSl9KSR7SS5yb3QgPyBgIHJvdGF0ZSgke0kucm90fSlgIDogJyd9JHtJLm1pcnJvciA/ICcgc2NhbGUoLTEgMSknIDogJyd9IHRyYW5zbGF0ZSgke24oLXMub3JpZ2luLngpfSAke24oLXMub3JpZ2luLnkpfSlgO1xuICAgIGNvbnN0IGhpdCA9IG9wdHMuaW50ZXJhY3RpdmUgPyBgPHJlY3QgY2xhc3M9XCJjZi1oaXRcIiB4PVwiJHtuKHMuYm9keS54IC0gNCl9XCIgeT1cIiR7bihzLmJvZHkueSAtIDQpfVwiIHdpZHRoPVwiJHtuKHMuYm9keS53ICsgOCl9XCIgaGVpZ2h0PVwiJHtuKHMuYm9keS5oICsgOCl9XCIgZmlsbD1cInRyYW5zcGFyZW50XCIgc3Ryb2tlPVwibm9uZVwiLz5gIDogJyc7XG4gICAgb3V0LnB1c2goYDxnIGlkPVwiJHtlc2MoJ3BhcnQtJyArIEkuaWQpfVwiIGNsYXNzPVwiY2YtcGFydFwiIGRhdGEtaWQ9XCIke2VzYyhJLmlkKX1cIiBkYXRhLXR5cGU9XCIke2VzYyhzLnR5cGUpfVwiIHRyYW5zZm9ybT1cIiR7dGZ9XCI+JHtoaXR9JHtzLnN2Z0JvZHl9PC9nPmApO1xuICB9XG4gIG91dC5wdXNoKCc8L2c+Jyk7XG5cbiAgLy8gcmFpbCBtYXJrZXJzXG4gIG91dC5wdXNoKGA8ZyBpZD1cIm1hcmtlcnNcIiBjb2xvcj1cIiR7dGguaW5rfVwiIGZpbGw9XCJub25lXCIgc3Ryb2tlPVwiJHt0aC53aXJlfVwiIHN0cm9rZS13aWR0aD1cIjEuNlwiPmApO1xuICBmb3IgKGNvbnN0IEkgb2Ygc2NlbmUuaW5zdGFuY2VzLnZhbHVlcygpKSB7XG4gICAgZm9yIChjb25zdCBtIG9mIEkubWFya2Vycykge1xuICAgICAgY29uc3QgcGFydHMgPSBbXTtcbiAgICAgIGlmIChtLnN0dWJzLmxlbmd0aCkgcGFydHMucHVzaChgPHBhdGggZD1cIiR7bS5zdHVicy5tYXAoKHN0KSA9PiBgTSR7bihzdC54MSl9ICR7bihzdC55MSl9TCR7bihzdC54Mil9ICR7bihzdC55Mil9YCkuam9pbignJyl9XCIgc3Ryb2tlLWxpbmVjYXA9XCJzcXVhcmVcIi8+YCk7XG4gICAgICBpZiAobS5kb3QpIHBhcnRzLnB1c2goYDxjaXJjbGUgY3g9XCIke24obS5kb3QueCl9XCIgY3k9XCIke24obS5kb3QueSl9XCIgcj1cIjMuMlwiIGZpbGw9XCIke3RoLmp1bmN0aW9ufVwiIHN0cm9rZT1cIm5vbmVcIi8+YCk7XG4gICAgICBpZiAobS5zeW0pIHtcbiAgICAgICAgY29uc3QgdCA9IG0udDtcbiAgICAgICAgcGFydHMucHVzaChgPGcgdHJhbnNmb3JtPVwidHJhbnNsYXRlKCR7bih0LngpfSAke24odC55KX0pJHt0LnJvdCA/IGAgcm90YXRlKCR7dC5yb3R9KWAgOiAnJ30gdHJhbnNsYXRlKCR7bigtdC5veCl9ICR7bigtdC5veSl9KVwiPiR7bS5zeW0uc3ZnQm9keX08L2c+YCk7XG4gICAgICB9XG4gICAgICBpZiAobS5mbGFnKSB7XG4gICAgICAgIGNvbnN0IHB0cyA9IG0uZmxhZy5tYXAoKFt4LCB5XSkgPT4gYCR7bih4KX0sJHtuKHkpfWApLmpvaW4oJyAnKTtcbiAgICAgICAgcGFydHMucHVzaChtLmJveCA/IGA8cG9seWxpbmUgcG9pbnRzPVwiJHtwdHN9XCIvPjxyZWN0IHg9XCIke24obS5ib3gueCl9XCIgeT1cIiR7bihtLmJveC55KX1cIiB3aWR0aD1cIiR7bihtLmJveC53KX1cIiBoZWlnaHQ9XCIke24obS5ib3guaCl9XCIgcng9XCIyXCIvPmAgOiBgPHBvbHlnb24gcG9pbnRzPVwiJHtwdHN9XCIgc3Ryb2tlLWxpbmVqb2luPVwicm91bmRcIi8+YCk7XG4gICAgICB9XG4gICAgICBpZiAobS50ZXh0KSBwYXJ0cy5wdXNoKHRleHRFbChtLnRleHQsIHRoLmluaywgJ25vcm1hbCcpKTtcbiAgICAgIG91dC5wdXNoKGA8ZyBjbGFzcz1cImNmLW1hcmtlclwiIGRhdGEtZm9yPVwiJHtlc2MoSS5pZCl9XCIgZGF0YS1uZXQ9XCIke2VzYyhtLm5ldCl9XCI+JHtwYXJ0cy5qb2luKCcnKX08L2c+YCk7XG4gICAgfVxuICB9XG4gIG91dC5wdXNoKCc8L2c+Jyk7XG5cbiAgLy8gbGFiZWxzXG4gIG91dC5wdXNoKGA8ZyBpZD1cImxhYmVsc1wiIHN0cm9rZT1cIm5vbmVcIj5gKTtcbiAgZm9yIChjb25zdCBJIG9mIHNjZW5lLmluc3RhbmNlcy52YWx1ZXMoKSkge1xuICAgIGNvbnN0IGxzID0gSS5sYWJlbHNGaW5hbCB8fCBJLmxhYmVscztcbiAgICBpZiAoIWxzLmxlbmd0aCkgY29udGludWU7XG4gICAgb3V0LnB1c2goYDxnIGNsYXNzPVwiY2YtbGFiZWxzXCIgZGF0YS1mb3I9XCIke2VzYyhJLmlkKX1cIj4ke2xzLm1hcCgobCkgPT4gdGV4dEVsKGwsIGwuY2xzID09PSAndmFsdWUnID8gdGgubXV0ZWQgOiB0aC5pbmssIGwuY2xzID09PSAncmVmJyA/ICc2MDAnIDogJ25vcm1hbCcpKS5qb2luKCcnKX08L2c+YCk7XG4gIH1cbiAgb3V0LnB1c2goJzwvZz4nKTtcblxuICAvLyBqdW5jdGlvbnNcbiAgb3V0LnB1c2goYDxnIGlkPVwianVuY3Rpb25zXCIgZmlsbD1cIiR7dGguanVuY3Rpb259XCIgc3Ryb2tlPVwibm9uZVwiPmApO1xuICBmb3IgKGNvbnN0IGogb2Ygc2NlbmUucm91dGluZy5qdW5jdGlvbnMpIG91dC5wdXNoKGA8Y2lyY2xlIGN4PVwiJHtuKGoueCl9XCIgY3k9XCIke24oai55KX1cIiByPVwiMy4yXCIvPmApO1xuICBvdXQucHVzaCgnPC9nPicpO1xuICBvdXQucHVzaCgnPC9zdmc+Jyk7XG4gIHJldHVybiB7IHN2Zzogb3V0LmpvaW4oJ1xcbicpLCB3aWR0aDogdncsIGhlaWdodDogdmgsIHZpZXdCb3g6IHsgeDogdngsIHk6IHZ5LCB3OiB2dywgaDogdmggfSB9O1xufVxuXG5mdW5jdGlvbiB0ZXh0RWwobCwgZmlsbCwgd2VpZ2h0KSB7XG4gIHJldHVybiBgPHRleHQgeD1cIiR7bihsLngpfVwiIHk9XCIke24obC55KX1cIiBmb250LXNpemU9XCIke2wuc2l6ZX1cIiB0ZXh0LWFuY2hvcj1cIiR7bC5hbmNob3J9XCIgZmlsbD1cIiR7ZmlsbH1cIiR7d2VpZ2h0ICE9PSAnbm9ybWFsJyA/IGAgZm9udC13ZWlnaHQ9XCIke3dlaWdodH1cImAgOiAnJ30+JHtlc2MobC50ZXh0KX08L3RleHQ+YDtcbn1cblxuY29uc3QgUiA9IDQuNTsgLy8gYnJpZGdlIHJhZGl1c1xuXG5mdW5jdGlvbiBwYXRoRChwdHMsIGhvcHMpIHtcbiAgaWYgKHB0cy5sZW5ndGggPCAyKSByZXR1cm4gJyc7XG4gIGxldCBkID0gYE0ke24ocHRzWzBdLngpfSAke24ocHRzWzBdLnkpfWA7XG4gIGZvciAobGV0IGkgPSAxOyBpIDwgcHRzLmxlbmd0aDsgaSsrKSB7XG4gICAgY29uc3QgYSA9IHB0c1tpIC0gMV0sIGIgPSBwdHNbaV07XG4gICAgaWYgKGEueSA9PT0gYi55ICYmIGhvcHMubGVuZ3RoKSB7XG4gICAgICBjb25zdCBkaXIgPSBiLnggPiBhLnggPyAxIDogLTE7XG4gICAgICBjb25zdCB4cyA9IGhvcHMuZmlsdGVyKChoKSA9PiBoLnkgPT09IGEueSAmJiAoaC54IC0gYS54KSAqIGRpciA+IFIgJiYgKGIueCAtIGgueCkgKiBkaXIgPiBSKVxuICAgICAgICAubWFwKChoKSA9PiBoLngpLnNvcnQoKHAsIHEpID0+IChwIC0gcSkgKiBkaXIpO1xuICAgICAgZm9yIChjb25zdCB4IG9mIHhzKSB7XG4gICAgICAgIGQgKz0gYEgke24oeCAtIGRpciAqIFIpfWEke1J9ICR7Un0gMCAwICR7ZGlyID4gMCA/IDEgOiAwfSAke24oZGlyICogMiAqIFIpfSAwYDtcbiAgICAgIH1cbiAgICB9XG4gICAgZCArPSBhLnggPT09IGIueCA/IGBWJHtuKGIueSl9YCA6IGEueSA9PT0gYi55ID8gYEgke24oYi54KX1gIDogYEwke24oYi54KX0gJHtuKGIueSl9YDtcbiAgfVxuICByZXR1cm4gZDtcbn1cbiIsICIvLyBQdWJsaWMgZW50cnkgcG9pbnQgc2hhcmVkIGJ5IHRoZSB3ZWIgVUksIHRlc3RzIGFuZCB0aGUgKGZ1dHVyZSkgSFRUUCBBUEkuXG4vLyAgIHJlbmRlcihjaXJjdWl0SnNvbk9yT2JqZWN0LCBvcHRpb25zKSAtPiB7IHZhbGlkLCBlcnJvcnMsIHdhcm5pbmdzLCBzdmcsIHdpZHRoLCBoZWlnaHQsIHNjZW5lIH1cbi8vICAgdmFsaWRhdGUoY2lyY3VpdEpzb25Pck9iamVjdCkgICAgICAgIC0+IHsgdmFsaWQsIGVycm9ycywgd2FybmluZ3MgfVxuaW1wb3J0IHsgdmFsaWRhdGVDaXJjdWl0IH0gZnJvbSAnLi92YWxpZGF0b3IvaW5kZXguanMnO1xuaW1wb3J0IHsgYnVpbGROZXRsaXN0IH0gZnJvbSAnLi9ncmFwaC9pbmRleC5qcyc7XG5pbXBvcnQgeyBsYXlvdXRDaXJjdWl0IH0gZnJvbSAnLi9sYXlvdXQvaW5kZXguanMnO1xuaW1wb3J0IHsgcm91dGVDaXJjdWl0IH0gZnJvbSAnLi9yb3V0ZXIvaW5kZXguanMnO1xuaW1wb3J0IHsgcGxhY2VMYWJlbHMgfSBmcm9tICcuL2xheW91dC9sYWJlbHMuanMnO1xuaW1wb3J0IHsgcmVuZGVyU1ZHIH0gZnJvbSAnLi9yZW5kZXJlci9pbmRleC5qcyc7XG5cbmV4cG9ydCBmdW5jdGlvbiB2YWxpZGF0ZShpbnB1dCkge1xuICBjb25zdCB2ID0gdmFsaWRhdGVDaXJjdWl0KGlucHV0KTtcbiAgcmV0dXJuIHsgdmFsaWQ6IHYudmFsaWQsIGVycm9yczogdi5lcnJvcnMsIHdhcm5pbmdzOiB2Lndhcm5pbmdzIH07XG59XG5cbi8vIEJ1aWxkIHRoZSBnZW9tZXRyaWMgc2NlbmUgKG5ldGxpc3QgKyBwbGFjZW1lbnQgKyByb3V0aW5nKSB3aXRob3V0IFNWRyBvdXRwdXQuXG5leHBvcnQgZnVuY3Rpb24gYnVpbGRTY2VuZShpbnB1dCwgdiA9IHZhbGlkYXRlQ2lyY3VpdChpbnB1dCkpIHtcbiAgaWYgKCF2LnZhbGlkKSByZXR1cm4geyB2LCBzY2VuZTogbnVsbCB9O1xuICBjb25zdCB3YXJuaW5ncyA9IHYud2FybmluZ3M7XG4gIGNvbnN0IG5sID0gYnVpbGROZXRsaXN0KHYpO1xuICBsZXQgcGxhY2VtZW50O1xuICB0cnkge1xuICAgIHBsYWNlbWVudCA9IGxheW91dENpcmN1aXQobmwpO1xuICB9IGNhdGNoIChlKSB7XG4gICAgdi5lcnJvcnMucHVzaCh7IGNvZGU6ICdMQVlPVVRfRkFJTFVSRScsIG1lc3NhZ2U6IGBMYXlvdXQgZmFpbGVkOiAke2UubWVzc2FnZX1gIH0pO1xuICAgIHYudmFsaWQgPSBmYWxzZTtcbiAgICByZXR1cm4geyB2LCBzY2VuZTogbnVsbCB9O1xuICB9XG4gIGxldCByb3V0aW5nO1xuICB0cnkge1xuICAgIHJvdXRpbmcgPSByb3V0ZUNpcmN1aXQobmwsIHBsYWNlbWVudC5pbnN0YW5jZXMpO1xuICB9IGNhdGNoIChlKSB7XG4gICAgdi5lcnJvcnMucHVzaCh7IGNvZGU6ICdST1VUSU5HX0ZBSUxVUkUnLCBtZXNzYWdlOiBgUm91dGluZyBmYWlsZWQ6ICR7ZS5tZXNzYWdlfWAgfSk7XG4gICAgdi52YWxpZCA9IGZhbHNlO1xuICAgIHJldHVybiB7IHYsIHNjZW5lOiBudWxsIH07XG4gIH1cbiAgZm9yIChjb25zdCBmIG9mIHJvdXRpbmcuZmFpbHVyZXMpIHtcbiAgICB3YXJuaW5ncy5wdXNoKHsgY29kZTogJ1JPVVRJTkdfRkFJTFVSRScsIGNvbXBvbmVudDogZi5jb21wLCBwaW46IGYucGluLCBtZXNzYWdlOiBgQ291bGQgbm90IGZpbmQgYSBjbGVhbiByb3V0ZSB0byAke2YuY29tcH0uJHtmLnBpbn07IGRyZXcgYSBkaXJlY3Qgd2lyZSBpbnN0ZWFkLmAgfSk7XG4gIH1cbiAgcGxhY2VMYWJlbHMocGxhY2VtZW50Lmluc3RhbmNlcywgcm91dGluZyk7XG4gIHJldHVybiB7IHYsIHNjZW5lOiB7IHRpdGxlOiB2LmNpcmN1aXQudGl0bGUsIG5ldGxpc3Q6IG5sLCBpbnN0YW5jZXM6IHBsYWNlbWVudC5pbnN0YW5jZXMsIHJvdXRpbmcgfSB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVuZGVyKGlucHV0LCBvcHRpb25zID0ge30pIHtcbiAgY29uc3QgdiA9IHZhbGlkYXRlQ2lyY3VpdChpbnB1dCk7XG4gIGNvbnN0IHsgc2NlbmUgfSA9IGJ1aWxkU2NlbmUoaW5wdXQsIHYpO1xuICBpZiAoIXNjZW5lKSByZXR1cm4geyB2YWxpZDogZmFsc2UsIGVycm9yczogdi5lcnJvcnMsIHdhcm5pbmdzOiB2Lndhcm5pbmdzLCBzdmc6IG51bGwgfTtcbiAgY29uc3Qgb3V0ID0gcmVuZGVyU1ZHKHNjZW5lLCBvcHRpb25zKTtcbiAgcmV0dXJuIHsgdmFsaWQ6IHRydWUsIGVycm9yczogW10sIHdhcm5pbmdzOiB2Lndhcm5pbmdzLCBzdmc6IG91dC5zdmcsIHdpZHRoOiBvdXQud2lkdGgsIGhlaWdodDogb3V0LmhlaWdodCwgdmlld0JveDogb3V0LnZpZXdCb3gsIHNjZW5lIH07XG59XG5cbmV4cG9ydCB7IGxpc3RUeXBlcyB9IGZyb20gJy4vc3ltYm9sLWxvYWRlci9pbmRleC5qcyc7XG4iLCAiLy8gVW5kby9yZWRvIG92ZXIgSlNPTiB0ZXh0IHNuYXBzaG90cy5cbmV4cG9ydCBjbGFzcyBIaXN0b3J5IHtcbiAgY29uc3RydWN0b3IobGltaXQgPSAyMDApIHtcbiAgICB0aGlzLnN0YWNrID0gW107XG4gICAgdGhpcy5pbmRleCA9IC0xO1xuICAgIHRoaXMubGltaXQgPSBsaW1pdDtcbiAgfVxuICBwdXNoKHRleHQpIHtcbiAgICBpZiAodGhpcy5zdGFja1t0aGlzLmluZGV4XSA9PT0gdGV4dCkgcmV0dXJuO1xuICAgIHRoaXMuc3RhY2subGVuZ3RoID0gdGhpcy5pbmRleCArIDE7XG4gICAgdGhpcy5zdGFjay5wdXNoKHRleHQpO1xuICAgIGlmICh0aGlzLnN0YWNrLmxlbmd0aCA+IHRoaXMubGltaXQpIHRoaXMuc3RhY2suc2hpZnQoKTtcbiAgICB0aGlzLmluZGV4ID0gdGhpcy5zdGFjay5sZW5ndGggLSAxO1xuICB9XG4gIGdldCBjYW5VbmRvKCkgeyByZXR1cm4gdGhpcy5pbmRleCA+IDA7IH1cbiAgZ2V0IGNhblJlZG8oKSB7IHJldHVybiB0aGlzLmluZGV4IDwgdGhpcy5zdGFjay5sZW5ndGggLSAxOyB9XG4gIHVuZG8oKSB7IHJldHVybiB0aGlzLmNhblVuZG8gPyB0aGlzLnN0YWNrWy0tdGhpcy5pbmRleF0gOiBudWxsOyB9XG4gIHJlZG8oKSB7IHJldHVybiB0aGlzLmNhblJlZG8gPyB0aGlzLnN0YWNrWysrdGhpcy5pbmRleF0gOiBudWxsOyB9XG59XG4iLCAiLy8gUHVyZSBtdXRhdGlvbnMgb24gdGhlIGNpcmN1aXQgSlNPTiBvYmplY3QuIENhbnZhcyBlZGl0cyBnbyB0aHJvdWdoIHRoZXNlIHNvXG4vLyB0aGUgSlNPTiBzdGF5cyB0aGUgc2luZ2xlIHNvdXJjZSBvZiB0cnV0aC5cbmltcG9ydCB7IHBhcnNlUmVmIH0gZnJvbSAnLi4vcGFyc2VyL2luZGV4LmpzJztcbmltcG9ydCB7IHJlc29sdmVTeW1ib2wgfSBmcm9tICcuLi9zeW1ib2wtbG9hZGVyL2luZGV4LmpzJztcblxuY29uc3QgY2xvbmUgPSAobykgPT4gSlNPTi5wYXJzZShKU09OLnN0cmluZ2lmeShvKSk7XG5cbi8vIENvbXBhY3QsIHJlYWRhYmxlIEpTT046IHNob3J0IGFycmF5cy9vYmplY3RzIHN0YXkgb24gb25lIGxpbmUuXG5leHBvcnQgZnVuY3Rpb24gZm9ybWF0SlNPTih2YWx1ZSwgaW5kZW50ID0gJycpIHtcbiAgY29uc3QgZmxhdCA9IEpTT04uc3RyaW5naWZ5KHZhbHVlKTtcbiAgaWYgKGZsYXQgPT09IHVuZGVmaW5lZCkgcmV0dXJuICdudWxsJztcbiAgY29uc3Qgc2ltcGxlID0gKHYpID0+IHYgPT09IG51bGwgfHwgdHlwZW9mIHYgIT09ICdvYmplY3QnIHx8IChBcnJheS5pc0FycmF5KHYpID8gdi5ldmVyeSgoeCkgPT4geCA9PT0gbnVsbCB8fCB0eXBlb2YgeCAhPT0gJ29iamVjdCcpIDogT2JqZWN0LnZhbHVlcyh2KS5ldmVyeSgoeCkgPT4geCA9PT0gbnVsbCB8fCB0eXBlb2YgeCAhPT0gJ29iamVjdCcpKTtcbiAgaWYgKHZhbHVlID09PSBudWxsIHx8IHR5cGVvZiB2YWx1ZSAhPT0gJ29iamVjdCcpIHJldHVybiBmbGF0O1xuICBjb25zdCBwcmltaXRpdmUgPSAoeCkgPT4geCA9PT0gbnVsbCB8fCB0eXBlb2YgeCAhPT0gJ29iamVjdCc7XG4gIGNvbnN0IGlubGluZSA9IChBcnJheS5pc0FycmF5KHZhbHVlKSA/IHZhbHVlLmV2ZXJ5KHByaW1pdGl2ZSkgOiBPYmplY3QudmFsdWVzKHZhbHVlKS5ldmVyeShzaW1wbGUpKSAmJiBmbGF0Lmxlbmd0aCArIGluZGVudC5sZW5ndGggPD0gMTAwO1xuICBpZiAoaW5saW5lKSByZXR1cm4gQXJyYXkuaXNBcnJheSh2YWx1ZSkgPyBmbGF0LnJlcGxhY2UoL1wiLFwiL2csICdcIiwgXCInKSA6IHByZXR0eUlubGluZSh2YWx1ZSk7XG4gIGNvbnN0IG5leHQgPSBpbmRlbnQgKyAnICAnO1xuICBpZiAoQXJyYXkuaXNBcnJheSh2YWx1ZSkpIHtcbiAgICBpZiAoIXZhbHVlLmxlbmd0aCkgcmV0dXJuICdbXSc7XG4gICAgcmV0dXJuICdbXFxuJyArIHZhbHVlLm1hcCgodikgPT4gbmV4dCArIGZvcm1hdEpTT04odiwgbmV4dCkpLmpvaW4oJyxcXG4nKSArICdcXG4nICsgaW5kZW50ICsgJ10nO1xuICB9XG4gIGNvbnN0IGtleXMgPSBPYmplY3Qua2V5cyh2YWx1ZSk7XG4gIGlmICgha2V5cy5sZW5ndGgpIHJldHVybiAne30nO1xuICByZXR1cm4gJ3tcXG4nICsga2V5cy5tYXAoKGspID0+IGAke25leHR9JHtKU09OLnN0cmluZ2lmeShrKX06ICR7Zm9ybWF0SlNPTih2YWx1ZVtrXSwgbmV4dCl9YCkuam9pbignLFxcbicpICsgJ1xcbicgKyBpbmRlbnQgKyAnfSc7XG59XG5cbmZ1bmN0aW9uIHByZXR0eUlubGluZShvKSB7XG4gIGNvbnN0IHBhcnRzID0gT2JqZWN0LmVudHJpZXMobykubWFwKChbaywgdl0pID0+IGAke0pTT04uc3RyaW5naWZ5KGspfTogJHtBcnJheS5pc0FycmF5KHYpID8gSlNPTi5zdHJpbmdpZnkodikucmVwbGFjZSgvXCIsXCIvZywgJ1wiLCBcIicpIDogdiAmJiB0eXBlb2YgdiA9PT0gJ29iamVjdCcgPyBwcmV0dHlJbmxpbmUodikgOiBKU09OLnN0cmluZ2lmeSh2KX1gKTtcbiAgcmV0dXJuIHBhcnRzLmxlbmd0aCA/IGB7ICR7cGFydHMuam9pbignLCAnKX0gfWAgOiAne30nO1xufVxuXG5jb25zdCByZWZzT2YgPSAoY2lyY3VpdCkgPT4ge1xuICBjb25zdCBsaXN0cyA9IFtdO1xuICAoY2lyY3VpdC5jb25uZWN0aW9ucyB8fCBbXSkuZm9yRWFjaCgoYywgaSkgPT4ge1xuICAgIGlmIChBcnJheS5pc0FycmF5KGMpKSBsaXN0cy5wdXNoKHsgZ2V0OiAoKSA9PiBjLCBzZXQ6ICh2KSA9PiAoY2lyY3VpdC5jb25uZWN0aW9uc1tpXSA9IHYpLCBraW5kOiAnYXJyYXknIH0pO1xuICAgIGVsc2UgaWYgKGMgJiYgQXJyYXkuaXNBcnJheShjLnBpbnMpKSBsaXN0cy5wdXNoKHsgZ2V0OiAoKSA9PiBjLnBpbnMsIHNldDogKHYpID0+IChjLnBpbnMgPSB2KSwga2luZDogJ3BpbnMnIH0pO1xuICAgIGVsc2UgaWYgKGMgJiYgdHlwZW9mIGMgPT09ICdvYmplY3QnKSBsaXN0cy5wdXNoKHsgZ2V0OiAoKSA9PiBbYy5mcm9tLCBjLnRvXSwgc2V0OiAodikgPT4geyBjLmZyb20gPSB2WzBdOyBjLnRvID0gdlsxXTsgfSwga2luZDogJ3BhaXInIH0pO1xuICB9KTtcbiAgaWYgKGNpcmN1aXQubmV0cyAmJiB0eXBlb2YgY2lyY3VpdC5uZXRzID09PSAnb2JqZWN0Jykge1xuICAgIGZvciAoY29uc3QgayBvZiBPYmplY3Qua2V5cyhjaXJjdWl0Lm5ldHMpKSBpZiAoQXJyYXkuaXNBcnJheShjaXJjdWl0Lm5ldHNba10pKSBsaXN0cy5wdXNoKHsgZ2V0OiAoKSA9PiBjaXJjdWl0Lm5ldHNba10sIHNldDogKHYpID0+IChjaXJjdWl0Lm5ldHNba10gPSB2KSwga2luZDogJ25ldCcgfSk7XG4gIH1cbiAgcmV0dXJuIGxpc3RzO1xufTtcblxuZXhwb3J0IGZ1bmN0aW9uIGRlbGV0ZUNvbXBvbmVudChjaXJjdWl0LCBpZCkge1xuICBjb25zdCBjID0gY2xvbmUoY2lyY3VpdCk7XG4gIGMuY29tcG9uZW50cyA9IChjLmNvbXBvbmVudHMgfHwgW10pLmZpbHRlcigoeCkgPT4geC5pZCAhPT0gaWQpO1xuICBjb25zdCBrZWVwID0gKHIpID0+IHBhcnNlUmVmKHIpPy5jb21wICE9PSBpZDtcbiAgaWYgKEFycmF5LmlzQXJyYXkoYy5jb25uZWN0aW9ucykpIHtcbiAgICBjLmNvbm5lY3Rpb25zID0gYy5jb25uZWN0aW9ucy5tYXAoKHgpID0+IHtcbiAgICAgIGlmIChBcnJheS5pc0FycmF5KHgpKSB7IGNvbnN0IHIgPSB4LmZpbHRlcihrZWVwKTsgcmV0dXJuIHIubGVuZ3RoID49IDIgPyByIDogbnVsbDsgfVxuICAgICAgaWYgKHggJiYgQXJyYXkuaXNBcnJheSh4LnBpbnMpKSB7IGNvbnN0IHIgPSB4LnBpbnMuZmlsdGVyKGtlZXApOyByZXR1cm4gci5sZW5ndGggPj0gMiA/IHsgLi4ueCwgcGluczogciB9IDogbnVsbDsgfVxuICAgICAgaWYgKHggJiYgdHlwZW9mIHggPT09ICdvYmplY3QnKSByZXR1cm4ga2VlcCh4LmZyb20pICYmIGtlZXAoeC50bykgPyB4IDogbnVsbDtcbiAgICAgIHJldHVybiB4O1xuICAgIH0pLmZpbHRlcigoeCkgPT4geCAhPT0gbnVsbCk7XG4gIH1cbiAgaWYgKGMubmV0cyAmJiB0eXBlb2YgYy5uZXRzID09PSAnb2JqZWN0Jykge1xuICAgIGZvciAoY29uc3QgayBvZiBPYmplY3Qua2V5cyhjLm5ldHMpKSBpZiAoQXJyYXkuaXNBcnJheShjLm5ldHNba10pKSBjLm5ldHNba10gPSBjLm5ldHNba10uZmlsdGVyKGtlZXApO1xuICB9XG4gIHJldHVybiBjO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVuYW1lQ29tcG9uZW50KGNpcmN1aXQsIG9sZElkLCBuZXdJZCkge1xuICBjb25zdCBjID0gY2xvbmUoY2lyY3VpdCk7XG4gIGNvbnN0IGNvbXAgPSBjLmNvbXBvbmVudHMuZmluZCgoeCkgPT4geC5pZCA9PT0gb2xkSWQpO1xuICBpZiAoIWNvbXApIHJldHVybiBjO1xuICBjb21wLmlkID0gbmV3SWQ7XG4gIGZvciAoY29uc3QgbCBvZiByZWZzT2YoYykpIHtcbiAgICBsLnNldChsLmdldCgpLm1hcCgocikgPT4ge1xuICAgICAgY29uc3QgcCA9IHBhcnNlUmVmKHIpO1xuICAgICAgcmV0dXJuIHAgJiYgcC5jb21wID09PSBvbGRJZCA/IChwLnBpbiA9PSBudWxsID8gbmV3SWQgOiBgJHtuZXdJZH0uJHtwLnBpbn1gKSA6IHI7XG4gICAgfSkpO1xuICB9XG4gIHJldHVybiBjO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdXBkYXRlQ29tcG9uZW50KGNpcmN1aXQsIGlkLCBwYXRjaCkge1xuICBjb25zdCBjID0gY2xvbmUoY2lyY3VpdCk7XG4gIGNvbnN0IGNvbXAgPSBjLmNvbXBvbmVudHMuZmluZCgoeCkgPT4geC5pZCA9PT0gaWQpO1xuICBpZiAoIWNvbXApIHJldHVybiBjO1xuICBmb3IgKGNvbnN0IFtrLCB2XSBvZiBPYmplY3QuZW50cmllcyhwYXRjaCkpIHtcbiAgICBpZiAodiA9PT0gdW5kZWZpbmVkIHx8IHYgPT09ICcnIHx8IHYgPT09IG51bGwpIGRlbGV0ZSBjb21wW2tdO1xuICAgIGVsc2UgY29tcFtrXSA9IHY7XG4gIH1cbiAgcmV0dXJuIGM7XG59XG5cbi8vIEZyZWV6ZSB0aGUgY3VycmVudCBhdXRvbWF0aWMgbGF5b3V0IGludG8gdGhlIEpTT04gKHBvc2l0aW9uICsgcm90YXRpb24gZm9yXG4vLyBldmVyeSBwYXJ0KSwgdGhlbiBhcHBseSBgbW92ZXNgIHsgaWQ6IHt4LCB5fSB9LlxuZXhwb3J0IGZ1bmN0aW9uIHBpbkxheW91dChjaXJjdWl0LCBpbnN0YW5jZXMsIG1vdmVzID0ge30pIHtcbiAgY29uc3QgYyA9IGNsb25lKGNpcmN1aXQpO1xuICBmb3IgKGNvbnN0IGNvbXAgb2YgYy5jb21wb25lbnRzIHx8IFtdKSB7XG4gICAgY29uc3QgSSA9IGluc3RhbmNlcy5nZXQoY29tcC5pZCk7XG4gICAgaWYgKCFJKSBjb250aW51ZTtcbiAgICBjb25zdCBtID0gbW92ZXNbY29tcC5pZF07XG4gICAgY29tcC5wb3NpdGlvbiA9IHsgeDogbSA/IG0ueCA6IEkueCwgeTogbSA/IG0ueSA6IEkueSB9O1xuICAgIGNvbXAucm90YXRpb24gPSBJLnJvdDtcbiAgICBpZiAoSS5taXJyb3IpIGNvbXAubWlycm9yID0gdHJ1ZTsgZWxzZSBkZWxldGUgY29tcC5taXJyb3I7XG4gIH1cbiAgcmV0dXJuIGM7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiByb3RhdGVDb21wb25lbnQoY2lyY3VpdCwgaW5zdGFuY2VzLCBpZCkge1xuICBjb25zdCBJID0gaW5zdGFuY2VzLmdldChpZCk7XG4gIGNvbnN0IGMgPSBwaW5MYXlvdXQoY2lyY3VpdCwgaW5zdGFuY2VzKTtcbiAgY29uc3QgY29tcCA9IGMuY29tcG9uZW50cy5maW5kKCh4KSA9PiB4LmlkID09PSBpZCk7XG4gIGlmIChjb21wICYmIEkpIGNvbXAucm90YXRpb24gPSAoSS5yb3QgKyA5MCkgJSAzNjA7XG4gIHJldHVybiBjO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY2xlYXJMYXlvdXQoY2lyY3VpdCkge1xuICBjb25zdCBjID0gY2xvbmUoY2lyY3VpdCk7XG4gIGZvciAoY29uc3QgY29tcCBvZiBjLmNvbXBvbmVudHMgfHwgW10pIHsgZGVsZXRlIGNvbXAucG9zaXRpb247IGRlbGV0ZSBjb21wLnJvdGF0aW9uOyBkZWxldGUgY29tcC5taXJyb3I7IH1cbiAgcmV0dXJuIGM7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBhZGRDb21wb25lbnQoY2lyY3VpdCwgdHlwZSkge1xuICBjb25zdCBjID0gY2xvbmUoY2lyY3VpdCk7XG4gIGMuY29tcG9uZW50cyA9IGMuY29tcG9uZW50cyB8fCBbXTtcbiAgY29uc3Qgc3ltID0gcmVzb2x2ZVN5bWJvbCh7IHR5cGUgfSk7XG4gIGNvbnN0IHByZWZpeCA9IHN5bT8ucHJlZml4IHx8IChzeW0/LnJhaWwgPyB0eXBlLnRvVXBwZXJDYXNlKCkgOiAnWCcpO1xuICBsZXQgbiA9IDE7XG4gIGNvbnN0IGlkcyA9IG5ldyBTZXQoYy5jb21wb25lbnRzLm1hcCgoeCkgPT4geC5pZCkpO1xuICB3aGlsZSAoaWRzLmhhcyhwcmVmaXggKyBuKSkgbisrO1xuICBjb25zdCBpZCA9IHN5bT8ucmFpbCAmJiAhaWRzLmhhcyhwcmVmaXgpID8gcHJlZml4IDogcHJlZml4ICsgbjtcbiAgYy5jb21wb25lbnRzLnB1c2goeyBpZCwgdHlwZSB9KTtcbiAgcmV0dXJuIHsgY2lyY3VpdDogYywgaWQgfTtcbn1cblxuZXhwb3J0IGNvbnN0IEVNUFRZX0NJUkNVSVQgPSB7IHRpdGxlOiAnVW50aXRsZWQgY2lyY3VpdCcsIGNvbXBvbmVudHM6IFtdLCBjb25uZWN0aW9uczogW10gfTtcbiIsICIvLyBNaW5pbWFsIHNpbmdsZS1wYWdlIFBERiB3cml0ZXIgZW1iZWRkaW5nIGEgbG9zc2xlc3MgKEZsYXRlKSBSR0IgaW1hZ2UuXG4vLyBwb255dGFpbDogcmFzdGVyIFBERiAocmVuZGVyZWQgZnJvbSB0aGUgU1ZHIGF0IGhpZ2ggRFBJKTsgc3dpdGNoIHRvIHN2ZzJwZGYuanNcbi8vIGlmIHRydWUgdmVjdG9yIFBERiBvdXRwdXQgaXMgbmVlZGVkIChpdCBicmluZ3MgZm9udC1lbWJlZGRpbmcgd29yayBmb3IgXHUwM0E5L1x1MDBCNSkuXG5cbmFzeW5jIGZ1bmN0aW9uIGRlZmxhdGUoYnl0ZXMpIHtcbiAgY29uc3QgY3MgPSBuZXcgQ29tcHJlc3Npb25TdHJlYW0oJ2RlZmxhdGUnKTtcbiAgY29uc3Qgc3RyZWFtID0gbmV3IEJsb2IoW2J5dGVzXSkuc3RyZWFtKCkucGlwZVRocm91Z2goY3MpO1xuICByZXR1cm4gbmV3IFVpbnQ4QXJyYXkoYXdhaXQgbmV3IFJlc3BvbnNlKHN0cmVhbSkuYXJyYXlCdWZmZXIoKSk7XG59XG5cbmNvbnN0IGVuYyA9IG5ldyBUZXh0RW5jb2RlcigpO1xuXG4vLyB3aWR0aC9oZWlnaHQ6IHBhZ2Ugc2l6ZSBpbiBwb2ludHM7IHJnYjogVWludDhBcnJheSBvZiBwdypwaCozLlxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGJ1aWxkUERGKHsgd2lkdGgsIGhlaWdodCwgcHcsIHBoLCByZ2IsIHRpdGxlID0gJ0NpcmN1aXRGb3JnZSBzY2hlbWF0aWMnIH0pIHtcbiAgY29uc3QgaW1nID0gYXdhaXQgZGVmbGF0ZShyZ2IpO1xuICBjb25zdCBjaHVua3MgPSBbXTtcbiAgY29uc3Qgb2Zmc2V0cyA9IFtdO1xuICBsZXQgcG9zID0gMDtcbiAgY29uc3QgcHV0ID0gKHgpID0+IHtcbiAgICBjb25zdCBiID0gdHlwZW9mIHggPT09ICdzdHJpbmcnID8gZW5jLmVuY29kZSh4KSA6IHg7XG4gICAgY2h1bmtzLnB1c2goYik7XG4gICAgcG9zICs9IGIubGVuZ3RoO1xuICB9O1xuICBjb25zdCBvYmogPSAobiwgYm9keSkgPT4geyBvZmZzZXRzW25dID0gcG9zOyBwdXQoYCR7bn0gMCBvYmpcXG5gKTsgYm9keSgpOyBwdXQoJ1xcbmVuZG9ialxcbicpOyB9O1xuICBjb25zdCBlc2MgPSAocykgPT4gU3RyaW5nKHMpLnJlcGxhY2UoL1tcXFxcKCldL2csIChjKSA9PiAnXFxcXCcgKyBjKS5yZXBsYWNlKC9bXlxceDIwLVxceDdlXS9nLCAnPycpO1xuICBjb25zdCBXID0gK3dpZHRoLnRvRml4ZWQoMiksIEggPSAraGVpZ2h0LnRvRml4ZWQoMik7XG5cbiAgcHV0KCclUERGLTEuNFxcbiVcXHhFMlxceEUzXFx4Q0ZcXHhEM1xcbicpO1xuICBvYmooMSwgKCkgPT4gcHV0KCc8PCAvVHlwZSAvQ2F0YWxvZyAvUGFnZXMgMiAwIFIgPj4nKSk7XG4gIG9iaigyLCAoKSA9PiBwdXQoJzw8IC9UeXBlIC9QYWdlcyAvS2lkcyBbMyAwIFJdIC9Db3VudCAxID4+JykpO1xuICBvYmooMywgKCkgPT4gcHV0KGA8PCAvVHlwZSAvUGFnZSAvUGFyZW50IDIgMCBSIC9NZWRpYUJveCBbMCAwICR7V30gJHtIfV0gL1Jlc291cmNlcyA8PCAvWE9iamVjdCA8PCAvSW0wIDQgMCBSID4+ID4+IC9Db250ZW50cyA1IDAgUiA+PmApKTtcbiAgb2JqKDQsICgpID0+IHtcbiAgICBwdXQoYDw8IC9UeXBlIC9YT2JqZWN0IC9TdWJ0eXBlIC9JbWFnZSAvV2lkdGggJHtwd30gL0hlaWdodCAke3BofSAvQ29sb3JTcGFjZSAvRGV2aWNlUkdCIC9CaXRzUGVyQ29tcG9uZW50IDggL0ZpbHRlciAvRmxhdGVEZWNvZGUgL0xlbmd0aCAke2ltZy5sZW5ndGh9ID4+XFxuc3RyZWFtXFxuYCk7XG4gICAgcHV0KGltZyk7XG4gICAgcHV0KCdcXG5lbmRzdHJlYW0nKTtcbiAgfSk7XG4gIGNvbnN0IGNvbnRlbnQgPSBgcSAke1d9IDAgMCAke0h9IDAgMCBjbSAvSW0wIERvIFFgO1xuICBvYmooNSwgKCkgPT4gcHV0KGA8PCAvTGVuZ3RoICR7Y29udGVudC5sZW5ndGh9ID4+XFxuc3RyZWFtXFxuJHtjb250ZW50fVxcbmVuZHN0cmVhbWApKTtcbiAgb2JqKDYsICgpID0+IHB1dChgPDwgL1RpdGxlICgke2VzYyh0aXRsZSl9KSAvUHJvZHVjZXIgKENpcmN1aXRGb3JnZSkgPj5gKSk7XG4gIGNvbnN0IHhyZWYgPSBwb3M7XG4gIHB1dChgeHJlZlxcbjAgN1xcbjAwMDAwMDAwMDAgNjU1MzUgZiBcXG5gKTtcbiAgZm9yIChsZXQgaSA9IDE7IGkgPD0gNjsgaSsrKSBwdXQoU3RyaW5nKG9mZnNldHNbaV0pLnBhZFN0YXJ0KDEwLCAnMCcpICsgJyAwMDAwMCBuIFxcbicpO1xuICBwdXQoYHRyYWlsZXJcXG48PCAvU2l6ZSA3IC9Sb290IDEgMCBSIC9JbmZvIDYgMCBSID4+XFxuc3RhcnR4cmVmXFxuJHt4cmVmfVxcbiUlRU9GXFxuYCk7XG5cbiAgY29uc3Qgb3V0ID0gbmV3IFVpbnQ4QXJyYXkocG9zKTtcbiAgbGV0IG8gPSAwO1xuICBmb3IgKGNvbnN0IGMgb2YgY2h1bmtzKSB7IG91dC5zZXQoYywgbyk7IG8gKz0gYy5sZW5ndGg7IH1cbiAgcmV0dXJuIG91dDtcbn1cbiIsICIvLyBCcm93c2VyIGV4cG9ydHMuIFRoZSBTVkcgc3RyaW5nIGlzIHRoZSBzaW5nbGUgc291cmNlIGZvciBldmVyeSBmb3JtYXQuXG5pbXBvcnQgeyBidWlsZFBERiB9IGZyb20gJy4vcGRmLmpzJztcblxuY29uc3QgTUFYX1BJWEVMUyA9IDEyMDAwICogMTIwMDA7XG5cbmV4cG9ydCBmdW5jdGlvbiBzbHVnKHMpIHtcbiAgcmV0dXJuIFN0cmluZyhzIHx8ICdjaXJjdWl0JykudG9Mb3dlckNhc2UoKS5yZXBsYWNlKC9bXmEtejAtOV0rL2csICctJykucmVwbGFjZSgvXi18LSQvZywgJycpIHx8ICdjaXJjdWl0Jztcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGRvd25sb2FkKGRhdGEsIGZpbGVuYW1lLCB0eXBlKSB7XG4gIGNvbnN0IGJsb2IgPSBkYXRhIGluc3RhbmNlb2YgQmxvYiA/IGRhdGEgOiBuZXcgQmxvYihbZGF0YV0sIHsgdHlwZSB9KTtcbiAgY29uc3QgdXJsID0gVVJMLmNyZWF0ZU9iamVjdFVSTChibG9iKTtcbiAgY29uc3QgYSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2EnKTtcbiAgYS5ocmVmID0gdXJsO1xuICBhLmRvd25sb2FkID0gZmlsZW5hbWU7XG4gIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoYSk7XG4gIGEuY2xpY2soKTtcbiAgYS5yZW1vdmUoKTtcbiAgc2V0VGltZW91dCgoKSA9PiBVUkwucmV2b2tlT2JqZWN0VVJMKHVybCksIDEwMDApO1xufVxuXG4vLyBSYXN0ZXJpemUgYW4gU1ZHIHN0cmluZy4gYmFja2dyb3VuZDogQ1NTIGNvbG9yIG9yIG51bGwgZm9yIHRyYW5zcGFyZW50LlxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHN2Z1RvQ2FudmFzKHN2Zywgd2lkdGgsIGhlaWdodCwgc2NhbGUgPSAyLCBiYWNrZ3JvdW5kID0gJyNmZmZmZmYnKSB7XG4gIGNvbnN0IHMgPSBNYXRoLm1pbihzY2FsZSwgTWF0aC5zcXJ0KE1BWF9QSVhFTFMgLyAod2lkdGggKiBoZWlnaHQpKSk7XG4gIGNvbnN0IGNhbnZhcyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2NhbnZhcycpO1xuICBjYW52YXMud2lkdGggPSBNYXRoLm1heCgxLCBNYXRoLnJvdW5kKHdpZHRoICogcykpO1xuICBjYW52YXMuaGVpZ2h0ID0gTWF0aC5tYXgoMSwgTWF0aC5yb3VuZChoZWlnaHQgKiBzKSk7XG4gIGNvbnN0IGN0eCA9IGNhbnZhcy5nZXRDb250ZXh0KCcyZCcpO1xuICBpZiAoYmFja2dyb3VuZCkgeyBjdHguZmlsbFN0eWxlID0gYmFja2dyb3VuZDsgY3R4LmZpbGxSZWN0KDAsIDAsIGNhbnZhcy53aWR0aCwgY2FudmFzLmhlaWdodCk7IH1cbiAgY29uc3QgdXJsID0gVVJMLmNyZWF0ZU9iamVjdFVSTChuZXcgQmxvYihbc3ZnXSwgeyB0eXBlOiAnaW1hZ2Uvc3ZnK3htbDtjaGFyc2V0PXV0Zi04JyB9KSk7XG4gIHRyeSB7XG4gICAgY29uc3QgaW1nID0gbmV3IEltYWdlKCk7XG4gICAgaW1nLmRlY29kaW5nID0gJ3N5bmMnO1xuICAgIGF3YWl0IG5ldyBQcm9taXNlKChyZXMsIHJlaikgPT4geyBpbWcub25sb2FkID0gcmVzOyBpbWcub25lcnJvciA9ICgpID0+IHJlaihuZXcgRXJyb3IoJ0NvdWxkIG5vdCByYXN0ZXJpemUgU1ZHJykpOyBpbWcuc3JjID0gdXJsOyB9KTtcbiAgICBjdHguZHJhd0ltYWdlKGltZywgMCwgMCwgY2FudmFzLndpZHRoLCBjYW52YXMuaGVpZ2h0KTtcbiAgfSBmaW5hbGx5IHtcbiAgICBVUkwucmV2b2tlT2JqZWN0VVJMKHVybCk7XG4gIH1cbiAgcmV0dXJuIGNhbnZhcztcbn1cblxuY29uc3QgY2FudmFzQmxvYiA9IChjYW52YXMsIHR5cGUsIHF1YWxpdHkpID0+XG4gIG5ldyBQcm9taXNlKChyZXMsIHJlaikgPT4gY2FudmFzLnRvQmxvYigoYikgPT4gKGIgPyByZXMoYikgOiByZWoobmV3IEVycm9yKCdFeHBvcnQgZmFpbGVkJykpKSwgdHlwZSwgcXVhbGl0eSkpO1xuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gdG9QTkcoc3ZnLCB3LCBoLCB7IHNjYWxlID0gMiwgdHJhbnNwYXJlbnQgPSBmYWxzZSB9ID0ge30pIHtcbiAgcmV0dXJuIGNhbnZhc0Jsb2IoYXdhaXQgc3ZnVG9DYW52YXMoc3ZnLCB3LCBoLCBzY2FsZSwgdHJhbnNwYXJlbnQgPyBudWxsIDogJyNmZmZmZmYnKSwgJ2ltYWdlL3BuZycpO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gdG9KUEVHKHN2ZywgdywgaCwgeyBzY2FsZSA9IDIsIHF1YWxpdHkgPSAwLjk1IH0gPSB7fSkge1xuICByZXR1cm4gY2FudmFzQmxvYihhd2FpdCBzdmdUb0NhbnZhcyhzdmcsIHcsIGgsIHNjYWxlLCAnI2ZmZmZmZicpLCAnaW1hZ2UvanBlZycsIHF1YWxpdHkpO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gdG9QREYoc3ZnLCB3LCBoLCB7IHNjYWxlID0gNCwgdGl0bGUgfSA9IHt9KSB7XG4gIGNvbnN0IGNhbnZhcyA9IGF3YWl0IHN2Z1RvQ2FudmFzKHN2ZywgdywgaCwgc2NhbGUsICcjZmZmZmZmJyk7XG4gIGNvbnN0IHsgZGF0YSB9ID0gY2FudmFzLmdldENvbnRleHQoJzJkJykuZ2V0SW1hZ2VEYXRhKDAsIDAsIGNhbnZhcy53aWR0aCwgY2FudmFzLmhlaWdodCk7XG4gIGNvbnN0IHJnYiA9IG5ldyBVaW50OEFycmF5KGNhbnZhcy53aWR0aCAqIGNhbnZhcy5oZWlnaHQgKiAzKTtcbiAgZm9yIChsZXQgaSA9IDAsIGogPSAwOyBpIDwgZGF0YS5sZW5ndGg7IGkgKz0gNCwgaiArPSAzKSB7IHJnYltqXSA9IGRhdGFbaV07IHJnYltqICsgMV0gPSBkYXRhW2kgKyAxXTsgcmdiW2ogKyAyXSA9IGRhdGFbaSArIDJdOyB9XG4gIC8vIDEgQ1NTIHB4ID0gMC43NSBwdFxuICBjb25zdCBieXRlcyA9IGF3YWl0IGJ1aWxkUERGKHsgd2lkdGg6IHcgKiAwLjc1LCBoZWlnaHQ6IGggKiAwLjc1LCBwdzogY2FudmFzLndpZHRoLCBwaDogY2FudmFzLmhlaWdodCwgcmdiLCB0aXRsZSB9KTtcbiAgcmV0dXJuIG5ldyBCbG9iKFtieXRlc10sIHsgdHlwZTogJ2FwcGxpY2F0aW9uL3BkZicgfSk7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBjb3B5VGV4dCh0ZXh0KSB7XG4gIGF3YWl0IG5hdmlnYXRvci5jbGlwYm9hcmQud3JpdGVUZXh0KHRleHQpO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gY29weVBORyhzdmcsIHcsIGgsIG9wdHMpIHtcbiAgaWYgKCF3aW5kb3cuQ2xpcGJvYXJkSXRlbSkgdGhyb3cgbmV3IEVycm9yKCdUaGlzIGJyb3dzZXIgY2Fubm90IGNvcHkgaW1hZ2VzIHRvIHRoZSBjbGlwYm9hcmQuJyk7XG4gIC8vIFBhc3MgdGhlIHByb21pc2UgZGlyZWN0bHkgc28gU2FmYXJpIGtlZXBzIHRoZSB1c2VyLWdlc3R1cmUgY29udGV4dC5cbiAgYXdhaXQgbmF2aWdhdG9yLmNsaXBib2FyZC53cml0ZShbbmV3IENsaXBib2FyZEl0ZW0oeyAnaW1hZ2UvcG5nJzogdG9QTkcoc3ZnLCB3LCBoLCBvcHRzKSB9KV0pO1xufVxuIiwgIi8vIFRyYW5zcG9ydC1hZ25vc3RpYyByZXF1ZXN0IGhhbmRsZXIgZm9yIHRoZSBwbGFubmVkIEhUVFAgQVBJLlxuLy8gICBoYW5kbGVSZXF1ZXN0KHsgbWV0aG9kLCBwYXRoLCBoZWFkZXJzLCBib2R5IH0sIHsgYXBpS2V5cyB9KSAtPiB7IHN0YXR1cywgaGVhZGVycywgYm9keSB9XG4vLyBVc2VkIGJ5IHNlcnZlci9zZXJ2ZXIubWpzIChOb2RlKSBhbmQgYnkgdGhlIGluLXBhZ2UgQVBJIGV4cGxvcmVyLlxuaW1wb3J0IHsgcmVuZGVyLCB2YWxpZGF0ZSB9IGZyb20gJy4uL2VuZ2luZS5qcyc7XG5cbmNvbnN0IGpzb24gPSAoc3RhdHVzLCBvYmopID0+ICh7IHN0YXR1cywgaGVhZGVyczogeyAnY29udGVudC10eXBlJzogJ2FwcGxpY2F0aW9uL2pzb247IGNoYXJzZXQ9dXRmLTgnIH0sIGJvZHk6IEpTT04uc3RyaW5naWZ5KG9iaiwgbnVsbCwgMikgfSk7XG5cbmV4cG9ydCBmdW5jdGlvbiBoYW5kbGVSZXF1ZXN0KHJlcSwgeyBhcGlLZXlzID0gbnVsbCB9ID0ge30pIHtcbiAgY29uc3QgcGF0aCA9IChyZXEucGF0aCB8fCAnJykucmVwbGFjZSgvXFwvKyQvLCAnJyk7XG4gIGlmICghWycvYXBpL3YxL3JlbmRlcicsICcvYXBpL3YxL3ZhbGlkYXRlJ10uaW5jbHVkZXMocGF0aCkpIHJldHVybiBqc29uKDQwNCwgeyBlcnJvcjogJ05PVF9GT1VORCcsIG1lc3NhZ2U6IGBObyByb3V0ZSBmb3IgJHtyZXEucGF0aH1gIH0pO1xuICBpZiAocmVxLm1ldGhvZCAhPT0gJ1BPU1QnKSByZXR1cm4ganNvbig0MDUsIHsgZXJyb3I6ICdNRVRIT0RfTk9UX0FMTE9XRUQnLCBtZXNzYWdlOiAnVXNlIFBPU1QuJyB9KTtcbiAgaWYgKGFwaUtleXMgJiYgYXBpS2V5cy5sZW5ndGgpIHtcbiAgICBjb25zdCBhdXRoID0gcmVxLmhlYWRlcnM/LmF1dGhvcml6YXRpb24gfHwgcmVxLmhlYWRlcnM/LkF1dGhvcml6YXRpb24gfHwgJyc7XG4gICAgY29uc3Qga2V5ID0gYXV0aC5yZXBsYWNlKC9eQmVhcmVyXFxzKy9pLCAnJykgfHwgcmVxLmhlYWRlcnM/LlsneC1hcGkta2V5J107XG4gICAgaWYgKCFhcGlLZXlzLmluY2x1ZGVzKGtleSkpIHJldHVybiBqc29uKDQwMSwgeyBlcnJvcjogJ1VOQVVUSE9SSVpFRCcsIG1lc3NhZ2U6ICdNaXNzaW5nIG9yIGludmFsaWQgQVBJIGtleS4nIH0pO1xuICB9XG4gIGxldCBib2R5ID0gcmVxLmJvZHk7XG4gIGlmICh0eXBlb2YgYm9keSA9PT0gJ3N0cmluZycpIHtcbiAgICB0cnkgeyBib2R5ID0gSlNPTi5wYXJzZShib2R5KTsgfSBjYXRjaCAoZSkgeyByZXR1cm4ganNvbig0MDAsIHsgdmFsaWQ6IGZhbHNlLCBlcnJvcnM6IFt7IGNvZGU6ICdJTlZBTElEX0pTT04nLCBtZXNzYWdlOiBgSW52YWxpZCBKU09OIGJvZHk6ICR7ZS5tZXNzYWdlfWAgfV0gfSk7IH1cbiAgfVxuICBpZiAoIWJvZHkgfHwgdHlwZW9mIGJvZHkgIT09ICdvYmplY3QnIHx8ICFib2R5LmNpcmN1aXQpIHJldHVybiBqc29uKDQwMCwgeyB2YWxpZDogZmFsc2UsIGVycm9yczogW3sgY29kZTogJ0lOVkFMSURfUkVRVUVTVCcsIG1lc3NhZ2U6ICdCb2R5IG11c3QgYmUgeyBcImNpcmN1aXRcIjogeyBcdTIwMjYgfSwgXCJmb3JtYXRcIj86IFwic3ZnXCIgfS4nIH1dIH0pO1xuXG4gIGlmIChwYXRoID09PSAnL2FwaS92MS92YWxpZGF0ZScpIHtcbiAgICBjb25zdCB2ID0gdmFsaWRhdGUoYm9keS5jaXJjdWl0KTtcbiAgICByZXR1cm4ganNvbih2LnZhbGlkID8gMjAwIDogNDIyLCB2KTtcbiAgfVxuICBjb25zdCBmb3JtYXQgPSBTdHJpbmcoYm9keS5mb3JtYXQgfHwgJ3N2ZycpLnRvTG93ZXJDYXNlKCk7XG4gIGlmIChmb3JtYXQgPT09ICdwbmcnIHx8IGZvcm1hdCA9PT0gJ3BkZicgfHwgZm9ybWF0ID09PSAnanBlZycpIHtcbiAgICByZXR1cm4ganNvbig1MDEsIHsgZXJyb3I6ICdOT1RfSU1QTEVNRU5URUQnLCBtZXNzYWdlOiBgU2VydmVyLXNpZGUgJHtmb3JtYXQudG9VcHBlckNhc2UoKX0gcmVuZGVyaW5nIGlzIHBsYW5uZWQgKHJlc3ZnLWJhc2VkKS4gUmVuZGVyIFNWRyBhbmQgcmFzdGVyaXplIGNsaWVudC1zaWRlIGZvciBub3cuYCB9KTtcbiAgfVxuICBpZiAoZm9ybWF0ICE9PSAnc3ZnJyAmJiBmb3JtYXQgIT09ICdqc29uJykgcmV0dXJuIGpzb24oNDAwLCB7IGVycm9yOiAnSU5WQUxJRF9GT1JNQVQnLCBtZXNzYWdlOiAnZm9ybWF0IG11c3QgYmUgXCJzdmdcIiBvciBcImpzb25cIi4nIH0pO1xuICBjb25zdCByID0gcmVuZGVyKGJvZHkuY2lyY3VpdCwgeyB0aGVtZTogYm9keS50aGVtZSA9PT0gJ2RhcmsnID8gJ2RhcmsnIDogJ2xpZ2h0JywgYnJpZGdlczogISFib2R5LmJyaWRnZXMsIGJhY2tncm91bmQ6IGJvZHkudHJhbnNwYXJlbnQgPyBudWxsIDogdW5kZWZpbmVkIH0pO1xuICBpZiAoIXIudmFsaWQpIHJldHVybiBqc29uKDQyMiwgeyB2YWxpZDogZmFsc2UsIGVycm9yczogci5lcnJvcnMsIHdhcm5pbmdzOiByLndhcm5pbmdzIH0pO1xuICBpZiAoZm9ybWF0ID09PSAnc3ZnJykgcmV0dXJuIHsgc3RhdHVzOiAyMDAsIGhlYWRlcnM6IHsgJ2NvbnRlbnQtdHlwZSc6ICdpbWFnZS9zdmcreG1sOyBjaGFyc2V0PXV0Zi04JyB9LCBib2R5OiByLnN2ZyB9O1xuICByZXR1cm4ganNvbigyMDAsIHsgdmFsaWQ6IHRydWUsIHdhcm5pbmdzOiByLndhcm5pbmdzLCB3aWR0aDogci53aWR0aCwgaGVpZ2h0OiByLmhlaWdodCwgc3ZnOiByLnN2ZyB9KTtcbn1cbiIsICIvLyBJbnRlcmFjdGl2ZSBjYW52YXM6IHNob3dzIHRoZSByZW5kZXJlZCBTVkcsIGhhbmRsZXMgem9vbS9wYW4sIHNlbGVjdGlvbiBhbmRcbi8vIGRyYWdnaW5nLiBJdCBuZXZlciBlZGl0cyB0aGUgY2lyY3VpdCBpdHNlbGYgXHUyMDE0IGl0IHJlcG9ydHMgaW50ZW50cyB0byB0aGUgYXBwLlxuY29uc3QgTUlOX1pPT00gPSAwLjEsIE1BWF9aT09NID0gODtcblxuZXhwb3J0IGNsYXNzIENhbnZhcyB7XG4gIGNvbnN0cnVjdG9yKGVsLCB2aWV3cG9ydCwgeyBvblNlbGVjdCwgb25EcmFnTW92ZSwgb25EcmFnRW5kLCBvblZpZXdDaGFuZ2UgfSkge1xuICAgIHRoaXMuZWwgPSBlbDtcbiAgICB0aGlzLnZwID0gdmlld3BvcnQ7XG4gICAgdGhpcy5jYiA9IHsgb25TZWxlY3QsIG9uRHJhZ01vdmUsIG9uRHJhZ0VuZCwgb25WaWV3Q2hhbmdlIH07XG4gICAgdGhpcy5zY2FsZSA9IDE7IHRoaXMudHggPSAwOyB0aGlzLnR5ID0gMDtcbiAgICB0aGlzLnZiID0gbnVsbDsgLy8gdmlld0JveCBvZiB0aGUgY3VycmVudCBzdmcge3gseSx3LGh9XG4gICAgdGhpcy5zZWxlY3RlZCA9IG51bGw7XG4gICAgdGhpcy5zcGFjZURvd24gPSBmYWxzZTtcbiAgICB0aGlzLmF1dG9GaXQgPSB0cnVlOyAvLyByZWZpdCBvbiByZXNpemUgdW50aWwgdGhlIHVzZXIgem9vbXMgb3IgcGFuc1xuICAgIHRoaXMuYmluZCgpO1xuICAgIG5ldyBSZXNpemVPYnNlcnZlcigoKSA9PiB7IGlmICh0aGlzLmF1dG9GaXQpIHRoaXMuZml0KCk7IH0pLm9ic2VydmUoZWwpO1xuICB9XG5cbiAgLy8gLS0tLSBjb250ZW50XG4gIHNldFNWRyhzdmcsIHZpZXdCb3gsIHsga2VlcFZpZXcgPSB0cnVlIH0gPSB7fSkge1xuICAgIGlmICh0aGlzLnZiICYmIGtlZXBWaWV3KSB7XG4gICAgICAvLyBrZWVwIHdvcmxkIGNvb3JkaW5hdGVzIGZpeGVkIG9uIHNjcmVlbiB3aGVuIHRoZSBkcmF3aW5nJ3MgYm91bmRzIGNoYW5nZVxuICAgICAgdGhpcy50eCArPSAodmlld0JveC54IC0gdGhpcy52Yi54KSAqIHRoaXMuc2NhbGU7XG4gICAgICB0aGlzLnR5ICs9ICh2aWV3Qm94LnkgLSB0aGlzLnZiLnkpICogdGhpcy5zY2FsZTtcbiAgICB9XG4gICAgdGhpcy52YiA9IHZpZXdCb3g7XG4gICAgdGhpcy52cC5pbm5lckhUTUwgPSBzdmc7XG4gICAgdGhpcy5zdmcgPSB0aGlzLnZwLnF1ZXJ5U2VsZWN0b3IoJ3N2ZycpO1xuICAgIHRoaXMuYXBwbHlTZWxlY3Rpb24oKTtcbiAgICB0aGlzLmFwcGx5KCk7XG4gIH1cblxuICBzZXRTdGFsZShzdGFsZSkgeyB0aGlzLnZwLmNsYXNzTGlzdC50b2dnbGUoJ3N0YWxlJywgc3RhbGUpOyB9XG5cbiAgLy8gLS0tLSB2aWV3IHRyYW5zZm9ybVxuICBhcHBseSgpIHtcbiAgICB0aGlzLnZwLnN0eWxlLnRyYW5zZm9ybSA9IGB0cmFuc2xhdGUoJHt0aGlzLnR4fXB4LCAke3RoaXMudHl9cHgpIHNjYWxlKCR7dGhpcy5zY2FsZX0pYDtcbiAgICBjb25zdCBncyA9IDIwICogdGhpcy5zY2FsZTtcbiAgICBjb25zdCBveCA9IHRoaXMudHggLSAodGhpcy52YiA/IHRoaXMudmIueCA6IDApICogdGhpcy5zY2FsZTtcbiAgICBjb25zdCBveSA9IHRoaXMudHkgLSAodGhpcy52YiA/IHRoaXMudmIueSA6IDApICogdGhpcy5zY2FsZTtcbiAgICB0aGlzLmVsLnN0eWxlLnNldFByb3BlcnR5KCctLWdzJywgYCR7Z3N9cHhgKTtcbiAgICB0aGlzLmVsLnN0eWxlLnNldFByb3BlcnR5KCctLWd4JywgYCR7KChveCAlIGdzKSArIGdzKSAlIGdzfXB4YCk7XG4gICAgdGhpcy5lbC5zdHlsZS5zZXRQcm9wZXJ0eSgnLS1neScsIGAkeygob3kgJSBncykgKyBncykgJSBnc31weGApO1xuICAgIHRoaXMuY2Iub25WaWV3Q2hhbmdlPy4odGhpcy5zY2FsZSk7XG4gIH1cblxuICBmaXQoKSB7XG4gICAgaWYgKCF0aGlzLnZiKSByZXR1cm47XG4gICAgY29uc3QgciA9IHRoaXMuZWwuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG4gICAgY29uc3QgYXZhaWxXID0gTWF0aC5tYXgoMTAwLCByLndpZHRoIC0gNjQpLCBhdmFpbEggPSBNYXRoLm1heCgxMDAsIHIuaGVpZ2h0IC0gMTIwKTtcbiAgICB0aGlzLnNjYWxlID0gTWF0aC5taW4oYXZhaWxXIC8gdGhpcy52Yi53LCBhdmFpbEggLyB0aGlzLnZiLmgsIDIuNSk7XG4gICAgdGhpcy50eCA9IChyLndpZHRoIC0gdGhpcy52Yi53ICogdGhpcy5zY2FsZSkgLyAyO1xuICAgIHRoaXMudHkgPSAoci5oZWlnaHQgLSA1NiAtIHRoaXMudmIuaCAqIHRoaXMuc2NhbGUpIC8gMjtcbiAgICB0aGlzLmF1dG9GaXQgPSB0cnVlO1xuICAgIHRoaXMuYXBwbHkoKTtcbiAgfVxuXG4gIHpvb21BdChmYWN0b3IsIHB4LCBweSkge1xuICAgIGNvbnN0IHIgPSB0aGlzLmVsLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuICAgIGlmIChweCA9PT0gdW5kZWZpbmVkKSB7IHB4ID0gci53aWR0aCAvIDI7IHB5ID0gci5oZWlnaHQgLyAyOyB9XG4gICAgdGhpcy5hdXRvRml0ID0gZmFsc2U7XG4gICAgY29uc3QgcyA9IE1hdGgubWluKE1BWF9aT09NLCBNYXRoLm1heChNSU5fWk9PTSwgdGhpcy5zY2FsZSAqIGZhY3RvcikpO1xuICAgIHRoaXMudHggPSBweCAtIChweCAtIHRoaXMudHgpICogKHMgLyB0aGlzLnNjYWxlKTtcbiAgICB0aGlzLnR5ID0gcHkgLSAocHkgLSB0aGlzLnR5KSAqIChzIC8gdGhpcy5zY2FsZSk7XG4gICAgdGhpcy5zY2FsZSA9IHM7XG4gICAgdGhpcy5hcHBseSgpO1xuICB9XG5cbiAgem9vbVRvKHMpIHsgdGhpcy56b29tQXQocyAvIHRoaXMuc2NhbGUpOyB9XG5cbiAgdG9Xb3JsZChjbGllbnRYLCBjbGllbnRZKSB7XG4gICAgY29uc3QgciA9IHRoaXMuZWwuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG4gICAgcmV0dXJuIHtcbiAgICAgIHg6IChjbGllbnRYIC0gci5sZWZ0IC0gdGhpcy50eCkgLyB0aGlzLnNjYWxlICsgKHRoaXMudmIgPyB0aGlzLnZiLnggOiAwKSxcbiAgICAgIHk6IChjbGllbnRZIC0gci50b3AgLSB0aGlzLnR5KSAvIHRoaXMuc2NhbGUgKyAodGhpcy52YiA/IHRoaXMudmIueSA6IDApLFxuICAgIH07XG4gIH1cblxuICAvLyAtLS0tIHNlbGVjdGlvblxuICBzZWxlY3QoaWQpIHtcbiAgICB0aGlzLnNlbGVjdGVkID0gaWQ7XG4gICAgdGhpcy5hcHBseVNlbGVjdGlvbigpO1xuICB9XG5cbiAgYXBwbHlTZWxlY3Rpb24oKSB7XG4gICAgaWYgKCF0aGlzLnN2ZykgcmV0dXJuO1xuICAgIHRoaXMuc3ZnLnF1ZXJ5U2VsZWN0b3JBbGwoJy5zZWxlY3RlZCcpLmZvckVhY2goKG4pID0+IG4uY2xhc3NMaXN0LnJlbW92ZSgnc2VsZWN0ZWQnKSk7XG4gICAgdGhpcy5zdmcucXVlcnlTZWxlY3RvcignLnNlbC1ib3gnKT8ucmVtb3ZlKCk7XG4gICAgaWYgKCF0aGlzLnNlbGVjdGVkKSByZXR1cm47XG4gICAgY29uc3QgZXNjID0gQ1NTLmVzY2FwZSh0aGlzLnNlbGVjdGVkKTtcbiAgICBjb25zdCBwYXJ0ID0gdGhpcy5zdmcucXVlcnlTZWxlY3RvcihgLmNmLXBhcnRbZGF0YS1pZD1cIiR7ZXNjfVwiXWApO1xuICAgIGlmICghcGFydCkgcmV0dXJuO1xuICAgIHBhcnQuY2xhc3NMaXN0LmFkZCgnc2VsZWN0ZWQnKTtcbiAgICB0aGlzLnN2Zy5xdWVyeVNlbGVjdG9yKGAuY2YtbGFiZWxzW2RhdGEtZm9yPVwiJHtlc2N9XCJdYCk/LmNsYXNzTGlzdC5hZGQoJ3NlbGVjdGVkJyk7XG4gICAgY29uc3QgYiA9IHBhcnQuZ2V0QkJveCgpO1xuICAgIGNvbnN0IG0gPSBwYXJ0LnRyYW5zZm9ybS5iYXNlVmFsLmNvbnNvbGlkYXRlKCk/Lm1hdHJpeDtcbiAgICBpZiAoIW0pIHJldHVybjtcbiAgICBjb25zdCBwdHMgPSBbW2IueCwgYi55XSwgW2IueCArIGIud2lkdGgsIGIueV0sIFtiLngsIGIueSArIGIuaGVpZ2h0XSwgW2IueCArIGIud2lkdGgsIGIueSArIGIuaGVpZ2h0XV1cbiAgICAgIC5tYXAoKFt4LCB5XSkgPT4gW20uYSAqIHggKyBtLmMgKiB5ICsgbS5lLCBtLmIgKiB4ICsgbS5kICogeSArIG0uZl0pO1xuICAgIGNvbnN0IHhzID0gcHRzLm1hcCgocCkgPT4gcFswXSksIHlzID0gcHRzLm1hcCgocCkgPT4gcFsxXSk7XG4gICAgY29uc3QgcmVjdCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnROUygnaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnLCAncmVjdCcpO1xuICAgIHJlY3Quc2V0QXR0cmlidXRlKCdjbGFzcycsICdzZWwtYm94Jyk7XG4gICAgcmVjdC5zZXRBdHRyaWJ1dGUoJ3gnLCBNYXRoLm1pbiguLi54cykgLSA1KTtcbiAgICByZWN0LnNldEF0dHJpYnV0ZSgneScsIE1hdGgubWluKC4uLnlzKSAtIDUpO1xuICAgIHJlY3Quc2V0QXR0cmlidXRlKCd3aWR0aCcsIE1hdGgubWF4KC4uLnhzKSAtIE1hdGgubWluKC4uLnhzKSArIDEwKTtcbiAgICByZWN0LnNldEF0dHJpYnV0ZSgnaGVpZ2h0JywgTWF0aC5tYXgoLi4ueXMpIC0gTWF0aC5taW4oLi4ueXMpICsgMTApO1xuICAgIHJlY3Quc2V0QXR0cmlidXRlKCdyeCcsIDMpO1xuICAgIHRoaXMuc3ZnLmluc2VydEJlZm9yZShyZWN0LCB0aGlzLnN2Zy5xdWVyeVNlbGVjdG9yKCcjY29tcG9uZW50cycpKTtcbiAgfVxuXG4gIC8vIC0tLS0gaW5wdXRcbiAgYmluZCgpIHtcbiAgICBjb25zdCBlbCA9IHRoaXMuZWw7XG4gICAgZWwuYWRkRXZlbnRMaXN0ZW5lcignd2hlZWwnLCAoZSkgPT4ge1xuICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgY29uc3QgciA9IGVsLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuICAgICAgaWYgKGUuY3RybEtleSB8fCBlLm1ldGFLZXkgfHwgIWUuc2hpZnRLZXkpIHtcbiAgICAgICAgY29uc3QgZiA9IE1hdGguZXhwKC1lLmRlbHRhWSAqIChlLmN0cmxLZXkgPyAwLjAxIDogMC4wMDE1KSk7XG4gICAgICAgIHRoaXMuem9vbUF0KGYsIGUuY2xpZW50WCAtIHIubGVmdCwgZS5jbGllbnRZIC0gci50b3ApO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5hdXRvRml0ID0gZmFsc2U7XG4gICAgICAgIHRoaXMudHggLT0gZS5kZWx0YVggfHwgZS5kZWx0YVk7XG4gICAgICAgIHRoaXMuYXBwbHkoKTtcbiAgICAgIH1cbiAgICB9LCB7IHBhc3NpdmU6IGZhbHNlIH0pO1xuXG4gICAgbGV0IGRyYWcgPSBudWxsO1xuICAgIGVsLmFkZEV2ZW50TGlzdGVuZXIoJ3BvaW50ZXJkb3duJywgKGUpID0+IHtcbiAgICAgIGlmIChlLmJ1dHRvbiAhPT0gMCAmJiBlLmJ1dHRvbiAhPT0gMSkgcmV0dXJuO1xuICAgICAgZWwuZm9jdXMoeyBwcmV2ZW50U2Nyb2xsOiB0cnVlIH0pO1xuICAgICAgY29uc3QgcGFydCA9IGUudGFyZ2V0LmNsb3Nlc3Q/LignLmNmLXBhcnQnKTtcbiAgICAgIGNvbnN0IGxhYmVscyA9IGUudGFyZ2V0LmNsb3Nlc3Q/LignLmNmLWxhYmVscycpO1xuICAgICAgY29uc3QgaWQgPSBwYXJ0Py5kYXRhc2V0LmlkIHx8IGxhYmVscz8uZGF0YXNldC5mb3I7XG4gICAgICBjb25zdCBwYW4gPSBlLmJ1dHRvbiA9PT0gMSB8fCB0aGlzLnNwYWNlRG93biB8fCAhaWQ7XG4gICAgICBkcmFnID0geyBwYW4sIGlkLCB4MDogZS5jbGllbnRYLCB5MDogZS5jbGllbnRZLCB0eDA6IHRoaXMudHgsIHR5MDogdGhpcy50eSwgdzA6IHRoaXMudG9Xb3JsZChlLmNsaWVudFgsIGUuY2xpZW50WSksIG1vdmVkOiBmYWxzZSB9O1xuICAgICAgZWwuc2V0UG9pbnRlckNhcHR1cmUoZS5wb2ludGVySWQpO1xuICAgICAgaWYgKCFwYW4pIHtcbiAgICAgICAgdGhpcy5jYi5vblNlbGVjdChpZCk7XG4gICAgICB9XG4gICAgICBpZiAocGFuKSBlbC5jbGFzc0xpc3QuYWRkKCdwYW5uaW5nJyk7XG4gICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgfSk7XG4gICAgZWwuYWRkRXZlbnRMaXN0ZW5lcigncG9pbnRlcm1vdmUnLCAoZSkgPT4ge1xuICAgICAgaWYgKCFkcmFnKSByZXR1cm47XG4gICAgICBjb25zdCBkeCA9IGUuY2xpZW50WCAtIGRyYWcueDAsIGR5ID0gZS5jbGllbnRZIC0gZHJhZy55MDtcbiAgICAgIGlmICghZHJhZy5tb3ZlZCAmJiBNYXRoLmh5cG90KGR4LCBkeSkgPCAzKSByZXR1cm47XG4gICAgICBkcmFnLm1vdmVkID0gdHJ1ZTtcbiAgICAgIGlmIChkcmFnLnBhbikge1xuICAgICAgICB0aGlzLmF1dG9GaXQgPSBmYWxzZTtcbiAgICAgICAgdGhpcy50eCA9IGRyYWcudHgwICsgZHg7IHRoaXMudHkgPSBkcmFnLnR5MCArIGR5O1xuICAgICAgICB0aGlzLmFwcGx5KCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zdCB3ID0gdGhpcy50b1dvcmxkKGUuY2xpZW50WCwgZS5jbGllbnRZKTtcbiAgICAgICAgdGhpcy52cC5jbGFzc0xpc3QuYWRkKCdkcmFnZ2luZycpO1xuICAgICAgICB0aGlzLmNiLm9uRHJhZ01vdmUoZHJhZy5pZCwgdy54IC0gZHJhZy53MC54LCB3LnkgLSBkcmFnLncwLnkpO1xuICAgICAgfVxuICAgIH0pO1xuICAgIGNvbnN0IGVuZCA9IChlKSA9PiB7XG4gICAgICBpZiAoIWRyYWcpIHJldHVybjtcbiAgICAgIGVsLmNsYXNzTGlzdC5yZW1vdmUoJ3Bhbm5pbmcnKTtcbiAgICAgIHRoaXMudnAuY2xhc3NMaXN0LnJlbW92ZSgnZHJhZ2dpbmcnKTtcbiAgICAgIGlmIChkcmFnLnBhbiAmJiAhZHJhZy5tb3ZlZCAmJiBlLnR5cGUgPT09ICdwb2ludGVydXAnKSB0aGlzLmNiLm9uU2VsZWN0KG51bGwpO1xuICAgICAgaWYgKCFkcmFnLnBhbiAmJiBkcmFnLm1vdmVkKSB0aGlzLmNiLm9uRHJhZ0VuZChkcmFnLmlkLCBlLnR5cGUgPT09ICdwb2ludGVyY2FuY2VsJyk7XG4gICAgICBkcmFnID0gbnVsbDtcbiAgICB9O1xuICAgIGVsLmFkZEV2ZW50TGlzdGVuZXIoJ3BvaW50ZXJ1cCcsIGVuZCk7XG4gICAgZWwuYWRkRXZlbnRMaXN0ZW5lcigncG9pbnRlcmNhbmNlbCcsIGVuZCk7XG4gIH1cbn1cbiIsICJ7XG4gIFwidGl0bGVcIjogXCJWb2x0YWdlIERpdmlkZXJcIixcbiAgXCJjb21wb25lbnRzXCI6IFtcbiAgICB7XG4gICAgICBcImlkXCI6IFwiVjFcIixcbiAgICAgIFwidHlwZVwiOiBcImRjX3NvdXJjZVwiLFxuICAgICAgXCJ2YWx1ZVwiOiBcIjEwVlwiXG4gICAgfSxcbiAgICB7XG4gICAgICBcImlkXCI6IFwiUjFcIixcbiAgICAgIFwidHlwZVwiOiBcInJlc2lzdG9yXCIsXG4gICAgICBcInZhbHVlXCI6IFwiMWtcdTAzQTlcIlxuICAgIH0sXG4gICAge1xuICAgICAgXCJpZFwiOiBcIlIyXCIsXG4gICAgICBcInR5cGVcIjogXCJyZXNpc3RvclwiLFxuICAgICAgXCJ2YWx1ZVwiOiBcIjJrXHUwM0E5XCJcbiAgICB9XG4gIF0sXG4gIFwiY29ubmVjdGlvbnNcIjogW1xuICAgIFtcbiAgICAgIFwiVjEucG9zaXRpdmVcIixcbiAgICAgIFwiUjEuMVwiXG4gICAgXSxcbiAgICBbXG4gICAgICBcIlIxLjJcIixcbiAgICAgIFwiUjIuMVwiXG4gICAgXSxcbiAgICBbXG4gICAgICBcIlIyLjJcIixcbiAgICAgIFwiVjEubmVnYXRpdmVcIlxuICAgIF1cbiAgXVxufVxuIiwgIntcbiAgXCJ0aXRsZVwiOiBcIkxFRCB3aXRoIEN1cnJlbnQtTGltaXRpbmcgUmVzaXN0b3JcIixcbiAgXCJjb21wb25lbnRzXCI6IFtcbiAgICB7XG4gICAgICBcImlkXCI6IFwiVjFcIixcbiAgICAgIFwidHlwZVwiOiBcImRjX3NvdXJjZVwiLFxuICAgICAgXCJ2YWx1ZVwiOiBcIjVWXCJcbiAgICB9LFxuICAgIHtcbiAgICAgIFwiaWRcIjogXCJSMVwiLFxuICAgICAgXCJ0eXBlXCI6IFwicmVzaXN0b3JcIixcbiAgICAgIFwidmFsdWVcIjogXCIzMzBcdTAzQTlcIlxuICAgIH0sXG4gICAge1xuICAgICAgXCJpZFwiOiBcIkQxXCIsXG4gICAgICBcInR5cGVcIjogXCJsZWRcIixcbiAgICAgIFwidmFsdWVcIjogXCJSZWRcIlxuICAgIH0sXG4gICAge1xuICAgICAgXCJpZFwiOiBcIkdORFwiLFxuICAgICAgXCJ0eXBlXCI6IFwiZ3JvdW5kXCJcbiAgICB9XG4gIF0sXG4gIFwiY29ubmVjdGlvbnNcIjogW1xuICAgIFtcbiAgICAgIFwiVjEucG9zaXRpdmVcIixcbiAgICAgIFwiUjEuMVwiXG4gICAgXSxcbiAgICBbXG4gICAgICBcIlIxLjJcIixcbiAgICAgIFwiRDEuYW5vZGVcIlxuICAgIF0sXG4gICAgW1xuICAgICAgXCJEMS5jYXRob2RlXCIsXG4gICAgICBcIkdORFwiXG4gICAgXSxcbiAgICBbXG4gICAgICBcIlYxLm5lZ2F0aXZlXCIsXG4gICAgICBcIkdORFwiXG4gICAgXVxuICBdXG59XG4iLCAie1xuICBcInRpdGxlXCI6IFwiUkMgTG93LVBhc3MgRmlsdGVyXCIsXG4gIFwiY29tcG9uZW50c1wiOiBbXG4gICAge1xuICAgICAgXCJpZFwiOiBcIlYxXCIsXG4gICAgICBcInR5cGVcIjogXCJhY19zb3VyY2VcIixcbiAgICAgIFwidmFsdWVcIjogXCIxViAxa0h6XCJcbiAgICB9LFxuICAgIHtcbiAgICAgIFwiaWRcIjogXCJSMVwiLFxuICAgICAgXCJ0eXBlXCI6IFwicmVzaXN0b3JcIixcbiAgICAgIFwidmFsdWVcIjogXCIxa1x1MDNBOVwiXG4gICAgfSxcbiAgICB7XG4gICAgICBcImlkXCI6IFwiQzFcIixcbiAgICAgIFwidHlwZVwiOiBcImNhcGFjaXRvclwiLFxuICAgICAgXCJ2YWx1ZVwiOiBcIjEwMG5GXCJcbiAgICB9LFxuICAgIHtcbiAgICAgIFwiaWRcIjogXCJWT1VUXCIsXG4gICAgICBcInR5cGVcIjogXCJvdXRwdXRcIlxuICAgIH0sXG4gICAge1xuICAgICAgXCJpZFwiOiBcIkdORFwiLFxuICAgICAgXCJ0eXBlXCI6IFwiZ3JvdW5kXCJcbiAgICB9XG4gIF0sXG4gIFwiY29ubmVjdGlvbnNcIjogW1xuICAgIFtcbiAgICAgIFwiVjEucG9zaXRpdmVcIixcbiAgICAgIFwiUjEuMVwiXG4gICAgXSxcbiAgICBbXG4gICAgICBcIlIxLjJcIixcbiAgICAgIFwiQzEuMVwiLFxuICAgICAgXCJWT1VUXCJcbiAgICBdLFxuICAgIFtcbiAgICAgIFwiQzEuMlwiLFxuICAgICAgXCJHTkRcIlxuICAgIF0sXG4gICAgW1xuICAgICAgXCJWMS5uZWdhdGl2ZVwiLFxuICAgICAgXCJHTkRcIlxuICAgIF1cbiAgXVxufVxuIiwgIntcbiAgXCJ0aXRsZVwiOiBcIlJMIENpcmN1aXRcIixcbiAgXCJjb21wb25lbnRzXCI6IFtcbiAgICB7XG4gICAgICBcImlkXCI6IFwiVjFcIixcbiAgICAgIFwidHlwZVwiOiBcImRjX3NvdXJjZVwiLFxuICAgICAgXCJ2YWx1ZVwiOiBcIjEyVlwiXG4gICAgfSxcbiAgICB7XG4gICAgICBcImlkXCI6IFwiU1cxXCIsXG4gICAgICBcInR5cGVcIjogXCJzd2l0Y2hcIlxuICAgIH0sXG4gICAge1xuICAgICAgXCJpZFwiOiBcIlIxXCIsXG4gICAgICBcInR5cGVcIjogXCJyZXNpc3RvclwiLFxuICAgICAgXCJ2YWx1ZVwiOiBcIjEwMFx1MDNBOVwiXG4gICAgfSxcbiAgICB7XG4gICAgICBcImlkXCI6IFwiTDFcIixcbiAgICAgIFwidHlwZVwiOiBcImluZHVjdG9yXCIsXG4gICAgICBcInZhbHVlXCI6IFwiMTBtSFwiXG4gICAgfSxcbiAgICB7XG4gICAgICBcImlkXCI6IFwiR05EXCIsXG4gICAgICBcInR5cGVcIjogXCJncm91bmRcIlxuICAgIH1cbiAgXSxcbiAgXCJjb25uZWN0aW9uc1wiOiBbXG4gICAgW1xuICAgICAgXCJWMS5wb3NpdGl2ZVwiLFxuICAgICAgXCJTVzEuMVwiXG4gICAgXSxcbiAgICBbXG4gICAgICBcIlNXMS4yXCIsXG4gICAgICBcIlIxLjFcIlxuICAgIF0sXG4gICAgW1xuICAgICAgXCJSMS4yXCIsXG4gICAgICBcIkwxLjFcIlxuICAgIF0sXG4gICAgW1xuICAgICAgXCJMMS4yXCIsXG4gICAgICBcIkdORFwiXG4gICAgXSxcbiAgICBbXG4gICAgICBcIlYxLm5lZ2F0aXZlXCIsXG4gICAgICBcIkdORFwiXG4gICAgXVxuICBdXG59XG4iLCAie1xuICBcInRpdGxlXCI6IFwiU2VyaWVzIFJMQyBDaXJjdWl0XCIsXG4gIFwiY29tcG9uZW50c1wiOiBbXG4gICAge1xuICAgICAgXCJpZFwiOiBcIlYxXCIsXG4gICAgICBcInR5cGVcIjogXCJhY19zb3VyY2VcIixcbiAgICAgIFwidmFsdWVcIjogXCI1ViAxMGtIelwiXG4gICAgfSxcbiAgICB7XG4gICAgICBcImlkXCI6IFwiUjFcIixcbiAgICAgIFwidHlwZVwiOiBcInJlc2lzdG9yXCIsXG4gICAgICBcInZhbHVlXCI6IFwiNTBcdTAzQTlcIlxuICAgIH0sXG4gICAge1xuICAgICAgXCJpZFwiOiBcIkwxXCIsXG4gICAgICBcInR5cGVcIjogXCJpbmR1Y3RvclwiLFxuICAgICAgXCJ2YWx1ZVwiOiBcIjFtSFwiXG4gICAgfSxcbiAgICB7XG4gICAgICBcImlkXCI6IFwiQzFcIixcbiAgICAgIFwidHlwZVwiOiBcImNhcGFjaXRvclwiLFxuICAgICAgXCJ2YWx1ZVwiOiBcIjIyMG5GXCJcbiAgICB9XG4gIF0sXG4gIFwiY29ubmVjdGlvbnNcIjogW1xuICAgIFtcbiAgICAgIFwiVjEucG9zaXRpdmVcIixcbiAgICAgIFwiUjEuMVwiXG4gICAgXSxcbiAgICBbXG4gICAgICBcIlIxLjJcIixcbiAgICAgIFwiTDEuMVwiXG4gICAgXSxcbiAgICBbXG4gICAgICBcIkwxLjJcIixcbiAgICAgIFwiQzEuMVwiXG4gICAgXSxcbiAgICBbXG4gICAgICBcIkMxLjJcIixcbiAgICAgIFwiVjEubmVnYXRpdmVcIlxuICAgIF1cbiAgXVxufVxuIiwgIntcbiAgXCJ0aXRsZVwiOiBcIkhhbGYtV2F2ZSBSZWN0aWZpZXIgd2l0aCBGaWx0ZXJcIixcbiAgXCJjb21wb25lbnRzXCI6IFtcbiAgICB7XG4gICAgICBcImlkXCI6IFwiVjFcIixcbiAgICAgIFwidHlwZVwiOiBcImFjX3NvdXJjZVwiLFxuICAgICAgXCJ2YWx1ZVwiOiBcIjEyViA1MEh6XCJcbiAgICB9LFxuICAgIHtcbiAgICAgIFwiaWRcIjogXCJEMVwiLFxuICAgICAgXCJ0eXBlXCI6IFwiZGlvZGVcIixcbiAgICAgIFwidmFsdWVcIjogXCIxTjQwMDdcIlxuICAgIH0sXG4gICAge1xuICAgICAgXCJpZFwiOiBcIkMxXCIsXG4gICAgICBcInR5cGVcIjogXCJjYXBhY2l0b3JfcG9sYXJpemVkXCIsXG4gICAgICBcInZhbHVlXCI6IFwiNDcwXHUwMEI1RlwiXG4gICAgfSxcbiAgICB7XG4gICAgICBcImlkXCI6IFwiUkxcIixcbiAgICAgIFwidHlwZVwiOiBcInJlc2lzdG9yXCIsXG4gICAgICBcInZhbHVlXCI6IFwiMWtcdTAzQTlcIlxuICAgIH0sXG4gICAge1xuICAgICAgXCJpZFwiOiBcIlZPVVRcIixcbiAgICAgIFwidHlwZVwiOiBcIm91dHB1dFwiXG4gICAgfSxcbiAgICB7XG4gICAgICBcImlkXCI6IFwiR05EXCIsXG4gICAgICBcInR5cGVcIjogXCJncm91bmRcIlxuICAgIH1cbiAgXSxcbiAgXCJjb25uZWN0aW9uc1wiOiBbXG4gICAgW1xuICAgICAgXCJWMS5wb3NpdGl2ZVwiLFxuICAgICAgXCJEMS5hbm9kZVwiXG4gICAgXSxcbiAgICBbXG4gICAgICBcIkQxLmNhdGhvZGVcIixcbiAgICAgIFwiQzEucG9zaXRpdmVcIixcbiAgICAgIFwiUkwuMVwiLFxuICAgICAgXCJWT1VUXCJcbiAgICBdLFxuICAgIFtcbiAgICAgIFwiQzEubmVnYXRpdmVcIixcbiAgICAgIFwiR05EXCJcbiAgICBdLFxuICAgIFtcbiAgICAgIFwiUkwuMlwiLFxuICAgICAgXCJHTkRcIlxuICAgIF0sXG4gICAgW1xuICAgICAgXCJWMS5uZWdhdGl2ZVwiLFxuICAgICAgXCJHTkRcIlxuICAgIF1cbiAgXVxufVxuIiwgIntcbiAgXCJ0aXRsZVwiOiBcIkNvbW1vbi1FbWl0dGVyIEJKVCBBbXBsaWZpZXJcIixcbiAgXCJjb21wb25lbnRzXCI6IFtcbiAgICB7XG4gICAgICBcImlkXCI6IFwiVklOXCIsXG4gICAgICBcInR5cGVcIjogXCJhY19zb3VyY2VcIixcbiAgICAgIFwidmFsdWVcIjogXCIxMG1WXCJcbiAgICB9LFxuICAgIHtcbiAgICAgIFwiaWRcIjogXCJDMVwiLFxuICAgICAgXCJ0eXBlXCI6IFwiY2FwYWNpdG9yXCIsXG4gICAgICBcInZhbHVlXCI6IFwiMTBcdTAwQjVGXCJcbiAgICB9LFxuICAgIHtcbiAgICAgIFwiaWRcIjogXCJSMVwiLFxuICAgICAgXCJ0eXBlXCI6IFwicmVzaXN0b3JcIixcbiAgICAgIFwidmFsdWVcIjogXCI0N2tcdTAzQTlcIlxuICAgIH0sXG4gICAge1xuICAgICAgXCJpZFwiOiBcIlIyXCIsXG4gICAgICBcInR5cGVcIjogXCJyZXNpc3RvclwiLFxuICAgICAgXCJ2YWx1ZVwiOiBcIjEwa1x1MDNBOVwiXG4gICAgfSxcbiAgICB7XG4gICAgICBcImlkXCI6IFwiUTFcIixcbiAgICAgIFwidHlwZVwiOiBcIm5wblwiLFxuICAgICAgXCJ2YWx1ZVwiOiBcIjJOMzkwNFwiXG4gICAgfSxcbiAgICB7XG4gICAgICBcImlkXCI6IFwiUkNcIixcbiAgICAgIFwidHlwZVwiOiBcInJlc2lzdG9yXCIsXG4gICAgICBcInZhbHVlXCI6IFwiNC43a1x1MDNBOVwiXG4gICAgfSxcbiAgICB7XG4gICAgICBcImlkXCI6IFwiUkVcIixcbiAgICAgIFwidHlwZVwiOiBcInJlc2lzdG9yXCIsXG4gICAgICBcInZhbHVlXCI6IFwiMWtcdTAzQTlcIlxuICAgIH0sXG4gICAge1xuICAgICAgXCJpZFwiOiBcIkMyXCIsXG4gICAgICBcInR5cGVcIjogXCJjYXBhY2l0b3JcIixcbiAgICAgIFwidmFsdWVcIjogXCIxMFx1MDBCNUZcIlxuICAgIH0sXG4gICAge1xuICAgICAgXCJpZFwiOiBcIlJMXCIsXG4gICAgICBcInR5cGVcIjogXCJyZXNpc3RvclwiLFxuICAgICAgXCJ2YWx1ZVwiOiBcIjEwa1x1MDNBOVwiXG4gICAgfSxcbiAgICB7XG4gICAgICBcImlkXCI6IFwiVkNDXCIsXG4gICAgICBcInR5cGVcIjogXCJ2Y2NcIixcbiAgICAgIFwidmFsdWVcIjogXCIrMTJWXCJcbiAgICB9LFxuICAgIHtcbiAgICAgIFwiaWRcIjogXCJHTkRcIixcbiAgICAgIFwidHlwZVwiOiBcImdyb3VuZFwiXG4gICAgfVxuICBdLFxuICBcImNvbm5lY3Rpb25zXCI6IFtcbiAgICBbXG4gICAgICBcIlZJTi5wb3NpdGl2ZVwiLFxuICAgICAgXCJDMS4xXCJcbiAgICBdLFxuICAgIFtcbiAgICAgIFwiQzEuMlwiLFxuICAgICAgXCJSMS4yXCIsXG4gICAgICBcIlIyLjFcIixcbiAgICAgIFwiUTEuQlwiXG4gICAgXSxcbiAgICBbXG4gICAgICBcIlIxLjFcIixcbiAgICAgIFwiVkNDXCJcbiAgICBdLFxuICAgIFtcbiAgICAgIFwiUjIuMlwiLFxuICAgICAgXCJHTkRcIlxuICAgIF0sXG4gICAgW1xuICAgICAgXCJRMS5DXCIsXG4gICAgICBcIlJDLjJcIixcbiAgICAgIFwiQzIuMVwiXG4gICAgXSxcbiAgICBbXG4gICAgICBcIlJDLjFcIixcbiAgICAgIFwiVkNDXCJcbiAgICBdLFxuICAgIFtcbiAgICAgIFwiUTEuRVwiLFxuICAgICAgXCJSRS4xXCJcbiAgICBdLFxuICAgIFtcbiAgICAgIFwiUkUuMlwiLFxuICAgICAgXCJHTkRcIlxuICAgIF0sXG4gICAgW1xuICAgICAgXCJDMi4yXCIsXG4gICAgICBcIlJMLjFcIlxuICAgIF0sXG4gICAgW1xuICAgICAgXCJSTC4yXCIsXG4gICAgICBcIkdORFwiXG4gICAgXSxcbiAgICBbXG4gICAgICBcIlZJTi5uZWdhdGl2ZVwiLFxuICAgICAgXCJHTkRcIlxuICAgIF1cbiAgXVxufVxuIiwgIntcbiAgXCJ0aXRsZVwiOiBcIk4tTU9TRkVUIExvdy1TaWRlIExFRCBEcml2ZXJcIixcbiAgXCJjb21wb25lbnRzXCI6IFtcbiAgICB7XG4gICAgICBcImlkXCI6IFwiUFdNXCIsXG4gICAgICBcInR5cGVcIjogXCJpbnB1dFwiXG4gICAgfSxcbiAgICB7XG4gICAgICBcImlkXCI6IFwiUkdcIixcbiAgICAgIFwidHlwZVwiOiBcInJlc2lzdG9yXCIsXG4gICAgICBcInZhbHVlXCI6IFwiMTAwXHUwM0E5XCJcbiAgICB9LFxuICAgIHtcbiAgICAgIFwiaWRcIjogXCJSUERcIixcbiAgICAgIFwidHlwZVwiOiBcInJlc2lzdG9yXCIsXG4gICAgICBcInZhbHVlXCI6IFwiMTBrXHUwM0E5XCJcbiAgICB9LFxuICAgIHtcbiAgICAgIFwiaWRcIjogXCJRMVwiLFxuICAgICAgXCJ0eXBlXCI6IFwibm1vc1wiLFxuICAgICAgXCJ2YWx1ZVwiOiBcIklSTFo0NE5cIlxuICAgIH0sXG4gICAge1xuICAgICAgXCJpZFwiOiBcIlJMXCIsXG4gICAgICBcInR5cGVcIjogXCJyZXNpc3RvclwiLFxuICAgICAgXCJ2YWx1ZVwiOiBcIjIyMFx1MDNBOVwiXG4gICAgfSxcbiAgICB7XG4gICAgICBcImlkXCI6IFwiRDFcIixcbiAgICAgIFwidHlwZVwiOiBcImxlZFwiLFxuICAgICAgXCJ2YWx1ZVwiOiBcIkxvYWRcIlxuICAgIH0sXG4gICAge1xuICAgICAgXCJpZFwiOiBcIlZDQ1wiLFxuICAgICAgXCJ0eXBlXCI6IFwidmNjXCIsXG4gICAgICBcInZhbHVlXCI6IFwiKzEyVlwiXG4gICAgfSxcbiAgICB7XG4gICAgICBcImlkXCI6IFwiR05EXCIsXG4gICAgICBcInR5cGVcIjogXCJncm91bmRcIlxuICAgIH1cbiAgXSxcbiAgXCJjb25uZWN0aW9uc1wiOiBbXG4gICAgW1xuICAgICAgXCJQV01cIixcbiAgICAgIFwiUkcuMVwiXG4gICAgXSxcbiAgICBbXG4gICAgICBcIlJHLjJcIixcbiAgICAgIFwiUTEuR1wiLFxuICAgICAgXCJSUEQuMVwiXG4gICAgXSxcbiAgICBbXG4gICAgICBcIlJQRC4yXCIsXG4gICAgICBcIkdORFwiXG4gICAgXSxcbiAgICBbXG4gICAgICBcIlExLlNcIixcbiAgICAgIFwiR05EXCJcbiAgICBdLFxuICAgIFtcbiAgICAgIFwiUTEuRFwiLFxuICAgICAgXCJEMS5jYXRob2RlXCJcbiAgICBdLFxuICAgIFtcbiAgICAgIFwiRDEuYW5vZGVcIixcbiAgICAgIFwiUkwuMlwiXG4gICAgXSxcbiAgICBbXG4gICAgICBcIlJMLjFcIixcbiAgICAgIFwiVkNDXCJcbiAgICBdXG4gIF1cbn1cbiIsICJ7XG4gIFwidGl0bGVcIjogXCJJbnZlcnRpbmcgT3AtQW1wIEFtcGxpZmllciAoR2FpbiBcdTIyMTIxMClcIixcbiAgXCJjb21wb25lbnRzXCI6IFtcbiAgICB7XG4gICAgICBcImlkXCI6IFwiVklOXCIsXG4gICAgICBcInR5cGVcIjogXCJhY19zb3VyY2VcIixcbiAgICAgIFwidmFsdWVcIjogXCIxMDBtVlwiXG4gICAgfSxcbiAgICB7XG4gICAgICBcImlkXCI6IFwiUklOXCIsXG4gICAgICBcInR5cGVcIjogXCJyZXNpc3RvclwiLFxuICAgICAgXCJ2YWx1ZVwiOiBcIjEwa1x1MDNBOVwiXG4gICAgfSxcbiAgICB7XG4gICAgICBcImlkXCI6IFwiUkZcIixcbiAgICAgIFwidHlwZVwiOiBcInJlc2lzdG9yXCIsXG4gICAgICBcInZhbHVlXCI6IFwiMTAwa1x1MDNBOVwiXG4gICAgfSxcbiAgICB7XG4gICAgICBcImlkXCI6IFwiVTFcIixcbiAgICAgIFwidHlwZVwiOiBcIm9wYW1wXCIsXG4gICAgICBcInZhbHVlXCI6IFwiVEwwNzFcIlxuICAgIH0sXG4gICAge1xuICAgICAgXCJpZFwiOiBcIlZPVVRcIixcbiAgICAgIFwidHlwZVwiOiBcIm91dHB1dFwiXG4gICAgfSxcbiAgICB7XG4gICAgICBcImlkXCI6IFwiR05EXCIsXG4gICAgICBcInR5cGVcIjogXCJncm91bmRcIlxuICAgIH1cbiAgXSxcbiAgXCJjb25uZWN0aW9uc1wiOiBbXG4gICAgW1xuICAgICAgXCJWSU4ucG9zaXRpdmVcIixcbiAgICAgIFwiUklOLjFcIlxuICAgIF0sXG4gICAgW1xuICAgICAgXCJSSU4uMlwiLFxuICAgICAgXCJVMS5pbi1cIixcbiAgICAgIFwiUkYuMVwiXG4gICAgXSxcbiAgICBbXG4gICAgICBcIlJGLjJcIixcbiAgICAgIFwiVTEub3V0XCIsXG4gICAgICBcIlZPVVRcIlxuICAgIF0sXG4gICAgW1xuICAgICAgXCJVMS5pbitcIixcbiAgICAgIFwiR05EXCJcbiAgICBdLFxuICAgIFtcbiAgICAgIFwiVklOLm5lZ2F0aXZlXCIsXG4gICAgICBcIkdORFwiXG4gICAgXVxuICBdXG59XG4iLCAie1xuICBcInRpdGxlXCI6IFwiMS1CaXQgRnVsbCBBZGRlclwiLFxuICBcImNvbXBvbmVudHNcIjogW1xuICAgIHtcbiAgICAgIFwiaWRcIjogXCJBXCIsXG4gICAgICBcInR5cGVcIjogXCJpbnB1dFwiXG4gICAgfSxcbiAgICB7XG4gICAgICBcImlkXCI6IFwiQlwiLFxuICAgICAgXCJ0eXBlXCI6IFwiaW5wdXRcIlxuICAgIH0sXG4gICAge1xuICAgICAgXCJpZFwiOiBcIkNJTlwiLFxuICAgICAgXCJ0eXBlXCI6IFwiaW5wdXRcIlxuICAgIH0sXG4gICAge1xuICAgICAgXCJpZFwiOiBcIlUxXCIsXG4gICAgICBcInR5cGVcIjogXCJ4b3JcIlxuICAgIH0sXG4gICAge1xuICAgICAgXCJpZFwiOiBcIlUyXCIsXG4gICAgICBcInR5cGVcIjogXCJ4b3JcIlxuICAgIH0sXG4gICAge1xuICAgICAgXCJpZFwiOiBcIlUzXCIsXG4gICAgICBcInR5cGVcIjogXCJhbmRcIlxuICAgIH0sXG4gICAge1xuICAgICAgXCJpZFwiOiBcIlU0XCIsXG4gICAgICBcInR5cGVcIjogXCJhbmRcIlxuICAgIH0sXG4gICAge1xuICAgICAgXCJpZFwiOiBcIlU1XCIsXG4gICAgICBcInR5cGVcIjogXCJvclwiXG4gICAgfSxcbiAgICB7XG4gICAgICBcImlkXCI6IFwiU1VNXCIsXG4gICAgICBcInR5cGVcIjogXCJvdXRwdXRcIlxuICAgIH0sXG4gICAge1xuICAgICAgXCJpZFwiOiBcIkNPVVRcIixcbiAgICAgIFwidHlwZVwiOiBcIm91dHB1dFwiXG4gICAgfVxuICBdLFxuICBcImNvbm5lY3Rpb25zXCI6IFtcbiAgICBbXG4gICAgICBcIkFcIixcbiAgICAgIFwiVTEuQVwiLFxuICAgICAgXCJVMy5BXCJcbiAgICBdLFxuICAgIFtcbiAgICAgIFwiQlwiLFxuICAgICAgXCJVMS5CXCIsXG4gICAgICBcIlUzLkJcIlxuICAgIF0sXG4gICAgW1xuICAgICAgXCJVMS5ZXCIsXG4gICAgICBcIlUyLkFcIixcbiAgICAgIFwiVTQuQVwiXG4gICAgXSxcbiAgICBbXG4gICAgICBcIkNJTlwiLFxuICAgICAgXCJVMi5CXCIsXG4gICAgICBcIlU0LkJcIlxuICAgIF0sXG4gICAgW1xuICAgICAgXCJVMi5ZXCIsXG4gICAgICBcIlNVTVwiXG4gICAgXSxcbiAgICBbXG4gICAgICBcIlUzLllcIixcbiAgICAgIFwiVTUuQlwiXG4gICAgXSxcbiAgICBbXG4gICAgICBcIlU0LllcIixcbiAgICAgIFwiVTUuQVwiXG4gICAgXSxcbiAgICBbXG4gICAgICBcIlU1LllcIixcbiAgICAgIFwiQ09VVFwiXG4gICAgXVxuICBdXG59XG4iLCAie1xuICBcInRpdGxlXCI6IFwiMi1CaXQgUmlwcGxlIENvdW50ZXIgKEQgRmxpcC1GbG9wcylcIixcbiAgXCJjb21wb25lbnRzXCI6IFtcbiAgICB7XG4gICAgICBcImlkXCI6IFwiQ0xLXCIsXG4gICAgICBcInR5cGVcIjogXCJpbnB1dFwiXG4gICAgfSxcbiAgICB7XG4gICAgICBcImlkXCI6IFwiVTFcIixcbiAgICAgIFwidHlwZVwiOiBcImRfZmxpcGZsb3BcIlxuICAgIH0sXG4gICAge1xuICAgICAgXCJpZFwiOiBcIlUyXCIsXG4gICAgICBcInR5cGVcIjogXCJkX2ZsaXBmbG9wXCJcbiAgICB9LFxuICAgIHtcbiAgICAgIFwiaWRcIjogXCJRMFwiLFxuICAgICAgXCJ0eXBlXCI6IFwib3V0cHV0XCJcbiAgICB9LFxuICAgIHtcbiAgICAgIFwiaWRcIjogXCJRMVwiLFxuICAgICAgXCJ0eXBlXCI6IFwib3V0cHV0XCJcbiAgICB9XG4gIF0sXG4gIFwiY29ubmVjdGlvbnNcIjogW1xuICAgIFtcbiAgICAgIFwiQ0xLXCIsXG4gICAgICBcIlUxLkNMS1wiXG4gICAgXSxcbiAgICBbXG4gICAgICBcIlUxLlFOXCIsXG4gICAgICBcIlUxLkRcIixcbiAgICAgIFwiVTIuQ0xLXCJcbiAgICBdLFxuICAgIFtcbiAgICAgIFwiVTIuUU5cIixcbiAgICAgIFwiVTIuRFwiXG4gICAgXSxcbiAgICBbXG4gICAgICBcIlUxLlFcIixcbiAgICAgIFwiUTBcIlxuICAgIF0sXG4gICAgW1xuICAgICAgXCJVMi5RXCIsXG4gICAgICBcIlExXCJcbiAgICBdXG4gIF1cbn1cbiIsICJ7XG4gIFwidGl0bGVcIjogXCI1NTUgQXN0YWJsZSBPc2NpbGxhdG9yXCIsXG4gIFwiY29tcG9uZW50c1wiOiBbXG4gICAge1xuICAgICAgXCJpZFwiOiBcIlUxXCIsXG4gICAgICBcInR5cGVcIjogXCJ0aW1lcl81NTVcIixcbiAgICAgIFwidmFsdWVcIjogXCJORTU1NVwiXG4gICAgfSxcbiAgICB7XG4gICAgICBcImlkXCI6IFwiUjFcIixcbiAgICAgIFwidHlwZVwiOiBcInJlc2lzdG9yXCIsXG4gICAgICBcInZhbHVlXCI6IFwiMWtcdTAzQTlcIlxuICAgIH0sXG4gICAge1xuICAgICAgXCJpZFwiOiBcIlIyXCIsXG4gICAgICBcInR5cGVcIjogXCJyZXNpc3RvclwiLFxuICAgICAgXCJ2YWx1ZVwiOiBcIjEwa1x1MDNBOVwiXG4gICAgfSxcbiAgICB7XG4gICAgICBcImlkXCI6IFwiQzFcIixcbiAgICAgIFwidHlwZVwiOiBcImNhcGFjaXRvclwiLFxuICAgICAgXCJ2YWx1ZVwiOiBcIjEwXHUwMEI1RlwiXG4gICAgfSxcbiAgICB7XG4gICAgICBcImlkXCI6IFwiQzJcIixcbiAgICAgIFwidHlwZVwiOiBcImNhcGFjaXRvclwiLFxuICAgICAgXCJ2YWx1ZVwiOiBcIjEwbkZcIlxuICAgIH0sXG4gICAge1xuICAgICAgXCJpZFwiOiBcIlIzXCIsXG4gICAgICBcInR5cGVcIjogXCJyZXNpc3RvclwiLFxuICAgICAgXCJ2YWx1ZVwiOiBcIjMzMFx1MDNBOVwiXG4gICAgfSxcbiAgICB7XG4gICAgICBcImlkXCI6IFwiRDFcIixcbiAgICAgIFwidHlwZVwiOiBcImxlZFwiXG4gICAgfSxcbiAgICB7XG4gICAgICBcImlkXCI6IFwiVkNDXCIsXG4gICAgICBcInR5cGVcIjogXCJ2Y2NcIixcbiAgICAgIFwidmFsdWVcIjogXCIrOVZcIlxuICAgIH0sXG4gICAge1xuICAgICAgXCJpZFwiOiBcIkdORFwiLFxuICAgICAgXCJ0eXBlXCI6IFwiZ3JvdW5kXCJcbiAgICB9XG4gIF0sXG4gIFwiY29ubmVjdGlvbnNcIjogW1xuICAgIFtcbiAgICAgIFwiVTEuVkNDXCIsXG4gICAgICBcIlUxLlJTVFwiLFxuICAgICAgXCJSMS4xXCIsXG4gICAgICBcIlZDQ1wiXG4gICAgXSxcbiAgICBbXG4gICAgICBcIlIxLjJcIixcbiAgICAgIFwiUjIuMVwiLFxuICAgICAgXCJVMS5ESVNcIlxuICAgIF0sXG4gICAgW1xuICAgICAgXCJSMi4yXCIsXG4gICAgICBcIlUxLlRIUlwiLFxuICAgICAgXCJVMS5UUklHXCIsXG4gICAgICBcIkMxLjFcIlxuICAgIF0sXG4gICAgW1xuICAgICAgXCJDMS4yXCIsXG4gICAgICBcIkdORFwiXG4gICAgXSxcbiAgICBbXG4gICAgICBcIlUxLkNWXCIsXG4gICAgICBcIkMyLjFcIlxuICAgIF0sXG4gICAgW1xuICAgICAgXCJDMi4yXCIsXG4gICAgICBcIkdORFwiXG4gICAgXSxcbiAgICBbXG4gICAgICBcIlUxLkdORFwiLFxuICAgICAgXCJHTkRcIlxuICAgIF0sXG4gICAgW1xuICAgICAgXCJVMS5PVVRcIixcbiAgICAgIFwiUjMuMVwiXG4gICAgXSxcbiAgICBbXG4gICAgICBcIlIzLjJcIixcbiAgICAgIFwiRDEuYW5vZGVcIlxuICAgIF0sXG4gICAgW1xuICAgICAgXCJEMS5jYXRob2RlXCIsXG4gICAgICBcIkdORFwiXG4gICAgXVxuICBdXG59XG4iLCAie1xuICBcInRpdGxlXCI6IFwiNzRIQzU5NSBTaGlmdCBSZWdpc3RlciBEcml2aW5nIExFRHNcIixcbiAgXCJjb21wb25lbnRzXCI6IFtcbiAgICB7XG4gICAgICBcImlkXCI6IFwiVTFcIixcbiAgICAgIFwidHlwZVwiOiBcImdlbmVyaWNfaWNcIixcbiAgICAgIFwibGFiZWxcIjogXCI3NEhDNTk1XCIsXG4gICAgICBcInBpbnNcIjoge1xuICAgICAgICBcImxlZnRcIjogW1xuICAgICAgICAgIFwiU0VSXCIsXG4gICAgICAgICAgXCJTUkNMS1wiLFxuICAgICAgICAgIFwiUkNMS1wiLFxuICAgICAgICAgIFwiflNSQ0xSXCIsXG4gICAgICAgICAgXCJ+T0VcIlxuICAgICAgICBdLFxuICAgICAgICBcInJpZ2h0XCI6IFtcbiAgICAgICAgICBcIlFBXCIsXG4gICAgICAgICAgXCJRQlwiLFxuICAgICAgICAgIFwiUUNcIixcbiAgICAgICAgICBcIlFEXCJcbiAgICAgICAgXSxcbiAgICAgICAgXCJ0b3BcIjogW1xuICAgICAgICAgIFwiVkNDXCJcbiAgICAgICAgXSxcbiAgICAgICAgXCJib3R0b21cIjogW1xuICAgICAgICAgIFwiR05EXCJcbiAgICAgICAgXVxuICAgICAgfVxuICAgIH0sXG4gICAge1xuICAgICAgXCJpZFwiOiBcIkRBVEFcIixcbiAgICAgIFwidHlwZVwiOiBcImlucHV0XCJcbiAgICB9LFxuICAgIHtcbiAgICAgIFwiaWRcIjogXCJTQ0tcIixcbiAgICAgIFwidHlwZVwiOiBcImlucHV0XCJcbiAgICB9LFxuICAgIHtcbiAgICAgIFwiaWRcIjogXCJMQVRDSFwiLFxuICAgICAgXCJ0eXBlXCI6IFwiaW5wdXRcIlxuICAgIH0sXG4gICAge1xuICAgICAgXCJpZFwiOiBcIlIxXCIsXG4gICAgICBcInR5cGVcIjogXCJyZXNpc3RvclwiLFxuICAgICAgXCJ2YWx1ZVwiOiBcIjMzMFx1MDNBOVwiXG4gICAgfSxcbiAgICB7XG4gICAgICBcImlkXCI6IFwiUjJcIixcbiAgICAgIFwidHlwZVwiOiBcInJlc2lzdG9yXCIsXG4gICAgICBcInZhbHVlXCI6IFwiMzMwXHUwM0E5XCJcbiAgICB9LFxuICAgIHtcbiAgICAgIFwiaWRcIjogXCJEMVwiLFxuICAgICAgXCJ0eXBlXCI6IFwibGVkXCJcbiAgICB9LFxuICAgIHtcbiAgICAgIFwiaWRcIjogXCJEMlwiLFxuICAgICAgXCJ0eXBlXCI6IFwibGVkXCJcbiAgICB9LFxuICAgIHtcbiAgICAgIFwiaWRcIjogXCJWQ0NcIixcbiAgICAgIFwidHlwZVwiOiBcInZjY1wiLFxuICAgICAgXCJ2YWx1ZVwiOiBcIis1VlwiXG4gICAgfSxcbiAgICB7XG4gICAgICBcImlkXCI6IFwiR05EXCIsXG4gICAgICBcInR5cGVcIjogXCJncm91bmRcIlxuICAgIH1cbiAgXSxcbiAgXCJjb25uZWN0aW9uc1wiOiBbXG4gICAgW1xuICAgICAgXCJEQVRBXCIsXG4gICAgICBcIlUxLlNFUlwiXG4gICAgXSxcbiAgICBbXG4gICAgICBcIlNDS1wiLFxuICAgICAgXCJVMS5TUkNMS1wiXG4gICAgXSxcbiAgICBbXG4gICAgICBcIkxBVENIXCIsXG4gICAgICBcIlUxLlJDTEtcIlxuICAgIF0sXG4gICAgW1xuICAgICAgXCJVMS5TUkNMUlwiLFxuICAgICAgXCJWQ0NcIlxuICAgIF0sXG4gICAgW1xuICAgICAgXCJVMS5PRVwiLFxuICAgICAgXCJHTkRcIlxuICAgIF0sXG4gICAgW1xuICAgICAgXCJVMS5WQ0NcIixcbiAgICAgIFwiVkNDXCJcbiAgICBdLFxuICAgIFtcbiAgICAgIFwiVTEuR05EXCIsXG4gICAgICBcIkdORFwiXG4gICAgXSxcbiAgICBbXG4gICAgICBcIlUxLlFBXCIsXG4gICAgICBcIlIxLjFcIlxuICAgIF0sXG4gICAgW1xuICAgICAgXCJSMS4yXCIsXG4gICAgICBcIkQxLmFub2RlXCJcbiAgICBdLFxuICAgIFtcbiAgICAgIFwiRDEuY2F0aG9kZVwiLFxuICAgICAgXCJHTkRcIlxuICAgIF0sXG4gICAgW1xuICAgICAgXCJVMS5RQlwiLFxuICAgICAgXCJSMi4xXCJcbiAgICBdLFxuICAgIFtcbiAgICAgIFwiUjIuMlwiLFxuICAgICAgXCJEMi5hbm9kZVwiXG4gICAgXSxcbiAgICBbXG4gICAgICBcIkQyLmNhdGhvZGVcIixcbiAgICAgIFwiR05EXCJcbiAgICBdXG4gIF1cbn1cbiIsICJ7XG4gIFwidGl0bGVcIjogXCJNaW5pbWFsIE1pY3JvY29udHJvbGxlciBTeXN0ZW1cIixcbiAgXCJjb21wb25lbnRzXCI6IFtcbiAgICB7XG4gICAgICBcImlkXCI6IFwiVTFcIixcbiAgICAgIFwidHlwZVwiOiBcIm1pY3JvY29udHJvbGxlclwiLFxuICAgICAgXCJ2YWx1ZVwiOiBcIkFUbWVnYTMyOFBcIlxuICAgIH0sXG4gICAge1xuICAgICAgXCJpZFwiOiBcIlkxXCIsXG4gICAgICBcInR5cGVcIjogXCJjcnlzdGFsXCIsXG4gICAgICBcInZhbHVlXCI6IFwiMTZNSHpcIlxuICAgIH0sXG4gICAge1xuICAgICAgXCJpZFwiOiBcIkMxXCIsXG4gICAgICBcInR5cGVcIjogXCJjYXBhY2l0b3JcIixcbiAgICAgIFwidmFsdWVcIjogXCIyMnBGXCJcbiAgICB9LFxuICAgIHtcbiAgICAgIFwiaWRcIjogXCJDMlwiLFxuICAgICAgXCJ0eXBlXCI6IFwiY2FwYWNpdG9yXCIsXG4gICAgICBcInZhbHVlXCI6IFwiMjJwRlwiXG4gICAgfSxcbiAgICB7XG4gICAgICBcImlkXCI6IFwiUjFcIixcbiAgICAgIFwidHlwZVwiOiBcInJlc2lzdG9yXCIsXG4gICAgICBcInZhbHVlXCI6IFwiMTBrXHUwM0E5XCJcbiAgICB9LFxuICAgIHtcbiAgICAgIFwiaWRcIjogXCJTVzFcIixcbiAgICAgIFwidHlwZVwiOiBcInB1c2hfYnV0dG9uXCIsXG4gICAgICBcInZhbHVlXCI6IFwiUkVTRVRcIlxuICAgIH0sXG4gICAge1xuICAgICAgXCJpZFwiOiBcIlIyXCIsXG4gICAgICBcInR5cGVcIjogXCJyZXNpc3RvclwiLFxuICAgICAgXCJ2YWx1ZVwiOiBcIjMzMFx1MDNBOVwiXG4gICAgfSxcbiAgICB7XG4gICAgICBcImlkXCI6IFwiRDFcIixcbiAgICAgIFwidHlwZVwiOiBcImxlZFwiXG4gICAgfSxcbiAgICB7XG4gICAgICBcImlkXCI6IFwiQzNcIixcbiAgICAgIFwidHlwZVwiOiBcImNhcGFjaXRvclwiLFxuICAgICAgXCJ2YWx1ZVwiOiBcIjEwMG5GXCJcbiAgICB9LFxuICAgIHtcbiAgICAgIFwiaWRcIjogXCJWQ0NcIixcbiAgICAgIFwidHlwZVwiOiBcInZjY1wiLFxuICAgICAgXCJ2YWx1ZVwiOiBcIis1VlwiXG4gICAgfSxcbiAgICB7XG4gICAgICBcImlkXCI6IFwiR05EXCIsXG4gICAgICBcInR5cGVcIjogXCJncm91bmRcIlxuICAgIH1cbiAgXSxcbiAgXCJjb25uZWN0aW9uc1wiOiBbXG4gICAgW1xuICAgICAgXCJVMS5WQ0NcIixcbiAgICAgIFwiVkNDXCJcbiAgICBdLFxuICAgIFtcbiAgICAgIFwiVTEuR05EXCIsXG4gICAgICBcIkdORFwiXG4gICAgXSxcbiAgICBbXG4gICAgICBcIkMzLjFcIixcbiAgICAgIFwiVkNDXCJcbiAgICBdLFxuICAgIFtcbiAgICAgIFwiQzMuMlwiLFxuICAgICAgXCJHTkRcIlxuICAgIF0sXG4gICAgW1xuICAgICAgXCJVMS5SU1RcIixcbiAgICAgIFwiUjEuMlwiLFxuICAgICAgXCJTVzEuMVwiXG4gICAgXSxcbiAgICBbXG4gICAgICBcIlIxLjFcIixcbiAgICAgIFwiVkNDXCJcbiAgICBdLFxuICAgIFtcbiAgICAgIFwiU1cxLjJcIixcbiAgICAgIFwiR05EXCJcbiAgICBdLFxuICAgIFtcbiAgICAgIFwiVTEuWFRBTDFcIixcbiAgICAgIFwiWTEuMVwiLFxuICAgICAgXCJDMS4xXCJcbiAgICBdLFxuICAgIFtcbiAgICAgIFwiVTEuWFRBTDJcIixcbiAgICAgIFwiWTEuMlwiLFxuICAgICAgXCJDMi4xXCJcbiAgICBdLFxuICAgIFtcbiAgICAgIFwiQzEuMlwiLFxuICAgICAgXCJHTkRcIlxuICAgIF0sXG4gICAgW1xuICAgICAgXCJDMi4yXCIsXG4gICAgICBcIkdORFwiXG4gICAgXSxcbiAgICBbXG4gICAgICBcIlUxLlBCMFwiLFxuICAgICAgXCJSMi4xXCJcbiAgICBdLFxuICAgIFtcbiAgICAgIFwiUjIuMlwiLFxuICAgICAgXCJEMS5hbm9kZVwiXG4gICAgXSxcbiAgICBbXG4gICAgICBcIkQxLmNhdGhvZGVcIixcbiAgICAgIFwiR05EXCJcbiAgICBdXG4gIF1cbn1cbiIsICJ7XG4gIFwidGl0bGVcIjogXCI1ViBMaW5lYXIgUmVndWxhdG9yXCIsXG4gIFwiY29tcG9uZW50c1wiOiBbXG4gICAge1xuICAgICAgXCJpZFwiOiBcIkJUMVwiLFxuICAgICAgXCJ0eXBlXCI6IFwiYmF0dGVyeVwiLFxuICAgICAgXCJ2YWx1ZVwiOiBcIjlWXCJcbiAgICB9LFxuICAgIHtcbiAgICAgIFwiaWRcIjogXCJVMVwiLFxuICAgICAgXCJ0eXBlXCI6IFwidm9sdGFnZV9yZWd1bGF0b3JcIixcbiAgICAgIFwidmFsdWVcIjogXCJMTTc4MDVcIlxuICAgIH0sXG4gICAge1xuICAgICAgXCJpZFwiOiBcIkMxXCIsXG4gICAgICBcInR5cGVcIjogXCJjYXBhY2l0b3JcIixcbiAgICAgIFwidmFsdWVcIjogXCIzMzBuRlwiXG4gICAgfSxcbiAgICB7XG4gICAgICBcImlkXCI6IFwiQzJcIixcbiAgICAgIFwidHlwZVwiOiBcImNhcGFjaXRvclwiLFxuICAgICAgXCJ2YWx1ZVwiOiBcIjEwMG5GXCJcbiAgICB9LFxuICAgIHtcbiAgICAgIFwiaWRcIjogXCJWT1VUXCIsXG4gICAgICBcInR5cGVcIjogXCJvdXRwdXRcIixcbiAgICAgIFwibGFiZWxcIjogXCIrNVZcIlxuICAgIH0sXG4gICAge1xuICAgICAgXCJpZFwiOiBcIkdORFwiLFxuICAgICAgXCJ0eXBlXCI6IFwiZ3JvdW5kXCJcbiAgICB9XG4gIF0sXG4gIFwiY29ubmVjdGlvbnNcIjogW1xuICAgIFtcbiAgICAgIFwiQlQxLnBvc2l0aXZlXCIsXG4gICAgICBcIlUxLklOXCIsXG4gICAgICBcIkMxLjFcIlxuICAgIF0sXG4gICAgW1xuICAgICAgXCJVMS5PVVRcIixcbiAgICAgIFwiQzIuMVwiLFxuICAgICAgXCJWT1VUXCJcbiAgICBdLFxuICAgIFtcbiAgICAgIFwiVTEuR05EXCIsXG4gICAgICBcIkdORFwiXG4gICAgXSxcbiAgICBbXG4gICAgICBcIkMxLjJcIixcbiAgICAgIFwiR05EXCJcbiAgICBdLFxuICAgIFtcbiAgICAgIFwiQzIuMlwiLFxuICAgICAgXCJHTkRcIlxuICAgIF0sXG4gICAgW1xuICAgICAgXCJCVDEubmVnYXRpdmVcIixcbiAgICAgIFwiR05EXCJcbiAgICBdXG4gIF1cbn1cbiIsICJpbXBvcnQgczAxIGZyb20gJy4uLy4uL3NhbXBsZXMvMDEtdm9sdGFnZS1kaXZpZGVyLmpzb24nO1xuaW1wb3J0IHMwMiBmcm9tICcuLi8uLi9zYW1wbGVzLzAyLWxlZC1yZXNpc3Rvci5qc29uJztcbmltcG9ydCBzMDMgZnJvbSAnLi4vLi4vc2FtcGxlcy8wMy1yYy1sb3dwYXNzLmpzb24nO1xuaW1wb3J0IHMwNCBmcm9tICcuLi8uLi9zYW1wbGVzLzA0LXJsLWNpcmN1aXQuanNvbic7XG5pbXBvcnQgczA1IGZyb20gJy4uLy4uL3NhbXBsZXMvMDUtcmxjLXNlcmllcy5qc29uJztcbmltcG9ydCBzMDYgZnJvbSAnLi4vLi4vc2FtcGxlcy8wNi1kaW9kZS1yZWN0aWZpZXIuanNvbic7XG5pbXBvcnQgczA3IGZyb20gJy4uLy4uL3NhbXBsZXMvMDctYmp0LWFtcGxpZmllci5qc29uJztcbmltcG9ydCBzMDggZnJvbSAnLi4vLi4vc2FtcGxlcy8wOC1tb3NmZXQtc3dpdGNoLmpzb24nO1xuaW1wb3J0IHMwOSBmcm9tICcuLi8uLi9zYW1wbGVzLzA5LW9wYW1wLWludmVydGluZy5qc29uJztcbmltcG9ydCBzMTAgZnJvbSAnLi4vLi4vc2FtcGxlcy8xMC1sb2dpYy1mdWxsLWFkZGVyLmpzb24nO1xuaW1wb3J0IHMxMSBmcm9tICcuLi8uLi9zYW1wbGVzLzExLWZsaXBmbG9wLWNvdW50ZXIuanNvbic7XG5pbXBvcnQgczEyIGZyb20gJy4uLy4uL3NhbXBsZXMvMTItNTU1LWFzdGFibGUuanNvbic7XG5pbXBvcnQgczEzIGZyb20gJy4uLy4uL3NhbXBsZXMvMTMtZ2VuZXJpYy1pYy5qc29uJztcbmltcG9ydCBzMTQgZnJvbSAnLi4vLi4vc2FtcGxlcy8xNC1taWNyb2NvbnRyb2xsZXIuanNvbic7XG5pbXBvcnQgczE1IGZyb20gJy4uLy4uL3NhbXBsZXMvMTUtdm9sdGFnZS1yZWd1bGF0b3IuanNvbic7XG5cbmV4cG9ydCBjb25zdCBTQU1QTEVTID0gW3MwMSwgczAyLCBzMDMsIHMwNCwgczA1LCBzMDYsIHMwNywgczA4LCBzMDksIHMxMCwgczExLCBzMTIsIHMxMywgczE0LCBzMTVdO1xuIiwgImltcG9ydCAnLi9zdHlsZXMuY3NzJztcbmltcG9ydCB7IHJlbmRlciwgdmFsaWRhdGUsIGxpc3RUeXBlcyB9IGZyb20gJy4uL2VuZ2luZS5qcyc7XG5pbXBvcnQgeyBwYXJzZUpTT04gfSBmcm9tICcuLi9wYXJzZXIvaW5kZXguanMnO1xuaW1wb3J0IHsgcmVzb2x2ZVN5bWJvbCB9IGZyb20gJy4uL3N5bWJvbC1sb2FkZXIvaW5kZXguanMnO1xuaW1wb3J0IHsgSGlzdG9yeSB9IGZyb20gJy4uL2VkaXRvci9oaXN0b3J5LmpzJztcbmltcG9ydCB7IGZvcm1hdEpTT04sIGRlbGV0ZUNvbXBvbmVudCwgcmVuYW1lQ29tcG9uZW50LCB1cGRhdGVDb21wb25lbnQsIHBpbkxheW91dCwgcm90YXRlQ29tcG9uZW50LCBjbGVhckxheW91dCwgYWRkQ29tcG9uZW50LCBFTVBUWV9DSVJDVUlUIH0gZnJvbSAnLi4vZWRpdG9yL21vZGVsLmpzJztcbmltcG9ydCB7IGRvd25sb2FkLCB0b1BORywgdG9KUEVHLCB0b1BERiwgY29weVRleHQsIGNvcHlQTkcsIHNsdWcgfSBmcm9tICcuLi9leHBvcnRlcnMvaW5kZXguanMnO1xuaW1wb3J0IHsgaGFuZGxlUmVxdWVzdCB9IGZyb20gJy4uL2FwaS9oYW5kbGVyLmpzJztcbmltcG9ydCB7IENhbnZhcyB9IGZyb20gJy4vY2FudmFzLmpzJztcbmltcG9ydCB7IFNBTVBMRVMgfSBmcm9tICcuL3NhbXBsZXMuanMnO1xuXG5jb25zdCAkID0gKHMsIHIgPSBkb2N1bWVudCkgPT4gci5xdWVyeVNlbGVjdG9yKHMpO1xuY29uc3QgJCQgPSAocywgciA9IGRvY3VtZW50KSA9PiBbLi4uci5xdWVyeVNlbGVjdG9yQWxsKHMpXTtcblxuLy8gUHVibGljIHNjcmlwdGluZyBBUEkgKHNlZSB0aGUgQVBJIGRpYWxvZykuXG53aW5kb3cuQ2lyY3VpdEZvcmdlID0geyByZW5kZXIsIHZhbGlkYXRlLCB0eXBlczogbGlzdFR5cGVzIH07XG5cbmNvbnN0IHN0b3JlID0ge1xuICBnZXQoaykgeyB0cnkgeyByZXR1cm4gbG9jYWxTdG9yYWdlLmdldEl0ZW0oayk7IH0gY2F0Y2ggeyByZXR1cm4gbnVsbDsgfSB9LFxuICBzZXQoaywgdikgeyB0cnkgeyBsb2NhbFN0b3JhZ2Uuc2V0SXRlbShrLCB2KTsgfSBjYXRjaCB7IC8qIHN0b3JhZ2UgdW5hdmFpbGFibGUgKi8gfSB9LFxufTtcblxuY29uc3Qgc3RhdGUgPSB7XG4gIHRleHQ6ICcnLFxuICBjaXJjdWl0OiBudWxsLCAgIC8vIGxhc3Qgc3VjY2Vzc2Z1bGx5IHBhcnNlZCBjaXJjdWl0IG9iamVjdFxuICByZXN1bHQ6IG51bGwsICAgIC8vIGxhc3Qgc3VjY2Vzc2Z1bCByZW5kZXIgKHdpdGggc2NlbmUpXG4gIHNlbGVjdGVkOiBudWxsLFxuICBzbmFwOiBzdG9yZS5nZXQoJ2NmLXNuYXAnKSAhPT0gJzAnLFxuICBncmlkOiBzdG9yZS5nZXQoJ2NmLWdyaWQnKSAhPT0gJzAnLFxuICBicmlkZ2VzOiBzdG9yZS5nZXQoJ2NmLWJyaWRnZXMnKSA9PT0gJzEnLFxuICBkcmFnOiBudWxsLFxufTtcbmNvbnN0IGhpc3RvcnkgPSBuZXcgSGlzdG9yeSgpO1xuXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tIGVsZW1lbnRzXG5jb25zdCB0ZXh0YXJlYSA9ICQoJyNqc29uJyk7XG5jb25zdCBndXR0ZXIgPSAkKCcjZ3V0dGVyJyk7XG5jb25zdCBjYW52YXNFbCA9ICQoJyNjYW52YXMnKTtcbmNvbnN0IGNhbnZhcyA9IG5ldyBDYW52YXMoY2FudmFzRWwsICQoJyN2aWV3cG9ydCcpLCB7XG4gIG9uU2VsZWN0OiAoaWQpID0+IHNlbGVjdChpZCksXG4gIG9uRHJhZ01vdmUsXG4gIG9uRHJhZ0VuZCxcbiAgb25WaWV3Q2hhbmdlOiAocykgPT4ge1xuICAgIGNvbnN0IHogPSBgJHtNYXRoLnJvdW5kKHMgKiAxMDApfSVgO1xuICAgICQoJyN6b29tLWxhYmVsJykudGV4dENvbnRlbnQgPSB6O1xuICAgICQoJyNzdGF0dXMtem9vbScpLnRleHRDb250ZW50ID0gejtcbiAgfSxcbn0pO1xuXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tIHRoZW1lXG5jb25zdCBkYXJrUXVlcnkgPSBtYXRjaE1lZGlhKCcocHJlZmVycy1jb2xvci1zY2hlbWU6IGRhcmspJyk7XG5jb25zdCBpc0RhcmsgPSAoKSA9PiAoZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LmRhdGFzZXQudGhlbWUgfHwgKGRhcmtRdWVyeS5tYXRjaGVzID8gJ2RhcmsnIDogJ2xpZ2h0JykpID09PSAnZGFyayc7XG5kYXJrUXVlcnkuYWRkRXZlbnRMaXN0ZW5lcignY2hhbmdlJywgKCkgPT4gdXBkYXRlKCkpO1xuXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tIHJlbmRlcmluZ1xuZnVuY3Rpb24gdXBkYXRlKHsgZml0ID0gZmFsc2UgfSA9IHt9KSB7XG4gIGNvbnN0IHBhcnNlZCA9IHBhcnNlSlNPTihzdGF0ZS50ZXh0KTtcbiAgbGV0IGVycm9ycyA9IFtdLCB3YXJuaW5ncyA9IFtdO1xuICBpZiAocGFyc2VkLmVycm9ycy5sZW5ndGgpIHtcbiAgICBlcnJvcnMgPSBwYXJzZWQuZXJyb3JzO1xuICAgIGNhbnZhcy5zZXRTdGFsZSh0cnVlKTtcbiAgfSBlbHNlIHtcbiAgICBzdGF0ZS5jaXJjdWl0ID0gcGFyc2VkLnZhbHVlO1xuICAgIGNvbnN0IHIgPSByZW5kZXIocGFyc2VkLnZhbHVlLCB7IHRoZW1lOiBpc0RhcmsoKSA/ICdkYXJrJyA6ICdsaWdodCcsIGJhY2tncm91bmQ6IG51bGwsIGludGVyYWN0aXZlOiB0cnVlLCBicmlkZ2VzOiBzdGF0ZS5icmlkZ2VzIH0pO1xuICAgIGVycm9ycyA9IHIuZXJyb3JzO1xuICAgIHdhcm5pbmdzID0gci53YXJuaW5ncztcbiAgICBpZiAoci52YWxpZCkge1xuICAgICAgc3RhdGUucmVzdWx0ID0gcjtcbiAgICAgIGNhbnZhcy5zZXRTVkcoci5zdmcsIHIudmlld0JveCwgeyBrZWVwVmlldzogIWZpdCB9KTtcbiAgICAgIGNhbnZhcy5zZXRTdGFsZShmYWxzZSk7XG4gICAgICBpZiAoZml0KSBjYW52YXMuZml0KCk7XG4gICAgICBpZiAoc3RhdGUuc2VsZWN0ZWQgJiYgIXIuc2NlbmUuaW5zdGFuY2VzLmhhcyhzdGF0ZS5zZWxlY3RlZCkpIHNlbGVjdChudWxsKTtcbiAgICAgIGVsc2UgaWYgKHN0YXRlLnNlbGVjdGVkKSBmaWxsSW5zcGVjdG9yKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNhbnZhcy5zZXRTdGFsZSh0cnVlKTtcbiAgICB9XG4gIH1cbiAgY29uc3QgY29tcHMgPSBBcnJheS5pc0FycmF5KHN0YXRlLmNpcmN1aXQ/LmNvbXBvbmVudHMpID8gc3RhdGUuY2lyY3VpdC5jb21wb25lbnRzLmxlbmd0aCA6IDA7XG4gICQoJyNlbXB0eS1zdGF0ZScpLmhpZGRlbiA9ICEoY29tcHMgPT09IDAgJiYgIWVycm9ycy5sZW5ndGgpO1xuICBzaG93UHJvYmxlbXMoZXJyb3JzLCB3YXJuaW5ncyk7XG4gIHVwZGF0ZVN0YXR1cyhlcnJvcnMsIHdhcm5pbmdzKTtcbiAgdXBkYXRlR3V0dGVyKGVycm9ycyk7XG4gIHN0b3JlLnNldCgnY2YtbGFzdCcsIHN0YXRlLnRleHQpO1xufVxuXG5mdW5jdGlvbiB1cGRhdGVTdGF0dXMoZXJyb3JzLCB3YXJuaW5ncykge1xuICBjb25zdCBzdCA9ICQoJyNzdGF0dXMnKTtcbiAgc3QuY2xhc3NMaXN0LnRvZ2dsZSgnZXJyb3InLCBlcnJvcnMubGVuZ3RoID4gMCk7XG4gIHN0LmNsYXNzTGlzdC50b2dnbGUoJ3dhcm5pbmcnLCAhZXJyb3JzLmxlbmd0aCAmJiB3YXJuaW5ncy5sZW5ndGggPiAwKTtcbiAgJCgnI3N0YXR1cy10ZXh0JykudGV4dENvbnRlbnQgPSBlcnJvcnMubGVuZ3RoXG4gICAgPyBgJHtlcnJvcnMubGVuZ3RofSBlcnJvciR7ZXJyb3JzLmxlbmd0aCA+IDEgPyAncycgOiAnJ31gXG4gICAgOiB3YXJuaW5ncy5sZW5ndGggPyBgUmVuZGVyZWQgXHUwMEI3ICR7d2FybmluZ3MubGVuZ3RofSB3YXJuaW5nJHt3YXJuaW5ncy5sZW5ndGggPiAxID8gJ3MnIDogJyd9YCA6ICdSZW5kZXJlZCc7XG4gIGNvbnN0IHNjZW5lID0gc3RhdGUucmVzdWx0Py5zY2VuZTtcbiAgaWYgKHNjZW5lKSB7XG4gICAgY29uc3QgbmV0cyA9IFsuLi5zY2VuZS5uZXRsaXN0Lm5ldHMudmFsdWVzKCldLmxlbmd0aDtcbiAgICAkKCcjc3RhdHVzLWNvdW50cycpLnRleHRDb250ZW50ID0gYCR7c2NlbmUuaW5zdGFuY2VzLnNpemV9IHBhcnRzIFx1MDBCNyAke25ldHN9IG5ldHMgXHUwMEI3ICR7c2NlbmUucm91dGluZy5qdW5jdGlvbnMubGVuZ3RofSBqdW5jdGlvbnNgO1xuICAgICQoJyNzdGF0dXMtc2l6ZScpLnRleHRDb250ZW50ID0gYCR7c3RhdGUucmVzdWx0LndpZHRofSBcdTAwRDcgJHtzdGF0ZS5yZXN1bHQuaGVpZ2h0fSBweGA7XG4gICAgJCgnI2VkaXRvci1tZXRhJykudGV4dENvbnRlbnQgPSBgJHtzdGF0ZS5jaXJjdWl0Py5jb21wb25lbnRzPy5sZW5ndGggPz8gMH0gY29tcG9uZW50c2A7XG4gIH1cbiAgJCgnI3N0YXR1cy1ncmlkJykudGV4dENvbnRlbnQgPSBzdGF0ZS5ncmlkID8gKHN0YXRlLnNuYXAgPyAnMjAgcHggc25hcCcgOiAnMTAgcHgnKSA6ICdvZmYnO1xufVxuXG5jb25zdCBlc2NSZSA9ICh0KSA9PiB0LnJlcGxhY2UoL1suKis/XiR7fSgpfFtcXF1cXFxcXS9nLCAnXFxcXCQmJyk7XG5mdW5jdGlvbiBsaW5lTWF0Y2hpbmcocmUpIHtcbiAgY29uc3QgaSA9IHN0YXRlLnRleHQuc3BsaXQoJ1xcbicpLmZpbmRJbmRleCgobCkgPT4gcmUudGVzdChsKSk7XG4gIHJldHVybiBpID49IDAgPyBpICsgMSA6IG51bGw7XG59XG4vLyBCZXN0LWVmZm9ydCBzb3VyY2UgbGluZSBmb3IgYSBwcm9ibGVtOiBleHBsaWNpdCBsaW5lLCBvZmZlbmRpbmcgcmVmZXJlbmNlLCBvciBjb21wb25lbnQgZW50cnkuXG5mdW5jdGlvbiBsaW5lT2YocCkge1xuICByZXR1cm4gcC5saW5lXG4gICAgfHwgKHAucmVmICYmIGxpbmVNYXRjaGluZyhuZXcgUmVnRXhwKGVzY1JlKEpTT04uc3RyaW5naWZ5KHAucmVmKSkpKSlcbiAgICB8fCAocC5jb21wb25lbnQgJiYgbGluZU1hdGNoaW5nKG5ldyBSZWdFeHAoYFwiaWRcIlxcXFxzKjpcXFxccyoke2VzY1JlKEpTT04uc3RyaW5naWZ5KHAuY29tcG9uZW50KSl9YCkpKVxuICAgIHx8IG51bGw7XG59XG5cbmZ1bmN0aW9uIHNob3dQcm9ibGVtcyhlcnJvcnMsIHdhcm5pbmdzKSB7XG4gIGNvbnN0IGxpc3QgPSAkKCcjcHJvYmxlbXMtbGlzdCcpO1xuICBsaXN0LnRleHRDb250ZW50ID0gJyc7XG4gIGNvbnN0IGFsbCA9IFsuLi5lcnJvcnMubWFwKChlKSA9PiAoeyAuLi5lLCBsZXZlbDogJ2Vycm9yJyB9KSksIC4uLndhcm5pbmdzLm1hcCgodykgPT4gKHsgLi4udywgbGV2ZWw6ICd3YXJuaW5nJyB9KSldO1xuICAkKCcjcHJvYmxlbXMtdGl0bGUnKS50ZXh0Q29udGVudCA9IGFsbC5sZW5ndGggPyBgUHJvYmxlbXMgKCR7YWxsLmxlbmd0aH0pYCA6ICdQcm9ibGVtcyc7XG4gIGlmICghYWxsLmxlbmd0aCkge1xuICAgIGNvbnN0IGxpID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnbGknKTtcbiAgICBsaS5jbGFzc05hbWUgPSAnb2snO1xuICAgIGxpLnRleHRDb250ZW50ID0gJ05vIHByb2JsZW1zLiBUaGUgY2lyY3VpdCBpcyB2YWxpZC4nO1xuICAgIGxpc3QuYXBwZW5kKGxpKTtcbiAgICByZXR1cm47XG4gIH1cbiAgZm9yIChjb25zdCBwIG9mIGFsbCkge1xuICAgIGNvbnN0IGxpID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnbGknKTtcbiAgICBsaS5jbGFzc05hbWUgPSBwLmxldmVsO1xuICAgIGxpLmlubmVySFRNTCA9ICc8c3BhbiBjbGFzcz1cImljb1wiPjwvc3Bhbj48c3BhbiBjbGFzcz1cImNvZGVcIj48L3NwYW4+PHNwYW4gY2xhc3M9XCJtc2dcIj48L3NwYW4+JztcbiAgICBsaS5xdWVyeVNlbGVjdG9yKCcuY29kZScpLnRleHRDb250ZW50ID0gcC5jb2RlO1xuICAgIGxpLnF1ZXJ5U2VsZWN0b3IoJy5tc2cnKS50ZXh0Q29udGVudCA9IHAubWVzc2FnZSArIChwLmxpbmUgJiYgIS9saW5lIFxcZC8udGVzdChwLm1lc3NhZ2UpID8gYCAobGluZSAke3AubGluZX0pYCA6ICcnKTtcbiAgICBsaS50aXRsZSA9ICdTaG93IGluIGVkaXRvcic7XG4gICAgbGkuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG4gICAgICBjb25zdCBsaW5lID0gbGluZU9mKHApO1xuICAgICAgaWYgKHAuY29tcG9uZW50ICYmIHN0YXRlLnJlc3VsdD8uc2NlbmUuaW5zdGFuY2VzLmhhcyhwLmNvbXBvbmVudCkpIHNlbGVjdChwLmNvbXBvbmVudCk7XG4gICAgICBpZiAobGluZSkgZ290b0xpbmUobGluZSk7XG4gICAgfSk7XG4gICAgbGlzdC5hcHBlbmQobGkpO1xuICB9XG59XG5cbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gZWRpdG9yXG5mdW5jdGlvbiB1cGRhdGVHdXR0ZXIoZXJyb3JzID0gW10pIHtcbiAgY29uc3QgbiA9IHN0YXRlLnRleHQuc3BsaXQoJ1xcbicpLmxlbmd0aDtcbiAgY29uc3QgYmFkID0gbmV3IFNldChlcnJvcnMuZmlsdGVyKChlKSA9PiBlLmxpbmUpLm1hcCgoZSkgPT4gZS5saW5lKSk7XG4gIGZvciAoY29uc3QgZSBvZiBlcnJvcnMpIGlmICghZS5saW5lKSB7IGNvbnN0IGwgPSBsaW5lT2YoZSk7IGlmIChsKSBiYWQuYWRkKGwpOyB9XG4gIGxldCBodG1sID0gJyc7XG4gIGZvciAobGV0IGkgPSAxOyBpIDw9IG47IGkrKykgaHRtbCArPSBiYWQuaGFzKGkpID8gYDxzcGFuIGNsYXNzPVwiZXJyXCI+JHtpfTwvc3Bhbj5cXG5gIDogYCR7aX1cXG5gO1xuICBndXR0ZXIuaW5uZXJIVE1MID0gaHRtbDtcbiAgZ3V0dGVyLnNjcm9sbFRvcCA9IHRleHRhcmVhLnNjcm9sbFRvcDtcbn1cblxuZnVuY3Rpb24gZ290b0xpbmUobGluZSkge1xuICBjb25zdCBsaW5lcyA9IHN0YXRlLnRleHQuc3BsaXQoJ1xcbicpO1xuICBjb25zdCBzdGFydCA9IGxpbmVzLnNsaWNlKDAsIGxpbmUgLSAxKS5yZWR1Y2UoKGEsIGwpID0+IGEgKyBsLmxlbmd0aCArIDEsIDApO1xuICB0ZXh0YXJlYS5mb2N1cygpO1xuICB0ZXh0YXJlYS5zZXRTZWxlY3Rpb25SYW5nZShzdGFydCwgc3RhcnQgKyAobGluZXNbbGluZSAtIDFdIHx8ICcnKS5sZW5ndGgpO1xuICB0ZXh0YXJlYS5zY3JvbGxUb3AgPSBNYXRoLm1heCgwLCAobGluZSAtIDUpICogMjApO1xufVxuXG5mdW5jdGlvbiBzZXRUZXh0KHRleHQsIHsgcmVjb3JkID0gdHJ1ZSwgZml0ID0gZmFsc2UgfSA9IHt9KSB7XG4gIHN0YXRlLnRleHQgPSB0ZXh0O1xuICBpZiAodGV4dGFyZWEudmFsdWUgIT09IHRleHQpIHRleHRhcmVhLnZhbHVlID0gdGV4dDtcbiAgaWYgKHJlY29yZCkgaGlzdG9yeS5wdXNoKHRleHQpO1xuICB1cGRhdGUoeyBmaXQgfSk7XG4gIHN5bmNUb29sYmFyKCk7XG59XG5cbmZ1bmN0aW9uIHNldENpcmN1aXQoY2lyY3VpdCwgb3B0cykge1xuICBzZXRUZXh0KGZvcm1hdEpTT04oY2lyY3VpdCkgKyAnXFxuJywgb3B0cyk7XG59XG5cbmxldCB0eXBpbmdUaW1lciA9IDAsIGhpc3RvcnlUaW1lciA9IDA7XG50ZXh0YXJlYS5hZGRFdmVudExpc3RlbmVyKCdpbnB1dCcsICgpID0+IHtcbiAgc3RhdGUudGV4dCA9IHRleHRhcmVhLnZhbHVlO1xuICBjbGVhclRpbWVvdXQodHlwaW5nVGltZXIpO1xuICBjbGVhclRpbWVvdXQoaGlzdG9yeVRpbWVyKTtcbiAgdHlwaW5nVGltZXIgPSBzZXRUaW1lb3V0KCgpID0+IHVwZGF0ZSgpLCAxODApO1xuICBoaXN0b3J5VGltZXIgPSBzZXRUaW1lb3V0KCgpID0+IHsgaGlzdG9yeS5wdXNoKHN0YXRlLnRleHQpOyBzeW5jVG9vbGJhcigpOyB9LCA2MDApO1xuICB1cGRhdGVHdXR0ZXIoKTtcbn0pO1xudGV4dGFyZWEuYWRkRXZlbnRMaXN0ZW5lcignc2Nyb2xsJywgKCkgPT4geyBndXR0ZXIuc2Nyb2xsVG9wID0gdGV4dGFyZWEuc2Nyb2xsVG9wOyB9KTtcbnRleHRhcmVhLmFkZEV2ZW50TGlzdGVuZXIoJ2tleWRvd24nLCAoZSkgPT4ge1xuICBpZiAoZS5rZXkgPT09ICdUYWInICYmICFlLmN0cmxLZXkgJiYgIWUubWV0YUtleSkge1xuICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICBkb2N1bWVudC5leGVjQ29tbWFuZCgnaW5zZXJ0VGV4dCcsIGZhbHNlLCAnICAnKTtcbiAgfVxufSk7XG5cbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gc2VsZWN0aW9uIC8gaW5zcGVjdG9yXG5jb25zdCB0eXBlU2VsZWN0ID0gJCgnI2luc3BlY3Rvci1mb3JtIHNlbGVjdFtuYW1lPXR5cGVdJyk7XG57XG4gIGNvbnN0IGJ5Q2F0ID0ge307XG4gIGZvciAoY29uc3QgdCBvZiBsaXN0VHlwZXMoKSkgKGJ5Q2F0W3QuY2F0ZWdvcnldIHx8PSBbXSkucHVzaCh0KTtcbiAgZm9yIChjb25zdCBbY2F0LCB0eXBlc10gb2YgT2JqZWN0LmVudHJpZXMoYnlDYXQpKSB7XG4gICAgY29uc3QgZyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ29wdGdyb3VwJyk7XG4gICAgZy5sYWJlbCA9IGNhdFswXS50b1VwcGVyQ2FzZSgpICsgY2F0LnNsaWNlKDEpO1xuICAgIGZvciAoY29uc3QgdCBvZiB0eXBlcy5zb3J0KChhLCBiKSA9PiBhLm5hbWUubG9jYWxlQ29tcGFyZShiLm5hbWUpKSkgZy5hcHBlbmQobmV3IE9wdGlvbihgJHt0Lm5hbWV9YCwgdC50eXBlKSk7XG4gICAgdHlwZVNlbGVjdC5hcHBlbmQoZyk7XG4gIH1cbn1cblxuZnVuY3Rpb24gc2VsZWN0KGlkKSB7XG4gIHN0YXRlLnNlbGVjdGVkID0gaWQ7XG4gIGNhbnZhcy5zZWxlY3QoaWQpO1xuICAkKCcjaW5zcGVjdG9yJykuaGlkZGVuID0gIWlkO1xuICBpZiAoaWQpIGZpbGxJbnNwZWN0b3IoKTtcbiAgc3luY1Rvb2xiYXIoKTtcbn1cblxuZnVuY3Rpb24gZmlsbEluc3BlY3RvcigpIHtcbiAgY29uc3QgY29tcCA9IHN0YXRlLmNpcmN1aXQ/LmNvbXBvbmVudHM/LmZpbmQoKGMpID0+IGMuaWQgPT09IHN0YXRlLnNlbGVjdGVkKTtcbiAgY29uc3QgSSA9IHN0YXRlLnJlc3VsdD8uc2NlbmUuaW5zdGFuY2VzLmdldChzdGF0ZS5zZWxlY3RlZCk7XG4gIGlmICghY29tcCB8fCAhSSkgcmV0dXJuO1xuICBjb25zdCBmID0gJCgnI2luc3BlY3Rvci1mb3JtJyk7XG4gIGYuaWQudmFsdWUgPSBjb21wLmlkO1xuICBmLnR5cGUudmFsdWUgPSBJLnBhcnQuc3ltLnR5cGU7XG4gIGYudmFsdWUudmFsdWUgPSBjb21wLnZhbHVlID8/ICcnO1xuICBmLmxhYmVsLnZhbHVlID0gY29tcC5sYWJlbCA/PyAnJztcbiAgZi5yb3RhdGlvbi52YWx1ZSA9IGNvbXAucm90YXRpb24gIT09IHVuZGVmaW5lZCA/IFN0cmluZyhjb21wLnJvdGF0aW9uKSA6ICcnO1xuICBmLm1pcnJvci5jaGVja2VkID0gISFjb21wLm1pcnJvcjtcbiAgY29uc3QgcGlucyA9IEkucGFydC5zeW0ucGluT3JkZXI7XG4gICQoJyNpbnNwZWN0b3ItcGlucycpLmlubmVySFRNTCA9IGA8Yj5QaW5zPC9iPjxicj4ke3BpbnMubWFwKChwKSA9PiBgPGNvZGU+JHtwLnJlcGxhY2UoL1smPD5dL2csICcnKX08L2NvZGU+YCkuam9pbignJyl9YDtcbn1cblxuJCgnI2luc3BlY3Rvci1mb3JtJykuYWRkRXZlbnRMaXN0ZW5lcignY2hhbmdlJywgKGUpID0+IHtcbiAgY29uc3QgZiA9IGUuY3VycmVudFRhcmdldDtcbiAgY29uc3QgaWQgPSBzdGF0ZS5zZWxlY3RlZDtcbiAgaWYgKCFpZCB8fCAhc3RhdGUuY2lyY3VpdCkgcmV0dXJuO1xuICBjb25zdCBuYW1lID0gZS50YXJnZXQubmFtZTtcbiAgbGV0IGMgPSBzdGF0ZS5jaXJjdWl0O1xuICBpZiAobmFtZSA9PT0gJ2lkJykge1xuICAgIGNvbnN0IG5leHQgPSBmLmlkLnZhbHVlLnRyaW0oKTtcbiAgICBpZiAoIW5leHQgfHwgL1suXFxzXS8udGVzdChuZXh0KSkgcmV0dXJuIHRvYXN0KCdJRHMgY2Fubm90IGJlIGVtcHR5IG9yIGNvbnRhaW4gZG90cy9zcGFjZXMuJywgdHJ1ZSk7XG4gICAgaWYgKG5leHQgIT09IGlkICYmIGMuY29tcG9uZW50cy5zb21lKCh4KSA9PiB4LmlkID09PSBuZXh0KSkgcmV0dXJuIHRvYXN0KGBJRCBcIiR7bmV4dH1cIiBpcyBhbHJlYWR5IHVzZWQuYCwgdHJ1ZSk7XG4gICAgYyA9IHJlbmFtZUNvbXBvbmVudChjLCBpZCwgbmV4dCk7XG4gICAgc3RhdGUuc2VsZWN0ZWQgPSBuZXh0O1xuICB9IGVsc2UgaWYgKG5hbWUgPT09ICdyb3RhdGlvbicpIHtcbiAgICBjID0gdXBkYXRlQ29tcG9uZW50KGMsIGlkLCB7IHJvdGF0aW9uOiBmLnJvdGF0aW9uLnZhbHVlID09PSAnJyA/IHVuZGVmaW5lZCA6IE51bWJlcihmLnJvdGF0aW9uLnZhbHVlKSB9KTtcbiAgfSBlbHNlIGlmIChuYW1lID09PSAnbWlycm9yJykge1xuICAgIGMgPSB1cGRhdGVDb21wb25lbnQoYywgaWQsIHsgbWlycm9yOiBmLm1pcnJvci5jaGVja2VkIHx8IHVuZGVmaW5lZCB9KTtcbiAgfSBlbHNlIGlmIChuYW1lID09PSAndHlwZScgfHwgbmFtZSA9PT0gJ3ZhbHVlJyB8fCBuYW1lID09PSAnbGFiZWwnKSB7XG4gICAgYyA9IHVwZGF0ZUNvbXBvbmVudChjLCBpZCwgeyBbbmFtZV06IGZbbmFtZV0udmFsdWUgfSk7XG4gIH0gZWxzZSByZXR1cm47XG4gIHNldENpcmN1aXQoYyk7XG4gIHNlbGVjdChzdGF0ZS5zZWxlY3RlZCk7XG59KTtcbiQoJyNpbnNwZWN0b3ItZm9ybScpLmFkZEV2ZW50TGlzdGVuZXIoJ3N1Ym1pdCcsIChlKSA9PiBlLnByZXZlbnREZWZhdWx0KCkpO1xuXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tIGRyYWdcbmNvbnN0IHNuYXBTdGVwID0gKCkgPT4gKHN0YXRlLnNuYXAgPyAyMCA6IDEwKTtcbmZ1bmN0aW9uIG9uRHJhZ01vdmUoaWQsIGR4LCBkeSkge1xuICBjb25zdCBzY2VuZSA9IHN0YXRlLnJlc3VsdD8uc2NlbmU7XG4gIGlmICghc2NlbmUgfHwgIXN0YXRlLmNpcmN1aXQpIHJldHVybjtcbiAgaWYgKCFzdGF0ZS5kcmFnIHx8IHN0YXRlLmRyYWcuaWQgIT09IGlkKSB7XG4gICAgc3RhdGUuZHJhZyA9IHsgaWQsIGJhc2U6IHNjZW5lLmluc3RhbmNlcywgY2lyY3VpdDogc3RhdGUuY2lyY3VpdCwgc3RhcnQ6IHsgeDogc2NlbmUuaW5zdGFuY2VzLmdldChpZCkueCwgeTogc2NlbmUuaW5zdGFuY2VzLmdldChpZCkueSB9LCBsYXN0OiBudWxsIH07XG4gIH1cbiAgY29uc3QgZCA9IHN0YXRlLmRyYWc7XG4gIGNvbnN0IHN0ZXAgPSBzbmFwU3RlcCgpO1xuICBjb25zdCB4ID0gTWF0aC5yb3VuZCgoZC5zdGFydC54ICsgZHgpIC8gc3RlcCkgKiBzdGVwO1xuICBjb25zdCB5ID0gTWF0aC5yb3VuZCgoZC5zdGFydC55ICsgZHkpIC8gc3RlcCkgKiBzdGVwO1xuICBpZiAoZC5sYXN0ICYmIGQubGFzdC54ID09PSB4ICYmIGQubGFzdC55ID09PSB5KSByZXR1cm47XG4gIGQubGFzdCA9IHsgeCwgeSB9O1xuICBkLnBlbmRpbmcgPSBwaW5MYXlvdXQoZC5jaXJjdWl0LCBkLmJhc2UsIHsgW2lkXTogeyB4LCB5IH0gfSk7XG4gIGlmICghZC5yYWYpIGQucmFmID0gcmVxdWVzdEFuaW1hdGlvbkZyYW1lKCgpID0+IHtcbiAgICBkLnJhZiA9IDA7XG4gICAgY29uc3QgciA9IHJlbmRlcihkLnBlbmRpbmcsIHsgdGhlbWU6IGlzRGFyaygpID8gJ2RhcmsnIDogJ2xpZ2h0JywgYmFja2dyb3VuZDogbnVsbCwgaW50ZXJhY3RpdmU6IHRydWUsIGJyaWRnZXM6IHN0YXRlLmJyaWRnZXMgfSk7XG4gICAgaWYgKHIudmFsaWQpIHsgY2FudmFzLnNldFNWRyhyLnN2Zywgci52aWV3Qm94KTsgc3RhdGUubGl2ZVJlc3VsdCA9IHI7IH1cbiAgfSk7XG59XG5mdW5jdGlvbiBvbkRyYWdFbmQoaWQsIGNhbmNlbGxlZCkge1xuICBjb25zdCBkID0gc3RhdGUuZHJhZztcbiAgc3RhdGUuZHJhZyA9IG51bGw7XG4gIGlmICghZCkgcmV0dXJuO1xuICBpZiAoZC5yYWYpIGNhbmNlbEFuaW1hdGlvbkZyYW1lKGQucmFmKTtcbiAgaWYgKGNhbmNlbGxlZCB8fCAhZC5wZW5kaW5nIHx8IChkLmxhc3QueCA9PT0gZC5zdGFydC54ICYmIGQubGFzdC55ID09PSBkLnN0YXJ0LnkpKSByZXR1cm4gdXBkYXRlKCk7XG4gIHNldENpcmN1aXQoZC5wZW5kaW5nKTtcbn1cblxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSBjb21tYW5kc1xuZnVuY3Rpb24gcm90YXRlU2VsZWN0ZWQoKSB7XG4gIGlmICghc3RhdGUuc2VsZWN0ZWQgfHwgIXN0YXRlLnJlc3VsdCkgcmV0dXJuO1xuICBzZXRDaXJjdWl0KHJvdGF0ZUNvbXBvbmVudChzdGF0ZS5jaXJjdWl0LCBzdGF0ZS5yZXN1bHQuc2NlbmUuaW5zdGFuY2VzLCBzdGF0ZS5zZWxlY3RlZCkpO1xufVxuZnVuY3Rpb24gZGVsZXRlU2VsZWN0ZWQoKSB7XG4gIGlmICghc3RhdGUuc2VsZWN0ZWQgfHwgIXN0YXRlLmNpcmN1aXQpIHJldHVybjtcbiAgY29uc3QgaWQgPSBzdGF0ZS5zZWxlY3RlZDtcbiAgc2VsZWN0KG51bGwpO1xuICBzZXRDaXJjdWl0KGRlbGV0ZUNvbXBvbmVudChzdGF0ZS5jaXJjdWl0LCBpZCkpO1xuICB0b2FzdChgRGVsZXRlZCAke2lkfWApO1xufVxuZnVuY3Rpb24gdW5kbygpIHsgY29uc3QgdCA9IGhpc3RvcnkudW5kbygpOyBpZiAodCAhPT0gbnVsbCkgc2V0VGV4dCh0LCB7IHJlY29yZDogZmFsc2UgfSk7IH1cbmZ1bmN0aW9uIHJlZG8oKSB7IGNvbnN0IHQgPSBoaXN0b3J5LnJlZG8oKTsgaWYgKHQgIT09IG51bGwpIHNldFRleHQodCwgeyByZWNvcmQ6IGZhbHNlIH0pOyB9XG5mdW5jdGlvbiB0b2dnbGUoa2V5KSB7XG4gIHN0YXRlW2tleV0gPSAhc3RhdGVba2V5XTtcbiAgc3RvcmUuc2V0KGBjZi0ke2tleX1gLCBzdGF0ZVtrZXldID8gJzEnIDogJzAnKTtcbiAgaWYgKGtleSA9PT0gJ2dyaWQnKSBjYW52YXNFbC5jbGFzc0xpc3QudG9nZ2xlKCdncmlkLW9uJywgc3RhdGUuZ3JpZCk7XG4gIHN5bmNUb29sYmFyKCk7XG4gIHVwZGF0ZSgpO1xufVxuZnVuY3Rpb24gc3luY1Rvb2xiYXIoKSB7XG4gICQkKCdbZGF0YS10b29sPXVuZG9dJykuZm9yRWFjaCgoYikgPT4gKGIuZGlzYWJsZWQgPSAhaGlzdG9yeS5jYW5VbmRvKSk7XG4gICQkKCdbZGF0YS10b29sPXJlZG9dJykuZm9yRWFjaCgoYikgPT4gKGIuZGlzYWJsZWQgPSAhaGlzdG9yeS5jYW5SZWRvKSk7XG4gICQkKCcudG9vbGJhciBbZGF0YS10b29sPXJvdGF0ZV0sIC50b29sYmFyIFtkYXRhLXRvb2w9ZGVsZXRlXScpLmZvckVhY2goKGIpID0+IChiLmRpc2FibGVkID0gIXN0YXRlLnNlbGVjdGVkKSk7XG4gIGZvciAoY29uc3QgayBvZiBbJ2dyaWQnLCAnc25hcCcsICdicmlkZ2VzJ10pICQoYFtkYXRhLXRvb2w9JHtrfV1gKS5zZXRBdHRyaWJ1dGUoJ2FyaWEtcHJlc3NlZCcsIFN0cmluZyhzdGF0ZVtrXSkpO1xufVxuXG5jb25zdCB0b29scyA9IHtcbiAgdW5kbywgcmVkbyxcbiAgcm90YXRlOiByb3RhdGVTZWxlY3RlZCxcbiAgZGVsZXRlOiBkZWxldGVTZWxlY3RlZCxcbiAgYXV0b2xheW91dDogKCkgPT4geyBpZiAoc3RhdGUuY2lyY3VpdCkgeyBzZXRDaXJjdWl0KGNsZWFyTGF5b3V0KHN0YXRlLmNpcmN1aXQpLCB7IGZpdDogdHJ1ZSB9KTsgdG9hc3QoJ0F1dG9tYXRpYyBsYXlvdXQgcmVzdG9yZWQnKTsgfSB9LFxuICBncmlkOiAoKSA9PiB0b2dnbGUoJ2dyaWQnKSxcbiAgc25hcDogKCkgPT4gdG9nZ2xlKCdzbmFwJyksXG4gIGJyaWRnZXM6ICgpID0+IHRvZ2dsZSgnYnJpZGdlcycpLFxuICAnem9vbS1pbic6ICgpID0+IGNhbnZhcy56b29tQXQoMS4yNSksXG4gICd6b29tLW91dCc6ICgpID0+IGNhbnZhcy56b29tQXQoMC44KSxcbiAgJ3pvb20tcmVzZXQnOiAoKSA9PiBjYW52YXMuem9vbVRvKDEpLFxuICBmaXQ6ICgpID0+IGNhbnZhcy5maXQoKSxcbn07XG5kb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIChlKSA9PiB7XG4gIGNvbnN0IHQgPSBlLnRhcmdldC5jbG9zZXN0KCdbZGF0YS10b29sXScpO1xuICBpZiAodCAmJiB0b29sc1t0LmRhdGFzZXQudG9vbF0pIHRvb2xzW3QuZGF0YXNldC50b29sXSgpO1xufSk7XG5cbmRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2tleWRvd24nLCAoZSkgPT4ge1xuICBjb25zdCBtb2QgPSBlLmN0cmxLZXkgfHwgZS5tZXRhS2V5O1xuICBjb25zdCBpbkZpZWxkID0gZS50YXJnZXQuY2xvc2VzdD8uKCdpbnB1dCwgdGV4dGFyZWEsIHNlbGVjdCcpO1xuICBpZiAobW9kICYmIGUua2V5LnRvTG93ZXJDYXNlKCkgPT09ICd6JykgeyBlLnByZXZlbnREZWZhdWx0KCk7IGUuc2hpZnRLZXkgPyByZWRvKCkgOiB1bmRvKCk7IHJldHVybjsgfVxuICBpZiAobW9kICYmIGUua2V5LnRvTG93ZXJDYXNlKCkgPT09ICd5JykgeyBlLnByZXZlbnREZWZhdWx0KCk7IHJlZG8oKTsgcmV0dXJuOyB9XG4gIGlmIChlLmtleSA9PT0gJ0VzY2FwZScpIHsgY2xvc2VNZW51cygpOyBpZiAoIWluRmllbGQpIHNlbGVjdChudWxsKTsgcmV0dXJuOyB9XG4gIGlmIChpbkZpZWxkIHx8IG1vZCB8fCBlLmFsdEtleSkgcmV0dXJuO1xuICBpZiAoZS5rZXkgPT09ICcgJykgeyBjYW52YXMuc3BhY2VEb3duID0gdHJ1ZTsgfVxuICBjb25zdCBtYXAgPSB7IERlbGV0ZTogJ2RlbGV0ZScsIEJhY2tzcGFjZTogJ2RlbGV0ZScsIHI6ICdyb3RhdGUnLCBSOiAncm90YXRlJywgZjogJ2ZpdCcsIEY6ICdmaXQnLCBnOiAnZ3JpZCcsIEc6ICdncmlkJywgczogJ3NuYXAnLCBTOiAnc25hcCcsICcrJzogJ3pvb20taW4nLCAnPSc6ICd6b29tLWluJywgJy0nOiAnem9vbS1vdXQnLCAnMCc6ICd6b29tLXJlc2V0JyB9O1xuICBpZiAobWFwW2Uua2V5XSkgeyBlLnByZXZlbnREZWZhdWx0KCk7IHRvb2xzW21hcFtlLmtleV1dKCk7IH1cbn0pO1xuZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcigna2V5dXAnLCAoZSkgPT4geyBpZiAoZS5rZXkgPT09ICcgJykgY2FudmFzLnNwYWNlRG93biA9IGZhbHNlOyB9KTtcblxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSBtZW51c1xuZnVuY3Rpb24gY2xvc2VNZW51cygpIHsgJCQoJy5tZW51JykuZm9yRWFjaCgobSkgPT4gKG0uaGlkZGVuID0gdHJ1ZSkpOyB9XG4kJCgnW2RhdGEtbWVudV0nKS5mb3JFYWNoKChidG4pID0+IHtcbiAgYnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKGUpID0+IHtcbiAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICAgIGNvbnN0IG1lbnUgPSAkKGAjbWVudS0ke2J0bi5kYXRhc2V0Lm1lbnV9YCk7XG4gICAgY29uc3Qgb3BlbiA9IG1lbnUuaGlkZGVuO1xuICAgIGNsb3NlTWVudXMoKTtcbiAgICBpZiAob3Blbikge1xuICAgICAgY29uc3QgciA9IGJ0bi5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcbiAgICAgIG1lbnUuc3R5bGUubGVmdCA9IGAke01hdGgubWluKHIubGVmdCwgaW5uZXJXaWR0aCAtIDI0MCl9cHhgO1xuICAgICAgbWVudS5zdHlsZS50b3AgPSBgJHtyLmJvdHRvbSArIDR9cHhgO1xuICAgICAgbWVudS5oaWRkZW4gPSBmYWxzZTtcbiAgICAgIG1lbnUucXVlcnlTZWxlY3RvcignYnV0dG9uJyk/LmZvY3VzKCk7XG4gICAgfVxuICB9KTtcbn0pO1xuZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoZSkgPT4geyBpZiAoIWUudGFyZ2V0LmNsb3Nlc3QoJy5tZW51JykpIGNsb3NlTWVudXMoKTsgfSk7XG5cbmNvbnN0IHNhbXBsZXNNZW51ID0gJCgnI21lbnUtc2FtcGxlcycpO1xuU0FNUExFUy5mb3JFYWNoKChzLCBpKSA9PiB7XG4gIGNvbnN0IGIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdidXR0b24nKTtcbiAgYi5zZXRBdHRyaWJ1dGUoJ3JvbGUnLCAnbWVudWl0ZW0nKTtcbiAgYi5pbm5lckhUTUwgPSBgPHNwYW4gY2xhc3M9XCJudW1cIj4ke2kgKyAxfTwvc3Bhbj48c3Bhbj48L3NwYW4+YDtcbiAgYi5sYXN0Q2hpbGQudGV4dENvbnRlbnQgPSBzLnRpdGxlO1xuICBiLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4geyBjbG9zZU1lbnVzKCk7IGxvYWRDaXJjdWl0KHMpOyB9KTtcbiAgc2FtcGxlc01lbnUuYXBwZW5kKGIpO1xufSk7XG5cbmZ1bmN0aW9uIGxvYWRDaXJjdWl0KGMpIHtcbiAgc2VsZWN0KG51bGwpO1xuICBzZXRDaXJjdWl0KGMsIHsgZml0OiB0cnVlIH0pO1xufVxuXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tIGFjdGlvbnNcbmNvbnN0IGZpbGVJbnB1dCA9ICQoJyNmaWxlLWlucHV0Jyk7XG5maWxlSW5wdXQuYWRkRXZlbnRMaXN0ZW5lcignY2hhbmdlJywgYXN5bmMgKCkgPT4ge1xuICBjb25zdCBmID0gZmlsZUlucHV0LmZpbGVzWzBdO1xuICBpZiAoZikgb3BlbkZpbGUoZik7XG4gIGZpbGVJbnB1dC52YWx1ZSA9ICcnO1xufSk7XG5hc3luYyBmdW5jdGlvbiBvcGVuRmlsZShmKSB7XG4gIGNvbnN0IHRleHQgPSBhd2FpdCBmLnRleHQoKTtcbiAgc2VsZWN0KG51bGwpO1xuICBzZXRUZXh0KHRleHQsIHsgZml0OiB0cnVlIH0pO1xuICB0b2FzdChgT3BlbmVkICR7Zi5uYW1lfWApO1xufVxuZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignZHJhZ292ZXInLCAoZSkgPT4gZS5wcmV2ZW50RGVmYXVsdCgpKTtcbmRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2Ryb3AnLCAoZSkgPT4ge1xuICBlLnByZXZlbnREZWZhdWx0KCk7XG4gIGNvbnN0IGYgPSBlLmRhdGFUcmFuc2Zlcj8uZmlsZXM/LlswXTtcbiAgaWYgKGYpIG9wZW5GaWxlKGYpO1xufSk7XG5cbmNvbnN0IGFjdGlvbnMgPSB7XG4gIG5ldzogKCkgPT4gbG9hZENpcmN1aXQoRU1QVFlfQ0lSQ1VJVCksXG4gIG9wZW46ICgpID0+IGZpbGVJbnB1dC5jbGljaygpLFxuICBmb3JtYXQ6ICgpID0+IHtcbiAgICBjb25zdCBwID0gcGFyc2VKU09OKHN0YXRlLnRleHQpO1xuICAgIGlmIChwLmVycm9ycy5sZW5ndGgpIHJldHVybiB0b2FzdCgnRml4IHRoZSBKU09OIHN5bnRheCBlcnJvciBmaXJzdC4nLCB0cnVlKTtcbiAgICBzZXRDaXJjdWl0KHAudmFsdWUpO1xuICB9LFxuICBhcGk6ICgpID0+ICQoJyNhcGktZGlhbG9nJykuc2hvd01vZGFsKCksXG4gIGxpYnJhcnk6ICgpID0+IHsgYnVpbGRMaWJyYXJ5KCk7ICQoJyNsaWJyYXJ5LWRpYWxvZycpLnNob3dNb2RhbCgpOyAkKCcjbGlicmFyeS1zZWFyY2gnKS5mb2N1cygpOyB9LFxuICB0aGVtZTogKCkgPT4ge1xuICAgIGNvbnN0IG5leHQgPSBpc0RhcmsoKSA/ICdsaWdodCcgOiAnZGFyayc7XG4gICAgZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LmRhdGFzZXQudGhlbWUgPSBuZXh0O1xuICAgIHN0b3JlLnNldCgnY2YtdGhlbWUnLCBuZXh0KTtcbiAgICB1cGRhdGUoKTtcbiAgfSxcbiAgZGVzZWxlY3Q6ICgpID0+IHNlbGVjdChudWxsKSxcbiAgJ2xvYWQtZmlyc3Qtc2FtcGxlJzogKCkgPT4gbG9hZENpcmN1aXQoU0FNUExFU1swXSksXG59O1xuZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoZSkgPT4ge1xuICBjb25zdCBhID0gZS50YXJnZXQuY2xvc2VzdCgnW2RhdGEtYWN0aW9uXScpO1xuICBpZiAoYSAmJiBhY3Rpb25zW2EuZGF0YXNldC5hY3Rpb25dKSBhY3Rpb25zW2EuZGF0YXNldC5hY3Rpb25dKCk7XG59KTtcbiQkKCdkaWFsb2cgW2RhdGEtY2xvc2VdJykuZm9yRWFjaCgoYikgPT4gYi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IGIuY2xvc2VzdCgnZGlhbG9nJykuY2xvc2UoKSkpO1xuJCQoJ2RpYWxvZycpLmZvckVhY2goKGQpID0+IGQuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoZSkgPT4geyBpZiAoZS50YXJnZXQgPT09IGQpIGQuY2xvc2UoKTsgfSkpO1xuXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tIGV4cG9ydFxuZnVuY3Rpb24gZXhwb3J0UmVuZGVyKGV4dHJhID0ge30pIHtcbiAgY29uc3QgcCA9IHBhcnNlSlNPTihzdGF0ZS50ZXh0KTtcbiAgaWYgKHAuZXJyb3JzLmxlbmd0aCkgdGhyb3cgbmV3IEVycm9yKCdGaXggdGhlIEpTT04gZXJyb3JzIGJlZm9yZSBleHBvcnRpbmcuJyk7XG4gIGNvbnN0IHIgPSByZW5kZXIocC52YWx1ZSwgeyB0aGVtZTogJ2xpZ2h0JywgYnJpZGdlczogc3RhdGUuYnJpZGdlcywgLi4uZXh0cmEgfSk7XG4gIGlmICghci52YWxpZCkgdGhyb3cgbmV3IEVycm9yKCdGaXggdGhlIGNpcmN1aXQgZXJyb3JzIGJlZm9yZSBleHBvcnRpbmcuJyk7XG4gIHJldHVybiByO1xufVxuY29uc3QgYmFzZU5hbWUgPSAoKSA9PiBzbHVnKHN0YXRlLmNpcmN1aXQ/LnRpdGxlKTtcbmNvbnN0IGV4cG9ydGVycyA9IHtcbiAgJ2NvcHktcG5nJzogYXN5bmMgKCkgPT4geyBjb25zdCByID0gZXhwb3J0UmVuZGVyKCk7IGF3YWl0IGNvcHlQTkcoci5zdmcsIHIud2lkdGgsIHIuaGVpZ2h0LCB7IHNjYWxlOiAyIH0pOyByZXR1cm4gJ1BORyBjb3BpZWQgdG8gY2xpcGJvYXJkJzsgfSxcbiAgJ2NvcHktc3ZnJzogYXN5bmMgKCkgPT4geyBhd2FpdCBjb3B5VGV4dChleHBvcnRSZW5kZXIoKS5zdmcpOyByZXR1cm4gJ1NWRyBjb3BpZWQgdG8gY2xpcGJvYXJkJzsgfSxcbiAgJ2NvcHktanNvbic6IGFzeW5jICgpID0+IHsgYXdhaXQgY29weVRleHQoc3RhdGUudGV4dCk7IHJldHVybiAnSlNPTiBjb3BpZWQgdG8gY2xpcGJvYXJkJzsgfSxcbiAgc3ZnOiBhc3luYyAoKSA9PiB7IGRvd25sb2FkKGV4cG9ydFJlbmRlcigpLnN2ZywgYCR7YmFzZU5hbWUoKX0uc3ZnYCwgJ2ltYWdlL3N2Zyt4bWwnKTsgfSxcbiAgcG5nOiBhc3luYyAoKSA9PiB7IGNvbnN0IHIgPSBleHBvcnRSZW5kZXIoKTsgZG93bmxvYWQoYXdhaXQgdG9QTkcoci5zdmcsIHIud2lkdGgsIHIuaGVpZ2h0LCB7IHNjYWxlOiAyIH0pLCBgJHtiYXNlTmFtZSgpfS5wbmdgKTsgfSxcbiAgJ3BuZy1oaXJlcyc6IGFzeW5jICgpID0+IHsgY29uc3QgciA9IGV4cG9ydFJlbmRlcigpOyBkb3dubG9hZChhd2FpdCB0b1BORyhyLnN2Zywgci53aWR0aCwgci5oZWlnaHQsIHsgc2NhbGU6IDQgfSksIGAke2Jhc2VOYW1lKCl9QDR4LnBuZ2ApOyB9LFxuICAncG5nLXRyYW5zcGFyZW50JzogYXN5bmMgKCkgPT4geyBjb25zdCByID0gZXhwb3J0UmVuZGVyKHsgYmFja2dyb3VuZDogbnVsbCB9KTsgZG93bmxvYWQoYXdhaXQgdG9QTkcoci5zdmcsIHIud2lkdGgsIHIuaGVpZ2h0LCB7IHNjYWxlOiAyLCB0cmFuc3BhcmVudDogdHJ1ZSB9KSwgYCR7YmFzZU5hbWUoKX0tdHJhbnNwYXJlbnQucG5nYCk7IH0sXG4gIGpwZWc6IGFzeW5jICgpID0+IHsgY29uc3QgciA9IGV4cG9ydFJlbmRlcigpOyBkb3dubG9hZChhd2FpdCB0b0pQRUcoci5zdmcsIHIud2lkdGgsIHIuaGVpZ2h0LCB7IHNjYWxlOiAyIH0pLCBgJHtiYXNlTmFtZSgpfS5qcGdgKTsgfSxcbiAgcGRmOiBhc3luYyAoKSA9PiB7IGNvbnN0IHIgPSBleHBvcnRSZW5kZXIoKTsgZG93bmxvYWQoYXdhaXQgdG9QREYoci5zdmcsIHIud2lkdGgsIHIuaGVpZ2h0LCB7IHNjYWxlOiA0LCB0aXRsZTogc3RhdGUuY2lyY3VpdD8udGl0bGUgfSksIGAke2Jhc2VOYW1lKCl9LnBkZmApOyB9LFxuICBqc29uOiBhc3luYyAoKSA9PiB7IGRvd25sb2FkKHN0YXRlLnRleHQsIGAke2Jhc2VOYW1lKCl9Lmpzb25gLCAnYXBwbGljYXRpb24vanNvbicpOyB9LFxufTtcbiQkKCdbZGF0YS1leHBvcnRdJykuZm9yRWFjaCgoYikgPT4gYi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGFzeW5jICgpID0+IHtcbiAgY2xvc2VNZW51cygpO1xuICB0cnkge1xuICAgIGNvbnN0IG1zZyA9IGF3YWl0IGV4cG9ydGVyc1tiLmRhdGFzZXQuZXhwb3J0XSgpO1xuICAgIHRvYXN0KG1zZyB8fCAnRXhwb3J0ZWQnKTtcbiAgfSBjYXRjaCAoZXJyKSB7XG4gICAgdG9hc3QoZXJyLm1lc3NhZ2UgfHwgU3RyaW5nKGVyciksIHRydWUpO1xuICB9XG59KSk7XG5cbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gQVBJIGV4cGxvcmVyXG4kJCgnW2RhdGEtYXBpXScpLmZvckVhY2goKGIpID0+IGIuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG4gIGNvbnN0IHAgPSBwYXJzZUpTT04oc3RhdGUudGV4dCk7XG4gIGNvbnN0IG91dCA9IGhhbmRsZVJlcXVlc3QoeyBtZXRob2Q6ICdQT1NUJywgcGF0aDogYC9hcGkvdjEvJHtiLmRhdGFzZXQuYXBpfWAsIGhlYWRlcnM6IHt9LCBib2R5OiB7IGNpcmN1aXQ6IHAudmFsdWUgPz8gc3RhdGUudGV4dCwgZm9ybWF0OiAnanNvbicgfSB9KTtcbiAgbGV0IGJvZHkgPSBvdXQuYm9keTtcbiAgdHJ5IHtcbiAgICBjb25zdCBvID0gSlNPTi5wYXJzZShib2R5KTtcbiAgICBpZiAoby5zdmcpIG8uc3ZnID0gby5zdmcuc2xpY2UoMCwgMTYwKSArIGAgXHUyMDI2ICgke28uc3ZnLmxlbmd0aH0gY2hhcnMpYDtcbiAgICBib2R5ID0gSlNPTi5zdHJpbmdpZnkobywgbnVsbCwgMik7XG4gIH0gY2F0Y2ggeyAvKiBzdmcgYm9keSAqLyB9XG4gICQoJyNhcGktb3V0JykudGV4dENvbnRlbnQgPSBgSFRUUCAke291dC5zdGF0dXN9XFxuJHtib2R5fWA7XG59KSk7XG5cbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gY29tcG9uZW50IGxpYnJhcnlcbmxldCBsaWJyYXJ5QnVpbHQgPSBmYWxzZTtcbmZ1bmN0aW9uIGJ1aWxkTGlicmFyeSgpIHtcbiAgaWYgKGxpYnJhcnlCdWlsdCkgcmV0dXJuO1xuICBsaWJyYXJ5QnVpbHQgPSB0cnVlO1xuICBjb25zdCBib2R5ID0gJCgnI2xpYnJhcnktYm9keScpO1xuICBjb25zdCBjYXRzID0geyBwYXNzaXZlOiAnUGFzc2l2ZScsIHNlbWljb25kdWN0b3I6ICdTZW1pY29uZHVjdG9yJywgYW5hbG9nOiAnQW5hbG9nJywgZGlnaXRhbDogJ0RpZ2l0YWwnLCBpYzogJ0lDIC8gTUNVJywgcG93ZXI6ICdQb3dlciAmIGNvbm5lY3Rpb24nIH07XG4gIGNvbnN0IGJ5Q2F0ID0ge307XG4gIGZvciAoY29uc3QgdCBvZiBsaXN0VHlwZXMoKSkgKGJ5Q2F0W3QuY2F0ZWdvcnldIHx8PSBbXSkucHVzaCh0KTtcbiAgZm9yIChjb25zdCBbY2F0LCBsYWJlbF0gb2YgT2JqZWN0LmVudHJpZXMoY2F0cykpIHtcbiAgICBpZiAoIWJ5Q2F0W2NhdF0pIGNvbnRpbnVlO1xuICAgIGNvbnN0IHNlYyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NlY3Rpb24nKTtcbiAgICBzZWMuY2xhc3NOYW1lID0gJ2xpYi1jYXQnO1xuICAgIHNlYy5pbm5lckhUTUwgPSBgPGgzPiR7bGFiZWx9PC9oMz48ZGl2IGNsYXNzPVwibGliLWdyaWRcIj48L2Rpdj5gO1xuICAgIGZvciAoY29uc3QgdCBvZiBieUNhdFtjYXRdKSB7XG4gICAgICBjb25zdCBzeW0gPSByZXNvbHZlU3ltYm9sKHsgdHlwZTogdC50eXBlIH0pO1xuICAgICAgY29uc3QgYiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2J1dHRvbicpO1xuICAgICAgYi5jbGFzc05hbWUgPSAnbGliLWl0ZW0nO1xuICAgICAgYi5kYXRhc2V0LnNlYXJjaCA9IFt0LnR5cGUsIHQubmFtZSwgLi4udC5hbGlhc2VzXS5qb2luKCcgJykudG9Mb3dlckNhc2UoKTtcbiAgICAgIGIudGl0bGUgPSBgUGluczogJHtzeW0ucGluT3JkZXIuam9pbignLCAnKX1gO1xuICAgICAgY29uc3QgcHJldmlldyA9IHN5bS5zdmdCb2R5XG4gICAgICAgID8gYDxzdmcgdmlld0JveD1cIi00IC00ICR7c3ltLndpZHRoICsgOH0gJHtzeW0uaGVpZ2h0ICsgOH1cIiB3aWR0aD1cIiR7TWF0aC5taW4oMTIwLCBzeW0ud2lkdGggKyA4KX1cIiBoZWlnaHQ9XCI1MlwiPiR7c3ltLnN2Z0JvZHl9PC9zdmc+YFxuICAgICAgICA6IGA8c3ZnIHZpZXdCb3g9XCIwIDAgNjAgMjBcIiB3aWR0aD1cIjYwXCIgaGVpZ2h0PVwiNTJcIj48dGV4dCB4PVwiMzBcIiB5PVwiMTRcIiB0ZXh0LWFuY2hvcj1cIm1pZGRsZVwiIGZvbnQtc2l6ZT1cIjEwXCIgZmlsbD1cImN1cnJlbnRDb2xvclwiPiR7dC50eXBlID09PSAnanVuY3Rpb24nID8gJ1x1MjVDRicgOiAnTkVUJ308L3RleHQ+PC9zdmc+YDtcbiAgICAgIGIuaW5uZXJIVE1MID0gYCR7cHJldmlld308c3BhbiBjbGFzcz1cIm5cIj48L3NwYW4+PHNwYW4gY2xhc3M9XCJ0XCI+PC9zcGFuPmA7XG4gICAgICBiLnF1ZXJ5U2VsZWN0b3IoJy5uJykudGV4dENvbnRlbnQgPSB0Lm5hbWU7XG4gICAgICBiLnF1ZXJ5U2VsZWN0b3IoJy50JykudGV4dENvbnRlbnQgPSB0LnR5cGU7XG4gICAgICBiLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuICAgICAgICBpZiAoIXN0YXRlLmNpcmN1aXQpIHJldHVybiB0b2FzdCgnRml4IHRoZSBKU09OIHN5bnRheCBlcnJvciBmaXJzdC4nLCB0cnVlKTtcbiAgICAgICAgY29uc3QgeyBjaXJjdWl0LCBpZCB9ID0gYWRkQ29tcG9uZW50KHN0YXRlLmNpcmN1aXQsIHQudHlwZSk7XG4gICAgICAgICQoJyNsaWJyYXJ5LWRpYWxvZycpLmNsb3NlKCk7XG4gICAgICAgIHNldENpcmN1aXQoY2lyY3VpdCk7XG4gICAgICAgIHNlbGVjdChpZCk7XG4gICAgICAgIHRvYXN0KGBBZGRlZCAke2lkfS4gQ29ubmVjdCBpdCBpbiBcImNvbm5lY3Rpb25zXCIgKHBpbnM6ICR7c3ltLnBpbk9yZGVyLmpvaW4oJywgJyl9KWApO1xuICAgICAgfSk7XG4gICAgICBzZWMubGFzdENoaWxkLmFwcGVuZChiKTtcbiAgICB9XG4gICAgYm9keS5hcHBlbmQoc2VjKTtcbiAgfVxufVxuJCgnI2xpYnJhcnktc2VhcmNoJykuYWRkRXZlbnRMaXN0ZW5lcignaW5wdXQnLCAoZSkgPT4ge1xuICBjb25zdCBxID0gZS50YXJnZXQudmFsdWUudHJpbSgpLnRvTG93ZXJDYXNlKCk7XG4gICQkKCcubGliLWl0ZW0nKS5mb3JFYWNoKChiKSA9PiAoYi5oaWRkZW4gPSBxICYmICFiLmRhdGFzZXQuc2VhcmNoLmluY2x1ZGVzKHEpKSk7XG4gICQkKCcubGliLWNhdCcpLmZvckVhY2goKHMpID0+IChzLmhpZGRlbiA9ICEkJCgnLmxpYi1pdGVtJywgcykuc29tZSgoYikgPT4gIWIuaGlkZGVuKSkpO1xufSk7XG5cbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gc3BsaXR0ZXJcbntcbiAgY29uc3Qgc3AgPSAkKCcjc3BsaXR0ZXInKTtcbiAgY29uc3Qgd3MgPSAkKCcud29ya3NwYWNlJyk7XG4gIGNvbnN0IHNhdmVkID0gc3RvcmUuZ2V0KCdjZi1lZGl0b3ItdycpO1xuICBpZiAoc2F2ZWQpIHdzLnN0eWxlLnNldFByb3BlcnR5KCctLWVkaXRvci13Jywgc2F2ZWQpO1xuICBzcC5hZGRFdmVudExpc3RlbmVyKCdwb2ludGVyZG93bicsIChlKSA9PiB7XG4gICAgaWYgKGlubmVyV2lkdGggPD0gODIwKSByZXR1cm47XG4gICAgc3Auc2V0UG9pbnRlckNhcHR1cmUoZS5wb2ludGVySWQpO1xuICAgIHNwLmNsYXNzTGlzdC5hZGQoJ2RyYWdnaW5nJyk7XG4gICAgY29uc3QgbW92ZSA9IChldikgPT4ge1xuICAgICAgY29uc3QgdyA9IE1hdGgubWF4KDI0MCwgTWF0aC5taW4oaW5uZXJXaWR0aCAqIDAuNywgZXYuY2xpZW50WCkpO1xuICAgICAgd3Muc3R5bGUuc2V0UHJvcGVydHkoJy0tZWRpdG9yLXcnLCBgJHt3fXB4YCk7XG4gICAgfTtcbiAgICBjb25zdCB1cCA9ICgpID0+IHtcbiAgICAgIHNwLmNsYXNzTGlzdC5yZW1vdmUoJ2RyYWdnaW5nJyk7XG4gICAgICBzcC5yZW1vdmVFdmVudExpc3RlbmVyKCdwb2ludGVybW92ZScsIG1vdmUpO1xuICAgICAgc3RvcmUuc2V0KCdjZi1lZGl0b3ItdycsIHdzLnN0eWxlLmdldFByb3BlcnR5VmFsdWUoJy0tZWRpdG9yLXcnKSk7XG4gICAgfTtcbiAgICBzcC5hZGRFdmVudExpc3RlbmVyKCdwb2ludGVybW92ZScsIG1vdmUpO1xuICAgIHNwLmFkZEV2ZW50TGlzdGVuZXIoJ3BvaW50ZXJ1cCcsIHVwLCB7IG9uY2U6IHRydWUgfSk7XG4gIH0pO1xuICBzcC5hZGRFdmVudExpc3RlbmVyKCdrZXlkb3duJywgKGUpID0+IHtcbiAgICBpZiAoZS5rZXkgIT09ICdBcnJvd0xlZnQnICYmIGUua2V5ICE9PSAnQXJyb3dSaWdodCcpIHJldHVybjtcbiAgICBjb25zdCBjdXIgPSBwYXJzZUZsb2F0KGdldENvbXB1dGVkU3R5bGUod3MpLmdyaWRUZW1wbGF0ZUNvbHVtbnMpIHx8IDQwMDtcbiAgICB3cy5zdHlsZS5zZXRQcm9wZXJ0eSgnLS1lZGl0b3ItdycsIGAke01hdGgubWF4KDI0MCwgY3VyICsgKGUua2V5ID09PSAnQXJyb3dMZWZ0JyA/IC0yMCA6IDIwKSl9cHhgKTtcbiAgfSk7XG59XG5cbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gdG9hc3RcbmxldCB0b2FzdFRpbWVyID0gMDtcbmZ1bmN0aW9uIHRvYXN0KG1zZywgaXNFcnJvciA9IGZhbHNlKSB7XG4gIGNvbnN0IHQgPSAkKCcjdG9hc3QnKTtcbiAgdC50ZXh0Q29udGVudCA9IG1zZztcbiAgdC5jbGFzc0xpc3QudG9nZ2xlKCdlcnJvcicsIGlzRXJyb3IpO1xuICB0LmhpZGRlbiA9IGZhbHNlO1xuICBjbGVhclRpbWVvdXQodG9hc3RUaW1lcik7XG4gIHRvYXN0VGltZXIgPSBzZXRUaW1lb3V0KCgpID0+ICh0LmhpZGRlbiA9IHRydWUpLCBpc0Vycm9yID8gNDAwMCA6IDIyMDApO1xufVxuXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tIGJvb3RcbmNhbnZhc0VsLmNsYXNzTGlzdC50b2dnbGUoJ2dyaWQtb24nLCBzdGF0ZS5ncmlkKTtcbmNvbnN0IGluaXRpYWwgPSBzdG9yZS5nZXQoJ2NmLWxhc3QnKTtcbmlmIChpbml0aWFsICYmIGluaXRpYWwudHJpbSgpKSBzZXRUZXh0KGluaXRpYWwsIHsgZml0OiB0cnVlIH0pO1xuZWxzZSBzZXRDaXJjdWl0KFNBTVBMRVNbMF0sIHsgZml0OiB0cnVlIH0pO1xuc3luY1Rvb2xiYXIoKTtcbiJdLAogICJtYXBwaW5ncyI6ICI7OztBQUVPLFdBQVMsVUFBVSxNQUFNO0FBQzlCLFFBQUk7QUFDRixhQUFPLEVBQUUsT0FBTyxLQUFLLE1BQU0sSUFBSSxHQUFHLFFBQVEsQ0FBQyxFQUFFO0FBQUEsSUFDL0MsU0FBUyxHQUFHO0FBRVYsWUFBTSxRQUFRLGdCQUFnQixPQUFPLElBQUksQ0FBQztBQUMxQyxZQUFNLE1BQU0sUUFBUSxNQUFNLE1BQU07QUFDaEMsWUFBTSxTQUFTLE9B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O0FBQUEsTUFDQTtBQUFBLFFBQ0U7QUFBQSxRQUNBO0FBQUEsTUFDRjtBQUFBLE1BQ0E7QUFBQSxRQUNFO0FBQUEsUUFDQTtBQUFBLE1BQ0Y7QUFBQSxNQUNBO0FBQUEsUUFDRTtBQUFBLFFBQ0E7QUFBQSxNQUNGO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7OztBQ3pDQTtBQUFBLElBQ0UsT0FBUztBQUFBLElBQ1QsWUFBYztBQUFBLE1BQ1o7QUFBQSxRQUNFLElBQU07QUFBQSxRQUNOLE1BQVE7QUFBQSxRQUNSLE9BQVM7QUFBQSxNQUNYO0FBQUEsTUFDQTtBQUFBLFFBQ0UsSUFBTTtBQUFBLFFBQ04sTUFBUTtBQUFBLFFBQ1IsT0FBUztBQUFBLE1BQ1g7QUFBQSxNQUNBO0FBQUEsUUFDRSxJQUFNO0FBQUEsUUFDTixNQUFRO0FBQUEsUUFDUixPQUFTO0FBQUEsTUFDWDtBQUFBLE1BQ0E7QUFBQSxRQUNFLElBQU07QUFBQSxRQUNOLE1BQVE7QUFBQSxNQUNWO0FBQUEsTUFDQTtBQUFBLFFBQ0UsSUFBTTtBQUFBLFFBQ04sTUFBUTtBQUFBLE1BQ1Y7QUFBQSxJQUNGO0FBQUEsSUFDQSxhQUFlO0FBQUEsTUFDYjtBQUFBLFFBQ0U7QUFBQSxRQUNBO0FBQUEsTUFDRjtBQUFBLE1BQ0E7QUFBQSxRQUNFO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxNQUNGO0FBQUEsTUFDQTtBQUFBLFFBQ0U7QUFBQSxRQUNBO0FBQUEsTUFDRjtBQUFBLE1BQ0E7QUFBQSxRQUNFO0FBQUEsUUFDQTtBQUFBLE1BQ0Y7QUFBQSxJQUNGO0FBQUEsRUFDRjs7O0FDOUNBO0FBQUEsSUFDRSxPQUFTO0FBQUEsSUFDVCxZQUFjO0FBQUEsTUFDWjtBQUFBLFFBQ0UsSUFBTTtBQUFBLFFBQ04sTUFBUTtBQUFBLFFBQ1IsT0FBUztBQUFBLE1BQ1g7QUFBQSxNQUNBO0FBQUEsUUFDRSxJQUFNO0FBQUEsUUFDTixNQUFRO0FBQUEsTUFDVjtBQUFBLE1BQ0E7QUFBQSxRQUNFLElBQU07QUFBQSxRQUNOLE1BQVE7QUFBQSxRQUNSLE9BQVM7QUFBQSxNQUNYO0FBQUEsTUFDQTtBQUFBLFFBQ0UsSUFBTTtBQUFBLFFBQ04sTUFBUTtBQUFBLFFBQ1IsT0FBUztBQUFBLE1BQ1g7QUFBQSxNQUNBO0FBQUEsUUFDRSxJQUFNO0FBQUEsUUFDTixNQUFRO0FBQUEsTUFDVjtBQUFBLElBQ0Y7QUFBQSxJQUNBLGFBQWU7QUFBQSxNQUNiO0FBQUEsUUFDRTtBQUFBLFFBQ0E7QUFBQSxNQUNGO0FBQUEsTUFDQTtBQUFBLFFBQ0U7QUFBQSxRQUNBO0FBQUEsTUFDRjtBQUFBLE1BQ0E7QUFBQSxRQUNFO0FBQUEsUUFDQTtBQUFBLE1BQ0Y7QUFBQSxNQUNBO0FBQUEsUUFDRTtBQUFBLFFBQ0E7QUFBQSxNQUNGO0FBQUEsTUFDQTtBQUFBLFFBQ0U7QUFBQSxRQUNBO0FBQUEsTUFDRjtBQUFBLElBQ0Y7QUFBQSxFQUNGOzs7QUNqREE7QUFBQSxJQUNFLE9BQVM7QUFBQSxJQUNULFlBQWM7QUFBQSxNQUNaO0FBQUEsUUFDRSxJQUFNO0FBQUEsUUFDTixNQUFRO0FBQUEsUUFDUixPQUFTO0FBQUEsTUFDWDtBQUFBLE1BQ0E7QUFBQSxRQUNFLElBQU07QUFBQSxRQUNOLE1BQVE7QUFBQSxRQUNSLE9BQVM7QUFBQSxNQUNYO0FBQUEsTUFDQTtBQUFBLFFBQ0UsSUFBTTtBQUFBLFFBQ04sTUFBUTtBQUFBLFFBQ1IsT0FBUztBQUFBLE1BQ1g7QUFBQSxNQUNBO0FBQUEsUUFDRSxJQUFNO0FBQUEsUUFDTixNQUFRO0FBQUEsUUFDUixPQUFTO0FBQUEsTUFDWDtBQUFBLElBQ0Y7QUFBQSxJQUNBLGFBQWU7QUFBQSxNQUNiO0FBQUEsUUFDRTtBQUFBLFFBQ0E7QUFBQSxNQUNGO0FBQUEsTUFDQTtBQUFBLFFBQ0U7QUFBQSxRQUNBO0FBQUEsTUFDRjtBQUFBLE1BQ0E7QUFBQSxRQUNFO0FBQUEsUUFDQTtBQUFBLE1BQ0Y7QUFBQSxNQUNBO0FBQUEsUUFDRTtBQUFBLFFBQ0E7QUFBQSxNQUNGO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7OztBQzFDQTtBQUFBLElBQ0UsT0FBUztBQUFBLElBQ1QsWUFBYztBQUFBLE1BQ1o7QUFBQSxRQUNFLElBQU07QUFBQSxRQUNOLE1BQVE7QUFBQSxRQUNSLE9BQVM7QUFBQSxNQUNYO0FBQUEsTUFDQTtBQUFBLFFBQ0UsSUFBTTtBQUFBLFFBQ04sTUFBUTtBQUFBLFFBQ1IsT0FBUztBQUFBLE1BQ1g7QUFBQSxNQUNBO0FBQUEsUUFDRSxJQUFNO0FBQUEsUUFDTixNQUFRO0FBQUEsUUFDUixPQUFTO0FBQUEsTUFDWDtBQUFBLE1BQ0E7QUFBQSxRQUNFLElBQU07QUFBQSxRQUNOLE1BQVE7QUFBQSxRQUNSLE9BQVM7QUFBQSxNQUNYO0FBQUEsTUFDQTtBQUFBLFFBQ0UsSUFBTTtBQUFBLFFBQ04sTUFBUTtBQUFBLE1BQ1Y7QUFBQSxNQUNBO0FBQUEsUUFDRSxJQUFNO0FBQUEsUUFDTixNQUFRO0FBQUEsTUFDVjtBQUFBLElBQ0Y7QUFBQSxJQUNBLGFBQWU7QUFBQSxNQUNiO0FBQUEsUUFDRTtBQUFBLFFBQ0E7QUFBQSxNQUNGO0FBQUEsTUFDQTtBQUFBLFFBQ0U7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxNQUNGO0FBQUEsTUFDQTtBQUFBLFFBQ0U7QUFBQSxRQUNBO0FBQUEsTUFDRjtBQUFBLE1BQ0E7QUFBQSxRQUNFO0FBQUEsUUFDQTtBQUFBLE1BQ0Y7QUFBQSxNQUNBO0FBQUEsUUFDRTtBQUFBLFFBQ0E7QUFBQSxNQUNGO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7OztBQ3hEQTtBQUFBLElBQ0UsT0FBUztBQUFBLElBQ1QsWUFBYztBQUFBLE1BQ1o7QUFBQSxRQUNFLElBQU07QUFBQSxRQUNOLE1BQVE7QUFBQSxRQUNSLE9BQVM7QUFBQSxNQUNYO0FBQUEsTUFDQTtBQUFBLFFBQ0UsSUFBTTtBQUFBLFFBQ04sTUFBUTtBQUFBLFFBQ1IsT0FBUztBQUFBLE1BQ1g7QUFBQSxNQUNBO0FBQUEsUUFDRSxJQUFNO0FBQUEsUUFDTixNQUFRO0FBQUEsUUFDUixPQUFTO0FBQUEsTUFDWDtBQUFBLE1BQ0E7QUFBQSxRQUNFLElBQU07QUFBQSxRQUNOLE1BQVE7QUFBQSxRQUNSLE9BQVM7QUFBQSxNQUNYO0FBQUEsTUFDQTtBQUFBLFFBQ0UsSUFBTTtBQUFBLFFBQ04sTUFBUTtBQUFBLFFBQ1IsT0FBUztBQUFBLE1BQ1g7QUFBQSxNQUNBO0FBQUEsUUFDRSxJQUFNO0FBQUEsUUFDTixNQUFRO0FBQUEsUUFDUixPQUFTO0FBQUEsTUFDWDtBQUFBLE1BQ0E7QUFBQSxRQUNFLElBQU07QUFBQSxRQUNOLE1BQVE7QUFBQSxRQUNSLE9BQVM7QUFBQSxNQUNYO0FBQUEsTUFDQTtBQUFBLFFBQ0UsSUFBTTtBQUFBLFFBQ04sTUFBUTtBQUFBLFFBQ1IsT0FBUztBQUFBLE1BQ1g7QUFBQSxNQUNBO0FBQUEsUUFDRSxJQUFNO0FBQUEsUUFDTixNQUFRO0FBQUEsUUFDUixPQUFTO0FBQUEsTUFDWDtBQUFBLE1BQ0E7QUFBQSxRQUNFLElBQU07QUFBQSxRQUNOLE1BQVE7QUFBQSxRQUNSLE9BQVM7QUFBQSxNQUNYO0FBQUEsTUFDQTtBQUFBLFFBQ0UsSUFBTTtBQUFBLFFBQ04sTUFBUTtBQUFBLE1BQ1Y7QUFBQSxJQUNGO0FBQUEsSUFDQSxhQUFlO0FBQUEsTUFDYjtBQUFBLFFBQ0U7QUFBQSxRQUNBO0FBQUEsTUFDRjtBQUFBLE1BQ0E7QUFBQSxRQUNFO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsTUFDRjtBQUFBLE1BQ0E7QUFBQSxRQUNFO0FBQUEsUUFDQTtBQUFBLE1BQ0Y7QUFBQSxNQUNBO0FBQUEsUUFDRTtBQUFBLFFBQ0E7QUFBQSxNQUNGO0FBQUEsTUFDQTtBQUFBLFFBQ0U7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLE1BQ0Y7QUFBQSxNQUNBO0FBQUEsUUFDRTtBQUFBLFFBQ0E7QUFBQSxNQUNGO0FBQUEsTUFDQTtBQUFBLFFBQ0U7QUFBQSxRQUNBO0FBQUEsTUFDRjtBQUFBLE1BQ0E7QUFBQSxRQUNFO0FBQUEsUUFDQTtBQUFBLE1BQ0Y7QUFBQSxNQUNBO0FBQUEsUUFDRTtBQUFBLFFBQ0E7QUFBQSxNQUNGO0FBQUEsTUFDQTtBQUFBLFFBQ0U7QUFBQSxRQUNBO0FBQUEsTUFDRjtBQUFBLE1BQ0E7QUFBQSxRQUNFO0FBQUEsUUFDQTtBQUFBLE1BQ0Y7QUFBQSxJQUNGO0FBQUEsRUFDRjs7O0FDM0dBO0FBQUEsSUFDRSxPQUFTO0FBQUEsSUFDVCxZQUFjO0FBQUEsTUFDWjtBQUFBLFFBQ0UsSUFBTTtBQUFBLFFBQ04sTUFBUTtBQUFBLE1BQ1Y7QUFBQSxNQUNBO0FBQUEsUUFDRSxJQUFNO0FBQUEsUUFDTixNQUFRO0FBQUEsUUFDUixPQUFTO0FBQUEsTUFDWDtBQUFBLE1BQ0E7QUFBQSxRQUNFLElBQU07QUFBQSxRQUNOLE1BQVE7QUFBQSxRQUNSLE9BQVM7QUFBQSxNQUNYO0FBQUEsTUFDQTtBQUFBLFFBQ0UsSUFBTTtBQUFBLFFBQ04sTUFBUTtBQUFBLFFBQ1IsT0FBUztBQUFBLE1BQ1g7QUFBQSxNQUNBO0FBQUEsUUFDRSxJQUFNO0FBQUEsUUFDTixNQUFRO0FBQUEsUUFDUixPQUFTO0FBQUEsTUFDWDtBQUFBLE1BQ0E7QUFBQSxRQUNFLElBQU07QUFBQSxRQUNOLE1BQVE7QUFBQSxRQUNSLE9BQVM7QUFBQSxNQUNYO0FBQUEsTUFDQTtBQUFBLFFBQ0UsSUFBTTtBQUFBLFFBQ04sTUFBUTtBQUFBLFFBQ1IsT0FBUztBQUFBLE1BQ1g7QUFBQSxNQUNBO0FBQUEsUUFDRSxJQUFNO0FBQUEsUUFDTixNQUFRO0FBQUEsTUFDVjtBQUFBLElBQ0Y7QUFBQSxJQUNBLGFBQWU7QUFBQSxNQUNiO0FBQUEsUUFDRTtBQUFBLFFBQ0E7QUFBQSxNQUNGO0FBQUEsTUFDQTtBQUFBLFFBQ0U7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLE1BQ0Y7QUFBQSxNQUNBO0FBQUEsUUFDRTtBQUFBLFFBQ0E7QUFBQSxNQUNGO0FBQUEsTUFDQTtBQUFBLFFBQ0U7QUFBQSxRQUNBO0FBQUEsTUFDRjtBQUFBLE1BQ0E7QUFBQSxRQUNFO0FBQUEsUUFDQTtBQUFBLE1BQ0Y7QUFBQSxNQUNBO0FBQUEsUUFDRTtBQUFBLFFBQ0E7QUFBQSxNQUNGO0FBQUEsTUFDQTtBQUFBLFFBQ0U7QUFBQSxRQUNBO0FBQUEsTUFDRjtBQUFBLElBQ0Y7QUFBQSxFQUNGOzs7QUN6RUE7QUFBQSxJQUNFLE9BQVM7QUFBQSxJQUNULFlBQWM7QUFBQSxNQUNaO0FBQUEsUUFDRSxJQUFNO0FBQUEsUUFDTixNQUFRO0FBQUEsUUFDUixPQUFTO0FBQUEsTUFDWDtBQUFBLE1BQ0E7QUFBQSxRQUNFLElBQU07QUFBQSxRQUNOLE1BQVE7QUFBQSxRQUNSLE9BQVM7QUFBQSxNQUNYO0FBQUEsTUFDQTtBQUFBLFFBQ0UsSUFBTTtBQUFBLFFBQ04sTUFBUTtBQUFBLFFBQ1IsT0FBUztBQUFBLE1BQ1g7QUFBQSxNQUNBO0FBQUEsUUFDRSxJQUFNO0FBQUEsUUFDTixNQUFRO0FBQUEsUUFDUixPQUFTO0FBQUEsTUFDWDtBQUFBLE1BQ0E7QUFBQSxRQUNFLElBQU07QUFBQSxRQUNOLE1BQVE7QUFBQSxNQUNWO0FBQUEsTUFDQTtBQUFBLFFBQ0UsSUFBTTtBQUFBLFFBQ04sTUFBUTtBQUFBLE1BQ1Y7QUFBQSxJQUNGO0FBQUEsSUFDQSxhQUFlO0FBQUEsTUFDYjtBQUFBLFFBQ0U7QUFBQSxRQUNBO0FBQUEsTUFDRjtBQUFBLE1BQ0E7QUFBQSxRQUNFO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxNQUNGO0FBQUEsTUFDQTtBQUFBLFFBQ0U7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLE1BQ0Y7QUFBQSxNQUNBO0FBQUEsUUFDRTtBQUFBLFFBQ0E7QUFBQSxNQUNGO0FBQUEsTUFDQTtBQUFBLFFBQ0U7QUFBQSxRQUNBO0FBQUEsTUFDRjtBQUFBLElBQ0Y7QUFBQSxFQUNGOzs7QUN4REE7QUFBQSxJQUNFLE9BQVM7QUFBQSxJQUNULFlBQWM7QUFBQSxNQUNaO0FBQUEsUUFDRSxJQUFNO0FBQUEsUUFDTixNQUFRO0FBQUEsTUFDVjtBQUFBLE1BQ0E7QUFBQSxRQUNFLElBQU07QUFBQSxRQUNOLE1BQVE7QUFBQSxNQUNWO0FBQUEsTUFDQTtBQUFBLFFBQ0UsSUFBTTtBQUFBLFFBQ04sTUFBUTtBQUFBLE1BQ1Y7QUFBQSxNQUNBO0FBQUEsUUFDRSxJQUFNO0FBQUEsUUFDTixNQUFRO0FBQUEsTUFDVjtBQUFBLE1BQ0E7QUFBQSxRQUNFLElBQU07QUFBQSxRQUNOLE1BQVE7QUFBQSxNQUNWO0FBQUEsTUFDQTtBQUFBLFFBQ0UsSUFBTTtBQUFBLFFBQ04sTUFBUTtBQUFBLE1BQ1Y7QUFBQSxNQUNBO0FBQUEsUUFDRSxJQUFNO0FBQUEsUUFDTixNQUFRO0FBQUEsTUFDVjtBQUFBLE1BQ0E7QUFBQSxRQUNFLElBQU07QUFBQSxRQUNOLE1BQVE7QUFBQSxNQUNWO0FBQUEsTUFDQTtBQUFBLFFBQ0UsSUFBTTtBQUFBLFFBQ04sTUFBUTtBQUFBLE1BQ1Y7QUFBQSxNQUNBO0FBQUEsUUFDRSxJQUFNO0FBQUEsUUFDTixNQUFRO0FBQUEsTUFDVjtBQUFBLElBQ0Y7QUFBQSxJQUNBLGFBQWU7QUFBQSxNQUNiO0FBQUEsUUFDRTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsTUFDRjtBQUFBLE1BQ0E7QUFBQSxRQUNFO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxNQUNGO0FBQUEsTUFDQTtBQUFBLFFBQ0U7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLE1BQ0Y7QUFBQSxNQUNBO0FBQUEsUUFDRTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsTUFDRjtBQUFBLE1BQ0E7QUFBQSxRQUNFO0FBQUEsUUFDQTtBQUFBLE1BQ0Y7QUFBQSxNQUNBO0FBQUEsUUFDRTtBQUFBLFFBQ0E7QUFBQSxNQUNGO0FBQUEsTUFDQTtBQUFBLFFBQ0U7QUFBQSxRQUNBO0FBQUEsTUFDRjtBQUFBLE1BQ0E7QUFBQSxRQUNFO0FBQUEsUUFDQTtBQUFBLE1BQ0Y7QUFBQSxJQUNGO0FBQUEsRUFDRjs7O0FDbEZBO0FBQUEsSUFDRSxPQUFTO0FBQUEsSUFDVCxZQUFjO0FBQUEsTUFDWjtBQUFBLFFBQ0UsSUFBTTtBQUFBLFFBQ04sTUFBUTtBQUFBLE1BQ1Y7QUFBQSxNQUNBO0FBQUEsUUFDRSxJQUFNO0FBQUEsUUFDTixNQUFRO0FBQUEsTUFDVjtBQUFBLE1BQ0E7QUFBQSxRQUNFLElBQU07QUFBQSxRQUNOLE1BQVE7QUFBQSxNQUNWO0FBQUEsTUFDQTtBQUFBLFFBQ0UsSUFBTTtBQUFBLFFBQ04sTUFBUTtBQUFBLE1BQ1Y7QUFBQSxNQUNBO0FBQUEsUUFDRSxJQUFNO0FBQUEsUUFDTixNQUFRO0FBQUEsTUFDVjtBQUFBLElBQ0Y7QUFBQSxJQUNBLGFBQWU7QUFBQSxNQUNiO0FBQUEsUUFDRTtBQUFBLFFBQ0E7QUFBQSxNQUNGO0FBQUEsTUFDQTtBQUFBLFFBQ0U7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLE1BQ0Y7QUFBQSxNQUNBO0FBQUEsUUFDRTtBQUFBLFFBQ0E7QUFBQSxNQUNGO0FBQUEsTUFDQTtBQUFBLFFBQ0U7QUFBQSxRQUNBO0FBQUEsTUFDRjtBQUFBLE1BQ0E7QUFBQSxRQUNFO0FBQUEsUUFDQTtBQUFBLE1BQ0Y7QUFBQSxJQUNGO0FBQUEsRUFDRjs7O0FDL0NBO0FBQUEsSUFDRSxPQUFTO0FBQUEsSUFDVCxZQUFjO0FBQUEsTUFDWjtBQUFBLFFBQ0UsSUFBTTtBQUFBLFFBQ04sTUFBUTtBQUFBLFFBQ1IsT0FBUztBQUFBLE1BQ1g7QUFBQSxNQUNBO0FBQUEsUUFDRSxJQUFNO0FBQUEsUUFDTixNQUFRO0FBQUEsUUFDUixPQUFTO0FBQUEsTUFDWDtBQUFBLE1BQ0E7QUFBQSxRQUNFLElBQU07QUFBQSxRQUNOLE1BQVE7QUFBQSxRQUNSLE9BQVM7QUFBQSxNQUNYO0FBQUEsTUFDQTtBQUFBLFFBQ0UsSUFBTTtBQUFBLFFBQ04sTUFBUTtBQUFBLFFBQ1IsT0FBUztBQUFBLE1BQ1g7QUFBQSxNQUNBO0FBQUEsUUFDRSxJQUFNO0FBQUEsUUFDTixNQUFRO0FBQUEsUUFDUixPQUFTO0FBQUEsTUFDWDtBQUFBLE1BQ0E7QUFBQSxRQUNFLElBQU07QUFBQSxRQUNOLE1BQVE7QUFBQSxRQUNSLE9BQVM7QUFBQSxNQUNYO0FBQUEsTUFDQTtBQUFBLFFBQ0UsSUFBTTtBQUFBLFFBQ04sTUFBUTtBQUFBLE1BQ1Y7QUFBQSxNQUNBO0FBQUEsUUFDRSxJQUFNO0FBQUEsUUFDTixNQUFRO0FBQUEsUUFDUixPQUFTO0FBQUEsTUFDWDtBQUFBLE1BQ0E7QUFBQSxRQUNFLElBQU07QUFBQSxRQUNOLE1BQVE7QUFBQSxNQUNWO0FBQUEsSUFDRjtBQUFBLElBQ0EsYUFBZTtBQUFBLE1BQ2I7QUFBQSxRQUNFO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsTUFDRjtBQUFBLE1BQ0E7QUFBQSxRQUNFO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxNQUNGO0FBQUEsTUFDQTtBQUFBLFFBQ0U7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxNQUNGO0FBQUEsTUFDQTtBQUFBLFFBQ0U7QUFBQSxRQUNBO0FBQUEsTUFDRjtBQUFBLE1BQ0E7QUFBQSxRQUNFO0FBQUEsUUFDQTtBQUFBLE1BQ0Y7QUFBQSxNQUNBO0FBQUEsUUFDRTtBQUFBLFFBQ0E7QUFBQSxNQUNGO0FBQUEsTUFDQTtBQUFBLFFBQ0U7QUFBQSxRQUNBO0FBQUEsTUFDRjtBQUFBLE1BQ0E7QUFBQSxRQUNFO0FBQUEsUUFDQTtBQUFBLE1BQ0Y7QUFBQSxNQUNBO0FBQUEsUUFDRTtBQUFBLFFBQ0E7QUFBQSxNQUNGO0FBQUEsTUFDQTtBQUFBLFFBQ0U7QUFBQSxRQUNBO0FBQUEsTUFDRjtBQUFBLElBQ0Y7QUFBQSxFQUNGOzs7QUM5RkE7QUFBQSxJQUNFLE9BQVM7QUFBQSxJQUNULFlBQWM7QUFBQSxNQUNaO0FBQUEsUUFDRSxJQUFNO0FBQUEsUUFDTixNQUFRO0FBQUEsUUFDUixPQUFTO0FBQUEsUUFDVCxNQUFRO0FBQUEsVUFDTixNQUFRO0FBQUEsWUFDTjtBQUFBLFlBQ0E7QUFBQSxZQUNBO0FBQUEsWUFDQTtBQUFBLFlBQ0E7QUFBQSxVQUNGO0FBQUEsVUFDQSxPQUFTO0FBQUEsWUFDUDtBQUFBLFlBQ0E7QUFBQSxZQUNBO0FBQUEsWUFDQTtBQUFBLFVBQ0Y7QUFBQSxVQUNBLEtBQU87QUFBQSxZQUNMO0FBQUEsVUFDRjtBQUFBLFVBQ0EsUUFBVTtBQUFBLFlBQ1I7QUFBQSxVQUNGO0FBQUEsUUFDRjtBQUFBLE1BQ0Y7QUFBQSxNQUNBO0FBQUEsUUFDRSxJQUFNO0FBQUEsUUFDTixNQUFRO0FBQUEsTUFDVjtBQUFBLE1BQ0E7QUFBQSxRQUNFLElBQU07QUFBQSxRQUNOLE1BQVE7QUFBQSxNQUNWO0FBQUEsTUFDQTtBQUFBLFFBQ0UsSUFBTTtBQUFBLFFBQ04sTUFBUTtBQUFBLE1BQ1Y7QUFBQSxNQUNBO0FBQUEsUUFDRSxJQUFNO0FBQUEsUUFDTixNQUFRO0FBQUEsUUFDUixPQUFTO0FBQUEsTUFDWDtBQUFBLE1BQ0E7QUFBQSxRQUNFLElBQU07QUFBQSxRQUNOLE1BQVE7QUFBQSxRQUNSLE9BQVM7QUFBQSxNQUNYO0FBQUEsTUFDQTtBQUFBLFFBQ0UsSUFBTTtBQUFBLFFBQ04sTUFBUTtBQUFBLE1BQ1Y7QUFBQSxNQUNBO0FBQUEsUUFDRSxJQUFNO0FBQUEsUUFDTixNQUFRO0FBQUEsTUFDVjtBQUFBLE1BQ0E7QUFBQSxRQUNFLElBQU07QUFBQSxRQUNOLE1BQVE7QUFBQSxRQUNSLE9BQVM7QUFBQSxNQUNYO0FBQUEsTUFDQTtBQUFBLFFBQ0UsSUFBTTtBQUFBLFFBQ04sTUFBUTtBQUFBLE1BQ1Y7QUFBQSxJQUNGO0FBQUEsSUFDQSxhQUFlO0FBQUEsTUFDYjtBQUFBLFFBQ0U7QUFBQSxRQUNBO0FBQUEsTUFDRjtBQUFBLE1BQ0E7QUFBQSxRQUNFO0FBQUEsUUFDQTtBQUFBLE1BQ0Y7QUFBQSxNQUNBO0FBQUEsUUFDRTtBQUFBLFFBQ0E7QUFBQSxNQUNGO0FBQUEsTUFDQTtBQUFBLFFBQ0U7QUFBQSxRQUNBO0FBQUEsTUFDRjtBQUFBLE1BQ0E7QUFBQSxRQUNFO0FBQUEsUUFDQTtBQUFBLE1BQ0Y7QUFBQSxNQUNBO0FBQUEsUUFDRTtBQUFBLFFBQ0E7QUFBQSxNQUNGO0FBQUEsTUFDQTtBQUFBLFFBQ0U7QUFBQSxRQUNBO0FBQUEsTUFDRjtBQUFBLE1BQ0E7QUFBQSxRQUNFO0FBQUEsUUFDQTtBQUFBLE1BQ0Y7QUFBQSxNQUNBO0FBQUEsUUFDRTtBQUFBLFFBQ0E7QUFBQSxNQUNGO0FBQUEsTUFDQTtBQUFBLFFBQ0U7QUFBQSxRQUNBO0FBQUEsTUFDRjtBQUFBLE1BQ0E7QUFBQSxRQUNFO0FBQUEsUUFDQTtBQUFBLE1BQ0Y7QUFBQSxNQUNBO0FBQUEsUUFDRTtBQUFBLFFBQ0E7QUFBQSxNQUNGO0FBQUEsTUFDQTtBQUFBLFFBQ0U7QUFBQSxRQUNBO0FBQUEsTUFDRjtBQUFBLElBQ0Y7QUFBQSxFQUNGOzs7QUMzSEE7QUFBQSxJQUNFLE9BQVM7QUFBQSxJQUNULFlBQWM7QUFBQSxNQUNaO0FBQUEsUUFDRSxJQUFNO0FBQUEsUUFDTixNQUFRO0FBQUEsUUFDUixPQUFTO0FBQUEsTUFDWDtBQUFBLE1BQ0E7QUFBQSxRQUNFLElBQU07QUFBQSxRQUNOLE1BQVE7QUFBQSxRQUNSLE9BQVM7QUFBQSxNQUNYO0FBQUEsTUFDQTtBQUFBLFFBQ0UsSUFBTTtBQUFBLFFBQ04sTUFBUTtBQUFBLFFBQ1IsT0FBUztBQUFBLE1BQ1g7QUFBQSxNQUNBO0FBQUEsUUFDRSxJQUFNO0FBQUEsUUFDTixNQUFRO0FBQUEsUUFDUixPQUFTO0FBQUEsTUFDWDtBQUFBLE1BQ0E7QUFBQSxRQUNFLElBQU07QUFBQSxRQUNOLE1BQVE7QUFBQSxRQUNSLE9BQVM7QUFBQSxNQUNYO0FBQUEsTUFDQTtBQUFBLFFBQ0UsSUFBTTtBQUFBLFFBQ04sTUFBUTtBQUFBLFFBQ1IsT0FBUztBQUFBLE1BQ1g7QUFBQSxNQUNBO0FBQUEsUUFDRSxJQUFNO0FBQUEsUUFDTixNQUFRO0FBQUEsUUFDUixPQUFTO0FBQUEsTUFDWDtBQUFBLE1BQ0E7QUFBQSxRQUNFLElBQU07QUFBQSxRQUNOLE1BQVE7QUFBQSxNQUNWO0FBQUEsTUFDQTtBQUFBLFFBQ0UsSUFBTTtBQUFBLFFBQ04sTUFBUTtBQUFBLFFBQ1IsT0FBUztBQUFBLE1BQ1g7QUFBQSxNQUNBO0FBQUEsUUFDRSxJQUFNO0FBQUEsUUFDTixNQUFRO0FBQUEsUUFDUixPQUFTO0FBQUEsTUFDWDtBQUFBLE1BQ0E7QUFBQSxRQUNFLElBQU07QUFBQSxRQUNOLE1BQVE7QUFBQSxNQUNWO0FBQUEsSUFDRjtBQUFBLElBQ0EsYUFBZTtBQUFBLE1BQ2I7QUFBQSxRQUNFO0FBQUEsUUFDQTtBQUFBLE1BQ0Y7QUFBQSxNQUNBO0FBQUEsUUFDRTtBQUFBLFFBQ0E7QUFBQSxNQUNGO0FBQUEsTUFDQTtBQUFBLFFBQ0U7QUFBQSxRQUNBO0FBQUEsTUFDRjtBQUFBLE1BQ0E7QUFBQSxRQUNFO0FBQUEsUUFDQTtBQUFBLE1BQ0Y7QUFBQSxNQUNBO0FBQUEsUUFDRTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsTUFDRjtBQUFBLE1BQ0E7QUFBQSxRQUNFO0FBQUEsUUFDQTtBQUFBLE1BQ0Y7QUFBQSxNQUNBO0FBQUEsUUFDRTtBQUFBLFFBQ0E7QUFBQSxNQUNGO0FBQUEsTUFDQTtBQUFBLFFBQ0U7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLE1BQ0Y7QUFBQSxNQUNBO0FBQUEsUUFDRTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsTUFDRjtBQUFBLE1BQ0E7QUFBQSxRQUNFO0FBQUEsUUFDQTtBQUFBLE1BQ0Y7QUFBQSxNQUNBO0FBQUEsUUFDRTtBQUFBLFFBQ0E7QUFBQSxNQUNGO0FBQUEsTUFDQTtBQUFBLFFBQ0U7QUFBQSxRQUNBO0FBQUEsTUFDRjtBQUFBLE1BQ0E7QUFBQSxRQUNFO0FBQUEsUUFDQTtBQUFBLE1BQ0Y7QUFBQSxNQUNBO0FBQUEsUUFDRTtBQUFBLFFBQ0E7QUFBQSxNQUNGO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7OztBQ3RIQTtBQUFBLElBQ0UsT0FBUztBQUFBLElBQ1QsWUFBYztBQUFBLE1BQ1o7QUFBQSxRQUNFLElBQU07QUFBQSxRQUNOLE1BQVE7QUFBQSxRQUNSLE9BQVM7QUFBQSxNQUNYO0FBQUEsTUFDQTtBQUFBLFFBQ0UsSUFBTTtBQUFBLFFBQ04sTUFBUTtBQUFBLFFBQ1IsT0FBUztBQUFBLE1BQ1g7QUFBQSxNQUNBO0FBQUEsUUFDRSxJQUFNO0FBQUEsUUFDTixNQUFRO0FBQUEsUUFDUixPQUFTO0FBQUEsTUFDWDtBQUFBLE1BQ0E7QUFBQSxRQUNFLElBQU07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LENBQUM7QUFDOUQsV0FBRyxNQUFNLFlBQVksY0FBYyxHQUFHLENBQUMsSUFBSTtBQUFBLE1BQzdDO0FBQ0EsWUFBTSxLQUFLLE1BQU07QUFDZixXQUFHLFVBQVUsT0FBTyxVQUFVO0FBQzlCLFdBQUcsb0JBQW9CLGVBQWUsSUFBSTtBQUMxQyxjQUFNLElBQUksZUFBZSxHQUFHLE1BQU0saUJBQWlCLFlBQVksQ0FBQztBQUFBLE1BQ2xFO0FBQ0EsU0FBRyxpQkFBaUIsZUFBZSxJQUFJO0FBQ3ZDLFNBQUcsaUJBQWlCLGFBQWEsSUFBSSxFQUFFLE1BQU0sS0FBSyxDQUFDO0FBQUEsSUFDckQsQ0FBQztBQUNELE9BQUcsaUJBQWlCLFdBQVcsQ0FBQyxNQUFNO0FBQ3BDLFVBQUksRUFBRSxRQUFRLGVBQWUsRUFBRSxRQUFRLGFBQWM7QUFDckQsWUFBTSxNQUFNLFdBQVcsaUJBQWlCLEVBQUUsRUFBRSxtQkFBbUIsS0FBSztBQUNwRSxTQUFHLE1BQU0sWUFBWSxjQUFjLEdBQUcsS0FBSyxJQUFJLEtBQUssT0FBTyxFQUFFLFFBQVEsY0FBYyxNQUFNLEdBQUcsQ0FBQyxJQUFJO0FBQUEsSUFDbkcsQ0FBQztBQUFBLEVBQ0g7QUFHQSxNQUFJLGFBQWE7QUFDakIsV0FBUyxNQUFNLEtBQUssVUFBVSxPQUFPO0FBQ25DLFVBQU0sSUFBSSxFQUFFLFFBQVE7QUFDcEIsTUFBRSxjQUFjO0FBQ2hCLE1BQUUsVUFBVSxPQUFPLFNBQVMsT0FBTztBQUNuQyxNQUFFLFNBQVM7QUFDWCxpQkFBYSxVQUFVO0FBQ3ZCLGlCQUFhLFdBQVcsTUFBTyxFQUFFLFNBQVMsTUFBTyxVQUFVLE1BQU8sSUFBSTtBQUFBLEVBQ3hFO0FBR0EsV0FBUyxVQUFVLE9BQU8sV0FBVyxNQUFNLElBQUk7QUFDL0MsTUFBTSxVQUFVLE1BQU0sSUFBSSxTQUFTO0FBQ25DLE1BQUksV0FBVyxRQUFRLEtBQUssRUFBRyxTQUFRLFNBQVMsRUFBRSxLQUFLLEtBQUssQ0FBQztBQUFBLE1BQ3hELFlBQVcsUUFBUSxDQUFDLEdBQUcsRUFBRSxLQUFLLEtBQUssQ0FBQztBQUN6QyxjQUFZOyIsCiAgIm5hbWVzIjogWyJuIiwgIlIiLCAibGFiZWwiLCAibiIsICJuIiwgImQiLCAibiIsICJveCIsICJzdGF0ZSIsICJjeCIsICJjeSIsICJuIiwgInAiLCAibiIsICJlc2MiLCAibiIsICJuIiwgImVzYyIsICJjYW52YXMiLCAib25EcmFnTW92ZSIsICJvbkRyYWdFbmQiLCAibiIsICJlc2MiLCAibiIsICJfYSIsICJsYWJlbCJdCn0K
