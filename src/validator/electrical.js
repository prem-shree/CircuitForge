// Electrical design checks over the net graph (never over the drawing).
// Every finding carries a student-facing explanation and, where it helps, the
// formula to apply. Severities can be tuned per circuit:
//   "validation": { "rules": { "LED_NO_CURRENT_LIMIT": "error" }, "supplyVoltage": 5 }
import { parseValue, formatValue, railVoltage } from '../utils/units.js';

const DEFAULTS = {
  // wiring
  DANGLING_NET: 'warning',
  SHORTED_COMPONENT: 'warning',
  SHORT_POWER_GROUND: 'error',
  WIRE_THROUGH_COMPONENT: 'warning',
  WIRE_OVERLAP: 'warning',
  // analog
  LED_NO_CURRENT_LIMIT: 'warning',
  DIODE_REVERSED: 'error',
  POLARIZED_CAP_REVERSED: 'error',
  MISSING_GROUND: 'warning',
  RESISTOR_POWER: 'warning',
  TRANSISTOR_SHORTED: 'error',
  TRANSISTOR_CONTROL_FLOATING: 'warning',
  OPAMP_SUPPLY_REVERSED: 'error',
  OPAMP_SUPPLY_MISSING: 'info',
  SOURCE_SHORTED: 'error',
  REGULATOR_IO: 'error',
  // digital
  OUTPUT_CONFLICT: 'error',
  OUTPUT_TIED_TO_RAIL: 'error',
  FLOATING_INPUT: 'warning',
  IC_MISSING_POWER: 'warning',
  CLOCK_TIED_TO_RAIL: 'warning',
  COMBINATIONAL_LOOP: 'warning',
};

const CURRENT_LIMITERS = new Set(['resistor', 'variable_resistor', 'potentiometer', 'photoresistor', 'lamp', 'motor', 'buzzer', 'speaker', 'relay', 'inductor', 'fuse', 'ldo', 'voltage_regulator', 'motor_driver']);
const DRIVERS = new Set(['out', 'power_out']);
const SHARED_BUS = new Set(['tristate', 'open_collector', 'open_drain', 'bidirectional', 'passive']);

export function checkElectrical({ circuit = {}, netlist, routing = null }) {
  const cfg = (circuit.validation && typeof circuit.validation === 'object') ? circuit.validation : {};
  const levels = { ...DEFAULTS, ...(cfg.rules && typeof cfg.rules === 'object' ? cfg.rules : {}) };
  const findings = [];
  const add = (code, message, extra = {}) => {
    const severity = levels[code] ?? 'warning';
    if (severity === 'off') return;
    findings.push({ code, severity, message, ...extra });
  };

  const { parts, nets } = netlist;
  const byId = new Map(parts.map((p) => [p.id, p]));
  const net = (id) => nets.get(id);
  const kind = (id) => net(id)?.rail?.kind || null;
  const isGround = (id) => id && (kind(id) === 'ground' || kind(id) === 'negative' || id === netlist.returnNet);
  const isPower = (id) => id && kind(id) === 'power';
  const pinIO = (p, pin) => p.sym.pins[pin]?.io || 'passive';
  const nameOf = (p) => `${p.comp.label ?? p.id}`;

  const supply = Number.isFinite(cfg.supplyVoltage) ? cfg.supplyVoltage
    : [...nets.values()].map((n) => railVoltage(n.rail?.name)).find((v) => Number.isFinite(v) && v > 0)
      ?? parts.filter((p) => p.sym.source).map((p) => parseValue(p.comp.value)).find((v) => Number.isFinite(v) && v > 0)
      ?? null;

  // Walk a series chain out of one pin: follow two-terminal parts until a rail,
  // a node with more than two pins, or a multi-pin part is reached.
  function series(startPart, startPin) {
    const seen = new Set();
    let netId = startPart.pinNets[startPin];
    const chain = [];
    for (let i = 0; i < 24 && netId; i++) {
      if (isGround(netId)) return { end: 'ground', chain, netId };
      if (isPower(netId)) return { end: 'power', chain, netId };
      const others = net(netId)?.pins.filter((e) => !(e.comp === startPart.id && i === 0)) || [];
      const next = others.filter((e) => !seen.has(`${e.comp}.${e.pin}`));
      if (next.length !== 1) return { end: next.length ? 'node' : 'open', chain, netId };
      const e = next[0];
      const p = byId.get(e.comp);
      if (!p) return { end: 'open', chain, netId };
      seen.add(`${e.comp}.${e.pin}`);
      if (p.sym.source) return { end: p.pinNets.positive === netId ? 'source+' : 'source-', chain, netId, part: p };
      if (!p.sym.twoTerminal) return { end: 'part', chain, netId, part: p };
      chain.push(p);
      const other = p.sym.pinOrder.find((x) => x !== e.pin);
      seen.add(`${p.id}.${other}`);
      netId = p.pinNets[other];
      startPart = p;
    }
    return { end: 'open', chain, netId };
  }
  const hasLimiter = (walk) => walk.chain.some((p) => CURRENT_LIMITERS.has(p.sym.type));
  const toPositive = (w) => w.end === 'power' || w.end === 'source+';
  const toNegative = (w) => w.end === 'ground' || w.end === 'source-';

  // ---------------------------------------------------------------- wiring
  for (const [id, n] of nets) {
    if (!n.rail && n.pins.length === 1) {
      const e = n.pins[0];
      add('DANGLING_NET', `${e.comp}.${e.pin} is the only thing on net ${n.name || id}: this wire does not go anywhere.`, {
        component: e.comp, pin: e.pin, net: id,
        hint: 'Every net needs at least two endpoints. Connect it to another pin, a rail or a net label.',
      });
    }
    const kinds = new Set((n.rails || []).map((r) => r.kind));
    if ((kinds.has('ground') || kinds.has('negative')) && kinds.has('power')) {
      add('SHORT_POWER_GROUND', `Net ${n.name || id} connects a supply rail to ground: that is a short circuit.`, {
        net: id, hint: 'Remove one of the rail symbols, or put a component between supply and ground.',
      });
    }
  }
  for (const p of parts) {
    if (!p.sym.twoTerminal) continue;
    const [a, b] = p.sym.pinOrder;
    if (p.pinNets[a] && p.pinNets[a] === p.pinNets[b]) {
      const code = p.sym.source ? 'SOURCE_SHORTED' : 'SHORTED_COMPONENT';
      add(code, `${nameOf(p)} has both pins on the same net, so it is shorted out.`, {
        component: p.id, hint: p.sym.source ? 'A shorted source delivers unlimited current. Put the load between + and −.' : 'Current will bypass this part completely.',
      });
    }
  }
  for (const v of routing?.violations || []) {
    if (v.code === 'WIRE_THROUGH_COMPONENT') {
      add('WIRE_THROUGH_COMPONENT', `A wire on net ${v.net} runs across ${v.comp}.`, { net: v.net, component: v.comp, hint: 'Move the part, or give that connection waypoints so the router takes another path.' });
    } else {
      add('WIRE_OVERLAP', `Wires of nets ${v.net} and ${v.other} run on top of each other, which reads as a connection.`, { net: v.net, hint: 'Move a part so the router can separate the two nets.' });
    }
  }

  // ---------------------------------------------------------------- analog
  const hasGround = [...nets.values()].some((n) => n.rail && (n.rail.kind === 'ground' || n.rail.kind === 'negative')) || !!netlist.returnNet;
  // Only circuits that carry power need a reference: a sheet of gates with no
  // supply pins is a logic exercise, not a wiring mistake.
  const needsGround = parts.some((p) => p.sym.source || Object.values(p.sym.pins).some((pin) => pin.io === 'power_in' || pin.io === 'power_out'))
    || [...nets.values()].some((n) => n.rail && n.rail.kind === 'power');
  if (!hasGround && needsGround && parts.length > 1) {
    add('MISSING_GROUND', 'The circuit has no ground reference.', {
      hint: 'Add a "ground" component and connect the return side of the supply to it. Voltages are only meaningful relative to a reference node.',
    });
  }

  for (const p of parts) {
    const t = p.sym.type;

    if (t === 'led' || t === 'rgb_led' || t === 'diode' || t === 'zener' || t === 'schottky') {
      const pairs = t === 'rgb_led'
        ? [['R', 'COM'], ['G', 'COM'], ['B', 'COM']]
        : [['anode', 'cathode']];
      for (const [ap, kp] of pairs) {
        if (!p.pinNets[ap] || !p.pinNets[kp]) continue;
        const up = series(p, ap), down = series(p, kp);
        if (t !== 'zener' && toNegative(up) && toPositive(down)) {
          add('DIODE_REVERSED', `${nameOf(p)} is connected backwards: its cathode (the bar) sits on the positive side.`, {
            component: p.id,
            hint: 'Current flows from anode to cathode. Swap the two ends.',
          });
        }
        if ((t === 'led' || t === 'rgb_led') && !hasLimiter(up) && !hasLimiter(down) && (toPositive(up) || toNegative(down))) {
          const r = supply ? Math.round((supply - 2) / 0.02) : null;
          add('LED_NO_CURRENT_LIMIT', `${nameOf(p)}${t === 'rgb_led' ? ` (${ap})` : ''} has no series resistor: it will draw too much current and burn out.`, {
            component: p.id, pin: ap,
            formula: 'R = (Vsupply − Vf) / I',
            hint: supply
              ? `With a ${formatValue(supply, 'V')} supply, a red LED (Vf ≈ 2 V) at 20 mA needs about ${formatValue(r, 'Ω')}.`
              : 'Add a series resistor sized for the LED forward voltage and the current you want (typically 10–20 mA).',
          });
        }
      }
    }

    if (t === 'capacitor_polarized') {
      const pos = series(p, 'positive'), neg = series(p, 'negative');
      if (toNegative(pos) && toPositive(neg)) {
        add('POLARIZED_CAP_REVERSED', `${nameOf(p)} is reversed: the + terminal is on the more negative side.`, {
          component: p.id, hint: 'Reversed electrolytics heat up and can vent. The + lead goes to the higher potential.',
        });
      }
    }

    if (t === 'resistor' && supply) {
      const R = parseValue(p.comp.value);
      const [a, b] = p.sym.pinOrder;
      const acrossSupply = (isPower(p.pinNets[a]) && isGround(p.pinNets[b])) || (isGround(p.pinNets[a]) && isPower(p.pinNets[b]));
      if (R > 0 && acrossSupply) {
        const P = (supply * supply) / R;
        const rating = parseValue(p.comp.params?.rating?.power ?? p.comp.params?.power) ?? 0.25;
        if (P > rating) {
          add('RESISTOR_POWER', `${nameOf(p)} would dissipate ${formatValue(P, 'W')} across the supply, above its ${formatValue(rating, 'W')} rating.`, {
            component: p.id, formula: 'P = V² / R', hint: 'Use a larger resistance or a resistor with a higher power rating.',
          });
        }
      }
    }

    if (['npn', 'pnp', 'nmos', 'pmos', 'jfet', 'jfet_p', 'phototransistor'].includes(t)) {
      const ctrl = p.sym.pins.B ? 'B' : 'G';
      const [x, y] = p.sym.pins.C ? ['C', 'E'] : ['D', 'S'];
      if (p.pinNets[x] && p.pinNets[x] === p.pinNets[y]) {
        add('TRANSISTOR_SHORTED', `${nameOf(p)} has ${x} and ${y} on the same net, so it cannot switch anything.`, { component: p.id });
      }
      if (!p.pinNets[ctrl] && t !== 'phototransistor') {
        add('TRANSISTOR_CONTROL_FLOATING', `${nameOf(p)} has an unconnected ${ctrl === 'B' ? 'base' : 'gate'}: its state is undefined.`, {
          component: p.id, pin: ctrl,
          hint: ctrl === 'G' ? 'MOSFET gates float and switch randomly; add a pull-down (or pull-up for P-channel) resistor.' : 'Drive the base through a resistor from your control signal.',
        });
      }
    }

    if (t === 'opamp' || t === 'comparator') {
      const vp = p.pinNets['v+'], vn = p.pinNets['v-'];
      if (vp && vn) {
        if (isGround(vp) && isPower(vn)) {
          add('OPAMP_SUPPLY_REVERSED', `${nameOf(p)} has its supply pins swapped: V+ is on ground and V− on the supply.`, { component: p.id });
        }
      } else if (p.sym.pins['v+'] && !vp && !vn) {
        add('OPAMP_SUPPLY_MISSING', `${nameOf(p)} is drawn without supply connections.`, {
          component: p.id, hint: 'That is a common simplification on paper, but the real device needs V+ and V− (or V+ and ground) to work.',
        });
      }
    }

    if (t === 'voltage_regulator' || t === 'ldo') {
      const vin = p.pinNets.IN, vout = p.pinNets.OUT, gnd = p.pinNets.GND;
      if (vin && vin === vout) {
        add('REGULATOR_IO', `${nameOf(p)} has IN and OUT on the same net, which bypasses the regulator.`, { component: p.id });
      }
      if (vin && isGround(vin)) {
        add('REGULATOR_IO', `${nameOf(p)} has its input on ground.`, { component: p.id, hint: 'IN takes the unregulated higher voltage; OUT delivers the regulated one.' });
      }
      if (!gnd) {
        add('REGULATOR_IO', `${nameOf(p)} has no ground connection, so it has no reference to regulate against.`, { component: p.id, pin: 'GND' });
      }
    }
  }

  // ---------------------------------------------------------------- digital
  // A real driver actively forces a level: an IC/gate/board output, not the
  // "current leaves here" end of a two-terminal part such as a diode.
  const isDriver = (e) => {
    const p = byId.get(e.comp);
    if (!p || p.sym.twoTerminal || p.sym.terminal) return false;
    const io = pinIO(p, e.pin);
    return DRIVERS.has(io) && !SHARED_BUS.has(io) && io !== 'power_out';
  };
  for (const [id, n] of nets) {
    const realDrivers = n.pins.filter(isDriver);
    if (realDrivers.length > 1) {
      add('OUTPUT_CONFLICT', `Outputs ${realDrivers.map((e) => `${e.comp}.${e.pin}`).join(' and ')} are wired together on net ${n.name || id}.`, {
        net: id, component: realDrivers[0].comp,
        hint: 'Two push-pull outputs fighting each other can destroy both. Use a tri-state or open-drain output, or a multiplexer, if the connection is intended.',
      });
    }
    if (realDrivers.length && (isPower(id) || isGround(id))) {
      add('OUTPUT_TIED_TO_RAIL', `Output ${realDrivers[0].comp}.${realDrivers[0].pin} is tied directly to ${isPower(id) ? 'a supply rail' : 'ground'}.`, {
        net: id, component: realDrivers[0].comp,
        hint: 'Driving an output against a rail shorts it when it switches. Add a resistor, or connect the rail to an input instead.',
      });
    }
  }

  for (const p of parts) {
    for (const pin of p.sym.pinOrder) {
      const io = pinIO(p, pin);
      const connected = !!p.pinNets[pin];
      if (!connected && io === 'in' && !p.sym.terminal) {
        add('FLOATING_INPUT', `${nameOf(p)}.${pin} is an unconnected input.`, {
          component: p.id, pin,
          hint: 'A floating input picks up noise and reads as random. Tie it to a defined level (pull-up or pull-down) or drive it.',
        });
      }
      if (!connected && io === 'power_in' && /^(vcc|vdd|gnd|vss|agnd|dgnd)$/i.test(pin)) {
        add('IC_MISSING_POWER', `${nameOf(p)} has no connection on its ${pin} pin.`, {
          component: p.id, pin,
          hint: 'Every IC needs its supply and ground connected, even when textbooks leave them out of the drawing.',
        });
      }
      if (connected && /^~?(clk|cp|clock)$/i.test(pin) && (isPower(p.pinNets[pin]) || isGround(p.pinNets[pin]))) {
        add('CLOCK_TIED_TO_RAIL', `${nameOf(p)}.${pin} is tied to ${isPower(p.pinNets[pin]) ? 'the supply' : 'ground'}, so it never clocks.`, {
          component: p.id, pin, hint: 'A clock input needs edges: drive it from an oscillator, a timer or another flip-flop.',
        });
      }
    }
  }

  // Combinational feedback: a cycle through gates only (no flip-flop/latch in it).
  const SEQ = /flipflop|latch|counter|register|memory|microcontroller|arduino|esp32|stm32|rp2040/;
  const edges = new Map(parts.map((p) => [p.id, new Set()]));
  for (const [, n] of nets) {
    const outs = n.pins.filter((e) => byId.get(e.comp) && pinIO(byId.get(e.comp), e.pin) === 'out');
    const ins = n.pins.filter((e) => byId.get(e.comp) && pinIO(byId.get(e.comp), e.pin) === 'in');
    for (const o of outs) for (const i of ins) if (o.comp !== i.comp && !SEQ.test(byId.get(o.comp).sym.type) && !SEQ.test(byId.get(i.comp).sym.type)) edges.get(o.comp).add(i.comp);
  }
  const state = new Map();
  const stack = [];
  const loops = new Set();
  const dfs = (u) => {
    state.set(u, 1); stack.push(u);
    for (const v of edges.get(u) || []) {
      if (state.get(v) === 1) loops.add([...stack.slice(stack.indexOf(v)), v].join(' → '));
      else if (!state.get(v)) dfs(v);
    }
    state.set(u, 2); stack.pop();
  };
  for (const p of parts) if (!state.get(p.id)) dfs(p.id);
  for (const loop of loops) {
    add('COMBINATIONAL_LOOP', `Combinational feedback loop: ${loop}.`, {
      hint: 'Gates feeding back into themselves oscillate or latch unpredictably. Break the loop with a flip-flop, or check the intended logic.',
    });
  }

  return findings;
}

export const RULE_CODES = Object.keys(DEFAULTS);
