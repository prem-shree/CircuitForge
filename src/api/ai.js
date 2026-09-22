// Provider abstraction for the AI endpoints.
//
// Keys are read from the environment on the server and never leave it: the
// browser bundle does not import this file. Add a provider by adding one entry
// to PROVIDERS — each one only has to turn a prompt into text.
import { listTypes } from '../symbol-loader/index.js';
import { RULE_CODES } from '../validator/electrical.js';

export const PROVIDERS = {
  anthropic: {
    envKey: 'ANTHROPIC_API_KEY',
    defaultModel: 'claude-sonnet-5',
    async complete({ key, model, system, prompt, maxTokens = 4000, fetchImpl = fetch }) {
      const res = await fetchImpl('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model, max_tokens: maxTokens, system, messages: [{ role: 'user', content: prompt }] }),
      });
      const data = await readJSON(res, 'Anthropic');
      return (data.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('');
    },
  },
  openai: {
    envKey: 'OPENAI_API_KEY',
    defaultModel: 'gpt-4o-mini',
    async complete({ key, model, system, prompt, maxTokens = 4000, fetchImpl = fetch }) {
      const res = await fetchImpl('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
        body: JSON.stringify({ model, max_completion_tokens: maxTokens, messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }] }),
      });
      const data = await readJSON(res, 'OpenAI');
      return data.choices?.[0]?.message?.content ?? '';
    },
  },
  google: {
    envKey: 'GOOGLE_AI_API_KEY',
    defaultModel: 'gemini-2.0-flash',
    async complete({ key, model, system, prompt, maxTokens = 4000, fetchImpl = fetch }) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
      const res = await fetchImpl(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: maxTokens },
        }),
      });
      const data = await readJSON(res, 'Google');
      return (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
    },
  },
};

async function readJSON(res, who) {
  const text = await res.text();
  if (!res.ok) throw new Error(`${who} API error ${res.status}: ${text.slice(0, 300)}`);
  try { return JSON.parse(text); } catch { throw new Error(`${who} returned a non-JSON response.`); }
}

// Which providers have a key configured in this process.
export function availableProviders(env = process.env) {
  return Object.entries(PROVIDERS).filter(([, p]) => !!env[p.envKey]).map(([name]) => name);
}

export function createProvider({ provider, model, env = process.env, fetchImpl = fetch } = {}) {
  const names = availableProviders(env);
  const name = provider || env.CF_AI_PROVIDER || names[0];
  if (!name) return null;
  const spec = PROVIDERS[name];
  if (!spec) throw new Error(`Unknown AI provider "${name}". Known: ${Object.keys(PROVIDERS).join(', ')}.`);
  const key = env[spec.envKey];
  if (!key) throw new Error(`No API key for ${name}: set ${spec.envKey} in the server environment.`);
  const chosen = model || env[`CF_${name.toUpperCase()}_MODEL`] || spec.defaultModel;
  return {
    name,
    model: chosen,
    complete: (args) => spec.complete({ key, model: chosen, fetchImpl, ...args }),
  };
}

// ---------------------------------------------------------------- prompts

let typeList = null;
const types = () => (typeList ??= listTypes().map((t) => t.type).sort().join(', '));

export const SYSTEM_PROMPT = () => `You generate circuits for CircuitForge, a JSON-to-schematic tool.

Reply with ONE JSON object and nothing else: no markdown fence, no commentary.

Shape:
{
  "title": string,
  "description": string,
  "components": [{ "id": "R1", "type": "resistor", "value": "1kΩ", "label"?: string,
                   "rotation"?: 0|90|180|270, "mirror"?: bool, "position"?: {"x":num,"y":num},
                   "section"?: "input"|"process"|"output"|"power",
                   "pins"?: { "left": [..], "right": [..], "top": [..], "bottom": [..] },
                   "params"?: object, "education"?: object }],
  "connections": [ ["R1.2","C1.1","U1.in-"], { "pins": ["A.1","B.2"], "net": "VOUT", "class": "signal" } ],
  "education"?: { "summary": string, "objectives": [string], "questions": [string] },
  "measurements"?: [{ "type": "voltage", "at": "VOUT", "label": "Vout", "expected": "3.3 V" }],
  "annotations"?: [{ "text": string, "at": "U1", "dy": -40 }]
}

Rules:
- Only these component types: ${types()}.
- Pin names must exist on the part. Two-terminal parts use "1"/"2"; diodes/LEDs use "anode"/"cathode";
  sources use "positive"/"negative"; transistors use B/C/E or G/D/S; op-amps use "in+"/"in-"/"out"/"v+"/"v-".
- Custom "pins" only work on box parts (generic_ic, microcontroller, memory, connector, boards…).
- Use "ground" for the reference and "vcc"/"vdd" with a value like "+5V" for supply rails. Every ground
  symbol is one net; the same applies to rails with the same value.
- Do NOT give positions unless asked: the layout engine places parts automatically.
- The design must be electrically sound. Checks that will run: ${RULE_CODES.join(', ')}.
- Always current-limit LEDs, give ICs power and ground, and never tie two outputs together.`;

export const EXPLAIN_PROMPT = 'You are teaching an electronics student. Explain the given circuit clearly and briefly: what each stage does, the key formulas with numbers from this circuit, and what to watch out for. Plain text, no markdown headings.';
export const ANALYZE_PROMPT = 'You are reviewing a student circuit. Given the circuit JSON and the automated findings, explain in plain language what is wrong, why it matters, and how to fix it. Be concrete and short.';
export const FIX_PROMPT = 'Repair the circuit JSON so that it passes validation. Keep the original intent and ids where possible. Reply with the corrected JSON object only.';

// Models like to wrap JSON in prose or fences; take the first JSON object.
export function extractJSON(text) {
  if (!text) return null;
  const fence = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  const body = fence ? fence[1] : text;
  const start = body.indexOf('{');
  if (start < 0) return null;
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < body.length; i++) {
    const ch = body[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) return body.slice(start, i + 1);
  }
  return null;
}
