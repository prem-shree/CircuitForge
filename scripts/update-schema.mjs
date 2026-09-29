// Keeps the list of component types in schema/circuit.schema.json in step with the
// symbol library, so editors offer the right names. Run after adding a symbol:
//   npm run symbols && npm run schema
import fs from 'node:fs';
import path from 'node:path';
import { listTypes } from '../src/symbol-loader/index.js';

const file = path.resolve('schema/circuit.schema.json');
const names = listTypes().map((t) => t.type).sort();
const rows = [];
for (let i = 0; i < names.length; i += 6) rows.push(`              ${names.slice(i, i + 6).map((n) => JSON.stringify(n)).join(', ')}`);
const block = `"examples": [\n${rows.join(',\n')}\n            ]`;
const before = fs.readFileSync(file, 'utf8');
const after = before.replace(/"examples": \[[\s\S]*?\n\s*\]/, block);
if (after !== before) fs.writeFileSync(file, after);
JSON.parse(after); // never leave a broken schema behind
console.log(`${after === before ? 'schema already lists' : 'schema updated with'} ${names.length} component types`);
