// Original 2D drawing data model. Coordinates are millimeters in a Y-up world.
const LIMIT = 1e6;
const TYPES = new Set(['line', 'polyline', 'circle']);
const NUMBER = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
const clone = (value) => structuredClone(value);
const finite = (value) =>
  typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= LIMIT;
export const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

export function parseScalar(text) {
  if (!NUMBER.test(text)) throw new Error('Sayıyı ondalık noktayla girin; örnek: 12.5.');
  const value = Number(text);
  if (!finite(value)) throw new Error('Sayı sonlu ve desteklenen aralıkta olmalı.');
  return value;
}

export function emptyDrawing() {
  return {
    format: 'cad-lab.drawing',
    schema_version: 1,
    units: 'mm',
    name: 'Çizim 1',
    layers: [{ id: '0', name: '0', color: '#d5dee7', visible: true, locked: false }],
    entities: [],
  };
}

export function validateDrawing(input) {
  if (
    !input ||
    input.format !== 'cad-lab.drawing' ||
    input.schema_version !== 1 ||
    input.units !== 'mm'
  )
    throw new Error('Desteklenmeyen çizim dosyası veya birimi.');
  if (typeof input.name !== 'string' || !input.name.trim() || input.name.length > 80)
    throw new Error('Çizim adı 1–80 karakter olmalı.');
  if (!Array.isArray(input.layers) || !input.layers.length || input.layers.length > 100)
    throw new Error('1–100 katman gerekli.');
  if (!Array.isArray(input.entities) || input.entities.length > 5000)
    throw new Error('En fazla 5000 nesne destekleniyor.');
  const layerIds = new Set();
  const layerNames = new Set();
  for (const layer of input.layers) {
    if (
      typeof layer.id !== 'string' ||
      !layer.id ||
      layerIds.has(layer.id) ||
      typeof layer.name !== 'string' ||
      !layer.name.trim() ||
      layer.name.length > 80 ||
      layerNames.has(layer.name.toLowerCase()) ||
      /[<>/\\":;?*|=\x00-\x1f]/.test(layer.name)
    )
      throw new Error('Katman adları ve kimlikleri geçerli ve benzersiz olmalı.');
    if (
      !/^#[0-9a-f]{6}$/i.test(layer.color) ||
      typeof layer.visible !== 'boolean' ||
      typeof layer.locked !== 'boolean'
    )
      throw new Error('Geçersiz katman özellikleri.');
    layerIds.add(layer.id);
    layerNames.add(layer.name.toLowerCase());
  }
  const ids = new Set();
  const point = (p) => Array.isArray(p) && p.length === 2 && p.every(finite);
  for (const entity of input.entities) {
    if (
      typeof entity.id !== 'string' ||
      !entity.id ||
      ids.has(entity.id) ||
      !layerIds.has(entity.layer) ||
      !TYPES.has(entity.type)
    )
      throw new Error('Geçersiz nesne, katman veya nesne kimliği.');
    ids.add(entity.id);
    if (entity.type === 'circle') {
      if (!point(entity.center) || !finite(entity.radius) || entity.radius <= 1e-6)
        throw new Error('Çember merkezi ve yarıçapı geçersiz.');
    } else {
      if (
        !Array.isArray(entity.points) ||
        entity.points.length < 2 ||
        entity.points.length > 1000 ||
        !entity.points.every(point)
      )
        throw new Error('Nesne noktaları geçersiz.');
      if (
        entity.type === 'line' &&
        (entity.points.length !== 2 || distance(...entity.points) < 1e-6)
      )
        throw new Error('Çizgi iki farklı nokta gerektirir.');
      if (
        entity.type === 'polyline' &&
        (typeof entity.closed !== 'boolean' ||
          (entity.closed && entity.points.length < 3) ||
          entity.points.some((p, i) => i && distance(p, entity.points[i - 1]) < 1e-6))
      )
        throw new Error(
          'Çoklu çizgi noktaları farklı olmalı; kapalı çizgi en az üç nokta gerektirir.',
        );
    }
  }
  return clone(input);
}

export function parsePoint(text, base = null) {
  const source = text.trim();
  const relative = source.startsWith('@');
  if (relative && !base)
    throw new Error('Göreli koordinat için önce bir başlangıç noktası belirtin.');
  const value = relative ? source.slice(1) : source;
  let values;
  if (value.includes('<')) {
    const pair = value.split('<');
    if (pair.length !== 2 || !pair.every((part) => NUMBER.test(part)))
      throw new Error('Kutupsal koordinat: @uzunluk<açı. Örnek: @50<90.');
    const [length, angle] = pair.map(Number);
    if (!finite(length) || length < 0 || !finite(angle))
      throw new Error('Kutupsal mesafe ve açı geçersiz.');
    const radians = (angle * Math.PI) / 180;
    values = [length * Math.cos(radians), length * Math.sin(radians)];
  } else {
    const pair = value.split(',').map((part) => part.trim());
    if (pair.length !== 2 || !pair.every((part) => NUMBER.test(part)))
      throw new Error(
        'Koordinatı x,y biçiminde girin; ondalık ayıracı noktadır. Örnek: 100,50 veya @20,0.',
      );
    values = pair.map(Number);
  }
  if (!values.every(finite)) throw new Error('Koordinatlar sonlu sayılar olmalı.');
  const result = values.map((v, i) => v + (relative ? base[i] : 0));
  if (!result.every(finite)) throw new Error('Koordinat sınırı aşıldı.');
  return result;
}

export function translated(entity, delta) {
  const next = clone(entity);
  const shift = (p) => p.map((v, i) => v + delta[i]);
  if (next.type === 'circle') next.center = shift(next.center);
  else next.points = next.points.map(shift);
  return next;
}

export function entityPoints(entity) {
  if (entity.type === 'circle')
    return [
      entity.center,
      ...[
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ].map((v) => v.map((c, i) => entity.center[i] + c * entity.radius)),
    ];
  const result = [...entity.points];
  const pairs = entity.points.slice(1).map((p, i) => [entity.points[i], p]);
  if (entity.closed) pairs.push([entity.points.at(-1), entity.points[0]]);
  for (const [a, b] of pairs) result.push([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]);
  return result;
}

export function snapPoint(point, drawing, tolerance) {
  let best = null,
    bestDistance = tolerance;
  const visible = new Set(drawing.layers.filter((l) => l.visible).map((l) => l.id));
  for (const entity of drawing.entities) {
    if (!visible.has(entity.layer)) continue;
    for (const candidate of entityPoints(entity)) {
      const d = distance(point, candidate);
      if (d <= bestDistance) {
        best = candidate;
        bestDistance = d;
      }
    }
  }
  return best ? [...best] : null;
}

export function drawingBounds(drawing) {
  const visible = new Set(drawing.layers.filter((l) => l.visible).map((l) => l.id));
  const box = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const entity of drawing.entities) {
    if (!visible.has(entity.layer)) continue;
    for (const [x, y] of entityPoints(entity)) {
      box.minX = Math.min(box.minX, x);
      box.minY = Math.min(box.minY, y);
      box.maxX = Math.max(box.maxX, x);
      box.maxY = Math.max(box.maxY, y);
    }
  }
  return box.minX === Infinity ? { minX: -20, minY: -20, maxX: 180, maxY: 120 } : box;
}

export class DrawingStore {
  constructor(document = emptyDrawing()) {
    this.document = validateDrawing(document);
    this.history = [clone(this.document)];
    this.index = 0;
    this.selection = new Set();
    this.layer = this.document.layers[0].id;
  }
  commit(next) {
    const validated = validateDrawing(next);
    this.document = validated;
    this.history = this.history.slice(0, this.index + 1);
    this.history.push(clone(validated));
    if (this.history.length > 100) this.history.shift();
    this.index = this.history.length - 1;
    this.selection = new Set(
      [...this.selection].filter((id) => validated.entities.some((e) => e.id === id)),
    );
    if (!validated.layers.some((l) => l.id === this.layer)) this.layer = validated.layers[0].id;
  }
  get currentLayer() {
    return this.document.layers.find((l) => l.id === this.layer);
  }
  get canUndo() {
    return this.index > 0;
  }
  get canRedo() {
    return this.index < this.history.length - 1;
  }
  undo() {
    if (this.canUndo) {
      this.document = clone(this.history[--this.index]);
      this.selection.clear();
      this.reconcileLayer();
    }
  }
  redo() {
    if (this.canRedo) {
      this.document = clone(this.history[++this.index]);
      this.selection.clear();
      this.reconcileLayer();
    }
  }
  reconcileLayer() {
    if (!this.document.layers.some((l) => l.id === this.layer))
      this.layer = this.document.layers[0].id;
  }
  add(entity) {
    if (this.currentLayer.locked || !this.currentLayer.visible)
      throw new Error('Etkin katman kilitli veya gizli.');
    const next = clone(this.document);
    next.entities.push({ ...entity, id: crypto.randomUUID(), layer: this.layer });
    this.commit(next);
  }
  select(id, additive = false) {
    const entity = this.document.entities.find((e) => e.id === id);
    const layer = entity && this.document.layers.find((l) => l.id === entity.layer);
    if (!additive) this.selection.clear();
    if (entity && layer.visible && !layer.locked) {
      if (additive && this.selection.has(id)) this.selection.delete(id);
      else this.selection.add(id);
    }
  }
  selectedEditable() {
    return this.document.entities.filter(
      (e) =>
        this.selection.has(e.id) &&
        this.document.layers.some((l) => l.id === e.layer && l.visible && !l.locked),
    );
  }
  erase() {
    const ids = new Set(this.selectedEditable().map((e) => e.id));
    if (!ids.size) throw new Error('Önce düzenlenebilir nesneleri seçin.');
    this.commit({
      ...clone(this.document),
      entities: this.document.entities.filter((e) => !ids.has(e.id)),
    });
    this.selection.clear();
  }
  move(delta, copy = false) {
    const selected = this.selectedEditable();
    if (!selected.length) throw new Error('Önce düzenlenebilir nesneleri seçin.');
    if (!copy && delta.every((value) => value === 0)) return;
    const ids = new Set(selected.map((e) => e.id));
    const next = clone(this.document);
    if (copy)
      next.entities.push(
        ...selected.map((e) => ({ ...translated(e, delta), id: crypto.randomUUID() })),
      );
    else next.entities = next.entities.map((e) => (ids.has(e.id) ? translated(e, delta) : e));
    this.commit(next);
  }
  addLayer(name, color = '#85c7ef') {
    const next = clone(this.document),
      id = crypto.randomUUID();
    next.layers.push({ id, name, color, visible: true, locked: false });
    this.commit(next);
    this.layer = id;
  }
  updateLayer(id, patch) {
    const next = clone(this.document);
    next.layers = next.layers.map((l) => (l.id === id ? { ...l, ...patch, id: l.id } : l));
    this.commit(next);
    this.selection = new Set(this.selectedEditable().map((e) => e.id));
  }
}
