// Public entry point shared by the web UI, tests and the (future) HTTP API.
//   render(circuitJsonOrObject, options) -> { valid, errors, warnings, svg, width, height, scene }
//   validate(circuitJsonOrObject)        -> { valid, errors, warnings }
import { validateCircuit } from './validator/index.js';
import { buildNetlist } from './graph/index.js';
import { layoutCircuit } from './layout/index.js';
import { routeCircuit } from './router/index.js';
import { placeLabels } from './layout/labels.js';
import { renderSVG } from './renderer/index.js';

export function validate(input) {
  const v = validateCircuit(input);
  return { valid: v.valid, errors: v.errors, warnings: v.warnings };
}

// Build the geometric scene (netlist + placement + routing) without SVG output.
export function buildScene(input, v = validateCircuit(input)) {
  if (!v.valid) return { v, scene: null };
  const warnings = v.warnings;
  const nl = buildNetlist(v);
  let placement;
  try {
    placement = layoutCircuit(nl);
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
  return { v, scene: { title: v.circuit.title, netlist: nl, instances: placement.instances, routing } };
}

export function render(input, options = {}) {
  const v = validateCircuit(input);
  const { scene } = buildScene(input, v);
  if (!scene) return { valid: false, errors: v.errors, warnings: v.warnings, svg: null };
  const out = renderSVG(scene, options);
  return { valid: true, errors: [], warnings: v.warnings, svg: out.svg, width: out.width, height: out.height, viewBox: out.viewBox, scene };
}

export { listTypes } from './symbol-loader/index.js';
