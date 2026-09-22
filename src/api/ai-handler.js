// AI endpoints. Everything a model returns is treated as untrusted input and has
// to survive runPipeline() before it is handed back.
//
//   POST /api/ai/generate  { prompt, provider?, model? }
//   POST /api/ai/explain   { circuit, question? }
//   POST /api/ai/analyze   { circuit }
//   POST /api/ai/fix       { circuit, issue? }
//
// explain and analyze work without any API key: the deterministic report is
// always produced, and the model only adds prose when a key is configured.
import { runPipeline } from './pipeline.js';
import { createProvider, availableProviders, extractJSON, SYSTEM_PROMPT, EXPLAIN_PROMPT, ANALYZE_PROMPT, FIX_PROMPT } from './ai.js';
import { validate, explainCircuit } from '../engine.js';

const json = (status, obj) => ({ status, headers: { 'content-type': 'application/json; charset=utf-8' }, body: JSON.stringify(obj, null, 2) });
const MAX_REPAIRS = 1;

export function aiRoutes() {
  return ['/api/ai/generate', '/api/ai/explain', '/api/ai/analyze', '/api/ai/fix'];
}

export async function handleAIRequest(req, { env = process.env, fetchImpl = fetch, provider: injected = null, apiKeys = null } = {}) {
  const path = (req.path || '').replace(/\/+$/, '');
  if (!aiRoutes().includes(path)) return json(404, { error: 'NOT_FOUND', message: `No route for ${req.path}` });
  if (req.method !== 'POST') return json(405, { error: 'METHOD_NOT_ALLOWED', message: 'Use POST.' });
  if (apiKeys && apiKeys.length) {
    const auth = req.headers?.authorization || req.headers?.Authorization || '';
    const key = auth.replace(/^Bearer\s+/i, '') || req.headers?.['x-api-key'];
    if (!apiKeys.includes(key)) return json(401, { error: 'UNAUTHORIZED', message: 'Missing or invalid API key.' });
  }
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { return json(400, { error: 'INVALID_JSON', message: e.message }); }
  }
  body = body || {};

  const ai = () => {
    if (injected) return injected;
    const p = createProvider({ provider: body.provider, model: body.model, env, fetchImpl });
    if (!p) {
      const err = new Error('No AI provider is configured on this server. Set ANTHROPIC_API_KEY, OPENAI_API_KEY or GOOGLE_AI_API_KEY (see .env.example).');
      err.status = 503;
      throw err;
    }
    return p;
  };

  try {
    if (path === '/api/ai/generate') return await generate(body, ai);
    if (path === '/api/ai/fix') return await fix(body, ai);
    if (path === '/api/ai/explain') return await explain(body, ai, env, injected);
    return await analyze(body, ai, env, injected);
  } catch (e) {
    return json(e.status || 502, { error: 'AI_ERROR', message: e.message });
  }
}

async function askForCircuit(provider, prompt, attemptsOut) {
  const text = await provider.complete({ system: SYSTEM_PROMPT(), prompt });
  const raw = extractJSON(text);
  attemptsOut.push({ model: provider.model, provider: provider.name, gotJSON: !!raw });
  if (!raw) throw Object.assign(new Error('The model did not return JSON.'), { status: 502 });
  return raw;
}

async function generate(body, ai) {
  if (!body.prompt || typeof body.prompt !== 'string') {
    return json(400, { error: 'INVALID_REQUEST', message: 'Body must be { "prompt": "describe the circuit" }.' });
  }
  const provider = ai();
  const attempts = [];
  let raw = await askForCircuit(provider, body.prompt, attempts);
  let result = runPipeline(raw, { allowDesignErrors: !!body.allowDesignErrors });

  for (let i = 0; i < MAX_REPAIRS && !result.ok; i++) {
    // hand the failure back to the model once; never silently accept the first answer
    const repair = `${FIX_PROMPT}\n\nOriginal request: ${body.prompt}\n\nYour JSON:\n${raw}\n\nCircuitForge rejected it at the "${result.stage}" stage with:\n${result.errors.map((e) => `- ${e.code}: ${e.message}`).join('\n')}`;
    raw = await askForCircuit(provider, repair, attempts);
    result = runPipeline(raw, { allowDesignErrors: !!body.allowDesignErrors });
  }

  if (!result.ok) {
    return json(422, { valid: false, stage: result.stage, errors: result.errors, warnings: result.warnings, findings: result.findings, circuit: result.circuit ?? null, attempts });
  }
  return json(200, {
    valid: true, circuit: result.circuit, svg: body.format === 'json' ? undefined : result.svg,
    width: result.width, height: result.height, warnings: result.warnings, findings: result.findings, attempts,
  });
}

async function fix(body, ai) {
  if (!body.circuit) return json(400, { error: 'INVALID_REQUEST', message: 'Body must be { "circuit": { … } }.' });
  const before = runPipeline(body.circuit, { allowDesignErrors: true });
  const problems = [...(before.errors || []), ...(before.findings || []).filter((f) => f.severity !== 'info')];
  if (!problems.length) {
    return json(200, { valid: true, changed: false, message: 'Nothing to fix: the circuit already validates.', circuit: body.circuit, findings: before.findings });
  }
  const provider = ai();
  const attempts = [];
  const prompt = `${FIX_PROMPT}\n\n${body.issue ? `Focus on: ${body.issue}\n\n` : ''}Circuit:\n${JSON.stringify(body.circuit, null, 2)}\n\nProblems:\n${problems.map((p) => `- ${p.code}: ${p.message}${p.hint ? ` (${p.hint})` : ''}`).join('\n')}`;
  const raw = await askForCircuit(provider, prompt, attempts);
  const after = runPipeline(raw);
  if (!after.ok) {
    return json(422, { valid: false, stage: after.stage, errors: after.errors, findings: after.findings, attempts, message: 'The repaired circuit still fails validation; the original was kept.' });
  }
  return json(200, {
    valid: true, changed: true, circuit: after.circuit, svg: after.svg,
    before: { errors: before.errors, findings: before.findings },
    after: { warnings: after.warnings, findings: after.findings },
    attempts,
  });
}

async function explain(body, ai, env, injected) {
  if (!body.circuit) return json(400, { error: 'INVALID_REQUEST', message: 'Body must be { "circuit": { … } }.' });
  const v = validate(body.circuit);
  const report = explainCircuit(typeof body.circuit === 'string' ? JSON.parse(body.circuit) : body.circuit, v.findings);
  // The deterministic report is the product; the model only adds prose, so a
  // provider outage must not lose it.
  let narrative = null, aiError = null;
  if (injected || availableProviders(env).length || body.provider) {
    try {
      narrative = await ai().complete({
        system: EXPLAIN_PROMPT,
        prompt: `${body.question ? `Question: ${body.question}\n\n` : ''}Circuit JSON:\n${JSON.stringify(body.circuit, null, 2)}`,
      });
    } catch (e) { aiError = e.message; }
  }
  return json(200, { valid: v.valid, education: report, findings: v.findings, narrative, aiUsed: !!narrative, aiError });
}

async function analyze(body, ai, env, injected) {
  if (!body.circuit) return json(400, { error: 'INVALID_REQUEST', message: 'Body must be { "circuit": { … } }.' });
  const result = runPipeline(body.circuit, { allowDesignErrors: true, render: false });
  const v = validate(body.circuit);
  let review = null, aiError = null;
  if (injected || availableProviders(env).length || body.provider) {
    try {
      review = await ai().complete({
        system: ANALYZE_PROMPT,
        prompt: `Circuit JSON:\n${JSON.stringify(body.circuit, null, 2)}\n\nAutomated findings:\n${JSON.stringify(v.findings, null, 2)}`,
      });
    } catch (e) { aiError = e.message; }
  }
  return json(v.errors.length ? 422 : 200, {
    valid: v.valid,
    stage: result.stage,
    errors: v.errors,
    warnings: v.warnings,
    findings: v.findings,
    summary: {
      errors: v.errors.length,
      designErrors: v.findings.filter((f) => f.severity === 'error').length,
      warnings: v.findings.filter((f) => f.severity === 'warning').length,
    },
    review,
    aiUsed: !!review,
    aiError,
  });
}
