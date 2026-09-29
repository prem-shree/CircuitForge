// Teaching notes for the parts added after the first release: protection and
// switching devices, multi-input gates, adders, latches, modules and connectors.
// Same shape as COMPONENT_NOTES in index.js: purpose, explanation, formulas,
// applications, mistakes, experiments, pins, truthTable.

// Truth table of an n-input gate: inputs A, B, C, D and a single output Y.
const gateTable = (n, fn) => ({
  inputs: ['A', 'B', 'C', 'D'].slice(0, n),
  rows: Array.from({ length: 2 ** n }, (_, i) => {
    const bits = Array.from({ length: n }, (_, k) => (i >> (n - 1 - k)) & 1);
    return [...bits, fn(bits) ? 1 : 0];
  }),
});

const GATES = {
  and: ['Output is high only when every input is high.', (n) => `Y = ${['A', 'B', 'C', 'D'].slice(0, n).join(' · ')}`, (b) => b.every(Boolean)],
  or: ['Output is high when at least one input is high.', (n) => `Y = ${['A', 'B', 'C', 'D'].slice(0, n).join(' + ')}`, (b) => b.some(Boolean)],
  nand: ['AND followed by an inversion; low only when every input is high.', (n) => `Y = ¬(${['A', 'B', 'C', 'D'].slice(0, n).join(' · ')})`, (b) => !b.every(Boolean)],
  nor: ['OR followed by an inversion; high only when every input is low.', (n) => `Y = ¬(${['A', 'B', 'C', 'D'].slice(0, n).join(' + ')})`, (b) => !b.some(Boolean)],
};

const gateNotes = {};
for (const n of [3, 4]) {
  for (const [name, [purpose, expr, fn]] of Object.entries(GATES)) {
    gateNotes[`${name}${n}`] = {
      purpose: `${n}-input ${name.toUpperCase()} gate. ${purpose}`,
      explanation: `${expr(n)}. Drawn as an IEC rectangle: "&" marks AND-type gates, "≥1" marks OR-type gates, and the bar over Y marks an inverted output.`,
      formulas: [expr(n)],
      applications: ['Wide decoders and enables', 'Reducing several conditions to one signal'],
      mistakes: ['Leaving a spare input floating — tie unused AND/NAND inputs high and OR/NOR inputs low', 'Chaining two-input gates when one wide gate would do'],
      truthTable: gateTable(n, fn),
    };
  }
}

// Seven-segment patterns for 0-9 as a b c d e f g (1 = segment lit).
const SEGMENTS = [[1, 1, 1, 1, 1, 1, 0], [0, 1, 1, 0, 0, 0, 0], [1, 1, 0, 1, 1, 0, 1], [1, 1, 1, 1, 0, 0, 1], [0, 1, 1, 0, 0, 1, 1],
  [1, 0, 1, 1, 0, 1, 1], [1, 0, 1, 1, 1, 1, 1], [1, 1, 1, 0, 0, 0, 0], [1, 1, 1, 1, 1, 1, 1], [1, 1, 1, 1, 0, 1, 1]];

export const EXTRA_NOTES = {
  thermistor: {
    purpose: 'Resistor whose value changes strongly with temperature.',
    explanation: 'An NTC thermistor falls in resistance as it warms; a PTC rises. Put it in a voltage divider to turn temperature into a voltage a microcontroller can read.',
    formulas: ['R(T) = R0 · e^(B · (1/T − 1/T0))', 'Vout = Vin × Rfixed / (Rfixed + Rntc)'],
    applications: ['Temperature sensing', 'Inrush-current limiting (NTC in series with a supply)', 'Overtemperature protection (PTC)'],
    mistakes: ['Ignoring self-heating: too much current warms the sensor and skews the reading', 'Using the 25 °C value across the whole range — the curve is very non-linear'],
  },
  varistor: {
    purpose: 'Voltage-dependent resistor that clamps surges.',
    explanation: 'Above its clamping voltage a varistor (MOV) conducts heavily and shunts the surge away; below it, it is nearly an open circuit. It wears out with repeated surges.',
    formulas: ['Choose a clamping voltage just above the peak of the normal supply'],
    applications: ['Mains surge protection', 'Absorbing switching spikes across relay contacts'],
    mistakes: ['Fitting it without a fuse: a failed MOV often fails short', 'Choosing a rating below the peak mains voltage'],
  },
  tvs_diode: {
    purpose: 'Clamps voltage spikes on a signal or supply line.',
    explanation: 'A bidirectional transient-voltage-suppression diode conducts in either direction once the line exceeds its breakdown voltage, protecting whatever sits behind it. It reacts in nanoseconds.',
    formulas: ['Vbreakdown should exceed the highest normal line voltage', 'Vclamp = the voltage the line is held to during the surge'],
    applications: ['ESD protection on USB and I/O lines', 'Surge protection on supply inputs'],
    mistakes: ['Placing it far from the connector so the wiring inductance defeats it', 'A standoff voltage below the normal signal level'],
  },
  microphone: {
    purpose: 'Converts sound into a small electrical signal.',
    explanation: 'An electret microphone needs a bias current through a resistor from the supply and delivers a tiny AC signal that must be amplified.',
    formulas: ['Bias: R = (Vsupply − Vmic) / Imic, typically 2–10 kΩ'],
    mistakes: ['Forgetting the bias resistor — the capsule then produces nothing', 'Connecting it without a coupling capacitor to the amplifier'],
  },
  spdt_switch: {
    purpose: 'Connects the common terminal to one of two other terminals.',
    explanation: 'A changeover switch. A is the normally-closed side and B the normally-open side as drawn; flipping the lever swaps which one is connected to COM.',
    formulas: [],
    applications: ['Selecting between two signals', 'Two-way lighting circuits', 'Mode selection'],
    mistakes: ['Leaving the unused throw floating when it drives a logic input', 'Using a light-duty switch on a motor or mains load'],
    pins: { COM: 'Common terminal: moves between A and B', A: 'Throw connected when the lever is up (normally closed)', B: 'Throw connected when the lever is down (normally open)' },
  },
  igbt: {
    purpose: 'High-voltage, high-current power switch with an insulated gate.',
    explanation: 'An IGBT combines a MOSFET gate (voltage driven, no steady gate current) with a bipolar output stage that handles large currents at high voltage. It is slower than a MOSFET but drops less voltage at high current.',
    formulas: ['Vce(sat) ≈ 1.5–3 V when on', 'Pcond = Vce(sat) × Ic'],
    applications: ['Motor drives and inverters', 'Induction heating', 'Welding and power supplies'],
    mistakes: ['Driving the gate with less than about 12–15 V, so it never fully turns on', 'No gate resistor or gate pull-down', 'Missing a freewheel diode across an inductive load'],
    pins: { G: 'Gate: voltage-controlled input', C: 'Collector: high-voltage side', E: 'Emitter: low side' },
  },
  scr: {
    purpose: 'Latching switch: a pulse on the gate turns it on until the current stops.',
    explanation: 'A silicon-controlled rectifier conducts from anode to cathode once triggered and stays on until the anode current falls below its holding current. It only conducts in one direction.',
    formulas: ['Igate ≥ Igt to trigger', 'Ianode ≥ Ilatch to stay on after the pulse'],
    applications: ['Phase-controlled DC and half-wave AC power', 'Crowbar overvoltage protection', 'Alarm latches'],
    mistakes: ['Expecting the gate to turn it off again', 'Triggering with too short a pulse for the load to reach the latching current'],
    pins: { anode: 'Positive power terminal', cathode: 'Negative power terminal', gate: 'Trigger input' },
  },
  triac: {
    purpose: 'AC power switch triggered by a gate pulse.',
    explanation: 'A triac conducts in both directions after triggering and turns off at each zero crossing of the AC current, so it is retriggered every half-cycle to dim or switch mains loads.',
    formulas: ['Firing angle sets the average power: P ∝ (1 − α/π + sin(2α)/2π)'],
    applications: ['Lamp dimmers', 'Heater and motor speed control', 'Solid-state relays (with an optocoupler)'],
    mistakes: ['Switching an inductive load without a snubber network', 'Driving the gate directly from a microcontroller connected to mains — use an optocoupler'],
    pins: { MT1: 'Main terminal 1 (gate reference)', MT2: 'Main terminal 2', G: 'Gate: trigger input' },
  },
  bridge_rectifier: {
    purpose: 'Four diodes in one package that turn AC into pulsating DC.',
    explanation: 'Both half-cycles of the AC input are steered to the + and − outputs. Follow it with a smoothing capacitor to get a steady DC voltage.',
    formulas: ['Vdc(peak) ≈ Vac(peak) − 2 × 0.7 V', 'Vripple ≈ I / (2 · f · C)'],
    applications: ['Linear and switching power-supply front ends', 'Battery chargers'],
    mistakes: ['Connecting the AC pins to the DC side', 'Ignoring the two diode drops in the voltage budget', 'Reversing the smoothing capacitor'],
    pins: { AC1: 'AC input', AC2: 'AC input', POS: 'Positive DC output', NEG: 'Negative DC output' },
  },
  antenna: {
    purpose: 'Radiates or receives radio waves.',
    explanation: 'Drawn as a single-pin symbol; its length and matching decide which frequencies it works on. Quarter-wave antennas are common for modules.',
    formulas: ['λ = c / f', 'Quarter-wave length ≈ 71.2 / f(MHz) metres'],
    mistakes: ['Routing the antenna over a ground plane or beside metal', 'Leaving out the matching network the module datasheet asks for'],
  },
  dip_switch: {
    purpose: 'Bank of small slide switches for setting options.',
    explanation: 'Each switch joins one pin on the left to its partner on the right (1–8, 2–7, 3–6, 4–5). Use them to set an address or a mode at power-up.',
    applications: ['Address and mode selection', 'Configuration jumpers'],
    mistakes: ['Forgetting the pull-up or pull-down: an open switch leaves the input floating'],
  },
  adjustable_regulator: {
    purpose: 'Regulator whose output voltage you set with two resistors.',
    explanation: 'The output is held 1.25 V above the ADJ pin. A divider from OUT to ADJ to ground sets the output between 1.25 V and about 37 V. The input must stay a couple of volts above the output.',
    formulas: ['Vout = 1.25 × (1 + R2 / R1) + Iadj × R2', 'R1 is normally 240 Ω between OUT and ADJ'],
    applications: ['Bench and adjustable power supplies', 'Battery chargers', 'Non-standard rail voltages'],
    mistakes: ['Grounding the ADJ pin directly — the output then sits at only 1.25 V', 'Input less than about 3 V above the output (dropout)', 'No output capacitor, giving oscillation'],
    pins: { IN: 'Unregulated input', OUT: 'Regulated output', ADJ: 'Reference: connect to the R1/R2 divider, not to ground' },
  },
  stepper_motor: {
    purpose: 'Motor that turns in fixed angular steps.',
    explanation: 'A bipolar stepper has two coils (A and B). Energising them in sequence turns the rotor one step at a time. A driver chip supplies the coil current.',
    formulas: ['Steps per revolution = 360° / step angle (200 for 1.8°)', 'RPM = steps per second × 60 / steps per revolution'],
    applications: ['3D printers and CNC', 'Positioning stages', 'Camera sliders'],
    mistakes: ['Driving coils straight from microcontroller pins', 'Mixing up which two wires make one coil (measure resistance between them)', 'No current limit in the driver'],
    pins: { A1: 'Coil A start', A2: 'Coil A end', B1: 'Coil B start', B2: 'Coil B end' },
  },
  d_latch: {
    purpose: 'Level-sensitive memory: follows D while enabled, holds it otherwise.',
    explanation: 'While EN is high the output Q follows D (transparent). When EN falls, Q keeps the last value. A flip-flop, by contrast, samples only on a clock edge.',
    formulas: ['EN = 1: Q = D', 'EN = 0: Q holds'],
    applications: ['Holding data on a bus', 'Building flip-flops from two latches'],
    mistakes: ['Expecting edge-triggered behaviour — data changing during EN passes straight through'],
    truthTable: { inputs: ['EN', 'D'], outputs: ['Q'], rows: [[0, 0, 'hold'], [0, 1, 'hold'], [1, 0, 0], [1, 1, 1]] },
  },
  half_adder: {
    purpose: 'Adds two bits, giving a sum and a carry.',
    explanation: 'S = A XOR B and C = A AND B. It cannot accept a carry from a previous stage, so it is used for the lowest bit.',
    formulas: ['S = A ⊕ B', 'C = A · B'],
    applications: ['Least significant bit of an adder', 'Introducing binary arithmetic'],
    mistakes: ['Chaining half adders for multi-bit sums — use full adders after the first bit'],
    truthTable: { inputs: ['A', 'B'], outputs: ['S', 'C'], rows: [[0, 0, 0, 0], [0, 1, 1, 0], [1, 0, 1, 0], [1, 1, 0, 1]] },
  },
  full_adder: {
    purpose: 'Adds two bits plus a carry-in.',
    explanation: 'Chain the COUT of each stage into the CIN of the next to build a ripple-carry adder of any width.',
    formulas: ['S = A ⊕ B ⊕ CIN', 'COUT = A·B + CIN·(A ⊕ B)'],
    applications: ['Multi-bit adders and ALUs', 'Counters and accumulators'],
    mistakes: ['Leaving CIN floating on the first stage — tie it low', 'Forgetting that ripple carry gets slower with every added bit'],
    truthTable: { inputs: ['A', 'B', 'CIN'], outputs: ['S', 'COUT'], rows: Array.from({ length: 8 }, (_, i) => { const a = (i >> 2) & 1, b = (i >> 1) & 1, c = i & 1; const t = a + b + c; return [a, b, c, t & 1, t >> 1]; }) },
  },
  bcd_7seg_decoder: {
    purpose: 'Turns a 4-bit BCD digit into the seven segment signals of a display.',
    explanation: 'Feed a binary-coded digit (0–9) to A–D and the outputs OA–OG light the matching segments. The classic 7447 drives common-anode displays with active-low outputs; the 4511 drives common-cathode displays with active-high outputs. The table shows the active-high pattern.',
    formulas: ['Segment current ≈ (Vcc − Vf) / Rseries, typically 5–15 mA'],
    applications: ['Counters with a numeric readout', 'Clocks and meters'],
    mistakes: ['Wiring an active-low decoder to a common-cathode display', 'No series resistor on each segment', 'Leaving ~LT or ~BI floating instead of tying them high'],
    pins: { A: 'BCD input, least significant bit', D: 'BCD input, most significant bit', '~LT': 'Lamp test: low lights every segment', '~BI': 'Blanking input: low turns the display off' },
    truthTable: { inputs: ['D', 'C', 'B', 'A'], outputs: ['a', 'b', 'c', 'd', 'e', 'f', 'g'], rows: SEGMENTS.map((seg, n) => [(n >> 3) & 1, (n >> 2) & 1, (n >> 1) & 1, n & 1, ...seg]) },
  },
  i2c_eeprom: {
    purpose: 'Non-volatile memory on the I²C bus.',
    explanation: 'Keeps its contents without power. A0–A2 set the low bits of the bus address so several can share one bus; WP high blocks writes. SDA needs a pull-up resistor.',
    formulas: ['Address = 0b1010 A2 A1 A0', 'Pull-up ≈ 4.7 kΩ at 100 kHz'],
    applications: ['Storing settings and calibration', 'Small data logs'],
    mistakes: ['No pull-ups on SDA and SCL', 'Leaving the address pins floating', 'Writing too often — cells wear out after about a million cycles'],
    pins: { SDA: 'Bidirectional data (open drain)', SCL: 'Clock input', WP: 'Write protect: high blocks writes' },
  },
  rtc: {
    purpose: 'Keeps time while the main supply is off.',
    explanation: 'A battery on VBAT keeps the clock running when VCC is removed. The microcontroller reads and sets the time over I²C; SQW can output a square wave or an alarm interrupt.',
    formulas: ['Battery life ≈ capacity / standby current (a CR2032 lasts years)'],
    applications: ['Data loggers', 'Clocks and alarms', 'Scheduled wake-up'],
    mistakes: ['No I²C pull-ups', 'Fitting a rechargeable-incompatible battery to the backup pin', 'Forgetting to set the time after the first power-up'],
    pins: { VBAT: 'Backup battery input', SQW: 'Square wave / alarm output', '32K': '32 kHz output' },
  },
  usb_connector: {
    purpose: 'USB port: power plus a differential data pair.',
    explanation: 'VBUS carries 5 V, D+ and D− carry data, GND is the return. Protect the data lines against ESD and add bulk capacitance near VBUS.',
    formulas: ['Default power draw ≤ 100 mA until enumerated (500 mA after)'],
    mistakes: ['Swapping D+ and D−', 'Drawing more current than the port allows', 'No ESD protection on a user-facing port'],
    pins: { VBUS: '+5 V supply', 'D-': 'Data −', 'D+': 'Data +', GND: 'Ground' },
  },
  power_jack: {
    purpose: 'Barrel connector for a wall adapter.',
    explanation: 'Most adapters put positive on the centre pin (TIP) and negative on the outer barrel (SLEEVE), but not all — check the polarity marking.',
    mistakes: ['Assuming centre-positive without checking', 'No reverse-polarity protection (a series diode or P-MOSFET)'],
    pins: { TIP: 'Centre pin', SLEEVE: 'Outer barrel' },
  },
  keypad: {
    purpose: 'Sixteen keys read with only eight wires.',
    explanation: 'Keys sit at the crossings of four rows and four columns. Drive one column low at a time and read the rows; a pressed key connects its row to the driven column.',
    formulas: ['Keys = rows × columns'],
    mistakes: ['Forgetting pull-ups on the row inputs', 'Reading all columns at once, which makes it ambiguous which key was pressed'],
  },
  sd_card: {
    purpose: 'Removable mass storage over SPI.',
    explanation: 'The card talks SPI: CS selects it, SCK clocks, MOSI carries commands to it and MISO carries data back. Cards run at 3.3 V, so 5 V logic needs level shifting.',
    formulas: ['Throughput ≈ SPI clock / 8 bytes per second'],
    applications: ['Data logging', 'Audio and image storage'],
    mistakes: ['Driving 3.3 V pins with 5 V logic', 'No decoupling capacitor at the socket'],
    pins: { CS: 'Chip select (active low)', MOSI: 'Data in to the card', MISO: 'Data out of the card', SCK: 'SPI clock' },
  },
  humidity_sensor: {
    purpose: 'Digital temperature and humidity sensor.',
    explanation: 'A DHT-type sensor sends a 40-bit reading on one data line each time it is asked. The line needs a pull-up resistor and should be read no more than about once a second.',
    formulas: ['Pull-up ≈ 4.7–10 kΩ on DATA'],
    mistakes: ['No pull-up on DATA', 'Polling faster than the sensor can measure'],
    pins: { DATA: 'Single-wire bidirectional data' },
  },
  imu: {
    purpose: 'Accelerometer and gyroscope on the I²C bus.',
    explanation: 'Reports acceleration and rotation rate on three axes. AD0 chooses between two bus addresses; INT signals that new data is ready.',
    formulas: ['Address = 0x68 (AD0 low) or 0x69 (AD0 high)'],
    mistakes: ['Leaving AD0 floating', 'No pull-ups on SDA/SCL', 'Powering a 3.3 V module from 5 V'],
    pins: { INT: 'Data-ready / motion interrupt output', AD0: 'Address select' },
  },
  pir_sensor: {
    purpose: 'Detects movement of warm bodies.',
    explanation: 'The output goes high for a few seconds when motion is seen. The module needs about a minute after power-up to settle.',
    mistakes: ['Testing before the warm-up period ends', 'Pointing it at a heater or window'],
  },
  bluetooth_module: {
    purpose: 'Wireless serial link (UART) over Bluetooth.',
    explanation: 'Cross the connections: the module’s TXD goes to the microcontroller’s RX, and its RXD to the microcontroller’s TX. Most modules use 3.3 V logic on RXD.',
    formulas: ['Common baud rates: 9600 or 38400 (AT mode)'],
    mistakes: ['Connecting TXD to TXD', 'Driving RXD with 5 V without a divider', 'Baud-rate mismatch'],
    pins: { TXD: 'Serial output from the module', RXD: 'Serial input to the module', STATE: 'Connection status output', EN: 'Enable / AT-mode select' },
  },
  ...gateNotes,
};
