// Transport-agnostic request handler for the planned HTTP API.
//   handleRequest({ method, path, headers, body }, { apiKeys }) -> { status, headers, body }
// Used by server/server.mjs (Node) and by the in-page API explorer.
import { render, validate } from '../engine.js';

const json = (status, obj) => ({ status, headers: { 'content-type': 'application/json; charset=utf-8' }, body: JSON.stringify(obj, null, 2) });

export function handleRequest(req, { apiKeys = null } = {}) {
  const path = (req.path || '').replace(/\/+$/, '');
  if (!['/api/v1/render', '/api/v1/validate'].includes(path)) return json(404, { error: 'NOT_FOUND', message: `No route for ${req.path}` });
  if (req.method !== 'POST') return json(405, { error: 'METHOD_NOT_ALLOWED', message: 'Use POST.' });
  if (apiKeys && apiKeys.length) {
    const auth = req.headers?.authorization || req.headers?.Authorization || '';
    const key = auth.replace(/^Bearer\s+/i, '') || req.headers?.['x-api-key'];
    if (!apiKeys.includes(key)) return json(401, { error: 'UNAUTHORIZED', message: 'Missing or invalid API key.' });
  }
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { return json(400, { valid: false, errors: [{ code: 'INVALID_JSON', message: `Invalid JSON body: ${e.message}` }] }); }
  }
  if (!body || typeof body !== 'object' || !body.circuit) return json(400, { valid: false, errors: [{ code: 'INVALID_REQUEST', message: 'Body must be { "circuit": { … }, "format"?: "svg" }.' }] });

  if (path === '/api/v1/validate') {
    const v = validate(body.circuit);
    return json(v.valid ? 200 : 422, v);
  }
  const format = String(body.format || 'svg').toLowerCase();
  if (format === 'png' || format === 'pdf' || format === 'jpeg') {
    return json(501, { error: 'NOT_IMPLEMENTED', message: `Server-side ${format.toUpperCase()} rendering is planned (resvg-based). Render SVG and rasterize client-side for now.` });
  }
  if (format !== 'svg' && format !== 'json') return json(400, { error: 'INVALID_FORMAT', message: 'format must be "svg" or "json".' });
  const r = render(body.circuit, { theme: body.theme === 'dark' ? 'dark' : 'light', bridges: !!body.bridges, background: body.transparent ? null : undefined });
  if (!r.valid) return json(422, { valid: false, errors: r.errors, warnings: r.warnings });
  if (format === 'svg') return { status: 200, headers: { 'content-type': 'image/svg+xml; charset=utf-8' }, body: r.svg };
  return json(200, { valid: true, warnings: r.warnings, width: r.width, height: r.height, svg: r.svg });
}
