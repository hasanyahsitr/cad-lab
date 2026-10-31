import test from 'node:test';
import assert from 'node:assert/strict';
import {DrawingStore} from '../src/drawing/model.js';
import {entitiesInBox} from '../src/drawing/selection.js';

test('window selects only completely enclosed geometry; crossing includes real intersections',()=>{
  const store=new DrawingStore();
  store.add({type:'line',points:[[5,5],[40,40]]});
  store.add({type:'line',points:[[-10,25],[60,25]]});
  store.add({type:'circle',center:[45,25],radius:10});
  const ids=store.document.entities.map(e=>e.id);
  assert.deepEqual(entitiesInBox(store.document,[0,0],[50,50]),[ids[0]]);
  assert.deepEqual(entitiesInBox(store.document,[50,50],[0,0]),ids);
});
test('crossing rejects an overlapping AABB when the actual line misses the box',()=>{
  const store=new DrawingStore();store.add({type:'line',points:[[-10,45],[45,110]]});
  assert.deepEqual(entitiesInBox(store.document,[50,50],[0,0]),[]);
});
test('a selection box inside a hollow circle does not select the circumference',()=>{
  const store=new DrawingStore();store.add({type:'circle',center:[0,0],radius:100});
  assert.deepEqual(entitiesInBox(store.document,[10,10],[-10,-10]),[]);
  assert.equal(entitiesInBox(store.document,[110,10],[90,-10]).length,1);
});
test('crossing sees a closed polyline closing edge and ignores hidden or locked layers',()=>{
  const store=new DrawingStore();store.add({type:'polyline',points:[[0,0],[80,0],[80,50],[0,50]],closed:true});
  assert.equal(entitiesInBox(store.document,[1,26],[-1,24]).length,1);
  store.updateLayer('0',{locked:true});assert.equal(entitiesInBox(store.document,[1,26],[-1,24]).length,0);
  store.updateLayer('0',{locked:false,visible:false});assert.equal(entitiesInBox(store.document,[100,100],[-10,-10]).length,0);
});
