// "Did you mean …?" support for error messages.

export function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

// Edits tolerated for a name of this length: short names must be nearly exact,
// otherwise every two-letter pin would "look like" every other one.
const tolerance = (len) => (len <= 2 ? 0 : len <= 4 ? 1 : 2);

// The candidate closest to `input` (ignoring case), or null when nothing is
// close enough. `candidates` may be plain strings or [candidate, result] pairs
// when several spellings (aliases) map to one answer.
export const MAX_NAME_LENGTH = 64; // longer than any real part or pin name: not searched

export function closest(input, candidates, maxEdits) {
  const s = String(input ?? '').trim().toLowerCase();
  if (!s || s.length > MAX_NAME_LENGTH) return null;
  const limit = maxEdits ?? tolerance(s.length);
  let best = null, bestD = Infinity;
  for (const cand of candidates) {
    const [text, result] = Array.isArray(cand) ? cand : [cand, cand];
    const t = String(text).toLowerCase();
    // names whose lengths differ by more than the edits allowed cannot match: skip the O(n·m) comparison
    if (Math.abs(t.length - s.length) > limit || t.length > MAX_NAME_LENGTH) continue;
    const d = levenshtein(s, t);
    if (d < bestD && d <= limit) { bestD = d; best = result; }
    if (d === 0) break;
  }
  return best;
}

export const didYouMean = (suggestion) => (suggestion ? ` Did you mean "${suggestion}"?` : '');
