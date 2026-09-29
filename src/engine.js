// Public entry point shared by the web UI, tests and the HTTP API.
//   validate(circuit)          -> { valid, errors, warnings, findings }
//   render(circuit, options)   -> { valid, errors, warnings, findings, svg, width, height, scene }
//   buildScene(circuit)        -> geometry without SVG
//   explain(type | circuit)    -> educational notes
//
// Stages: parse -> validate -> net graph -> electrical rules -> layout -> route -> render.
//
// None of these throw: an unexpected failure inside a stage comes back as an
// INTERNAL_ERROR entry in `errors`, so a bad document can never take down the UI
// or an API worker. Problems that can be located carry a JSON `path` and, when
// the input was text, a `line`/`column`.
import { validateCircuit } from './validator/index.js';
import { checkElectrical } from './validator/electrical.js';
import { buildNetlist } from './graph/index.js';
import { planLayout } from './layout/optimize.js';
import { renderSVG } from './renderer/index.js';
import { annotateLines } from './parser/locate.js';

const hasDesignError = (findings) => findings.some((f) => f.severity === 'error');
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

const crash = (stage, e) => ({
  code: 'INTERNAL_ERROR',
  message: `CircuitForge hit an unexpected problem while ${stage} (${e?.name || 'Error'}: ${e?.message || e}). Your circuit was not changed; please report the JSON that caused this.`,
});
const failed = (stage, e) => ({ valid: false, errors: [crash(stage, e)], warnings: [], findings: [], svg: null });

// Give every located problem a JSON path (from its component) and, when the input
// was text, a line and column.
function locate(problems, v, text) {
  const paths = v.resolved?.paths;
  if (paths) for (const p of problems) if (!p.path && p.component && paths.has(p.component)) p.path = paths.get(p.component);
  if (text !== null) annotateLines(problems, text);
  return problems;
}
const textOf = (input, v) => (typeof input === 'string' && !v.wrapped ? input : null);

export function validate(input, options = {}) {
  try {
    const v = validateCircuit(input, options);
    const text = textOf(input, v);
    if (!v.valid) return { valid: false, errors: locate(v.errors, v, text), warnings: locate(v.warnings, v, text), findings: [] };
    let findings = [];
    try {
      const nl = buildNetlist(v);
      v.warnings.push(...nl.warnings);
      findings = checkElectrical({ circuit: v.circuit, netlist: nl });
    } catch (e) {
      v.warnings.push({ code: 'RULE_FAILURE', message: `Electrical checks could not run: ${e.message}` });
    }
    return { valid: !hasDesignError(findings), errors: v.errors, warnings: locate(v.warnings, v, text), findings: locate(findings, v, text) };
  } catch (e) {
    return failed('checking the circuit', e);
  }
}

// Build the geometric scene (netlist + placement + routing) without SVG output.
export function buildScene(input, v = validateCircuit(input), options = {}) {
  if (!v.valid) return { v, scene: null };
  const warnings = v.warnings;
  const nl = buildNetlist(v);
  warnings.push(...nl.warnings);
  // layout, label placement and routing run together: the spacing optimizer
  // scores each routed attempt and keeps the best one
  let plan;
  try {
    plan = planLayout(nl, v.circuit, { workBudget: options.workBudget });
  } catch (e) {
    v.errors.push({ code: 'LAYOUT_FAILURE', message: `Layout failed: ${e.message}` });
    v.valid = false;
    return { v, scene: null };
  }
  const { placement, routing } = plan;
  const limited = routing.failures.filter((f) => f.reason === 'work-limit');
  for (const f of routing.failures) {
    if (f.reason === 'work-limit') continue; // summarised below
    warnings.push({ code: 'ROUTING_FAILURE', component: f.comp, pin: f.pin, message: f.reason === 'too-large'
      ? `The sheet is too large to route (${f.comp}.${f.pin} and its net were drawn with direct wires). Move the parts closer together or remove far-away manual positions.`
      : `Could not find a clean route to ${f.comp}.${f.pin}; drew a direct wire instead.` });
  }
  if (limited.length) {
    warnings.push({ code: 'ROUTING_FAILURE', component: limited[0].comp, pin: limited[0].pin, message: `The circuit is too dense to route completely: ${limited.length} connection${limited.length > 1 ? 's were' : ' was'} drawn as direct wires (first: ${limited[0].comp}.${limited[0].pin}). Split it into sections, or add "layout": { "spacing": "spacious" }.` });
  }
  let findings = [];
  try {
    findings = checkElectrical({ circuit: v.circuit, netlist: nl, routing });
  } catch (e) {
    warnings.push({ code: 'RULE_FAILURE', message: `Electrical checks could not run: ${e.message}` });
  }
  return {
    v,
    scene: {
      title: v.circuit.title,
      circuit: v.circuit,
      netlist: nl,
      instances: placement.instances,
      routing,
      findings,
      layout: placement.config,
      layoutInfo: plan.metrics,
    },
  };
}

export function render(input, options = {}) {
  const t0 = now();
  try {
    const v = validateCircuit(input, options);
    const text = textOf(input, v);
    const { scene } = buildScene(input, v, options);
    if (!scene) return { valid: false, errors: locate(v.errors, v, text), warnings: locate(v.warnings, v, text), findings: [], svg: null };
    const out = renderSVG(scene, options);
    locate(scene.findings, v, text);
    return {
      valid: !hasDesignError(scene.findings),
      errors: v.errors,
      warnings: locate(v.warnings, v, text),
      findings: scene.findings,
      svg: out.svg,
      width: out.width,
      height: out.height,
      viewBox: out.viewBox,
      scene,
      ms: Math.round(now() - t0),
    };
  } catch (e) {
    return failed('drawing the circuit', e);
  }
}

export { listTypes } from './symbol-loader/index.js';
export { explainType, explainCircuit, RULE_HELP } from './education/index.js';
export { RULE_CODES } from './validator/electrical.js';
export { DEFAULT_LAYOUT } from './layout/config.js';
export { LIMITS } from './validator/index.js';
