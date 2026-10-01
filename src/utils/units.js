// Parse engineering values: "4.7kΩ" -> 4700, "100nF" -> 1e-7, "+12V" -> 12, "1M" -> 1e6.
const PREFIX = { p: 1e-12, n: 1e-9, u: 1e-6, µ: 1e-6, μ: 1e-6, m: 1e-3, k: 1e3, K: 1e3, M: 1e6, G: 1e9, R: 1, r: 1 };
const UNITS = 'Ω|ohm|ohms|F|H|V|A|W|Hz|s';

// Words often glued to a value: "12Vdc", "5Vrms", "5Vpp", "100mVp-p", "3.3V typ".
const QUALIFIERS = ['dc', 'ac', 'rms', 'pp', 'p-p', 'pk', 'peak', 'max', 'min', 'typ', 'nom'];
const NUM = '[+-]?(?:\\d+\\.?\\d*|\\.\\d+)(?:[eE][+-]?\\d+)?';
// SPICE writes mega as "meg" (a bare "m" is milli): 1Meg, 4.7MEGohm
const MEGA = new RegExp(`^(${NUM})meg(?:${UNITS})?$`, 'i');
const RKM = new RegExp(`^([+-]?\\d+)([pnuµμmkKMGRr])(\\d+)(?:${UNITS})?$`); // 4k7 / 1R2 style
const PLAIN = new RegExp(`^(${NUM})\\s*([pnuµμmkKMGRr])?\\s*(?:${UNITS})?$`);
const MAX_LENGTH = 40; // a value is a number and a unit: anything longer is not one

export function parseValue(raw) {
  if (raw == null) return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  let s = String(raw).trim().replace(/\s+/g, '');
  if (s.length > MAX_LENGTH) return null;
  // peel qualifiers off the end one at a time (a loop, not a repeated regex, so it cannot backtrack)
  for (let again = true; again;) {
    again = false;
    const low = s.toLowerCase();
    for (const q of QUALIFIERS) {
      if (low.length > q.length && low.endsWith(q)) { s = s.slice(0, -q.length); again = true; break; }
    }
  }
  const mega = MEGA.exec(s);
  if (mega) return Number(mega[1]) * 1e6;
  let m = RKM.exec(s);
  if (m) return (m[1].startsWith('-') ? -1 : 1) * (Math.abs(Number(m[1])) + Number('0.' + m[3])) * PREFIX[m[2]];
  m = PLAIN.exec(s);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return null;
  return m[2] ? n * PREFIX[m[2]] : n;
}

// Format back for messages: 4700 -> "4.7k", 1e-7 -> "100n".
export function formatValue(v, unit = '') {
  if (!Number.isFinite(v)) return String(v);
  const steps = [[1e9, 'G'], [1e6, 'M'], [1e3, 'k'], [1, ''], [1e-3, 'm'], [1e-6, 'µ'], [1e-9, 'n'], [1e-12, 'p']];
  const a = Math.abs(v);
  for (const [f, p] of steps) {
    if (a >= f) return `${+(v / f).toPrecision(3)}${p}${unit}`;
  }
  return `${+v.toPrecision(3)}${unit}`;
}

// Supply voltage implied by a rail name such as "+12V", "3V3", "5V".
export function railVoltage(name) {
  if (!name) return null;
  const s = String(name).trim();
  let m = /^([+-]?\d+)V(\d+)$/i.exec(s);           // 3V3
  if (m) return Number(`${m[1]}.${m[2]}`);
  m = /^([+-]?\d*\.?\d+)\s*V$/i.exec(s.replace(/^\+/, '+'));
  if (m) return Number(m[1]);
  return null;
}
