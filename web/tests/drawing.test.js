import test from 'node:test';
import assert from 'node:assert/strict';
import {DrawingStore,drawingBounds,emptyDrawing,parsePoint,snapPoint,validateDrawing} from '../src/drawing/model.js';

test('exact and relative coordinates reject incomplete, non-finite and out-of-range inputs',()=>{
  assert.deepEqual(parsePoint('10,-5'),[10,-5]);
  assert.deepEqual(parsePoint('@20,0',[10,5]),[30,5]);
  for(const text of ['1,','Infinity,3','@1,1','1000001,2'])assert.throws(()=>parsePoint(text));
});
test('line creation, copy, move, erase and undo retain exact editable coordinates',()=>{
  const store=new DrawingStore();store.add({type:'line',points:[[0,0],[100,0]]});
  const id=store.document.entities[0].id;store.select(id);store.move([20,10],true);
  assert.equal(store.document.entities.length,2);
  assert.deepEqual(store.document.entities[1].points,[[20,10],[120,10]]);
  store.move([5,0]);assert.deepEqual(store.document.entities[0].points[0],[5,0]);
  store.erase();assert.equal(store.document.entities.length,1);
  store.undo();assert.equal(store.document.entities.length,2);
  store.undo();assert.deepEqual(store.document.entities[0].points[0],[0,0]);
  store.redo();assert.deepEqual(store.document.entities[0].points[0],[5,0]);
});
test('locked and hidden layers protect entities even with a stale selection',()=>{
  const store=new DrawingStore();store.add({type:'circle',center:[20,30],radius:10});
  const id=store.document.entities[0].id;store.select(id);store.updateLayer('0',{locked:true});
  assert.equal(store.selection.size,0);store.selection.add(id);assert.throws(()=>store.erase());
  assert.throws(()=>store.add({type:'line',points:[[0,0],[1,1]]}));
  store.updateLayer('0',{locked:false,visible:false});store.select(id);assert.equal(store.selection.size,0);
});
test('snaps honor drawing units, tolerance and visible layers',()=>{
  const store=new DrawingStore();store.add({type:'line',points:[[0,0],[100,0]]});
  assert.deepEqual(snapPoint([49.9,0.1],store.document,1),[50,0]);
  assert.equal(snapPoint([49.9,0.1],store.document,0.01),null);
  store.updateLayer('0',{visible:false});assert.equal(snapPoint([0,0],store.document,1),null);
});
test('invalid imports and failed transforms do not replace the current drawing',()=>{
  const store=new DrawingStore();store.add({type:'line',points:[[0,0],[100,0]]});
  const before=structuredClone(store.document);store.select(before.entities[0].id);
  assert.throws(()=>store.move([Infinity,0]));assert.deepEqual(store.document,before);
  const bad=emptyDrawing();bad.layers.push({...bad.layers[0]});assert.throws(()=>validateDrawing(bad));
  bad.layers.pop();bad.entities.push({id:'x',layer:'missing',type:'circle',center:[0,0],radius:1});
  assert.throws(()=>store.commit(bad));assert.deepEqual(store.document,before);
});
test('Gemini review: polar coordinates and decimal grammar are locale independent',()=>{
  const p=parsePoint('@100<30',[20,30]);assert.ok(Math.abs(p[0]-(20+50*Math.sqrt(3)))<1e-9);assert.ok(Math.abs(p[1]-80)<1e-9);
  assert.deepEqual(parsePoint('12,5'),[12,5]);assert.deepEqual(parsePoint('12.5,6.25'),[12.5,6.25]);
  assert.throws(()=>parsePoint('0x10,2'));assert.throws(()=>parsePoint('10,,2'));
});
test('Gemini review: closing edge midpoint remains a snap target, including on locked layers',()=>{
  const store=new DrawingStore();store.add({type:'polyline',points:[[0,0],[80,0],[80,50],[0,50]],closed:true});
  store.updateLayer('0',{locked:true});assert.deepEqual(snapPoint([0.1,25.1],store.document,1),[0,25]);
});
test('zoom bounds handle many vertices without argument-spread stack overflow',()=>{
  const drawing=emptyDrawing();
  drawing.entities=Array.from({length:120},(_,id)=>({id:String(id),layer:'0',type:'polyline',points:Array.from({length:1000},(_,x)=>[x,id]),closed:false}));
  assert.deepEqual(drawingBounds(drawing),{minX:0,minY:0,maxX:999,maxY:119});
});
test('a restored drawing chooses its first valid layer even when its id is not 0',()=>{
  const drawing=emptyDrawing();drawing.layers[0].id='custom-layer';
  const store=new DrawingStore(drawing);store.add({type:'circle',center:[0,0],radius:5});
  assert.equal(store.document.entities[0].layer,'custom-layer');
});
