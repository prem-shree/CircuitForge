// Student-facing notes: what a part does, the formulas that go with it, the
// mistakes that cost people an afternoon, and what each validation rule means.
// Circuit JSON can add or override any of this through "education" blocks.
import { getDef, canonicalType, resolveSymbol } from '../symbol-loader/index.js';

export const COMPONENT_NOTES = {
  resistor: {
    purpose: 'Limits current and sets voltages.',
    explanation: 'A resistor drops a voltage proportional to the current through it. In series it limits current; in a pair it forms a voltage divider.',
    formulas: ['V = I × R', 'P = V × I = V² / R', 'Vout = Vin × R2 / (R1 + R2)'],
    applications: ['LED current limiting', 'Voltage dividers', 'Pull-up / pull-down', 'Biasing transistors'],
    mistakes: ['Ignoring the power rating: a 1/4 W part across 12 V needs at least 576 Ω', 'Reading the colour code backwards', 'Using a divider to power a load — the output sags under current'],
    experiments: ['Measure a divider unloaded, then with a 1 kΩ load, and explain the drop.'],
  },
  potentiometer: {
    purpose: 'Adjustable voltage divider or variable resistor.',
    explanation: 'Wiper position sets the split between the two end pins. Using only the wiper and one end makes it a rheostat.',
    formulas: ['Vwiper = Vin × (Rlower / Rtotal)'],
    mistakes: ['Wiring the wiper as the only connection (the track then floats)', 'Using a pot as a power rheostat and exceeding its rating'],
  },
  capacitor: {
    purpose: 'Stores charge, passes changes, blocks DC.',
    explanation: 'Voltage across a capacitor cannot jump. With a resistor it sets a time constant; in signal paths it couples AC and blocks DC.',
    formulas: ['Q = C × V', 'τ = R × C', 'Xc = 1 / (2πfC)', 'fc = 1 / (2πRC)'],
    applications: ['Decoupling ICs', 'RC filters and timing', 'AC coupling between stages'],
    mistakes: ['Forgetting a 100 nF decoupling capacitor next to each IC', 'Expecting a capacitor to pass DC'],
    experiments: ['Charge a 10 µF capacitor through 10 kΩ and check that it reaches 63 % of the supply in 0.1 s.'],
  },
  capacitor_polarized: {
    purpose: 'Large-value capacitor for smoothing and bulk storage.',
    explanation: 'Electrolytics give high capacitance in a small package but only tolerate one polarity.',
    formulas: ['Vripple ≈ I × t / C'],
    mistakes: ['Reversing the polarity — the part heats and can vent', 'Using one where fast, low-ESR response is needed'],
  },
  inductor: {
    purpose: 'Stores energy in a magnetic field and resists current changes.',
    explanation: 'Current through an inductor cannot jump. Switching it off produces a large voltage spike, which is why flyback diodes exist.',
    formulas: ['V = L × di/dt', 'τ = L / R', 'XL = 2πfL'],
    mistakes: ['Switching an inductive load (relay, motor) without a flyback diode'],
  },
  transformer: {
    purpose: 'Couples AC between windings and changes voltage.',
    explanation: 'The turns ratio scales voltage up or down and current the other way. It only works with changing current.',
    formulas: ['Vs / Vp = Ns / Np', 'Ip × Np = Is × Ns'],
    mistakes: ['Expecting DC to pass through'],
  },
  diode: {
    purpose: 'Lets current flow one way only.',
    explanation: 'Conducts from anode to cathode above roughly 0.7 V (0.3 V for Schottky). The bar on the symbol is the cathode.',
    formulas: ['Vf ≈ 0.7 V (silicon)'],
    applications: ['Rectifiers', 'Reverse-polarity protection', 'Flyback across relays and motors'],
    mistakes: ['Fitting it backwards', 'Forgetting the forward drop in a supply budget'],
  },
  led: {
    purpose: 'Emits light when forward current flows.',
    explanation: 'An LED is a diode with a forward drop of about 1.8–3.4 V depending on colour. It needs a series resistor: its current rises steeply with voltage.',
    formulas: ['R = (Vsupply − Vf) / I', 'Typical I = 10–20 mA'],
    mistakes: ['No series resistor', 'Fitting it backwards (long lead is the anode)', 'Driving it straight from an MCU pin above the pin current limit'],
    experiments: ['Try 220 Ω, 1 kΩ and 10 kΩ with the same LED and compare brightness and measured current.'],
  },
  zener: {
    purpose: 'Clamps a voltage using controlled reverse breakdown.',
    explanation: 'Used in reverse: above the zener voltage it conducts and holds the node near Vz.',
    formulas: ['Rseries = (Vin − Vz) / (Iz + Iload)'],
    mistakes: ['Fitting it like a normal diode', 'Omitting the series resistor, so the zener takes all the current'],
  },
  schottky: { purpose: 'Fast diode with a low forward drop (~0.3 V).', applications: ['Switching supplies', 'Reverse protection with little loss'] },
  photodiode: { purpose: 'Converts light into a small reverse current.', explanation: 'Usually reverse-biased into a transimpedance amplifier.' },
  npn: {
    purpose: 'Current-controlled switch and amplifier (low-side).',
    explanation: 'A small base current controls a much larger collector current. As a switch, saturate it; as an amplifier, bias it into the active region.',
    formulas: ['Ic = β × Ib', 'Rbase = (Vcontrol − 0.7) / Ib', 'Ib ≈ Ic / 10 for a saturated switch'],
    pins: { B: 'Base — the control input, always through a resistor', C: 'Collector — to the load', E: 'Emitter — to ground in a low-side switch' },
    mistakes: ['Driving the base without a resistor', 'Swapping collector and emitter', 'Trying to switch a load on the high side with an NPN'],
  },
  pnp: {
    purpose: 'Current-controlled switch for the high side.',
    explanation: 'Conducts when the base is pulled below the emitter, so the emitter goes to the positive rail.',
    pins: { B: 'Base — pull low to turn on', E: 'Emitter — to the positive rail', C: 'Collector — to the load' },
    mistakes: ['Driving the base from a 3.3 V pin while the emitter is at 12 V: it never turns off'],
  },
  nmos: {
    purpose: 'Voltage-controlled switch (low-side).',
    explanation: 'The gate draws almost no current; it is the gate-source voltage that turns the channel on. Use a logic-level part for 3.3/5 V drive.',
    formulas: ['Vgs > Vth to conduct', 'Pdiss = Id² × Rds(on)'],
    pins: { G: 'Gate — voltage control, add a pull-down', D: 'Drain — to the load', S: 'Source — to ground' },
    mistakes: ['Floating gate', 'Using a standard MOSFET where Vth is above the logic level', 'Forgetting a flyback diode on inductive loads'],
  },
  pmos: { purpose: 'Voltage-controlled high-side switch.', explanation: 'Source goes to the positive rail; pull the gate below the rail to turn it on.' },
  jfet: { purpose: 'Depletion-mode voltage-controlled device.', explanation: 'Conducts with zero gate voltage and pinches off as the gate is reverse-biased. Popular for high-impedance inputs.' },
  opamp: {
    purpose: 'High-gain differential amplifier, shaped by feedback.',
    explanation: 'With negative feedback the op-amp drives its output until both inputs match. The external resistors set the gain, not the chip.',
    formulas: ['Inverting: Av = −Rf / Rin', 'Non-inverting: Av = 1 + Rf / Rg', 'Buffer: Av = 1'],
    pins: { 'in+': 'Non-inverting input', 'in-': 'Inverting input', out: 'Output', 'v+': 'Positive supply', 'v-': 'Negative supply or ground' },
    mistakes: ['No feedback path (the output then slams to a rail)', 'Expecting the output to swing beyond the supplies', 'Single supply without biasing the input to mid-rail'],
    experiments: ['Build a ×10 inverting amp and check the output clips near the supply rails.'],
  },
  comparator: {
    purpose: 'Compares two voltages and outputs a logic level.',
    explanation: 'Like an op-amp but built for open-loop switching. Many have open-collector outputs that need a pull-up.',
    mistakes: ['Using it with negative feedback as if it were an op-amp', 'No hysteresis, so the output chatters near the threshold'],
  },
  voltage_regulator: {
    purpose: 'Turns a higher, noisy input into a fixed output voltage.',
    explanation: 'A linear regulator burns the difference as heat, so it needs headroom and capacitors on both sides.',
    formulas: ['Pdiss = (Vin − Vout) × Iout'],
    mistakes: ['Swapping IN and OUT', 'Leaving out the input/output capacitors, which causes oscillation', 'Ignoring the dropout voltage'],
  },
  ldo: { purpose: 'Low-dropout regulator: works with a small input-to-output difference.', mistakes: ['Choosing capacitors with the wrong ESR for the part'] },
  timer_555: {
    purpose: 'Timer and oscillator built from comparators and a flip-flop.',
    explanation: 'Astable mode oscillates with two resistors and a capacitor; monostable mode makes one pulse per trigger.',
    formulas: ['Astable f = 1.44 / ((R1 + 2·R2) · C)', 'Duty = (R1 + R2) / (R1 + 2·R2)', 'Monostable T = 1.1 × R × C'],
    pins: { TRIG: 'Trigger — fires when it drops below 1/3 VCC', THR: 'Threshold — resets when it rises above 2/3 VCC', DIS: 'Discharge — pulls the timing capacitor down', CV: 'Control voltage — decouple with 10 nF', RST: 'Reset — tie to VCC when unused' },
    mistakes: ['Leaving RESET floating', 'Forgetting the 10 nF on CV', 'Expecting exactly 50 % duty in astable mode'],
  },
  and: { purpose: 'Output is high only when both inputs are high.', explanation: 'Y = A · B', truthTable: { inputs: ['A', 'B'], rows: [[0, 0, 0], [0, 1, 0], [1, 0, 0], [1, 1, 1]] } },
  or: { purpose: 'Output is high when either input is high.', explanation: 'Y = A + B', truthTable: { inputs: ['A', 'B'], rows: [[0, 0, 0], [0, 1, 1], [1, 0, 1], [1, 1, 1]] } },
  not: { purpose: 'Inverts its input.', explanation: 'Y = ¬A', truthTable: { inputs: ['A'], rows: [[0, 1], [1, 0]] } },
  nand: { purpose: 'AND followed by an inversion, and a universal gate.', explanation: 'Y = ¬(A · B). Any logic function can be built from NANDs alone.', truthTable: { inputs: ['A', 'B'], rows: [[0, 0, 1], [0, 1, 1], [1, 0, 1], [1, 1, 0]] } },
  nor: { purpose: 'OR followed by an inversion; also universal.', explanation: 'Y = ¬(A + B)', truthTable: { inputs: ['A', 'B'], rows: [[0, 0, 1], [0, 1, 0], [1, 0, 0], [1, 1, 0]] } },
  xor: { purpose: 'Output is high when the inputs differ.', explanation: 'Y = A ⊕ B — the sum bit of a half adder.', truthTable: { inputs: ['A', 'B'], rows: [[0, 0, 0], [0, 1, 1], [1, 0, 1], [1, 1, 0]] } },
  xnor: { purpose: 'Output is high when the inputs match.', explanation: 'Y = ¬(A ⊕ B) — an equality test.', truthTable: { inputs: ['A', 'B'], rows: [[0, 0, 1], [0, 1, 0], [1, 0, 0], [1, 1, 1]] } },
  buffer: { purpose: 'Passes logic through while restoring drive strength.' },
  tristate_buffer: { purpose: 'Buffer that can also let go of the bus.', explanation: 'With EN low the output is high-impedance, which is how several devices share one bus line.', mistakes: ['Enabling two drivers on the same bus at once'] },
  schmitt_trigger: { purpose: 'Cleans up slow or noisy edges using hysteresis.', explanation: 'Different thresholds for rising and falling inputs stop the output chattering.' },
  d_flipflop: {
    purpose: 'Stores one bit, sampled on a clock edge.',
    explanation: 'Q takes the value of D at the active clock edge and holds it until the next one. Feed Q̄ back to D and it divides the clock by two.',
    pins: { D: 'Data input', CLK: 'Clock — the edge does the work', Q: 'Stored bit', QN: 'Inverted output', S: 'Asynchronous set', R: 'Asynchronous reset' },
    mistakes: ['Leaving asynchronous set/reset floating', 'Clocking from a bouncing switch without debouncing'],
  },
  jk_flipflop: { purpose: 'Flip-flop that can set, reset, hold or toggle.', explanation: 'J=K=1 toggles on each clock edge.' },
  t_flipflop: { purpose: 'Toggles its output on every clock edge.', explanation: 'A divide-by-two building block for counters.' },
  sr_flipflop: { purpose: 'Simplest latch: set and reset inputs.', mistakes: ['Asserting S and R together, which is an undefined state'] },
  counter: { purpose: 'Counts clock pulses and shows the value in binary.', formulas: ['n stages count to 2ⁿ − 1'], mistakes: ['Forgetting to reset at power-up'] },
  register: { purpose: 'Stores several bits at once on a clock edge.' },
  shift_register: {
    purpose: 'Turns serial data into parallel outputs (or the reverse).',
    explanation: 'Clock bits in on SER/SRCLK, then pulse RCLK to move them to the outputs. It trades three MCU pins for eight outputs.',
    pins: { SER: 'Serial data in', SRCLK: 'Shift clock', RCLK: 'Latch clock — moves the shifted bits to the outputs', '~OE': 'Output enable, active low', '~SRCLR': 'Clear, active low' },
    mistakes: ['Leaving ~OE or ~SRCLR floating', 'Latching before all bits are shifted in'],
  },
  mux: { purpose: 'Selects one of several inputs.', explanation: 'The select lines pick which input reaches the output: n select lines choose between 2ⁿ inputs.' },
  demux: { purpose: 'Routes one input to one of several outputs.' },
  decoder: { purpose: 'Turns a binary code into one active output line.' },
  encoder: { purpose: 'Turns an active input line into a binary code.' },
  adc: { purpose: 'Converts an analog voltage into a number.', formulas: ['LSB = Vref / 2ⁿ', 'code = Vin × 2ⁿ / Vref'], mistakes: ['Sampling a source with high impedance without a buffer', 'Ignoring the Nyquist limit: sample above twice the signal frequency'] },
  dac: { purpose: 'Converts a number into an analog voltage.', formulas: ['Vout = Vref × code / 2ⁿ'] },
  microcontroller: {
    purpose: 'Programmable digital brain of the circuit.',
    explanation: 'GPIO pins can be inputs or outputs under software control. Each needs decoupling, a reset arrangement and often a crystal.',
    mistakes: ['No 100 nF decoupling capacitor next to the supply pins', 'Exceeding the per-pin current limit (usually 20–40 mA)', 'Floating reset pin'],
  },
  crystal: { purpose: 'Sets an accurate clock frequency.', explanation: 'Needs two small load capacitors to ground, typically 12–22 pF.', mistakes: ['Wrong load capacitors', 'Long traces to the MCU pins'] },
  oscillator: { purpose: 'Complete clock source with its own drive circuit.', explanation: 'Unlike a bare crystal it takes a supply and outputs a square wave.' },
  battery: { purpose: 'Portable DC source.', formulas: ['Runtime ≈ capacity (mAh) / current (mA)'] },
  dc_source: { purpose: 'Ideal DC voltage source for analysis.', explanation: 'Holds its voltage regardless of current — real supplies cannot.' },
  ac_source: { purpose: 'Sine source for frequency-domain work.', formulas: ['Vrms = Vpeak / √2'] },
  current_source: { purpose: 'Delivers a fixed current whatever the load.' },
  ground: { purpose: 'The reference node every voltage is measured against.', explanation: 'All ground symbols in a schematic are the same node even when no wire is drawn between them.' },
  vcc: { purpose: 'Positive supply rail.', explanation: 'Every VCC symbol with the same name is the same net.' },
  relay: { purpose: 'Electrically operated mechanical switch.', explanation: 'A small coil current switches contacts that can carry much more power, and isolates the two sides.', mistakes: ['No flyback diode across the coil', 'Driving the coil straight from a logic pin'] },
  optocoupler: { purpose: 'Passes a signal between circuits with no electrical connection.', explanation: 'An LED lights a phototransistor across an insulating gap — the two sides can sit at completely different potentials.', mistakes: ['No series resistor for the internal LED'] },
  photoresistor: { purpose: 'Resistance falls as light increases.', explanation: 'Pair it with a fixed resistor to make a light-sensing divider.' },
  switch: { purpose: 'Makes or breaks a connection by hand.', mistakes: ['Forgetting contact bounce in digital circuits'] },
  push_button: { purpose: 'Momentary contact input.', explanation: 'Needs a pull-up or pull-down so the input is defined when the button is open.', mistakes: ['No pull resistor', 'No debouncing in software or hardware'] },
  fuse: { purpose: 'Opens the circuit when current exceeds its rating.' },
  buzzer: { purpose: 'Makes a tone.', explanation: 'Active buzzers need only DC; passive ones need a driving frequency.' },
  speaker: { purpose: 'Converts an audio signal into sound.', mistakes: ['Driving one directly from a logic pin'] },
  motor: { purpose: 'Converts electrical power into rotation.', mistakes: ['Driving a motor straight from an MCU pin', 'No flyback protection'] },
  servo: { purpose: 'Positions a shaft according to a pulse width.', formulas: ['1.0–2.0 ms pulse every 20 ms spans the travel'], mistakes: ['Powering it from the MCU regulator — servos need their own supply'] },
  seven_segment: { purpose: 'Displays one digit with seven LEDs.', explanation: 'Each segment is an LED and needs its own current limiting. Common-cathode parts tie COM to ground.', mistakes: ['One shared resistor on COM, which makes brightness depend on the digit'] },
  lcd: { purpose: 'Character display with a parallel interface.', explanation: 'V0 sets the contrast, usually with a potentiometer.' },
  oled: { purpose: 'Small graphic display driven over I²C or SPI.', mistakes: ['Forgetting the I²C pull-up resistors'] },
  test_point: { purpose: 'Named place to attach a probe.' },
  voltmeter: { purpose: 'Measures the potential difference across a component.', explanation: 'Always goes in parallel with what you measure, and ideally draws no current.' },
  ammeter: { purpose: 'Measures current through a branch.', explanation: 'Must be placed in series, so the circuit has to be broken to insert it.', mistakes: ['Putting an ammeter across a supply — it is a near short'] },
};

export const RULE_HELP = {
  LED_NO_CURRENT_LIMIT: { title: 'LED without current limiting', why: 'An LED\'s current rises very steeply once it conducts, so a small voltage change becomes a large current. Without a resistor the LED, the supply, or both take the damage.', fix: 'Add a series resistor: R = (Vsupply − Vf) / I, with I around 10–20 mA.' },
  DIODE_REVERSED: { title: 'Diode fitted backwards', why: 'A diode only conducts from anode to cathode. Reversed, the branch simply does not work (or breaks down at high voltage).', fix: 'Swap the ends. The bar on the symbol is the cathode, the side current leaves.' },
  POLARIZED_CAP_REVERSED: { title: 'Polarized capacitor reversed', why: 'Electrolytic capacitors rely on a one-way oxide layer. Reversed they conduct, heat and can burst.', fix: 'Connect + to the more positive node, or use a non-polarized capacitor.' },
  MISSING_GROUND: { title: 'No ground reference', why: 'Voltage is always measured between two points. Without a reference node the circuit has no defined potentials and cannot be simulated or measured.', fix: 'Add a ground symbol and connect the supply return to it.' },
  RESISTOR_POWER: { title: 'Resistor over its power rating', why: 'The energy a resistor drops becomes heat. Beyond its rating it drifts, discolours and eventually fails open.', fix: 'Increase the resistance, or use a physically larger resistor. P = V² / R.' },
  TRANSISTOR_SHORTED: { title: 'Transistor terminals shorted', why: 'With collector and emitter (or drain and source) on the same net the device can never control anything.', fix: 'Put the load between the supply and the collector/drain.' },
  TRANSISTOR_CONTROL_FLOATING: { title: 'Floating base or gate', why: 'An unconnected control terminal picks up noise, so the device switches unpredictably. MOSFET gates hold charge and can stay on.', fix: 'Drive it from your control signal and add a pull-down (NMOS) or pull-up (PMOS) resistor.' },
  OPAMP_SUPPLY_REVERSED: { title: 'Op-amp supplies swapped', why: 'Reversed supplies exceed the absolute maximum ratings, so the part heats immediately.', fix: 'V+ goes to the positive rail, V− to the negative rail or ground.' },
  OPAMP_SUPPLY_MISSING: { title: 'Op-amp drawn without supplies', why: 'Textbook diagrams hide the supply pins, but the real part needs them to produce an output.', fix: 'Connect V+ and V− when you build it, and decouple both with 100 nF.' },
  SOURCE_SHORTED: { title: 'Source shorted', why: 'Both terminals of the source sit on the same net, so it drives unlimited current into zero ohms.', fix: 'Insert the load between + and −.' },
  REGULATOR_IO: { title: 'Regulator connections wrong', why: 'A regulator needs a higher voltage on IN, the regulated load on OUT and a ground reference between them.', fix: 'Check the pinout of your exact part: many regulators do not share a pin order.' },
  OUTPUT_CONFLICT: { title: 'Two outputs driving one net', why: 'When one output drives high and the other low, the only thing between the rails is the two transistors, so both overheat.', fix: 'Use tri-state or open-drain outputs with a pull-up, or a multiplexer.' },
  OUTPUT_TIED_TO_RAIL: { title: 'Output tied to a supply rail', why: 'The moment the output drives the opposite level it shorts the rail.', fix: 'Tie unused inputs to rails instead, and never outputs.' },
  FLOATING_INPUT: { title: 'Floating input', why: 'CMOS inputs are extremely high impedance: an unconnected one picks up noise, reads randomly and can make the chip draw large currents.', fix: 'Drive it, or tie it high/low through a resistor (10 kΩ is a good default).' },
  IC_MISSING_POWER: { title: 'IC without power or ground', why: 'Schematics often hide supply pins, but the chip does nothing until they are connected.', fix: 'Connect VCC and GND, and add a 100 nF decoupling capacitor close to the chip.' },
  CLOCK_TIED_TO_RAIL: { title: 'Clock input tied to a rail', why: 'Flip-flops act on clock edges. A constant level produces no edges, so nothing ever updates.', fix: 'Drive the clock from an oscillator, a timer or a previous stage.' },
  COMBINATIONAL_LOOP: { title: 'Combinational feedback loop', why: 'Gates feeding back without a storage element either oscillate at their propagation delay or latch in a way that depends on timing.', fix: 'Insert a flip-flop, or re-check the intended logic.' },
  DANGLING_NET: { title: 'Wire that goes nowhere', why: 'A net with a single endpoint carries no current and usually means a typo in a connection.', fix: 'Connect it to the intended pin, or remove it.' },
  SHORTED_COMPONENT: { title: 'Component shorted out', why: 'Both pins sit on the same net, so current bypasses the part entirely.', fix: 'Check the connection list: one endpoint is probably on the wrong net.' },
  SHORT_POWER_GROUND: { title: 'Supply shorted to ground', why: 'Connecting a rail straight to ground is a dead short across the supply.', fix: 'Remove the duplicate rail symbol, or put the load between them.' },
  WIRE_THROUGH_COMPONENT: { title: 'Wire crosses a component', why: 'The connection is electrically correct, but the drawing is ambiguous to a reader.', fix: 'Move the part, widen componentGap, or give the connection waypoints.' },
  WIRE_OVERLAP: { title: 'Two nets drawn on top of each other', why: 'Overlapping wires read as a connection that does not exist in the netlist.', fix: 'Give the layout more room (componentGap / wireGap) or move a part.' },
  ROUTING_FAILURE: { title: 'Router fell back to a direct wire', why: 'No clean orthogonal path was found, so the wire may cut across the drawing.', fix: 'Increase spacing, or place the parts manually with "position".' },
};

const CATEGORY_NOTE = {
  passive: 'Passive parts do not need a supply of their own.',
  semiconductor: 'Semiconductors are polarity sensitive: check the pinout of your exact part.',
  digital: 'Digital parts need power, ground and defined input levels.',
  ic: 'Integrated circuits need supply, ground and decoupling.',
  board: 'Development boards bring their own regulator and USB; mind the pin current limits.',
  sensor: 'Sensor modules usually need a supply, a ground and produce a signal output.',
  display: 'Displays need current limiting per segment or a driver chip.',
  power: 'Power symbols mark nets rather than physical parts.',
  measurement: 'Measurement points do not change the circuit; they mark where to probe.',
};

export function explainType(type) {
  const t = canonicalType(type);
  if (!t) return null;
  const def = getDef(t);
  const sym = resolveSymbol({ type: t });
  const notes = COMPONENT_NOTES[t] || {};
  return {
    type: t,
    name: def.name,
    category: def.category,
    pins: sym.pinOrder.map((p) => ({
      name: p,
      electrical: sym.pins[p].io || 'passive',
      note: notes.pins?.[p] || null,
    })),
    purpose: notes.purpose || CATEGORY_NOTE[def.category] || null,
    explanation: notes.explanation || null,
    formulas: notes.formulas || [],
    applications: notes.applications || [],
    mistakes: notes.mistakes || [],
    experiments: notes.experiments || [],
    truthTable: notes.truthTable || null,
  };
}

// Circuit-level notes: whatever the JSON carries, plus per-part notes and the
// help text for any rule that fired.
export function explainCircuit(circuit, findings = []) {
  const edu = (circuit && typeof circuit.education === 'object' && circuit.education) || {};
  const types = [...new Set((circuit?.components || []).map((c) => canonicalType(c.type)).filter(Boolean))];
  return {
    title: circuit?.title || null,
    summary: edu.summary || edu.explanation || null,
    objectives: edu.objectives || edu.learningObjectives || [],
    theory: edu.theory || null,
    questions: edu.questions || [],
    troubleshooting: edu.troubleshooting || [],
    experiments: edu.experiments || [],
    components: types.map(explainType).filter(Boolean),
    rules: [...new Set(findings.map((f) => f.code))].map((code) => ({ code, ...(RULE_HELP[code] || {}) })).filter((r) => r.title),
  };
}
