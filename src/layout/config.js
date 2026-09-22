// Layout spacing, configurable per circuit:
//   "layout": { "grid": 20, "componentGap": 60, "wireGap": 20, "labelGap": 15, "sectionGap": 100 }
export const DEFAULT_LAYOUT = {
  grid: 10,          // placement grid; must be a multiple of the 10px routing grid
  componentGap: 40,  // horizontal gap between columns
  wireGap: 16,       // clearance kept around a part (wires and other parts)
  labelGap: 6,       // gap between a body and its reference/value text
  sectionGap: 60,    // vertical gap between unconnected sub-circuits
};

export const SECTIONS = ['input', 'process', 'output', 'power'];

export function normalizeLayout(circuit) {
  const raw = (circuit && typeof circuit.layout === 'object' && circuit.layout) || {};
  const num = (v, d, min, max) => (Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : d);
  const grid = Math.max(10, Math.round(num(raw.grid, DEFAULT_LAYOUT.grid, 10, 100) / 10) * 10);
  return {
    grid,
    componentGap: Math.round(num(raw.componentGap, DEFAULT_LAYOUT.componentGap, 20, 400) / 10) * 10,
    wireGap: num(raw.wireGap, DEFAULT_LAYOUT.wireGap, 4, 200),
    labelGap: num(raw.labelGap, DEFAULT_LAYOUT.labelGap, 2, 60),
    sectionGap: Math.round(num(raw.sectionGap, DEFAULT_LAYOUT.sectionGap, 20, 600) / 10) * 10,
  };
}
