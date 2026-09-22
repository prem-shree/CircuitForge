// The only way circuit JSON from an untrusted source (an LLM, an upload, a user
// paste) is allowed into the app: every stage runs in order and the first failure
// stops it.
//
//   JSON -> schema -> components -> pins -> connections -> electrical -> layout -> routing -> SVG
import { parseJSON } from '../parser/index.js';
import { render, validate } from '../engine.js';

const fail = (stage, errors, extra = {}) => ({ ok: false, stage, errors, warnings: [], findings: [], ...extra });

export function runPipeline(input, { allowDesignErrors = false, render: wantSvg = true } = {}) {
  let circuit = input;
  if (typeof input === 'string') {
    const parsed = parseJSON(input);
    if (parsed.errors.length) return fail('json', parsed.errors);
    circuit = parsed.value;
  }
  if (!circuit || typeof circuit !== 'object' || Array.isArray(circuit)) {
    return fail('schema', [{ code: 'INVALID_SCHEMA', message: 'The circuit must be a JSON object.' }]);
  }
  if (circuit.circuit && !circuit.components) circuit = circuit.circuit;

  // schema + component + pin + connection validation, then the electrical rules
  const v = validate(circuit);
  if (v.errors.length) return fail('validation', v.errors, { warnings: v.warnings, findings: v.findings, circuit });
  const designErrors = v.findings.filter((f) => f.severity === 'error');
  if (designErrors.length && !allowDesignErrors) {
    return fail('electrical', designErrors, { warnings: v.warnings, findings: v.findings, circuit });
  }

  if (!wantSvg) return { ok: true, stage: 'electrical', circuit, errors: [], warnings: v.warnings, findings: v.findings };

  // layout + routing + rendering
  const r = render(circuit);
  if (!r.svg) return fail('layout', r.errors, { warnings: r.warnings, findings: r.findings, circuit });
  return {
    ok: true,
    stage: 'render',
    circuit,
    svg: r.svg,
    width: r.width,
    height: r.height,
    errors: [],
    warnings: r.warnings,
    findings: r.findings,
  };
}
