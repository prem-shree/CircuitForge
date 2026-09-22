// Public entry point shared by the web UI, tests and the HTTP API.
//   validate(circuit)          -> { valid, errors, warnings, findings }
//   render(circuit, options)   -> { valid, errors, warnings, findings, svg, width, height, scene }
//   buildScene(circuit)        -> geometry without SVG
//   explain(type | circuit)    -> educational notes
//
// Stages: parse -> validate -> net graph -> electrical rules -> layout -> route -> render.
import { validateCircuit } from './validator/index.js';
import { checkElectrical } from './validator/electrical.js';
import { buildNetlist } from './graph/index.js';
import { layoutCircuit } from './layout/index.js';
import { routeCircuit } from './router/index.js';
import { placeLabels } from './layout/labels.js';
import { renderSVG } from './renderer/index.js';

const hasDesignError = (findings) => findings.some((f) => f.severity === 'error');

export function validate(input) {
  const v = validateCircuit(input);
  if (!v.valid) return { valid: false, errors: v.errors, warnings: v.warnings, findings: [] };
  let findings = [];
  try {
    findings = checkElectrical({ circuit: v.circuit, netlist: buildNetlist(v) });
  } catch (e) {
    v.warnings.push({ code: 'RULE_FAILURE', message: `Electrical checks could not run: ${e.message}` });
  }
  return { valid: !hasDesignError(findings), errors: v.errors, warnings: v.warnings, findings };
}

// Build the geometric scene (netlist + placement + routing) without SVG output.
export function buildScene(input, v = validateCircuit(input)) {
  if (!v.valid) return { v, scene: null };
  const warnings = v.warnings;
  const nl = buildNetlist(v);
  let placement;
  try {
    placement = layoutCircuit(nl, v.circuit);
  } catch (e) {
    v.errors.push({ code: 'LAYOUT_FAILURE', message: `Layout failed: ${e.message}` });
    v.valid = false;
    return { v, scene: null };
  }
  let routing;
  try {
    routing = routeCircuit(nl, placement.instances);
  } catch (e) {
    v.errors.push({ code: 'ROUTING_FAILURE', message: `Routing failed: ${e.message}` });
    v.valid = false;
    return { v, scene: null };
  }
  for (const f of routing.failures) {
    warnings.push({ code: 'ROUTING_FAILURE', component: f.comp, pin: f.pin, message: `Could not find a clean route to ${f.comp}.${f.pin}; drew a direct wire instead.` });
  }
  placeLabels(placement.instances, routing);
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
    },
  };
}

export function render(input, options = {}) {
  const v = validateCircuit(input);
  const { scene } = buildScene(input, v);
  if (!scene) return { valid: false, errors: v.errors, warnings: v.warnings, findings: [], svg: null };
  const out = renderSVG(scene, options);
  return {
    valid: !hasDesignError(scene.findings),
    errors: v.errors,
    warnings: v.warnings,
    findings: scene.findings,
    svg: out.svg,
    width: out.width,
    height: out.height,
    viewBox: out.viewBox,
    scene,
  };
}

export { listTypes } from './symbol-loader/index.js';
export { explainType, explainCircuit, RULE_HELP } from './education/index.js';
export { RULE_CODES } from './validator/electrical.js';
export { DEFAULT_LAYOUT } from './layout/config.js';
