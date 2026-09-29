// Helpers for handling untrusted names. Circuit JSON comes from users, uploads and
// language models, so ids, pin names and types are used as object keys only after
// they pass through here: "constructor" or "__proto__" must never resolve to
// something inherited from Object.prototype.

export const RESERVED_NAMES = new Set(['__proto__', 'constructor', 'prototype']);

export const has = (obj, key) => obj != null && Object.prototype.hasOwnProperty.call(obj, key);

// Own-property read: undefined for inherited names.
export const own = (obj, key) => (has(obj, key) ? obj[key] : undefined);

export const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// A plain-object dictionary with no prototype to fall back to.
export const dict = (entries = []) => Object.assign(Object.create(null), Object.fromEntries(entries));

// Largest coordinate accepted from JSON (positions, waypoints, routes). Keeps
// the routing grid, and therefore memory use, bounded.
export const MAX_COORD = 20000;
