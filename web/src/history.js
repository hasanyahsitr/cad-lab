export class ProjectHistory {
  constructor(limit = 50) { this.entries = []; this.index = -1; this.limit = limit; }
  get current() { return this.index < 0 ? null : structuredClone(this.entries[this.index]); }
  get canUndo() { return this.index > 0; }
  get canRedo() { return this.index < this.entries.length - 1; }
  push(project) {
    if (JSON.stringify(this.current) === JSON.stringify(project)) return;
    this.entries = this.entries.slice(0, this.index + 1);
    this.entries.push(structuredClone(project));
    if (this.entries.length > this.limit) this.entries.shift();
    this.index = this.entries.length - 1;
  }
  peek(offset) {
    const target = this.index + offset;
    return target >= 0 && target < this.entries.length ? structuredClone(this.entries[target]) : null;
  }
  move(offset) {
    if (!this.peek(offset)) throw new Error('No project at this history position.');
    this.index += offset;
  }
}
