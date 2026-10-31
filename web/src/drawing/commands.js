import { distance, parsePoint, parseScalar } from './model.js';

const ALIASES = {
  L: 'LINE',
  PL: 'PLINE',
  C: 'CIRCLE',
  REC: 'RECTANG',
  RECTANGLE: 'RECTANG',
  M: 'MOVE',
  CO: 'COPY',
  CP: 'COPY',
  E: 'ERASE',
  U: 'UNDO',
  DI: 'DIST',
  LA: 'LAYER',
  Z: 'ZOOM',
};
const TOOLS = new Set(['LINE', 'PLINE', 'CIRCLE', 'RECTANG', 'MOVE', 'COPY', 'DIST']);

export class CommandEngine {
  constructor(store, changed, log, fit) {
    this.store = store;
    this.changed = changed;
    this.log = log;
    this.fit = fit;
    this.tool = null;
    this.points = [];
    this.lastTool = 'LINE';
    this.diameter = false;
  }
  get prompt() {
    if (!this.tool) return 'Komut girin veya bir nesne seçin';
    if (this.tool === 'CIRCLE' && this.points.length)
      return this.diameter
        ? 'CIRCLE · Çapı belirtin'
        : 'CIRCLE · Yarıçap veya çevrede bir nokta belirtin · D: çap';
    if (['MOVE', 'COPY'].includes(this.tool))
      return `${this.tool} · ${this.points.length ? 'Hedef noktayı' : 'Taban noktasını'} belirtin`;
    return `${this.tool} · ${this.points.length ? 'Sonraki noktayı' : 'İlk noktayı'} belirtin${['LINE', 'PLINE'].includes(this.tool) ? ' · Enter ile bitir' : ''}`;
  }
  start(tool) {
    this.end();
    if (
      ['LINE', 'PLINE', 'RECTANG', 'CIRCLE'].includes(tool) &&
      (this.store.currentLayer.locked || !this.store.currentLayer.visible)
    )
      throw new Error('Etkin katman kilitli veya gizli.');
    this.tool = tool;
    this.points = [];
    this.lastTool = tool;
    this.diameter = false;
    if (['MOVE', 'COPY'].includes(tool) && !this.store.selectedEditable().length) {
      this.tool = null;
      throw new Error('Önce taşınacak veya kopyalanacak nesneleri seçin.');
    }
    this.log(this.prompt);
    this.changed();
  }
  execute(text) {
    const input = text.trim();
    if (!input) {
      if (this.tool) this.finish();
      else this.start(this.lastTool);
      return;
    }
    const tokens = input.split(/\s+/),
      first = tokens[0].toUpperCase(),
      command = ALIASES[first] || first;
    if (['LINE', 'PLINE'].includes(this.tool) && ['C', 'CLOSE', 'KAPAT'].includes(first)) {
      this.finish(true);
      return;
    }
    if (command === 'UNDO' && ['LINE', 'PLINE'].includes(this.tool) && this.points.length) {
      this.points.pop();
      this.log('Komut içindeki son nokta geri alındı.');
      this.changed();
      return;
    }
    if (command === 'UNDO' || command === 'REDO') {
      this.cancel();
      this.store[command.toLowerCase()]();
      this.changed();
      return;
    }
    if (command === 'ERASE') {
      this.cancel();
      this.store.erase();
      this.log('ERASE · Seçili nesneler silindi.');
      this.changed();
      return;
    }
    if (command === 'ZOOM') {
      this.fit();
      this.changed();
      return;
    }
    if (command === 'LAYER') {
      this.store.addLayer(tokens.slice(1).join(' '));
      this.log('Katman oluşturuldu.');
      this.changed();
      return;
    }
    if (TOOLS.has(command)) {
      this.start(command);
      tokens.shift();
    } else if (!this.tool)
      throw new Error(
        `Bilinmeyen komut: ${first}. LINE, PLINE, CIRCLE, RECTANG, MOVE, COPY, ERASE, DIST, UNDO, REDO.`,
      );
    for (const token of tokens) {
      if (!this.tool) throw new Error('Komut tamamlandı; yeni bir komut girin.');
      if (
        ['LINE', 'PLINE'].includes(this.tool) &&
        ['C', 'CLOSE', 'KAPAT'].includes(token.toUpperCase())
      ) {
        this.finish(true);
        continue;
      }
      if (this.tool === 'CIRCLE' && this.points.length && token.toUpperCase() === 'D') {
        this.diameter = true;
        this.changed();
        continue;
      }
      if (
        this.tool === 'CIRCLE' &&
        this.points.length &&
        !token.includes(',') &&
        !token.includes('<') &&
        !token.startsWith('@')
      ) {
        const radius = parseScalar(token);
        if (radius <= 1e-6) throw new Error('Yarıçap pozitif bir sayı olmalı.');
        this.store.add({
          type: 'circle',
          center: this.points[0],
          radius: this.diameter ? radius / 2 : radius,
        });
        this.done();
        continue;
      }
      this.point(parsePoint(token, this.points.at(-1) || null));
    }
  }
  point(point) {
    if (!this.tool) return;
    if (this.points.length && distance(point, this.points.at(-1)) < 1e-6)
      throw new Error('Farklı bir nokta belirtin.');
    const previous = this.points;
    this.points = [...previous, [...point]];
    try {
      const [a, b] = this.points;
      if (this.tool === 'RECTANG' && b) {
        if (Math.abs(a[0] - b[0]) < 1e-6 || Math.abs(a[1] - b[1]) < 1e-6)
          throw new Error('Dikdörtgenin genişliği ve yüksekliği sıfırdan büyük olmalı.');
        this.store.add({
          type: 'polyline',
          points: [a, [b[0], a[1]], b, [a[0], b[1]]],
          closed: true,
        });
        this.done();
      } else if (this.tool === 'CIRCLE' && b) {
        this.store.add({ type: 'circle', center: a, radius: this.circleRadiusAt(b) });
        this.done();
      } else if (['MOVE', 'COPY'].includes(this.tool) && b) {
        this.store.move([b[0] - a[0], b[1] - a[1]], this.tool === 'COPY');
        this.done();
      } else if (this.tool === 'DIST' && b) {
        this.log(
          `DIST · ${distance(a, b).toFixed(4)} mm · ΔX ${(b[0] - a[0]).toFixed(4)} · ΔY ${(b[1] - a[1]).toFixed(4)}`,
        );
        this.tool = null;
        this.points = [];
      }
    } catch (error) {
      this.points = previous;
      throw error;
    }
    this.changed();
  }
  circleRadiusAt(point) {
    return distance(this.points[0], point) / (this.diameter ? 2 : 1);
  }
  end() {
    try {
      this.finish();
    } catch (error) {
      this.cancel();
      throw error;
    }
  }
  finish(close = false) {
    if (close && ['LINE', 'PLINE'].includes(this.tool) && this.points.length < 3)
      throw new Error('Kapalı çizgi en az üç nokta gerektirir.');
    if (['LINE', 'PLINE'].includes(this.tool) && this.points.length >= 2) {
      const next = structuredClone(this.store.document);
      if (this.store.currentLayer.locked || !this.store.currentLayer.visible)
        throw new Error('Etkin katman kilitli veya gizli.');
      const points = [...this.points];
      if (close && distance(points[0], points.at(-1)) < 1e-6) points.pop();
      if (close && points.length < 3) throw new Error('Kapalı çizgi en az üç nokta gerektirir.');
      if (this.tool === 'LINE') {
        const linePoints = close ? [...points, points[0]] : points;
        for (let i = 1; i < linePoints.length; i++)
          next.entities.push({
            id: crypto.randomUUID(),
            layer: this.store.layer,
            type: 'line',
            points: [linePoints[i - 1], linePoints[i]],
          });
      } else
        next.entities.push({
          id: crypto.randomUUID(),
          layer: this.store.layer,
          type: 'polyline',
          points,
          closed: close,
        });
      this.store.commit(next);
      this.log(`${this.tool} · Çizim tamamlandı.`);
    }
    this.tool = null;
    this.points = [];
    this.changed();
  }
  cancel() {
    this.tool = null;
    this.points = [];
    this.changed();
  }
  done() {
    this.log(`${this.tool} · Tamamlandı.`);
    this.tool = null;
    this.points = [];
  }
}
