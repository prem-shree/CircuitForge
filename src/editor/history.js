// Undo/redo over JSON text snapshots.
export class History {
  constructor(limit = 200) {
    this.stack = [];
    this.index = -1;
    this.limit = limit;
  }
  push(text) {
    if (this.stack[this.index] === text) return;
    this.stack.length = this.index + 1;
    this.stack.push(text);
    if (this.stack.length > this.limit) this.stack.shift();
    this.index = this.stack.length - 1;
  }
  get canUndo() { return this.index > 0; }
  get canRedo() { return this.index < this.stack.length - 1; }
  undo() { return this.canUndo ? this.stack[--this.index] : null; }
  redo() { return this.canRedo ? this.stack[++this.index] : null; }
}
