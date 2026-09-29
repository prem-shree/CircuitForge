// Undo/redo over JSON text snapshots.
//
//   push(text)                       record a state (a plain string still works)
//   push(text, { label, key })       label names the action ("Move R1"); consecutive
//                                    pushes with the same key inside `coalesceMs` merge
//                                    into one step (nudging, typing in a field, …)
//   undo() / redo()                  return the text to show, or null
//   entry                            { text, label, selection } of the current state
//   undoLabel / redoLabel            what Ctrl+Z / Ctrl+Y would undo or redo
//
// The stack is bounded by step count and by total size, so a large circuit with a
// long editing session cannot exhaust memory: the oldest steps are dropped first.
export class History {
  constructor(limit = 200, { maxChars = 24_000_000, coalesceMs = 800, now = () => Date.now() } = {}) {
    this.stack = [];
    this.index = -1;
    this.limit = limit;
    this.maxChars = maxChars;
    this.coalesceMs = coalesceMs;
    this.now = now;
    this.chars = 0;
  }

  push(text, meta = {}) {
    const { label = null, key = null, selection = null } = meta;
    const cur = this.stack[this.index];
    if (cur && cur.text === text) {
      // same document: keep it, but let a later selection/label refine the entry
      if (selection) cur.selection = selection;
      return false;
    }
    const t = this.now();
    // merge into the current step when it is the same kind of edit, made moments ago
    // (never when it is the step we just undid to: that starts a new branch)
    if (cur && key && cur.key === key && t - cur.time <= this.coalesceMs && this.index === this.stack.length - 1 && this.index > 0) {
      this.chars += text.length - cur.text.length;
      cur.text = text;
      cur.time = t;
      if (selection) cur.selection = selection;
      return true;
    }
    for (let i = this.index + 1; i < this.stack.length; i++) this.chars -= this.stack[i].text.length;
    this.stack.length = this.index + 1;
    this.stack.push({ text, label, key, selection, time: t });
    this.chars += text.length;
    // drop the oldest steps while over budget; the current state always stays
    while (this.stack.length > 1 && (this.stack.length > this.limit || this.chars > this.maxChars)) {
      this.chars -= this.stack.shift().text.length;
    }
    this.index = this.stack.length - 1;
    return true;
  }

  get entry() { return this.stack[this.index] || null; }
  get canUndo() { return this.index > 0; }
  get canRedo() { return this.index < this.stack.length - 1; }
  get undoLabel() { return this.canUndo ? this.stack[this.index].label : null; }
  get redoLabel() { return this.canRedo ? this.stack[this.index + 1].label : null; }
  get size() { return this.stack.length; }

  undo() { return this.canUndo ? this.stack[--this.index].text : null; }
  redo() { return this.canRedo ? this.stack[++this.index].text : null; }

  // Restart from a document that is not an edit of the previous one (File > New/Open).
  reset(text, meta = {}) {
    this.stack = [];
    this.index = -1;
    this.chars = 0;
    this.push(text, meta);
  }
}
