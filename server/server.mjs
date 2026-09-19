// Reference HTTP server for the CircuitForge API (Node >= 18, no dependencies).
//   node server/server.mjs                 # PORT=8787 by default
//   CF_API_KEYS=key1,key2 node server/server.mjs
//
//   curl -X POST localhost:8787/api/v1/render -H 'content-type: application/json' \
//        -d '{"circuit": {...}, "format": "svg"}'
import http from 'node:http';
import { handleRequest } from '../src/api/handler.js';

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
  req.on('end', () => {
    const out = handleRequest({ method: req.method, path: new URL(req.url, 'http://x').pathname, headers: req.headers, body }, { apiKeys });
    res.writeHead(out.status, { ...cors, ...out.headers });
    res.end(out.body);
  });
}).listen(PORT, () => console.log(`CircuitForge API on http://localhost:${PORT} ${apiKeys.length ? '(API keys required)' : '(no auth)'}`));
