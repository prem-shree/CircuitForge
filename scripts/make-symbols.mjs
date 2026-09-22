// Generates CircuitForge's own symbols into src/symbols/<type>/.
//   node scripts/make-symbols.mjs
// Two kinds live here:
//   - drawn symbols (rails, terminals, meters, RGB LED, seven-segment, …)
//   - "box" symbols (ICs, boards, modules) that carry no SVG: the renderer draws
//     the rectangle, pins and labels from the pin lists below.
// Symbols imported from external libraries are handled by import-symbols.mjs.
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.resolve('src/symbols');
const ORIGIN = { library: 'CircuitForge', license: 'same as the CircuitForge project', note: 'original CircuitForge symbol' };

function write(type, meta, svg) {
  const dir = path.join(OUT, type);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'metadata.json'), JSON.stringify({ type, ...meta, ...(svg ? { svg: 'symbol.svg' } : {}), origin: ORIGIN }, null, 2) + '\n');
  if (svg) {
    fs.writeFileSync(path.join(dir, 'symbol.svg'),
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${meta.width} ${meta.height}" width="${meta.width}" height="${meta.height}">\n` +
      `<g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">\n${svg}\n</g>\n</svg>\n`);
  }
}

// ---------------------------------------------------------------- rails & terminals
const railUp = (name, def, aliases) => write(name, {
  name: def + ' rail', category: 'power', width: 40, height: 40,
  pins: { '1': { x: 20, y: 40, dir: 'down', io: 'power_out' } },
  body: { x: 8, y: 14, w: 24, h: 26 }, rail: 'power',
  text: { x: 20, y: 9, anchor: 'middle', default: def }, typeAliases: aliases,
}, '<path d="M20 40V16M8 16h24"/>');
railUp('vcc', 'VCC', ['power_rail', 'rail', 'vplus', 'v+', 'supply']);
railUp('vdd', 'VDD', []);

write('vss', {
  name: 'VSS rail', category: 'power', width: 40, height: 40,
  pins: { '1': { x: 20, y: 0, dir: 'up', io: 'power_out' } },
  body: { x: 8, y: 0, w: 24, h: 26 }, rail: 'negative',
  text: { x: 20, y: 38, anchor: 'middle', default: 'VSS' }, typeAliases: ['vee', 'v-', 'negative_rail'],
}, '<path d="M20 0v24M8 24h24"/>');

write('input', {
  name: 'Input terminal', category: 'power', width: 40, height: 20,
  pins: { '1': { x: 40, y: 10, dir: 'right', io: 'out' } },
  body: { x: 0, y: 4, w: 12, h: 12 }, terminal: 'input', labels: 'none',
  text: { x: -4, y: 14, anchor: 'end', default: '$id' }, prefix: 'IN',
  typeAliases: ['input_terminal', 'in', 'port_in'],
}, '<circle cx="6" cy="10" r="4"/><path d="M10 10h30"/>');

write('output', {
  name: 'Output terminal', category: 'power', width: 40, height: 20,
  pins: { '1': { x: 0, y: 10, dir: 'left', io: 'in' } },
  body: { x: 28, y: 4, w: 12, h: 12 }, terminal: 'output', labels: 'none',
  text: { x: 44, y: 14, anchor: 'start', default: '$id' }, prefix: 'OUT',
  typeAliases: ['output_terminal', 'out', 'port_out'],
}, '<path d="M0 10h30"/><circle cx="34" cy="10" r="4"/>');

write('test_point', {
  name: 'Test point', category: 'measurement', width: 20, height: 30,
  pins: { '1': { x: 10, y: 30, dir: 'down', io: 'passive' } },
  body: { x: 4, y: 2, w: 12, h: 12 }, labels: 'none',
  text: { x: 18, y: 8, anchor: 'start', default: '$id' }, prefix: 'TP',
  typeAliases: ['testpoint', 'tp', 'probe'],
}, '<circle cx="10" cy="8" r="5"/><path d="M10 13v17"/>');

write('net_label', { name: 'Net label', category: 'power', kind: 'label', rail: 'label', pins: { '1': { x: 0, y: 0, dir: 'left' } }, typeAliases: ['label', 'net', 'netlabel'] });
write('junction', { name: 'Junction', category: 'power', kind: 'virtual', pins: { '1': { x: 0, y: 0, dir: 'left' } }, typeAliases: ['node', 'dot'] });

// ---------------------------------------------------------------- meters
const meter = (type, letter, name, aliases, prefix) => write(type, {
  name, category: 'measurement', width: 40, height: 40,
  pins: { '1': { x: 0, y: 20, dir: 'left', io: 'passive' }, '2': { x: 40, y: 20, dir: 'right', io: 'passive' } },
  body: { x: 8, y: 8, w: 24, h: 24 }, prefix, typeAliases: aliases,
}, `<circle cx="20" cy="20" r="12"/><path d="M0 20h8M32 20h8"/><text x="20" y="25" font-size="13" font-weight="600" text-anchor="middle" fill="currentColor" stroke="none">${letter}</text>`);
meter('voltmeter', 'V', 'Voltmeter', ['volt_meter', 'voltage_probe'], 'MV');
meter('ammeter', 'A', 'Ammeter', ['current_meter', 'current_probe'], 'MA');

// ---------------------------------------------------------------- motor
write('motor', {
  name: 'DC motor', category: 'output_device', width: 60, height: 40,
  pins: { '1': { x: 0, y: 20, dir: 'left', io: 'passive' }, '2': { x: 60, y: 20, dir: 'right', io: 'passive' } },
  body: { x: 10, y: 4, w: 40, h: 32 }, prefix: 'M', typeAliases: ['dc_motor'],
}, '<circle cx="30" cy="20" r="16"/><path d="M0 20h14M46 20h14"/><text x="30" y="25" font-size="13" font-weight="600" text-anchor="middle" fill="currentColor" stroke="none">M</text>');

// ---------------------------------------------------------------- RGB LED
// Three LED junctions sharing one common pin (common cathode by default).
const rgbTri = (y) => `<path d="M14 ${y}h10m0 0 14 8V${y - 8}l-14 8zm14 0h10"/><path d="M38 ${y - 8}v16"/>`;
write('rgb_led', {
  name: 'RGB LED', category: 'semiconductor', width: 60, height: 80,
  pins: {
    R: { x: 0, y: 20, dir: 'left', io: 'in' },
    G: { x: 0, y: 40, dir: 'left', io: 'in' },
    B: { x: 0, y: 60, dir: 'left', io: 'in' },
    COM: { x: 60, y: 40, dir: 'right', io: 'passive' },
  },
  aliases: { red: 'R', green: 'G', blue: 'B', common: 'COM', cathode: 'COM', anode: 'COM', k: 'COM', '1': 'R', '2': 'G', '3': 'B', '4': 'COM' },
  body: { x: 12, y: 8, w: 36, h: 64 }, prefix: 'D', labels: 'right',
  required: ['R', 'G', 'B', 'COM'], typeAliases: ['led_rgb', 'rgbled'],
}, `<path d="M0 20h14M0 40h14M0 60h14"/>${rgbTri(20)}${rgbTri(40)}${rgbTri(60)}<path d="M48 20v40m0-20h12"/>
<path d="m44 12 6-6m-2 6 6-6" stroke-width="1.2"/><path d="m50 6-3 1 1 3z" fill="currentColor" stroke="none"/>`);

// ---------------------------------------------------------------- seven-segment display
// Seven segments as plain bars: a/d/g horizontal, b/c/e/f vertical, plus the point.
const SEG = [
  [37, 16, 26, 5], [63, 21, 5, 20], [63, 46, 5, 20], [37, 66, 26, 5],
  [32, 46, 5, 20], [32, 21, 5, 20], [37, 41, 26, 5],
];
write('seven_segment', {
  name: 'Seven-segment display', category: 'display', width: 100, height: 100,
  pins: {
    a: { x: 0, y: 20, dir: 'left', io: 'in' }, b: { x: 0, y: 40, dir: 'left', io: 'in' },
    c: { x: 0, y: 60, dir: 'left', io: 'in' }, d: { x: 0, y: 80, dir: 'left', io: 'in' },
    e: { x: 100, y: 20, dir: 'right', io: 'in' }, f: { x: 100, y: 40, dir: 'right', io: 'in' },
    g: { x: 100, y: 60, dir: 'right', io: 'in' }, dp: { x: 100, y: 80, dir: 'right', io: 'in' },
    COM: { x: 50, y: 100, dir: 'down', io: 'passive' },
  },
  aliases: { common: 'COM', cc: 'COM', ca: 'COM', dot: 'dp', point: 'dp' },
  body: { x: 14, y: 6, w: 72, h: 84 }, prefix: 'DS', labels: 'top',
  required: ['COM'], typeAliases: ['7seg', 'seven_seg', 'digit'],
}, `<rect x="14" y="6" width="72" height="84" rx="3"/>
<path d="M0 20h14M0 40h14M0 60h14M0 80h14M100 20H86M100 40H86M100 60H86M100 80H86M50 100V90"/>
<g fill="currentColor" stroke="none" opacity="0.8">${SEG.map(([x, y, w, h]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1.5"/>`).join('')}</g>
<circle cx="73" cy="69" r="3" fill="currentColor" stroke="none"/>`);

// ---------------------------------------------------------------- box symbols
const box = (type, name, category, label, pins, extra = {}) => write(type, { name, category, kind: 'box', label, pins, ...extra });
const seq = (p, n, start = 0) => Array.from({ length: n }, (_, i) => p + (i + start));

box('generic_ic', 'Generic IC', 'ic', 'IC', { left: ['1', '2', '3', '4'], right: ['8', '7', '6', '5'] }, { prefix: 'U', typeAliases: ['ic', 'chip'] });
box('timer_555', '555 timer', 'ic', '555', { left: ['DIS', 'THR', 'TRIG'], right: ['OUT', 'CV'], top: ['VCC', 'RST'], bottom: ['GND'] },
  { prefix: 'U', aliases: { '1': 'GND', '2': 'TRIG', '3': 'OUT', '4': 'RST', '5': 'CV', '6': 'THR', '7': 'DIS', '8': 'VCC', trigger: 'TRIG', threshold: 'THR', control: 'CV', ctrl: 'CV', reset: 'RST', discharge: 'DIS', output: 'OUT', vdd: 'VCC' }, required: ['VCC', 'GND', 'OUT'], typeAliases: ['555', 'ne555', 'timer'] });
box('microcontroller', 'Generic microcontroller', 'ic', 'MCU', { left: ['RST', 'XTAL1', 'XTAL2', 'PA0', 'PA1', 'PA2', 'PA3', 'PA4'], right: seq('PB', 8), top: ['VCC'], bottom: ['GND'] },
  { prefix: 'U', aliases: { reset: 'RST', vdd: 'VCC', vss: 'GND' }, pinIO: { PA0: 'bidirectional', PA1: 'bidirectional', PA2: 'bidirectional', PA3: 'bidirectional', PA4: 'bidirectional', ...Object.fromEntries(seq('PB', 8).map((p) => [p, 'bidirectional'])) }, typeAliases: ['mcu', 'micro'] });
box('memory', 'Generic memory', 'ic', 'MEM', { left: [...seq('A', 8), '~CS', '~OE', '~WE'], right: seq('D', 8), top: ['VCC'], bottom: ['GND'] },
  { prefix: 'U', pinIO: Object.fromEntries(seq('D', 8).map((p) => [p, 'bidirectional'])), typeAliases: ['ram', 'rom', 'eeprom', 'sram'] });
box('voltage_regulator', 'Voltage regulator', 'analog', 'REG', { left: ['IN'], right: ['OUT'], bottom: ['GND'] },
  { prefix: 'U', aliases: { vin: 'IN', vout: 'OUT', '1': 'IN', '2': 'GND', '3': 'OUT', input: 'IN', output: 'OUT', adj: 'GND' }, pinIO: { IN: 'power_in', OUT: 'power_out', GND: 'power_in' }, required: ['IN', 'OUT', 'GND'], typeAliases: ['regulator', '7805', 'lm7805'] });
box('ldo', 'LDO regulator', 'analog', 'LDO', { left: ['IN', 'EN'], right: ['OUT'], bottom: ['GND'] },
  { prefix: 'U', aliases: { vin: 'IN', vout: 'OUT', enable: 'EN', shdn: 'EN' }, pinIO: { IN: 'power_in', OUT: 'power_out', GND: 'power_in', EN: 'in' }, required: ['IN', 'OUT', 'GND'], typeAliases: ['low_dropout', 'ams1117', 'lm1117'] });
box('mux', 'Multiplexer', 'digital', 'MUX', { left: seq('D', 4), right: ['Y'], bottom: ['S0', 'S1'] }, { prefix: 'U', typeAliases: ['multiplexer'] });
box('demux', 'Demultiplexer', 'digital', 'DEMUX', { left: ['D'], right: seq('Y', 4), bottom: ['S0', 'S1'] }, { prefix: 'U', typeAliases: ['demultiplexer'] });
box('encoder', 'Encoder', 'digital', 'ENC', { left: seq('I', 4), right: ['Y0', 'Y1'] }, { prefix: 'U', typeAliases: ['priority_encoder'] });
box('decoder', 'Decoder', 'digital', 'DEC', { left: ['A0', 'A1', 'EN'], right: seq('Y', 4) }, { prefix: 'U' });
box('counter', 'Counter', 'digital', 'CTR', { left: ['CLK', '~CLR', 'EN'], right: seq('Q', 4) }, { prefix: 'U', typeAliases: ['binary_counter'] });
box('register', 'Register', 'digital', 'REG', { left: [...seq('D', 4), 'CLK', '~CLR'], right: seq('Q', 4) }, { prefix: 'U', typeAliases: ['latch_register'] });
box('shift_register', 'Shift register', 'digital', 'SREG', { left: ['SER', 'SRCLK', 'RCLK', '~SRCLR', '~OE'], right: [...'ABCDEFGH'].map((c) => 'Q' + c), top: ['VCC'], bottom: ['GND'] },
  { prefix: 'U', aliases: { data: 'SER', ds: 'SER', shcp: 'SRCLK', stcp: 'RCLK', latch: 'RCLK', mr: '~SRCLR', oe: '~OE' }, required: ['SER', 'SRCLK', 'RCLK'], typeAliases: ['74hc595', 'sipo'] });
box('connector', 'Connector', 'connector', '', { right: ['1', '2', '3', '4'] }, { prefix: 'J', io: 'passive', typeAliases: ['header', 'conn'] });
box('oscillator', 'Crystal oscillator', 'passive', 'OSC', { left: ['EN'], right: ['OUT'], top: ['VCC'], bottom: ['GND'] },
  { prefix: 'Y', aliases: { output: 'OUT', clk: 'OUT', enable: 'EN' }, required: ['OUT', 'VCC', 'GND'], typeAliases: ['clock_oscillator', 'can_oscillator'] });

// ---------------------------------------------------------------- modules, sensors, displays
box('sensor', 'Generic sensor module', 'sensor', 'SENSOR', { left: ['VCC'], right: ['OUT'], bottom: ['GND'] },
  { prefix: 'SNS', pinIO: { VCC: 'power_in', GND: 'power_in', OUT: 'out' }, required: ['VCC', 'GND', 'OUT'], typeAliases: ['generic_sensor', 'module'] });
box('temperature_sensor', 'Temperature sensor', 'sensor', 'TEMP', { left: ['VCC'], right: ['OUT'], bottom: ['GND'] },
  { prefix: 'U', pinIO: { VCC: 'power_in', GND: 'power_in', OUT: 'out' }, required: ['VCC', 'GND', 'OUT'], typeAliases: ['lm35', 'tmp36', 'thermometer'] });
box('ultrasonic_sensor', 'Ultrasonic distance sensor', 'sensor', 'HC-SR04', { left: ['VCC', 'TRIG'], right: ['ECHO'], bottom: ['GND'] },
  { prefix: 'U', pinIO: { VCC: 'power_in', GND: 'power_in', TRIG: 'in', ECHO: 'out' }, required: ['VCC', 'GND'], typeAliases: ['hcsr04', 'distance_sensor'] });
box('servo', 'Servo motor', 'output_device', 'SERVO', { left: ['VCC', 'SIG'], bottom: ['GND'] },
  { prefix: 'M', pinIO: { VCC: 'power_in', GND: 'power_in', SIG: 'in' }, required: ['VCC', 'GND', 'SIG'], typeAliases: ['servo_motor', 'sg90'] });
box('motor_driver', 'Motor driver', 'output_device', 'DRV', { left: ['IN1', 'IN2', 'EN'], right: ['OUT1', 'OUT2'], top: ['VCC', 'VM'], bottom: ['GND'] },
  { prefix: 'U', pinIO: { VCC: 'power_in', VM: 'power_in', GND: 'power_in', OUT1: 'out', OUT2: 'out' }, required: ['VCC', 'GND'], typeAliases: ['h_bridge', 'l293d', 'drv8833'] });
box('lcd', 'Character LCD', 'display', 'LCD', { left: ['VSS', 'VDD', 'V0', 'RS', 'RW', 'E'], right: ['D4', 'D5', 'D6', 'D7', 'A', 'K'] },
  { prefix: 'DS', pinIO: { VSS: 'power_in', VDD: 'power_in', D4: 'bidirectional', D5: 'bidirectional', D6: 'bidirectional', D7: 'bidirectional' }, required: ['VSS', 'VDD'], typeAliases: ['lcd1602', 'hd44780', 'character_lcd'] });
box('oled', 'OLED display', 'display', 'OLED', { left: ['VCC', 'SDA', 'SCL'], bottom: ['GND'] },
  { prefix: 'DS', pinIO: { VCC: 'power_in', GND: 'power_in', SDA: 'bidirectional', SCL: 'in' }, required: ['VCC', 'GND'], typeAliases: ['ssd1306', 'oled_i2c'] });

// ---------------------------------------------------------------- development boards
const gpio = (names) => Object.fromEntries(names.map((n) => [n, 'bidirectional']));
box('arduino_uno', 'Arduino-style board', 'board', 'ARDUINO', {
  left: ['RESET', 'A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'VIN'],
  right: ['D2', 'D3', 'D4', 'D5', 'D6', 'D9', 'D10', 'D11', 'D12', 'D13'],
  top: ['5V', '3V3'], bottom: ['GND'],
}, { prefix: 'U', aliases: { sda: 'A4', scl: 'A5', mosi: 'D11', miso: 'D12', sck: 'D13', led_builtin: 'D13', vcc: '5V' },
  pinIO: { ...gpio(['D2', 'D3', 'D4', 'D5', 'D6', 'D9', 'D10', 'D11', 'D12', 'D13', 'A0', 'A1', 'A2', 'A3', 'A4', 'A5']), '5V': 'power_out', '3V3': 'power_out', VIN: 'power_in', GND: 'power_in', RESET: 'in' },
  required: ['GND'], typeAliases: ['arduino', 'arduino_nano', 'arduino_board', 'uno'] });
box('esp32', 'ESP32-style board', 'board', 'ESP32', {
  left: ['EN', 'GPIO36', 'GPIO39', 'GPIO34', 'GPIO35', 'GPIO32', 'GPIO33', 'GPIO25'],
  right: ['GPIO26', 'GPIO27', 'GPIO14', 'GPIO12', 'GPIO13', 'GPIO21', 'GPIO22', 'GPIO23'],
  top: ['3V3', 'VIN'], bottom: ['GND'],
}, { prefix: 'U', aliases: { sda: 'GPIO21', scl: 'GPIO22', mosi: 'GPIO23', en: 'EN', reset: 'EN', vcc: '3V3' },
  pinIO: { ...gpio(['GPIO26', 'GPIO27', 'GPIO14', 'GPIO12', 'GPIO13', 'GPIO21', 'GPIO22', 'GPIO23', 'GPIO32', 'GPIO33', 'GPIO25']), GPIO36: 'in', GPIO39: 'in', GPIO34: 'in', GPIO35: 'in', '3V3': 'power_out', VIN: 'power_in', GND: 'power_in', EN: 'in' },
  required: ['GND'], typeAliases: ['esp32_board', 'esp8266', 'nodemcu', 'wroom'] });
box('stm32', 'STM32-style board', 'board', 'STM32', {
  left: ['NRST', 'PA0', 'PA1', 'PA2', 'PA3', 'PA4', 'PA5', 'PA6'],
  right: ['PA7', 'PA8', 'PA9', 'PA10', 'PB0', 'PB1', 'PB6', 'PB7'],
  top: ['3V3', '5V'], bottom: ['GND'],
}, { prefix: 'U', aliases: { reset: 'NRST', sda: 'PB7', scl: 'PB6', tx: 'PA9', rx: 'PA10', vcc: '3V3' },
  pinIO: { ...gpio(['PA0', 'PA1', 'PA2', 'PA3', 'PA4', 'PA5', 'PA6', 'PA7', 'PA8', 'PA9', 'PA10', 'PB0', 'PB1', 'PB6', 'PB7']), '3V3': 'power_out', '5V': 'power_in', GND: 'power_in', NRST: 'in' },
  required: ['GND'], typeAliases: ['stm32_board', 'nucleo', 'blue_pill'] });
box('rp2040', 'RP2040-style board', 'board', 'RP2040', {
  left: ['RUN', 'GP0', 'GP1', 'GP2', 'GP3', 'GP4', 'GP5', 'GP6'],
  right: ['GP7', 'GP8', 'GP9', 'GP10', 'GP16', 'GP17', 'GP25', 'GP26'],
  top: ['3V3', 'VSYS'], bottom: ['GND'],
}, { prefix: 'U', aliases: { reset: 'RUN', sda: 'GP4', scl: 'GP5', tx: 'GP0', rx: 'GP1', led: 'GP25', vcc: '3V3' },
  pinIO: { ...gpio(['GP0', 'GP1', 'GP2', 'GP3', 'GP4', 'GP5', 'GP6', 'GP7', 'GP8', 'GP9', 'GP10', 'GP16', 'GP17', 'GP25', 'GP26']), '3V3': 'power_out', VSYS: 'power_in', GND: 'power_in', RUN: 'in' },
  required: ['GND'], typeAliases: ['pico', 'raspberry_pi_pico', 'rp2040_board'] });

console.log('generated CircuitForge symbols');
