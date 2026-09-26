// Layout spacing, configurable per circuit:
//   "layout": { "spacing": "auto", "grid": 20, "componentGap": 60, "wireGap": 20, "labelGap": 15, "sectionGap": 100 }
//
// "spacing" picks a preset; any explicit number overrides that one value. With
// "auto" (the default) the preset follows the size of the circuit, and the
// optimizer (optimize.js) may still widen individual gaps where wiring is
// congested — it never shrinks below what is configured here.
export const DEFAULT_LAYOUT = {
  grid: 10,          // placement grid; must be a multiple of the 10px routing grid
  componentGap: 40,  // horizontal gap between columns
  wireGap: 16,       // clearance kept around a part (wires and other parts)
  labelGap: 6,       // gap between a body and its reference/value text
  sectionGap: 60,    // vertical gap between unconnected sub-circuits
};

export const SPACING_PRESETS = {
  compact: { componentGap: 30, wireGap: 12, labelGap: 4, sectionGap: 40 },
  normal: { componentGap: 40, wireGap: 16, labelGap: 6, sectionGap: 60 },
  comfortable: { componentGap: 50, wireGap: 20, labelGap: 7, sectionGap: 70 },
  spacious: { componentGap: 70, wireGap: 26, labelGap: 9, sectionGap: 100 },
};

export const SECTIONS = ['input', 'process', 'output', 'power'];

// Small sheets get room to breathe; big ones stay compact enough to read.
export function autoSpacing(stats = {}) {
  const n = stats.parts ?? 10;
  if (n <= 6) return SPACING_PRESETS.comfortable;
  if (n <= 24) return SPACING_PRESETS.normal;
  return { componentGap: 36, wireGap: 14, labelGap: 6, sectionGap: 50 };
}

export function normalizeLayout(circuit, stats) {
  const raw = (circuit && typeof circuit.layout === 'object' && circuit.layout) || {};
  const preset = SPACING_PRESETS[raw.spacing] || autoSpacing(stats);
  const num = (v, d, min, max) => (Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : d);
  const grid = Math.max(10, Math.round(num(raw.grid, DEFAULT_LAYOUT.grid, 10, 100) / 10) * 10);
  return {
    spacing: SPACING_PRESETS[raw.spacing] ? raw.spacing : 'auto',
    grid,
    componentGap: Math.round(num(raw.componentGap, preset.componentGap, 20, 400) / 10) * 10,
    wireGap: num(raw.wireGap, preset.wireGap, 4, 200),
    labelGap: num(raw.labelGap, preset.labelGap, 2, 60),
    sectionGap: Math.round(num(raw.sectionGap, preset.sectionGap, 20, 600) / 10) * 10,
    bridges: raw.bridges !== false,
    optimize: raw.optimize !== false,
    // which values the user pinned (the optimizer leaves those alone)
    fixed: ['componentGap', 'wireGap', 'labelGap', 'sectionGap'].filter((k) => Number.isFinite(raw[k])),
  };
}
