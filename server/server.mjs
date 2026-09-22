// Reference HTTP server for the CircuitForge API (Node >= 20, no dependencies).
//
//   node server/server.mjs                     # http://localhost:8787
//   CF_API_KEYS=key1,key2 node server/server.mjs
//
//   curl -X POST localhost:8787/api/v1/render -H 'content-type: application/json' \
//        -d '{"circuit": {...}, "format": "svg"}'
//   curl -X POST localhost:8787/api/ai/generate -H 'content-type: application/json' \
//        -d '{"prompt": "555 astable blinking an LED at 1 Hz"}'
//
// Provider keys are read from the environment (see .env.example) and stay on the
// server: nothing in dist/ can reach them.
import http from 'node:http';
import fs from 'node:fs';
import { handleRequest } from '../src/api/handler.js';
import { handleAIRequest, aiRoutes } from '../src/api/ai-handler.js';
import { availableProviders } from '../src/api/ai.js';

// tiny .env loader so the reference server needs no dependency
const envFile = new URL('../.env', import.meta.url);
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const PORT = Number(process.env.PORT) || 8787;
const apiKeys = (process.env.CF_API_KEYS || '').split(',').map((s) => s.trim()).filter(Boolean);
const MAX_BODY = 1 << 20;

http.createServer((req, res) => {
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type, authorization, x-api-key' };
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
  let body = '';
  req.on('data', (c) => {
    body += c;
    if (body.length > MAX_BODY) { res.writeHead(413, cors); res.end(); req.destroy(); }
  });
  req.on('end', async () => {
    const path = new URL(req.url, 'http://x').pathname;
    const request = { method: req.method, path, headers: req.headers, body };
    try {
      const out = aiRoutes().includes(path.replace(/\/+$/, ''))
        ? await handleAIRequest(request, { apiKeys })
        : handleRequest(request, { apiKeys });
      res.writeHead(out.status, { ...cors, ...out.headers });
      res.end(out.body);
    } catch (e) {
      res.writeHead(500, { ...cors, 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'SERVER_ERROR', message: e.message }));
    }
  });
}).listen(PORT, () => {
  const providers = availableProviders();
  console.log(`CircuitForge API on http://localhost:${PORT}`);
  console.log(`  auth:      ${apiKeys.length ? `${apiKeys.length} API key(s) required` : 'open (no keys configured)'}`);
  console.log(`  render:    POST /api/v1/render, /api/v1/validate`);
  console.log(`  ai:        ${providers.length ? `POST /api/ai/{generate,explain,analyze,fix} via ${providers.join(', ')}` : 'no provider key set — generate/fix disabled, explain/analyze still work'}`);
});
