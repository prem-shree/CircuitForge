// The problems panel: errors, warnings and design findings, each with a plain
// explanation, a jump-to-source action and (when the engine knows one) a
// one-click fix. Also marks the offending lines in the editor gutter.
import { RULE_HELP } from '../engine.js';
import { annotateLines, indexJSON } from '../parser/locate.js';
import { applyFix } from '../editor/model.js';
import { parsePath } from '../utils/path.js';
import { state, $, esc } from './state.js';

let index = null, indexText = null;
const locator = () => {
  if (indexText !== state.text) { index = indexJSON(state.text); indexText = state.text; }
  return index;
};

export function initProblems(app) {
  const textarea = $('#json');
  const gutter = $('#gutter');

  // Select the JSON that a problem points at and scroll it into view.
  function goToSource(p) {
    const at = p.path ? locator().locate([...(state.wrapped ? ['circuit'] : []), ...parsePath(p.path)]) : null;
    const line = p.line || at?.line;
    if (!line) return;
    const lines = state.text.split('\n');
    const start = at ? at.offset : lines.slice(0, line - 1).reduce((a, l) => a + l.length + 1, 0);
    const end = at ? Math.min(at.end, at.offset + 400) : start + (lines[line - 1] || '').length;
    textarea.focus();
    textarea.setSelectionRange(start, end);
    textarea.scrollTop = Math.max(0, (line - 5) * 20);
  }

  function show(errors, warnings, findings = [], wrapped = false) {
    const all = [
      ...errors.map((e) => ({ ...e, level: 'error' })),
      ...findings.map((f) => ({ ...f, level: f.severity === 'error' ? 'error' : f.severity === 'info' ? 'info' : 'warning' })),
      ...warnings.map((w) => ({ ...w, level: 'warning' })),
    ];
    // syntax errors already carry their own line; the index is only built when something needs one
    annotateLines(all, state.text, wrapped ? ['circuit'] : [], locator);
    state.problems = all;
    const list = $('#problems-list');
    list.textContent = '';
    $('#problems-title').textContent = all.length ? `Problems (${all.length})` : 'Problems';
    if (!all.length) {
      const li = document.createElement('li');
      li.className = 'ok';
      li.textContent = 'No problems. The circuit is valid.';
      list.append(li);
      return all;
    }
    for (const p of all) {
      const li = document.createElement('li');
      li.className = p.level;
      li.innerHTML = '<span class="ico"></span><span class="code"></span><span class="msg"></span>';
      li.querySelector('.code').textContent = p.code;
      li.querySelector('.msg').textContent = p.message + (p.line && !/line \d/.test(p.message) ? ` (line ${p.line})` : '');
      if (p.hint || p.formula) {
        const extra = document.createElement('span');
        extra.className = 'hint';
        extra.textContent = [p.formula, p.hint].filter(Boolean).join(' · ');
        li.append(extra);
      }
      if (p.fix) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'btn btn-sm fix';
        b.textContent = p.fix.label;
        b.title = 'Apply this correction to the JSON';
        b.addEventListener('click', (e) => {
          e.stopPropagation();
          if (!app.sync()) return;
          const fixed = applyFix(state.circuit, p.fix);
          if (!fixed) return app.toast('That part of the document has changed; the fix no longer applies.', true);
          app.commit(fixed, { label: `Fix: ${p.fix.label}`, key: null });
          app.toast(p.fix.label);
        });
        li.append(b);
      }
      const help = RULE_HELP[p.code];
      li.title = help ? `${help.title}\n\n${help.why}\n\nFix: ${help.fix}` : 'Show in editor';
      li.addEventListener('click', () => {
        if (p.component && state.result?.scene.instances.has(p.component)) app.select([p.component]);
        goToSource(p);
      });
      list.append(li);
    }
    return all;
  }

  // Line numbers, with a mark on every line that has a problem.
  function gutterMarks() {
    const n = state.text.split('\n').length;
    const level = new Map();
    for (const p of state.problems) {
      if (!p.line || p.level === 'info') continue;
      if (level.get(p.line) !== 'err') level.set(p.line, p.level === 'error' ? 'err' : 'warn');
    }
    let html = '';
    for (let i = 1; i <= n; i++) html += level.has(i) ? `<span class="${level.get(i)}">${i}</span>\n` : `${i}\n`;
    gutter.innerHTML = html;
    gutter.scrollTop = textarea.scrollTop;
  }

  return { show, gutterMarks, goToSource };
}
