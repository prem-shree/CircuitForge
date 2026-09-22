// The AI endpoints must never hand back a circuit that has not been through the
// full validation pipeline. A fake provider stands in for the model so these
// tests never touch the network.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { handleAIRequest } from '../src/api/ai-handler.js';
import { runPipeline } from '../src/api/pipeline.js';
import { extractJSON, availableProviders, createProvider, PROVIDERS } from '../src/api/ai.js';

const good = JSON.parse(fs.readFileSync(new URL('../examples/01-led-resistor.json', import.meta.url), 'utf8'));
const fakeProvider = (replies) => {
  const queue = [...replies];
  const calls = [];
  return {
    name: 'fake', model: 'fake-1', calls,
    async complete({ system, prompt }) { calls.push({ system, prompt }); return queue.shift() ?? ''; },
  };
};
const post = (path, body, opts) => handleAIRequest({ method: 'POST', path, headers: {}, body }, { env: {}, ...opts });
const parse = (r) => JSON.parse(r.body);

test('pipeline stops at the first failing stage', () => {
  assert.equal(runPipeline('{oops').stage, 'json');
  assert.equal(runPipeline({ components: 'x' }).stage, 'validation');
  assert.equal(runPipeline({ components: [{ id: 'R1', type: 'nope' }] }).stage, 'validation');
  // schema-valid but electrically wrong: shorted source
  const shorted = { components: [{ id: 'V1', type: 'dc_source', value: '5V' }, { id: 'G', type: 'ground' }], connections: [['V1.positive', 'V1.negative', 'G']] };
  const r = runPipeline(shorted);
  assert.equal(r.ok, false);
  assert.equal(r.stage, 'electrical');
  assert.ok(r.errors.some((e) => e.code === 'SOURCE_SHORTED'));
  assert.equal(runPipeline(shorted, { allowDesignErrors: true }).ok, true);
  const ok = runPipeline(good);
  assert.equal(ok.ok, true);
  assert.match(ok.svg, /^<svg/);
});

test('extractJSON copes with fences and commentary', () => {
  assert.equal(extractJSON('Here you go:\n```json\n{"a":1}\n```'), '{"a":1}');
  assert.equal(extractJSON('{"a":"}"}\ntrailing'), '{"a":"}"}');
  assert.equal(extractJSON('no json here'), null);
});

test('generate validates the model output and returns a rendered circuit', async () => {
  const provider = fakeProvider([JSON.stringify(good)]);
  const r = await post('/api/ai/generate', { prompt: 'led with a resistor' }, { provider });
  assert.equal(r.status, 200);
  const out = parse(r);
  assert.equal(out.valid, true);
  assert.match(out.svg, /^<svg/);
  assert.equal(out.circuit.components.length, good.components.length);
  assert.match(provider.calls[0].system, /Only these component types/);
});

test('generate retries once with the validation errors, then gives up', async () => {
  const brokenThenGood = fakeProvider(['{"components":[{"id":"R1","type":"resistr"}],"connections":[]}', JSON.stringify(good)]);
  const r = await post('/api/ai/generate', { prompt: 'x' }, { provider: brokenThenGood });
  assert.equal(r.status, 200);
  assert.equal(brokenThenGood.calls.length, 2);
  assert.match(brokenThenGood.calls[1].prompt, /UNKNOWN_TYPE/);

  const alwaysBroken = fakeProvider(['{"components":[{"id":"R1","type":"resistr"}],"connections":[]}', '{"components":[{"id":"R1","type":"resistr"}],"connections":[]}']);
  const bad = await post('/api/ai/generate', { prompt: 'x' }, { provider: alwaysBroken });
  assert.equal(bad.status, 422);
  const out = parse(bad);
  assert.equal(out.valid, false);
  assert.equal(out.stage, 'validation');
  assert.ok(out.errors.some((e) => e.code === 'UNKNOWN_TYPE'));
  assert.ok(!out.svg);
});

test('generate rejects a model reply that is not JSON', async () => {
  const r = await post('/api/ai/generate', { prompt: 'x' }, { provider: fakeProvider(['I cannot do that.']) });
  assert.equal(r.status, 502);
  assert.match(parse(r).message, /did not return JSON/);
});

test('explain and analyze work without any AI provider', async () => {
  const e = await post('/api/ai/explain', { circuit: good });
  assert.equal(e.status, 200);
  const out = parse(e);
  assert.equal(out.aiUsed, false);
  assert.ok(out.education.components.some((c) => c.type === 'led'));
  assert.ok(out.education.components.find((c) => c.type === 'led').formulas.length);

  const bad = { components: [{ id: 'V1', type: 'dc_source', value: '5V' }, { id: 'D1', type: 'led' }, { id: 'G', type: 'ground' }], connections: [['V1.positive', 'D1.anode'], ['D1.cathode', 'G'], ['V1.negative', 'G']] };
  const a = await post('/api/ai/analyze', { circuit: bad });
  assert.equal(a.status, 200);
  const rep = parse(a);
  assert.equal(rep.aiUsed, false);
  assert.ok(rep.findings.some((f) => f.code === 'LED_NO_CURRENT_LIMIT'));
  assert.equal(rep.summary.warnings >= 1, true);
});

test('explain and analyze survive a provider outage', async () => {
  const boom = { name: 'boom', model: 'x', async complete() { throw new Error('provider exploded'); } };
  const e = await post('/api/ai/explain', { circuit: good }, { provider: boom });
  assert.equal(e.status, 200);
  const out = parse(e);
  assert.equal(out.aiUsed, false);
  assert.match(out.aiError, /exploded/);
  assert.ok(out.education.components.length, 'the deterministic report is still returned');

  const a = await post('/api/ai/analyze', { circuit: good }, { provider: boom });
  assert.equal(a.status, 200);
  assert.match(parse(a).aiError, /exploded/);
  assert.ok(parse(a).summary);
});

test('fix returns a repaired circuit only when it validates', async () => {
  const broken = { components: [{ id: 'V1', type: 'dc_source', value: '5V' }, { id: 'D1', type: 'led' }, { id: 'G', type: 'ground' }], connections: [['V1.positive', 'D1.anode'], ['D1.cathode', 'G'], ['V1.negative', 'G']] };
  const ok = await post('/api/ai/fix', { circuit: broken }, { provider: fakeProvider([JSON.stringify(good)]) });
  assert.equal(ok.status, 200);
  const out = parse(ok);
  assert.equal(out.changed, true);
  assert.ok(out.before.findings.some((f) => f.code === 'LED_NO_CURRENT_LIMIT'));
  assert.ok(!out.after.findings.some((f) => f.code === 'LED_NO_CURRENT_LIMIT'));

  const worse = await post('/api/ai/fix', { circuit: broken }, { provider: fakeProvider(['{"components":[{"id":"R1","type":"resistr"}],"connections":[]}']) });
  assert.equal(worse.status, 422);
  assert.match(parse(worse).message, /original was kept/);

  const nothing = await post('/api/ai/fix', { circuit: good }, { provider: fakeProvider([]) });
  assert.equal(parse(nothing).changed, false);
});

test('AI endpoints honour API keys and reject bad routes', async () => {
  const denied = await handleAIRequest({ method: 'POST', path: '/api/ai/generate', headers: {}, body: { prompt: 'x' } }, { env: {}, apiKeys: ['k'], provider: fakeProvider([JSON.stringify(good)]) });
  assert.equal(denied.status, 401);
  const allowed = await handleAIRequest({ method: 'POST', path: '/api/ai/generate', headers: { authorization: 'Bearer k' }, body: { prompt: 'x' } }, { env: {}, apiKeys: ['k'], provider: fakeProvider([JSON.stringify(good)]) });
  assert.equal(allowed.status, 200);
  assert.equal((await post('/api/ai/nope', {})).status, 404);
  assert.equal((await handleAIRequest({ method: 'GET', path: '/api/ai/generate' }, { env: {} })).status, 405);
  const noKey = await post('/api/ai/generate', { prompt: 'x' });
  assert.equal(noKey.status, 503);
  assert.match(parse(noKey).message, /ANTHROPIC_API_KEY/);
});

test('provider selection reads keys from the environment only', () => {
  assert.deepEqual(availableProviders({}), []);
  assert.deepEqual(availableProviders({ OPENAI_API_KEY: 'x' }), ['openai']);
  const p = createProvider({ env: { ANTHROPIC_API_KEY: 'secret', GOOGLE_AI_API_KEY: 'g' } });
  assert.equal(p.name, 'anthropic');
  assert.equal(p.model, PROVIDERS.anthropic.defaultModel);
  assert.equal(createProvider({ provider: 'google', env: { GOOGLE_AI_API_KEY: 'g' } }).name, 'google');
  assert.throws(() => createProvider({ provider: 'google', env: { OPENAI_API_KEY: 'x' } }), /GOOGLE_AI_API_KEY/);
  assert.equal(createProvider({ env: {} }), null);
  // the browser bundle must not be able to reach a key
  const bundled = fs.readFileSync(new URL('../src/ui/main.js', import.meta.url), 'utf8');
  assert.ok(!/ANTHROPIC_API_KEY|OPENAI_API_KEY|GOOGLE_AI_API_KEY|api\/ai\.js/.test(bundled), 'the UI must not import AI provider code');
});

test('providers send the key in the right place', async () => {
  const seen = [];
  const fetchImpl = async (url, init) => {
    seen.push({ url, init });
    return { ok: true, status: 200, text: async () => JSON.stringify({ content: [{ type: 'text', text: '{}' }], choices: [{ message: { content: '{}' } }], candidates: [{ content: { parts: [{ text: '{}' }] } }] }) };
  };
  for (const name of ['anthropic', 'openai', 'google']) {
    const env = { ANTHROPIC_API_KEY: 'a-key', OPENAI_API_KEY: 'o-key', GOOGLE_AI_API_KEY: 'g-key' };
    const p = createProvider({ provider: name, env, fetchImpl });
    const text = await p.complete({ system: 's', prompt: 'p' });
    assert.equal(text, '{}');
  }
  assert.equal(seen[0].init.headers['x-api-key'], 'a-key');
  assert.equal(seen[1].init.headers.authorization, 'Bearer o-key');
  assert.match(seen[2].url, /key=g-key/);
});
