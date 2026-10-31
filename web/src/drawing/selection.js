// Analytical window/crossing tests on actual curves, not bounding-box overlap alone.
const EPS=1e-9;
const inside=(p,r)=>p[0]>=r.minX-EPS&&p[0]<=r.maxX+EPS&&p[1]>=r.minY-EPS&&p[1]<=r.maxY+EPS;

function segmentCrosses(a,b,r){
  let low=0,high=1;
  const dx=b[0]-a[0],dy=b[1]-a[1];
  const p=[-dx,dx,-dy,dy],q=[a[0]-r.minX,r.maxX-a[0],a[1]-r.minY,r.maxY-a[1]];
  for(let i=0;i<4;i++){
    if(Math.abs(p[i])<EPS){if(q[i]<-EPS)return false;continue;}
    const t=q[i]/p[i];
    if(p[i]<0)low=Math.max(low,t);else high=Math.min(high,t);
    if(low>high+EPS)return false;
  }
  return true;
}
function segments(entity){
  const pairs=entity.points.slice(1).map((p,i)=>[entity.points[i],p]);
  if(entity.closed)pairs.push([entity.points.at(-1),entity.points[0]]);
  return pairs;
}
export function entitiesInBox(drawing,a,b,crossing=a[0]>b[0]){
  const rect={minX:Math.min(a[0],b[0]),minY:Math.min(a[1],b[1]),maxX:Math.max(a[0],b[0]),maxY:Math.max(a[1],b[1])};
  const editable=new Set(drawing.layers.filter(layer=>layer.visible&&!layer.locked).map(layer=>layer.id));
  return drawing.entities.filter(entity=>{
    if(!editable.has(entity.layer))return false;
    if(entity.type==='circle'){
      const [x,y]=entity.center,r=entity.radius;
      if(!crossing)return inside([x-r,y-r],rect)&&inside([x+r,y+r],rect);
      const closest=[Math.max(rect.minX,Math.min(rect.maxX,x)),Math.max(rect.minY,Math.min(rect.maxY,y))];
      const min=Math.hypot(x-closest[0],y-closest[1]);
      const max=Math.hypot(Math.max(Math.abs(x-rect.minX),Math.abs(x-rect.maxX)),Math.max(Math.abs(y-rect.minY),Math.abs(y-rect.maxY)));
      return min<=r+EPS&&max>=r-EPS;
    }
    return crossing?segments(entity).some(([p,q])=>segmentCrosses(p,q,rect)):entity.points.every(p=>inside(p,rect));
  }).map(entity=>entity.id);
}
