// Parse engineering values: "4.7kΩ" -> 4700, "100nF" -> 1e-7, "+12V" -> 12, "1M" -> 1e6.
const PREFIX = { p: 1e-12, n: 1e-9, u: 1e-6, µ: 1e-6, μ: 1e-6, m: 1e-3, k: 1e3, K: 1e3, M: 1e6, G: 1e9, R: 1, r: 1 };
const UNITS = 'Ω|ohm|ohms|F|H|V|A|W|Hz|s';

export function parseValue(raw) {
  if (raw == null) return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  const s = String(raw).trim().replace(/\s+/g, '');
  // 4k7 / 1R2 style
  let m = new RegExp(`^([+-]?\\d+)([pnuµμmkKMGRr])(\\d+)(?:${UNITS})?$`).exec(s);
  if (m) return (Number(m[1]) + Number('0.' + m[3])) * PREFIX[m[2]];
  m = new RegExp(`^([+-]?(?:\\d+\\.?\\d*|\\.\\d+))\\s*([pnuµμmkKMGRr])?\\s*(?:${UNITS})?$`).exec(s);
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
