import './drafting.css';
import {DrawingStore,emptyDrawing,validateDrawing,drawingBounds,snapPoint,distance} from './model.js';
import {CommandEngine} from './commands.js';
import {entitiesInBox} from './selection.js';

const $=id=>document.getElementById(id),NS='http://www.w3.org/2000/svg';
const store=new DrawingStore();
const view={center:[50,30],scale:4};
const settings={grid:true,snap:false,ortho:false,osnap:true};
let worldCursor=null,snapped=null,panning=null,selectBox=null,saved=JSON.stringify(store.document),requestBusy=false;
const canvas=$('drawing-canvas');
const engine=new CommandEngine(store,render,log,fit);

function node(type,attributes={},parent=null){const item=document.createElementNS(NS,type);for(const[key,value]of Object.entries(attributes))item.setAttribute(key,String(value));if(parent)parent.append(item);return item;}
function log(text,error=false){const line=document.createElement('div');line.textContent=text;if(error)line.className='error';$('command-log').append(line);while($('command-log').children.length>100)$('command-log').firstChild.remove();$('command-log').scrollTop=$('command-log').scrollHeight;}
function attempt(action){try{action();}catch(error){log(error.message,true);render();}}
function bounds(){const rect=canvas.getBoundingClientRect();return {width:rect.width/view.scale,height:rect.height/view.scale,x:view.center[0]-rect.width/view.scale/2,y:-view.center[1]-rect.height/view.scale/2};}
function pointAt(event){const rect=canvas.getBoundingClientRect(),box=bounds();return [box.x+(event.clientX-rect.left)/view.scale,-box.y-(event.clientY-rect.top)/view.scale];}
function constrained(point){
  snapped=settings.osnap?snapPoint(point,store.document,10/view.scale):null;
  if(snapped)return snapped;
  const result=settings.snap?point.map(v=>Math.round(v/10)*10):point;
  const base=engine.points.at(-1);
  if(settings.ortho&&base){if(Math.abs(result[0]-base[0])>=Math.abs(result[1]-base[1]))return [result[0],base[1]];return [base[0],result[1]];}
  return result;
}
function drawEntity(entity,parent,color,extraClass=''){
  const attributes={class:`entity ${extraClass}`,stroke:color};let element;
  if(entity.type==='circle')element=node('circle',{...attributes,cx:entity.center[0],cy:entity.center[1],r:entity.radius},parent);
  else element=node('polyline',{...attributes,points:(entity.closed?[...entity.points,entity.points[0]]:entity.points).map(p=>p.join(',')).join(' ')},parent);
  return element;
}
function renderGeometry(){
  const box=bounds();canvas.setAttribute('viewBox',`${box.x} ${box.y} ${box.width} ${box.height}`);
  const grid=$('grid-surface');for(const[key,value]of Object.entries(box))grid.setAttribute(key,value);grid.hidden=!settings.grid;grid.style.display=settings.grid?'':'none';
  $('drawing-axes').replaceChildren();
  node('path',{d:`M ${box.x} 0 h ${box.width} M 0 ${box.y} v ${box.height}`,stroke:'#4e5e6e','stroke-width':0.8,'vector-effect':'non-scaling-stroke'},$('drawing-axes'));
  $('entities').replaceChildren();
  const layers=new Map(store.document.layers.map(layer=>[layer.id,layer]));
  for(const entity of store.document.entities){const layer=layers.get(entity.layer);if(!layer.visible)continue;const group=node('g',{'data-entity':entity.id,class:'entity-group'},$('entities'));drawEntity(entity,group,layer.color,store.selection.has(entity.id)?'selected':'');const hit=drawEntity(entity,group,'transparent','hit');hit.classList.remove('entity');}
  $('preview').replaceChildren();
  if(selectBox){const a=selectBox.start,b=selectBox.end,crossing=a[0]>b[0];node('rect',{x:Math.min(a[0],b[0]),y:Math.min(a[1],b[1]),width:Math.abs(a[0]-b[0]),height:Math.abs(a[1]-b[1]),stroke:crossing?'#77d89b':'#70bcff',fill:crossing?'#77d89b22':'#70bcff22','stroke-width':1,'stroke-dasharray':crossing?'5 3':'none','vector-effect':'non-scaling-stroke'},$('preview'));}
  const pending=engine.points,tip=worldCursor;
  if(pending.length){
    if(['LINE','PLINE'].includes(engine.tool))drawEntity({type:'polyline',points:[...pending,...(tip?[tip]:[])],closed:false},$('preview'),'#83c7f9');
    if(engine.tool==='RECTANG'&&tip){const a=pending[0],b=tip;drawEntity({type:'polyline',points:[a,[b[0],a[1]],b,[a[0],b[1]]],closed:true},$('preview'),'#83c7f9');}
    if(engine.tool==='CIRCLE'&&tip)drawEntity({type:'circle',center:pending[0],radius:distance(pending[0],tip)},$('preview'),'#83c7f9');
    if(['MOVE','COPY','DIST'].includes(engine.tool)&&tip)drawEntity({type:'line',points:[pending[0],tip]},$('preview'),'#9dd89b');
  }
  $('cursor').replaceChildren();
  if(tip){const radius=8/view.scale;node('path',{d:`M ${tip[0]-radius} ${tip[1]} h ${2*radius} M ${tip[0]} ${tip[1]-radius} v ${2*radius}`,stroke:'#e0ebf5','stroke-width':1,'vector-effect':'non-scaling-stroke'},$('cursor'));if(snapped)node('rect',{x:snapped[0]-radius/2,y:snapped[1]-radius/2,width:radius,height:radius,fill:'none',stroke:'#78e69e','stroke-width':1.5,'vector-effect':'non-scaling-stroke'},$('cursor'));}
  $('empty-guide').hidden=store.document.entities.length>0||pending.length>0;
}
function render(){
  renderGeometry();$('command-prompt').textContent=engine.prompt;
  $('drawing-name').textContent=store.document.name;$('tab-name').textContent=store.document.name;
  $('dirty-indicator').hidden=saved===JSON.stringify(store.document);
  $('entity-count').textContent=`${store.document.entities.length} nesne`;
  for(const button of document.querySelectorAll('[data-tool]'))button.classList.toggle('active',button.dataset.tool===engine.tool);
  document.querySelector('[data-command=UNDO]').disabled=!store.canUndo;document.querySelector('[data-command=REDO]').disabled=!store.canRedo;
  $('current-layer').replaceChildren();$('layer-list').replaceChildren();
  for(const layer of store.document.layers){
    const option=document.createElement('option');option.value=layer.id;option.textContent=layer.name;$('current-layer').append(option);
    const row=document.createElement('div');row.className='layer-row';
    const color=document.createElement('input');color.type='color';color.value=layer.color;color.setAttribute('aria-label',`${layer.name} katman rengi`);color.addEventListener('change',()=>attempt(()=>{store.updateLayer(layer.id,{color:color.value});render();}));row.append(color);
    const label=document.createElement('button');label.className=`layer-name ${store.layer===layer.id?'active':''}`;label.textContent=layer.name;label.title=`Etkin katman yap: ${layer.name}`;label.addEventListener('click',()=>{store.layer=layer.id;render();});row.append(label);
    for(const [field,onText,offText]of [['visible','Açık','Gizli'],['locked','Kilitli','Serbest']]){const button=document.createElement('button');button.className='layer-toggle';button.textContent=layer[field]?onText:offText;button.setAttribute('aria-label',`${layer.name}: ${field==='visible'?'görünürlüğü':'kilidi'} değiştir`);button.setAttribute('aria-pressed',String(layer[field]));button.addEventListener('click',()=>attempt(()=>{store.updateLayer(layer.id,{[field]:!layer[field]});render();}));row.append(button);}
    $('layer-list').append(row);
  }
  $('current-layer').value=store.layer;
  const selected=store.selectedEditable();$('selection-properties').replaceChildren();
  if(!selected.length)$('selection-properties').textContent='Nesne seçilmedi';
  else{const dl=document.createElement('dl');const first=selected[0],layer=store.document.layers.find(l=>l.id===first.layer);const pairs=[['Seçim',`${selected.length} nesne`],['Tür',first.type],['Katman',layer.name]];
    if(first.type==='circle')pairs.push(['Merkez',first.center.map(n=>n.toFixed(3)).join(', ')],['Yarıçap',`${first.radius.toFixed(3)} mm`]);else pairs.push(['Nokta',String(first.points.length)],['Uzunluk',`${first.points.slice(1).reduce((sum,p,i)=>sum+distance(p,first.points[i]),first.closed?distance(first.points[0],first.points.at(-1)):0).toFixed(3)} mm`]);
    for(const[key,value]of pairs){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=key;dd.textContent=value;dl.append(dt,dd);}$('selection-properties').append(dl);}
}
function fit(){const box=drawingBounds(store.document);view.center=[(box.minX+box.maxX)/2,(box.minY+box.maxY)/2];const rect=canvas.getBoundingClientRect();view.scale=Math.min(rect.width/Math.max(box.maxX-box.minX,20),rect.height/Math.max(box.maxY-box.minY,20))*0.75;renderGeometry();}
function download(text,filename,type='application/json'){const url=URL.createObjectURL(new Blob([text],{type}));const link=document.createElement('a');link.href=url;link.download=filename;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function toggle(key){settings[key]=!settings[key];$('toggle-'+key).setAttribute('aria-pressed',String(settings[key]));renderGeometry();}

for(const button of document.querySelectorAll('[data-tool]'))button.addEventListener('click',()=>attempt(()=>{engine.start(button.dataset.tool);$('command-input').focus();}));
for(const button of document.querySelectorAll('[data-command]'))button.addEventListener('click',()=>attempt(()=>engine.execute(button.dataset.command)));
$('command-form').addEventListener('submit',event=>{event.preventDefault();const text=$('command-input').value;log(`> ${text}`);attempt(()=>engine.execute(text));$('command-input').value='';render();});
$('cancel-command').addEventListener('click',()=>attempt(()=>engine.finish()));
$('zoom-fit').addEventListener('click',fit);
$('current-layer').addEventListener('change',event=>{store.layer=event.target.value;render();});
$('layer-form').addEventListener('submit',event=>{event.preventDefault();attempt(()=>{store.addLayer($('layer-name').value.trim());$('layer-name').value='';render();});});
for(const key of Object.keys(settings))$('toggle-'+key).addEventListener('click',()=>toggle(key));
canvas.addEventListener('pointerdown',event=>{
  if(event.button===1){event.preventDefault();panning={x:event.clientX,y:event.clientY,center:[...view.center]};canvas.setPointerCapture(event.pointerId);return;}
  if(event.button!==0)return;
  if(engine.tool){attempt(()=>engine.point(constrained(pointAt(event))));return;}
  const target=event.target.closest('[data-entity]');
  if(target){store.select(target.dataset.entity,event.shiftKey);render();}
  else{const point=pointAt(event);selectBox={start:point,end:point,additive:event.shiftKey};canvas.setPointerCapture(event.pointerId);}
});
canvas.addEventListener('pointermove',event=>{
  if(panning){view.center=[panning.center[0]-(event.clientX-panning.x)/view.scale,panning.center[1]+(event.clientY-panning.y)/view.scale];renderGeometry();return;}
  if(selectBox){selectBox.end=pointAt(event);renderGeometry();return;}
  worldCursor=constrained(pointAt(event));$('coordinates').textContent=`X: ${worldCursor[0].toFixed(4)} · Y: ${worldCursor[1].toFixed(4)}`;renderGeometry();
});
canvas.addEventListener('pointerup',()=>{
  panning=null;
  if(selectBox){const box=selectBox;selectBox=null;if(!box.additive)store.selection.clear();if(distance(box.start,box.end)*view.scale>3)for(const id of entitiesInBox(store.document,box.start,box.end))store.selection.add(id);render();}
});canvas.addEventListener('pointercancel',()=>{panning=null;selectBox=null;renderGeometry();});
canvas.addEventListener('pointerleave',()=>{worldCursor=null;snapped=null;renderGeometry();});
canvas.addEventListener('wheel',event=>{event.preventDefault();const before=pointAt(event);view.scale=Math.max(0.0001,Math.min(10000,view.scale*Math.exp(-event.deltaY*0.001)));const after=pointAt(event);view.center=view.center.map((v,i)=>v+before[i]-after[i]);renderGeometry();},{passive:false});
document.addEventListener('keydown',event=>{
  const editing=['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName);
  if(event.key==='Escape'){event.preventDefault();attempt(()=>engine.finish());if(!editing)store.selection.clear();render();return;}
  const keys={F3:'osnap',F7:'grid',F8:'ortho',F9:'snap'};if(keys[event.key]){event.preventDefault();toggle(keys[event.key]);return;}
  if(editing)return;
  if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'){event.preventDefault();attempt(()=>engine.execute(event.shiftKey?'REDO':'UNDO'));}
  else if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='y'){event.preventDefault();attempt(()=>engine.execute('REDO'));}
  else if(event.key==='Delete'){event.preventDefault();attempt(()=>engine.execute('ERASE'));}
  else if(event.key==='Enter'){event.preventDefault();attempt(()=>engine.execute(''));$('command-input').focus();}
  else if(event.key.length===1&&!event.ctrlKey&&!event.metaKey){event.preventDefault();$('command-input').value+=event.key;$('command-input').focus();}
});
$('save-drawing').addEventListener('click',()=>attempt(()=>{engine.finish();const text=JSON.stringify(store.document,null,2)+'\n';download(text,'drawing.cadlab.json');saved=JSON.stringify(store.document);log('Düzenlenebilir çizim kaydedildi.');render();}));
$('open-drawing').addEventListener('click',()=>$('drawing-file').click());
$('drawing-file').addEventListener('change',async event=>{
  const file=event.target.files[0];if(!file||requestBusy)return;
  try{
    if(file.size>1024*1024)throw new Error('En fazla 1 MiB çizim dosyası açılabilir.');
    const text=await file.text();let data;
    requestBusy=true;$('open-drawing').disabled=true;
    if(file.name.toLowerCase().endsWith('.dxf')){
      const response=await fetch('/api/drawing/import-dxf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({dxf:text})});
      const result=await response.json();if(!response.ok)throw new Error(result.error||'DXF açılamadı.');
      data=result.drawing;log(`DXF: ${result.report.entities} nesne, mm. Yalnız düzlemsel model geometrisi; kullanılmayan blok tanımları, ek veriler ve pafta ayarları alınmadı.`);
    }else data=JSON.parse(text);
    const next=validateDrawing(data);engine.cancel();store.commit(next);saved=JSON.stringify(store.document);log('Çizim açıldı.');render();fit();
  }catch(error){log(error.message,true);}finally{event.target.value='';requestBusy=false;$('open-drawing').disabled=false;}
});
$('new-drawing').addEventListener('click',()=>{if(saved!==JSON.stringify(store.document)){log('Yeni çizimden önce mevcut çizimi kaydedin.',true);return;}engine.cancel();store.commit(emptyDrawing());saved=JSON.stringify(store.document);store.layer='0';render();fit();});
$('example').addEventListener('click',()=>{if(store.document.entities.length){log('Örneği açmak için boş bir çizime geçin.',true);return;}engine.cancel();const drawing=emptyDrawing();drawing.name='Bağlantı plakası — 2B';drawing.entities=[{id:'outer',type:'polyline',layer:'0',points:[[0,0],[80,0],[80,50],[0,50]],closed:true},...[[10,10],[10,40],[70,10],[70,40]].map((center,i)=>({id:`hole-${i}`,type:'circle',layer:'0',center,radius:2.5}))];store.commit(drawing);log('Örnek çizim: bir kapalı çoklu çizgi ve dört çember.');render();fit();});
$('export-dxf').addEventListener('click',async()=>{if(requestBusy)return;try{engine.finish();requestBusy=true;$('export-dxf').disabled=true;const response=await fetch('/api/drawing/dxf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(store.document)});if(!response.ok){const data=await response.json();throw new Error(data.error||'DXF dışa aktarılamadı.');}download(await response.text(),'drawing.dxf','application/dxf');log('DXF dışa aktarıldı: LINE, LWPOLYLINE ve CIRCLE.');}catch(error){log(error.message,true);}finally{requestBusy=false;$('export-dxf').disabled=false;}});
window.addEventListener('beforeunload',event=>{if(saved!==JSON.stringify(store.document)){event.preventDefault();event.returnValue='';}});
new ResizeObserver(()=>renderGeometry()).observe(canvas);
log('CAD Lab · 2B çizim çekirdeği. Tamamlanmış komutlar, kaydetme ve DXF dışa aktarma.');
log('İlk deneme: REC 0,0 100,60  →  C 20,20 5  →  nesneyi seçip MOVE.');
render();fit();
